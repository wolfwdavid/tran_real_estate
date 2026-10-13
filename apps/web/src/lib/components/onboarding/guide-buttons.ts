// Button classes shared by the guide and its lazily loaded tour panel (plain elements, no
// tailwind-variants, to keep the landing bundle small).
const base =
	'inline-flex min-h-12 cursor-pointer touch-manipulation items-center justify-center gap-1 rounded-md px-6 text-body font-semibold whitespace-nowrap transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const BTN = {
	base,
	primary: `${base} bg-primary text-primary-foreground hover:bg-primary-hover`,
	outline: `${base} border border-border-strong text-foreground hover:bg-surface`,
	link: `${base} text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2`
};
