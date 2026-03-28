const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePassword } = require("../src/middleware/validation");

test("validatePassword accepts letters and numbers at required length", () => {
  assert.equal(validatePassword("founder2026"), "founder2026");
});

test("validatePassword rejects short passwords", () => {
  assert.throws(() => validatePassword("short7"), /at least 10 characters/);
});

test("validatePassword rejects passwords without numbers", () => {
  assert.throws(() => validatePassword("lettersonly"), /one letter and one number/);
});
