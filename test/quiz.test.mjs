import assert from "node:assert/strict";
import { parseQuiz, shuffle, generateQuiz } from "../src/quiz/generate.js";
import { selectCoverage, buildSystem, MAX_COURS_CHARS } from "../src/chat/context.js";

const TEXT = "La prise de la Bastille a lieu le 14 juillet 1789 à Paris.\n\nLa nuit du 4 août abolit les privilèges féodaux.\n\nLa Déclaration des droits de l'homme est adoptée le 26 août 1789.";
const Q = (extra = {}) => ({ question: "Quand a lieu la prise de la Bastille ?", options: ["14 juillet 1789", "4 août 1789", "26 août 1789", "9 thermidor"], correctIndex: 0, passage: "La prise de la Bastille a lieu le 14 juillet 1789 à Paris.", ...extra });

// shuffle : permutation, déterministe avec rnd fixé
assert.deepEqual(shuffle([1, 2, 3, 4], () => 0).sort(), [1, 2, 3, 4]);
assert.deepEqual(shuffle([1, 2, 3, 4], () => 0.99), [1, 2, 3, 4]);

// parseQuiz : valide ; la bonne réponse reste la bonne après mélange
for (const rnd of [() => 0, () => 0.5, () => 0.99, Math.random]) {
  const [q] = parseQuiz({ questions: [Q()] }, TEXT, rnd);
  assert.equal(q.options[q.correctIndex], "14 juillet 1789");
  assert.equal(q.options.length, 4);
}
assert.equal(parseQuiz({ questions: [Q()] }, TEXT)[0].passage, "La prise de la Bastille a lieu le 14 juillet 1789 à Paris.");

// questions invalides écartées, les bonnes gardées
const mixed = parseQuiz({ questions: [
  Q({ question: "  " }), Q({ options: ["a", "b", "c"] }), Q({ options: ["a", "A", "c", "d"] }), Q({ options: ["a", "b", "", "d"] }),
  Q({ correctIndex: 4 }), Q({ correctIndex: 1.5 }), Q({ correctIndex: "0" }), null, "x", Q(),
] }, TEXT);
assert.equal(mixed.length, 1);

// passage introuvable ou absent -> null, la question reste
assert.equal(parseQuiz({ questions: [Q({ passage: "phrase absente du cours entierement" })] }, TEXT)[0].passage, null);
assert.equal(parseQuiz({ questions: [Q({ passage: undefined })] }, TEXT)[0].passage, null);

// plafond à QUIZ_SIZE
assert.equal(parseQuiz({ questions: Array.from({ length: 9 }, () => Q()) }, TEXT).length, 5);

// rien d'exploitable -> bad_quiz
for (const bad of [null, {}, { questions: [] }, { questions: "x" }, { questions: [Q({ correctIndex: 9 })] }]) {
  assert.throws(() => parseQuiz(bad, TEXT), { code: "bad_quiz" });
}

// selectCoverage : court = entier ; long = blocs espacés du début à la fin, sous le budget
assert.deepEqual(selectCoverage("abc"), { text: "abc", tronque: false });
const long = Array.from({ length: 80 }, (_, i) => `SECTION-${i} ` + "x".repeat(1500)).join("\n\n");
const cov = selectCoverage(long, 20000);
assert.equal(cov.tronque, true);
assert.ok(cov.text.length <= 20000);
assert.ok(cov.text.includes("SECTION-0 "));
assert.ok(cov.text.includes("SECTION-79 "));
const ids = [...cov.text.matchAll(/SECTION-(\d+) /g)].map((m) => Number(m[1]));
assert.ok(ids.some((n) => n > 25 && n < 55), "des sections du milieu");
assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
assert.ok(MAX_COURS_CHARS >= 60000);

// buildSystem : règles personnalisées à la place de celles du chat
const sys = buildSystem({ consigne: "C", cours: "texte", tronque: false, rules: "REGLES-QUIZ" });
assert.match(sys, /REGLES-QUIZ/);
assert.doesNotMatch(sys, /source/);

// bout en bout avec le mock : 5 questions réparties ; un cours sans phrase exploitable échoue proprement
const doc = { id: "d", text: TEXT + "\n\nLa monarchie constitutionnelle dure jusqu'en 1792 avant la chute.\n\nLouis XVI est exécuté en janvier 1793 sur la place publique.", onboarding: { consigne: "Tu es un expert." } };
const r = await generateQuiz({ doc });
assert.equal(r.questions.length, 5);
assert.equal(r.tronque, false);
for (const q of r.questions) assert.ok(doc.text.includes(q.passage), "passage réel du cours");
assert.ok(r.questions.some((q) => /Bastille/.test(q.passage)) && r.questions.some((q) => /Louis XVI/.test(q.passage)));
await assert.rejects(() => generateQuiz({ doc: { ...doc, text: "Trop court." } }), { code: "bad_quiz" });
console.log("ok");
