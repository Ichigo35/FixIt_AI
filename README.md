# FixIt AI

> **What's wrong? Let's figure it out.**

Assistant mobile de diagnostic et de réparation par IA. L'utilisateur photographie ou décrit un
problème (électroménager, meuble, informatique, véhicule, plomberie, objet du quotidien…) et FixIt AI
renvoie un diagnostic structuré, un score de réparabilité, une classification du risque et un guide
de réparation étape par étape — ou une recommandation claire de faire appel à un professionnel.

## Recommandation finale (toujours affichée)

| Badge | Signification |
|-------|---------------|
| 🟢 **DIY** | You can probably fix this |
| 🟡 **CAUTION** | Possible DIY with experience |
| 🔴 **PROFESSIONAL** | Don't attempt this yourself |

## Principe de sécurité

La sécurité prime sur l'expérience utilisateur. L'app ne présente jamais un diagnostic comme certain
quand les données sont insuffisantes, et une couche de classification du risque **déterministe**
(indépendante du texte généré par l'IA) peut forcer un arrêt :

```
LOW · MEDIUM · HIGH · CRITICAL
```

Sujets à escalade automatique : électricité secteur, gaz, haute tension, batteries lithium
endommagées, systèmes sous pression, produits chimiques, incendie, structures porteuses, freins et
systèmes critiques d'un véhicule.

## Stack

| Couche | Choix |
|--------|-------|
| Mobile | React Native + Expo (SDK 57) + TypeScript + Expo Router |
| Backend | Cloudflare Workers (Hono) — détient tous les secrets |
| IA | Google Gemini via abstraction `AIProvider` (OpenAI / Anthropic ajoutables) |
| Base de données | Neon (PostgreSQL serverless) + Drizzle ORM |
| Stockage images | Cloudflare R2 (uploads pré-signés) |
| Auth | Neon Auth (à valider) |
| Domaine | Cloudflare |

> Aucune clé API secrète n'est embarquée dans l'app mobile. Tout appel IA passe par le Worker.

## Structure du dépôt (monorepo pnpm)

```
apps/
  mobile/     Application Expo
  api/        Cloudflare Worker (API + pipeline IA + sécurité)
packages/
  shared/     Types, schémas Zod, SafetyClassifier, RepairabilityScore (déterministes)
```

## Démarrage

```bash
pnpm install
pnpm api            # Worker local (wrangler dev) -> http://localhost:8788
pnpm mobile         # Expo (Metro)
pnpm -r test        # tests (shared + api)
pnpm -r typecheck   # TypeScript
pnpm lint           # ESLint
```

Secrets : copier `.env.example` et renseigner `apps/api/.dev.vars` (jamais committé) —
`GEMINI_API_KEY`, `DATABASE_URL` (Neon).

## État du projet

**PHASES 1–7 terminées — le MVP est fonctionnel de bout en bout.**
Auth **Neon Auth (Stack)**, persistance **PostgreSQL/Neon** (Drizzle), images **R2**,
quota **FREE 3/mois**. Parcours complet : sign-in → photo/texte → upload → diagnostic
**Gemini** structuré → sécurité déterministe (écran **STOP** si danger) → guide pas-à-pas
→ historique **« My Repairs »** rouvrable, feedback 👍/👎, avant/après.
43 tests verts (API en intégration contre Neon).
Prochaines étapes : **PHASE 10 — POLISH** (le MVP est là ; 8 et 9 sont V2/V3). Voir `TODO.md`.

## Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — architecture, pipeline IA, modèle de données, sécurité
- [`TODO.md`](./TODO.md) — plan de développement par phases
- [`.env.example`](./.env.example) — variables d'environnement requises
