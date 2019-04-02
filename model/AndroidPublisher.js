const fetch = require('node-fetch');
const fs = require('fs');
const AsyncLock = require('async-lock');
const AdmZip = require('adm-zip');
const EE = require('../EE');

const filename = 'ANDROIDPUBLISHER';
const LOCK_DURATION = 60 * 1000;
const CACHE_DURATION = 6 * 60 * 60;

const DIMENSION_DATE = 'date';
const DIMENSION_TRANSACTION_TYPE = 'type';
const DIMENSION_PRODUCT_TITLE = 'product_title';
const DIMENSION_PRODUCT_ID = 'product_id';
const DIMENSION_PRODUCT_TYPE = 'product_type';
const DIMENSION_SKU_ID = 'sku';
const DIMENSION_BUYER_COUNTRY = 'country_iso_code';
const METRIC_AMOUNT = 'amount';

class AndroidPublisher {
  static createOptionsFromToken(accessToken) {
    const options = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
    return options;
  }

  static createOption(token) {
    return this.createOptionsFromToken(token);
  }

  static createZipOption(token) {
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip',
      },
    };
    // console.log(options);
    return options;
  }

  static mapHeaderIndex(name) {
    if (name === DIMENSION_DATE) {
      return 1;
    }
    if (name === DIMENSION_TRANSACTION_TYPE) {
      return 3;
    }
    if (name === DIMENSION_PRODUCT_TITLE) {
      return 5;
    }
    if (name === DIMENSION_PRODUCT_ID) {
      return 6;
    }
    if (name === DIMENSION_PRODUCT_TYPE) {
      return 7;
    }
    if (name === DIMENSION_SKU_ID) {
      return 8;
    }
    if (name === METRIC_AMOUNT) {
      return 12;
    }
    if (name === DIMENSION_BUYER_COUNTRY) {
      return 16;
    }
    return name;
  }

  static formatObjectsListUrl(bucketId) {
    const format = [
      'https://www.googleapis.com/storage/v1',
      `/b/${bucketId}`,
      '/o',
      '?prefix=sales',
      '&fields=items(name,mediaLink)',
    ].join('');
    // console.log(format);
    return format;
  }

  static parseReportDateRange(name) {
    // name format: earnings/earnings_yyyyMM_xxxxxxxxxxxxxxxx-n.zip
    // name format: sales/salesreport_yyyyMM.zip
    const year = parseInt(name.substring(18, 22), 10);
    const month = parseInt(name.substring(22, 24), 10);
    const since = new Date(Date.UTC(year, month - 1, 1));
    const until = new Date(Date.UTC(year, month, 0));
    return {
      since,
      until,
    };
  }

  static async parseData(token, data, headers, since, until) {
    const rows = [];
    // const parseReportDateRange  = this.parseReportDateRange;
    if (data.items) {
      const { items } = data;
      await Promise.all(items.map(async (item) => {
        const reportRange = this.parseReportDateRange(item.name);
        const reportSince = reportRange.since;
        const reportUntil = reportRange.until;
        if (!(since <= reportUntil && reportSince <= until)) {
          return;
        }
        const option = this.createZipOption(token);
        const res = await fetch(item.mediaLink, option);
        const buffer = await res.buffer();
        const admzip = new AdmZip(buffer);
        const zipEntries = admzip.getEntries();
        const unzipData = admzip.readAsText(zipEntries[0]);
        const dataRows = await EE.csvToJson(unzipData);
        dataRows.forEach(async (row) => {
          const date = new Date(row[this.mapHeaderIndex(DIMENSION_DATE)]);
          if (!(since <= date && date <= until)) {
            // Out of range.
            return;
          }
          const dict = {};
          headers.map(async (header) => {
            let value = row[this.mapHeaderIndex(header)];
            if (header === DIMENSION_DATE) {
              value = EE.parseDate(value);
            }
            if (header === METRIC_AMOUNT) {
              value = value.replace(/,/g, '');
              const discount = value * 0.7;
              const currency = row[9];
              const rate = await EE.getRate(currency);
              value = value * rate * discount;
            }
            dict[header] = value;
          });
          rows.push(dict);
        });
      }));
    }
    return rows;
  }

  static buildKey(token, bucketId, dimensions, metrics, since, until) {
    let params = [];
    params = [
      token,
      bucketId,
      ...dimensions,
      ...metrics,
      EE.formatDate(since),
      EE.formatDate(until),
    ];
    return params.join('|');
  }

  static async retrieveData(url, token) {
    const options = this.createOption(token);
    const response = await EE.sendHttpGET(url, options);
    const result = await response.json();
    return result;
  }

  static async requestHttp(token, bucketId, dimensions, metrics, since, until, useCache) {
    let parsedData;
    const lock = new AsyncLock({
      timeout: LOCK_DURATION,
    });
    const result = await lock.acquire('key', async () => {
      const buildKey = this.buildKey(token, bucketId, dimensions, metrics, since, until, useCache);
      const key = EE.hash(buildKey);
      const cache = EE.cache();
      const value = useCache ? cache.get(key) : null;
      if (value !== null) {
        // const data = await EE.decompress(value);
        // parsedData = JSON.parse(data);
        const readFile = fs.readFileSync(`./cache/${filename}.txt`, 'utf8');
        const decompressed = await EE.decompress(readFile);
        parsedData = JSON.parse(decompressed);
      } else {
        const url = this.formatObjectsListUrl(bucketId);
        const data = await this.retrieveData(url, token);
        const headers = dimensions.concat(metrics);
        parsedData = await this.parseData(token, data, headers, since, until);
        const raw = JSON.stringify(parsedData);
        const compress = await EE.compress(raw);
        fs.writeFile(`./cache/${filename}.txt`, compress, (err) => {
          if (err) throw err;
        });
        cache.put(key, filename, CACHE_DURATION);
      }
      return parsedData;
    });
    return result;
  }
}
module.exports = AndroidPublisher;
