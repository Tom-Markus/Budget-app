# Audit complet — Tom's Cabinet (juillet 2026)

Analyse de l'intégralité du code : `src/` (pages, composants, contextes, hooks, libs), `api/` (fonctions serverless Vercel), `migrations/` (SQL Supabase), configuration (Vite, Tailwind, PWA, Vercel), plus exécution d'ESLint, du build et de `npm audit`.

Légende de gravité : 🔴 critique · 🟠 important · 🟡 moyen · ⚪ mineur

---

## 1. 🐛 Bugs à corriger

### 🔴 1.1 Versements récurrents d'épargne : doublons possibles (multi-appareils)
`src/lib/mutations.js` → `executerRecurrencesDues()` est appelé à **chaque chargement de l'app** (`AppContext.jsx:72-80`). Si deux appareils (ou deux onglets) ouvrent l'app en même temps, chacun lit `recurring_last_run`, calcule les mêmes échéances dues et insère **les mêmes versements deux fois** avant que l'autre n'ait mis à jour `recurring_last_run`. Aucune idempotence, aucun verrou. C'est de l'argent compté en double sur le compte épargne. La bonne solution est une fonction RPC Postgres atomique (ou un cron serveur), ou au minimum une clé d'unicité `(envelope_id, type, note, created_at)` sur les versements auto.

### 🔴 1.2 Import JSON : risque de perte totale des données
`src/lib/importJson.js` → `appliquerImport()` **supprime toutes les données avant d'insérer** les nouvelles. Or `validerImport()` ne valide pas tout ce que la base refuse :
- montants ≤ 0 (`amount > 0` en DB),
- note obligatoire sur `creance_add` / `creance_repaid`,
- contraintes de récurrence (`recurring_interval` invalide, `recurring_amount ≤ 0`),
- `description` sur une créance, `goal_amount` ≤ 0, etc.

Un fichier qui passe la validation client mais viole une contrainte SQL fait échouer l'INSERT **après** les DELETE → compte vidé, restauration partielle. À corriger : soit valider exactement les mêmes règles que la DB avant de toucher quoi que ce soit, soit rendre l'opération atomique (RPC/transaction).
Autre fragilité : `update({ id: totalSauvegarde.id })` change la **clé primaire** du Patrimoine existant — ça marche mais c'est très risqué (FK, realtime, cache).

### 🔴 1.3 Crash de la page « Graphes & Dettes » si le Patrimoine est absent
`src/pages/GraphesEtDettes.jsx:354` : `soldeDe(patrimoine.id)` sans garde. `Accueil.jsx` gère le cas `!patrimoine` (message d'erreur), cette page non → écran blanc si le trigger `handle_new_user` a échoué ou pendant certains états intermédiaires (reset/import + realtime).

### 🟠 1.4 Investments : mélange EUR / USD incohérent
`src/pages/Investments.jsx` :
- Le « montant investi » (`prix_achat × quantite`) est formaté en **euros** (`formatEur`, lignes 978, 1164-1171) alors que les prix live viennent de CoinGecko/Yahoo **en dollars** et que le P&L live est affiché en **USD** (`formatUsd`).
- Le graphe du portefeuille affiche l'axe Y en `$` mais les StatCards en `€`.
- Aucune conversion EUR/USD n'est appliquée nulle part. Si tu saisis tes achats en EUR, le P&L live (prix live USD − prix d'achat EUR) est faux ; si tu saisis en USD, les cartes « € » sont fausses. Il faut choisir une devise de référence et convertir (le taux EUR/USD est déjà disponible via `/api/fx-eurusd`).

### 🟠 1.5 Investments : « Portefeuille » ignore les plus-values latentes
`valeurPortefeuille = totalInvesti + pnlRealise` (ligne 1131-1133) : la valeur affichée ne tient pas compte des prix live des positions ouvertes (pourtant récupérés pour chaque carte). La carte « Portefeuille » n'est donc pas la valeur réelle du portefeuille mais un « coût + P&L réalisé ». Au minimum renommer, idéalement intégrer le P&L latent.

