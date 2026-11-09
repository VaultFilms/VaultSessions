<p align="center"><img src="../VaultSessions/icons/leaf-128.png" width="64" height="64" alt="VaultSessions"></p>
<h1 align="center">VaultSessions</h1>

<h3 align="center">Réunissez vos propres assistants IA.</h3>

<p align="center">
  <a href="../README.md">English</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.id.md">Indonesia</a> |
  <a href="README.pt-BR.md">Português</a> |
  <a href="README.hi.md">हिन्दी</a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=UsRg_4V6jCg">
    <img src="introduction-compact.gif" alt="VaultSessions Demo" width="700">
  </a>
</p>

<p align="center">
  <a href="https://github.com/VaultFilms/VaultSessions/releases">
    <img src="https://img.shields.io/github/v/release/VaultFilms/VaultSessions?color=blue" alt="GitHub Release">
  </a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/manifest-v3-orange" alt="Manifest v3">
  <img src="https://visitor-badge.laobi.icu/badge?page_id=VaultFilms.VaultSessions" alt="visitors">
</p>

**Une application de réunion open source où les humains et leurs assistants IA personnels — ChatGPT, Gemini et Claude — peuvent réfléchir et collaborer ensemble, en conservant leur personnalisation existante.**

## Fonctionnalités

- **Retrouvez la personnalité de vos IA habituelles.** Connectez les chats Web officiels que vous utilisez déjà, avec leurs conversations et leur personnalisation existantes. Aucune clé d’API IA n’est nécessaire.
- **Des discussions de groupe naturelles.** Les IA connectées interviennent à tour de rôle, apportent de nouveaux points de vue et passent leur tour lorsqu’elles n’ont rien à ajouter. Une seule IA connectée donne une seule réponse.
- **Désignez naturellement le premier intervenant.** Utilisez `@GPT`, `@ChatGPT`, `@Gemini`, `@Claude` ou `To Gemini`. Sans indication, le premier intervenant est choisi au hasard.
- **Partagez un contexte visuel.** Joignez ou collez jusqu’à quatre images et discutez-en en utilisant leurs numéros.
- **Continuez à discuter pendant que ChatGPT ou Gemini génère des images.** Lorsque la génération native est détectée, l’IA qui génère devient temporairement indisponible et vous pouvez parler aux autres IA connectées. Les aperçus terminés apparaissent avec la demande initiale, sans relancer la discussion. VS fournit des aperçus compressés ; consultez le chat officiel pour les originaux. Les échecs de génération ou de récupération et les délais dépassés apparaissent dans le journal ; l’IA revient automatiquement lorsque son chat est prêt. Gardez l’onglet officiel ouvert ; la progression en arrière-plan dépend du fournisseur et du navigateur. Les codes et fichiers SVG de Claude sont également pris en charge : VS supprime les scripts et références externes, puis crée un aperçu matriciel.
- **Partagez la page actuelle.** Fournissez, si vous le souhaitez, le texte lisible d’une page comme document de référence.
- **Résumez et copiez.** Générez un résumé pour relire la discussion ou préparer une prochaine réunion.
- **Panneau latéral et vue agrandie.** Changez de présentation, masquez les commandes des participants et ajustez la taille du texte du journal.
- **Neuf langues d’interface.** Anglais, japonais, français (France), allemand (Allemagne), espagnol (États-Unis), italien, indonésien, portugais (Brésil) et hindi. La sélection initiale suit les préférences du navigateur, avec l’anglais comme solution de repli ; les choix manuels sont mémorisés. Le mode sombre suit les préférences du navigateur ou du système.

VaultSessions est une preuve de concept d’interface de réunion réunissant différents contextes et personnalités d’IA ainsi que des points de vue humains. Le projet n’est ni affilié à OpenAI, Google ou Anthropic, ni approuvé par ces entreprises.

## Installation

```text
VaultSessions/
├── README.md
├── LICENSE
├── SECURITY.md
├── docs/
└── VaultSessions/       ← Charger ce dossier dans Chrome
    ├── manifest.json
    ├── meeting.html
    ├── start.command
    ├── start.bat
    ├── serve.py
    ├── icons/
    ├── i18n/
    └── ...
```

1. Téléchargez ou clonez ce dépôt dans un dossier que vous conserverez.
2. Ouvrez `chrome://extensions/` et activez le **mode développeur**.
3. Cliquez sur **Charger l’extension non empaquetée** et sélectionnez le dossier intérieur **`VaultSessions/`** contenant `manifest.json`, et non la racine du dépôt.
4. Ouvrez les sites officiels de ChatGPT, Gemini et/ou Claude, puis connectez-vous vous-même.
5. Cliquez sur l’icône de l’extension VaultSessions dans l’onglet où vous souhaitez afficher le panneau de réunion.

