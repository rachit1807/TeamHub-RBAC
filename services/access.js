const { Workspace, WorkspaceMember } = require("../models");
const { forbidden, notFound } = require("../utils/errors");
async function workspaceAccess(user, workspaceId, { required = true } = {}) {
  const workspace = await Workspace.findByPk(workspaceId);
  if (!workspace) throw notFound("Workspace not found.");
  if (user.role === "admin") return { workspace, role: "admin" };
  const membership = await WorkspaceMember.findOne({ where: { workspaceId, userId: user.id } });
  if (!membership) {
    if (required) throw forbidden("You are not a member of this workspace.");
    return { workspace, role: null };
  }
  const role = user.role === "manager" && membership.role === "member" ? "manager" : membership.role;
  return { workspace, role };
}
function requireWorkspaceRole(role, allowed) {
  const accepted = Array.isArray(allowed) ? allowed : [allowed];
  if (!accepted.includes(role)) throw forbidden("Your workspace role does not allow this action.");
}
module.exports = { workspaceAccess, requireWorkspaceRole };