### 🟠 1.6 Investments : aucune validation des dates de vente
`FormulaireCloturer` accepte une `date_vente` **antérieure à la date d'achat** (et une date d'achat dans le futur). Ni le client ni la DB (`migrations/002`) ne le vérifient → historique de portefeuille incohérent (`buildPortfolioHistory` trie par date et fera passer la vente avant l'achat).

### 🟠 1.7 Opérations multi-requêtes non atomiques
Documenté dans le code, mais réel :
- `rembourserCreance()` (`mutations.js:91`) : 2 INSERT ; si le 2ᵉ échoue → income orphelin sur Patrimoine.
- `creerSousEnveloppe()` : l'`unallocate` automatique du parent est inséré **avant** la création de l'enfant ; si celle-ci échoue, le solde du parent a été vidé pour rien.
- `annulerDernier()` : lecture puis UPDATE séparés → deux annulations simultanées (2 appareils) peuvent annuler deux mouvements au lieu d'un, en contournant la simulation de sûreté côté client.
- `reordonnerPositions()` : N UPDATE en parallèle, échec partiel possible (rollback UI seulement).
Toutes ces opérations mériteraient des fonctions RPC PostgreSQL (transactionnelles).

### 🟠 1.8 Cycle de `parent_id` possible → boucle infinie client
La DB n'empêche pas `parent_id` de créer un cycle (une enveloppe parent d'elle-même via UPDATE). `descendantsIds()` (`calculs.js:164`) est récursif **sans garde anti-cycle** → si une donnée corrompue apparaît, l'app freeze (stack overflow). `importJson.js` a une garde (`profondeur`), `calculs.js` non. Ajouter une garde + un trigger SQL de vérification.

### 🟡 1.9 Suppression en cascade : le Patrimoine « remonte »
Choix documenté (« option A ») mais piégeux : supprimer une enveloppe qui a un historique de dépenses supprime ses `spend` → le solde du Patrimoine **augmente** rétroactivement et les montants réapparaissent dans « à répartir ». Comptablement surprenant ; une alternative serait d'archiver les mouvements (soft-delete) au lieu du `ON DELETE CASCADE`.

### 🟡 1.10 Favoris News : la synchro peut ressusciter des favoris supprimés
`src/pages/News.jsx:79-91` : au montage, les favoris distants **écrasent** le localStorage seulement s'ils sont non vides. Si tu supprimes tous tes favoris sur l'appareil A (liste vide envoyée), puis ouvres l'appareil B qui avait l'ancienne liste en local… B affiche l'ancienne liste et la re-pousse au premier toggle. Il faudrait un horodatage de version.

### 🟡 1.11 Widget BCE/FED : dates codées en dur pour 2026
`src/components/news/WidgetBceFed.jsx` : les réunions s'arrêtent au 17/12/2026. À partir de 2027 le widget devient vide sans message. Prévoir un fallback (« calendrier à mettre à jour ») ou une source dynamique.

### 🟡 1.12 API `/api/news` : parsing XML par regex incomplet
`decodeEntities()` ne gère pas les entités numériques (`&#8217;`, `&#x2019;`, `&amp;#039;`…) → certains titres affichent les entités brutes. Le parsing `<item>` par regex casse aussi sur les flux Atom (`<entry>`) — plusieurs sources de la catégorie IA publient en Atom. Utiliser un vrai parseur (ex. `fast-xml-parser`) côté serverless.

### 🟡 1.13 Drag & drop : impossible de déposer dans une colonne vide
`src/pages/Accueil.jsx` (`handleDragOver`) : le déplacement inter-colonnes exige de survoler **un item** de la colonne cible. Si toutes les enveloppes sont dans une colonne, l'autre est indéplaçable (limitation dnd-kit sans droppable de conteneur). Ajouter un `useDroppable` par colonne.

