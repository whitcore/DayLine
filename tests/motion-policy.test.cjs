const { test } = require("node:test");
const assert = require("node:assert/strict");
test("system preference keeps gentle feedback instead of silently disabling every effect", async () => {
  const { motionPolicy } = await import("../src/motion-policy.js");
  assert.equal(motionPolicy(true, "system", true), "reduced");
  assert.equal(motionPolicy(true, "system", false), "on");
});
test("explicit full and gentle modes work independently of Windows without changing its settings", async () => {
  const { motionPolicy } = await import("../src/motion-policy.js");
  assert.equal(motionPolicy(true, "full", true), "on");
  assert.equal(motionPolicy(true, "gentle", false), "reduced");
  assert.equal(motionPolicy(false, "full", false), "off");
  assert.equal(motionPolicy(false, "system", true), "off");
});
