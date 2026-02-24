exports.isValidEmail = (email) => {
  if (typeof email !== "string" || !email.trim()) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (email.length < 6 || email.length > 254) return false;
  return emailRegex.test(email);
};

exports.isValidMobile = (mobile) => {
  if (!mobile) return false;
  const mobileStr = String(mobile).trim();
  const mobileRegex = /^[6-9]\d{9}$/;
  if (mobileStr.length !== 10) return false;
  return mobileRegex.test(mobileStr);
};
