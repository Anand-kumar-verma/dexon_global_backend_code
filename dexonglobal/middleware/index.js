require("dotenv").config();
const { queryDb } = require("../helper/utilityHelper");
const { returnResponse } = require("../helper/helperResponse");
const logRequest = require("../utils/requestLogger");

exports.checkAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res
      .status(201)
      .json(returnResponse(false, true, "Authorization header is missing."));

  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer" || !token)
    return res
      .status(201)
      .json(
        returnResponse(
          false,
          true,
          "Invalid Authorization format. Must be Bearer <token>",
        ),
      );

  try {
    const rows = await queryDb(
      `SELECT login_id, lgn_jnr_id, lgn_user_type, lgn_wallet_add
       FROM tr01_login_credential
       WHERE lgn_token = ? LIMIT 1;`,
      [token],
    );

    if (!rows?.length)
      return res.status(201).json(returnResponse(false, true, "Invalid Token"));

    const user = rows[0];

    req.userId = user.lgn_jnr_id || user.login_id;
    req.login_id = user.login_id;
    req.role = user.lgn_user_type;
    req.user = {
      login_id: user.login_id,
      user_type: user.lgn_user_type,
      wallet_add: user.lgn_wallet_add,
    };

    next();
  } catch (err) {
    return res
      .status(201)
      .json(
        returnResponse(
          false,
          true,
          err?.message || "Invalid or expired token.",
        ),
      );
  }
};
exports.isAdmin = (req, res, next) => {
  try {
    if (req.role !== "Admin")
      return res
        .status(201)
        .json(returnResponse(false, true, "Routes Available for Admin.", []));
    next();
  } catch (err) {
    return res
      .status(201)
      .json(
        returnResponse(
          false,
          true,
          err?.message || "Invalid or expired token.",
        ),
      );
  }
};
exports.isAdminSubAdmin = (req, res, next) => {
  try {
    if (req.role !== "Admin" && req.role != "SubAdmin")
      return res
        .status(201)
        .json(
          returnResponse(
            false,
            true,
            "Routes Available for Admin and SubAdmin only.",
            [],
          ),
        );
    next();
  } catch (err) {
    return res
      .status(201)
      .json(
        returnResponse(
          false,
          true,
          err?.message || "Invalid or expired token.",
        ),
      );
  }
};

exports.isUser = (req, res, next) => {
  try {
    if (req.role !== "User")
      return res
        .status(201)
        .json(returnResponse(false, true, "Routes Available for User.", []));
    next();
  } catch (err) {
    return res
      .status(201)
      .json(
        returnResponse(
          false,
          true,
          err?.message || "Invalid or expired token.",
        ),
      );
  }
};

exports.checkPermission = (permKey) => async (req, res, next) => {
  try {
    const { role, login_id: loginId } = req;

    if (role === "Admin") return next();

    if (role !== "SubAdmin")
      return res
        .status(201)
        .json(
          returnResponse(
            false,
            true,
            "Access denied. Admin panel routes only.",
            [],
          ),
        );

    if (!loginId)
      return res
        .status(201)
        .json(returnResponse(false, true, "Unauthorized", []));

    const rows = await queryDb(
      `SELECT tr00_perm_id
       FROM tr00_subadmin_permissions
       WHERE tr00_perm_login_id = ?
         AND tr00_perm_key      = ?
         AND tr00_perm_status   = 1
       LIMIT 1;`,
      [loginId, permKey],
    );

    if (rows?.length) return next();

    return res
      .status(201)
      .json(
        returnResponse(
          false,
          true,
          `You don't have permission to access this feature. Please contact your Admin to grant "${permKey}" access.`,
          [],
        ),
      );
  } catch (err) {
    return res
      .status(500)
      .json(
        returnResponse(false, true, err?.message || "Permission check failed."),
      );
  }
};

exports.apiLogger = (req, res, next) => {
  res.on("finish", () => {
    logRequest({
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      body: req.body,
      status: res.statusCode,
      ip: req.ip,
    });
  });
  next();
};
