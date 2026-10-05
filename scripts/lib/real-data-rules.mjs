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

// Synthetic fixture rules (Phase 4, DATA-01). Fixture JSON lives in one directory and must only
// describe the three fictional metros in USPS-unassigned ZIP3 prefixes.
export const FIXTURE_PATH = /(^|\/)apps\/web\/src\/lib\/data\/fixtures\/[^/]+\.json$/;
export const SAMPLE_ZIP3 = ['742', '702', '858'];
export const ALLOWED_URL_HOST = /^(?:example\.(?:com|org)|(?:[a-z0-9-]+\.)*[a-z0-9-]+\.test)$/i;
export const SAMPLE_MLS_NAME = 'Sample MLS';
export const SAMPLE_MLS_PREFIX = 'SAMPLE-';

const isSampleZip = (value) =>
	/^\d{5}$/.test(value) && SAMPLE_ZIP3.some((prefix) => value.startsWith(prefix));

/**
 * Structural rules for one fixture JSON file: ZIP prefixes, URL hosts, MLS fields and ids.
 * @param {string} file repo-relative path (forward slashes)
 * @param {string} text file contents
 * @returns {string[]}
 */
export function findFixtureProblems(file, text) {
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		return [`${file}: fixture is not valid JSON`];
	}
	const problems = [];
	const zipProblem = (value, path) =>
		`${file}: fixture ZIP ${value} at ${path} is outside sample prefixes 742/702/858`;

	const visit = (value, path, key) => {
		if (Array.isArray(value)) {
			if (key === 'zipCodes') {
				value.forEach((zip, i) => {
					if (!isSampleZip(String(zip))) problems.push(zipProblem(zip, `${path}[${i}]`));
				});
			}
			value.forEach((item, i) => visit(item, `${path}[${i}]`, undefined));
			return;
		}
		if (value !== null && typeof value === 'object') {
			for (const [k, v] of Object.entries(value)) visit(v, `${path}.${k}`, k);
			return;
		}
		if (key === 'zipCode' && (typeof value === 'string' || typeof value === 'number')) {
			if (!isSampleZip(String(value))) problems.push(zipProblem(value, path));
		}
		if (typeof value !== 'string') return;
		if (key === 'formattedAddress') {
			for (const m of value.matchAll(/\b\d{5}\b/g)) {
				if (!isSampleZip(m[0])) problems.push(zipProblem(m[0], path));
			}
		}
		for (const m of value.matchAll(/https?:\/\/([^/\s"'?#]+)/g)) {
			const host = m[1].replace(/:\d+$/, '');
			if (!ALLOWED_URL_HOST.test(host)) {
				problems.push(
					`${file}: fixture URL host ${host} at ${path} is not example.com/example.org/.test`
				);
			}
		}
		if (key === 'mlsNumber' && !value.startsWith(SAMPLE_MLS_PREFIX)) {
			problems.push(
				`${file}: fixture mlsNumber ${value} at ${path} must start ${SAMPLE_MLS_PREFIX}`
			);
		}
		if (key === 'mlsName' && value !== SAMPLE_MLS_NAME) {
			problems.push(`${file}: fixture mlsName ${value} at ${path} must be ${SAMPLE_MLS_NAME}`);
		}
		if (key === 'id' && !SAMPLE_ZIP3.some((prefix) => value.includes(prefix))) {
			problems.push(`${file}: fixture id ${value} at ${path} lacks a sample ZIP prefix`);
		}
	};
	visit(data, '$', undefined);
	return problems;
}

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
	if (FIXTURE_PATH.test(file)) problems.push(...findFixtureProblems(file, text ?? ''));
	return problems;
}
