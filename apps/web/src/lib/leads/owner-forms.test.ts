import { describe, expect, test, vi } from 'vitest';
import { submitOwnerForm } from './owner-forms';
import { feedbackBody, waitlistBody } from '$lib/components/forms/form-gate';

// Fake fetch only: these tests never touch the real network. Low-entropy test key.
const K = '00000000-0000-4000-8000-000000000000';

type FetchArgs = [string | URL | Request, RequestInit | undefined];

function fakeFetch(body: unknown, status = 200) {
	return vi.fn<(...args: FetchArgs) => Promise<Response>>(
		async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
	);
}

const asFetch = (f: unknown) => f as typeof fetch;
const WAITLIST = waitlistBody({ key: K, portal: 'renter', email: 'a@example.com' });

describe('submitOwnerForm request', () => {
	test('posts the waitlist body once, verbatim, to the Web3Forms endpoint', async () => {
		const f = fakeFetch({ success: true });
		await submitOwnerForm(WAITLIST, asFetch(f));
		expect(f).toHaveBeenCalledTimes(1);
		const [url, init] = f.mock.calls[0]!;
		expect(url).toBe('https://api.web3forms.com/submit');
		expect(init?.method).toBe('POST');
		expect(init?.headers).toStrictEqual({
			'Content-Type': 'application/json',
			Accept: 'application/json'
		});
		expect(JSON.parse(String(init?.body))).toStrictEqual(WAITLIST);
	});

	test('posts a feedback body verbatim', async () => {
		const body = feedbackBody({ key: K, topic: 'other', message: 'Hi', email: '' });
		const f = fakeFetch({ success: true });
		await submitOwnerForm(body, asFetch(f));
		expect(JSON.parse(String(f.mock.calls[0]![1]?.body))).toStrictEqual(body);
	});
});

describe('submitOwnerForm response mapping', () => {
	test('200 success:true is ok', async () => {
		expect(await submitOwnerForm(WAITLIST, asFetch(fakeFetch({ success: true })))).toEqual({
			ok: true
		});
	});

	test('200 success:false is rejected', async () => {
		const r = await submitOwnerForm(WAITLIST, asFetch(fakeFetch({ success: false })));
		expect(r).toMatchObject({ ok: false, kind: 'rejected' });
	});

	test('400 captcha message is captcha-required', async () => {
		const r = await submitOwnerForm(
			WAITLIST,
			asFetch(fakeFetch({ success: false, message: 'hCaptcha verification required' }, 400))
		);
		expect(r).toMatchObject({ ok: false, kind: 'captcha-required' });
	});

	test('429 is rate-limited', async () => {
		const r = await submitOwnerForm(WAITLIST, asFetch(fakeFetch({ success: false }, 429)));
		expect(r).toEqual({ ok: false, kind: 'rate-limited' });
	});

	test('500 is server', async () => {
		const r = await submitOwnerForm(WAITLIST, asFetch(fakeFetch('oops', 500)));
		expect(r).toEqual({ ok: false, kind: 'server' });
	});

	test('a thrown TypeError is network', async () => {
		const f = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		expect(await submitOwnerForm(WAITLIST, asFetch(f))).toEqual({ ok: false, kind: 'network' });
	});

	test('the access key is redacted from a returned detail', async () => {
		const r = await submitOwnerForm(
			WAITLIST,
			asFetch(fakeFetch({ success: false, message: `Invalid key ${K}` }, 400))
		);
		expect(JSON.stringify(r)).not.toContain(K);
	});
});
