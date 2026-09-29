export function runtimePolicy(mode,env=process.env){
  const raw=env.MAX_SESSION_MINUTES??(mode==='remote'?'10':'30');
  if(!/^\d+$/.test(String(raw))||Number(raw)<1||Number(raw)>30)throw new Error('MAX_SESSION_MINUTES must be an integer from 1 to 30.');
  return {maxSessionMinutes:Number(raw),maxConcurrentSessions:1,modelRequestsPerMinute:mode==='remote'?6:0};
}

// Instance-wide, not IP-based: proxies and fresh login cookies cannot bypass it.
export function createModelRequestLimiter(limit,now=Date.now){
  let requests=[];
  return ()=>{
    const time=now();
    requests=requests.filter(at=>at>time-60000);
    if(!limit)return 0;
    if(requests.length>=limit)return Math.max(1,Math.ceil((requests[0]+60000-time)/1000));
    requests.push(time);
    return 0;
  };
}
