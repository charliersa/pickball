/* ============================================================
   觀眾看板（/）— 唯讀
   即時同步操作者的比賽狀態，分頁顯示：
     即時比分 · 積分榜 · 對戰表 · 賽果
   重用 scoreboard.jsx / bracket.jsx 的顯示元件（babel 頂層函式為全域）。
   ============================================================ */

// 取隊伍名字（可能是球員陣列，或 {players} 物件，或 null）
function specTeamNames(team) {
  if (!team) return "—";
  const names = Array.isArray(team) ? team : team.players;
  return (names || []).join("・");
}

// 唯讀即時計分板：重用 TeamPanel / ScoreCall / Court，但不接受任何操作
function SpectatorBoard({ st }) {
  const ruleLabel = st.config.rule === "rally" ? "Rally 制" : "發球得分制";
  const modeLabel = st.config.mode === "doubles" ? "雙打" : "單打";
  const noop = () => {};

  return (
    <div className="match spectator-match">
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
        <span className="chip live-chip"><span className="live-dot" />LIVE</span>
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
      </div>

      {st.matchOver && (
        <div className="spec-winner">
          <Icon name="trophy" width="20" height="20" />
          {st.config.teams[st.matchWinner].name} 勝出 · {st.gamesWon[st.matchWinner]}:{st.gamesWon[1 - st.matchWinner]}
        </div>
      )}
      {!st.matchOver && st.switchEnds && (
        <div className="switch-banner"><Icon name="swap" width="18" height="18" /> 交換場邊 · 第 {st.gameIndex + 1} 局</div>
      )}

      <div className="board">
        <TeamPanel st={st} team={0} side="left" onRally={noop} />
        <div className="center-col">
          <ScoreCall st={st} />
          <Court st={st} />
        </div>
        <TeamPanel st={st} team={1} side="right" onRally={noop} />
      </div>
    </div>
  );
}

// 唯讀對戰列（無「開始計分」按鈕）
function SpecMatchRow({ m, label, color }) {
  const done = m.status === "done";
  const winner = done && m.result ? m.result.winner : null;
  const score = done && m.result ? `${m.result.gamesWon[0]}:${m.result.gamesWon[1]}` : "vs";
  const bothReady = m.teams[0] && m.teams[1];
  return (
    <div style={{
      background: "var(--panel-2)", border: "1px solid var(--line)", borderLeft: `3px solid ${color || "var(--line-2)"}`,
      borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{label}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <span style={{ fontWeight: winner === 0 ? 800 : 600, color: winner === 0 ? "var(--gold)" : "var(--ink)" }}>{specTeamNames(m.teams[0])}</span>
          <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>{score}</span>
          <span style={{ fontWeight: winner === 1 ? 800 : 600, color: winner === 1 ? "var(--gold)" : "var(--ink)" }}>{specTeamNames(m.teams[1])}</span>
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: done ? "var(--serve)" : bothReady ? "var(--ink-dim)" : "var(--muted)" }}>
        {done ? "已完成" : bothReady ? "待開賽" : "等待晉級"}
      </span>
    </div>
  );
}

