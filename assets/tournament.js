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

  // 把循環賽所有對戰貪婪排進「courtCount 面場地」，回傳帶 court / slot 的賽程。
  // 規則：依循環輪次順序，每場排進「最早可用時段」——該時段尚有空場地，
  //       且兩對都沒有在同一時段打別場（同一時段同一對不重複）。
  function scheduleMatches(rounds, courtCount) {
    var pending = [];
    rounds.forEach(function (round, r) {
      round.forEach(function (ij) { pending.push({ i: ij[0], j: ij[1], round: r }); });
    });
    var slots = []; // slots[s] = { count: 已排場數, busy: { pairIdx: true } }
    var scheduled = [];
    pending.forEach(function (pm) {
      var s = 0;
      for (;;) {
        if (!slots[s]) slots[s] = { count: 0, busy: {} };
        var slot = slots[s];
        if (slot.count < courtCount && !slot.busy[pm.i] && !slot.busy[pm.j]) break;
        s++;
      }
      var slot = slots[s];
      var court = slot.count;
      slot.count++;
      slot.busy[pm.i] = true;
      slot.busy[pm.j] = true;
      scheduled.push({ i: pm.i, j: pm.j, round: pm.round, court: court, slot: s });
    });
    return scheduled;
  }

  // 從 12 人抽籤配 6 對，並產生循環賽程（回傳一個 division 物件）
  function buildDivision(di, level, names, pairCount, courtCount) {
    pairCount = pairCount || DEFAULT_PAIR_COUNT;
    courtCount = courtCount || DEFAULT_COURTS;
    var pool = shuffle((names || []).map(function (n, i) {
      return (n && String(n).trim()) || ("球員 " + (i + 1));
    }));
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
  // divisionInputs: [ {level, names:[10]}, {level, names:[10]} ]
  // opts: { event, target, rule, groupBestOf, koBestOf }
  function drawTournament(divisionInputs, opts) {
    opts = opts || {};
    var inputs = divisionInputs && divisionInputs.length ? divisionInputs : [
      { level: DEFAULT_LEVELS[0], names: [] },
      { level: DEFAULT_LEVELS[1], names: [] },
    ];
    var divisions = inputs.map(function (d, di) {
      return buildDivision(di, d.level || DEFAULT_LEVELS[di] || String(di + 1), d.names, opts.pairCount, opts.courts);
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
