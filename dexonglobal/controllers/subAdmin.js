"use strict";

const { returnResponse }                    = require("../helper/helperResponse");
const { queryDb, randomStrAlphabetNumeric } = require("../helper/utilityHelper");
const { isValidEmail, isValidMobile }       = require("../validation/validation");

const PERM_CATALOG = [
  // Members
  { key: "members.update_profile",  module: "members", label: "Update Member Profile"     },
  // Fund
  { key: "fund.topup",              module: "fund",    label: "Member Topup"              },
  { key: "fund.withdrawal_approve", module: "fund",    label: "Approve Withdrawal"        },
  { key: "fund.withdrawal_toggle",  module: "fund",    label: "Toggle Withdrawal Access"  },
  // Trade
  { key: "trade.create",            module: "trade",   label: "Create Trade Pair"         },
  { key: "trade.update_status",     module: "trade",   label: "Update Trade Pair Status"  },
  { key: "trade.delete",            module: "trade",   label: "Delete Trade Pair"         },
  { key: "trade.toggle_permission", module: "trade",   label: "Toggle Member Trade Access"},
  { key: "trade.update_profit",     module: "trade",   label: "Update Trade Profit"       },
  // Tickets
  { key: "tickets.reply",           module: "tickets", label: "Reply to Tickets"          },
];

const VALID_KEYS   = new Set(PERM_CATALOG.map((p) => p.key));
const catalogByKey = Object.fromEntries(PERM_CATALOG.map((p) => [p.key, p]));

function sanitisePerms(keys = []) {
  return [...new Set(keys)]
    .filter((k) => VALID_KEYS.has(k))
    .map((k) => catalogByKey[k]);
}

async function replacePermissions(loginId, permKeys = []) {
  await queryDb(
    "DELETE FROM tr00_subadmin_permissions WHERE tr00_perm_login_id = ?;",
    [loginId]
  );

  const enriched = sanitisePerms(permKeys);
  if (!enriched.length) return;

  const placeholders = enriched.map(() => "(?, ?, ?, ?, 1)").join(", ");
  const values       = enriched.flatMap((p) => [loginId, p.key, p.module, p.label]);

  await queryDb(
    `INSERT INTO tr00_subadmin_permissions
       (tr00_perm_login_id, tr00_perm_key, tr00_perm_module, tr00_perm_label, tr00_perm_status)
     VALUES ${placeholders};`,
    values
  );
}

exports.updateSubAdminPermissions = async (req, res) => {
  try {
    const { login_id, permissions = [] } = req.body;

    if (!login_id)
      return res.status(201).json(returnResponse(false, true, "login_id is required", []));

    const [target] = await queryDb(
      "SELECT login_id FROM tr01_login_credential WHERE login_id = ? AND lgn_user_type = 'SubAdmin' LIMIT 1;",
      [login_id]
    );
    if (!target)
      return res.status(201).json(returnResponse(false, true, "SubAdmin not found", []));

    await replacePermissions(login_id, permissions);

    return res.status(200).json(returnResponse(true, false, "Permissions updated successfully", []));
  } catch (e) {
    console.error("[updateSubAdminPermissions]", e);
    return res.status(500).json(returnResponse(false, true, e.message || "Internal Server Error", []));
  }
};

exports.getSubAdmins = async (req, res) => {
  try {
    const rows = await queryDb(
      `SELECT
         lc.login_id,
         lc.lgn_name,
         lc.lgn_email,
         lc.lgn_mobile,
         lc.lgn_cust_id,
         lc.lgn_is_blocked,
         lc.lgn_created_at,
         sp.tr00_perm_key
       FROM tr01_login_credential lc
       LEFT JOIN tr00_subadmin_permissions sp
         ON  sp.tr00_perm_login_id = lc.login_id
         AND sp.tr00_perm_status   = 1
       WHERE lc.lgn_user_type = 'SubAdmin'
       ORDER BY lc.lgn_created_at DESC, sp.tr00_perm_module, sp.tr00_perm_key;`,
      []
    );

    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.login_id)) {
        map.set(row.login_id, {
          login_id:          row.login_id,
          lgn_name:          row.lgn_name,
          lgn_email:         row.lgn_email,
          lgn_mobile:        row.lgn_mobile,
          lgn_cust_id:       row.lgn_cust_id,
          lgn_is_blocked:    row.lgn_is_blocked,
          lgn_created_at:    row.lgn_created_at,
          permissions:       [],
        });
      }
      if (row.tr00_perm_key) {
        map.get(row.login_id).permissions.push(row.tr00_perm_key);
      }
    }

    const data = [...map.values()].map((sa) => ({
      ...sa,
      total_permissions: sa.permissions.length,
    }));

    return res.status(200).json(returnResponse(true, false, "Sub-admins fetched", data));
  } catch (e) {
    console.error("[getSubAdmins]", e);
    return res.status(500).json(returnResponse(false, true, e.message || "Internal Server Error", []));
  }
};

exports.toggleSubAdminStatus = async (req, res) => {
  try {
    const { login_id, status } = req.body;

    if (!login_id || !["Yes", "No"].includes(status))
      return res.status(201).json(returnResponse(false, true, "login_id and valid status (Yes/No) required", []));

    const result = await queryDb(
      "UPDATE tr01_login_credential SET lgn_is_blocked = ? WHERE login_id = ? AND lgn_user_type = 'SubAdmin';",
      [status, login_id]
    );

    if (!result.affectedRows)
      return res.status(201).json(returnResponse(false, true, "SubAdmin not found", []));

    return res.status(200).json(
      returnResponse(true, false, status === "Yes" ? "Sub-admin blocked" : "Sub-admin unblocked", [])
    );
  } catch (e) {
    return res.status(500).json(returnResponse(false, true, e.message || "Internal Server Error", []));
  }
};

exports.toggleSubAdminAccess = async (req, res) => {
  try {
    const { login_id, user_type } = req.body;

    if (!login_id || !["SubAdmin", "User"].includes(user_type))
      return res.status(201).json(
        returnResponse(false, true, "login_id and user_type ('SubAdmin' | 'User') are required", [])
      );

    const [user] = await queryDb(
      "SELECT login_id, lgn_name, lgn_user_type FROM tr01_login_credential WHERE login_id = ? LIMIT 1;",
      [login_id]
    );
    if (!user)
      return res.status(201).json(returnResponse(false, true, "User not found", []));

    if (user.lgn_user_type === "Admin")
      return res.status(201).json(returnResponse(false, true, "Cannot change access for an Admin account", []));

    await queryDb(
      "UPDATE tr01_login_credential SET lgn_user_type = ? WHERE login_id = ?;",
      [user_type, login_id]
    );

    if (user_type === "User") {
      await queryDb(
        "DELETE FROM tr00_subadmin_permissions WHERE tr00_perm_login_id = ?;",
        [login_id]
      );
    }

    const msg = user_type === "SubAdmin"
      ? `${user.lgn_name} promoted to SubAdmin successfully`
      : `${user.lgn_name} demoted to User — permissions removed`;

    return res.status(200).json(returnResponse(true, false, msg, []));
  } catch (e) {
    console.error("[toggleSubAdminAccess]", e);
    return res.status(500).json(returnResponse(false, true, e.message || "Internal Server Error", []));
  }
};