// PostToolUse hook: run Prettier on each file Claude edits, so formatting never needs attention.
// Never blocks: formatting failures (e.g. a half-written file) are left for `npm run check`.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const file = input.tool_input?.file_path;
  // Only format files inside this repo (not memory/plan files elsewhere).
  const rel = file ? relative(ROOT, resolve(ROOT, file)) : '';
  if (rel && !rel.startsWith('..') && !isAbsolute(rel)) {
    // --ignore-unknown skips files Prettier can't format; .prettierignore is honoured.
    spawnSync(
      process.execPath,
      ['node_modules/prettier/bin/prettier.cjs', '--write', '--ignore-unknown', file],
      { cwd: ROOT, stdio: 'ignore', timeout: 20000 },
    );
  }
} catch {
  // Malformed hook input; nothing to format.
}
process.exit(0);
