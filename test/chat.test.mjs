import assert from "node:assert/strict";
import { findPassage, parseAnswer, askCourse, reexplain } from "../src/chat/ask.js";
import { buildHistory, selectCourse, MAX_TURNS } from "../src/chat/context.js";
import { setFeedback, insertAfter } from "../src/chat/store.js";

const TEXT = "La prise de la Bastille a lieu\nle 14 juillet 1789 à Paris.\n\nLa nuit du 4 août abolit les privilèges.";

// findPassage : exact, espaces aplatis (renvoie la version du cours), introuvable, trop court
assert.equal(findPassage(TEXT, "La nuit du 4 août abolit les privilèges."), "La nuit du 4 août abolit les privilèges.");
assert.equal(findPassage(TEXT, "a lieu le 14 juillet 1789"), "a lieu\nle 14 juillet 1789");
assert.equal(findPassage(TEXT, "« La nuit du 4 août abolit les privilèges. »"), "La nuit du 4 août abolit les privilèges.");
assert.equal(findPassage(TEXT, "Napoléon est sacré empereur"), null);
assert.equal(findPassage(TEXT, "la"), null);

// parseAnswer
const good = parseAnswer({ reponse: " Ok ", source: "cours", passage: "La nuit du 4 août abolit les privilèges." }, TEXT);
assert.deepEqual(good, { reponse: "Ok", source: "cours", passage: "La nuit du 4 août abolit les privilèges." });
assert.equal(parseAnswer({ reponse: "x", source: "cours", passage: "introuvable dans le cours" }, TEXT).passage, null);
assert.equal(parseAnswer({ reponse: "x", source: "bizarre" }, TEXT).source, "general");
assert.equal(parseAnswer({ reponse: "x", source: "general", passage: "La nuit du 4 août abolit les privilèges." }, TEXT).passage, null);
for (const bad of [null, {}, { reponse: "  " }, { reponse: 3 }, "texte"]) assert.throws(() => parseAnswer(bad, TEXT), { code: "bad_answer" });

// selectCourse : court = entier ; long = blocs pertinents, sous le budget, ordre conservé
assert.deepEqual(selectCourse("abc", ["x"]), { text: "abc", tronque: false });
const long = Array.from({ length: 30 }, (_, i) => `Paragraphe ${i} ` + (i === 21 ? "mitose chromosomes" : "bla ".repeat(150))).join("\n\n");
const sel = selectCourse(long, ["Explique la mitose"], 5000);
assert.equal(sel.tronque, true);
assert.ok(sel.text.length <= 5000);
assert.ok(sel.text.includes("mitose chromosomes"));

// buildHistory : alterne, ré-explication remplace la réponse, borné
const U = (id, content) => ({ id, role: "user", content });
const A = (id, reponse, extra) => ({ id, role: "assistant", reponse, ...extra });
const turns = [U("u1", "q1"), A("a1", "r1"), A("a1b", "r1 simple", { reexplique: "a1" }), U("u2", "q2"), A("a2", "r2")];
assert.deepEqual(buildHistory(turns), [
  { role: "user", content: "q1" }, { role: "assistant", content: "r1 simple" },
  { role: "user", content: "q2" }, { role: "assistant", content: "r2" },
]);
const many = Array.from({ length: 15 }, (_, i) => [U("u" + i, "q" + i), A("a" + i, "r" + i)]).flat();
assert.equal(buildHistory(many).length, MAX_TURNS * 2);
assert.equal(buildHistory(many)[0].content, "q5");

// feedback : compteurs, annulation, changement de vote
let chat = { turns: [A("a1", "r")], counts: { up: 0, down: 0 } };
chat = setFeedback(chat, "a1", "up");   assert.deepEqual(chat.counts, { up: 1, down: 0 });
chat = setFeedback(chat, "a1", "down"); assert.deepEqual(chat.counts, { up: 0, down: 1 });
chat = setFeedback(chat, "a1", "down"); assert.deepEqual(chat.counts, { up: 0, down: 0 });
assert.deepEqual(insertAfter(turns, "a1", A("n", "x")).map((t) => t.id), ["u1", "a1", "a1b", "n", "u2", "a2"]);

// bout en bout avec le mock : historique vide puis non vide ; cours / hors cours / ré-explication
const doc = { id: "d", text: TEXT, onboarding: { consigne: "Tu es un expert en histoire." } };
const a1 = await askCourse({ doc, turns: [], question: "Que s'est-il passé le 14 juillet ?" });
assert.equal(a1.source, "cours");
assert.ok(TEXT.includes(a1.passage));
const t2 = [U("u1", "q"), A("a1", a1.reponse)];
assert.equal((await askCourse({ doc, turns: t2, question: "Et hors cours, la météo ?" })).source, "general");
const re = await reexplain({ doc, turns: t2, targetId: "a1" });
assert.match(re.reponse, /^\[mock simplifié\]/);
await assert.rejects(() => reexplain({ doc, turns: t2, targetId: "nope" }), { code: "bad_target" });
// règles de concision présentes dans le system
import { buildSystem } from "../src/chat/context.js";
const sys = buildSystem({ consigne: "C", cours: "texte", tronque: false });
assert.match(sys, /NEUTRE et EFFICACE/);
assert.match(sys, /sans encouragement/);
assert.match(sys, /BREF/);
assert.match(sys, /3 à 5 phrases/);
assert.match(sys, /Ne termine pas par une question/);
console.log("ok");
