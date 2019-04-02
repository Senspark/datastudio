const http = require('http');
const app = require('./App');

const port = process.env.PORT || 4567;

const server = http.createServer(app);

server.listen(port);

// const app = express();

// app.get('/', (request, response) => {
//   response.end(200);
// });

// const server = app.listen(4567, () => {
//   const host = server.address().address;
//   const port = server.address().port;
//   console.log(`DataStudio server listening at http://${host}:${port}`);
// });
