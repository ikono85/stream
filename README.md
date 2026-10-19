# Lucarne

Une interface de streaming pour une bibliothèque vidéo privée, partagée entre
proches. React 19, TypeScript, Vite 8, Tailwind 4.

Le projet est complet et fonctionne : navigation, catalogue filtrable,
recherche, fiches détaillées, lecteur vidéo, profils, favoris et reprise de
lecture. Ce qui n'est **pas** fourni, c'est votre bibliothèque de fichiers — la
section « Brancher votre bibliothèque » explique comment la raccorder.

---

## Démarrer

Il faut Node 20 ou plus récent.

```bash
npm install
npm run dev          # http://localhost:5173
```

Les autres commandes :

```bash
npm run build        # construit dans dist/
npm start            # sert dist/ + les salles partagées (production)
npm run preview      # aperçu rapide du build
npm run typecheck    # vérification des types
npm run lint         # analyse statique
```

---

## Ce qui est réellement lisible

Le catalogue livré contient deux choses très différentes, et l'interface le dit
partout où c'est utile.

**Lisible.** Quatre courts métrages de la Blender Foundation, sous licence
Creative Commons, avec leurs vrais titres et leurs vrais génériques : *Big Buck
Bunny*, *Sintel*, *Tears of Steel*, *Elephants Dream*. Ils sont servis depuis
l'hébergement public de Google ; si ces adresses changent un jour, la fiche
affichera une erreur de lecture explicite.

S'y ajoute une **mire de test** en trois épisodes, générée avec ffmpeg pour ce
projet. Elle sert à vérifier votre installation : compteur à l'écran pour
contrôler la reprise, deux qualités pour le sélecteur, deux pistes de
sous-titres. C'est le premier endroit où aller si quelque chose cloche.

**Non lisible.** Une trentaine de titres inventés, marqués `demo: true`. Ils
existent pour que la grille, les filtres et la recherche aient de la matière.
Ni les films ni les personnes citées au générique n'existent, et aucun fichier
ne leur est associé. L'interface le signale sur chaque fiche concernée.

---

## Brancher votre bibliothèque

Tout le catalogue tient dans `src/data/catalog.ts`. Remplacez son contenu par le
vôtre ; rien d'autre n'a besoin de changer.

### Un film

```ts
film({
  id: 'noel-2019',                    // unique et stable : il sert de clé partout
  title: 'Noël chez mamie',
  year: 2019,
  runtime: 42,                        // en minutes
  genres: ['Famille'],
  rating: 0,                          // 0 masque la note
  director: 'Papa',
  cast: ['Toute la famille'],
  synopsis: "Le sapin tombe à la minute 12.",
  popularity: 50,                     // sert au tri « les plus regardés »
  addedAt: '2026-10-19',
  demo: false,                        // retire la mention « catalogue de démonstration »
  sources: [
    { src: '/videos/noel-2019.mp4', type: 'video/mp4' },
  ],
})
```

### Une série

```ts
serie({
  id: 'vacances',
  title: 'Vacances',
  year: 2024,
  genres: ['Famille'],
  rating: 0,
  director: 'Papa',
  cast: [],
  synopsis: "Trois étés filmés au caméscope.",
  popularity: 40,
  addedAt: '2026-10-19',
  demo: false,
  seasons: [
    season('vacances', 1, [
      ['Bretagne', "Il pleut tous les jours sauf le dernier.", 28],
      ['Ardèche',  "Canoë et coup de soleil.", 31],
    ], [
      [{ src: '/videos/vacances-s1e1.mp4', type: 'video/mp4' }],
      [{ src: '/videos/vacances-s1e2.mp4', type: 'video/mp4' }],
    ]),
  ],
})
```

Le troisième argument de `season()` est la liste des sources, épisode par
épisode, dans le même ordre que les titres. Un tableau vide laisse l'épisode
sans source : la fiche le marque et le lecteur le dit clairement.

### Où poser les fichiers vidéo

Pour quelques fichiers, `public/videos/` suffit : tout ce qui s'y trouve est
servi tel quel à la racine du site, et `/videos/mon-film.mp4` fonctionne.

Pour une vraie bibliothèque, ne mettez pas des dizaines de gigaoctets dans
`public/` — Vite copierait tout à chaque build. Servez-les depuis un dossier
séparé et pointez les sources vers une URL absolue :

