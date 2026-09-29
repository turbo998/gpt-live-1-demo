import {readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {copyApplication, auditApplication, inventory, sha256, auditArchive} from './release-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [action, kind, directory, archive] = process.argv.slice(2);
try {
  if (!['copy','audit','receipt'].includes(action) || !['azure','windows'].includes(kind) || !directory) {
    throw new Error('Usage: package-application.mjs copy|audit|receipt azure|windows DIRECTORY [ARCHIVE]');
  }
  if (action === 'copy') await copyApplication(root, resolve(directory), kind);
  else {
    await auditApplication(resolve(directory), kind, root);
    if (action === 'receipt') {
      if (!archive) throw new Error('Archive required');
      const receipt = {
        schema: 1, kind, files: await inventory(resolve(directory)),
        archiveSha256: sha256(await readFile(resolve(archive)))
      };
      await writeFile(resolve(archive) + '.audit.json', JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
      await auditArchive(resolve(archive), resolve(archive) + '.audit.json', root);
    }
  }
  console.log(`Application ${action} passed: ${kind}`);
} catch (error) {
  console.error(`Packaging failed: ${error.message}`);
  process.exitCode = 1;
}
