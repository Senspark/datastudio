const AsyncLock = require('async-lock');
const fs = require('fs');

const EE = require('../EE');

const filename = 'VUNGLE';
const CACHE_DURATION = 6 * 60 * 60;
const LOCK_DURATION = 60 * 1000;

const DIMENSION_APPLICATION = 'application';
const DIMENSION_PLACEMENT = 'placement';
const DIMENSION_DATE = 'date';
const DIMENSION_COUNTRY = 'country_iso_code';

class Vungle {
  static mapQuery(name) {
    if (name === DIMENSION_COUNTRY) {
      return 'country';
    }

    return name;
  }

  static mapHeader(name) {
    if (name === 'application name') {
      return DIMENSION_APPLICATION;
    }
    if (name === 'country') {
      return DIMENSION_COUNTRY;
    }
    if (name === 'placement name') {
      return DIMENSION_PLACEMENT;
    }
    return name;
  }

  static formatUrl(dimensions, metrics, since, until) {
    let url;
    const format = [
      'https://report.api.vungle.com/ext/pub/reports/performance',
      `?start=${EE.formatDate(since)}`,
      `&end=${EE.formatDate(until)}`,
      `&aggregates=${metrics.join(',')}`,
    ].join('');

    if (dimensions.length > 0) {
      url = `${format}&dimensions=${dimensions.join(',')}`;
    }
    return url;
  }

  static async downloadData(apiKey, url) {
    const options = {
      headers: {
        Authorization: (`Bearer ${apiKey}`),
        Accept: 'application/json',
        'Vungle-Version': '1',
      },
    };

    const response = await EE.sendHttpGET(url, options);
    const result = await response.json();
    return result;
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

  static async requestHttp(apiKey, dimensions, metrics, since, until, useCache) {
    const url = this.formatUrl(
      dimensions.map(this.mapQuery),
      metrics.map(this.mapQuery),
      since,
      until,
    );
    const key = EE.hash(this.buildKey(apiKey, dimensions, metrics));
    const retrieveData = await this.retrieveData(key, apiKey, url, useCache);
    const parseData = this.parseData(retrieveData);
    return parseData;
  }

  static async retrieveData(key, apiKey, url, useCache) {
    let data;
    const lock = new AsyncLock({
      timeout: LOCK_DURATION,
    });
    const result = await lock.acquire('key', async () => {
      const cache = EE.cache();
      const value = useCache ? cache.get(key) : null;
      if (value !== null) {
        // const readFile = fs.readFileSync(`./cache/${filename}.txt`, 'utf8');
        const readFile = fs.readFileSync(`../cache/${filename}.txt`, 'utf8');
        const decompressed = await EE.decompress(readFile);
        data = JSON.parse(decompressed);
      } else {
        data = await this.downloadData(apiKey, url);
        const compressed = await EE.compress(JSON.stringify(data));
        fs.writeFile(`./cache/${filename}.txt`, compressed, (err) => {
          if (err) throw err;
        });
        cache.put(key, filename, CACHE_DURATION);
      }
      return data;
    });
    return result;
  }

  static parseData(data) {
    const rows = [];
    data.forEach((item) => {
      const dict = {};
      Object.keys(item).forEach((key) => {
        const header = this.mapHeader(key);
        let value = item[key];
        if (header === DIMENSION_DATE) {
          value = EE.parseDate(value);
        }
        dict[header] = value;
      });
      rows.push(dict);
    });
    return rows;
  }
}

module.exports = Vungle;
