const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("Task", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(160), allowNull: false },
  description: { type: DataTypes.STRING(4000), allowNull: true },
  status: { type: DataTypes.ENUM("todo", "in_progress", "review", "completed"), allowNull: false, defaultValue: "todo" },
  priority: { type: DataTypes.ENUM("low", "medium", "high", "urgent"), allowNull: false, defaultValue: "medium" },
  dueDate: { type: DataTypes.DATEONLY, allowNull: true },
  projectId: { type: DataTypes.INTEGER, allowNull: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  assignedTo: { type: DataTypes.INTEGER, allowNull: true },
});
