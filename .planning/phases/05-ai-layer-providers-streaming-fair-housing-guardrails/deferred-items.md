# Phase 5 deferred items

## Carried forward (open)

- **OPEN, carried from Phase 4 (04-14) to Phase 6+ (UI).** tailwind-merge drops the custom
  font-size tokens `text-label` / `text-body` when a variant adds a text colour
  (`twMerge('text-label text-muted-foreground')` returns `text-muted-foreground`), so Phase 3
  Badge/Button render at the inherited size. Fix: `extendTailwindMerge` with
  `classGroups: { 'font-size': [{ text: ['label', 'body', 'heading', 'display'] }] }` in
  `$lib/utils.ts` and the `tv()` config, plus a test. Phase 5 components avoided the collision with
  `text-base leading-[1.6]`. Not fixed in Phase 5 by decision (05-16 scope is the gate). Fix it before
  Phase 6 adds more badge-heavy UI.

## Recorded at the gate (05-16)

- **Testing lesson (05-14).** The `DraftHistory` `bind:ref` crash surfaced only in a real-browser
  test. SSR render-only tests can't exercise ref binding or focus. Any component that binds a
  ref and moves focus needs a `*.browser.test.ts` or an E2E step, not only an SSR test.
- **Orchestrator fix (01b3375).** After AI cards gained a model `<code>`, `settings-keys.spec.ts`
  scopes the provider-card host assertion to `c.locator('code').first()`. No product change.
- **Rescoped test (05-16).** `settings-keys.spec.ts` "no Test key button without a registered
  tester" passed only because AI cards label the button "Test connection". It is now "AI key cards
  offer Test connection, never Test key, including after a reload", which asserts the button is
  present (also after a remembered-key reload) and that "Test key" is absent. Settings now
  registers a tester for every provider, so production can no longer show "a saved key with no
  tester". The registry is still covered by `testers.test.ts` (none registered by default,
  register/unregister) and `testers.svelte.browser.test.ts` (reactivity). The card's
  `{#if hasKeyTester(id)}` guard is unchanged.
- **Owner-gated live checks** live in `05-HUMAN-UAT.md` (H1-H10). They are non-blocking.
