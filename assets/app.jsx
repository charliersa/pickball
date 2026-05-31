/* ============================================================
   App 根元件：狀態、Undo、持久化、歷史、WebSocket 同步
   ============================================================ */
const LS_CURRENT = "pb_current_v1";
const LS_RECORDS = "pb_records_v1";

// ?reset 參數：清除 localStorage 後跳回首頁，解決損壞狀態導致白畫面
if (new URLSearchParams(location.search).has('reset')) {
  localStorage.removeItem(LS_CURRENT);
  localStorage.removeItem(LS_RECORDS);
  history.replaceState(null, '', '/');
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
        <button onClick={() => { localStorage.removeItem(LS_CURRENT); location.reload(); }}
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
  const [showHistory, setShowHistory] = React.useState(false);
  const justSaved = React.useRef(false);
  const socketRef = React.useRef(null);

  // 持久化目前比賽到 localStorage
  React.useEffect(() => {
    if (st) saveJSON(LS_CURRENT, { st, undoStack, displaySwap });
    else localStorage.removeItem(LS_CURRENT);
  }, [st, undoStack, displaySwap]);

  // WebSocket：React 掛載後才初始化，避免影響首次 render
  React.useEffect(() => {
    const s = initSocket();
    if (!s) return;
    socketRef.current = s;
    s.on('state:sync', ({ st: newSt, undoStack: newUndo }) => {
      setSt(newSt ?? null);
      setUndoStack(newUndo ?? []);
      if (newSt) setScreen("match");
    });
    return () => { s.disconnect(); socketRef.current = null; };
  }, []);

  function persistRecords(nr) { saveJSON(LS_RECORDS, nr); }

  // 將最新狀態推送給伺服器，伺服器再廣播給其他裝置
  function pushState(newSt, newUndo) {
    if (socketRef.current) socketRef.current.emit('state:push', { st: newSt, undoStack: newUndo });
  }

  function handleStart(config) {
    const m = PB.createMatch(config);
    setSt(m);
    setUndoStack([]);
    setDisplaySwap(false);
    justSaved.current = false;
    setScreen("match");
    pushState(m, []);
  }

  function handleRally(team) {
    if (!st || st.matchOver) return;
    const next = PB.applyRally(st, team);
    const newUndo = [...undoStack, PB.clone(st)];
    setUndoStack(newUndo);
    if (next.matchOver && !st.matchOver) {
      const rec = buildRecord(next);
      setRecords((r) => { const nr = [rec, ...r]; persistRecords(nr); return nr; });
      justSaved.current = true;
    }
    setSt(next);
    pushState(next, newUndo);
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
    pushState(prev, newUndo);
  }

  function handleNewMatch() {
    setScreen("setup");
  }
  function handleClearRecords() {
    setRecords([]); persistRecords([]);
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
        <VictoryOverlay st={st} onNew={handleNewMatch} onHistory={() => setShowHistory(true)} />
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
