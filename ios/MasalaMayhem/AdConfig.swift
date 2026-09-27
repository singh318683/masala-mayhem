import Foundation

/// All AdMob settings in one place.
///
/// Debug builds (running from Xcode onto your phone) show Google's TEST ads, which are
/// safe to tap. Release builds (Archive → TestFlight / App Store) show REAL ads.
/// Never tap real ads on your own device — AdMob can suspend the account.
///
/// AdMob app ID (also in Info.plist → GADApplicationIdentifier):
///   ca-app-pub-7991398343029209~8752428802
enum AdConfig {
    #if DEBUG
    static let useTestAds = true
    #else
    static let useTestAds = false
    #endif

    // ---- Real ad unit IDs (AdMob → Apps → Masala Mayhem → Ad units) ----
    private static let realBanner       = "ca-app-pub-7991398343029209/3500102123"
    private static let realInterstitial = "ca-app-pub-7991398343029209/3577881333"
    private static let realRewarded     = "ca-app-pub-7991398343029209/8564726544"

    // ---- Google's public test IDs (do not change) ----
    private static let testBanner       = "ca-app-pub-3940256099942544/2934735716"
    private static let testInterstitial = "ca-app-pub-3940256099942544/4411468910"
    private static let testRewarded     = "ca-app-pub-3940256099942544/1712485313"

    static var bannerID: String       { useTestAds ? testBanner : realBanner }
    static var interstitialID: String { useTestAds ? testInterstitial : realInterstitial }
    static var rewardedID: String     { useTestAds ? testRewarded : realRewarded }

    /// Minimum seconds between two interstitials (the game also only asks every 2nd level).
    static let interstitialCooldown: TimeInterval = 90
}
