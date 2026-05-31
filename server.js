const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 根路由：將所有 type="text/babel" src="..." 的外部 JSX 直接 inline 進 HTML
// 原因：Babel Standalone 透過 fetch 載入外部 JSX 在某些環境不可靠
app.get('/', (req, res) => {
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
});

// 其餘靜態資源（CSS、engine.js、socket.io.js 等）
app.use(express.static(__dirname));

// 伺服器記憶體中的比賽狀態（所有裝置的唯一真相來源）
let sharedState = null;

io.on('connection', (socket) => {
  console.log(`[+] 裝置連線 ${socket.id}`);

  // 新裝置連線時，立刻推送目前比賽狀態
  if (sharedState) {
    socket.emit('state:sync', sharedState);
  }

  // 任一裝置操作後推送新狀態
  socket.on('state:push', (data) => {
    sharedState = data;
    socket.broadcast.emit('state:sync', data); // 廣播給所有其他裝置
  });

  socket.on('disconnect', () => {
    console.log(`[-] 裝置離線 ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`計分伺服器已啟動：http://localhost:${PORT}`);
});
