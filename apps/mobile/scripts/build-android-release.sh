#!/usr/bin/env bash
# Build APK release (signé clé debug, installable) optimisé pour cette machine (8 Go RAM).
#
# À utiliser quand SEUL le JS / les assets ont changé (pas de nouvelle dép native,
# pas de plugin app.config.ts) : PAS besoin de `expo prebuild`.
# Après un `expo prebuild` : ce script réapplique les réglages perf effacés.
#
# Options :
#   --clean   nettoie d'abord les sorties (app/build) — plus lent, à réserver aux
#             problèmes de build incohérent.
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$MOBILE_DIR/android"
PROPS="$ANDROID_DIR/gradle.properties"

if [[ ! -d "$ANDROID_DIR" ]]; then
  echo "✗ $ANDROID_DIR absent — lance d'abord : cd $MOBILE_DIR && npx expo prebuild --platform android --no-install" >&2
  exit 1
fi

# --- Réglages perf idempotents (réappliqués si prebuild a régénéré le fichier) ---
ensure_prop() {
  local key="$1" line="$2"
  if grep -q "^${key}=" "$PROPS" 2>/dev/null; then
    # remplace la valeur existante
    /usr/bin/sed -i '' "s|^${key}=.*|${line}|" "$PROPS"
  else
    printf '\n%s\n' "$line" >> "$PROPS"
  fi
}
JDK17="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
ensure_prop "org.gradle.jvmargs"            "org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+UseParallelGC"
ensure_prop "org.gradle.caching"            "org.gradle.caching=true"
ensure_prop "org.gradle.java.home"          "org.gradle.java.home=$JDK17"
ensure_prop "kotlin.daemon.jvmargs"         "kotlin.daemon.jvmargs=-Xmx1536m -XX:+UseParallelGC"
ensure_prop "kotlin.incremental"            "kotlin.incremental=true"
ensure_prop "reactNativeArchitectures"      "reactNativeArchitectures=arm64-v8a"
ensure_prop "android.enablePngCrunchInReleaseBuilds" "android.enablePngCrunchInReleaseBuilds=false"
# --- Taille de l'APK (réappliqué après `expo prebuild`) ---
ensure_prop "android.enableMinifyInReleaseBuilds"         "android.enableMinifyInReleaseBuilds=true"
ensure_prop "android.enableShrinkResourcesInReleaseBuilds" "android.enableShrinkResourcesInReleaseBuilds=true"
ensure_prop "expo.useLegacyPackaging"       "expo.useLegacyPackaging=true"
ensure_prop "expo.camera.barcode-scanner-enabled" "expo.camera.barcode-scanner-enabled=false"
ensure_prop "expo.gif.enabled"              "expo.gif.enabled=false"

# Garde-fous R8 (proguard-rules.pro régénéré par `expo prebuild` → on réapplique).
PROGUARD="$ANDROID_DIR/app/proguard-rules.pro"
if [[ -f "$PROGUARD" ]] && ! grep -q "FixIt AI : garde-fous R8" "$PROGUARD"; then
  cat >> "$PROGUARD" <<'EOF'

# --- FixIt AI : garde-fous R8 (réappliqué par build-android-release.sh). ---
-keep class expo.modules.** { *; }
-keep class * implements expo.modules.core.interfaces.Package { *; }
-keep class * extends expo.modules.kotlin.modules.Module { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep,includedescriptorclasses class com.facebook.react.bridge.** { *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod <methods>; }
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn javax.annotation.**
EOF
  echo "✓ garde-fous R8 ajoutés à proguard-rules.pro"
fi

# Retire ML Kit (scanner de code-barres, ~5 Mo natif) — jamais utilisé. Régénéré par prebuild.
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
if [[ -f "$APP_GRADLE" ]] && ! grep -q "on retire ML Kit" "$APP_GRADLE"; then
  /usr/bin/sed -i '' $'s|^dependencies {|configurations.all {\\\n    exclude group: \'com.google.mlkit\'\\\n    exclude group: \'com.google.android.gms\', module: \'play-services-mlkit-barcode-scanning\'\\\n    exclude group: \'com.google.android.gms\', module: \'play-services-code-scanner\'\\\n    exclude group: \'androidx.camera\', module: \'camera-mlkit-vision\'\\\n}  // on retire ML Kit\\\n\\\ndependencies {|' "$APP_GRADLE"
  echo "✓ exclusion ML Kit ajoutée à app/build.gradle"
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="$JDK17"
export EXPO_PUBLIC_APP_ENV=production   # impératif pour OAuth (redirect /auth/callback joignable)

GRADLE_ARGS=(
  :app:assembleRelease
  -PreactNativeArchitectures=arm64-v8a
  --build-cache
  --console=plain
  -x lint -x lintVitalRelease -x lintVitalAnalyzeRelease -x lintVitalReportRelease
)
[[ "${1:-}" == "--clean" ]] && GRADLE_ARGS=(clean "${GRADLE_ARGS[@]}")

cd "$ANDROID_DIR"

# ⚠️ Avec `org.gradle.caching`, Gradle restaure un bundle JS PÉRIMÉ depuis le
# build-cache après une modif dans `src/` (suivi d'inputs défaillant en monorepo
# hoisté) — la tâche n'apparaît même pas dans le log. On force donc le re-bundle
# JS séparément (rapide : Metro + hermesc), l'`assembleRelease` verra ensuite le
# nouveau .bundle comme un input modifié et repackagera.
rm -rf app/build/generated/assets/react \
       app/build/intermediates/{assets,merged_assets} \
       app/build/ASSETS \
       app/build/outputs/apk/release
echo "▶ ./gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks (re-bundle JS forcé)"
./gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks \
  -PreactNativeArchitectures=arm64-v8a --console=plain

echo "▶ ./gradlew ${GRADLE_ARGS[*]}"
time ./gradlew "${GRADLE_ARGS[@]}"

APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
if [[ -f "$APK" ]]; then
  echo ""
  echo "✓ $(du -h "$APK" | cut -f1)  $APK"
  command -v open >/dev/null && open -R "$APK"
fi
