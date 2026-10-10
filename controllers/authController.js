const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { conflict, unauthorized, badRequest } = require("../utils/errors");
const { requiredString, email, password } = require("../utils/validation");
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }; }
function createToken(user) { return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h", issuer: "teamhub-rbac" }); }
exports.register = async (req, res) => {
  const name = requiredString(req.body.name, "Name", { min: 2, max: 80 });
  const userEmail = email(req.body.email);
  const userPassword = password(req.body.password);
  const exists = await User.unscoped().findOne({ where: { email: userEmail } });
  if (exists) throw conflict("An account with this email already exists.");
  const hash = await bcrypt.hash(userPassword, 12);
  const user = await User.create({ name, email: userEmail, password: hash, role: "member" });
  res.status(201).json({ success: true, message: "Account created.", data: { user: publicUser(user) } });
};
exports.login = async (req, res) => {
  const userEmail = email(req.body.email);
  if (typeof req.body.password !== "string" || req.body.password.length > 128) throw unauthorized("Invalid email or password.");
  const user = await User.unscoped().findOne({ where: { email: userEmail } });
  const valid = user && await bcrypt.compare(req.body.password, user.password);
  if (!valid) throw unauthorized("Invalid email or password.");
  const token = createToken(user);
  res.json({ success: true, message: "Signed in.", data: { token, tokenType: "Bearer", expiresIn: process.env.JWT_EXPIRES_IN || "8h", user: publicUser(user) } });
};
exports.getProfile = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  res.json({ success: true, data: { user: publicUser(user) } });
};
exports.updateProfile = async (req, res) => {
  const updates = {};
  if (Object.hasOwn(req.body, "name")) updates.name = requiredString(req.body.name, "Name", { min: 2, max: 80 });
  if (Object.hasOwn(req.body, "email")) updates.email = email(req.body.email);
  if (!Object.keys(updates).length) throw badRequest("Provide at least one profile field to update.");
  if (updates.email) {
    const duplicate = await User.unscoped().findOne({ where: { email: updates.email } });
    if (duplicate && duplicate.id !== req.user.id) throw conflict("An account with this email already exists.");
  }
  await User.update(updates, { where: { id: req.user.id } });
  const user = await User.findByPk(req.user.id);
  res.json({ success: true, message: "Profile updated.", data: { user: publicUser(user) } });
};
exports.changePassword = async (req, res) => {
  const currentPassword = req.body.currentPassword;
  const newPassword = password(req.body.newPassword, "New password");
  if (typeof currentPassword !== "string" || !currentPassword) throw badRequest("Current password is required.");
  const user = await User.unscoped().findByPk(req.user.id);
  if (!(await bcrypt.compare(currentPassword, user.password))) throw unauthorized("Current password is incorrect.");
  if (currentPassword === newPassword) throw badRequest("Choose a new password different from the current one.");
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ success: true, message: "Password changed. Sign in again with the new password." });
};
