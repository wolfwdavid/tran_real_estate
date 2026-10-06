// 06-UI-SPEC status table (RENT-05): one Lucide icon per shortlist status, used at 16px in the
// board's section headings and 14px in the card badge. Status is always text plus icon.
import type { Component } from 'svelte';
import Bookmark from '@lucide/svelte/icons/bookmark';
import DoorOpen from '@lucide/svelte/icons/door-open';
import FileText from '@lucide/svelte/icons/file-text';
import Mail from '@lucide/svelte/icons/mail';
import Signature from '@lucide/svelte/icons/signature';
import type { ShortlistStatus } from '@tran/core/renter/records';

type IconProps = { size?: number; class?: string; 'aria-hidden'?: 'true' };

export const STATUS_ICONS: Readonly<Record<ShortlistStatus, Component<IconProps>>> = {
	saved: Bookmark,
	contacted: Mail,
	toured: DoorOpen,
	applied: FileText,
	signed: Signature
};

/** Badge fill/text per status: neutral surface, muted for Saved, the secondary pair for Signed. */
export const STATUS_BADGE: Readonly<Record<ShortlistStatus, string>> = {
	saved: 'bg-surface text-muted-foreground',
	contacted: 'bg-surface text-foreground',
	toured: 'bg-surface text-foreground',
	applied: 'bg-surface text-foreground',
	signed: 'bg-secondary-surface text-secondary'
};
