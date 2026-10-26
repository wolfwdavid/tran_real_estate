// Constructable-sheet text for the reveal pill (UI-SPEC Color B + Component Inventory B).
// Adopted inside each pill's closed shadow root, never injected as a <style> element.
// Every hex is a Phase 2 token: foreground #2b1d16, background #fbf7f0,
// muted-foreground #5c4a3e, surface #f2e9db. brand-parity.test.ts enforces this.
// No web fonts: loading one on zillow.com would need web_accessible_resources.
export const PILL_CSS = `
:host { all: initial; }
button { all: initial; box-sizing: border-box; position: relative; display: inline-flex; align-items: center; min-height: 32px; padding: 0 8px; border-radius: 9999px; font: 600 14px/20px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; white-space: nowrap; cursor: pointer; touch-action: manipulation; background: #2b1d16; color: #fbf7f0; box-shadow: 0 0 0 2px #fbf7f0; outline: 2px solid transparent; outline-offset: 4px; transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1); }
button::before { content: ''; position: absolute; inset: -8px 0; }
button[data-state='revealed'] { background: #fbf7f0; color: #2b1d16; box-shadow: 0 0 0 2px #2b1d16; }
@media (hover: hover) { button:hover { background: #5c4a3e; } button[data-state='revealed']:hover { background: #f2e9db; } }
button:focus-visible { box-shadow: 0 0 0 2px #fbf7f0, 0 0 0 4px #2b1d16, 0 0 0 6px #fbf7f0; }
button[data-state='revealed']:focus-visible { box-shadow: 0 0 0 2px #2b1d16, 0 0 0 4px #fbf7f0, 0 0 0 6px #2b1d16; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (forced-colors: active) { button, button[data-state='revealed'] { background: ButtonFace; color: ButtonText; border: 1px solid ButtonText; box-shadow: none; } }
@media (prefers-reduced-motion: reduce) { button { transition: none; } }
`;
