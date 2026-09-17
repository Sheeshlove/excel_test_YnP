/* Runs every check: the formula engine, the programme, the interface. */
const { execFileSync } = require('child_process');
const path = require('path');

const suites = [
  ['Formula engine', 'formula.test.js'],
  ['Pivot engine', 'pivot.test.js'],
  ['Training programme', 'curriculum.test.js'],
  ['Interface (real browser)', 'ui.test.js']
];

let failed = 0;
for (const [name, file] of suites) {
  console.log('\n══ ' + name + ' ' + '═'.repeat(Math.max(0, 50 - name.length)));
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8' });
    process.stdout.write(out.trim() + '\n');
  } catch (e) {
    failed++;
    process.stdout.write((e.stdout || '') + (e.stderr || ''));
    console.log('FAILED: ' + name);
  }
}
console.log('\n' + (failed ? failed + ' suite(s) failed' : 'All checks passed.'));
process.exit(failed ? 1 : 0);
