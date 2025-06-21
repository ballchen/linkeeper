# LinkKeeper 部署指南

這份文件說明如何輕鬆部署 LinkKeeper 前端和後端應用程式。

## 🚀 快速開始

### 1. 環境檢查
```bash
make check
# 或
./check-env.sh
```

### 2. 安裝依賴
```bash
make install
```

### 3. 完整部署
```bash
make deploy
# 或
./deploy.sh
```

### 4. 快速部署 (適合小更新)
```bash
make deploy-quick
# 或
./quick-deploy.sh
```

## 📋 部署腳本說明

### 主要腳本

| 腳本 | 用途 | 使用時機 |
|------|------|----------|
| `deploy.sh` | 完整部署，包含安全檢查和備份 | 重大更新、首次部署 |
| `quick-deploy.sh` | 快速部署，最少檢查 | 小更新、緊急修復 |
| `check-env.sh` | 環境檢查和驗證 | 部署前檢查、故障排除 |

### Makefile 指令

```bash
# 查看所有可用指令
make help

# 環境設定
make install        # 安裝所有依賴
make check          # 檢查環境設定

# 建置
make build          # 建置前後端
make build-frontend # 只建置前端
make build-backend  # 只建置後端

# 部署
make deploy         # 完整部署
make deploy-quick   # 快速部署
make deploy-frontend # 只部署前端
make deploy-backend  # 只部署後端

# 服務管理
make start          # 啟動所有服務
make stop           # 停止所有服務
make restart        # 重啟所有服務
make status         # 查看服務狀態
make logs           # 查看後端日誌

# 維護
make clean          # 清理建置檔案
make backup         # 建立備份
make health         # 健康檢查
make reanalyze      # 重新分析所有 URL 並上傳圖片到 S3
```

## 🎯 部署選項

### 完整部署 (`deploy.sh`)
```bash
# 完整部署 (前端 + 後端)
./deploy.sh

# 只部署前端
./deploy.sh --frontend-only

# 只部署後端
./deploy.sh --backend-only

# 跳過建置過程
./deploy.sh --skip-build
```

**特色：**
- ✅ 完整的錯誤檢查
- ✅ 自動備份
- ✅ nginx 設定測試
- ✅ 健康檢查
- ✅ 自動回滾（如果失敗）
- ✅ 備份清理

### 快速部署 (`quick-deploy.sh`)
```bash
./quick-deploy.sh
```

**特色：**
- ⚡ 快速執行
- ⚡ 最少檢查
- ⚡ 適合小更新

## 🔧 環境需求

### 必要軟體
- Node.js (v16+)
- npm 或 yarn
- PM2
- nginx
- sudo 權限

### 目錄結構
```
/home/ball/project/linkeeper/
├── client/
│   ├── dist/           # 前端建置檔案
│   ├── src/
│   └── package.json
├── server/
│   ├── dist/           # 後端建置檔案
│   ├── src/
│   ├── .env            # 環境變數
│   └── package.json
├── deploy.sh           # 主要部署腳本
├── quick-deploy.sh     # 快速部署腳本
├── check-env.sh        # 環境檢查腳本
└── Makefile           # Make 指令
```

### 環境變數設定

#### 後端 (`server/.env`)
```bash
# 資料庫
MONGODB_URI=mongodb://localhost:27017/link-keeper

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here

# API 安全
INTERNAL_API_KEY=your_secure_api_key_here

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=linkeeper

# 伺服器設定
PORT=4000
NODE_ENV=production
```

#### 前端 (`client/.env.local`)
```bash
VITE_API_BASE_URL=https://lk-api.ballchen.cc/api
```

## 🌐 nginx 設定

您的 nginx 設定應該包含：

```nginx
# API 伺服器
server {
    listen 443 ssl;
    server_name lk-api.ballchen.cc;
    
    location / {
        proxy_pass http://127.0.0.1:4000/;
        proxy_redirect off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    ssl_certificate /etc/letsencrypt/live/lk-api.ballchen.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lk-api.ballchen.cc/privkey.pem;
}

# 前端網站
server {
    listen 443 ssl;
    server_name lk.ballchen.cc;
    
    location / {
        root /home/ball/project/linkeeper/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    ssl_certificate /etc/letsencrypt/live/lk-api.ballchen.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lk-api.ballchen.cc/privkey.pem;
}
```

## 🚨 故障排除

### 常見問題

1. **PM2 服務無法啟動**
   ```bash
   # 檢查 PM2 狀態
   pm2 status
   
   # 查看錯誤日誌
   pm2 logs url-saver-server
   
   # 重啟服務
   pm2 restart url-saver-server
   ```

2. **nginx 設定錯誤**
   ```bash
   # 測試 nginx 設定
   sudo nginx -t
   
   # 重新載入設定
   sudo nginx -s reload
   ```

3. **權限問題**
   ```bash
   # 修正前端檔案權限
   sudo chown -R www-data:www-data /home/ball/project/linkeeper/client/dist
   sudo chmod -R 755 /home/ball/project/linkeeper/client/dist
   ```

4. **環境變數遺失**
   ```bash
   # 檢查環境變數
   ./check-env.sh
   
   # 確認 .env 檔案存在
   ls -la server/.env
   ```

### 日誌檔案位置

- **PM2 日誌**: `server/logs/`
- **nginx 日誌**: `/var/log/nginx/`
- **系統日誌**: `journalctl -u nginx`

## 🔄 自動化部署

### 設定 Git Hook (可選)
```bash
# 在 .git/hooks/post-receive 新增
#!/bin/bash
cd /home/ball/project/linkeeper
./deploy.sh --skip-build
```

### 設定 Cron Job (可選)
```bash
# 每日自動健康檢查
0 2 * * * /home/ball/project/linkeeper/check-env.sh
```

## 📊 監控和維護

### 定期檢查
```bash
make status    # 檢查服務狀態
make health    # 執行健康檢查
make logs      # 查看近期日誌
```

### 備份
```bash
make backup    # 手動備份
```

備份檔案會儲存在 `backups/` 目錄中，系統會自動保留最近 5 個備份。

### 重新分析和 S3 遷移
```bash
make reanalyze      # 重新分析所有 URL 並上傳圖片到 S3
```

**什麼時候需要執行重新分析？**
- 升級到 S3 圖片儲存後，將舊的圖片 URL 遷移到 S3
- 修復損壞的圖片連結
- 更新過時的 metadata 資訊
- 重新檢測 URL 來源類型（Facebook、Instagram 等）

**重新分析功能：**
- 🔄 重新獲取所有 URL 的 metadata
- 📸 下載並上傳圖片到 S3
- 🏷️ 重新檢測 URL 來源類型
- 📊 詳細的處理統計報告
- ⚡ 智慧錯誤處理和恢復

## 🎉 部署完成

部署成功後，您可以訪問：

- 🌐 **前端**: https://lk.ballchen.cc
- 🔌 **API**: https://lk-api.ballchen.cc

---

**提示**: 建議先在測試環境執行 `make check` 確認所有設定正確，再進行正式部署。 