/* Generate tabel referensi baked utk tab Peluang — node tools/gen-tables.js > tables-data.js
 * Dua varian per nilai: tangan representatif TANPA balak & DENGAN balak,
 * karena tiebreaker balak mengubah win%. */
var E = require('../engine.js');
var hands = E.allHands();

// distribusi nilai lawan (exact, semua 378 tangan)
var dist = [];
for (var v = 0; v <= 9; v++) {
  var hs = hands.filter(function (h) { return h.value === v; });
  dist.push(+(hs.length / hands.length).toFixed(4));
}

// satu tangan median per (nilai, status balak)
function medianHand(v, wantBalak) {
  var list = hands.filter(function (h) {
    var b = E.balakRank(h.t1, h.t2) >= 0;
    return h.value === v && (wantBalak ? b : !b);
  }).sort(function (a, b) { return a.eq - b.eq; });
  if (!list.length) return null;
  return list[Math.floor(list.length / 2)];
}

function rowFor(v, wantBalak) {
  var med = medianHand(v, wantBalak);
  if (!med) return null;
  var hu = E.headsUp(med.t1, med.t2);
  var row = {
    v: v,
    hand: [med.t1, med.t2],
    huWin: +hu.win.toFixed(3), huTie: +hu.tie.toFixed(3),
    mc: {}
  };
  [3, 4, 6].forEach(function (n) {
    var s = E.simulate(med.t1, med.t2, n, 40000, 1000 + v * 10 + n + (wantBalak ? 500 : 0));
    row.mc[n] = { win: +s.win.toFixed(3), tie: +s.tie.toFixed(3) };
  });
  return row;
}

var out = { dist: dist, noBalak: [], balak: [] };
for (var v2 = 0; v2 <= 9; v2++) {
  out.noBalak.push(rowFor(v2, false));
  out.balak.push(rowFor(v2, true));
}
console.log('var JISONG_TABLES = ' + JSON.stringify(out) + ';');
console.error('OK — 10 nilai x 2 varian balak x (HU exact + MC 40k utk 3/4/6 pemain)');
