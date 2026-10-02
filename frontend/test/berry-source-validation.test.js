import { describe, expect, it } from 'vitest';
import { MAX_BERRY_SOURCE_BYTES, validateBerrySource } from '../src/standalone/berry/sourceValidation.js';

describe('Berry upload prechecks', () => {
  it('rejects empty source and embedded NUL bytes', () => {
    expect(validateBerrySource('  \n')).toBe('Program is empty');
    expect(validateBerrySource('def mppt()\0end')).toBe('Berry source contains a NUL byte');
  });

  it('uses UTF-8 bytes, not JavaScript character count, for the device limit', () => {
    expect(validateBerrySource('a'.repeat(MAX_BERRY_SOURCE_BYTES))).toBeNull();
    expect(validateBerrySource('a'.repeat(MAX_BERRY_SOURCE_BYTES - 1) + 'é'))
      .toBe('Program exceeds the 4096-byte limit');
  });
});
