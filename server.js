require("dotenv").config();
const app = require("./app");
const sequelize = require("./config/database");
require("./models");

async function start() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required. Set it in your .env file.");
  if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters in production.");
  await sequelize.authenticate();
  await sequelize.sync();
  const port = Number(process.env.PORT) || 8000;
  const server = app.listen(port, () => console.log(`TeamHub API listening on http://localhost:${port}`));
  const shutdown = async () => {
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("Unable to start TeamHub:", error.message);
  process.exitCode = 1;
});
