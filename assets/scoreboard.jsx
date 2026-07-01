/* ============================================================
   主計分板：球場圖、隊伍面板、唱分、控制列
   ============================================================ */

function Court({ st }) {
  const doubles = st.config.mode === "doubles";
  const info = PB.serveInfo(st);
  const serveTeam = st.serveTeam;
  const recvTeam = 1 - serveTeam;
  const cA = st.config.teams[serveTeam].color;
  const cB = st.config.teams[recvTeam].color;

  // 底=發球方、頂=接發方
  const cells = [];
  const tok = (key, cls, color, label, serving) => (
    <div className={"cell " + key} key={key}>
      <div className={"token" + (serving ? " serving" : "")} style={{ "--tk": color, background: serving ? undefined : color + "33", borderColor: color }}>
        {label}
      </div>
    </div>
  );

  if (doubles) {
    const sR = st.rightIdx[serveTeam], sL = 1 - sR;
    const rR = st.rightIdx[recvTeam], rL = 1 - rR;
    const srvSideRight = info.side === "right";
    cells.push(tok("b-right", "", cA, sR + 1, srvSideRight && info.playerIdx === sR));
    cells.push(tok("b-left", "", cA, sL + 1, !srvSideRight && info.playerIdx === sL));
    cells.push(tok("t-right", "", cB, rR + 1, false));
    cells.push(tok("t-left", "", cB, rL + 1, false));
  } else {
    const srvRight = info.side === "right";
    // 發球方在底，接發方對角
    cells.push(tok(srvRight ? "b-right" : "b-left", "", cA, "S", true));
    cells.push(tok(srvRight ? "t-left" : "t-right", "", cB, "R", false));
  }

  return (
    <div className="court-wrap">
      <div className="court">
        <div className="kitchen top" />
        <div className="kitchen bot" />
        <div className="net" />
        <div className="mid" />
        {cells}
      </div>
      <div className="court-cap">{info.side === "right" ? "右發球區 · 偶數區" : "左發球區 · 奇數區"}</div>
    </div>
  );
}

