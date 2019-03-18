var http = require('http');
const EE = require('../EE')
const ee = new EE();
const hostName = '127.0.0.1';
const config = require('../config/config');
const port = 3000;
const AsyncLock = require('async-lock');
var LOCK_DURATION = 60 * 1000;
var lock = new AsyncLock({
    timeout: LOCK_DURATION
});

var LOCK_DURATION = 60 * 1000;
var DIMENSION_APPLICATION = 'application';
var DIMENSION_PLACEMENT = 'placement';
var DIMENSION_DATE = 'date';
var DIMENSION_COUNTRY = 'country_iso_code';
var _sessionId = ee.getSessionId();

class Vungle {
    mapQuery(name) {
        if (name == DIMENSION_COUNTRY) {
            return 'country';
        }

        return name;
    }

    mapHeader(name) {
        if (name == 'application name') {
            return DIMENSION_APPLICATION;
        }
        if (name == 'country') {
            return DIMENSION_COUNTRY;
        }
        if (name == 'placement name') {
            return DIMENSION_PLACEMENT;
        }
        return name;
    }

    formatUrl(dimensions, metrics, since, until) {
        var format = [
            `https://report.api.vungle.com/ext/pub/reports/performance`,
            `?start=${ee.formatDate(since)}`,
            `&end=${ee.formatDate(until)}`,
            `&aggregates=${metrics.join(',')}`
        ].join('');

        if (dimensions.length > 0) {
            var url = `${format}&dimensions=${dimensions.join(',')}`;
        }
        return url;
    }

    downloadData(apiKey, url) {
        var options = {
            headers: {
                Authorization: (`Bearer ${apiKey}`),
                Accept: 'application/json',
                'Vungle-Version': '1'
            }
        };

        var result = ee.sendHttpGET(url, options).then(res => {
            return res.json();
        }).then(json => {
            return json;
        });

        return result;
    }

    getSessionId() {
        return _sessionId;
    }

    buildKey(apiKey, dimensions, metrics, since, until) {
        var params = [];
        params.push(apiKey);
        params.extend(dimensions);
        params.extend(metrics);
        params.push(ee.formatDate(since));
        params.push(ee.formatDate(until));
        return params.join('|');
    }

    requestHttp(apiKey, dimensions, metrics, since, until, useCache) {
        var url = this.formatUrl(dimensions.map(this.mapQuery), metrics.map(this.mapQuery), since, until);
        return new Promise((resolve, reject) => {
            // var key = ee.hash(this.buildKey(apiKey, dimensions, metrics, since, until));
            this.retrieveData(`key`, apiKey, url).then((data) => {
                var parsedData = this.parseData(data);
                resolve(parsedData);
            });
        });
    }

    mapHeader(name) {
        if (name == 'application name') {
            return DIMENSION_APPLICATION;
        }
        if (name == 'country') {
            return DIMENSION_COUNTRY;
        }
        if (name == 'placement name') {
            return DIMENSION_PLACEMENT;
        }
        return name;
    }

    retrieveData(key, apiKey, url) {
        var data = undefined;
        lock.acquire(key, (done) => {
            data = this.downloadData(apiKey, url).then(result => {
                done();
                return result;
            }).catch((error) => {
                console.log("Error " + error);
                done();
            });
        }, (err, ret) => {})
        return data;
    }

    parseData(data) {
        var rows = [];
        data.forEach(item => {
            var dict = {};
            Object.keys(item).forEach(key => {
                var header = this.mapHeader(key);
                var value = item[key];
                if (header == DIMENSION_DATE) {
                    value = ee.parseDate(value);
                }
                dict[header] = value;
            });
            rows.push(dict);
        });
        return rows;
    }
}

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-type', 'text/plan');
    res.end('Yay Me\n');
});

server.listen(port, hostName, () => {
    console.log(`Server running at http:// ${hostName}:${port}/`);
});

function __testVungle() {
    const dimensions = ["application", "date"];
    const VUNGLE_KEY = config.CONFIG_VUNGLE_API_KEY;
    const metrics = ["revenue"]
    const since = `2019-02-17`;
    const until = `2019-03-18`;
    var vungle = new Vungle();
    var data = vungle.requestHttp(VUNGLE_KEY, dimensions, metrics, since, until, true);
    data.then((data) => {
        console.log(data);
    }).catch(error => {
        console.log("error " + error);
    });
}

__testVungle();
module.exports = Vungle;