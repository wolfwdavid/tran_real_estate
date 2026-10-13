import { expect, test } from 'vitest';
import { trackingAllowed } from './consent.js';

type Nav = Parameters<typeof trackingAllowed>[0];
type Win = Parameters<typeof trackingAllowed>[1];

test.each<[string, Nav, Win, boolean]>([
	['GPC on', { globalPrivacyControl: true }, {}, false],
	['navigator DNT "1"', { doNotTrack: '1' }, {}, false],
	['navigator DNT "yes"', { doNotTrack: 'yes' }, {}, false],
	['window DNT "1"', {}, { doNotTrack: '1' }, false],
	['GPC on wins over DNT "0"', { globalPrivacyControl: true, doNotTrack: '0' }, {}, false],
	['navigator DNT "0"', { doNotTrack: '0' }, {}, true],
	['no signals', {}, {}, true],
	['GPC false and DNT null', { globalPrivacyControl: false, doNotTrack: null }, {}, true],
	['DNT "unspecified"', { doNotTrack: 'unspecified' }, {}, true]
])('%s -> %s', (_label, nav, win, expected) => {
	expect(trackingAllowed(nav, win)).toBe(expected);
});
