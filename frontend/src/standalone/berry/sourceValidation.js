export const MAX_BERRY_SOURCE_BYTES = 4096;

export function validateBerrySource(source) {
  if (typeof source !== 'string' || !source.trim()) return 'Program is empty';
  if (source.includes('\0')) return 'Berry source contains a NUL byte';
  if (new TextEncoder().encode(source).length > MAX_BERRY_SOURCE_BYTES) {
    return 'Program exceeds the 4096-byte limit';
  }
  return null;
}
