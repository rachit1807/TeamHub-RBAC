const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { unauthorized, forbidden } = require("../utils/errors");
async function verifyToken(req, _res, next) {
  const header = req.get("authorization");
  if (!header || !/^Bearer\s+\S+$/i.test(header)) return next(unauthorized("A bearer token is required."));
  try {
    const token = header.replace(/^Bearer\s+/i, "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { issuer: "teamhub-rbac" });
    const userId = Number(decoded.id || decoded.sub);
    if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("Invalid subject");
    const user = await User.findByPk(userId);
    if (!user) return next(unauthorized("The account for this token no longer exists."));
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    return next();
  } catch (_error) { return next(unauthorized("The token is invalid or expired.")); }
}
function verifyAdmin(req, _res, next) {
  if (req.user?.role !== "admin") return next(forbidden("Administrator access is required."));
  return next();
}
function verifyManager(req, _res, next) {
  if (!req.user || !["admin", "manager"].includes(req.user.role)) return next(forbidden("Manager access is required."));
  return next();
}
module.exports = { verifyToken, verifyAdmin, verifyManager };
