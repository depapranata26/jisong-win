/* Generate tabel referensi baked utk tab Peluang — node tools/gen-tables.js > tables-data.js */
var E = require('../engine.js');
var hands = E.allHands();

// distribusi nilai lawan (exact, semua 378 tangan)
var dist = [];
for (var v = 0; v <= 9; v++) {
  var hs = hands.filter(function (h) { return h.value === v; });
  dist.push(+(hs.length / hands.length).toFixed(4));
}

// satu tangan median per nilai (representatif)
var table = [];
for (var v2 = 0; v2 <= 9; v2++) {
  var list = hands.filter(function (h) { return h.value === v2; })
    .sort(function (a, b) { return a.eq - b.eq; });
  var med = list[Math.floor(list.length / 2)];
  var hu = E.headsUp(med.t1, med.t2);
  var row = {
    v: v2,
    hand: [med.t1, med.t2],
    huWin: +hu.win.toFixed(3), huTie: +hu.tie.toFixed(3),
    mc: {}
  };
  [3, 4, 6].forEach(function (n) {
    var s = E.simulate(med.t1, med.t2, n, 60000, 1000 + v2 * 10 + n);
    row.mc[n] = { win: +s.win.toFixed(3), tie: +s.tie.toFixed(3) };
  });
  table.push(row);
}
console.log('var JISONG_TABLES = ' + JSON.stringify({ dist: dist, table: table }) + ';');
console.error('OK — 10 nilai x (HU exact + MC 60k utk 3/4/6 pemain)');
