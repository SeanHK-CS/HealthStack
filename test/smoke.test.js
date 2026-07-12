// Smoke test: loads the actual index.html in jsdom, runs the real scripts,
// and exercises each MUST from the browser's side. Run: node test/smoke.test.js
const assert = require("assert");
const path = require("path");
const { JSDOM } = require("jsdom");

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, "..", "index.html"), {
    runScripts: "dangerously",
    resources: "usable", // loads local <script src>; external fonts fail silently (E: offline behavior)
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const doc = window.document;
  await new Promise((res) => {
    if (doc.readyState === "complete") return res();
    window.addEventListener("load", res);
    setTimeout(res, 5000);
  });
  await new Promise((r) => setTimeout(r, 300));

  let pass = 0;
  const t = (name, fn) => { fn(); pass++; console.log("  ok - " + name); };
  const $ = (id) => doc.getElementById(id);
  const input = (id, v) => { $(id).value = v; $(id).dispatchEvent(new window.Event("input", { bubbles: true })); };

  t("M4: page boots from disk, data + scripts loaded", () => {
    assert.strictEqual(window.EXERCISES.length, 873);
    assert.strictEqual(window.SUPPLEMENTS.length, 33);
    assert(window.FOODS.length >= 80);
    assert(window.Logic, "logic loaded");
  });

  t("M1: workouts opens with a scrollable row per muscle group, not a wall of 873 cards", () => {
    const rows = $("ex-grid").querySelectorAll(".ex-row");
    assert(rows.length >= 8);
    for (const row of rows) {
      assert(row.querySelector(".ex-row-scroll .card"), "row has cards");
      assert(row.querySelector("[data-group]"), "row has a See-all button");
      assert(row.querySelectorAll("[data-row-nav]").length === 2, "row has scroll arrows");
    }
    assert(rows[0].textContent.includes("Pushups"), "chest row leads with curated picks");
    assert($("ex-count").textContent.includes("873"));
  });

  t("M1: 'See all' opens the group view with flagged top picks, then the full list", () => {
    $("ex-grid").querySelector("[data-group='chest']").click();
    assert($("ex-grid").textContent.includes("top picks"));
    assert($("ex-grid").querySelectorAll(".chip.pick").length === 5, "five suggested picks");
    assert($("ex-grid").textContent.includes("Pushups") && $("ex-grid").textContent.includes("Dumbbell Bench Press"), "canonical curated picks lead");
    assert($("ex-grid").querySelectorAll(".card").length > 6, "full list follows the picks");
    assert($("ex-count").textContent.includes("Chest"));
    $("ex-grid").querySelector("[data-groups-back]").click();
    assert($("ex-grid").querySelectorAll(".ex-row").length >= 8, "back returns to the rows");
  });

  t("M1: filtering to chest + dumbbell updates grid and count", () => {
    input("ex-muscle", "chest");
    input("ex-equipment", "dumbbell");
    const n = parseInt($("ex-count").textContent);
    assert(n > 0 && n < 873);
    assert($("ex-grid").querySelectorAll(".card").length === Math.min(n, 60));
  });

  t("M1: detail view shows instructions, images, MuscleWiki link", () => {
    $("ex-grid").querySelector("[data-detail]").click();
    assert.strictEqual($("exercise-detail").hidden, false);
    assert($("exercise-detail").querySelectorAll("ol li").length >= 2, "step instructions");
    assert($("exercise-detail").querySelector("img").src.includes("raw.githubusercontent.com"));
    const a = $("exercise-detail").querySelector("a[href*='musclewiki.com']");
    assert(a, "musclewiki link");
    $("ex-back").click();
    assert.strictEqual($("exercise-browse").hidden, false);
  });

  t("E3: no-result exercise search shows empty-state message", () => {
    input("ex-q", "zzzznotreal");
    assert($("ex-grid").textContent.includes("No exercises match"));
    input("ex-q", ""); input("ex-muscle", ""); input("ex-equipment", "");
  });

  t("M2: supplements render tier-sorted with plate badges and Examine links", () => {
    doc.getElementById("tab-supplements").click();
    const cards = $("supp-grid").querySelectorAll(".supp-card");
    assert.strictEqual(cards.length, 33);
    assert(cards[0].querySelector(".plate.A"), "first card is tier A");
    assert(cards[cards.length - 1].querySelector(".plate.D"), "last card is tier D");
    assert(cards[0].querySelector("a[href*='examine.com']"), "examine link");
  });

  t("M2: goal filter 'sleep' narrows and still tier-sorts", () => {
    input("supp-goal", "sleep");
    const names = [...$("supp-grid").querySelectorAll("h3")].map((h) => h.textContent);
    assert(names.some((n) => n.includes("Melatonin")) && !names.some((n) => n.includes("Creatine")));
    input("supp-goal", "");
  });

  t("M3: food table renders and search filters it", () => {
    doc.getElementById("tab-nutrition").click();
    assert($("food-body").querySelectorAll("tr").length >= 80);
    input("food-q", "salmon");
    assert.strictEqual($("food-body").querySelectorAll("tr").length, 1);
    input("food-q", "");
  });

  t("M3: calculator computes targets for US units", () => {
    input("c-sex", "male"); input("c-age", "25");
    input("c-ft", "5"); input("c-in", "10");
    input("c-weight", "170"); input("c-activity", "1.55");
    input("c-goal", "maintain");
    $("c-go").click();
    assert.strictEqual($("c-results").hidden, false);
    assert($("c-results").textContent.includes("kcal"));
    assert($("c-results").querySelector(".big").textContent.includes("2,7"), "≈2,733 kcal target");
    assert(!$("c-results").textContent.includes("NaN"));
  });

  t("E4: blank calculator input shows a named error, no NaN output", () => {
    input("c-age", "");
    $("c-go").click();
    assert.strictEqual($("c-error").hidden, false);
    assert($("c-error").textContent.includes("age"));
    assert.strictEqual($("c-results").hidden, true);
  });

  t("M5: saving a supplement puts it in the Saved tab (localStorage)", () => {
    doc.getElementById("tab-supplements").click();
    const btn = $("supp-grid").querySelector("[data-save-supp='creatine']");
    btn.click();
    doc.getElementById("tab-saved").click();
    assert($("saved-content").textContent.includes("Creatine"));
    // unsave -> empty state returns
    $("saved-content").querySelector("[data-save-supp='creatine']").click();
    doc.getElementById("tab-saved").click();
    assert($("saved-content").textContent.includes("Nothing saved yet"));
  });

  t("tabs toggle panels with aria-selected", () => {
    doc.getElementById("tab-workouts").click();
    assert.strictEqual($("panel-workouts").hidden, false);
    assert.strictEqual($("panel-supplements").hidden, true);
    assert.strictEqual(doc.getElementById("tab-workouts").getAttribute("aria-selected"), "true");
  });

  const ask = (text) => {
    $("coach-input").value = text;
    $("coach-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    const msgs = $("coach-log").querySelectorAll(".msg.bot");
    return msgs[msgs.length - 1];
  };

  t("M6: coach opens with a welcome message", () => {
    $("coach-fab").click();
    assert.strictEqual($("coach-panel").hidden, false);
    assert($("coach-log").textContent.includes("optimal upper body workout"));
  });

  t("M6: 'optimal upper body workout' returns a 5-exercise plan with schemes", () => {
    const m = ask("what should i work out for the optimal upper body workout");
    assert(m.querySelector("h4").textContent.includes("Upper"));
    assert.strictEqual(m.querySelectorAll("ol li").length, 5);
    assert(m.textContent.includes("reps"));
  });

  t("M6: tapping an exercise in chat jumps to its detail page (cross-tab fix)", () => {
    doc.getElementById("tab-nutrition").click(); // start from a different tab on purpose
    const msgs = $("coach-log").querySelectorAll(".msg.bot");
    msgs[msgs.length - 1].querySelector("[data-detail]").click();
    assert.strictEqual($("panel-workouts").hidden, false, "switched to workouts tab");
    assert.strictEqual($("exercise-detail").hidden, false, "detail visible");
    $("ex-back").click();
  });

  t("M6: 'another' reshuffles using remembered constraints", () => {
    const m = ask("another");
    assert(m.querySelector("h4").textContent.includes("Upper"));
    assert.strictEqual(m.querySelectorAll("ol li").length, 5);
  });

  t("M7: supplement verdict answer with tier and Examine link", () => {
    const m = ask("is creatine actually worth taking?");
    assert(m.textContent.includes("Tier A") && m.textContent.includes("strong evidence"));
    assert(m.querySelector("a[href*='examine.com']"));
  });

  t("M7: goal question returns tier-A/B shortlist", () => {
    const m = ask("what supplements should i take for sleep");
    assert(m.textContent.includes("Melatonin"));
    assert(!m.textContent.includes("ZMA"), "tier D excluded");
  });

  t("M7: protein question with bodyweight computes the range", () => {
    const m = ask("how much protein do i need at 180 lbs");
    assert(m.textContent.includes("131") && m.textContent.includes("180 g"));
  });

  t("E5: unrelated question gets capability fallback", () => {
    const m = ask("write me a poem about deadlifts");
    assert(m.textContent.includes("built-in coach"));
    assert(!m.textContent.toLowerCase().includes("api key"), "no API mention remains");
  });

  /* ---- M9/M10: coach plan builder + shareable links ---- */
  t("M9: '+ Plan' collects an exercise into the Plans tab builder", () => {
    doc.getElementById("tab-workouts").click();
    $("ex-grid").querySelector("[data-group='chest']").click();
    const btn = $("ex-grid").querySelector("[data-plan-ex]");
    btn.click();
    doc.getElementById("tab-plans").click();
    assert.strictEqual($("panel-plans").hidden, false);
    assert.strictEqual($("plan-builder").querySelectorAll(".plan-item").length, 1);
    assert($("plan-builder").textContent.includes("Copy shareable link"));
  });

  t("M9: plan fields and per-exercise notes persist through the store", () => {
    input("plan-coach", "Coach Sam");
    input("plan-title", "Week 1 — Upper");
    const ta = $("plan-builder").querySelector("[data-plan-note]");
    ta.value = "3×8, slow eccentric";
    ta.dispatchEvent(new window.Event("input", { bubbles: true }));
    doc.getElementById("tab-workouts").click();
    doc.getElementById("tab-plans").click(); // full re-render from storage
    assert.strictEqual($("plan-coach").value, "Coach Sam");
    assert($("plan-builder").querySelector("[data-plan-note]").value.includes("eccentric"));
  });

  let sharedLink;
  t("M10: share button produces a decodable #p= link", () => {
    $("plan-share").click();
    const out = $("plan-link");
    assert.strictEqual(out.hidden, false);
    assert(out.value.includes("#p="), out.value);
    sharedLink = out.value;
    const code = window.Share.parseHash("#" + out.value.split("#")[1]);
    const r = window.Share.decodePlan(code, window.EXERCISES);
    assert(!r.error, r.error);
    assert.strictEqual(r.plan.coach, "Coach Sam");
    assert(r.plan.items[0].note.includes("eccentric"));
  });

  window.location.hash = "#" + sharedLink.split("#")[1];
  await new Promise((r) => setTimeout(r, 100));
  t("M10: opening a #p= link shows the read-only shared plan with coach notes", () => {
    assert.strictEqual($("panel-plans").hidden, false, "jumped to Plans tab");
    assert.strictEqual($("shared-plan").hidden, false);
    assert.strictEqual($("plan-builder").hidden, true, "builder hidden behind shared view");
    assert($("shared-plan").textContent.includes("Coach Sam"));
    assert($("shared-plan").textContent.includes("eccentric"));
    assert($("shared-plan").querySelector("[data-detail]"), "links through to exercise detail");
  });

  t("M10: 'Load into my plan builder' imports the plan and returns to the builder", () => {
    $("shared-import").click();
    assert.strictEqual($("shared-plan").hidden, true);
    assert.strictEqual($("plan-builder").hidden, false);
    assert($("plan-builder").querySelector("[data-plan-note]").value.includes("eccentric"));
    $("plan-clear").click(); // leave a clean slate for anything after
    assert($("plan-builder").textContent.includes("No exercises in this plan yet"));
  });

  window.location.hash = "#p=%%%not-a-real-plan";
  await new Promise((r) => setTimeout(r, 100));
  window.location.hash = "#p=garbagegarbage";
  await new Promise((r) => setTimeout(r, 100));
  t("E7: a tampered link shows a named error view, and dismiss recovers", () => {
    assert.strictEqual($("shared-plan").hidden, false);
    assert($("shared-plan").textContent.includes("doesn't contain a readable plan"));
    $("shared-dismiss").click();
    assert.strictEqual($("shared-plan").hidden, true);
    assert.strictEqual($("plan-builder").hidden, false);
  });

  /* ---- M12: today's session + retention layer ---- */
  t("M12: today's session card renders a daily workout with tappable exercises", () => {
    doc.getElementById("tab-workouts").click();
    assert($("today-box").querySelector(".today-card"));
    assert($("today-box").textContent.includes("Today’s session"));
    assert($("today-box").querySelectorAll("[data-detail]").length >= 4);
    assert($("today-box").textContent.includes("reps"));
  });

  t("M12: reshuffle regenerates and keeps the card populated", () => {
    $("today-shuffle").click();
    assert($("today-box").querySelectorAll("[data-detail]").length >= 4);
  });

  t("M12: today's focus can be switched for people on their own split", () => {
    assert($("today-split"), "focus picker present");
    assert($("today-box").textContent.includes("suggested"), "day's suggestion is marked");
    input("today-split", "upper");
    assert($("today-box").querySelector("h3").textContent.includes("Upper-body"));
    assert($("today-box").textContent.includes("your pick"), "override is labelled");
    assert($("today-box").querySelectorAll("[data-detail]").length >= 4);
    $("today-shuffle").click(); // override survives a reshuffle
    assert($("today-box").querySelector("h3").textContent.includes("Upper-body"));
  });

  t("M12: 'Add all to plan' fills the plan and shows a Plans tab badge", () => {
    $("today-plan").click();
    const badge = doc.getElementById("tab-plans").querySelector(".tab-badge");
    assert(badge && Number(badge.textContent) >= 4, "plans badge counts items");
    doc.getElementById("tab-plans").click();
    assert($("plan-builder").querySelectorAll(".plan-item").length >= 4);
    $("plan-clear").click();
    assert(!doc.getElementById("tab-plans").querySelector(".tab-badge"), "badge clears with the plan");
  });

  t("M12: saved badge tracks saves and unsaves", () => {
    doc.getElementById("tab-supplements").click();
    $("supp-grid").querySelector("[data-save-supp='creatine']").click();
    let badge = doc.getElementById("tab-saved").querySelector(".tab-badge");
    assert(badge && badge.textContent === "1");
    $("supp-grid").querySelector("[data-save-supp='creatine']").click();
    assert(!doc.getElementById("tab-saved").querySelector(".tab-badge"));
  });

  t("M12: empty states offer a way forward (goto buttons, clear filters)", () => {
    doc.getElementById("tab-saved").click();
    $("saved-content").querySelector("[data-goto-tab='workouts']").click();
    assert.strictEqual($("panel-workouts").hidden, false, "goto button switches tab");
    input("ex-q", "zzzznotreal");
    $("ex-grid").querySelector("[data-clear-filters='ex']").click();
    assert.strictEqual($("ex-q").value, "");
    assert($("ex-grid").querySelectorAll(".card").length > 0, "grid restored after clearing");
  });

  t("M12: calculator results cross-link to protein-rich foods", () => {
    doc.getElementById("tab-nutrition").click();
    input("c-sex", "male"); input("c-age", "25");
    input("c-ft", "5"); input("c-in", "10");
    input("c-weight", "170"); input("c-activity", "1.55");
    $("c-go").click();
    $("see-protein").click();
    assert.strictEqual($("food-group").value, "protein");
    assert($("food-body").textContent.includes("Chicken"));
    input("food-group", "");
  });

  t("M12: exercise cards show a thumbnail that hides itself on load failure", () => {
    doc.getElementById("tab-workouts").click();
    input("ex-muscle", "chest");
    const img = $("ex-grid").querySelector(".card-thumb");
    assert(img && img.src.includes("raw.githubusercontent.com"));
    assert(img.getAttribute("onerror"), "has offline fallback");
    input("ex-muscle", "");
  });

  t("removal check: no key field, settings control, or api.anthropic.com reference in the page", () => {
    assert(!doc.getElementById("coach-key"));
    assert(!doc.getElementById("coach-settings-btn"));
    assert(!doc.documentElement.outerHTML.includes("api.anthropic.com"));
  });

  console.log("\n" + pass + " smoke tests passed");
  window.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
