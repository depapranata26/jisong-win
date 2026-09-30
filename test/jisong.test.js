/* Test engine Jisong Win Logic — jalankan: node test/jisong.test.js */
var E = require('../engine.js');
var pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL: ' + name + (extra ? ' | ' + extra : '')); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

// 1. Deck
ok(E.TILES.length === 28, 'deck 28 kartu');
ok(E.TILES.every(function (t) { return t[0] <= t[1] && t[1] <= 6; }), 'semua kartu valid');
var keys = E.TILES.map(E.key);
ok(new Set(keys).size === 28, 'tidak ada kartu kembar');

// 2. handValue — kasus manual
ok(E.handValue([6, 6], [6, 6]) === 4, '24 -> 4', E.handValue([6, 6], [6, 6]));
ok(E.handValue([0, 0], [0, 0]) === 0, '0 -> 0');
ok(E.handValue([6, 6], [6, 1]) === 9, '19 -> 9 (Qiu)');
ok(E.handValue([6, 5], [6, 4]) === 1, '21 -> 1');
ok(E.handValue([3, 3], [2, 4]) === 2, '12 -> 2');
ok(E.handValue([5, 5], [4, 6]) === 0, '20 -> 0');

// 3. headsUp exact
var hu9 = E.headsUp([6, 6], [6, 1]); // nilai 9
ok(hu9.total === 325, 'headsUp enumerasi 325');
ok(hu9.value === 9, 'nilai terdeteksi 9');
ok(approx(hu9.win + hu9.tie + hu9.lose, 1, 1e-9), 'probabilitas genap 1');
ok(hu9.win > 0.85 && hu9.win < 0.95, 'win% Qiu heads-up masuk akal', hu9.win.toFixed(3));
var hu0 = E.headsUp([0, 0], [0, 1]); // nilai 1
ok(hu0.win < 0.15, 'kartu lemah win% kecil', hu0.win.toFixed(3));

// 4. allHands: 378 kombinasi
var hands = E.allHands();
ok(hands.length === 378, 'C(28,2)=378 kombinasi');
var dist = {};
hands.forEach(function (h) { dist[h.value] = (dist[h.value] || 0) + 1; });
var tot = Object.keys(dist).reduce(function (s, k) { return s + dist[k]; }, 0);
ok(tot === 378, 'distribusi genap 378');
console.log('  distribusi nilai: ' + [0,1,2,3,4,5,6,7,8,9].map(function(k){return k+':'+dist[k];}).join(' '));
// rata-rata win% heads-up per nilai — harus naik monoton
var avgWin = [];
for (var v = 0; v <= 9; v++) {
  var hs = hands.filter(function (h) { return h.value === v; });
  var avg = hs.reduce(function (s, h) { return s + h.win; }, 0) / hs.length;
  avgWin.push(avg);
}
var mono = true;
for (var v = 1; v <= 9; v++) if (avgWin[v] < avgWin[v - 1] - 0.02) mono = false;
ok(mono, 'win% naik seiring nilai', avgWin.map(function(x){return x.toFixed(2);}).join(','));

// 5. simulate: deterministik & konsisten dgn headsUp utk 2 pemain
var s1 = E.simulate([6, 6], [6, 1], 2, 20000, 42);
var s2 = E.simulate([6, 6], [6, 1], 2, 20000, 42);
ok(s1.win === s2.win && s1.tie === s2.tie, 'simulasi deterministik dgn seed sama');
ok(approx(s1.win, hu9.win, 0.02), 'MC(2p) ≈ exact', s1.win.toFixed(3) + ' vs ' + hu9.win.toFixed(3));
var s4 = E.simulate([6, 6], [6, 1], 4, 20000, 42);
ok(approx(s4.win + s4.tie + s4.lose, 1, 1e-9), 'MC 4p genap 1');
ok(s4.win < hu9.win, 'makin banyak lawan makin kecil win%', s4.win.toFixed(3));
var s8 = E.simulate([0, 0], [0, 1], 8, 20000, 7);
ok(s8.win < 0.05, 'kartu sampah vs 7 lawan hampir pasti kalah', s8.win.toFixed(3));

// 6. recommend
ok(E.recommend(0.75) === 'NAIKKAN', 'eq tinggi -> NAIKKAN');
ok(E.recommend(0.45) === 'IKUT', 'eq sedang -> IKUT');
ok(E.recommend(0.10) === 'LIPAT', 'eq rendah -> LIPAT');
ok(E.recommend(0.60) === 'NAIKKAN', 'batas 0.60');
ok(E.recommend(0.30) === 'IKUT', 'batas 0.30');

// 7. reasoning & label
for (var v2 = 0; v2 <= 9; v2++) {
  var r = E.reasoning(v2, 0.5, 4);
  ok(typeof r === 'string' && r.length > 20, 'reasoning nilai ' + v2);
}
ok(E.VALUE_LABEL[9] === '9 (Qiu!)', 'label Qiu');

console.log('\n' + pass + ' lolos, ' + fail + ' gagal');
process.exit(fail ? 1 : 0);
