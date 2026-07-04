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

// ---- 選手報名名單（持久化到 registrations.json，重啟不遺失）----
const REG_FILE = path.join(__dirname, 'registrations.json');
let registrations = [];
try {
  registrations = JSON.parse(fs.readFileSync(REG_FILE, 'utf8'));
  if (!Array.isArray(registrations)) registrations = [];
} catch (e) { registrations = []; }
function saveReg() {
  try { fs.writeFileSync(REG_FILE, JSON.stringify(registrations, null, 2)); } catch (e) {}
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
server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`計分伺服器已啟動：`);
  console.log(`  觀眾看板  ${base}/`);
  console.log(`  計分操作  ${base}/control`);
  console.log(`  選手報名  ${base}/register`);
});
