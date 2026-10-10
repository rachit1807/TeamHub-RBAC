const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("Workspace", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(80), allowNull: false },
  description: { type: DataTypes.STRING(1000), allowNull: true },
  ownerId: { type: DataTypes.INTEGER, allowNull: false },
});
