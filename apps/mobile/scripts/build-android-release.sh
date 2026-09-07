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
ensure_prop "expo.gif.enabled"              "expo.gif.enabled=false"
# NB : PAS `expo.camera.barcode-scanner-enabled=false` — on garde les classes ML Kit
# (R8 échoue sinon) et on retire seulement le .so au packaging (voir plus bas).

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
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.vision.**
-dontwarn androidx.camera.mlkit.**
EOF
  echo "✓ garde-fous R8 ajoutés à proguard-rules.pro"
fi

# Retire le natif ML Kit (scanner de code-barres, ~5 Mo) du packaging — jamais
# utilisé, mais on GARDE les classes Java (sinon R8 échoue : CameraViewModule les
# référence). Régénéré par `expo prebuild`. NB : ne PAS exclure la dépendance Maven.
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
if [[ -f "$APP_GRADLE" ]] && ! grep -q "libbarhopper_v3.so" "$APP_GRADLE"; then
  cat >> "$APP_GRADLE" <<'EOF'

// --- FixIt AI : natif ML Kit code-barres retiré du packaging (jamais utilisé). ---
android.packagingOptions.jniLibs.excludes += '**/libbarhopper_v3.so'
android.packagingOptions.resources.excludes += 'assets/mlkit_barcode_models/**'
EOF
  echo "✓ exclusion natif ML Kit ajoutée à app/build.gradle"
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
