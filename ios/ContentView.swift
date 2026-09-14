//  ContentView.swift
//  Excel Trainer — the whole iOS app, in one file.
//
//  Replace the ContentView.swift that Xcode generates with this file, drag the
//  "Web" folder into the project as a FOLDER REFERENCE (blue, not yellow), and
//  the app is done. See ios/README.md for the click-by-click version.
//
//  Why a custom URL scheme instead of file:// —
//  WKWebView disables localStorage for file:// URLs, which would throw away the
//  learner's progress on every launch. A custom scheme gets a proper origin, so
//  storage behaves exactly as it does on a website. This is the same trick the
//  mainstream hybrid frameworks use.

import SwiftUI
import WebKit

// MARK: - Serving the bundled web app

private let appScheme = "trainer"
private let appHost = "app"

final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {

    private let root: URL

    init(root: URL) {
        self.root = root
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        var relative = url.path
        if relative.isEmpty || relative == "/" { relative = "/index.html" }
        if relative.hasPrefix("/") { relative.removeFirst() }

        // never let a crafted path climb out of the bundled folder
        let file = root.appendingPathComponent(relative).standardizedFileURL
        guard file.path.hasPrefix(root.standardizedFileURL.path),
              let data = try? Data(contentsOf: file) else {
            let missing = HTTPURLResponse(url: url, statusCode: 404,
                                          httpVersion: "HTTP/1.1", headerFields: nil)!
            urlSchemeTask.didReceive(missing)
            urlSchemeTask.didFinish()
            return
        }

        let response = HTTPURLResponse(
            url: url, statusCode: 200, httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": Self.mimeType(for: file.pathExtension),
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*"
            ])!
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) { }

    private static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js":   return "text/javascript; charset=utf-8"
        case "css":  return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json; charset=utf-8"
        case "png":  return "image/png"
        case "svg":  return "image/svg+xml"
        default:     return "application/octet-stream"
        }
    }
}

// MARK: - The web view

struct TrainerWebView: UIViewRepresentable {

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()           // persistent localStorage
        config.allowsInlineMediaPlayback = true

        if let root = Bundle.main.url(forResource: "Web", withExtension: nil) {
            config.setURLSchemeHandler(BundleSchemeHandler(root: root), forURLScheme: appScheme)
        }

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.bounces = false                       // no rubber-band on the page
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.06, green: 0.15, blue: 0.25, alpha: 1)

        if let url = URL(string: "\(appScheme)://\(appHost)/index.html") {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) { }
}

// MARK: - Screen

struct ContentView: View {
    var body: some View {
        TrainerWebView()
            .ignoresSafeArea()        // the CSS handles the notch with safe-area insets
            .statusBarHidden(false)
    }
}

#Preview {
    ContentView()
}
