/* ============================================================
   匹克球計分引擎  Pickleball Scoring Engine
   - 單打 / 雙打
   - 發球得分制 (side-out)  /  Rally 制 (每球得分)
   - 11 / 15 分，need win by 2
   - 三局兩勝 (Best of 3)
   純函式，無 React 依賴。所有 apply* 回傳「新的」state（深拷貝）。
   ============================================================ */
(function () {
  "use strict";

  function clone(s) {
    return JSON.parse(JSON.stringify(s));
  }

  // config:
  //  { event, mode:'doubles'|'singles', target:11|15, rule:'sideout'|'rally',
  //    bestOf:3, teams:[{name,color,players:[..]},{...}], firstServe:0|1 }
  function createMatch(config) {
    var st = {
      config: clone(config),
      gamesWon: [0, 0],
      completed: [],          // [{scores:[a,b], winner, game}]
      rightIdx: [0, 0],       // 各隊「右發球區」目前是哪位球員 (0/1)
      scores: [0, 0],         // 當前這一局比分
      serveTeam: config.firstServe,
      serverNum: config.mode === "doubles" ? 2 : 1, // 雙打每局開局以「第二發球員」起算
      serverPlayer: 0,        // 發球隊中正在發球的球員 index (0/1)
      gameIndex: 0,
      matchOver: false,
      matchWinner: null,
      lastEvent: null,        // 'point' | 'sideout' | 'server2' | 'gamewon' | 'matchwon'
      switchEnds: false       // 是否提示交換場邊
    };
    st.serverPlayer = st.rightIdx[st.serveTeam];
    return st;
  }

  function neededGames(st) {
    return Math.floor(st.config.bestOf / 2) + 1;
  }

  function isGameWon(st, team) {
    var s = st.scores[team];
    var o = st.scores[1 - team];
    return s >= st.config.target && s - o >= 2;
  }

  // 交換場邊判定：每局開始交換；決勝局過半再交換一次
  function computeSwitchEnds(st) {
    if (st.gameIndex > 0 && st.scores[0] === 0 && st.scores[1] === 0) return true;
    return false;
  }

  function startNextGame(st) {
    st.gameIndex += 1;
    st.scores = [0, 0];
    st.rightIdx = [0, 0];
    var firstServe = (st.config.firstServe + st.gameIndex) % 2; // 每局交替先發
    st.serveTeam = firstServe;
    st.serverNum = st.config.mode === "doubles" ? 2 : 1;
    st.serverPlayer = st.rightIdx[st.serveTeam];
    st.switchEnds = true;
  }

  function finishGame(st, team) {
    st.gamesWon[team] += 1;
    st.completed.push({
      scores: [st.scores[0], st.scores[1]],
      winner: team,
      game: st.gameIndex
    });
    if (st.gamesWon[team] >= neededGames(st)) {
      st.matchOver = true;
      st.matchWinner = team;
      st.lastEvent = "matchwon";
    } else {
      st.lastEvent = "gamewon";
      startNextGame(st);
    }
  }

  // winner = 贏得「這一球 rally」的隊伍 index (0/1)
  function applyRally(prev, winner) {
    if (prev.matchOver) return prev;
    var st = clone(prev);
    st.switchEnds = false;
    var doubles = st.config.mode === "doubles";

    if (st.config.rule === "sideout") {
      if (winner === st.serveTeam) {
        // 發球方得分
        st.scores[st.serveTeam] += 1;
        if (doubles) st.rightIdx[st.serveTeam] = 1 - st.rightIdx[st.serveTeam]; // 與隊友換邊
        st.lastEvent = "point";
        if (isGameWon(st, st.serveTeam)) return finishGame(st, st.serveTeam), st;
      } else {
        // 接發方贏球 → 不得分
        if (doubles && st.serverNum === 1) {
          st.serverNum = 2;
          st.serverPlayer = 1 - st.serverPlayer; // 換隊友發球
          st.lastEvent = "server2";
        } else {
          // 換發 (side-out)
          st.serveTeam = winner;
          st.serverNum = 1;
          st.serverPlayer = st.rightIdx[st.serveTeam];
          st.lastEvent = "sideout";
        }
      }
    } else {
      // Rally 制：每球都得分
      st.scores[winner] += 1;
      if (winner === st.serveTeam) {
        if (doubles) st.rightIdx[st.serveTeam] = 1 - st.rightIdx[st.serveTeam];
        st.lastEvent = "point";
      } else {
        // 換發並得分
        st.serveTeam = winner;
        st.serverPlayer = st.rightIdx[st.serveTeam];
        st.lastEvent = "point";
      }
      st.serverNum = 1;
      if (isGameWon(st, winner)) return finishGame(st, winner), st;
    }
    return st;
  }

  // 發球資訊：哪隊、哪位球員、左右區、第幾發球員
  function serveInfo(st) {
    var team = st.serveTeam;
    var doubles = st.config.mode === "doubles";
    var side;
    if (doubles) {
      side = st.rightIdx[team] === st.serverPlayer ? "right" : "left";
    } else {
      side = st.scores[team] % 2 === 0 ? "right" : "left";
    }
    return {
      team: team,
      playerIdx: doubles ? st.serverPlayer : 0,
      side: side,
      num: st.serverNum
    };
  }

  // 唱分字串元件（給 UI 自行排版）
  function scoreCall(st) {
    var info = serveInfo(st);
    var serve = st.scores[info.team];
    var recv = st.scores[1 - info.team];
    if (st.config.rule === "rally") {
      // Rally：以發球方-接發方
      return { parts: [serve, recv], serverTeam: info.team };
    }
    if (st.config.mode === "doubles") {
      return { parts: [serve, recv, info.num], serverTeam: info.team };
    }
    return { parts: [serve, recv], serverTeam: info.team };
  }

  // 是否處於賽末點 / 局點
  function gamePointInfo(st) {
    var t = st.config.target;
    var res = [false, false];
    for (var team = 0; team < 2; team++) {
      var s = st.scores[team], o = st.scores[1 - team];
      // 再得一分即達標且領先2
      var after = s + 1;
      if (after >= t && after - o >= 2) {
        if (st.config.rule === "rally" || team === st.serveTeam) res[team] = true;
      }
    }
    return res;
  }

  window.PB = {
    createMatch: createMatch,
    applyRally: applyRally,
    serveInfo: serveInfo,
    scoreCall: scoreCall,
    gamePointInfo: gamePointInfo,
    neededGames: neededGames,
    clone: clone
  };
})();