Utilisez une version récente de Chrome. Le minimum déclaré dans le manifeste est Chrome 116, mais la compatibilité des API du navigateur et des interfaces des fournisseurs peut varier. Les réunions ordinaires ne nécessitent ni compilation ni serveur.

Après une mise à jour, rechargez l’extension, les onglets officiels des IA et la vue de réunion.

**Prise en charge de Windows :** Des instructions et un lanceur pour Windows sont fournis, mais VaultSessions n’a pas encore été testé sur une machine Windows. Le focus des fenêtres, la saisie IME, le collage d’images depuis le presse-papiers et le passage entre la panneau latéral et le plein écran restent à vérifier sous Windows.

### Vue agrandie sans serveur

1. Dans les **détails** de l’extension, activez **Autoriser l’accès aux URL de fichiers**.
2. Ouvrez `VaultSessions/meeting.html` dans Chrome.
3. Cliquez sur **Enregistrer cette page de réunion** pour enregistrer son URL locale exacte dans le stockage local de l’extension.
4. Utilisez les commandes d’en-tête pour passer du panneau latéral à la vue agrandie et inversement.

Si vous déplacez le dossier, ouvrez et enregistrez de nouveau le fichier `meeting.html`. Le passage du panneau à la vue agrandie réutilise l’onglet actuel ; le bouton Retour du navigateur permet de retrouver le site précédent. Les journaux sont transférés, mais les IA peuvent devoir être reconnectées.

### Mode localhost facultatif

Certains panneaux IA de navigateur ne peuvent pas agir sur les pages `file://`. Pour ces intégrations, installez Python 3 et démarrez le serveur local facultatif, limité à l’interface de bouclage :

| Plateforme | Lanceur | Commande à exécuter depuis le dossier intérieur `VaultSessions/` |
| --- | --- | --- |
| macOS | Double-cliquez sur `VaultSessions/start.command` | `python3 serve.py` |
| Windows | Double-cliquez sur `VaultSessions/start.bat` | `py -3 serve.py` ou `python serve.py` |

Si le lanceur macOS a perdu son autorisation d’exécution, utilisez `chmod +x start.command` ou la commande de terminal ci-dessus. Gardez la fenêtre du terminal ouverte ; Ctrl+C arrête le serveur. Le port 8766 doit être libre.

Dans la réunion en mode fichier, cliquez sur **?**, puis sur le bouton de vérification et d’ouverture du serveur dans la fenêtre d’aide. Il vérifie le serveur et sauvegarde le journal actuel avant de changer de vue. L’adresse est `http://127.0.0.1:8766/meeting.html`.

Le serveur ne diffuse les fichiers du dossier intérieur `VaultSessions/` que sur l’interface de bouclage. N’y conservez pas de secrets ni de fichiers personnels. L’extension doit rester activée dans les deux modes.

## Utilisation

### Démarrer une réunion

Les onglets IA disponibles se connectent automatiquement. Si plusieurs onglets correspondent à un même fournisseur, choisissez la conversation souhaitée. Vous pouvez déconnecter une IA sans fermer son onglet ; la reconnexion automatique reste suspendue dans cette vue jusqu’à ce que vous la reconnectiez.

Saisissez un sujet et appuyez sur Entrée. Maj+Entrée insère un saut de ligne ; une composition en cours avec un IME n’envoie pas le message. Avec plusieurs IA connectées, les autres participants interviennent dans l’ordre après le premier. Vous pouvez désigner le premier intervenant n’importe où dans le message ; la casse est ignorée et la première désignation explicite est retenue.

Les limites initiales sont de **3 interventions** et **6 requêtes**. PASS compte comme une requête, pas comme une intervention. La discussion s’arrête également lorsque tous les participants connectés passent consécutivement leur tour. **Arrêter la discussion** empêche les tours suivants ; une réponse déjà en cours peut encore devoir être récupérée avant le déverrouillage de la saisie.

Les onglets IA passent au premier plan pendant l’envoi et la récupération des réponses. Évitez de modifier ces conversations ou d’en changer pendant un tour. La protection de saisie limite les frappes accidentelles après un changement de focus. Les instructions de rôle sont des messages de chat ordinaires, pas des rôles système ; la conservation de la personnalité et le respect des instructions ne sont pas garantis.

### Images et résumés

