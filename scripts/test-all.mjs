import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const { scripts } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const tests = Object.entries(scripts).filter(([name, command]) =>
  name.startsWith('test:') && /^node scripts\/[a-z-]+\.mjs$/.test(command));
let failed = 0;
for (const [name, command] of tests) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [command.slice(5)], { cwd: root, encoding: 'utf8' });
  if (result.status === 0) console.log(`PASS ${name} (${Date.now() - started} ms)`);
  else {
    failed++;
    console.error(`FAIL ${name}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}`);
  }
}
console.log(`${tests.length - failed}/${tests.length} application suites passed.`);
process.exitCode = failed ? 1 : 0;
