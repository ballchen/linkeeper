import XCTest

/// 走過主要畫面並截圖（附在 xcresult 裡）。需要本機 server 與 debug device token：
/// LK_UITEST_DEVICE_TOKEN=lkd_… xcodebuild test -scheme LinkKeeper …
@MainActor
final class WalkthroughTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        let token = try XCTUnwrap(ProcessInfo.processInfo.environment["LK_UITEST_DEVICE_TOKEN"], "需要 LK_UITEST_DEVICE_TOKEN")
        app = XCUIApplication()
        app.launchArguments = ["-LKDebugDeviceToken", token, "-LKDebugSkipSetup", "YES"]
        app.launch()
    }

    func testWalkthrough() throws {
        let firstCard = app.buttons.matching(NSPredicate(format: "label CONTAINS '80ms'")).firstMatch
        XCTAssertTrue(firstCard.waitForExistence(timeout: 10))
        snapshot("1-library")

        app.buttons["YouTube"].tap()
        sleep(1)
        snapshot("2-filter-youtube")
        app.buttons["全部"].tap()

        firstCard.press(forDuration: 1.0)
        sleep(1)
        snapshot("3-context-menu")
        app.buttons["編輯標籤"].tap()
        XCTAssertTrue(app.staticTexts["標籤"].waitForExistence(timeout: 3))
        app.typeText("讀書")
        snapshot("4-tag-editor")
        app.buttons["完成"].firstMatch.tap()
        sleep(1)

        firstCard.swipeLeft()
        sleep(1)
        snapshot("5-swipe")
        app.buttons["刪除"].firstMatch.tap()
        XCTAssertTrue(app.buttons["復原"].waitForExistence(timeout: 2))
        snapshot("6-undo-toast")
        app.buttons["復原"].tap()
        XCTAssertTrue(firstCard.waitForExistence(timeout: 3))

        app.buttons["設定"].tap()
        XCTAssertTrue(app.staticTexts["上傳佇列"].waitForExistence(timeout: 5))
        sleep(2)
        snapshot("7-settings")
    }

    private func snapshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
