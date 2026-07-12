(function () {
  "use strict";
  var L = window.Logic;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  /* ---------- saved items (localStorage with in-memory fallback) ---------- */
  var memoryStore = null; // used when localStorage is blocked (strict private modes); persists for the session only
  var store = {
    read: function () {
      if (memoryStore) return memoryStore;
      try { return JSON.parse(localStorage.getItem("healthstack.saved") || '{"ex":[],"supp":[]}'); }
      catch (e) { memoryStore = { ex: [], supp: [] }; return memoryStore; }
    },
    write: function (v) {
      if (!memoryStore) {
        try { localStorage.setItem("healthstack.saved", JSON.stringify(v)); return true; }
        catch (e) { memoryStore = v; }
      }
      memoryStore = v;
      return true;
    },
    toggle: function (kind, id) {
      var v = store.read();
      var i = v[kind].indexOf(id);
      if (i === -1) v[kind].push(id); else v[kind].splice(i, 1);
      store.write(v);
      return i === -1;
    },
    has: function (kind, id) { return store.read()[kind].indexOf(id) !== -1; }
  };

  /* ---------- tabs ---------- */
  var tabs = ["workouts", "supplements", "nutrition", "plans", "saved"];
  function showTab(name) {
    tabs.forEach(function (t) {
      $("tab-" + t).setAttribute("aria-selected", String(t === name));
      $("panel-" + t).hidden = t !== name;
    });
    if (name === "saved") renderSaved();
    if (name === "plans") renderPlans();
    try { localStorage.setItem("healthstack.tab", name); } catch (e) {}
  }
  tabs.forEach(function (t) {
    $("tab-" + t).addEventListener("click", function () { showTab(t); });
  });

  /* ---------- workouts ---------- */
  var MUSCLES = [], EQUIP = [], CATS = [];
  (function collect() {
    var m = {}, e = {}, c = {};
    window.EXERCISES.forEach(function (x) {
      x.primary.forEach(function (p) { m[p] = 1; });
      e[x.equipment] = 1;
      c[x.category] = 1;
    });
    MUSCLES = Object.keys(m).sort();
    EQUIP = Object.keys(e).sort();
    CATS = Object.keys(c).sort();
  })();
  function fillSelect(sel, values) {
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = v.charAt(0).toUpperCase() + v.slice(1);
      sel.appendChild(o);
    });
  }
  fillSelect($("ex-muscle"), MUSCLES);
  fillSelect($("ex-equipment"), EQUIP);
  fillSelect($("ex-category"), CATS);

  /* Muscle-group browsing: the antidote to "873 exercises" overwhelm.
     The default view is ~9 tiles; a tapped group leads with 5 top picks
     (curated lists live in logic.js next to the fallback ranking). */
  var MUSCLE_GROUPS = L.MUSCLE_GROUPS;
  var browseGroup = null; // key of the group being browsed, or null

  var EX_RENDER_CAP = 60;
  function exerciseCard(x, topPick) {
    var saved = store.has("ex", x.id);
    return '<div class="card">' +
      '<div class="card-row">' +
      '<img class="card-thumb" loading="lazy" alt="" src="' + esc(L.exerciseImageUrl(x.images[0])) + '" onerror="this.style.display=\'none\'">' +
      '<div class="card-main">' +
      '<h3>' + esc(x.name) + '</h3>' +
      '<div class="meta">' + esc(x.level) + ' &middot; ' + esc(x.equipment) + ' &middot; ' + esc(x.category) + '</div>' +
      '</div></div>' +
      '<div class="chips">' +
        (topPick ? '<span class="chip pick">Top pick</span>' : "") +
        x.primary.map(function (p) { return '<span class="chip primary">' + esc(p) + '</span>'; }).join("") +
        x.secondary.slice(0, 3).map(function (p) { return '<span class="chip">' + esc(p) + '</span>'; }).join("") +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="btn" data-detail="' + esc(x.id) + '">Details</button>' +
        '<button class="btn' + (saved ? " saved" : "") + '" data-save-ex="' + esc(x.id) + '">' + (saved ? "Saved \u2713" : "Save") + '</button>' +
        '<button class="btn' + (planHas(x.id) ? " saved" : "") + '" data-plan-ex="' + esc(x.id) + '">' + (planHas(x.id) ? "In plan \u2713" : "+ Plan") + '</button>' +
      '</div></div>';
  }
  var CORE_CATS = ["strength", "powerlifting", "olympic weightlifting"];
  // curated canonical picks first; the ranking algorithm fills any gaps
  // (e.g. when an equipment filter excludes some of the curated ones)
  function groupPicks(g, list, n) {
    var listIds = {};
    list.forEach(function (x) { listIds[x.id] = 1; });
    var picks = (g.picks || []).filter(function (id) { return listIds[id]; }).map(exById);
    if (picks.length < n) {
      var chosen = {};
      picks.forEach(function (x) { chosen[x.id] = 1; });
      var pool = (g.category ? list : list.filter(function (x) { return CORE_CATS.indexOf(x.category) !== -1; }))
        .filter(function (x) { return !chosen[x.id]; });
      if (pool.length < 3) pool = list.filter(function (x) { return !chosen[x.id]; });
      picks = picks.concat(L.rankSuggestions(pool, n - picks.length));
    }
    return picks.slice(0, n);
  }

  // Browse home: one horizontally scrollable row per muscle group, curated
  // picks first \u2014 every group visible at a glance, no wall of 873 cards.
  function renderBrowseRows() {
    $("ex-grid").classList.add("rows-mode");
    $("ex-count").textContent = "Browse by muscle group, or search above";
    $("ex-grid").innerHTML = MUSCLE_GROUPS.map(function (g) {
      var list = L.filterExercises(window.EXERCISES, { muscles: g.muscles, category: g.category });
      var picks = groupPicks(g, list, 8);
      return '<section class="ex-row">' +
        '<div class="ex-row-head">' +
          '<h2>' + esc(g.name) + '</h2>' +
          '<div class="ex-row-nav">' +
            '<button class="btn icon" data-row-nav="-1" aria-label="Scroll ' + esc(g.name) + ' back">&lsaquo;</button>' +
            '<button class="btn icon" data-row-nav="1" aria-label="Scroll ' + esc(g.name) + ' forward">&rsaquo;</button>' +
            '<button class="btn" data-group="' + g.key + '">See all &rarr;</button>' +
          '</div>' +
        '</div>' +
        '<div class="ex-row-scroll">' + picks.map(function (x) { return exerciseCard(x); }).join("") + '</div>' +
      '</section>';
    }).join("");
  }
  function renderGroupView(g, f) {
    var list = L.filterExercises(window.EXERCISES, {
      q: f.q, equipment: f.equipment, level: f.level,
      muscles: g.muscles, category: g.category || f.category
    });
    // counts only as filter feedback \u2014 a bare group view stays number-free
    var narrowed = f.q || f.equipment || f.level || f.category;
    $("ex-count").textContent = narrowed ? list.length + " match" + (list.length === 1 ? "" : "es") + " \u00b7 " + g.name : "";
    if (!list.length) {
      $("ex-grid").innerHTML = '<div class="empty">Nothing in ' + esc(g.name) + ' matches those filters.' +
        '<div class="empty-actions">' +
          '<button class="btn" data-clear-filters="ex">Clear all filters</button>' +
          '<button class="btn" data-groups-back>All muscle groups</button>' +
        '</div></div>';
      return;
    }
    var picks = groupPicks(g, list, 5);
    var used = {};
    picks.forEach(function (x) { used[x.id] = 1; });
    var rest = list.filter(function (x) { return !used[x.id]; });
    $("ex-grid").innerHTML =
      '<div class="grid-span">' +
        '<button class="btn" data-groups-back>&larr; All muscle groups</button>' +
        '<h2 class="group-title">' + esc(g.name) + ' \u00b7 top picks</h2>' +
      '</div>' +
      picks.map(function (x) { return exerciseCard(x, true); }).join("") +
      (rest.length
        ? '<div class="grid-span"><h2 class="group-title">Everything else' +
          (rest.length > EX_RENDER_CAP ? ' \u00b7 first ' + EX_RENDER_CAP + ' \u2014 narrow with filters' : "") +
          '</h2></div>' + rest.slice(0, EX_RENDER_CAP).map(function (x) { return exerciseCard(x); }).join("")
        : "");
  }

  function renderExercises() {
    var f = {
      q: $("ex-q").value, muscle: $("ex-muscle").value, equipment: $("ex-equipment").value,
      level: $("ex-level").value, category: $("ex-category").value
    };
    if (f.muscle) browseGroup = null; // an explicit muscle filter replaces group browsing
    $("ex-grid").classList.remove("rows-mode");
    var g = null;
    if (browseGroup) {
      for (var i = 0; i < MUSCLE_GROUPS.length; i++) if (MUSCLE_GROUPS[i].key === browseGroup) g = MUSCLE_GROUPS[i];
    }
    if (g) { renderGroupView(g, f); return; }
    if (!f.q && !f.muscle && !f.equipment && !f.level && !f.category) { renderBrowseRows(); return; }
    var list = L.filterExercises(window.EXERCISES, f);
    $("ex-count").textContent = list.length + " exercise" + (list.length === 1 ? "" : "s") +
      (list.length > EX_RENDER_CAP ? " (showing first " + EX_RENDER_CAP + " \u2014 narrow with filters)" : "");
    if (!list.length) {
      $("ex-grid").innerHTML = '<div class="empty">No exercises match. Clear a filter or try a shorter search term.' +
        '<div class="empty-actions"><button class="btn" data-clear-filters="ex">Clear all filters</button></div></div>';
      return;
    }
    $("ex-grid").innerHTML = list.slice(0, EX_RENDER_CAP).map(function (x) { return exerciseCard(x); }).join("");
  }
  ["ex-q", "ex-muscle", "ex-equipment", "ex-level", "ex-category"].forEach(function (id) {
    $(id).addEventListener("input", renderExercises);
  });

  function showDetail(id) {
    var x = null;
    for (var i = 0; i < window.EXERCISES.length; i++) if (window.EXERCISES[i].id === id) { x = window.EXERCISES[i]; break; }
    if (!x) return;
    var imgs = x.images.map(function (p) {
      return '<img src="' + esc(L.exerciseImageUrl(p)) + '" alt="' + esc(x.name) + ' demonstration" loading="lazy" onerror="this.style.display=\'none\'">';
    }).join("");
    $("exercise-detail").innerHTML =
      '<button class="btn back" id="ex-back">&larr; Back to all exercises</button>' +
      '<div class="detail">' +
      '<h2>' + esc(x.name) + '</h2>' +
      '<div class="meta">' + esc(x.level) + ' &middot; ' + esc(x.equipment) + ' &middot; primary: ' + x.primary.map(esc).join(", ") +
        (x.secondary.length ? ' &middot; secondary: ' + x.secondary.map(esc).join(", ") : "") + '</div>' +
      '<div class="detail-images">' + imgs + '</div>' +
      '<ol>' + x.instructions.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ol>' +
      '<p><a href="' + esc(L.muscleWikiUrl(x.name)) + '" target="_blank" rel="noopener">Find this on MuscleWiki (video demos) &rarr;</a></p>' +
      '<div class="card-actions">' +
        '<button class="btn' + (planHas(x.id) ? " saved" : "") + '" data-plan-ex="' + esc(x.id) + '">' + (planHas(x.id) ? "In plan ✓" : "+ Plan") + '</button>' +
      '</div>' +
      '</div>';
    $("exercise-browse").hidden = true;
    $("exercise-detail").hidden = false;
    $("ex-back").addEventListener("click", function () {
      $("exercise-detail").hidden = true;
      $("exercise-browse").hidden = false;
    });
  }

  /* ---------- supplements ---------- */
  (function fillGoals() {
    var g = {};
    window.SUPPLEMENTS.forEach(function (s) { s.goals.forEach(function (x) { g[x] = 1; }); });
    fillSelect($("supp-goal"), Object.keys(g).sort());
  })();

  function suppCard(s) {
    var saved = store.has("supp", s.id);
    return '<div class="card supp-card">' +
      '<div class="plate ' + esc(s.tier) + '" aria-label="Evidence tier ' + esc(s.tier) + '">' + esc(s.tier) + '</div>' +
      '<div class="supp-body">' +
      '<h3>' + esc(s.name) + '</h3>' +
      '<div class="chips">' + s.goals.map(function (g) { return '<span class="chip">' + esc(g) + '</span>'; }).join("") + '</div>' +
      '<p style="margin:8px 0 0;font-size:13.5px;">' + esc(s.evidence) + '</p>' +
      '<ul class="supp-facts">' +
        (s.dose !== "\u2014" ? '<li><b>Dose:</b> ' + esc(s.dose) + '</li><li><b>Timing:</b> ' + esc(s.timing) + '</li>' : "") +
        '<li><b>Notes:</b> ' + esc(s.safety) + '</li>' +
      '</ul>' +
      '<div class="card-actions">' +
        '<a class="btn" href="' + esc(L.examineUrl(s.slug)) + '" target="_blank" rel="noopener">Research on Examine</a>' +
        '<button class="btn' + (saved ? " saved" : "") + '" data-save-supp="' + esc(s.id) + '">' + (saved ? "In my stack \u2713" : "Add to my stack") + '</button>' +
      '</div>' +
      '</div></div>';
  }
  function renderSupps() {
    var list = L.filterSupps(window.SUPPLEMENTS, { q: $("supp-q").value, goal: $("supp-goal").value, tier: $("supp-tier").value });
    $("supp-count").textContent = list.length + " supplement" + (list.length === 1 ? "" : "s");
    $("supp-grid").innerHTML = list.length ? list.map(suppCard).join("")
      : '<div class="empty">Nothing matches. Clear a filter or try another term.' +
        '<div class="empty-actions"><button class="btn" data-clear-filters="supp">Clear all filters</button></div></div>';
  }
  ["supp-q", "supp-goal", "supp-tier"].forEach(function (id) { $(id).addEventListener("input", renderSupps); });

  /* ---------- nutrition ---------- */
  $("c-units").addEventListener("input", function () {
    var us = this.value === "us";
    $("us-height").hidden = !us;
    $("metric-height").hidden = us;
    $("c-weight-label").textContent = us ? "Weight (lb)" : "Weight (kg)";
  });
  $("c-go").addEventListener("click", function () {
    var us = $("c-units").value === "us";
    var heightCm = us ? L.ftInToCm(Number($("c-ft").value), Number($("c-in").value)) : Number($("c-cm").value);
    var weightKg = us ? L.lbToKg(Number($("c-weight").value)) : Number($("c-weight").value);
    var r = L.calcPlan({
      sex: $("c-sex").value, age: $("c-age").value, heightCm: heightCm, weightKg: weightKg,
      activity: $("c-activity").value, goal: $("c-goal").value
    });
    if (r.error) {
      $("c-error").textContent = r.error; $("c-error").hidden = false; $("c-results").hidden = true;
      return;
    }
    $("c-error").hidden = true;
    $("c-results").hidden = false;
    $("c-results").innerHTML =
      '<div>Daily calorie target</div><div class="big">' + r.target.toLocaleString() + ' kcal</div>' +
      '<table><tbody>' +
      '<tr><td>Maintenance (TDEE)</td><td>' + r.tdee.toLocaleString() + ' kcal</td></tr>' +
      '<tr><td>Protein</td><td>' + r.proteinLo + '\u2013' + r.proteinHi + ' g</td></tr>' +
      '<tr><td>Fat (~25%)</td><td>' + r.fatG + ' g</td></tr>' +
      '<tr><td>Carbs (remainder)</td><td>' + r.carbG + ' g</td></tr>' +
      '</tbody></table>' +
      '<p class="note">Mifflin-St Jeor estimate. Treat it as a starting point; adjust by \u00b1200 kcal based on 2\u20133 weeks of scale trend.</p>' +
      '<button class="btn" id="see-protein">See protein-rich foods &rarr;</button>';
  });

  function renderFoods() {
    var list = L.searchFoods(window.FOODS, $("food-q").value, $("food-group").value);
    $("food-count").textContent = list.length + " food" + (list.length === 1 ? "" : "s");
    $("food-body").innerHTML = list.length ? list.map(function (x) {
      return "<tr><td>" + esc(x.n) + "</td><td>" + x.kcal + "</td><td>" + x.p + "</td><td>" + x.c + "</td><td>" + x.f + "</td><td>" + x.fb + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty">No foods match that search.</td></tr>';
  }
  ["food-q", "food-group"].forEach(function (id) { $(id).addEventListener("input", renderFoods); });

  /* ---------- saved panel ---------- */
  function renderSaved() {
    var v = store.read();
    var ex = window.EXERCISES.filter(function (x) { return v.ex.indexOf(x.id) !== -1; });
    var sp = window.SUPPLEMENTS.filter(function (s) { return v.supp.indexOf(s.id) !== -1; });
    if (!ex.length && !sp.length) {
      $("saved-content").innerHTML = '<div class="empty">Nothing saved yet. Save exercises from the Workouts tab and supplements from the Supplements tab, and they collect here.' +
        '<div class="empty-actions">' +
          '<button class="btn" data-goto-tab="workouts">Browse exercises</button>' +
          '<button class="btn" data-goto-tab="supplements">Browse supplements</button>' +
        '</div></div>';
      return;
    }
    var html = "";
    if (sp.length) html += '<h3 style="font-family:var(--display);text-transform:uppercase;">My supplement stack</h3><div class="grid grid-wide">' + sp.map(suppCard).join("") + "</div>";
    if (ex.length) html += '<h3 style="font-family:var(--display);text-transform:uppercase;margin-top:22px;">Saved exercises</h3><div class="grid">' + ex.map(function (x) { return exerciseCard(x); }).join("") + "</div>";
    $("saved-content").innerHTML = html;
  }

  /* ---------- coach plans: builder + shareable links (js/share.js) ---------- */
  var Share = window.Share;
  var planMemory = null; // same localStorage-with-fallback pattern as `store`
  var planStore = {
    read: function () {
      if (planMemory) return planMemory;
      try { return JSON.parse(localStorage.getItem("healthstack.plan") || "null") || emptyPlan(); }
      catch (e) { planMemory = emptyPlan(); return planMemory; }
    },
    write: function (v) {
      if (!planMemory) {
        try { localStorage.setItem("healthstack.plan", JSON.stringify(v)); return; }
        catch (e) { /* fall through to memory */ }
      }
      planMemory = v;
    }
  };
  function emptyPlan() { return { title: "", coach: "", message: "", items: [] }; }
  function planHas(id) {
    return planStore.read().items.some(function (it) { return it.id === id; });
  }
  function planToggle(id) {
    var p = planStore.read();
    for (var i = 0; i < p.items.length; i++) {
      if (p.items[i].id === id) { p.items.splice(i, 1); planStore.write(p); return "removed"; }
    }
    if (p.items.length >= Share.LIMITS.items) return "full";
    p.items.push({ id: id, note: "" });
    planStore.write(p);
    return "added";
  }
  function exById(id) {
    for (var i = 0; i < window.EXERCISES.length; i++) if (window.EXERCISES[i].id === id) return window.EXERCISES[i];
    return null;
  }

  /* ---------- today's session: date-seeded daily pick (retention hook) ---------- */
  var TODAY_SPLITS = ["full", "upper", "lower", "push", "pull", "core", "arms", "chest", "back", "shoulders", "glutes", "cardio"];
  var SPLIT_LABELS = {
    full: "Full-body", upper: "Upper-body", lower: "Lower-body", push: "Push", pull: "Pull",
    core: "Core", arms: "Arms", chest: "Chest", back: "Back", shoulders: "Shoulders", glutes: "Glutes", cardio: "Cardio"
  };
  var todayShuffle = 0;
  var todayItems = []; // ids of the currently shown daily pick
  var todaySplitMem = null; // fallback when localStorage is blocked
  // The rotation is a suggestion; users on their own split can override it for
  // the day. The override expires at midnight (seed mismatch) so tomorrow is fresh.
  function todaySplitChoice(seed) {
    var v = todaySplitMem;
    if (!v) {
      try { v = JSON.parse(localStorage.getItem("healthstack.todaySplit") || "null"); } catch (e) {}
    }
    return v && v.seed === seed && TODAY_SPLITS.indexOf(v.split) !== -1 ? v.split : null;
  }
  function setTodaySplit(seed, split) {
    todaySplitMem = { seed: seed, split: split };
    try { localStorage.setItem("healthstack.todaySplit", JSON.stringify(todaySplitMem)); } catch (e) {}
  }
  function renderToday() {
    var now = new Date();
    var seed = L.dateSeed(now);
    var suggested = L.dailySplit(now);
    var split = todaySplitChoice(seed) || suggested;
    var rng = L.mulberry32(seed + todayShuffle * 97);
    var res = window.Coach.generate(window.EXERCISES, { split: split, goal: "hypertrophy" }, rng);
    if (!res.items.length) { $("today-box").innerHTML = ""; todayItems = []; return; }
    todayItems = res.items.map(function (it) { return it.ex.id; });
    var weekday = now.toLocaleDateString(undefined, { weekday: "long" });
    $("today-box").innerHTML =
      '<div class="card today-card">' +
        '<div class="today-head">' +
          '<div>' +
            '<div class="today-kicker">Today’s session · ' + esc(weekday) + (split !== suggested ? " · your pick" : "") + '</div>' +
            '<h3>' + esc(SPLIT_LABELS[split]) + ' day</h3>' +
          '</div>' +
          '<div class="today-tools">' +
            '<select id="today-split" aria-label="Change today’s focus">' +
              TODAY_SPLITS.map(function (s) {
                return '<option value="' + s + '"' + (s === split ? " selected" : "") + '>' +
                  SPLIT_LABELS[s] + (s === suggested ? " · suggested" : "") + '</option>';
              }).join("") +
            '</select>' +
            '<button class="btn" id="today-shuffle">Reshuffle</button>' +
            '<button class="btn" id="today-plan">Add all to plan</button>' +
          '</div>' +
        '</div>' +
        '<ol class="today-list">' + res.items.map(function (it) {
          return '<li><button class="linklike" data-detail="' + esc(it.ex.id) + '">' + esc(it.ex.name) + '</button>' +
            '<span class="scheme">' + esc(it.scheme) + ' · ' + esc(it.ex.equipment) + '</span></li>';
        }).join("") + '</ol>' +
        '<p class="today-mini">A fresh pick every day. On a different split? Switch the focus above — tomorrow suggests anew.</p>' +
      '</div>';
  }

  /* ---------- tab badges: show how much you've collected ---------- */
  function setBadge(id, n) {
    var el = $(id);
    var b = el.querySelector(".tab-badge");
    if (!n) { if (b) el.removeChild(b); return; }
    if (!b) { b = document.createElement("span"); b.className = "tab-badge"; el.appendChild(b); }
    b.textContent = String(n);
  }
  function updateBadges() {
    var v = store.read();
    setBadge("tab-saved", v.ex.length + v.supp.length);
    setBadge("tab-plans", planStore.read().items.length);
    try { window.dispatchEvent(new Event("resize")); } catch (e) {} // let the tab indicator re-measure
  }

  function toast(text) {
    var d = document.createElement("div");
    d.className = "toast";
    d.textContent = text;
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2400);
  }

  function planItemRow(it, i, total) {
    var x = exById(it.id);
    if (!x) return "";
    return '<li class="card plan-item">' +
      '<div class="plan-item-head">' +
        '<span class="plan-n">' + (i + 1) + '</span>' +
        '<div><h3>' + esc(x.name) + '</h3><div class="meta">' + esc(x.level) + ' &middot; ' + esc(x.equipment) + ' &middot; ' + x.primary.map(esc).join(", ") + '</div></div>' +
        '<div class="plan-item-tools">' +
          '<button class="btn icon" data-plan-up="' + i + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Move up">&uarr;</button>' +
          '<button class="btn icon" data-plan-down="' + i + '"' + (i === total - 1 ? " disabled" : "") + ' aria-label="Move down">&darr;</button>' +
          '<button class="btn icon" data-plan-remove="' + i + '" aria-label="Remove from plan">&times;</button>' +
        '</div>' +
      '</div>' +
      '<textarea class="plan-note" data-plan-note="' + i + '" maxlength="' + Share.LIMITS.note + '" placeholder="Coach note for this exercise — sets/reps, tempo, cues…">' + esc(it.note || "") + '</textarea>' +
    '</li>';
  }

  function renderPlans() {
    var p = planStore.read();
    $("plan-builder").innerHTML =
      '<p class="plan-intro">Curate a session for a client: add exercises with the <b>+ Plan</b> button on any exercise card, write a note under each one, then copy a link. The whole plan travels inside the link — no account, no server.</p>' +
      '<div class="plan-grid">' +
      '<div class="card plan-meta">' +
        '<h3>Plan details</h3>' +
        '<label for="plan-title">Plan title</label>' +
        '<input id="plan-title" data-plan-field="title" maxlength="' + Share.LIMITS.title + '" placeholder="Week 1 — upper body focus" value="' + esc(p.title) + '">' +
        '<label for="plan-coach">Your name (coach / trainer)</label>' +
        '<input id="plan-coach" data-plan-field="coach" maxlength="' + Share.LIMITS.name + '" placeholder="Coach Sam" value="' + esc(p.coach) + '">' +
        '<label for="plan-message">Message to your client</label>' +
        '<textarea id="plan-message" data-plan-field="message" maxlength="' + Share.LIMITS.message + '" placeholder="Focus on form this week; weights stay light.">' + esc(p.message) + '</textarea>' +
        '<button class="go" id="plan-share">Copy shareable link</button>' +
        '<input id="plan-link" readonly aria-label="Shareable plan link" hidden>' +
        (p.items.length ? '<button class="btn" id="plan-clear">Clear plan</button>' : "") +
        '<p class="note">Anyone with the link can read the plan and your notes. Links keep working offline and on the deployed site.</p>' +
      '</div>' +
      (p.items.length
        ? '<ol class="plan-list">' + p.items.map(function (it, i) { return planItemRow(it, i, p.items.length); }).join("") + '</ol>'
        : '<div class="empty">No exercises in this plan yet. Head to the Workouts tab and tap <b>+ Plan</b> on the exercises you want.' +
          '<div class="empty-actions"><button class="btn" data-goto-tab="workouts">Browse exercises</button></div></div>') +
      '</div>';
  }

  /* ----- shared plan view (opened from a #p=... link) ----- */
  var sharedCode = null;
  function renderSharedPlan(code) {
    sharedCode = code;
    var box = $("shared-plan");
    var r = Share.decodePlan(code, window.EXERCISES);
    if (r.error) {
      box.innerHTML = '<div class="empty">' + esc(r.error) + '</div>' +
        '<div class="shared-actions"><button class="btn" id="shared-dismiss">Back to my plans</button></div>';
      box.hidden = false;
      $("plan-builder").hidden = true;
      return;
    }
    var p = r.plan;
    box.innerHTML =
      '<div class="shared-head">' +
        '<div class="shared-kicker">Shared training plan</div>' +
        '<h2>' + esc(p.title || "Training plan") + '</h2>' +
        (p.coach ? '<div class="meta">from ' + esc(p.coach) + '</div>' : "") +
        (p.message ? '<p class="shared-msg">' + esc(p.message) + '</p>' : "") +
      '</div>' +
      '<ol class="plan-list">' + p.items.map(function (it, i) {
        var x = it.exercise;
        return '<li class="card plan-item">' +
          '<div class="plan-item-head">' +
            '<span class="plan-n">' + (i + 1) + '</span>' +
            '<div><h3>' + esc(x.name) + '</h3><div class="meta">' + esc(x.level) + ' &middot; ' + esc(x.equipment) + ' &middot; ' + x.primary.map(esc).join(", ") + '</div></div>' +
          '</div>' +
          (it.note ? '<p class="coach-note"><b>Coach’s note:</b> ' + esc(it.note) + '</p>' : "") +
          '<div class="card-actions"><button class="btn" data-detail="' + esc(x.id) + '">Form &amp; instructions</button></div>' +
        '</li>';
      }).join("") + '</ol>' +
      '<div class="shared-actions">' +
        '<button class="btn" id="shared-import">Load into my plan builder</button>' +
        '<button class="btn" id="shared-dismiss">Dismiss</button>' +
      '</div>';
    box.hidden = false;
    $("plan-builder").hidden = true;
  }
  function dismissShared() {
    sharedCode = null;
    try { history.replaceState(null, "", location.pathname + location.search); }
    catch (e) { location.hash = ""; }
    checkSharedHash();
  }
  function checkSharedHash() {
    var code = Share.parseHash(location.hash);
    if (code) {
      showTab("plans");
      renderSharedPlan(code);
    } else {
      sharedCode = null;
      $("shared-plan").hidden = true;
      $("shared-plan").innerHTML = "";
      $("plan-builder").hidden = false;
      // re-render: an import may have just changed the draft (a recipient's
      // fresh browser renders the builder before the import happens)
      if (!$("panel-plans").hidden) renderPlans();
    }
  }
  window.addEventListener("hashchange", checkSharedHash);

  function sharePlan() {
    var r = Share.encodePlan(planStore.read());
    if (r.error) { toast(r.error); return; }
    var link = Share.planLink(location.href, r.code);
    var out = $("plan-link");
    out.hidden = false;
    out.value = link;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        function () { toast("Link copied — send it to your client."); },
        function () { try { out.select(); } catch (e) {} toast("Copy the link below."); }
      );
    } else {
      try { out.select(); } catch (e) {}
      toast("Copy the link below.");
    }
  }

  /* persist plan fields/notes as they're typed (no re-render, keeps focus) */
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!t || !t.dataset) return;
    if (t.id === "today-split") {
      todayShuffle = 0;
      setTodaySplit(L.dateSeed(new Date()), t.value);
      renderToday();
    }
    if (t.dataset.planField) {
      var p = planStore.read();
      p[t.dataset.planField] = t.value;
      planStore.write(p);
    }
    if (t.dataset.planNote !== undefined && t.dataset.planNote !== "") {
      var p2 = planStore.read();
      var i = Number(t.dataset.planNote);
      if (p2.items[i]) { p2.items[i].note = t.value; planStore.write(p2); }
    }
  });

  /* ---------- delegated clicks (save / detail / plan buttons) ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target;
    var tile = t.closest ? t.closest("[data-group]") : null;
    if (tile) { browseGroup = tile.dataset.group; renderExercises(); }
    if (t.closest && t.closest("[data-groups-back]")) { browseGroup = null; renderExercises(); }
    var nav = t.closest ? t.closest("[data-row-nav]") : null;
    if (nav) {
      var scroller = nav.closest(".ex-row").querySelector(".ex-row-scroll");
      var dx = Number(nav.dataset.rowNav) * Math.max(200, scroller.clientWidth - 100);
      if (scroller.scrollBy) scroller.scrollBy({ left: dx, behavior: "smooth" });
      else scroller.scrollLeft += dx;
    }
    if (t.dataset && t.dataset.detail) { showTab("workouts"); showDetail(t.dataset.detail); }
    if (t.dataset && t.dataset.planEx) {
      var res = planToggle(t.dataset.planEx);
      if (res === "full") toast("Plans cap at " + Share.LIMITS.items + " exercises — remove one first.");
      else toast(res === "added" ? "Added to your plan (Plans tab)." : "Removed from your plan.");
      if (res !== "full" && t.closest && t.closest("#exercise-detail")) {
        var on = res === "added";
        t.classList.toggle("saved", on);
        t.innerHTML = on ? "In plan ✓" : "+ Plan";
      }
      renderExercises();
      if (!$("panel-plans").hidden) renderPlans();
      if (!$("panel-saved").hidden) renderSaved();
    }
    if (t.dataset && t.dataset.planRemove !== undefined) {
      var pr = planStore.read();
      pr.items.splice(Number(t.dataset.planRemove), 1);
      planStore.write(pr);
      renderPlans();
      renderExercises();
    }
    if (t.dataset && (t.dataset.planUp !== undefined || t.dataset.planDown !== undefined)) {
      var up = t.dataset.planUp !== undefined;
      var from = Number(up ? t.dataset.planUp : t.dataset.planDown);
      var to = up ? from - 1 : from + 1;
      var pm = planStore.read();
      if (pm.items[from] && pm.items[to]) {
        var tmp = pm.items[from];
        pm.items[from] = pm.items[to];
        pm.items[to] = tmp;
        planStore.write(pm);
        renderPlans();
      }
    }
    if (t.id === "plan-share") sharePlan();
    if (t.id === "plan-clear") {
      planStore.write(emptyPlan());
      renderPlans();
      renderExercises();
    }
    if (t.id === "shared-import" && sharedCode) {
      var sr = Share.decodePlan(sharedCode, window.EXERCISES);
      if (sr.plan) {
        planStore.write({
          title: sr.plan.title, coach: sr.plan.coach, message: sr.plan.message,
          items: sr.plan.items.map(function (it) { return { id: it.id, note: it.note }; })
        });
        toast("Plan loaded into your builder.");
        dismissShared();
        renderExercises();
      }
    }
    if (t.id === "shared-dismiss") dismissShared();
    if (t.id === "today-shuffle") { todayShuffle++; renderToday(); }
    if (t.id === "today-plan") {
      var addedCount = 0;
      todayItems.forEach(function (id) {
        if (!planHas(id) && planToggle(id) === "added") addedCount++;
      });
      toast(addedCount ? "Added " + addedCount + " exercises to your plan (Plans tab)." : "These are already in your plan.");
      renderExercises();
      if (!$("panel-plans").hidden) renderPlans();
    }
    if (t.id === "see-protein") {
      $("food-group").value = "protein";
      $("food-q").value = "";
      renderFoods();
      var fb = document.querySelector(".foods-box");
      if (fb && fb.scrollIntoView) { try { fb.scrollIntoView({ behavior: "smooth" }); } catch (e) {} }
    }
    if (t.dataset && t.dataset.gotoTab) showTab(t.dataset.gotoTab);
    if (t.dataset && t.dataset.clearFilters === "ex") {
      ["ex-q", "ex-muscle", "ex-equipment", "ex-level", "ex-category"].forEach(function (id) { $(id).value = ""; });
      renderExercises();
    }
    if (t.dataset && t.dataset.clearFilters === "supp") {
      ["supp-q", "supp-goal", "supp-tier"].forEach(function (id) { $(id).value = ""; });
      renderSupps();
    }
    if (t.dataset && t.dataset.saveEx) {
      store.toggle("ex", t.dataset.saveEx);
      renderExercises();
      if (!$("panel-saved").hidden) renderSaved();
    }
    if (t.dataset && t.dataset.saveSupp) {
      store.toggle("supp", t.dataset.saveSupp);
      renderSupps();
      if (!$("panel-saved").hidden) renderSaved();
    }
    updateBadges(); // counts may have changed on any of the branches above
  });

  /* ---------- coach chat (fully local, no network, no keys) ---------- */
  var Coach = window.Coach;
  var coachState = { lastWorkout: null };

  $("coach-fab").addEventListener("click", function () {
    var open = $("coach-panel").hidden;
    $("coach-panel").hidden = !open;
    this.setAttribute("aria-expanded", String(open));
    if (open && !$("coach-log").children.length) {
      botMsg({ type: "text", text: "Hey! I answer from this app's data: ask for a workout (\u201coptimal upper body workout\u201d, \u201cleg day, dumbbells only\u201d), a supplement verdict (\u201cis creatine worth it?\u201d), or protein/calorie basics." });
    }
    if (open) $("coach-input").focus();
  });
  $("coach-close").addEventListener("click", function () {
    $("coach-panel").hidden = true;
    $("coach-fab").setAttribute("aria-expanded", "false");
  });

  function addMsg(cls, html) {
    var d = document.createElement("div");
    d.className = "msg " + cls;
    d.innerHTML = html;
    $("coach-log").appendChild(d);
    $("coach-log").scrollTop = $("coach-log").scrollHeight;
    return d;
  }

  function renderAnswer(a) {
    if (a.type === "workout") {
      var html = "<h4>" + esc(a.head) + "</h4><ol>" + a.items.map(function (it) {
        return "<li><button class='linklike' data-detail='" + esc(it.ex.id) + "'>" + esc(it.ex.name) + "</button>" +
          "<span class='scheme'>" + esc(it.scheme) + " \u00b7 " + esc(it.ex.equipment) + "</span></li>";
      }).join("") + "</ol><p class='mini'>" + esc(a.tips) + " Tap any exercise for step-by-step form. Say \u201canother\u201d to reshuffle.</p>";
      if (a.gaps.length) html += "<p class='mini'>No match in the database for: " + esc(a.gaps.join(", ")) + " with those constraints.</p>";
      return html;
    }
    if (a.type === "supp") {
      var s = a.supp;
      return "<h4>" + esc(a.head) + "</h4><p style='margin:0 0 6px'><b>" + esc(a.verdict) + "</b> " + esc(s.evidence) + "</p>" +
        (s.dose !== "\u2014" ? "<p class='mini'>Dose: " + esc(s.dose) + " \u00b7 " + esc(s.timing) + "</p>" : "") +
        "<p class='mini'>" + esc(s.safety) + " <a href='" + esc(L.examineUrl(s.slug)) + "' target='_blank' rel='noopener'>Full research \u2192</a></p>";
    }
    if (a.type === "supp-list") {
      return "<h4>" + esc(a.head) + "</h4><ol>" + a.list.map(function (s) {
        return "<li><b>" + esc(s.name) + "</b> (Tier " + esc(s.tier) + ") <span class='scheme'>" + esc(s.dose) + "</span></li>";
      }).join("") + "</ol><p class='mini'>Details and safety notes are on the Supplements tab.</p>";
    }
    return esc(a.text);
  }
  function botMsg(a) { return addMsg("bot", renderAnswer(a)); }

  $("coach-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var text = $("coach-input").value.trim();
    if (!text) return;
    addMsg("user", esc(text));
    $("coach-input").value = "";
    var a = Coach.answer(text, coachState);
    if (a.type === "workout") coachState.lastWorkout = a.intent;
    botMsg(a);
  });

  /* ---------- initial paint ---------- */
  renderExercises();
  renderSupps();
  renderFoods();
  renderToday();
  updateBadges();
  // land returning visitors on the tab they last used (share links win below)
  try {
    var lastTab = localStorage.getItem("healthstack.tab");
    if (lastTab && tabs.indexOf(lastTab) !== -1) showTab(lastTab);
  } catch (e) {}
  checkSharedHash(); // opened from a shared #p=... link? jump straight to the plan
})();