```ts
sources: [{ src: 'https://films.chez-moi.fr/noel-2019.mp4', type: 'video/mp4' }]
```

La configuration Caddy correspondante est donnée plus bas.

### Formats

Le lecteur interroge le navigateur avant d'essayer une source et écarte celles
qu'il refuse. Vous pouvez donc proposer le même épisode en plusieurs formats :
il prendra le premier qui passe.

**H.264 / AAC en MP4** est le choix le plus sûr : tous les navigateurs le
lisent. Si un fichier ne passe pas :

```bash
ffmpeg -i source.mkv -c:v libx264 -crf 21 -preset slow \
       -c:a aac -b:a 160k -movflags +faststart sortie.mp4
```

`-movflags +faststart` est important : sans lui, la lecture ne démarre qu'une
fois le fichier presque entièrement téléchargé.

Pour proposer plusieurs qualités, donnez-leur le même libellé de `quality` et
le lecteur les regroupera dans le sélecteur :

```ts
sources: [
  { src: '/videos/film-1080p.mp4', type: 'video/mp4', quality: '1080p' },
  { src: '/videos/film-720p.mp4',  type: 'video/mp4', quality: '720p'  },
]
```

### HLS, pour une vraie diffusion adaptative

Les fichiers MP4 progressifs conviennent sur un bon réseau. Dès que plusieurs
personnes regardent en même temps, ou depuis une connexion mobile, HLS vaut
mieux : la qualité s'ajuste toute seule, et une coupure ne fait pas repartir la
lecture du début.

`hls.js` est déjà installé et **chargé à la demande** : il ne pèse sur le
téléchargement initial que si une source `.m3u8` est réellement utilisée. Safari
lit HLS nativement et ne le charge jamais.

Pour fabriquer les segments :

```bash
ffmpeg -i source.mp4 \
  -filter_complex "[0:v]split=3[v1][v2][v3]; \
    [v1]scale=w=1920:h=1080[v1out]; [v2]scale=w=1280:h=720[v2out]; [v3]scale=w=854:h=480[v3out]" \
  -map "[v1out]" -c:v:0 libx264 -b:v:0 5000k \
  -map "[v2out]" -c:v:1 libx264 -b:v:1 2800k \
  -map "[v3out]" -c:v:2 libx264 -b:v:2 1400k \
  -map a:0 -map a:0 -map a:0 -c:a aac -b:a 128k \
  -f hls -hls_time 6 -hls_playlist_type vod \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
  sortie/flux_%v.m3u8
```

Puis une seule source suffit, les qualités étant gérées par le flux lui-même :

```ts
sources: [{ src: '/videos/noel/master.m3u8', type: 'application/vnd.apple.mpegurl' }]
```

Comptez plusieurs minutes à plusieurs heures de calcul par film.

---

## Importer un catalogue depuis TMDB

Pour remplir la grille avec de vrais titres — vraies affiches, vrais
génériques, vrais synopsis — sans rien saisir à la main :

```bash
npm run import:tmdb -- --key=VOTRE_CLE
```

