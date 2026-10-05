/**
 * Billing policy: which RentCast HTTP statuses consume a call from the quota.
 * The ONE line to flip if real-key UAT U7 shows 404s are billed (RESEARCH Pattern 2).
 */
export const isBilled = (status: number): boolean => status === 200;
