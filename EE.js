const csv = require('csvtojson');
const zlib = require('zlib');
const crypto = require('crypto');
const memoryCache = require('memory-cache');
const fetch = require('node-fetch');

// Date.prototype.addDays = function(days) {
//   // https://stackoverflow.com/questions/10849676/date-without-daylight-savings-time
//   // Ignore DST.
//   var dat = new Date(this.valueOf());
//   // dat.setUTCDate(dat.getUTCDate() + days);
//   dat.setDate(dat.getDate() + days);
//   return dat;
// }

const rates = {
  AED: 3.672779,
  AFN: 68.6405,
  ALL: 113.870281,
  AMD: 483.199952,
  ANG: 1.782151,
  AOA: 165.9235,
  ARS: 17.485,
  AUD: 1.32158,
  AWG: 1.786833,
  AZN: 1.6985,
  BAM: 1.665836,
  BBD: 2,
  BDT: 83.71394,
  BGN: 1.667055,
  BHD: 0.377546,
  BIF: 1756.05,
  BMD: 1,
  BND: 1.354839,
  BOB: 6.923968,
  BRL: 3.2588,
  BSD: 1,
  BTC: 0.000122420051,
  BTN: 64.777708,
  BWP: 10.49865,
  BYN: 2.003853,
  BZD: 2.012549,
  CAD: 1.277066,
  CDF: 1574.900794,
  CHF: 0.990804,
  CLF: 0.02354,
  CLP: 636.9,
  CNH: 6.626488,
  CNY: 6.6274,
  COP: 3010.6,
  CRC: 567.170059,
  CUC: 1,
  CUP: 25.5,
  CVE: 94.2,
  CZK: 21.7205,
  DJF: 178.77,
  DKK: 6.339382,
  DOP: 47.502313,
  DZD: 114.9445,
  EGP: 17.658,
  ERN: 15.117722,
  ETB: 27.216738,
  EUR: 0.851883,
  FJD: 2.085545,
  FKP: 0.754589,
  GBP: 0.754589,
  GEL: 2.482817,
  GGP: 0.754589,
  GHS: 4.612672,
  GIP: 0.754589,
  GMD: 47.375,
  GNF: 9030.65,
  GTQ: 7.307968,
  GYD: 207.42497,
  HKD: 7.811697,
  HNL: 23.558663,
  HRK: 6.443012,
  HTG: 63.582812,
  HUF: 266.875,
  IDR: 13521.545353,
  ILS: 3.516995,
  IMP: 0.754589,
  INR: 64.785,
  IQD: 1166.15,
  IRR: 34769.5,
  ISK: 103.68,
  JEP: 0.754589,
  JMD: 125.865,
  JOD: 0.709001,
  JPY: 112.282,
  KES: 103.345,
  KGS: 69.697314,
  KHR: 4025.1,
  KMF: 419.369527,
  KPW: 900,
  KRW: 1090.83,
  KWD: 0.302195,
  KYD: 0.831957,
  KZT: 330.025,
  LAK: 8309.9,
  LBP: 1505.012443,
  LKR: 153.53,
  LRD: 124.925,
  LSL: 14.069405,
  LYD: 1.368831,
  MAD: 9.452445,
  MDL: 17.442964,
  MGA: 3186.55,
  MKD: 52.4595,
  MMK: 1354.35,
  MNT: 2442.015312,
  MOP: 8.033902,
  MRO: 354.44,
  MUR: 34.05,
  MVR: 15.299677,
  MWK: 725.73,
  MXN: 18.8041,
  MYR: 4.124478,
  MZN: 60.926857,
  NAD: 14.069405,
  NGN: 359.425,
  NIO: 30.72692,
  NOK: 8.2151,
  NPR: 103.647876,
  NZD: 1.464441,
  OMR: 0.384966,
  PAB: 1,
  PEN: 3.2365,
  PGK: 3.207095,
  PHP: 50.635,
  PKR: 105.100178,
  PLN: 3.593721,
  PYG: 5641.6,
  QAR: 3.88375,
  RON: 3.958817,
  RSD: 101.13,
  RUB: 59.147,
  RWF: 836.025,
  SAR: 3.75,
  SBD: 7.836397,
  SCR: 13.415941,
  SDG: 6.666075,
  SEK: 8.432683,
  SGD: 1.354229,
  SHP: 0.754589,
  SLL: 7643.944702,
  SOS: 577.56,
  SRD: 7.448,
  SSP: 130.2634,
  STD: 20902.828205,
  SVC: 8.73616,
  SYP: 515.00999,
  SZL: 14.075088,
  THB: 32.753,
  TJS: 8.801472,
  TMT: 3.509961,
  TND: 2.495799,
  TOP: 2.300612,
  TRY: 3.963122,
  TTD: 6.752557,
  TWD: 29.890766,
  TZS: 2246.75,
  UAH: 26.482759,
  UGX: 3627.25,
  USD: 1,
  UYU: 29.235494,
  UZS: 8072.3,
  VEF: 10.62375,
  VND: 22725.389844,
  VUV: 107.21291,
  WST: 2.548483,
  XAF: 558.798675,
  XAG: 0.0589799,
  XAU: 0.00078134,
  XCD: 2.70255,
  XDR: 0.709918,
  XOF: 558.798675,
  XPD: 0.00099904,
  XPF: 101.656693,
  XPT: 0.00107224,
  YER: 250.294142,
  ZAR: 13.9848,
  ZMW: 10.068823,
  ZWL: 322.355011,
};

