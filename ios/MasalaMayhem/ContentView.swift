import SwiftUI

extension Color {
    /// The game's background purple (#1B1035).
    static let masalaBackground = Color(red: 27 / 255, green: 16 / 255, blue: 53 / 255)
}

struct ContentView: View {
    @ObservedObject private var ads = AdManager.shared
    /// The web game tells us which screen it is on. Banners show on the title and map
    /// screens only, never on top of the puzzle board.
    @State private var screen = "title"

    private var bannerVisible: Bool { ads.canShowAds && screen != "game" }

    var body: some View {
        VStack(spacing: 0) {
            GameWebView(screen: $screen)
                .ignoresSafeArea(edges: bannerVisible ? .top : .all)

            if bannerVisible {
                BannerAdView()
                    .frame(width: 320, height: 50)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)
                    .background(Color.masalaBackground)
            }
        }
        .background(Color.masalaBackground.ignoresSafeArea())
        .statusBarHidden(false)
        .onAppear { ads.bootstrap() }
    }
}
