#!/usr/bin/env bash
set -euo pipefail
: "${ANDROID_HOME:?Set ANDROID_HOME to the Android SDK}"
: "${STOCKLENS_KEYSTORE:?Set STOCKLENS_KEYSTORE to the private release keystore}"
: "${STOCKLENS_PASSWORD_FILE:?Set STOCKLENS_PASSWORD_FILE to the private password file}"
input_apk="${1:?Pass the unsigned APK path}"
output_apk="${2:?Pass the signed output APK path}"
android_build_tools="$ANDROID_HOME/build-tools/36.0.0"
work_folder="$(mktemp -d)"
trap 'rm -rf "$work_folder"' EXIT
"$android_build_tools/zipalign" -P 16 -f 4 "$input_apk" "$work_folder/aligned.apk"
"$android_build_tools/apksigner" sign --ks "$STOCKLENS_KEYSTORE" --ks-key-alias stocklens \
  --ks-pass "file:$STOCKLENS_PASSWORD_FILE" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false \
  --out "$output_apk" "$work_folder/aligned.apk"
"$android_build_tools/zipalign" -c -P 16 4 "$output_apk"
"$android_build_tools/apksigner" verify --verbose --print-certs "$output_apk"
