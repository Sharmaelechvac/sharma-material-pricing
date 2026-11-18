/* Sharma Material Prices — one app, three links.
   /electrical and /hvac each load only their own trade's rows; /combined
   shows both with ELEC/HVAC tags and the only trade filter in the app.
   Prices come only from prices.enc.json (decrypted in the browser by lock.js
   after the office code is entered) and only ever hold prices Sharma pays
   its distributors — web/list rows are dropped when the data is built.
   Photos (photos.json + img/) are public product pictures, never prices.
   Design: guidance sections 13 + 13a — a plain supply-house catalog:
   photo-led cards, plain words, details tucked behind a tap. */
(function () {
  "use strict";
  var MODE = window.PRICE_TRADE; // electrical | hvac | combined
  var LABEL = window.PRICE_LABEL || MODE;
  var COMBINED = MODE === "combined";
  var STALE_DAYS = 45;
  var CHANGED_DAYS = 30;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return esc(n);
    var d = Math.abs(v) >= 100 ? 2 : 4;
    return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: d });
  }
  function parseDate(s) {
    if (!s) return null;
    var d = new Date(String(s) + "T12:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDate(s) {
    var d = parseDate(s);
    return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  }
  function ageDays(e) {
    var d = parseDate(e.date);
    return d ? Math.floor((Date.now() - d.getTime()) / 86400000) : null;
  }
  function statusStale(e) { return /STALE/i.test(e.status || ""); }
  function isStale(e) {
    if (statusStale(e)) return true;
    var a = ageDays(e);
    return a !== null && a > STALE_DAYS;
  }
  function tradeTag(t) {
    return t === "hvac" ? '<span class="tag hvac">HVAC</span>' : '<span class="tag elec">ELEC</span>';
  }
  function priceType(e) {
    if (/WEB/i.test(e.status || "")) return "web";
    if (/SANJAY/i.test((e.status || "") + " " + (e.supplier || ""))) return "sanjay";
    return "ticket";
  }
  function flagsFor(e) {
    var out = "";
    var t = priceType(e);
    if (t === "web") out += '<span class="tag web">WEB LIST</span>';
    else if (t === "sanjay") out += '<span class="tag rule">SANJAY\'S PRICE</span>';
    else out += '<span class="tag ticket">TICKET</span>';
    if (isStale(e)) {
      var a = ageDays(e);
      out += '<span class="tag stale">RE-CHECK' + (a !== null ? " · " + a + " DAYS" : "") + "</span>";
    } else {
      var a2 = ageDays(e);
      if (a2 !== null && a2 > 30 && a2 <= STALE_DAYS) out += '<span class="tag aging">GETTING OLD · ' + a2 + " DAYS</span>";
    }
    if (!e.source) out += '<span class="tag nosrc">no ticket</span>';
    if (!e.date) out += '<span class="tag nosrc">no date</span>';
    return out;
  }
  // Plain display name: part-number-looking tokens move to Details (§13.2).
  function splitName(name) {
    var toks = name.split(/\s+/);
    var codes = [], words = [];
    toks.forEach(function (t) {
      var bare = t.replace(/^[#\s]+/, "");
      if (bare.length >= 5 && /\d/.test(bare) && /[A-Za-z]/.test(bare) && /^[A-Za-z0-9][A-Za-z0-9\-\/]*$/.test(bare)) codes.push(t);
      else words.push(t);
    });
    var plain = words.join(" ").trim();
    if (plain.length < 4 || !codes.length) return { plain: name, codes: [] };
    return { plain: plain, codes: codes };
  }
  function categoryFor(it) {
    if (it.trade === "hvac") return "HVAC";
    var n = " " + it.name.toLowerCase() + " ";
    if (/panel|load ?center|meter|disconnect|service/.test(n)) return "Panels";
    if (/breaker|afci|gfci breaker|surge/.test(n)) return "Breakers";
    if (/box|ring|bracket|gang/.test(n)) return "Boxes";
    if (/receptacle|outlet|switch|dimmer|gfci|cover|in-use|wp\d|device|usb/.test(n)) return "Devices";
    if (/wire|thhn|romex|nm-b|cable|gec|ser |xhhw|uf-b|bare|conductor|stranded|solid cu/.test(n)) return "Wire";
    return "Other";
  }
  var ICONS = {
    Wire: '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9aa5b8" stroke-width="2.5"><circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="7"/><path d="M32 12v6M32 46v6M12 32h6M46 32h6"/></svg>',
    Breakers: '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9aa5b8" stroke-width="2.5"><rect x="20" y="10" width="24" height="44" rx="3"/><rect x="27" y="24" width="10" height="16" rx="2"/><path d="M32 24v-6M32 46v-6"/></svg>',
    Boxes: '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9aa5b8" stroke-width="2.5"><rect x="14" y="14" width="36" height="36" rx="2"/><rect x="24" y="24" width="16" height="16" rx="1"/></svg>',
    Panels: '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9aa5b8" stroke-width="2.5"><rect x="18" y="6" width="28" height="52" rx="2"/><path d="M25 16h6M33 16h6M25 26h6M33 26h6M25 36h6M33 36h6M25 46h6M33 46h6"/></svg>',
    Devices: '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9aa5b8" stroke-width="2.5"><rect x="18" y="10" width="28" height="44" rx="4"/><circle cx="32" cy="24" r="3.5"/><circle cx="32" cy="40" r="3.5"/></svg>',
    HVAC: '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9aa5b8" stroke-width="2.5"><rect x="10" y="14" width="44" height="36" rx="3"/><circle cx="32" cy="32" r="9"/><path d="M32 23v6l5 4M32 41v-6l-6-2M23 32h6l3-5"/></svg>',
    Other: '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9aa5b8" stroke-width="2.5"><path d="M12 24l20-10 20 10v16L32 50 12 40z"/><path d="M12 24l20 10 20-10M32 34v16"/></svg>'
  };

  var photos = {};
  fetch("../photos.json").then(function (r) { return r.ok ? r.json() : {}; }).then(function (p) { photos = p || {}; }).catch(function () { photos = {}; })
    .then(function () {
      return SharmaLock.load("../prices.enc.json", { appName: "Material Prices — " + LABEL, logo: "../assets/logo.png" });
    })
    .then(function (data) { render(data); })
    .catch(function (err) {
      document.getElementById("app").hidden = false;
      document.getElementById("items").innerHTML = '<p class="empty">Could not load prices: ' + esc(err.message) + "</p>";
    });

  function render(data) {
    var entries = data.entries || [];
    var all = COMBINED ? entries.slice() : entries.filter(function (e) { return e.trade === MODE; });
    document.getElementById("app").hidden = false;

    var byKey = {};
    all.forEach(function (e, idx) {
      var k = (COMBINED ? e.trade + "|" : "") + e.item.toLowerCase();
      if (!byKey[k]) byKey[k] = { key: k, name: e.item, trade: e.trade, rows: [] };
      byKey[k].rows.push({ e: e, idx: idx });
    });
    var items = Object.keys(byKey).map(function (k) {
      var it = byKey[k];
      it.rows.sort(function (a, b) {
        var da = parseDate(a.e.date), db = parseDate(b.e.date);
        var ta = da ? da.getTime() : 0, tb = db ? db.getTime() : 0;
        if (tb !== ta) return tb - ta;
        return b.idx - a.idx;
      });
      // Headline = newest ticket / Sanjay price (web rows never reach the data).
      var pool = it.rows.filter(function (r) { return priceType(r.e) !== "web"; });
      if (!pool.length) pool = it.rows;
      it.latest = pool[0].e;
      it.prev = pool.length > 1 ? pool[1].e : null;
      it.change = null;
      if (it.prev && isFinite(Number(it.latest.price)) && isFinite(Number(it.prev.price)) && Number(it.prev.price) !== 0) {
        var diff = Number(it.latest.price) - Number(it.prev.price);
        it.change = { diff: diff, pct: Math.round((diff / Number(it.prev.price)) * 100) };
      }
      it.changed30 = false;
      if (it.change && it.change.diff !== 0) {
        var a = ageDays(it.latest);
        it.changed30 = a !== null && a <= CHANGED_DAYS;
      }
      var sn = splitName(it.name);
      it.plain = sn.plain;
      it.codes = sn.codes;
      it.cat = categoryFor(it);
      it.photo = photos[it.trade + "|" + it.name.toLowerCase()] || null;
      return it;
    });

    function staleItems(list) { return list.filter(function (it) { return isStale(it.latest); }); }
    function changeNote(it) {
      if (!it.change || it.change.diff === 0 || !it.prev) return "";
      var up = it.change.diff > 0;
      var hot = Math.abs(it.change.pct) > 10;
      return '<span class="card-note' + (hot ? " hot" : "") + '">' + (up ? "Up " : "Down ") + money(Math.abs(it.change.diff)).replace(".00", "") +
        (it.prev.date ? " since " + fmtDate(it.prev.date) : "") + "</span>";
    }

    var stats = document.getElementById("stats");
    if (COMBINED) {
      var ei = items.filter(function (i) { return i.trade === "electrical"; });
      var hi = items.filter(function (i) { return i.trade === "hvac"; });
      var se = staleItems(ei).length, sh = staleItems(hi).length;
      stats.innerHTML =
        '<div class="stat"><span class="stat-num">' + ei.length + '</span><span class="stat-lab">Electrical items</span></div>' +
        '<div class="stat gold"><span class="stat-num">' + hi.length + '</span><span class="stat-lab">HVAC items</span></div>' +
        '<div class="stat"><span class="stat-num">' + items.length + '</span><span class="stat-lab">All items</span></div>' +
        '<button type="button" class="stat stale-tile' + (se + sh > 0 ? " hot" : "") + '" id="staleTile"><span class="stat-num">' + (se + sh) + '</span><span class="stat-lab">To re-check — Elec ' + se + " · HVAC " + sh + "</span></button>";
    } else {
      var sc = staleItems(items).length;
      stats.innerHTML =
        '<div class="stat"><span class="stat-num">' + items.length + '</span><span class="stat-lab">Items</span></div>' +
        '<div class="stat"><span class="stat-num">' + all.length + '</span><span class="stat-lab">Prices we pay</span></div>' +
        '<button type="button" class="stat stale-tile' + (sc > 0 ? " hot" : "") + '" id="staleTile"><span class="stat-num">' + sc + '</span><span class="stat-lab">To re-check</span></button>';
    }

    var newest = "";
    items.forEach(function (it) { if (it.latest.date && it.latest.date > newest) newest = it.latest.date; });
    document.getElementById("asof").textContent =
      (newest ? "Newest price: " + fmtDate(newest) : "No dated prices on file") +
      " · " + all.length + " prices we pay on file" + (COMBINED ? " across both trades." : " for " + LABEL + ".");

    var savedView = "cards";
    try { savedView = localStorage.getItem("mp-view") || "cards"; } catch (e) {}
    if (["cards", "list", "sheet", "supplier"].indexOf(savedView) === -1) savedView = "cards";
    var state = { q: "", supplier: "", stale: false, changed: false, movers: false, trade: "all", cat: "", sort: "name", view: savedView };
    var lastView = [];
    var suppliers = [];
    all.forEach(function (e) { if (e.supplier && suppliers.indexOf(e.supplier) === -1) suppliers.push(e.supplier); });
    suppliers.sort();

    // Category chips (§13.4): plain words, gold underline on the active one.
    var catsEl = document.getElementById("cats");
    var CAT_ORDER = ["Wire", "Boxes", "Breakers", "Panels", "Devices", "HVAC"];
    var catsPresent = CAT_ORDER.filter(function (c) {
      if (MODE === "hvac") return false;
      if (c === "HVAC") return COMBINED;
      return items.some(function (it) { return it.cat === c; });
    });
    if (catsEl && catsPresent.length) {
      catsEl.innerHTML = '<button type="button" class="cat-chip" data-cat="">Show all</button>' +
        catsPresent.map(function (c) { return '<button type="button" class="cat-chip" data-cat="' + c + '">' + c + "</button>"; }).join("");
      catsEl.addEventListener("click", function (ev) {
        var b = ev.target.closest(".cat-chip");
        if (!b) return;
        state.cat = b.getAttribute("data-cat");
        paintCats(); draw();
      });
    }
    function paintCats() {
      if (!catsEl) return;
      catsEl.querySelectorAll(".cat-chip").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-cat") === state.cat);
      });
    }

    var chips = document.getElementById("chips");
    function chip(label, kind, val) {
      return '<button type="button" class="chip" data-kind="' + kind + '" data-val="' + esc(val) + '">' + esc(label) + "</button>";
    }
    chips.innerHTML = chip("All suppliers", "supplier", "") +
      suppliers.map(function (s) { return chip(s, "supplier", s); }).join("") +
      chip("To re-check only", "stale", "") + chip("Changed lately", "changed", "") + chip("Big moves", "movers", "");
    function paintChips() {
      chips.querySelectorAll(".chip").forEach(function (c) {
        var k = c.getAttribute("data-kind"), v = c.getAttribute("data-val"), on = false;
        if (k === "supplier") on = state.supplier === v;
        if (k === "stale") on = state.stale;
        if (k === "changed") on = state.changed;
        if (k === "movers") on = state.movers;
        c.classList.toggle("active", on);
      });
      document.querySelectorAll(".seg-btn").forEach(function (b) {
        var on = b.getAttribute("data-t") === state.trade;
        b.classList.toggle("active", on);
        b.classList.toggle("gold-active", on && b.getAttribute("data-t") === "hvac");
      });
    }
    chips.addEventListener("click", function (ev) {
      var c = ev.target.closest(".chip");
      if (!c) return;
      var k = c.getAttribute("data-kind");
      if (k === "supplier") state.supplier = c.getAttribute("data-val");
      if (k === "stale") state.stale = !state.stale;
      if (k === "changed") state.changed = !state.changed;
      if (k === "movers") state.movers = !state.movers;
      paintChips(); draw();
    });
    var staleTile = document.getElementById("staleTile");
    if (staleTile) staleTile.addEventListener("click", function () { state.stale = !state.stale; paintChips(); draw(); });
    if (COMBINED) {
      document.querySelectorAll(".seg-btn").forEach(function (b) {
        b.addEventListener("click", function () { state.trade = b.getAttribute("data-t"); paintChips(); draw(); });
      });
    }
    // Re-check list: old prices, oldest first, copyable for Warren.
    var reqRow = document.createElement("div");
    reqRow.className = "req-row";
    reqRow.innerHTML = '<button type="button" class="chip" id="reqBtn">Re-check list</button>' +
      '<button type="button" class="chip" id="copyBtn" hidden>Copy list</button>';
    chips.parentNode.insertBefore(reqRow, chips.nextSibling);
    reqRow.querySelector("#reqBtn").addEventListener("click", function () {
      state.stale = true;
      state.sort = "oldest";
      document.getElementById("sort").value = "oldest";
      reqRow.querySelector("#copyBtn").hidden = false;
      paintChips(); draw();
    });
    reqRow.querySelector("#copyBtn").addEventListener("click", function () {
      var btn = this;
      var lines = ["Item\tPrice\tUnit\tSupplier\tDate\tTicket"];
      lastView.forEach(function (v) {
        lines.push([v.it.name, Number(v.e.price), v.e.unit || "", v.e.supplier || "", v.e.date || "no date", v.e.source || "no ticket"].join("\t"));
      });
      var text = lines.join("\n");
      function done() {
        btn.textContent = "Copied " + lastView.length + " items";
        setTimeout(function () { btn.textContent = "Copy list"; }, 2000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
      else {
        var ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (err) {}
        document.body.removeChild(ta);
        done();
      }
    });
    document.getElementById("q").addEventListener("input", function (ev) { state.q = ev.target.value.trim().toLowerCase(); draw(); });
    document.getElementById("sort").addEventListener("change", function (ev) { state.sort = ev.target.value; draw(); });
    var viewsEl = document.getElementById("views");
    function paintViews() {
      if (!viewsEl) return;
      viewsEl.querySelectorAll(".view-btn").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-view") === state.view);
      });
    }
    if (viewsEl) viewsEl.addEventListener("click", function (ev) {
      var b = ev.target.closest(".view-btn");
      if (!b) return;
      state.view = b.getAttribute("data-view");
      try { localStorage.setItem("mp-view", state.view); } catch (e) {}
      paintViews(); draw();
    });

    var sheet = document.getElementById("sheet");
    var openKey = null;
    function chartSVG(it) {
      var pts = it.rows.map(function (r) { return r.e; }).filter(function (e) { return parseDate(e.date); });
      pts.sort(function (a, b) { return parseDate(a.date) - parseDate(b.date); });
      if (pts.length < 2) return "";
      var W = 320, H = 96, P = 12;
      var t0 = parseDate(pts[0].date).getTime(), t1 = parseDate(pts[pts.length - 1].date).getTime();
      var ps = pts.map(function (e) { return Number(e.price); }).filter(isFinite);
      if (!ps.length) return "";
      var loP = Math.min.apply(null, ps), hiP = Math.max.apply(null, ps);
      var lo = loP, hi = hiP;
      if (hi === lo) { hi = lo + 1; }
      var xy = pts.map(function (e) {
        var x = t1 === t0 ? W / 2 : P + ((parseDate(e.date).getTime() - t0) / (t1 - t0)) * (W - 2 * P);
        var y = H - 18 - ((Number(e.price) - lo) / (hi - lo)) * (H - 36);
        return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
      });
      var line = xy.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
      var last = xy[xy.length - 1];
      return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Price history chart">' +
        '<polyline points="' + line + '" fill="none" stroke="#264387" stroke-width="2"/>' +
        '<text x="' + P + '" y="11" class="chart-lab">' + money(hiP) + "</text>" +
        '<text x="' + P + '" y="' + (H - 20) + '" class="chart-lab">' + money(loP) + "</text>" +
        '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4.5" fill="#F0A846" stroke="#1a2f61" stroke-width="1.5"/>' +
        '<text x="' + P + '" y="' + (H - 4) + '" class="chart-lab">' + esc(pts[0].date) + "</text>" +
        '<text x="' + (W - P) + '" y="' + (H - 4) + '" text-anchor="end" class="chart-lab">' + esc(pts[pts.length - 1].date) + "</text></svg>";
    }
    function openSheet(it, anchor) {
      if (openKey === it.key) { sheet.hidden = true; openKey = null; return; }
      openKey = it.key;
      var L = it.latest;
      var bySup = {};
      it.rows.forEach(function (r) { if (!bySup[r.e.supplier]) bySup[r.e.supplier] = r.e; });
      var supNames = Object.keys(bySup);
      var supNote = "";
      if (supNames.length > 1) {
        supNote = '<p class="sup-note">Newest price by supplier: ' + supNames.map(function (s) {
          return esc(s) + " " + money(bySup[s].price) + (bySup[s].date ? " (" + fmtDate(bySup[s].date) + ")" : "");
        }).join(" · ") + "</p>";
      }
      var rows = it.rows.map(function (r) {
        var e = r.e;
        return "<tr><td class='num'>" + (e.date ? esc(fmtDate(e.date)) : "no date") + "</td><td class='num'>" + money(e.price) +
          (e.unit ? " / " + esc(e.unit) : "") + "</td><td>" + esc(e.supplier) + "</td><td>" + (e.source ? esc(e.source) : "no ticket") + "<br>" + flagsFor(e) + "</td></tr>";
      }).join("");
      var photoHtml = it.photo
        ? '<div class="sheet-photo"><img src="../' + esc(it.photo.src) + '" alt="' + esc(it.plain) + '" loading="lazy"></div>'
        : '<div class="sheet-photo ph">' + (ICONS[it.cat] || ICONS.Other) + '<span class="cap">Photo coming</span></div>';
      sheet.innerHTML = '<div class="sheet-head"><span class="sheet-title">' + esc(it.plain) + "</span>" +
        (COMBINED ? tradeTag(it.trade) : "") +
        '<button type="button" class="sheet-close" aria-label="Close details">Close</button></div>' +
        photoHtml +
        '<p class="sheet-price">' + money(L.price) + (L.unit ? ' <span class="sheet-unit">per ' + esc(L.unit) + "</span>" : "") + "</p>" +
        '<dl class="details">' +
        (it.codes.length ? "<div><dt>Part number</dt><dd>" + esc(it.codes.join(", ")) + "</dd></div>" : "") +
        "<div><dt>Full name on file</dt><dd>" + esc(it.name) + "</dd></div>" +
        "<div><dt>Supplier</dt><dd>" + esc(L.supplier) + "</dd></div>" +
        "<div><dt>Price date</dt><dd>" + (L.date ? esc(fmtDate(L.date)) : "no date") + "</dd></div>" +
        "<div><dt>Ticket</dt><dd>" + (L.source ? esc(L.source) : "no ticket on file") + "</dd></div>" +
        (it.photo && it.photo.source ? '<div><dt>Photo from</dt><dd><a href="' + esc(it.photo.source) + '" target="_blank" rel="noopener">' + esc(it.photo.source) + "</a></dd></div>" : "") +
        "</dl>" +
        chartSVG(it) + supNote +
        '<table class="hist"><thead><tr><th>Date</th><th>Price</th><th>Supplier</th><th>Ticket</th></tr></thead><tbody>' + rows + "</tbody></table>";
      sheet.hidden = false;
      sheet.querySelector(".sheet-close").addEventListener("click", function () { sheet.hidden = true; openKey = null; });
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sheet, anchor.nextSibling);
    }

    function thumbHtml(it) {
      if (it.photo) return '<img src="../' + esc(it.photo.src) + '" alt="" loading="lazy">';
      return ICONS[it.cat] || ICONS.Other;
    }

    function photoHtml(it) {
      if (it.photo) return '<span class="photo"><img src="../' + esc(it.photo.src) + '" alt="' + esc(it.plain) + '" loading="lazy"></span>';
      return '<span class="photo ph">' + (ICONS[it.cat] || ICONS.Other) + '<span class="cap">Photo coming</span></span>';
    }

    function draw() {
      var shown = items.filter(function (it) {
        var L = it.latest;
        if (COMBINED && state.trade !== "all" && it.trade !== state.trade) return false;
        if (state.cat) {
          if (state.cat === "HVAC") { if (it.trade !== "hvac") return false; }
          else if (it.cat !== state.cat) return false;
        }
        if (state.q) {
          var inName = it.name.toLowerCase().indexOf(state.q) !== -1;
          var inSup = it.rows.some(function (r) { return (r.e.supplier || "").toLowerCase().indexOf(state.q) !== -1; });
          var inSrc = it.rows.some(function (r) { return (r.e.source || "").toLowerCase().indexOf(state.q) !== -1; });
          if (!inName && !inSup && !inSrc) return false;
        }
        if (state.supplier && !it.rows.some(function (r) { return r.e.supplier === state.supplier; })) return false;
        if (state.stale && !isStale(L)) return false;
        if (state.changed && !it.changed30) return false;
        if (state.movers && !(it.change && Math.abs(it.change.pct) > 5)) return false;
        return true;
      });
      var view = shown.map(function (it) {
        var e = it.latest, ch = it.change;
        if (state.supplier) {
          var rows = it.rows.filter(function (r) { return r.e.supplier === state.supplier; });
          e = rows[0].e;
          ch = null;
          if (rows.length > 1) {
            var pv = rows[1].e;
            if (isFinite(Number(e.price)) && isFinite(Number(pv.price)) && Number(pv.price) !== 0) {
              var d = Number(e.price) - Number(pv.price);
              ch = { diff: d, pct: Math.round((d / Number(pv.price)) * 100) };
            }
          }
        }
        return { it: it, e: e, ch: ch };
      });
      lastView = view;
      if (state.sort === "price") view.sort(function (a, b) { return Number(b.e.price) - Number(a.e.price); });
      else if (state.sort === "updated") view.sort(function (a, b) {
        var da = parseDate(a.e.date), db = parseDate(b.e.date);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
      else if (state.sort === "change") view.sort(function (a, b) {
        var ca = a.ch ? Math.abs(a.ch.pct) : -1, cb = b.ch ? Math.abs(b.ch.pct) : -1;
        return cb - ca;
      });
      else if (state.sort === "oldest") view.sort(function (a, b) {
        var da = parseDate(a.e.date), db = parseDate(b.e.date);
        if (!da && !db) return 0;
        if (!da) return -1;
        if (!db) return 1;
        return da.getTime() - db.getTime();
      });
      else view.sort(function (a, b) {
        // Combined page: Electrical first, then HVAC, never interleaved (§12a).
        if (COMBINED && state.trade === "all" && a.it.trade !== b.it.trade) return a.it.trade === "electrical" ? -1 : 1;
        return a.it.plain.localeCompare(b.it.plain);
      });

      var box = document.getElementById("items");
      sheet.hidden = true; openKey = null;
      // The details sheet gets moved next to the tapped item; move it back
      // home before re-rendering or it is wiped with the items markup.
      if (sheet.parentNode && sheet.parentNode !== box.parentNode) box.parentNode.appendChild(sheet);
      if (!all.length) {
        box.innerHTML = '<p class="empty">No distributor prices on file yet' + (COMBINED ? "" : " for " + esc(LABEL)) + ". Prices show up here as supplier tickets are added to the tracker.</p>";
        return;
      }
      if (!shown.length) {
        box.innerHTML = '<p class="empty">Nothing matches' + (state.q ? " &lsquo;" + esc(state.q) + "&rsquo;" : "") + ". Try a shorter word, like &lsquo;breaker&rsquo;.</p>";
        return;
      }
      function noteFor(v) {
        var it = v.it;
        if (v.ch && v.ch.diff !== 0) {
          var up = v.ch.diff > 0, hot = Math.abs(v.ch.pct) > 10;
          return '<span class="card-note' + (hot ? " hot" : "") + '">' + (up ? "Up " : "Down ") + money(Math.abs(v.ch.diff)).replace(".00", "") +
            (it.prev && it.prev.date && !state.supplier ? " since " + fmtDate(it.prev.date) : "") + "</span>";
        }
        return state.supplier ? "" : changeNote(it);
      }
      function cardHtml(v) {
        var it = v.it, L = v.e;
        var staleNote = isStale(L) ? '<span class="card-stale">Old price — worth a re-check</span>' : "";
        return '<div class="card t-' + it.trade + '"><button class="card-main" data-key="' + esc(it.key) + '">' +
          photoHtml(it) +
          '<span class="card-body">' +
          '<span class="card-name">' + esc(it.plain) + "</span>" +
          '<span class="card-price">' + money(L.price) + "</span>" +
          '<span class="card-sub">' + (L.unit ? "per " + esc(L.unit) + " · " : "") + esc(L.supplier) + (COMBINED ? " · " + (it.trade === "hvac" ? "HVAC" : "ELEC") : "") + "</span>" +
          noteFor(v) + staleNote +
          '<span class="card-details">Details ›</span>' +
          "</span></button></div>";
      }
      function listRowHtml(v) {
        var it = v.it, L = v.e;
        var staleNote = isStale(L) ? '<span class="card-stale">Old price — worth a re-check</span>' : "";
        return '<div class="lrow t-' + it.trade + '"><button class="lrow-main" data-key="' + esc(it.key) + '">' +
          '<span class="lthumb">' + thumbHtml(it) + "</span>" +
          '<span class="lmain">' +
          '<span class="lname">' + esc(it.plain) + "</span>" +
          '<span class="lsub">' + esc(L.supplier) + (L.date ? " · " + fmtDate(L.date) : "") + (COMBINED ? " · " + (it.trade === "hvac" ? "HVAC" : "ELEC") : "") + "</span>" +
          noteFor(v) + staleNote +
          "</span>" +
          '<span class="lprice">' + money(L.price) + '<span class="lunit">' + (L.unit ? "per " + esc(L.unit) : "") + "</span></span>" +
          "</button></div>";
      }
      function sheetHtml() {
        var rows = view.map(function (v) {
          var it = v.it, L = v.e;
          return '<tr data-key="' + esc(it.key) + '" tabindex="0"><td class="pi">' + esc(it.plain) +
            (it.codes.length ? '<span class="pcodes">' + esc(it.codes.join(", ")) + "</span>" : "") + (COMBINED ? tradeTag(it.trade) : "") + "</td>" +
            '<td class="num pprice">' + money(L.price) + "</td>" +
            "<td>" + (L.unit ? esc(L.unit) : "—") + "</td>" +
            "<td>" + esc(L.supplier) + "</td>" +
            '<td class="num">' + (L.date ? fmtDate(L.date) : "no date") + "</td>" +
            "<td>" + (L.source ? esc(L.source) : "no ticket") + "</td>" +
            "<td>" + flagsFor(L) + "</td></tr>";
        }).join("");
        return '<div class="sheetwrap"><table class="psheet"><thead><tr><th>Item</th><th>Price</th><th>Per</th><th>Supplier</th><th>Date</th><th>Ticket</th><th>Status</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
      }
      function supplierHtml() {
        var groups = {}, order = [];
        view.forEach(function (v) {
          var sup = v.e.supplier || "No supplier on file";
          if (!groups[sup]) { groups[sup] = []; order.push(sup); }
          groups[sup].push(v);
        });
        order.sort();
        return order.map(function (sup) {
          return '<div class="sup-head">' + esc(sup) + ' <span class="sup-count">' + groups[sup].length + (groups[sup].length === 1 ? " item" : " items") + "</span></div>" +
            groups[sup].map(listRowHtml).join("");
        }).join("");
      }

      box.className = state.view === "cards" ? "" : "v-" + state.view;
      if (state.view === "list") box.innerHTML = view.map(listRowHtml).join("");
      else if (state.view === "sheet") box.innerHTML = sheetHtml();
      else if (state.view === "supplier") box.innerHTML = supplierHtml();
      else box.innerHTML = view.map(cardHtml).join("");

      var byKeyMap = {};
      items.forEach(function (it) { byKeyMap[it.key] = it; });
      box.querySelectorAll("[data-key]").forEach(function (el) {
        function go() {
          var it = byKeyMap[el.getAttribute("data-key")];
          if (!it) return;
          openSheet(it, el.closest(".card") || el.closest(".lrow") || null);
        }
        el.addEventListener("click", go);
        if (el.tagName === "TR") el.addEventListener("keydown", function (ev) { if (ev.key === "Enter") go(); });
      });
    }
    paintCats();
    paintChips();
    paintViews();
    draw();

    // Cost per house: only from tracker lines that name a house (never guessed).
    var roll = document.getElementById("rollup");
    var houses = {};
    all.forEach(function (e) { if (e.house) houses[e.house] = true; });
    var names = Object.keys(houses).sort();
    if (!names.length) {
      roll.innerHTML = '<p class="empty">No per-house list yet. When the tracker lists how much of each item a house uses, the cost per house shows up here. Quantities are never guessed.</p>';
      return;
    }
    roll.innerHTML = names.map(function (h) {
      var perKey = {};
      all.forEach(function (e) {
        if (e.house !== h) return;
        var k = (COMBINED ? e.trade + "|" : "") + e.item.toLowerCase(), cur = perKey[k];
        var d = parseDate(e.date), cd = cur ? parseDate(cur.date) : null;
        if (!cur || (d && (!cd || d >= cd))) perKey[k] = e;
      });
      var elec = 0, hvac = 0, count = 0, stale = 0;
      Object.keys(perKey).forEach(function (k) {
        var e = perKey[k], v = Number(e.price);
        if (isFinite(v)) { if (e.trade === "hvac") hvac += v; else elec += v; }
        count++;
        if (isStale(e)) stale++;
      });
      var meta = count + " items at newest price" + (stale ? " · includes " + stale + " old price" + (stale === 1 ? "" : "s") : "");
      if (COMBINED) {
        return '<div class="roll-row"><span class="roll-name">' + esc(h) + ' <span class="item-meta">(' + meta + ')</span></span>' +
          '<span class="roll-nums"><span class="roll-sub navy-t">Elec ' + money(elec) + '</span>' +
          '<span class="roll-sub gold-t">HVAC ' + money(hvac) + '</span>' +
          '<span class="roll-total">' + money(elec + hvac) + "</span></span></div>";
      }
      return '<div class="roll-row"><span class="roll-name">' + esc(h) + ' <span class="item-meta">(' + meta + ')</span></span>' +
        '<span class="roll-total">' + money(MODE === "hvac" ? hvac : elec) + "</span></div>";
    }).join("");
  }
})();
