import { Hono } from 'hono';
import type { AppEnv } from './types';

/**
 * Pages publiques HTML servies par le Worker.
 *
 * Elles existent avant tout pour l'écran de consentement OAuth Google, qui exige
 * une page d'accueil + des règles de confidentialité + des conditions
 * d'utilisation joignables sur un domaine autorisé
 * (`fixit-ai-api.ichigo35.workers.dev`).
 *
 * NB : la CSP globale de l'API est `default-src 'none'` (API JSON pure). Pour ces
 * routes HTML, `app.ts` réécrit l'en-tête `Content-Security-Policy` afin
 * d'autoriser les styles inline.
 */

const UPDATED = '2 septembre 2026';
const CONTACT = 'tcha.jimmy@gmail.com';

const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #0B1120;
    background: #F8FAFC;
  }
  main { max-width: 720px; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
  header a { color: inherit; text-decoration: none; font-weight: 700; letter-spacing: -0.01em; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 1.5rem 0 0.25rem; letter-spacing: -0.02em; }
  h2 { font-size: 1.2rem; margin: 2.25rem 0 0.5rem; }
  .lede { font-size: 1.1rem; color: #334155; }
  .updated { color: #64748B; font-size: 0.9rem; margin-top: 0.25rem; }
  a { color: #2563EB; }
  ul { padding-left: 1.25rem; }
  li { margin: 0.35rem 0; }
  footer { margin-top: 3.5rem; padding-top: 1.5rem; border-top: 1px solid #E2E8F0; color: #64748B; font-size: 0.9rem; }
  footer a { color: #64748B; }
  @media (prefers-color-scheme: dark) {
    body { color: #E2E8F0; background: #0B1120; }
    .lede { color: #94A3B8; }
    .updated, footer, footer a { color: #94A3B8; }
    footer { border-top-color: #1E293B; }
  }
`;

function layout(title: string, body: string): string {
  return (
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title} · FixIt AI</title>` +
    `<style>${STYLE}</style></head><body><main>` +
    `<header><a href="/">FixIt AI</a></header>` +
    body +
    `<footer>FixIt AI · <a href="/">Accueil</a> · <a href="/privacy">Confidentialité</a> · ` +
    `<a href="/terms">Conditions</a> · <a href="mailto:${CONTACT}">${CONTACT}</a></footer>` +
    `</main></body></html>`
  );
}

const HOME = layout(
  'Accueil',
  `<h1>FixIt AI</h1>
   <p class="lede">Un assistant de réparation mobile : prenez en photo ou filmez un
   appareil en panne, décrivez le problème, et l'application propose un diagnostic
   et un guide de réparation pas&nbsp;à&nbsp;pas — ou vous conseille d'arrêter quand
   l'intervention est dangereuse.</p>
   <h2>Comment ça marche</h2>
   <ul>
     <li>Vous photographiez ou filmez l'objet et décrivez la panne.</li>
     <li>Une IA analyse les médias et renvoie un diagnostic, un score de
     réparabilité et un niveau de risque.</li>
     <li>Si la réparation est raisonnable, un guide étape par étape s'affiche, avec
     vérification photo de chaque étape.</li>
     <li>Votre historique de réparations est conservé dans votre compte.</li>
   </ul>
   <h2>Compte et connexion</h2>
   <p>La connexion se fait par e-mail/mot de passe ou via Google. FixIt AI ne
   demande à Google que votre identité de base (nom, adresse e-mail, photo de
   profil) pour créer votre compte.</p>
   <h2>Confidentialité</h2>
   <p>Voir les <a href="/privacy">règles de confidentialité</a> et les
   <a href="/terms">conditions d'utilisation</a>. Pour toute question :
   <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`,
);

const PRIVACY = layout(
  'Règles de confidentialité',
  `<h1>Règles de confidentialité</h1>
   <p class="updated">Dernière mise à jour : ${UPDATED}</p>
   <p class="lede">Cette page décrit les données que l'application FixIt AI
   collecte, pourquoi, et avec qui elles sont partagées.</p>

   <h2>Responsable du traitement</h2>
   <p>FixIt AI est un projet individuel. Contact :
   <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>

   <h2>Données collectées</h2>
   <ul>
     <li><strong>Compte</strong> : adresse e-mail, nom et photo de profil fournis
     lors de l'inscription ou par la connexion Google.</li>
     <li><strong>Contenus que vous envoyez</strong> : photos et courtes vidéos des
     objets à réparer, et le texte décrivant la panne.</li>
     <li><strong>Diagnostics et réparations</strong> : résultats générés,
     historique des réparations et retours (utile / pas utile) que vous laissez.</li>
     <li><strong>Données d'usage techniques</strong> : nombre de diagnostics
     effectués (pour le quota) et journaux techniques nécessaires au bon
     fonctionnement et à la limitation d'abus.</li>
   </ul>
   <p>FixIt AI n'utilise pas de traceurs publicitaires ni d'outils d'analyse
   comportementale tiers.</p>

   <h2>Finalités</h2>
   <ul>
     <li>Créer et sécuriser votre compte.</li>
     <li>Produire un diagnostic et un guide de réparation à partir de vos médias
     et de votre description.</li>
     <li>Conserver votre historique de réparations et améliorer le service.</li>
     <li>Appliquer les quotas d'utilisation et prévenir les abus.</li>
   </ul>

   <h2>Sous-traitants et partage</h2>
   <ul>
     <li><strong>Google (API Gemini)</strong> : les photos, vidéos et textes que
     vous soumettez sont envoyés à l'API Gemini de Google pour analyse. Les
     fichiers vidéo transmis sont supprimés de l'API après traitement.</li>
     <li><strong>Neon</strong> : base de données et stockage des fichiers
     (serveurs situés aux États-Unis, région us-east-2). Le stockage est privé.</li>
     <li><strong>Cloudflare</strong> : hébergement de l'API et protection réseau.</li>
     <li><strong>Neon Auth / Stack Auth</strong> : gestion de l'authentification.</li>
   </ul>
   <p>Aucune donnée personnelle n'est vendue. Les données ne sont partagées
   qu'avec ces prestataires, pour faire fonctionner le service, ou si la loi
   l'exige.</p>

   <h2>Transferts internationaux</h2>
   <p>Les données sont traitées aux États-Unis par les prestataires ci-dessus.</p>

   <h2>Durée de conservation</h2>
   <p>Les contenus et l'historique sont conservés tant que votre compte est actif.
   Supprimer un diagnostic supprime aussi les photos et vidéos associées du
   stockage. Vous pouvez demander la suppression de votre compte et de vos
   données en écrivant à <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>

   <h2>Vos droits</h2>
   <p>Vous pouvez demander l'accès, la rectification, l'export ou la suppression
   de vos données à <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>

   <h2>Enfants</h2>
   <p>Le service n'est pas destiné aux personnes de moins de 16 ans.</p>

   <h2>Modifications</h2>
   <p>Toute évolution de ces règles sera publiée sur cette page avec une nouvelle
   date de mise à jour.</p>`,
);

const TERMS = layout(
  "Conditions d'utilisation",
  `<h1>Conditions d'utilisation</h1>
   <p class="updated">Dernière mise à jour : ${UPDATED}</p>

   <h2>Objet</h2>
   <p>FixIt AI est une application qui fournit des diagnostics et des guides de
   réparation générés par intelligence artificielle à partir des photos, vidéos
   et descriptions que vous soumettez.</p>

   <h2>Utilisation acceptable</h2>
   <ul>
     <li>N'envoyez que des contenus dont vous avez le droit de disposer.</li>
     <li>N'utilisez pas le service à des fins illégales ou pour contourner ses
     limites techniques.</li>
     <li>Un quota d'utilisation peut s'appliquer.</li>
   </ul>

   <h2>Avertissement sur les réparations</h2>
   <p>Les diagnostics et guides sont fournis à titre informatif et peuvent être
   incomplets ou erronés. Certaines réparations (électricité, gaz, appareils sous
   pression, etc.) sont dangereuses : suivez les consignes de sécurité, coupez
   l'alimentation et faites appel à un professionnel qualifié en cas de doute.
   Vous restez seul responsable des interventions que vous réalisez.</p>

   <h2>Absence de garantie</h2>
   <p>Le service est fourni « en l'état », sans garantie d'exactitude, de
   disponibilité ou d'adéquation à un usage particulier.</p>

   <h2>Limitation de responsabilité</h2>
   <p>Dans les limites permises par la loi, l'éditeur de FixIt AI ne saurait être
   tenu responsable des dommages résultant de l'utilisation du service ou des
   informations qu'il fournit.</p>

   <h2>Résiliation</h2>
   <p>Vous pouvez cesser d'utiliser le service à tout moment et demander la
   suppression de votre compte. L'accès peut être suspendu en cas de non-respect
   de ces conditions.</p>

   <h2>Contact</h2>
   <p><a href="mailto:${CONTACT}">${CONTACT}</a></p>`,
);

export const pages = new Hono<AppEnv>();

pages.get('/', (c) => c.html(HOME));
pages.get('/privacy', (c) => c.html(PRIVACY));
pages.get('/terms', (c) => c.html(TERMS));

/** Chemins servis en HTML → CSP assouplie (cf. app.ts). */
export const HTML_PAGE_PATHS = new Set(['/', '/privacy', '/terms']);
