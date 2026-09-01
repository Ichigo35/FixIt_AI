# FixIt AI — contexte projet (pour Claude)

> Spécifications produit complètes : voir le brief FixIt AI (concept, sécurité, écrans, phases).
> Ce fichier suit **les décisions, l'état réel et les écarts** par rapport au brief d'origine.

## Écarts assumés vs brief d'origine

| Brief d'origine | Décision retenue | Raison |
|-----------------|------------------|--------|
| Supabase (DB / Storage / Edge Functions / Auth) | **Neon** (Postgres + **Object Storage** S3) + **Cloudflare Workers** (Hono) + **Neon Auth** | Consigne utilisateur. R2 abandonné (activation exigeait une carte bancaire) → Neon Object Storage. |
| OpenAI / Anthropic en priorité | **Google Gemini** (`gemini-2.5-flash`) via abstraction `AIProvider` | Clé gratuite fournie par l'utilisateur |
| Vercel | **Cloudflare** (Workers + domaine) | Consigne utilisateur |
| — | Monorepo **pnpm** : `apps/mobile`, `apps/api`, `packages/shared` | Partage types + logique déterministe |

Inchangé : mobile en **React Native + Expo + TypeScript + Expo Router**.

## Décisions

- **Auth** : anonyme (device ID) au MVP → **Neon Auth** branché en PHASE 6 (email + OAuth, RLS en défense en profondeur).
- **Clé Gemini** : fournie par l'utilisateur, stockée dans `.dev.vars` (gitignore). Jamais committée, jamais en clair dans la mémoire.
- **Sécurité** : `SafetyClassifier` + `RepairabilityScore` déterministes dans `packages/shared`, la validation de sécurité fait autorité **côté serveur uniquement**. Le classifier ne peut que durcir la reco de l'IA.

## État des phases

| Phase | État |
|-------|------|
| 1 — Audit | ✅ terminée · push OK (2026-08-31) |
| 2 — Foundation | ✅ monorepo pnpm, shared+api+mobile, push OK |
| 3 — Camera | ✅ expo-camera + image-picker + `POST /uploads` → R2, push OK |
| 4 — Diagnosis | ✅ AIProvider/Gemini + `POST /diagnoses` + safety repensé + écran résultat + STOP, push OK |
| 5 — Repair guide | ✅ `GET /diagnoses/:id/repair-guide` + `RepairGuideView` pas-à-pas, push OK |
| 6 — Neon + Auth + Storage | ✅ Neon Auth (Stack), Drizzle, persistance Postgres, quota, auth mobile, push OK |
| 7 — History | ✅ `My Repairs`, détail rouvrable, `POST /diagnoses/:id/history`, avant/après, feedback 👍/👎, 43 tests, push OK |
| 8 — Interactive repair | ⏳ V2 (voir `TODO.md`) |
| 9 — Video | ⏳ V3 |
| 10 — Polish | ✅ 1re passe : erreurs centralisées (`lib/errors.ts`), `LoadingState`/`ErrorState`/`EmptyState`, `ErrorBoundary`, onboarding (3 écrans + `OnboardingProvider`), animations `Animated` natives (`FadeInView`, meter, press), a11y, `history` en FlatList, **9 tests mobile (Vitest)**. Push OK |
| CI | ✅ `.github/workflows/ci.yml` (lint + typecheck + tests sur push/PR `main`), secret `DATABASE_URL` posé, run vert |
| Storage swap | ✅ R2 → **Neon Object Storage** (S3, `aws4fetch`), abstraction `src/storage/`, 53 tests. Push OK |
| Déploiement | ✅ **Worker prod live** : `https://fixit-ai-api.ichigo35.workers.dev` — `APP_ENV=production`, 4 secrets posés, `/health` OK, E2E authentifié (upload/get/403/delete) vérifié en prod |

## Infra provisionnée

