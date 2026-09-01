# FixIt AI — contexte projet (pour Claude)

> Spécifications produit complètes : voir le brief FixIt AI (concept, sécurité, écrans, phases).
> Ce fichier suit **les décisions, l'état réel et les écarts** par rapport au brief d'origine.

## Écarts assumés vs brief d'origine

| Brief d'origine | Décision retenue | Raison |
|-----------------|------------------|--------|
| Supabase (DB / Storage / Edge Functions / Auth) | **Neon** (Postgres + **Object Storage** S3) + **Cloudflare Workers** (Hono) + **Neon Auth** | Consigne utilisateur. R2 abandonné (activation exigeait une carte bancaire) → Neon Object Storage. |
| OpenAI / Anthropic en priorité | **Google Gemini** (`gemini-3.6-flash`) via abstraction `AIProvider` | Clé gratuite fournie par l'utilisateur |
| Vercel | **Cloudflare Workers** (domaine custom abandonné, `.workers.dev` suffit) | Consigne utilisateur |
| — | Monorepo **pnpm** : `apps/mobile`, `apps/api`, `packages/shared` | Partage types + logique déterministe |

Inchangé : mobile en **React Native + Expo + TypeScript + Expo Router**.

## Décisions

- **Auth** : **Neon Auth (Stack)** branché en PHASE 6 (email/password + **OAuth Google** mobile via code+PKCE, rebond Worker `/auth/callback`). Le Worker vérifie le JWT (JWKS + `jose`).
- **Clé Gemini** : fournie par l'utilisateur, stockée dans `.dev.vars` (gitignore) + secret Worker. Jamais committée, jamais en clair dans la mémoire.
- **Sécurité applicative** : `SafetyClassifier` + `RepairabilityScore` déterministes dans `packages/shared`, autorité **côté serveur uniquement** ; le classifier ne peut que durcir la reco IA.
- **Isolation par utilisateur** : filtrage explicite `WHERE user_id =` dans chaque requête du Worker + tests d'intégration d'isolation. **RLS Postgres écartée** (driver `neon-http` sans transaction → pas de GUC par requête ; tous les rôles Neon ont `BYPASSRLS` non retirable).
- **Durcissement Worker** : `secureHeaders`, `bodyLimit`, rate limiting Cloudflare `[[ratelimits]]`.

## État

**MVP (phases 1–7) : ✅ fonctionnel de bout en bout.** Détail par phase dans `TODO.md`.
- 1 Audit · 2 Foundation (monorepo) · 3 Camera (`POST /uploads`) · 4 Diagnosis (Gemini + STOP) ·
  5 Repair guide (pas-à-pas) · 6 Neon + Auth + persistance Postgres + quota · 7 History (`My Repairs`, feedback).

