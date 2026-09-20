// Check project text files without requiring a separate formatter or linter.
const fs = require('fs');
const path = require('path');

// Kept for migration reference; these bundled third-party assets are not built.
const vendorFiles = new Set([
  'public/js/lib.js',
  'public/fonts/fontawesome-webfont.svg',
]);

const ignoredDirectories = new Set([
  '.git', '.agents', '.codex', 'node_modules', 'target', 'data', 'logs', 'dist', 'angular', 'new',
]);
function* filesIn(directory = '.') {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      yield* filesIn(path.join(directory, entry.name));
    } else if (entry.isFile()) {
      yield path.join(directory, entry.name).replace(/^\.\//, '');
    }
  }
}
let failures = 0;

for (const file of filesIn()) {
  if (vendorFiles.has(file)) continue;
  const contents = fs.readFileSync(file);
  if (contents.includes(0)) continue;
  const lines = contents.toString('utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/[\t ]+$/.test(lines[i])) {
      console.error(`${file}:${i + 1}: trailing whitespace`);
      failures++;
    }
  }
}

if (failures) process.exitCode = 1;
