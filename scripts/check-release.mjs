import {readFile, lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanFile, scanText, auditArchive, sha256} from './release-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, {cwd: root, maxBuffer: 128 * 1024 * 1024});

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--archive' && args.length === 4 && args[2] === '--receipt') {
    const result = await auditArchive(resolve(args[1]), resolve(args[3]), root);
    console.log(`Archive audit passed: ${result.kind}, ${result.files} files, SHA-256 ${result.sha256}`);
    return;
  }
  if (args.length && !(args[0] === '--history' && args.length === 2 && /^[\w./-]+$/.test(args[1]) && !args[1].startsWith('-'))) {
    throw new Error('Usage: check-release.mjs [--history REF | --archive ZIP --receipt JSON]');
  }
  const images = JSON.parse(await readFile(join(root, 'scripts', 'reviewed-images.json'), 'utf8'));
  const failures = [];
  let count = 0;
  if (args[0] === '--history') {
    const reviews = JSON.parse(await readFile(join(root, 'scripts', 'reviewed-history.json'), 'utf8'));
    if (git('rev-parse', '--is-shallow-repository').toString().trim() === 'true') throw new Error('History audit requires full ancestry');
    const commits = git('rev-list', args[1]).toString().trim().split('\n');
    const seen = new Set();
    for (const commit of commits) {
      failures.push(...scanText(`${commit}:commit-message`, git('show', '-s', '--format=%B', commit).toString()));
      for (const entry of git('ls-tree', '-rz', '--full-tree', commit).toString().split('\0').filter(Boolean)) {
        const [, mode, type, oid, name] = /^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/.exec(entry) || [];
        if (!name || type !== 'blob' || !['100644','100755'].includes(mode)) {
          failures.push({path: `${commit}:tree`, category: 'non-regular-history-entry'}); continue;
        }
        const key = `${name}:${oid}`; if (seen.has(key)) continue; seen.add(key);
        const data = git('cat-file', 'blob', oid);
        failures.push(...scanFile(name, data, images)
          .filter(f => !reviews.some(r => r.path === name && r.sha256 === sha256(data) && r.category === f.category && r.line === f.line))
          .map(f => ({...f, path: `${commit}:${f.path}`})));
        count++;
      }
    }
  } else {
    const names = new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString().split('\0').filter(Boolean));
    for (const name of names) {
      const path = join(root, name);
      if (!(await lstat(path)).isFile()) { failures.push({path: name, category: 'non-regular-source-file'}); continue; }
      failures.push(...scanFile(name, await readFile(path), images));
      count++;
    }
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    if (pkg.name !== 'gpt-live-1-demo' || !names.has('.env.example')) throw new Error('Required package identity/config example missing');
  }
  if (failures.length) {
    for (const {path, line, category} of failures) console.error(`${path}${line ? ':' + line : ''}: ${category}`);
    throw new Error(`${failures.length} publication findings; diagnostics contain locations/categories only`);
  }
  console.log(`${args.length ? 'History' : 'Source'} audit passed: ${count} files/blobs. This is not audiovisual or live-provider clearance.`);
}

main().catch(error => {
  console.error(`Release check failed: ${error.message}`);
  process.exitCode = 1;
});
