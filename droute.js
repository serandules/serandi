var async = require('async');

var Droute = function () {
  this.middlewares = [];
};

Droute.prototype.use = function (middleware) {
  this.middlewares.push(middleware);
};

Droute.prototype.end = function (req, res, next) {
  async.eachSeries(this.middlewares, function (middleware, ran) {
    middleware(req, res, ran);
  }, function (err) {
    if (err) {
      return next(err)
    }
  });
};

module.exports = Droute;