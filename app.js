/* Sharma Material Pricing — one app, three links.
   /electrical and /hvac are single-trade. /combined shows both trades with
   ELEC/HVAC tags, trade subtotals, and the only trade filter in the app.
   Data comes only from prices.enc.json, decrypted in the browser by lock.js
   after the office code is entered. No prices are stored in this file. */
(function () {
  "use strict";
  var MODE = window.PRICE_TRADE; // electrical | hvac | combined
  var LABEL = window.PRICE_LABEL || MODE;
  var COMBINED = MODE === "combined";
  var STALE_DAYS = 30;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return esc(n);
    return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function parseDate(s) {
    var d = new Date(String(s || "") + "T12:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  function ageDays(e) {
    var d = parseDate(e.date);
    if (!d) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }
  function isStale(e) { var a = ageDays(e); return a !== null && a > STALE_DAYS; }
  function tradeTag(t) {
    return t === "hvac" ? '<span class="tag hvac">HVAC</span>' : '<span class="tag elec">Elec</span>';
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

    // Group by item (per trade on the combined page); latest = newest date, later row wins ties.
    var byKey = {};
    all.forEach(function (e, idx) {
      var k = (COMBINED ? e.trade + "|" : "") + e.item.toLowerCase();
      if (!byKey[k]) byKey[k] = { name: e.item, trade: e.trade, rows: [] };
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
      it.latest = it.rows[0].e;
      return it;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });

    function latestSum(list) {
      var t = 0;
      list.forEach(function (it) { var v = Number(it.latest.price); if (isFinite(v)) t += v; });
      return t;
    }
    function staleCount(list) { return list.filter(function (it) { return isStale(it.latest); }).length; }

    // Numbers-first stat strip.
    var stats = document.getElementById("stats");
    if (COMBINED) {
      var ei = items.filter(function (i) { return i.trade === "electrical"; });
      var hi = items.filter(function (i) { return i.trade === "hvac"; });
      stats.innerHTML =
        '<div class="stat navy"><span class="stat-num">' + money(latestSum(ei)) + '</span><span class="stat-lab">Electrical — latest prices</span></div>' +
        '<div class="stat gold"><span class="stat-num">' + money(latestSum(hi)) + '</span><span class="stat-lab">HVAC — latest prices</span></div>' +
        '<div class="stat"><span class="stat-num">' + money(latestSum(items)) + '</span><span class="stat-lab">Combined</span></div>' +
        '<div class="stat"><span class="stat-num">' + staleCount(items) + '</span><span class="stat-lab">Stale prices</span></div>';
    } else {
      var sups = {};
      all.forEach(function (e) { if (e.supplier) sups[e.supplier] = true; });
      stats.innerHTML =
        '<div class="stat"><span class="stat-num">' + items.length + '</span><span class="stat-lab">Items tracked</span></div>' +
        '<div class="stat"><span class="stat-num">' + money(latestSum(items)) + '</span><span class="stat-lab">Latest prices total</span></div>' +
        '<div class="stat"><span class="stat-num">' + staleCount(items) + '</span><span class="stat-lab">Stale prices</span></div>' +
        '<div class="stat"><span class="stat-num">' + Object.keys(sups).length + '</span><span class="stat-lab">Suppliers</span></div>';
    }

    document.getElementById("asof").textContent =
      "Tracker updated " + (data.meta && data.meta.generated ? data.meta.generated : "—") +
      " · " + all.length + " price entr" + (all.length === 1 ? "y" : "ies") + " on file" +
      (COMBINED ? " across both trades." : " for " + LABEL + ".");

    var suppliers = [];
    all.forEach(function (e) { if (e.supplier && suppliers.indexOf(e.supplier) === -1) suppliers.push(e.supplier); });
    suppliers.sort();
    var sel = document.getElementById("supplier");
    suppliers.forEach(function (s) {
      var o = document.createElement("option"); o.value = s; o.textContent = s; sel.appendChild(o);
    });

    var q = document.getElementById("q"), staleOnly = document.getElementById("staleOnly");
    var tradeFilter = "all";
    if (COMBINED) {
      document.querySelectorAll(".seg-btn").forEach(function (b) {
        b.addEventListener("click", function () {
          document.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          tradeFilter = b.getAttribute("data-t");
          draw();
        });
      });
    }

    function draw() {
      var term = q.value.trim().toLowerCase(), sup = sel.value;
      var box = document.getElementById("items");
      var shown = items.filter(function (it) {
        var L = it.latest;
        if (COMBINED && tradeFilter !== "all" && it.trade !== tradeFilter) return false;
        if (term && it.name.toLowerCase().indexOf(term) === -1) return false;
        if (sup && L.supplier !== sup && !it.rows.some(function (r) { return r.e.supplier === sup; })) return false;
        if (staleOnly.checked && !isStale(L)) return false;
        return true;
      });
      if (!all.length) {
        box.innerHTML = '<p class="empty">No prices in the tracker yet' + (COMBINED ? "" : " for " + esc(LABEL)) +
          ". Prices appear here as supplier tickets are added to the tracker.</p>";
        return;
      }
      if (!shown.length) { box.innerHTML = '<p class="empty">No items match the current search and filters.</p>'; return; }
      box.innerHTML = shown.map(function (it) {
        var L = it.latest, a = ageDays(L), stale = isStale(L);
        var hist = it.rows.map(function (r, i) {
          var e = r.e, prev = it.rows[i + 1];
          var delta = "";
          if (prev && isFinite(Number(e.price)) && isFinite(Number(prev.e.price))) {
            var diff = Number(e.price) - Number(prev.e.price);
            if (diff > 0) delta = '<span class="delta-up">+' + money(diff) + "</span>";
            else if (diff < 0) delta = '<span class="delta-down">&minus;' + money(-diff) + "</span>";
            else delta = "no change";
          }
          return "<tr><td class='num'>" + esc(e.date) + "</td><td class='num'>" + money(e.price) +
            (e.unit ? " / " + esc(e.unit) : "") + "</td><td>" + esc(e.supplier) + "</td><td>" +
            esc(e.source || "") + "</td><td>" + delta + "</td></tr>";
        }).join("");
        return '<div class="item"><button class="item-head" aria-expanded="false">' +
          '<span class="item-name">' + esc(it.name) + "</span>" +
          (COMBINED ? tradeTag(it.trade) : "") +
          '<span class="item-price">' + money(L.price) + (L.unit ? " / " + esc(L.unit) : "") + "</span>" +
          '<span class="item-meta">' + esc(L.supplier) + " · " + esc(L.date) +
          (a !== null ? " · " + a + "d old" : "") + (L.source ? " · " + esc(L.source) : "") + "</span>" +
          (stale ? '<span class="tag stale">Stale</span>' : "") +
          (it.rows.length > 1 ? '<span class="tag">History ' + it.rows.length + "</span>" : "") +
          '</button><div class="history" hidden><div class="sheet-lab">Price history — ' + esc(it.name) + '</div><table><thead><tr><th>Date</th><th>Price</th><th>Supplier</th><th>Source ticket</th><th>Change</th></tr></thead><tbody>' +
          hist + "</tbody></table></div></div>";
      }).join("");
      box.querySelectorAll(".item-head").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var h = btn.parentElement.querySelector(".history");
          var open = h.hidden;
          h.hidden = !open;
          btn.setAttribute("aria-expanded", String(open));
        });
      });
    }
    q.addEventListener("input", draw);
    sel.addEventListener("change", draw);
    staleOnly.addEventListener("change", draw);
    draw();

    // Per-house rollup: latest price per item for the houses named on tracker lines.
    var roll = document.getElementById("rollup");
    var houses = {};
    all.forEach(function (e) { if (e.house) houses[e.house] = true; });
    var names = Object.keys(houses).sort();
    if (!names.length) {
      roll.innerHTML = '<p class="empty">No house is named on the tracker lines yet. When a tracker line carries a house or job name, its rollup appears here — latest price per item, summed for that house, with its stale-price count.</p>';
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
      var meta = count + " items at latest price" + (stale ? " · " + stale + " stale" : "");
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
