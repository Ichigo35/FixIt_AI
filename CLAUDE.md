# FixIt AI — contexte projet (pour Claude)

> Spécifications produit complètes : voir le brief FixIt AI (concept, sécurité, écrans, phases).
> Ce fichier suit **les décisions, l'état réel et les écarts** par rapport au brief d'origine.

## Écarts assumés vs brief d'origine

| Brief d'origine | Décision retenue | Raison |
|-----------------|------------------|--------|
| Supabase (DB / Storage / Edge Functions / Auth) | **Neon** (Postgres) + **Cloudflare Workers** (Hono) + **R2** + **Neon Auth** | Consigne utilisateur |
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
| 1 — Audit | ✅ terminée · commit `5c556a4` · push OK (2026-08-31) |
| 2 — Foundation | ⏳ prochaine (en attente feu vert utilisateur) |
| 3–10 | ⏳ voir `TODO.md` |

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
