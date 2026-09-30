/* Jisong Win Logic — UI */
(function () {
  'use strict';
  var E = window.JisongEngine;
  var $ = function (id) { return document.getElementById(id); };

  // ---- navigasi tab ----
  var navBtns = document.querySelectorAll('nav button');
  navBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      navBtns.forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('on'); });
      $(b.dataset.t).classList.add('on');
      if (b.dataset.t === 't-hist') renderHist();
    });
  });

  // ---- render kartu domino ----
  var PIP = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function halfHTML(v) {
    var c = '';
    for (var i = 0; i < 9; i++) c += '<i class="' + (PIP[v].indexOf(i) >= 0 ? 'p' : '') + '"></i>';
    return '<div class="half">' + c + '</div>';
  }
  function tileHTML(t, big) {
    return '<div class="tile' + (big ? ' big' : '') + '">' + halfHTML(t[0]) +
      '<div class="divi"></div>' + halfHTML(t[1]) + '</div>';
  }

  var sel = [];       // kartu terpilih (maks 2)
  var players = 4;

  var picker = $('picker');
  E.TILES.forEach(function (t) {
    var d = document.createElement('div');
    d.innerHTML = tileHTML(t);
    var el = d.firstChild;
    el.dataset.k = t[0] + '-' + t[1];
    el.addEventListener('click', function () {
      var k = el.dataset.k;
      var idx = sel.indexOf(k);
      if (idx >= 0) { sel.splice(idx, 1); el.classList.remove('sel'); }
      else {
        if (sel.length >= 2) {
          var old = picker.querySelector('[data-k="' + sel[0] + '"]');
          if (old) old.classList.remove('sel');
          sel.shift();
        }
        sel.push(k); el.classList.add('sel');
      }
      analyze();
    });
    picker.appendChild(el);
  });

  function parseK(k) { var p = k.split('-'); return [+p[0], +p[1]]; }

  $('b-rand').addEventListener('click', function () {
    picker.querySelectorAll('.tile.sel').forEach(function (e) { e.classList.remove('sel'); });
    sel = [];
    var pool = E.TILES.slice(), out = [];
    for (var i = 0; i < 2; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    out.forEach(function (t) {
      var k = t[0] + '-' + t[1];
      sel.push(k);
      var el = picker.querySelector('[data-k="' + k + '"]');
      if (el) el.classList.add('sel');
    });
    analyze();
  });
  $('b-clr').addEventListener('click', function () {
    picker.querySelectorAll('.tile.sel').forEach(function (e) { e.classList.remove('sel'); });
    sel = []; analyze();
  });

  // ---- stepper pemain ----
  function setP(n) { players = Math.min(8, Math.max(2, n)); $('p-num').textContent = players; analyze(); }
  $('p-min').addEventListener('click', function () { setP(players - 1); });
  $('p-plus').addEventListener('click', function () { setP(players + 1); });

  // ---- analisa ----
  var lastVal = null;
  function analyze() {
    var res = $('result');
    if (sel.length < 2) { res.classList.add('hidden'); return; }
    res.classList.remove('hidden');
    var t1 = parseK(sel[0]), t2 = parseK(sel[1]);
    var r = players === 2
      ? E.headsUp(t1, t2)
      : E.simulate(t1, t2, players, 25000,
          ((E.tileIndex(t1) * 31 + E.tileIndex(t2) * 17 + players * 101) >>> 0));
    var eq = E.equity(r), rec = E.recommend(eq);
    lastVal = r.value;

    $('r-tiles').innerHTML = tileHTML(t1, true) + tileHTML(t2, true);
    var vn = $('r-val');
    vn.textContent = r.value;
    vn.style.color = r.value >= 8 ? '#4ade80' : (r.value >= 6 ? '#fbbf24' : '#f87171');
    var tot = E.pips(t1) + E.pips(t2);
    $('r-lbl').innerHTML = tot + ' bulatan → <b>' + (r.value === 9 ? 'Qiu!' : 'nilai ' + r.value) + '</b>';

    function bar(t, p, c) {
      return '<div class="barrow"><div class="t">' + t + '</div><div class="bar"><span style="width:' +
        Math.round(p * 100) + '%;background:' + c + '"></span></div><div class="pc">' +
        Math.round(p * 100) + '%</div></div>';
    }
    $('r-bars').innerHTML =
      bar('Menang', r.win, '#2fa84f') + bar('Seri', r.tie, '#c9a227') + bar('Kalah', r.lose, '#e05252');

    var rc = $('r-rec');
    rc.className = 'rec ' + (rec === 'NAIKKAN' ? 'up' : rec === 'IKUT' ? 'mid' : 'down');
    rc.querySelector('.r').textContent = rec === 'NAIKKAN' ? '🟢 NAIKKAN' : rec === 'IKUT' ? '🟡 IKUT' : '🔴 LIPAT';
    rc.querySelector('.why').textContent = E.reasoning(r.value, eq, players);
    res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- riwayat (localStorage) ----
  var HKEY = 'jisong_hist_v1';
  function loadH() { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } }
  function saveH(h) { try { localStorage.setItem(HKEY, JSON.stringify(h.slice(-200))); } catch (e) {} }
  function logRes(w) {
    if (lastVal === null) return;
    var h = loadH(); h.push({ v: lastVal, r: w ? 'W' : 'L' }); saveH(h);
    renderHist();
  }
  $('log-w').addEventListener('click', function () { logRes(true); });
  $('log-l').addEventListener('click', function () { logRes(false); });
  $('h-reset').addEventListener('click', function () {
    if (confirm('Hapus semua riwayat?')) { saveH([]); renderHist(); }
  });
  function renderHist() {
    var h = loadH(), w = h.filter(function (x) { return x.r === 'W'; }).length;
    $('h-tot').textContent = h.length;
    $('h-wr').textContent = h.length ? Math.round(w / h.length * 100) + '%' : '–';
    $('h-wr').style.color = h.length ? (w / h.length >= 0.5 ? '#4ade80' : '#f87171') : '';
    var st = 0;
    for (var i = h.length - 1; i >= 0; i--) { if (h[i].r === 'W') st++; else break; }
    $('h-streak').textContent = st + '🔥';
    $('h-dots').innerHTML = h.slice(-24).map(function (x) {
      return '<i class="' + x.r + '" title="Nilai ' + x.v + '">' + x.v + '</i>';
    }).join('');
  }

  // ---- tab Peluang (dari tabel baked) ----
  (function () {
    var T = window.JISONG_TABLES;
    // distribusi
    $('dist').innerHTML = T.dist.map(function (p, v) {
      return '<div class="col"><div class="b" style="height:' + Math.round(p * 100 * 8) + '%"></div>' +
        '<div class="x">' + v + '</div></div>';
    }).join('');
    // tabel win%
    function cls(p) { return p >= 0.6 ? 'hi' : p >= 0.3 ? 'md2' : 'lo'; }
    $('odds-tbody').innerHTML = T.table.map(function (row) {
      function c(p) { return '<span class="' + cls(p) + '">' + Math.round(p * 100) + '%</span>'; }
      return '<tr><td>' + (row.v === 9 ? '9 🎯' : row.v) + '</td><td>' + c(row.huWin) +
        '</td><td>' + c(row.mc[3].win) + '</td><td>' + c(row.mc[4].win) + '</td><td>' + c(row.mc[6].win) + '</td></tr>';
    }).join('');
  })();

  renderHist();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
