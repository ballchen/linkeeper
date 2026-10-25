# LinkKeeper iOS

SwiftUI 主 App + Share Extension。在任何 App 按「分享 → LinkKeeper」就會存起來，打開後自動送出，不需要按任何按鈕。

## 架構

| Target | 內容 |
| --- | --- |
| `LinkKeeper` | 主 App：Google 登入、收藏庫（搜尋、來源篩選、左滑／長按操作、刪除可復原）、設定（上傳佇列、已登入裝置） |
| `ShareExtension` | 分享面板：存好後顯示標題與縮圖，約 2 秒自動關閉；可加標籤或復原 |
| `LinkKeeperKit` | 兩者共用：API client、Keychain、App Group 佇列、色票、標籤編輯畫面 |

- **登入**：Google ID token → `POST /api/auth/google` 拿 JWT → `POST /api/auth/devices` 換一組長效 device token（`lkd_…`），存在 App 與 Extension 共用的 Keychain access group。之後新增、讀取連結都用 device token；JWT 只拿來管理裝置，過期時用 Google session 悄悄換新的。
- **不會丟連結**：Extension 一打開就先把分享寫進 App Group 的佇列，再送 server。沒網路時交給背景 `URLSession` 補送，主 App 開啟時和 `BGAppRefreshTask` 也會補送（server 依網址去重，重送安全）。
- **Safari 的 og 資訊**：`GetMetadata.js` 在頁面裡讀 og:title / og:image，跟著網址一起送，IG、FB 這類擋爬蟲的網站也能有標題與縮圖。

## 第一次設定

1. 同意 Xcode 授權並安裝 XcodeGen：
   ```sh
   sudo xcodebuild -license accept
   brew install xcodegen
   ```
2. 在 Google Cloud Console → Credentials 建立 **iOS** 類型的 OAuth client ID，Bundle ID 填 `cc.ballchen.linkkeeper`（或你在 `LK_BUNDLE_ID` 改的值）。
3. App 會用網頁版 client（`LK_GOOGLE_SERVER_CLIENT_ID`，即 server 的 `GOOGLE_CLIENT_ID`）當 ID token 的 audience，所以 server 不需要額外設定。
4. 建立本機設定：
   ```sh
   cp Config/Local.xcconfig.example Config/Local.xcconfig
   # 填入 LK_TEAM_ID、LK_GOOGLE_IOS_CLIENT_ID、LK_GOOGLE_REVERSED_CLIENT_ID
   ```
5. 產生專案並打開：
   ```sh
   xcodegen generate
   open LinkKeeper.xcodeproj
   ```
   使用 Automatic signing，Xcode 會自動註冊 App Group（`group.cc.ballchen.linkkeeper`）與 Keychain group。

`LinkKeeper.xcodeproj` 由 `project.yml` 產生、不進版控；新增或搬移檔案後重新執行 `xcodegen generate`。

## 連本機 server

在 `Config/Local.xcconfig` 設定 `LK_API_BASE_URL`。實機要用 Mac 的區網 IP；若使用 `http://`，需要另外加 ATS 例外。
