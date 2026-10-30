---
phase: 5
slug: ai-layer-providers-streaming-fair-housing-guardrails
status: superseded
superseded_by: .planning/HUMAN-UAT.md
source: [05-RESEARCH.md "Deferred Live Checks" and "Open Questions" 1 and 5, 05-VALIDATION.md "Manual-Only Verifications", 05-15 and 05-16 executor notes]
created: 2026-10-05
updated: 2026-10-05
blocking: false
---
> Superseded on 2026-10-30 by `.planning/HUMAN-UAT.md` (Phase 13 ledger). This file is kept as history; record results in the ledger.

# Phase 5: Live AI provider UAT (deferred, owner-gated)

**Status: pending until the owner creates the `tranrealestate` GitHub organization, deploys the
site to `https://tranrealestate.github.io/`, and creates real, spend-limited provider keys.**
These checks do not block Phases 6-9. Automation already covers every behaviour below with all
four providers mocked: unit and SSR tests, plus Playwright on both base paths under the
production meta CSP (`ai-drafting`, `ai-guardrails` and `ai-a11y` specs). Automation cannot reach
the providers' real CORS edges, real key validation, or real request-parameter acceptance.

## Ground rules

- Run from the **deployed origin** `https://tranrealestate.github.io/settings/` (CORS answers
  depend on the origin). A local `corepack pnpm dev` session is fine only for H4 and H5 parameter
  checks. If CORS fails there, repeat on the deployed origin before you treat it as a finding.
- Use a **dedicated key per provider, created only for this UAT, with the lowest spending limit
  the provider allows** (Anthropic workspace limit, OpenAI project budget, Google Cloud budget
  alert, OpenRouter credit limit). Never commit a key or paste one into an issue, chat,
  screenshot or log. Revoke every key when done.
- Keep the default "This tab only" key mode, so keys are gone when the tab closes.
- DevTools → Network with "Preserve log" on. Record **status codes, header names and counts
  only**, never response bodies and never header values that contain a key.
- If a row's result differs from Expected, the "If different" column names the change. Make it in
  a normal GSD plan with its test, not ad hoc.

## Checklist

