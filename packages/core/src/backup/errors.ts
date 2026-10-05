// Every way a backup can fail maps to exactly one code. The UI turns a code into a plain-language
// title and body (UI-SPEC "Backup and restore section"). Messages are the fixed code itself and
// never carry file content or key text.
export type BackupErrorCode =
	| 'not-json'
	| 'not-tran'
	| 'invalid'
	| 'newer'
	| 'too-large'
	| 'key-material'
	| 'export-failed'
	| 'write-failed'
	| 'out-of-space';

export class BackupError extends Error {
	constructor(readonly code: BackupErrorCode) {
		super(code);
		this.name = 'BackupError';
	}
}
