const User = require("./User");
const Workspace = require("./Workspace");
const WorkspaceMember = require("./WorkspaceMember");
const Project = require("./Project");
const Task = require("./Task");
const TaskComment = require("./TaskComment");

User.hasMany(Workspace, { as: "ownedWorkspaces", foreignKey: "ownerId" });
Workspace.belongsTo(User, { as: "owner", foreignKey: "ownerId" });
Workspace.belongsToMany(User, { as: "members", through: WorkspaceMember, foreignKey: "workspaceId", otherKey: "userId" });
User.belongsToMany(Workspace, { as: "workspaces", through: WorkspaceMember, foreignKey: "userId", otherKey: "workspaceId" });
Workspace.hasMany(WorkspaceMember, { as: "memberships", foreignKey: "workspaceId", onDelete: "CASCADE" });
WorkspaceMember.belongsTo(User, { as: "user", foreignKey: "userId" });
Workspace.hasMany(Project, { as: "projects", foreignKey: "workspaceId", onDelete: "CASCADE" });
Project.belongsTo(Workspace, { as: "workspace", foreignKey: "workspaceId" });
Project.belongsTo(User, { as: "creator", foreignKey: "createdBy" });
Project.hasMany(Task, { as: "tasks", foreignKey: "projectId", onDelete: "CASCADE" });
Task.belongsTo(Project, { as: "project", foreignKey: "projectId" });
Task.belongsTo(User, { as: "assignee", foreignKey: "assignedTo" });
Task.belongsTo(User, { as: "creator", foreignKey: "createdBy" });
Task.hasMany(TaskComment, { as: "comments", foreignKey: "taskId", onDelete: "CASCADE" });
TaskComment.belongsTo(User, { as: "author", foreignKey: "userId" });
TaskComment.belongsTo(Task, { as: "task", foreignKey: "taskId" });

module.exports = { User, Workspace, WorkspaceMember, Project, Task, TaskComment };
