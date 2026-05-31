/* ============================================================
   勝利畫面 + 彩帶
   ============================================================ */
function Confetti({ colors }) {
  const bits = React.useMemo(() => {
    const arr = [];
    const palette = colors && colors.length ? colors.concat(["#FFC53D", "#C7F03A", "#FFFFFF"]) : ["#FFC53D", "#C7F03A", "#19C3FB", "#FF5B3A", "#FFFFFF"];
    for (let i = 0; i < 120; i++) {
      arr.push({
        left: Math.random() * 100,
        delay: Math.random() * 2.2,
        dur: 2.6 + Math.random() * 2.4,
        color: palette[i % palette.length],
        w: 7 + Math.random() * 8,
        h: 10 + Math.random() * 12,
        rot: Math.random() * 360,
        round: Math.random() > 0.7,
      });
    }
    return arr;
  }, [colors]);
  return (
    <div className="confetti">
      {bits.map((b, i) => (
        <i key={i} style={{
          left: b.left + "%", animationDelay: b.delay + "s", animationDuration: b.dur + "s",
          background: b.color, width: b.w, height: b.h, transform: `rotate(${b.rot}deg)`,
          borderRadius: b.round ? "50%" : "2px",
        }} />
      ))}
    </div>
  );
}

function VictoryOverlay({ st, onNew, onHistory }) {
  const w = st.matchWinner;
  const team = st.config.teams[w];
  const loser = st.config.teams[1 - w];
  return (
    <>
      <Confetti colors={[team.color]} />
      <div className="victory" style={{ "--win-color": team.color, "--win-glow": team.color + "33", "--win-glow2": team.color + "88" }}>
        <div className="champ-label"><Icon name="trophy" width="15" height="15" style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />Champion</div>
        <div className="champ-name">{team.name}</div>
        <div className="champ-sub">
          {st.gamesWon[w]} : {st.gamesWon[1 - w]} 勝出 · {st.config.mode === "doubles" ? "雙打" : "單打"} {st.config.target} 分制
        </div>
        <div className="champ-games">
          {st.completed.map((g, i) => (
            <div className="gx" key={i}>
              <span className={g.winner === w ? "w" : ""}>{g.scores[w]}</span>
              <span style={{ color: "var(--muted)", margin: "0 4px" }}>:</span>
              <span className={g.winner !== w ? "w" : ""}>{g.scores[1 - w]}</span>
            </div>
          ))}
        </div>
        <div className="champ-actions">
          <button className="btn ghost" onClick={onHistory}><Icon name="history" /> 查看紀錄</button>
          <button className="btn primary" onClick={onNew}><Icon name="home" /> 新比賽</button>
        </div>
      </div>
    </>
  );
}

window.VictoryOverlay = VictoryOverlay;
