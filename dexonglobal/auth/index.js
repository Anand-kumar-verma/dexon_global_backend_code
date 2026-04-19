const { default: axios } = require("axios");
const { returnResponse } = require("../helper/helperResponse");
const {
  queryDb,
  randomStrAlphabetNumeric,
  deCryptData,
  enCryptData,
} = require("../helper/utilityHelper");
const { isValidMobile, isValidEmail } = require("../validation/validation");
const mailSender = require("../utils/Nodemailer");
const registrationSuccessfully = require("../templets/registrationSuccessfully");
// exports.userLogin = async (req, res) => {
//   try {
//     const {
//       username = "",
//       mobile = "N/A",
//       email = "N/A",
//       password,
//       full_name = "N/A",
//       referral_id,
//     } = req.body;
//     if (!username || !password)
//       return res
//         .status(201)
//         .json(returnResponse(false, false, "Everything is required", []));
//     if (username === "")
//       return res
//         .status(201)
//         .json(
//           returnResponse(
//             false,
//             false,
//             "Your Telegram Not Allow to fetch data.",
//             [],
//           ),
//         );
//     // const api_response = await queryDb(
//     //   "SELECT `login_id`,lgn_user_type,lgn_cust_id FROM `rnk_mlm_login_credential` WHERE (`lgn_email` = ? OR `lgn_mobile` = ?) AND `lgn_pass` = ? LIMIT 1;",
//     //   [username?.trim(), username?.trim(), password?.trim()]
//     // );
//     const api_response = await queryDb(
//       "SELECT `login_id`,lgn_user_type,lgn_cust_id FROM `tr01_login_credential` WHERE `lgn_mobile` = ? LIMIT 1;",
//       [username?.trim()],
//     );
//     if (api_response?.length === 0 && referral_id) {
//       const token = randomStrAlphabetNumeric(100);
//       await queryDb(
//         "CALL sp_member_registration_telegram(?,?,?,?,?,?,@p_message,@p_cust_id);",
//         [
//           email?.trim(),
//           mobile?.trim(),
//           password?.trim(),
//           full_name?.trim(),
//           referral_id?.trim(),
//           token,
//         ],
//       );

//       const result = await queryDb(
//         "SELECT @p_message AS message,@p_cust_id AS cust_id;",
//         [],
//       );
//       if (result?.[0]?.message === "Login Successfully")
//         sendNotification(email?.trim());
//       else
//         return res
//           .status(201)
//           .json(
//             returnResponse(false, false, result?.[0]?.message, [
//               { cust_id: result?.[0]?.cust_id },
//             ]),
//           );
//       return res
//         .status(200)
//         .json(
//           returnResponse(true, false, "Login Successfully", [
//             { token: token, user_type: "User" },
//           ]),
//         );
//     } else if (api_response?.length === 0 && !referral_id) {
//       return res
//         .status(201)
//         .json(
//           returnResponse(false, false, "May Be Your URL is not Correct", []),
//         );
//     }
//     const token = randomStrAlphabetNumeric(100);
//     await queryDb(
//       "UPDATE `tr01_login_credential` SET `lgn_token` = ?  WHERE `login_id` = ?;",
//       [token?.trim(), Number(api_response?.[0]?.login_id)],
//     );
//     return res.status(200).json(
//       returnResponse(true, false, "Login Successfully", [
//         {
//           token: token,
//           user_type: api_response?.[0]?.lgn_user_type,
//         },
//       ]),
//     );
//   } catch (e) {
//     return res
//       .status(500)
//       .json(
//         returnResponse(false, true, e.message || `Internal Server Error`, []),
//       );
//   }
// };
// async function sendNotification(username) {
//   try {
//     username &&
//       (await axios.get(
//         `https://api.telegram.org/bot8512082856:AAEyvojXn1jlrNOm5weWNXZ7O7HHJKFkUMY/sendMessage`,
//         {
//           params: {
//             chat_id: username,
//             text: `https://t.me/RoiTele_bot/teleroi?startapp=${username}`,
//           },
//         },
//       ));
//     return;
//   } catch (e) {
//     return;
//   }
// }

