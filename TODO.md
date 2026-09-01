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
- ✅ Bouton vidéo = **SOON** (déjà en place PHASE 2)
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

## PHASE 8 — INTERACTIVE REPAIR ⏸️ V2

- ⏸️ `repair_sessions`, `AIProvider.verifyStep`, boucle Step → Photo → Vérif IA → Step suivant

## PHASE 9 — VIDEO ⏸️ V3

- ⏸️ Capture vidéo, extraction frames, audio, analyse multimodale (jamais simulé)

## PHASE 10 — POLISH ⏳/⏸️

- ⏳ Animations, gestion d'erreurs, accessibilité, onboarding, perfs, états de chargement

---

## Backlog transverse

- ⏸️ `ProductIdentificationService` (bases externes)
- ⏸️ `KnowledgeProvider` (manuels fabricants, docs sous licence)
- ⏸️ `PartsProvider` (prix/dispo réels)
- ⏸️ `AnalyticsClient` (PostHog ou équivalent)
- ⏸️ `BillingClient` / RevenueCat (FREE/PREMIUM)
- ⏳ CI GitHub Actions (lint + typecheck + tests) — dès PHASE 2
- ⏳ EAS Build / dev client — avant distribution

---

## Rituel de fin de phase (rappel)

1. Expliquer → implémenter → tester → corriger → vérifier démarrage
2. MAJ `TODO.md` + indiquer ce qui marche vraiment / ce qui reste
3. `git commit` + `git push` vers `git@github.com:Ichigo35/FixIt_AI.git`
4. MAJ `CLAUDE.md` + mémoire
