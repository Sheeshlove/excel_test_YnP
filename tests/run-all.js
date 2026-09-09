/* Прогон всех проверок: движок формул, программа, интерфейс. */
const { execFileSync } = require('child_process');
const path = require('path');

const suites = [
  ['Движок формул', 'formula.test.js'],
  ['Учебная программа', 'curriculum.test.js'],
  ['Интерфейс (браузер)', 'ui.test.js']
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
    console.log('НЕ ПРОЙДЕНО: ' + name);
  }
}
console.log('\n' + (failed ? failed + ' набор(а) проверок не прошли' : 'Все проверки пройдены.'));
process.exit(failed ? 1 : 0);
