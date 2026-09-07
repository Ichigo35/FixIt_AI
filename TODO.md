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

---

## PHASE 11 — AUDIO 🚧 (2026-09-07)

Diagnostic à partir d'un **court clip audio** (~30 s) + une **description obligatoire** — le bruit d'une panne (voiture, électroménager, PC…). Miroir de la PHASE 9 (vidéo).

- ✅ **Shared** : `AUDIO_CONTENT_TYPES` (`audio/mp4|mpeg|aac|wav|ogg`), ajoutés à `MEDIA_CONTENT_TYPES` ; `UPLOAD_KINDS` (+`audio`) ; `MAX_AUDIO_BYTES` (15 Mo), `MAX_AUDIO_DURATION_SECONDS` (30). `media.ts` : alias (`audio/m4a`→`audio/mp4`…), extensions (`m4a/aac/mp3/wav/ogg`), `isAudioContentType`, `resolveAudioContentType`. `createDiagnosisRequestSchema.audioIds` (max 1), `diagnosisResultSchema.input.audioIds`.
- ✅ **`POST /uploads`** : sélection à trois voies `kind`/`maxBytes` (video / audio / image) via `isAudioType`.
- ✅ **`POST /diagnoses`** : `diagnosisFingerprint` inclut `audioIds` (dédup correcte) ; garde `need_description_for_audio` (clip sans description ⇒ 400) ; boucle média + branche `isAudio` → `provider.diagnose({ …, audios })` ; `result.input.audioIds` ; `db/repos.ts` split par `kind` (`audioIds`). **Aucune migration** (`diagnosis_images.kind` texte libre).
- ✅ **Provider Gemini** : `DiagnoseAudio` + `DiagnoseInput.audios` ; clip court ⇒ part `inline_data` base64 (comme les images), repli API Files (`uploadAndWaitFile`, ex-`uploadAndWaitVideo`) au-delà de ~18 Mo. `MockProvider` gère `audios`. Prompt : bloc « listen for grinding/clicking/humming… + WHEN it happens ».
- ✅ **Mobile** : dép. native **`expo-audio ~57.0.4`** + plugin `app.config.ts` ; `AudioCapture.tsx` (`useAudioRecorder`/`useAudioRecorderState`, perms, cap 30 s, bouton record/stop) ; `uploads.ts` `uploadAudio` + `audioSource` (retag `Blob.slice()`) ; `CaptureFlow` mode `audio` (**description ≥ 8 car. obligatoire**) ; `app/capture.tsx` + `app/diagnosis/new.tsx` (`audioIds`, `analyzingAudio`) ; `DiagnosisMedia` tuile 🎙️ + `AudioPlayerBox` (`useAudioPlayer`) ; `RefineDiagnosis` propage `audioIds` ; action d'accueil « Enregistrer un son » ; i18n FR/EN (`capture.*`, `media.audio/playAudio`, `home.actionAudio*`).
- ✅ **Helper pur** `src/features/capture/audioMeta.ts` (`formatClock`, `isUsableClip`) + test.
- ✅ **177 tests** (72 shared + 58 api + 47 mobile ; +2 api « live » opt-in), `pnpm -r typecheck` + `pnpm lint` verts.
- ✅ **`expo prebuild` + APK release** (2026-09-07, build 3 min 22 s, `RECORD_AUDIO` dans le manifeste, `allowBackup=false` + `dataExtractionRules` préservés). `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (~54,7 Mo, arm64, signé clé debug).
- ✅ **Worker déployé** (2026-09-07, version `4aeefdb2`, `/health` OK — audio rétrocompatible).
- ⏳ **Reste** : **vérif sur device** (OPPO CPH2799 non branché) : enregistrer un bruit → diagnostic → relecture dans « My Repairs » + `wrangler tail --format json` (upload `audio/*`, part inline envoyée) ; test « live » Gemini audio opt-in (`GEMINI_LIVE_AUDIO`).

---

## PHASE 12 — ENTRÉES DE DIAGNOSTIC ENRICHIES 🚧 (2026-09-07)

Trois champs facultatifs qui affinent le diagnostic — **aucune requête Gemini en plus**, juste plus de contexte dans le prompt.

- ✅ **12a Plaque signalétique / modèle** : `identifiedModel` (marque/modèle/série) était **déjà** produit par Gemini + porté dans `rawDiagnosisSchema` mais jamais exploité. Route : `serialNumber` forwardé à `provider.diagnose` + persisté (colonne `serial_number` existante) + `result.input.serialNumber`. Prompt système : extraction **verbatim** de la plaque → `identifiedModel.confident`. `DiagnosisResultView` : carte **« IDENTIFIED MODEL »**. Mobile : bouton « Photo de la plaque signalétique » (caméra/galerie → `uploadImage(uri, 'label')` → id concaténé aux `imageIds`).
- ✅ **12b Code d'erreur + base OBD-II** : dataset MIT `Wal33D/dtc-database` → `packages/shared/src/data/dtc-generic.json` (**9 415 codes génériques P/C/B/U**, 557 Ko, +74 Ko gzip). `packages/shared/src/dtc.ts` (`normalizeDtc`/`isDtcFormat`, léger, dans le barrel) + `dtcData.ts` (`lookupDtc`, **hors barrel** → jamais dans le bundle mobile ; import serveur `@fixit/shared/dtcData`). `createDiagnosisRequestSchema.errorCode`. Route : normalise le code au format canonique ; si DTC générique connu → `errorCodeInfo` (signification standard) injecté dans le prompt, **reformulé par le modèle**. Migration **`0003`** (`error_code` + `measurements` sur `diagnoses`) — appliquée sur la branche Neon (= prod, même branche). Mobile : champ « Code d'erreur » + indicateur « ✓ code OBD-II reconnu » (100 % local via `isDtcFormat`).
- ✅ **12c Mesures** : `createDiagnosisRequestSchema.measurements` (texte libre ≤ 600). Route → prompt (« use them ; if a key measurement is missing, ask via moreInfoNeeded »). Persisté (colonne `measurements`). Mobile : champ multiligne.
- ✅ **Composant partagé** `src/features/diagnosis/ExtraDetailsFields.tsx` (replié par défaut) branché dans `CaptureFlow` **et** `describe.tsx` ; `diagnosisFingerprint` inclut `errorCode`/`measurements`/`serialNumber` (dédup correcte) ; `RefineDiagnosis` propage les 5 champs. i18n FR/EN (`extra.*`).
- ✅ **189 tests** (79 shared + 63 api + 47 mobile), `typecheck` + `lint` verts. Worker bundle 1,34 Mo / **252 Ko gzip** (limite CF 1 Mo gzip → large marge).
- ✅ **Worker déployé** (2026-09-07, version `febf8f9d`, `/health` OK).
- ⏳ **Reste** : **vérif device** (diagnostic voiture `P0300` → explication du code ; photo de plaque → carte « IDENTIFIED MODEL ») — sur un APK groupé avec les PHASES 11+13.

---

## PHASE 13 — RESTITUTION 🚧 (2026-09-07)

Questions interactives · « réparer ou remplacer » · STOP par domaine · i18n des écrans de diagnostic.

- ✅ **13a Questions de clarification interactives** (= multi-tours léger) : `RefineDiagnosis` rend `diagnosis.moreInfoNeeded` comme une **liste de questions**, chacune avec son champ de réponse (state `answers: Record<number,string>`) + champ libre. À la soumission : concaténation `description d'origine + "User's answers:\n- {q} → {a}"` + `router.push('/diagnosis/new', …)` (re-soumission client, non consommée pour illimité, fingerprint différent). Propage tous les champs (`brand`/`model`/`serialNumber`/`errorCode`/`measurements`/`replacementCost`/médias). La carte « MORE INFORMATION » de `DiagnosisResultView` est **retirée** (fondue dans `RefineDiagnosis`).
- ✅ **13b « Vaut le coup de réparer ? »** : `packages/shared/src/repairability/verdict.ts` `repairVsReplace()` **pur** (score → `repair`/`borderline`/`replace` ; ratio coût réparation médian / prix du neuf si fourni ; pénalités `partsAvailability==='uncommon'`, `riskOfWorseningDamage==='high'`, score bas). `createDiagnosisRequestSchema.replacementCost` (nombre > 0) + `diagnosisResultSchema.input.replacementCost` + colonne `replacement_cost` (**migration `0004`**, appliquée branche Neon). `DiagnosisResultView` : carte **« REPAIR OR REPLACE »** (verdict coloré + ratio + dispo pièces + risque d'aggraver — ces 2 derniers **déjà générés, jamais affichés**). Champ « prix du neuf » ajouté dans `ExtraDetailsFields` (`keyboardType="decimal-pad"`) ; le verdict marche aussi sans (score seul).
- ✅ **13c STOP spécifiques par domaine** : `safety/classifier.ts` — nouvelles `TextRule` FR+EN : `refrigerant` (fluide frigorigène / R-134a… → **CRITICAL forcedStop** : manipulation légalement encadrée), `airbag` (SRS / prétensionneur → **CRITICAL forcedStop**), `vehicle_lifted` (voiture sur cric/chandelles → HIGH), `working_at_height` (échelle / toit / gouttières → HIGH). Tokens de danger `airbag`/`refrigerant`/`working_at_height`/… → plancher de risque. **Règle d'or respectée** (ne peut que durcir).
- ✅ **13d i18n** : namespace `diagnosis.*` (FR/EN, parité testée) → `DiagnosisResultView`, `StopView`, `RefineDiagnosis`, `OutcomeSection` migrés à `t()` ; `describe.tsx` migré (namespace `describe.*`) ; `lib/errors.ts` : `need_description_for_audio` ajouté (reste EN — module pur hors Expo, i18n complète = plus tard).
- ✅ **199 tests** (89 shared + 63 api + 47 mobile), `typecheck` + `lint` verts.
- ✅ **Worker déployé** (2026-09-07, version `daa89cb9`, `/health` OK).
- ✅ **APK release PHASES 11+12+13** reconstruit (2026-09-07, `--rerun-tasks` forcé car `org.gradle.caching` masquait le re-bundle JS — piège documenté dans CLAUDE.md ; bundle vérifié : `Writing bundle output` + strings 11/12/13 présentes dans `index.android.bundle`). `app-release.apk` (~54,8 Mo, arm64, clé debug).
- ⏳ **Reste** : **vérif device** (OPPO CPH2799 non branché) — audio bout-en-bout, code `P0300` → explication, photo de plaque → carte modèle, questions cliquables → re-diagnostic, carte « réparer ou remplacer », « fluide frigorigène » → STOP ; i18n de `lib/errors.ts` (module pur hors Expo).

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

### Guide de réparation illustré — icônes outils + type d'étape ✅ (2026-09-02)

- **`packages/shared/src/icons.ts`** : deux fonctions **pures** — `toolIconId(name)` (nom d'outil libre FR/EN → id d'icône, repli `toolbox`) et `stepIconId({title,instruction})` (type d'étape : `secure` / `unplug` / `water-off` / `cool-down` / `disassemble` / `unscrew` / `inspect` / `clean` / `measure` / `replace` / `tighten` / `lubricate` / `reassemble` / `test` / `photo`, repli `generic`). Tables de mots-clés ordonnées, texte normalisé (minuscule + sans accent). Exportées via `@fixit/shared`.
- **Assets** : `apps/mobile/assets/icons/` — 25 icônes outils + 16 icônes d'étape, SVG au trait monochrome 24×24 (26 reprises de **Lucide** ISC + 15 tracées à la main dans le même style, `stroke="currentColor"`).
- **`apps/mobile/src/components/LineIcon.tsx`** : `<ToolIcon id>` / `<StepIcon id>` — `expo-image` (déjà natif, gère le SVG + `tintColor` dynamique) → **aucun module natif ajouté, aucun rebuild « à froid »**. Map `satisfies Record<…IconId, number>` (complétude garantie au typecheck). `apps/mobile/types/assets.d.ts` déclare `*.svg`.
- **`RepairGuideView`** : aperçu → chaque entrée `TOOLS` / `OPTIONAL` précédée de son icône ; étape → médaillon d'icône de type dans l'en-tête + ligne `TOOLS` en puces « icône + nom ».
- **Illustrations d'étape par IA écartées** (choix utilisateur) : pictos génériques par type d'étape, instantané / hors-ligne / gratuit.
- **110 tests** (44 shared + 38 api + 28 mobile) — `packages/shared/test/icons.test.ts` (mapping FR/EN, replis, ids valides). Metro `expo export` android OK (41 assets bundlés).
- ✅ **APK release rebuildé (2026-09-02 23:46, ~52 Mo)** avec le guide illustré. Parité i18n non concernée (RepairGuideView encore en EN codé en dur).

### Build APK local accéléré ✅ (2026-09-02)

- **Cause de la lenteur (~19 min systématiques) : `org.gradle.daemon=false`** dans `~/.gradle/gradle.properties` (posé par une session précédente « pour la RAM ») → JVM Gradle froide + **état de compilation incrémentale Kotlin jeté à chaque build** → `compileReleaseKotlin` recompilait tout. Le clean `/storage-audit` de l'utilisateur n'y était **pour rien** (`~/.gradle` intact 4,4 Go, disque à 49 Go libres).
- **Fix** : `~/.gradle/gradle.properties` → `daemon=true` + `idletimeout=1200000` (rend la RAM 20 min après) + `caching` + `parallel`/`workers.max=4`. `apps/mobile/android/gradle.properties` → cache, JDK 17 épinglé (un seul daemon), `kotlin.daemon.jvmargs=-Xmx1536m`, `reactNativeArchitectures=arm64-v8a`, PNG crunch off.
- **`apps/mobile/scripts/build-android-release.sh`** (commité) : réapplique ces props (effacées par `prebuild`), `-x lintVitalRelease` (que `-x lint` ne saute pas), `--build-cache`, `open -R`.
- **Mesuré** : rebuild sans changement **45 s** (vs ~19 min). Attendu ~2-4 min pour un vrai changement JS, ~10-15 min pour `--clean`.
- Itérer sur le JS sans rebuild : `pnpm mobile` (Metro) + APK installé.

### Bascule automatique modèle Gemini (quota) ✅ (2026-09-02)

- **`FailoverGeminiProvider`** (`apps/api/src/providers/geminiFailover.ts`) : modèle préféré `GEMINI_MODEL` (`gemini-3.6-flash`) → sur **HTTP 429** (`RESOURCE_EXHAUSTED`), mise « en repos » du modèle (`RetryInfo.retryDelay` du corps, sinon 60 s, plafond 1 h) + bascule sur `GEMINI_FALLBACK_MODEL` (`gemini-3.5-flash`). Repos écoulé ⇒ retour automatique au modèle préféré (aucune intervention). État `Map` module-level (par isolate Worker, best-effort comme le rate limiting Cloudflare).
- `GeminiProvider.call` + `uploadAndWaitVideo` : 429 → `AIProviderError('ai_rate_limited', { retryAfterMs })` ; route `diagnoses` mappe `ai_rate_limited` → **429**. Tous les modèles en 429 ⇒ `ai_rate_limited`.
- Vars ajoutées : `GEMINI_FALLBACK_MODEL` (`env.ts`, `wrangler.toml [vars]`, `.dev.vars`, `test/helpers.ts`). **Aucun nouveau secret** (même clé). Les 2 ids validés dispo sur la clé (`GET /v1beta/models`).
- **116 tests** (44 shared + **44 api** + 28 mobile) — `apps/api/test/geminiFailover.test.ts` (6 tests : `fetch` mocké + fake timers ; bascule, repos/reprise, repos par défaut, tous 429, non-429 sans bascule, 1 seul modèle).
- ✅ **Worker déployé (2026-09-02, version `6daeb673`)** — `GEMINI_FALLBACK_MODEL=gemini-3.5-flash` visible dans les bindings, `/health` OK.

### Étapes de réparation illustrées + refonte UI/UX du guide ✅ (2026-09-03)

**Problème** : le guide n'était que du texte — impraticable les mains dans l'appareil.

**Toutes les pistes d'illustration examinées**, et ce qui a été retenu :

| Piste | Verdict | Coût quota |
|---|---|---|
| **Schéma vectoriel natif par scène** | ✅ retenu — couvre **100 %** des étapes, hors ligne | **0** |
| **Photo de l'utilisateur annotée** (zone de l'étape mise en évidence) | ✅ retenu — repères posés par l'IA **dans l'appel de guide existant** | **0 requête en plus** (tokens d'entrée seulement) |
| Régénération d'un ancien guide pour obtenir les visuels | ✅ retenu (`?refresh=1`, bouton dans l'app) | 1 appel, à la demande |
| **Génération d'images par IA** (`gemini-3.1-flash-image`, `gemini-3-pro-image`…) | ❌ **impossible** : palier gratuit à `limit: 0` sur tous les modèles image (429 `RESOURCE_EXHAUSTED` mesuré le 2026-09-03, les autres ids répondent 404). Nécessiterait la facturation Google. | — |
| SVG généré par le modèle texte | ❌ écarté : tokens de sortie ×5, sortie fragile, nécessiterait `react-native-svg` (module natif) | — |

**1. Vocabulaire de scènes** — `packages/shared/src/scenes.ts` : 23 scènes (`power-off`, `unscrew`, `pry`, `disconnect`, `unclog`, `lubricate`, `reassemble`…), chacune décrite par une **composition pure** `{ body, focus, tool|stepIcon, motion, tone }` (`SCENE_SPECS`). `sceneForStep()` déduit la scène du texte (mots-clés FR+EN, **correspondance début de mot** — sans quoi « **dé**visser » tombait dans « visser », bug attrapé par les tests). `resolveScene()` = scène de l'IA si valide, sinon déduction ⇒ **aucune étape sans illustration**, y compris les guides déjà en cache et le `MockProvider`.

**2. Plan visuel produit par l'IA, sans requête supplémentaire** — `repairStepSchema` gagne `visual { scene, subject, caption, anchors[] }`, `checks[]` (0-4) et `estimatedMinutes` ; `GEMINI_REPAIR_SCHEMA` et `REPAIR_SYSTEM_PROMPT` étendus. La route `repair-guide` joint désormais **jusqu'à 3 photos du diagnostic** à l'appel de génération (`GUIDE_PHOTO_LIMIT`) : même nombre de requêtes, donc **même consommation de quota en requêtes**. `sanitizeVisual()` écarte un repère mal formé au lieu de faire échouer tout le guide.

**3. Repères sur la photo de l'utilisateur** — convention Gemini `box_2d = [ymin, xmin, ymax, xmax]` normalisée 0..1000 + `imageIndex` (dans `input.imageIds`). **Précision vérifiée en live** sur une image de test : vis à (190,180) et (710,180) px → boîtes renvoyées centrées sur (210,255) et (790,255) ‰ = exactement les vis.

**4. Rendu mobile** — `apps/mobile/src/features/repair/illustration/` :
- `SceneIllustration.tsx` : moteur de dessin **100 % primitives React Native** (Views, bordures, transforms, triangles par bordures, arcs par anneau + pointes tangentes) sur un canevas virtuel 100×62,5 unités. **Pas de `react-native-svg`, donc pas de module natif ni de rebuild.** Gestes animés (`Animated`, driver natif) : rotation h/ah, flèches entrée/sortie/haut/bas, balayage, gouttes, chaleur, pulsation. Respecte **« Réduire les animations »** (`useReducedMotion`) : pose figée, toujours lisible.
- `PhotoAnchorView.tsx` : photo de l'utilisateur en `contentFit="contain"` dans un conteneur au ratio exact de l'image (mesuré via `onLoad`) ⇒ les boîtes se posent en pourcentages, sans calcul de recadrage. Effet **projecteur** (4 voiles), cadre pulsant, étiquette, appui = voir toute la photo.
- `geometry.ts` (pur, testé) : `anchorRect` (bornage, coordonnées inversées, agrandissement d'un repère minuscule), `pickAnchor`, `labelBelow`.
- `StepVisual.tsx` : puce du type de geste + bascule **Photo / Schéma** quand un repère existe (photo par défaut) + légende.

**5. Refonte UI/UX du guide** (`RepairGuideView.tsx`) :
- **Aperçu** : méta compacte, avertissements, **« LE DÉROULÉ »** = toutes les étapes cliquables (médaillon coloré par type, durée, ⚠ si danger), outils en **grille de tuiles**, reprise « Reprendre à l'étape N ».
- **Étape** : en-tête fixe (retour au déroulé + « Étape n/N » + **barre de progression animée** + **rail d'étapes** scrollable et cliquable, ✓ pour les faites), **illustration en tête**, instruction en 24 px d'interligne, **points de contrôle cochables** (`checks`), carte sécurité, puces outils, vérification photo, **barre d'actions fixe en bas** (plus besoin de scroller pour continuer).
- **`useKeepAwake()`** : l'écran ne s'éteint plus pendant la réparation (fourni par `expo`, déjà autolinké).
- **i18n FR/EN complète** du guide (namespace `repair.*`, 23 libellés de scènes, verdicts, `StepCheck`) — l'un des points « à faire » du backlog.

**6. Robustesse Gemini — 503 « high demand »** (rencontré en live pendant la mise au point) : nouveau code `ai_overloaded`, `FailoverGeminiProvider` bascule aussi sur 503 (repos court 20 s), route → **503**. Mapping des erreurs IA factorisé (`aiStatus`/`aiErrorResponse`). Vérifié en live : `gemini-3.6-flash saturé → bascule sur gemini-3.5-flash`, guide produit.

**Tests : 143** (60 shared + 47 api + 36 mobile) + 2 tests **live** opt-in (`GEMINI_LIVE_TEST=1`, `apps/api/test/geminiRepairVisual.live.test.ts`) qui parlent au vrai modèle — jamais joués en CI.

**Vérification visuelle** : les 23 scènes ont été rendues hors app (transcription HTML de la même géométrie + capture headless) avant le build, pour valider les compositions.

### Upload MIME (JPEG MIUI) + clavier qui masquait la saisie ✅ (2026-09-04)

**Problème 1 — photos refusées (415)** : certains téléphones Android (MIUI/Xiaomi notamment) renvoient `image/jpg` (non canonique) au lieu de `image/jpeg` pour `fetch(content://…).blob().type` → le Worker rejetait avec un `Set` strict. **Fix** : `packages/shared/src/media.ts` (`normalizeMediaContentType`/`mediaContentTypeFromName`/`resolveImageContentType`/`resolveVideoContentType`), partagé Worker + mobile. Le Worker normalise le header reçu au lieu de le comparer strictement ; le mobile résout le type dans l'ordre `asset.mimeType` (sélecteur) → `blob.type` → extension → repli `image/jpeg`, et l'envoie en header explicite. Testé (6 tests shared).

**Problème 2 — clavier qui cachait le champ de saisie** (description du problème, « More info », etc.) : `Screen` gagne une prop `keyboardAware` (`KeyboardAvoidingView behavior="padding"` sur iOS ; `windowSoftInputMode="adjustResize"` suffit sur Android, déjà dans `AndroidManifest.xml`) + `scrollRef` pour `scrollToEnd` au focus du champ (Android ne défile pas seul). Appliqué à `describe.tsx` et à l'étape preview+description de `CaptureFlow`.

**⚠️ Vérification du 2026-09-05 (matin) invalidée** : une relecture de code + suite de tests verte avait conclu que ces deux fixes tenaient. **Faux** — l'utilisateur a branché son téléphone (OPPO CPH2799, Android 16/ColorOS) en USB et signalé que les deux bugs étaient toujours là avec le nouvel APK. Reproduits en direct via `adb`/`uiautomator`/`wrangler tail` : **relire du code ne suffit pas, il faut tester sur le device réel** avant d'annoncer un fix résolu — voir la section suivante pour les vraies causes et le vrai correctif (2026-09-05, après-midi).

### Déconnexion Google intermittente ✅ (2026-09-05)

**Symptôme rapporté** : la session Google se déconnectait de temps en temps, de façon non permanente (pas une vraie expiration du compte).

**Cause** : dans `AuthProvider`, `authBridge.refresh()` effaçait **systématiquement** la session locale (`persist(null)`) dès que `refreshAccessToken` levait une erreur — y compris pour une panne réseau passagère (coupure Wi-Fi/DNS — cf. note DNS intermittente de la machine dans ce fichier) ou une panne serveur transitoire (5xx/429) côté Stack Auth, qui n'ont rien à voir avec un refresh token réellement invalide. En plus, `apps/mobile/src/api/client.ts` forçait un second `onSignedOut()` dans tous les cas où `refresh()` renvoyait `null`, court-circuitant toute tentative de préserver la session.

**Fix** :
- `StackAuthError` porte désormais le **statut HTTP** d'origine ; nouvelle fonction pure `isDefinitiveAuthFailure(err)` (`apps/mobile/src/auth/authError.ts`, extrait de `stackClient.ts` pour rester testable en Node — comme `jwt.ts`) : `true` seulement pour un 4xx autre que 429 (refresh token réellement rejeté), `false` pour une erreur réseau, un 5xx ou un 429 (transitoire).
- `AuthProvider.authBridge.refresh` n'appelle `persist(null)` que si `isDefinitiveAuthFailure` est vrai ; sinon la session locale est conservée et le prochain appel retentera le refresh.
- `client.ts` ne force plus `onSignedOut()` quand `refresh()` renvoie `null` — la décision de déconnecter appartient désormais uniquement à `AuthProvider`.

**Tests** : `apps/mobile/test/authError.test.ts` (5 tests, purs). Suite complète relancée : 155 tests verts.

### Clavier + upload photo — vrais correctifs après test sur device ✅ (2026-09-05, après-midi)

L'utilisateur a branché son téléphone (**OPPO CPH2799, Android 16, ColorOS**) en USB et démontré que les deux
bugs du 2026-09-04 étaient toujours présents avec le nouvel APK. Diagnostiqué **en direct sur le device** avec
`adb`/`uiautomator2` (tap, screenshot, dump de la hiérarchie de vues) et `wrangler tail --format json` (requêtes
réelles reçues par le Worker prod) — la relecture de code de la veille avait conclu à tort que c'était corrigé.

**1. Clavier qui cache la saisie — cause réelle.** Le fix du 2026-09-04 (`Screen.keyboardAware` avec
`KeyboardAvoidingView behavior="height"` sur Android) ne faisait **rien** : `dumpsys window` a montré l'`EditText`
positionné à `[99,1493]-[981,1763]` alors que le clavier (`InsetsSource type=ime`) commençait à `y=1475` — champ
entièrement sous le clavier, comme avant. Cause : le calcul interne de `KeyboardAvoidingView` (`frame.y + frame.height
- keyboardY`, dans `KeyboardAvoidingView.js`) suppose que `frame.y` (mesuré par `onLayout`, **relatif au parent**)
correspond à une position absolue à l'écran — hypothèse fausse dès que la vue est nichée dans un `SafeAreaView`
(barre de statut). Sous edge-to-edge (Android 15+, `edgeToEdgeEnabled=true`), le résultat est une hauteur quasi
nulle : `KeyboardAvoidingView` ne sert à rien ici, quel que soit le `behavior` choisi.
**Fix fiable** : abandon de `KeyboardAvoidingView`. `Screen.tsx` écoute directement `Keyboard.addListener('keyboardDidShow'/'keyboardDidHide', …)`
(mécanisme natif RN moderne basé sur `WindowInsetsCompat.Type.ime()` — `ReactRootView.java#checkForKeyboardEvents`,
fonctionne bien indépendamment d'edge-to-edge) pour récupérer uniquement la **hauteur** du clavier (valeur absolue,
aucune ambiguïté de repère), l'ajoute en `paddingBottom` du contenu du `ScrollView`, et appelle `scrollToEnd()`
automatiquement à l'apparition du clavier. Centralisé dans `Screen` : `describe.tsx` et `CaptureFlow` en profitent
sans code par écran (le hack `onFocus` + `setTimeout(scrollToEnd)` de `CaptureFlow` est supprimé, devenu inutile).
**Vérifié en direct** : `EditText` désormais à `[99,734]-[981,1094]`, entièrement au-dessus du clavier (`y=1475`) —
champ, placeholder et bouton "Analyze" tous visibles, capture d'écran à l'appui.

**2. Photo refusée (415) — cause réelle.** Le fix du 2026-09-04 (normalisation du `Content-Type` en JS +
header explicite) ne suffisait pas : `wrangler tail --format json` a montré la requête `POST /uploads` réelle
envoyée par le téléphone **sans aucun header `content-type`** (confirmé aussi en la provoquant nous-mêmes via
`curl` pour valider la lecture de `wrangler tail`, dont le texte `- Ok @ …` en mode `pretty` est trompeur : il
indique juste l'absence d'exception dans le Worker, **pas** le code HTTP réel — piège découvert en cours de route).
Cause profonde : sur Android **et** iOS, le pont natif RN ignore le header HTTP JS pour un body `Blob` — Android
`BlobModule.kt#toRequestBody` (`var type = contentType; if (map["type"] non vide) type = map["type"]`) et iOS
`RCTBlobManager.mm#resolveMultipartBlock` lisent tous les deux en priorité le **type interne du Blob**
(`blob.data.type`, dérivé par l'OS — `ContentResolver.getType()` sur Android, UTI sur iOS), écrasant silencieusement
notre valeur normalisée dès qu'il est non vide. Sur ce device, ce type OS est soit non canonique, soit invalide pour
`MediaType.parse` d'OkHttp → **aucun** Content-Type n'est envoyé du tout → 415 même avec un header JS correct. Le
correctif de la veille ne touchait que le header JS, jamais consulté dans ce cas.
**Fix fiable** : `apps/mobile/src/api/uploads.ts` — nouvelle fonction `retag()` qui appelle `blob.slice(0, blob.size,
contentType)` (API standard `Blob.prototype.slice`, RN core) : crée une nouvelle vue sur les mêmes octets (pas de
copie) mais avec le type qu'on lui donne, qui devient alors ce que lit `map["type"]` côté natif — sur les deux
plateformes. `uploadImage`/`uploadVideo` envoient ce Blob retaggé au lieu du Blob brut.
**Vérifié en direct** : requête réelle observée par `wrangler tail` → `content-type: image/jpeg`, `201 Created` ;
diagnostic produit avec la miniature de la photo affichée dans "Ce que vous avez envoyé".

**Leçon retenue** : pour un bug rapporté « toujours là » après un fix, tester sur le device réel de l'utilisateur
(`adb`/`uiautomator2` + `wrangler tail` pour voir la requête HTTP réelle) plutôt que de se fier à une relecture de
code ou aux tests unitaires — ni l'un ni l'autre n'auraient attrapé ces deux causes (comportement spécifique du pont
natif Android/iOS, non simulable en Vitest/Node).

**Tests** : suite complète inchangée en nombre (155 : 66 shared + 48 api + 41 mobile — ces deux bugs sont dans des
mécanismes natifs non testables en Vitest) mais toutes vertes après les deux fixes. APK régénéré et testé sur
device (OPPO CPH2799) via `adb install -r`.

### Guide de réparation illustré — gel réseau, photo noire et schéma générique corrigés ✅ (2026-09-05, soir)

Toujours en session device branché : l'utilisateur, dans le guide de réparation, signale que la photo repère
s'affiche **entièrement noire** et que les schémas dessinés **« ne sont pas du tout parlants »**. Diagnostiqué en
direct (`adb`/`uiautomator2`, `wrangler tail --format json`, requêtes Neon directes via MCP) — trois causes
distinctes trouvées, dont une auto-infligée par les fixes du jour même.

**1. Gel infini de l'écran « Repair guide ».** En re-testant, `GET /diagnoses/:id/repair-guide` (pourtant déjà en
cache, donc censé être quasi instantané) est resté bloqué **plusieurs minutes**, sans qu'aucune requête n'atteigne
le Worker (`wrangler tail` muet malgré le spinner toujours animé — donc le thread JS n'était pas figé, seule une
promesse restait indéfiniment en attente). Cause : `fetch()` n'a **aucun délai par défaut** ; le rafraîchissement
d'access token ajouté plus tôt dans la journée (voir section précédente sur les déconnexions Google) appelle
`refreshAccessToken()` vers `api.stack-auth.com`, et si ce point réseau précis reste bloqué (jamais de réponse, ni
succès ni erreur), l'attente est **infinie** — la requête originale au Worker ne repart jamais.
**Fix** : nouveau `apps/mobile/src/lib/fetchTimeout.ts` (`fetchWithTimeout`, `AbortController`), appliqué aux
appels Stack Auth (`stackClient.ts`, `oauth.ts` — 15 s, ces appels sont censés être quasi instantanés) **et** en
filet de sécurité sur le client API principal (`client.ts` — 90 s, généreux exprès : un diagnostic IA peut
légitimement prendre « jusqu'à une minute »). Un appel bloqué échoue désormais proprement (retryable) au lieu de
geler l'écran pour toujours. Test pur : `apps/mobile/test/fetchTimeout.test.ts` (2 tests, fake timers).

**2. Photo repère entièrement noire.** Une fois le point 1 corrigé, cause trouvée : `expo-image` ne réessaie
**jamais** tout seul sur une image authentifiée — un jeton d'accès expiré au moment de l'ouverture de l'écran fait
échouer le chargement une fois, silencieusement (contrairement aux appels API JSON, qui ont déjà un
refresh-and-retry), et la photo reste vide **pour de bon**, cachée derrière l'effet « projecteur » qui assombrit
tout sauf le repère (donc un écran uniformément noir avec juste le cadre flottant). **Fix** :
`PhotoAnchorView.tsx` — `onError` déclenche un rafraîchissement de session (`authBridge.refresh()`) puis force un
nouvel essai (`key={attempt}` sur l'`<Image>`) ; en cas d'échec persistant, un **vrai état d'erreur** visible
(icône + « Photo indisponible » + « Appuyez pour réessayer », clés i18n FR/EN `repair.photoUnavailable*`) remplace
le cadre noir muet — plus jamais d'échec silencieux. **Vérifié en direct** : rebranché sur le diagnostic exact
signalé (piano, étape 2/5, repère « Rangée d'étouffoirs ») → la photo réelle s'affiche, boîte bien positionnée sur
la rangée d'étouffoirs, assombrissement fonctionnel — capture d'écran à l'appui.

**3. Schémas « pas du tout parlants ».** La silhouette générique `body: 'appliance'` (utilisée par la **majorité**
des scènes : inspect, clean, replace, reassemble, lift-out, pry, cool-down, open-panel, photo, wait, generic…)
dessinait un **lave-linge précis** (hublot rond + pieds + molette) — sur un piano, ça ne représente juste rien de
réel, pire, ça a l'air **faux**. `SceneIllustration.tsx#Body` : silhouette rendue **neutre** (rectangle arrondi à
deux zones, sans hublot ni pieds) — reste crédible pour n'importe quel objet réparé (meuble, instrument, vélo,
carte électronique…), le geste et la cible (reticle/flèche/outil, déjà corrects) restent le vrai vecteur
d'information. Purement visuel, aucun test cassé (`scenes.test.ts` ne couvre que `SCENE_SPECS`/`sceneForStep`, pas
le rendu). **Vérifié en direct** : étape « Sécuriser le piano » → rectangle neutre + flèche, plus de forme
d'électroménager incongrue.

**Tests** : 157 verts (66 shared + 48 api + 43 mobile, +2 pour `fetchTimeout`). APK régénéré, réinstallé et
revérifié en direct sur le device (OPPO CPH2799) pour les trois points.

## Réduction de la consommation des quotas Gemini ✅ (2026-09-06)

5 leviers, tous implémentés. Objectif : moins de **requêtes** (mur RPD/RPM du palier gratuit) et moins de
**tokens d'entrée** (photos).

1. **Photos redimensionnées avant l'upload** (`apps/mobile/src/api/uploads.ts`). `downscaleImage()` :
   `Image.getSize` → si le côté long > `MAX_IMAGE_EDGE` (1280 px), `expo-image-manipulator` (`manipulate().resize().renderAsync().saveAsync` JPEG q0.72). Best-effort : toute erreur ⇒ URI d'origine, un upload
   n'échoue jamais à cause du redimensionnement. Un capteur 4000 px (~1600 tokens image) tombe à ~1000 px
   (~400 tokens) ⇒ ~4× moins de tokens Gemini + upload plus léger. **Nouvelle dép native `expo-image-manipulator@~57.0.16`** ⇒ `expo prebuild` + rebuild APK nécessaires (pas de plugin config).
2. **Retry JSON économe** (`apps/api/src/providers/gemini.ts` `structured()`). a) `salvageJson()` : retire un bloc
   ` ```json ` / tronque à `{`…`}` et re-parse **localement** (0 requête) — rattrape le cas « modèle qui enrobe ».
   b) Si une vraie 2ᵉ requête est nécessaire, elle part en **texte seul** (`textOnlyParts()` filtre les
   `inline_data`/`file_data`) : le modèle corrige sa syntaxe, inutile de lui renvoyer les images. Tests :
   `apps/api/test/gemini.test.ts` (4).
3. **Repos de bascule partagé entre isolates** (`geminiFailover.ts` + KV `AI_STATE`). Sans ça, chaque isolate
   Worker neuf recrame une requête 429 sur le modèle préféré avant de basculer. `CooldownStore` optionnel
   (interface = sous-ensemble de `KVNamespace`) : `loadSharedCooldowns()` au début de `run()`, `persistCooldown()`
   quand l'état change. Absent en local/tests ⇒ comportement inchangé (cache module seul). `wrangler.toml` :
   `[[kv_namespaces]] binding = "AI_STATE"` (namespace `3b69ae05…` créé). Test : `geminiFailover.test.ts` (+1).
4. **Déduplication des diagnostics identiques** (`routes/diagnoses.ts` + `repos.recentDiagnoses()`). Empreinte
   `{description, category, imageIds triés, videoIds triés}` ; si un diagnostic identique existe depuis
   < `DEDUP_WINDOW_MS` (10 min) ⇒ renvoyé (HTTP 200, `deduplicated: true`), **sans** appel Gemini ni
   consommation de quota. Couvre le « Réessayer » client après un timeout réseau alors que le serveur avait
   déjà répondu, et le retour arrière + re-soumission. `RefineDiagnosis` concatène les précisions ⇒ empreinte
   différente, non impacté. Test : `diagnoses.test.ts` (+1).
5. **Gardes anti double-tap** : `StepCheck.tsx` (verrou `busy` couvrant la phase `capturePhoto()` asynchrone,
   sinon 2ᵉ tap = 2ᵉ appel `verify` vision) ; `RefineDiagnosis.tsx` (`submitted` ref avant `router.push`).

**Tests** : 163 verts (66 shared + 54 api + 43 mobile). `pnpm -r typecheck` + `pnpm lint` OK.
**Worker déployé** ✅ version `431bc954` (2026-09-06) — leviers 2/3/4 actifs en prod, `/health` OK.
**APK release** ✅ 2026-09-06 (2 builds ; le 2ᵉ inclut le fix session/MAJ, ~54 Mo arm64).
**Vérifié en direct sur device (OPPO CPH2799)** :
- levier 1 (redim. photo) : photo de piano stockée **112 Ko vs 845 Ko** avant (−87 %).
- levier 4 (dédup) : 2ᵉ diagnostic identique → **HTTP 200 / ~1 s vs 28 s**, 0 ligne créée, 0 appel Gemini.
- fix session : 2× `adb install -r` d'affilée → l'app **reste connectée** (avant : login à chaque MAJ).

## Session perdue à chaque mise à jour de l'app — corrigée ✅ (2026-09-06)

`expo-secure-store` (session + outbox) chiffre avec une clé AndroidKeyStore jamais sauvegardée. Le
manifeste avait `allowBackup=true` et **pas** de `android:dataExtractionRules` (Android 12+ ; device
en Android 16). Les SharedPreferences `SecureStore` étaient donc restaurables → clé ≠ chiffré →
`BadPaddingException` → `getItemAsync` renvoie `null` → écran de login à chaque MAJ (mais pas à un
simple redémarrage). Fix : `app.config.ts` → `android.allowBackup = false` + re-`expo prebuild`
(pose `dataExtractionRules` excluant `SecureStore` de cloud-backup + device-transfer) ;
`AuthProvider` : `getItemAsync().catch(() => null)` au démarrage. Commit `0e39696`. ⚠️ Un vrai
uninstall/réinstall demandera toujours une reconnexion (normal).

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
