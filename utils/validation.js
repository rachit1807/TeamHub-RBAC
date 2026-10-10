const { badRequest } = require("./errors");
function requiredString(value, field, { min = 1, max = 255 } = {}) {
  if (typeof value !== "string") throw badRequest(`${field} is required and must be text.`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) throw badRequest(`${field} must be between ${min} and ${max} characters.`);
  return clean;
}
function optionalString(value, field, { max = 2000, nullable = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  if (typeof value !== "string") throw badRequest(`${field} must be text.`);
  const clean = value.trim();
  if (clean.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
  return clean || (nullable ? null : "");
}
function email(value) {
  const clean = requiredString(value, "Email", { min: 3, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw badRequest("Enter a valid email address.");
  return clean;
}
function password(value, field = "Password") {
  if (typeof value !== "string" || value.length < 8 || value.length > 128 || Buffer.byteLength(value, "utf8") > 72) throw badRequest(`${field} must be 8–128 characters and at most 72 UTF-8 bytes.`);
  return value;
}
function id(value, field = "id") {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw badRequest(`${field} must be a positive integer.`);
  return parsed;
}
function enumValue(value, field, allowed) {
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(", ")}.`);
  return value;
}
function dateOnly(value, field) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest(`${field} must use YYYY-MM-DD format.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw badRequest(`${field} must be a real calendar date.`);
  return value;
}
function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}
module.exports = { requiredString, optionalString, email, password, id, enumValue, dateOnly, pagination };
