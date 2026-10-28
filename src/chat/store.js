import { storage } from "../storage.js";

const key = (docId) => "chat:" + docId;

export const loadChat = (docId) => storage.get(key(docId), { turns: [], counts: { up: 0, down: 0 } });
export const saveChat = (docId, chat) => storage.set(key(docId), chat);

/** Vote sur une réponse ; le même vote une seconde fois l'annule. Renvoie un nouveau chat (compteurs à jour). */
export function setFeedback(chat, turnId, vote) {
  const counts = { ...chat.counts };
  const turns = chat.turns.map((t) => {
    if (t.id !== turnId) return t;
    const next = t.feedback === vote ? null : vote;
    if (t.feedback) counts[t.feedback]--;
    if (next) counts[next]++;
    return { ...t, feedback: next };
  });
  return { ...chat, turns, counts };
}

/** Insère une ré-explication juste après la réponse visée (et ses ré-explications) : buildHistory garde la dernière. */
export function insertAfter(turns, targetId, turn) {
  let j = turns.findIndex((t) => t.id === targetId) + 1;
  while (turns[j]?.role === "assistant") j++;
  return [...turns.slice(0, j), turn, ...turns.slice(j)];
}
