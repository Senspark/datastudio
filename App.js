const express = require('express');

const app = express();
const vungleRoutes = require('./routes/Vungle');
const ironSourceRoutes = require('./routes/IronSource');
const unityAdsRoutes = require('./routes/UnityAds');
const facebookAdsRoutes = require('./routes/FacebookAds');
const androidPublisherRoutes = require('./routes/AndroidPubliser');

app.use('/vungle', vungleRoutes);
app.use('/ironsource', ironSourceRoutes);
app.use('/unityads', unityAdsRoutes);
app.use('/facebookads', facebookAdsRoutes);
app.use('/androidpublisher', androidPublisherRoutes);
app.use('/test', (req, res) => {
  res.status(200).json({
    message: 'It works',
  });
});
module.exports = app;