exports.userRegistration = async (req, res) => {
  try {
    const {
      mobile = "",
      email = "",
      password,
      full_name = "",
      referral_id,
    } = req.body;
    if (!mobile)
      return res
        .status(201)
        .json(returnResponse(false, true, "Mobile is required", []));
    if (!password)
      return res
        .status(201)
        .json(returnResponse(false, true, "Password is required", []));
    if (!email)
      return res
        .status(201)
        .json(returnResponse(false, true, "Email is required", []));
    if (!full_name)
      return res
        .status(201)
        .json(returnResponse(false, true, "Full name is required", []));
    if (!referral_id)
      return res
        .status(201)
        .json(returnResponse(false, true, "Referral id is required", []));

    if (!isValidMobile(mobile))
      return res
        .status(201)
        .json(returnResponse(false, true, "Invalid Mobile Number", []));
    if (!isValidEmail(email))
      return res
        .status(201)
        .json(returnResponse(false, true, "Invalid Email", []));

    const api_response = await queryDb(
      "SELECT `login_id`,lgn_user_type,lgn_cust_id FROM `tr01_login_credential` WHERE `lgn_mobile` = ? OR `lgn_email` = ? LIMIT 1;",
      [mobile?.trim(), email?.trim()],
    );
    if (api_response?.length > 0)
      return res
        .status(201)
        .json(
          returnResponse(false, true, "Mobile or email already exist", [,]),
        );
    const token = randomStrAlphabetNumeric(100);
    await queryDb(
      "CALL sp_member_registration(?,?,?,?,?,?,@p_message,@p_cust_id);",
      [
        email?.trim(),
        mobile?.trim(),
        password?.trim(),
        full_name?.trim(),
        referral_id?.trim(),
        token,
      ],
    );
    const result = await queryDb(
      "SELECT @p_message AS message,@p_cust_id AS cust_id;",
      [],
    );
    if (result?.[0]?.message === "Registration Successfully") {
      // await mailSender(
      //   email?.trim(),
      //   `Congcongratulations,${full_name?.trim()}`,
      //   registrationSuccessfully(
      //     full_name?.trim(),
      //     String(result?.[0]?.cust_id)?.trim(),
      //     password?.trim()
      //   )
      // );
      return res
        .status(200)
        .json(returnResponse(true, false, "Registration Successfully", []));
    }
    return res
      .status(201)
      .json(returnResponse(false, true, result?.[0]?.message, []));
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json(
        returnResponse(false, true, e.message || `Internal Server Error`, []),
      );
  }
};
// without telegram
exports.userLogin = async (req, res) => {
  try {
    const { username = "", password, lgn_type = 2 } = req.body;
    if (!username || !password)
      return res
        .status(201)
        .json(returnResponse(false, false, "Everything is required", []));

    const api_response = await queryDb(
      "SELECT `login_id`,lgn_user_type,lgn_cust_id,lgn_is_blocked FROM `tr01_login_credential` WHERE (`lgn_mobile` = ? OR  `lgn_email` = ?) and `lgn_pass` = ? and `lgn_user_type` = ? LIMIT 1;",
      [username?.trim(), username?.trim(), password?.trim(), lgn_type],
    );
    if (api_response?.length === 0)
      return res
        .status(201)
        .json(returnResponse(false, true, "Invalid Credentials", []));
    if (api_response?.[0]?.lgn_is_blocked === "Yes") {
      return res
        .status(201)
        .json(returnResponse(false, true, "Your account is blocked", []));
    }
    const token = randomStrAlphabetNumeric(100);
    await queryDb(
      "UPDATE `tr01_login_credential` SET `lgn_token` = ?  WHERE `login_id` = ?;",
      [token?.trim(), Number(api_response?.[0]?.login_id)],
    );
    return res.status(200).json(
      returnResponse(true, false, "Login Successfully", [
        {
          token: token,
          user_type: api_response?.[0]?.lgn_user_type,
        },
      ]),
    );
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json(
        returnResponse(false, true, e.message || `Internal Server Error`, []),
      );
  }
};

