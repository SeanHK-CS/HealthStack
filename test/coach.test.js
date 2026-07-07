// Coach unit tests. Run: node test/coach.test.js
const assert = require("assert");
const path = require("path");
const fs = require("fs");

global.window = {};
for (const f of ["data/exercises.js", "data/supplements.js", "data/foods.js"]) {
  eval(fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
}
globalThis.EXERCISES = global.window.EXERCISES;
globalThis.SUPPLEMENTS = global.window.SUPPLEMENTS;
const Coach = require("../js/coach.js");
const EX = global.window.EXERCISES;
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok - " + name); };

console.log("M6: intent parsing");
t("'what should i work out for the optimal upper body workout' -> upper workout", () => {
  const q = Coach.parse("what should i work out for the optimal upper body workout");
  assert.strictEqual(q.type, "workout");
  assert.strictEqual(q.split, "upper");
});
t("'leg day with dumbbells only' -> lower + dumbbell", () => {
  const q = Coach.parse("leg day with dumbbells only");
  assert.strictEqual(q.split, "lower");
  assert.strictEqual(q.equipment, "dumbbell");
});
t("'beginner push workout at home' -> push, body only, beginner", () => {
  const q = Coach.parse("beginner push workout at home");
  assert.strictEqual(q.split, "push");
  assert.strictEqual(q.equipment, "body only");
  assert.strictEqual(q.level, "beginner");
});
t("'strength routine for my back' -> back + strength goal", () => {
  const q = Coach.parse("strength routine for my back");
  assert.strictEqual(q.split, "back");
  assert.strictEqual(q.goal, "strength");
});
t("'is creatine worth it?' -> single supplement", () => {
  const q = Coach.parse("is creatine worth it?");
  assert.strictEqual(q.type, "supp-one");
  assert.strictEqual(q.supp.id, "creatine");
});
t("'what should i take for sleep' -> supplement goal sleep", () => {
  const q = Coach.parse("what should i take for sleep");
  assert.strictEqual(q.type, "supp-goal");
  assert.strictEqual(q.goal, "sleep");
});
t("'how much protein do i need at 170 lbs' -> protein + kg weight", () => {
  const q = Coach.parse("how much protein do i need at 170 lbs");
  assert.strictEqual(q.type, "protein");
  assert(Math.abs(q.weight.kg - 77.11) < 0.1);
});
t("'how many calories should i eat' -> calories", () => {
  assert.strictEqual(Coach.parse("how many calories should i eat").type, "calories");
});
t("E5: off-topic question -> unknown", () => {
  assert.strictEqual(Coach.parse("what's the weather in chicago").type, "unknown");
});

console.log("M6: workout generation");
t("upper split: 5 exercises, correct muscles, no duplicates, compounds lead", () => {
  const r = Coach.generate(EX, { split: "upper", equipment: null, level: null, goal: "hypertrophy" }, () => 0);
  assert.strictEqual(r.items.length, 5);
  const ids = new Set(r.items.map(i => i.ex.id));
  assert.strictEqual(ids.size, 5, "no duplicate exercises");
  const allowed = ["chest", "lats", "middle back", "shoulders", "biceps", "triceps"];
  for (const i of r.items) assert(i.ex.primary.some(p => allowed.includes(p)), i.ex.name);
  assert.strictEqual(r.items[0].ex.mechanic, "compound");
  assert.strictEqual(r.items[1].ex.mechanic, "compound");
});
t("equipment constraint: dumbbell-only lower body uses only dumbbells", () => {
  const r = Coach.generate(EX, { split: "lower", equipment: "dumbbell", level: null, goal: "hypertrophy" }, () => 0);
  assert(r.items.length >= 3);
  for (const i of r.items) assert.strictEqual(i.ex.equipment, "dumbbell", i.ex.name);
});
t("beginner level constraint holds", () => {
  const r = Coach.generate(EX, { split: "push", equipment: null, level: "beginner", goal: "hypertrophy" }, () => 0.5);
  for (const i of r.items) assert.strictEqual(i.ex.level, "beginner", i.ex.name);
});
t("strength goal produces low-rep scheme on compounds", () => {
  const r = Coach.generate(EX, { split: "upper", equipment: null, level: null, goal: "strength" }, () => 0);
  assert(r.items[0].scheme.includes("4\u20136 reps"));
});
t("impossible constraint reports gaps instead of crashing", () => {
  const r = Coach.generate(EX, { split: "lower", equipment: "e-z curl bar", level: null, goal: "hypertrophy" }, () => 0);
  assert(r.gaps.length > 0);
});
t("cardio split pulls cardio/plyo exercises", () => {
  const r = Coach.generate(EX, { split: "cardio", equipment: null, level: null, goal: "hypertrophy" }, () => 0);
  assert(r.items.length >= 3);
  for (const i of r.items) assert(["cardio", "plyometrics"].includes(i.ex.category));
});

console.log("M7: answers");
t("workout answer carries items, tips, and its intent for 'another'", () => {
  const a = Coach.answer("give me an optimal upper body workout", {});
  assert.strictEqual(a.type, "workout");
  assert(a.items.length === 5 && a.tips && a.intent.split === "upper");
});
t("'another' regenerates from saved state, prompts without it", () => {
  assert.strictEqual(Coach.answer("another", {}).type, "text");
  const a = Coach.answer("another", { lastWorkout: { type: "workout", split: "pull", equipment: null, level: null, goal: "hypertrophy" } });
  assert.strictEqual(a.type, "workout");
});
t("supplement verdict maps tier to plain language", () => {
  const a = Coach.answer("should i take bcaas", {});
  assert.strictEqual(a.type, "supp");
  assert(a.verdict.toLowerCase().includes("skip"));
});
t("sleep stack lists only tier A/B and includes melatonin", () => {
  const a = Coach.answer("what should i take for sleep", {});
  assert.strictEqual(a.type, "supp-list");
  assert(a.list.every(s => s.tier === "A" || s.tier === "B"));
  assert(a.list.some(s => s.id === "melatonin"));
});
t("fat-loss question gets the honest no-pill answer", () => {
  const a = Coach.answer("best supplement for fat loss", {});
  assert(a.text.includes("no Tier A or B fat-loss pill"));
});
t("protein with weight computes 1.6-2.2 g/kg range", () => {
  const a = Coach.answer("how much protein do i need, i weigh 180 lbs", {});
  assert(a.text.includes("131") && a.text.includes("180 g")); // 81.6kg -> 131-180g
});
t("E5: unknown answer lists capabilities, no API mention", () => {
  const a = Coach.answer("write me a poem about deadlifts", {});
  assert.strictEqual(a.type, "unknown");
  assert(a.text.includes("optimal upper body workout"), "fallback lists examples");
  assert(!a.text.toLowerCase().includes("api key"), "no API mention remains");
});

console.log("\n" + pass + " coach tests passed");
