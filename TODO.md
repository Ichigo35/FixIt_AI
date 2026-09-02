# FixIt AI — TODO / Plan de développement

Légende : ✅ fait · 🚧 en cours · ⏳ à faire · ⏸️ reporté V2/V3

---

## PHASE 1 — AUDIT ✅

- ✅ Inspection environnement (Node 26, pnpm 11, bun 1.3, Expo 57, Git, Xcode 26.6, Android SDK, gh, wrangler)
- ✅ Vérification accès SSH GitHub (`Ichigo35`), dépôt distant `Ichigo35/FixIt_AI` (privé, vide)
- ✅ `README.md`, `ARCHITECTURE.md`, `TODO.md`, `.env.example`
- ✅ Validation de l'architecture par l'utilisateur (auth = Neon Auth en PHASE 6 ; clé Gemini fournie)
- ✅ `git init` + commit + push

---

## PHASE 2 — FOUNDATION ✅

- ✅ Monorepo pnpm (`apps/mobile`, `apps/api`, `packages/shared`) + `.npmrc` hoisted + tsconfig base
- ✅ `packages/shared` : constantes de domaine, schémas **Zod**, `classifySafety` (déterministe), `computeRepairabilityScore` — **18 tests** (dont câble électrique/gaz/lithium → STOP)
- ✅ `apps/api` : Worker **Hono** + wrangler (`GET /`, `GET /health`), CORS, 404/500 JSON — 2 tests, `wrangler dev` OK sur `:8788` (gemini+db détectés via `.dev.vars`)
- ✅ Projet **Neon** créé : `fixit-ai` / `winter-union-90877282` (org sweet-tooth, région aws-us-east-2, PG 17)
- ✅ `apps/mobile` : Expo SDK 57 + **Expo Router** (typed routes), `metro.config.js` monorepo, `app.config.ts`
- ✅ Thème clair/sombre (`tokens.ts` + `ThemeProvider`), composants : `Text`, `Screen`, `Card`, `Button`, `RiskBadge` / `DifficultyBadge` / `RecommendationBadge`
- ✅ Écran d'accueil : titre, sous-titre, 4 actions (Take photo / Upload photo / Describe / Record video → **SOON**) + écrans stub `capture` / `describe`
- ✅ ESLint 9 (flat) + Prettier + Vitest — `pnpm lint` / `pnpm -r test` / `pnpm -r typecheck` verts
- ✅ Bundle Expo iOS OK (`expo export`, 1128 modules, `@fixit/shared` résolu par Metro)

**Écarts / notes :** port dev API = **8788** (8787 occupé par un autre projet local). Auth, R2, pipeline IA, DB migrations = phases suivantes.

---

## PHASE 3 — CAMERA ✅

