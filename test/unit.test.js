// Unit tests: data integrity + pure logic. Run: node test/unit.test.js
const assert = require("assert");
const path = require("path");
const fs = require("fs");

// Load data files (they assign to window.*)
global.window = {};
for (const f of ["data/exercises.js", "data/supplements.js", "data/foods.js"]) {
  eval(fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
}
const L = require("../js/logic.js");
const EX = global.window.EXERCISES, SUPP = global.window.SUPPLEMENTS, FOODS = global.window.FOODS;
let pass = 0;
function t(name, fn) { fn(); pass++; console.log("  ok - " + name); }

console.log("Data integrity");
t("873 exercises loaded, all with required fields", () => {
  assert.strictEqual(EX.length, 873);
  for (const x of EX) {
    assert(x.id && x.name && x.level && x.equipment && x.category, x.name);
    assert(Array.isArray(x.primary) && x.primary.length >= 1, x.name);
    assert(Array.isArray(x.instructions), x.name);
    assert(Array.isArray(x.images) && x.images.length >= 1, x.name);
  }
});
t("33 supplements, valid tiers, unique ids, examine slugs present", () => {
  assert.strictEqual(SUPP.length, 33);
  const ids = new Set();
  for (const s of SUPP) {
    assert(["A", "B", "C", "D"].includes(s.tier), s.name);
    assert(s.goals.length >= 1 && s.evidence && s.safety && s.slug, s.name);
    assert(!ids.has(s.id), "dup id " + s.id); ids.add(s.id);
  }
  assert(SUPP.filter(s => s.tier === "A").length >= 3, "has tier A entries");
  assert(SUPP.filter(s => s.tier === "D").length >= 3, "has tier D entries");
});
t("foods: 80+ entries, numeric macros, no NaN", () => {
  assert(FOODS.length >= 80, "count " + FOODS.length);
  for (const f of FOODS)
    for (const k of ["kcal", "p", "c", "f", "fb"])
      assert(Number.isFinite(f[k]) && f[k] >= 0, f.n + "." + k);
});

console.log("M1: exercise filtering");
t("filter by muscle+equipment+level narrows correctly", () => {
  const r = L.filterExercises(EX, { muscle: "chest", equipment: "dumbbell", level: "beginner" });
  assert(r.length > 0 && r.length < 30);
  for (const x of r) {
    assert(x.primary.includes("chest") && x.equipment === "dumbbell" && x.level === "beginner");
  }
});
t("text search finds squats", () => {
  const r = L.filterExercises(EX, { q: "squat" });
  assert(r.length > 10 && r.every(x => x.name.toLowerCase().includes("squat")));
});
t("E3: impossible filter combo returns empty array (not crash)", () => {
  const r = L.filterExercises(EX, { q: "zzzznotreal" });
  assert.deepStrictEqual(r, []);
});
t("MuscleWiki link is a safe encoded search URL", () => {
  assert.strictEqual(L.muscleWikiUrl("Barbell Squat"), "https://musclewiki.com/exercises?search=Barbell%20Squat");
});

console.log("M2: supplement ranking");
t("results sort tier A first, D last", () => {
  const r = L.filterSupps(SUPP, {});
  assert.strictEqual(r[0].tier, "A");
  assert.strictEqual(r[r.length - 1].tier, "D");
});
t("goal filter: muscle includes creatine, excludes melatonin", () => {
  const names = L.filterSupps(SUPP, { goal: "muscle" }).map(s => s.id);
  assert(names.includes("creatine") && !names.includes("melatonin"));
});
t("tier filter A returns only A", () => {
  assert(L.filterSupps(SUPP, { tier: "A" }).every(s => s.tier === "A"));
});

console.log("M3: nutrition");
t("calculator matches hand-checked Mifflin-St Jeor case", () => {
  // male, 25y, 178cm, 77.1kg (170lb), 1.55, maintain
  // BMR = 10*77.1 + 6.25*178 - 5*25 + 5 = 771+1112.5-125+5 = 1763.5 -> 1764(round)
  const r = L.calcPlan({ sex: "male", age: 25, heightCm: 178, weightKg: 77.1, activity: 1.55, goal: "maintain" });
  assert.strictEqual(r.bmr, 1764);
  assert.strictEqual(r.tdee, Math.round(1764 * 1.55)); // 2734
  assert.strictEqual(r.target, r.tdee);
  assert.strictEqual(r.proteinLo, Math.round(1.6 * 77.1)); // 123
  assert(r.carbG > 0 && Number.isFinite(r.carbG));
});
t("cut goal reduces target by 20%", () => {
  const m = L.calcPlan({ sex: "female", age: 30, heightCm: 165, weightKg: 60, activity: 1.375, goal: "maintain" });
  const c = L.calcPlan({ sex: "female", age: 30, heightCm: 165, weightKg: 60, activity: 1.375, goal: "cut" });
  assert.strictEqual(c.target, Math.round(m.tdee * 0.8));
});
t("E4: invalid inputs return error strings, never NaN", () => {
  for (const bad of [
    { sex: "", age: 25, heightCm: 178, weightKg: 77, activity: 1.55 },
    { sex: "male", age: "", heightCm: 178, weightKg: 77, activity: 1.55 },
    { sex: "male", age: 25, heightCm: 0, weightKg: 77, activity: 1.55 },
    { sex: "male", age: 25, heightCm: 178, weightKg: -5, activity: 1.55 },
    { sex: "male", age: 25, heightCm: 178, weightKg: 77, activity: "" },
  ]) {
    const r = L.calcPlan(bad);
    assert(typeof r.error === "string" && r.error.length > 0, JSON.stringify(bad));
    assert(!("target" in r));
  }
});
t("unit conversions: 170lb -> 77.11kg, 5'10\" -> 177.8cm", () => {
  assert(Math.abs(L.lbToKg(170) - 77.11) < 0.01);
  assert(Math.abs(L.ftInToCm(5, 10) - 177.8) < 0.01);
});
t("food search: 'chicken' + protein group", () => {
  const r = L.searchFoods(FOODS, "chicken", "protein");
  assert(r.length === 2 && r.every(x => x.g === "protein"));
});
t("E3: food search no-match returns empty", () => {
  assert.deepStrictEqual(L.searchFoods(FOODS, "unobtainium", ""), []);
});

console.log("M13: muscle-group browsing + top picks");
t("curated group picks: every id exists and belongs to its group", () => {
  const byId = {};
  EX.forEach(x => byId[x.id] = x);
  for (const g of L.MUSCLE_GROUPS) {
    assert.strictEqual(g.picks.length, 5, g.key + " has 5 picks");
    for (const id of g.picks) {
      const x = byId[id];
      assert(x, g.key + ": unknown id " + id);
      if (g.muscles) assert(g.muscles.some(m => x.primary.includes(m)), g.key + ": " + id + " trains " + x.primary);
      if (g.category) assert.strictEqual(x.category, g.category, g.key + ": " + id);
    }
  }
});
t("muscle groups cover every primary muscle in the DB", () => {
  const covered = new Set();
  L.MUSCLE_GROUPS.forEach(g => (g.muscles || []).forEach(m => covered.add(m)));
  const all = new Set();
  EX.forEach(x => x.primary.forEach(m => all.add(m)));
  for (const m of all) assert(covered.has(m), "uncovered muscle: " + m);
});
t("muscles array filter matches any listed primary muscle", () => {
  const r = L.filterExercises(EX, { muscles: ["lats", "middle back"] });
  assert(r.length > 20);
  assert(r.every(x => x.primary.includes("lats") || x.primary.includes("middle back")));
});
t("muscles filter composes with equipment", () => {
  const r = L.filterExercises(EX, { muscles: ["chest"], equipment: "dumbbell" });
  assert(r.length > 0 && r.every(x => x.primary.includes("chest") && x.equipment === "dumbbell"));
});
t("rankSuggestions: deterministic, compound-first, beginner-leaning", () => {
  const chest = L.filterExercises(EX, { muscles: ["chest"] }).filter(x => x.category === "strength");
  const a = L.rankSuggestions(chest, 5);
  const b = L.rankSuggestions(chest, 5);
  assert.deepStrictEqual(a.map(x => x.id), b.map(x => x.id), "stable output");
  assert.strictEqual(a.length, 5);
  assert(a.every(x => x.mechanic === "compound"), "compounds lead");
  assert.strictEqual(a[0].level, "beginner", "easiest first");
  assert(!Object.is(a, chest) && chest.length > 5, "input list not mutated/truncated");
});
t("rankSuggestions: shortlist is diverse — one per equipment type, no movement variants", () => {
  const chest = L.filterExercises(EX, { muscles: ["chest"] }).filter(x => x.category === "strength");
  const picks = L.rankSuggestions(chest, 5);
  const equip = picks.map(x => x.equipment);
  assert.strictEqual(new Set(equip).size, equip.length, "equipment unique: " + equip.join(", "));
  const fams = picks.map(x => x.name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).slice(0, 2).join(" "));
  assert.strictEqual(new Set(fams).size, fams.length, "movement families unique: " + picks.map(x => x.name).join(", "));
});

