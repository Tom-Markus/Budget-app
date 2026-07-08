# Tom's Cabinet

Application web de **budget personnel par enveloppes**, esprit banque privée
suisse éditoriale. L'utilisateur répartit son patrimoine dans des enveloppes,
suit ses dépenses, gère des créances (sommes qu'on lui doit), visualise le tout
avec des graphiques, suit son portefeuille d'investissements et son programme
sportif.

Application **web installable** (PWA), synchronisée en temps réel entre
appareils, avec authentification Google et base de données.

---

## 1. Stack technique

| Brique | Rôle |
|---|---|
| **React 19 + Vite** | Interface et serveur de développement |
| **React Router DOM** | Routage SPA (6 pages) |
| **Supabase** | Base de données PostgreSQL, authentification Google, synchronisation temps réel |
| **Tailwind CSS** | Styles utilitaires (couleurs/ombres branchées sur les tokens du design system) |
| **Framer Motion** | Animations |
| **Lucide React** | Icônes |
| **Recharts** | Graphiques (courbe d'évolution, camembert, chandelier) |
| **dnd-kit** | Glisser-déposer tactile et souris (enveloppes racines, sous-enveloppes, créances) |
| **jsPDF** | Export PDF |
| **vite-plugin-pwa** | Manifest + service worker (installation de l'app) |
| **Alpha Vantage** | Taux de change Forex (EUR/USD) pour la page Salon & marchés |
| **CoinGecko** | Cours crypto BTC, ETH, etc. — sans clé |
| **Yahoo Finance** | Indices boursiers via proxy Vercel — sans clé |
| **Flux RSS** | Actualités — parsés côté serveur via le proxy Vercel `/api/news` (sans clé) |

---

## 2. Démarrer le projet

Le développement se fait dans **GitHub Codespaces** (VS Code dans le navigateur,
Node.js préinstallé — pratique sur Chromebook).

```bash
# Installer les dépendances (à faire une fois)
npm install

# Lancer le serveur de développement
npm run dev
```

Le serveur démarre sur le port `5173`. Dans Codespaces, ouvrir l'onglet
**PORTS** et cliquer sur l'icône globe du port 5173. Le port doit être en
visibilité **Public** pour que la connexion Google fonctionne.

```bash
# Construire la version de production
npm run build

# Prévisualiser la version de production en local (utile pour tester la PWA)
npm run preview
```

---

## 3. Variables d'environnement

Le fichier `.env.local` (jamais commité) doit contenir :

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_ALPHA_VANTAGE_KEY=               # alphavantage.co — clé gratuite (Forex EUR/USD)
VITE_GNEWS_KEY=                       # gnews.io — réservé usage futur
VITE_TWELVE_DATA_KEY=                 # twelvedata.com — réservé usage futur
```

`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` se trouvent dans le tableau de bord Supabase :
**Project Settings → API**. Les clés d'API tierces sont obtenues sur les sites respectifs (compte gratuit suffisant).

> La clé `anon` est **publique par conception**. La sécurité ne repose pas sur
> son secret, mais sur les politiques RLS (voir section 5). Le seul élément
> réellement secret est le mot de passe de la base de données, qui n'est
> jamais utilisé par l'application.

---

## 4. Base de données Supabase

Les migrations se trouvent dans `migrations/` et se lancent dans l'ordre dans le **SQL Editor** de Supabase.

**Comment appliquer une migration** : Supabase → ton projet → **SQL Editor** →
*New query* → colle le contenu du fichier → **Run**. Une par une, dans l'ordre
des numéros. Chaque migration ne se lance qu'une seule fois (sauf mention
« idempotent » dans son en-tête).

| Fichier | Contenu |
|---|---|
| `001_initial.sql` | Tables `envelopes` et `movements`, trigger Patrimoine, politiques RLS, Realtime |
| `002_investments.sql` | Table `investments` (portefeuille d'investissements) |
| `003_exercise_images_storage.sql` | Bucket Supabase Storage pour les photos d'exercices |
| `004_sport_custom_exos.sql` | Table `sport_custom_exos` (personnalisations d'exercices) |
| `005_sport_performances.sql` | RLS + index sur `sport_performances` (idempotent) |
| `006_savings.sql` | Comptes épargne : type `savings`, mouvements `savings_add`/`savings_withdraw`, colonnes de récurrence |
| `007_hardening.sql` | Garde-fous d'intégrité : anti-cycle `parent_id`, cohérence type de mouvement/enveloppe (idempotent) |
| `008_sport_sync.sql` | Sport : coches de séance synchronisées (`sport_checks`) + exercices ajoutés (`sport_extra_exos`) |

### Tables principales

- **`envelopes`** — les enveloppes. Champs : `id`, `user_id`, `parent_id`
  (hiérarchie), `type` (`total` / `normal` / `creance`), `title`,
  `description`, `goal_amount`, `position`, dates.
- **`movements`** — les mouvements d'argent. Champs : `id`, `envelope_id`,
  `amount` (toujours positif, le signe est déduit du `type`), `type`
  (`income` / `spend` / `allocate` / `unallocate` / `creance_add` /
  `creance_repaid`), `linked_movement_id` (lie un remboursement de créance à
  l'entrée d'argent correspondante), `note`, `is_undone`, `created_at`.
- **`investments`** — le portefeuille. Champs : `id`, `user_id`, `ticker`,
  `type` (`action` / `etf` / `crypto` / `or`), `quantity`, `buy_price`,
  `buy_date`, `closed_at`, `close_price`.
- **`sport_custom_exercises`** — exercices créés par l'utilisateur en dehors
  du programme prédéfini.

La migration `001` crée aussi :
- un **trigger** qui initialise automatiquement l'enveloppe « Patrimoine » à
  l'inscription de chaque utilisateur ;
- les **politiques RLS** (voir section 7) ;
- l'activation de **Realtime** sur les tables `envelopes` et `movements`.

---

## 5. Architecture des fichiers

```
budget-app/
├── public/
│   └── icons/                  Icônes PWA (favicons, icônes 192/512, maskable)
│
├── migrations/
│   ├── 001_initial.sql         Schéma initial : envelopes, movements, RLS, trigger, Realtime
│   ├── 002_investments.sql     Table investments (portefeuille)
│   ├── 003_exercise_images_storage.sql   Bucket Storage pour photos d'exercices
│   └── 004_sport_custom_exos.sql         Table exercices personnalisés
│
├── src/
│   ├── main.jsx                Point d'entrée : monte React dans la page
│   ├── App.jsx                 Arbre des providers + routes (/, /graphes-dettes,
│   │                           /news, /investments, /sport, /reglages)
│   ├── index.css               Importe les styles du design system + Tailwind
│   │
│   ├── styles/
│   │   ├── tokens.css          Variables CSS : couleurs, ombres, espacements
│   │   ├── typography.css      Polices Google + échelle typographique
│   │   └── globals.css         Reset CSS + grain + classes utilitaires
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx     État de session Supabase + actions login/logout
│   │   ├── ToastContext.jsx    Notifications globales en bas d'écran
│   │   ├── ThemeContext.jsx    Thème clair / sombre (persisté dans localStorage)
│   │   └── AppContext.jsx      État global : enveloppes, mouvements, soldes, actions
│   │
│   ├── hooks/
│   │   ├── useAuth.js          Accès au contexte d'authentification
│   │   ├── useToast.js         Déclenche une notification depuis n'importe où
│   │   ├── useTheme.js         Lit et bascule le thème clair/sombre
│   │   └── useApp.js           Accès à l'état global de l'application
│   │
│   ├── lib/
│   │   ├── supabase.js         Client Supabase unique (configuré pour toute l'app)
│   │   ├── formatters.js       Format européen des montants + dates
│   │   ├── calculs.js          Calcul des soldes côté client + reconstruction d'historique
│   │   ├── mutations.js        Fonctions qui écrivent dans la base (créer, dépenser, etc.)
│   │   ├── investmentsMutations.js  CRUD du portefeuille d'investissements
│   │   ├── newsApi.js          Fetch marchés : Forex, crypto, indices, actions, actualités RSS
│   │   ├── exportJson.js       Génère et télécharge une sauvegarde JSON
│   │   ├── exportPdf.js        Génère et télécharge un rapport PDF
│   │   └── importJson.js       Lit, valide et restaure une sauvegarde JSON
│   │
│   ├── components/             Composants du design system + composants techniques
│   │   ├── Navbar.jsx              Barre de navigation (haut PC / bas mobile)
│   │   ├── EcranConnexion.jsx      Écran de connexion Google
│   │   ├── GrandeEnveloppe.jsx     Enveloppe « Patrimoine » + ligne « à répartir »
│   │   ├── PetiteEnveloppe.jsx     Enveloppe normale + ses sous-catégories (avec DnD)
│   │   ├── EnveloppeCreance.jsx    Créance + animation parchemin de l'historique
│   │   ├── BoutonAction.jsx        Bouton d'action avec ses différents états
│   │   ├── BoutonNouvelleEnveloppe.jsx  Cadre pointillé de création
│   │   ├── ChampSaisie.jsx         Champ de saisie d'un montant + validation
│   │   ├── OdometerCounter.jsx     Compteur à défilement (effet odomètre)
│   │   ├── Graphique.jsx           Fenêtre modale : courbe d'évolution
│   │   ├── Camembert.jsx           Camembert de répartition
│   │   ├── PopupConfirmation.jsx   Fenêtre modale de confirmation réutilisable
│   │   ├── Toast.jsx               Notification + LoaderNoble + SyncingDot
│   │   ├── AuthGate.jsx            Affiche l'écran de connexion OU l'application
│   │   ├── Layout.jsx              Navbar + zone de page (relie la Navbar au routeur)
│   │   ├── CurseurDore.jsx         Curseur personnalisé (point doré + anneau)
│   │   ├── MetaballFond.jsx        Fond animé metaball (canvas WebGL)
│   │   └── news/                   Composants de la page Salon & marchés
│   │       ├── BarreMarches.jsx        Bandeau défilant cours BTC/ETH/Or/indices
│   │       ├── ColonneNews.jsx         Colonne d'actualités RSS + favoris
│   │       ├── GrapheModal.jsx         Modal graphique chandelier crypto/indices
│   │       ├── WidgetBceFed.jsx        Calendrier des décisions BCE / Fed
│   │       ├── WidgetFearGreed.jsx     Indicateur Fear & Greed
│   │       ├── WidgetFx.jsx            Taux de change EUR/USD en direct
│   │       ├── WidgetMeteo.jsx         Météo locale (géolocalisation)
│   │       └── WidgetPortfolio.jsx     Mini-portfolio crypto personnalisable
│   │
│   └── pages/
│       ├── Accueil.jsx             Patrimoine + enveloppes + créations + suppressions
│       ├── GraphesEtDettes.jsx     Camembert + courbe Patrimoine + créances (avec DnD)
│       ├── News.jsx                Salon & marchés : actualités + widgets + graphes
│       ├── Investments.jsx         Portefeuille (actions, ETF, crypto, or) + prix temps réel
│       ├── Sport.jsx               Programme d'entraînement hebdomadaire + séries/reps
│       └── Reglages.jsx            Compte + thème + stats + export/import + remise à zéro
│
├── .env.example                Modèle des variables d'environnement
├── .gitignore                  Fichiers exclus de Git (dont .env.local)
├── index.html                  Page HTML racine
├── package.json                Dépendances et scripts
├── postcss.config.js           Configuration PostCSS (requise par Tailwind)
├── tailwind.config.js          Configuration Tailwind (couleurs du design system)
├── vite.config.js              Configuration Vite + PWA
└── README.md                   Ce fichier
```

---

## 6. Choix d'architecture notables

**Soldes calculés côté client.** Les soldes ne sont pas stockés en base — seuls
les mouvements le sont. `lib/calculs.js` les recalcule à partir de l'historique
complet à chaque mise à jour. Avantage : impossible de désynchroniser un solde,
facile à déboguer, pas de colonne à maintenir. Règles :
- enveloppe avec sous-catégories → solde = somme stricte des enfants ;
- enveloppe feuille → somme algébrique de ses mouvements ;
- plancher à zéro (aucun solde affiché en négatif).

**Optimistic UI.** Les actions (allouer, réordonner…) se reflètent
immédiatement dans l'interface sans attendre la réponse Supabase. En cas
d'échec serveur : rollback automatique + toast d'erreur.

**Annulation en cascade.** Annuler un remboursement de créance annule aussi
automatiquement l'entrée d'argent liée sur le Patrimoine
(`linked_movement_id`).

**Portals pour les overlays.** Les modales et toasts sont montés via
`createPortal(document.body)` pour éviter que les transformées CSS de Framer
Motion ne cassent le positionnement `fixed`.

---

## 7. Sécurité (RLS)

Les quatre opérations (lecture, insertion, mise à jour, suppression) sont
filtrées sur toutes les tables par `user_id = auth.uid()`. Conséquences :
- chaque utilisateur ne voit et ne modifie que ses propres données ;
- l'enveloppe « Patrimoine » (`type = 'total'`) ne peut pas être supprimée ;
- les contraintes métier (note obligatoire sur les créances, objectif réservé
  aux enveloppes normales, un seul Patrimoine par utilisateur...) sont aussi
  vérifiées directement par PostgreSQL — l'application ne peut pas écrire de
  données incohérentes même en cas de bug.

---

## 8. PWA

`vite-plugin-pwa` (configuré dans `vite.config.js`) génère automatiquement :
- le **manifest** (nom, couleurs, icônes, mode d'affichage `standalone`) ;
- un **service worker** minimal qui pré-charge les fichiers statiques de
  l'application (le « shell »).

L'application fonctionne **uniquement en ligne** : les données viennent
toujours de Supabase. Le service worker ne sert qu'à rendre l'application
installable, pas à fonctionner hors connexion.

> Le service worker n'est **pas actif** avec `npm run dev`. Pour tester
> l'installation, utiliser `npm run build` puis `npm run preview`, ou la
> version déployée.

**Installer sur Android :** ouvrir l'application dans Chrome → menu → « Ajouter
à l'écran d'accueil ». **Sur Chromebook :** une icône d'installation apparaît
dans la barre d'adresse, ou simplement mettre la page en favori.

---

## 9. Plan de test

À dérouler dans cet ordre après chaque déploiement important.

1. **Authentification** — se connecter avec Google, se déconnecter depuis
   Réglages, vérifier que la session persiste après fermeture de l'onglet.
2. **Créer une enveloppe normale** — bouton « + Nouvelle enveloppe ».
3. **Entrée d'argent** — bouton `+` sur le Patrimoine : le total et « à
   répartir » montent du même montant.
4. **Allocation** — bouton `+` sur une enveloppe : l'enveloppe monte, « à
   répartir » baisse, le total ne bouge pas.
5. **Dépense** — bouton `−` sur une enveloppe : l'enveloppe et le total
   baissent, « à répartir » ne bouge pas.
6. **Transfert et annulation** — boutons `⤴` (renvoyer vers « à répartir ») et
   `↩` (annuler la dernière action, avec restauration en cascade).
7. **Synchronisation** — ouvrir l'application sur deux appareils connectés au
   même compte ; une action sur l'un apparaît sur l'autre en moins d'une
   seconde.
8. **Sous-catégories** — en mode édition, créer une sous-catégorie ; le solde
   de la parente devient la somme de ses enfants ; réordonner les
   sous-catégories par glisser-déposer et vérifier que l'ordre persiste.
9. **Créances** — créer une créance, augmenter la dette (note obligatoire),
   enregistrer un remboursement (l'argent rejoint le Patrimoine).
10. **Glisser-déposer** — réordonner les enveloppes racines, les sous-enveloppes
    et les créances ; l'ordre est conservé après rechargement.
11. **Mode édition et objectif** — modifier titre/description, activer un
    objectif et vérifier la barre de progression.
12. **Graphiques** — courbe d'évolution d'une enveloppe, camembert de
    répartition, courbe du Patrimoine avec les différentes périodes.
13. **Export / import** — exporter en JSON et en PDF, puis réimporter le JSON
    et vérifier que l'état est restauré à l'identique.
14. **Portefeuille (Investments)** — ajouter une position (action, ETF, crypto,
    or), vérifier l'affichage du prix en temps réel, clôturer une position.
15. **Sport** — vérifier l'affichage du programme hebdomadaire, modifier le
    nombre de séries/répétitions d'un exercice, naviguer entre les jours.
16. **Thème sombre** — basculer en mode sombre depuis Réglages et vérifier la
    cohérence des couleurs sur toutes les pages.
17. **PWA** — installer l'application sur un téléphone et vérifier qu'elle
    s'ouvre en plein écran.

---

## 10. Limites connues et pistes pour la suite

- **Import non transactionnel** : la restauration d'une sauvegarde supprime
  puis réinsère les données. Le fichier est validé avant toute écriture, mais
  une coupure réseau en plein import pourrait laisser un état partiel — il faut
  donc **conserver le fichier JSON**. Une version atomique (fonction
  PostgreSQL) est possible.
- **Polices du PDF** : le rapport PDF utilise les polices standard de jsPDF
  (proches du design, mais pas EB Garamond exactement).
- **Calcul des soldes** : effectué côté client. Si le nombre de mouvements
  devenait très important, une vue PostgreSQL pourrait prendre le relais.
- **Édition simultanée titre + description** : en cas de frappe très rapide
  alternée sur les deux champs, une modification peut être perdue (limite du
  composant `PetiteEnveloppe`).
- **Limite** : 100 enveloppes maximum par utilisateur.
- **Cours Investments** : les prix en temps réel dépendent de la disponibilité
  des API publiques (CoinGecko, Yahoo Finance proxy) ; un quota dépassé peut
  afficher des prix en cache ou indisponibles.

---

## 11. Déploiement

Le déploiement sur GitHub et Vercel est traité séparément. Points d'attention
pour cette étape :

- recopier `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les variables
  d'environnement de Vercel ;
- ajouter l'URL de production dans Supabase
  (**Authentication → URL Configuration → Redirect URLs**) ;
- ajouter cette même URL dans Google Cloud Console
  (**Credentials → OAuth client → Authorized redirect URIs**, via l'URL de
  callback Supabase) ;
- vérifier que les routes profondes (`/graphes-dettes`, `/news`, `/investments`,
  `/sport`, `/reglages`) renvoient bien vers `index.html` au rechargement
  (comportement « SPA »).

---

*Tom's Cabinet — version 1.1.0*
