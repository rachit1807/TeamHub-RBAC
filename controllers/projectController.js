const { Op } = require("sequelize");
const { User, WorkspaceMember, Workspace, Project } = require("../models");
const { workspaceAccess, requireWorkspaceRole } = require("../services/access");
const { notFound, badRequest } = require("../utils/errors");
const { requiredString, optionalString, id, enumValue, dateOnly, pagination } = require("../utils/validation");
const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed"];

exports.list = async (req, res) => {
  const workspaceId = id(req.params.workspaceId, "Workspace ID");
  await workspaceAccess(req.user, workspaceId);
  const { page, limit, offset } = pagination(req.query);
  const where = { workspaceId };
  if (req.query.status) where.status = enumValue(req.query.status, "Status", PROJECT_STATUSES);
  if (req.query.search) where[Op.or] = [
    { name: { [Op.like]: `%${String(req.query.search).trim().slice(0, 100)}%` } },
    { description: { [Op.like]: `%${String(req.query.search).trim().slice(0, 100)}%` } },
  ];
  const { count, rows } = await Project.findAndCountAll({ where, include: [{ model: User, as: "creator", attributes: ["id", "name"] }], order: [["updatedAt", "DESC"]], limit, offset });
  res.json({ success: true, data: { projects: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } } });
};

exports.create = async (req, res) => {
  const workspaceId = id(req.params.workspaceId, "Workspace ID");
  const { role } = await workspaceAccess(req.user, workspaceId);
  requireWorkspaceRole(role, ["admin", "owner", "manager"]);
  const name = requiredString(req.body.name, "Name", { min: 2, max: 100 });
  const description = optionalString(req.body.description, "Description", { max: 2000, nullable: true });
  const status = req.body.status === undefined ? "planning" : enumValue(req.body.status, "Status", PROJECT_STATUSES);
  const deadline = req.body.deadline === undefined ? null : dateOnly(req.body.deadline, "Deadline");
  const project = await Project.create({ name, description: description ?? null, status, deadline, workspaceId, createdBy: req.user.id });
  res.status(201).json({ success: true, message: "Project created.", data: { project } });
};

exports.get = async (req, res) => {
  const project = await Project.findByPk(id(req.params.id, "Project ID"), { include: [{ model: Workspace, as: "workspace", attributes: ["id", "name", "ownerId"] }] });
  if (!project) throw notFound("Project not found.");
  await workspaceAccess(req.user, project.workspaceId);
  res.json({ success: true, data: { project } });
};

exports.update = async (req, res) => {
  const project = await Project.findByPk(id(req.params.id, "Project ID"));
  if (!project) throw notFound("Project not found.");
  const { role } = await workspaceAccess(req.user, project.workspaceId);
  requireWorkspaceRole(role, ["admin", "owner", "manager"]);
  const updates = {};
  if (Object.hasOwn(req.body, "name")) updates.name = requiredString(req.body.name, "Name", { min: 2, max: 100 });
  if (Object.hasOwn(req.body, "description")) updates.description = optionalString(req.body.description, "Description", { max: 2000, nullable: true });
  if (Object.hasOwn(req.body, "status")) updates.status = enumValue(req.body.status, "Status", PROJECT_STATUSES);
  if (Object.hasOwn(req.body, "deadline")) updates.deadline = dateOnly(req.body.deadline, "Deadline");
  if (!Object.keys(updates).length) throw badRequest("Provide at least one project field to update.");
  await project.update(updates);
  res.json({ success: true, message: "Project updated.", data: { project } });
};

exports.remove = async (req, res) => {
  const project = await Project.findByPk(id(req.params.id, "Project ID"));
  if (!project) throw notFound("Project not found.");
  const { role } = await workspaceAccess(req.user, project.workspaceId);
  requireWorkspaceRole(role, ["admin", "owner", "manager"]);
  await project.destroy();
  res.json({ success: true, message: "Project and its tasks were deleted." });
};
