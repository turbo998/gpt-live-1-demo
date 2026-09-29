import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createSettingsStore,mergeSettings,emptySettings,publicSettings,normalizeBaseUrl} from '../settings-store.mjs';
import {startServer} from '../server.mjs';
import {request} from 'node:http';
import {EventEmitter} from 'node:events';
const voice={provider:'azure',baseUrl:'https://speech.example',model:'gpt-live-1',apiKey:'synthetic-voice-credential'};
const candidate=()=>({voice,backend:{enabled:false},preferences:{timeZone:'UTC'}});
const probes={voice:async()=>({ok:true,message:'fixture passed'}),backend:async()=>({ok:true,message:'fixture passed'})};
async function fixture(t,options={}){
 const dataDir=await mkdtemp(join(tmpdir(),'voice-demo-test-'));
 const app=await startServer({port:0,host:'127.0.0.1',dataDir,quiet:true,probes,...options});
 t.after(async()=>{await app.close();assert.ok(resolve(dataDir).startsWith(resolve(tmpdir())+sep+'voice-demo-test-'));await rm(dataDir,{recursive:true,force:true});});return app;
}
function rawRequest(url,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const req=request(url,{method,headers},res=>{let content='';res.on('data',chunk=>content+=chunk);res.on('end',()=>resolve({status:res.statusCode,text:async()=>content,json:async()=>JSON.parse(content),headers:{get:name=>{const v=res.headers[name.toLowerCase()];return Array.isArray(v)?v.join(','):v;}}}));});req.on('error',reject);req.end(body);});}
async function post(base,path,data,headers={}){const options={method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)};return headers.Host?rawRequest(base+path,options):fetch(base+path,options);}
test('settings never echo credentials or reuse them at another address',()=>{
 const saved=mergeSettings(candidate(),emptySettings());
 assert.equal(saved.voice.baseUrl,'https://speech.example/openai/v1');
 assert.ok(!JSON.stringify(publicSettings(saved)).includes(voice.apiKey));
 assert.throws(()=>mergeSettings({...candidate(),voice:{...voice,baseUrl:'https://other.example',apiKey:''}},saved),/重新填写/);
 assert.equal(mergeSettings({...candidate(),voice:{...voice,apiKey:''}},saved).voice.apiKey,voice.apiKey);
 assert.equal(normalizeBaseUrl('https://speech.example/openai/v1/responses','azure'),'https://speech.example/openai/v1');
});
test('clean startup enters setup and saves private configuration',async t=>{
 const app=await fixture(t);
 let r=await fetch(app.url+'/',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/setup');
 r=await post(app.url,'/api/settings',{settings:candidate()});assert.equal(r.status,200,await r.text());
 const settings=await(await fetch(app.url+'/api/settings')).json();assert.equal(settings.voice.keyConfigured,true);assert.equal(settings.voice.apiKey,undefined);
 const config=await(await fetch(app.url+'/api/config')).json();assert.equal(config.configured,true);assert.equal(config.backendReady,false);
 assert.ok(!JSON.stringify(config).includes(voice.apiKey));assert.ok(!JSON.stringify(config).includes('speech.example'));
 const diagnostics=await(await fetch(app.url+'/api/diagnostics')).text();assert.ok(!diagnostics.includes('speech.example'));assert.ok(!diagnostics.includes(voice.apiKey));
 const disk=JSON.parse(await readFile(join(app.dataDir,'settings.json'),'utf8'));assert.equal(disk.voice.apiKey,voice.apiKey);
 const reopened=await createSettingsStore(app.dataDir);assert.equal(reopened.configured(),true);
});
test('foreign origins and hosts cannot change settings',async t=>{
 const app=await fixture(t);
 assert.equal((await post(app.url,'/api/settings',{settings:candidate()},{Origin:'https://foreign.example'})).status,403);
 assert.equal((await rawRequest(app.url+'/api/settings',{headers:{Host:'foreign.example'}})).status,403);
});
test('remote mode requires bootstrap authentication then password login',async t=>{
 const token='synthetic-initialization-token-123';
 const app=await fixture(t,{mode:'remote',publicOrigin:'https://demo.example',setupToken:token});
 const base=`http://127.0.0.1:${app.port}`;const headers={Host:'demo.example',Origin:'https://demo.example'};
 assert.equal((await rawRequest(base+'/api/settings',{headers})).status,401);
 assert.equal((await post(base,'/api/auth/login',{setupToken:'wrong'},headers)).status,401);
 let r=await post(base,'/api/auth/login',{setupToken:token},headers);assert.equal(r.status,200);
 const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);
 const authorized={...headers,Cookie:cookie.split(';')[0]};
 r=await post(base,'/api/settings',{settings:candidate(),adminPassword:'synthetic-admin-passphrase'},authorized);assert.equal(r.status,200,await r.text());
 assert.equal((await post(base,'/api/auth/login',{setupToken:token},headers)).status,401);
 r=await post(base,'/api/auth/login',{password:'synthetic-admin-passphrase'},headers);assert.equal(r.status,200);
 const saved=JSON.parse(await readFile(join(app.dataDir,'settings.json'),'utf8'));assert.ok(saved.admin.hash);assert.ok(!JSON.stringify(saved).includes('synthetic-admin-passphrase'));
});
test('connection failures are actionable without exposing credentials',async t=>{
 const app=await fixture(t,{probes:{voice:async()=>{const e=new Error('bad credential');e.status=401;throw e;},backend:probes.backend}});
 const r=await post(app.url,'/api/settings/test',{kind:'voice',settings:candidate()});assert.equal(r.status,400);
 const content=await r.text();assert.match(content,/密钥未通过验证/);assert.ok(!content.includes(voice.apiKey));
});
test('HTTP errors and metadata follow Accept-Language without changing saved preferences',async t=>{
 const app=await fixture(t);
 const invalid=await post(app.url,'/api/settings',{settings:{voice:{...voice,apiKey:''}}},{'Accept-Language':'en'});
 assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/voice API key/);
 const chinese=await post(app.url,'/api/settings',{settings:{voice:{...voice,apiKey:''}}},{'Accept-Language':'zh-CN'});
 assert.match((await chinese.json()).error,/语音服务 API Key/);
 const config=await(await fetch(app.url+'/api/config',{headers:{'Accept-Language':'en'}})).json();
 assert.equal(config.voices[0].label,'Marin · Default');assert.equal(config.defaults.language,'auto');
});
test('remote environment configuration still requires initial administrator setup',async t=>{
 const names=['LIVE_BASE_URL','LIVE_API_KEY','LIVE_MODEL'];const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 process.env.LIVE_BASE_URL=voice.baseUrl;process.env.LIVE_API_KEY=voice.apiKey;process.env.LIVE_MODEL=voice.model;
 t.after(()=>{for(const key of names){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}});
 const token='synthetic-env-initialization-token';
 const app=await fixture(t,{mode:'remote',publicOrigin:'https://demo.example',setupToken:token});
 const base=`http://127.0.0.1:${app.port}`,headers={Host:'demo.example'};
 const bootstrap=await(await rawRequest(base+'/api/bootstrap',{headers})).json();
 assert.equal(bootstrap.configured,true);assert.equal(bootstrap.needsSetupToken,true);assert.equal(bootstrap.authenticated,false);
 const login=await post(base,'/api/auth/login',{setupToken:token},headers);assert.equal(login.status,200);
 const authenticated={...headers,Cookie:login.headers.get('set-cookie').split(';')[0]};
 const save=await post(base,'/api/settings',{settings:{voice:{...voice,apiKey:''},backend:{enabled:false}},adminPassword:'synthetic-env-admin-password'},authenticated);
 assert.equal(save.status,200,await save.text());
});
test('local mode refuses an accidentally public listening address',async()=>{
 const before=process.env.ALLOW_LOCAL_NETWORK;delete process.env.ALLOW_LOCAL_NETWORK;
 try{await assert.rejects(startServer({host:'0.0.0.0',mode:'local',quiet:true}),/本机模式只能监听回环地址/);}
 finally{if(before!==undefined)process.env.ALLOW_LOCAL_NETWORK=before;}
});

