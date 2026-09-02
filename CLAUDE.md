# FixIt AI — contexte projet (pour Claude)

> Spécifications produit complètes : voir le brief FixIt AI (concept, sécurité, écrans, phases).
> Ce fichier suit **les décisions, l'état réel et les écarts** par rapport au brief d'origine.

## Écarts assumés vs brief d'origine

| Brief d'origine | Décision retenue | Raison |
|-----------------|------------------|--------|
| Supabase (DB / Storage / Edge Functions / Auth) | **Neon** (Postgres + **Object Storage** S3) + **Cloudflare Workers** (Hono) + **Neon Auth** | Consigne utilisateur. R2 abandonné (activation exigeait une carte bancaire) → Neon Object Storage. |
| OpenAI / Anthropic en priorité | **Google Gemini** (`gemini-3.6-flash`, repli auto `gemini-3.5-flash`) via abstraction `AIProvider` | Clé gratuite fournie par l'utilisateur |
| Vercel | **Cloudflare Workers** (domaine custom abandonné, `.workers.dev` suffit) | Consigne utilisateur |
| — | Monorepo **pnpm** : `apps/mobile`, `apps/api`, `packages/shared` | Partage types + logique déterministe |

Inchangé : mobile en **React Native + Expo + TypeScript + Expo Router**.

## Décisions

