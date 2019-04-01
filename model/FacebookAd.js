const sleep = require('sleep');
const fs = require('fs');
const AsyncLock = require('async-lock');

const EE = require('../EE');

const filename = 'FACEBOOKADS';
const LOCK_DURATION = 60 * 1000;
const CACHE_DURATION = 6 * 60 * 60;

const DIMENSION_COUNTRY = 'country_iso_code';
const DIMENSION_DATE = 'date';

class FacebookAd {
  static mapQuery(name) {
    if (name === DIMENSION_COUNTRY) {
      return 'country';
    }
    return name;
  }

  static mapHeader(name) {
    if (name === 'country') {
      return DIMENSION_COUNTRY;
    }
    return name;
  }

  static addDay(date) {
    const result = new Date(date);
    result.setDate(result.getDate() + 1);
    return result;
  }

  static formatQueryUrl(appId, accessToken, breakdowns, metrics, since, until) {
    const format = [
      'https://graph.facebook.com',
      `/v${2.11}`,
      `/${appId}`,
      '/adnetworkanalytics',
      `?access_token=${accessToken}`,
      `&breakdowns=[${EE.joinWithQuote(breakdowns)}]`,
      `&metrics=[${EE.joinWithQuote(metrics)}]`,
      `&since=${EE.formatDate(since)}`,
      `&until=${EE.formatDate(until)}`,
      '&aggregation_period=day',
    ].join('');

    return format;
  }

  static formatQueryResultUrl(appId, accessToken, queryIds) {
    const format = [
      'https://graph.facebook.com',
      `/v${2.11}`,
      `/${appId}`,
      '/adnetworkanalytics_results',
      `?query_ids=[${EE.joinWithQuote(queryIds)}]`,
      `&access_token=${accessToken}`,
    ].join('');
    return format;
  }

  static async retrieveQueryId(url) {
    const response = await EE.sendHttpPOST(url, {});
    const text = await response.text();
    const dict = JSON.parse(text);
    const result = dict.query_id;
    return result;
  }

  static async retrieveData(url) {
    const response = await EE.sendHttpGET(url, {});
    const text = await response.text();
    const dict = JSON.parse(text);
    return dict.data;
    // Format:
    // {
    //   "data": [{
    //     "query_id": "xxxx",
    //     "status": "invalid"
    //   }, {
    //     "query_id": "xxxx",
    //     "status": "requested"
    //   }, {
    //     "query_id": "xxxx",
    //     "status": "running",
    //   }, {
    //     "query_id": "xxxx",
    //     "status": "complete",
    //     "results": [{
    //       "time": "yyyy-MM-ddThh:mm:ss+xxx",
    //       "metric": "xxxx",
    //       "breakdowns: [{
    //         "key": "xxxx",
    //         "value": "xxxx"
    //       }],
    //       "value": "xxxx"
    //     }]
    //   }]
    // }
  }

  static parseUrl(appIds, accessToken, dimensionsWithoutDate, metrics, localSince, next) {
    const link = (appIds.map(appId => this.formatQueryUrl(
      appId,
      accessToken,
      dimensionsWithoutDate.map(this.mapQuery),
      metrics,
      this.addDay(localSince),
      this.addDay(next),
    )));
    return link;
  }

  static async retrieveQueryIds(appIds, accessToken, dimensions, metrics, since, until, maxRange) {
    const dimensionsWithoutDate = dimensions.filter(item => item !== DIMENSION_DATE);
    const urls = [];
    while (since < until) {
      let next = new Date(since.toString());
      next.setDate(next.getDate() + maxRange);
      if (next > until) {
        next = until;
      }
      urls.push(...this.parseUrl(appIds, accessToken, dimensionsWithoutDate, metrics, since, next));
      since = new Date(next);
      since.setDate(since.getDate() + 1);
    }

    // console.log(urls.length);
    const queryIds = await Promise.all(urls.map(url => this.retrieveQueryId(url)));
    return queryIds;
  }

