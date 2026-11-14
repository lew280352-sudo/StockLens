# StockLens Android

Android launcher for the HTTPS StockLens app, using Google's Android Browser Helper / Trusted Web Activity. It opens `https://stocklen-znwy.onrender.com/` in a compatible browser without adding a separate account database or embedding API keys. The browser handles website login, storage, external links, and web features. Internet access and an up-to-date compatible browser (Chrome recommended) are required. Minimum Android version: 8.0 (API 26).

## Build

Use JDK 21, Android SDK 36/build-tools 36.0.0, and the checked-in Gradle 8.13 wrapper:

```sh
cd android
./gradlew --no-daemon lintRelease assembleRelease
```

The Android Actions workflow produces an **unsigned** verification artifact. It must be signed with the existing release key before distribution. Public GitHub Releases contain the signed APK and SHA-256 checksum instead.

## Sign and verify

Keep signing material outside the repository. In the current workspace it lives in `.data/android/stocklens-release.p12` and `.data/android/signing-password.txt`, with restricted file permissions. Make a private backup of both files before deleting or replacing this workspace. Future APK updates must use this same key and a higher `versionCode`.

Set `ANDROID_HOME`, `STOCKLENS_KEYSTORE`, and `STOCKLENS_PASSWORD_FILE` to their local paths, then run:

```sh
android/sign-release.sh android/app/build/outputs/apk/release/app-release-unsigned.apk StockLens-0.9.2-beta.1.apk
```

Do not commit or upload the keystore/password. GitHub's current integration cannot write repository Actions secrets, so this release is signed locally. A future owner-managed signing workflow can use encrypted Actions secrets after those permissions are configured.

`signing-certificate.pem` is the **public** certificate. Its SHA-256 fingerprint must match both the signed APK and `dist/.well-known/assetlinks.json`. The website serves the latter at `/.well-known/assetlinks.json` so Android/Chrome can verify the app's origin. If the domain changes, update both sides and publish a new APK.

## Install

Download the `.apk` attached to a GitHub Release on an Android device. Open it and allow that browser/file manager to install the app when Android requests permission. Keep Chrome or another TWA-capable browser enabled and updated. News and AI still use the online service and its existing quotas.

## Upstream

- [Android Browser Helper](https://github.com/GoogleChrome/android-browser-helper), Apache-2.0
- [Trusted Web Activity quick start](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Gradle](https://gradle.org/), Apache-2.0 (wrapper scripts retain the upstream license notices)
