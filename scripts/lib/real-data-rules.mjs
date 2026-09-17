// Pure, unit-testable rules for the real-data / CoStar guard.
// No I/O here: scripts/guard-real-data.mjs supplies file lists and contents.

export const COSTAR_PATH = /costar/i;
export const DATA_PATH = /(^|\/)(fixtures?|data|mocks?|samples?|seed)(\/|$)/i;
export const TEXT_EXT = /\.(json|jsonl|csv|tsv|ts|js|mjs|svelte|md|txt|ya?ml|html|eml)$/i;
export const EMAIL = /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
export const ALLOWED_EMAIL = /@(?:example\.(?:com|org)|(?:[A-Za-z0-9-]+\.)*[A-Za-z0-9-]+\.test)$/i;
export const PHONE =
	/(?<![\d-])(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})(?![\d-])/g;

export const isFictionalPhone = (exchange, line) => exchange === '555' && /^01\d\d$/.test(line);

/**
 * Returns a list of human-readable problems for one file.
 * - Any path matching *costar* is a problem regardless of content.
 * - Content is scanned only for text files under data-like directories.
 * @param {string} file repo-relative path (forward slashes)
 * @param {string} text file contents
 * @returns {string[]}
 */
export function findProblems(file, text) {
	const problems = [];
	if (COSTAR_PATH.test(file)) {
		problems.push(`${file}: path matches *costar* (CoStar data is prohibited)`);
	}
	if (!DATA_PATH.test(file) || !TEXT_EXT.test(file)) return problems;

	// Global regexes are stateful; clone per call so callers never see a stale lastIndex.
	const email = new RegExp(EMAIL.source, 'g');
	const phone = new RegExp(PHONE.source, 'g');

	(text ?? '').split(/\r?\n/).forEach((line, n) => {
		for (const m of line.matchAll(email)) {
			if (!ALLOWED_EMAIL.test(m[0])) {
				problems.push(`${file}:${n + 1}: real-looking email (use @example.com/@example.org/.test)`);
			}
		}
		for (const m of line.matchAll(phone)) {
			if (!isFictionalPhone(m[2], m[3])) {
				problems.push(`${file}:${n + 1}: real-looking US phone (use 555-01xx)`);
			}
		}
	});
	return problems;
}
