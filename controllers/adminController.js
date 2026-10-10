const { Op } = require("sequelize");
const { User, Workspace, Project, Task } = require("../models");
const { conflict, notFound } = require("../utils/errors");
const { enumValue, pagination } = require("../utils/validation");
const ROLES = ["admin", "manager", "member"];
exports.dashboard = async (_req, res) => {
  const [users, workspaces, projects, tasks, completedTasks] = await Promise.all([
    User.count(), Workspace.count(), Project.count(), Task.count(), Task.count({ where: { status: "completed" } }),
  ]);
  res.json({ success: true, data: { summary: { users, workspaces, projects, tasks, completedTasks } } });
};
exports.listUsers = async (req, res) => {
  const { page, limit, offset } = pagination(req.query);
  const where = {};
  if (req.query.role) where.role = enumValue(req.query.role, "Role", ROLES);
  if (req.query.search) {
    const search = String(req.query.search).trim().slice(0, 100);
    where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }];
  }
  const { count, rows } = await User.findAndCountAll({ where, attributes: ["id", "name", "email", "role", "createdAt"], order: [["createdAt", "DESC"]], limit, offset });
  res.json({ success: true, data: { users: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } } });
};
exports.updateUserRole = async (req, res) => {
  const role = enumValue(req.body.role, "Role", ROLES);
  const user = await User.findByPk(req.params.id);
  if (!user) throw notFound("User not found.");
  if (user.id === req.user.id && user.role === "admin" && role !== "admin") {
    const admins = await User.count({ where: { role: "admin" } });
    if (admins <= 1) throw conflict("Create another administrator before changing your own role.");
  }
  user.role = role;
  await user.save();
  res.json({ success: true, message: "User role updated.", data: { user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
};
