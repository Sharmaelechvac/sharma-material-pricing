/* Sharma Material Pricing — one app, three links.
   /electrical and /hvac each load only their own trade's rows.
   /combined (Sanjay's section-12 addition) shows both trades with ELEC/HVAC
   tags, trade subtotals and the only trade filter in the app.
   Data comes only from prices.enc.json, decrypted in the browser by lock.js
   after the office code is entered. No prices are stored in this file. */
(function () {
  "use strict";
  var MODE = window.PRICE_TRADE; // electrical | hvac | combined
  var LABEL = window.PRICE_LABEL || MODE;
  var COMBINED = MODE === "combined";
  var STALE_DAYS = 45;   // Mark guidance section 10: stale = 45 days old (one constant; Sanjay can change)
  var CHANGED_DAYS = 30; // "Changed 30d" chip window

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return esc(n);
    var d = Math.abs(v) >= 100 ? 2 : 4; // keep per-foot precision from the tracker
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
    // The tracker status text already carries the kind of price this is.
    if (/WEB/i.test(e.status || "")) return "web";
    if (/SANJAY/i.test((e.status || "") + " " + (e.supplier || ""))) return "sanjay";
    return "ticket";
  }
  function flagsFor(e) {
    var out = "";
    var t = priceType(e);
    if (t === "web") out += '<span class="tag web">WEB LIST</span>';
    else if (t === "sanjay") out += '<span class="tag rule">SANJAY RULE</span>';
    else out += '<span class="tag ticket">TICKET</span>';
    if (isStale(e)) {
      var a = ageDays(e);
      out += '<span class="tag stale">STALE' + (a !== null ? " · " + a + " days" : "") + "</span>";
    } else {
      var a2 = ageDays(e);
      if (a2 !== null && a2 > 30 && a2 <= STALE_DAYS) out += '<span class="tag aging">AGING · ' + a2 + " days</span>";
    }
    if (!e.source) out += '<span class="tag nosrc">no source</span>';
    if (!e.date) out += '<span class="tag nosrc">no date</span>';
    return out;
  }

  SharmaLock.load("../prices.enc.json", { appName: "Material Pricing — " + LABEL, logo: "../assets/logo.png" })
    .then(function (data) { render(data); })
    .catch(function (err) {
      document.getElementById("app").hidden = false;
      document.getElementById("items").innerHTML = '<p class="empty">Could not load pricing data: ' + esc(err.message) + "</p>";
    });

  function render(data) {
    var entries = data.entries || [];
    var all = COMBINED ? entries.slice() : entries.filter(function (e) { return e.trade === MODE; });
    document.getElementById("app").hidden = false;

    // Group rows by item (per trade on the combined page); latest = newest date, later row wins ties.
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
      // Headline rule (Sanjay, 2026-11-17): the headline price is the newest
      // TICKET / Sanjay-rule price; web list prices headline only when an item
      // has no ticket price at all. Full history (incl. web) stays in the sheet.
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
      return it;
    });

    function staleItems(list) { return list.filter(function (it) { return isStale(it.latest); }); }
    function changeTextOf(ch) {
      if (!ch || ch.diff === 0) return "";
      var s = ch.diff > 0 ? "+" : "&minus;";
      return s + money(Math.abs(ch.diff)) + " (" + (ch.pct > 0 ? "+" : "") + ch.pct + "%)";
    }

    // Numbers-first stat strip (guidance section 3; combined per section 12).
    var stats = document.getElementById("stats");
    if (COMBINED) {
      var ei = items.filter(function (i) { return i.trade === "electrical"; });
      var hi = items.filter(function (i) { return i.trade === "hvac"; });
      var se = staleItems(ei).length, sh = staleItems(hi).length;
      stats.innerHTML =
        '<div class="stat navy"><span class="stat-num">' + ei.length + '</span><span class="stat-lab">Electrical items priced</span></div>' +
        '<div class="stat gold"><span class="stat-num">' + hi.length + '</span><span class="stat-lab">HVAC items priced</span></div>' +
        '<div class="stat"><span class="stat-num">' + items.length + '</span><span class="stat-lab">All items priced</span></div>' +
        '<button type="button" class="stat stale-tile' + (se + sh > 0 ? " hot" : "") + '" id="staleTile"><span class="stat-num">' + (se + sh) + '</span><span class="stat-lab">Stale — Elec ' + se + " · HVAC " + sh + "</span></button>";
    } else {
      var sc = staleItems(items).length;
      stats.innerHTML =
        '<div class="stat"><span class="stat-num">' + items.length + '</span><span class="stat-lab">Items priced</span></div>' +
        '<div class="stat"><span class="stat-num">' + all.length + '</span><span class="stat-lab">Distributor prices on file</span></div>' +
        '<button type="button" class="stat stale-tile' + (sc > 0 ? " hot" : "") + '" id="staleTile"><span class="stat-num">' + sc + '</span><span class="stat-lab">Items stale</span></button>';
    }

    var newest = "";
    items.forEach(function (it) { if (it.latest.date && it.latest.date > newest) newest = it.latest.date; });
    document.getElementById("asof").textContent =
      (newest ? "Prices as of " + fmtDate(newest) : "No dated prices on file") +
      " · " + all.length + " distributor prices on file" + (COMBINED ? " across both trades." : " for " + LABEL + ".");

    // Filter state + chips (guidance section 4).
    var state = { q: "", supplier: "", stale: false, changed: false, movers: false, trade: "all", sort: "name" };
    var lastView = [];
    var suppliers = [];
    all.forEach(function (e) { if (e.supplier && suppliers.indexOf(e.supplier) === -1) suppliers.push(e.supplier); });
    suppliers.sort();
    var chips = document.getElementById("chips");
    function chip(label, kind, val) {
      return '<button type="button" class="chip" data-kind="' + kind + '" data-val="' + esc(val) + '">' + esc(label) + "</button>";
    }
    chips.innerHTML = chip("All suppliers", "supplier", "") +
      suppliers.map(function (s) { return chip(s, "supplier", s); }).join("") +
      chip("Stale only", "stale", "") + chip("Changed 30d", "changed", "") + chip("Movers >5%", "movers", "");
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
    // Re-quote worklist (audit F4): stale items, oldest first, copyable for Warren.
    var reqRow = document.createElement("div");
    reqRow.className = "req-row";
    reqRow.innerHTML = '<button type="button" class="chip" id="reqBtn">Re-quote list</button>' +
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
      var lines = ["Item\tPrice\tUnit\tSupplier\tDate\tSource ticket"];
      lastView.forEach(function (v) {
        lines.push([v.it.name, Number(v.e.price), v.e.unit || "", v.e.supplier || "", v.e.date || "no date", v.e.source || "no source"].join("\t"));
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
        '<polyline points="' + line + '" fill="none" stroke="#F0A846" stroke-width="2"/>' +
        '<text x="' + P + '" y="11" class="chart-lab">' + money(hiP) + "</text>" +
        '<text x="' + P + '" y="' + (H - 20) + '" class="chart-lab">' + money(loP) + "</text>" +
        '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4.5" fill="#ffffff" stroke="#F0A846" stroke-width="1.5"/>' +
        '<text x="' + P + '" y="' + (H - 4) + '" class="chart-lab">' + esc(pts[0].date) + "</text>" +
        '<text x="' + (W - P) + '" y="' + (H - 4) + '" text-anchor="end" class="chart-lab">' + esc(pts[pts.length - 1].date) + "</text></svg>";
    }
    function openSheet(it, anchor) {
      if (openKey === it.key) { sheet.hidden = true; openKey = null; return; }
      openKey = it.key;
      var bySup = {};
      it.rows.forEach(function (r) { if (!bySup[r.e.supplier]) bySup[r.e.supplier] = r.e; });
      var supNames = Object.keys(bySup);
      var supNote = "";
      if (supNames.length > 1) {
        supNote = '<p class="sup-note">Latest by supplier: ' + supNames.map(function (s) {
          return esc(s) + " " + money(bySup[s].price) + (bySup[s].date ? " (" + esc(bySup[s].date) + ")" : "");
        }).join(" · ") + "</p>";
      }
      var rows = it.rows.map(function (r) {
        var e = r.e;
        return "<tr><td class='num'>" + (e.date ? esc(e.date) : "no date") + "</td><td class='num'>" + money(e.price) +
          (e.unit ? " / " + esc(e.unit) : "") + "</td><td>" + esc(e.supplier) + "</td><td>" + (e.source ? esc(e.source) : "no source") + "<br>" + flagsFor(e) + "</td></tr>";
      }).join("");
      sheet.innerHTML = '<div class="sheet-head"><span class="sheet-title">Price history — ' + esc(it.name) + "</span>" +
        (COMBINED ? tradeTag(it.trade) : "") +
        '<button type="button" class="sheet-close" aria-label="Close history">Close</button></div>' +
        chartSVG(it) + supNote +
        '<table class="hist"><thead><tr><th>Date</th><th>Price</th><th>Supplier</th><th>Source ticket</th></tr></thead><tbody>' + rows + "</tbody></table>";
      sheet.hidden = false;
      sheet.querySelector(".sheet-close").addEventListener("click", function () { sheet.hidden = true; openKey = null; });
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sheet, anchor.nextSibling);
    }

    function draw() {
      var shown = items.filter(function (it) {
        var L = it.latest;
        if (COMBINED && state.trade !== "all" && it.trade !== state.trade) return false;
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
      // Displayed entry: normally the global latest; under a supplier filter,
      // that supplier's own latest price (audit F5 — never show another
      // supplier's price under a supplier filter).
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
      else view.sort(function (a, b) { return a.it.name.localeCompare(b.it.name); });

      var box = document.getElementById("items");
      var tw = document.getElementById("tablewrap");
      sheet.hidden = true; openKey = null;
      if (!all.length) {
        box.innerHTML = '<p class="empty">No prices in the tracker yet' + (COMBINED ? "" : " for " + esc(LABEL)) + ". Prices appear here as supplier tickets are added to the tracker.</p>";
        tw.innerHTML = "";
        return;
      }
      if (!shown.length) { box.innerHTML = '<p class="empty">No items match</p>'; tw.innerHTML = ""; return; }

      box.innerHTML = view.map(function (v) {
        var it = v.it, L = v.e, ch = changeTextOf(v.ch);
        return '<div class="item t-' + it.trade + '"><button class="item-head" data-key="' + esc(it.key) + '">' +
          '<span class="item-line1"><span class="item-name">' + esc(it.name) + "</span>" +
          '<span class="item-price">' + money(L.price) + "</span></span>" +
          '<span class="item-line2">' + esc(L.unit || "") + (L.unit ? " · " : "") + esc(L.supplier) +
          (L.date ? " · " + esc(L.date) : "") + (ch ? ' · <span class="chg">' + ch + "</span>" : "") + "</span>" +
          '<span class="item-line3">' + (COMBINED ? tradeTag(it.trade) : "") + flagsFor(L) +
          (L.source ? '<span class="src-chip">' + esc(L.source) + "</span>" : "") +
          (it.rows.length > 1 ? '<span class="tag">History ' + it.rows.length + "</span>" : "") + "</span>" +
          "</button></div>";
      }).join("");

      tw.innerHTML = '<table class="ptable"><thead><tr><th>Item</th><th class="num">Latest price</th><th>Unit</th><th>Supplier</th><th class="num">Date</th><th class="num">Change</th><th>Source</th><th>Flags</th></tr></thead><tbody>' +
        view.map(function (v) {
          var it = v.it, L = v.e;
          return '<tr data-key="' + esc(it.key) + '"><td>' + esc(it.name) + (COMBINED ? " " + tradeTag(it.trade) : "") + "</td>" +
            '<td class="num price-cell">' + money(L.price) + "</td><td>" + esc(L.unit || "") + "</td><td>" + esc(L.supplier) + "</td>" +
            '<td class="num">' + (L.date ? esc(L.date) : "no date") + "</td>" +
            '<td class="num">' + (changeTextOf(v.ch) || "—") + "</td>" +
            "<td>" + (L.source ? esc(L.source) : "no source") + "</td><td>" + flagsFor(L) + "</td></tr>";
        }).join("") + "</tbody></table>";

      var byKeyMap = {};
      items.forEach(function (it) { byKeyMap[it.key] = it; });
      box.querySelectorAll(".item-head").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var it = byKeyMap[btn.getAttribute("data-key")];
          openSheet(it, btn.closest(".item"));
        });
      });
      tw.querySelectorAll("tr[data-key]").forEach(function (tr) {
        tr.addEventListener("click", function () {
          var it = byKeyMap[tr.getAttribute("data-key")];
          openSheet(it, tw);
        });
      });
    }
    paintChips();
    draw();

    // Per-house rollup (guidance section 7): only from tracker lines that name a house.
    var roll = document.getElementById("rollup");
    var houses = {};
    all.forEach(function (e) { if (e.house) houses[e.house] = true; });
    var names = Object.keys(houses).sort();
    if (!names.length) {
      roll.innerHTML = '<p class="empty">The price tracker carries no per-house quantity data yet, so no per-house rollup can be built. When tracker lines name a house, its rollup appears here at latest prices with its stale-price count. Quantities are never estimated.</p>';
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
      var meta = count + " items at latest price" + (stale ? " · includes " + stale + " stale price" + (stale === 1 ? "" : "s") : "");
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
