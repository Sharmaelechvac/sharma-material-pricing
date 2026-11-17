/* Sharma Material Pricing — one trade per page (window.PRICE_TRADE).
   Data comes only from prices.enc.json, decrypted in the browser by lock.js
   after the office code is entered. No prices are stored in this file. */
(function () {
  "use strict";
  var TRADE = window.PRICE_TRADE;
  var LABEL = window.PRICE_LABEL || TRADE;
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

  SharmaLock.load("../prices.enc.json", { appName: "Material Pricing — " + LABEL, logo: "../assets/logo.png" })
    .then(function (data) { render(data); })
    .catch(function (err) {
      document.getElementById("app").hidden = false;
      document.getElementById("items").innerHTML = '<p class="empty">Could not load pricing data: ' + esc(err.message) + "</p>";
    });

  function render(data) {
    var all = (data.entries || []).filter(function (e) { return e.trade === TRADE; });
    document.getElementById("app").hidden = false;
    document.getElementById("asof").textContent =
      "Tracker updated " + (data.meta && data.meta.generated ? data.meta.generated : "—") +
      " · " + all.length + " price entr" + (all.length === 1 ? "y" : "ies") + " on file for " + LABEL + ".";

    var suppliers = [];
    all.forEach(function (e) { if (e.supplier && suppliers.indexOf(e.supplier) === -1) suppliers.push(e.supplier); });
    suppliers.sort();
    var sel = document.getElementById("supplier");
    suppliers.forEach(function (s) {
      var o = document.createElement("option"); o.value = s; o.textContent = s; sel.appendChild(o);
    });

    // Group entries by item; latest = newest date, later tracker row wins ties.
    var byItem = {};
    all.forEach(function (e, idx) {
      var k = e.item.toLowerCase();
      if (!byItem[k]) byItem[k] = { name: e.item, rows: [] };
      byItem[k].rows.push({ e: e, idx: idx });
    });
    Object.keys(byItem).forEach(function (k) {
      byItem[k].rows.sort(function (a, b) {
        var da = parseDate(a.e.date), db = parseDate(b.e.date);
        var ta = da ? da.getTime() : 0, tb = db ? db.getTime() : 0;
        if (tb !== ta) return tb - ta;
        return b.idx - a.idx;
      });
      byItem[k].latest = byItem[k].rows[0].e;
    });
    var items = Object.keys(byItem).map(function (k) { return byItem[k]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });

    var q = document.getElementById("q"), staleOnly = document.getElementById("staleOnly");
    function draw() {
      var term = q.value.trim().toLowerCase(), sup = sel.value;
      var box = document.getElementById("items");
      var shown = items.filter(function (it) {
        var L = it.latest;
        if (term && it.name.toLowerCase().indexOf(term) === -1) return false;
        if (sup && L.supplier !== sup && !it.rows.some(function (r) { return r.e.supplier === sup; })) return false;
        if (staleOnly.checked && !isStale(L)) return false;
        return true;
      });
      if (!all.length) {
        box.innerHTML = '<p class="empty">No prices in the tracker yet for ' + esc(LABEL) + ". Prices appear here as supplier tickets are added to the tracker.</p>";
        return;
      }
      if (!shown.length) { box.innerHTML = '<p class="empty">No items match the current search and filters.</p>'; return; }
      box.innerHTML = shown.map(function (it, n) {
        var L = it.latest, a = ageDays(L), stale = isStale(L);
        var hist = it.rows.map(function (r, i) {
          var e = r.e, prev = it.rows[i + 1];
          var delta = "";
          if (prev && isFinite(Number(e.price)) && isFinite(Number(prev.e.price))) {
            var diff = Number(e.price) - Number(prev.e.price);
            if (diff > 0) delta = '<span class="delta-up">+' + money(diff).slice(0) + "</span>";
            else if (diff < 0) delta = '<span class="delta-down">&minus;' + money(-diff) + "</span>";
            else delta = "no change";
          }
          return "<tr><td class='num'>" + esc(e.date) + "</td><td class='num'>" + money(e.price) +
            (e.unit ? " / " + esc(e.unit) : "") + "</td><td>" + esc(e.supplier) + "</td><td>" +
            esc(e.source || "") + "</td><td>" + delta + "</td></tr>";
        }).join("");
        return '<div class="item"><button class="item-head" data-i="' + n + '" aria-expanded="false">' +
          '<span class="item-name">' + esc(it.name) + "</span>" +
          '<span class="item-price">' + money(L.price) + (L.unit ? " / " + esc(L.unit) : "") + "</span>" +
          '<span class="item-meta">' + esc(L.supplier) + " · " + esc(L.date) +
          (a !== null ? " · " + a + "d old" : "") + (L.source ? " · " + esc(L.source) : "") + "</span>" +
          (stale ? '<span class="tag stale">Stale</span>' : "") +
          (it.rows.length > 1 ? '<span class="tag">History ' + it.rows.length + "</span>" : "") +
          '</button><div class="history" hidden><table><thead><tr><th>Date</th><th>Price</th><th>Supplier</th><th>Source ticket</th><th>Change</th></tr></thead><tbody>' +
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

    // Per-house rollup: latest price per item, summed for the houses named on tracker lines.
    var roll = document.getElementById("rollup");
    var houses = {};
    all.forEach(function (e) { if (e.house) houses[e.house] = true; });
    var names = Object.keys(houses).sort();
    if (!names.length) {
      roll.innerHTML = '<p class="empty">No house is named on the ' + esc(LABEL) +
        ' tracker lines yet. When a tracker line carries a house or job name, its rollup appears here — latest price per item, summed for that house.</p>';
      return;
    }
    roll.innerHTML = names.map(function (h) {
      var perItem = {};
      all.forEach(function (e) {
        if (e.house !== h) return;
        var k = e.item.toLowerCase(), cur = perItem[k];
        var d = parseDate(e.date), cd = cur ? parseDate(cur.date) : null;
        if (!cur || (d && (!cd || d >= cd))) perItem[k] = e;
      });
      var total = 0, count = 0;
      Object.keys(perItem).forEach(function (k) { var v = Number(perItem[k].price); if (isFinite(v)) { total += v; count++; } });
      return '<div class="roll-row"><span class="roll-name">' + esc(h) + ' <span class="item-meta">(' + count + ' items at latest price)</span></span>' +
        '<span class="roll-total">' + money(total) + "</span></div>";
    }).join("");
  }
})();
