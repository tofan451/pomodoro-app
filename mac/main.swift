// Focus — native macOS wrapper for the Pomodoro web app.
//
// Serves the bundled web files on a loopback HTTP server and loads them in
// a WKWebView. Running on http://127.0.0.1 (instead of file://) lets the
// Google Drive OAuth redirect return to the app and gives localStorage a
// stable origin. Build with mac/build.sh (produces Focus.app).

import Cocoa
import Network
import WebKit

let SERVER_PORT: UInt16 = 53412

/// Minimal GET-only static file server bound to 127.0.0.1.
final class LocalServer {
    private let listener: NWListener
    private let root: URL

    init(root: URL, port: UInt16) throws {
        self.root = root
        let params = NWParameters.tcp
        params.requiredLocalEndpoint = NWEndpoint.hostPort(
            host: "127.0.0.1",
            port: NWEndpoint.Port(rawValue: port)!
        )
        listener = try NWListener(using: params)
        listener.newConnectionHandler = { [weak self] connection in
            self?.handle(connection)
        }
        listener.start(queue: .global(qos: .userInitiated))
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: .global(qos: .userInitiated))
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) {
            [weak self] data, _, _, _ in
            guard let self, let data,
                  let request = String(data: data, encoding: .utf8) else {
                connection.cancel()
                return
            }
            let parts = request.split(separator: " ", maxSplits: 2)
            guard parts.count >= 2, parts[0] == "GET" else {
                self.send(connection, status: "405 Method Not Allowed", body: Data(), mime: "text/plain")
                return
            }
            var path = String(parts[1].split(separator: "?").first ?? "/")
            path = path.removingPercentEncoding ?? path
            if path == "/" { path = "/index.html" }
            // No path traversal.
            guard !path.contains("..") else {
                self.send(connection, status: "403 Forbidden", body: Data(), mime: "text/plain")
                return
            }
            let fileURL = self.root.appendingPathComponent(String(path.dropFirst()))
            guard let body = try? Data(contentsOf: fileURL) else {
                self.send(connection, status: "404 Not Found", body: Data("not found".utf8), mime: "text/plain")
                return
            }
            let mime: String
            switch fileURL.pathExtension.lowercased() {
            case "html": mime = "text/html; charset=utf-8"
            case "css": mime = "text/css; charset=utf-8"
            case "js": mime = "text/javascript; charset=utf-8"
            case "json": mime = "application/json"
            case "png": mime = "image/png"
            case "jpg", "jpeg": mime = "image/jpeg"
            case "svg": mime = "image/svg+xml"
            case "mp3": mime = "audio/mpeg"
            case "webmanifest": mime = "application/manifest+json"
            case "m4a": mime = "audio/mp4"
            case "wav": mime = "audio/wav"
            case "icns": mime = "image/x-icns"
            default: mime = "application/octet-stream"
            }
            self.send(connection, status: "200 OK", body: body, mime: mime)
        }
    }

    private func send(_ connection: NWConnection, status: String, body: Data, mime: String) {
        var response = Data(
            ("HTTP/1.1 \(status)\r\n" +
             "Content-Type: \(mime)\r\n" +
             "Content-Length: \(body.count)\r\n" +
             "Cache-Control: no-cache\r\n" +
             "Connection: close\r\n\r\n").utf8
        )
        response.append(body)
        connection.send(content: response, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var server: LocalServer?
    var titleObservation: NSKeyValueObservation?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()

        let resources = Bundle.main.resourceURL!
        server = try? LocalServer(root: resources, port: SERVER_PORT)

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // persists localStorage across launches
        webView = WKWebView(frame: .zero, configuration: config)
        // A Safari user agent so Google's OAuth page accepts the sign-in.
        webView.customUserAgent =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
            "(KHTML, like Gecko) Version/17.4 Safari/605.1.15"

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1080, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Focus"
        window.minSize = NSSize(width: 360, height: 620)
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(red: 0.055, green: 0.067, blue: 0.086, alpha: 1)
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("FocusMainWindow")
        window.makeKeyAndOrderFront(nil)

        // Mirror the page title (it carries the live countdown) in the title bar.
        titleObservation = webView.observe(\.title, options: [.new]) { [weak self] view, _ in
            self?.window.title = (view.title?.isEmpty == false) ? view.title! : "Focus"
        }

        if server != nil {
            let url = URL(string: "http://127.0.0.1:\(SERVER_PORT)/index.html")!
            webView.load(URLRequest(url: url))
        } else {
            // Fallback: local file load (Drive sync unavailable in this mode).
            webView.loadFileURL(
                resources.appendingPathComponent("index.html"),
                allowingReadAccessTo: resources
            )
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    // Minimal menu so standard shortcuts (Cmd+Q, copy/paste in inputs) work.
    private func buildMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(
            withTitle: "About Focus",
            action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
            keyEquivalent: ""
        )
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(
            withTitle: "Hide Focus",
            action: #selector(NSApplication.hide(_:)),
            keyEquivalent: "h"
        )
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(
            withTitle: "Quit Focus",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)

        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu
        mainMenu.addItem(editItem)

        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowItem.submenu = windowMenu
        mainMenu.addItem(windowItem)

        NSApp.mainMenu = mainMenu
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
