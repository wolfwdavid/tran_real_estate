import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { parseFreeform } from './parse-freeform.js';

describe('parseFreeform', () => {
	it('reads labelled Name / Email / Phone lines', () => {
		expect(
			parseFreeform('Name: Riley Sample\nEmail: riley@example.com\nPhone: 555-555-0107')
		).toEqual({ name: 'Riley Sample', email: 'riley@example.com', phone: '(555) 555-0107' });
	});

	it('takes the name from a quoted display name', () => {
		expect(
			parseFreeform('From: "Casey Placeholder" <casey@example.com>\nHi, can I see the condo?')
		).toEqual({ name: 'Casey Placeholder', email: 'casey@example.com', phone: '' });
	});

	it('skips the Web3Forms sender and uses the Reply-To person', () => {
		expect(
			parseFreeform(
				'From: Notifications <notify@web3forms.com>\nReply-To: Morgan Demo <morgan@example.com>\ncall me at (555) 555-0111'
			)
		).toEqual({ name: 'Morgan Demo', email: 'morgan@example.com', phone: '(555) 555-0111' });
	});

	it.each([
		'notify@web3forms.com',
		'alerts@mail.web3forms.com',
		'NoReply@example.com',
		'no-reply@example.com',
		'noreply@example.com',
		'notification@example.com',
		'notifications@example.com',
		'MAILER-DAEMON@example.com'
	])('skips the service address %s', (address) => {
		expect(parseFreeform(`From: ${address}\nFrom: Avery <avery@example.com>`)?.email).toBe(
			'avery@example.com'
		);
		expect(parseFreeform(`Sent by ${address}`)).toBeNull();
	});

	it('does not skip addresses that only contain a skip word', () => {
		expect(parseFreeform('noreply.fan@example.com')?.email).toBe('noreply.fan@example.com');
		expect(parseFreeform('jo@notweb3forms.com')?.email).toBe('jo@notweb3forms.com');
	});

	it('never guesses a name from prose', () => {
		expect(parseFreeform('Hi, this is Taylor and my email is taylor@example.com')).toEqual({
			name: '',
			email: 'taylor@example.com',
			phone: ''
		});
	});

	it('does not read a reply attribution line as a display name', () => {
		expect(
			parseFreeform('On Mon, Oct 5, 2026 at 9:00 AM Morgan Demo <morgan@example.com> wrote:')
		).toEqual({ name: '', email: 'morgan@example.com', phone: '' });
	});

	it('takes the display name of the chosen address, not of a skipped sender', () => {
		expect(
			parseFreeform('From: Notifications <notifications@example.com>\nquinn@example.com')
		).toEqual({ name: '', email: 'quinn@example.com', phone: '' });
	});

	it('only reads a display name directly before <address>', () => {
		expect(parseFreeform('From: Morgan Demo morgan@example.com')?.name).toBe('');
	});

	it('does not read other labels ending in name', () => {
		expect(parseFreeform('Company name: Acme\njordan@example.com')?.name).toBe('');
	});

	it('prefers a labelled Name line over the display name', () => {
		expect(
			parseFreeform('From: Web Form <form@example.com>\nFull name: Jordan Example')?.name
		).toBe('Jordan Example');
	});

	it('ignores a labelled name longer than 120 characters', () => {
		expect(parseFreeform(`Name: ${'a'.repeat(121)}\njordan@example.com`)?.name).toBe('');
	});

	it('returns null when there is no email and no phone', () => {
		expect(parseFreeform('nothing useful here')).toBeNull();
		expect(parseFreeform('')).toBeNull();
		expect(parseFreeform('Name: Riley Sample')).toBeNull();
	});

	it('returns a phone-only lead', () => {
		expect(parseFreeform('Text me: 555.555.0123')).toEqual({
			name: '',
			email: '',
			phone: '(555) 555-0123'
		});
	});

	it('uses only the first email and the first valid NANP phone', () => {
		expect(
			parseFreeform(
				'a@example.com b@example.com\nold 555-055-0142, new +1 555 555 0142, also 555-555-0199'
			)
		).toEqual({ name: '', email: 'a@example.com', phone: '(555) 555-0142' });
	});

	it('does not take digits out of a longer number', () => {
		expect(parseFreeform('Order 1555555014299 shipped')).toBeNull();
	});

	it('lowercases the email and strips quoting, NBSP and zero-width characters', () => {
		expect(parseFreeform('> Name:\u00A0Riley\u200B Sample\r\n> Email: Riley@Example.COM')).toEqual({
			name: 'Riley Sample',
			email: 'riley@example.com',
			phone: ''
		});
	});

	it('trims a trailing period after an address', () => {
		expect(parseFreeform('Write to riley@example.com.')?.email).toBe('riley@example.com');
	});

	it('stays fast on a 100,000-character paste with no separators', () => {
		const started = performance.now();
		expect(parseFreeform('a'.repeat(50_000) + '@' + 'b'.repeat(49_999))).toBeNull();
		expect(parseFreeform(' '.repeat(50_000) + '\n'.repeat(50_000))).toBeNull();
		expect(performance.now() - started).toBeLessThan(1000);
	});

	it('never returns a skipped service address or an invalid phone (property)', () => {
		fc.assert(
			fc.property(
				fc.array(
					fc.constantFrom(
						'notify@web3forms.com',
						'noreply@example.com',
						'riley@example.com',
						'555-055-0142',
						'(555) 555-0142',
						'Name: Riley',
						'From: "Casey" <casey@example.com>',
						'\n',
						' ',
						'> ',
						'hello'
					),
					{ maxLength: 12 }
				),
				(parts) => {
					const lead = parseFreeform(parts.join(' '));
					if (lead === null) return;
					expect(lead.email).not.toMatch(/web3forms|noreply/);
					expect(['', '(555) 555-0142']).toContain(lead.phone);
					expect(lead.email !== '' || lead.phone !== '').toBe(true);
				}
			),
			{ numRuns: 300 }
		);
	});
});
