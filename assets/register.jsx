/* ============================================================
   選手報名後台（/register）
   選手自行填「姓名 + DUPR 帳號名 + DUPR ID + 分級」送出，累積成報名名單。
   透過 socket 即時同步：操作者計分台可帶入此名單抽籤分組，
   對戰表／看板則用姓名對照出 DUPR ID 顯示。
   ============================================================ */
const REG_LEVELS = ["2.0", "3.0"];

function RegisterScreen() {
  const [name, setName] = React.useState("");
  const [duprName, setDuprName] = React.useState("");
  const [duprId, setDuprId] = React.useState("");
  const [level, setLevel] = React.useState(REG_LEVELS[0]);
  const [list, setList] = React.useState([]);
  const [editing, setEditing] = React.useState(null); // 正在編輯的報名 id
  const [draft, setDraft] = React.useState({ name: "", duprName: "", duprId: "" });
  const [toast, setToast] = React.useState("");
  const socketRef = React.useRef(null);
  const toastTimer = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const s = initSocket();
    if (!s) return;
    socketRef.current = s;
    s.on("reg:sync", (rows) => setList(Array.isArray(rows) ? rows : []));
    return () => { s.disconnect(); socketRef.current = null; };
  }, []);

  function flash(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  function submit() {
    const nm = name.trim();
    if (!nm) { flash("請先輸入姓名"); return; }
    const dn = duprName.trim();
    const did = duprId.trim().toUpperCase();
    if (list.some((r) => did && (r.duprId || "").toUpperCase() === did)) {
      flash(`DUPR ID ${did} 已在名單中`); return;
    }
    if (socketRef.current) socketRef.current.emit("reg:add", { name: nm, level, duprName: dn, duprId: did });
    setName(""); setDuprName(""); setDuprId("");
    flash(`已新增：${nm}${did ? `（${did}）` : ""} · ${level} 級`);
    if (inputRef.current) inputRef.current.focus();
  }

  function removeEntry(id) {
    if (socketRef.current) socketRef.current.emit("reg:remove", id);
  }

  function startEdit(r) {
    setEditing(r.id);
    setDraft({ name: r.name || "", duprName: r.duprName || "", duprId: r.duprId || "" });
  }
  function saveEdit() {
    if (!draft.name.trim()) { flash("姓名不可空白"); return; }
    if (socketRef.current) socketRef.current.emit("reg:update", { id: editing, ...draft });
    setEditing(null);
    flash("已更新");
  }

  const byLevel = REG_LEVELS.map((lvl) => ({
    level: lvl,
    rows: list.filter((r) => r.level === lvl),
  }));
  const other = list.filter((r) => !REG_LEVELS.includes(r.level));
  if (other.length) byLevel.push({ level: "其他", rows: other });

  return (
    <div className="setup-scroll">
      <div className="setup">
        <div className="setup-head">
          <div className="brand-mark"><Icon name="ball" stroke="#1a2a00" /></div>
          <div>
            <h1>選手報名</h1>
            <p>填寫姓名、DUPR 資料並選擇分級 · 送出後即加入報名名單</p>
          </div>
        </div>

        <div className="card">
          <h2>報名資料</h2>
          <div className="field">
            <label>姓名</label>
            <input
              ref={inputRef}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="請輸入你的姓名"
              autoFocus
            />
          </div>
          <div className="rule-grid">
            <div className="field">
              <label>DUPR 帳號名<span className="reg-opt">選填</span></label>
              <input
                className="input"
                value={duprName}
                onChange={(e) => setDuprName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="例：TingYu Jiang"
              />
            </div>
            <div className="field">
              <label>DUPR ID<span className="reg-opt">選填</span></label>
              <input
                className="input reg-id-input"
                value={duprId}
                onChange={(e) => setDuprId(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="例：K5LQDQ"
                maxLength={12}
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>分級</label>
            <div className="seg full">
              {REG_LEVELS.map((lvl) => (
                <button key={lvl} className={level === lvl ? "on" : ""} onClick={() => setLevel(lvl)}>
                  {lvl} 級
                </button>
              ))}
            </div>
          </div>
          <button className="btn primary" onClick={submit} style={{ width: "100%", justifyContent: "center", marginTop: 16 }}>
            新增到名單 →
          </button>
          {toast && <div className="reg-toast">{toast}</div>}
        </div>

        <div className="card">
          <h2>目前報名名單 · 共 {list.length} 人</h2>
          {list.length === 0 && (
            <div className="hist-empty">尚無人報名<br />填寫上方表單後會即時顯示於此</div>
          )}
          {byLevel.map((grp) => grp.rows.length > 0 && (
            <div key={grp.level} style={{ marginTop: 12 }}>
              <div className="reg-grp-head">
                {grp.level} 級
                <span className="reg-count">{grp.rows.length} 人</span>
              </div>
              <div className="reg-list">
                {grp.rows.map((r, i) => editing === r.id ? (
                  <div className="reg-row editing" key={r.id}>
                    <span className="reg-no">{i + 1}</span>
                    <div className="reg-edit-fields">
                      <input className="input" value={draft.name} placeholder="姓名"
                             onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                      <input className="input" value={draft.duprName} placeholder="DUPR 帳號名"
                             onChange={(e) => setDraft({ ...draft, duprName: e.target.value })} />
                      <input className="input reg-id-input" value={draft.duprId} placeholder="DUPR ID" maxLength={12}
                             onChange={(e) => setDraft({ ...draft, duprId: e.target.value.toUpperCase() })}
                             onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} />
                    </div>
                    <button className="reg-act ok" title="儲存" onClick={saveEdit}>✓</button>
                    <button className="reg-act" title="取消" onClick={() => setEditing(null)}>×</button>
                  </div>
                ) : (
                  <div className="reg-row" key={r.id}>
                    <span className="reg-no">{i + 1}</span>
                    <span className="reg-nm">{r.name}</span>
                    <span className="reg-dn">{r.duprName || "—"}</span>
                    <span className="reg-did">{r.duprId || "—"}</span>
                    <button className="reg-act" title="編輯" onClick={() => startEdit(r)}>✎</button>
                    <button className="reg-act" title="移除" onClick={() => removeEntry(r.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, padding: "0 4px" }}>
          報名資料會即時同步到計分台，由主辦方抽籤分組。填錯了可按 ✎ 修改、× 移除。
          DUPR ID 會顯示在對戰表與觀眾看板上。
        </p>
      </div>
    </div>
  );
}
window.RegisterScreen = RegisterScreen;
