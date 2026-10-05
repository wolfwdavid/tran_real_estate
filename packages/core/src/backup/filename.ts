/** Suggested download name, using the user's LOCAL calendar date (not UTC). */
export const backupFilename = (d = new Date()): string =>
	`tran-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