**Post-MVP : ✅**
- **PHASE 8 Réparation interactive** : `AIProvider.verifyStep` (Gemini vision + Mock déterministe), table `repair_sessions` (Neon, migration `0001`), routes `POST/GET /diagnoses/:id/repair-session` + `.../verify` (autorité serveur : `current_step` n'avance que sur verdict `pass`), `StepCheck` mobile intégré à chaque étape du guide.
- **PHASE 10 — 3e passe** : file de retry hors-ligne (`src/lib/outboxQueue.ts` + `OutboxProvider`), i18n FR/EN (`src/i18n/`, `expo-localization`, accueil/history/auth convertis), empty states illustrés (`IconMedallion`), transitions d'écran via `react-native-screens` (reanimated écarté : rebuild natif requis). 88 tests.
- **OAuth Google (mobile)** : `src/auth/oauth.ts` (code d'autorisation + PKCE via `expo-web-browser`/`expo-crypto`), Worker `GET /auth/callback` (rebond https → `fixitai://oauth`), `AuthProvider.signInWithGoogle`. Clés Google partagées de Stack (dev) ; identifiants propres à poser pour la prod.
- **PHASE 10 Polish (2 passes)** : erreurs centralisées (`lib/errors.ts`), `LoadingState`/`ErrorState`/`EmptyState`, `ErrorBoundary`, onboarding, animations `Animated` natives (`FadeInView`, meter), a11y, `history` en `FlatList` · puis `expo-haptics`, skeletons, pull-to-refresh, `OfflineBanner`+`ConnectivityProvider`.
- **CI** : `.github/workflows/ci.yml` (lint + typecheck + tests sur push/PR `main`), secret `DATABASE_URL` posé, runs verts.
- **Storage** : R2 → **Neon Object Storage** (S3, `aws4fetch`), abstraction `apps/api/src/storage/`.
- **Déploiement** : **Worker prod live** `https://fixit-ai-api.ichigo35.workers.dev` — `APP_ENV=production`, 4 secrets, `/health` OK, E2E authentifié (upload/get/403/delete) vérifié en prod.
- **Sécurité** : `secureHeaders` + `bodyLimit` + rate limiting Cloudflare. RLS écartée (voir Décisions).
- **55 tests** (26 shared + 9 mobile + 20 api). Base Neon vierge (prête pour de vrais utilisateurs).

**À faire :** PHASE 9 (vidéo) = V3 · build/EAS mobile (nécessaire pour tester OAuth : Expo Go ne gère pas le schéma natif) · identifiants Google OAuth propres pour la prod · reanimated (si rebuild natif) · i18n sur les écrans restants.

## Infra provisionnée

- **Neon** : projet `fixit-ai` = `winter-union-90877282` (org `org-sweet-tooth-50877405`, aws-us-east-2, PG 17). `DATABASE_URL` dans `apps/api/.dev.vars` + secret Worker. Branche `br-rough-feather-a5r1cdyr`. Tables : `app_users`, `diagnoses`, `diagnosis_images`, `repair_guides`, `repair_history`, `repair_sessions` + `neon_auth.users_sync`. Migrations Drizzle dans `apps/api/drizzle/`. Driver = `drizzle-orm/neon-http` (HTTP, **sans transaction**). Colonnes `r2_key*` = anciens noms, contenu = clés Neon Object Storage.
- **Neon Auth (Stack)** : projet Stack `3432abc2-2b77-4b7b-acff-0686a7b99697`. `STACK_PROJECT_ID` / `STACK_JWKS_URL` / `STACK_PUBLISHABLE_KEY` dans `wrangler.toml [vars]` (publics) et `apps/mobile/app.config.ts extra`. Email/password + **OAuth Google** (clés partagées Stack en dev — `list_auth_oauth_providers` = `shared`). Domaine de confiance `https://fixit-ai-api.ichigo35.workers.dev` (redirect OAuth). Worker vérifie le JWT via JWKS (`jose`). Endpoints OAuth Stack : `GET /api/v1/auth/oauth/authorize/google` (params `client_id`=projectId, `client_secret`=publishable key, `redirect_uri`, `response_type=code`, `scope`, `state`, `code_challenge`+`_method=S256`) → `POST /api/v1/auth/oauth/token` (`grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`).
- **Gemini** : clé dans `apps/api/.dev.vars` (`GEMINI_API_KEY`), modèle **`gemini-3.6-flash`** (`gemini-2.5-flash` retiré par Google). Appel REST `generateContent` + `responseSchema`. Sans clé → `MockProvider`.
- **Neon Object Storage (S3)** : bucket `fixit-ai-images` (private) sur la branche `br-rough-feather-a5r1cdyr`. Endpoint `https://br-rough-feather-a5r1cdyr.storage.c-1.us-east-2.aws.neon.tech`, région `us-east-2`, path-style. Credential `fixit-api-worker-rw` (scopes `storage:read`+`storage:write` — `write` seul **ne suffit pas** en beta malgré la doc). Clés S3 dans `.dev.vars` + secrets Worker `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`. Client : `apps/api/src/storage/` (`aws4fetch`, SigV4). `getStorage(env)` : `env.STORAGE` (tests) sinon client S3. Palier gratuit 5 Go/compte (beta).
- **Cloudflare Worker** : `fixit-ai-api` déployé sur `https://fixit-ai-api.ichigo35.workers.dev` (compte `tcha.jimmy@gmail.com` = `34cf747a1eaf3858a49e4fafaf9580e0`). `wrangler` déjà loggé. Secrets posés : `GEMINI_API_KEY`, `DATABASE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Redéployer : `pnpm --filter @fixit/api run deploy` (le `run` est obligatoire — `pnpm deploy` est une sous-commande pnpm). `APP_ENV=production` dans `wrangler.toml [vars]` (désactive le bypass `x-dev-user-id`) ; `apps/api/.dev.vars` remet `APP_ENV=development` en local.
- **Hébergement : Cloudflare uniquement — jamais Vercel.** Domaine custom abandonné (consigne utilisateur) ; `fixit-ai-api.ichigo35.workers.dev` reste l'URL de l'API.
- **Rate limiting** : `[[ratelimits]]` dans `wrangler.toml` (`DIAGNOSE_RL` 8/min/user, `UPLOAD_RL` 40/min/user), middleware `apps/api/src/middleware/rateLimit.ts`. Bindings absents en local/tests → no-op.
- Tests API = **intégration contre Neon réel** (lisent `apps/api/.dev.vars`, `describe.runIf(hasDb)`, users `test-*` nettoyés en `afterAll`). En CI le secret `DATABASE_URL` fait tourner ces tests (mock Gemini). Le stockage utilise `memoryStorage` (aucun secret S3 requis).
- Tests mobile = **Vitest sur modules purs uniquement** (`apps/mobile/vitest.config.ts`, env node, alias `@`). Pas de rendu RN. Garder les helpers testables hors Expo (ex. `ApiError` isolé dans `src/api/ApiError.ts`).

## Commandes

`pnpm api` (wrangler dev :8788) · `pnpm mobile` (Expo) · `pnpm -r test` · `pnpm -r typecheck` · `pnpm lint`
Port API dev = **8788** (8787 occupé par un autre projet local de l'utilisateur).

## Environnement (machine utilisateur, audit 2026-08-31)

Node 26.5 · pnpm 11.13 · bun 1.3.14 · Expo 57 · Git 2.50 · Xcode 26.6 · Android SDK présent (ANDROID_HOME non défini) · CocoaPods 1.17 · gh 2.97 · wrangler 4.127 (via npx) · watchman absent · EAS absent.
GitHub : compte `Ichigo35`, SSH OK, `gh` authentifié (scopes `repo`/`workflow`). Dépôt `Ichigo35/FixIt_AI` (privé). `wrangler` loggé (`tcha.jimmy@gmail.com`).
⚠️ Disque à 95 % (~12 Gio libres) — surveiller avec les builds RN/iOS. EAS non installé.
ℹ️ Résolution DNS locale intermittente le 2026-08-31 (routeur 192.168.18.1). Si `git push` échoue sur « Could not resolve hostname github.com » → réessayer.

## Rituel de fin de phase

1. Expliquer → implémenter → tester → corriger → vérifier démarrage
2. MAJ `TODO.md` (ce qui marche vraiment / ce qui reste)
3. `git commit` + `git push` → `git@github.com:Ichigo35/FixIt_AI.git`
4. MAJ ce `CLAUDE.md` + mémoire
5. Ne pas passer à la phase suivante avec des erreurs critiques non résolues. Aucune fonctionnalité fictive.

## Langue

Répondre en français.
