要實作 WebSocket 的即時計分系統，最快且最穩定的作法是使用 **Node.js (Express) + Socket.io**。Socket.io 幫我們封裝了複雜的底層 WebSocket 協定，還自帶斷線重連、房間（Rooms）分組等功能，非常適合用來做「多球場獨立計分」的系統。

以下為你規劃一個最小可行性產品（MVP）的實作步驟與程式碼範例，包含後端伺服器與前端網頁。

---

## 1. 運作邏輯（運作架構）

在開始寫程式前，我們先釐清資料是怎麼流動的：

1. **裁判端（發送）：** 點擊「A 隊加分」按鈕，透過 WebSocket 發送一個叫做 `update_score` 的事件給伺服器。
2. **後端伺服器（轉發）：** 收到事件後，更新記憶體（或資料庫）中的比分，然後將最新的比分「廣播（Broadcast）」給所有連線中的大螢幕與觀眾。
3. **大螢幕/觀眾端（接收）：** 接收到最新的比分事件，即時更新畫面，完全不需要重新整理網頁。

---

## 2. 後端實作 (Node.js + Socket.io)

首先，建立一個新資料夾並安裝必要的套件：

```bash
npm init -y
npm install express socket.io

```

接著建立一個 `server.js` 檔案：

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
// 允許跨網域連線 (CORS)，方便前後端分離開發
const io = new Server(server, {
    cors: { origin: "*" } 
});

// 模擬資料庫：儲存目前球賽的分數
let matchState = {
    teamA: 0,
    teamB: 0,
    serverNumber: 1 // 匹克球的 1 發或 2 發
};