test('search tests run independently of chat checks and never cache evidence',async t=>{
 let calls=0;
 const app=await fixture(t,{probes:{...probes,search:async settings=>{calls++;assert.equal(settings.backend.model,'reasoning');return {ok:true,message:'联网搜索测试通过，已取得来源',sources:[{title:'Search source',url:'https://example.com'}]};}}});
 const input={...candidate(),backend:{enabled:true,mode:'same',model:'reasoning'},preferences:{webSearch:true}};
 assert.equal((await post(app.url,'/api/settings',{settings:input})).status,200);
 assert.equal(calls,0);
 for(let i=0;i<2;i++){
  const r=await post(app.url,'/api/search/test',{}, {'Accept-Language':'en'});assert.equal(r.status,200);
  const data=await r.json();assert.match(data.message,/Web search passed/);assert.equal(data.sources.length,1);assert.ok(!JSON.stringify(data).includes(voice.apiKey));
 }
 assert.equal(calls,2);
 const candidateTest=await post(app.url,'/api/settings/test',{kind:'search',settings:input});assert.equal(candidateTest.status,200);assert.equal(calls,3);
 assert.equal((await post(app.url,'/api/search/test',{}, {Origin:'https://foreign.example'})).status,403);
 const pub=await(await fetch(app.url+'/api/settings')).json();assert.equal(pub.search,undefined);
});