### 🟡 1.14 Édition créance/épargne : lecture du titre via le DOM
`GraphesEtDettes.jsx:198-213 / 263-278` : `document.querySelector('[data-creance-id=…] input[aria-label=…]')` pour récupérer le titre édité. Fragile (dépend d'un `aria-label`, casse au moindre refactor) et non-React. `EnveloppeCreance`/`EnveloppeEpargne` devraient remonter la valeur via un callback contrôlé, comme le fait `PetiteEnveloppe`.

### 🟡 1.15 Agrégation des courbes par jour en UTC
`calculs.js` → `preparerCourbe()` groupe par `toISOString().slice(0,10)` (jour **UTC**). Pour un utilisateur belge, les mouvements entre minuit et 1h/2h du matin sont rattachés à la veille sur les vues 3M/TOUT. Utiliser la date locale.

### ⚪ 1.16 Divers
- `Reglages.jsx:387` affiche « Version 1.0.1 » alors que `package.json` dit `1.1.0`.
- `Reglages.jsx:89-94` : le listener `appinstalled` n'est jamais retiré (fuite mineure).
- `exportPdf.js` : un solde de **0 €** est affiché en rouge (`sp > 0 ? vert : rouge`) alors que l'app le traite comme neutre ailleurs.
- `WidgetMarche` (`BarreMarches.jsx`) : `prix.replace(',', ' , ')` affiche « 43 250 , 25 » avec des espaces autour de la virgule — bizarre visuellement, et seul le premier `,` est remplacé.
- `PoidsChart` (`Sport.jsx:413-414`) : `evolution` peut afficher des artefacts flottants (« +2.5000000000000004 kg ») — arrondir.
- `Sport.jsx` : les erreurs Supabase (sauvegarde de perf, upload, customisation) sont silencieuses — aucun toast d'erreur.
- `Sport.jsx` → `handleUpload()` : aucune limite de taille/type de fichier pour les photos (on peut envoyer 50 Mo).
- `supabase.js` : si les variables d'env manquent, `throw` au chargement du module → **écran blanc** sans message. Afficher un écran d'erreur propre.
- `ChampSaisie` accepte de taper `-` (le bouton est ensuite désactivé, mais autant l'interdire dans la regex) et n'accepte pas « 1.234,56 » contrairement à `parseMontant` (incohérence de tolérance de saisie).
- Comparaisons de montants en flottants (`montant > solde`) : avec `numeric(12,2)` ça passe presque toujours, mais un epsilon (`> solde + 0.005`) éviterait les faux positifs limites.
- Fichiers parasites à la racine du repo : `ChatGPT Image 18 mai 2026, 21_56_29.png`, `verify_news.mjs` (script de test ad hoc).
- `README.md` et l'en-tête de `newsApi.js` mentionnent encore rss2json alors que le code passe par `/api/news`.
- `.env.example` liste `VITE_GNEWS_KEY` et `VITE_TWELVE_DATA_KEY` qui ne sont plus utilisées nulle part.

---

## 2. 🧹 Erreurs de code (ESLint : 40 erreurs, 4 warnings)

Résultat de `npx eslint .` sur le repo :

1. **`api/fx-eurusd.js:7`** — `'process' is not defined` : la config ESLint n'a que les globals *browser* ; ajouter un bloc `files: ['api/**']` avec `globals.node`.
2. **`setState` synchrone dans un `useEffect`** (react-hooks v7) — signalé dans `AppContext.jsx:49`, `Accueil.jsx:140`, `Investments.jsx` (×4), `Sport.jsx:222`, `Graphique.jsx:119`, `PetiteEnveloppe.jsx:189`, `GrapheModal.jsx` (×2) : rendus en cascade évitables (initialiser dans `useState`, ou dériver au rendu).
3. **`Accueil.jsx:303`** & **`Sport.jsx:1259`** — fonctions utilisées avant déclaration dans des hooks (`buildPetiteProps` récursif, `loadCustomExos`/`loadImages`) : fonctionne grâce au hoisting mais fragile vis-à-vis des règles hooks ; à restructurer (`useCallback` déclarés avant usage).
4. **`WidgetBceFed.jsx:83`** — composant `Row` **créé pendant le rendu** : recréé à chaque render, état/animations perdus ; à sortir du composant parent.
5. **Variables mortes** : `X` (BoutonNouvelleEnveloppe), `aRepartirDernierMouvement`/`couleurMvtARepartir` (GrandeEnveloppe — la prop existe mais n'est plus affichée : soit un oubli d'UI, soit à supprimer), `chartGrid`/`chartAxis` (Investments), `id` (PetiteEnveloppe), `dndActive` (Accueil), `maxW` (Sport).
6. **Blocs `catch {}` vides** (`newsApi.js`, `News.jsx`, `ThemeContext.jsx`) — au minimum un commentaire, idéalement un `console.warn`.
7. **react-refresh** : les contextes exportent contexte + provider dans le même fichier, et les widgets News exportent composant + fetcher → HMR dégradé en dev.
8. **`PetiteEnveloppe` — comparateur `memo` incomplet** (`propsEgales`) : ne compare ni `maxAmountForRenvoyer`, ni `description`/`objectif`/`dernierMouvement` des sous-enveloppes → une sous-enveloppe peut afficher des infos périmées après modification.
9. **Mutation d'état hors setState** : `Accueil.jsx` `pendingRef`/`saveTimerRef` par id sans nettoyage au démontage (timers orphelins si on quitte la page pendant les 400 ms de debounce → la sauvegarde part quand même, mais sur un composant démonté).
10. **Duplication massive** : `DatePicker` existe en double (Investments + Sport, quasi identiques), `FlecheDirection` en triple (GrandeEnveloppe, PetiteEnveloppe, EnveloppeCreance), les blocs « historique + graphique + drag » créance/épargne dans `GraphesEtDettes` sont deux copies quasi identiques, `WidgetFx`/`WidgetPortfolio` partagent 80 % de leur logique de convertisseur. À factoriser.
11. `Sport.jsx` : 1 576 lignes dont ~1 000 lignes de **données** (programmes d'entraînement) codées en dur dans le composant — à extraire dans un fichier de données.
12. Aucun test automatisé dans le projet (pas de test unitaire sur `calculs.js`, qui est pourtant le cœur financier de l'app — c'est le premier endroit où en ajouter).

---

## 3. 🔒 Dangers de sécurité

### 🟠 3.1 API serverless ouvertes à tous, sans limite
Tous les endpoints `api/*` renvoient `Access-Control-Allow-Origin: *` et n'ont **ni authentification, ni rate-limiting** :
- N'importe qui peut utiliser ton déploiement comme proxy gratuit vers Yahoo/CoinGecko (risque de bannissement d'IP Vercel, de dépassement de quota d'invocations).
- `/api/fx-eurusd` consomme **ta** clé Alpha Vantage (25 req/jour en gratuit) : un tiers peut épuiser le quota malgré le cache CDN de 15 min (il suffit de varier les query params pour contourner le cache).
Correctifs : retirer le header CORS `*` (les appels sont same-origin), vérifier le JWT Supabase dans les fonctions, ou au minimum un rate-limit (Vercel firewall / upstash).

### 🟠 3.2 Import JSON destructeur (voir bug 1.2)
C'est aussi un problème de sécurité des données : un fichier accidentellement corrompu suffit à détruire le compte. La popup avertit, mais l'opération devrait être transactionnelle.

### 🟡 3.3 Realtime : les événements DELETE ne sont pas filtrés par RLS
Supabase Postgres Changes n'applique pas la RLS aux événements `DELETE` (seul l'id est diffusé). Tes canaux `envelopes-*`/`movements-*` (`AppContext.jsx:90-99`) reçoivent donc les DELETE **de tous les utilisateurs**. Impact faible ici (UUID inexploitables, `appliquerDelta` ne matche pas), mais c'est une fuite de méta-données et du trafic inutile ; ajouter un `filter: user_id=eq.{uid}` sur le canal envelopes.

### 🟡 3.4 Bucket d'images public
`migrations/003` : `exercise-images` est public en lecture (`public: true` + policy SELECT libre). Toute personne connaissant l'URL (`/{user_id}/{slug}.jpg`) peut voir les photos. Les UUID sont durs à deviner mais l'URL fuit facilement (historique navigateur, partage d'écran…). Passer en bucket privé + URLs signées serait plus propre.

### 🟡 3.5 Intégrité inter-lignes non vérifiée par la DB
- `movements.linked_movement_id` : la policy INSERT ne vérifie pas que le mouvement lié t'appartient.
- `envelopes.parent_id` : la policy INSERT/UPDATE ne vérifie pas que le parent t'appartient (on peut rattacher une enveloppe au Patrimoine d'un autre utilisateur — il ne la verra jamais, mais c'est une pollution possible).
- Le **type de mouvement n'est pas contraint au type d'enveloppe** (rien n'empêche un `income` sur une enveloppe `normal` via l'API REST directe) — le client serait alors incohérent avec la DB. Un trigger de validation fermerait tout ça.

### 🟡 3.6 Dépendance vulnérable
`npm audit` : **dompurify** (dépendance de jsPDF) — 1 vulnérabilité *moderate* (bypass de sanitization), fix disponible (`npm audit fix` / mise à jour jspdf).

### ⚪ 3.7 Divers
- Aucun header de sécurité dans `vercel.json` (CSP, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options`). Une CSP raisonnable limiterait fortement l'impact d'un éventuel XSS (le token Supabase vit en localStorage).
- `api/fx.js` / `api/fx-eurusd.js` renvoient `e.message` brut au client (fuite de détails internes mineure).
- L'export JSON contient les `user_id` (PII mineure) — inutile puisque l'import les réécrit.
- Bonnes pratiques déjà en place à saluer : RLS complète sur toutes les tables, clé Alpha Vantage côté serveur uniquement, allow-lists strictes sur `coinId`/`symbol` dans les proxys, pas de `.env` commité, pas de `dangerouslySetInnerHTML`.

---

## 4. 💡 Améliorations

### Fonctionnement / logique métier
1. **Déplacer les récurrences d'épargne côté serveur** (cron Vercel ou `pg_cron` Supabase) : plus de doublons, et les versements tombent même si tu n'ouvres pas l'app (aujourd'hui un versement « mensuel » n'existe que si tu ouvres l'app après l'échéance).
2. **RPC PostgreSQL pour les opérations composées** (remboursement créance, annulation en cascade, réordonnancement, import) → atomicité + les validations de solde (« montant trop élevé ») seraient faites côté serveur au lieu du client seul (actuellement, deux dépenses simultanées sur deux appareils peuvent faire passer une enveloppe sous 0 ; le clipping à 0 masque le problème).
3. **Montants en centimes (entiers)** côté client pour éliminer les flottants, ou epsilon systématique.
4. **Édition/suppression d'un mouvement individuel** dans le Grand Livre (aujourd'hui on ne peut annuler que le *dernier* mouvement ; une note d'il y a 3 semaines est éditable, mais pas le montant, et pas de suppression ciblée).
5. **Grand Livre** : inclure (ou filtrer explicitement) les mouvements d'épargne — actuellement ils sont invisibles du journal sans mention ; ajouter un export CSV du journal filtré.
6. **Objectifs** : la valeur par défaut de 100 € en un clic est arbitraire ; proposer la saisie directe. Une notification/badge quand un objectif est atteint serait motivant.
7. **Investments** : édition d'une position existante (correction de faute de frappe impossible aujourd'hui — il faut supprimer/recréer) ; ventes partielles ; choix de devise par position ; historiser un snapshot quotidien de la valeur pour un vrai graphe (le graphe actuel reconstruit uniquement à partir des événements achat/vente + prix live du jour).
8. **Sport** : les coches de séance (`sport_checked_exos`) sont en localStorage uniquement → pas de synchro entre appareils contrairement au reste ; les migrer en DB comme `sport_custom_exos`. Le programme (jours/sessions) est figé dans le code : le rendre éditable serait la suite logique.
9. **Mode hors-ligne réel** : la PWA precache l'app shell mais toutes les données passent par Supabase → l'app installée affiche un loader infini hors connexion. Un cache local des dernières données (IndexedDB) + file d'attente d'écritures serait le grand chantier « v2 ».
10. **News** : mettre `fetchWeather` en cache (sessionStorage comme le reste) — actuellement chaque visite déclenche géoloc + 2 appels réseau ; suspendre le polling 60 s d'Investments quand l'onglet est caché (`document.visibilitychange`).

### Graphismes / UX
11. **Mode sombre incomplet** : de très nombreuses couleurs sont codées en dur en `rgba(31,24,16,…)` (encre claire) au lieu des variables — surtout dans `Sport.jsx` (fonds, bordures, textes du calendrier et du PoidsChart, axes `rgba(31,24,16,0.38)`), `PetiteEnveloppe`, `EnveloppeCreance` (parchemin), `ChampSaisie`, `GrandLivre`. En thème sombre, ces éléments gardent des teintes « papier clair » → contrastes incohérents. Passer systématiquement par les tokens (`var(--border-fin)`, `var(--fond-micro)`…).
12. **Accessibilité** :
    - beaucoup de textes en `text-[10px]`/`text-[11px]` avec des opacités `/35`–`/50` → contraste insuffisant (WCAG AA) ;
    - le row de suppression d'une perf sport est un bouton de 16 px (cible tactile trop petite, minimum 44 px respecté ailleurs) ;
    - les modals (`PopupConfirmation`, `Graphique`, `Modal` d'Investments) ne piègent pas le focus (pas de focus-trap) et ne rendent pas le focus à l'élément déclencheur à la fermeture ;
    - `CurseurDore` + curseur SVG custom : prévoir un opt-out (réglage) — certains utilisateurs détestent les curseurs custom ;
    - le fond Metaball respecte `prefers-reduced-motion`, très bien — mais l'odomètre, les springs de drag et le ping de la barre marchés pourraient aussi le respecter.
13. **Skeletons vs spinners** : Accueil et Investments affichent un loader plein écran ; des skeletons type ceux de la page News rendraient le chargement moins abrupt.
14. **États vides** : la section « Comptes épargne » affiche son titre même sans aucun compte (les créances masquent le leur) — harmoniser ; un onboarding « première visite » (aucune enveloppe) guiderait mieux qu'un simple bouton pointillé.
15. **Feedback de confirmation** : la plupart des actions réussies sont silencieuses (seul « Annulé » a un toast). Un toast de succès discret sur création/suppression/import éviterait le doute, surtout avec la latence réseau.
16. **Toast unique** : un nouveau toast écrase le précédent — sur un import raté + erreur réseau on perd de l'info ; une petite file (2-3 max) serait plus robuste.
17. **PDF** : la palette de l'export est figée sur le thème clair et le rendu (times/helvetica) tranche avec l'identité EB Garamond — embarquer la police et aligner la maquette serait un beau raffinement. Les mouvements d'épargne sont absents du PDF.
18. **Barre marchés** : l'espace « 43 250 , 25 » (cf. bug 1.16) ; sur mobile le scroll horizontal n'a aucun indicateur de contenu débordant au-delà des dégradés latéraux.
19. **Navbar mobile** : 6 items sur ~360 px → labels tronqués (`split(' ')[0]` donne « Graphes », « News »…) et cibles serrées ; envisager 5 items + « Plus », ou retirer le label au profit de l'icône seule.

### Technique / performance
20. **Code-splitting par route** : bundle principal de 457 KB (+151 KB + 200 KB de chunks jsPDF/html2canvas). `React.lazy()` sur Sport, Investments, News et l'import dynamique de `exportPdf` réduiraient nettement le premier chargement (html2canvas n'est probablement jamais utilisé — c'est une dépendance optionnelle de jsPDF qu'on peut exclure).
21. **`AppContext.actions` recréé à chaque changement** de `envelopes`/`mouvements` (dépendances du `useMemo`) → tous les consommateurs re-rendent à chaque mouvement ; découper le contexte (state vs actions) ou stabiliser via refs.
22. **`buildPetiteProps` recrée l'arbre complet de props** à chaque render d'Accueil ; combiné au comparateur memo incomplet, c'est le point chaud de la page. Idéalement chaque enveloppe s'abonne à ses propres données.
23. **Fetch initial** : `movements` charge **tout l'historique** sans pagination ; au bout de quelques années ce sera lourd (mémoire + temps de chargement). Prévoir une pagination/agrégation côté serveur pour l'historique ancien.
24. **ESLint dans la CI** : aucun workflow GitHub Actions ; un simple `lint + build` sur PR éviterait les régressions (les 40 erreurs actuelles seraient déjà bloquées).
25. **Tests unitaires sur `calculs.js`** (soldes, à répartir, simulation d'annulation, préparation de courbe) : c'est le cœur financier, pur et sans dépendance — parfait pour Vitest.
26. **Nettoyage** : retirer les clés d'env obsolètes, `verify_news.mjs`, l'image PNG à la racine ; aligner la version affichée dans Réglages sur `package.json` ; mettre à jour le README (rss2json → proxy interne, page Sport/Investments non documentées dans le tableau des pages).

---

## Points forts relevés (pour équilibre)

- RLS systématique et bien écrite sur toutes les tables, y compris le storage.
- Clés API sensibles côté serveur uniquement, allow-lists strictes dans les proxys.
- Contraintes métier doublées en SQL (« belt-and-braces ») — c'est rare et précieux.
- Simulation d'annulation avant exécution (`simulerAnnulationSure`) : très bonne idée.
- Optimistic UI avec rollback propre sur l'édition/réordonnancement.
- Accessibilité soignée par endroits (aria-labels, `prefers-reduced-motion`, cibles 44 px).
- Design system cohérent à base de tokens CSS, commentaires de code exemplaires.
