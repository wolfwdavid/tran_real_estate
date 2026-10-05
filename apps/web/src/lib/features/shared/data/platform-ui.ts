// Phase 3 UI pieces under fixed names for Phase 4 data components. If a Phase 3 component moves,
// only this file changes.
export { Button, buttonVariants, type ButtonProps } from '$lib/components/ui/button/index.js';
export { Badge, badgeVariants, type BadgeVariant } from '$lib/components/ui/badge/index.js';
export { Input } from '$lib/components/ui/input/index.js';
export { Label } from '$lib/components/ui/label/index.js';
export * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
export * as RadioGroup from '$lib/components/ui/radio-group/index.js';
export { default as ConfirmDialog } from '$lib/features/shared/settings/ConfirmDialog.svelte';
export { announce } from '$lib/components/a11y/announcer.svelte';