  static async retrieveRawData(appId, accessToken, queryIds, maxAttempts, sleepDuration) {
    let attempts = 0;
    let results = [];
    while (queryIds.length > 0 && attempts < maxAttempts) {
      sleep.sleep(sleepDuration);
      ++attempts;
      const queriedIds = [];
      await Promise.all(queryIds.map(async (queryId) => {
        const url = this.formatQueryResultUrl(appId, accessToken, [queryId]);

        const data = await this.retrieveData(url);
        data.forEach((item) => {
          const id = item.query_id;
          const status = item.status;
          if (status === 'complete' || status === 'invalid') {
            queriedIds.push(id);
            if (status === 'complete') {
              if ('results' in item) {
                results = [...results, ...item.results];
              }
            }
          }
        });

        return queryId;
      }));

      queriedIds.forEach((queryId) => {
        // Remove from the queue
        const index = queryIds.indexOf(queryId);
        queryIds.splice(index, 1);
      });
    }
    return results;
  }

  static parseData(data, useDate, metrics) {
    data.sort((lhs, rhs) => {
      if (lhs.time !== rhs.time) {
        return lhs.time < rhs.time ? -1 : 1;
      }
      if ('breakdowns' in lhs) {
        const lhsBreakdowns = JSON.stringify(lhs.breakdowns);
        const rhsBreakdowns = JSON.stringify(rhs.breakdowns);
        if (lhsBreakdowns !== rhsBreakdowns) {
          return lhsBreakdowns < rhsBreakdowns ? -1 : 1;
        }
      }
      if (lhs.metric !== rhs.metric) {
        return lhs.metric < rhs.metric ? -1 : 1;
      }
      return 0;
    });

    const parsedData = [];
    for (let i = 0; i < data.length; i += metrics.length) {
      const dict = {};
      const item = data[i];
      if (useDate) {
        dict[DIMENSION_DATE] = EE.parseDate(item.time);
      }
      if ('breakdowns' in item) {
        item.breakdowns.forEach((breakdown) => {
          const header = this.mapHeader(breakdown.key);
          const value = { breakdown };
          dict[header] = value;
        });
      }
      for (let j = 0; j < metrics.length; j += 1) {
        const k = i + j;
        const metric = this.mapHeader(data[k].metric);
        const currentData = data[k];
        const value = { currentData };
        dict[metric] = value;
      }
      parsedData.push(dict);
    }

    return parsedData;
  }

  static buildKey(appIds, accessToken, dimensions, metrics, since, until) {
    const params = [
      ...appIds,
      accessToken,
      ...dimensions,
      ...metrics,
      EE.formatDate(since),
      EE.formatDate(until),
    ];
    return params.join('|');
  }

  static async requestHttp(appIds, accessToken, dimensions, metrics, since, until, useCache) {
    let parsedData;
    const lock = new AsyncLock({
      timeout: LOCK_DURATION,
    });
    const result = await lock.acquire('key', async () => {
      const key = EE.hash(this.buildKey(
        appIds,
        accessToken,
        dimensions,
        metrics,
        since,
        until,
        useCache,
      ));

      const cache = EE.cache();
      const value = useCache ? cache.get(key) : null;
      if (value !== null) {
        const readFile = fs.readFileSync(`../cache/${filename}.txt`, 'utf8');
        const decompressed = await EE.decompress(readFile);
        parsedData = JSON.parse(decompressed);
      } else {
        const queryIds = await this.retrieveQueryIds(
          appIds,
          accessToken,
          dimensions,
          metrics,
          since,
          until,
          7,
        );
        const data = await this.retrieveRawData(appIds[0], accessToken, queryIds, 10, 1);
        const useDate = dimensions.includes(DIMENSION_DATE);
        parsedData = this.parseData(data, useDate, metrics);
        const raw = JSON.stringify(parsedData);
        const compressed = await EE.compress(raw);
        fs.writeFile(`../cache/${filename}.txt`, compressed, (err) => {
          if (err) throw err;
        });
        cache.put(key, filename, CACHE_DURATION);
      }
      return parsedData;
    });
    return result;
  }
}

module.exports = FacebookAd;
