const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequlize = new Sequelize(
  process.env.DB_NAME, // db name
  process.env.DB_USER, // user name
  process.env.DB_PASSWORD, // pass
  {
    dialect: "mysql",
    host: process.env.DB_HOST, // host
    logging: false,
    dialectOptions: {
      multipleStatements: true,
    },
  },
);
// (async () => {
//   try {
//     await sequlizebnbchainx.authenticate();
//     console.log("✅ Connection has been established successfully. bnbchain");
//   } catch (error) {
//     console.error("❌ Unable to connect to the database:", error);
//   } finally {
//     await sequlizebnbchainx.close();
//   }
// })();
module.exports = sequlize;
