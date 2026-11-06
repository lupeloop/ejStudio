// ════════════════════════════════════════════════════════════════════════════
//  Phone panel bridge: when ejStudio is opened from the car's web server (http://ejlogger.local),
//  this stands in for the desktop connection. Same calls, sent as web requests; live data over one event stream.
// ════════════════════════════════════════════════════════════════════════════
(()=>{
  if(window.rrlab||!/^https?:$/.test(location.protocol)) return;
  const call=(n,...args)=>fetch('/api/ejl/'+n,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({args})})
    .then(r=>{ if(r.status===401){ if(!/passenger=1/.test(location.search)) location.href='/go'; throw new Error('locked'); } return r.json(); }).then(j=>j.r);
  const L=[]; let es=null;
  const open=()=>{ es=new EventSource('/api/events'); es.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch(_){ return; } L.forEach(f=>{ try{ f(m); }catch(_){} }); };
    es.onerror=()=>{ try{ es.close(); }catch(_){} setTimeout(open,2000); }; };
  open();
  window.rrlab={desktop:false,web:true,ejl:{
    send:m=>call('send',m), cfg:()=>call('cfg'), set:(p,o)=>call('set',p,o), state:()=>call('state'), relaunch:()=>call('relaunch'),
    pickDef:()=>call('cfg'), pickDir:()=>call('cfg'), openDir:()=>Promise.resolve(true), openLast:()=>Promise.resolve(false), importCluster:()=>Promise.resolve(false), openCluster:()=>Promise.resolve(true),
    cluster:()=>call('cluster'), writeProp:(f,p,o)=>call('writeProp',f,p,o), saveProfile:(n,l)=>call('saveProfile',n,l), profileOp:(op,n,t)=>call('profileOp',op,n,t),
    logs:()=>call('logs'), logsDo:(a,n,o)=>{ if(a==='zip'){ location.href='/api/logszip?names='+encodeURIComponent(JSON.stringify(n)); return Promise.resolve({ok:true}); } return call('logsDo',a,n,o); },
    usbSync:l=>call('usbSync',l), storageNow:()=>call('storageNow'), net:()=>call('net'),
    backup:()=>{ location.href='/api/backupzip'; return Promise.resolve(true); },
    on:f=>L.push(f)}};
})();
