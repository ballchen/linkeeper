import XCTest

/// 從 Safari 分享到 LinkKeeper。需要本機 server，以及在 127.0.0.1:8765 提供有 og tag 的測試頁。
@MainActor
final class ShareExtensionTests: XCTestCase {
    func testShareFromSafari() throws {
        let token = try XCTUnwrap(ProcessInfo.processInfo.environment["LK_UITEST_DEVICE_TOKEN"])
        // 先開一次 App，讓 debug token 寫進共用 Keychain
        let app = XCUIApplication()
        app.launchArguments = ["-LKDebugDeviceToken", token, "-LKDebugSkipSetup", "YES"]
        app.launch()

        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.launch()
        safari.open(URL(string: "http://127.0.0.1:8765/coffee.html")!)
        XCTAssertTrue(safari.staticTexts["冷萃咖啡"].waitForExistence(timeout: 15))
        safari.buttons["MoreMenuButton"].tap()
        safari.buttons["ShareButton"].tap()
        let target = safari.descendants(matching: .any).matching(NSPredicate(format: "label == 'LinkKeeper'")).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: 5))
        target.tap()

        // 面板在 Safari 的畫面上，用 springboard 層級抓不到；直接截整個螢幕
        let screen = XCUIScreen.main
        // 存好後點「加標籤」，畫面就停住不會自動關閉
        let addTag = safari.buttons["加標籤"]
        XCTAssertTrue(addTag.waitForExistence(timeout: 10))
        attach(screen.screenshot(), "1-saved")
        addTag.tap()
        XCTAssertTrue(safari.staticTexts["標籤"].waitForExistence(timeout: 3))
        safari.typeText("咖啡\n")
        attach(screen.screenshot(), "2-tagging")
        safari.buttons["完成"].firstMatch.tap()
        sleep(1)
        attach(screen.screenshot(), "3-tagged")
        sleep(3)
        attach(screen.screenshot(), "4-closed")
    }

    /// server 關掉時分享：應顯示「已先存在手機上」
    func testShareWhileOffline() throws {
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.launch()
        safari.open(URL(string: "http://127.0.0.1:8765/coffee.html")!)
        XCTAssertTrue(safari.staticTexts["冷萃咖啡"].waitForExistence(timeout: 15))
        safari.buttons["MoreMenuButton"].tap()
        safari.buttons["ShareButton"].tap()
        let target = safari.descendants(matching: .any).matching(NSPredicate(format: "label == 'LinkKeeper'")).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: 5))
        target.tap()
        XCTAssertTrue(safari.staticTexts["已先存在手機上"].waitForExistence(timeout: 15))
        attach(XCUIScreen.main.screenshot(), "offline")
    }

    private func attach(_ screenshot: XCUIScreenshot, _ name: String) {
        let shot = XCTAttachment(screenshot: screenshot)
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    private func dump(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "\(name)-tree"
        tree.lifetime = .keepAlways
        add(tree)
    }
}
