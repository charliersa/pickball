/* ============================================================
   歷史對戰紀錄抽屜
   ============================================================ */
function HistoryPanel({ records, onClose, onClear }) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <h2>歷史對戰紀錄</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="drawer-body">
          {(!records || records.length === 0) && (
            <div className="hist-empty">尚無已完成的比賽<br />完成一場比賽後會自動記錄於此</div>
          )}
          {records && records.map((r, i) => {
            const w = r.matchWinner;
            return (
              <div className="hist-item" key={i}>
                <div className="hi-top">
                  <span className="hi-mode">{r.event}</span>
                  <span className="hi-when">{r.when}</span>
                </div>
                <div className="hi-teams">
                  {[0, 1].map((tm) => (
                    <div className="hi-team-row" key={tm}>
                      <span className="hi-dot" style={{ background: r.teams[tm].color }} />
                      <span className={"hi-tn" + (tm === w ? " win" : "")}>
                        {r.teams[tm].name}
                        {tm === w && <Icon name="trophy" className="hi-trophy" style={{ display: "inline", verticalAlign: "-3px", marginLeft: 6 }} />}
                      </span>
                      <span className="hi-scores">
                        {r.games.map((g, k) => (
                          <span key={k} className={g.winner === tm ? "win" : ""}>{g.scores[tm]}</span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                  {r.mode === "doubles" ? "雙打" : "單打"} · {r.target} 分 · {r.rule === "rally" ? "Rally 制" : "發球得分制"} · {r.gamesWon[w]}:{r.gamesWon[1 - w]}
                </div>
              </div>
            );
          })}
        </div>
        {records && records.length > 0 && (
          <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)" }}>
            <button className="btn ghost danger" onClick={onClear} style={{ width: "100%", justifyContent: "center" }}>清除所有紀錄</button>
          </div>
        )}
      </div>
    </>
  );
}
window.HistoryPanel = HistoryPanel;
