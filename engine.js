/* Jisong Win Logic — engine inti (2 kartu domino, nilai = total bulatan mod 10)
 * Berlaku di Node & browser. Murni logika, tanpa DOM. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JisongEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 28 kartu domino (double-six), tiap kartu [atas, bawah], atas <= bawah
  var TILES = [];
  for (var a = 0; a <= 6; a++) for (var b = a; b <= 6; b++) TILES.push([a, b]);

  function key(t) { return t[0] + '-' + t[1]; }
  function norm(t) { return t[0] <= t[1] ? [t[0], t[1]] : [t[1], t[0]]; }
  function sameTile(t, u) { var a = norm(t), b = norm(u); return a[0] === b[0] && a[1] === b[1]; }
  function pips(t) { return t[0] + t[1]; }
  // Nilai tangan: total bulatan 2 kartu, ambil angka belakang
  function handValue(t1, t2) { return (pips(t1) + pips(t2)) % 10; }

  // Kartu balak = dobel (kedua sisi sama)
  function isBalak(t) { return t[0] === t[1]; }
  // Peringkat balak tangan: nilai balak tertinggi, -1 kalau tidak pegang balak
  function balakRank(t1, t2) {
    var r = -1;
    if (isBalak(t1)) r = t1[0];
    if (isBalak(t2) && t2[0] > r) r = t2[0];
    return r;
  }
  // Bandingkan dua tangan: 1 = tangan pertama menang, 0 = seri, -1 = kalah.
  // Urutan: nilai dulu; kalau nilai seri, yang pegang balak menang;
  // kalau dua-duanya pegang balak, balak tertinggi menang.
  function compareHands(t1, t2, o1, o2) {
    var v = handValue(t1, t2), w = handValue(o1, o2);
    if (v !== w) return v > w ? 1 : -1;
    var b = balakRank(t1, t2), c = balakRank(o1, o2);
    if (b !== c) return b > c ? 1 : -1;
    return 0;
  }

  function tileIndex(t1, t2) {
    for (var i = 0; i < TILES.length; i++)
      if (TILES[i][0] === t1[0] && TILES[i][1] === t1[1]) return i;
    return -1;
  }

  // RNG seedable (mulberry32) — hasil simulasi deterministik utk testing
  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Exact heads-up: lawan 1 pemain, enumerasi C(26,2)=325 kombinasi
  function headsUp(t1, t2) {
    var v = handValue(t1, t2);
    var rest = [];
    for (var i = 0; i < TILES.length; i++) {
      var t = TILES[i];
      if (sameTile(t, t1) || sameTile(t, t2)) continue;
      rest.push(t);
    }
    var win = 0, tie = 0, tot = 0;
    for (var x = 0; x < rest.length; x++) for (var y = x + 1; y < rest.length; y++) {
      var cmp = compareHands(t1, t2, rest[x], rest[y]); tot++;
      if (cmp > 0) win++; else if (cmp === 0) tie++;
    }
    return { value: v, balak: balakRank(t1, t2), win: win / tot, tie: tie / tot, lose: 1 - (win + tie) / tot, total: tot };
  }

  // Monte Carlo utk multi-pemain: tiap trial kocok sisa deck, bagi ke lawan
  function simulate(t1, t2, nPlayers, trials, seed) {
    trials = trials || 20000;
    var rnd = mulberry32(seed == null ? 1234567 : seed);
    var v = handValue(t1, t2), myB = balakRank(t1, t2);
    var rest = [];
    for (var i = 0; i < TILES.length; i++) {
      var t = TILES[i];
      if (sameTile(t, t1) || sameTile(t, t2)) continue;
      rest.push(t);
    }
    var nOpp = nPlayers - 1, need = nOpp * 2;
    var win = 0, tie = 0;
    var deck = rest.slice();
    for (var tr = 0; tr < trials; tr++) {
      // Fisher-Yates parsial: ambil `need` kartu pertama
      for (var i = 0; i < need; i++) {
        var j = i + Math.floor(rnd() * (deck.length - i));
        var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      }
      var bestV = -1, bestB = -1;
      for (var o = 0; o < nOpp; o++) {
        var ov = handValue(deck[o * 2], deck[o * 2 + 1]);
        var ob = balakRank(deck[o * 2], deck[o * 2 + 1]);
        if (ov > bestV || (ov === bestV && ob > bestB)) { bestV = ov; bestB = ob; }
      }
      if (v > bestV || (v === bestV && myB > bestB)) win++;
      else if (v === bestV && myB === bestB) tie++;
    }
    return { value: v, balak: myB, win: win / trials, tie: tie / trials, lose: 1 - (win + tie) / trials, trials: trials };
  }

  // Equity kasar utk keputusan: menang penuh + separuh dari seri (split pot)
  function equity(r) { return r.win + r.tie / 2; }

  // Rekomendasi taruhan berdasarkan equity
  function recommend(eq) {
    if (eq >= 0.60) return 'NAIKKAN';
    if (eq >= 0.30) return 'IKUT';
    return 'LIPAT';
  }

  var VALUE_LABEL = ['0 (Kosong)', '1', '2', '3', '4', '5', '6', '7', '8', '9 (Qiu!)'];

  // Alasan berbahasa Indonesia per nilai kartu
  function reasoning(v, eq, nPlayers, hasBalak) {
    var pct = Math.round(eq * 100);
    var opp = nPlayers - 1;
    var base;
    if (v === 9) base = 'Qiu! Kartu monster — nilai tertinggi. Equity ' + pct + '% vs ' + opp + ' lawan. NAIKKAN, jangan kasih murah.';
    else if (v === 8) base = 'Nilai 8, kartu premium. Equity ' + pct + '% vs ' + opp + ' lawan. Layak NAIKKAN, cuma kalah dari Qiu.';
    else if (v === 7) base = 'Nilai 7, kartu kuat. Equity ' + pct + '% vs ' + opp + ' lawan. Ikut berani, naikkan kalau lawan ragu.';
    else if (v === 6) base = 'Nilai 6, kartu menengah-atas. Equity ' + pct + '% vs ' + opp + ' lawan. Aman untuk IKUT.';
    else if (v === 5) base = 'Nilai 5, koin flip. Equity ' + pct + '% vs ' + opp + ' lawan. Ikut kalau taruhan masih murah.';
    else if (v === 4) base = 'Nilai 4, di bawah rata-rata. Equity cuma ' + pct + '% vs ' + opp + ' lawan. Lipat kecuali pot sudah besar.';
    else if (v >= 1) base = 'Nilai ' + v + ', kartu lemah. Equity cuma ' + pct + '% vs ' + opp + ' lawan. LIPAT, jangan buang chip.';
    else base = 'Nilai 0 (kosong) — kartu mati. Equity cuma ' + pct + '% vs ' + opp + ' lawan. LIPAT, titik.';
    if (hasBalak) base += ' 🀄 Bonus balak: kalau nilai seri dengan lawan, kamu yang menang.';
    return base;
  }

  // Semua 378 kombinasi 2 kartu + nilai & equity heads-up (utk tabel referensi)
  function allHands() {
    var out = [];
    for (var i = 0; i < TILES.length; i++) for (var j = i + 1; j < TILES.length; j++) {
      var r = headsUp(TILES[i], TILES[j]);
      out.push({ t1: TILES[i], t2: TILES[j], value: r.value, win: r.win, tie: r.tie, eq: equity(r) });
    }
    return out;
  }

  return {
    TILES: TILES, key: key, pips: pips, handValue: handValue, tileIndex: tileIndex,
    isBalak: isBalak, balakRank: balakRank, compareHands: compareHands,
    headsUp: headsUp, simulate: simulate, equity: equity, recommend: recommend,
    reasoning: reasoning, allHands: allHands, VALUE_LABEL: VALUE_LABEL, mulberry32: mulberry32
  };
});