// 唯讀分級檢視：view='standing' 只顯示積分榜；view='bracket' 顯示配對 + 賽程/淘汰賽
function SpecDivisionView({ t, di, view }) {
  const d = t.divisions[di];
  const courtMatches = (c) => d.matches.filter((m) => m.court === c).sort((a, b) => a.slot - b.slot);

  if (view === "standing") {
    return <DivisionStanding t={t} di={di} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <h2>抽籤配對（{d.pairs.length} 對）</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {d.pairs.map((p) => (
            <div key={p.idx} style={{ border: "1px solid var(--line)", borderTop: `3px solid ${p.color}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontWeight: 800, marginBottom: 4, color: p.color }}>{p.tag}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{p.players[0]}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{p.players[1]}</div>
            </div>
          ))}
        </div>
      </div>

      {d.ko && (
        <div className="card">
          <h2>淘汰賽</h2>
          {d.ko.champion && (
            <div style={{ textAlign: "center", padding: "14px 0", marginBottom: 10, background: "var(--panel-2)", borderRadius: 12, border: "1px solid var(--gold)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)", letterSpacing: 1 }}>
                <Icon name="trophy" style={{ display: "inline", width: 15, height: 15, verticalAlign: "-2px", marginRight: 5 }} />{d.level} 級冠軍
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{d.ko.champion.name}</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {d.ko.matches.map((m) => (
              <SpecMatchRow key={m.id} m={m} label={`${m.roundName} · 場地 ${m.court + 1}`} color="var(--gold)" />
            ))}
          </div>
        </div>
      )}

      {!d.ko && (
        <div className="card">
          <h2>賽程表（2 場地 · 5 輪）</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {[0, 1].map((c) => (
              <div key={c}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink-dim)", marginBottom: 8 }}>場地 {c + 1}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {courtMatches(c).map((m) => (
                    <SpecMatchRow key={m.id} m={m} label={`第 ${m.slot + 1} 輪`} color={d.pairs[m.pairIdx[0]].color} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 賽果：彙整所有分級「已完成」的比賽（循環 + 淘汰）
function SpecResults({ t }) {
  const rows = [];
  t.divisions.forEach((d, di) => {
    d.matches.forEach((m) => {
      if (m.status === "done" && m.result) rows.push({ di, level: d.level, label: `第 ${m.round + 1} 輪`, m });
    });
    if (d.ko) d.ko.matches.forEach((m) => {
      if (m.status === "done" && m.result) rows.push({ di, level: d.level, label: m.roundName, m });
    });
  });

  if (rows.length === 0) {
    return <div className="hist-empty">尚無已完成的比賽<br />比賽結束後賽果會顯示於此</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((row, i) => {
        const m = row.m, res = m.result, w = res.winner;
        return (
          <div className="card" key={i} style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>
              <span>{row.level} 級 · {row.label}</span>
              <span>{res.gamesWon[0]}:{res.gamesWon[1]}</span>
            </div>
            {[0, 1].map((side) => (
              <div key={side} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                <span style={{ flex: 1, fontWeight: side === w ? 800 : 600, color: side === w ? "var(--gold)" : "var(--ink)" }}>
                  {specTeamNames(m.teams[side])}
                  {side === w && <Icon name="trophy" style={{ display: "inline", width: 13, height: 13, verticalAlign: "-2px", marginLeft: 5 }} />}
                </span>
                <span style={{ display: "flex", gap: 8, fontFamily: "var(--font-num)", fontWeight: 700 }}>
                  {res.games.map((g, k) => (
                    <span key={k} style={{ color: g.winner === side ? "var(--gold)" : "var(--muted)" }}>{g.scores[side]}</span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SpectatorApp() {
  const [st, setSt] = React.useState(null);
  const [tournament, setTournament] = React.useState(null);
  const [tab, setTab] = React.useState("live");
  const [di, setDi] = React.useState(0);

  React.useEffect(() => {
    const s = initSocket();
    if (!s) return;
    s.on("state:sync", ({ st: newSt, tournament: newT }) => {
      setSt(newSt ?? null);
      if (newT !== undefined) setTournament(isValidTournament(newT) ? newT : null);
    });
    return () => { s.disconnect(); };
  }, []);

  const hasLive = !!st;
  // 有新的即時比賽時自動切到「即時比分」
  const prevLive = React.useRef(false);
  React.useEffect(() => {
    if (hasLive && !prevLive.current) setTab("live");
    prevLive.current = hasLive;
  }, [hasLive]);

  const hasT = !!(tournament && Array.isArray(tournament.divisions));
  const divIdx = hasT ? Math.min(di, tournament.divisions.length - 1) : 0;

  const TABS = [
    { key: "live", label: "即時比分" },
    { key: "standing", label: "積分榜" },
    { key: "bracket", label: "對戰表" },
    { key: "result", label: "賽果" },
  ];

  return (
    <div className="setup-scroll">
      <div className="setup" style={{ maxWidth: 940 }}>
        <div className="setup-head">
          <div className="brand-mark"><Icon name="ball" stroke="#1a2a00" /></div>
          <div>
            <h1>{hasT ? tournament.event : "匹克球即時看板"}</h1>
            <p>{hasT ? `${tournament.divisions.length} 級別 · ${tournament.target} 分${tournament.rule === "rally" ? " · Rally" : ""}` : "即時比分 · 積分榜 · 賽果"}</p>
          </div>
        </div>

        <div className="seg full spec-tabs">
          {TABS.map((tb) => (
            <button key={tb.key} className={tab === tb.key ? "on" : ""} onClick={() => setTab(tb.key)}>{tb.label}</button>
          ))}
        </div>

        {/* 分級分頁（積分榜 / 對戰表用） */}
        {hasT && (tab === "standing" || tab === "bracket") && tournament.divisions.length > 1 && (
          <div className="seg full" style={{ marginBottom: 4 }}>
            {tournament.divisions.map((d, k) => (
              <button key={k} className={divIdx === k ? "on" : ""} onClick={() => setDi(k)}>
                {d.level} 級{d.ko && d.ko.champion ? " 🏆" : ""}
              </button>
            ))}
          </div>
        )}

        {tab === "live" && (
          hasLive
            ? <SpectatorBoard st={st} />
            : <div className="card"><div className="hist-empty">目前沒有進行中的比賽<br />比賽開始後即時比分會顯示於此</div></div>
        )}

        {tab === "standing" && (
          hasT ? <SpecDivisionView t={tournament} di={divIdx} view="standing" />
               : <div className="card"><div className="hist-empty">尚未建立賽事<br />主辦方抽籤分組後會顯示積分榜</div></div>
        )}

        {tab === "bracket" && (
          hasT ? <SpecDivisionView t={tournament} di={divIdx} view="bracket" />
               : <div className="card"><div className="hist-empty">尚未建立賽事<br />主辦方抽籤分組後會顯示對戰表</div></div>
        )}

        {tab === "result" && (
          <div className="card">
            <h2>賽果</h2>
            {hasT ? <SpecResults t={tournament} />
                  : <div className="hist-empty">尚未建立賽事<br />比賽結束後賽果會顯示於此</div>}
          </div>
        )}
      </div>
    </div>
  );
}
window.SpectatorApp = SpectatorApp;