- ✅ `expo-camera` + `useCameraPermissions` (écran de demande d'accès), prise de photo, bouton obturateur
- ✅ `expo-image-picker` (sélection galerie, lancement auto si `mode=library`)
- ✅ Preview `expo-image` + « Retake / Choose another »
- ✅ Champ description « What happened? »
- ✅ `POST /uploads` : upload relayé par le Worker vers **R2** (binding `IMAGES`), validation type/taille (JPEG/PNG/WebP, 10 Mo), `GET` + `DELETE /uploads/:id`
- ✅ `src/api/client.ts` (fetch typé + `ApiError`) et `src/api/uploads.ts`
- ✅ Bouton vidéo = **SOON** en PHASE 3 → **activé en PHASE 9** (2026-09-02)
- ✅ 5 tests API (mock R2 en mémoire) ; vérifié end-to-end via `wrangler dev` + R2 local (`curl` upload/get/415)

**Écart vs plan initial :** upload **relayé par le Worker** (mobile → Worker → R2) plutôt qu'URL
pré-signée. Plus simple, marche en local sans compte Cloudflare, secrets hors du mobile.
Les URLs pré-signées restent possibles plus tard (optim).
**Reste :** `wrangler r2 bucket create fixit-ai-images` avant déploiement (après `wrangler login`).

---

## PHASE 4 — DIAGNOSIS ✅

- ✅ Abstraction `AIProvider` (`src/providers/`) + `GeminiProvider` (vision, `responseSchema` structuré, `x-goog-api-key`) + `MockProvider` déterministe (secours si pas de clé)
- ✅ `POST /diagnoses` : validation Zod → récupération images R2 → IA → `coerceRawDiagnosis` → `assessDiagnosis` (sécurité + score) → persistance R2 (bridge avant Neon) → réponse
- ✅ `GET` / `DELETE /diagnoses/:id`
- ✅ Retry/réparation JSON (1 relance en renvoyant l'erreur au modèle)
- ✅ `classifySafety` **repensé** : `forcedStop` réservé aux dangers réellement décrits (câble secteur, fil dénudé, gaz, HT, lithium gonflée, feu, structure) ou sévérité IA `CRITICAL` ; les tokens de danger seuls (`mains_electricity`…) élèvent le risque sans bloquer
- ✅ `packages/shared/pipeline.ts` : `assessDiagnosis()` (pur, testé)
- ✅ Mobile : `src/api/diagnoses.ts`, écran `diagnosis/new` (loader « Analyzing… » → résultat), `DiagnosisResultView` (problème, confiance %, badges risque/difficulté/reco 🟢🟡🔴, `RepairabilityMeter` /100, temps, coût ou « unavailable », causes numérotées, « more info needed »), `StopView` (écran rouge « 🔴 STOP — Contact a professional », pas de guide)
- ✅ « Analyze » câblé depuis `capture` (upload → diagnostic) et `describe` (texte → diagnostic)
- ✅ Stub `repair/[id]` (PHASE 5)
- ✅ **37 tests** (24 shared + 13 api). Les 5 scénarios de référence vérifiés contre **Gemini réel** (`gemini-3.6-flash`) : robinet→DIY 52, chaise→CAUTION, PC→PROFESSIONAL (diag visible), lave-linge→PROFESSIONAL, **câble électrique→CRITICAL + STOP, score 1**

**Notes :** modèle passé à `gemini-3.6-flash` (`gemini-2.5-flash` retiré côté Google). Latence ~10–18 s/diagnostic. Erreurs Gemini → 502 + écran « Try again ». Persistance en R2 JSON en attendant Neon (PHASE 6).

---

## PHASE 5 — REPAIR GUIDE ✅

- ✅ `AIProvider.generateRepairGuide()` (Gemini `responseSchema` dédié + `MockProvider`)
- ✅ `GET /diagnoses/:id/repair-guide` : 404 si diag inconnu, **409 `forced_stop`** si danger, sinon génère + met en cache dans R2 (`guides/{id}.json`)
- ✅ `repairGuideSchema` étendu : `summary`, `generalWarnings` ; `coerceRepairGuide()` (casse + ré-indexation 0-based des étapes)
- ✅ `DELETE /diagnoses/:id` supprime aussi le guide en cache
- ✅ Écran `repair/[id]` : loader → `RepairGuideView`
- ✅ `RepairGuideView` : aperçu (résumé, difficulté, temps, ⚠ BEFORE YOU START, **TOOLS / PARTS / OPTIONAL**, prix `$x–y` ou **« Price unavailable »**) → **guide pas-à-pas 1 étape/écran** (STEP n/N, [Back]/[Continue], encadré **⚠ SAFETY** par étape) → écran « Done 🎉 »
- ✅ 41 tests (26 shared + 15 api). Guide vérifié contre Gemini réel (charnière meuble : 6 étapes, safety warnings, prix « unavailable »)

**Note :** le mobile suit sa propre position d'étape (0-based), la numérotation du modèle est ignorée.

---

## PHASE 6 — NEON + AUTH + STORAGE ✅

- ✅ **Neon Auth (Stack)** provisionné sur `winter-union-90877282` (projet Stack `3432abc2-…`, `neon_auth.users_sync`)
- ✅ **Drizzle** schema + migration `0000_init` appliquée à Neon : `app_users`, `diagnoses`, `diagnosis_images`, `repair_guides`, `repair_history`
- ✅ Worker : middleware `requireAuth` (vérif JWT Stack via **JWKS + jose**, `iss`/`aud`) + bypass dev `x-dev-user-id`
- ✅ `src/db/` (client `@neondatabase/serverless` + drizzle, `repos.ts`) — **persistance migrée de R2-JSON vers Postgres** (images toujours dans R2)
- ✅ `GET /me` (profil + quota) · toutes les routes `/uploads` et `/diagnoses` exigent l'auth, **filtrées par `user_id`**
- ✅ **Quota FREE 3 / 30 j** (`consumeQuota`, 429 `quota_exceeded`) ; premium = illimité
- ✅ `DELETE /diagnoses/:id` : cascade Postgres + purge des objets R2
- ✅ Mobile : `stackClient` (REST Stack : sign-up / sign-in / refresh), **`AuthProvider`** (expo-secure-store, refresh auto sur 401), portail d'auth dans `_layout`, écran `auth` (sign in / sign up), bandeau compte + quota + « Sign out » sur l'accueil
- ✅ **41 tests** (26 shared + 15 api **d'intégration contre Neon réel** : quota, isolation, auth 401, persistance, guide). Flux JWT Stack vérifié end-to-end via `wrangler dev`.

**Reste (config, non bloquant pour le dev) :** OAuth Google/GitHub côté mobile (redirections + config dashboard Stack) ; policies RLS Postgres (le filtrage Worker est la frontière de sécurité, cf. `ARCHITECTURE.md`) ; `wrangler login` + `wrangler r2 bucket create fixit-ai-images` + `wrangler secret put GEMINI_API_KEY DATABASE_URL` avant déploiement.

---

## PHASE 7 — HISTORY ✅

- ✅ `GET /diagnoses` (liste) + écran **« My Repairs »** (problème, temps relatif, badge de statut)
- ✅ Détail **rouvrable** : `app/diagnosis/[id].tsx` → `GET /diagnoses/:id` (inclut `history` + `status`) → `DiagnosisResultView` (ou `StopView`) + `OutcomeSection`
- ✅ `POST /diagnoses/:id/history` : `outcome` (fixed / not_fixed / pro) + `feedbackWorked` + `feedbackNote` + `beforeImageId` / `afterImageId` (résolus en clés R2, appartenance vérifiée) → met à jour `diagnoses.status`
- ✅ **Avant / après** : `OutcomeSection` affiche BEFORE (photo du diagnostic) / AFTER (photo ajoutée), + **« Problem solved 🎉 »**
- ✅ **Feedback 👍 / 👎 / 🔧 pro** ; 👎 → champ « What happened? »
- ✅ `imageSource()` / `imageSourceFromKey()` : images authentifiées (`<Image headers>`)
- ✅ Entrée « My Repairs » sur l'accueil
- ✅ 43 tests (26 shared + 17 api : historique + isolation historique)

---

## PHASE 8 — INTERACTIVE REPAIR ✅ (2026-09-01)

- ✅ **Shared** : `rawStepCheckSchema` (verdict `pass`/`retry`/`unsafe`/`unclear` + `summary` + `advice` + `escalate`), `coerceRawStepCheck` (alias de verdict, escalate auto sur `unsafe`), `repairSessionSchema` / `repairCheckSchema` / `verifyStepRequestSchema`. **+8 tests** (26 → 32 shared).
- ✅ **AIProvider.verifyStep** : Gemini (vision, `GEMINI_STEP_CHECK_SCHEMA` + `STEP_CHECK_SYSTEM_PROMPT`, conservateur : jamais `pass` sans certitude) · `MockProvider` déterministe (note « spark/smoke… » → `unsafe`, « won't/stuck/wrong… » → `retry`, sinon `pass`).
- ✅ **DB** : table `repair_sessions` (1 par diagnostic, `unique(diagnosis_id)`, `checks jsonb`, `current_step`, `status`). Migration `0001_repair_sessions` **appliquée à Neon**. `DELETE /diagnoses/:id` purge aussi les photos de session (`checks[].imageId`).
- ✅ **Routes** (`requireAuth`, filtrées `user_id`) : `POST /diagnoses/:id/repair-session` (démarre/récupère — 409 `guide_required` sans guide, 409 `forced_stop` si danger), `GET …/repair-session`, `POST …/repair-session/verify` (`stepIndex` + `imageId` + `note` → image du stockage → `verifyStep` → check ajouté, `current_step` avancé **seulement** si `pass`, `status: completed` quand toutes les étapes passent). Rate limit `DIAGNOSE_RL`. **+7 tests** d'intégration (20 → 27 api).
- ✅ **Mobile** : `src/api/repairSession.ts`, `verdictMeta.ts` (pur, testé), `StepCheck` (photo caméra → repli galerie → upload `kind=step` → `verifyStep` → carte verdict colorée + conseils + haptique). Intégré à chaque étape de `RepairGuideView` (`diagnosisId` passé depuis `repair/[id]`). Écran de fin adapté (« Stop here 🛑 » si un `unsafe` a été vu). **+2 tests mobile** (9 → 11).
- ✅ 70 tests (32 shared + 27 api + 11 mobile) · typecheck + lint verts · bundle iOS OK (2.7 Mo hbc).

**Reste V2+ :** reprise de session persistée côté mobile (le serveur fait déjà autorité), photos de session dans « My Repairs ».

## PHASE 9 — VIDEO ✅ (2026-09-02)

Diagnostic à partir d'un **court clip** (~15 s) — mouvement + son + pannes intermittentes qu'une photo rate.

- ✅ **Shared** : `VIDEO_CONTENT_TYPES` (`video/mp4`, `video/quicktime`), `MEDIA_CONTENT_TYPES`, `UPLOAD_KINDS` (+`video`), `MAX_VIDEO_BYTES` (40 Mo), `MAX_VIDEO_DURATION_SECONDS` (15). `createDiagnosisRequestSchema.videoIds` (max 1). `diagnosisResultSchema.input.videoIds`.
- ✅ **`POST /uploads`** accepte les vidéos (`kind=video`), plafond `MAX_VIDEO_BYTES` (par Content-Type). `bodyLimit` `/uploads` relevé à 40 Mo.
- ✅ **Gemini File API** (`apps/api/src/providers/gemini.ts`) : upload résumable `uploadType=media` → polling `state=ACTIVE` (20×1,5 s) → part `file_data`. Nettoyage best-effort après réponse (Gemini purge sinon à 48 h). Trop lourd pour l'inline base64.
- ✅ **`POST /diagnoses`** : récupère les vidéos du storage, `provider.diagnose({ images, videos })`. Vérif d'appartenance sur chaque média. `imageMeta` enregistre le kind `video` → **purge cascade au DELETE**. `MockProvider` gère `videos` (déterministe).
- ✅ **Mobile** : `VideoCapture` (expo-camera `mode="video"` + micro + minuteur + cap 15 s), `CaptureFlow` mode `video` (caméra **ou** galerie `mediaTypes:['videos']`), `uploadVideo` (rejet client >40 Mo), action d'accueil « Filmer une vidéo » **activée** (plus de *SOON*). `app.config.ts` : `microphonePermission` + `recordAudioAndroid`.
- ✅ **93 tests** (34 shared + 31 api + 28 mobile).
- ⚠️ **Non testé sur device** (schéma natif + File API réelle). Le pipeline File API n'est couvert qu'en dry-run/typecheck ; les tests API tournent avec le MockProvider.
- ✅ **Worker redéployé** (2026-09-02, version `cf8bf14e`, `/health` OK).
- ⏳ **Reste** : tester la File API réelle sur device ; miniature vidéo dans la preview et « My Repairs » ; extraction de durée côté mobile ; lecture de la vidéo dans le détail d'un diagnostic ; i18n `CaptureFlow`.

## PHASE 10 — POLISH ✅ (1re passe)

- ✅ **Gestion d'erreurs centralisée** : `src/lib/errors.ts` (`friendlyError(err, context)` + `isRetryable`), pur, remplace les ternaires dupliquées dans `diagnosis/new`, `diagnosis/[id]`, `repair/[id]`, `history`, `CaptureFlow`, `auth`. `ApiError` extrait dans `src/api/ApiError.ts` (testable hors Expo).
- ✅ **États réutilisables** : `LoadingState` / `ErrorState` / `EmptyState` (`src/components/StateView.tsx`) — spinner + message, bouton *Try again* seulement si l'erreur est réessayable, `accessibilityRole` alert/progressbar + live region.
- ✅ **ErrorBoundary** racine (`src/components/ErrorBoundary.tsx`) → plus d'écran blanc en cas d'erreur de rendu, bouton *Reload the screen*.
- ✅ **Onboarding** : 3 écrans d'intro (`app/onboarding.tsx`), `OnboardingProvider` (state partagé, persisté via `expo-secure-store`, clé `fixit.onboarding.v1`), portail dans `_layout` (intro → auth → app). *Skip* dispo.
- ✅ **Animations** (API `Animated` native, **0 dépendance ajoutée**) : `FadeInView` (fondu + glissement à l'entrée, cascade sur les cartes du diagnostic + étapes du guide + onboarding), scale au *press* sur `Card`, remplissage animé du `RepairabilityMeter`.
- ✅ **Accessibilité** : `accessibilityRole`/`Label`/`Hint`/`State` sur `Card`, `Button` (busy/disabled), badges (labels lisibles « Risk level: critical »…), `RepairabilityMeter` = `progressbar` + `accessibilityValue`, `StopView` = `alert` assertif, erreurs auth en `alert`, en-têtes `header`.
- ✅ **Perfs** : `history` passé en `FlatList` + ligne `memo`, `getMe`/`listDiagnoses` avec garde `alive` (plus de setState après démontage), `headerBackButtonDisplayMode: 'minimal'`.
- ✅ **Tests mobile** (nouveau) : Vitest sur les modules purs — `friendlyError`/`isRetryable` + `statusMeta`/`relativeTime`. **9 tests**. Total monorepo = **52** (26 shared + 17 api + 9 mobile).

### PHASE 10 — 2e passe ✅ (2026-09-01)

- ✅ **Haptique** (`expo-haptics`, `src/lib/haptics.ts`) : obturateur caméra (impact), STOP (warning), diagnostic prêt (success) / erreur (error), Start Repair (impact), navigation guide + fin (success), feedback 👍 (success) / 👎 (tap). Silencieux sur web.
- ✅ **Skeletons** (`src/components/Skeleton.tsx`, Animated natif) : `My Repairs` affiche des cartes fantômes au lieu d'un spinner.
- ✅ **Pull-to-refresh** sur `My Repairs` (`RefreshControl`).
- ✅ **Hors-ligne** : `ConnectivityProvider` (`src/lib/connectivity.tsx`) branché sur `netBridge` du client API (2 échecs consécutifs → offline, 1 succès → online) + `OfflineBanner` animé dans `_layout`.
- Bundle iOS OK (1189 modules). 55 tests.

### PHASE 10 — 3e passe ✅ (2026-09-01)

- ✅ **File de retry hors-ligne** : `src/lib/outboxQueue.ts` (pur : `addItem` dédoublonne sur path+body, `markAttempt`, `pruneExhausted`, `MAX_ATTEMPTS=6`) + `OutboxProvider` (persistance `expo-secure-store`, rejeu auto à la reconnexion via `useConnectivity`, abandon des erreurs métier `ApiError`). `OutcomeSection` : un feedback envoyé hors-ligne est mis en file + reflété localement (`optimisticEntry`). `OfflineBanner` affiche l'état de synchro. **+5 tests**.
- ✅ **i18n FR/EN (fondation)** : `src/i18n/` — `translate.ts` pur (`lookup` clés pointées, `interpolate` `{param}`, `makeTranslator` avec repli en→clé), catalogues `en.ts`/`fr.ts`, `index.ts` (`getLocales()` d'`expo-localization`, plugin ajouté). Écrans convertis : **accueil, My Repairs, auth**. Test de parité des clés en/fr. **+9 tests**. Reste : les autres écrans suivent le même `t()`.
- ✅ **Empty/Error states illustrés** : `IconMedallion` (emoji sur cercles concentriques teintés, 0 dépendance — pas de SVG) dans `EmptyState` + `ErrorState`.
- ✅ **Transitions d'écran** : via `react-native-screens` (déjà présent) — `animation: 'slide_from_right'` global, `'fade'` pour index/auth/onboarding. **`react-native-reanimated` écarté** : sa v4 tire `react-native-worklets` (peer non résolu ici) + exige un rebuild natif (pas d'EAS, disque à 95 %) et contredit le choix « 0 dépendance » des animations `Animated`.
- Bundle iOS OK. Total 88 tests.

## PHASE 6b — OAuth Google (mobile) ✅ (2026-09-01)

- ✅ **Neon Auth (Stack)** : provider Google déjà dispo en **clés partagées** (dev). Domaine de confiance `https://fixit-ai-api.ichigo35.workers.dev` ajouté.
- ✅ **Worker** : route publique `GET /auth/callback` — rebond du `redirect_uri` https (exigé par Stack) vers le schéma natif `fixitai://oauth?code=…&state=…` (meta-refresh, seuls `code`/`state`/`error` relayés). **+1 test**.
- ✅ **Mobile** : `src/auth/oauth.ts` — flux code d'autorisation **+ PKCE** (`expo-crypto` S256), `expo-web-browser` `openAuthSessionAsync`, vérif du `state`, échange sur `/auth/oauth/token`, `sub` extrait du JWT (`src/auth/jwt.ts`, testé). `AuthProvider.signInWithGoogle` + bouton « Continue with Google » sur l'écran auth (`OAuthCancelledError` silencieuse).
- - ✅ **Identifiants Google propres** posés dans Neon Auth (`update_auth_oauth_provider`, `type: standard`). Redirect Google whitelisté = `https://api.stack-auth.com/api/v1/auth/oauth/callback/google`. Vérifié : l'endpoint `authorize` redirige vers Google avec le bon `client_id`.
- ✅ **`eas.json`** (profils development/preview/production, `EXPO_PUBLIC_APP_ENV=production`).
- ✅ **APK release Android buildé en local** (`expo prebuild` + `./gradlew :app:assembleRelease`). Fixes en passant : `pnpm-workspace.yaml` (`nodeLinker: hoisted` — pnpm 11 ignore `.npmrc`), NDK r27b installé manuellement. Détail dans `CLAUDE.md` § Build mobile.
- ✅ **Fix « Unmatched Route » (2026-09-02)** : sur Android le navigateur ouvre le deep link `fixitai://oauth?code=…` au lieu de rendre la main à `openAuthSessionAsync`. Route `app/oauth.tsx` ajoutée → `completeGoogleSignIn(url)` termine l'échange (idempotent : deep link OU retour navigateur, grâce 4 s après cancel/dismiss). `'oauth'` joignable déconnecté dans le garde `_layout.tsx`.
- ✅ **Fix « retour Google → écran de login » (2026-09-02)** : sur Android le navigateur système est un processus séparé → l'app peut être **recréée** pendant le choix du compte Google, donc l'objet `pending` (verifier/state en mémoire) disparaît et l'échange du code échouait silencieusement → retour à `/auth`.
  - `verifier` + `state` désormais **persistés dans SecureStore** (`fixit.oauth.pending.v1`) au lancement du flux.
  - `oauth.ts` : nouveau `resolveGoogleRedirect(url)` qui termine l'échange **à chaud** (promesse en mémoire) **ou à froid** (relit SecureStore) et **renvoie la session** ; cache d'échange par `code` (usage unique garanti même si deep link + `openAuthSessionAsync` reviennent tous les deux).
  - `AuthProvider.completeGoogleRedirect(url)` : la route `app/oauth.tsx` persiste la session elle-même, sans dépendre de la promesse de `signInWithGoogle` ni du timer (relevé 4 s → 12 s, ne rejette plus que la promesse en mémoire).
  - Worker `/auth/callback` : bouton de repli agrandi (tap = geste utilisateur, seule redirection fiable vers `fixitai://` dans Chrome Custom Tabs ; la CSP `default-src 'none'` interdit tout `<script>` inline).
  - **93 tests toujours verts**, typecheck + lint OK. **APK release rebuildé** (`app-release.apk`).

- ✅ **Worker redéployé** (2026-09-02, version `a65c7f6c`) — nouveau `/auth/callback`, `/health` OK.

- ✅ **Flux OAuth Google validé end-to-end sur device** (2026-09-02, APK release) — chaud + froid, session persistée.

### Publication de l'écran de consentement Google — en cours (2026-09-02)

Google refuse de publier l'app *External* (Testing → Production) tant que la section **« Domaine de l'application »** (page d'accueil + règles de confidentialité + conditions) est vide.

- ✅ **Pages publiques HTML servies par le Worker** (`apps/api/src/pages.ts`) : `GET /` (accueil), `GET /privacy`, `GET /terms`. CSP assouplie pour ces 3 chemins uniquement (`style-src 'unsafe-inline'`) via un middleware externe dans `app.ts` ; les routes JSON gardent `default-src 'none'`. `GET /` ne renvoie plus le JSON `{name,status}` (aucun consommateur). 6 tests ajoutés → **37 tests api**, typecheck + lint OK, rendu vérifié en local.
- ✅ **Worker déployé** (2026-09-02, version `40c1fbcc`) — les 3 URL répondent en prod (HTML + bon CSP), `/health` inchangé.
- ✅ **Console Google Cloud** (projet `fixit-ai-507310`) : domaine autorisé `ichigo35.workers.dev` ajouté, 3 URL renseignées, branding enregistré, **application publiée → « État de la publication : En production »**. Scopes non sensibles → aucune vérification Google requise.

**➡️ Résultat : n'importe quel compte Google peut désormais se connecter à FixIt AI** (fin du mode Testing / plus besoin de *test users*). À revérifier vite fait sur device avec un compte Google non-testeur.

OAuth GitHub/Apple = plus tard.

### i18n flux de capture + médias dans « My Repairs » ✅ (2026-09-02)

- ✅ **i18n du flux de capture** : `CaptureFlow`, `CameraCapture`, `VideoCapture`, `app/diagnosis/new.tsx` convertis à `t()`. Nouveaux namespaces `capture.*` (labels, permissions caméra/micro, placeholders, écran d'analyse) et `media.*`. Parité en/fr couverte par le test existant (`apps/mobile/test/i18n.test.ts`).
- ✅ **Miniatures + lecture vidéo dans le détail du diagnostic** : `apps/mobile/src/features/diagnosis/DiagnosisMedia.tsx` — bande horizontale de vignettes (photos via `expo-image`, vidéos = tuile ▶) + visionneuse plein écran (`Modal`), lecture avec **`expo-video`** (`useVideoPlayer` / `VideoView` `nativeControls`), source authentifiée `videoSource(id)` (header `Authorization: Bearer`). Intégré dans `DiagnosisResultView` **et** `StopView`.
- ✅ **API** : `getDiagnosis` (`apps/api/src/db/repos.ts`) renvoie désormais `input.imageIds` / `input.videoIds` = **l'id d'upload** (suffixe de `r2Key`), utilisable tel quel par `GET /uploads/:id`. Avant : l'id de ligne `diagnosis_images` (cassait la vignette « avant » d'`OutcomeSection`). Assertion ajoutée au test `avec image`.
- ✅ **Dép. ajoutée** : `expo-video` (~57.0.3) — `apps/mobile/package.json` + plugin dans `app.config.ts`. `expo install` a été SIGKILL en cours (mémoire) → dép. ajoutée à la main, lockfile déjà cohérent.
- ✅ 99 tests (34 shared + 37 api + 28 mobile), typecheck + lint OK.
- ✅ **APK release rebuildé** (2026-09-02, `ai.fixit.app` v0.1.0, ~52 Mo arm64, signé clé debug). Build ~15 min à froid (`--clean` + `expo-video` = nouveau module natif). Trop gros pour l'upload chat (30 Mo) → Finder.
- ⏳ **Lecture vidéo non testée sur device** (composant natif `expo-video`) — à vérifier avec cet APK.

## Sécurité — durcissement ✅ (2026-09-01)

- ✅ **En-têtes** (`secureHeaders`) : CSP `default-src 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS, COOP/CORP. Vérifiés en prod.
- ✅ **Plafond de corps** (`bodyLimit`) : `/uploads` ≤ 10 Mio, `/diagnoses*` JSON ≤ 64 Kio → `413 payload_too_large`.
- ✅ **Rate limiting** : primitive Cloudflare `[[ratelimits]]` — `DIAGNOSE_RL` 8/min/user (POST /diagnoses + repair-guide), `UPLOAD_RL` 40/min/user (POST /uploads). Clé = userId (fallback IP). `429 rate_limited`. Couche grossière (best-effort) ; le quota exact reste `consumeQuota` (3/user).
- ❌ **RLS Postgres** : non faisable ici — `drizzle-orm/neon-http` n'a **aucun support de transaction** (impossible de poser un GUC de session par requête) et **tous les rôles Neon ont `BYPASSRLS`** (non retirable par `neondb_owner`). Le filtrage `WHERE user_id =` côté Worker + tests d'isolation restent la frontière (cf. `ARCHITECTURE.md`).
- ❌ **Rôle Postgres restreint** : sans intérêt sur Neon — tout rôle a `CREATEDB`/`CREATEROLE`/`BYPASSRLS`, aucun gradient de privilège. L'isolation Neon est au niveau projet/branche.

---

## Backlog transverse

- ⏸️ `ProductIdentificationService` (bases externes)
- ⏸️ `KnowledgeProvider` (manuels fabricants, docs sous licence)
- ⏸️ `PartsProvider` (prix/dispo réels)
- ⏸️ `AnalyticsClient` (PostHog ou équivalent)
- ⏸️ `BillingClient` / RevenueCat (FREE/PREMIUM)
- ✅ CI GitHub Actions (`.github/workflows/ci.yml`) : `pnpm install --frozen-lockfile` → `lint` → `-r typecheck` → `-r test`, sur push/PR `main`. Tests API d'intégration : tournent si le secret `DATABASE_URL` est défini sur le dépôt, sinon `describe.runIf(hasDb)` les saute.
- ⏳ EAS Build / dev client — avant distribution

## Rôle administrateur / accès illimité ✅ (2026-09-02)

- Colonne `app_users.role` (`text NOT NULL DEFAULT 'user'`) — migration `0002_user_role.sql`, **appliquée sur Neon prod**.
- Var `ADMIN_EMAILS` (`wrangler.toml [vars]` + `.dev.vars`) = liste d'emails, séparés par des virgules. `apps/api/src/auth/admin.ts` (`isAdminEmail`).
- `ensureUser(db, id, email, isAdmin?)` synchronise `role` sur la liste à chaque `/me` et `POST /diagnoses` (email connu → `admin`/`user` ; email inconnu → inchangé).
- `getQuota` / `consumeQuota` : `role === 'admin'` (ou `plan === 'premium'`) ⇒ limite `Infinity`, **quota jamais consommé** (`diagnoses_used` reste à 0). `/me` renvoie désormais `role`.
- Mobile : `Me.role`, accueil affiche « Administrateur · illimité » (i18n `home.quotaAdmin` FR/EN).
- `tcha.jimmy@gmail.com` promu `admin` en base (le seul compte existant). Un système d'abonnement (`plan`) pour les autres profils reste à faire.
- 89 tests (test admin : 5 diagnostics d'affilée en 201, `quota.used` reste 0).
- **Reste** : `pnpm --filter @fixit/api run deploy` pour propager la var `ADMIN_EMAILS` en prod (bloqué côté agent, à lancer manuellement).

### Admin — override guide + « More info » ✅ (2026-09-02)

- **Guide déverrouillé pour un admin même sur un STOP de sécurité** : `GET /diagnoses/:id/repair-guide`, `POST …/repair-session` et `…/verify` ne renvoient plus 409 `forced_stop` / `session_unavailable` si `isAdminEmail(env, userEmail)`. Le guide est généré avec `RepairGuideInput.adminOverride` → prompt renforcé (tous les dangers dans `generalWarnings`, `safetyWarning` par étape, étape 1 = mise en sécurité complète).
- **Mobile** : `MeProvider` / `useMe()` (`src/lib/me.tsx`, wrap dans `_layout.tsx`) expose `me` / `isAdmin` / `unlimited` / `refresh` — l'accueil le consomme (fin du `getMe` local).
  - `DiagnosisResultView` : reco « professionnel » → bouton actif pour un admin (« Open repair guide (override) ») + carte « ⚠️ ADMIN OVERRIDE ». Non-admin : bouton désactivé comme avant.
  - `StopView` : carte « ⚠️ ADMIN OVERRIDE » + bouton « Open repair guide anyway » (admin uniquement). Tous les avertissements de danger restent affichés.
- **« ADD MORE DETAILS »** : nouveau composant `RefineDiagnosis` (dans `DiagnosisResultView` **et** `StopView`) — champ texte libre + « Re-analyze with these details » → relance `/diagnosis/new` (description d'origine + précisions concaténées, mêmes `imageIds`/`videoIds`). Crée un nouveau diagnostic (non consommé pour un accès illimité).
- **100 tests** (34 shared + 38 api + 28 mobile). Nouveau test api : « admin : guide accessible malgré forcedStop » (guide 200 + repair-session 201).
- ✅ **Worker déployé** (version `7444aa66`, 2026-09-02, `/health` OK) + **APK release rebuildé** (2026-09-02 20:03).

## Déploiement Cloudflare ✅ (2026-09-01)

- **Worker prod : `https://fixit-ai-api.ichigo35.workers.dev`** — `wrangler deploy` (compte `tcha.jimmy@gmail.com`).
- **R2 abandonné** : son activation exigeait une carte bancaire. Remplacé par **Neon Object Storage** (S3-compatible, déjà activé, 5 Go gratuits) — voir plus bas.
- Secrets Worker posés : `GEMINI_API_KEY`, `DATABASE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- `APP_ENV=production` dans `wrangler.toml` → bypass `x-dev-user-id` désactivé (vérifié : `curl -H 'x-dev-user-id: hacker' … → 401`).
- Vérifs prod : `/health` OK · 401 sans token · CORS 204 · E2E authentifié (Stack JWT) : upload → GET round-trip (bytes match) → autre user 403 → delete → 404. Diagnostic = 502 tant que le quota Gemini gratuit est épuisé (se réinitialise).
- **Reste** : domaine custom Cloudflare (le `.workers.dev` suffit pour l'instant) ; build mobile pointant sur l'URL prod (`app.config.ts` : prod par défaut si `EXPO_PUBLIC_APP_ENV=production`).

## Stockage objet — R2 → Neon Object Storage ✅

- `apps/api/src/storage/` : `ObjectStorage` (put/get/delete) ; `s3.ts` (SigV4 `aws4fetch`, path-style, `x-amz-meta-*`) ; `memory.ts` (tests) ; `getStorage(env)`.
- Bucket `fixit-ai-images` (private) + credential `fixit-api-worker-rw` (`storage:read`+`storage:write`).
- Routes `uploads`/`diagnoses` migrées ; `wrangler.toml` : `[[r2_buckets]]` supprimé, vars `S3_*` ajoutées.
- 53 tests (26 shared + 9 mobile + 18 api, dont purge-cascade de l'image). Round-trip vérifié local + prod.

---

## Rituel de fin de phase (rappel)

1. Expliquer → implémenter → tester → corriger → vérifier démarrage
2. MAJ `TODO.md` + indiquer ce qui marche vraiment / ce qui reste
3. `git commit` + `git push` vers `git@github.com:Ichigo35/FixIt_AI.git`
4. MAJ `CLAUDE.md` + mémoire
