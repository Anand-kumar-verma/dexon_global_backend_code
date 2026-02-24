const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequlize = new Sequelize(
  "administrator_dexonglobal", // db name
  "administrator_dexonglobal", // user name
  "u6&jaHoWctbK", // pass
  {
    dialect: "mysql",
    host: "103.120.176.66", // host
    logging: false,
    dialectOptions: {
      multipleStatements: true,
    },
  }
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
