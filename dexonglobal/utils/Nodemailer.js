const nodemailer = require("nodemailer");
require("dotenv").config();
const mailSender = async (email, title, body) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.TRADING_POOL_MAIL_USER,
        pass: process.env.TRADING_POOL_MAIL_PASS,
      },
    });

    // let transporter = nodemailer.createTransport({
    //   host: process.env.TRADING_POOL_MAIL_HOST,
    //   port: process.env.TRADING_POOL_MAIL_PORT || 587,
    //   secure: false, // use true for 465
    //   auth: {
    //     user: process.env.TRADING_POOL_MAIL_USER,
    //     pass: process.env.TRADING_POOL_MAIL_PASS,
    //   },
    //   tls: {
    //     rejectUnauthorized: false, // temp fix for hostname mismatch
    //   },
    // });

    let info = await transporter.sendMail({
      from: `${process.env.TRADING_POOL_DOMAIN_NAME} <${process.env.TRADING_POOL_MAIL_USER}>`, // ✅ correct format
      to: email,
      subject: title,
      html: body,
    });

    return info;
  } catch (error) {
    console.log(error.message);
    return error.message;
  }
};

module.exports = mailSender;
