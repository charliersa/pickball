/* ============================================================
   賽事分配畫面（抽籤分組 → 小組循環 → 淘汰賽）
   純顯示 + 事件上拋；賽事狀態與同步由 App 管理。
   ============================================================ */
const TB_PLAYER_COUNT = 20;

function TeamLabel({ team, win }) {
  if (!team) return <span style={{ color: "var(--muted)" }}>—</span>;
  const names = Array.isArray(team) ? team : team.players;
  return (
    <span style={{ fontWeight: win ? 800 : 600, color: win ? "var(--gold)" : "var(--ink)" }}>
      {names.join("・")}
      {win && <Icon name="trophy" style={{ display: "inline", width: 14, height: 14, verticalAlign: "-2px", marginLeft: 5 }} />}
    </span>
  );
}

function MatchRow({ m, label, color, onStart }) {
  const done = m.status === "done";
  const ready = m.teams[0] && m.teams[1] && !done;
  const winner = done && m.result ? m.result.winner : (done ? m.winner : null);
  return (
    <div style={{
      background: "var(--panel-2)", border: "1px solid var(--line)", borderLeft: `3px solid ${color || "var(--line-2)"}`,
      borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{label}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <TeamLabel team={m.teams[0]} win={winner === 0} />
          <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
            {done && m.result ? `${m.result.gamesWon[0]}:${m.result.gamesWon[1]}` : "vs"}
          </span>
          <TeamLabel team={m.teams[1]} win={winner === 1} />
        </div>
      </div>
      {done ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--serve)" }}>已完成</span>
      ) : ready ? (
        <button className="btn primary" style={{ padding: "7px 12px", fontSize: 13 }} onClick={onStart}>開始計分</button>
      ) : (
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>等待晉級</span>
      )}
    </div>
  );
}

