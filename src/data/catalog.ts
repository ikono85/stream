import { planArtwork } from '@/lib/poster'
import type { Entry, Episode, Season, Source, Subtitle } from '@/types'

/**
 * THE CATALOGUE
 * =============
 * Two kinds of entry live here.
 *
 * 1. Four real short films from the Blender Foundation's open-movie project,
 *    released under Creative Commons. They have real titles, real credits and
 *    real playable video, and they carry their licence through to the UI.
 *
 * 2. An invented catalogue, every entry flagged `demo: true`. These titles do
 *    not exist. They exist so the layout, filters and search have something to
 *    chew on. The interface marks them, and they have no video attached.
 *
 * Replace this file with your own library — see README, "Brancher ta
 * bibliothèque".
 */

const BLENDER = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample'

const FR_VTT: Subtitle[] = [
  { src: '/demo/mire-ep1.fr.vtt', lang: 'fr', label: 'Français', default: true },
  { src: '/demo/mire-ep1.en.vtt', lang: 'en', label: 'English' },
]

/**
 * Precise codec strings let the player drop a source the browser cannot
 * decode instead of failing on it. A plain 'video/mp4' works too — the player
 * only discards a source the browser rejects outright.
 */
function mp4(src: string, quality?: string): Source {
  return { src, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', ...(quality ? { quality } : {}) }
}

function webm(src: string, quality?: string): Source {
  return { src, type: 'video/webm; codecs="vp9, opus"', ...(quality ? { quality } : {}) }
}

/* ---------- builders ---------- */

type FilmInput = Omit<Entry, 'kind' | 'demo' | 'sources'> &
  Partial<Pick<Entry, 'sources' | 'demo'>>

function film(e: FilmInput): Entry {
  return { kind: 'film', demo: true, sources: [], ...e }
}

type EpInput = [title: string, synopsis: string, runtime: number]

function season(entryId: string, n: number, eps: EpInput[], sources?: Source[][]): Season {
  return {
    number: n,
    episodes: eps.map<Episode>(([title, synopsis, runtime], i) => ({
      id: `${entryId}-s${n}e${i + 1}`,
      number: i + 1,
      title,
      synopsis,
      runtime,
      sources: sources?.[i] ?? [],
      ...(sources?.[i]?.length && i === 0 ? { subtitles: FR_VTT } : {}),
    })),
  }
}

type SerieInput = Omit<Entry, 'kind' | 'demo' | 'runtime'> & Partial<Pick<Entry, 'demo'>>

function serie(e: SerieInput): Entry {
  return { kind: 'serie', demo: true, ...e }
}

/* ---------- real, licensed, playable ---------- */

const OPEN_MOVIES: Entry[] = [
  film({
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    year: 2008,
    runtime: 10,
    genres: ['Animation', 'Comédie'],
    rating: 7.4,
    director: 'Sacha Goedegebure',
    cast: ['Blender Institute'],
    synopsis:
      "Un lapin débonnaire sort de son terrier pour une matinée tranquille. Trois rongeurs décident du contraire. Le troisième film ouvert de la Blender Foundation, tourné pour démontrer ce qu'un studio libre peut produire.",
    popularity: 88,
    addedAt: '2026-09-02',
    demo: false,
    sources: [mp4(`${BLENDER}/BigBuckBunny.mp4`, '720p')],
    license: 'CC BY 3.0',
    attribution: '© 2008 Blender Foundation — peach.blender.org',
  }),
  film({
    id: 'sintel',
    title: 'Sintel',
    year: 2010,
    runtime: 15,
    genres: ['Animation', 'Fantastique', 'Drame'],
    rating: 8.1,
    director: 'Colin Levy',
    cast: ['Halina Reijn', 'Thom Hoffman'],
    synopsis:
      "Une jeune femme traverse un monde hostile à la recherche du dragonneau qu'elle a recueilli puis perdu. Le film ouvert le plus ambitieux de la Blender Foundation, et le plus sombre.",
    popularity: 93,
    addedAt: '2026-09-02',
    demo: false,
    sources: [mp4(`${BLENDER}/Sintel.mp4`, '720p')],
    heroVideo: `${BLENDER}/Sintel.mp4`,
    license: 'CC BY 3.0',
    attribution: '© 2010 Blender Foundation — durian.blender.org',
  }),
  film({
    id: 'tears-of-steel',
    title: 'Tears of Steel',
    year: 2012,
    runtime: 12,
    genres: ['Science-fiction', 'Action'],
    rating: 6.9,
    director: 'Ian Hubert',
    cast: ['Derek de Lint', 'Sergio Hasselbaink', 'Rogier Schippers'],
    synopsis:
      "Amsterdam, futur proche. Une équipe tente de réparer une rupture provoquée quarante ans plus tôt par une dispute. Tourné en prises de vues réelles et composité entièrement en logiciel libre.",
    popularity: 79,
    addedAt: '2026-08-21',
    demo: false,
    sources: [mp4(`${BLENDER}/TearsOfSteel.mp4`, '720p')],
    license: 'CC BY 3.0',
    attribution: '© 2012 Blender Foundation — mango.blender.org',
  }),
  film({
    id: 'elephants-dream',
    title: 'Elephants Dream',
    year: 2006,
    runtime: 11,
    genres: ['Animation', 'Science-fiction'],
    rating: 6.7,
    director: 'Bassam Kurdali',
    cast: ['Tygo Gernandt', 'Cas Jansen'],
    synopsis:
      "Deux hommes parcourent une machine immense dont ni l'un ni l'autre ne s'accorde sur la nature. Le tout premier film ouvert, produit quand l'idée paraissait encore absurde.",
    popularity: 64,
    addedAt: '2026-08-21',
    demo: false,
    sources: [mp4(`${BLENDER}/ElephantsDream.mp4`, '720p')],
    license: 'CC BY 2.5',
    attribution: '© 2006 Blender Foundation — orange.blender.org',
  }),
]

/* ---------- technical test pattern ---------- */

const TEST_PATTERN: Entry = serie({
  id: 'mire-lucarne',
  title: 'Mire de test',
  year: 2026,
  genres: ['Technique'],
  rating: 0,
  director: '—',
  cast: [],
  synopsis:
    "Trois clips générés pour vérifier votre installation : lecture d'épisodes, reprise à la seconde près, sélection de qualité et pistes de sous-titres. Rien à regarder, tout à tester.",
  popularity: 1,
  addedAt: '2026-10-01',
  demo: false,
  license: 'Domaine public',
  attribution: 'Généré avec ffmpeg pour ce projet',
  seasons: [
    season(
      'mire-lucarne',
      1,
      [
        ['Lecture et reprise', "Compteur à l'écran : quittez en cours de route, revenez, vérifiez la reprise.", 1],
        ['Changement d\'épisode', 'Vérifie le passage à la suite et la mémorisation par épisode.', 1],
        ['Fin de saison', 'Dernier clip : vérifie le comportement en fin de liste.', 1],
      ],
      [
        [
          mp4('/demo/mire-ep1.mp4', '720p'), webm('/demo/mire-ep1.webm', '720p'),
          mp4('/demo/mire-ep1-360p.mp4', '360p'), webm('/demo/mire-ep1-360p.webm', '360p'),
        ],
        [mp4('/demo/mire-ep2.mp4', '720p'), webm('/demo/mire-ep2.webm', '720p')],
        [mp4('/demo/mire-ep3.mp4', '720p'), webm('/demo/mire-ep3.webm', '720p')],
      ],
    ),
  ],
})

/* ---------- invented catalogue ---------- */

const FILMS: Entry[] = [
  film({
    id: 'le-dernier-train',
    title: 'Le Dernier Train du soir',
    year: 2024, runtime: 107, rating: 7.8, popularity: 96, addedAt: '2026-10-05',
    genres: ['Drame'], director: 'Hélène Vasseur',
    cast: ['Marion Delcourt', 'Yanis Beauchamp', 'Clotilde Rives'],
    synopsis: "Une contrôleuse de nuit fait le même trajet depuis onze ans. Un soir, un passager descend à une gare qui n'existe plus sur les horaires.",
  }),
  film({
    id: 'nord-magnetique',
    title: 'Nord magnétique',
    year: 2025, runtime: 134, rating: 8.2, popularity: 94, addedAt: '2026-09-28',
    genres: ['Science-fiction', 'Drame'], director: 'Idriss Kamara',
    cast: ['Lou Berthier', 'Samuel Oyono', 'Nadia Kerbrat'],
    synopsis: "Le champ magnétique terrestre s'inverse en dix-huit mois au lieu de dix mille ans. Une géophysicienne doit expliquer à sa fille pourquoi les oiseaux ne reviennent pas.",
  }),
  film({
    id: 'la-chambre-bleue',
    title: 'La Chambre bleue',
    year: 2021, runtime: 101, rating: 7.1, popularity: 72, addedAt: '2026-06-14',
    genres: ['Thriller'], director: 'Véronique Alloin',
    cast: ['Théo Mansart', 'Inès Bouvier'],
    synopsis: "Un couple loue la même chambre d'hôtel chaque mois depuis deux ans. Le jour où elle ne vient pas, il comprend qu'il ne connaît pas son nom de famille.",
  }),
  film({
    id: 'vents-contraires',
    title: 'Vents contraires',
    year: 2023, runtime: 128, rating: 7.5, popularity: 81, addedAt: '2026-07-30',
    genres: ['Aventure', 'Drame'], director: 'Paul Esterhazy',
    cast: ['Jeanne Lacombe', 'Omar Tissier', 'Bastien Fourcade'],
    synopsis: "Trois frères reprennent le voilier de leur père pour une traversée qu'il n'a jamais terminée. Aucun des trois ne sait vraiment naviguer.",
  }),
  film({
    id: 'orage-sec',
    title: 'Orage sec',
    year: 2020, runtime: 118, rating: 6.8, popularity: 58, addedAt: '2026-03-11',
    genres: ['Western', 'Drame'], director: 'Claire Mondésir',
    cast: ['Gabriel Sorrente', 'Estelle Vianey'],
    synopsis: "Dans une vallée qui n'a pas vu la pluie depuis quatorze mois, un puits se remplit tout seul. Les voisins cessent de se parler.",
  }),
  film({
    id: 'petite-faune',
    title: 'Petite Faune',
    year: 2023, runtime: 82, rating: 8.0, popularity: 77, addedAt: '2026-08-08',
    genres: ['Animation', 'Famille'], director: 'Mei Sandoz',
    cast: ['Rosalie Pech', 'Armand Lévêque'],
    synopsis: "Un hérisson tient l'inventaire de tout ce qui vit dans le talus. Une pelleteuse arrive au chapitre quarante-trois.",
  }),
  film({
    id: 'sable-noir',
    title: 'Sable noir',
    year: 2022, runtime: 112, rating: 7.3, popularity: 69, addedAt: '2026-05-19',
    genres: ['Policier', 'Thriller'], director: 'Fabrice Oulhen',
    cast: ['Dounia Raspail', 'Victor Nascimento', 'Hélias Brun'],
    synopsis: "Une marée noire rejette sur la plage un conteneur disparu neuf ans plus tôt. La gendarmerie locale aimerait qu'il reparte avec la marée.",
  }),
  film({
    id: 'la-criee',
    title: 'La Criée',
    year: 2019, runtime: 89, rating: 6.6, popularity: 44, addedAt: '2026-02-02',
    genres: ['Comédie'], director: 'Serge Kahn',
    cast: ['Monique Delaveau', 'Pierrick Hamon'],
    synopsis: "Le dernier mareyeur du port décide de vendre son stock aux enchères en vers libres. La chambre de commerce ne trouve aucun texte l'interdisant.",
  }),
  film({
    id: 'hivernage',
    title: 'Hivernage',
    year: 2025, runtime: 121, rating: 8.4, popularity: 91, addedAt: '2026-09-18',
    genres: ['Drame'], director: 'Anouk Tissandier',
    cast: ['Léa Monfort', 'Khalil Darrieux', 'Suzanne Aby'],
    synopsis: "Une gardienne de refuge passe l'hiver seule à deux mille mètres. Au printemps, elle ne veut plus redescendre, et personne ne sait comment le lui demander.",
  }),
  film({
    id: 'le-phare-eteint',
    title: 'Le Phare éteint',
    year: 2023, runtime: 98, rating: 6.4, popularity: 61, addedAt: '2026-04-27',
    genres: ['Horreur'], director: 'Grégoire Nizan',
    cast: ['Camille Ost', 'Johan Pradel'],
    synopsis: "Le phare est automatisé depuis 1998. Les pêcheurs continuent de voir le faisceau tourner certaines nuits.",
  }),
  film({
    id: 'terres-basses',
    title: 'Terres basses',
    year: 2021, runtime: 135, rating: 7.9, popularity: 66, addedAt: '2026-01-23',
    genres: ['Drame', 'Documentaire'], director: 'Wim Oosterlinck',
    cast: ['Famille Daelman'],
    synopsis: "Quatre générations d'une famille de polder racontent la même inondation. Les récits ne concordent sur aucun détail sauf l'heure.",
  }),
  film({
    id: 'cendres-de-novembre',
    title: 'Cendres de novembre',
    year: 2018, runtime: 142, rating: 7.7, popularity: 52, addedAt: '2025-12-09',
    genres: ['Guerre', 'Drame'], director: 'Antoine Rouvière',
    cast: ['Marc Steiner', 'Giulia Ponti', 'Tomasz Werner'],
    synopsis: "Novembre 1918. Dans un village repris trois fois, l'armistice met onze jours à arriver. Personne n'ose être le dernier à tirer.",
  }),
  film({
    id: 'minuit-moins-dix',
    title: 'Minuit moins dix',
    year: 2024, runtime: 103, rating: 7.2, popularity: 85, addedAt: '2026-10-11',
    genres: ['Thriller'], director: 'Sophie Nganga',
    cast: ['Rachid Oumar', 'Blandine Vey'],
    synopsis: "Une opératrice du 15 reconnaît la voix au bout du fil. C'est la sienne, enregistrée six mois plus tôt.",
  }),
  film({
    id: 'fugue-en-re',
    title: 'Fugue en ré',
    year: 2022, runtime: 110, rating: 7.6, popularity: 63, addedAt: '2026-06-30',
    genres: ['Musical', 'Drame'], director: 'Bruno Castelli',
    cast: ['Agathe Vermeil', 'Noé Lantier'],
    synopsis: "Un accordeur de piano perd l'audition d'une oreille. Il accepte un dernier contrat dans une salle qu'il n'a jamais réussi à régler.",
  }),
  film({
    id: 'les-mains-gelees',
    title: 'Les Mains gelées',
    year: 2020, runtime: 99, rating: 6.9, popularity: 47, addedAt: '2025-11-15',
    genres: ['Policier'], director: 'Katarzyna Belmont',
    cast: ['Erwan Tudal', 'Maya Ferreira'],
    synopsis: "Un braquage raté dans une station de ski fermée pour la saison. Les six suspects sont les six seules personnes présentes, et tous ont un alibi fourni par un autre.",
  }),
  film({
    id: 'bleu-de-prusse',
    title: 'Bleu de Prusse',
    year: 2023, runtime: 106, rating: 7.4, popularity: 70, addedAt: '2026-07-07',
    genres: ['Romance', 'Drame'], director: 'Lise Haddad',
    cast: ['Juliette Kerven', 'Arthur Blin'],
    synopsis: "Une restauratrice de tableaux découvre une lettre glissée derrière une toile en 1912. Elle met deux ans à décider si elle doit y répondre.",
  }),
  film({
    id: 'archipel',
    title: 'Archipel',
    year: 2024, runtime: 96, rating: 8.1, popularity: 74, addedAt: '2026-08-25',
    genres: ['Documentaire'], director: 'Taina Faatau',
    cast: ['Habitants de Rangiroa'],
    synopsis: "Onze îles, onze façons de compter le temps. Aucune ne correspond au calendrier administratif, et toutes fonctionnent.",
  }),
  film({
    id: 'marelle',
    title: 'Marelle',
    year: 2022, runtime: 94, rating: 7.0, popularity: 55, addedAt: '2026-03-29',
    genres: ['Comédie', 'Famille'], director: 'Pascal Guermeur',
    cast: ['Anne-Sophie Ledru', 'Mathis Carvalho', 'Rosa Bianchi'],
    synopsis: "Deux sœurs brouillées depuis quinze ans héritent d'une cour d'école désaffectée. Le notaire exige qu'elles décident ensemble.",
  }),
]

const SERIES: Entry[] = [
  serie({
    id: 'les-veilleurs',
    title: 'Les Veilleurs',
    year: 2024, rating: 8.5, popularity: 98, addedAt: '2026-10-09',
    genres: ['Science-fiction', 'Thriller'], director: 'Hélène Vasseur',
    cast: ['Ilona Brecht', 'Samir Lazaar', 'Fédor Melnik'],
    synopsis: "Une station d'écoute abandonnée dans les Vosges se remet à émettre. L'équipe envoyée la fermer comprend qu'elle n'a jamais cessé.",
    seasons: [
      season('les-veilleurs', 1, [
        ['Le signal', "Trois techniciens, une station censée être hors tension depuis 1991.", 52],
        ['Bande passante', "Le signal se répète toutes les onze heures, à la seconde près.", 48],
        ['Relève', "L'équipe précédente a laissé un carnet. Aucune de ses pages n'est datée.", 55],
        ['Point aveugle', "La source n'est pas à l'extérieur de la station.", 51],
        ['Fréquence propre', "Première tentative de réponse.", 58],
      ]),
      season('les-veilleurs', 2, [
        ['Retour de porteuse', "Six mois plus tard, la station est redevenue silencieuse. Trop silencieuse.", 54],
        ['Écho long', "Ce qu'ils ont émis revient, décalé.", 49],
        ['Brouillage', "Quelqu'un d'autre écoute.", 53],
        ['Dernier relevé', "Fin de la deuxième saison.", 61],
      ]),
    ],
  }),
  serie({
    id: 'quartier-nord',
    title: 'Quartier Nord',
    year: 2022, rating: 7.8, popularity: 83, addedAt: '2026-05-02',
    genres: ['Policier', 'Drame'], director: 'Fabrice Oulhen',
    cast: ['Nadège Kouam', 'Bruno Settimo', 'Lila Attar'],
    synopsis: "Un commissariat de quartier perd sa brigade de nuit au profit d'une réforme. Les affaires, elles, continuent d'arriver après vingt heures.",
    seasons: [
      season('quartier-nord', 1, [
        ['Garde descendante', "Dernière nuit avant la réforme.", 47],
        ['Main courante', "Une plainte déposée trois fois, classée trois fois.", 45],
        ['Heures supplémentaires', "L'équipe reste sans y être autorisée.", 49],
        ['Procédure', "L'inspection générale s'intéresse au commissariat.", 46],
      ]),
      season('quartier-nord', 2, [
        ['Mutation', "La brigade est dispersée sur quatre arrondissements.", 48],
        ['Liaison', "Ils continuent de travailler ensemble, officieusement.", 44],
        ['Rapport', "Ce qu'ils trouvent ne peut être versé à aucun dossier.", 52],
      ]),
    ],
  }),
  serie({
    id: 'la-traversee',
    title: 'La Traversée',
    year: 2023, rating: 8.0, popularity: 76, addedAt: '2026-07-21',
    genres: ['Drame', 'Aventure'], director: 'Paul Esterhazy',
    cast: ['Oumou Diagne', 'Henrik Vold'],
    synopsis: "Un cargo met vingt-neuf jours à rallier Montréal. À bord, onze marins et un passager qui n'a pas de raison d'être là.",
    seasons: [
      season('la-traversee', 1, [
        ['Jour 1', "Appareillage du Havre.", 50],
        ['Jour 9', "Le passager connaît le nom de tout le monde.", 48],
        ['Jour 17', "Avarie sur le groupe électrogène.", 53],
        ['Jour 24', "Le commandant consulte le manifeste.", 51],
        ['Jour 29', "Accostage.", 57],
      ]),
    ],
  }),
  serie({
    id: 'les-heures-creuses',
    title: 'Les Heures creuses',
    year: 2021, rating: 7.4, popularity: 59, addedAt: '2026-02-17',
    genres: ['Comédie'], director: 'Serge Kahn',
    cast: ['Fanny Delisle', 'Olivier Barraud', 'Thuy Nguyen'],
    synopsis: "Une piscine municipale entre 14 h et 16 h : trois nageurs réguliers, un maître-nageur qui lit, et aucune raison que cela change.",
    seasons: [
      season('les-heures-creuses', 1, [
        ['Couloir 3', "Un quatrième nageur arrive.", 26],
        ['Bonnet obligatoire', "Le règlement est affiché depuis 1987.", 24],
        ['Vidange annuelle', "Deux semaines de fermeture.", 27],
        ['Réouverture', "Le carrelage a changé de couleur.", 25],
      ]),
      season('les-heures-creuses', 2, [
        ['Nouvelle grille horaire', "Les heures creuses déplacées à 11 h.", 26],
        ['Pétition', "Trois signatures.", 23],
        ['Conseil municipal', "Le dossier passe en point divers.", 28],
      ]),
    ],
  }),
  serie({
    id: 'boussole',
    title: 'Boussole',
    year: 2025, rating: 7.9, popularity: 87, addedAt: '2026-09-25',
    genres: ['Aventure', 'Documentaire'], director: 'Taina Faatau',
    cast: ['Équipage du Kaveka'],
    synopsis: "Six navigateurs polynésiens traversent le Pacifique sans instrument. La série suit l'apprentissage, pas l'exploit.",
    seasons: [
      season('boussole', 1, [
        ['Lire le ciel', "Quarante-huit étoiles à mémoriser avant de partir.", 44],
        ['Lire la houle', "Ce que le corps sait et que les yeux ne voient pas.", 41],
        ['Lire les oiseaux', "À quelle distance de la terre vole un noddi.", 43],
        ['Départ', "Première nuit sans GPS à bord.", 46],
      ]),
    ],
  }),
  serie({
    id: 'le-pli',
    title: 'Le Pli',
    year: 2024, rating: 7.6, popularity: 71, addedAt: '2026-08-14',
    genres: ['Thriller', 'Science-fiction'], director: 'Sophie Nganga',
    cast: ['Esther Vangeon', 'Malik Sarr'],
    synopsis: "Une archiviste trouve dans un fonds notarial un document plié d'une manière qui n'a pas été inventée. Elle décide de ne pas le déplier.",
    seasons: [
      season('le-pli', 1, [
        ['Cote 4-J-112', "Inventaire de routine.", 47],
        ['Papier vergé', "Le papier date de 1740. L'encre, de jamais.", 45],
        ['Expertise', "Trois laboratoires, trois résultats.", 49],
        ['Dépliage', "Elle change d'avis.", 54],
      ]),
    ],
  }),
  serie({
    id: 'sous-les-toits',
    title: 'Sous les toits',
    year: 2024, rating: 7.2, popularity: 64, addedAt: '2026-06-06',
    genres: ['Romance', 'Comédie'], director: 'Lise Haddad',
    cast: ['Capucine Morel', 'Ivan Dragomir'],
    synopsis: "Deux chambres de bonne séparées par une cloison de douze millimètres. Ils se connaissent par les bruits depuis trois ans et ne se sont jamais croisés.",
    seasons: [
      season('sous-les-toits', 1, [
        ['Cloison', "Elle rentre à 23 h 40. Lui part à 6 h 10.", 29],
        ['Palier', "Première occasion manquée.", 27],
        ['Fuite d\'eau', "Le plombier doit passer par les deux chambres.", 31],
        ['Préavis', "L'un des deux déménage.", 33],
      ]),
    ],
  }),
  serie({
    id: 'frequence-8',
    title: 'Fréquence 8',
    year: 2022, rating: 7.1, popularity: 49, addedAt: '2026-01-10',
    genres: ['Science-fiction'], director: 'Idriss Kamara',
    cast: ['Ruben Achkar', 'Soline Trameur'],
    synopsis: "Une radio associative diffuse à 3 h du matin pour douze auditeurs. L'un d'eux écrit avant l'émission pour dire ce qui va être dit.",
    seasons: [
      season('frequence-8', 1, [
        ['Émission 212', "Première lettre.", 42],
        ['Émission 213', "La lettre était exacte.", 40],
        ['Émission 214', "Ils changent le programme sans prévenir.", 44],
        ['Émission 215', "La lettre aussi avait changé.", 47],
      ]),
    ],
  }),
  serie({
    id: 'rives',
    title: 'Rives',
    year: 2023, rating: 8.3, popularity: 80, addedAt: '2026-04-03',
    genres: ['Drame'], director: 'Anouk Tissandier',
    cast: ['Margot Selle', 'Ousmane Baldé', 'Pia Hofstetter'],
    synopsis: "Un fleuve, trois villes, trente ans. Chaque épisode remonte d'une décennie et d'une centaine de kilomètres.",
    seasons: [
      season('rives', 1, [
        ['Estuaire, 2023', "Là où le fleuve finit.", 56],
        ['Confluence, 2013', "Là où il double de volume.", 54],
        ['Barrage, 2003', "Là où on l'a arrêté.", 58],
        ['Source, 1993', "Là où il tient dans une main.", 52],
      ]),
    ],
  }),
  serie({
    id: 'dernier-service',
    title: 'Dernier Service',
    year: 2024, rating: 7.7, popularity: 73, addedAt: '2026-09-11',
    genres: ['Policier', 'Comédie'], director: 'Katarzyna Belmont',
    cast: ['Gilles Abitbol', 'Wendy Castaing'],
    synopsis: "Deux inspecteurs à six semaines de la retraite héritent d'un dossier que personne n'a voulu. Ils comptent bien ne pas le résoudre.",
    seasons: [
      season('dernier-service', 1, [
        ['J-42', "Le dossier arrive par erreur.", 46],
        ['J-30', "Ils commencent à s'y intéresser malgré eux.", 44],
        ['J-14', "Quelqu'un tient à ce qu'ils arrêtent.", 48],
        ['J-1', "Pot de départ reporté.", 52],
      ]),
    ],
  }),
  serie({
    id: 'grand-large',
    title: 'Grand Large',
    year: 2023, rating: 7.5, popularity: 57, addedAt: '2026-03-20',
    genres: ['Documentaire'], director: 'Wim Oosterlinck',
    cast: ['Pêcheurs de Zeebruges'],
    synopsis: "Une saison de pêche filmée depuis la passerelle. Pas de commentaire, pas de musique, le bruit du moteur et les prévisions météo.",
    seasons: [
      season('grand-large', 1, [
        ['Marée 1', "Sortie de trois jours.", 50],
        ['Marée 2', "Avis de coup de vent.", 48],
        ['Marée 3', "Quota atteint en deux jours.", 46],
      ]),
    ],
  }),
  serie({
    id: 'le-banc',
    title: 'Le Banc',
    year: 2025, rating: 7.3, popularity: 68, addedAt: '2026-10-14',
    genres: ['Comédie', 'Drame'], director: 'Pascal Guermeur',
    cast: ['Henri Delacroix', 'Zoé Marchetti'],
    synopsis: "Un banc public, une caméra fixe, et tous ceux qui s'y assoient pendant un an. Personne ne sait qu'il est filmé, tout le monde a signé.",
    seasons: [
      season('le-banc', 1, [
        ['Janvier à mars', "Il fait froid, peu de monde reste.", 38],
        ['Avril à juin', "Le banc devient un lieu de rendez-vous.", 36],
        ['Juillet à septembre', "Un couple revient chaque mercredi.", 39],
        ['Octobre à décembre', "La municipalité annonce des travaux.", 41],
      ]),
    ],
  }),
]

export const CATALOG: Entry[] = [...OPEN_MOVIES, TEST_PATTERN, ...FILMS, ...SERIES]

/* Spread the generated artwork evenly across the catalogue. */
planArtwork(CATALOG.map((e) => e.id))

export const GENRES: string[] = [
  ...new Set(CATALOG.flatMap((e) => e.genres)),
].sort((a, b) => a.localeCompare(b, 'fr'))

export const YEARS: number[] = [
  ...new Set(CATALOG.map((e) => e.year)),
].sort((a, b) => b - a)

export function byId(id: string): Entry | undefined {
  return CATALOG.find((e) => e.id === id)
}

/** Every episode of a series, flattened in running order. */
export function episodesOf(entry: Entry): Episode[] {
  return entry.seasons?.flatMap((s) => s.episodes) ?? []
}

export function episodeById(entry: Entry, episodeId: string): Episode | undefined {
  return episodesOf(entry).find((ep) => ep.id === episodeId)
}

/** What plays when you press Regarder: the film, or the first episode. */
export function playableOf(entry: Entry, episodeId?: string): { sources: Source[]; subtitles?: Subtitle[]; label?: string } {
  if (entry.kind === 'film') {
    return { sources: entry.sources ?? [], subtitles: entry.subtitles }
  }
  const eps = episodesOf(entry)
  const ep = (episodeId ? episodeById(entry, episodeId) : undefined) ?? eps[0]
  if (!ep) return { sources: [] }
  return { sources: ep.sources, subtitles: ep.subtitles, label: `S${entry.seasons?.find((s) => s.episodes.includes(ep))?.number ?? 1} E${ep.number} · ${ep.title}` }
}

export function hasVideo(entry: Entry): boolean {
  if (entry.kind === 'film') return (entry.sources?.length ?? 0) > 0
  return episodesOf(entry).some((ep) => ep.sources.length > 0)
}
