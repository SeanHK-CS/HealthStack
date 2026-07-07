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
  var tabs = ["workouts", "supplements", "nutrition", "saved"];
  function showTab(name) {
    tabs.forEach(function (t) {
      $("tab-" + t).setAttribute("aria-selected", String(t === name));
      $("panel-" + t).hidden = t !== name;
    });
    if (name === "saved") renderSaved();
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

  var EX_RENDER_CAP = 60;
  function exerciseCard(x) {
    var saved = store.has("ex", x.id);
    return '<div class="card">' +
      '<h3>' + esc(x.name) + '</h3>' +
      '<div class="meta">' + esc(x.level) + ' &middot; ' + esc(x.equipment) + ' &middot; ' + esc(x.category) + '</div>' +
      '<div class="chips">' +
        x.primary.map(function (p) { return '<span class="chip primary">' + esc(p) + '</span>'; }).join("") +
        x.secondary.slice(0, 3).map(function (p) { return '<span class="chip">' + esc(p) + '</span>'; }).join("") +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="btn" data-detail="' + esc(x.id) + '">Details</button>' +
        '<button class="btn' + (saved ? " saved" : "") + '" data-save-ex="' + esc(x.id) + '">' + (saved ? "Saved \u2713" : "Save") + '</button>' +
      '</div></div>';
  }
  function renderExercises() {
    var f = {
      q: $("ex-q").value, muscle: $("ex-muscle").value, equipment: $("ex-equipment").value,
      level: $("ex-level").value, category: $("ex-category").value
    };
    var list = L.filterExercises(window.EXERCISES, f);
    $("ex-count").textContent = list.length + " exercise" + (list.length === 1 ? "" : "s") +
      (list.length > EX_RENDER_CAP ? " (showing first " + EX_RENDER_CAP + " \u2014 narrow with filters)" : "");
    if (!list.length) {
      $("ex-grid").innerHTML = '<div class="empty">No exercises match. Clear a filter or try a shorter search term.</div>';
      return;
    }
    $("ex-grid").innerHTML = list.slice(0, EX_RENDER_CAP).map(exerciseCard).join("");
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
      : '<div class="empty">Nothing matches. Clear a filter or try another term.</div>';
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
      '<p class="note">Mifflin-St Jeor estimate. Treat it as a starting point; adjust by \u00b1200 kcal based on 2\u20133 weeks of scale trend.</p>';
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
      $("saved-content").innerHTML = '<div class="empty">Nothing saved yet. Save exercises from the Workouts tab and supplements from the Supplements tab, and they collect here.</div>';
      return;
    }
    var html = "";
    if (sp.length) html += '<h3 style="font-family:var(--display);text-transform:uppercase;">My supplement stack</h3><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr));">' + sp.map(suppCard).join("") + "</div>";
    if (ex.length) html += '<h3 style="font-family:var(--display);text-transform:uppercase;margin-top:22px;">Saved exercises</h3><div class="grid">' + ex.map(exerciseCard).join("") + "</div>";
    $("saved-content").innerHTML = html;
  }

  /* ---------- delegated clicks (save / detail buttons) ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.detail) { showTab("workouts"); showDetail(t.dataset.detail); }
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
})();
