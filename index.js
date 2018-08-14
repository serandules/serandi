var log = require('logger')('serandi:index');
var nconf = require('nconf');
var _ = require('lodash');
var url = require('url');
var request = require('request');
var utils = require('utils');
var serand = require('serand');
var errors = require('errors');

var port = nconf.get('PORT');

var captchaUri = 'https://www.google.com/recaptcha/api/siteverify';

var captchaSecret = nconf.get('CAPTCHA_SECRET');

module.exports.ctx = function (req, res, next) {
    req.ctx = req.ctx || {};
    next();
};

module.exports.pond = function (req, res, next) {
    res.pond = function (o) {
        if (o instanceof Error) {
            o = errors.serverError();
        }
        res.status(o.status).send(o.data);
    };
    next();
};

module.exports.locate = function (prefix) {
    return function (req, res, next) {
        res.locate = function (path) {
            return res.location(req.protocol + '://' + req.get('host') + prefix + path);
        };
        next();
    };
};

module.exports.many = function (req, res, next) {
    res.many = function (o, paging) {
        var data = req.query.data;
        var sort = paging.sort;
        var pathname = req.baseUrl;
        if (req.path !== '/') {
            pathname += req.path;
        }
        /*if (sort._id) {
         sort.id = sort._id;
         delete sort._id;
         }*/
        var link = function (o) {
            if (!o) {
                return null;
            }
            var sort = o.sort;
            if (sort && sort._id) {
                sort.id = sort._id;
                delete sort._id;
            }
            var cursor = o.cursor;
            if (cursor && cursor._id) {
                cursor.id = cursor._id;
                delete cursor.id;
            }
            o.fields = data.fields;
            o.count = data.count;
            return url.format({
                protocol: req.protocol,
                hostname: req.hostname,
                port: port,
                pathname: pathname,
                query: {
                    data: JSON.stringify(o)
                }
            });
        };
        var last = link(paging.last);
        var next = link(paging.next);
        var links = {};
        if (last) {
            links.last = last;
        }
        if (next) {
            links.next = next;
        }
        res.links(links);
        res.send(o);
    };
    next();
};

module.exports.ssl = function (req, res, next) {
    if (req.secure) {
        return next();
    }
    if (req.method === 'GET') {
        return res.redirect(301, 'https://' + req.hostname + req.originalUrl);
    }
    res.pond(errors.forbidden());
};

module.exports.captcha = function (req, res, next) {
  var captcha = req.get('X-Captcha');
  if (!captcha) {
    return res.pond(errors.forbidden());
  }
  request({
    uri: captchaUri,
    method: 'POST',
    form: {
      secret: captchaSecret,
      response: captcha,
      remoteip: req.ip
    },
    json: true
  }, function (e, r, b) {
    if (e) {
      return res.pond(errors.serverError());
    }
    if (!b.success) {
      return res.pond(errors.forbidden());
    }
    next();
  });
};