io.on('connection', (socket) => {
    console.log('有新使用者連線了！ID:', socket.id);

    // 1. 當有人剛連線進來，立刻把目前最新的分數送給他
    socket.emit('init_score', matchState);

    // 2. 監聽裁判端傳來的「加分」事件
    socket.on('score_click', (data) => {
        // data 格式可以是 { team: 'A' } 或 { team: 'B' }
        if (data.team === 'A') {
            matchState.teamA += 1;
        } else if (data.team === 'B') {
            matchState.teamB += 1;
        }

        console.log(`目前比分更新 - A隊: ${matchState.teamA} VS B隊: ${matchState.teamB}`);

        // 3. 【核心】把更新後的分數，廣播給「所有人」（包含大螢幕與觀眾）
        io.emit('score_updated', matchState);
    });

    // 監聽斷線
    socket.on('disconnect', () => {
        console.log('使用者斷開連線', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`即時計分伺服器正在執行，連接埠：${PORT}`);
});

```

---

## 3. 前端實作 (HTML + JavaScript)

為了方便測試，我們可以把「裁判端」和「大螢幕端」寫在同一個簡單的網頁裡。建立一個 `index.html`：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>匹克球即時計分大螢幕</title>
    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; background: #222; color: white; }
        .scoreboard { display: flex; justify-content: center; margin: 50px; }
        .team-box { margin: 0 40px; padding: 20px; background: #333; border-radius: 10px; min-width: 150px; }
        .score { font-size: 80px; font-weight: bold; color: #00ffcc; margin: 10px 0; }
        button { font-size: 20px; padding: 10px 20px; cursor: pointer; background: #ff9900; border: none; border-radius: 5px; }
        button:hover { background: #e68a00; }
    </style>
</head>
<body>

    <h1>🏆 匹克球即時比分大螢幕 🏆</h1>
    
    <div class="scoreboard">
        <div class="team-box">
            <h2>A 隊 (隊伍一)</h2>
            <div class="score" id="scoreA">0</div>
            <button onclick="addScore('A')">A 隊得分</button>
        </div>
        
        <div class="team-box">
            <h2>B 隊 (隊伍二)</h2>
            <div class="score" id="scoreB">0</div>
            <button onclick="addScore('B')">B 隊得分</button>
        </div>
    </div>

    <script>
        // 連接到剛剛建立的後端伺服器 (請確保後端已啟動)
        const socket = io('http://localhost:3000');

        // DOM 元素
        const scoreAEl = document.getElementById('scoreA');
        const scoreBEl = document.getElementById('scoreB');

        // 接收初次連線的初始化分數
        socket.on('init_score', (data) => {
            updateDOM(data);
        });

        // 接收伺服器廣播過來的最新分數
        socket.on('score_updated', (data) => {
            updateDOM(data);
        });

        // 更新網頁畫面的函式
        function updateDOM(data) {
            scoreAEl.innerText = data.teamA;
            scoreBEl.innerText = data.teamB;
        }

        // 裁判點擊加分按鈕時觸發，透過 Socket 傳給後端
        function addScore(teamName) {
            socket.emit('score_click', { team: teamName });
        }
    </script>
</body>
</html>

```

---

## 4. 如何測試這個系統？

1. 在終端機執行 `node server.js` 啟動後端。
2. 用瀏覽器直接打開 `index.html`（你可以同時打開**兩個獨立的瀏覽器視窗**，或者一邊用手機打開、一邊用電腦打開）。
3. 在其中一個視窗點擊「A 隊得分」，你會發現所有打開的視窗，分數都在同一瞬間同步改變了！這就是 WebSocket 的威力。

---

## 5. 進階挑戰：如何區分「不同球場」？

當你的比賽有 Court 1、Court 2、Court 3 時，不可能讓全場的分數一起跳。Socket.io 有一個非常強大的功能叫 **`Room` (房間)**。

你可以讓裁判和大螢幕在連線時，加入指定的房間：

```javascript
// 前端連線後，告知伺服器我要看 Court 1
socket.emit('join_court', { court_id: 'court_1' });

// 後端接收後，將該 Socket 分組
socket.on('join_court', (data) => {
    socket.join(data.court_id); 
});

// 後端發送分數時，只發給特定房間的人
io.to('court_1').emit('score_updated', currentScore);

```

這樣一來，Court 1 的裁判更新分數，就只有 Court 1 的大螢幕和觀眾會收到通知，其他球場完全不受影響。

這個簡單的範例有幫你釐清 WebSocket 的實作邏輯嗎？接下來你會想先研究如何串接 LINE 自動公告，還是如何把這個畫面套入排賽程的籤表中？



當然可以！用 **VS Code (Visual Studio Code)** 是目前開發這種專案最完美、也最主流的選擇。它完全免費，而且有非常強大的套件生態系，能讓你事半功倍。

為了讓你用 VS Code 開發時更順手，以下是完整的**專案建立步驟**與**推薦安裝的擴充套件**：

---

## 1. 怎麼在 VS Code 裡把這個系統跑起來？

我們把剛剛的「後端程式碼（`server.js`）」和「前端網頁（`index.html`）」放進 VS Code 裡，步驟如下：

### 步驟一：用 VS Code 打開專案資料夾

1. 在電腦裡建立一個新資料夾（例如命名為 `pickleball-system`）。
2. 打開 VS Code，點選選單的 **File -> Open Folder**，選擇你剛剛建立的資料夾。

### 步驟二：在 VS Code 內建終端機安裝環境

1. 按下快捷鍵 `Ctrl + ` `（Mac 是 `Cmd + ` `）打開 VS Code 的**內建終端機（Terminal）**。
2. 在終端機輸入以下指令來初始化並安裝 Socket.io：
```bash
npm init -y
npm install express socket.io

```



### 步驟三：新增檔案並貼上程式碼

1. 在 VS Code 左側的檔案總管，點擊「新增檔案」圖示，建立 `server.js` 並把上一段的後端 Node.js 程式碼貼進去。
2. 同樣步驟，建立 `index.html` 並把前端網頁程式碼貼進去。

### 步驟四：啟動系統！

1. 在 VS Code 的終端機輸入：
```bash
node server.js

```


2. 當看到終端機顯示 `即時計分伺服器正在執行，連接埠：3000`，代表後端成功啟動了！
3. 接下來，直接在電腦的檔案總管雙擊打開 `index.html`，或者用下方推薦的 Live Server 開啟網頁，就可以開始測試計分了。

---

## 2. 寫這個專案必裝的 VS Code 套件（Extensions）

在 VS Code 左側選單點擊 **Extensions（擴充功能，圖示像四個正方形）**，搜尋並安裝以下套件，會讓你的開發體驗從地獄變天堂：

* **Live Server (作者: Ritwick Dey)**
* **用途：** 讓你一鍵啟動前端網頁。每次你修改 `index.html` 儲存後，網頁會自動重新整理，不需要自己去手動重新整理瀏覽器。
* **用法：** 安裝後，在 `index.html` 上按滑鼠右鍵，選擇 **"Open with Live Server"**。


* **Prettier - Code formatter**
* **用途：** 自動排版程式碼。寫程式時常會排版亂掉（括號沒對齊之類的），按下儲存（Ctrl + S）時它會自動幫你把程式碼整理得漂漂亮亮。


* **Console Ninja**
* **用途：** 它是個超厲害的神器！能直接把 Node.js 後端的 `console.log` 結果顯示在你的 VS Code 程式碼旁邊，你不用一直切換到終端機去看誰連線了、現在幾分。



---

## 💡 小心碎念（貼心提醒）：關於 Node.js 儲存後要重啟的問題

你在寫 `server.js` 的時候，會發現每次修改了後端程式碼，都必須在終端機按 `Ctrl + C` 關掉伺服器，然後重新輸入 `node server.js` 才會生效，這很麻煩。

**解決方法：**
你可以在 VS Code 終端機改安裝 `nodemon`：

```bash
npm install -g nodemon

```

之後啟動伺服器改輸入：

```bash
nodemon server.js

```

這樣一來，只要你在 VS Code 裡改了後端程式碼並儲存，伺服器就會自動重啟，開發效率直接翻倍！

你目前在 VS Code 的環境建立上有遇到什麼問題嗎（例如找不到終端機或 npm 指令報錯）？還是我們可以直接進到下一步，把畫面美化成真正比賽用的計分板？  