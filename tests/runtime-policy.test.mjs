import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimePolicy,createModelRequestLimiter} from '../runtime-policy.mjs';

test('server policy keeps local defaults and bounds remote session duration',()=>{
  assert.equal(runtimePolicy('local',{}).maxSessionMinutes,30);
  assert.deepEqual(runtimePolicy('remote',{}),{maxSessionMinutes:10,maxConcurrentSessions:1,modelRequestsPerMinute:6});
  assert.equal(runtimePolicy('remote',{MAX_SESSION_MINUTES:'8'}).maxSessionMinutes,8);
  for(const value of ['0','31','1.5','no','',Infinity])assert.throws(()=>runtimePolicy('remote',{MAX_SESSION_MINUTES:value}),/MAX_SESSION_MINUTES/);
});

test('rolling provider request limit cannot be reset at a minute boundary',()=>{
  let time=59000;
  const limit=createModelRequestLimiter(2,()=>time);
  assert.equal(limit(),0);assert.equal(limit(),0);assert.equal(limit(),60);
  time=60000;assert.equal(limit(),59);
  time=119000;assert.equal(limit(),0);
});
