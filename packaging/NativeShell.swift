// Родное окно приложения на WKWebView.
// Собирается только если на машине есть swiftc (Xcode Command Line Tools).
// Меню намеренно минимальное: ⌘T, ⌘D, ⌘R, ⌘C, ⌘V должны доставаться странице,
// а не перехватываться системными пунктами меню.
import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    private let target: String
    private var window: NSWindow!
    private var web: WKWebView!

    init(target: String) {
        self.target = target
        super.init()
    }

    func applicationDidFinishLaunching(_ note: Notification) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let rect = NSRect(x: 0, y: 0, width: 1320, height: 880)
        web = WKWebView(frame: rect, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false

        window = NSWindow(contentRect: rect,
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Excel-тренажёр · подготовка к тесту"
        window.contentView = web
        window.setFrameAutosaveName("ExcelTrainerWindow")
        window.minSize = NSSize(width: 1024, height: 640)
        window.center()
        window.makeKeyAndOrderFront(nil)

        if let url = URL(string: target) {
            web.load(URLRequest(url: url))
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    // JS-диалоги (confirm/alert) внутри страницы
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.addButton(withTitle: "OK")
        a.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.addButton(withTitle: "OK")
        a.addButton(withTitle: "Отмена")
        a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn) }
    }
}

func buildMenu() {
    let main = NSMenu()

    let appItem = NSMenuItem()
    main.addItem(appItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "О тренажёре", action: nil, keyEquivalent: "")
    appMenu.addItem(NSMenuItem.separator())
    appMenu.addItem(withTitle: "Скрыть", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    appMenu.addItem(withTitle: "Выйти", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu

    let winItem = NSMenuItem()
    main.addItem(winItem)
    let winMenu = NSMenu(title: "Окно")
    winMenu.addItem(withTitle: "Свернуть", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    winMenu.addItem(withTitle: "Закрыть", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    winItem.submenu = winMenu

    NSApp.mainMenu = main
}

let target = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "http://127.0.0.1:8000/index.html"
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate(target: target)
app.delegate = delegate
buildMenu()
app.run()
