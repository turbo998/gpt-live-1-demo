// Application-only capture. Never requests a real microphone, camera or desktop.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const [url,cookieFile,mediaDirectory,outputDirectory,approval]=process.argv.slice(2);
if(!url||!cookieFile||!mediaDirectory||!outputDirectory||approval!=='--allow-live'||!process.env.PLAYWRIGHT_MODULE||!process.env.FFMPEG_EXE){
  throw new Error('Usage: node scripts/record-demo.mjs HTTPS_URL PRIVATE_COOKIES_JSON MEDIA_DIR NEW_OUTPUT_DIR --allow-live; obtain live/cost approval first and set PLAYWRIGHT_MODULE and FFMPEG_EXE.');
}
if(new URL(url).protocol!=='https:')throw new Error('Live recording requires the approved HTTPS application.');
const output=resolve(outputDirectory);
await mkdir(output,{recursive:false});
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1600,height:1000},recordVideo:{dir:output,size:{width:1600,height:1000}},locale:'zh-CN'});
await context.addCookies(JSON.parse(await readFile(cookieFile,'utf8')));
await context.addInitScript(()=>{
  const audio=new AudioContext({sampleRate:48000});
  const microphone=audio.createMediaStreamDestination();
  const recording=audio.createMediaStreamDestination();
  navigator.mediaDevices.getUserMedia=async constraints=>{
    if(constraints.video)throw new Error('This recorder cannot capture a camera.');
    await audio.resume();
    return microphone.stream.clone();
  };
  const OriginalPeer=window.RTCPeerConnection;
  window.RTCPeerConnection=class extends OriginalPeer{
    constructor(...args){
      super(...args);
      window.demoPeer=this;
      this.addEventListener('track',event=>{
        if(event.track.kind==='audio')audio.createMediaStreamSource(new MediaStream([event.track])).connect(recording);
      });
    }
  };
  window.demoMedia={
    audio,microphone,recording,chunks:[],
    async play(base64,question){
      await audio.resume();
      const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
      const buffer=await audio.decodeAudioData(bytes.buffer);
      const source=audio.createBufferSource();source.buffer=buffer;
      source.connect(recording);
      if(question)source.connect(microphone);
      return new Promise(resolve=>{source.onended=resolve;source.start();});
    },
    start(){
      this.recorder=new MediaRecorder(recording.stream,{mimeType:'audio/webm;codecs=opus'});
      this.recorder.ondataavailable=event=>{if(event.data.size)this.chunks.push(event.data);};
      this.recorder.start(1000);
    },
    async stop(){
      await new Promise(resolve=>{this.recorder.onstop=resolve;this.recorder.stop();});
      const bytes=new Uint8Array(await new Blob(this.chunks).arrayBuffer());
      let encoded='';for(let i=0;i<bytes.length;i+=8192)encoded+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return btoa(encoded);
    }
  };
});
const videoZero=Date.now();
const page=await context.newPage();
const evidence={kind:'actual-azure-application',input:'disclosed-offline-synthetic-speech',microphoneCaptured:false,desktopCaptured:false,steps:[],errors:[]};
let sessionId,finalUsage,voiceStartedAt;
page.on('response',async response=>{
  if(new URL(response.url()).pathname==='/api/session'&&response.ok()){
    const data=await response.json();sessionId=data.sessionId;voiceStartedAt=Date.now();
  }
});
page.on('pageerror',error=>evidence.errors.push(error.message.slice(0,200)));
const pause=ms=>page.waitForTimeout(ms);
async function play(name,question=true){
  const clear=question&&['12-calculator','13-web-search','06-bilingual'].includes(name);
  const bytes=await readFile(join(mediaDirectory,clear&&process.env.DEMO_CLEAR_AUDIO==='1'?'audio-clear':'audio',name+'.wav'));
  await page.evaluate(({data,question})=>window.demoMedia.play(data,question),{data:bytes.toString('base64'),question});
  evidence.steps.push({name,question,atSeconds:Math.round((Date.now()-videoZero)/1000)});
}
async function label(text){
  await page.evaluate(text=>{
    let banner=document.getElementById('recording-disclosure');
    if(!banner){banner=document.createElement('div');banner.id='recording-disclosure';banner.style.cssText='position:fixed;bottom:14px;left:24px;right:24px;z-index:99999;background:#052f43;color:white;padding:12px 20px;border:1px solid #2dd4bf;border-radius:10px;font:18px sans-serif;pointer-events:none';document.body.append(banner);}
    banner.textContent='真实 Azure GPT-Live · 合成提问 / 实时模型回答 · '+text;
  },text);
}
let audioOffset;
try{
  await page.goto(url,{waitUntil:'networkidle',timeout:90000});
  await page.locator('#connectButton').waitFor({state:'visible'});
  await page.selectOption('#uiLanguageSelect','zh-CN');
  await page.locator('.advanced-settings > summary').click();
  await page.locator('#instructionsInput').fill('这是客户演示。回答简短自然；计算、时间、最新资讯委派后端。没有真实来源不要声称联网成功，不执行订单或付款。');
  const draft=await page.locator('#instructionsInput').inputValue();
  await page.selectOption('#uiLanguageSelect','en');
  assert.equal(await page.locator('#instructionsInput').inputValue(),draft);
  await page.selectOption('#uiLanguageSelect','zh-CN');
  await page.locator('#sessionMinutesInput').fill('8');
  await page.locator('#sessionMinutesInput').dispatchEvent('change');
  await page.locator('.advanced-settings > summary').click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await label('演示说明：不采集真人麦克风或桌面');
  audioOffset=(Date.now()-videoZero)/1000;
  await page.evaluate(()=>window.demoMedia.start());
  await play('01-introduction',false);
  await page.click('#connectButton');
  await page.waitForFunction(()=>window.demoPeer?.connectionState==='connected',{},{timeout:60000});
  evidence.connected=true;
  evidence.concurrentAttemptStatus=await page.evaluate(async()=>(await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:'v=0\r\nm=audio',config:{sessionMinutes:1}})})).status);
  assert.equal(evidence.concurrentAttemptStatus,409);
  await label('自然问候');
  await play('02-greeting');await pause(10000);
  await label('全双工与自然打断：停止讲话不等于取消业务');
  await play('03-long-answer');await pause(4000);
  await play('04-interruption');await pause(12000);
  await label('时间工具：读取服务端时钟');
  await play('05-time-tool');await pause(12000);
  await label(process.env.DEMO_CLEAR_AUDIO==='1'?'计算委派：十加二十':'计算委派：18 × 25 + 125');
  await play('12-calculator');await pause(14000);
  await page.locator('#backendDetails').evaluate(element=>element.open=true);
  await label('原生联网搜索：核对工具执行与来源；失败必须可见');
  await play('13-web-search');await pause(20000);
  await page.evaluate(()=>window.demoBeforeLanguage={peer:window.demoPeer,stream:document.getElementById('remoteAudio').srcObject,transcript:document.getElementById('userTranscript').textContent});
  await page.selectOption('#uiLanguageSelect','en');
  evidence.languagePreservesMedia=await page.evaluate(()=>window.demoBeforeLanguage.peer===window.demoPeer&&window.demoBeforeLanguage.stream===document.getElementById('remoteAudio').srcObject&&document.getElementById('userTranscript').textContent.includes(window.demoBeforeLanguage.transcript));
  assert.equal(evidence.languagePreservesMedia,true);
  await label('English 界面切换不中断媒体');
  await play('06-bilingual');await pause(12000);
  await page.click('#muteButton');await pause(1500);await page.click('#muteButton');
  await page.selectOption('#uiLanguageSelect','zh-CN');
  await play('14-goodbye');await pause(5000);
  assert.ok(sessionId,'The app did not return a real session ID.');
  evidence.incomingAudio=await page.evaluate(async()=>[...await window.demoPeer.getStats()].map(([,value])=>value).filter(value=>value.type==='inbound-rtp'&&value.kind==='audio').map(value=>({bytesReceived:value.bytesReceived,packetsReceived:value.packetsReceived,packetsLost:value.packetsLost,totalAudioEnergy:value.totalAudioEnergy,totalSamplesDuration:value.totalSamplesDuration})));
  assert.ok(evidence.incomingAudio.some(audio=>audio.bytesReceived>0&&audio.totalAudioEnergy>0),'No audible real incoming audio was measured.');
  await page.click('#disconnectButton');
  evidence.voiceWallSeconds=Math.ceil((Date.now()-voiceStartedAt)/1000);
  await pause(6000);
  finalUsage=await page.evaluate(async id=>(await fetch(`/api/session/${encodeURIComponent(id)}/status`)).json(),sessionId);
  const diagnostics=await page.evaluate(async()=>(await fetch('/api/diagnostics')).json());
  assert.equal(diagnostics.activeSessions,0);
  evidence.finalStatus=finalUsage;
  evidence.activeSessions=diagnostics.activeSessions;
  evidence.transcripts=await page.locator('#userTranscript, #assistantTranscript').allTextContents();
  await page.screenshot({path:join(output,'application.png')});
  await label('独立验证原生联网查询：以完成事件和实际来源为准');
  await page.locator('.advanced-settings > summary').click();
  await page.locator('#testWebSearchButton').scrollIntoViewIfNeeded();
  await page.click('#testWebSearchButton');
  await page.waitForFunction(()=>!document.getElementById('testWebSearchButton').disabled,{},{timeout:60000});
  evidence.searchProbe={status:await page.locator('#webSearchTestStatus').innerText(),sources:await page.locator('#webSearchTestSources a').count()};
  await pause(5000);
  await page.screenshot({path:join(output,'native-search.png')});
  await page.locator('.advanced-settings > summary').click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await label('会话已关闭：架构与操作说明，不再占用语音计费');
  await play('08-architecture',false);
  const audio=await page.evaluate(()=>window.demoMedia.stop());
  await writeFile(join(output,'interaction-audio.webm'),Buffer.from(audio,'base64'));
}finally{
  if(sessionId){
    await page.evaluate(async id=>{await fetch(`/api/session/${encodeURIComponent(id)}/close`,{method:'POST'});},sessionId).catch(error=>{evidence.errors.push('Close request failed: '+error.message.slice(0,100));});
  }
  await writeFile(join(output,'verification.json'),JSON.stringify(evidence,null,2));
  await context.close();
  await browser.close();
}
const video=await page.video().path();
const result=spawnSync(process.env.FFMPEG_EXE,['-hide_banner','-loglevel','error','-ss',String(audioOffset),'-i',video,'-i',join(output,'interaction-audio.webm'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',join(output,'GPT-Live-Azure-demo.mp4')],{stdio:'inherit'});
if(result.status!==0)throw new Error('Video mux failed; retain original application video and audio for diagnosis.');
console.log(JSON.stringify({output,connected:evidence.connected,voiceSeconds:finalUsage?.usage?.voiceSeconds,activeSessions:evidence.activeSessions,languagePreservesMedia:evidence.languagePreservesMedia}));
