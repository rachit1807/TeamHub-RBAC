const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { User, Workspace, WorkspaceMember } = require("../models");
const { workspaceAccess, requireWorkspaceRole } = require("../services/access");
const { badRequest, notFound, conflict } = require("../utils/errors");
const { requiredString, optionalString, email, id, enumValue } = require("../utils/validation");
exports.list = async (req, res) => {
  let ids = null;
  let memberships = [];
  if (req.user.role !== "admin") {
    memberships = await WorkspaceMember.findAll({ where: { userId: req.user.id }, attributes: ["workspaceId", "role"] });
    ids = memberships.map((row) => row.workspaceId);
    if (!ids.length) return res.json({ success: true, data: { workspaces: [] } });
  }
  const where = ids ? { id: { [Op.in]: ids } } : {};
  if (req.query.search) where.name = { [Op.like]: `%${String(req.query.search).trim().slice(0, 100)}%` };
  const workspaces = await Workspace.findAll({ where, include: [{ model: User, as: "owner", attributes: ["id", "name", "email"] }], order: [["updatedAt", "DESC"]] });
  const roles = new Map(memberships.map((membership) => [membership.workspaceId, membership.role]));
  res.json({ success: true, data: { workspaces: workspaces.map((workspace) => ({
    ...workspace.toJSON(),
    workspaceRole: req.user.role === "admin" ? "admin" : req.user.role === "manager" && roles.get(workspace.id) === "member" ? "manager" : roles.get(workspace.id),
  })) } });
};
exports.create = async (req, res) => {
  const name = requiredString(req.body.name, "Name", { min: 2, max: 80 });
  const description = optionalString(req.body.description, "Description", { max: 1000, nullable: true });
  const workspace = await sequelize.transaction(async (transaction) => {
    const created = await Workspace.create({ name, description: description ?? null, ownerId: req.user.id }, { transaction });
    await WorkspaceMember.create({ workspaceId: created.id, userId: req.user.id, role: "owner" }, { transaction });
    return created;
  });
  res.status(201).json({ success: true, message: "Workspace created.", data: { workspace } });
};
exports.get = async (req, res) => {
  const workspaceId = id(req.params.id, "Workspace ID");
  const { workspace } = await workspaceAccess(req.user, workspaceId);
  const memberships = await WorkspaceMember.findAll({ where: { workspaceId }, include: [{ model: User, as: "user", attributes: ["id", "name", "email", "role"] }], order: [["createdAt", "ASC"]] });
  res.json({ success: true, data: { workspace, members: memberships.map((m) => ({ ...m.user.toJSON(), workspaceRole: m.role })) } });
};
exports.update = async (req, res) => {
  const workspaceId = id(req.params.id, "Workspace ID");
  const { workspace, role } = await workspaceAccess(req.user, workspaceId);
  requireWorkspaceRole(role, ["admin", "owner"]);
  const updates = {};
  if (Object.hasOwn(req.body, "name")) updates.name = requiredString(req.body.name, "Name", { min: 2, max: 80 });
  if (Object.hasOwn(req.body, "description")) updates.description = optionalString(req.body.description, "Description", { max: 1000, nullable: true });
  if (!Object.keys(updates).length) throw badRequest("Provide a workspace name or description to update.");
  await workspace.update(updates);
  res.json({ success: true, message: "Workspace updated.", data: { workspace } });
};
exports.remove = async (req, res) => {
  const workspaceId = id(req.params.id, "Workspace ID");
  const { workspace, role } = await workspaceAccess(req.user, workspaceId);
  requireWorkspaceRole(role, ["admin", "owner"]);
  await sequelize.transaction(async (transaction) => {
    await WorkspaceMember.destroy({ where: { workspaceId }, transaction });
    await workspace.destroy({ transaction });
  });
  res.json({ success: true, message: "Workspace and its projects were deleted." });
};
exports.listMembers = async (req, res) => {
  const workspaceId = id(req.params.id, "Workspace ID");
  await workspaceAccess(req.user, workspaceId);
  const members = await WorkspaceMember.findAll({ where: { workspaceId }, include: [{ model: User, as: "user", attributes: ["id", "name", "email", "role"] }], order: [["createdAt", "ASC"]] });
  res.json({ success: true, data: { members: members.map((m) => ({ ...m.user.toJSON(), workspaceRole: m.role })) } });
};
exports.addMember = async (req, res) => {
  const workspaceId = id(req.params.id, "Workspace ID");
  const { role: actorRole } = await workspaceAccess(req.user, workspaceId);
  requireWorkspaceRole(actorRole, ["admin", "owner", "manager"]);
  const userEmail = email(req.body.email);
  const role = enumValue(req.body.role || "member", "Workspace role", ["manager", "member"]);
  if (actorRole === "manager" && role === "manager") throw conflict("Managers can add members but cannot grant manager access.");
  const user = await User.findOne({ where: { email: userEmail } });
  if (!user) throw notFound("No account exists with that email. Ask them to register first.");
  const [membership, created] = await WorkspaceMember.findOrCreate({ where: { workspaceId, userId: user.id }, defaults: { role } });
  if (!created) throw conflict("This user is already a workspace member.");
  res.status(201).json({ success: true, message: "Member added.", data: { member: { id: user.id, name: user.name, email: user.email, workspaceRole: membership.role } } });
};
exports.updateMember = async (req, res) => {
  const workspaceId = id(req.params.id, "Workspace ID");
  const memberId = id(req.params.userId, "User ID");
  const { role: actorRole } = await workspaceAccess(req.user, workspaceId);
  requireWorkspaceRole(actorRole, ["admin", "owner", "manager"]);
  const role = enumValue(req.body.role, "Workspace role", ["manager", "member"]);
  if (actorRole === "manager" && role === "manager") throw conflict("Managers cannot grant manager access.");
  const membership = await WorkspaceMember.findOne({ where: { workspaceId, userId: memberId } });
  if (!membership) throw notFound("Workspace member not found.");
  if (membership.role === "owner") throw badRequest("The workspace owner role cannot be changed here.");
  membership.role = role;
  await membership.save();
  res.json({ success: true, message: "Workspace role updated.", data: { membership } });
};
exports.removeMember = async (req, res) => {
  const workspaceId = id(req.params.id, "Workspace ID");
  const memberId = id(req.params.userId, "User ID");
  const { role: actorRole } = await workspaceAccess(req.user, workspaceId);
  requireWorkspaceRole(actorRole, ["admin", "owner", "manager"]);
  const membership = await WorkspaceMember.findOne({ where: { workspaceId, userId: memberId } });
  if (!membership) throw notFound("Workspace member not found.");
  if (membership.role === "owner") throw badRequest("Transfer workspace ownership before removing its owner.");
  if (actorRole === "manager" && membership.role === "manager") throw conflict("Managers cannot remove another manager.");
  await membership.destroy();
  res.json({ success: true, message: "Member removed from workspace." });
};

