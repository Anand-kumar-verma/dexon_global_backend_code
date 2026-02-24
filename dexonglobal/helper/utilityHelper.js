"user strict";

const sequelize = require("../config/seq.config");
const CryptoJS = require("crypto-js");
require("dotenv").config();
module.exports = {
  deCryptData: (data) => {
    try {
      if (!data) return null;
      if (!process.env.BODY_SECRET) throw new Error("Missing encryption key");

      const bytes = CryptoJS.AES.decrypt(data, process.env.BODY_SECRET);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);

      if (!decrypted) throw new Error("Decryption failed");

      return JSON.parse(decrypted);
    } catch (error) {
      return error.message || null;
    }
  },

  enCryptData: (data) => {
    try {
      if (!data) return null;
      if (!process.env.BODY_SECRET) throw new Error("Missing encryption key");

      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(data),
        process.env.BODY_SECRET
      ).toString();

      return encrypted;
    } catch (error) {
      console.log(error);
      return error.message || null;
    }
  },

  randomStrNumeric: function (len) {
    let ans = "";
    let arr = "1234567890";
    for (let i = len; i > 0; i--) {
      ans += arr[Math.floor(Math.random() * arr.length)];
    }
    return ans;
  },
  randomStrAlphabet: function (len) {
    let ans = "";
    let arr = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = len; i > 0; i--) {
      ans += arr[Math.floor(Math.random() * arr.length)];
    }
    return ans;
  },
  randomStrAlphabetNumeric: function (len) {
    let ans = "";
    let arr = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for (let i = len; i > 0; i--) {
      ans += arr[Math.floor(Math.random() * arr.length)];
    }
    return ans;
  },

  queryDb: function (query, param = [], transaction = null) {
    return new Promise((resolve, reject) => {
      sequelize
        .query(query, {
          replacements: param,
          transaction: transaction || undefined, // Add transaction if provided
        })
        .then((res) => resolve(res?.[0]))
        .catch((err) => reject(err));
    });
  },
};
