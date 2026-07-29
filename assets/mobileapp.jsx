/* ============================================================
   手機版 App（/app）：把看板、計分台、報名三個畫面合成一個
   底部分頁列切換；只掛載目前分頁（各畫面自己開 socket，
   切走再切回會從伺服器 state:sync 還原，不會掉比分）。

   計分分頁要輸入密碼（工作人員用），密碼由伺服器 /api/host-check 比對，
   不寫在前端，看網頁原始碼也看不到。解鎖後記在這台手機，下次不用再輸。
   網址加 ?lock=1 可解除本機解鎖（手機借人前用）。

   #board / #control / #register → 開啟時直接進該分頁
   ============================================================ */
const MA_LS_TAB = "pb_tab_v1";
const MA_LS_HOST = "pb_host_v1";

// ?lock=1：清掉本機的解鎖狀態，回到要輸密碼的狀態
if (new URLSearchParams(location.search).has("lock")) {
  try { localStorage.removeItem(MA_LS_HOST); } catch (e) {}
}

function hostUnlocked() {
  try { return localStorage.getItem(MA_LS_HOST) === "1"; } catch (e) { return false; }
}

// 計分台密碼鎖：通過才顯示 children
function HostGate({ children }) {
  const [ok, setOk] = React.useState(hostUnlocked);
  const [code, setCode] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/host-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = await r.json();
      if (data && data.ok) {
        try { localStorage.setItem(MA_LS_HOST, "1"); } catch (e) {}
        setOk(true);
      } else {
        setErr("密碼不對，請再試一次");
        setCode("");
      }
    } catch (e) {
      setErr("連不上伺服器，請檢查網路後再試");
    }
    setBusy(false);
  }

  if (ok) return children;

  return (
    <div className="setup-scroll">
      <div className="setup" style={{ maxWidth: 460 }}>
        <div className="setup-head">
          <div className="brand-mark"><Icon name="ball" stroke="#1a2a00" /></div>
          <div>
            <h1>計分台</h1>
            <p>工作人員專用 · 請輸入密碼</p>
          </div>
        </div>

        <div className="card">
          <div className="field">
            <label>密碼</label>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(e) => { setCode(e.target.value); setErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="請向主辦索取"
              autoFocus
            />
          </div>
          {err && <div style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, marginTop: -4 }}>{err}</div>}
          <button className="btn primary" style={{ width: "100%", marginTop: 4 }} onClick={submit} disabled={busy}>
            {busy ? "驗證中…" : "解鎖計分台"}
          </button>
          <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>
            解鎖後這台手機會記住，下次直接進入。<br />
            手機要借人時，開網址加上 <b style={{ color: "var(--ink-dim)" }}>?lock=1</b> 就會重新上鎖。
          </p>
        </div>
      </div>
    </div>
  );
}

const MA_TABS = [
  { key: "board", label: "看板", icon: "trophy", title: "即時看板", view: () => <SpectatorApp /> },
  { key: "control", label: "計分", icon: "flag", title: "計分台", view: () => <HostGate><App /></HostGate> },
  { key: "register", label: "報名", icon: "plus", title: "選手報名", view: () => <RegisterScreen /> },
];

function maInitialTab() {
  const hash = (location.hash || "").replace("#", "");
  if (MA_TABS.some((t) => t.key === hash)) return hash;
  try {
    const saved = localStorage.getItem(MA_LS_TAB);
    if (MA_TABS.some((t) => t.key === saved)) return saved;
  } catch (e) {}
  return MA_TABS[0].key;
}

function MobileApp() {
  const [tab, setTab] = React.useState(maInitialTab);
  const active = MA_TABS.find((t) => t.key === tab) || MA_TABS[0];

  React.useEffect(() => {
    try { localStorage.setItem(MA_LS_TAB, tab); } catch (e) {}
    history.replaceState(null, "", "#" + tab);
  }, [tab]);

  // 支援手機的上一頁／下一頁
  React.useEffect(() => {
    const onHash = () => {
      const h = (location.hash || "").replace("#", "");
      if (MA_TABS.some((t) => t.key === h)) setTab(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* 內容區：只掛載目前分頁 */}
      <div key={active.key} style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        {active.view()}
      </div>

      {/* 底部分頁列 */}
      <nav style={{
        flex: "0 0 auto",
        display: "flex",
        borderTop: "1px solid var(--line)",
        background: "var(--panel)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {MA_TABS.map((t) => {
          const on = t.key === active.key;
          const locked = t.key === "control" && !hostUnlocked();
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-label={t.title}
              aria-current={on ? "page" : undefined}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, padding: "9px 0 8px", border: "none", background: "transparent", cursor: "pointer",
                color: on ? "var(--serve)" : "var(--muted)",
                borderTop: `2px solid ${on ? "var(--serve)" : "transparent"}`,
                marginTop: -1, WebkitTapHighlightColor: "transparent",
              }}
            >
              <Icon name={t.icon} style={{ width: 21, height: 21, display: "block" }} />
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4 }}>
                {t.label}{locked ? " 🔒" : ""}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
