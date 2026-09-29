import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  scanFile, scanText, sha256, crc32, readZip, compareInventory,
  appFiles, copyApplication, auditApplication, auditArchive
} from '../scripts/release-policy.mjs';
import {auditDocx} from '../scripts/build-demo-materials.mjs';

function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const [name,value] of entries) {
    const content=Buffer.from(value), filename=Buffer.from(name), header=Buffer.alloc(30), dir=Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);
    header.writeUInt32LE(crc32(content),14);header.writeUInt32LE(content.length,18);header.writeUInt32LE(content.length,22);header.writeUInt16LE(filename.length,26);
    dir.writeUInt32LE(0x02014b50);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);
    dir.writeUInt32LE(crc32(content),16);dir.writeUInt32LE(content.length,20);dir.writeUInt32LE(content.length,24);dir.writeUInt16LE(filename.length,28);dir.writeUInt32LE(offset,42);
    local.push(header,filename,content);central.push(dir,filename);offset+=header.length+filename.length+content.length;
  }
  const directory=Buffer.concat(central), end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}

test('publication scans dotfiles, fixtures and private data with value-free diagnostics',()=>{
  const secret='sk-'+'A'.repeat(32);
  for(const name of ['tests/fixture.mjs','.github/workflows/check.yml','infra/main.bicep']){
    const findings=scanFile(name,Buffer.from(secret));
    assert.ok(findings.some(f=>f.category==='credential-material'));
    assert.ok(!JSON.stringify(findings).includes(secret));
  }
  for(const name of ['.env','credentials/sample.clixml','.azure/deployment-plan.md','docs/demo.mp4','settings.json']){
    assert.ok(scanFile(name,Buffer.from('synthetic')).some(f=>f.category==='private-file'));
  }
  const privatePath='C:'+'\\Users\\'+'SyntheticOwner\\file';
  assert.equal(scanText('sample.md',privatePath)[0].category,'personal-path');
  const tokenUrl='https://example.com/?'+'token='+'Q'.repeat(25);
  assert.equal(scanText('sample.md',tokenUrl)[0].category,'credential-url');
  const pem=['-----BEGIN '+'PRIVATE KEY-----','A'.repeat(64),'-----END '+'PRIVATE KEY-----'].join('\n');
  assert.equal(scanText('sample.md',pem)[0].category,'credential-material');
  assert.equal(scanText('sample.md','LIVE_API_KEY='+'A'.repeat(40))[0].category,'connection-credential');
});

test('specific examples pass without allowing all Azure hosts or identifiers',()=>{
  assert.deepEqual(scanText('example.md',['https://voice.example.com','https://your-resource.openai.azure.com','/home/gpt-live-demo','5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'].join('\n')),[]);
  const host='https://'+'nonpublic-fixture'+'.azurewebsites.net';
  assert.equal(scanText('tests/fixture.mjs',host)[0].category,'environment-host');
  const id=['12345678','1234','1234','1234','123456789abc'].join('-');
  assert.equal(scanText('infra/sample.bicep',id)[0].category,'environment-identifier');
});

test('binary source fails closed and image reviews bind exact bytes and paths',()=>{
  const image=Buffer.from([137,80,78,71,0]);
  assert.equal(scanFile('docs/demo.docx',image)[0].category,'private-file');
  assert.equal(scanFile('public/unknown.bin',image)[0].category,'unreviewed-binary-or-format');
  const name='docs/images/interface-en.png';
  assert.deepEqual(scanFile(name,image,{[name]:sha256(image)}),[]);
  assert.equal(scanFile(name,Buffer.concat([image,Buffer.from('changed')]),{[name]:sha256(image)})[0].category,'unreviewed-image');
});

