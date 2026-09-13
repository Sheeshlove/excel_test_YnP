// The native application window, built on WKWebView.
// Compiled only when swiftc is present (Xcode Command Line Tools).
// The menu is deliberately minimal: ⌘T, ⌘D, ⌘R, ⌘C and ⌘V must reach the page
// rather than being swallowed by system menu items.
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
        window.title = "Excel Trainer - Yakov & Partners test preparation"
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

    // JavaScript dialogs (confirm/alert) raised by the page
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
        a.addButton(withTitle: "Cancel")
        a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn) }
    }
}

func buildMenu() {
    let main = NSMenu()

    let appItem = NSMenuItem()
    main.addItem(appItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "About Excel Trainer", action: nil, keyEquivalent: "")
    appMenu.addItem(NSMenuItem.separator())
    appMenu.addItem(withTitle: "Hide", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    appMenu.addItem(withTitle: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu

    let winItem = NSMenuItem()
    main.addItem(winItem)
    let winMenu = NSMenu(title: "Window")
    winMenu.addItem(withTitle: "Minimise", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    winMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
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