// let countryIsoCodes_ = {
//   AF: 'Afghanistan',
//   AX: 'Åland Islands',
//   AL: 'Albania',
//   DZ: 'Algeria',
//   AS: 'American Samoa',
//   AD: 'AndorrA',
//   AO: 'Angola',
//   AI: 'Anguilla',
//   AQ: 'Antarctica',
//   AG: 'Antigua and Barbuda',
//   AR: 'Argentina',
//   AM: 'Armenia',
//   AW: 'Aruba',
//   AU: 'Australia',
//   AT: 'Austria',
//   AZ: 'Azerbaijan',
//   BS: 'Bahamas',
//   BH: 'Bahrain',
//   BD: 'Bangladesh',
//   BB: 'Barbados',
//   BY: 'Belarus',
//   BE: 'Belgium',
//   BZ: 'Belize',
//   BJ: 'Benin',
//   BM: 'Bermuda',
//   BT: 'Bhutan',
//   BO: 'Bolivia',
//   BA: 'Bosnia & Herzegovina',
//   BW: 'Botswana',
//   BV: 'Bouvet Island',
//   BR: 'Brazil',
//   IO: 'British Indian Ocean Territory',
//   BN: 'Brunei Darussalam',
//   BG: 'Bulgaria',
//   BF: 'Burkina Faso',
//   BI: 'Burundi',
//   KH: 'Cambodia',
//   CM: 'Cameroon',
//   CA: 'Canada',
//   CV: 'Cape Verde',
//   KY: 'Cayman Islands',
//   CF: 'Central African Republic',
//   TD: 'Chad',
//   CL: 'Chile',
//   CN: 'China',
//   CX: 'Christmas Island',
//   CC: 'Cocos (Keeling) Islands',
//   CO: 'Colombia',
//   KM: 'Comoros',
//   CG: 'Congo',
//   CD: 'Congo, Democratic Republic',
//   CK: 'Cook Islands',
//   CR: 'Costa Rica',
//   CI: 'Côte d’Ivoire',
//   HR: 'Croatia',
//   CU: 'Cuba',
//   CY: 'Cyprus',
//   CZ: 'Czechia',
//   DK: 'Denmark',
//   DJ: 'Djibouti',
//   DM: 'Dominica',
//   DO: 'Dominican Republic',
//   EC: 'Ecuador',
//   EG: 'Egypt',
//   SV: 'El Salvador',
//   GQ: 'Equatorial Guinea',
//   ER: 'Eritrea',
//   EE: 'Estonia',
//   ET: 'Ethiopia',
//   FK: 'Falkland Islands (Malvinas)',
//   FO: 'Faroe Islands',
//   FJ: 'Fiji',
//   FI: 'Finland',
//   FR: 'France',
//   GF: 'French Guiana',
//   PF: 'French Polynesia',
//   TF: 'French Southern Territories',
//   GA: 'Gabon',
//   GM: 'Gambia',
//   GE: 'Georgia',
//   DE: 'Germany',
//   GH: 'Ghana',
//   GI: 'Gibraltar',
//   GR: 'Greece',
//   GL: 'Greenland',
//   GD: 'Grenada',
//   GP: 'Guadeloupe',
//   GU: 'Guam',
//   GT: 'Guatemala',
//   GG: 'Guernsey',
//   GN: 'Guinea',
//   GW: 'Guinea-Bissau',
//   GY: 'Guyana',
//   HT: 'Haiti',
//   HM: 'Heard Island and Mcdonald Islands',
//   VA: 'Holy See (Vatican City State)',
//   HN: 'Honduras',
//   HK: 'Hong Kong',
//   HU: 'Hungary',
//   IS: 'Iceland',
//   IN: 'India',
//   ID: 'Indonesia',
//   IR: 'Iran',
//   IQ: 'Iraq',
//   IE: 'Ireland',
//   IM: 'Isle of Man',
//   IL: 'Israel',
//   IT: 'Italy',
//   JM: 'Jamaica',
//   JP: 'Japan',
//   JE: 'Jersey',
//   JO: 'Jordan',
//   KZ: 'Kazakhstan',
//   KE: 'Kenya',
//   KI: 'Kiribati',
//   KP: 'Korea (North)',
//   KR: 'South Korea',
//   XK: 'Kosovo',
//   KW: 'Kuwait',
//   KG: 'Kyrgyzstan',
//   LA: 'Laos',
//   LV: 'Latvia',
//   LB: 'Lebanon',
//   LS: 'Lesotho',
//   LR: 'Liberia',
//   LY: 'Libya',
//   LI: 'Liechtenstein',
//   LT: 'Lithuania',
//   LU: 'Luxembourg',
//   MO: 'Macao',
//   MK: 'Macedonia (FYROM)',
//   MG: 'Madagascar',
//   MW: 'Malawi',
//   MY: 'Malaysia',
//   MV: 'Maldives',
//   ML: 'Mali',
//   MT: 'Malta',
//   MH: 'Marshall Islands',
//   MQ: 'Martinique',
//   MR: 'Mauritania',
//   MU: 'Mauritius',
//   YT: 'Mayotte',
//   MX: 'Mexico',
//   FM: 'Micronesia',
//   MD: 'Moldova',
//   MC: 'Monaco',
//   MN: 'Mongolia',
//   MS: 'Montserrat',
//   MA: 'Morocco',
//   MZ: 'Mozambique',
//   MM: 'Myanmar (Burma)',
//   NA: 'Namibia',
//   NR: 'Nauru',
//   NP: 'Nepal',
//   NL: 'Netherlands',
//   AN: 'Netherlands Antilles',
//   NC: 'New Caledonia',
//   NZ: 'New Zealand',
//   NI: 'Nicaragua',
//   NE: 'Niger',
//   NG: 'Nigeria',
//   NU: 'Niue',
//   NF: 'Norfolk Island',
//   MP: 'Northern Mariana Islands',
//   NO: 'Norway',
//   OM: 'Oman',
//   PK: 'Pakistan',
//   PW: 'Palau',
//   PS: 'Palestine',
//   PA: 'Panama',
//   PG: 'Papua New Guinea',
//   PY: 'Paraguay',
//   PE: 'Peru',
//   PH: 'Philippines',
//   PN: 'Pitcairn',
//   PL: 'Poland',
//   PT: 'Portugal',
//   PR: 'Puerto Rico',
//   QA: 'Qatar',
//   RE: 'Reunion',
//   RO: 'Romania',
//   RU: 'Russia',
//   RW: 'Rwanda',
//   SH: 'Saint Helena',
//   KN: 'Saint Kitts and Nevis',
//   LC: 'Saint Lucia',
//   PM: 'Saint Pierre and Miquelon',
//   VC: 'Saint Vincent and the Grenadines',
//   WS: 'Samoa',
//   SM: 'San Marino',
//   ST: 'Sao Tome and Principe',
//   SA: 'Saudi Arabia',
//   SN: 'Senegal',
//   RS: 'Serbia',
//   ME: 'Montenegro',
//   SC: 'Seychelles',
//   SL: 'Sierra Leone',
//   SG: 'Singapore',
//   SK: 'Slovakia',
//   SI: 'Slovenia',
//   SB: 'Solomon Islands',
//   SO: 'Somalia',
//   ZA: 'South Africa',
//   GS: 'South Georgia and the South Sandwich Islands',
//   ES: 'Spain',
//   LK: 'Sri Lanka',
//   SD: 'Sudan',
//   SR: 'Suriname',
//   SJ: 'Svalbard and Jan Mayen',
//   SZ: 'Swaziland',
//   SE: 'Sweden',
//   CH: 'Switzerland',
//   SY: 'Syria',
//   TW: 'Taiwan',
//   TJ: 'Tajikistan',
//   TZ: 'Tanzania',
//   TH: 'Thailand',
//   TL: 'Timor-Leste',
//   TG: 'Togo',
//   TK: 'Tokelau',
//   TO: 'Tonga',
//   TT: 'Trinidad and Tobago',
//   TN: 'Tunisia',
//   TR: 'Turkey',
//   TM: 'Turkmenistan',
//   TC: 'Turks and Caicos Islands',
//   TV: 'Tuvalu',
//   UG: 'Uganda',
//   UA: 'Ukraine',
//   AE: 'United Arab Emirates',
//   GB: 'United Kingdom',
//   US: 'United States',
//   UM: 'United States Minor Outlying Islands',
//   UY: 'Uruguay',
//   UZ: 'Uzbekistan',
//   VU: 'Vanuatu',
//   VE: 'Venezuela',
//   VN: 'Vietnam',
//   VG: 'Virgin Islands, British',
//   VI: 'Virgin Islands, U.S.',
//   WF: 'Wallis and Futuna',
//   EH: 'Western Sahara',
//   YE: 'Yemen',
//   ZM: 'Zambia',
//   ZW: 'Zimbabwe',
//   XW: 'Unknown',
// };

