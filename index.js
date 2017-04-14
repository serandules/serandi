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