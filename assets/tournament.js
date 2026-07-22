/* ============================================================
   匹克球賽事引擎  Tournament Engine（雙級別版）
   - 分 2.0 / 3.0 兩級別，各 12 人
   - 每級抽籤把 12 人配成 6 對固定雙打搭檔
   - 6 對打循環賽（每對打其他 5 對，每級 15 場，排進 2 面場地 · 8 時段）
   - 積分：每對勝場優先、淨分次之
   - 淘汰賽：各級前 4 對 → 準決賽(1-4,2-3) → 決賽，各級各出一位冠軍
   純函式，無 React 依賴。所有 apply* 回傳「新的」tournament（深拷貝）。
   掛在 window.TB。
   ============================================================ */
(function () {
  "use strict";

  var PAIR_COLORS = ["#19C3FB", "#FF5B3A", "#C7F03A", "#A66BFF", "#FFC53D", "#FF4D9D"];
  var DEFAULT_LEVELS = ["2.0", "3.0"];
  var DEFAULT_PAIR_COUNT = 6; // 每級 12 人 → 6 對
  var DEFAULT_COURTS = 2;     // 兩面場地

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 循環賽排輪（circle method）：n 隊回傳 [ [ [i,j],[k,l] ], ... ]（每輪的對戰）
  function roundRobinRounds(n) {
    var teams = [];
    for (var i = 0; i < n; i++) teams.push(i);
    if (teams.length % 2 === 1) teams.push(-1); // 奇數補一個「輪空」
    var m = teams.length;
    var arr = teams.slice();
    var rounds = [];
    for (var r = 0; r < m - 1; r++) {
      var round = [];
      for (var k = 0; k < m / 2; k++) {
        var a = arr[k], b = arr[m - 1 - k];
        if (a !== -1 && b !== -1) round.push([a, b]);
      }
      rounds.push(round);
      var fixed = arr[0];
      var rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [fixed].concat(rest);
    }
    return rounds;
  }

  // ---- 排程成本：讓每對「平均交叉、不要連打好幾場」----
  // 主目標：最小化任一對的「最長連續上場輪數」；其次：連打總數、空檔落在最後一輪。
  function scheduleCost(sched, n) {
    var perPair = [];
    for (var p = 0; p < n; p++) perPair.push([]);
    sched.forEach(function (m) { perPair[m.i].push(m.slot); perPair[m.j].push(m.slot); });
    var totalB2B = 0, worstRun = 1, runPenalty = 0;
    for (var p2 = 0; p2 < n; p2++) {
      var seq = perPair[p2].sort(function (a, b) { return a - b; });
      var run = 1;
      for (var q = 1; q < seq.length; q++) {
        if (seq[q] - seq[q - 1] === 1) { totalB2B++; run++; if (run > worstRun) worstRun = run; runPenalty += run; }
        else run = 1;
      }
    }
    var maxSlot = 0, cnt = {};
    sched.forEach(function (m) { cnt[m.slot] = (cnt[m.slot] || 0) + 1; if (m.slot > maxSlot) maxSlot = m.slot; });
    var slots = maxSlot + 1, maxPerSlot = 0;
    for (var ss in cnt) maxPerSlot = Math.max(maxPerSlot, cnt[ss]);
    var gapPenalty = 0; // 未滿場的時段若不在最後一輪 → 場地輪次會跳號
    for (var s2 = 0; s2 < slots - 1; s2++) if ((cnt[s2] || 0) < maxPerSlot) gapPenalty++;
    return worstRun * 1000000 + runPenalty * 10000 + gapPenalty * 1000 + totalB2B * 10 + slots;
  }

  // 隨機把 matches 打包進「剛好 ceil(場數/場地)」個時段（每時段 <=courtCount 且對手不重複）。
  // 只接受「未滿場的空檔落在最後一輪」的打包，否則回傳 null 重試。
  function packRandom(matches, courtCount) {
    var order = matches.slice();
    for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
    var minSlots = Math.ceil(matches.length / courtCount);
    var slots = [];
    for (var s = 0; s < minSlots; s++) slots.push({ ms: [], used: {} });
    for (var k = 0; k < order.length; k++) {
      var pm = order[k], cand = [];
      for (var s2 = 0; s2 < slots.length; s2++) {
        var sl = slots[s2];
        if (sl.ms.length < courtCount && !sl.used[pm.i] && !sl.used[pm.j]) cand.push(s2);
      }
      if (cand.length === 0) return null;
      var pick = cand[Math.floor(Math.random() * cand.length)];
      slots[pick].used[pm.i] = true; slots[pick].used[pm.j] = true; slots[pick].ms.push(pm);
    }
    for (var s3 = 0; s3 < slots.length - 1; s3++) if (slots[s3].ms.length < courtCount) return null;
    var out = [];
    slots.forEach(function (slt, s4) {
      slt.ms.forEach(function (pm2, c) { out.push({ i: pm2.i, j: pm2.j, round: pm2.round, court: c, slot: s4 }); });
    });
    return out;
  }

  // 局部搜尋：隨機交換兩場的時段/場地（不製造同時段重複對手、不降級才保留）。
  function hillClimb(sched, n, courtCount, tries) {
    function slotPairsExcept(slot, exceptIdx) {
      var used = {};
      for (var k = 0; k < sched.length; k++) {
        if (k === exceptIdx) continue;
        if (sched[k].slot === slot) { used[sched[k].i] = true; used[sched[k].j] = true; }
      }
      return used;
    }
    var cur = scheduleCost(sched, n);
    for (var t = 0; t < tries; t++) {
      var a = Math.floor(Math.random() * sched.length), b = Math.floor(Math.random() * sched.length);
      if (a === b || sched[a].slot === sched[b].slot) continue;
      var ua = slotPairsExcept(sched[a].slot, a);
      if (ua[sched[b].i] || ua[sched[b].j]) continue;
      var ub = slotPairsExcept(sched[b].slot, b);
      if (ub[sched[a].i] || ub[sched[a].j]) continue;
      var sa = sched[a].slot, ca = sched[a].court, sb = sched[b].slot, cb = sched[b].court;
      sched[a].slot = sb; sched[a].court = cb; sched[b].slot = sa; sched[b].court = ca;
      var c = scheduleCost(sched, n);
      if (c <= cur) cur = c;
      else { sched[a].slot = sa; sched[a].court = ca; sched[b].slot = sb; sched[b].court = cb; }
    }
    return sched;
  }

  // 把循環賽所有對戰排進「courtCount 面場地」，讓每對平均交叉上場、避免連打好幾場。
  // 做法：多起點隨機打包 + 局部搜尋，取「最長連續上場」最少的賽程。
  function scheduleMatches(rounds, courtCount) {
    var matches = [], n = 0;
    rounds.forEach(function (round, r) {
      round.forEach(function (ij) { matches.push({ i: ij[0], j: ij[1], round: r }); n = Math.max(n, ij[0] + 1, ij[1] + 1); });
    });
    var best = null, bestC = Infinity;
    for (var restart = 0; restart < 30; restart++) {
      var s = null;
      for (var it = 0; it < 350 && !s; it++) s = packRandom(matches, courtCount);
      if (!s) continue;
      s = hillClimb(s, n, courtCount, 600);
      var c = scheduleCost(s, n);
      if (c < bestC) { bestC = c; best = s; }
    }
    if (best) return best;
    // 保底：極端設定下若找不到合法打包，退回單純貪婪最早時段
    var slots = [], scheduled = [];
    matches.forEach(function (pm) {
      var s2 = 0;
      for (;;) { if (!slots[s2]) slots[s2] = { count: 0, busy: {} }; if (slots[s2].count < courtCount && !slots[s2].busy[pm.i] && !slots[s2].busy[pm.j]) break; s2++; }
      scheduled.push({ i: pm.i, j: pm.j, round: pm.round, court: slots[s2].count, slot: s2 });
      slots[s2].count++; slots[s2].busy[pm.i] = true; slots[s2].busy[pm.j] = true;
    });
    return scheduled;
  }

  // 從 12 人抽籤配 6 對，並產生循環賽程（回傳一個 division 物件）
  // forcedPairs: [[a,b],...] 指定配對 → 依序組隊、不洗牌（強制寫入名單用）
  function buildDivision(di, level, names, pairCount, courtCount, forcedPairs) {
    courtCount = courtCount || DEFAULT_COURTS;
    var pool;
    if (forcedPairs && forcedPairs.length) {
      pairCount = forcedPairs.length;
      pool = [];
      forcedPairs.forEach(function (pr) { pool.push(pr[0], pr[1]); });
      pool = pool.map(function (n, i) {
        return (n && String(n).trim()) || ("球員 " + (i + 1));
      });
    } else {
      pairCount = pairCount || DEFAULT_PAIR_COUNT;
      pool = shuffle((names || []).map(function (n, i) {
        return (n && String(n).trim()) || ("球員 " + (i + 1));
      }));
    }
    var pairs = [];
    for (var p = 0; p < pairCount; p++) {
      var a = pool[p * 2], b = pool[p * 2 + 1];
      pairs.push({
        idx: p,
        players: [a, b],
        name: (a || "?") + "・" + (b || "?"),
        tag: "第" + (p + 1) + "隊",
        color: PAIR_COLORS[p % PAIR_COLORS.length],
      });
    }

    var rounds = roundRobinRounds(pairs.length);
    var matches = scheduleMatches(rounds, courtCount).map(function (sm) {
      return {
        id: "d" + di + "-s" + sm.slot + "-c" + sm.court,
        phase: "group",
        division: di,
        round: sm.round,
        pairIdx: [sm.i, sm.j],
        teams: [pairs[sm.i].players.slice(), pairs[sm.j].players.slice()],
        court: sm.court,
        slot: sm.slot,
        status: "pending",
        result: null,
      };
    });

    return { level: level, pairs: pairs, matches: matches, ko: null };
  }

  // ---- 建立整場賽事：兩級別各抽籤 ----
  // divisionInputs: [ {level, names:[12], pairs?:[[a,b]x6]}, ... ]
  //   有給 pairs 時直接採用該配對（強制寫入），否則隨機抽籤
  // opts: { event, target, rule, groupBestOf, koBestOf }
  function drawTournament(divisionInputs, opts) {
    opts = opts || {};
    var inputs = divisionInputs && divisionInputs.length ? divisionInputs : [
      { level: DEFAULT_LEVELS[0], names: [] },
      { level: DEFAULT_LEVELS[1], names: [] },
    ];
    var divisions = inputs.map(function (d, di) {
      return buildDivision(di, d.level || DEFAULT_LEVELS[di] || String(di + 1), d.names, opts.pairCount, opts.courts, d.pairs);
    });
    return {
      event: (opts.event && opts.event.trim()) || "匹克球分級循環賽",
      target: opts.target || 11,
      rule: opts.rule || "sideout",
      groupBestOf: opts.groupBestOf || 1,
      koBestOf: opts.koBestOf || 3,
      divisions: divisions,
    };
  }

  function resultFromState(st) {
    return {
      games: st.completed.map(function (g) { return { scores: g.scores.slice(), winner: g.winner }; }),
      gamesWon: st.gamesWon.slice(),
      winner: st.matchWinner,
    };
  }

  function findMatch(t, di, id) {
    var d = t.divisions[di];
    if (!d) return null;
    var arr = (d.ko ? d.ko.matches : []).concat(d.matches);
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  // ---- 回填循環賽結果（純函式）----
  function applyMatchResult(t, di, matchId, st) {
    var nt = clone(t);
    var ms = nt.divisions[di].matches;
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].id === matchId) {
        ms[i].result = resultFromState(st);
        ms[i].status = "done";
        break;
      }
    }
    return nt;
  }

  function divisionComplete(t, di) {
    return t.divisions[di].matches.every(function (m) { return m.status === "done"; });
  }

  // ---- 某級積分：每對跨其 4 場的勝場 / 得失分 ----
  function computeStanding(t, di) {
    var d = t.divisions[di];
    var stat = d.pairs.map(function (p) {
      return { idx: p.idx, name: p.name, tag: p.tag, color: p.color, players: p.players.slice(), w: 0, l: 0, pf: 0, pa: 0 };
    });
    d.matches.forEach(function (m) {
      if (m.status !== "done" || !m.result) return;
      var res = m.result;
      [0, 1].forEach(function (side) {
        var pi = m.pairIdx[side];
        var row = stat[pi];
        if (!row) return;
        if (res.winner === side) row.w += 1; else row.l += 1;
        res.games.forEach(function (g) {
          row.pf += g.scores[side];
          row.pa += g.scores[1 - side];
        });
      });
    });
    stat.forEach(function (r) { r.diff = r.pf - r.pa; });
    stat.sort(function (a, b) {
      if (b.w !== a.w) return b.w - a.w;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return a.idx - b.idx;
    });
    stat.forEach(function (r, i) { r.rank = i + 1; r.advance = i < 4; });
    return stat;
  }

  // ---- 某級淘汰賽：前 4 對 → 準決賽(1-4,2-3) → 決賽 ----
  function buildKnockout(t, di) {
    var nt = clone(t);
    var rank = computeStanding(nt, di);
    var top = rank.slice(0, 4).map(function (r, i) {
      return { idx: r.idx, name: r.name, tag: r.tag, color: r.color, players: r.players.slice(), seed: i + 1 };
    });
    // 不足 4 對時用 null 補（極少見）
    while (top.length < 4) top.push(null);

    var koMatches = [
      { id: "ko-sf1", phase: "ko", roundName: "準決賽", division: di,
        teams: [top[0], top[3]], feeds: { match: "ko-final", slot: 0 },
        court: 0, slot: 0, status: "pending", result: null, winner: null },
      { id: "ko-sf2", phase: "ko", roundName: "準決賽", division: di,
        teams: [top[1], top[2]], feeds: { match: "ko-final", slot: 1 },
        court: 1, slot: 0, status: "pending", result: null, winner: null },
      { id: "ko-final", phase: "ko", roundName: "決賽", division: di,
        teams: [null, null], feeds: null,
        court: 0, slot: 1, status: "pending", result: null, winner: null },
    ];

    nt.divisions[di].ko = { seeds: top, matches: koMatches, champion: null };
    return nt;
  }

  // ---- 回填淘汰賽結果 + 勝者遞補 ----
  function applyKoResult(t, di, matchId, st) {
    var nt = clone(t);
    var ko = nt.divisions[di].ko;
    if (!ko) return nt;
    var m = null;
    for (var i = 0; i < ko.matches.length; i++) {
      if (ko.matches[i].id === matchId) { m = ko.matches[i]; break; }
    }
    if (!m) return nt;
    m.result = resultFromState(st);
    m.status = "done";
    m.winner = st.matchWinner;
    var winTeam = m.teams[st.matchWinner];
    if (m.feeds) {
      for (var j = 0; j < ko.matches.length; j++) {
        if (ko.matches[j].id === m.feeds.match) { ko.matches[j].teams[m.feeds.slot] = winTeam; break; }
      }
    } else {
      ko.champion = winTeam;
    }
    return nt;
  }

  function matchReady(m) {
    return m.status !== "done" && m.teams[0] && m.teams[1];
  }

  window.TB = {
    drawTournament: drawTournament,
    applyMatchResult: applyMatchResult,
    applyKoResult: applyKoResult,
    computeStanding: computeStanding,
    divisionComplete: divisionComplete,
    buildKnockout: buildKnockout,
    findMatch: findMatch,
    matchReady: matchReady,
    clone: clone,
    PAIR_COLORS: PAIR_COLORS,
    DEFAULT_LEVELS: DEFAULT_LEVELS,
    DEFAULT_PAIR_COUNT: DEFAULT_PAIR_COUNT,
    DEFAULT_COURTS: DEFAULT_COURTS,
  };
})();
