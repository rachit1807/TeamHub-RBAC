const { Op } = require("sequelize");
const { WorkspaceMember, Workspace, Project, Task } = require("../models");
exports.dashboard = async (req, res) => {
  const rows = await WorkspaceMember.findAll({ where: { userId: req.user.id }, attributes: ["workspaceId"] });
  const workspaceIds = rows.map((row) => row.workspaceId);
  const visibleWorkspaceIds = req.user.role === "admin" ? null : (workspaceIds.length ? workspaceIds : [-1]);
  const projectWhere = visibleWorkspaceIds ? { workspaceId: { [Op.in]: visibleWorkspaceIds } } : {};
  const projects = await Project.findAll({ where: projectWhere, attributes: ["id", "name", "status"] });
  const projectIds = projects.map((project) => project.id);
  const taskWhere = { ...(req.user.role === "admin" ? {} : { projectId: { [Op.in]: projectIds.length ? projectIds : [-1] } }) };
  const fromToday = new Date().toISOString().slice(0, 10);
  const [workspaces, tasks, myTasks, upcoming, completed] = await Promise.all([
    Workspace.count({ where: visibleWorkspaceIds ? { id: { [Op.in]: visibleWorkspaceIds } } : {} }),
    Task.count({ where: taskWhere }),
    Task.count({ where: { ...taskWhere, assignedTo: req.user.id } }),
    Task.count({ where: { ...taskWhere, assignedTo: req.user.id, dueDate: { [Op.gte]: fromToday }, status: { [Op.ne]: "completed" } } }),
    Task.count({ where: { ...taskWhere, status: "completed" } }),
  ]);
  res.json({ success: true, data: { summary: { workspaces, projects: projects.length, tasks, myTasks, upcoming, completed }, projects } });
};
