# Phase 4 deferred items

## From 04-14

- **Phase 3 Badge/Button lose their font-size token class (pre-existing, out of scope).**
  `tailwind-variants`/`tailwind-merge` treat custom `text-label` / `text-body` as text-colour
  utilities, so the variant colour (`text-muted-foreground`, `text-foreground`, ...) drops them:
  `twMerge('text-label text-muted-foreground')` returns `text-muted-foreground`. Badge then renders
  at the inherited size instead of Label 14px. Fix: `extendTailwindMerge` with
  `classGroups: { 'font-size': [{ text: ['label', 'body', 'heading', 'display'] }] }` in
  `$lib/utils.ts` and the `tv()` config. 04-14's chips build their own class string (no merge) and
  are unaffected.
- **Vitest browser failure artifacts are untracked, not gitignored.** Failing browser tests write
  `apps/web/.vitest-attachments/` and `src/**/__screenshots__/`. Add both to `.gitignore`.
