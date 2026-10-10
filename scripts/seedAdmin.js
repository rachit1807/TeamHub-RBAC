require("dotenv").config();
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");
const { User } = require("../models");

async function run() {
  const email = String(process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = String(process.env.SEED_ADMIN_NAME || "TeamHub Administrator").trim();
  if (!email || !password || password.length < 12) throw new Error("Set SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD with at least 12 characters.");
  await sequelize.authenticate();
  await sequelize.sync();
  const existing = await User.unscoped().findOne({ where: { email } });
  if (existing) {
    if (existing.role !== "admin") throw new Error("That email already belongs to a non-admin account. Choose a different seed admin email.");
    console.log(`Administrator account already exists: ${email}`);
  } else {
    await User.create({ name, email, password: await bcrypt.hash(password, 12), role: "admin" });
    console.log(`Administrator account created: ${email}`);
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => sequelize.close());
