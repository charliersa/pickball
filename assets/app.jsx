/* ============================================================
   App 根元件：狀態、Undo、持久化、歷史、WebSocket 同步
   ============================================================ */
const LS_CURRENT = "pb_current_v1";
const LS_RECORDS = "pb_records_v1";
const LS_TOURNAMENT = "pb_tournament_v1";

// ?reset 參數：清除 localStorage 後跳回首頁，解決損壞狀態導致白畫面
if (new URLSearchParams(location.search).has('reset')) {
  localStorage.removeItem(LS_CURRENT);
  localStorage.removeItem(LS_RECORDS);
  localStorage.removeItem(LS_TOURNAMENT);
  history.replaceState(null, '', '/');
}

// 由賽事的一場比賽組出計分板 config；tournamentRef 讓比賽結束後可回填賽事
function tournamentMatchConfig(t, phase, m) {
  const di = m.division;
  const d = t.divisions[di];
  const bestOf = phase === "ko" ? (t.koBestOf || 3) : (t.groupBestOf || 1);
  let teamA, teamB;
  if (phase === "ko") {
    teamA = { name: m.teams[0].players.join("・"), color: m.teams[0].color, players: m.teams[0].players.slice() };
    let c1 = m.teams[1].color;
    if (c1 === m.teams[0].color) c1 = "#FF5B3A";
    teamB = { name: m.teams[1].players.join("・"), color: c1, players: m.teams[1].players.slice() };
  } else {
    const pa = d.pairs[m.pairIdx[0]], pb = d.pairs[m.pairIdx[1]];
    teamA = { name: pa.players.join("・"), color: pa.color, players: pa.players.slice() };
    let c1 = pb.color;
    if (c1 === pa.color) c1 = "#FF5B3A";
    teamB = { name: pb.players.join("・"), color: c1, players: pb.players.slice() };
  }
  const label = d.level + "級 · " + (phase === "ko" ? m.roundName : ("第" + (m.round + 1) + "輪"));
  return {
    event: t.event + " · " + label,
    mode: "doubles", target: t.target, rule: t.rule, bestOf,
    teams: [teamA, teamB], firstServe: 0,
    tournamentRef: { division: di, phase: phase, id: m.id },
  };
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ padding: 32, color: '#FF5B5B', fontFamily: 'monospace', fontSize: 14 }}>
        <b>畫面渲染錯誤（React crash）</b><br /><br />
        {String(this.state.err)}<br /><br />
        <button onClick={() => { localStorage.removeItem(LS_CURRENT); localStorage.removeItem(LS_TOURNAMENT); location.reload(); }}
          style={{ padding: '8px 16px', cursor: 'pointer', background: '#1A2843', color: '#EEF3FF', border: '1px solid #FF5B5B', borderRadius: 8 }}>
          清除存檔並重新載入
        </button>
      </div>
    );
  }
}

// socket 在 App 掛載後才初始化，避免 polling 403 錯誤影響首次 render
// 使用 websocket 傳輸，跳過 HTTP polling（避免與 MetaMask 等擴充功能衝突）
function initSocket() {
  try {
    if (typeof io === 'undefined') return null;
    return io({ transports: ['websocket'], reconnectionAttempts: 5 });
  } catch (e) { return null; }
}

function loadJSON(key, fb) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch (e) { return fb; }
}
function saveJSON(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
}

// 只接受目前的雙級別賽事格式；舊版存檔（無 divisions）一律丟棄，避免 crash
function isValidTournament(t) {
  return !!(t && Array.isArray(t.divisions) && t.divisions.every(
    (d) => d && Array.isArray(d.pairs) && Array.isArray(d.matches)
  ));
}
function loadTournament() {
  const t = loadJSON(LS_TOURNAMENT, null);
  if (isValidTournament(t)) return t;
  if (t) localStorage.removeItem(LS_TOURNAMENT); // 清掉不相容的舊存檔
  return null;
}

