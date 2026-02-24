module.exports.returnResponse = function (success, error, msg, result=[]) {
  return {
    success: success,
    error: error,
    message: msg,
    result: result || [],
  };
};
exports.loginReq = "Login Required";
