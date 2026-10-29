// Programmes connus (collège, lycée) : listes écrites en dur, donc fiables et sans appel IA.
// Pour les études supérieures il n'existe pas de catalogue : on pose des questions et l'élève déclare ses matières ;
// les raccourcis ci-dessous ne sont que des suggestions cliquables (jamais ajoutées sans son accord).
export const slug = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const NIVEAUX = [
  { value: "college", label: "Collège" },
  { value: "lycee", label: "Lycée" },
  { value: "superieur", label: "Études Sup" },
];

export const COLLEGE = {
  classes: [{ value: "6e", label: "6ème" }, { value: "5e", label: "5ème" }, { value: "4e", label: "4ème" }, { value: "3e", label: "3ème" }],
  matieres: ["Français", "Maths", "Histoire-Géographie-EMC", "Anglais", "Deuxième langue vivante", "SVT", "Physique-Chimie", "Technologie", "Arts plastiques", "Éducation musicale", "EPS"],
};

export const LYCEE = {
  niveaux: [
    { value: "seconde", label: "Seconde (générale et technologique)" },
    { value: "premiere", label: "Première" },
    { value: "terminale", label: "Terminale" },
    { value: "pro", label: "Lycée professionnel" },
  ],
  voies: [{ value: "generale", label: "Voie générale" }, { value: "techno", label: "Voie technologique" }],
  langues: ["Espagnol", "Allemand", "Italien", "Portugais", "Chinois", "Arabe", "Russe", "Autre langue"],
  tronc: {
    seconde: ["Français", "Histoire-Géographie", "EMC", "Maths", "Physique-Chimie", "SVT", "Sciences économiques et sociales", "Sciences numériques et technologie", "EPS"],
    generale_premiere: ["Français", "Histoire-Géographie", "EMC", "Enseignement scientifique", "EPS"],
    generale_terminale: ["Philosophie", "Histoire-Géographie", "EMC", "Enseignement scientifique", "EPS"],
    techno_premiere: ["Français", "Histoire-Géographie", "EMC", "Maths", "EPS"],
    techno_terminale: ["Philosophie", "Histoire-Géographie", "EMC", "Maths", "EPS"],
  },
  specialites: [
    "Maths", "Physique-Chimie", "SVT", "Sciences économiques et sociales", "Histoire-Géographie, Géopolitique et Sciences politiques",
    "Humanités, Littérature et Philosophie", "Langues, Littératures et Cultures Étrangères (Anglais)", "Langues, Littératures et Cultures Étrangères (autre langue)",
    "Numérique et Sciences Informatiques", "Sciences de l'ingénieur", "Arts", "Biologie-Écologie", "Éducation physique, pratiques et culture sportives",
    "Littérature, Langues et Cultures de l'Antiquité",
  ],
  nbSpecialites: { premiere: 3, terminale: 2 },
  options: {
    seconde: ["Latin", "Grec", "Langue vivante C", "Arts", "EPS (option)"],
    premiere: ["Latin", "Grec", "Langue vivante C", "Arts", "EPS (option)"],
    terminale: ["Maths complémentaires", "Maths expertes", "Droit et grands enjeux du monde contemporain", "Latin", "Grec", "Langue vivante C", "Arts", "EPS (option)"],
  },
  series: {
    STMG: ["Management", "Sciences de gestion et numérique", "Droit et économie", "Gestion et finance", "Mercatique (marketing)", "Ressources humaines et communication", "Systèmes d'information de gestion"],
    STI2D: ["Innovation technologique", "Ingénierie, innovation et développement durable", "Physique-Chimie et Maths", "Énergies et environnement", "Architecture et construction", "Systèmes d'information et numérique"],
    ST2S: ["Sciences et techniques sanitaires et sociales", "Biologie et physiopathologie humaines", "Physique-Chimie pour la santé", "Chimie, biologie et physiopathologie humaines"],
    STL: ["Physique-Chimie et Maths", "Biochimie-Biologie", "Biotechnologies", "Sciences physiques et chimiques en laboratoire", "Mesure et instrumentation"],
    STD2A: ["Design et métiers d'art", "Physique-Chimie", "Outils et langages numériques", "Analyse et méthodes en design", "Conception et création en design et métiers d'art"],
    STHR: ["Sciences et technologies culinaires et des services", "Enseignement scientifique alimentation-environnement", "Économie-Gestion hôtelière"],
    "Autre série": [],
  },
  pro: ["Français", "Histoire-Géographie-EMC", "Maths", "Physique-Chimie", "Anglais", "Arts appliqués", "Économie-Gestion", "Prévention-Santé-Environnement", "EPS"],
};

export const SUPERIEUR = {
  formations: ["Licence (université)", "Master (université)", "Classe préparatoire (CPGE)", "BTS", "BUT", "École d'ingénieurs", "École de commerce", "Études de santé (PASS / LAS)", "Autre formation"],
  domaines: ["Droit", "Économie, gestion", "Sciences", "Informatique, ingénierie", "Santé", "Lettres, langues, sciences humaines", "Arts, design", "Autre domaine"],
  annees: ["1re année", "2e année", "3e année", "4e année", "5e année ou plus"],
  // suggestions cliquables par domaine (l'élève reste libre d'ajouter les siennes)
  raccourcis: {
    "Droit": ["Introduction au droit", "Droit civil", "Droit constitutionnel", "Droit pénal", "Droit administratif", "Droit des contrats", "Droit des affaires", "Droit européen", "Histoire du droit"],
    "Économie, gestion": ["Microéconomie", "Macroéconomie", "Comptabilité", "Finance", "Marketing", "Management", "Statistiques", "Maths", "Droit des affaires"],
    "Sciences": ["Maths", "Algèbre", "Analyse", "Physique", "Chimie", "Biologie", "Statistiques", "Informatique", "Mécanique"],
    "Informatique, ingénierie": ["Algorithmique", "Programmation", "Bases de données", "Réseaux", "Maths", "Électronique", "Mécanique", "Thermodynamique", "Systèmes d'exploitation"],
    "Santé": ["Anatomie", "Physiologie", "Biochimie", "Biologie cellulaire", "Histologie", "Pharmacologie", "Santé publique", "Chimie", "Biostatistiques"],
    "Lettres, langues, sciences humaines": ["Littérature", "Histoire", "Géographie", "Philosophie", "Sociologie", "Psychologie", "Linguistique", "Anglais"],
    "Arts, design": ["Histoire de l'art", "Théorie et analyse", "Pratique artistique", "Culture numérique", "Anglais"],
    "Autre domaine": [],
  },
  // questions guidées pour ne rien oublier (chaque « oui » ajoute une matière)
  guides: [
    { question: "As-tu des cours de langue vivante ?", ajoute: "Anglais" },
    { question: "As-tu des cours de méthodologie ou de projet ?", ajoute: "Méthodologie" },
    { question: "As-tu une option ou un enseignement d'ouverture ?", ajoute: "Option" },
  ],
};
