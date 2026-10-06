import { describe, expect, test, vi } from 'vitest';
import { submitInquiry, WEB3FORMS_ENDPOINT, type InquiryPayload } from './web3forms-sink';

// Fake fetch only: these tests never touch the real network.
const KEY = '00000000-0000-4000-8000-000000000000';
const INPUT: InquiryPayload = {
	key: KEY,
	agentName: 'Sample Agent',
	name: 'Jordan Example',
	email: 'jordan@example.com',
	phone: '(555) 555-0123',
	property: '12 Sample Lane',
	message: 'Is the unit still available?',
	submittedAt: '2026-10-06T12:00:00.000Z'
};

type FetchArgs = [string | URL | Request, RequestInit | undefined];

function fakeFetch(body: unknown, status = 200) {
	return vi.fn<(...args: FetchArgs) => Promise<Response>>(
		async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
	);
}

const asFetch = (f: unknown) => f as typeof fetch;

describe('submitInquiry request shape', () => {
	test('posts one JSON request to the Web3Forms endpoint', async () => {
		const f = fakeFetch({ success: true });
		await submitInquiry(INPUT, asFetch(f));
		expect(f).toHaveBeenCalledTimes(1);
		const [url, init] = f.mock.calls[0]!;
		expect(WEB3FORMS_ENDPOINT).toBe('https://api.web3forms.com/submit');
		expect(url).toBe('https://api.web3forms.com/submit');
		expect(init?.method).toBe('POST');
		expect(init?.headers).toEqual({
			'Content-Type': 'application/json',
			Accept: 'application/json'
		});
		const body = JSON.parse(String(init?.body)) as Record<string, string>;
		expect(Object.keys(body).sort()).toEqual(
			[
				'access_key',
				'subject',
				'from_name',
				'name',
				'email',
				'phone',
				'property_of_interest',
				'message',
				'consent',
				'tran_lead_v1'
			].sort()
		);
		expect(body).not.toHaveProperty('botcheck');
		expect(body.access_key).toBe(KEY);
		expect(body.subject).toBe('New inquiry for Sample Agent from Jordan Example');
		expect(body.from_name).toBe('Tran inquiry form');
		expect(body.consent).toBe('Yes: I agree to be contacted about my inquiry.');
		expect(body.message).toBe('Is the unit still available?');
		expect(body.tran_lead_v1).toMatch(/^TRAN-LEAD v1\n[\s\S]*\nEND TRAN-LEAD$/);
		expect(body.tran_lead_v1).toContain('email: jordan@example.com');
		expect(body.tran_lead_v1).toContain('consent: yes');
		expect(body.tran_lead_v1).toContain('submitted: 2026-10-06T12:00:00.000Z');
	});

	test('optional phone and property are sent as empty strings', async () => {
		const f = fakeFetch({ success: true });
		const rest: InquiryPayload = { ...INPUT };
		delete rest.phone;
		delete rest.property;
		await submitInquiry(rest, asFetch(f));
		const body = JSON.parse(String(f.mock.calls[0]![1]?.body)) as Record<string, string>;
		expect(body.phone).toBe('');
		expect(body.property_of_interest).toBe('');
	});
});

describe('submitInquiry result mapping', () => {
	const run = (f: unknown) => submitInquiry(INPUT, asFetch(f));

	test('200 success', async () => {
		expect(await run(fakeFetch({ success: true, message: 'Email sent successfully!' }))).toEqual({
			ok: true
		});
	});

	test('400 invalid key is rejected', async () => {
		expect(await run(fakeFetch({ success: false, message: 'Invalid access key' }, 400))).toEqual({
			ok: false,
			kind: 'rejected',
			detail: 'Invalid access key'
		});
	});

	test('400 with the message under body is captcha-required', async () => {
		const r = await run(
			fakeFetch({ success: false, body: { message: 'hCaptcha verification required' } }, 400)
		);
		expect(r).toEqual({
			ok: false,
			kind: 'captcha-required',
			detail: 'hCaptcha verification required'
		});
	});

	test('429 is rate-limited', async () => {
		expect(
			await run(fakeFetch({ success: false, message: 'Too may requests' }, 429))
		).toMatchObject({ ok: false, kind: 'rate-limited' });
	});

	test('500 is server', async () => {
		expect(await run(fakeFetch({ statusCode: 500, error: 'x' }, 500))).toMatchObject({
			ok: false,
			kind: 'server'
		});
	});

	test('a thrown TypeError is network', async () => {
		const f = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		expect(await run(f)).toEqual({ ok: false, kind: 'network' });
	});

	test('a non-JSON 200 body is rejected', async () => {
		expect(await run(fakeFetch('<html>ok</html>', 200))).toMatchObject({
			ok: false,
			kind: 'rejected'
		});
	});

	test('200 with success false is rejected', async () => {
		expect(await run(fakeFetch({ success: false, message: 'Spam detected' }, 200))).toMatchObject({
			ok: false,
			kind: 'rejected'
		});
	});

	test('the access key never appears in a returned detail', async () => {
		const echoes = fakeFetch({ success: false, message: `Access key ${KEY} is not valid` }, 400);
		expect(JSON.stringify(await run(echoes))).not.toContain(KEY);
		const upper = fakeFetch({ success: false, message: `Key ${KEY.toUpperCase()} bad` }, 400);
		expect(JSON.stringify(await run(upper))).not.toContain(KEY.toUpperCase());
		const cap = fakeFetch(
			{ success: false, body: { message: `hCaptcha required for ${KEY}` } },
			400
		);
		expect(JSON.stringify(await run(cap))).not.toContain(KEY);
	});
});
