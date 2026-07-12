// Pure functions only. No DOM access, so this file is unit-testable in Node.
(function (root) {
  const Logic = {};

  Logic.filterExercises = function (list, f) {
    f = f || {};
    const q = (f.q || "").trim().toLowerCase();
    return list.filter(function (x) {
      if (f.muscle && x.primary.indexOf(f.muscle) === -1) return false;
      if (f.muscles && f.muscles.length) { // muscle-group browsing: match any
        let hit = false;
        for (let i = 0; i < f.muscles.length; i++) {
          if (x.primary.indexOf(f.muscles[i]) !== -1) { hit = true; break; }
        }
        if (!hit) return false;
      }
      if (f.equipment && x.equipment !== f.equipment) return false;
      if (f.level && x.level !== f.level) return false;
      if (f.category && x.category !== f.category) return false;
      if (q && x.name.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  };

  // Deterministic "top picks" for the overwhelmed: compound movements first,
  // then easier levels, then common equipment, then short canonical names
  // ("Pushups" beats "Incline Push-Up Reverse Grip"). No randomness —
  // suggestions should feel stable and authoritative, not like a slot machine.
  // Greedy selection takes at most one exercise per equipment type first, so
  // the shortlist reads like a coach's list (push-up, dumbbell press, barbell
  // press...) instead of five variants of the same movement.
  Logic.rankSuggestions = function (list, n) {
    n = n || 5;
    const equipRank = { "body only": 0, "dumbbell": 1, "barbell": 2, "cable": 3, "machine": 4 };
    const levelRank = { beginner: 0, intermediate: 1, expert: 2 };
    const ranked = list.slice().sort(function (a, b) {
      return (a.mechanic === "compound" ? 0 : 1) - (b.mechanic === "compound" ? 0 : 1) ||
        (levelRank[a.level] || 0) - (levelRank[b.level] || 0) ||
        (equipRank[a.equipment] != null ? equipRank[a.equipment] : 9) - (equipRank[b.equipment] != null ? equipRank[b.equipment] : 9) ||
        a.name.split(/\s+/).length - b.name.split(/\s+/).length ||
        a.name.localeCompare(b.name);
    });
    const family = function (x) { return x.name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).slice(0, 2).join(" "); };
    const picks = [], usedEquip = {}, usedFamily = {};
    for (let i = 0; i < ranked.length && picks.length < n; i++) { // one per equipment type
      const x = ranked[i];
      if (usedEquip[x.equipment] || usedFamily[family(x)]) continue;
      usedEquip[x.equipment] = true;
      usedFamily[family(x)] = true;
      picks.push(x);
    }
    for (let j = 0; j < ranked.length && picks.length < n; j++) { // top up, still avoiding same-movement variants
      const y = ranked[j];
      if (picks.indexOf(y) !== -1 || usedFamily[family(y)]) continue;
      usedFamily[family(y)] = true;
      picks.push(y);
    }
    for (let k = 0; k < ranked.length && picks.length < n; k++) { // last resort: fill
      if (picks.indexOf(ranked[k]) === -1) picks.push(ranked[k]);
    }
    return picks;
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

  // Muscle-group browsing config. `picks` are hand-curated canonical exercises
  // (validated against the DB by unit tests) shown as "top picks" — the
  // algorithmic rankSuggestions only fills in when filters exclude them.
  Logic.MUSCLE_GROUPS = [
    { key: "chest", name: "Chest", muscles: ["chest"],
      picks: ["Pushups", "Dumbbell_Bench_Press", "Barbell_Bench_Press_-_Medium_Grip", "Incline_Dumbbell_Press", "Dips_-_Chest_Version"] },
    { key: "back", name: "Back", muscles: ["lats", "middle back", "lower back", "traps", "neck"],
      picks: ["Pullups", "Wide-Grip_Lat_Pulldown", "Bent_Over_Barbell_Row", "Seated_Cable_Rows", "One-Arm_Dumbbell_Row"] },
    { key: "shoulders", name: "Shoulders", muscles: ["shoulders"],
      picks: ["Seated_Dumbbell_Press", "Standing_Military_Press", "Side_Lateral_Raise", "Front_Dumbbell_Raise", "Arnold_Dumbbell_Press"] },
    { key: "arms", name: "Arms", muscles: ["biceps", "triceps", "forearms"],
      picks: ["Barbell_Curl", "Hammer_Curls", "Triceps_Pushdown", "Dips_-_Triceps_Version", "Close-Grip_Barbell_Bench_Press"] },
    { key: "core", name: "Core", muscles: ["abdominals"],
      picks: ["Plank", "Crunches", "Sit-Up", "Russian_Twist", "Ab_Crunch_Machine"] },
    { key: "quads", name: "Quads & Hips", muscles: ["quadriceps", "abductors", "adductors"],
      picks: ["Barbell_Squat", "Bodyweight_Squat", "Leg_Press", "Dumbbell_Lunges", "Goblet_Squat"] },
    { key: "hams", name: "Hamstrings & Glutes", muscles: ["hamstrings", "glutes"],
      picks: ["Romanian_Deadlift", "Lying_Leg_Curls", "Barbell_Hip_Thrust", "Stiff-Legged_Barbell_Deadlift", "Butt_Lift_Bridge"] },
    { key: "calves", name: "Calves", muscles: ["calves"],
      picks: ["Standing_Calf_Raises", "Seated_Calf_Raise", "Calf_Press_On_The_Leg_Press_Machine", "Standing_Dumbbell_Calf_Raise", "Donkey_Calf_Raises"] },
    { key: "cardio", name: "Cardio & Conditioning", category: "cardio",
      picks: ["Rowing_Stationary", "Running_Treadmill", "Bicycling_Stationary", "Rope_Jumping", "Stairmaster"] }
  ];

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
