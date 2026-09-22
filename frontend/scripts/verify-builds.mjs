import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function filesBelow(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

const firmware = filesBelow(resolve('../firmware/data'))
  .map((path) => readFileSync(path))
  .map((buffer) => buffer.toString('latin1'))
  .join('\n');
for (const forbidden of ['berry_compile', 'Student / Berry Algorithm Lab', 'Berry 1.1.0', 'student-console']) {
  if (firmware.includes(forbidden)) throw new Error(`Firmware build contains standalone marker: ${forbidden}`);
}

const standalone = readFileSync(resolve('dist/edugrid-mppt.html'), 'utf8');
for (const required of ['berry_compile', 'Student / Berry Algorithm Lab', 'Berry 1.1.0']) {
  if (!standalone.includes(required)) throw new Error(`Standalone build is missing: ${required}`);
}
if (/<script[^>]+src=|<link[^>]+rel=["']stylesheet/.test(standalone)) {
  throw new Error('Standalone HTML contains an external script or stylesheet');
}
console.log('PASS build target isolation and standalone asset inlining');
