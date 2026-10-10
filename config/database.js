const path = require("node:path");
const { Sequelize } = require("sequelize");

const logging = process.env.NODE_ENV === "development" && process.env.SQL_LOG === "true" ? console.log : false;
const pool = { max: 5, min: 0, idle: 10000, acquire: 30000 };

// Hosted environments set DATABASE_URL to PostgreSQL. Local development keeps
// the zero-configuration SQLite setup used by the Postman collection.
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging,
    pool,
    dialectOptions: process.env.DATABASE_SSL === "true"
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  })
  : (() => {
    const configuredStorage = process.env.DB_STORAGE || "database.sqlite";
    const storage = path.isAbsolute(configuredStorage)
      ? configuredStorage
      : path.resolve(__dirname, "..", configuredStorage);
    return new Sequelize({ dialect: "sqlite", storage, logging, pool });
  })();

module.exports = sequelize;
