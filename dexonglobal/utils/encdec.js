const { returnResponse } = require("../helper/helperResponse");
const { deCryptData } = require("../helper/utilityHelper");

exports.encdec = async (req, res, next) => {
  try {
    const { payload } = req.body;
    if (!payload)
      return res
        .status(201)
        .json(returnResponse(false, true, "payload is required!"));

    const decrypted = deCryptData(payload);
    if (!decrypted || typeof decrypted !== "object") {
      return res
        .status(201)
        .json(
          returnResponse(
            false,
            true,
            decrypted || "Invalid or missing payload data"
          )
        );
    }
    req.body = deCryptData(payload);
    next();
  } catch (e) {
    return res
      .status(201)
      .json(
        returnResponse(
          false,
          true,
          e?.message || "Invalid or missing payload data"
        )
      );
  }
};
