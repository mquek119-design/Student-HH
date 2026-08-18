/**
 * typecheck → lint → build, quiet unless something fails.
 *
 * `next build` prints a ~25-line route table on every run. Over a working
 * session that is a lot of context spent re-reading a table nobody asked for,
 * so this swallows the output and prints it only when a step fails.
 *
 * Exits non-zero on the first failure, so it is safe in a chain.
 */
import { spawnSync } from 'node:child_process';

const steps = [
  ['typecheck', 'npx tsc --noEmit'],
  ['lint', 'npx next lint'],
  ['build', 'npx next build'],
];

/**
 * Noise these tools emit on a *successful* run. Filtering by hand rather than
 * dropping all warnings: a real Next or ESLint warning is worth seeing, and
 * swallowing everything is how a broken build starts looking clean.
 */
const NOISE = [
  /Failed to load the ES module.*tailwind\.config\.ts/,
  /Make sure to set "type": "module"/,
  /--trace-warnings/,
  /--trace-deprecation/,
  /DeprecationWarning/,
];

for (const [name, command] of steps) {
  process.stdout.write(`${name}… `);

  // One string, no args array — passing both with `shell: true` is deprecated.
  const result = spawnSync(command, { shell: true, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.status !== 0) {
    console.log('FAILED\n');
    console.log(output.trim());
    process.exit(result.status ?? 1);
  }

  const warnings = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /warn|error/i.test(line))
    .filter((line) => !NOISE.some((pattern) => pattern.test(line)))
    .filter((line) => !/No ESLint warnings or errors/.test(line));

  console.log('ok');
  if (warnings.length > 0) console.log(warnings.map((line) => `  ${line}`).join('\n'));
}

console.log('\nAll clean.');
