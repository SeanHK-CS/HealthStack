// Pure functions only. No DOM access, so this file is unit-testable in Node.
(function (root) {
  const Logic = {};

  Logic.filterExercises = function (list, f) {
    f = f || {};
    const q = (f.q || "").trim().toLowerCase();
    return list.filter(function (x) {
      if (f.muscle && x.primary.indexOf(f.muscle) === -1) return false;
      if (f.equipment && x.equipment !== f.equipment) return false;
      if (f.level && x.level !== f.level) return false;
      if (f.category && x.category !== f.category) return false;
      if (q && x.name.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  };

  Logic.filterSupps = function (list, f) {
    f = f || {};
    const q = (f.q || "").trim().toLowerCase();
    const order = { A: 0, B: 1, C: 2, D: 3 };
    return list
      .filter(function (s) {
        if (f.tier && s.tier !== f.tier) return false;
        if (f.goal && s.goals.indexOf(f.goal) === -1) return false;
        if (q && (s.name + " " + s.evidence).toLowerCase().indexOf(q) === -1) return false;
        return true;
      })
      .slice()
      .sort(function (a, b) {
        return order[a.tier] - order[b.tier] || a.name.localeCompare(b.name);
      });
  };

  Logic.searchFoods = function (list, q, group) {
    q = (q || "").trim().toLowerCase();
    return list.filter(function (x) {
      if (group && x.g !== group) return false;
      if (q && x.n.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  };

  // Mifflin-St Jeor BMR, activity multiplier, goal adjustment, macro split.
  // Returns { error } for invalid input; never NaN.
  Logic.calcPlan = function (input) {
    const sex = input.sex === "female" ? "female" : input.sex === "male" ? "male" : null;
    const age = Number(input.age);
    const h = Number(input.heightCm);
    const w = Number(input.weightKg);
    const act = Number(input.activity);
    const goal = input.goal;

    if (!sex) return { error: "Choose a sex (used by the BMR formula)." };
    if (!isFinite(age) || age < 14 || age > 100) return { error: "Enter an age between 14 and 100." };
    if (!isFinite(h) || h < 120 || h > 230) return { error: "Enter a height between 120 and 230 cm (about 3'11\" to 7'6\")." };
    if (!isFinite(w) || w < 35 || w > 250) return { error: "Enter a weight between 35 and 250 kg (about 77 to 550 lb)." };
    if (!isFinite(act) || act < 1.2 || act > 1.9) return { error: "Choose an activity level." };

    const bmr = Math.round(10 * w + 6.25 * h - 5 * age + (sex === "male" ? 5 : -161));
    const tdee = Math.round(bmr * act);
    let target = tdee;
    if (goal === "cut") target = Math.round(tdee * 0.8);
    if (goal === "gain") target = Math.round(tdee * 1.1);

    const proteinLo = Math.round(1.6 * w);
    const proteinHi = Math.round(2.2 * w);
    const fatG = Math.round((target * 0.25) / 9);
    const proteinMid = Math.round((proteinLo + proteinHi) / 2);
    const carbG = Math.max(0, Math.round((target - proteinMid * 4 - fatG * 9) / 4));

    return { bmr: bmr, tdee: tdee, target: target, proteinLo: proteinLo, proteinHi: proteinHi, proteinMid: proteinMid, fatG: fatG, carbG: carbG };
  };

  // Daily session: a date-seeded pick so "today's workout" is stable all day
  // and fresh tomorrow. mulberry32 is a tiny deterministic PRNG.
  Logic.dateSeed = function (d) {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  };
  Logic.mulberry32 = function (seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  Logic.dailySplit = function (d) {
    // Sun..Sat — a sane week: recovery-ish bookends, classic split midweek
    return ["full", "upper", "lower", "push", "pull", "full", "core"][d.getDay()];
  };

  Logic.lbToKg = function (lb) { return lb * 0.45359237; };
  Logic.ftInToCm = function (ft, inch) { return ft * 30.48 + (inch || 0) * 2.54; };

  Logic.muscleWikiUrl = function (name) {
    return "https://musclewiki.com/exercises?search=" + encodeURIComponent(name);
  };
  Logic.examineUrl = function (slug) {
    return "https://examine.com/supplements/" + slug + "/";
  };
  Logic.exerciseImageUrl = function (path) {
    return "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/" + path;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Logic;
  root.Logic = Logic;
})(typeof window !== "undefined" ? window : globalThis);
