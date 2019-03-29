const express = require('express');
const FacebookAds = require('../model/FacebookAd');

const router = express.Router();

router.get('/', (req, res) => {
  let appIds = req.query.appIds;
  const token = req.query.token;
  let dimensions = req.query.dimensions;
  let metrics = req.query.metrics;
  const since = new Date(req.query.since);
  const until = new Date(req.query.until);
  const useCache = (req.query.useCache === 'true');
  appIds = appIds.split(',');
  dimensions = dimensions.split(',');
  metrics = metrics.split(',');

  const data = FacebookAds.requestHttp(appIds, token, dimensions, metrics, since, until, useCache);
  data.then((result) => {
    if (result === null) {
      res.status(404).json({
        data: 'cannot get data',
      });
    } else {
      res.status(200).json({
        response: result,
      });
    }
  });
});

module.exports = router;
