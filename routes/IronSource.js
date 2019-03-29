const express = require('express');
const IronSource = require('../model/IronSource');

const router = express.Router();

router.get('/', (req, res) => {
  const username = req.query.username;
  const key = req.query.key;
  let dimensions = req.query.dimensions;
  let metrics = req.query.metrics;
  const since = req.query.since;
  const until = req.query.until;
  const useCache = (req.query.useCache === 'true');
  dimensions = dimensions.split(',');
  metrics = metrics.split(',');

  const data = IronSource.requestHttp(username, key, dimensions, metrics, since, until, useCache);
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