test('ZIP review rejects traversal, duplicate paths, corrupt data and oversized entries',()=>{
  for(const names of [['../escape'],['C:/escape'],['a\\escape'],['a/../escape'],['A.txt','a.txt'],['trailing./file'],['CON.txt']]){
    assert.throws(()=>readZip(zip(names.map(name=>[name,'x']))),/Unsafe/);
  }
  assert.throws(()=>readZip(zip([['one','abc']]),{maxBytes:2}),/size limit/);
  const bad=zip([['one','abc']]);bad[33]^=1;
  assert.throws(()=>readZip(bad),/checksum/);
  const entries=readZip(zip([['public/index.html','safe']]));
  compareInventory(entries,{'public/index.html':sha256(Buffer.from('safe'))});
  assert.throws(()=>compareInventory(entries,{'public/index.html':sha256(Buffer.from('changed'))}),/mismatch/);
  assert.throws(()=>compareInventory(entries,{}),/count/);
  assert.equal(readZip(zip([['./',''],['./safe.txt','safe']])).size,1);
});

test('both package allowlists require identity/runtime modules and license notices',()=>{
  for(const kind of ['azure','windows']){
    for(const name of ['provider-auth.mjs','runtime-policy.mjs','LICENSE','NOTICE.md']){
      assert.ok(appFiles(kind).includes(name));
    }
    assert.ok(!appFiles(kind).some(name=>/\.(docx|mp4|zip)$/.test(name)));
  }
});

