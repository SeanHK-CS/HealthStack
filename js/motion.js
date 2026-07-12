// Motion layer: vanilla ports of motion-primitives patterns (motion-primitives.com)
// — TextEffect per-word reveal, AnimatedGroup/InView staggered card entrances,
// Spotlight cursor glow, and a sliding tab indicator. motion-primitives itself is
// a React library; this file re-implements its signature interactions with zero
// dependencies so the site keeps booting from disk with no build step.
// Pure progressive enhancement: without it (or with prefers-reduced-motion) the
// page is identical, just static.
(function () {
  "use strict";
  var doc = document;

  function media(q) {
    try { return window.matchMedia(q).matches; } catch (e) { return false; }
  }
  if (media("(prefers-reduced-motion: reduce)")) return;
  doc.documentElement.classList.add("mp-motion");

  /* ---- TextEffect: per-word blur/rise reveal on the tagline ---- */
  var tag = doc.querySelector(".tagline");
  if (tag) {
    var words = tag.textContent.split(/\s+/).filter(Boolean);
    tag.textContent = "";
    words.forEach(function (w, i) {
      var s = doc.createElement("span");
      s.className = "mp-word";
      s.style.animationDelay = (120 + i * 24) + "ms";
      s.textContent = w;
      tag.appendChild(s);
      tag.appendChild(doc.createTextNode(" "));
    });
  }

  /* ---- AnimatedGroup / InView: staggered reveals for re-rendered grids ---- */
  var io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("mp-in");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
  }
  function reveal(container) {
    var kids = container.querySelectorAll(".card");
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.classList.contains("mp-card")) continue;
      k.classList.add("mp-card");
      k.style.setProperty("--mp-i", String(i % 14));
      if (io) io.observe(k); else k.classList.add("mp-in");
    }
  }
  ["ex-grid", "supp-grid", "saved-content", "plan-builder", "shared-plan"].forEach(function (id) {
    var el = doc.getElementById(id);
    if (!el) return;
    reveal(el);
    if ("MutationObserver" in window) {
      new MutationObserver(function () { reveal(el); }).observe(el, { childList: true, subtree: true });
    }
  });

  /* ---- Spotlight: cursor-tracking glow on cards (fine pointers only) ---- */
  if (media("(hover: hover) and (pointer: fine)")) {
    doc.addEventListener("pointermove", function (e) {
      var card = e.target && e.target.closest ? e.target.closest(".card") : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mp-mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--mp-my", (e.clientY - r.top) + "px");
    }, { passive: true });
  }

  /* ---- Sliding tab indicator ---- */
  var nav = doc.querySelector(".tabs");
  if (nav) {
    var ind = doc.createElement("span");
    ind.className = "mp-tab-ind";
    ind.setAttribute("aria-hidden", "true");
    nav.appendChild(ind);
    var move = function () {
      var cur = nav.querySelector('.tab[aria-selected="true"]');
      if (!cur || !cur.offsetWidth) { ind.style.opacity = "0"; return; }
      ind.style.opacity = "1";
      ind.style.width = cur.offsetWidth + "px";
      ind.style.transform = "translate(" + cur.offsetLeft + "px," + (cur.offsetTop + cur.offsetHeight - 3) + "px)";
    };
    nav.addEventListener("click", function () { setTimeout(move, 0); });
    window.addEventListener("resize", move);
    window.addEventListener("load", move);
    move();
  }
})();
