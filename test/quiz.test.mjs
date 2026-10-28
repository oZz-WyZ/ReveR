import assert from "node:assert/strict";
import { parseQuiz, shuffle, generateQuiz, quizSize } from "../src/quiz/generate.js";
import { createRun } from "../src/quiz/run.js";
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

// plafond : QUIZ_MAX par défaut, ou le nombre demandé
const nine = { questions: Array.from({ length: 12 }, () => Q()) };
assert.equal(parseQuiz(nine, TEXT).length, 10);
assert.equal(parseQuiz(nine, TEXT, Math.random, 4).length, 4);

// quizSize : 1 question par ~2000 caractères, borné 3..10
for (const [len, n] of [[0, 3], [1500, 3], [6000, 3], [6001, 4], [12000, 6], [19999, 10], [20000, 10], [500000, 10]]) {
  assert.equal(quizSize("x".repeat(len)), n, `${len} car. -> ${n}`);
}

// déroulé : choisir, valider, suivante ; score cumulé ; garde-fous
const qs = [0, 1, 2].map((c) => ({ question: "q" + c, options: ["a", "b", "c", "d"], correctIndex: c, passage: c === 1 ? null : "p" + c }));
const run = createRun(qs);
assert.equal(run.validate(), null);                 // rien choisi
assert.equal(run.next(), false);                    // pas validée -> pas de saut
assert.deepEqual([run.n, run.total], [1, 3]);
run.pick(0);
assert.deepEqual(run.validate(), { ok: true, picked: 0, correctIndex: 0, passage: "p0" });
assert.equal(run.validate(), null);                 // pas de double validation
run.pick(3); assert.equal(run.picked, 0);           // verrouillé après validation
assert.equal(run.next(), false); assert.equal(run.n, 2);
run.pick(3);
assert.deepEqual(run.validate(), { ok: false, picked: 3, correctIndex: 1, passage: null });
assert.equal(run.next(), false);
assert.equal(run.last, true);
run.pick(2); run.validate();
assert.equal(run.next(), true);                     // fin
assert.equal(run.score, 2);

// clic direct : réponse définitive puis question suivante ; corrections gardées pour la fin
const run2 = createRun(qs);
assert.equal(run2.answer(0), false);                 // bonne réponse, il en reste
assert.equal(run2.n, 2);
assert.equal(run2.answer(9), false);                 // option invalide ignorée
assert.equal(run2.n, 2);
assert.equal(run2.answer(3), false);                 // mauvaise réponse
assert.equal(run2.answer(2), true);                  // dernière : terminé
assert.equal(run2.score, 2);
assert.deepEqual(run2.answers.map((a) => a.ok), [true, false, true]);
assert.equal(run2.answers[1].options[run2.answers[1].picked], "d");
assert.equal(run2.answers[0].passage, "p0");

// mock : n demandé lu dans le prompt

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
assert.equal(r.questions.length, quizSize(doc.text)); // cours court -> 3
assert.equal(r.tronque, false);
for (const q of r.questions) assert.ok(doc.text.includes(q.passage), "passage réel du cours");
assert.ok(r.questions.some((q) => /Bastille/.test(q.passage)) && r.questions.some((q) => /Louis XVI/.test(q.passage)));
// cours long : plus de questions (6 pour ~12000 car.), toutes tirées du cours
const longDoc = { ...doc, text: Array.from({ length: 60 }, (_, i) => `Fait numéro ${i} : ${"le cours explique ceci en détail ".repeat(5)}.`).join("\n\n") };
const rl = await generateQuiz({ doc: longDoc });
assert.equal(rl.questions.length, quizSize(longDoc.text));
assert.ok(rl.questions.length > 3);
for (const q of rl.questions) assert.ok(longDoc.text.includes(q.passage));
await assert.rejects(() => generateQuiz({ doc: { ...doc, text: "Trop court." } }), { code: "bad_quiz" });
console.log("ok");