exports.transferOwnership = async (req, res) => {
  const workspaceId = id(req.params.id, "Workspace ID");
  const newOwnerId = id(req.body.newOwnerId, "New owner ID");
  const { workspace, role } = await workspaceAccess(req.user, workspaceId);
  requireWorkspaceRole(role, ["admin", "owner"]);
  if (newOwnerId === workspace.ownerId) throw badRequest("That user already owns this workspace.");
  const newOwner = await User.findByPk(newOwnerId);
  if (!newOwner) throw notFound("New workspace owner not found.");
  await sequelize.transaction(async (transaction) => {
    const previousOwner = await WorkspaceMember.findOne({ where: { workspaceId, userId: workspace.ownerId }, transaction });
    if (previousOwner) await previousOwner.update({ role: "manager" }, { transaction });
    else await WorkspaceMember.create({ workspaceId, userId: workspace.ownerId, role: "manager" }, { transaction });
    const [membership, created] = await WorkspaceMember.findOrCreate({ where: { workspaceId, userId: newOwnerId }, defaults: { role: "owner" }, transaction });
    if (!created) await membership.update({ role: "owner" }, { transaction });
    await workspace.update({ ownerId: newOwnerId }, { transaction });
  });
  res.json({ success: true, message: "Workspace ownership transferred.", data: { workspace, owner: { id: newOwner.id, name: newOwner.name, email: newOwner.email } } });
};