Joignez jusqu’à quatre images PNG, JPEG ou WebP : **5 Mo chacune, 10 Mo au total**. Collez-les dans le champ du message ou utilisez le bouton de pièce jointe. Si les données collées contiennent une image, son traitement est prioritaire sur le texte. Prévisualisez et retirez les pièces jointes avant l’envoi.

VaultSessions transmet les images à l’onglet officiel de l’IA à l’intérieur du navigateur, sans serveur relais exploité par le projet. Le site officiel les téléverse ensuite vers son fournisseur lors de l’envoi. La numérotation recommence à chaque nouveau message humain comportant des images.

**Résumer la discussion** sélectionne au hasard une IA connectée disponible. Cette opération ne lance pas un nouveau tour de discussion et n’applique pas la recommandation de 300 caractères. En cas de réussite, le résumé remplace le journal affiché et l’historique ordinaire de l’application. Copiez-le si vous souhaitez le conserver. Un échec préserve le journal précédent. Les résumés sont exclus des historiques de discussion générés ensuite par l’application et des entrées de résumés ultérieurs ; les messages déjà envoyés restent dans la conversation du fournisseur.

### Affichage et stockage temporaire

Le menu d’en-tête masque les commandes des participants et des paramètres. **A−**, **A＋** et **Taille par défaut** ajustent le texte du journal, résumés compris, entre 75 % et 175 %. Ce réglage est partagé entre les présentations et conservé après le redémarrage du navigateur.

Les instantanés temporaires utilisent `chrome.storage.session`, avec jusqu’à 500 entrées affichées et 500 entrées d’historique ordinaire par sauvegarde. La vue active peut en contenir davantage. Ce stockage n’est pas une archive durable. La langue, la taille du texte, le partage de page et l’URL du fichier enregistré utilisent le stockage local du navigateur. Les images sélectionnées mais non envoyées ne sont pas conservées lors d’un changement de vue.

### Confidentialité, autorisations et compatibilité

**Cette application n’est ni hors ligne ni limitée aux communications de bouclage.** La coordination de l’extension et la transmission des images entre ses composants se font dans le navigateur, mais les sites officiels des IA envoient les messages, images et textes de pages partagés à leurs services. VaultSessions n’utilise pas directement les API IA et ne nécessite pas de serveur relais exploité par le projet.

L’inspection statique du code a identifié un seul `fetch` explicite : la vérification facultative de `http://127.0.0.1:8766/meeting.html`. Aucun client d’analyse distinct, chargeur de script distant ou de CDN, ni client direct d’API IA externe n’a été identifié. Il s’agit d’un constat portant sur le code, **pas d’un audit de trafic réseau enregistré**, ni d’une affirmation d’absence de communication externe.

Le partage de page peut inclure des informations privées visibles sur des pages où vous êtes connecté. Désactivez-le pour les pages que vous ne souhaitez pas partager. Supprimer les paramètres de l’URL ne supprime pas les données privées du texte. Consultez [SECURITY.md](../SECURITY.md) pour les autorisations, les flux de données et le signalement de problèmes de sécurité.

**VaultSessions automatise des sites IA officiels sur lesquels vous êtes connecté. Cela peut entrer en conflit avec les conditions d’utilisation ou les règles de compte d’un fournisseur. Vérifiez les conditions applicables et utilisez le logiciel à vos risques. Des modifications des interfaces, API du navigateur, fonctions ou conditions peuvent empêcher le fonctionnement ou imposer l’arrêt de l’utilisation.** L’application ne contourne ni les CAPTCHA ni les limites d’utilisation. Un logiciel open source n’est pas nécessairement audité indépendamment ou sûr par défaut.

### Contribuer

Les contributions sont les bienvenues !

Créez un fork de ce dépôt, améliorez VaultSessions et proposez une Pull Request.

Construisons une meilleure façon de réfléchir ensemble, humains et IA.

La suite de tests interne n’est pas incluse dans cette distribution. Décrivez vos vérifications lorsque vous proposez une modification, notamment pour les adaptateurs DOM des fournisseurs. Consultez [VaultSessions/i18n/README.md](../VaultSessions/i18n/README.md) pour ajouter une langue.

## Licence

[MIT](../LICENSE) — Copyright (c) 2026 VaultFilms.

Le logiciel est fourni **EN L’ÉTAT, SANS GARANTIE**. Conservez les avis de droits d’auteur, d’autorisation et de non-garantie lors de toute redistribution. La licence n’autorise pas à ignorer les conditions des services tiers.

Créé par [VaultFilms](https://www.youtube.com/channel/UCmiLs19uM0in4ubeyvPHLIQ).