function buildRecord(st) {
  return {
    event: st.config.event,
    mode: st.config.mode,
    target: st.config.target,
    rule: st.config.rule,
    teams: st.config.teams.map((t) => ({ name: t.name, color: t.color })),
    games: st.completed.map((g) => ({ scores: g.scores, winner: g.winner })),
    gamesWon: st.gamesWon.slice(),
    matchWinner: st.matchWinner,
    when: new Date().toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
}

function App() {
  const saved = React.useRef(loadJSON(LS_CURRENT, null));
  const [screen, setScreen] = React.useState(saved.current && saved.current.st ? "match" : "setup");
  const [st, setSt] = React.useState(saved.current?.st ?? null);
  const [undoStack, setUndoStack] = React.useState(saved.current?.undoStack ?? []);
  const [displaySwap, setDisplaySwap] = React.useState(saved.current?.displaySwap ?? false);
  const [records, setRecords] = React.useState(loadJSON(LS_RECORDS, []));
  const [tournament, setTournament] = React.useState(loadTournament());
  const [showHistory, setShowHistory] = React.useState(false);
  const justSaved = React.useRef(false);
  const socketRef = React.useRef(null);

  // 持久化目前比賽到 localStorage
  React.useEffect(() => {
    if (st) saveJSON(LS_CURRENT, { st, undoStack, displaySwap });
    else localStorage.removeItem(LS_CURRENT);
  }, [st, undoStack, displaySwap]);

  // 持久化賽事到 localStorage
  React.useEffect(() => {
    if (tournament) saveJSON(LS_TOURNAMENT, tournament);
    else localStorage.removeItem(LS_TOURNAMENT);
  }, [tournament]);

  // WebSocket：React 掛載後才初始化，避免影響首次 render
  React.useEffect(() => {
    const s = initSocket();
    if (!s) return;
    socketRef.current = s;
    s.on('state:sync', ({ st: newSt, undoStack: newUndo, tournament: newT }) => {
      setSt(newSt ?? null);
      setUndoStack(newUndo ?? []);
      if (newT !== undefined) setTournament(isValidTournament(newT) ? newT : null);
      if (newSt) setScreen("match");
    });
    return () => { s.disconnect(); socketRef.current = null; };
  }, []);

  function persistRecords(nr) { saveJSON(LS_RECORDS, nr); }

  // 將最新狀態（含賽事）推送給伺服器，伺服器再廣播給其他裝置
  function broadcast(newSt, newUndo, newTournament) {
    if (socketRef.current) socketRef.current.emit('state:push', { st: newSt, undoStack: newUndo, tournament: newTournament });
  }

  function handleStart(config) {
    const m = PB.createMatch(config);
    setSt(m);
    setUndoStack([]);
    setDisplaySwap(false);
    justSaved.current = false;
    setScreen("match");
    broadcast(m, [], tournament);
  }

  function handleRally(team) {
    if (!st || st.matchOver) return;
    const next = PB.applyRally(st, team);
    const newUndo = [...undoStack, PB.clone(st)];
    setUndoStack(newUndo);
    let nextTournament = tournament;
    if (next.matchOver && !st.matchOver) {
      const rec = buildRecord(next);
      setRecords((r) => { const nr = [rec, ...r]; persistRecords(nr); return nr; });
      justSaved.current = true;
      // 賽事比賽結束 → 把結果回填賽事
      const ref = next.config.tournamentRef;
      if (ref && tournament) {
        nextTournament = ref.phase === "ko"
          ? TB.applyKoResult(tournament, ref.division, ref.id, next)
          : TB.applyMatchResult(tournament, ref.division, ref.id, next);
        setTournament(nextTournament);
      }
    }
    setSt(next);
    broadcast(next, newUndo, nextTournament);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    if (st.matchOver && justSaved.current) {
      setRecords((r) => { const nr = r.slice(1); persistRecords(nr); return nr; });
      justSaved.current = false;
    }
    const prev = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);
    setUndoStack(newUndo);
    setSt(prev);
    broadcast(prev, newUndo, tournament);
  }

  function handleNewMatch() {
    setScreen("setup");
  }
  function handleClearRecords() {
    setRecords([]); persistRecords([]);
  }

  // ---------- 賽事（多組循環）----------
  function handleDrawTournament(names, opts) {
    const t = TB.drawTournament(names, opts);
    setTournament(t);
    broadcast(st, undoStack, t);
  }
  function handleResetTournament() {
    setTournament(null);
    broadcast(st, undoStack, null);
  }
  function handleBuildKnockout(division) {
    if (!tournament) return;
    const after = TB.buildKnockout(tournament, division);
    setTournament(after);
    broadcast(st, undoStack, after);
  }
  function startTournamentMatch(division, phase, id) {
    if (!tournament) return;
    const m = TB.findMatch(tournament, division, id);
    if (!m || !TB.matchReady(m)) return;
    const cfg = tournamentMatchConfig(tournament, phase, m);
    const match = PB.createMatch(cfg);
    setSt(match);
    setUndoStack([]);
    setDisplaySwap(false);
    justSaved.current = false;
    setScreen("match");
    broadcast(match, [], tournament);
  }
  // 賽事比賽打完後返回賽程（清掉當前比賽，並通知其他裝置離開計分板）
  function handleBackToTournament() {
    setSt(null);
    setUndoStack([]);
    justSaved.current = false;
    setScreen("tournament");
    broadcast(null, [], tournament);
  }

  return (
    <div className="stage">
      <div className="app-bg" />
      {screen === "setup" && (
        <SetupScreen
          initial={st ? st.config : null}
          resumable={!!st && !st.matchOver}
          onResume={() => setScreen("match")}
          onStart={handleStart}
          onTournament={() => setScreen("tournament")}
        />
      )}
      {screen === "tournament" && (
        <TournamentScreen
          tournament={tournament}
          onDraw={handleDrawTournament}
          onStartMatch={startTournamentMatch}
          onBuildKnockout={handleBuildKnockout}
          onReset={handleResetTournament}
          onBack={() => setScreen("setup")}
        />
      )}
      {screen === "match" && st && (
        <Scoreboard
          st={st}
          displaySwap={displaySwap}
          canUndo={undoStack.length > 0}
          onRally={handleRally}
          onUndo={handleUndo}
          onSwap={() => setDisplaySwap((v) => !v)}
          onHistory={() => setShowHistory(true)}
          onSettings={() => setScreen("setup")}
        />
      )}
      {st && st.matchOver && screen === "match" && (
        <VictoryOverlay
          st={st}
          onNew={st.config.tournamentRef ? handleBackToTournament : handleNewMatch}
          newLabel={st.config.tournamentRef ? "返回賽程" : "新比賽"}
          onHistory={() => setShowHistory(true)}
        />
      )}
      {showHistory && (
        <HistoryPanel records={records} onClose={() => setShowHistory(false)} onClear={handleClearRecords} />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
