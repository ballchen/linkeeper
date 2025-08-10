# 🎥 YouTube API 設定指南

## 為什麼使用 YouTube API？

原本系統使用爬蟲方式獲取 YouTube 影片資訊，但容易遇到以下問題：
- **429 Too Many Requests** 錯誤
- 被 YouTube 反爬蟲機制阻擋
- 獲取的資訊不穩定

使用 YouTube API 可以：
- ✅ 獲得穩定可靠的影片資訊
- ✅ 避免 429 錯誤
- ✅ 取得高品質的縮圖
- ✅ 獲得完整的影片 metadata (標題、描述、標籤等)

## 📋 前置條件

你需要有 Google 帳號來建立 YouTube API 金鑰。

## 🔧 設定步驟

### 1. 建立 Google Cloud Project

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊「建立專案」或選擇現有專案
3. 為你的專案命名，例如 "LinKeeper"

### 2. 啟用 YouTube Data API v3

1. 在 Google Cloud Console 中，前往「API 和服務」→「程式庫」
2. 搜尋 "YouTube Data API v3"
3. 點擊並啟用該 API

### 3. 建立 API 金鑰

1. 前往「API 和服務」→「憑證」
2. 點擊「建立憑證」→「API 金鑰」
3. 複製生成的 API 金鑰

### 4. 設定 API 金鑰限制 (推薦)

為了安全性，建議限制 API 金鑰的使用：

1. 點擊剛建立的 API 金鑰進行編輯
2. 在「API 限制」中選擇「限制金鑰」
3. 選擇 "YouTube Data API v3"
4. 儲存變更

### 5. 設定環境變數

在 `server/.env` 檔案中加入：

```env
YOUTUBE_API_KEY=your_youtube_api_key_here
```

## 📊 配額限制

YouTube API 有免費配額限制：
- **每日配額**: 10,000 units (通常足夠個人使用)
- **每次影片查詢**: 約使用 1-3 units

如果超過配額，系統會自動回退到爬蟲模式。

## ✅ 測試設定

設定完成後，你可以測試 YouTube API 是否正常運作：

```bash
cd server
npm run test-metadata "https://youtu.be/dQw4w9WgXcQ"
```

成功的話會看到：
```
✅ Success (XXXms)
📝 Title: Rick Astley - Never Gonna Give You Up (Official Video)
📄 Description: Rick Astley's official music video for...
🖼️  Image: maxresdefault.jpg
🎯 Source: youtube
🏷️  Type: video
```

## 🔍 支援的 YouTube URL 格式

系統支援所有常見的 YouTube URL 格式：

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`

## ⚠️ 故障排除

### API 金鑰無效
- 檢查 API 金鑰是否正確複製
- 確認 YouTube Data API v3 已啟用
- 檢查 API 金鑰的限制設定

### 配額用盡
- 檢查 Google Cloud Console 中的配額使用量
- 系統會自動回退到爬蟲模式
- 考慮升級到付費方案 (一般用戶很少需要)

### 影片無法找到
- 某些私人影片或受地區限制的影片無法透過 API 存取
- 系統會回退到爬蟲模式

## 🎯 成本估算

YouTube API 的使用是免費的，在免費配額內：
- **每日 10,000 units** = 約 3,000-10,000 次影片查詢
- 超過配額後會使用爬蟲備案

對於個人使用，免費配額通常足夠。

## 📚 參考資料

- [YouTube Data API v3 文件](https://developers.google.com/youtube/v3)
- [配額與定價](https://developers.google.com/youtube/v3/getting-started#quota)
- [API 金鑰最佳實踐](https://cloud.google.com/docs/authentication/api-keys)
