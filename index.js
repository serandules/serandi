module.exports.ctx = function (req, res, next) {
    req.serand = req.serand || {};
    next();
};