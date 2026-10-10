const { HttpError } = require("../utils/errors");
function rateLimit({ windowMs = 15 * 60 * 1000, max = 30 } = {}) {
  const requests = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let entry = requests.get(key);
    if (!entry || now - entry.startedAt >= windowMs) { entry = { startedAt: now, count: 0 }; requests.set(key, entry); }
    entry.count += 1;
    if (entry.count > max) return next(new HttpError(429, "Too many authentication requests. Try again later."));
    for (const [ip, value] of requests) if (now - value.startedAt >= windowMs) requests.delete(ip);
    return next();
  };
}
module.exports = rateLimit;
