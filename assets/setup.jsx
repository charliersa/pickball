/* ============================================================
   賽事設定畫面
   ============================================================ */
const COLOR_OPTS = ["#19C3FB", "#FF5B3A", "#C7F03A", "#A66BFF", "#FF4D9D", "#2BD4A8", "#FFC53D", "#5B8CFF"];

function SetupScreen({ onStart, initial, resumable, onResume }) {
  const [event, setEvent] = React.useState(initial?.event ?? "匹克球友誼賽");
  const [mode, setMode] = React.useState(initial?.mode ?? "doubles");
  const [target, setTarget] = React.useState(initial?.target ?? 11);
  const [rule, setRule] = React.useState(initial?.rule ?? "sideout");
  const [firstServe, setFirstServe] = React.useState(initial?.firstServe ?? 0);
  const [teams, setTeams] = React.useState(initial?.teams ?? [
    { name: "藍隊", color: "#19C3FB", players: ["球員 A1", "球員 A2"] },
    { name: "橘隊", color: "#FF5B3A", players: ["球員 B1", "球員 B2"] },
  ]);

  function setTeam(i, patch) {
    setTeams((t) => t.map((tm, k) => (k === i ? { ...tm, ...patch } : tm)));
  }
  function setPlayer(i, j, v) {
    setTeams((t) => t.map((tm, k) => (k === i ? { ...tm, players: tm.players.map((p, q) => (q === j ? v : p)) } : tm)));
  }

  function start() {
    const cleanTeams = teams.map((tm, i) => ({
      name: tm.name.trim() || (i === 0 ? "A 隊" : "B 隊"),
      color: tm.color,
      players: (mode === "doubles" ? tm.players.slice(0, 2) : tm.players.slice(0, 1))
        .map((p, j) => p.trim() || `球員 ${i === 0 ? "A" : "B"}${j + 1}`),
    }));
    onStart({ event: event.trim() || "匹克球比賽", mode, target, rule, bestOf: 3, teams: cleanTeams, firstServe });
  }

  return (
    <div className="setup-scroll">
      <div className="setup">
        <div className="setup-head">
          <div className="brand-mark"><Icon name="ball" stroke="#1a2a00" /></div>
          <div>
            <h1>匹克球比賽即時計分</h1>
            <p>設定賽制與隊伍，開始記分 · 三局兩勝</p>
          </div>
        </div>

        <div className="card">
          <h2>賽事</h2>
          <div className="field">
            <label>賽事名稱</label>
            <input className="input" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="例：社區盃決賽" />
          </div>
          <div className="rule-grid">
            <div className="field">
              <label>賽制</label>
              <div className="seg full">
                <button className={mode === "doubles" ? "on" : ""} onClick={() => setMode("doubles")}>雙打</button>
                <button className={mode === "singles" ? "on" : ""} onClick={() => setMode("singles")}>單打</button>
              </div>
            </div>
            <div className="field">
              <label>每局分數</label>
              <div className="seg full">
                <button className={target === 11 ? "on" : ""} onClick={() => setTarget(11)}>11 分</button>
                <button className={target === 15 ? "on" : ""} onClick={() => setTarget(15)}>15 分</button>
              </div>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>計分規則</label>
            <div className="seg full">
              <button className={rule === "sideout" ? "on" : ""} onClick={() => setRule("sideout")}>發球得分制</button>
              <button className={rule === "rally" ? "on" : ""} onClick={() => setRule("rally")}>Rally 每球得分</button>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 9, fontWeight: 600, lineHeight: 1.5 }}>
              {rule === "sideout"
                ? "傳統制：僅發球方得分；雙打有第 1／第 2 發球員，唱分為「發-接-發球員」。"
                : "Rally 制：每球皆得分，輸球方換發；勝負需領先 2 分。"}
            </p>
          </div>
        </div>

        <div className="teams-grid">
          {teams.map((tm, i) => (
            <div className="card team-card" key={i} style={{ "--tc": tm.color }}>
              <h2>{i === 0 ? "隊伍 A" : "隊伍 B"}</h2>
              <div className="field">
                <label>隊名</label>
                <input className="input" value={tm.name} onChange={(e) => setTeam(i, { name: e.target.value })} />
              </div>
              <div className="field">
                <label>{mode === "doubles" ? "球員（右發球區先發 → 左）" : "球員"}</label>
                <input className="input" style={{ marginBottom: 9 }} value={tm.players[0]}
                       onChange={(e) => setPlayer(i, 0, e.target.value)} placeholder="球員 1" />
                {mode === "doubles" && (
                  <input className="input" value={tm.players[1]}
                         onChange={(e) => setPlayer(i, 1, e.target.value)} placeholder="球員 2" />
                )}
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>隊色</label>
                <div className="color-row">
                  {COLOR_OPTS.map((c) => (
                    <div key={c} className={"swatch" + (tm.color === c ? " on" : "")}
                         style={{ background: c }} onClick={() => setTeam(i, { color: c })} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>先發球方</h2>
          <div className="serve-pick">
            {teams.map((tm, i) => (
              <div key={i} className={"serve-opt" + (firstServe === i ? " on" : "")} onClick={() => setFirstServe(i)}>
                <span className="dot" style={{ background: tm.color }} />
                {tm.name || (i === 0 ? "A 隊" : "B 隊")}
              </div>
            ))}
          </div>
        </div>

        <div className="setup-foot">
          {resumable && <button className="btn ghost" onClick={onResume}>← 返回目前比賽</button>}
          <button className="btn primary" onClick={start}>{resumable ? "開新比賽 →" : "開始比賽 →"}</button>
        </div>
      </div>
    </div>
  );
}
window.SetupScreen = SetupScreen;
