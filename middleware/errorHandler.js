const { UniqueConstraintError, ForeignKeyConstraintError, ValidationError } = require("sequelize");
const { HttpError } = require("../utils/errors");
function notFoundHandler(req, _res, next) { next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`)); }
function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;
  let status = error.status || 500;
  let message = error.message || "An unexpected error occurred.";
  let details = error.details;
  if (error instanceof UniqueConstraintError) { status = 409; message = "A record with that value already exists."; }
  else if (error instanceof ForeignKeyConstraintError) { status = 400; message = "The request references a record that does not exist."; }
  else if (error instanceof ValidationError) { status = 400; message = "The request contains invalid data."; details = error.errors.map((item) => ({ field: item.path, message: item.message })); }
  if (status >= 500) { console.error(`[${req.requestId || "request"}]`, error); message = "An internal server error occurred."; }
  res.status(status).json({ success: false, message, ...(details ? { details } : {}), requestId: req.requestId });
}
module.exports = { notFoundHandler, errorHandler };
