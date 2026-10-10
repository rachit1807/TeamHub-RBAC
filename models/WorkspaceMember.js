const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("WorkspaceMember", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  role: { type: DataTypes.ENUM("owner", "manager", "member"), allowNull: false, defaultValue: "member" },
}, { indexes: [{ unique: true, fields: ["workspaceId", "userId"] }] });
