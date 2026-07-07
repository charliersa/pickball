# 報名名單 Firebase 持久化 · 設定步驟

目的：讓 `/register` 的報名名單存到 Firebase 即時資料庫，**主機休眠、重啟、重新部署都不會被清空**。

> ⚠️ 程式已支援。**在完成下列設定前，線上維持「本地檔案模式」（重啟會清空）**；設好兩個環境變數後，持久化自動啟用。

---

## 一、建立 Firebase 即時資料庫

1. 開 [Firebase Console](https://console.firebase.google.com/) → 建立或選一個專案（可沿用你其他專案，或新開一個 `pickball`）。
2. 左側 **建構 → Realtime Database** → **建立資料庫**。
3. 地區選 **asia-southeast1（新加坡，離台灣近）**。
4. 安全性規則選 **鎖定模式（locked mode）** 即可 —— 因為只有伺服器用 Admin SDK 存取，會**繞過規則**，資料仍安全。
5. 建好後，畫面上方會顯示資料庫網址，長得像：
   - `https://pickball-xxxxx-default-rtdb.asia-southeast1.firebasedatabase.app`
   
   **把這串完整複製起來**（下面步驟三會用到）。

---

## 二、產生服務帳戶金鑰（Service Account Key）

1. Firebase Console → 左上齒輪 **專案設定** → 分頁 **服務帳戶**。
2. 按 **產生新的私密金鑰** → 確認 → 會下載一個 `.json` 檔。
3. 用記事本打開這個 `.json`，**全選複製裡面全部內容**（一大包 `{ "type": "service_account", ... }`）。

> 🔒 這個 JSON 是機密，**不要** commit 進 git、不要外傳。只貼到 Render 環境變數。

---

## 三、在 Render 設定環境變數

1. 開 [Render Dashboard](https://dashboard.render.com/) → 進入 **pickball** 服務。
2. 左側 **Environment** → **Add Environment Variable**，新增兩個：

   | Key | Value |
   |-----|-------|
   | `FIREBASE_DATABASE_URL` | 步驟一複製的資料庫網址 |
   | `FIREBASE_SERVICE_ACCOUNT` | 步驟二複製的整包 JSON 內容 |

3. 按 **Save Changes** → Render 會**自動重新部署**。

---

## 四、確認成功

部署完成後，到 Render 服務的 **Logs** 分頁，看到這行就成功：

```
[reg] Firebase 已連線，載入 24 筆報名
```

（若看到 `[reg] Firebase 初始化失敗，改用本地檔案` 表示金鑰或網址貼錯，重貼即可。）

**實測持久化**：到 `https://pickball.onrender.com/register` 新增一個測試報名 → 到 Firebase Console 的 Realtime Database 應能看到 `registrations` 節點多一筆 → 之後主機重啟名單也不會消失。

---

## 運作邏輯（給你了解）

- 伺服器啟動時：**先讀 Firebase**。若雲端還沒資料，會把 git 裡的 `registrations.json`（目前預載的 24 人）**帶入一次**當種子。之後就以雲端為準。
- 有人報名／移除：即時寫入 Firebase + 廣播給所有裝置。
- 沒設環境變數（例如本機開發）：自動退回本地 `registrations.json`，照常可跑。
- 安全性：資料只經由伺服器 Admin SDK 存取，RTDB 規則保持鎖定即可，一般人無法直接讀寫你的資料庫。
