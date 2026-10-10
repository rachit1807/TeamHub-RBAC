const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(80), allowNull: false, validate: { len: [2, 80] } },
  email: { type: DataTypes.STRING(254), allowNull: false, unique: true, validate: { isEmail: true, len: [3, 254] } },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM("admin", "manager", "member"), allowNull: false, defaultValue: "member" },
}, { defaultScope: { attributes: { exclude: ["password"] } }, scopes: { withPassword: { attributes: {} } } });

module.exports = User;
