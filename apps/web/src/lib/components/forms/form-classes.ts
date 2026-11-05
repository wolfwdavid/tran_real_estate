// Static copies of the Button default and ghost classes for the marketing forms (DEBT-09): the
// shadcn Button pulls tailwind-variants + tailwind-merge into the initial JS. form-classes.test.ts
// keeps these token-equal to buttonVariants(), so the two cannot drift.
const BASE =
	'inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-1 rounded-md text-body font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-muted-foreground aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0';
export const PRIMARY_BUTTON_CLASS = `${BASE} bg-primary text-primary-foreground hover:bg-primary-hover h-12 min-w-11 px-6`;
export const GHOST_BUTTON_CLASS = `${BASE} bg-transparent text-foreground hover:bg-surface h-12 min-w-11 px-6`;
