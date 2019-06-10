var log = require('logger')('serandi:index');
var nconf = require('nconf');
var url = require('url');
var request = require('request');
var formidable = require('formidable');

var validators = require('validators');
var errors = require('errors');
var Otps = require('model-otps');

var Droute = require('./droute');

var port = nconf.get('PORT');

var captchaUri = nconf.get('CAPTCHA_URI');

var captchaSecret = nconf.get('CAPTCHA_SECRET');

var validator = function (model, name) {
  return function (req, res, next) {
    exports.query(req, res, function (err) {
      if (err) {
        return next(err);
      }
      req.ctx.user = req.user;
      req.ctx.data = req.body;
      req.ctx.streams = req.streams;
      req.ctx.search = req.query.data;
      req.ctx.id = req.params.id;
      req.ctx.model = model;
      validators.model[name](req.ctx, next);
    });
  };
};

exports.ctx = function (req, res, next) {
  req.ctx = req.ctx || {};
  next();
};

exports.notFound = function (req, res, next) {
  next(errors.notFound());
};

exports.pond = function (req, res, next) {
  res.pond = function (o) {
    if (o instanceof Error) {
      o = errors.serverError();
    }
    res.status(o.status).send(o.data);
  };
  next();
};

exports.locate = function (prefix) {
  return function (req, res, next) {
    res.locate = function (path) {
      return res.location(req.protocol + '://' + req.get('host') + prefix + path);
    };
    next();
  };
};

exports.xactions = function (xactions) {
  return function (req, res, next) {
    var action = req.headers['x-action'];
    if (!action) {
      return next();
    }
    var xaction = xactions[action];
    if (!xaction) {
      return next(errors.unprocessableEntity());
    }
    var droute = new Droute();
    xaction(droute);
    droute.end(req, res, next);
  };
};

exports.many = function (req, res, next) {
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

exports.ssl = function (req, res, next) {
  if (req.secure) {
    return next();
  }
  if (req.method === 'GET') {
    return res.redirect(301, 'https://' + req.hostname + req.originalUrl);
  }
  next(errors.forbidden());
};

exports.captcha = function (req, res, next) {
  var captcha = req.get('X-Captcha');
  if (!captcha) {
    return next(errors.forbidden());
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
      return next(e);
    }
    if (!b.success) {
      return next(errors.forbidden());
    }
    next();
  });
};

exports.otp = function (options) {
  return function (req, res, next) {
    var otp = req.otp;
    if (!otp) {
      return next(errors.unauthorized());
    }
    var user = options.user || req.user.id;
    if (otp.name !== options.name) {
      return next(errors.unauthorized());
    }
    if (otp.user.id !== user) {
      return next(errors.unauthorized());
    }
    next();
  };
};

exports.json = function (req, res, next) {
  if (req.is('application/json')) {
    return next();
  }
  next(errors.unsupportedMedia());
};

exports.urlencoded = function (req, res, next) {
  if (req.is('application/x-www-form-urlencoded')) {
    return next();
  }
  next(errors.unsupportedMedia());
};

exports.multipart = function (req, res, next) {
  req.streams = {};
  if (!req.is('multipart/form-data')) {
    return next(errors.unsupportedMedia());
  }
  var form = new formidable.IncomingForm();
  form.on('progress', function (rec, exp) {

  });
  form.on('field', function (name, value) {
    if (name !== 'data') {
      return;
    }
    req.body = JSON.parse(value);
  });
  form.on('file', function (name, file) {
    var streams = req.streams[name] || (req.streams[name] = []);
    streams.push(file);
  });
  form.on('error', function (err) {
    log.error('forms:errored', 'data:%j', data, err);
    next(errors.badRequest());
  });
  form.on('aborted', function () {
    next();
  });
  form.on('end', function () {
    next();
  });
  form.parse(req);
};

exports.create = function (model) {
  return validator(model, 'create');
};

exports.update = function (model) {
  return validator(model, 'update');
};

exports.findOne = function (model) {
  return validator(model, 'findOne');
};

exports.find = function (model) {
  return validator(model, 'find');
};

exports.remove = function (model) {
  return validator(model, 'remove');
};

exports.query = function (req, res, next) {
  if (['GET'].indexOf(req.method) === -1) {
    req.query.data = req.body || {};
    return next();
  }
  var data = req.query.data;
  if (!data) {
    req.query.data = {};
    return next();
  }
  try {
    data = JSON.parse(data);
  } catch (e) {
    return next(errors.badRequest('\'data\' contains an invalid value'));
  }
  if (typeof data !== 'object') {
    return next(errors.badRequest('\'data\' contains an invalid value'));
  }
  req.query.data = data;
  next();
};
