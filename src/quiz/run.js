// Déroulé d'un quiz, une question à la fois : choisir, valider (correction immédiate), suivante. Logique pure.
export function createRun(questions) {
  let i = 0, picked = null, answered = false, score = 0;
  return {
    total: questions.length,
    get n() { return i + 1; },
    get question() { return questions[i]; },
    get picked() { return picked; },
    get answered() { return answered; },
    get score() { return score; },
    pick(j) { if (!answered && j >= 0 && j < 4) picked = j; },
    /** Correction de la question courante, ou null si rien n'est choisi / déjà validée. */
    validate() {
      if (answered || picked === null) return null;
      answered = true;
      const q = questions[i];
      const ok = picked === q.correctIndex;
      if (ok) score++;
      return { ok, picked, correctIndex: q.correctIndex, passage: q.passage };
    },
    /** Passe à la suite ; renvoie true quand le quiz est terminé. Sans effet tant que la question n'est pas validée. */
    next() {
      if (!answered) return false;
      if (i === questions.length - 1) return true;
      i++; picked = null; answered = false;
      return false;
    },
    get last() { return i === questions.length - 1; },
  };
}
