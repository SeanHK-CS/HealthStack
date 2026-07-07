// Coach: rule-based Q&A over the bundled data. Pure logic, no DOM, unit-testable in Node.
// answer() returns structured objects; the app layer renders them.
(function (root) {
  var Coach = {};

  /* ---------------- splits: slots of acceptable primary muscles ---------------- */
  var SPLITS = {
    upper:     [["chest"], ["lats", "middle back"], ["shoulders"], ["biceps"], ["triceps"]],
    lower:     [["quadriceps"], ["hamstrings"], ["glutes"], ["calves"], ["abdominals"]],
    push:      [["chest"], ["shoulders"], ["chest", "shoulders"], ["triceps"]],
    pull:      [["lats"], ["middle back"], ["biceps"], ["traps", "forearms"]],
    full:      [["quadriceps"], ["chest"], ["lats", "middle back"], ["shoulders"], ["hamstrings", "glutes"], ["abdominals"]],
    arms:      [["biceps"], ["triceps"], ["biceps"], ["triceps"]],
    chest:     [["chest"], ["chest"], ["chest"], ["chest"]],
    back:      [["lats"], ["middle back"], ["lower back"], ["traps"]],
    shoulders: [["shoulders"], ["shoulders"], ["shoulders"], ["traps"]],
    core:      [["abdominals"], ["abdominals"], ["abdominals"], ["lower back"]],
    glutes:    [["glutes"], ["glutes"], ["hamstrings"], ["quadriceps"]],
    cardio:    "cardio"
  };
  var SPLIT_WORDS = [
    [/upper/, "upper"], [/lower|leg/, "lower"], [/push/, "push"], [/pull/, "pull"],
    [/full\s*body|total\s*body|whole\s*body/, "full"], [/\barms?\b|bicep|tricep/, "arms"],
    [/chest|pec/, "chest"], [/\bback\b|\blats?\b/, "back"], [/shoulder|delt/, "shoulders"],
    [/core|abs|abdominal/, "core"], [/glute|booty/, "glutes"], [/cardio|conditioning|hiit/, "cardio"]
  ];
  var EQUIP_WORDS = [
    [/dumbbell/, "dumbbell"], [/barbell/, "barbell"], [/kettlebell/, "kettlebells"],
    [/cable/, "cable"], [/machine/, "machine"], [/\bbands?\b/, "bands"],
    [/body\s*weight|bodyweight|no equipment|at home|home workout/, "body only"]
  ];

  Coach.parse = function (text) {
    var t = " " + String(text || "").toLowerCase() + " ";
    var intent = { type: null };

    // split / workout intent
    var split = null;
    for (var i = 0; i < SPLIT_WORDS.length; i++) if (SPLIT_WORDS[i][0].test(t)) { split = SPLIT_WORDS[i][1]; break; }
    var wantsWorkout = /work\s*out|workout|routine|exercis|train|program|\bday\b|\bsplit\b/.test(t);

    // supplement intent
    var suppMention = null;
    for (var s = 0; s < root.SUPPLEMENTS.length; s++) {
      var sup = root.SUPPLEMENTS[s];
      var first = sup.name.toLowerCase().split(/[\s(\/]/)[0];
      if (first.length > 3 && t.indexOf(first) !== -1) { suppMention = sup; break; }
      if (t.indexOf(sup.id) !== -1) { suppMention = sup; break; }
    }
    var suppGoal = null;
    [["sleep", /sleep|insomnia/], ["focus", /focus|energy|concentrat/], ["muscle", /muscle|bulk|gain size|hypertrophy/],
     ["endurance", /endurance|running|marathon|stamina/], ["recovery", /recovery|sore/], ["stress", /stress|anxi/],
     ["joints", /joint|tendon|knee pain|elbow pain/], ["fatloss", /fat\s*loss|lose (weight|fat)|burn fat|cutting|weight\s*loss/]
    ].forEach(function (p) { if (!suppGoal && p[1].test(t)) suppGoal = p[0]; });
    var wantsSupp = /supplement|should i take|worth (it|taking)|stack\b|vitamin|creatine|protein powder/.test(t);

    // nutrition intent
    var weight = null;
    var m = t.match(/(\d{2,3})\s*(lbs?|pounds)/); if (m) weight = { kg: Number(m[1]) * 0.45359237 };
    m = t.match(/(\d{2,3})\s*(kg|kilo)/); if (m) weight = { kg: Number(m[1]) };
    if (/how (much|many).*protein|protein.*(need|should|target|per day)/.test(t)) return { type: "protein", weight: weight };
    if (/calorie|tdee|maintenance|how much should i eat|macros/.test(t)) return { type: "calories" };

    if (suppMention) return { type: "supp-one", supp: suppMention };
    if (wantsSupp || (suppGoal && !wantsWorkout)) return { type: "supp-goal", goal: suppGoal };

    if (split || wantsWorkout) {
      var equipment = null;
      for (var e = 0; e < EQUIP_WORDS.length; e++) if (EQUIP_WORDS[e][0].test(t)) { equipment = EQUIP_WORDS[e][1]; break; }
      var level = /beginner|new to|just start/.test(t) ? "beginner"
        : /advanced|expert/.test(t) ? "expert"
        : /intermediate/.test(t) ? "intermediate" : null;
      var goal = /strength|stronger|powerlifting|\b1rm\b/.test(t) ? "strength"
        : /endurance|toning|high rep/.test(t) ? "endurance" : "hypertrophy";
      return { type: "workout", split: split || "full", equipment: equipment, level: level, goal: goal };
    }
    if (/^(hi|hey|hello|yo|sup)\b/.test(t.trim())) return { type: "greet" };
    if (/another|again|different|new one|regenerate|refresh/.test(t)) return { type: "again" };
    return { type: "unknown" };
  };

  /* ---------------- workout generation ---------------- */
  function repScheme(goal, mechanic) {
    if (goal === "strength") return mechanic === "compound" ? "4 sets \u00d7 4\u20136 reps, 2\u20133 min rest" : "3 sets \u00d7 8 reps, 90 s rest";
    if (goal === "endurance") return "3 sets \u00d7 15\u201320 reps, 45\u201360 s rest";
    return mechanic === "compound" ? "4 sets \u00d7 8\u201310 reps, 2 min rest" : "3 sets \u00d7 10\u201315 reps, 60\u201390 s rest";
  }

  Coach.generate = function (exercises, opts, rng) {
    rng = rng || Math.random;
    var levels = opts.level === "beginner" ? ["beginner"]
      : opts.level === "expert" ? ["beginner", "intermediate", "expert"]
      : opts.level === "intermediate" ? ["beginner", "intermediate"]
      : ["beginner", "intermediate"]; // sensible default
    var picked = [], used = {}, gaps = [];

    if (SPLITS[opts.split] === "cardio") {
      var cands = exercises.filter(function (x) {
        return (x.category === "cardio" || x.category === "plyometrics") &&
          levels.indexOf(x.level) !== -1 &&
          (!opts.equipment || x.equipment === opts.equipment);
      });
      for (var k = 0; k < 4 && cands.length; k++) {
        var c = cands.splice(Math.floor(rng() * cands.length), 1)[0];
        picked.push({ ex: c, scheme: "3\u20134 rounds \u00d7 30\u201345 s work, 15\u201330 s rest" });
      }
      if (!picked.length) gaps.push("cardio with that equipment");
      return { items: picked, gaps: gaps };
    }

    var slots = SPLITS[opts.split] || SPLITS.full;
    slots.forEach(function (slot) {
      var cands = exercises.filter(function (x) {
        if (used[x.id]) return false;
        if (["strength", "powerlifting", "olympic weightlifting"].indexOf(x.category) === -1) return false;
        if (levels.indexOf(x.level) === -1) return false;
        if (opts.equipment && x.equipment !== opts.equipment) return false;
        var hit = false;
        for (var i = 0; i < slot.length; i++) if (x.primary.indexOf(slot[i]) !== -1) hit = true;
        return hit;
      });
      if (!cands.length) { gaps.push(slot.join("/")); return; }
      var compounds = cands.filter(function (x) { return x.mechanic === "compound"; });
      var pool = picked.length < 2 && compounds.length ? compounds : (compounds.length && rng() < 0.6 ? compounds : cands);
      var choice = pool[Math.floor(rng() * pool.length)];
      used[choice.id] = true;
      picked.push({ ex: choice, scheme: repScheme(opts.goal, choice.mechanic) });
    });
    return { items: picked, gaps: gaps };
  };

  /* ---------------- answers ---------------- */
  Coach.answer = function (text, state) {
    var q = Coach.parse(text);
    var order = { A: 0, B: 1, C: 2, D: 3 };

    if (q.type === "greet") return { type: "text", text: "Hey! Ask me for a workout (\u201cbest upper body workout with dumbbells\u201d), about a supplement (\u201cis creatine worth it?\u201d), or nutrition basics (\u201chow much protein do I need at 170 lb?\u201d)." };

    if (q.type === "again") {
      if (state && state.lastWorkout) { q = state.lastWorkout; }
      else return { type: "text", text: "Nothing to redo yet \u2014 ask me for a workout first, like \u201cgive me a pull day\u201d." };
    }

    if (q.type === "workout") {
      var res = Coach.generate(root.EXERCISES, q);
      if (!res.items.length) return { type: "text", text: "I couldn't find " + q.split + " exercises for that equipment in the database. Try dropping the equipment restriction, or browse the Workouts tab filters." };
      var label = q.split.charAt(0).toUpperCase() + q.split.slice(1);
      var head = label + " session \u00b7 " + q.goal + (q.equipment ? " \u00b7 " + q.equipment + " only" : "") + (q.level ? " \u00b7 " + q.level : "");
      var tips = q.goal === "strength" ? "Leave 1\u20132 reps in the tank on every set; add weight when you hit the top of the range."
        : q.goal === "endurance" ? "Keep rest short and the weight light enough to finish every set clean."
        : "Take each set close to failure (1\u20133 reps left); progress weight or reps weekly.";
      return { type: "workout", head: head, items: res.items, gaps: res.gaps, tips: tips, intent: q };
    }

    if (q.type === "supp-one") {
      var s = q.supp;
      var verdict = s.tier === "A" ? "Yes \u2014 strong evidence." : s.tier === "B" ? "Reasonable \u2014 moderate evidence." : s.tier === "C" ? "Maybe \u2014 limited or situational evidence." : "Skip it \u2014 the evidence doesn't support the claim.";
      return { type: "supp", head: s.name + " \u00b7 Tier " + s.tier, verdict: verdict, supp: s };
    }

    if (q.type === "supp-goal") {
      if (q.goal === "fatloss") return { type: "text", text: "Honest answer: there's no Tier A or B fat-loss pill. A calorie deficit does the work; supplements that actually help are protein powder (keeps you full, protects muscle) and caffeine (training energy while cutting). The marketed \u201cfat burners\u201d and CLA sit in Tier D. Use the Nutrition tab to set a \u221220% calorie target." };
      var goal = q.goal;
      var list = root.SUPPLEMENTS.filter(function (x) { return (!goal || x.goals.indexOf(goal) !== -1) && (x.tier === "A" || x.tier === "B"); })
        .sort(function (a, b) { return order[a.tier] - order[b.tier]; }).slice(0, 5);
      if (!list.length) return { type: "text", text: "Nothing with solid evidence matches that goal. Browse the Supplements tab \u2014 tiers A and B are where the real effects live." };
      return { type: "supp-list", head: goal ? "Best-supported options for " + goal : "The short list worth taking (Tier A/B)", list: list };
    }

    if (q.type === "protein") {
      if (q.weight) {
        var lo = Math.round(1.6 * q.weight.kg), hi = Math.round(2.2 * q.weight.kg);
        return { type: "text", text: "At that bodyweight, aim for " + lo + "\u2013" + hi + " g of protein per day (1.6\u20132.2 g per kg). Spread it over 3\u20134 meals of 25\u201345 g each. The food table in the Nutrition tab shows the densest sources." };
      }
      return { type: "text", text: "The evidence-based range is 1.6\u20132.2 g per kg of bodyweight per day for building or keeping muscle. Tell me your weight (\u201cI weigh 170 lb\u201d in the same question) and I'll compute it, or use the Nutrition tab calculator." };
    }

    if (q.type === "calories") return { type: "text", text: "Use the calculator in the Nutrition tab \u2014 it runs Mifflin-St Jeor from your stats and gives calorie plus protein/fat/carb targets for cutting, maintaining, or gaining. Treat the number as a starting point and adjust to your 2\u20133 week scale trend." };

    return { type: "unknown", text: "I'm a built-in coach, so I stick to what's in this app. Try: \u201coptimal upper body workout\u201d, \u201cleg day with dumbbells only\u201d, \u201cis ashwagandha worth it?\u201d, \u201cwhat should I take for sleep?\u201d, or \u201chow much protein at 180 lb?\u201d" };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Coach;
  root.Coach = Coach;
})(typeof window !== "undefined" ? window : globalThis);
