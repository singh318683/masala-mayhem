# Masala Mayhem — iOS app

A native SwiftUI shell that runs the game offline (bundled in `MasalaMayhem/web`) and earns through **Google AdMob**.

## Open on the Mac
```
cd ~/Desktop && git clone https://github.com/singh318683/masala-mayhem.git && open masala-mayhem/ios/MasalaMayhem.xcodeproj
```
Xcode downloads the Google Mobile Ads package automatically the first time (File → Packages → Resolve Package Versions if it doesn't).

## Ads in the app
| Ad | Where | Why it's player-friendly |
|---|---|---|
| Banner 320×50 | Title and map screens only | Never covers the puzzle board, so no accidental taps |
| Interstitial | Between levels, from the 3rd finished level, every 2nd level, at most once per 90 s | Only at natural breaks |
| Rewarded | "Watch a video: +5 moves" after running out of moves, free booster on the map (🎁), and when a booster runs out | Player chooses to watch — usually the best-earning format |

Consent: Google's UMP consent form (shown only where the law requires it, e.g. EU/UK), then Apple's App Tracking Transparency prompt.

## Going live
The app ships with Google's **test** ads. Before submitting:
1. In AdMob, add the iOS app and create Banner, Interstitial and Rewarded ad units.
2. Paste the three ad unit IDs into `AdConfig.swift` and set `useTestAds = false`.
3. (Done) Real IDs are in `AdConfig.swift` and `Info.plist`. Debug builds use test ads, Release builds use real ads.
4. In AdMob → Privacy & messaging, create a GDPR message (and an IDFA explainer if you like).
5. Add `app-ads.txt` to ikshana-solutions.com and list that site in App Store Connect.

Never tap your own live ads — AdMob can suspend the account. Use test ads or register your iPhone as a test device.

## Updating the game
The web game lives in two places: the repo root (served by Vercel) and `ios/MasalaMayhem/web` (bundled in the app). Keep both in sync when the game changes.
