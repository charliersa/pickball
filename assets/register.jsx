/* ============================================================
   選手報名後台（/register）
   選手自行填「姓名 + 分級」送出，累積成報名名單。
   透過 socket 即時同步：操作者計分台可帶入此名單抽籤分組。
   ============================================================ */
const REG_LEVELS = ["2.0", "3.0"];

function RegisterScreen() {
  const [name, setName] = React.useState("");
  const [level, setLevel] = React.useState(REG_LEVELS[0]);
  const [list, setList] = React.useState([]);
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
    if (socketRef.current) socketRef.current.emit("reg:add", { name: nm, level });
    setName("");
    flash(`已報名：${nm}（${level} 級）`);
    if (inputRef.current) inputRef.current.focus();
  }

  function removeEntry(id) {
    if (socketRef.current) socketRef.current.emit("reg:remove", id);
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
            <p>填寫姓名並選擇分級 · 送出後即加入報名名單</p>
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
            送出報名 →
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
              <div className="reg-chip-wrap">
                {grp.rows.map((r) => (
                  <span className="reg-chip" key={r.id}>
                    {r.name}
                    <button className="reg-x" title="移除" onClick={() => removeEntry(r.id)}>×</button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, padding: "0 4px" }}>
          報名資料會即時同步到計分台，由主辦方抽籤分組。填錯了可點名字上的 × 移除。
        </p>
      </div>
    </div>
  );
}
window.RegisterScreen = RegisterScreen;
