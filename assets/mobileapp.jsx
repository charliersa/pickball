/* ============================================================
   手機版 App（/app）：把看板、計分台、報名三個畫面合成一個
   底部分頁列切換；只掛載目前分頁（各畫面自己開 socket，
   切走再切回會從伺服器 state:sync 還原，不會掉比分）。
   ?guest=1 → 隱藏計分台分頁，可安全發給選手／觀眾。
   #board / #control / #register → 開啟時直接進該分頁
   ============================================================ */
const MA_LS_TAB = "pb_tab_v1";

const MA_TABS = [
  { key: "board", label: "看板", icon: "trophy", title: "即時看板", view: () => <SpectatorApp /> },
  { key: "control", label: "計分", icon: "flag", title: "計分台", view: () => <App />, host: true },
  { key: "register", label: "報名", icon: "plus", title: "選手報名", view: () => <RegisterScreen /> },
];

// 觀眾模式（?guest=1）不顯示計分台，避免選手改到比分
const MA_GUEST = new URLSearchParams(location.search).has("guest");
const MA_VISIBLE = MA_TABS.filter((t) => !(t.host && MA_GUEST));

function maInitialTab() {
  const hash = (location.hash || "").replace("#", "");
  if (MA_VISIBLE.some((t) => t.key === hash)) return hash;
  try {
    const saved = localStorage.getItem(MA_LS_TAB);
    if (MA_VISIBLE.some((t) => t.key === saved)) return saved;
  } catch (e) {}
  return MA_VISIBLE[0].key;
}

function MobileApp() {
  const [tab, setTab] = React.useState(maInitialTab);
  const active = MA_VISIBLE.find((t) => t.key === tab) || MA_VISIBLE[0];

  React.useEffect(() => {
    try { localStorage.setItem(MA_LS_TAB, tab); } catch (e) {}
    history.replaceState(null, "", "#" + tab);
  }, [tab]);

  // 支援手機的上一頁／下一頁
  React.useEffect(() => {
    const onHash = () => {
      const h = (location.hash || "").replace("#", "");
      if (MA_VISIBLE.some((t) => t.key === h)) setTab(h);
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
        {MA_VISIBLE.map((t) => {
          const on = t.key === active.key;
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
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4 }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