La clé est gratuite : créez un compte sur
[themoviedb.org](https://www.themoviedb.org/signup), puis Paramètres →
API → demandez une clé pour usage personnel.

Le script écrit `src/data/tmdb.generated.ts`, que `catalog.ts` ajoute au
catalogue. Relancez-le pour rafraîchir. Quelques options :

```bash
npm run import:tmdb -- --key=... --pages=10 --list=top_rated --lang=en-US
```

`--pages` compte vingt titres par page, `--list` accepte `popular`,
`top_rated`, `now_playing` et `upcoming`.

**La clé ne quitte pas votre machine.** Le script tourne une fois, écrit un
fichier, et le navigateur ne la voit jamais. Ne déplacez pas ces appels dans
l'application : une clé dans une page web est une clé publique.

**TMDB ne fournit aucune vidéo.** L'import apporte les métadonnées et les
affiches ; chaque titre arrive sans source, et sa fiche le dit. C'est de quoi
éprouver la grille, les filtres et la recherche sur une vraie matière, pas un
catalogue regardable.

Si vous gardez cet import, TMDB demande que vous le mentionniez. Une ligne
dans le pied de page suffit : « Ce produit utilise l'API de TMDB mais n'est ni
approuvé ni certifié par TMDB. »

---

## Remplacer les affiches

Faute d'affiches, le projet en **génère** : chaque titre reçoit une composition
géométrique déterministe, tirée de son identifiant, dans une palette d'encres
commune. Deux titres n'ont jamais la même, et le même titre a toujours la
sienne. Le code est dans `src/lib/poster.ts`.

Pour utiliser vos propres images, ajoutez `artwork` (portrait 2:3) et
`backdrop` (paysage 16:9) à l'entrée :

```ts
artwork: '/affiches/noel-2019.jpg',
backdrop: '/affiches/noel-2019-large.jpg',
```

L'entrée du hero peut aussi recevoir `heroVideo`, une boucle muette en fond. Elle
n'est chargée que sur grand écran, si le système n'a pas demandé de réduire les
animations et si le navigateur n'est pas en mode économie de données.

---

## Dans le lecteur

### Enchaîner les épisodes

Quinze secondes avant la fin d'un épisode — ou le dernier cinquième seulement,
pour un clip très court — une carte annonce la suite et décompte le temps qui
reste. « Lire maintenant » enchaîne tout de suite ; « Annuler » laisse
l'épisode se terminer sans rien lancer, et le lecteur reste sur sa dernière
image.

Le décompte n'est pas une minuterie à part : c'est le temps restant de la
vidéo. Revenir en arrière fait donc disparaître la carte, qui réapparaîtra le
moment venu.

Le dernier épisode d'une saison, comme un film, ramène à la fiche. Un épisode
auquel aucun fichier n'est associé n'est jamais proposé.

Dans une salle partagée, la carte décompte mais n'offre pas « Lire
maintenant » : chacun bascule à la fin de son propre épisode, et partir en
avance laisserait les autres derrière.

### Image dans l'image

Le bouton à gauche du plein écran, ou la touche `P`, détache la vidéo dans une
petite fenêtre qui flotte au-dessus des autres applications.

Chrome, Edge et Safari donnent cette possibilité aux pages ; Firefox la garde
pour lui et propose son propre bouton au survol de la vidéo, et Chrome sur
Android ne l'expose pas. Le bouton de Lucarne n'apparaît donc que là où il peut
réellement fonctionner, plutôt que d'échouer sous le doigt.

La synchronisation d'une salle partagée continue pendant ce temps. Le panneau
de chat, lui, reste sur la page — comme en plein écran.

### Les commandes du système

Pendant la lecture, Lucarne annonce au système ce qui passe. Titre, épisode et
affiche apparaissent sur l'écran verrouillé d'un téléphone, dans la fenêtre que
Windows ouvre quand on appuie sur la touche pause du clavier, dans le « Now
Playing » de macOS, sur l'écran d'un autoradio. Les touches média du clavier et
les boutons d'un casque Bluetooth pilotent alors le lecteur ; « piste
suivante » passe à l'épisode suivant.

Rien ne sort sur le réseau et aucun compte n'est nécessaire : c'est une
interface du navigateur, au même titre que le plein écran. Là où elle manque,
il ne se passe simplement rien.

Ces commandes passent par les mêmes fonctions que les boutons à l'écran. Une
pause prise depuis l'écran verrouillé arrive donc dans une salle partagée
exactement comme une pause prise dans la barre de contrôle. Dans une salle,
« piste suivante » est retiré, pour la raison qui masque « Lire maintenant ».

Faute d'affiche fournie, c'est la composition générée qui sert de pochette,
redessinée en JPEG : les plateformes derrière cette interface ne décodent pas
toutes le SVG.

---

## Regarder ensemble

Deux personnes (jusqu'à huit) peuvent suivre le même film en même temps, chacune
chez soi, lecture synchronisée.

**Comment on s'en sert.** Dans le lecteur, bouton « Regarder ensemble » en haut à
droite. Un code de salle apparaît ; copiez le lien et envoyez-le. La personne
qui l'ouvre arrive sur le même film, au même endroit, même si vous avez
commencé il y a vingt minutes.

**Le contrôle est partagé.** Chacun peut lancer, mettre en pause et se déplacer
dans le film ; l'action vaut pour tout le monde. Il n'y a pas d'hôte.

**L'attente est partagée aussi.** Si la vidéo se met à charger chez l'un, la
lecture s'arrête chez les deux, et repart ensemble quand c'est prêt. Un bandeau
indique qui on attend.

**Le chat** est à côté de la vidéo (en bas de l'écran sur mobile). Les messages
ne sont stockés nulle part : ils vivent le temps de la séance et disparaissent.

En plein écran, le panneau latéral n'est plus visible — c'est une limite du
plein écran du navigateur, qui ne couvre que l'élément vidéo.

### Ce qu'il faut pour que ça marche

Les deux navigateurs doivent joindre **le même serveur**. Trois cas :

| Situation | Ce qu'il faut faire |
| --- | --- |
| Même wifi | Rien. Partagez l'adresse `Network` affichée au démarrage (`http://192.168.x.x:5173`). |
| Chacun chez soi | [Tailscale](https://tailscale.com) sur les deux machines, ou une vraie mise en ligne. |
| Site public | La configuration Caddy donnée plus bas. |

### Comment c'est fait

Un petit relais WebSocket, dans `server/sync.mjs`. Il ne détient pas le film et
ne décide de rien : il transmet aux autres ce que l'un vient de faire, et tient
la liste des présents. En développement il est greffé sur le serveur Vite, donc
`npm run dev` reste la seule commande à lancer.

Un point mérite d'être expliqué, parce qu'il n'est pas évident. Le contrôle
étant partagé, personne ne fait autorité — et deux lecteurs qui se corrigent
mutuellement finissent par osciller. Donc : toute action explicite s'impose à
tous, mais la **dérive** au fil de la lecture est arbitrée par une seule
personne, celle qui est entrée la première dans la salle. Les autres se recalent
silencieusement sur elle dès que l'écart dépasse 1,2 seconde.

---

## Comptes et authentification

Soyons précis, parce que c'est le point où beaucoup de projets se racontent des
histoires.

Les **profils** de Lucarne ne sont pas une sécurité. Ils séparent les listes et
les reprises de lecture entre les gens du foyer, rien de plus. Ils n'ont pas de
mot de passe, et c'est volontaire : une application qui tourne entièrement dans
le navigateur ne peut garder aucun secret. Un mot de passe vérifié en JavaScript
côté client se contourne en ouvrant les outils de développement.

Tout ce que l'application mémorise passe par une seule interface,
`LucarneStore`, dans `src/lib/storage.ts`. L'implémentation livrée écrit dans
`localStorage` : propre à chaque navigateur et à chaque appareil. Suffisant pour
essayer, insuffisant dès que les mêmes personnes regardent depuis le téléphone
et la télévision.

Pour une vraie authentification, il faut un serveur. Écrivez une seconde
implémentation de `LucarneStore` qui appelle votre API, exportez-la à la place
de `store`, et aucun composant ne change. Côté serveur, les règles habituelles :
mots de passe hachés avec bcrypt ou argon2, jamais en clair ; session dans un
cookie `HttpOnly` `Secure` `SameSite=Lax` ; et la protection réelle de vos
fichiers vidéo, qui doit se faire sur le serveur de fichiers, pas dans
l'interface.

Le plus simple, si le site n'est destiné qu'à vos proches : laissez les profils
tels quels et protégez tout le site derrière une authentification de niveau
serveur — Caddy, nginx, ou un tunnel Tailscale. L'interface reste une
interface ; le contrôle d'accès reste au bon endroit.

---

## Mettre en ligne

`npm run build` produit `dist/`, un site statique.

Deux points comptent. D'abord, c'est une application à page unique : toute URL
inconnue doit renvoyer `index.html`, sinon un rechargement sur `/titre/sintel`
donne une 404. Ensuite, le serveur doit honorer les requêtes par plage d'octets
(`Range`), sans quoi on ne peut pas se déplacer dans une vidéo. Caddy et nginx
le font nativement.

Comme les salles partagées ont besoin d'un WebSocket, le site passe par le
serveur Node (`npm start`) plutôt que par un simple dossier statique. Caddy fait
le relais et transmet l'`upgrade` WebSocket tout seul :

```caddyfile
lucarne.chez-moi.fr {
    encode gzip

    # Les vidéos, servies directement depuis le disque
    handle_path /videos/* {
        root * /mnt/disque/videos
        file_server
    }

    # Le site et les salles partagées (/sync)
    reverse_proxy localhost:8080

    # Tout le site derrière un mot de passe partagé.
    # Fabriquer le hash : caddy hash-password
    basic_auth {
        famille $2a$14$remplacez.par.votre.hash
    }
}
```

Pour que le serveur Node redémarre tout seul, un service systemd :

```ini
# /etc/systemd/system/lucarne.service
[Unit]
Description=Lucarne
After=network.target

[Service]
WorkingDirectory=/var/www/lucarne
Environment=PORT=8080
Environment=VIDEOS=/mnt/disque/videos
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

Si vous préférez ne rien exposer sur Internet, installez
[Tailscale](https://tailscale.com) sur le serveur et sur les appareils de vos
proches : le site n'est alors joignable que depuis votre réseau privé, sans
ouvrir le moindre port.

### Débit nécessaire

C'est votre **débit montant** qui limite, pas le descendant. Comptez environ
5 Mb/s par personne en 1080p et 2,5 Mb/s en 720p, simultanément. Une fibre à
500 Mb/s en envoi ne pose aucun problème ; un ADSL à 1 Mb/s ne tiendra pas un
seul flux.

---

## Raccourcis du lecteur

| Touche | Effet |
| --- | --- |
| `Espace` ou `K` | Lecture / pause |
| `←` `→` | Reculer / avancer de 10 secondes |
| `↑` `↓` | Volume |
| `F` | Plein écran |
| `P` | Image dans l'image |
| `M` | Couper le son |
| `C` | Sous-titres |
| `Échap` | Ferme le menu ouvert, puis le plein écran, puis le lecteur |

Ailleurs sur le site, `/` ouvre la recherche.

---

## Structure

```
src/
  config.ts              Nom du site et couleurs de profil
  types/                 Les types partagés
  data/catalog.ts        Le catalogue — c'est le fichier à remplacer
  lib/
    poster.ts            Génération des affiches
    storage.ts           Persistance (interface + implémentation localStorage)
    search.ts            Filtres, tri, suggestions
    recommend.ts         Recommandations d'après la liste et l'historique
    format.ts            Durées, horloges, comparaison sans accents
  hooks/
    libraryContext.ts    Contexte et hook useLibrary
    library.tsx          Le fournisseur
  components/            Cartes, carrousel, hero, recherche, navigation
  sync/
    protocol.ts          Messages échangés avec le relais
    useWatchTogether.ts  Salle partagée : dérive, pause sur chargement, chat
  player/                Lecteur vidéo, plein écran, image dans l'image,
                         commandes du système
  pages/                 Accueil, catalogue, fiche, ma liste, lecture, 404
server/
  sync.mjs               Le relais WebSocket des salles partagées
  index.mjs              Serveur de production (site + relais)
public/demo/             La mire de test
```

---

## Ce que ce projet ne fait pas

Pour éviter les mauvaises surprises :

- **Pas de transcodage à la volée.** Plex et Jellyfin convertissent le fichier
  en temps réel selon l'appareil. Ici, le navigateur lit le fichier tel quel :
  préparez vos fichiers à l'avance.
- **Pas de synchronisation entre appareils** tant que `LucarneStore` écrit dans
  `localStorage`. Chaque navigateur a sa propre liste.
- **Pas de téléchargement hors ligne**, pas de Chromecast, pas d'AirPlay au-delà
  de ce que le navigateur propose nativement sur une balise vidéo.
- **Pas de récupération automatique de métadonnées.** Titres, synopsis et
  génériques sont saisis à la main dans `catalog.ts`.
- **Pas d'historique de chat.** Les messages d'une séance partagée ne sont
  jamais écrits sur disque ; fermer la salle les efface.
- **Pas de voix ni de vidéo entre vous.** Le chat est en texte. Pour s'entendre,
  gardez un appel à côté.

Si l'un de ces points est rédhibitoire, Jellyfin fait tout cela et c'est gratuit.
L'intérêt de Lucarne est ailleurs : c'est votre code, vous le changez comme vous
voulez, et il ne dépend d'aucun service qui pourrait décider un jour de faire
payer l'accès à distance.

---

## Licences

Le code de ce projet est à vous.

Les quatre courts métrages inclus restent la propriété de la Blender Foundation
et sont redistribués sous les licences indiquées sur chaque fiche et dans le pied
de page : Creative Commons BY 3.0 pour *Big Buck Bunny*, *Sintel* et *Tears of
Steel*, Creative Commons BY 2.5 pour *Elephants Dream*. Si vous retirez ces
entrées du catalogue, retirez aussi les mentions correspondantes.

La police Archivo est sous SIL Open Font License, embarquée via
`@fontsource-variable/archivo`.
