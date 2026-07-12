// Shareable plan links: pure logic tests. Run: node test/share.test.js
const assert = require("assert");
const path = require("path");
const fs = require("fs");

global.window = {};
eval(fs.readFileSync(path.join(__dirname, "..", "data/exercises.js"), "utf8"));
const Share = require("../js/share.js");
const EX = global.window.EXERCISES;

let pass = 0;
function t(name, fn) { fn(); pass++; console.log("  ok - " + name); }

const id1 = EX[0].id, id2 = EX[1].id;

console.log("M10: encode/decode round-trip");
t("plan with title, coach, message, and unicode/HTML-ish notes survives round-trip", () => {
  const plan = {
    title: "Week 1 — Upper",
    coach: "Coach Sören 💪",
    message: "Light weights, focus on form. <b>No ego lifting.</b>",
    items: [
      { id: id1, note: "3×8, slow eccentric — “control the way down”" },
      { id: id2, note: "" },
    ],
  };
  const { code, error } = Share.encodePlan(plan);
  assert(!error && typeof code === "string");
  const r = Share.decodePlan(code, EX);
  assert(!r.error, r.error);
  assert.strictEqual(r.plan.title, plan.title);
  assert.strictEqual(r.plan.coach, plan.coach);
  assert.strictEqual(r.plan.message, plan.message);
  assert.strictEqual(r.plan.items.length, 2);
  assert.strictEqual(r.plan.items[0].id, id1);
  assert.strictEqual(r.plan.items[0].note, plan.items[0].note);
  assert.strictEqual(r.plan.items[0].exercise, EX[0], "exercise object attached");
});
t("code is URL-safe (base64url charset, no padding)", () => {
  const { code } = Share.encodePlan({ items: [{ id: id1, note: "a+b/c=d & ünïcode" }] });
  assert(/^[A-Za-z0-9\-_]+$/.test(code), code);
  assert.strictEqual(encodeURIComponent(code), code, "needs no percent-encoding");
});

console.log("E7: hostile / broken input");
t("empty plan refuses to encode with a named error", () => {
  assert(Share.encodePlan({ items: [] }).error);
  assert(Share.encodePlan(null).error);
  assert(Share.encodePlan({ items: [{ id: 42 }, { note: "no id" }] }).error);
});
t("garbage codes return a named error, never throw", () => {
  for (const bad of ["", "!!!not-base64!!!", "aGVsbG8", Share.toB64("[1,2,3]"), Share.toB64('{"v":2,"x":[]}'), null, undefined]) {
    const r = Share.decodePlan(bad, EX);
    assert(typeof r.error === "string" && r.error.length > 0, String(bad));
  }
});
t("unknown exercise ids are dropped; all-unknown gives a named error", () => {
  const mixed = Share.encodePlan({ items: [{ id: id1, note: "keep" }, { id: "Not_A_Real_Exercise", note: "drop" }] });
  const r = Share.decodePlan(mixed.code, EX);
  assert.strictEqual(r.plan.items.length, 1);
  assert.strictEqual(r.plan.items[0].id, id1);
  const allBad = Share.encodePlan({ items: [{ id: "Nope_1" }, { id: "Nope_2" }] });
  assert(Share.decodePlan(allBad.code, EX).error);
});
t("length caps: 20 items -> 15, long note/title clipped", () => {
  const items = EX.slice(0, 20).map((x) => ({ id: x.id, note: "y".repeat(999) }));
  const { code } = Share.encodePlan({ title: "t".repeat(999), items });
  const r = Share.decodePlan(code, EX);
  assert.strictEqual(r.plan.items.length, Share.LIMITS.items);
  assert.strictEqual(r.plan.items[0].note.length, Share.LIMITS.note);
  assert.strictEqual(r.plan.title.length, Share.LIMITS.title);
});

console.log("M10: links and hash parsing");
t("planLink replaces any existing hash", () => {
  assert.strictEqual(Share.planLink("https://x.test/app#old", "abc"), "https://x.test/app#p=abc");
  assert.strictEqual(Share.planLink("file:///C:/HealthStack/index.html", "abc"), "file:///C:/HealthStack/index.html#p=abc");
});
t("parseHash finds #p= codes and ignores everything else", () => {
  assert.strictEqual(Share.parseHash("#p=aB1-_"), "aB1-_");
  assert.strictEqual(Share.parseHash("https://x.test/app#p=Zz9"), "Zz9");
  assert.strictEqual(Share.parseHash("#other=1&p=Q_w"), "Q_w");
  assert.strictEqual(Share.parseHash("#panel-workouts"), null);
  assert.strictEqual(Share.parseHash(""), null);
  assert.strictEqual(Share.parseHash(null), null);
});
t("real-size plan (15 exercises, full notes) stays under ~8 KB of URL", () => {
  const items = EX.slice(0, 15).map((x) => ({ id: x.id, note: "Tempo 3-1-1, RPE 8. ".repeat(10) }));
  const { code } = Share.encodePlan({ title: "Full program", coach: "Coach", message: "m".repeat(500), items });
  assert(code.length < 8000, "code length " + code.length);
  assert(!Share.decodePlan(code, EX).error);
});

console.log("\n" + pass + " share tests passed");
