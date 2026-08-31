# FixIt AI — TODO / Plan de développement

Légende : ✅ fait · 🚧 en cours · ⏳ à faire · ⏸️ reporté V2/V3

---

## PHASE 1 — AUDIT ✅

- ✅ Inspection environnement (Node 26, pnpm 11, bun 1.3, Expo 57, Git, Xcode 26.6, Android SDK, gh, wrangler)
- ✅ Vérification accès SSH GitHub (`Ichigo35`), dépôt distant `Ichigo35/FixIt_AI` (privé, vide)
- ✅ `README.md`, `ARCHITECTURE.md`, `TODO.md`, `.env.example`
- 🚧 **Validation de l'architecture par l'utilisateur** ← ON EST ICI
- ⏳ `git init` + premier commit + push (après validation)

---

## PHASE 2 — FOUNDATION ⏳

- ⏳ Monorepo pnpm (`apps/mobile`, `apps/api`, `packages/shared`)
- ⏳ `apps/mobile` : Expo + TS + Expo Router, navigation, thème (clair/sombre), tokens
- ⏳ Composants de base (Button, Card, Badge risque/difficulté, Screen, etc.)
- ⏳ `apps/api` : Worker Hono + wrangler, route `GET /health`
- ⏳ `packages/shared` : types, schémas Zod, constantes, squelettes `SafetyClassifier` / `RepairabilityScore`
- ⏳ ESLint + Prettier + tsconfig partagés, Vitest
- ⏳ Écran d'accueil : titre, sous-titre, 4 actions (Take photo / Record video [bientôt] / Describe / Upload)
- ⏳ Vérifier `expo start` et `wrangler dev`

---

## PHASE 3 — CAMERA ⏳

- ⏳ `expo-camera` + permissions, prise de photo, preview
- ⏳ `expo-image-picker` (upload depuis galerie)
- ⏳ Champ description « What happened? »
- ⏳ Upload pré-signé vers R2 (`POST /uploads`)
- ⏳ Bouton vidéo présent mais marqué « Coming soon »

---

## PHASE 4 — DIAGNOSIS ⏳

- ⏳ `AIProvider` + `GeminiProvider` (vision + `responseSchema`)
- ⏳ `POST /diagnoses` : pipeline complet
- ⏳ Validation Zod + retry/réparation JSON
- ⏳ `SafetyClassifier` déterministe (LOW/MEDIUM/HIGH/CRITICAL, forcedStop)
- ⏳ `computeRepairabilityScore`
- ⏳ Écran résultat : problème, confiance, causes, sévérité, difficulté, temps, coût, recommandation 🟢🟡🔴
- ⏳ Écran « STOP — Contact a professional » si `forcedStop`
- ⏳ Tests des 5 scénarios (câble électrique → STOP)

---

## PHASE 5 — REPAIR GUIDE ⏳

- ⏳ `POST /diagnoses/:id/repair-guide` (étapes, outils, pièces, avertissements)
- ⏳ Écran guide pas-à-pas (1 étape / écran, [Continue])
- ⏳ Sections TOOLS / PARTS / OPTIONAL
- ⏳ Pièce requise + prix `$x–y` ou « Price unavailable »
- ⏳ Encadrés ⚠ SAFETY par étape

---

## PHASE 6 — NEON + AUTH + STORAGE ⏳

- ⏳ Projet Neon + Drizzle schema + migrations
- ⏳ Auth (Neon Auth — à confirmer), `POST /auth/session`, JWT
- ⏳ Isolation par `user_id` + policies RLS en défense en profondeur
- ⏳ R2 bucket + suppression images sur `DELETE /diagnoses/:id`
- ⏳ Quota FREE 3/mois
- ⏳ Tests isolation / quota / auth

---

## PHASE 7 — HISTORY ⏳

- ⏳ `GET /diagnoses` paginé, écran « My Repairs »
- ⏳ Détail rouvrable
- ⏳ Avant / après + « Problem solved 🎉 »
- ⏳ Feedback 👍 / 👎 + « What happened? »

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
