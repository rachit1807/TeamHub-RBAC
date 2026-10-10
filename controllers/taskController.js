const { Op } = require("sequelize");
const { User, WorkspaceMember, Workspace, Project, Task, TaskComment } = require("../models");
const { workspaceAccess, requireWorkspaceRole } = require("../services/access");
const { badRequest, notFound, forbidden } = require("../utils/errors");
const { requiredString, optionalString, id, enumValue, dateOnly, pagination } = require("../utils/validation");
const STATUSES = ["todo", "in_progress", "review", "completed"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

async function loadTask(user, taskId) {
  const task = await Task.findByPk(taskId, { include: [{ model: Project, as: "project", attributes: ["id", "workspaceId", "name"] }] });
  if (!task) throw notFound("Task not found.");
  const access = await workspaceAccess(user, task.project.workspaceId);
  return { task, ...access };
}
async function requireAssigneeMember(project, assigneeId) {
  if (assigneeId === null || assigneeId === undefined) return;
  const user = await User.findByPk(assigneeId);
  if (!user) throw notFound("Assignee not found.");
  if (user.role === "admin") return;
  const member = await WorkspaceMember.findOne({ where: { workspaceId: project.workspaceId, userId: assigneeId } });
  if (!member) throw badRequest("The assignee must belong to this workspace.");
}
function taskIncludes() {
  return [
    { model: Project, as: "project", attributes: ["id", "name", "workspaceId"] },
    { model: User, as: "assignee", attributes: ["id", "name", "email"] },
    { model: User, as: "creator", attributes: ["id", "name"] },
  ];
}

exports.list = async (req, res) => {
  const { page, limit, offset } = pagination(req.query);
  const where = {};
  if (req.query.projectId) where.projectId = id(req.query.projectId, "Project ID");
  if (req.query.assignedTo) where.assignedTo = id(req.query.assignedTo, "Assignee ID");
  if (req.query.status) where.status = enumValue(req.query.status, "Status", STATUSES);
  if (req.query.priority) where.priority = enumValue(req.query.priority, "Priority", PRIORITIES);
  if (req.query.search) {
    const search = `%${String(req.query.search).trim().slice(0, 100)}%`;
    where[Op.or] = [{ title: { [Op.like]: search } }, { description: { [Op.like]: search } }];
  }
  if (req.query.workspaceId) {
    const workspaceId = id(req.query.workspaceId, "Workspace ID");
    await workspaceAccess(req.user, workspaceId);
    const projects = await Project.findAll({ where: { workspaceId }, attributes: ["id"] });
    const projectIds = projects.map((project) => project.id);
    if (req.query.projectId) {
      const projectId = id(req.query.projectId, "Project ID");
      if (!projectIds.includes(projectId)) throw badRequest("The selected project does not belong to this workspace.");
      where.projectId = projectId;
    } else {
      where.projectId = { [Op.in]: projectIds.length ? projectIds : [-1] };
    }
  } else if (req.user.role !== "admin") {
    const memberships = await WorkspaceMember.findAll({ where: { userId: req.user.id }, attributes: ["workspaceId"] });
    const projectWhere = { workspaceId: { [Op.in]: memberships.length ? memberships.map((m) => m.workspaceId) : [-1] } };
    const projects = await Project.findAll({ where: projectWhere, attributes: ["id"] });
    const projectIds = projects.map((project) => project.id);
    where.projectId = where.projectId ? where.projectId : { [Op.in]: projectIds.length ? projectIds : [-1] };
    if (req.query.projectId && !projectIds.includes(Number(req.query.projectId))) throw forbidden("You do not have access to that project's tasks.");
  }
  const sortBy = ["createdAt", "updatedAt", "dueDate", "priority", "title"].includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
  const direction = String(req.query.order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const { count, rows } = await Task.findAndCountAll({ where, include: taskIncludes(), order: [[sortBy, direction]], limit, offset, distinct: true });
  res.json({ success: true, data: { tasks: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } } });
};

exports.board = async (req, res) => {
  req.query.limit = req.query.limit || "100";
  await exports.list({ user: req.user, query: { ...req.query, page: 1 } }, {
    json(payload) {
      const groups = Object.fromEntries(STATUSES.map((status) => [status, []]));
      for (const task of payload.data.tasks) groups[task.status].push(task);
      res.json({ success: true, data: { board: groups, total: payload.data.pagination.total } });
    },
  });
};

exports.create = async (req, res) => {
  const projectId = id(req.params.projectId, "Project ID");
  const project = await Project.findByPk(projectId);
  if (!project) throw notFound("Project not found.");
  const { role } = await workspaceAccess(req.user, project.workspaceId);
  requireWorkspaceRole(role, ["admin", "owner", "manager"]);
  const title = requiredString(req.body.title, "Title", { min: 2, max: 160 });
  const description = optionalString(req.body.description, "Description", { max: 4000, nullable: true });
  const status = req.body.status === undefined ? "todo" : enumValue(req.body.status, "Status", STATUSES);
  const priority = req.body.priority === undefined ? "medium" : enumValue(req.body.priority, "Priority", PRIORITIES);
  const dueDate = req.body.dueDate === undefined ? null : dateOnly(req.body.dueDate, "Due date");
  const assignedTo = req.body.assignedTo === undefined || req.body.assignedTo === null ? null : id(req.body.assignedTo, "Assignee ID");
  await requireAssigneeMember(project, assignedTo);
  const task = await Task.create({ title, description: description ?? null, status, priority, dueDate, projectId, createdBy: req.user.id, assignedTo });
  res.status(201).json({ success: true, message: "Task created.", data: { task } });
};

exports.get = async (req, res) => {
  const { task } = await loadTask(req.user, id(req.params.id, "Task ID"));
  const full = await Task.findByPk(task.id, { include: taskIncludes() });
  res.json({ success: true, data: { task: full } });
};

exports.update = async (req, res) => {
  const { task, role } = await loadTask(req.user, id(req.params.id, "Task ID"));
  requireWorkspaceRole(role, ["admin", "owner", "manager"]);
  const updates = {};
  if (Object.hasOwn(req.body, "title")) updates.title = requiredString(req.body.title, "Title", { min: 2, max: 160 });
  if (Object.hasOwn(req.body, "description")) updates.description = optionalString(req.body.description, "Description", { max: 4000, nullable: true });
  if (Object.hasOwn(req.body, "status")) updates.status = enumValue(req.body.status, "Status", STATUSES);
  if (Object.hasOwn(req.body, "priority")) updates.priority = enumValue(req.body.priority, "Priority", PRIORITIES);
  if (Object.hasOwn(req.body, "dueDate")) updates.dueDate = dateOnly(req.body.dueDate, "Due date");
  if (Object.hasOwn(req.body, "assignedTo")) updates.assignedTo = req.body.assignedTo === null ? null : id(req.body.assignedTo, "Assignee ID");
  if (!Object.keys(updates).length) throw badRequest("Provide at least one task field to update.");
  if (Object.hasOwn(updates, "assignedTo")) await requireAssigneeMember(task.project, updates.assignedTo);
  await task.update(updates);
  res.json({ success: true, message: "Task updated.", data: { task } });
};

exports.updateStatus = async (req, res) => {
  const { task, role } = await loadTask(req.user, id(req.params.id, "Task ID"));
  const status = enumValue(req.body.status, "Status", STATUSES);
  const isLead = ["admin", "owner", "manager"].includes(role);
  if (!isLead && task.assignedTo !== req.user.id) throw forbidden("Only the assignee or a workspace lead can change this task's status.");
  await task.update({ status });
  res.json({ success: true, message: "Task status updated.", data: { task } });
};

exports.remove = async (req, res) => {
  const { task, role } = await loadTask(req.user, id(req.params.id, "Task ID"));
  requireWorkspaceRole(role, ["admin", "owner", "manager"]);
  await task.destroy();
  res.json({ success: true, message: "Task deleted." });
};

exports.listComments = async (req, res) => {
  const { task } = await loadTask(req.user, id(req.params.id, "Task ID"));
  const comments = await TaskComment.findAll({ where: { taskId: task.id }, include: [{ model: User, as: "author", attributes: ["id", "name"] }], order: [["createdAt", "ASC"]] });
  res.json({ success: true, data: { comments } });
};

exports.addComment = async (req, res) => {
  const { task } = await loadTask(req.user, id(req.params.id, "Task ID"));
  const body = requiredString(req.body.body, "Comment", { min: 1, max: 2000 });
  const comment = await TaskComment.create({ body, taskId: task.id, userId: req.user.id });
  res.status(201).json({ success: true, message: "Comment added.", data: { comment } });
};
