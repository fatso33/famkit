import { describe, it, expect } from 'vitest';

describe('Auth allowlist matching logic', () => {
  it('correctly matches emails case-insensitively', () => {
    const rawFamilyEmails = 'Mom@gmail.com, Dad@Gmail.Com, Sister@outlook.com';
    const allowed = rawFamilyEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    expect(allowed.includes('mom@gmail.com'.toLowerCase())).toBe(true);
    expect(allowed.includes('DAD@GMAIL.COM'.toLowerCase())).toBe(true);
    expect(allowed.includes('stranger@gmail.com'.toLowerCase())).toBe(false);
  });

  it('rejects empty or whitespace-only email matches', () => {
    const rawFamilyEmails = 'mom@gmail.com, ';
    const allowed = rawFamilyEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    expect(allowed).toEqual(['mom@gmail.com']);
    expect(allowed.includes('')).toBe(false);
  });
});
