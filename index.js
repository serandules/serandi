var log = require('logger')('serandi:index');
var _ = require('lodash');
var nconf = require('nconf');
var url = require('url');

var port = nconf.get('port');

module.exports.ctx = function (req, res, next) {
    req.serand = req.serand || {};
    next();
};

module.exports.pond = function (req, res, next) {
    res.pond = function (o) {
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
    res.many = function (o) {
        var data = req.query.data;
        var paging = data.paging;
        if (o.length < paging.count) {
            return res.send(o);
        }
        var sort = paging.sort;
        var end = o[o.length - 1];
        if (!end) {
            return res.send(o);
        }
        var pathname = req.baseUrl;
        if (req.path !== '/') {
            pathname += req.path;
        }
        if (sort._id) {
            sort.id = sort._id;
            delete sort._id;
        }
        var link = function (rel, direction) {
            if (!rel) {
                return null;
            }
            var order;
            var fields = {};
            Object.keys(sort).forEach(function (field) {
                fields[field] = rel[field];
                if (order) {
                    return;
                }
                order = sort[field];
            });
            if (!order) {
                return null;
            }
            var cursor = {};
            var type = (direction * order === 1) ? 'min' : 'max';
            cursor[type] = fields;
            var clone = _.cloneDeep(data);
            clone.paging.cursor = cursor;
            return url.format({
                protocol: req.protocol,
                hostname: req.hostname,
                port: nconf.get('port'),
                pathname: pathname,
                query: {
                    data: JSON.stringify(clone)
                }
            });
        };
        var index = o.length - 1;
        var last = link(o[0], -1);
        var next = link(o[index], 1);
        res.links({
            last: last,
            next: next
        });
        res.send(o);
    };
    next();
};