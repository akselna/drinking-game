const { server } = require('../server/index.js');

module.exports = (req, res) => {
  server.emit('request', req, res);
};
