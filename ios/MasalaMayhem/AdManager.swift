import UIKit
import AppTrackingTransparency
import GoogleMobileAds
import UserMessagingPlatform

/// Handles consent (GDPR via Google UMP, then Apple's tracking prompt), starts the
/// Google Mobile Ads SDK, and keeps one interstitial and one rewarded ad preloaded.
final class AdManager: NSObject, ObservableObject, FullScreenContentDelegate {
    static let shared = AdManager()

    /// True once consent is sorted out and the SDK is started.
    @Published private(set) var canShowAds = false

    private var interstitial: InterstitialAd?
    private var rewarded: RewardedAd?
    private var lastInterstitial = Date.distantPast
    private var didBootstrap = false

    private var rewardCompletion: ((Bool) -> Void)?
    private var rewardEarned = false

    // MARK: - Startup

    func bootstrap() {
        guard !didBootstrap else { return }
        didBootstrap = true

        // 1. Google consent form (only shown to users in regions that require it, e.g. EU/UK).
        let parameters = RequestParameters()
        ConsentInformation.shared.requestConsentInfoUpdate(with: parameters) { [weak self] _ in
            DispatchQueue.main.async {
                ConsentForm.loadAndPresentIfRequired(from: AdManager.topViewController()) { _ in
                    DispatchQueue.main.async { self?.requestTrackingThenStart() }
                }
            }
        }
    }

    private func requestTrackingThenStart() {
        // 2. Apple's "Allow tracking?" prompt. Ads still work if the player says no.
        // Small delay so the prompt appears after the app is fully on screen.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            ATTrackingManager.requestTrackingAuthorization { _ in
                DispatchQueue.main.async { self.startSDK() }
            }
        }
    }

    private func startSDK() {
        guard ConsentInformation.shared.canRequestAds else { return }
        MobileAds.shared.start()
        canShowAds = true
        loadInterstitial()
        loadRewarded()
    }

    // MARK: - Interstitial

    private func loadInterstitial() {
        InterstitialAd.load(with: AdConfig.interstitialID, request: Request()) { [weak self] ad, error in
            guard let self = self else { return }
            if let error = error {
                print("Interstitial failed to load: \(error.localizedDescription)")
                return
            }
            ad?.fullScreenContentDelegate = self
            self.interstitial = ad
        }
    }

    /// Called by the game between levels. Silently does nothing if no ad is ready
    /// or one was shown recently.
    func showInterstitial() {
        guard canShowAds else { return }
        guard Date().timeIntervalSince(lastInterstitial) >= AdConfig.interstitialCooldown else { return }
        guard let ad = interstitial, let vc = AdManager.topViewController() else {
            loadInterstitial()
            return
        }
        lastInterstitial = Date()
        interstitial = nil
        ad.present(from: vc)
    }

    // MARK: - Rewarded

    private func loadRewarded() {
        RewardedAd.load(with: AdConfig.rewardedID, request: Request()) { [weak self] ad, error in
            guard let self = self else { return }
            if let error = error {
                print("Rewarded failed to load: \(error.localizedDescription)")
                return
            }
            ad?.fullScreenContentDelegate = self
            self.rewarded = ad
        }
    }

    /// Shows a rewarded video. `completion(true)` only if the player watched long enough
    /// to earn the reward.
    func showRewarded(completion: @escaping (Bool) -> Void) {
        guard canShowAds, let ad = rewarded, let vc = AdManager.topViewController() else {
            completion(false)
            loadRewarded()
            return
        }
        rewarded = nil
        rewardEarned = false
        rewardCompletion = completion
        ad.present(from: vc) { [weak self] in
            self?.rewardEarned = true
        }
    }

    // MARK: - FullScreenContentDelegate

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        if ad is RewardedAd {
            let earned = rewardEarned
            let completion = rewardCompletion
            rewardCompletion = nil
            completion?(earned)
            loadRewarded()
        } else {
            loadInterstitial()
        }
    }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("Ad failed to present: \(error.localizedDescription)")
        if ad is RewardedAd {
            let completion = rewardCompletion
            rewardCompletion = nil
            completion?(false)
            loadRewarded()
        } else {
            loadInterstitial()
        }
    }

    // MARK: - Helpers

    static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap { $0.windows }.first { $0.isKeyWindow } ?? scenes.first?.windows.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
