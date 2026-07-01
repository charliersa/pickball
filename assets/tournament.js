/* ============================================================
   匹克球賽事引擎  Tournament Engine
   - 20 人抽籤分 5 組（每組 4 人）
   - 小組：美式雙打循環（每組 3 場，輪流搭檔）
   - 積分：個人勝場優先、淨分次之
   - 淘汰賽：各組前 2 名配隊，5 隊種子單淘汰
   純函式，無 React 依賴。所有 apply* 回傳「新的」tournament（深拷貝）。
   掛在 window.TB。
   ============================================================ */
(function () {
  "use strict";

  var GROUP_LETTERS = ["A", "B", "C", "D", "E"];
  var GROUP_COLORS = ["#19C3FB", "#FF5B3A", "#C7F03A", "#A66BFF", "#FFC53D"];

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 每組 4 人的雙打循環搭檔組合（輪流搭檔，共 3 場）
  //  idx: [[隊1],[隊2]]
  var ROTATION = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
  ];

  // ---- 建立賽事：洗牌 → 分組 → 產生小組賽程 → 排場地 ----
  // names: 20 個字串；opts: { event, target, rule, groupCount, groupSize, courts, bestOf }
  function drawTournament(names, opts) {
    opts = opts || {};
    var groupCount = opts.groupCount || 5;
    var groupSize = opts.groupSize || 4;
    var courts = opts.courts || 2;

    var pool = shuffle(names.map(function (n, i) {
      return (n && String(n).trim()) || ("球員 " + (i + 1));
    }));

    var groups = [];
    for (var g = 0; g < groupCount; g++) {
      groups.push({
        name: (GROUP_LETTERS[g] || String(g + 1)) + "組",
        color: GROUP_COLORS[g % GROUP_COLORS.length],
        players: pool.slice(g * groupSize, g * groupSize + groupSize),
      });
    }

    var matches = [];
    for (var gi = 0; gi < groups.length; gi++) {
      var pl = groups[gi].players;
      for (var r = 0; r < ROTATION.length; r++) {
        var combo = ROTATION[r];
        matches.push({
          id: "g" + gi + "-r" + r,
          phase: "group",
          group: gi,
          round: r,
          teams: [
            combo[0].map(function (k) { return pl[k]; }),
            combo[1].map(function (k) { return pl[k]; }),
          ],
          court: 0,
          slot: 0,
          status: "pending",
          result: null,
        });
      }
    }
    scheduleCourts(matches, courts);

    return {
      event: (opts.event && opts.event.trim()) || "匹克球循環賽",
      target: opts.target || 11,
      rule: opts.rule || "sideout",
      groupBestOf: opts.groupBestOf || 1,
      koBestOf: opts.koBestOf || 3,
      courts: courts,
      groups: groups,
      matches: matches,
      stage: "group",
      ko: null,
    };
  }

  // ---- 貪婪排場地：把每場塞進最早、該場 4 人都空、且場地未滿的時段 ----
  function scheduleCourts(matches, courts) {
    var slots = []; // slots[s] = { busy:Set(玩家), count }
    function playersOf(m) {
      return m.teams[0].concat(m.teams[1]);
    }
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      var ppl = playersOf(m);
      var placed = false;
      for (var s = 0; s < slots.length && !placed; s++) {
        var slot = slots[s];
        if (slot.count >= courts) continue;
        var conflict = false;
        for (var p = 0; p < ppl.length; p++) {
          if (slot.busy[ppl[p]]) { conflict = true; break; }
        }
        if (conflict) continue;
        m.slot = s;
        m.court = slot.count;
        slot.count++;
        for (var q = 0; q < ppl.length; q++) slot.busy[ppl[q]] = true;
        placed = true;
      }
      if (!placed) {
        var busy = {};
        for (var b = 0; b < ppl.length; b++) busy[ppl[b]] = true;
        m.slot = slots.length;
        m.court = 0;
        slots.push({ busy: busy, count: 1 });
      }
    }
    return matches;
  }

  function findMatch(t, id) {
    var arr = (t.ko ? t.ko.matches : []).concat(t.matches);
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  // 從已結束的計分 state 萃取結果
  function resultFromState(st) {
    return {
      games: st.completed.map(function (g) {
        return { scores: g.scores.slice(), winner: g.winner };
      }),
      gamesWon: st.gamesWon.slice(),
      winner: st.matchWinner,
    };
  }

  // ---- 回填小組賽結果（純函式）----
  function applyMatchResult(t, matchId, st) {
    var nt = clone(t);
    for (var i = 0; i < nt.matches.length; i++) {
      if (nt.matches[i].id === matchId) {
        nt.matches[i].result = resultFromState(st);
        nt.matches[i].status = "done";
        break;
      }
    }
    return nt;
  }

  function groupsComplete(t) {
    return t.matches.every(function (m) { return m.status === "done"; });
  }

  // ---- 小組積分：每位球員跨其 3 場的勝場 / 得失分 ----
  function computeGroupStanding(t, gi) {
    var players = t.groups[gi].players;
    var stat = {};
    players.forEach(function (p) {
      stat[p] = { name: p, w: 0, l: 0, pf: 0, pa: 0 };
    });
    t.matches.forEach(function (m) {
      if (m.group !== gi || m.status !== "done" || !m.result) return;
      var res = m.result;
      // 該場每位球員屬於 team 0 或 1
      [0, 1].forEach(function (side) {
        m.teams[side].forEach(function (p) {
          if (!stat[p]) return;
          if (res.winner === side) stat[p].w += 1; else stat[p].l += 1;
          res.games.forEach(function (g) {
            stat[p].pf += g.scores[side];
            stat[p].pa += g.scores[1 - side];
          });
        });
      });
    });
    var rows = players.map(function (p) {
      var s = stat[p];
      s.diff = s.pf - s.pa;
      return s;
    });
    rows.sort(function (a, b) {
      if (b.w !== a.w) return b.w - a.w;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return a.name.localeCompare(b.name);
    });
    rows.forEach(function (r, i) { r.rank = i + 1; r.advance = i < 2; });
    return rows;
  }

  // ---- 產生淘汰賽：各組前 2 名配成隊伍，5 隊種子單淘汰 ----
  function buildKnockout(t) {
    var nt = clone(t);
    var teams = [];
    for (var gi = 0; gi < nt.groups.length; gi++) {
      var st = computeGroupStanding(nt, gi);
      var top = st.slice(0, 2);
      teams.push({
        group: gi,
        groupName: nt.groups[gi].name,
        color: nt.groups[gi].color,
        players: [top[0].name, top[1].name],
        name: nt.groups[gi].name + " " + top[0].name + "·" + top[1].name,
        // 隊伍強度：兩人勝場和、淨分和（決定種子）
        w: top[0].w + top[1].w,
        diff: top[0].diff + top[1].diff,
      });
    }
    teams.sort(function (a, b) {
      if (b.w !== a.w) return b.w - a.w;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return a.group - b.group;
    });
    teams.forEach(function (tm, i) { tm.seed = i + 1; tm.id = "seed" + (i + 1); });

    var s = teams; // s[0]=種子1 ...
    var koMatches = [
      { id: "ko-qf", phase: "ko", roundName: "資格賽",
        teams: [s[3], s[4]], feeds: { match: "ko-sf1", slot: 1 },
        court: 0, slot: 0, status: "pending", result: null, winner: null },
      { id: "ko-sf1", phase: "ko", roundName: "準決賽",
        teams: [s[0], null], feeds: { match: "ko-final", slot: 0 },
        court: 0, slot: 1, status: "pending", result: null, winner: null },
      { id: "ko-sf2", phase: "ko", roundName: "準決賽",
        teams: [s[1], s[2]], feeds: { match: "ko-final", slot: 1 },
        court: 1, slot: 0, status: "pending", result: null, winner: null },
      { id: "ko-final", phase: "ko", roundName: "決賽",
        teams: [null, null], feeds: null,
        court: 0, slot: 2, status: "pending", result: null, winner: null },
    ];

    nt.ko = { teams: teams, matches: koMatches, champion: null };
    nt.stage = "ko";
    return nt;
  }

  // ---- 回填淘汰賽結果 + 勝者遞補下一場 ----
  function applyKoResult(t, matchId, st) {
    var nt = clone(t);
    if (!nt.ko) return nt;
    var m = null;
    for (var i = 0; i < nt.ko.matches.length; i++) {
      if (nt.ko.matches[i].id === matchId) { m = nt.ko.matches[i]; break; }
    }
    if (!m) return nt;
    m.result = resultFromState(st);
    m.status = "done";
    m.winner = st.matchWinner;
    var winTeam = m.teams[st.matchWinner];
    if (m.feeds) {
      for (var j = 0; j < nt.ko.matches.length; j++) {
        if (nt.ko.matches[j].id === m.feeds.match) {
          nt.ko.matches[j].teams[m.feeds.slot] = winTeam;
          break;
        }
      }
    } else {
      nt.ko.champion = winTeam; // 決賽
    }
    return nt;
  }

  // 一場是否可開打（兩隊都到齊且尚未打完）
  function matchReady(m) {
    return m.status !== "done" && m.teams[0] && m.teams[1];
  }

  window.TB = {
    drawTournament: drawTournament,
    scheduleCourts: scheduleCourts,
    applyMatchResult: applyMatchResult,
    applyKoResult: applyKoResult,
    computeGroupStanding: computeGroupStanding,
    groupsComplete: groupsComplete,
    buildKnockout: buildKnockout,
    findMatch: findMatch,
    matchReady: matchReady,
    clone: clone,
    GROUP_COLORS: GROUP_COLORS,
  };
})();
