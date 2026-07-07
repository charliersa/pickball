const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 三種角色共用同一份前端 bundle，由前端依網址路徑決定畫面：
//   /          → 觀眾看板（唯讀：即時比分／積分榜／對戰表／賽果）
//   /control   → 操作者計分台（完整操作介面）
//   /register  → 選手報名後台（填姓名＋分級）
// 將所有 type="text/babel" src="..." 的外部 JSX 直接 inline 進 HTML
// 原因：Babel Standalone 透過 fetch 載入外部 JSX 在某些環境不可靠
function renderApp(res) {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace(
    /<script type="text\/babel" src="([^"]+)"><\/script>/g,
    (match, src) => {
      try {
        const content = fs.readFileSync(path.join(__dirname, src), 'utf8');
        return `<script type="text/babel" data-presets="react,env">\n${content}\n</script>`;
      } catch (e) {
        return `<!-- inline failed: ${src} -->`;
      }
    }
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}
app.get('/', (req, res) => renderApp(res));
app.get('/control', (req, res) => renderApp(res));
app.get('/register', (req, res) => renderApp(res));

// 其餘靜態資源（CSS、engine.js、socket.io.js 等）
app.use(express.static(__dirname));

// 伺服器記憶體中的比賽狀態（所有裝置的唯一真相來源）
let sharedState = null;

// ---- 選手報名名單持久化 ----
// 優先寫入 Firebase 即時資料庫（重啟／重新部署都不遺失）；
// 未設定 Firebase 環境變數時，退回本地 registrations.json（本機開發用）。
//   需要的環境變數：
//     FIREBASE_SERVICE_ACCOUNT  服務帳戶金鑰 JSON（整包字串）
//     FIREBASE_DATABASE_URL     RTDB 網址，例如 https://xxx-default-rtdb.firebaseio.com
const REG_FILE = path.join(__dirname, 'registrations.json');
let registrations = [];
let regRef = null; // Firebase RTDB ref（null = 本地檔案模式）

function readSeedFile() {
  try {
    const arr = JSON.parse(fs.readFileSync(REG_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

async function initRegStore() {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  const dbUrl = process.env.FIREBASE_DATABASE_URL;
  if (svc && dbUrl) {
    try {
      const { initializeApp, cert } = require('firebase-admin/app');
      const { getDatabase } = require('firebase-admin/database');
      const creds = JSON.parse(svc);
      const fbApp = initializeApp({ credential: cert(creds), databaseURL: dbUrl });
      regRef = getDatabase(fbApp).ref('registrations');
      const snap = await regRef.once('value');
      const val = snap.val();
      registrations = Array.isArray(val) ? val.filter(Boolean)
                    : (val ? Object.values(val) : []);
      // 雲端尚無資料，但本地有種子名單 → 帶入一次（例如首次上線的預載名單）
      if (registrations.length === 0) {
        const seed = readSeedFile();
        if (seed.length) { registrations = seed; await regRef.set(registrations); }
      }
      console.log(`[reg] Firebase 已連線，載入 ${registrations.length} 筆報名`);
      return;
    } catch (e) {
      console.error('[reg] Firebase 初始化失敗，改用本地檔案：', e.message);
      regRef = null;
    }
  }
  registrations = readSeedFile();
  console.log(`[reg] 本地檔案模式，載入 ${registrations.length} 筆報名`);
}

function saveReg() {
  if (regRef) {
    regRef.set(registrations).catch((e) => console.error('[reg] Firebase 寫入失敗：', e.message));
  } else {
    try { fs.writeFileSync(REG_FILE, JSON.stringify(registrations, null, 2)); } catch (e) {}
  }
}
function newRegId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

io.on('connection', (socket) => {
  console.log(`[+] 裝置連線 ${socket.id}`);

  // 新裝置連線時，立刻推送目前比賽狀態與報名名單
  if (sharedState) socket.emit('state:sync', sharedState);
  socket.emit('reg:sync', registrations);

  // 任一裝置操作後推送新狀態
  socket.on('state:push', (data) => {
    sharedState = data;
    socket.broadcast.emit('state:sync', data); // 廣播給所有其他裝置
  });

  // ---- 報名事件 ----
  socket.on('reg:add', (p) => {
    const name = (p && p.name ? String(p.name) : '').trim();
    if (!name) return;
    const level = (p && p.level ? String(p.level) : '').trim();
    registrations.push({ id: newRegId(), name, level, when: new Date().toISOString() });
    saveReg();
    io.emit('reg:sync', registrations); // 廣播給所有裝置（含送出者）
  });
  socket.on('reg:remove', (id) => {
    registrations = registrations.filter((r) => r.id !== id);
    saveReg();
    io.emit('reg:sync', registrations);
  });
  socket.on('reg:clear', () => {
    registrations = [];
    saveReg();
    io.emit('reg:sync', registrations);
  });

  socket.on('disconnect', () => {
    console.log(`[-] 裝置離線 ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
initRegStore().finally(() => {
  server.listen(PORT, () => {
    const base = `http://localhost:${PORT}`;
    console.log(`計分伺服器已啟動：`);
    console.log(`  觀眾看板  ${base}/`);
    console.log(`  計分操作  ${base}/control`);
    console.log(`  選手報名  ${base}/register`);
  });
});
