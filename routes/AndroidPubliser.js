const express = require('express');
const AndroidPublisher = require('../model/AndroidPublisher');

const router = express.Router();

router.get('/', (req, res) => {
  const bucketId = req.query.bucketId;
  const token = req.query.token;
  let dimensions = req.query.dimensions;
  let metrics = req.query.metrics;
  const since = new Date(req.query.since);
  const until = new Date(req.query.until);
  const useCache = (req.query.useCache === 'true');
  dimensions = dimensions.split(',');
  metrics = metrics.split(',');

  const data = AndroidPublisher.requestHttp(
    token,
    bucketId,
    dimensions,
    metrics,
    since,
    until,
    useCache,
  );
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
