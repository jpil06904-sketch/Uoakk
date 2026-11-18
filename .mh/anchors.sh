#!/bin/bash
F=/workspaces/Uoakk/v5/mehryar-v5.html
for p in 'paintStorage(); sizeInput(); scrollChat();' '${pending ? messageHtml(pending,-1)' 'async function run() {' 'const messageHtml' '<div class="ai-input-row"><textarea' 'function persist(' 'function save(' 'async function callGemini' 'async function callModel' 'function systemPrompt' 'function buildSystem' 'const HEAVY_MODEL' 'const LIGHT_MODEL' 'function chooseModel' 'function classifyIntent' 'async function ask(' 'async function sendToModel' 'generationConfig' 'PANEL_URL' 'MehryarTools.prepare(' 'function hedged' 'raceStrong' '<brain>'; do
  echo "=== $p"; grep -n -F -- "$p" "$F" | cut -c1-220 | head -8
done
