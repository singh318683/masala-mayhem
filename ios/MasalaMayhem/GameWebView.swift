import SwiftUI
import WebKit

/// Runs the bundled web game (the `web` folder) fully offline and connects it to AdMob.
///
/// The game sends messages through `window.webkit.messageHandlers.mm`:
///   { type: "screen", name: "title" | "map" | "game" }
///   { type: "interstitial" }
///   { type: "rewarded", id: <number> }  → answered with window.MMNative.onReward(id, true/false)
struct GameWebView: UIViewRepresentable {
    @Binding var screen: String

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(context.coordinator, name: "mm")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 27 / 255, green: 16 / 255, blue: 53 / 255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        context.coordinator.webView = webView

        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        let parent: GameWebView
        weak var webView: WKWebView?

        init(_ parent: GameWebView) { self.parent = parent }

        // Messages from the game
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            switch type {
            case "screen":
                if let name = body["name"] as? String {
                    DispatchQueue.main.async { self.parent.screen = name }
                }
            case "interstitial":
                AdManager.shared.showInterstitial()
            case "rewarded":
                let id = (body["id"] as? NSNumber)?.intValue ?? 0
                AdManager.shared.showRewarded { [weak self] earned in
                    self?.webView?.evaluateJavaScript("window.MMNative && window.MMNative.onReward(\(id), \(earned))")
                }
            default:
                break
            }
        }

        // Keep the game inside the app; open web links (e.g. the recipe video) in Safari.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = action.request.url, let scheme = url.scheme?.lowercased(),
               (scheme == "http" || scheme == "https"), action.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // Links with target="_blank"
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url { UIApplication.shared.open(url) }
            return nil
        }
    }
}
