require("dotenv").config();
const jwt = require("jsonwebtoken");
const { queryDb } = require("../helper/utilityHelper");
const { returnResponse } = require("../helper/helperResponse");

exports.checkAuth = async (req, res, next) => {
  // Get token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(201)
      .json(returnResponse(false, true, "Authorization header is missing."));
  }
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer" || !token) {
    return res
      .status(201)
      .json(
        returnResponse(
          false,
          true,
          "Invalid Authorization format. Must be Bearer <token>"
        )
      );
  }
  try {
    const getUserDetails = await queryDb(
      "SELECT `lgn_jnr_id`,`lgn_user_type`,lgn_wallet_add FROM `tr01_login_credential` WHERE `lgn_token` = ? LIMIT 1;",
      [token]
    );
    if (getUserDetails?.length === 0)
      return res.status(201).json(returnResponse(false, true, "Invalid Token"));

    req.userId = getUserDetails?.[0]?.lgn_jnr_id; // Attach the user ID to the request object
    req.role = getUserDetails?.[0]?.lgn_user_type;
    
    next();
  } catch (err) {
    return res
      .status(201)
      .json(
        returnResponse(false, true, err?.message || "Invalid or expired token.")
      );
  }
};

exports.isAdmin = (req, res, next) => {
  const role = req.role;

  try {
    if (role !== "Admin")
      return res
        .status(201)
        .json(returnResponse(false, true, "Routes Available for Admin.", []));
    next();
  } catch (err) {
    return res
      .status(201)
      .json(
        returnResponse(false, true, err?.message || "Invalid or expired token.")
      );
  }
};
exports.isUser = (req, res, next) => {
  const role = req.role;

  try {
    if (role !== "User")
      return res
        .status(201)
        .json(returnResponse(false, true, "Routes Available for User.", []));
    next();
  } catch (err) {
    return res
      .status(201)
      .json(
        returnResponse(false, true, err?.message || "Invalid or expired token.")
      );
  }
};
