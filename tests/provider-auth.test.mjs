import test from 'node:test';
import assert from 'node:assert/strict';
import {providerHeaders,validateIdentityEndpoint} from '../provider-auth.mjs';
import {mergeSettings,emptySettings,publicSettings,defaultDataDir} from '../settings-store.mjs';

test('managed identity obtains service-scoped bearer tokens only for Azure endpoints',async()=>{
 let calls=0;
 const credential={getToken:async scope=>{calls++;assert.equal(scope,'https://cognitiveservices.azure.com/.default');return {token:'synthetic-access-token'};}};
 assert.deepEqual(await providerHeaders({auth:'managed-identity',baseUrl:'https://fixture.openai.azure.com/openai/v1'},credential),{Authorization:'Bearer synthetic-access-token'});
 for(const url of ['https://attacker.example','https://fixture.openai.azure.com.attacker.example','http://fixture.openai.azure.com'])assert.throws(()=>validateIdentityEndpoint(url));
 await assert.rejects(providerHeaders({auth:'managed-identity',baseUrl:'https://attacker.example'},credential));
 assert.equal(calls,1);
 await assert.rejects(providerHeaders({auth:'managed-identity',baseUrl:'https://fixture.openai.azure.com'}, {getToken:async()=>{throw new Error('sensitive provider detail');}}),error=>error.message.includes('托管身份认证失败')&&!error.message.includes('sensitive'));
});

test('managed identity settings contain neither credentials nor tokens and preserve auth when omitted',()=>{
 const initial=mergeSettings({voice:{provider:'azure',auth:'managed-identity',baseUrl:'https://fixture.openai.azure.com',model:'live'},backend:{enabled:true,mode:'same',model:'reasoning'}},emptySettings());
 assert.equal(initial.voice.apiKey,'');assert.equal(initial.backend.apiKey,'');assert.equal(initial.backend.auth,'managed-identity');
 const saved=mergeSettings({voice:{model:'live'},backend:initial.backend},initial);
 assert.equal(saved.voice.auth,'managed-identity');
 assert.equal(publicSettings(saved).voice.keyConfigured,false);
 assert.equal(publicSettings(saved).voice.auth,'managed-identity');
 const custom=mergeSettings({voice:initial.voice,backend:{enabled:true,mode:'custom',auth:'managed-identity',baseUrl:'https://reasoning.openai.azure.com',model:'reasoning'}},initial);
 assert.equal(custom.backend.baseUrl,'https://reasoning.openai.azure.com/openai/v1');
 assert.equal(custom.backend.apiKey,'');
 assert.throws(()=>mergeSettings({voice:{...initial.voice,auth:'api-key'}},initial),/API Key/);
});

test('App Service settings use the persistent mount even when process HOME differs',()=>{
 const names=['WEBSITE_SITE_NAME','HOME','APP_DATA_DIR'];
 const prior=Object.fromEntries(names.map(key=>[key,process.env[key]]));
 try{
   process.env.WEBSITE_SITE_NAME='synthetic-app';
   process.env.HOME='/synthetic-ephemeral-home';
   delete process.env.APP_DATA_DIR;
   assert.equal(defaultDataDir(),'/home/gpt-live-demo');
   process.env.APP_DATA_DIR='synthetic-override';
   assert.equal(defaultDataDir(),'synthetic-override');
 }finally{
   for(const key of names){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}
 }
});
