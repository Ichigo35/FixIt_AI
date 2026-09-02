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
echo "▶ ./gradlew ${GRADLE_ARGS[*]}"
time ./gradlew "${GRADLE_ARGS[@]}"

APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
if [[ -f "$APK" ]]; then
  echo ""
  echo "✓ $(du -h "$APK" | cut -f1)  $APK"
  command -v open >/dev/null && open -R "$APK"
fi
