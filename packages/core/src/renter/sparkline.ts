// Sparkline geometry (RENT-03). Pure: numeric series in, SVG path string out. No DOM.
// The component decides the minimum number of points it is willing to draw.

function coords(values: readonly number[], w: number, h: number, pad: number) {
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	return values.map((v, i) => ({
		x: pad + (i * (w - 2 * pad)) / (values.length - 1),
		y: h - pad - ((v - min) * (h - 2 * pad)) / span
	}));
}

const drawable = (values: readonly number[]) =>
	values.length >= 2 && values.every((v) => Number.isFinite(v));

export function sparklinePath(
	values: readonly number[],
	w: number,
	h: number,
	pad = 2
): string | null {
	if (!drawable(values)) return null;
	return coords(values, w, h, pad)
		.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
		.join(' ');
}

export function lastPoint(
	values: readonly number[],
	w: number,
	h: number,
	pad = 2
): { x: number; y: number } | null {
	if (!drawable(values)) return null;
	const pts = coords(values, w, h, pad);
	const p = pts[pts.length - 1]!;
	return { x: Number(p.x.toFixed(1)), y: Number(p.y.toFixed(1)) };
}