function TeamPanel({ st, team, side, onRally }) {
  const t = st.config.teams[team];
  const doubles = st.config.mode === "doubles";
  const info = PB.serveInfo(st);
  const serving = info.team === team;
  const gp = PB.gamePointInfo(st)[team];
  const need = PB.neededGames(st);
  const [press, setPress] = React.useState(false);

  const isMatchPoint = gp && st.gamesWon[team] === need - 1;

  return (
    <div
      className={"team-panel" + (serving ? " serving" : "") + (press ? " pressed" : "")}
      style={{ "--tc": t.color, "--tc-fade": t.color + "26", "--tc-glow": t.color + "55" }}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
      onClick={() => onRally(team)}
    >
      <div className="tp-top">
        <div className="tp-bar" />
        <div className="tp-name">{t.name}</div>
        <div className="players">
          {t.players.map((p, j) => {
            const isServer = serving && (doubles ? info.playerIdx === j : true);
            return (
              <div className={"player" + (isServer ? " serving" : "")} key={j}>
                <span className="ball" />
                <span>{p}</span>
                {doubles && isServer && <span className="snum">{info.num}</span>}
                {doubles && !isServer && <span className="pos">{st.rightIdx[team] === j ? "右" : "左"}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="tp-score">{st.scores[team]}</div>

      <div className="tp-gamewins">
        {Array.from({ length: need }).map((_, k) => (
          <span className={"gw" + (k < st.gamesWon[team] ? " on" : "")} key={k} />
        ))}
      </div>

      <div className={"gp-flag" + (gp ? " show" : "")}>
        {isMatchPoint ? "賽末點 MATCH POINT" : "局點 GAME POINT"}
      </div>
    </div>
  );
}

function ScoreCall({ st }) {
  const call = PB.scoreCall(st);
  const doubles = st.config.mode === "doubles";
  const rally = st.config.rule === "rally";
  return (
    <div className="scorecall">
      <div className="sc-label">{rally ? "比分 SCORE" : "唱分 SCORE CALL"}</div>
      <div className="sc-nums">
        <span className="sc-srv">{call.parts[0]}</span>
        <span className="sc-sep">·</span>
        <span>{call.parts[1]}</span>
        {!rally && doubles && (
          <>
            <span className="sc-sep">·</span>
            <span className="sc-srv">{call.parts[2]}</span>
          </>
        )}
      </div>
    </div>
  );
}

// 輸入計分模式：逐局輸入最終比分
function ScoreInputPanel({ st, onGameScore }) {
  const [a, setA] = React.useState("");
  const [b, setB] = React.useState("");
  const [err, setErr] = React.useState("");
  const target = st.config.target;
  const teamA = st.config.teams[0], teamB = st.config.teams[1];

  function confirm() {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    if (isNaN(na) || isNaN(nb)) { setErr("請輸入兩隊分數"); return; }
    if (na === nb) { setErr("兩隊分數不能相同"); return; }
    const hi = Math.max(na, nb), lo = Math.min(na, nb);
    if (hi < target) { setErr(`勝方需達 ${target} 分`); return; }
    if (hi - lo < 2) { setErr("需領先 2 分"); return; }
    setErr("");
    onGameScore(na, nb);
    setA(""); setB("");
  }

  const teamRow = (t, val, setVal, color) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color, flex: "0 0 auto" }} />
      <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {t.name}
        <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 13, marginLeft: 8 }}>{t.players.join("・")}</span>
      </div>
      <input
        className="input" type="number" inputMode="numeric" min="0" value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
        style={{ width: 96, marginBottom: 0, textAlign: "center", fontSize: 26, fontWeight: 800, fontFamily: "var(--font-num)", padding: "8px 10px" }}
        placeholder="0"
      />
    </div>
  );

  return (
    <div className="board" style={{ display: "block", padding: "8px 4px" }}>
      <div className="card" style={{ maxWidth: 460, margin: "0 auto" }}>
        <h2 style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>第 {st.gameIndex + 1} 局 · 輸入最終比分</span>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{target} 分 · 領先 2 分</span>
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 6 }}>
          {teamRow(teamA, a, setA, teamA.color)}
          {teamRow(teamB, b, setB, teamB.color)}
        </div>
        {err && <div style={{ color: "var(--danger)", fontWeight: 700, fontSize: 13, marginTop: 12 }}>{err}</div>}
        <button className="btn primary" onClick={confirm} style={{ width: "100%", justifyContent: "center", marginTop: 16 }}>
          確認本局 →
        </button>
        {st.completed.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>已完成局數</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {st.completed.map((g, i) => (
                <span key={i} style={{ fontFamily: "var(--font-num)", fontWeight: 700, fontSize: 15, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "4px 10px" }}>
                  <span style={{ color: g.winner === 0 ? "var(--gold)" : "var(--ink)" }}>{g.scores[0]}</span>
                  <span style={{ color: "var(--muted)", margin: "0 5px" }}>:</span>
                  <span style={{ color: g.winner === 1 ? "var(--gold)" : "var(--ink)" }}>{g.scores[1]}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Scoreboard({ st, displaySwap, onRally, onGameScore, onUndo, canUndo, onSwap, onHistory, onSettings }) {
  const [inputMode, setInputMode] = React.useState(false);
  const order = displaySwap ? [1, 0] : [0, 1];
  const showSwitch = st.switchEnds;
  const ruleLabel = st.config.rule === "rally" ? "Rally 制" : "發球得分制";
  const modeLabel = st.config.mode === "doubles" ? "雙打" : "單打";

  return (
    <div className="match">
      <div className="topbar">
        <div className="event">
          <div className="brand-mark" style={{ width: 38, height: 38, borderRadius: 10 }}>
            <Icon name="ball" stroke="#1a2a00" width="22" height="22" />
          </div>
          <span className="nm">{st.config.event}</span>
        </div>
        <span className="chip">{modeLabel}</span>
        <span className="chip">{st.config.target} 分</span>
        <span className="chip">{ruleLabel}</span>
        <div className="spacer" />
        <div className="games-pips">
          <div className="game-track">
            <span className="gt-label">局數</span>
            <span className="pip-row">
              {Array.from({ length: st.config.bestOf }).map((_, k) => {
                const c = st.completed[k];
                return <span key={k} className={"pip" + (c ? (c.winner === 0 ? " a" : " b") : "")} />;
              })}
            </span>
          </div>
        </div>
        <div className="top-chips">
          <button className="icon-btn" onClick={onHistory} title="歷史紀錄"><Icon name="history" /></button>
          <button className="icon-btn" onClick={onSettings} title="新比賽 / 設定"><Icon name="settings" /></button>
        </div>
      </div>

      {showSwitch && (
        <div className="switch-banner"><Icon name="swap" width="18" height="18" /> 請交換場邊 · 第 {st.gameIndex + 1} 局</div>
      )}

      {inputMode ? (
        <ScoreInputPanel st={st} onGameScore={onGameScore} />
      ) : (
        <div className="board">
          <TeamPanel st={st} team={order[0]} side="left" onRally={onRally} />
          <div className="center-col">
            <ScoreCall st={st} />
            <Court st={st} />
          </div>
          <TeamPanel st={st} team={order[1]} side="right" onRally={onRally} />
        </div>
      )}

      <div className="controls">
        <button className="btn" onClick={onUndo} disabled={!canUndo}><Icon name="undo" /> 回上一步</button>
        {!inputMode && <button className="btn ghost" onClick={onSwap}><Icon name="swap" /> 交換顯示</button>}
        <div className="seg" style={{ marginLeft: 4 }}>
          <button className={!inputMode ? "on" : ""} onClick={() => setInputMode(false)}>點擊</button>
          <button className={inputMode ? "on" : ""} onClick={() => setInputMode(true)}>輸入</button>
        </div>
        <div className="spacer" />
        <span className="hint">
          {inputMode ? <>輸入<b>本局最終比分</b>後按確認</> : <>點擊<b>贏得該球</b>的一方記分</>}
        </span>
      </div>
    </div>
  );
}

window.Scoreboard = Scoreboard;
