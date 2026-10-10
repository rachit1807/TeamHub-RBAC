require("dotenv").config();
const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");
const { HttpError } = require("./utils/errors");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const rateLimit = require("./middleware/rateLimit");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
const appPort = Number(process.env.PORT) || 8000;
const allowedOrigins = (process.env.CORS_ORIGIN || `http://localhost:${appPort},http://127.0.0.1:${appPort}`).split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new HttpError(403, "Origin is not allowed."));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

app.get("/api/health", (_req, res) => res.json({ success: true, data: { status: "ok", service: "TeamHub RBAC API" } }));
app.use("/api/auth", rateLimit(), authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use(express.static(require("node:path").join(__dirname, "public"), { extensions: ["html"] }));
app.get("/", (_req, res) => res.sendFile(require("node:path").join(__dirname, "public", "index.html")));
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
