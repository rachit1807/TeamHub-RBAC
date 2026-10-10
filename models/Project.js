const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("Project", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.STRING(2000), allowNull: true },
  status: { type: DataTypes.ENUM("planning", "active", "on_hold", "completed"), allowNull: false, defaultValue: "planning" },
  deadline: { type: DataTypes.DATEONLY, allowNull: true },
  workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
});
