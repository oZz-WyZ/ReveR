// Genre probable d'un prénom, uniquement pour choisir les illustrations de l'onboarding.
// Listes de prénoms courants en France : un prénom mixte ou inconnu renvoie null (l'app pose alors la question).
const list = (s) => new Set(s.split(/\s+/));
const FILLE = list(`
  emma jade louise alice lina chloe rose anna mila lea manon ines camille zoe eva sarah juliette lola nina clara jeanne
  lucie agathe romane charlotte maelys lena margaux eleonore capucine pauline marie sophie laura julie marion oceane
  anais clemence elise amelie manon noemie ambre victoria mathilde mia ava maeva yasmine fatima sofia salome apolline
  celia melissa justine elodie laurence nathalie isabelle sandrine valerie christine catherine sylvie martine nicole
  lisa luna iris romy zelie aurore lise elsa elena leonie albane constance diane flore gabrielle helene irene
  josephine judith lilou lily maya noa nora olivia sasha tess thea violette adele amandine axelle bastienne estelle
  fanny florence hortense inaya jasmine kenza lena maelle melanie morgane nadia oriane rania sabrina salma tiphaine
`);
const GARCON = list(`
  gabriel louis raphael jules adam lucas leo hugo arthur nathan liam ethan paul tom noah sacha maxime antoine enzo
  mathis theo victor alexandre nicolas thomas pierre julien romain clement baptiste quentin valentin kevin florian
  guillaume benjamin jeremy maxence matteo ruben samuel simon adrien axel bastien dylan elias etienne felix fabien
  francois henri hector jean jacques jerome laurent loic marc martin mathieu michel olivier patrick philippe remi
  robin sebastien stephane thibault timothe tristan vincent yanis yann yohan youssef karim mohamed ahmed ali omar
  rayan ismael ilyes lenny logan marius milo nolan oscar tiago william xavier david daniel bruno cedric christophe
  damien denis eric fabrice franck gregory guy herve jonathan lilian mael mattias nael nils owen rafael
`);
const MIXTE = list(`
  camille charlie dominique claude alix andrea ange eden gaby gabin ilan lou maxime sacha sasha yael
  noa noe swann yannick morgan sam sidney jordan ayden loan
`);

/** "fille", "garcon", ou null si le prénom est mixte ou inconnu. */
export function guessGenre(prenom) {
  const n = String(prenom ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().split(/[\s-]+/)[0];
  if (!n || MIXTE.has(n)) return null;
  return FILLE.has(n) !== GARCON.has(n) ? (FILLE.has(n) ? "fille" : "garcon") : null;
}
