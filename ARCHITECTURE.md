# FixIt AI — Architecture

## 1. Vue d'ensemble

```
┌─────────────────────────────┐
│  Mobile (Expo / RN / TS)    │   Aucune clé secrète
│  UI → Hooks → Services API  │
└──────────────┬──────────────┘
               │  HTTPS (JWT)
┌──────────────▼──────────────┐
│  Cloudflare Worker (Hono)   │   Détient GEMINI_API_KEY, DB, R2
│                             │
│  Auth ─ Rate limit ─ Quota  │
│  Pipeline de diagnostic     │
│  SafetyClassifier (déterm.) │
│  RepairabilityScore (déterm)│
└───┬─────────┬───────────┬───┘
    │         │           │
┌───▼───┐ ┌───▼────┐ ┌────▼─────┐
│ Neon  │ │  R2    │ │  Gemini  │
│ (PG)  │ │ images │ │  API     │
└───────┘ └────────┘ └──────────┘
```

Séparation stricte des responsabilités :

```
UI  →  Hooks  →  Services  →  API client
                                  │
                    Worker: Route → Service → AIProvider → Gemini
                                              KnowledgeProvider (V2)
                                              SafetyClassifier (déterministe)
```

## 2. Monorepo

| Package | Rôle |
|---------|------|
| `apps/mobile` | Expo Router, écrans, composants, thème, appels API |
| `apps/api` | Worker Hono : routes REST, pipeline IA, auth, quotas, migrations |
| `packages/shared` | Source de vérité partagée : types TS, schémas **Zod**, `SafetyClassifier`, `computeRepairabilityScore`, constantes (catégories, niveaux de risque, difficulté) |

`packages/shared` ne contient **aucun** accès réseau — logique pure, testable, réutilisée des deux côtés.
La validation de sécurité fait autorité **uniquement côté serveur**.

## 3. Abstraction IA

```
AIProvider (interface)
├── GeminiProvider      ← MVP (google-generativeai / REST)
├── OpenAIProvider      ← stub, non implémenté
└── AnthropicProvider   ← stub, non implémenté
```

Interface cible :

```ts
interface AIProvider {
  diagnose(input: DiagnosisInput): Promise<RawDiagnosis>;   // vision + texte → JSON structuré
  generateRepairGuide(d: Diagnosis): Promise<RepairGuide>;
  // V2 : verifyStep(stepId, image) : Promise<StepVerification>
}
```

- Modèle par défaut : `gemini-2.5-flash` (vision + sortie JSON contrainte via `responseSchema`).
- Sortie **toujours** validée par Zod. En cas d'échec : 1 tentative de réparation, sinon erreur
  propre côté client (« More information is needed »).
- Le provider ne renvoie jamais directement à l'utilisateur : passage obligatoire par le
  `SafetyClassifier` puis `RepairabilityScore`.

## 4. Pipeline de diagnostic (Worker)

```
1. POST /diagnoses           { imageIds[], description, brand?, model?, category? }
2. Vérif auth + quota (FREE = 3 / mois)
3. Récupération des images depuis R2
4. AIProvider.diagnose()  → RawDiagnosis (JSON)
5. Validation Zod
6. SafetyClassifier(rawDiagnosis, description, category)  → riskLevel + override éventuel
       CRITICAL / PROFESSIONAL  →  on tronque le guide, message d'arrêt
7. computeRepairabilityScore(diagnosis)  → 0..100 + libellé
8. Persistance Neon (diagnoses, diagnosis_images)
9. Réponse : Diagnosis complet
10. (à la demande) POST /diagnoses/:id/repair-guide  → étapes
```

### SafetyClassifier (déterministe, indépendant du texte IA)

Entrées : catégorie, mots-clés de la description, champs du diagnostic (`severity`,
`needsProfessional`), listes de motifs à risque (regex : « mains voltage », « gas », « brake »,
« lithium »…).

Sortie :

```ts
type SafetyResult = {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: 'DIY' | 'CAUTION' | 'PROFESSIONAL';
  forcedStop: boolean;       // true → pas de guide, écran « STOP — Contact a professional »
  reasons: string[];
};
```

Règle : le classifier ne peut que **durcir** la recommandation de l'IA, jamais l'assouplir.

### RepairabilityScore (déterministe)

Pondération sur : difficulté, nb d'outils, nb d'étapes, disponibilité probable des pièces,
niveau de danger, risque d'aggravation, expérience requise. Renvoie `{ score: number, label: string }`.

## 5. Modèle de données (Neon / PostgreSQL)

