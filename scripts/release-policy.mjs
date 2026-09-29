import {createHash} from 'node:crypto';
import {readFile, readdir, lstat, mkdir, copyFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {isUtf8} from 'node:buffer';

export const RUNTIME_FILES = [
  'package.json', 'package-lock.json', 'launcher.mjs', 'server.mjs',
  'backend.mjs', 'config.mjs', 'delivery.mjs', 'fast-time.mjs', 'tools.mjs',
  'auth.mjs', 'connections.mjs', 'settings-store.mjs', 'ui-messages.mjs',
  'runtime-policy.mjs', 'provider-auth.mjs', 'LICENSE', 'NOTICE.md'
];
export const PUBLIC_FILES = [
  'public/index.html', 'public/setup.html', 'public/i18n.js',
  'public/locales/main.js', 'public/locales/setup.js', 'public/locales/messages.json'
];
export const DOC_FILES = [
  'README.md', 'README.zh-CN.md', '.env.example', 'Dockerfile',
  'compose.yml', 'compose.remote.yml', 'render.yaml',
  'docs/DEPLOYMENT.md', 'docs/DEPLOYMENT.zh-CN.md', 'docs/DEVELOPMENT.md',
  'docs/RELEASE.md', 'docs/RELEASE.zh-CN.md', 'docs/RELEASE-NOTES.md', 'docs/ROADMAP.md',
  'docs/AZURE-DEMO.md', 'docs/AZURE-DEMO.zh-CN.md', 'docs/RECORDING.md',
  'docs/demo/README.md', 'docs/demo/README.zh-CN.md', 'docs/demo/architecture.md',
  'docs/demo/presenter-guide.md', 'docs/demo/presenter-guide.zh-CN.md',
  'docs/demo/media.md', 'docs/demo/media.zh-CN.md',
  'docs/images/interface-en.png', 'docs/images/interface-zh-CN.png', 'docs/images/demo-architecture.png'
];
export const MATERIAL_FILES = [
  'docs/demo/README.md', 'docs/demo/README.zh-CN.md', 'docs/demo/architecture.md',
  'docs/demo/presenter-guide.md', 'docs/demo/presenter-guide.zh-CN.md',
  'docs/demo/media.md', 'docs/demo/media.zh-CN.md', 'docs/images/demo-architecture.png',
  'docs/AZURE-DEMO.md', 'docs/AZURE-DEMO.zh-CN.md', 'docs/RECORDING.md',
  'LICENSE', 'NOTICE.md'
];
export const appFiles = kind => [...RUNTIME_FILES, ...PUBLIC_FILES, ...(kind === 'windows' ? DOC_FILES : [])];
export const sha256 = data => createHash('sha256').update(data).digest('hex');

const textExtensions = /\.(?:mjs|cjs|js|json|md|txt|html|css|ya?ml|bicep|ps1|cmd|bat|sh|xml|svg|map|ts|cts|mts|h|c|gyp|py|rst)$/i;
const imagePaths = new Set(DOC_FILES.filter(name => name.endsWith('.png')));
const safeAzureHosts = new Set([
  'your-resource.openai.azure.com', '你的资源.openai.azure.com',
  'fixture.openai.azure.com', 'reasoning.openai.azure.com'
]);
const publicRole = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd';

export function forbiddenFile(name) {
  return /(?:^|\/)(?:\.azure|\.copilot-tracking|credentials|private-evidence|logs|work|staging|artifacts)(?:\/|$)/i.test(name)
    || /(?:^|\/)(?:\.env(?:\..+)?|settings\.json|.*\.private\..*|.*(?:deployment-plan|delivery-receipt).*)$/i.test(name) && !name.endsWith('.env.example')
    || /\.(?:key|pem|pfx|p12|clixml|log|har|docx|mp4|webm|wav|mp3|m4a|zip|7z|tar|gz)$/i.test(name);
}

export function scanText(name, text, {dependency = false} = {}) {
  const findings = [];
  const add = (line, category) => findings.push({path: name, line, category});
  for (const match of text.matchAll(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----(?:\s|\\[rn]|\*)+[A-Za-z0-9+/]{30,}/g)) {
    add(text.slice(0,match.index).split('\n').length, 'credential-material');
  }
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const at = index + 1;
    const pathLine = dependency ? line.replace(/(?:[A-Za-z]:[\\/]+Users[\\/]+user|\/(?:Users|home)\/user)(?=[\\/"'`.\s])/gi, '<documented-user-path>') : line;
    if (/(?:[A-Za-z]:[\\/]+Users[\\/]+|\/Users\/)[\w.-]+/.test(pathLine)
      || /\/home\/(?!gpt-live-demo(?:[\s/'"`]|$))[\w.-]+/.test(pathLine)) add(at, 'personal-path');
    if (/\b(?:sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})\b/.test(line)
      || /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(line)) add(at, 'credential-material');
    if (/\bAccountKey\s*=\s*[A-Za-z0-9+/]{40,}={0,2}(?:[;\s"'`]|$)/i.test(line)
      || /\bSharedAccessSignature\s*=\s*[^;\s"'`]{40,}/i.test(line)
      || /(?:\b|_)(?:api[_-]?key|setup[_-]?token|password)["']?\s*[:=]\s*["']?[A-Za-z0-9+/]{32,}={0,2}(?:["';\s,}]|$)/i.test(line)) add(at, 'connection-credential');
    for (const match of line.matchAll(/https?:\/\/[^\s<>"'`]+/g)) {
      const url = match[0];
      if (/https?:\/\/[^/@\s]+:[^/@\s]+@/i.test(url)
        || /[?#&](?:sig|token|access_token|api[_-]?key|code|setup-token)=[A-Za-z0-9_%+./=-]{8,}/i.test(url)) add(at, 'credential-url');
      if (!dependency) {
        const host = /^https?:\/\/([^/:?#]+)/i.exec(url)?.[1]?.toLowerCase();
        if (host && /\.(?:azurewebsites\.net|openai\.azure\.com|cognitiveservices\.azure\.com|services\.ai\.azure\.com)$/.test(host)
          && !safeAzureHosts.has(host) && !host.includes('${')) add(at, 'environment-host');
      }
    }
    if (!dependency) {
      for (const match of line.matchAll(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi)) {
        if (match[0] !== publicRole && match[0] !== '00000000-0000-0000-0000-000000000000') add(at, 'environment-identifier');
      }
    }
  }
  return findings;
}

export function scanFile(name, data, images = {}, options = {}) {
  const findings = [];
  const sdkCredentialModule = options.dependency
    && /^node_modules\/@azure\/identity\/dist\/(?:browser|commonjs|esm|react-native|workerd)\/credentials\/[\w/.-]+\.(?:js|ts|map)$/.test(name);
  if (forbiddenFile(name) && !sdkCredentialModule) findings.push({path: name, category: 'private-file'});
  if (name.endsWith('.png')) {
    if (!imagePaths.has(name) || images[name] !== sha256(data)) findings.push({path: name, category: 'unreviewed-image'});
    return findings;
  }
  const leaf = name.split('/').at(-1);
  if (data.includes(0) || !isUtf8(data) || (!options.dependency && !textExtensions.test(name)
    && !/^(?:LICENSE.*|NOTICE.*|Dockerfile|AGENTS\.md|\.env\.example|\.gitignore|\.dockerignore|\.gitattributes|\.npmignore|\.npmrc|npmrc|Makefile)$/i.test(leaf))) {
    findings.push({path: name, category: 'unreviewed-binary-or-format'});
    return findings;
  }
  return [...findings, ...scanText(name, data.toString('utf8'), options)];
}

export async function filesUnder(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(root, prefix), {withFileTypes: true})) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic link not permitted: ${name}`);
    if (entry.isDirectory()) files.push(...await filesUnder(root, name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Non-regular file not permitted: ${name}`);
  }
  return files.sort();
}

export async function copyApplication(root, destination, kind) {
  for (const name of appFiles(kind)) {
    const source = join(root, name);
    if (!(await lstat(source)).isFile()) throw new Error(`Required application file is not regular: ${name}`);
    await mkdir(dirname(join(destination, name)), {recursive: true});
    await copyFile(source, join(destination, name));
  }
}

export async function auditApplication(directory, kind, root) {
  const expected = new Set(appFiles(kind));
  const names = await filesUnder(directory);
  for (const name of expected) {
    if (!names.includes(name)) throw new Error(`Missing required application file: ${name}`);
    if (sha256(await readFile(join(directory, name))) !== sha256(await readFile(join(root, name)))) {
      throw new Error(`Application differs from reviewed source: ${name}`);
    }
  }
  const lock = JSON.parse(await readFile(join(directory, 'package-lock.json'), 'utf8'));
  const packages = Object.entries(lock.packages).filter(([name, pkg]) => name && !pkg.dev && !pkg.optional);
  const bins = new Set(packages.flatMap(([,pkg]) => Object.keys(pkg.bin || {})));
  for (const [name, pkg] of packages) {
    const installed = JSON.parse(await readFile(join(directory, name, 'package.json'), 'utf8'));
    if (installed.version !== pkg.version || !pkg.integrity) throw new Error(`Locked dependency mismatch: ${name}`);
    if (!(await readdir(join(directory,name))).some(file=>/^(?:license|copying|copyright)/i.test(file))) throw new Error(`Dependency license missing: ${name}`);
  }
  for (const name of ['node_modules/ws', 'node_modules/@azure/identity']) {
    if (!packages.some(([path]) => path === name)) throw new Error(`Required production dependency missing: ${name}`);
  }
  const images = JSON.parse(await readFile(join(root, 'scripts', 'reviewed-images.json'), 'utf8'));
  for (const name of names) {
    if (expected.has(name)) continue;
    if (name === 'node_modules/.package-lock.json') continue;
    if (name.startsWith('node_modules/.bin/')) {
      if (!bins.has(name.slice('node_modules/.bin/'.length).replace(/\.(cmd|ps1)$/, ''))) throw new Error(`Unexpected dependency launcher: ${name}`);
      if (scanText(name, (await readFile(join(directory,name))).toString('utf8'), {dependency:true}).length) throw new Error(`Dependency launcher audit failed: ${name}`);
      continue;
    }
    const owner = Object.keys(lock.packages).filter(path => path && name.startsWith(path + '/')).sort((a,b) => b.length - a.length)[0];
    if (!owner) throw new Error(`Unexpected application file: ${name}`);
    const findings = scanFile(name, await readFile(join(directory, name)), images, {dependency: true});
    if (findings.length) throw new Error(`Dependency audit failed: ${name}: ${findings[0].category}`);
  }
}

export async function inventory(directory) {
  const result = {};
  for (const name of await filesUnder(directory)) result[name] = sha256(await readFile(join(directory, name)));
  return result;
}

export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Read bounded ZIP entries without extracting paths or executing archive contents.
export function readZip(data, {maxEntries = 20000, maxBytes = 750 * 1024 * 1024} = {}) {
  if (data.length > maxBytes) throw new Error('Archive exceeds size limit');
  let end = -1;
  for (let at = data.length - 22; at >= Math.max(0, data.length - 65557); at--) {
    if (data.readUInt32LE(at) === 0x06054b50 && at + 22 + data.readUInt16LE(at + 20) === data.length) { end = at; break; }
  }
  if (end < 0) throw new Error('Invalid ZIP directory');
  const count = data.readUInt16LE(end + 10);
  const centralSize = data.readUInt32LE(end + 12);
  let cursor = data.readUInt32LE(end + 16);
  if (data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6) || count !== data.readUInt16LE(end + 8)
    || count > maxEntries || cursor + centralSize !== end) throw new Error('Unsupported ZIP layout');
  const entries = new Map(), seen = new Set();
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || data.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP entry');
    const flags = data.readUInt16LE(cursor + 8), method = data.readUInt16LE(cursor + 10);
    const checksum = data.readUInt32LE(cursor + 16);
    const compressed = data.readUInt32LE(cursor + 20), size = data.readUInt32LE(cursor + 24);
    const nameSize = data.readUInt16LE(cursor + 28), extra = data.readUInt16LE(cursor + 30), comment = data.readUInt16LE(cursor + 32);
    const mode = data.readUInt32LE(cursor + 38) >>> 16, offset = data.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameSize + extra + comment > end) throw new Error('Truncated ZIP entry');
    const rawName = data.subarray(cursor + 46, cursor + 46 + nameSize).toString('utf8');
    let name = rawName.replace(/^\.\//, '');
    const isDirectory = rawName.endsWith('/');
    name = name.replace(/\/$/, '');
    const rootDirectory = !name && rawName === './';
    if ((!name && !rootDirectory) || /[\\:\x00-\x1f]/.test(name) || name.startsWith('/')
      || (!rootDirectory && name.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part)
        || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)))
      || seen.has(name.toLowerCase()) || (mode & 0xf000) === 0xa000) throw new Error('Unsafe or duplicate ZIP path');
    seen.add(name.toLowerCase());
    total += size;
    if (flags & 1 || ![0,8].includes(method) || total > maxBytes || size > maxBytes
      || offset + 30 > data.length || data.readUInt32LE(offset) !== 0x04034b50) throw new Error('Unsupported or oversized ZIP entry');
    const localNameLength = data.readUInt16LE(offset + 26), localExtraLength = data.readUInt16LE(offset + 28);
    if (data.subarray(offset + 30, offset + 30 + localNameLength).toString('utf8') !== rawName
      || data.readUInt16LE(offset + 8) !== method || data.readUInt16LE(offset + 6) !== flags) throw new Error('Inconsistent ZIP headers');
    const start = offset + 30 + localNameLength + localExtraLength;
    if (start + compressed > data.readUInt32LE(end + 16)) throw new Error('Invalid ZIP payload bounds');
    const payload = data.subarray(start, start + compressed);
    const content = method === 0 ? payload : inflateRawSync(payload, {maxOutputLength: Math.max(1, size)});
    if (content.length !== size || crc32(content) !== checksum) throw new Error('ZIP checksum or size mismatch');
    if (isDirectory) {
      if (size) throw new Error('Directory contains data');
    } else entries.set(name, content);
    cursor += 46 + nameSize + extra + comment;
  }
  if (cursor !== end) throw new Error('Unexpected ZIP directory data');
  return entries;
}

export function compareInventory(entries, expected) {
  if (entries.size !== Object.keys(expected).length) throw new Error('Archive file count differs from approved inventory');
  for (const [name, data] of entries) {
    if (!Object.hasOwn(expected, name) || sha256(data) !== expected[name]) throw new Error(`Archive inventory mismatch: ${name}`);
  }
}

export async function auditArchive(archive, receiptPath, root) {
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  if (receipt.schema !== 1 || !['windows','azure','materials'].includes(receipt.kind)) throw new Error('Invalid audit receipt');
  const bytes = await readFile(archive);
  if (sha256(bytes) !== receipt.archiveSha256) throw new Error('Archive hash differs from audit receipt');
  const entries = readZip(bytes);
  compareInventory(entries, receipt.files);
  if (receipt.kind === 'materials') {
    for (const name of entries.keys()) {
      if (![...MATERIAL_FILES, 'presenter-guide.docx', 'presenter-guide.zh-CN.docx', 'GPT-Live-Azure-demo.mp4', 'MANIFEST.json'].includes(name)) {
        throw new Error(`Unexpected customer material: ${name}`);
      }
    }
    for (const name of [...MATERIAL_FILES, 'presenter-guide.docx', 'presenter-guide.zh-CN.docx', 'MANIFEST.json']) {
      if (!entries.has(name)) throw new Error(`Missing customer material: ${name}`);
    }
    for (const name of MATERIAL_FILES) {
      if (sha256(entries.get(name)) !== sha256(await readFile(join(root, name)))) throw new Error(`Material source mismatch: ${name}`);
    }
    const manifest = JSON.parse(entries.get('MANIFEST.json'));
    const payload = new Map(entries); payload.delete('MANIFEST.json');
    compareInventory(payload, manifest.files);
    if (entries.has('GPT-Live-Azure-demo.mp4') && manifest.videoReview !== 'full-visual-and-audio-approved') throw new Error('Video lacks full review');
  } else {
    const prefix = receipt.kind === 'windows' ? 'app/' : '';
    for (const name of appFiles(receipt.kind)) {
      if (!entries.has(prefix + name)) throw new Error(`Missing runtime module: ${name}`);
      if (sha256(entries.get(prefix + name)) !== sha256(await readFile(join(root, name)))) throw new Error(`Archive source mismatch: ${name}`);
    }
    const lock = JSON.parse(entries.get(prefix + 'package-lock.json'));
    const bins = new Set(Object.values(lock.packages).flatMap(pkg=>Object.keys(pkg.bin || {})));
    for (const [name, pkg] of Object.entries(lock.packages).filter(([name,pkg]) => name && !pkg.dev && !pkg.optional)) {
      const actual = entries.get(prefix + name + '/package.json');
      if (!actual || JSON.parse(actual).version !== pkg.version) throw new Error(`Archive dependency missing or mismatched: ${name}`);
    }
    if (receipt.kind === 'windows' && (!entries.has('Start.cmd') || !entries.has('runtime/node.exe') || !entries.has('runtime/LICENSE'))) {
      throw new Error('Missing portable launcher/runtime/license');
    }
    for (const name of entries.keys()) {
      const relative = name.slice(prefix.length);
      if (appFiles(receipt.kind).includes(relative)) continue;
      if (name.startsWith(prefix + 'node_modules/')) {
        const owner = Object.keys(lock.packages).find(path=>path && relative.startsWith(path + '/'));
        const bin = relative.startsWith('node_modules/.bin/') && bins.has(relative.slice('node_modules/.bin/'.length).replace(/\.(cmd|ps1)$/, ''));
        if (!owner && !bin && relative !== 'node_modules/.package-lock.json') throw new Error(`Unlisted archive dependency: ${relative}`);
        const findings = scanFile(relative,entries.get(name),{}, {dependency:true});
        if (findings.length) throw new Error(`Archive dependency finding: ${relative}: ${findings[0].category}`);
        continue;
      }
      if (receipt.kind === 'windows' && (name === 'Start.cmd' || name.startsWith('runtime/'))) {
        if (forbiddenFile(name)) throw new Error(`Private file in runtime: ${name}`);
        continue;
      }
      throw new Error(`Unexpected archive file: ${name}`);
    }
  }
  return {kind: receipt.kind, files: entries.size, sha256: sha256(bytes)};
}
