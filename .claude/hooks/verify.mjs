// Stop hook: block Claude from finishing a turn while the project is red.
// Skips instantly when no code/config changed; otherwise runs `npm run check`.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// Any change except prose-only Markdown can break the gate (code, lint/format config, CI).
const CODE_PATHS = /^(?!.*\.md$)/;

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  // No or malformed stdin; treat as a fresh stop.
}

const changed = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .map((line) => line.slice(3).trim().replace(/^"|"$/g, ''))
  .filter((file) => CODE_PATHS.test(file));

if (changed.length === 0) process.exit(0);

const result = spawnSync('npm run check', { cwd: ROOT, shell: true, encoding: 'utf8' });
if (result.status === 0) process.exit(0);

const tail = `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-40).join('\n');

if (input.stop_hook_active) {
  // Already blocked once this turn; surface the red state instead of looping forever.
  console.log(JSON.stringify({ systemMessage: `⚠ npm run check is still failing:\n${tail}` }));
  process.exit(0);
}

console.error(`npm run check failed. Fix it before finishing:\n${tail}`);
process.exit(2);
