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

## Démarrage (après PHASE 2)

```bash
pnpm install
pnpm --filter api dev          # Worker local (wrangler dev)
pnpm --filter mobile start     # Expo
```

## État du projet

**PHASE 1 — AUDIT terminée.** Aucune application n'est encore implémentée.
Voir `TODO.md` pour l'avancement et `ARCHITECTURE.md` pour le détail technique.

## Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — architecture, pipeline IA, modèle de données, sécurité
- [`TODO.md`](./TODO.md) — plan de développement par phases
- [`.env.example`](./.env.example) — variables d'environnement requises