test('copy fails on missing required source instead of making a partial release',async t=>{
  const root=await mkdtemp(join(tmpdir(),'release-fixture-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await assert.rejects(copyApplication(root,join(root,'out'),'azure'),/ENOENT/);
});

test('package audit rejects missing production dependencies',async t=>{
  const root=await mkdtemp(join(tmpdir(),'release-fixture-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const name of appFiles('azure')){
    await mkdir(join(root,name,'..'),{recursive:true});
    await writeFile(join(root,name),name==='package-lock.json'?JSON.stringify({packages:{'':{},'node_modules/ws':{version:'1.0.0',integrity:'synthetic'}}}):'fixture');
  }
  await assert.rejects(auditApplication(root,'azure',root),/ENOENT/);
});

test('final archive audit rejects self-consistent but incomplete or unexpected application files',async t=>{
  const root=await mkdtemp(join(tmpdir(),'release-fixture-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const files=appFiles('azure').map(name=>[name,name==='package-lock.json'?JSON.stringify({packages:{'':{},'node_modules/ws':{version:'1'},'node_modules/@azure/identity':{version:'1'}}}):'fixture']);
  for(const [name,data] of files){await mkdir(join(root,name,'..'),{recursive:true});await writeFile(join(root,name),data);}
  files.push(['node_modules/ws/package.json','{"version":"1"}'],['node_modules/@azure/identity/package.json','{"version":"1"}']);
  async function check(values){
    const archive=join(root,'app.zip'),receipt=join(root,'audit.json'),bytes=zip(values);
    await writeFile(archive,bytes);
    await writeFile(receipt,JSON.stringify({schema:1,kind:'azure',archiveSha256:sha256(bytes),files:Object.fromEntries(values.map(([name,data])=>[name,sha256(Buffer.from(data))]))}));
    return auditArchive(archive,receipt,root);
  }
  assert.equal((await check(files)).kind,'azure');
  await assert.rejects(check(files.filter(([name])=>name!=='provider-auth.mjs')),/Missing runtime module/);
  await assert.rejects(check(files.filter(([name])=>name!=='node_modules/@azure/identity/package.json')),/dependency missing/);
  await assert.rejects(check([...files,['private/nested.zip','not approved']]),/Unexpected archive file/);
  await assert.rejects(check([...files,['node_modules/unlisted/index.js','not approved']]),/Unlisted archive dependency/);
  await assert.rejects(check([...files,['node_modules/ws/.env','not approved']]),/Archive dependency finding/);
});

test('Word review rejects hidden parts, private metadata and unreviewed media',()=>{
  const core='<cp:coreProperties><dc:creator>turbo998</dc:creator><cp:lastModifiedBy>turbo998</cp:lastModifiedBy></cp:coreProperties>';
  const parts=[['[Content_Types].xml','<Types/>'],['word/document.xml','<w:document><w:t>Public synthetic text</w:t></w:document>'],['docProps/core.xml',core]];
  assert.doesNotThrow(()=>auditDocx(zip(parts),[]));
  assert.throws(()=>auditDocx(zip([...parts,['word/comments.xml','<w:comments/>']]),[]),/hidden content/);
  assert.throws(()=>auditDocx(zip(parts.map(([name,text])=>[name,name==='docProps/core.xml'?text.replaceAll('turbo998','synthetic-owner'):text])),[]),/author metadata/);
  assert.throws(()=>auditDocx(zip([...parts,['word/media/image.png','unreviewed']]),[]),/unreviewed media/);
  assert.throws(()=>auditDocx(zip([...parts,['word/_rels/document.xml.rels','<Relationships><Relationship TargetMode=\"External\" Target=\"https://private.example/\"/></Relationships>']]),[]),/external relationship/);
});

test('documents-only builder emits every checksum asset at the declared relative path', {skip:process.platform!=='win32'}, async t=>{
  const directory=await mkdtemp(join(tmpdir(),'materials-fixture-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const stage=join(directory,'stage'),output=join(directory,'output'),approvalFile=join(directory,'approval.json');
  await mkdir(stage);
  const document=zip([
    ['[Content_Types].xml','<Types/>'],['word/document.xml','<w:document><w:t>Synthetic fixture</w:t></w:document>'],
    ['docProps/core.xml','<cp:coreProperties><dc:creator>turbo998</dc:creator><cp:lastModifiedBy>turbo998</cp:lastModifiedBy></cp:coreProperties>']
  ]);
  const names=['presenter-guide.docx','presenter-guide.zh-CN.docx'];
  for(const name of names)await writeFile(join(stage,name),document);
  await writeFile(approvalFile,JSON.stringify({schema:1,assets:Object.fromEntries(names.map(name=>[name,{sha256:sha256(document),review:'public-text-rendered-metadata-approved'}]))}));
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/build-demo-materials.mjs',import.meta.url)),stage,approvalFile,output,'--documents-only'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const sums=(await readFile(join(output,'SHA256SUMS.txt'),'utf8')).trim().split('\n');
  assert.equal(sums.length,3);
  for(const line of sums){const [hash,name]=line.split('  ');assert.equal(sha256(await readFile(join(output,name))),hash);}
  const entries=readZip(await readFile(join(output,'gpt-live-demo-documents-only.zip')));
  assert.ok(!entries.has('GPT-Live-Azure-demo.mp4'));
  assert.equal(JSON.parse(entries.get('MANIFEST.json')).videoReview,'excluded-pending-full-review');
});

test('branding preserves provenance and does not advertise a nonexistent fork release',async()=>{
  for(const name of ['README.md','README.zh-CN.md','public/index.html','public/setup.html']){
    const text=await readFile(new URL('../'+name,import.meta.url),'utf8');
    assert.ok(text.includes('turbo998/gpt-live-1-demo'));
    assert.ok(!text.includes('kylefu8/gpt-live-1-demo'));
    assert.ok(!text.includes('/releases/latest'));
  }
  assert.match(await readFile(new URL('../NOTICE.md',import.meta.url),'utf8'),/kylefu8/);
  assert.match(await readFile(new URL('../LICENSE',import.meta.url),'utf8'),/GPT Live 1 Demo contributors/);
  const dockerIgnore=(await readFile(new URL('../.dockerignore',import.meta.url),'utf8')).split(/\r?\n/);
  assert.ok(!dockerIgnore.includes('LICENSE'));
  assert.ok(!dockerIgnore.includes('NOTICE.md'));
});
