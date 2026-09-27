import Foundation

/// All AdMob settings in one place.
///
/// While `useTestAds` is true the app shows Google's official TEST ads, which are safe to
/// tap during development. Before you submit to the App Store:
///   1. Create the app and three ad units in AdMob (Banner, Interstitial, Rewarded).
///   2. Paste the ad unit IDs below.
///   3. Put your AdMob APP ID (the one with a "~") in Info.plist → GADApplicationIdentifier.
///   4. Set `useTestAds = false`.
enum AdConfig {
    static let useTestAds = true

    // ---- Your real ad unit IDs (from AdMob → Apps → Masala Mayhem → Ad units) ----
    private static let realBanner       = "ca-app-pub-XXXXXXXXXXXXXXXX/BBBBBBBBBB"
    private static let realInterstitial = "ca-app-pub-XXXXXXXXXXXXXXXX/IIIIIIIIII"
    private static let realRewarded     = "ca-app-pub-XXXXXXXXXXXXXXXX/RRRRRRRRRR"

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