class EE {
  static addDate(days, amount) {
    days.setUTCDate(days.getUTCDate() + amount);
    return days;
  }

  static cache() {
    return memoryCache;
  }

  static treatAsUTC(date) {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() - result.getTimezoneOffset());
    return result;
  }

  //   static daysBetween() {
  //     const millisecondsPerDay = 24 * 60 * 60 * 1000;
  //     return Math.round(
  //   (this.treatAsUTC(endDate) - this.treatAsUTC(startDate)) / millisecondsPerDay);
  //   }

  static getSessionId() {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let timestamp = Date.now();
    let id = '';
    for (let i = 0; i < 8; i += 1) {
      const index = timestamp % CHARS.length;
      id += CHARS[index];
      timestamp = (timestamp - index) / CHARS.length;
    }
    return id.split('').reverse().join('');
  }

  static compressStringToBytes(value) {
    return new Promise((resolve) => {
      zlib.deflate(value, (err, buffer) => {
        resolve(buffer);
      });
    });
  }

  static decompressStringFromBytes(value) {
    return new Promise((resolve) => {
      zlib.inflate(value, (err, buffer) => {
        resolve(buffer.toString('utf8'));
      });
    });
  }

  static async compress(value) {
    const bytes = await this.compressStringToBytes(value);
    const encode = bytes.toString('base64');
    return encode;
  }

  static async decompress(value) {
    const decode = Buffer.from(value, 'base64');
    const bytes = await this.decompressStringFromBytes(decode);
    return bytes;
  }

  static hash(value) {
    const result = crypto.createHash('sha256').update(value).digest('base64');
    return result;
  }

  static joinWithQuote(arr) {
    if (arr.length === 0) {
      return '';
    }
    return `'${arr.join('\',\'')}'`;
  }

  static cloneDict(dict) {
    return JSON.parse(JSON.stringify(dict));
  }

  static csvToJson(text) {
    const result = csv({
      noheader: true,
      output: 'csv',
    }).fromString(text);
    return result;
  }

  static parseDateRange(request) {
    const { dateRange } = request;
    const { startDate, endDate } = dateRange;
    return {
      since: new Date(startDate),
      until: new Date(endDate),
    };
  }

  static async sendHttp(url, options) {
    const response = await fetch(url, options);
    return response;
  }

  static sendHttpGET(url, option) {
    console.log(url);
    const options = option;
    options.method = 'GET';
    return this.sendHttp(url, options);
  }

  static sendHttpPOST(url, option) {
    const options = option;
    options.method = 'POST';
    return this.sendHttp(url, options);
  }

  static parseFields(request, fields) {
    const results = [];
    request.fields.forEach((field) => {
      for (let i = 0; i < fields.length; i += 1) {
        if (fields[i] === field.name) {
          results.push(field.name);
          break;
        }
      }
    });
    return results;
  }

  static parseFieldsInSchema(request, schema) {
    return this.parseFields(
      request,
      schema.map(item => item.name),
    );
  }

  static findSchema(headers, schema) {
    return headers.map(header => schema.find(item => (item === header)));
  }

  static formatDate(date) {
    const dat = new Date(date);
    const year = dat.getFullYear();
    let month = dat.getMonth() + 1;
    let dt = dat.getDate();

    if (dt < 10) {
      dt = `0${dt}`;
    }
    if (month < 10) {
      month = `0${month}`;
    }

    return (`${year}-${month}-${dt}`);
  }

  static parseDate(date) {
    const year = date.substring(0, 4);
    const month = date.substring(5, 7);
    const day = date.substring(8, 10);
    return year + month + day;
  }

  static convertStringToDate(value) {
    if (value.length === 8) {
      // yyyyMMdd.
    }
    const year = value.substring(0, 4);
    const month = value.substring(4, 6);
    const day = value.substring(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }

  static convertData(data, headers) {
    return data.map(item => headers.map(header => item[header]));
  }

  static convertToRows(data) {
    return data.map(item => ({
      values: item,
    }));
  }

  static async getRate(currency) {
    if (currency in rates) {
      return 1.0 / rates[currency];
    }
    const param = `${currency}_USD`;
    const url = [
      'https://free.currencyconverterapi.com/api/v4/convert',
      `?q=${param}`,
      '&compact=ultra',
      '&apiKey=2ec1d277adc18b5f5229',
    ].join('');
    const res = await fetch(url);
    const data = await res.json();
    // var rate = JSON.parse(data.getContentText())[param];
    rates[currency] = 1.0 / data[param];
    return data[param];
  }
}

// const reversedCountryIsoCodeInitializer = (() => {
//   const executed = false;
//   return function() {
//     if (!executed) {
//       executed = true;
//       for (var key in countryIsoCodes_) {
//         reversedCountryIsoCodes_[countryIsoCodes_[key]] = key;
//       }
//     }
//   };
// })();

// var reversedCountryIsoCodes_ = {
// Empty.
// };

// https://gist.github.com/keeguon/2310008
// Used for BigQuery.

module.exports = EE;