function GroupStanding({ t, gi }) {
  const rows = TB.computeGroupStanding(t, gi);
  const g = t.groups[gi];
  return (
    <div className="card" style={{ padding: 14 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: g.color, display: "inline-block" }} />
        {g.name}積分榜
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ color: "var(--muted)", fontSize: 11, textAlign: "left" }}>
            <th style={{ padding: "4px 2px" }}>#</th>
            <th style={{ padding: "4px 2px" }}>球員</th>
            <th style={{ padding: "4px 2px", textAlign: "center" }}>勝-負</th>
            <th style={{ padding: "4px 2px", textAlign: "right" }}>淨分</th>
            <th style={{ padding: "4px 2px", textAlign: "right" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "7px 2px", fontWeight: 700, color: r.advance ? "var(--gold)" : "var(--muted)" }}>{r.rank}</td>
              <td style={{ padding: "7px 2px", fontWeight: 700 }}>{r.name}</td>
              <td style={{ padding: "7px 2px", textAlign: "center", fontFamily: "var(--font-num)" }}>{r.w}-{r.l}</td>
              <td style={{ padding: "7px 2px", textAlign: "right", fontFamily: "var(--font-num)", color: r.diff > 0 ? "var(--serve)" : r.diff < 0 ? "var(--danger)" : "var(--muted)" }}>
                {r.diff > 0 ? "+" : ""}{r.diff}
              </td>
              <td style={{ padding: "7px 2px", textAlign: "right" }}>
                {r.advance && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#06090F", background: "var(--gold)", borderRadius: 5, padding: "2px 6px" }}>晉級</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TournamentScreen({ tournament, onDraw, onStartMatch, onBuildKnockout, onReset, onBack }) {
  const [names, setNames] = React.useState(() => Array.from({ length: TB_PLAYER_COUNT }, () => ""));
  const [event, setEvent] = React.useState("匹克球循環賽");
  const [target, setTarget] = React.useState(11);
  const [rule, setRule] = React.useState("sideout");

  function setName(i, v) { setNames((a) => a.map((x, k) => (k === i ? v : x))); }
  function draw() {
    onDraw(names.map((n, i) => n.trim() || `球員 ${i + 1}`), { event, target, rule });
  }

  // ---------- 尚未抽籤：輸入名單 ----------
  if (!tournament) {
    return (
      <div className="setup-scroll">
        <div className="setup">
          <div className="setup-head">
            <div className="brand-mark"><Icon name="ball" stroke="#1a2a00" /></div>
            <div>
              <h1>多組循環賽事分配</h1>
              <p>20 人 · 5 組 · 2 場地 · 抽籤分組 → 小組循環 → 淘汰賽</p>
            </div>
          </div>

          <div className="card">
            <h2>賽事設定</h2>
            <div className="field">
              <label>賽事名稱</label>
              <input className="input" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="例：社區盃循環賽" />
            </div>
            <div className="rule-grid">
              <div className="field">
                <label>每局分數</label>
                <div className="seg full">
                  <button className={target === 11 ? "on" : ""} onClick={() => setTarget(11)}>11 分</button>
                  <button className={target === 15 ? "on" : ""} onClick={() => setTarget(15)}>15 分</button>
                </div>
              </div>
              <div className="field">
                <label>計分規則</label>
                <div className="seg full">
                  <button className={rule === "sideout" ? "on" : ""} onClick={() => setRule("sideout")}>發球制</button>
                  <button className={rule === "rally" ? "on" : ""} onClick={() => setRule("rally")}>Rally</button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>球員名單（20 人）</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {names.map((n, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, width: 20, textAlign: "right", fontFamily: "var(--font-num)" }}>{i + 1}</span>
                  <input className="input" style={{ marginBottom: 0 }} value={n} onChange={(e) => setName(i, e.target.value)} placeholder={`球員 ${i + 1}`} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
              留空的會自動命名為「球員 N」。抽籤會把 20 人隨機分成 5 組、每組 4 人。
            </p>
          </div>

          <div className="setup-foot">
            <button className="btn ghost" onClick={onBack}>← 返回</button>
            <button className="btn primary" onClick={draw}>🎲 抽籤分組 →</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- 已抽籤：分組 / 賽程 / 積分 / 淘汰 ----------
  const t = tournament;
  const groupsDone = TB.groupsComplete(t);
  const courtMatches = (c) => t.matches.filter((m) => m.court === c).sort((a, b) => a.slot - b.slot);

  return (
    <div className="setup-scroll">
      <div className="setup" style={{ maxWidth: 900 }}>
        <div className="setup-head">
          <div className="brand-mark"><Icon name="ball" stroke="#1a2a00" /></div>
          <div>
            <h1>{t.event}</h1>
            <p>{t.groups.length} 組 · {t.matches.length} 場小組賽 · {t.target} 分{t.rule === "rally" ? " · Rally" : ""}</p>
          </div>
        </div>

        {/* 分組結果 */}
        <div className="card">
          <h2>分組結果</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {t.groups.map((g, gi) => (
              <div key={gi} style={{ border: `1px solid var(--line)`, borderTop: `3px solid ${g.color}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontWeight: 800, marginBottom: 6, color: g.color }}>{g.name}</div>
                {g.players.map((p, pi) => (
                  <div key={pi} style={{ fontSize: 13.5, fontWeight: 600, padding: "2px 0" }}>{p}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 淘汰賽（若已產生） */}
        {t.ko && (
          <div className="card">
            <h2>淘汰賽</h2>
            {t.ko.champion && (
              <div style={{ textAlign: "center", padding: "14px 0", marginBottom: 10, background: "var(--panel-2)", borderRadius: 12, border: "1px solid var(--gold)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)", letterSpacing: 1 }}>
                  <Icon name="trophy" style={{ display: "inline", width: 15, height: 15, verticalAlign: "-2px", marginRight: 5 }} />CHAMPION
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{t.ko.champion.name}</div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {t.ko.matches.map((m) => (
                <MatchRow key={m.id} m={m} label={`${m.roundName} · 場地 ${m.court + 1}`} color="var(--gold)"
                  onStart={() => onStartMatch("ko", m.id)} />
              ))}
            </div>
          </div>
        )}

        {/* 小組賽程（兩場地） */}
        {!t.ko && (
          <div className="card">
            <h2>賽程表（2 場地）</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              {[0, 1].map((c) => (
                <div key={c}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink-dim)", marginBottom: 8 }}>場地 {c + 1}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {courtMatches(c).map((m) => (
                      <MatchRow key={m.id} m={m} label={`${t.groups[m.group].name} · 第 ${m.slot + 1} 輪`}
                        color={t.groups[m.group].color} onStart={() => onStartMatch("group", m.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 積分榜 */}
        {!t.ko && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {t.groups.map((g, gi) => <GroupStanding key={gi} t={t} gi={gi} />)}
          </div>
        )}

        {/* 動作列 */}
        <div className="setup-foot">
          <button className="btn ghost" onClick={onBack}>← 返回</button>
          <button className="btn ghost danger" onClick={onReset}>重新抽籤</button>
          {groupsDone && !t.ko && (
            <button className="btn primary" onClick={onBuildKnockout}>產生淘汰賽 →</button>
          )}
        </div>
      </div>
    </div>
  );
}

window.TournamentScreen = TournamentScreen;