console.log("M12: today's session (date-seeded daily pick)");
t("dateSeed is stable per calendar day, distinct across days", () => {
  assert.strictEqual(L.dateSeed(new Date(2026, 6, 12)), 20260712);
  assert.notStrictEqual(L.dateSeed(new Date(2026, 6, 12)), L.dateSeed(new Date(2026, 6, 13)));
});
t("mulberry32: same seed -> same sequence in [0,1); different seed differs", () => {
  const a = L.mulberry32(20260712), b = L.mulberry32(20260712), c = L.mulberry32(20260713);
  const seqA = [a(), a(), a()], seqB = [b(), b(), b()], seqC = [c(), c(), c()];
  assert.deepStrictEqual(seqA, seqB);
  assert.notDeepStrictEqual(seqA, seqC);
  for (const v of seqA) assert(v >= 0 && v < 1);
});
t("dailySplit maps the week to real splits (Sun full ... Sat core)", () => {
  const splits = [];
  for (let d = 12; d <= 18; d++) splits.push(L.dailySplit(new Date(2026, 6, d))); // Jul 12 2026 is a Sunday
  assert.deepStrictEqual(splits, ["full", "upper", "lower", "push", "pull", "full", "core"]);
});
t("seeded generation is deterministic (same seed -> identical workout)", () => {
  const Coach = require("../js/coach.js");
  const one = Coach.generate(EX, { split: "upper", goal: "hypertrophy" }, L.mulberry32(20260712));
  const two = Coach.generate(EX, { split: "upper", goal: "hypertrophy" }, L.mulberry32(20260712));
  assert.deepStrictEqual(one.items.map(i => i.ex.id), two.items.map(i => i.ex.id));
  assert(one.items.length >= 4);
});

console.log("\n" + pass + " tests passed");
