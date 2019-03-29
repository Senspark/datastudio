const AsyncLock = require('async-lock');
const EE = require('../EE');

const LOCK_DURATION = 60 * 1000;
const CACHE_DURATION = 6 * 60 * 60;

// const DIMENSION_AD_CLIENT_ID = 'AD_CLIENT_ID';
// const DIMENSION_AD_UNIT_ID = 'AD_UNIT_ID';
// const DIMENSION_AD_UNIT_NAME = 'AD_UNIT_NAME';
// const DIMENSION_APP_NAME = 'APP_NAME';
// const DIMENSION_APP_ID = 'APP_ID';
// const DIMENSION_APP_PLATFORM = 'APP_PLATFORM';
const DIMENSION_COUNTRY_CODE = 'country_iso_code';
const DIMENSION_DATE = 'DATE';
// const DIMENSION_MONTH = 'MONTH';
// const DIMENSION_WEEK = 'WEEK';
// const METRIC_CLICKS = 'CLICKS';
// const METRIC_EARNINGS = 'EARNINGS';
// const METRIC_MATCHED_AD_REQUESTS = 'MATCHED_AD_REQUESTS';
// const METRIC_REACHED_AD_REQUESTS = 'REACHED_AD_REQUESTS';
// const METRIC_VIEWED_IMPRESSIONS = 'VIEWED_IMPRESSIONS';
// const METRIC_REACHED_AD_REQUESTS_MATCH_RATE = 'REACHED_AD_REQUESTS_MATCH_RATE';
// const METRIC_REACHED_AD_REQUESTS_SHOW_RATE = 'REACHED_AD_REQUESTS_SHOW_RATE';

class AdSense {
  static mapQuery(name) {
    if (name === DIMENSION_COUNTRY_CODE) {
      return 'COUNTRY_CODE';
    }
    return name;
  }

  static mapHeader(name) {
    if (name === 'COUNTRY_CODE') {
      return DIMENSION_COUNTRY_CODE;
    }
    return name;
  }

  static downloadData(dimensions, metrics, since, until) {
    const report = AdSense.Reports.generate(
      EE.formatDate(since),
      EE.formatDate(until), {
        dimension: dimensions.map(this.mapQuery),
        metric: metrics.map(this.mapQuery),
        fields: 'headers,rows',
      },
    );
    return JSON.stringify(report);
  }


  static async retrieveData(key, dimensions, metrics, since, until, useCache) {
    let data;
    const lock = new AsyncLock({ timeout: LOCK_DURATION });
    const result = await lock.acquire('key', async () => {
      const cache = EE.cache();
      const value = useCache ? cache.get(key) : null;
      if (value !== null) {
        data = EE.compress(value);
      } else {
        data = await this.downloadData(dimensions, metrics, since, until);
        const compressed = EE.compress(data);
        cache.put(key, compressed, CACHE_DURATION);
      }
      return JSON.parse(data);
    });
    return result;
  }

  static parseData(data) {
    let rows = [];
    if (data.rows) {
      const headers = data.headers;
      rows = data.rows.map((item) => {
        const dict = {};
        for (let i = 0; i < headers.length; ++i) {
          const header = this.mapHeader(headers[i].name);
          let value = item[i];
          if (header === DIMENSION_DATE) {
            value = EE.parseDate(value);
          }
          dict[header] = value;
        }
        return dict;
      });
    }
    return rows;
  }

  static buildKey(token, dimensions, metrics, since, until) {
    // Todo: find the way to get token
    const params = [
      token,
      ...dimensions,
      ...metrics,
      EE.formatDate(since),
      EE.formatDate(until),
    ];
    return params.join('|');
  }

  static async requestHttp(token, dimensions, metrics, since, until, useCache) {
    const key = EE.hash(this.buildKey(token, dimensions, metrics, since, until));
    const data = await this.retrieveData(key, dimensions, metrics, since, until, useCache);
    const parsedData = this.parseData(data);
    return parsedData;
  }
}

module.exports = AdSense;