| # | Check | Expected | If different | Result |
|---|-------|----------|--------------|--------|
| H1 | Per provider: Test connection, streaming, Stop, usage (steps A) | Each provider: "{Provider} accepted this key." + "Model {default} is available."; text streams word by word; Stop halts within about 1 s and keeps the partial text; the usage line shows plausible tokens and "about $… on your {Provider} account" (OpenRouter: the reported cost) | Model not listed: update the default in `apps/web/src/lib/ai/models.ts`. Stop slow: check the adapter's abort path. | [pending] |
| H2 | Wrong key per provider (steps B) | Generation shows "{Provider} didn't accept your key" with **Open AI settings**. **OpenAI specifically** shows "OpenAI didn't accept your key", not "OpenAI is blocking this site right now" (the disambiguation probe, because OpenAI's bad-key 401 has no CORS header) | If OpenAI shows the CORS card with a bad key: the keyed probe in `disambiguateFetchFailure` (`apps/web/src/lib/ai/providers/test-connection.ts`) is not CORS-readable on the real edge; plan a fix | [pending] |
| H3 | Gemini key types (steps C) | A new AI Studio key works and is sent only in the `x-goog-api-key` header (never `?key=` in the URL). An old unrestricted standard key, if you have one, either works or shows the sensible auth copy "Google Gemini didn't accept your key" | Confusing copy: adjust the Gemini auth mapping (`classifyHttp` in `packages/core/src/ai/errors.ts`) and the UI copy | [pending] |
| H4 | Default-model extras accepted (steps D) | No 400 on any default model: Gemini `thinkingConfig.thinkingLevel: 'low'` on `gemini-3.8-flash` (RESEARCH Open Question 1: enum casing on `generateContent` REST is unverified); Anthropic `thinking: { type: 'between_tools' }` + `output_config: { effort: 'low' }` on `claude-sonnet-5-5`; OpenAI `reasoning: { effort: 'low' }` on `gpt-6.1-sol` | A 400 naming the field: change that one value in `PROVIDERS[...].models[...].extras` in `apps/web/src/lib/ai/models.ts` (Gemini: try `'LOW'`, else drop the extra) and update `models.test.ts` | [pending] |
| H5 | OpenRouter privacy routing | With `provider.data_collection: 'deny'`, `anthropic/claude-sonnet-5.5` streams (no 404 "no allowed providers") | 404: pick an OpenRouter default model with a no-data-collection provider in `models.ts`; never drop `deny` | [pending] |
| H6 | Network hygiene in DevTools (steps E) | No key in any URL (no `key=` anywhere); request headers match the verified sets below; every request goes to `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com` or `openrouter.ai` (plus the app's own origin); no CSP violation in the console | Any key in a URL or any off-list host is a **stop-ship** bug: open a GSD debug session | [pending] |
| H7 | Launch-day CORS re-probe (steps F) | Keyless preflights (OPTIONS) and canaries for all four generation endpoints still return CORS-readable answers for `Origin: https://tranrealestate.github.io`. Also record OpenAI's 429 and 5xx on `/v1/responses`: do they carry `access-control-allow-origin`? (RESEARCH Open Question 5; the disambiguation probe covers either answer) | A provider that stopped answering CORS: the panel already shows its cors-blocked card with **Set up OpenRouter**; record it and decide whether to hide that provider | [pending] |
| H8 | Model IDs and prices re-verified before launch | `claude-sonnet-5-5`, `gpt-6.1-sol`, `gemini-3.8-flash`, `anthropic/claude-sonnet-5.5` still current on each provider's models page. RESEARCH is valid until **2026-10-18**. The `claude-haiku-4-5` retirement window opens **2026-10-15** (it is not a default). Gemini 3.8 Flash prices double on **2027-01-01** (already a date-effective pricing row) | Update `apps/web/src/lib/ai/models.ts` defaults / pricing rows + `models.test.ts` | [pending] |
| H9 | Legal review of the Fair Housing lexicon | A qualified reviewer signs off on the wording, severities (Must fix vs Review) and alternatives in `packages/core/src/fair-housing/lexicon.ts` before the public GTM push. The in-app copy already says "These flags are a plain-language check … They're not legal advice." | Edit lexicon entries in a GSD plan; the leave-one-out mutation suite (`mutation.test.ts`) must stay green | [pending] |
| H10 | Remembered key shows Test connection after a reload | Remember mode, save a key, reload Settings several times: every AI card with a key shows **Test connection** (05-16 made the tester registry reactive, so a card that renders before the AI testers register still updates) | Button missing: the registry reactivity regressed (`apps/web/src/lib/storage/secrets/testers.ts`) | [pending] |

### Verified request header sets (H6)

| Provider | Generation request headers (names only) |
|----------|------------------------------------------|
| Anthropic `POST /v1/messages` | `content-type`, `x-api-key`, `anthropic-version`, `anthropic-dangerous-direct-browser-access` |
| OpenAI `POST /v1/responses` | `content-type`, `authorization` (body has `store: false`) |
| Google Gemini `POST /v1beta/models/{model}:streamGenerateContent?alt=sse` | `content-type`, `x-goog-api-key` |
| OpenRouter `POST /api/v1/chat/completions` | `content-type`, `authorization`, `x-openrouter-title` (body has `provider.data_collection: 'deny'`) |

Keyless canaries (Test connection) carry no key header at all.

## Steps

### A. Real key, per provider (H1)

1. Open `https://tranrealestate.github.io/settings/#api-keys` with DevTools → Network open.
2. On the provider's card paste the dedicated key, click **Save key**. Expected: no request yet.
3. Click **Test connection**. Expected: one keyed models/key request and one keyless canary, no
   generation; lines "{Provider} accepted this key." and "Model {default} is available."
4. In **AI drafting**, choose the provider under **Draft with**. For Google Gemini, the "Send
   client details to Gemini?" dialog opens first: focus is on **Don't send to Gemini**; choose
   **Send to Gemini**.
5. Click **Generate draft**. Expected: "Connecting to {Provider}…", then words stream in, then
   "Draft ready." and a usage line.
6. Click **Generate again**, then **Stop** after a few words. Expected: streaming halts within
   about 1 s; "Stopped. The partial draft is kept, so you can edit it, use it, or generate again.";
   the partial text stays. (Stop before any word arrives reads "Stopped before any text arrived.
   Nothing was saved, so you can generate again.")

### B. Wrong key (H2)

1. On the provider card click **Replace key**, paste the key with its last character changed,
   **Save key**.
2. **Generate draft**. Expected: the error card "{Provider} didn't accept your key" with
   **Open AI settings**. For OpenAI, DevTools shows the generation request failing (CORS) and then
   one keyed `GET /v1/models` with 401; the card still says "OpenAI didn't accept your key".
3. **Test connection** with the wrong key. Expected: "{Provider} didn't accept this key. Check that
   you copied all of it, or create a new key."

### C. Gemini key types (H3)

1. New AI Studio key: steps A for Google Gemini. In DevTools the `streamGenerateContent` URL has
   only `?alt=sse`, and the key is only in the `x-goog-api-key` request header.
2. An old unrestricted standard key (only if you already have one; do not create one): steps A.
   Record whether it works or which status and copy appear.

### D. Default extras (H4)

1. For each of Anthropic, OpenAI and Google Gemini with **Use default** model, run steps A.5.
2. Expected: HTTP 200 streams. A 400 whose error names `thinkingLevel`, `thinking`,
   `output_config`/`effort` or `reasoning` means that extra is not accepted: record the field and
   the status (not the body).

### E. Network hygiene (H6)

1. With all four keys saved, run one generation per provider and one Test connection per provider.
2. Network filter: `key=` → expected zero matches. Check each request's **Request Headers** names
   against the table above (do not copy values).
3. Console: expected no "Content Security Policy" errors.

### F. Launch-day CORS re-probe (H7)

Run from a terminal, with no keys. The requests prove the generation endpoints answer the origin
with CORS headers, without spending tokens:

```bash
ORIGIN=https://tranrealestate.github.io
for url in https://api.anthropic.com/v1/messages https://api.openai.com/v1/responses \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse" \
  https://openrouter.ai/api/v1/chat/completions; do
  echo "== $url"
  curl -s -o /dev/null -D - -X OPTIONS "$url" -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" | grep -i -E "^HTTP|access-control-allow"
  curl -s -o /dev/null -D - -X POST "$url" -H "Origin: $ORIGIN" \
    -H "content-type: application/json" -d '{}' | grep -i -E "^HTTP|access-control-allow-origin"
done
```

Expected: every preflight allows `POST` for the origin, and every keyless POST returns a 4xx that
carries `access-control-allow-origin`. Record any OpenAI 429/5xx you see during H1 and whether it
carried the header.

## Known behaviour recorded at the gate (05-16)

- **Stop before the first word.** Fixed in 05-16 (`826a61d`): the status now reads "Stopped
  before any text arrived. Nothing was saved, so you can generate again." It no longer claims a
  partial draft was kept. No row is saved.
- **AI testers register asynchronously.** Fixed in 05-16 (`748d4e9`): the key tester registry is
  a `SvelteMap`, so a card that rendered first updates. H10 re-checks this on the real origin.
- **Only locked keys and no stored preference.** Fixed in 05-16 (`d9aa087`): the picker and panel
  default to the first locked provider, so a run shows "Your keys are locked" with **Unlock in
  Settings**. Before the fix they showed the false "No AI key yet" sample notice.

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0
