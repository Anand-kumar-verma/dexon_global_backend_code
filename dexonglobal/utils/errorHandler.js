const { returnResponse } = require("../helper/helperResponse");

// middleware/errorHandler.js
module.exports = (err, req, res, next) => {
  if (err?.name === "SequelizeUniqueConstraintError") {
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: `${e.path} must be unique`,
      value: e.value,
    }));
    return res
      .status(201)
      .json(returnResponse(false, true, errors?.[0]?.message));
  }
  // Handle other Sequelize errors if needed
  if (err?.name === "SequelizeValidationError") {
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res
      .status(201)
      .json(returnResponse(false, true, errors?.[0]?.message));
  }
  // Default case
  return res.status(500).json(returnResponse(false, true, err?.message));
};
