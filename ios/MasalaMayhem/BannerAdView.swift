import SwiftUI
import GoogleMobileAds

/// A standard 320×50 AdMob banner.
struct BannerAdView: UIViewRepresentable {
    func makeUIView(context: Context) -> BannerView {
        let banner = BannerView(adSize: AdSizeBanner)
        banner.adUnitID = AdConfig.bannerID
        banner.rootViewController = AdManager.topViewController()
        banner.load(Request())
        return banner
    }

    func updateUIView(_ banner: BannerView, context: Context) {
        if banner.rootViewController == nil {
            banner.rootViewController = AdManager.topViewController()
        }
    }
}
