// Shareable coach plans: serialize a curated exercise plan (with per-exercise
// coach notes) into a URL-safe string and back. Pure logic, no DOM, unit-testable
// in Node. The whole plan travels inside the link fragment (#p=...), so sharing
// needs no server, no account, and works on the static deploy and from file://.
(function (root) {
  var Share = {};

  Share.LIMITS = { items: 15, note: 300, title: 80, name: 60, message: 500 };

  /* ---- base64url of UTF-8 text (btoa/atob exist in browsers and Node 16+) ---- */
  function utf8Bytes(s) {
    return encodeURIComponent(s).replace(/%([0-9A-Fa-f]{2})/g, function (_, h) {
      return String.fromCharCode(parseInt(h, 16));
    });
  }
  function bytesToUtf8(b) {
    var out = "";
    for (var i = 0; i < b.length; i++) {
      var h = b.charCodeAt(i).toString(16);
      out += "%" + (h.length < 2 ? "0" : "") + h;
    }
    return decodeURIComponent(out);
  }
  Share.toB64 = function (s) {
    return btoa(utf8Bytes(s)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  Share.fromB64 = function (s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return bytesToUtf8(atob(s));
  };

  function clip(v, n) { return String(v == null ? "" : v).trim().slice(0, n); }

  // plan: { title, coach, message, items: [{ id, note }] }
  // -> { code } (base64url string) or { error } if there is nothing shareable.
  Share.encodePlan = function (plan) {
    plan = plan || {};
    var items = (Array.isArray(plan.items) ? plan.items : [])
      .filter(function (it) { return it && typeof it.id === "string" && it.id; })
      .slice(0, Share.LIMITS.items)
      .map(function (it) { return [it.id, clip(it.note, Share.LIMITS.note)]; });
    if (!items.length) return { error: "Add at least one exercise before creating a link." };
    var payload = {
      v: 1,
      t: clip(plan.title, Share.LIMITS.title),
      c: clip(plan.coach, Share.LIMITS.name),
      m: clip(plan.message, Share.LIMITS.message),
      x: items
    };
    return { code: Share.toB64(JSON.stringify(payload)) };
  };

  // exercises: the bundled DB; ids that don't exist (tampered or stale links)
  // are dropped rather than crashing the view.
  // -> { plan } with items [{ id, note, exercise }], or { error }.
  Share.decodePlan = function (code, exercises) {
    var bad = { error: "That link doesn't contain a readable plan. Ask whoever sent it for a fresh one." };
    var raw;
    try { raw = JSON.parse(Share.fromB64(code)); } catch (e) { return bad; }
    if (!raw || raw.v !== 1 || !Array.isArray(raw.x)) return bad;
    var byId = {};
    (exercises || []).forEach(function (x) { byId[x.id] = x; });
    var items = [];
    raw.x.slice(0, Share.LIMITS.items).forEach(function (row) {
      if (!Array.isArray(row) || typeof row[0] !== "string" || !byId[row[0]]) return;
      items.push({ id: row[0], note: clip(row[1], Share.LIMITS.note), exercise: byId[row[0]] });
    });
    if (!items.length) return { error: "None of the exercises in that link exist in this version of the app." };
    return {
      plan: {
        title: clip(raw.t, Share.LIMITS.title),
        coach: clip(raw.c, Share.LIMITS.name),
        message: clip(raw.m, Share.LIMITS.message),
        items: items
      }
    };
  };

  Share.planLink = function (href, code) {
    return String(href).split("#")[0] + "#p=" + code;
  };

  // -> encoded plan string from a location.hash (or full URL), else null
  Share.parseHash = function (hash) {
    var m = /[#&]p=([A-Za-z0-9\-_]+)/.exec(String(hash || ""));
    return m ? m[1] : null;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Share;
  root.Share = Share;
})(typeof window !== "undefined" ? window : globalThis);