- **Auth** : **Neon Auth (Stack)** branché en PHASE 6 (email/password + **OAuth Google** mobile via code+PKCE, rebond Worker `/auth/callback`). Le Worker vérifie le JWT (JWKS + `jose`).
- **Clé Gemini** : fournie par l'utilisateur, stockée dans `.dev.vars` (gitignore) + secret Worker. Jamais committée, jamais en clair dans la mémoire.
- **Sécurité applicative** : `SafetyClassifier` + `RepairabilityScore` déterministes dans `packages/shared`, autorité **côté serveur uniquement** ; le classifier ne peut que durcir la reco IA.
- **Rôle admin / accès illimité** : colonne `app_users.role` (`user`|`admin`, migration `0002`). Var `ADMIN_EMAILS` (liste d'emails, `wrangler.toml [vars]` + `.dev.vars`) → `apps/api/src/auth/admin.ts`. `ensureUser` synchronise `role` à chaque `/me` / `POST /diagnoses`. `getQuota`/`consumeQuota` : `admin` (ou `plan=premium`) ⇒ limite `Infinity`, quota **jamais** consommé. `/me` renvoie `role`. `tcha.jimmy@gmail.com` promu `admin` en base. Abonnement (`plan`) pour les autres profils = à faire.
  - **Override guide (2026-09-02)** : un admin obtient le guide de réparation **même sur un STOP de sécurité** (`repair-guide` / `repair-session` / `verify` ne renvoient plus 409 `forced_stop` si `isAdminEmail`). Le guide est généré avec `RepairGuideInput.adminOverride` → prompt renforcé (dangers dans `generalWarnings`, `safetyWarning` par étape, étape 1 = mise en sécurité). Mobile : `MeProvider`/`useMe()` (`src/lib/me.tsx`, wrap `_layout.tsx`) → `isAdmin` ; `DiagnosisResultView` + `StopView` affichent une carte « ⚠️ ADMIN OVERRIDE » + bouton d'ouverture du guide (admin only ; les avertissements de danger restent affichés). Non-admin : comportement inchangé (bouton désactivé / écran STOP sans guide).
  - **« ADD MORE DETAILS »** : composant `RefineDiagnosis` (dans `DiagnosisResultView` **et** `StopView`) — champ libre → relance `/diagnosis/new` (description d'origine + précisions concaténées, mêmes `imageIds`/`videoIds`) ⇒ nouveau diagnostic (non consommé pour un accès illimité).
- **Guide de réparation illustré (2026-09-02)** : `packages/shared/src/icons.ts` = 2 fonctions pures `toolIconId(name)` / `stepIconId({title,instruction})` (mots-clés FR+EN normalisés, replis `toolbox` / `generic`), exportées via `@fixit/shared`. Assets `apps/mobile/assets/icons/` : 25 icônes outils + 16 icônes de type d'étape, SVG au trait 24×24 monochrome (26 de **Lucide**, ISC ; 15 tracées main — voir `assets/icons/LICENSE.md`). `src/components/LineIcon.tsx` : `<ToolIcon>` / `<StepIcon>` via **`expo-image`** (`tintColor`, SVG déjà géré nativement → **pas de `react-native-svg`, pas de rebuild natif**) ; map `satisfies Record<IconId, number>` ; `apps/mobile/types/assets.d.ts` déclare `*.svg`. `RepairGuideView` : icône devant chaque outil `TOOLS`/`OPTIONAL` (aperçu) + puces « icône + nom » et médaillon d'icône de type par étape. **Illustrations d'étape par IA écartées** (choix utilisateur) au profit de pictos génériques par type.
- **Isolation par utilisateur** : filtrage explicite `WHERE user_id =` dans chaque requête du Worker + tests d'intégration d'isolation. **RLS Postgres écartée** (driver `neon-http` sans transaction → pas de GUC par requête ; tous les rôles Neon ont `BYPASSRLS` non retirable).
- **Durcissement Worker** : `secureHeaders`, `bodyLimit`, rate limiting Cloudflare `[[ratelimits]]`.

## État

**MVP (phases 1–7) : ✅ fonctionnel de bout en bout.** Détail par phase dans `TODO.md`.
- 1 Audit · 2 Foundation (monorepo) · 3 Camera (`POST /uploads`) · 4 Diagnosis (Gemini + STOP) ·
  5 Repair guide (pas-à-pas) · 6 Neon + Auth + persistance Postgres + quota · 7 History (`My Repairs`, feedback).

**Post-MVP : ✅**
- **PHASE 8 Réparation interactive** : `AIProvider.verifyStep` (Gemini vision + Mock déterministe), table `repair_sessions` (Neon, migration `0001`), routes `POST/GET /diagnoses/:id/repair-session` + `.../verify` (autorité serveur : `current_step` n'avance que sur verdict `pass`), `StepCheck` mobile intégré à chaque étape du guide.
- **PHASE 9 Vidéo** : diagnostic à partir d'un court clip (~15 s). `POST /uploads` accepte `video/mp4|quicktime` (`kind=video`, plafond `MAX_VIDEO_BYTES` 40 Mo). Gemini **File API** (`uploadType=media` → polling `ACTIVE` → part `file_data`, purge best-effort). `POST /diagnoses` prend `videoIds` (max 1) → `provider.diagnose({ images, videos })` ; `MockProvider` gère `videos`. Purge cascade au DELETE (kind `video` dans `diagnosis_images`). Mobile : `VideoCapture` (expo-camera `mode="video"` + micro), `CaptureFlow` mode `video` (caméra ou galerie), action d'accueil activée. **Miniatures + lecture** dans le détail du diagnostic (« My Repairs ») : `getDiagnosis` renvoie `input.imageIds`/`videoIds` = **id d'upload** (dérivé de `r2Key`, plus l'id de ligne) → `DiagnosisMedia` (bande de vignettes + visionneuse plein écran, `expo-video` `useVideoPlayer`/`VideoView`, source authentifiée `videoSource(id)` avec header Bearer) dans `DiagnosisResultView` + `StopView`. **Pipeline vidéo IA non testé sur device** (File API réelle non couverte par les tests → MockProvider).
- **PHASE 10 — 3e passe** : file de retry hors-ligne (`src/lib/outboxQueue.ts` + `OutboxProvider`), i18n FR/EN (`src/i18n/`, `expo-localization`, accueil/history/auth **+ tout le flux de capture** : `CaptureFlow`, `CameraCapture`, `VideoCapture`, `diagnosis/new` — namespaces `capture.*`/`media.*`, parité en/fr testée), empty states illustrés (`IconMedallion`), transitions d'écran via `react-native-screens` (`Stack.Screen animation`). NB : `react-native-reanimated` **est** présent (dép. transitive d'`expo-router` 57) et compilé dans les builds natifs.
- **OAuth Google (mobile)** : `src/auth/oauth.ts` (code d'autorisation + PKCE via `expo-web-browser`/`expo-crypto`), `src/auth/jwt.ts`, Worker `GET /auth/callback` (rebond https → `fixitai://oauth`), **route `app/oauth.tsx`** qui finit l'échange du code car sur Android le navigateur ouvre le deep link au lieu de rendre la main à `openAuthSessionAsync` (sinon écran « Unmatched Route »). `AuthProvider.signInWithGoogle` + `completeGoogleRedirect`, bouton sur l'écran auth. **Identifiants Google propres de l'utilisateur posés dans Neon Auth** (`update_auth_oauth_provider`, type `standard`) ; redirect Google whitelisté = `https://api.stack-auth.com/api/v1/auth/oauth/callback/google`.
  - **Retour « à froid » (2026-09-02)** : sur Android le navigateur est un processus séparé → l'app peut être recréée pendant le choix du compte Google (l'objet `pending` en mémoire disparaît, l'échange échouait en silence → retour à `/auth`). `verifier`+`state` désormais **persistés dans SecureStore** (`fixit.oauth.pending.v1`). `resolveGoogleRedirect(url)` termine l'échange à chaud **ou** à froid et **renvoie la session** (que `app/oauth.tsx` persiste via `AuthProvider.completeGoogleRedirect`, sans dépendre de la promesse de `signInWithGoogle` ni du timer). Cache d'échange par `code` = usage unique garanti. `completeGoogleSignIn` conservé (déprécié, délègue).
  - **✅ Validé sur device (2026-09-02)** : la connexion Google fonctionne de bout en bout (chaud + froid) avec l'APK release. Session persistée, retour app OK.
  - **✅ Écran de consentement Google PUBLIÉ (2026-09-02)** — « État de la publication : En production ». N'importe quel compte Google peut se connecter (fin du mode Testing, plus de *test users*). Prérequis levé : Google exigeait la section « Domaine de l'application » (accueil + confidentialité + conditions) → **pages HTML publiques ajoutées au Worker** : `apps/api/src/pages.ts` sert `GET /` (accueil), `GET /privacy`, `GET /terms`. CSP assouplie pour ces 3 chemins seulement (`style-src 'unsafe-inline'`) via un middleware externe dans `app.ts` (le plus externe → repasse après `secureHeaders`) ; les routes JSON gardent `default-src 'none'`. `GET /` ne renvoie plus le JSON `{name,status}`. Domaine autorisé `ichigo35.workers.dev` ajouté dans la console (projet Google Cloud `fixit-ai-507310`). Scopes non sensibles → aucune vérification Google.
- **Build Android natif** : **`apps/mobile/scripts/build-android-release.sh`** (assembleRelease, arm64, `-x lintVital*`, cache, JDK 17 pinné, `EXPO_PUBLIC_APP_ENV=production`, `open -R` à la fin ; `--clean` en option). À utiliser quand seul le JS/les assets changent → **pas de `expo prebuild`**. Dernier APK release (**2026-09-02 23:31**, signé clé debug, `ai.fixit.app` v0.1.0, ~52 Mo arm64) = guide illustré + i18n capture + lecture vidéo + pages légales OAuth + override guide admin + `RefineDiagnosis`.
  - **Perf build (8 Go RAM, revu 2026-09-02)** : le vrai frein était `org.gradle.daemon=false` dans `~/.gradle/gradle.properties` (ajouté « pour la RAM » → JVM froide + état Kotlin jeté à chaque build → 15-19 min). Remis à `true` + `idletimeout=1200000` (le daemon rend la RAM 20 min après). Ajouté : `org.gradle.caching`, `configureondemand`, `org.gradle.java.home` = JDK 17 (évite un 2e daemon sur le JDK système), `kotlin.daemon.jvmargs=-Xmx1536m`, `reactNativeArchitectures=arm64-v8a` (au lieu des 4 ABIs), PNG crunch off, `lintVitalRelease` exclu. Le clean `/storage-audit` de l'utilisateur **n'y était pour rien** (`~/.gradle` intact, 4,4 Go ; disque repassé à ~49 Go libres).
- **PHASE 10 Polish (2 passes)** : erreurs centralisées (`lib/errors.ts`), `LoadingState`/`ErrorState`/`EmptyState`, `ErrorBoundary`, onboarding, animations `Animated` natives (`FadeInView`, meter), a11y, `history` en `FlatList` · puis `expo-haptics`, skeletons, pull-to-refresh, `OfflineBanner`+`ConnectivityProvider`.
- **CI** : `.github/workflows/ci.yml` (lint + typecheck + tests sur push/PR `main`), secret `DATABASE_URL` posé, runs verts.
- **Storage** : R2 → **Neon Object Storage** (S3, `aws4fetch`), abstraction `apps/api/src/storage/`.
- **Déploiement** : **Worker prod live** `https://fixit-ai-api.ichigo35.workers.dev` — `APP_ENV=production`, 4 secrets, `/health` OK, E2E authentifié (upload/get/403/delete) vérifié en prod.
- **Sécurité** : `secureHeaders` + `bodyLimit` + rate limiting Cloudflare. RLS écartée (voir Décisions).
- **Bascule modèle Gemini (2026-09-02)** : `FailoverGeminiProvider` (`apps/api/src/providers/geminiFailover.ts`) enveloppe des `GeminiProvider` par modèle. Modèle préféré `GEMINI_MODEL` (`gemini-3.6-flash`) → sur **HTTP 429** (quota/limite de débit), le modèle est mis « en repos » (`RetryInfo.retryDelay` du corps, sinon 60 s, plafond 1 h) et l'appel bascule sur `GEMINI_FALLBACK_MODEL` (`gemini-3.5-flash`). Repos écoulé ⇒ le préféré redevient prioritaire automatiquement. État `Map` au niveau module (par isolate Worker, best-effort). `GeminiProvider.call`/upload vidéo lèvent `AIProviderError('ai_rate_limited', {retryAfterMs})` sur 429 ; route → **429** (au lieu de 502). Tous modèles en 429 ⇒ `ai_rate_limited`. `_resetGeminiCooldowns()` pour les tests. `apps/api/test/geminiFailover.test.ts` (6 tests, `fetch` mocké + fake timers).
- **116 tests** (44 shared + 44 api + 28 mobile). Base Neon : 1 user (`tcha.jimmy@gmail.com`, admin). Dép. mobile ajoutée : `expo-video` (~57.0.3, plugin dans `app.config.ts`).

**À faire :** rebuild APK release pour voir le guide illustré sur device (JS seulement, pas de build natif) · tester vidéo end-to-end sur device (File API réelle + lecture `expo-video`) · système d'abonnement `plan` FREE/PREMIUM pour les non-admins · EAS Build · i18n sur les écrans restants (`DiagnosisResultView`/`StopView`/`OutcomeSession`/`RepairGuideView` + `lib/errors.ts`) · domaine custom = abandonné.

**Prod :** Worker version `6daeb673` (2026-09-02) — `ADMIN_EMAILS` + pipeline vidéo (PHASE 9) + `/auth/callback` + pages légales publiques `/` `/privacy` `/terms` + **override guide admin** (`repair-guide`/`repair-session`/`verify` sans 409 `forced_stop` pour un admin) + **`GEMINI_FALLBACK_MODEL=gemini-3.5-flash`** (bascule modèle Gemini sur 429). `/health` OK (`env=production`).

## Infra provisionnée

- **Neon** : projet `fixit-ai` = `winter-union-90877282` (org `org-sweet-tooth-50877405`, aws-us-east-2, PG 17). `DATABASE_URL` dans `apps/api/.dev.vars` + secret Worker. Branche `br-rough-feather-a5r1cdyr`. Tables : `app_users` (dont `role` `user`|`admin`), `diagnoses`, `diagnosis_images`, `repair_guides`, `repair_history`, `repair_sessions` + `neon_auth.users_sync`. Migrations Drizzle dans `apps/api/drizzle/` (`0002_user_role` appliquée en prod). Driver = `drizzle-orm/neon-http` (HTTP, **sans transaction**). Colonnes `r2_key*` = anciens noms, contenu = clés Neon Object Storage.
- **Neon Auth (Stack)** : projet Stack `3432abc2-2b77-4b7b-acff-0686a7b99697`. `STACK_PROJECT_ID` / `STACK_JWKS_URL` / `STACK_PUBLISHABLE_KEY` dans `wrangler.toml [vars]` (publics) et `apps/mobile/app.config.ts extra`. Email/password + **OAuth Google** (identifiants Google propres de l'utilisateur posés via `update_auth_oauth_provider`, `type: standard` ; le redirect Google whitelisté dans la console Google = `https://api.stack-auth.com/api/v1/auth/oauth/callback/google`). Domaine de confiance `https://fixit-ai-api.ichigo35.workers.dev` (redirect OAuth). **Flux OAuth Google validé sur device (2026-09-02).** **Écran de consentement Google publié (« En production », 2026-09-02)** — projet Google Cloud `fixit-ai-507310` (compte `tcha.jimmy@gmail.com`) → tout compte Google peut se connecter ; pages légales servies par le Worker (`/`, `/privacy`, `/terms`), domaines autorisés = `stack-auth.com` + `ichigo35.workers.dev`. Contenu privacy/terms rédigé d'après le code, **à faire relire (juridique) par l'utilisateur**. Worker vérifie le JWT via JWKS (`jose`). Endpoints OAuth Stack : `GET /api/v1/auth/oauth/authorize/google` (params `client_id`=projectId, `client_secret`=publishable key, `redirect_uri`, `response_type=code`, `scope`, `state`, `code_challenge`+`_method=S256`) → `POST /api/v1/auth/oauth/token` (`grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`).
- **Gemini** : clé dans `apps/api/.dev.vars` (`GEMINI_API_KEY`), modèle préféré **`gemini-3.6-flash`** (`GEMINI_MODEL`) + repli **`gemini-3.5-flash`** (`GEMINI_FALLBACK_MODEL`, `wrangler.toml [vars]` + `.dev.vars`) — bascule auto sur 429, retour auto (voir `FailoverGeminiProvider`). Les deux ids validés dispo pour la clé (`GET /v1beta/models`). Appel REST `generateContent` + `responseSchema`. **Vidéo** : passe par l'**API Files** (upload resumable `/upload/v1beta/files` : `X-Goog-Upload-Command: start` → header `x-goog-upload-url` → `upload, finalize` → polling `state=ACTIVE` → part `file_data`), pas l'inline base64. Sans clé → `MockProvider`. **Pas de nouveau secret** (les 2 modèles = même clé) : le redéploiement propage juste la var `GEMINI_FALLBACK_MODEL`.
- **Neon Object Storage (S3)** : bucket `fixit-ai-images` (private) sur la branche `br-rough-feather-a5r1cdyr`. Endpoint `https://br-rough-feather-a5r1cdyr.storage.c-1.us-east-2.aws.neon.tech`, région `us-east-2`, path-style. Credential `fixit-api-worker-rw` (scopes `storage:read`+`storage:write` — `write` seul **ne suffit pas** en beta malgré la doc). Clés S3 dans `.dev.vars` + secrets Worker `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`. Client : `apps/api/src/storage/` (`aws4fetch`, SigV4). `getStorage(env)` : `env.STORAGE` (tests) sinon client S3. Palier gratuit 5 Go/compte (beta).
- **Cloudflare Worker** : `fixit-ai-api` déployé sur `https://fixit-ai-api.ichigo35.workers.dev` (compte `tcha.jimmy@gmail.com` = `34cf747a1eaf3858a49e4fafaf9580e0`). `wrangler` déjà loggé. Secrets posés : `GEMINI_API_KEY`, `DATABASE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Redéployer : `pnpm --filter @fixit/api run deploy` (le `run` est obligatoire — `pnpm deploy` est une sous-commande pnpm). `APP_ENV=production` dans `wrangler.toml [vars]` (désactive le bypass `x-dev-user-id`) ; `apps/api/.dev.vars` remet `APP_ENV=development` en local.
- **Hébergement : Cloudflare uniquement — jamais Vercel.** Domaine custom abandonné (consigne utilisateur) ; `fixit-ai-api.ichigo35.workers.dev` reste l'URL de l'API.
- **Rate limiting** : `[[ratelimits]]` dans `wrangler.toml` (`DIAGNOSE_RL` 8/min/user, `UPLOAD_RL` 40/min/user), middleware `apps/api/src/middleware/rateLimit.ts`. Bindings absents en local/tests → no-op.
- Tests API = **intégration contre Neon réel** (lisent `apps/api/.dev.vars`, `describe.runIf(hasDb)`, users `test-*` nettoyés en `afterAll`). En CI le secret `DATABASE_URL` fait tourner ces tests (mock Gemini). Le stockage utilise `memoryStorage` (aucun secret S3 requis).
- Tests mobile = **Vitest sur modules purs uniquement** (`apps/mobile/vitest.config.ts`, env node, alias `@`). Pas de rendu RN. Garder les helpers testables hors Expo (ex. `ApiError` isolé dans `src/api/ApiError.ts`).

## Commandes

`pnpm api` (wrangler dev :8788) · `pnpm mobile` (Expo) · `pnpm -r test` · `pnpm -r typecheck` · `pnpm lint`
Port API dev = **8788** (8787 occupé par un autre projet local de l'utilisateur).

## Build mobile (Android, local)

`android/` et `ios/` sont **gitignore** (générés par `expo prebuild`). Prérequis machine :
- `pnpm` **11** ignore `.npmrc` pour ses réglages → `nodeLinker: hoisted` + `shamefullyHoist: true` sont dans `pnpm-workspace.yaml`. Vérif : `pnpm config get node-linker` → `hoisted`. Sinon `babel-preset-expo` (et autres deps transitives) introuvables au bundling.
- **NDK `27.1.12297006` (r27b)** requis par RN 0.86 — installé manuellement dans `~/Library/Android/sdk/ndk/` (pas de `cmdline-tools` → AGP ne peut pas l'auto-télécharger).
- `JAVA_HOME` = **openjdk@17** (pas 21). `ANDROID_HOME=~/Library/Android/sdk`.

**Changement JS/assets uniquement** (pas de nouvelle dép native, pas de plugin `app.config.ts`) : sauter `expo prebuild`, juste `cd apps/mobile/android && ./gradlew :app:assembleRelease -x lint -PreactNativeArchitectures=arm64-v8a` (avec les `export` ci-dessous). Metro re-bundle le JS + les assets. Fait le 2026-09-02 pour le guide illustré (~19 min, daemon froid).

Build APK release from scratch / nouveau module natif (signé avec la clé debug → installable, JS bundlé) :
```
cd apps/mobile && npx expo prebuild --platform android --clean --no-install
git checkout apps/mobile/package.json   # prebuild remplace les scripts android/ios par `expo run:*`
cd android
export ANDROID_HOME=~/Library/Android/sdk \
  JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
  EXPO_PUBLIC_APP_ENV=production
./gradlew :app:assembleRelease -x lint -PreactNativeArchitectures=arm64-v8a --console=plain
# → app/build/outputs/apk/release/app-release.apk  (~52 Mo arm64 seul)
```
Temps de build (daemon Gradle **chaud**, après la 1re exécution qui le démarre) : **~10-15 min à froid** (`--clean` ou nouveau module natif) ; **quelques min en incrémental** JS/assets ; **~1 min** si rien n'a bougé. Sans daemon (l'ancien réglage) c'était +10-15 min à chaque fois. Ne pas supprimer `~/.gradle`, le NDK, ni `apps/mobile/android/{.gradle,build,app/build}` entre deux builds (cf. [[build-cache-protection]]). L'APK (~52 Mo) dépasse la limite d'upload du chat (30 Mo) → `open -R` (le script le fait).

**Boucle rapide pour itérer sur le JS** (pas de rebuild APK) : garder l'APK debug/release installé + `pnpm mobile` (Metro) — le JS se recharge à chaud. Le rebuild APK ne sert que pour livrer une version installable autonome.
NB : `git checkout apps/mobile/package.json` après `prebuild` ne fait que restaurer les scripts `android`/`ios` ; les vraies deps (dont `expo-video`) sont déjà committées.
APK léger (~arm64 + R8) : dans `android/gradle.properties` poser `reactNativeArchitectures=arm64-v8a`,
`android.enableMinifyInReleaseBuilds=true`, `android.enableShrinkResourcesInReleaseBuilds=true`.
`EXPO_PUBLIC_APP_ENV=production` est **impératif** pour OAuth (redirect_uri `/auth/callback` doit être joignable depuis le navigateur système). `eas.json` a des profils prêts si EAS est installé un jour.
Tester OAuth : impossible en Expo Go (schéma natif `fixitai://`) → dev-client ou APK.

## Environnement (machine utilisateur, audit 2026-08-31)

Node 26.5 · pnpm 11.13 · bun 1.3.14 · Expo 57 · Git 2.50 · Xcode 26.6 · Android SDK présent (ANDROID_HOME non défini) · CocoaPods 1.17 · gh 2.97 · wrangler 4.127 (via npx) · watchman absent · EAS absent.
GitHub : compte `Ichigo35`, SSH OK, `gh` authentifié (scopes `repo`/`workflow`). Dépôt `Ichigo35/FixIt_AI` (privé). `wrangler` loggé (`tcha.jimmy@gmail.com`).
Disque : ~49 Gio libres au 2026-09-02 (le clean `/storage-audit` a bien travaillé — l'ancienne note « 95 % » est périmée). **RAM = 8 Go / 8 cœurs** : c'est LA contrainte des builds natifs (Gradle + Kotlin + Metro + hermesc = plusieurs JVM). D'où les réglages perf dans `apps/mobile/android/gradle.properties` + `~/.gradle/gradle.properties`. EAS non installé.
ℹ️ Résolution DNS locale intermittente le 2026-08-31 (routeur 192.168.18.1). Si `git push` échoue sur « Could not resolve hostname github.com » → réessayer.

## Rituel de fin de phase

1. Expliquer → implémenter → tester → corriger → vérifier démarrage
2. MAJ `TODO.md` (ce qui marche vraiment / ce qui reste)
3. `git commit` + `git push` → `git@github.com:Ichigo35/FixIt_AI.git`
4. MAJ ce `CLAUDE.md` + mémoire
5. Ne pas passer à la phase suivante avec des erreurs critiques non résolues. Aucune fonctionnalité fictive.

## Langue

Répondre en français.
