/* ============================================================
   賽事分配畫面（分級：2.0 / 3.0）
   每級 10 人 → 抽籤配 5 對 → 對循環賽 → 前 4 淘汰賽
   純顯示 + 事件上拋；賽事狀態與同步由 App 管理。
   ============================================================ */
const TB_LEVELS = ["2.0", "3.0"];
const TB_PER_DIV = 10;

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
  const winner = done && m.result ? m.result.winner : null;
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

function DivisionStanding({ t, di }) {
  const rows = TB.computeStanding(t, di);
  return (
    <div className="card" style={{ padding: 14 }}>
      <h2>積分榜（5 對循環）</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ color: "var(--muted)", fontSize: 11, textAlign: "left" }}>
            <th style={{ padding: "4px 2px" }}>#</th>
            <th style={{ padding: "4px 2px" }}>搭檔</th>
            <th style={{ padding: "4px 2px", textAlign: "center" }}>勝-負</th>
            <th style={{ padding: "4px 2px", textAlign: "right" }}>淨分</th>
            <th style={{ padding: "4px 2px", textAlign: "right" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.idx} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "7px 2px", fontWeight: 700, color: r.advance ? "var(--gold)" : "var(--muted)" }}>{r.rank}</td>
              <td style={{ padding: "7px 2px", fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: "inline-block", marginRight: 6 }} />
                {r.name}
              </td>
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

function DivisionView({ t, di, onStartMatch, onBuildKnockout }) {
  const d = t.divisions[di];
  const done = TB.divisionComplete(t, di);
  const courtMatches = (c) => d.matches.filter((m) => m.court === c).sort((a, b) => a.slot - b.slot);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 配對結果 */}
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

      {/* 淘汰賽 */}
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
              <MatchRow key={m.id} m={m} label={`${m.roundName} · 場地 ${m.court + 1}`} color="var(--gold)"
                onStart={() => onStartMatch(di, "ko", m.id)} />
            ))}
          </div>
        </div>
      )}

      {/* 循環賽程（2 場地） */}
      {!d.ko && (
        <div className="card">
          <h2>賽程表（2 場地 · 5 輪）</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {[0, 1].map((c) => (
              <div key={c}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink-dim)", marginBottom: 8 }}>場地 {c + 1}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {courtMatches(c).map((m) => (
                    <MatchRow key={m.id} m={m} label={`第 ${m.slot + 1} 輪`}
                      color={d.pairs[m.pairIdx[0]].color} onStart={() => onStartMatch(di, "group", m.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 積分榜 */}
      {!d.ko && <DivisionStanding t={t} di={di} />}

      {/* 產生淘汰賽 */}
      {done && !d.ko && (
        <button className="btn primary" onClick={() => onBuildKnockout(di)} style={{ alignSelf: "flex-start" }}>
          {d.level} 級 · 產生淘汰賽 →
        </button>
      )}
    </div>
  );
}

function TournamentScreen({ tournament, registrations, onDraw, onStartMatch, onBuildKnockout, onReset, onBack }) {
  const [names, setNames] = React.useState(() => TB_LEVELS.map(() => Array.from({ length: TB_PER_DIV }, () => "")));
  const [event, setEvent] = React.useState("匹克球分級循環賽");
  const [target, setTarget] = React.useState(11);
  const [rule, setRule] = React.useState("sideout");
  const [activeDiv, setActiveDiv] = React.useState(0);

  const reg = registrations || [];
  const regByLevel = (lvl) => reg.filter((r) => r.level === lvl).map((r) => r.name);

  function setName(di, i, v) {
    setNames((a) => a.map((list, k) => (k === di ? list.map((x, q) => (q === i ? v : x)) : list)));
  }
  // 把某級的報名名單帶入該級名單欄位（最多 10 人，其餘留空）
  function loadRoster(di, lvl) {
    const picked = regByLevel(lvl).slice(0, TB_PER_DIV);
    setNames((a) => a.map((list, k) => (
      k === di ? Array.from({ length: TB_PER_DIV }, (_, i) => picked[i] || "") : list
    )));
  }
  function draw() {
    const inputs = TB_LEVELS.map((lvl, di) => ({
      level: lvl,
      names: names[di].map((n, i) => n.trim() || `${lvl}-${i + 1}`),
    }));
    onDraw(inputs, { event, target, rule });
  }

  // ---------- 尚未抽籤（或舊格式）：輸入名單 ----------
  if (!tournament || !Array.isArray(tournament.divisions)) {
    return (
      <div className="setup-scroll">
        <div className="setup">
          <div className="setup-head">
            <div className="brand-mark"><Icon name="ball" stroke="#1a2a00" /></div>
            <div>
              <h1>分級循環賽事分配</h1>
              <p>2.0 / 3.0 各 10 人 · 抽籤配 5 對 · 對循環 → 各級淘汰賽</p>
            </div>
          </div>

          <div className="card">
            <h2>賽事設定</h2>
            <div className="field">
              <label>賽事名稱</label>
              <input className="input" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="例：社區盃分級賽" />
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

          {TB_LEVELS.map((lvl, di) => {
            const regCount = regByLevel(lvl).length;
            return (
            <div className="card" key={di}>
              <h2 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span>{lvl} 級名單（10 人）</span>
                <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }}
                        disabled={regCount === 0} onClick={() => loadRoster(di, lvl)}>
                  帶入報名（{regCount}）
                </button>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {names[di].map((n, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, width: 20, textAlign: "right", fontFamily: "var(--font-num)" }}>{i + 1}</span>
                    <input className="input" style={{ marginBottom: 0 }} value={n} onChange={(e) => setName(di, i, e.target.value)} placeholder={`${lvl}-${i + 1}`} />
                  </div>
                ))}
              </div>
            </div>
            );
          })}

          <p style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, padding: "0 4px" }}>
            可按「帶入報名」自動填入 /register 收到的名單。留空的會自動命名。抽籤會把每級 10 人隨機配成 5 對固定搭檔，5 對互相循環。
          </p>

          <div className="setup-foot">
            <button className="btn ghost" onClick={onBack}>← 返回</button>
            <button className="btn primary" onClick={draw}>🎲 抽籤分組 →</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- 已抽籤：級別分頁 ----------
  const t = tournament;
  const di = Math.min(activeDiv, t.divisions.length - 1);

  return (
    <div className="setup-scroll">
      <div className="setup" style={{ maxWidth: 900 }}>
        <div className="setup-head">
          <div className="brand-mark"><Icon name="ball" stroke="#1a2a00" /></div>
          <div>
            <h1>{t.event}</h1>
            <p>{t.divisions.length} 級別 · 每級 5 對循環 · {t.target} 分{t.rule === "rally" ? " · Rally" : ""}</p>
          </div>
        </div>

        {/* 級別分頁 */}
        <div className="seg full" style={{ marginBottom: 4 }}>
          {t.divisions.map((d, k) => (
            <button key={k} className={di === k ? "on" : ""} onClick={() => setActiveDiv(k)}>
              {d.level} 級{d.ko && d.ko.champion ? " 🏆" : ""}
            </button>
          ))}
        </div>

        <DivisionView t={t} di={di} onStartMatch={onStartMatch} onBuildKnockout={onBuildKnockout} />

        <div className="setup-foot">
          <button className="btn ghost" onClick={onBack}>← 返回</button>
          <button className="btn ghost danger" onClick={onReset}>重新抽籤</button>
        </div>
      </div>
    </div>
  );
}

window.TournamentScreen = TournamentScreen;
