// The native application window, built on WKWebView.
// Compiled only when swiftc is present (Xcode Command Line Tools).
// The menu is deliberately minimal: ⌘T, ⌘D, ⌘R, ⌘C and ⌘V must reach the page
// rather than being swallowed by system menu items.
//
// It also owns the learner's progress. WKWebView's own storage is tied to the
// page's origin, which includes the port of the local server, and is refused
// outright for file:// pages — so relying on it meant losing everything between
// launches. Instead the window reads progress.json before the page loads,
// hands it to the page, and writes it back whenever the page says it changed.
import Cocoa
import WebKit

/// progress.json in ~/Library/Application Support/ExcelTrainer.
final class ProgressStore {
    let url: URL

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support")
        let dir = base.appendingPathComponent("ExcelTrainer", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        url = dir.appendingPathComponent("progress.json")
    }

    func read() -> String? {
        guard let data = try? Data(contentsOf: url), !data.isEmpty else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Writes through a temporary file, so an interrupted write cannot leave a
    /// half-finished progress file behind.
    func write(_ json: String) {
        guard let data = json.data(using: .utf8) else { return }
        let tmp = url.deletingLastPathComponent()
            .appendingPathComponent(".progress-\(UUID().uuidString).tmp")
        do {
            try data.write(to: tmp, options: .atomic)
            _ = try FileManager.default.replaceItemAt(url, withItemAt: tmp)
        } catch {
            try? FileManager.default.removeItem(at: tmp)
            try? data.write(to: url, options: .atomic)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate,
                         WKScriptMessageHandler {
    private let target: String
    private let store = ProgressStore()
    private var window: NSWindow!
    private var web: WKWebView!

    init(target: String) {
        self.target = target
        super.init()
    }

    func applicationDidFinishLaunching(_ note: Notification) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(self, name: "trainerStore")
        installProgressScript(into: config.userContentController)

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

    /// Puts the saved progress on the page before any of its own scripts run.
    /// Re-installed before every navigation so that a reload sees what the last
    /// visit wrote rather than what was on disk when the app started.
    private func installProgressScript(into controller: WKUserContentController) {
        controller.removeAllUserScripts()
        let saved = store.read()
        let savedLiteral = saved.flatMap { text -> String? in
            guard let data = try? JSONSerialization.data(withJSONObject: [text], options: []),
                  let array = String(data: data, encoding: .utf8) else { return nil }
            return String(array.dropFirst().dropLast())          // the quoted string alone
        } ?? "null"
        let pathLiteral = (try? JSONSerialization.data(withJSONObject: [store.url.path], options: []))
            .flatMap { String(data: $0, encoding: .utf8) }
            .map { String($0.dropFirst().dropLast()) } ?? "\"\""
        let source = """
        window.__XLTrainerNative = { saved: \(savedLiteral), path: \(pathLiteral) };
        """
        controller.addUserScript(WKUserScript(source: source,
                                              injectionTime: .atDocumentStart,
                                              forMainFrameOnly: true))
    }

    // The page asks for its progress to be written.
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "trainerStore",
              let body = message.body as? [String: Any],
              (body["op"] as? String) == "save",
              let json = body["json"] as? String else { return }
        store.write(json)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.targetFrame?.isMainFrame == true {
            installProgressScript(into: webView.configuration.userContentController)
        }
        decisionHandler(.allow)
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

    /// One last save before the app goes away, in case a change was still in
    /// flight when the learner quit. Quitting is held back — without blocking
    /// the main thread — until the page has handed its progress over, and the
    /// timer guarantees that a page which cannot answer never traps the app.
    private var replied = false

    private func finishTerminating() {
        if replied { return }
        replied = true
        NSApp.reply(toApplicationShouldTerminate: true)
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let web = web else { return .terminateNow }
        let js = "window.XLStore && window.XLStore.data ? JSON.stringify(window.XLStore.data) : null"
        web.evaluateJavaScript(js) { [weak self] value, _ in
            if let json = value as? String { self?.store.write(json) }
            self?.finishTerminating()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.finishTerminating()
        }
        return .terminateLater
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

let target = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "http://127.0.0.1:17324/index.html"
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate(target: target)
app.delegate = delegate
buildMenu()
app.run()
