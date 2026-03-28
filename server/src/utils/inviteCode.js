const crypto = require("crypto");

function generateInviteCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

module.exports = { generateInviteCode };
