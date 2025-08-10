# 🚀 詳細設定指南

## 1. 安裝必要軟體

### 安裝 Node.js
```bash
# 使用 Homebrew (macOS)
brew install node

# 或下載安裝包
# https://nodejs.org/
```

### 安裝 MongoDB

#### 選項 1: 使用 Homebrew (推薦)
```bash
# 安裝 MongoDB
brew tap mongodb/brew
brew install mongodb-community

# 啟動 MongoDB 服務
brew services start mongodb/brew/mongodb-community
```

#### 選項 2: 使用 Docker
```bash
# 拉取 MongoDB 映像
docker pull mongo

# 運行 MongoDB 容器
docker run -d -p 27017:27017 --name mongodb mongo
```

#### 選項 3: 使用 MongoDB Atlas (雲端)
1. 前往 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 建立免費帳戶
3. 建立新的叢集
4. 獲取連接字串並更新 `.env` 檔案

## 2. 建立 Telegram Bot

### 步驟：
1. 在 Telegram 中搜尋 `@BotFather`
2. 發送 `/newbot` 指令
3. 輸入你的 bot 名稱 (例如: "My URL Saver Bot")
4. 輸入 bot 的用戶名 (必須以 "bot" 結尾，例如: "my_url_saver_bot")
5. 複製獲得的 bot token

### 範例對話：
```
你: /newbot
BotFather: Alright, a new bot. How are we going to call it? Please choose a name for your bot.

你: My URL Saver Bot
BotFather: Good. Now let's choose a username for your bot. It must end in `bot`. Like this, for example: TetrisBot or tetris_bot.

你: my_url_saver_bot
BotFather: Done! Congratulations on your new bot. You will find it at t.me/my_url_saver_bot. You can now add a description, about section and profile picture for your bot, see /help for a list of commands. By the way, when you've finished creating your cool bot, ping our Bot Support if you want a better username for it. Just make sure the bot is fully operational before you do this.

Use this token to access the HTTP API:
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

Keep your token secure and store it safely, it can be used by anyone to control your bot.
```

## 3. 設定環境變數

在 `server` 目錄中建立 `.env` 檔案：

```bash
cd server
cp .env.example .env
```

編輯 `.env` 檔案：
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=你的_telegram_bot_token

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/url-saver

# Server Configuration
PORT=4000
API_URL=http://localhost:4000/api/urls

# YouTube API Configuration (可選，用於改善 YouTube 影片資訊獲取)
YOUTUBE_API_KEY=你的_youtube_api_key

# 其他配置 (詳見 .env.example)
INTERNAL_API_KEY=your_internal_api_key
JWT_SECRET=your_jwt_secret
```

### YouTube API 設定 (可選但推薦)

為了避免 YouTube 的 429 錯誤並獲得更好的影片資訊，建議設定 YouTube API：

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立專案並啟用 "YouTube Data API v3"
3. 建立 API 金鑰
4. 將金鑰加入 `.env` 檔案

詳細步驟請參考 `YOUTUBE_API_SETUP.md`。

## 4. 安裝依賴

```bash
# 安裝 server 依賴
cd server
npm install

# 安裝 client 依賴
cd ../client
npm install
```

## 5. 啟動應用程式

### 啟動 Server (在一個終端視窗)
```bash
cd server
npm run dev
```

你應該會看到：
```
Connected to MongoDB
Server running on port 4000
Telegram bot is running
```

### 啟動 Client (在另一個終端視窗)
```bash
cd client
npm run dev
```

你應該會看到：
```
  VITE v6.3.5  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

## 6. 測試系統

1. 開啟瀏覽器前往 `http://localhost:5173`
2. 在 Telegram 中找到你的 bot
3. 發送 `/start` 指令
4. 發送任何 URL (例如: `https://www.google.com`)
5. 回到網站查看 URL 是否出現

## 故障排除

### MongoDB 連接問題
```bash
# 檢查 MongoDB 是否運行
brew services list | grep mongodb

# 如果沒有運行，啟動它
brew services start mongodb/brew/mongodb-community
```

### Bot 沒有回應
- 檢查 bot token 是否正確
- 確保 server 正在運行
- 檢查 console 是否有錯誤訊息

### CORS 錯誤
- 確保 server 運行在 port 4000
- 確保 client 運行在 port 5173
- 檢查防火牆設定

### URL 預覽無法載入
- 某些網站會阻止爬蟲，這是正常的
- 檢查網路連接
- 查看 server console 的錯誤訊息 