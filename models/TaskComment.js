const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("TaskComment", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  body: { type: DataTypes.STRING(2000), allowNull: false },
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
});
