const { authenticator } = require("otplib");
const { queryDb } = require("../helper/utilityHelper");           // ← adjust path to your db helper
const { returnResponse } = require("../helper/helperResponse"); // ← adjust path to your utils

let _adminSecret = null;

async function getAdminTotpSecret() {
  if (_adminSecret) return _adminSecret;
  const rows = await queryDb(
    `SELECT m00_value FROM m00_master_config 
     WHERE m00_title = 'ADMIN_2FA_SECRET' AND m00_status = 1 LIMIT 1`,
    []
  );
  _adminSecret = rows?.[0]?.m00_value ?? null;
  return _adminSecret;
}

exports.verifyAdminTotp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json(returnResponse(false, true, "OTP must be a 6-digit number", []));
    }

    const secret = await getAdminTotpSecret();

    if (!secret) {
      return res.status(500).json(returnResponse(false, true, "Admin 2FA is not configured.", []));
    }

    authenticator.options = { window: 1 };
    const isValid = authenticator.verify({ token: otp, secret });

    if (!isValid) {
      return res.status(401).json(returnResponse(false, true, "Invalid or expired OTP code", []));
    }

    return res.status(200).json(returnResponse(true, false, "OTP verified successfully", []));
  } catch (e) {
    console.error(e);
    return res.status(500).json(returnResponse(false, true, e.message || "Internal Server Error", []));
  }
};
