# Google 登入功能設定指南

## 🔧 Google Cloud Console 設定

### 1. 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 專案名稱建議：`LinkKeeper`

### 2. 啟用 Google+ API

1. 在左側選單選擇 **APIs & Services** → **Library**
2. 搜尋 "Google+ API" 或 "Google Identity"
3. 點擊啟用

### 3. 設定 OAuth 2.0 認證資訊

1. 左側選單 → **APIs & Services** → **Credentials**
2. 點擊 **CREATE CREDENTIALS** → **OAuth client ID**
3. 首次設定需要配置 OAuth consent screen：
   - User Type: External
   - App name: LinkKeeper
   - User support email: 您的 email
   - Developer contact information: 您的 email

### 4. 建立 OAuth Client ID

1. Application type: **Web application**
2. 名稱：`LinkKeeper Web Client`
3. **Authorized JavaScript origins**：
   ```
   http://localhost:3000
   https://lk.ballchen.cc
   ```
4. **Authorized redirect URIs**：
   ```
   http://localhost:3000
   https://lk.ballchen.cc
   ```
5. 點擊 **Create**
6. 記下 **Client ID** 和 **Client Secret**

## 📝 環境變數設定

### 後端環境變數 (server/.env)

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/url-saver

# Server Configuration
PORT=4000
NODE_ENV=production

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=你的_telegram_bot_token
TELEGRAM_API_KEY=你的_secure_api_key

# JWT Configuration (生成一個至少 32 字元的隨機字串)
JWT_SECRET=你的_非常安全的_jwt_secret_至少32字元長

# Google OAuth Configuration
GOOGLE_CLIENT_ID=你的_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=你的_google_client_secret

# User Authentication (用逗號分隔的允許登入的 email 地址)
ALLOWED_EMAILS=your-email@gmail.com,another-allowed@domain.com

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=你的_aws_access_key
AWS_SECRET_ACCESS_KEY=你的_aws_secret_key
AWS_REGION=你的_aws_region
AWS_S3_BUCKET=你的_s3_bucket_name
```

### 前端環境變數 (client/.env)

前端不需要額外的環境變數，Google Client ID 會從後端 API 自動取得。

## 🚀 部署步驟

### 1. 設定環境變數

```bash
# 在伺服器上設定環境變數
cd /path/to/your/linkkeeper/server
cp .env.example .env
# 編輯 .env 檔案，填入上述的設定值
nano .env
```

### 2. 安裝相依套件

```bash
# 後端
cd server
npm install

# 前端
cd ../client
npm install
```

### 3. 建置和部署

```bash
# 使用現有的部署腳本
make deploy
# 或
./deploy.sh
```

### 4. 驗證部署

1. 前端應該顯示 Google 登入按鈕
2. 登入後應該能看到用戶頭像和名稱
3. 只有白名單中的 email 可以成功登入

## 🔒 安全性注意事項

### JWT Secret 產生

```bash
# 使用 Node.js 產生安全的 JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 白名單設定

在 `ALLOWED_EMAILS` 中只添加您信任的 email 地址：

```bash
ALLOWED_EMAILS=admin@yourdomain.com,trusted-user@gmail.com
```

### Google OAuth 安全設定

1. 定期檢查 OAuth consent screen 設定
2. 監控 API 使用量
3. 確保 redirect URIs 只包含您的域名

## 🧪 測試

### 本地測試

1. 啟動後端：`cd server && npm run dev`
2. 啟動前端：`cd client && npm run dev`
3. 訪問 `http://localhost:3000`
4. 嘗試使用白名單中的 Google 帳號登入

### 生產環境測試

1. 訪問 `https://lk.ballchen.cc`
2. 測試登入功能
3. 確認 API 認證正常運作
4. 測試 Telegram bot 仍可正常運作

## ❓ 常見問題

### Q: 登入後出現 "Authentication required" 錯誤

**A:** 檢查：
1. JWT_SECRET 是否設定
2. 用戶 email 是否在 ALLOWED_EMAILS 白名單中
3. 前端是否正確發送 Authorization header

### Q: Google 登入按鈕沒有出現

**A:** 檢查：
1. 後端 `/api/auth/config` endpoint 是否正常
2. GOOGLE_CLIENT_ID 是否正確設定
3. 瀏覽器開發者工具的網路請求

### Q: Telegram bot 無法存取 API

**A:** Telegram bot 使用 API key 認證，不受 Google 登入影響。確保 `TELEGRAM_API_KEY` 設定正確。

## 📞 支援

如果遇到問題，請檢查：

1. 伺服器日誌：`journalctl -u linkkeeper-server -f`
2. PM2 日誌：`pm2 logs linkkeeper-server`
3. nginx 日誌：`sudo tail -f /var/log/nginx/error.log` 