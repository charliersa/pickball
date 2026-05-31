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

function Scoreboard({ st, displaySwap, onRally, onUndo, canUndo, onSwap, onHistory, onSettings }) {
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

      <div className="board">
        <TeamPanel st={st} team={order[0]} side="left" onRally={onRally} />
        <div className="center-col">
          <ScoreCall st={st} />
          <Court st={st} />
        </div>
        <TeamPanel st={st} team={order[1]} side="right" onRally={onRally} />
      </div>

      <div className="controls">
        <button className="btn" onClick={onUndo} disabled={!canUndo}><Icon name="undo" /> 回上一步</button>
        <button className="btn ghost" onClick={onSwap}><Icon name="swap" /> 交換顯示</button>
        <div className="spacer" />
        <span className="hint">點擊<b>贏得該球</b>的一方記分</span>
      </div>
    </div>
  );
}

window.Scoreboard = Scoreboard;