```
users
  id (uuid, pk)         auth_provider_id      email
  plan ('free'|'premium')     diagnoses_used_this_period      period_started_at
  created_at

diagnoses
  id (uuid, pk)         user_id (fk → users)
  category    brand    model    serial_number
  user_description
  problem      confidence (numeric)      severity
  risk_level   recommendation    needs_professional (bool)   forced_stop (bool)
  possible_causes (jsonb)        repairability_score (int)    repairability_label
  estimated_time_min   estimated_cost_min   estimated_cost_max   cost_currency
  ai_provider   ai_model   raw_response (jsonb)
  status ('open'|'fixed'|'pro_recommended'|'abandoned')
  created_at   updated_at

diagnosis_images
  id (uuid, pk)   diagnosis_id (fk)   r2_key   kind ('problem'|'label'|'before'|'after'|'step')
  width  height  content_type   created_at

repair_steps
  id (uuid, pk)   diagnosis_id (fk)   index (int)   title   instruction
  safety_warning (nullable)   tools (jsonb)   parts (jsonb)   image_r2_key (nullable)

repair_sessions            -- V2 (réparation interactive)
  id (uuid, pk)   diagnosis_id (fk)   current_step_index   state (jsonb)   started_at   completed_at

repair_history
  id (uuid, pk)   diagnosis_id (fk)   user_id (fk)
  outcome ('fixed'|'not_fixed'|'pro')   before_image_r2_key   after_image_r2_key
  feedback_worked (bool)   feedback_note   summary   created_at
```

### Row Level Security / isolation

Neon Postgres : l'accès passe par le Worker qui filtre systématiquement par `user_id` extrait du
JWT vérifié. Si Neon Auth + Data API sont activés, on ajoute des policies RLS
(`user_id = auth.user_id()`) en défense en profondeur. Un utilisateur ne peut jamais lire le
diagnostic d'un autre.

### Stockage images (R2)

- Upload : le mobile demande une URL pré-signée `POST /uploads` → PUT direct vers R2.
- Clé : `users/{userId}/diagnoses/{diagnosisId}/{uuid}.jpg`.
- Suppression : `DELETE /diagnoses/:id` supprime lignes + objets R2 associés.
- Rétention : purge configurable (par défaut : conservation jusqu'à suppression par l'utilisateur ;
  option d'auto-suppression après N jours). Aucune image utilisée pour de l'entraînement sans
  consentement explicite.

## 6. API (v1) — esquisse

```
POST   /auth/session                 échange token provider → JWT app
GET    /me                           profil + quota
POST   /uploads                      → { uploadUrl, r2Key }
POST   /diagnoses                    lance un diagnostic
GET    /diagnoses                    historique (paginé)
GET    /diagnoses/:id                détail
POST   /diagnoses/:id/repair-guide   génère / renvoie les étapes
DELETE /diagnoses/:id                supprime diagnostic + images
POST   /diagnoses/:id/history        outcome + avant/après + feedback
POST   /diagnoses/:id/feedback       👍 / 👎 + note
```

Toutes les réponses IA renvoyées au client sont des objets structurés validés, jamais du texte libre.

## 7. Sécurité & confidentialité

- Secrets uniquement dans les *bindings* / *secrets* Cloudflare (`wrangler secret put`).
- JWT court + refresh ; rate limiting par IP et par utilisateur (Durable Object ou KV).
- Validation Zod de **toutes** les entrées.
- PII possible dans les photos → suppression complète (diagnostic + images) à la demande,
  politique de conservation affichée, pas d'entraînement sans consentement.
- Logs sans contenu image ni PII.

## 8. Abstractions préparées pour plus tard (interfaces vides au MVP)

| Abstraction | Usage futur |
|-------------|-------------|
| `ProductIdentificationService` | marque / modèle / n° série via bases externes |
| `KnowledgeProvider` | manuels fabricants, docs techniques, bases de réparation sous licence |
| `PartsProvider` | prix et disponibilité pièces (marketplaces) — jamais de prix inventé |
| `VideoAnalysisService` | frames + audio + contexte (V3, non simulé) |
| `AnalyticsClient` | `diagnosis_started`, `photo_uploaded`, `diagnosis_completed`, … |
| `BillingClient` | RevenueCat (FREE 3/mois, PREMIUM illimité) |

## 9. Thème / design

Moderne, premium, minimaliste, rassurant, très lisible. Le résultat du diagnostic est l'élément
central de l'écran. Tokens de thème centralisés (`packages/shared` ou `apps/mobile/theme`), support
clair/sombre. Parcours : `PHOTO → QUESTION → ANALYSE → DIAGNOSTIC → ACTION`, jamais de long formulaire.

## 10. Tests

- `packages/shared` : `SafetyClassifier` (dont le cas câble électrique endommagé → escalade),
  `computeRepairabilityScore`, validation des schémas Zod.
- `apps/api` : quotas, isolation par utilisateur, erreurs Gemini, JSON invalide, absence de données,
  auth, upload.
- Scénarios de bout en bout : robinet qui fuit · chaise cassée · PC qui ne démarre pas ·
  machine à laver bruyante · **câble électrique endommagé (doit déclencher STOP)**.
