import {readFile, writeFile, mkdir, copyFile, lstat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve, dirname, join, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MATERIAL_FILES, filesUnder, inventory, sha256, readZip, scanText, auditArchive} from './release-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function auditDocx(bytes, imageHashes) {
  const entries = readZip(bytes, {maxEntries: 150, maxBytes: 25 * 1024 * 1024});
  for (const required of ['[Content_Types].xml','word/document.xml','docProps/core.xml']) {
    if (!entries.has(required)) throw new Error('Word package missing required part');
  }
  for (const [name,data] of entries) {
    if (/customXml|embeddings|vbaProject|comments|thumbnail|docProps\/custom|externalLinks/i.test(name)) throw new Error('Word contains unapproved hidden content');
    if (name.endsWith('.png')) {
      if (!name.startsWith('word/media/') || !imageHashes.includes(sha256(data))) throw new Error('Word contains unreviewed media');
      continue;
    }
    if (!/\.(xml|rels)$/.test(name)) throw new Error('Unexpected Word part');
    const xml = data.toString('utf8');
    if (/<w:(?:ins|del|vanish|webHidden|altChunk)(?:\s|\/|>)/.test(xml)) throw new Error('Word contains revisions or hidden text');
    for (const field of xml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)) {
      if (!/^\s*PAGE\s*$/.test(field[1])) throw new Error('Unexpected Word field');
    }
    if (scanText(name,xml).length) throw new Error('Word text/metadata contains publication findings');
    for (const rel of xml.matchAll(/<Relationship\b[^>]*>/g)) {
      if (!/TargetMode="External"/.test(rel[0])) continue;
      const target = /Target="([^"]+)"/.exec(rel[0])?.[1];
      if (!target || !/^https:\/\/(?:github\.com\/turbo998\/gpt-live-1-demo(?:\/|#)|learn\.microsoft\.com\/|prices\.azure\.com\/|voice\.example\.com(?:\/|$))/.test(target)) {
        throw new Error('Word contains unapproved external relationship');
      }
    }
  }
  const core = entries.get('docProps/core.xml').toString('utf8');
  if (!/<dc:creator>turbo998<\/dc:creator>/.test(core) || !/<cp:lastModifiedBy>turbo998<\/cp:lastModifiedBy>/.test(core)) {
    throw new Error('Word author metadata is not the approved public identity');
  }
}

async function main() {
  const [stageArg, approvalArg, outputArg, option] = process.argv.slice(2);
  if (!stageArg || !approvalArg || !outputArg || (option && option !== '--documents-only')) throw new Error('Expected STAGE APPROVAL NEW_OUTPUT [--documents-only]');
  const stage = resolve(stageArg), output = resolve(outputArg), documentsOnly = option === '--documents-only';
  if (stage === root || stage.startsWith(root + sep) || output === root || output.startsWith(root + sep)) throw new Error('Media staging/output must be outside the repository');
  if (existsSync(output)) throw new Error('Output already exists; refusing overwrite');
  const check = spawnSync(process.execPath, [join(root,'scripts','check-release.mjs')], {stdio:'inherit'});
  if (check.status !== 0) throw new Error('Source audit failed');
  const approval = JSON.parse(await readFile(resolve(approvalArg),'utf8'));
  const assets = ['presenter-guide.docx','presenter-guide.zh-CN.docx',...(!documentsOnly ? ['GPT-Live-Azure-demo.mp4'] : [])];
  const staged = await filesUnder(stage);
  if (staged.length !== assets.length || staged.some(name=>!assets.includes(name))) throw new Error('Staging directory must contain exactly the selected approved assets');
  const imageHashes = [sha256(await readFile(join(root,'docs','images','demo-architecture.png')))];
  for (const name of assets) {
    if (!(await lstat(join(stage,name))).isFile()) throw new Error('Non-regular staged asset');
    const bytes = await readFile(join(stage,name));
    const review = approval.assets?.[name];
    const required = name.endsWith('.mp4') ? 'full-visual-and-audio-approved' : 'public-text-rendered-metadata-approved';
    if (approval.schema !== 1 || review?.sha256 !== sha256(bytes) || review?.review !== required) throw new Error(`Missing exact-byte review approval: ${name}`);
    if (name.endsWith('.docx')) auditDocx(bytes,imageHashes);
  }
  const payload = join(output,'materials');
  await mkdir(payload,{recursive:true});
  for (const name of MATERIAL_FILES) {
    await mkdir(dirname(join(payload,name)),{recursive:true});
    await copyFile(join(root,name),join(payload,name));
  }
  for (const name of assets) await copyFile(join(stage,name),join(payload,name));
  const manifest = {
    schema:1,maintainer:'turbo998',videoReview:documentsOnly ? 'excluded-pending-full-review' : 'full-visual-and-audio-approved',
    files:await inventory(payload)
  };
  await writeFile(join(payload,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  const archive = join(output,documentsOnly ? 'gpt-live-demo-documents-only.zip' : 'gpt-live-demo-materials.zip');
  const zip = spawnSync('tar',['-a','-c','-f',archive,'-C',payload,'.'],{stdio:'inherit'});
  if (zip.status !== 0) throw new Error('ZIP creation failed (requires ZIP-capable tar)');
  const receipt = {schema:1,kind:'materials',files:await inventory(payload),archiveSha256:sha256(await readFile(archive))};
  await writeFile(archive+'.audit.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  await auditArchive(archive,archive+'.audit.json',root);
  const sums = [[archive.split(/[\\/]/).at(-1),receipt.archiveSha256],...assets.map(name=>[name,manifest.files[name]])];
  await writeFile(join(output,'SHA256SUMS.txt'),sums.map(([name,hash])=>`${hash}  ${name}`).join('\n')+'\n',{flag:'wx'});
  console.log(`Materials audited: ${documentsOnly ? 'DOCUMENTS ONLY; video release remains blocked' : 'full reviewed set'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(`Materials build failed: ${error.message}`);process.exitCode=1;});
}
