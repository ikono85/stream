# Lucarne

Une interface de streaming branchée sur le catalogue **HeiwaStream**. React 19,
TypeScript, Vite 8, Tailwind 4.

Tout ce que le site affiche vient d'une seule source : l'API de
[HeiwaStream](https://heiwastream.fr/api) — plus de quarante mille films,
séries et animés, leurs disponibilités par langue et par qualité, leurs
saisons épisode par épisode, et le lecteur qui les joue. Aucun fichier vidéo
n'est hébergé ici, aucune métadonnée n'est saisie à la main, et il n'y a pas
de catalogue de démonstration : ce que vous voyez est ce que HeiwaStream a.

---

## Démarrer

Il faut Node 20 ou plus récent, et une clé d'API.

```bash
npm install
cp .env.example .env     # puis renseignez HEIWA_KEY
npm run dev              # http://localhost:5173
```

La clé se crée sur [heiwastream.fr/api?p=cle](https://heiwastream.fr/api?p=cle),
avec un compte Discord. Elle est gratuite, une par compte, et **ne s'affiche
qu'une fois** : copiez-la tout de suite. Sans elle, l'API ne répond pas et le
site affiche « Le catalogue ne répond pas » avec la raison exacte.

Les autres commandes :

```bash
npm run build        # construit dans dist/
npm start            # sert dist/ + le proxy + les salles partagées (production)
npm run preview      # aperçu rapide du build
npm run typecheck    # vérification des types
npm run lint         # analyse statique
npm run admin:motdepasse   # fabrique le mot de passe d'administration
```

Sous PowerShell, si npm est refusé pour cause de politique d'exécution :

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

## La clé reste côté serveur

C'est le point d'architecture le plus important du projet, et il n'est pas
négociable pour deux raisons indépendantes :

1. **L'API ne renvoie aucun en-tête CORS.** Un `fetch` depuis la page échoue
   avant même de partir, quel que soit l'en-tête d'autorisation. Essayer plus
   fort ne sert à rien : c'est le navigateur qui refuse.
2. **Une clé dans le bundle est une clé publique.** N'importe qui ouvrant
   l'onglet Réseau la lirait, et s'en servirait sous votre quota — jusqu'à la
   suspension.

Le site ne parle donc jamais directement à HeiwaStream. Il parle à
`/api/hs/…`, un proxy maison qui vit dans `server/heiwa.mjs`, ajoute
l'autorisation côté serveur, et relaie. En développement il est greffé sur le
serveur Vite ; en production, sur le serveur Node. `npm run dev` reste la
seule commande à lancer.

Vérifier que la clé n'a pas fui dans le build :

```bash
npm run build
grep -r "hs_" dist/     # ne doit rien trouver
```

---

## Ce que l'API fournit

Huit routes suffisent à tout le site. Le client typé qui les enveloppe est
dans `src/lib/heiwa.ts`, et c'est le seul fichier de l'application qui
connaisse la forme des réponses.

| Route | Ce qu'elle donne | Où elle sert |
| --- | --- | --- |
| `/catalog/{movie\|tv\|anime}` | Catalogue paginé, filtrable | Catalogue, rangées d'accueil |
| `/media/{movie\|tv}/{tmdb}` | Affiche, fond, logo, résumé, genres, note, durée, saisons, bande-annonce | Fiche, enrichissement des listes |
| `/media/{type}/{tmdb}/similar` | Titres proches, visuels compris | « Dans le même esprit » |
| `/tv/{tmdb}/{saison}` | Épisodes, langues et sources par épisode | Liste des épisodes |
| `/find/{titre}` | Recherche par titre | Barre de recherche |
| `/news/{type}` | Les cinquante derniers ajouts | « Ajoutés récemment » |
| `/top/{type}` | Les cinquante plus regardés | Bandeau, « Les plus regardés » |
| `/calendar` | Épisodes attendus, 31 jours au plus | Page Calendrier, bloc d'accueil |
| `/available/{type}/{id}` | Disponibilité, langues, qualité, sources | Vérification ponctuelle |

**Le type est un segment de chemin, pas un paramètre.** `/catalog/movie` filtre
les films ; `/catalog?type=movie` est accepté puis **ignoré**, et renvoie
silencieusement tout le catalogue. Ce détail coûte une demi-journée à qui ne
l'a pas vu — d'où ce paragraphe.

Les filtres de `/catalog`, eux, sont bien des paramètres : `genre`, `year`
(une année ou un intervalle `2020-2026`), `lang`, `quality`, `rating`,
`platform`, `sort` (`popular`, `added`, `rating`) et `page`.

### Ce que l'API ne donne pas

- **Aucun casting, aucune réalisation, aucun studio.** Il n'existe pas de route
  de générique. La page `/personne/:slug` a donc disparu, ainsi que les champs
  correspondants du modèle. Les inventer aurait été mentir.
- **Aucune URL de fichier vidéo.** La lecture passe obligatoirement par le
  lecteur HeiwaStream — voir plus bas.
- **Pas de liste des genres.** Celle de `src/lib/genres.ts` est écrite à la
  main, dans l'orthographe française de TMDB, parce qu'aucune route ne
  l'expose.
- **Pas de sagas, pas de collections.**

### Quotas

Cent mille requêtes par jour, ce qui est large. Mais la **limite de rafale**
est stricte : une vingtaine d'appels en deux secondes suffit à déclencher un
`429`. Le proxy est construit autour de cette contrainte.

---

## Le proxy, en trois précautions

`server/heiwa.mjs` fait trois choses au-delà du simple relais.

**Un cache, à durée variable selon la fraîcheur utile.** Une fiche ne change
pas : elle est gardée une semaine, et sur disque (`.cache/heiwa.json`), donc
elle survit à un redémarrage. Un classement est gardé une demi-heure, les
nouveautés cinq minutes. Mettez `HEIWA_NO_CACHE=1` pour tout désactiver.

**Une file d'attente.** Deux requêtes de front au plus, espacées de 120 ms, et
une reprise sur `429` qui respecte l'en-tête `Retry-After`. Une même adresse
demandée six fois en même temps ne part qu'une fois.

**L'enrichissement.** Le catalogue ne renvoie ni affiche ni résumé ; la fiche
`/media` les a. Plutôt que cinquante allers-retours depuis le navigateur, le
proxy complète les entrées lui-même quand l'appel porte `rich=N` : il va
chercher la fiche des N premiers titres et la fusionne dans la liste.
`HEIWA_RICH` fixe le défaut (24). Au-delà de ce que l'écran montre, c'est du
quota dépensé pour rien ; les entrées non enrichies restent affichables, avec
une affiche dessinée et sans résumé.

Le premier chargement à froid prend donc quelques secondes, le temps que les
fiches arrivent. Les suivants sont instantanés.

---

## Trouver quelque chose à regarder

L'accueil s'ouvre sur un **bandeau rotatif** nourri par le classement de la
semaine : six titres toutes les neuf secondes, arrêtés dès que la souris s'y
pose, que le clavier y entre, que l'onglet passe au second plan ou que le
système demande de réduire les animations.

Dessous, **chaque rangée charge la sienne**, et s'affiche dès qu'elle arrive.
C'est volontaire : attendre que huit rangées soient prêtes laisserait la page
grise plusieurs secondes. Une rangée qui échoue disparaît sans bruit ; la
fiche et le catalogue, eux, annoncent leurs pannes.

Le **catalogue** garde tout son état dans l'adresse — rayon, genre, décennie,
langue, qualité, note, tri, page. Un lien partagé rouvre la même vue, et le
bouton Retour fait ce qu'on attend. Les noms de paramètres sont en français :
`?type=anime&genre=Action&decennie=2010&langue=vf&qualite=1080p&tri=rating`.

Deux limites de l'API méritent d'être connues :

- **Mille titres par jeu de filtres.** Vingt pages de cinquante. Pour aller
  au-delà, il faut resserrer — ajouter un genre, une décennie, une langue. La
  page le dit quand on arrive au bout plutôt que de laisser chercher.
- **La recherche par titre ne se combine pas aux filtres.** Elle passe par
  `/find`, qui n'accepte ni genre ni tri. Les filtres sont donc masqués
  pendant une recherche, au lieu d'être affichés sans effet.

Le tri porte sur tout le catalogue, pas sur la page affichée : il est passé à
l'API. Trier côté navigateur n'aurait trié que cinquante titres sur quarante
mille, ce qui aurait été faux.

### Le calendrier

`/calendrier` groupe par jour les épisodes annoncés. La fenêtre se règle — 7,
14 ou 31 jours — et **31 est la borne de l'API**, pas un choix de design : au
delà elle répond `invalid_parameter`. Le client vérifie l'écart avant
d'appeler, parce qu'une erreur de paramètre n'apprend rien à personne.

Le filtre « seulement ma liste » est appliqué dans le navigateur. L'API ne
sait pas ce qu'il y a dans votre liste, et lui demander trente et un jours
pour n'en garder que trois lignes coûte exactement la même requête que de
tout afficher.

Les dates sont relatives tant qu'elles situent quelque chose : « aujourd'hui »,
« demain », « samedi 25 octobre », puis « le 9 novembre » au-delà d'une
semaine — passé sept jours, le nom du jour ne situe plus rien.

### Le prochain épisode

La fiche `/media` d'une série en cours porte un champ `nextEpisode` — saison,
numéro, titre, date. C'est l'information qu'on vient chercher quand on suit
une série, donc elle passe **avant** les boutons sur la fiche, dans un
bandeau à part.

Sur les affiches, une pastille n'apparaît que si l'épisode sort aujourd'hui ou
demain. Au-delà, l'information appartient à la fiche et au calendrier : une
pastille « dans onze jours » n'aide personne et salit la grille.

### Par plateforme

Le filtre `platform` de `/catalog` signifie « inclus dans l'abonnement de
cette plateforme », pas « hébergé par elle » : la lecture reste celle de
HeiwaStream dans tous les cas.

Six identifiants rendent des résultats, et ils sont écrits à la main dans
`src/lib/plateformes.ts` faute de route qui les liste : `netflix`,
`prime-video`, `disney-plus`, `max`, `canal-plus`, `crunchyroll`. Chacun a été
vérifié contre l'API ; ceux qui renvoyaient zéro — `apple-tv-plus`,
`paramount-plus`, `ocs` — n'y figurent pas, parce qu'un filtre qui ouvre une
page vide est pire que pas de filtre.

L'accueil en montre une bande de liens, qui ne coûte aucune requête : ce sont
des liens vers le catalogue déjà filtré.

---

## Les affiches

HeiwaStream renvoie les **chemins TMDB** (`/pEoqbqt….jpg`) sans les assembler.
`src/lib/images.ts` en fait des URL servies par le CDN d'images de TMDB, qui ne
demande ni clé ni compte : c'est un serveur de fichiers, pas une API. Les
tailles y sont nommées par usage plutôt que par largeur, parce qu'une affiche
de carte en `original` pèse dix fois le poids utile.

Quand il n'y a pas de chemin — un titre sans affiche chez TMDB, une entrée que
le proxy n'a pas enrichie, une image que le navigateur n'a pas pu charger —
`src/lib/poster.ts` en dessine une : une sérigraphie abstraite dérivée de
l'identifiant du titre, donc stable d'une visite à l'autre et d'un appareil à
l'autre, sans rien stocker. Mieux qu'un rectangle gris, et mieux qu'une image
cassée. `src/components/Art.tsx` fait la bascule toute seule.

---

## Le lecteur

L'API ne donne jamais l'adresse d'un fichier. Elle donne une adresse de
lecteur, et c'est ce lecteur qui joue :

```
https://heiwastream.fr/embed/movie/603
https://heiwastream.fr/embed/tv/1399/01/02
```

La lecture vit donc dans une **iframe**, et tout ce que la page peut en faire
passe par `postMessage`. `src/player/Embed.tsx` enveloppe ça et expose la même
interface impérative que l'ancien lecteur maison — `play`, `pause`, `seek`,
`position`, `isPlaying` — de sorte que la synchro des salles n'a pas eu à
changer d'une ligne.

Ce que l'iframe change, et qu'il vaut mieux savoir :

- **Les commandes sont asynchrones et sans accusé de réception.** On demande,
  on apprend le résultat par un événement. La position est tenue à partir des
  `time` reçus, et non lue sur un élément.
- **Les boutons, le plein écran, l'image dans l'image et les raccourcis
  appartiennent au lecteur distant.** Notre barre ne garde que ce qui est à
  nous : sortir, le titre, la séance partagée. Dédoubler le reste serait pire
  que de s'en passer.
- **Le plein écran est pris par l'iframe elle-même**, donc nos surcouches —
  barre du haut, carte « À suivre » — disparaissent alors. C'est normal.
- **Le lecteur déployé n'envoie aujourd'hui aucun message, et ignore les
  commandes.** Mesuré le 21 octobre 2026 : une page tierce qui l'encadre reçoit
  zéro `ready`, zéro `time`, zéro `ended`, et un `pause` envoyé ne fait rien,
  sur un film qui se lit parfaitement. La documentation décrit pourtant ce
  protocole — il n'est simplement pas en service.

  Conséquence : pas de reprise à la position, pas d'enregistrement de la
  progression, pas d'enchaînement automatique des épisodes, et pas de synchro
  de lecture dans une séance partagée. L'écoute reste branchée : le jour où
  HeiwaStream livre le protocole, tout repart sans un changement ici.

  Corollaire qui a coûté un écran noir : **le voile de chargement ne doit
  jamais attendre un message**. Il se retire sur l'événement `load` de
  l'iframe, que le navigateur garantit.

Le site n'utilise du lecteur distant que la lecture. Les réglages de couleurs
et de marque qu'il propose demandent un domaine déclaré avec la clé, ce qui
n'a de sens qu'une fois le site en ligne — voir
[la page Lecteur](https://heiwastream.fr/api?p=lecteur).

---

## Regarder ensemble

Deux personnes (jusqu'à huit) peuvent suivre le même film en même temps,
chacune chez soi, lecture synchronisée.

**Comment on s'en sert.** Dans le lecteur, bouton « Regarder ensemble » en haut
à droite. Un code de salle apparaît ; copiez le lien et envoyez-le. La personne
qui l'ouvre arrive sur le même titre, au même endroit.

**Le contrôle est partagé.** Chacun peut lancer, mettre en pause et se déplacer
dans le film ; l'action vaut pour tout le monde. Il n'y a pas d'hôte.

**Le chat** est à côté de la vidéo (en bas de l'écran sur mobile). Les messages
ne sont stockés nulle part : ils vivent le temps de la séance et disparaissent.

**La condition.** La synchro repose sur ce que le lecteur rapporte. Elle
fonctionne quand il envoie sa position, et pas quand la source joue chez un
hébergeur tiers. Dans ce cas le lecteur le dit en haut de l'écran.

### Ce qu'il faut pour que ça marche

Les deux navigateurs doivent joindre **le même serveur**. Trois cas :

| Situation | Ce qu'il faut faire |
| --- | --- |
| Même wifi | Rien. Partagez l'adresse `Network` affichée au démarrage (`http://192.168.x.x:5173`). |
| Chacun chez soi | [Tailscale](https://tailscale.com) sur les deux machines, ou une vraie mise en ligne. |
| Site public | La configuration Caddy donnée plus bas. |

### Comment c'est fait

Un petit relais WebSocket, dans `server/sync.mjs`. Il ne détient rien et ne
décide de rien : il transmet aux autres ce que l'un vient de faire, et tient la
liste des présents.

Un point mérite d'être expliqué, parce qu'il n'est pas évident. Le contrôle
étant partagé, personne ne fait autorité — et deux lecteurs qui se corrigent
mutuellement finissent par osciller. Donc : toute action explicite s'impose à
tous, mais la **dérive** au fil de la lecture est arbitrée par une seule
personne, celle qui est entrée la première dans la salle. Les autres se
recalent silencieusement sur elle dès que l'écart dépasse 1,2 seconde.

Une précaution propre à l'iframe : une commande que nous émettons provoque un
événement `play` ou `pause` que le lecteur nous renvoie. Sans filtre, cet écho
repartirait vers la salle et les deux lecteurs se renverraient l'ordre
indéfiniment. Embed ignore donc l'écho pendant 700 ms après chaque commande.

---

## Comptes et authentification

Soyons précis, parce que c'est le point où beaucoup de projets se racontent des
histoires.

Les **profils** de Lucarne ne sont pas une sécurité. Ils séparent les listes et
les reprises de lecture entre les gens du foyer, rien de plus. Ils n'ont pas de
mot de passe, et c'est volontaire : une application qui tourne entièrement dans
le navigateur ne peut garder aucun secret. Un mot de passe vérifié en
JavaScript côté client se contourne en ouvrant les outils de développement.

Tout ce que l'application mémorise passe par une seule interface,
`LucarneStore`, dans `src/lib/storage.ts`. L'implémentation livrée écrit dans
`localStorage` : propre à chaque navigateur et à chaque appareil. Suffisant
pour essayer, insuffisant dès que les mêmes personnes regardent depuis le
téléphone et la télévision.

À noter : la liste et les reprises ne gardent que des **identifiants**, de la
forme `movie-603` ou `tv-1399`. Les titres sont redemandés à l'API à chaque
visite — gratuitement, puisque les fiches sont en cache — ce qui les tient à
jour, là où une copie locale aurait vieilli.

**C'est ce que fait désormais le chapitre Comptes** : une seconde
implémentation de `LucarneStore` qui appelle le serveur, choisie selon qu'on
est connecté ou non. Mots de passe hachés en scrypt, session dans un cookie
`HttpOnly` `SameSite=Lax`, `Secure` dès que le site est en HTTPS. Les profils
locaux restent pour qui ne veut pas de compte.

Le plus simple, si le site n'est destiné qu'à vos proches : laissez les profils
tels quels et protégez tout le site derrière une authentification de niveau
serveur — Caddy, nginx, ou un tunnel Tailscale.

---

## Comptes

Le site est **ouvert** : on parcourt le catalogue et on lance une lecture sans
rien créer. Un compte sert à une seule chose, et les pages ne promettent rien
d'autre — faire suivre sa liste et ses reprises d'un appareil à l'autre.

Sans compte, tout reste dans le navigateur, comme avant. Avec, tout passe par
le serveur : `src/lib/storage.ts` expose deux implémentations de la même
interface `LucarneStore`, et `magasinPour(compte)` choisit. Aucun composant ne
sait lequel il manipule.

**Ce qu'un compte contient** : un nom, une empreinte scrypt du mot de passe,
une date. Pas d'adresse électronique — donc pas de courrier à envoyer, et pas
de réinitialisation automatique. Qui perd son mot de passe le fait remettre
depuis le panneau d'administration.

**L'inscription est libre**, assortie de garde-fous qui ne gênent personne :
trois comptes par heure et par adresse IP, huit caractères au minimum, et un
interrupteur dans le panneau pour fermer les inscriptions en un clic.

**La session** vit dans un cookie `HttpOnly` signé, valable un mois. Toutes
les routes de bibliothèque lisent l'identifiant du compte **dans ce cookie**,
jamais dans l'URL ni dans le corps de la requête : c'est ce qui garantit qu'on
ne lit pas la liste du voisin en changeant un numéro.

Tout est rangé dans `donnees/`, non versionné : `comptes.json`,
`bibliotheques/<id>.json`, et le secret de signature. Une base de données
serait une complication sans contrepartie à cette échelle ; le jour où elle
s'impose, seuls `comptes.mjs` et `bibliotheque.mjs` changent.

---

## Le suivi d'usage

Le site enregistre ce que les visiteurs y font. C'est un choix de
l'exploitant, et il s'accompagne de deux obligations qu'on a tenues : **le
dire** et **pouvoir effacer**.

**Ce qui est enregistré** : fiche ouverte, lecture lancée, recherche,
connexion, inscription. Avec l'heure, l'adresse IP, le type d'appareil, et le
compte quand il y en a un. Un fichier par jour dans `donnees/evenements/`, une
ligne JSON par événement — un format qui s'écrit par ajout et ne se corrompt
pas en cas de coupure.

**Ce qui ne peut pas l'être** : la durée réellement regardée. Le lecteur est
une iframe de HeiwaStream qui ne rapporte rien (voir le chapitre Le lecteur).
« Lecture lancée » ne veut donc pas dire « film regardé » : un titre lancé
puis abandonné à la deuxième minute compte pareil. Le panneau le rappelle à
l'endroit où l'on lit les chiffres, parce qu'un indicateur mal compris est
pire qu'un indicateur absent.

**Ce qui est dit aux visiteurs** : une phrase dans le pied de page de chaque
page, et un paragraphe sur la page d'inscription, au moment où la personne
décide. Enregistrer l'activité de quelqu'un sans le lui dire ne se fait pas,
et la loi française et européenne est du même avis — une adresse IP est une
donnée personnelle.

**Ce qu'on peut effacer** : un membre supprime son compte et tout ce qui s'y
rapporte depuis *Mon compte*. L'administrateur peut effacer l'historique d'un
compte sans toucher au compte — c'est le geste à faire quand quelqu'un le
demande — ou supprimer le compte, ce qui emporte aussi ses traces.

**La rétention** est illimitée par défaut, conformément au réglage choisi.
`RETENTION_JOURS=90` dans `.env` suffit à activer la purge automatique, qui
tourne au démarrage puis une fois par jour. Le mécanisme existe avant d'être
utile, pour pouvoir changer d'avis sans rien migrer.

---

## Administration

Une page `/admin` réservée, pour voir ce qui se passe : le quota, les erreurs,
l'état du cache, les connexions. Elle n'existe pas pour les visiteurs — ni
l'onglet, ni le code.

### Qui a le droit d'entrer

Le serveur ne connaît personne : il reçoit des requêtes, et rien dans une
requête ne dit qui l'envoie. Il accepte donc deux preuves, et pas une de plus.

**Venir de la machine elle-même.** Une requête dont la socket part de
`127.0.0.1` ne peut pas avoir été fabriquée de l'extérieur. En développement
c'est votre cas : `/admin` s'ouvre sans rien taper. Mettez `ADMIN_LOCALHOST=0`
si vous voulez le mot de passe même là.

**Connaître le mot de passe.** Vérifié une fois, puis remplacé par une session
signée dans un cookie `HttpOnly`, pour ne pas le redemander à chaque clic.

```bash
npm run admin:motdepasse     # imprime la ligne à coller dans .env
```

Le mot de passe lui-même n'est stocké nulle part : seule son empreinte scrypt
part dans `.env`, et elle ne permet pas de le retrouver.

Trois pièges classiques sont évités, et le code le dit à l'endroit où ils se
posent : l'adresse vient de la **socket** et jamais de `X-Forwarded-For` — cet
en-tête se forge en une ligne de curl, et lui faire confiance pour reconnaître
localhost ouvrirait l'administration au monde ; la comparaison du mot de passe
et celle de la signature sont à **temps constant** ; les tentatives sont
**comptées**, cinq par dix minutes et par adresse.

### Pourquoi le visiteur ne voit rien

L'administration est une **seconde entrée Vite**, pas une route du site. Son
code est construit dans un bundle à part que la page publique ne référence
jamais : il n'est pas téléchargé, et le mot « admin » n'apparaît nulle part
dans ce que reçoit un visiteur.

En production, le serveur va plus loin. Il lit le manifeste de build, en
déduit les fichiers qui n'appartiennent **qu'à** l'administration, et refuse
de les servir sans session — un 404, comme s'ils n'existaient pas. Les
fichiers partagés avec le site public, eux, restent publics : les protéger
casserait le site pour tout le monde.

Celui qui tombe sur `/admin` reçoit un écran de connexion rendu par le
serveur, en HTML simple. Pas de bundle, rien à fouiller.

### Ce que le tableau de bord montre

Uniquement ce que le serveur sait déjà, sans rien instrumenter :

- **Le quota HeiwaStream**, lu dans les en-têtes de chaque réponse. C'est
  l'indicateur le plus utile du lot : il prévient avant la panne.
- **Les appels** : combien, quelle part servie par le cache, durée moyenne et
  pic, répartition par route.
- **Les réponses par code**, les 429 séparément — ce sont les limites de
  rafale, et elles disent quand le proxy force trop.
- **Le cache** : entrées, fiches gardées, requêtes en vol.
- **Les dernières erreurs**, avec l'heure et le chemin.
- **Les connexions à l'administration**, lues dans le journal d'audit.

Les compteurs vivent en mémoire et repartent à zéro au redémarrage : ils
décrivent la santé du processus en cours. Le journal d'audit, lui, est écrit
sur disque dans `donnees/admin-journal.jsonl`.

Ce journal est tenu même pour un administrateur unique. Pas par méfiance : le
jour où l'on se demande « est-ce que quelqu'un est entré ? », il faut que la
réponse soit écrite quelque part.

### Usage

Qui vient, ce qu'on ouvre, ce qu'on lance, ce qu'on cherche — sur 7, 30 ou 90
jours. Les mots cherchés sont la partie la plus instructive : ils disent ce
qu'on attend du catalogue et qu'on n'y trouve pas.

Une « visite » est un couple personne-ou-adresse et journée. Faute de
traceur, c'est l'approximation honnête du nombre de gens venus, et le panneau
l'écrit plutôt que d'afficher un chiffre qu'on croirait exact.

### Comptes

La liste des inscrits, leur dernière venue, et leur activité détaillée. Avec
de quoi agir : fermer les inscriptions, suspendre quelqu'un, remettre un mot
de passe, effacer un historique, supprimer un compte.

### Derrière un proxy inverse

Mettez `ADMIN_DERRIERE_PROXY=1` **uniquement** si un proxy est réellement
devant : le journal lit alors `X-Forwarded-For` pour consigner la vraie
adresse du visiteur plutôt que celle du proxy. Sans proxy, cet en-tête est
falsifiable et n'importe qui choisirait ce qu'on écrit dans votre journal.
L'accès, lui, ne dépend jamais de cet en-tête.

---

## Mettre en ligne

`npm run build` produit `dist/`, mais **ce n'est pas un site statique** : le
proxy de l'API et le relais des salles vivent dans le serveur Node. Le site
passe donc par `npm start`, pas par un simple dossier servi.

Deux points comptent. C'est une application à page unique : toute URL inconnue
doit renvoyer `index.html`, sinon un rechargement sur `/titre/movie-603` donne
une 404 — `server/index.mjs` s'en occupe. Et le serveur a besoin de la clé dans
son environnement : il lit `.env` au démarrage, et prévient dans la console si
`HEIWA_KEY` manque.

Un détail de la documentation HeiwaStream, qui surprend une fois en ligne :
sans en-tête `User-Agent` nommé, l'API peut répondre une page web en 403 au
lieu du JSON attendu. Le proxy envoie `Lucarne/1.0`.

```caddyfile
lucarne.chez-moi.fr {
    encode gzip

    # Le site, le proxy de l'API (/api/hs) et les salles partagées (/sync)
    reverse_proxy localhost:8080

    # Tout le site derrière un mot de passe partagé.
    # Fabriquer le hash : caddy hash-password
    basic_auth {
        famille $2a$14$remplacez.par.votre.hash
    }
}
```

```ini
# /etc/systemd/system/lucarne.service
[Unit]
Description=Lucarne
After=network.target

[Service]
WorkingDirectory=/var/www/lucarne
Environment=PORT=8080
Environment=HEIWA_KEY=hs_votre_cle
ExecStart=/usr/bin/node server/index.mjs
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now lucarne
```

Caddy obtient et renouvelle le certificat HTTPS tout seul.

**Le débit n'est plus un sujet.** La vidéo ne passe pas par votre serveur :
elle va du lecteur HeiwaStream au spectateur. Votre machine ne sert que des
pages et du JSON.

---

## Raccourcis

Les raccourcis de lecture appartiennent au lecteur HeiwaStream, qui a les
siens. Deux touches sont à nous :

| Touche | Effet |
| --- | --- |
| `/` | Ouvre la recherche |
| `Échap` | Quitte le lecteur (hors plein écran) |

---

## Structure

```
.env                     HEIWA_KEY — jamais versionné
server/
  heiwa.mjs              Le proxy : cache, file d'attente, enrichissement
  heiwa.d.mts            Ses types, pour vite.config.ts
  securite.mjs           Mots de passe, jetons signés, cookies, adresses
  mesures.mjs            Les compteurs que lit le tableau de bord
  comptes.mjs            Les comptes des membres et leurs sessions
  bibliotheque.mjs       Liste, reprises et recherches, par compte
  evenements.mjs         Le journal d'usage et ses agrégations
  compteRoutes.mjs       /api/compte, /api/bibliotheque, /api/evenements
  admin.mjs              La serrure : mot de passe, session, audit
  adminRoutes.mjs        Les routes /api/admin et l'écran de connexion
  adminVite.mjs          La même garde pour le serveur de développement
  sync.mjs               Le relais WebSocket des salles partagées
  index.mjs              Serveur de production (site + proxy + admin + relais)
src/
  config.ts              Nom du site et couleurs de profil
  types/                 Le modèle, calqué sur ce que l'API renvoie
  lib/
    heiwa.ts             Le client de l'API — le seul à connaître ses réponses
    compte.ts            Inscription, connexion, mon compte
    suivi.ts             Les signaux que seul le navigateur connaît
    images.ts            Chemins TMDB vers URL d'images
    filtres.ts           Entre l'URL du catalogue et les paramètres de l'API
    genres.ts            Les genres filtrables, et les équivalences
    plateformes.ts       Les six plateformes que l'API sait filtrer
    poster.ts            Les affiches dessinées, pour celles qui manquent
    storage.ts           Persistance : navigateur sans compte, serveur avec
    format.ts            Durées, horloges, langues, dates relatives
  hooks/
    useRemote.ts         Un appel, trois états : chargement, donnée, erreur
    libraryContext.ts    Contexte et hook useLibrary
    library.tsx          Le fournisseur
  components/
    Art.tsx              Image qui retombe sur l'affiche dessinée
    Badge.tsx            4K et VF au coin des affiches
    RangeeDistante.tsx   Une rangée qui charge la sienne
    Card.tsx Row.tsx Hero.tsx SearchOverlay.tsx Trailer.tsx RoomPanel.tsx
  player/
    Embed.tsx            L'iframe du lecteur et le pont postMessage
  sync/
    protocol.ts          Messages échangés avec le relais
    useWatchTogether.ts  Salle partagée : dérive, pause sur chargement, chat
  admin/                 Le tableau de bord — second point d'entrée, jamais
                         envoyé au visiteur. Surveillance, usage, comptes
  pages/                 Accueil, catalogue, fiche, calendrier, ma liste,
                         lecture, compte, 404
admin.html               L'entrée de l'administration, à côté d'index.html
donnees/                 Comptes, bibliothèques, journaux (non versionné)
_to_delete/              L'ancien catalogue, à supprimer après vérification
```

Le dossier `_to_delete/` contient ce que cette version a remplacé : l'ancien
catalogue de démonstration, les imports TMDB et MyAnimeList, les courts
métrages Creative Commons, le lecteur vidéo maison et la page personne. Rien
n'y est importé par le code. Supprimez-le quand vous aurez vérifié que rien ne
vous manque.

---

## Ce que ce projet ne fait pas

- **Il n'héberge aucune vidéo** et n'en sert aucune. Le catalogue et la lecture
  sont ceux de HeiwaStream ; sans clé valide, le site est vide.
- **Pas de générique.** L'API n'expose ni casting ni réalisation.
- **Pas de reprise à la seconde près, ni de synchro de lecture**, tant que le
  lecteur distant reste muet — voir le chapitre Le lecteur.
- **Pas de synchronisation entre appareils sans compte.** Sans inscription,
  la liste reste dans le navigateur où elle a été faite.
- **Pas de téléchargement hors ligne**, et pas de contrôle sur les options du
  lecteur distant au-delà de ce que son API accepte.
- **Pas d'historique de chat.** Les messages d'une séance partagée ne sont
  jamais écrits sur disque.
- **Pas de voix ni de vidéo entre vous.** Le chat est en texte.
- **Plus de bibliothèque locale.** Les versions précédentes lisaient vos
  propres fichiers ; cette version lit le catalogue HeiwaStream. Leur lecteur
  sait jouer des sources à vous — voir
  [la page Tes sources](https://heiwastream.fr/api?p=sources) — mais rien ici
  ne s'en sert.

---

## Licences

Le code de ce projet est à vous.

Le catalogue, les disponibilités et la lecture sont fournis par HeiwaStream,
selon ses propres conditions. Les affiches, fonds et résumés viennent de The
Movie Database, via HeiwaStream : ce produit utilise l'API de TMDB mais n'est
ni approuvé ni certifié par TMDB. La mention correspondante est dans le pied de
page du site ; gardez-la.

La police Archivo est sous SIL Open Font License, embarquée via
`@fontsource-variable/archivo`.