- **Neon** : projet `fixit-ai` = `winter-union-90877282` (org `org-sweet-tooth-50877405`, aws-us-east-2, PG 17). `DATABASE_URL` dans `apps/api/.dev.vars`. Branche `br-rough-feather-a5r1cdyr`. Tables : `app_users`, `diagnoses`, `diagnosis_images`, `repair_guides`, `repair_history` + `neon_auth.users_sync`. Migrations Drizzle dans `apps/api/drizzle/`.
- **Neon Auth (Stack)** : projet Stack `3432abc2-2b77-4b7b-acff-0686a7b99697`. `STACK_PROJECT_ID` / `STACK_JWKS_URL` / `STACK_PUBLISHABLE_KEY` dans `wrangler.toml [vars]` (publics) et `apps/mobile/app.config.ts extra`. Email/password activé, pas d'OAuth mobile encore. Worker vérifie le JWT via JWKS (`jose`).
- **Gemini** : clé dans `apps/api/.dev.vars` (`GEMINI_API_KEY`), modèle **`gemini-3.6-flash`** (`gemini-2.5-flash` retiré par Google). Appel REST `generateContent` + `responseSchema`. Sans clé → `MockProvider`.
- **Neon Object Storage (S3)** : bucket `fixit-ai-images` (private) sur la branche `br-rough-feather-a5r1cdyr`. Endpoint `https://br-rough-feather-a5r1cdyr.storage.c-1.us-east-2.aws.neon.tech`, région `us-east-2`, path-style. Credential `fixit-api-worker-rw` (scopes `storage:read`+`storage:write` — `write` seul **ne suffit pas** en beta malgré la doc). Clés S3 dans `.dev.vars` + secrets Worker `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`. Client : `apps/api/src/storage/` (`aws4fetch`, SigV4). `getStorage(env)` : `env.STORAGE` (tests) sinon client S3. Palier gratuit 5 Go/compte (beta).
- **Cloudflare Worker** : `fixit-ai-api` déployé sur `https://fixit-ai-api.ichigo35.workers.dev` (compte `tcha.jimmy@gmail.com` = `34cf747a1eaf3858a49e4fafaf9580e0`). `wrangler` déjà loggé. Secrets posés : `GEMINI_API_KEY`, `DATABASE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Redéployer : `pnpm --filter @fixit/api deploy`. `APP_ENV=production` dans `wrangler.toml [vars]` (désactive le bypass `x-dev-user-id`) ; `apps/api/.dev.vars` remet `APP_ENV=development` en local.
- **Domaine / DNS / hébergement : Cloudflare uniquement — jamais Vercel.** (domaine custom pas encore branché ; le `.workers.dev` suffit pour l'instant.)
- Tests API = **intégration contre Neon réel** (lisent `apps/api/.dev.vars`, `describe.runIf(hasDb)`, users `test-*` nettoyés en `afterAll`). Le stockage utilise `memoryStorage` (aucun secret S3 requis en CI).
- Tests mobile = **Vitest sur modules purs uniquement** (`apps/mobile/vitest.config.ts`, env node, alias `@`). Pas de rendu RN. Garder les helpers testables hors Expo (ex. `ApiError` isolé dans `src/api/ApiError.ts`).

## Commandes

`pnpm api` (wrangler dev :8788) · `pnpm mobile` (Expo) · `pnpm -r test` · `pnpm -r typecheck` · `pnpm lint`
Port API dev = **8788** (8787 occupé par un autre projet local de l'utilisateur).

## Environnement (machine utilisateur, audit 2026-08-31)

Node 26.5 · pnpm 11.13 · bun 1.3.14 · Expo 57 · Git 2.50 · Xcode 26.6 · Android SDK présent (ANDROID_HOME non défini) · CocoaPods 1.17 · gh 2.97 · wrangler 4.127 (via npx) · watchman absent · EAS absent.
GitHub : compte `Ichigo35`, SSH OK. Dépôt `Ichigo35/FixIt_AI` (privé, vide au départ).
⚠️ Disque à 95 % (~12 Gio libres) — surveiller avec les builds RN/iOS.
ℹ️ Résolution DNS locale intermittente le 2026-08-31 (routeur 192.168.18.1). Si `git push` échoue sur « Could not resolve hostname github.com » → réessayer.

## Rituel de fin de phase

1. Expliquer → implémenter → tester → corriger → vérifier démarrage
2. MAJ `TODO.md` (ce qui marche vraiment / ce qui reste)
3. `git commit` + `git push` → `git@github.com:Ichigo35/FixIt_AI.git`
4. MAJ ce `CLAUDE.md` + mémoire
5. Ne pas passer à la phase suivante avec des erreurs critiques non résolues. Aucune fonctionnalité fictive.

## Langue

Répondre en français.