// admin login
exports.adminLogin = async (req, res) => {
  try {
    const { username = "", password } = req.body;
    if (!username || !password)
      return res
        .status(201)
        .json(returnResponse(false, false, "Everything is required", []));

    const api_response = await queryDb(
      "SELECT `login_id`,lgn_user_type,lgn_cust_id,lgn_is_blocked FROM `tr01_login_credential` WHERE (`lgn_mobile` = ? OR  `lgn_email` = ?) and `lgn_pass` = ? and `lgn_user_type` IN ('Admin', 'SubAdmin') LIMIT 1;",
      [username?.trim(), username?.trim(), password?.trim()],
    );
    if (api_response?.length === 0)
      return res
        .status(201)
        .json(returnResponse(false, true, "Invalid Credentials", []));
    if (api_response?.[0]?.lgn_is_blocked === "Yes") {
      return res
        .status(201)
        .json(returnResponse(false, true, "Your account is blocked", []));
    }

    const token = randomStrAlphabetNumeric(100);
    await queryDb(
      "UPDATE `tr01_login_credential` SET `lgn_token` = ?  WHERE `login_id` = ?;",
      [token?.trim(), Number(api_response?.[0]?.login_id)],
    );
    return res.status(200).json(
      returnResponse(true, false, "Login Successfully", [
        {
          token: token,
          user_type: api_response?.[0]?.lgn_user_type,
        },
      ]),
    );
  } catch (e) {
    return res
      .status(500)
      .json(
        returnResponse(false, true, e.message || `Internal Server Error`, []),
      );
  }
};

exports.dappUserLogin = async (req, res) => {
  try {
    const { payload } = req.body;

    const { wallet_address_user_ka = "", referral_id } =
      deCryptData(payload) || {};

    if (!wallet_address_user_ka)
      return res.status(201).json({
        apiRes: enCryptData(
          returnResponse(false, false, "Wallet address is required", []),
        ),
      });

    const api_response = await queryDb(
      "SELECT `login_id`,lgn_user_type,lgn_cust_id,lgn_is_blocked FROM `tr01_login_credential` WHERE `lgn_wallet_add` = ? LIMIT 1;",
      [wallet_address_user_ka?.trim()?.toLowerCase()],
    );
    if (api_response?.length === 0 && referral_id) {
      const token = randomStrAlphabetNumeric(100);

      await queryDb("CALL sp_dapp_registration(?,?,?,@p_message,@p_cust_id);", [
        wallet_address_user_ka?.trim()?.toLowerCase(),
        referral_id?.trim(),
        token,
      ]);
      const result = await queryDb(
        "SELECT @p_message AS message, @p_cust_id AS cust_id;",
        [],
      );

      return res.status(200).json({
        apiRes: enCryptData(
          returnResponse(true, false, result?.[0]?.message, [
            { token: token, user_type: "User", cust_id: result?.[0]?.cust_id },
          ]),
        ),
      });
    } else if (api_response?.length === 0 && !referral_id) {
      return res.status(201).json({
        apiRes: enCryptData(
          returnResponse(false, false, "Wallet Not Registered", []),
        ),
      });
    }
    if (api_response?.[0]?.lgn_is_blocked === "Yes") {
      return res.status(201).json({
        apiRes: enCryptData(
          returnResponse(
            false,
            false,
            "Sorry! Your Id is not activated for login, Try again later.",
            [
              {
                token: "",
                user_type: "User",
              },
            ],
          ),
        ),
      });
    }
    const token = randomStrAlphabetNumeric(100);
    await queryDb(
      "UPDATE `tr01_login_credential` SET `lgn_token` = ?  WHERE `login_id` = ?;",
      [token?.trim(), Number(api_response?.[0]?.login_id)],
    );
    return res.status(200).json({
      apiRes: enCryptData(
        returnResponse(true, false, "Login Successfully", [
          {
            token: token,
            user_type: api_response?.[0]?.lgn_user_type,
          },
        ]),
      ),
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      apiRes: enCryptData(
        returnResponse(false, true, e.message || `Internal Server Error`, []),
      ),
    });
  }
};
