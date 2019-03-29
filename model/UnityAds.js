const csv = require('csvtojson');
const AsyncLock = require('async-lock');
const EE = require('../EE');

const LOCK_DURATION = 60 * 1000;
const CACHE_DURATION = 6 * 60 * 60;

const DIMENSION_DATE = 'date';
const DIMENSION_SOURCE = 'source';
const DIMENSION_PLATFORM = 'platform';
const DIMENSION_ZONE = 'zone';
const DIMENSION_COUNTRY = 'country_iso_code';
// const METRIC_AD_REQUESTS = 'adrequests';
// const METRIC_AVAILABLE = 'available';
// const METRIC_STARTED = 'started';
// const METRIC_VIEWS = 'views';
// const METRIC_REVENUE = 'revenue';

class UnityAds {
  static mapQuery(name) {
    if (name === DIMENSION_COUNTRY) {
      return 'country';
    }
    if (name === DIMENSION_PLATFORM) {
      return DIMENSION_SOURCE;
    }
    return name;
  }

  static mapHeader(name) {
    if (name === 'Date') {
      return DIMENSION_DATE;
    }
    if (name === 'Source game name') {
      return DIMENSION_SOURCE;
    }
    if (name === 'Source game id') {
      return DIMENSION_PLATFORM;
    }
    if (name === 'Source zone') {
      return DIMENSION_ZONE;
    }
    if (name === 'Country code') {
      return DIMENSION_COUNTRY;
    }
    return name;
  }

  static formatUrl(apiKey, dimensions, metrics, since, until) {
    const url = [
      'https://gameads-admin.applifier.com/stats/monetization-api',
      `?apikey=${apiKey}`,
      `&splitBy=${dimensions.join(',')}`,
      `&fields=${metrics.join(',')}`,
      '&scale=day',
      `&start=${EE.formatDate(since)}`,
      `&end=${EE.formatDate(until)}T23:59:59.999Z`,
    ].join('');
    return url;
  }

  static async downloadData(url) {
    const options = {};
    const response = await EE.sendHttpGET(url, options);
    const csvToJson = await response.text();
    const result = await csv({
      noheader: true,
      output: 'csv',
    }).fromString(csvToJson);
    return result;
  }

  static async retrieveData(key, url, useCache) {
    let data;
    const lock = new AsyncLock({ timeout: LOCK_DURATION });
    const result = await lock.acquire('key', async () => {
      const cache = EE.cache();
      const value = useCache ? cache.get(key) : null;
      if (value !== null) {
        const decompressed = await EE.decompress(value);
        data = JSON.parse(decompressed);
      } else {
        data = await this.downloadData(url);
        const compressed = await EE.compress(JSON.stringify(data));
        cache.put(key, compressed, CACHE_DURATION);
      }
      return data;
    });
    return result;
  }

  static parseData(data, androidIds, iosIds) {
    const headers = data[0].map(this.mapHeader);
    const rows = [];
    for (let i = 1; i < data.length; i += 1) {
      const dict = {};
      for (let j = 0; j < headers.length; j += 1) {
        const header = headers[j];
        let value = data[i][j];
        if (header === DIMENSION_DATE) {
          value = EE.parseDate(value);
        }
        if (header === DIMENSION_PLATFORM) {
          if (androidIds.includes(value)) {
            value = 'Android';
          } else if (iosIds.includes(value)) {
            value = 'iOS';
          } else {
            value = 'Unknown platform';
          }
        }
        dict[header] = value;
      }
      rows.push(dict);
    }
    return rows;
  }

  static buildKey(apiKey, dimensions, metrics, since, until) {
    const params = [
      apiKey,
      ...dimensions,
      ...metrics,
      EE.formatDate(since),
      EE.formatDate(until),
    ];
    return params.join('|');
  }

  static async requestHttp(
    apiKey,
    androidIds,
    iosIds,
    dimensions,
    metrics,
    since,
    until,
    useCache,
  ) {
    const url = this.formatUrl(
      apiKey,
      dimensions.map(this.mapQuery),
      metrics.map(this.mapQuery),
      since,
      until,
    );
    const key = EE.hash(this.buildKey(apiKey, dimensions, metrics, since, until));
    const retrieveData = await this.retrieveData(key, url, useCache);
    const parseData = this.parseData(retrieveData, androidIds, iosIds);
    return parseData;
  }
}

module.exports = UnityAds;