test('remote startup refuses an absent setup token and never logs a supplied token',async t=>{
 const before=process.env.SETUP_TOKEN;delete process.env.SETUP_TOKEN;
 const dataDir=await mkdtemp(join(tmpdir(),'voice-demo-test-'));
 try{await assert.rejects(startServer({port:0,dataDir,mode:'remote',publicOrigin:'https://demo.example',quiet:true}),/SETUP_TOKEN/);}
 finally{await rm(dataDir,{recursive:true,force:true});if(before!==undefined)process.env.SETUP_TOKEN=before;}
 const lines=[];t.mock.method(console,'log',line=>lines.push(line));
 const token='synthetic-private-setup-token';
 await fixture(t,{mode:'remote',publicOrigin:'https://demo.example',setupToken:token,quiet:false});
 assert.match(lines.join('\n'),/Setup:/);assert.ok(!lines.join('\n').includes(token));
});

test('authenticated remote costly routes are rate limited, but health and close are not',async t=>{
 let calls=0;
 const token='synthetic-private-setup-token';
 const app=await fixture(t,{mode:'remote',publicOrigin:'https://demo.example',setupToken:token,probes:{...probes,search:async()=>{calls++;return {ok:true};}}});
 const base=`http://127.0.0.1:${app.port}`,headers={Host:'demo.example'};
 const login=await post(base,'/api/auth/login',{setupToken:token},headers);
 headers.Cookie=login.headers.get('set-cookie').split(';')[0];
 for(let i=0;i<6;i++)assert.equal((await post(base,'/api/settings/test',{settings:candidate(),kind:'search'},headers)).status,200);
 const rejected=await post(base,'/api/settings/test',{settings:candidate(),kind:'search'},{...headers,'Accept-Language':'en'});
 assert.equal(rejected.status,429);assert.ok(Number(rejected.headers.get('retry-after'))>0);
 assert.match((await rejected.json()).error,/too frequent/);assert.equal(calls,6);
 assert.equal((await rawRequest(base+'/api/health',{headers})).status,200);
 assert.equal((await post(base,'/api/session/synthetic/close',{},headers)).status,200);
});

test('session lifetime is enforced on the server without browser polling and concurrency stays one',async t=>{
 const sent=[];
 class Socket extends EventEmitter{
   readyState=1;
   constructor(){super();process.nextTick(()=>this.emit('open'));}
   send(raw){const event=JSON.parse(raw);sent.push(event);if(event.type==='session.close')process.nextTick(()=>{this.emit('message',JSON.stringify({type:'session.closed',usage:{seconds:60},reason:'close_requested'}));});}
   close(){this.readyState=3;this.emit('close');}
   terminate(){this.close();}
 }
 const app=await fixture(t,{createVoiceSocket:()=>new Socket(),voiceFetch:async()=>({ok:true,json:async()=>({session:{id:'synthetic-session'},transport:{sdp:'v=0\r\nm=audio'}})})});
 await post(app.url,'/api/settings',{settings:candidate()});
 t.mock.timers.enable({apis:['setTimeout']});
 const input={sdp:'v=0\r\nm=audio',config:{sessionMinutes:1}};
 assert.equal((await post(app.url,'/api/session',input)).status,200);
 assert.equal((await post(app.url,'/api/session',input)).status,409);
 t.mock.timers.tick(60000);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sent.filter(event=>event.type==='session.close').length,1);
 const diagnostics=await(await fetch(app.url+'/api/diagnostics')).json();
 assert.equal(diagnostics.activeSessions,0);
 t.mock.timers.reset();
});

test('remote session cap rejects client overrides without contacting voice provider',async t=>{
 const token='synthetic-private-setup-token';
 const app=await fixture(t,{mode:'remote',publicOrigin:'https://demo.example',setupToken:token,voiceFetch:async()=>assert.fail('over-limit session reached provider')});
 const base=`http://127.0.0.1:${app.port}`,headers={Host:'demo.example'};
 const login=await post(base,'/api/auth/login',{setupToken:token},headers);
 headers.Cookie=login.headers.get('set-cookie').split(';')[0];
 await post(base,'/api/settings',{settings:candidate(),adminPassword:'synthetic-admin-password'},headers);
 const response=await post(base,'/api/session',{sdp:'v=0\r\nm=audio',config:{sessionMinutes:30}},{...headers,'Accept-Language':'en'});
 assert.equal(response.status,400);assert.equal((await response.json()).maxSessionMinutes,10);
});
