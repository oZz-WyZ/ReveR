#!/bin/sh
# SessionStart : si le dernier contrôle des consignes date de plus de 7 jours, demande à Claude de lancer l'agent doc-freshness.
# La date du dernier contrôle est écrite par l'agent dans .claude/.doc-check (fichier local, ignoré par git).
stamp="${CLAUDE_PROJECT_DIR:-.}/.claude/.doc-check"
now=$(date +%s)
last=$(date -j -f %F "$(cat "$stamp" 2>/dev/null)" +%s 2>/dev/null || date -d "$(cat "$stamp" 2>/dev/null)" +%s 2>/dev/null || echo 0)
[ $((now - last)) -lt 604800 ] && exit 0
jq -n '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: "VEILLE DES CONSIGNES (demande permanente de l utilisateur, autorisation donnee dans CLAUDE.md) : le dernier contrôle des .md et de la config .claude date de plus de 7 jours. Au début de cette session, avant le reste, lance en arrière-plan l agent doc-freshness (Agent, subagent_type doc-freshness). Quand il a fini, résume en 3 lignes ce qu il a corrigé et ce qui demande une décision, puis commite en local les fichiers qu il a modifiés. Ne pousse pas."}}'
