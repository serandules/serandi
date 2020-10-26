var log = require('logger')('serandi:index');
var errors = require('errors');

exports.notFound = function (req, res, next) {
  next(errors.notFound());
};

exports.pond = function (req, res, next) {
  res.pond = function (o) {
    if (!(o instanceof Error)) {
      return res.status(o.status).send(o.data);
    }
    if (o.status === 413) {
      o = errors.payloadTooLarge();
    } else {
      o = errors.serverError();
    }
    res.status(o.status).send(o.data);
  };
  next();
};

exports.ssl = function (req, res, next) {
  if (req.secure) {
    return next();
  }
  if (req.method === 'GET') {
    return res.redirect(301, 'https://' + req.hostname + req.originalUrl);
  }
  next(errors.forbidden());
};
