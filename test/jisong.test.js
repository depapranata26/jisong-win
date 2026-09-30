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
var hu9 = E.headsUp([6, 6], [6, 1]); // nilai 9 + balak 6
ok(hu9.total === 325, 'headsUp enumerasi 325');
ok(hu9.value === 9, 'nilai terdeteksi 9');
ok(E.balakRank([6, 6], [6, 1]) === 6, 'balakRank terdeteksi 6');
ok(approx(hu9.win + hu9.tie + hu9.lose, 1, 1e-9), 'probabilitas genap 1');
// Qiu + balak 6 tidak terkalahkan heads-up: lawan butuh 9 + balak >6 (mustahil)
ok(hu9.win === 1 && hu9.tie === 0 && hu9.lose === 0, 'Qiu+balak6 unbeatable', JSON.stringify({w:hu9.win,t:hu9.tie,l:hu9.lose}));
// Qiu TANPA balak: range wajar
var hu9nb = E.headsUp([6, 3], [6, 4]); // 19 -> 9, tanpa balak
ok(hu9nb.value === 9 && E.balakRank([6, 3], [6, 4]) === -1, 'Qiu tanpa balak');
ok(hu9nb.win > 0.85 && hu9nb.win < 0.99, 'win% Qiu non-balak masuk akal', hu9nb.win.toFixed(3));
var hu0 = E.headsUp([0, 4], [0, 6]); // nilai 0, tanpa balak — kartu paling lemah
ok(hu0.value === 0 && E.balakRank([0, 4], [0, 6]) === -1, 'kartu lemah v0 non-balak');
ok(hu0.win < 0.10, 'kartu lemah win% kecil', hu0.win.toFixed(3));

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
var s4 = E.simulate([6, 3], [6, 4], 4, 20000, 42); // Qiu tanpa balak vs 3 lawan
ok(approx(s4.win + s4.tie + s4.lose, 1, 1e-9), 'MC 4p genap 1');
ok(s4.win < hu9nb.win, 'makin banyak lawan makin kecil win%', s4.win.toFixed(3) + ' < ' + hu9nb.win.toFixed(3));
// tangan unbeatable: Qiu + balak 6 tak pernah kalah/seri lawan berapa pun
var s4god = E.simulate([6, 6], [6, 1], 4, 20000, 42);
ok(s4god.win === 1 && s4god.tie === 0 && s4god.lose === 0, 'Qiu+balak6 unbeatable vs 3 lawan');
var s8 = E.simulate([0, 4], [0, 6], 8, 20000, 7);
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

// 8. tiebreaker balak
ok(E.isBalak([6, 6]) && !E.isBalak([6, 1]), 'isBalak');
ok(E.balakRank([1, 2], [3, 4]) === -1, 'tanpa balak -> -1');
ok(E.balakRank([5, 5], [6, 6]) === 6, 'balak tertinggi diambil');
// A:[6,6]+[0,1] v3 b6 vs B:[5,5]+[0,3] v3 b5 -> A menang (balak lebih tinggi)
ok(E.compareHands([6, 6], [0, 1], [5, 5], [0, 3]) === 1, 'seri nilai, balak 6 > balak 5');
// A v3 b6 vs C:[0,2]+[0,1] v3 tanpa balak -> A menang
ok(E.compareHands([6, 6], [0, 1], [0, 2], [0, 1]) === 1, 'seri nilai, balak > non-balak');
ok(E.compareHands([0, 2], [0, 1], [6, 6], [0, 1]) === -1, 'seri nilai, non-balak < balak');
// D:[1,2]+[0,0] v3 b0 vs C v3 tanpa balak -> D menang (balak 0 tetap balak)
ok(E.compareHands([1, 2], [0, 0], [0, 2], [0, 1]) === 1, 'balak 0 tetap mengalahkan non-balak');
// E:[2,3]+[1,2] v8 vs F:[0,5]+[1,2] v8, dua-duanya tanpa balak -> seri
ok(E.compareHands([2, 3], [1, 2], [0, 5], [1, 2]) === 0, 'seri nilai tanpa balak -> seri');
// nilai beda tetap menang walau lawan balak: G v3 b6 vs H v2
ok(E.compareHands([6, 6], [6, 5], [1, 1], [0, 0]) === 1, 'nilai lebih tinggi tetap menang');
// [6,6]+[0,1] (v3,b6): tie EXACT 0 — lawan tak mungkin punya balak 6
var huB = E.headsUp([6, 6], [0, 1]);
ok(huB.tie === 0, 'balak 6 => tie persis 0', huB.tie);
ok(approx(huB.win + huB.lose, 1, 1e-9), 'win+lose genap 1 tanpa tie');
// MC konsisten dgn exact utk tangan balak
var sB = E.simulate([6, 6], [0, 1], 2, 20000, 42);
ok(approx(sB.win, huB.win, 0.02), 'MC(2p) balak ≈ exact', sB.win.toFixed(3) + ' vs ' + huB.win.toFixed(3));
ok(sB.tie === 0, 'MC tie 0 utk balak 6');
// reasoning menyebut balak
ok(E.reasoning(5, 0.5, 4, true).indexOf('balak') >= 0, 'reasoning sebut balak');
ok(E.reasoning(5, 0.5, 4, false).indexOf('balak') < 0, 'reasoning tanpa balak diam');

console.log('\n' + pass + ' lolos, ' + fail + ' gagal');
process.exit(fail ? 1 : 0);
