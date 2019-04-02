const AsyncLock = require('async-lock');
const fs = require('fs');
const EE = require('../EE');

const LOCK_DURATION = 60 * 1000;
const CACHE_DURATION = 6 * 60 * 60;
const filename = 'IRONSOURCE';

const DIMENSION_DATE = 'date';
const DIMENSION_APP = 'app';
const DIMENSION_COUNTRY = 'country_iso_code';
const DIMENSION_AD_SOURCE = 'adSource';

class IronSource {
  static mapQuery(name) {
    if (name === DIMENSION_COUNTRY) {
      return 'country';
    }
    return name;
  }

  static mapHeader(name) {
    if (name === 'countryCode') {
      return DIMENSION_COUNTRY;
    }
    if (name === 'appName') {
      return DIMENSION_APP;
    }
    if (name === 'providerName') {
      return DIMENSION_AD_SOURCE;
    }
    return name;
  }

  static formatUrl(dimensions, metrics, since, until) {
    const url = [
      'https://platform.ironsrc.com/partners/publisher/mediation/applications/v3/stats',
      `?startDate=${EE.formatDate(since)}`,
      `&endDate=${EE.formatDate(until)}`,
      `&breakdowns=${dimensions.join(',')}`,
      `&metrics=${metrics.join(',')}`,
    ].join('');
    return url;
  }

  static async downloadData(username, secretKey, url) {
    const encoded = Buffer.from(`${username}:${secretKey}`).toString('base64');
    const options = {
      headers: {
        Authorization: `Basic ${encoded}`,
      },
    };
    const response = await EE.sendHttpGET(url, options);
    const result = await response.text();
    const data = JSON.parse(result);
    return data;
  }

  static async retrieveData(key, username, secretKey, url, useCache) {
    let data;
    const lock = new AsyncLock({ timeout: LOCK_DURATION });
    const result = await lock.acquire('key', async () => {
      const cache = EE.cache();
      const value = useCache ? cache.get(key) : null;
      if (value !== null) {
        const readFile = fs.readFileSync(`./cache/${filename}.txt`, 'utf8');
        const decompressed = await EE.decompress(readFile);
        data = JSON.parse(decompressed);
      } else {
        data = await this.downloadData(username, secretKey, url);
        const compressed = await EE.compress(JSON.stringify(data));
        fs.writeFile(`./cache/${filename}.txt`, compressed, (err) => {
          if (err) throw err;
        });
        cache.put(key, 'IRONSOURE', CACHE_DURATION);
      }
      return data;
    });
    return result;
  }

  static parseData(data) {
    const mapHeader = this.mapHeader;
    const parsedData = [];
    if (data) {
      // May return empty data.

      data.forEach((item) => {
        item.data.forEach((subItem) => {
          const parsedItem = {};
          Object.keys(item).forEach((key) => {
            if (key !== 'data') {
              const header = mapHeader(key);
              let value = item[key];
              if (header === DIMENSION_DATE) {
                value = EE.parseDate(value);
              }
              parsedItem[header] = value;
            }
          });
          Object.keys(subItem).forEach((key) => {
            const header = mapHeader(key);
            parsedItem[header] = subItem[key];
          });
          parsedData.push(parsedItem);
        });
      });
    }
    return parsedData;
  }

  static buildKey(username, secretKey, dimensions, metrics, since, until) {
    const params = [
      username,
      secretKey,
      ...dimensions,
      ...metrics,
      EE.formatDate(since),
      EE.formatDate(until),
    ];
    return params.join('|');
  }

  static async requestHttp(username, secretKey, dimensions, metrics, since, until, useCache) {
    const url = this.formatUrl(
      dimensions.map(this.mapQuery),
      metrics.map(this.mapQuery),
      since,
      until,
    );
    const key = EE.hash(this.buildKey(username, secretKey, dimensions, metrics, since, until));
    const data = await this.retrieveData(key, username, secretKey, url, useCache);
    const parsedData = this.parseData(data);
    return parsedData;
  }
}

module.exports = IronSource;
