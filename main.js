// ejStudio desktop shell (Electron). Runs ejstudio.html (ejStudio + ejLogger); adds native file open, a watched
// log folder, clipboard and app-data storage.
const {app,BrowserWindow,ipcMain,dialog,clipboard,shell,utilityProcess}=require('electron');
const fs=require('fs'), path=require('path');
// ejLab → ejStudio: the settings folder moved with the new name; carry the old one over once (before anything touches userData)
try{ const nu=app.getPath('userData'), old=path.join(app.getPath('appData'),'ejLab'); if(!fs.existsSync(nu)&&fs.existsSync(old)) fs.cpSync(old,nu,{recursive:true}); }catch(_){}
const GH_REPO='lupeloop/ejStudio'; 
const CFGF=()=>path.join(app.getPath('userData'),'desktop.json');
let cfg={folder:null,auto:true}, win=null, watcher=null, seen=new Set(); const pending=new Map();
const LOGD=()=>path.join(app.getPath('userData'),'logs');
function elog(t){ try{ fs.mkdirSync(LOGD(),{recursive:true}); fs.appendFileSync(path.join(LOGD(),new Date().toISOString().slice(0,10)+'.log'),t+'\n'); }catch(_){} }
function pruneLogs(){ try{ const cut=Date.now()-5*864e5; for(const f of fs.readdirSync(LOGD())){ const p=path.join(LOGD(),f); if(fs.statSync(p).mtimeMs<cut) fs.unlinkSync(p); } }catch(_){} }
process.on('uncaughtException',e=>elog(new Date().toISOString()+' MAIN '+(e&&e.stack||e)));
const saveCfg=()=>{ try{ fs.writeFileSync(CFGF(),JSON.stringify(cfg)); }catch(_){} };
const argFiles=argv=>argv.slice(1).filter(a=>/\.(csv|tune|json|ejsp|ejstudio|ejlab)$/i.test(a)&&fs.existsSync(a));
const readOut=p=>({name:path.basename(p),path:p,text:fs.readFileSync(p,'utf8')});
const send=(ch,d)=>{ if(win&&!win.isDestroyed()) win.webContents.send(ch,d); if(ch==='ejl'&&typeof phoneBroadcast==='function') phoneBroadcast(d); };
const csvs=dir=>{ try{ return fs.readdirSync(dir).filter(f=>/\.csv$/i.test(f)); }catch(_){ return []; } };
function startWatch(){
  if(watcher){ try{ watcher.close(); }catch(_){} watcher=null; } pending.forEach(t=>clearInterval(t)); pending.clear();
  if(!cfg.folder||!fs.existsSync(cfg.folder)) return; seen=new Set(csvs(cfg.folder));
  try{ watcher=fs.watch(cfg.folder,(ev,fn)=>{ if(!fn||!/\.csv$/i.test(fn)||seen.has(fn)||pending.has(fn)) return;
    const p=path.join(cfg.folder,fn); let last=-1, still=0;
    const t=setInterval(()=>{ let sz; try{ sz=fs.statSync(p).size; }catch(_){ clearInterval(t); pending.delete(fn); return; }
      if(sz>0&&sz===last){ if(++still>=3){ clearInterval(t); pending.delete(fn); seen.add(fn); if(cfg.auto){ try{ send('newlog',readOut(p)); }catch(_){} } } } else { still=0; last=sz; } },1000);
    pending.set(fn,t); }); }catch(_){ watcher=null; } }
// ── ejLogger engine: its own background process (owns ports, polling, CSV) ──
const EJL_CFGF=()=>path.join(app.getPath('userData'),'ejlogger.json');
const CLUSTER_FILE=/^(page|page-[\w.-]+|theme-[\w.-]+|gauges|labels|trim|warnlimits|warnlimits-[\w.-]+|display|warmup|dimming|screensaver|record|profile-meta|network)\.properties$/i;
const EJL_DEF={role:'laptop',defPath:'',ecuPort:'',wbType:'none',wbPort:'',wbUnits:'AFR Gasoline',autoConnect:false,logDir:'',openOnStop:false,fastPoll:true,sel:[],profiles:{},profile:''};
let ejl={cfg:null,proc:null,rec:false,file:null,state:'idle',quitting:false};
const BUILTIN_DEF=path.join(__dirname,'ejLogger','defaults','logger_METRIC_EN_v370.xml').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
function ejlCfg(){ if(!ejl.cfg){ ejl.cfg=Object.assign({},EJL_DEF); try{ Object.assign(ejl.cfg,JSON.parse(fs.readFileSync(EJL_CFGF(),'utf8'))); }catch(_){} if(!ejl.cfg.defPath||!fs.existsSync(ejl.cfg.defPath)) ejl.cfg.defPath=BUILTIN_DEF; if(!ejl.cfg.logDir) ejl.cfg.logDir=path.join(app.getPath('documents'),'ejStudio','logs'); } return ejl.cfg; }
function ejlSave(){ try{ const f=EJL_CFGF(); fs.writeFileSync(f+'.tmp',JSON.stringify(ejl.cfg,null,1)); fs.renameSync(f+'.tmp',f); }catch(e){ elog('ejl cfg '+e); } }
const ejlEngineCfg=c=>({appVersion:app.getVersion(),profile:c.profile||'',defPath:c.defPath,ecuPort:c.ecuPort,wbType:c.wbType,wbPort:c.wbPort,wbUnits:c.wbUnits,logDir:c.logDir,fastPoll:c.fastPoll!==false,replayFile:c.replayFile||'',replayAt:+c.replayAt||0});
function ejlStart(){
  if(ejl.proc) return ejl.proc;
  const p=utilityProcess.fork(path.join(__dirname,'ejLogger','engine','engine.js'),[],{serviceName:'ejLogger engine',stdio:'pipe'});
  if(p.stdout) p.stdout.on('data',d=>elog('ENGINE '+String(d).trim())); if(p.stderr) p.stderr.on('data',d=>elog('ENGINE ERR '+String(d).trim()));
  p.on('message',m=>{ if(!m) return;
    if(m.t==='status') ejl.state=m.state;
    if(m.t==='rec'){ if(m.on&&!ejl.rec) ejl.recT0=Date.now(); ejl.rec=!!m.on; if(m.file) ejl.file=m.file; if(!m.on&&m.file){ ejl.last=m.file; } if(!m.on&&ejl.quitting) setTimeout(()=>app.quit(),150); }
    if(m.t==='error') elog('ejLogger: '+m.text);
    send('ejl',m); });
  p.on('exit',code=>{ elog('ejLogger engine exited '+code); ejl.proc=null; ejl.rec=false; ejl.state='idle'; send('ejl',{t:'status',state:'idle',msg:'Engine stopped'}); });
  p.postMessage({t:'config',cfg:ejlEngineCfg(ejlCfg())}); if((ejlCfg().sel||[]).length) p.postMessage({t:'select',list:ejlCfg().sel});
  ejl.proc=p; return p;
}
const ejlPost=m=>ejlStart().postMessage(m);
const H={}; const reg=(n,fn)=>{ H[n]=fn; ipcMain.handle(n,fn); };
// phone panel (ejLogger/phone.js): on in car mode, off on a laptop unless switched on
let phoneServe=()=>{}, phoneBroadcast=null, phone={port:0,srv:null};
const localIPs=()=>Object.values(require('os').networkInterfaces()).flat().filter(i=>i&&i.family==='IPv4'&&!i.internal).map(i=>i.address);
function ejlIpc(){
  reg('ejl:send',(e,m)=>{ if(m&&m.t==='select'){ ejlCfg().sel=m.list||[]; ejlSave(); send('ejl',{t:'cfg',cfg:ejlCfg(),origin:m.origin}); } ejlPost(m); return true; });
  reg('ejl:cfg',()=>ejlCfg());
  reg('ejl:set',(e,patch,origin)=>{ const c=ejlCfg(); Object.assign(c,patch||{}); ejlSave(); if(ejl.proc) ejl.proc.postMessage({t:'config',cfg:ejlEngineCfg(c)}); send('ejl',{t:'cfg',cfg:c,origin}); if(patch&&('phone' in patch||'role' in patch)) phoneServe(); return c; });
  reg('ejl:pickDef',async()=>{ const r=await dialog.showOpenDialog(win,{title:'Choose the logger definition (logger_METRIC_EN_v370.xml)',properties:['openFile'],filters:[{name:'Logger definition',extensions:['xml']}]});
    if(r.canceled||!r.filePaths[0]) return ejlCfg();
    try{ const d=path.join(app.getPath('userData'),'ejLogger'); fs.mkdirSync(d,{recursive:true}); const dst=path.join(d,path.basename(r.filePaths[0])); if(path.resolve(dst)!==path.resolve(r.filePaths[0])) fs.copyFileSync(r.filePaths[0],dst); ejlCfg().defPath=dst; }
    catch(err){ elog('pickDef '+err); ejlCfg().defPath=r.filePaths[0]; }
    ejlSave(); ejlPost({t:'config',cfg:ejlEngineCfg(ejlCfg())}); return ejlCfg(); });
  reg('ejl:pickReplay',async()=>{ const r=await dialog.showOpenDialog(win,{title:'Choose a log to replay',properties:['openFile'],filters:[{name:'CSV log',extensions:['csv']}],defaultPath:ejlCfg().logDir||undefined}); if(r.canceled||!r.filePaths[0]) return ejlCfg(); ejlCfg().replayFile=r.filePaths[0]; ejlSave(); ejlPost({t:'config',cfg:ejlEngineCfg(ejlCfg())}); return ejlCfg(); });
  reg('ejl:pickDir',async()=>{ const c=ejlCfg(); const r=await dialog.showOpenDialog(win,{title:'Choose the ejLogger log folder',properties:['openDirectory','createDirectory'],defaultPath:c.logDir||undefined});
    if(!r.canceled&&r.filePaths[0]){ c.logDir=r.filePaths[0]; ejlSave(); if(ejl.proc) ejl.proc.postMessage({t:'config',cfg:ejlEngineCfg(c)}); } return c; });
  reg('ejl:openDir',()=>{ const d=ejlCfg().logDir; try{ fs.mkdirSync(d,{recursive:true}); }catch(_){} shell.openPath(d); return true; });
  reg('ejl:readLogs',(e,names)=>{ const L=listLogs(), out=[]; for(const n of names||[]){ const f=L.find(x=>x.name===n&&!x.old); if(f) try{ out.push(readOut(pathOf(f))); }catch(_){} } return out; });
  reg('ejl:openLast',()=>{ const f=ejl.last; if(!f||!fs.existsSync(f)) return false; send('open-files',[readOut(f)]); return true; });
  // cluster sidecars: <userData>/ejLogger/cluster/{customize,profiles}, seeded once from the app's defaults
  const CLD=()=>ejlCfg().clusterDir||path.join(app.getPath('userData'),'ejLogger','cluster');
  const copyDir=(src,dst,re)=>{ try{ fs.mkdirSync(dst,{recursive:true}); for(const f of fs.readdirSync(src)) if(re.test(f)&&fs.statSync(path.join(src,f)).isFile()) fs.copyFileSync(path.join(src,f),path.join(dst,f)); return true; }catch(e){ elog('cluster copy '+e); return false; } };
  function seedCluster(){ const d=CLD(), def=path.join(__dirname,'ejLogger','defaults'), cz=path.join(d,'customize');
    if(!fs.existsSync(cz)){ copyDir(path.join(def,'customize'),cz,/\.properties$/i); copyDir(path.join(def,'profiles'),path.join(d,'profiles'),/\.xml$/i); return; }
    // existing cluster folder: add the preset profiles once (3.1.0), never overwriting the user's own files
    const mark=path.join(cz,'.presets-310'); if(fs.existsSync(mark)) return;
    try{ const added=[]; fs.mkdirSync(path.join(d,'profiles'),{recursive:true});
      for(const f of fs.readdirSync(path.join(def,'profiles'))){ const n=f.replace(/\.xml$/i,''), k=n.replace(/[^A-Za-z0-9_-]/g,'_'); if(fs.existsSync(path.join(d,'profiles',f))) continue;
        fs.copyFileSync(path.join(def,'profiles',f),path.join(d,'profiles',f)); added.push(n);
        for(const pf of ['page-'+k,'theme-'+k]){ const src=path.join(def,'customize',pf+'.properties'), dst=path.join(cz,pf+'.properties'); if(fs.existsSync(src)&&!fs.existsSync(dst)) fs.copyFileSync(src,dst); } }
      const gd=path.join(cz,'gauges.properties'), have=fs.existsSync(gd)?fs.readFileSync(gd,'utf8'):'', keys=new Set(have.split(/\r?\n/).map(l=>l.split('=')[0].trim()));
      const extra=fs.readFileSync(path.join(def,'customize','gauges.properties'),'utf8').split(/\r?\n/).filter(l=>/^gauge\./.test(l)&&!keys.has(l.split('=')[0].trim()));
      if(extra.length) fs.appendFileSync(gd,(have&&!have.endsWith('\n')?'\n':'')+'# preset gauges (3.1.0)\n'+extra.join('\n')+'\n');
      if(added.length){ const mf=path.join(cz,'profile-meta.properties'); let m=fs.existsSync(mf)?fs.readFileSync(mf,'utf8'):''; const om=m.match(/^\s*order\s*=\s*(.*)$/m);
        if(om) m=m.replace(om[0],'order = '+[...om[1].split(',').map(x=>x.trim()).filter(Boolean),...added].join(',')); const gl=fs.readFileSync(path.join(def,'customize','profile-meta.properties'),'utf8').split(/\r?\n/).filter(l=>/^glyph\./.test(l)&&!m.includes(l.split('=')[0].trim()));
        fs.writeFileSync(mf,m+(m&&!m.endsWith('\n')?'\n':'')+gl.join('\n')+(gl.length?'\n':'')); }
      fs.writeFileSync(mark,'presets added '+new Date().toISOString()+': '+added.join(', ')); }catch(e){ elog('presets '+e); } }
  const readAll=(dir,re)=>{ const o={}; try{ for(const f of fs.readdirSync(dir)) if(re.test(f)) o[f]=fs.readFileSync(path.join(dir,f),'utf8'); }catch(_){} return o; };
  reg('ejl:cluster',()=>{ seedCluster(); const d=CLD(), cz=path.join(d,'customize'), qr={}; try{ for(const f of fs.readdirSync(cz)){ if(!/\.png$/i.test(f)) continue; const k=/wifi/i.test(f)?'wifi':/open|hub|url/i.test(f)?'open':null; if(k&&!qr[k]) qr[k]='data:image/png;base64,'+fs.readFileSync(path.join(cz,f)).toString('base64'); } }catch(_){}
    return {dir:d,files:readAll(cz,/\.properties$/i),profiles:readAll(path.join(d,'profiles'),/\.xml$/i),qr}; });
  reg('ejl:importCluster',async()=>{ const r=await dialog.showOpenDialog(win,{title:'Choose a ClusterConfig folder (or its customize folder)',properties:['openDirectory']}); if(r.canceled||!r.filePaths[0]) return false;
    let root=r.filePaths[0]; if(/customize$/i.test(root)) root=path.dirname(root); const cz=path.join(root,'customize'), pf=path.join(root,'profiles');
    if(!fs.existsSync(cz)&&!fs.existsSync(pf)){ dialog.showMessageBox(win,{type:'info',message:'No customize or profiles folder there.',detail:'Pick the ClusterConfig folder that contains customize\\ and profiles\\.'}); return false; }
    const d=CLD(); try{ const bk=path.join(path.dirname(d),'ClusterConfig-backup-'+new Date().toISOString().slice(0,16).replace(/[-:T]/g,'')+'.zip'); fs.writeFileSync(bk,ejl.zipConfig()); }catch(e){ elog('import backup '+e); }
    const took=[], left=[], ls=dd=>{ try{ return fs.readdirSync(dd,{withFileTypes:true}); }catch(_){ return []; } };
    for(const e of ls(cz)){ if(!e.isFile()) { left.push('customize\\'+e.name+'\\'); continue; } if(CLUSTER_FILE.test(e.name)){ fs.mkdirSync(path.join(d,'customize'),{recursive:true}); fs.copyFileSync(path.join(cz,e.name),path.join(d,'customize',e.name)); took.push(e.name); } else left.push('customize\\'+e.name); }
    let np=0; for(const e of ls(pf)){ const f=path.join(pf,e.name); let ok=false; if(e.isFile()&&/\.xml$/i.test(e.name)){ try{ ok=/<profile[\s>]/i.test(fs.readFileSync(f,'utf8').slice(0,4000)); }catch(_){} } if(ok){ fs.mkdirSync(path.join(d,'profiles'),{recursive:true}); fs.copyFileSync(f,path.join(d,'profiles',e.name)); np++; } else left.push('profiles\\'+e.name); }
    for(const e of ls(root)) if(!/^(customize|profiles)$/i.test(e.name)) left.push(e.name+(e.isDirectory()?'\\':''));
    dialog.showMessageBox(win,{type:'info',message:`Imported ${took.length} cluster file${took.length===1?'':'s'} and ${np} profile${np===1?'':'s'}.`,detail:(left.length?`Left out ${left.length} item${left.length===1?'':'s'} ejLogger doesn't use:\n`+left.slice(0,25).join('\n')+(left.length>25?`\n…and ${left.length-25} more`:'')+'\n\n':'')+'Your previous cluster files were backed up next to the cluster folder.'});
    send('ejl',{t:'cluster',origin:'main'}); return true; });
  // move anything ejLogger doesn't read out of the cluster folder (into _unused, nothing is deleted)
  reg('ejl:tidyCluster',()=>{ const d=CLD(), un=path.join(d,'_unused'), moved=[]; const mv=(dir,f)=>{ fs.mkdirSync(un,{recursive:true}); try{ fs.renameSync(path.join(dir,f),path.join(un,f)); moved.push(f); }catch(_){} };
    try{ for(const f of fs.readdirSync(path.join(d,'customize'))) if(!f.startsWith('.')&&!CLUSTER_FILE.test(f)) mv(path.join(d,'customize'),f); }catch(_){}
    try{ for(const f of fs.readdirSync(path.join(d,'profiles'))){ const p=path.join(d,'profiles',f); let ok=false; try{ ok=/\.xml$/i.test(f)&&/<profile[\s>]/i.test(fs.readFileSync(p,'utf8').slice(0,4000)); }catch(_){} if(!ok) mv(path.join(d,'profiles'),f); } }catch(_){}
    if(moved.length) send('ejl',{t:'cluster',origin:'main'}); return {moved}; });
  // sidecar writes: only the keys given change; comments, order and other keys stay; atomic (tmp + rename)
  reg('ejl:writeProp',(e,file,patchObj,origin)=>{ setTimeout(()=>send('ejl',{t:'cluster',origin}),50); try{ seedCluster(); const name=String(file).replace(/[^\w.-]/g,''); if(!name) return false; const f=path.join(CLD(),'customize',name+'.properties');
    let lines=[]; try{ lines=fs.readFileSync(f,'utf8').split(/\r?\n/); }catch(_){ lines=['# '+name+'.properties - written by ejStudio']; }
    for(const [k,v] of Object.entries(patchObj||{})){ const i=lines.findIndex(l=>{ const t=l.trim(); if(!t||t[0]==='#'||t[0]===';') return false; const j=t.indexOf('='); return j>0&&t.slice(0,j).trim()===k; });
      if(v===null||v===undefined){ if(i>=0) lines.splice(i,1); } else if(i>=0) lines[i]=k+' = '+String(v).replace(/[\r\n]+/g,' '); else { while(lines.length&&lines[lines.length-1].trim()==='') lines.pop(); lines.push(k+' = '+String(v).replace(/[\r\n]+/g,' ')); } }
    fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f+'.tmp',lines.join('\r\n').replace(/(\r\n)*$/,'')+'\r\n'); fs.renameSync(f+'.tmp',f); return true; }catch(err){ elog('writeProp '+err); return false; } });
  reg('ejl:openCluster',()=>{ seedCluster(); shell.openPath(CLD()); return true; });
  // ── Logs tab: list, delete, export, zip, open in Graph ──
  const LD=()=>ejlCfg().logDir, OLD=()=>path.join(LD(),'.old');
  const metaOf=(dir,n)=>{ try{ return JSON.parse(fs.readFileSync(path.join(dir,'.meta',n.replace(/\.csv$/i,'.json')),'utf8')); }catch(_){ return null; } };
  function listLogs(){ const out=[]; for(const [dir,old] of [[LD(),false],[OLD(),true]]){ let names=[]; try{ names=fs.readdirSync(dir); }catch(_){}
      for(const n of names){ if(!/\.csv$/i.test(n)) continue; let st; try{ st=fs.statSync(path.join(dir,n)); }catch(_){ continue; } const m=metaOf(dir,n);
        const pm=n.match(/^ejlogger_(\d{4}-\d\d-\d\d)_(\d{4})_(.+?)(?:_\d+)?(_split)?\.csv$/i)||n.match(/^(\d{4}-\d\d-\d\d)_(\d{4})_(.+?)(_split)?\.csv$/);
        out.push({name:n,old,size:st.size,mtime:st.mtimeMs,date:pm?pm[1]:new Date(st.mtimeMs).toISOString().slice(0,10),profile:(m&&m.profile)||(pm?pm[3]:''),split:/_split\.csv$/i.test(n),meta:m}); } }
    return out.sort((a,b)=>b.mtime-a.mtime); }
  const pathOf=f=>path.join(f.old?OLD():LD(),path.basename(f.name));
  function copyLog(f,dest){ fs.mkdirSync(dest,{recursive:true}); fs.copyFileSync(pathOf(f),path.join(dest,path.basename(f.name)));
    const mj=path.join(f.old?OLD():LD(),'.meta',path.basename(f.name).replace(/\.csv$/i,'.json')); if(fs.existsSync(mj)){ fs.mkdirSync(path.join(dest,'.meta'),{recursive:true}); fs.copyFileSync(mj,path.join(dest,'.meta',path.basename(mj))); } }
  function moveLog(f,toOld){ const from=pathOf(f), dir=toOld?OLD():LD(); fs.mkdirSync(path.join(dir,'.meta'),{recursive:true}); fs.renameSync(from,path.join(dir,path.basename(f.name)));
    const mj=path.join(path.dirname(from),'.meta',path.basename(f.name).replace(/\.csv$/i,'.json')); if(fs.existsSync(mj)) fs.renameSync(mj,path.join(dir,'.meta',path.basename(mj))); }
  // minimal zip writer (deflate), no extra dependency
  function writeZip(file,entries){ const b=zipBuf(entries); fs.writeFileSync(file+'.tmp',b); fs.renameSync(file+'.tmp',file); }
  function zipBuf(entries){ const zlib=require('zlib'), parts=[], cen=[]; let off=0;
    for(const [name,data] of entries){ const nb=Buffer.from(name,'utf8'), comp=zlib.deflateRawSync(data), crc=zlib.crc32(data)>>>0, d=new Date(), dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1)), dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate());
      const h=Buffer.alloc(30); h.writeUInt32LE(0x04034b50,0); h.writeUInt16LE(20,4); h.writeUInt16LE(0x0800,6); h.writeUInt16LE(8,8); h.writeUInt16LE(dt,10); h.writeUInt16LE(dd,12); h.writeUInt32LE(crc,14); h.writeUInt32LE(comp.length,18); h.writeUInt32LE(data.length,22); h.writeUInt16LE(nb.length,26);
      parts.push(h,nb,comp); const c=Buffer.alloc(46); c.writeUInt32LE(0x02014b50,0); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(0x0800,8); c.writeUInt16LE(8,10); c.writeUInt16LE(dt,12); c.writeUInt16LE(dd,14); c.writeUInt32LE(crc,16); c.writeUInt32LE(comp.length,20); c.writeUInt32LE(data.length,24); c.writeUInt16LE(nb.length,28); c.writeUInt32LE(off,42);
      cen.push(c,nb); off+=30+nb.length+comp.length; }
    const cs=cen.reduce((a,b)=>a+b.length,0), e=Buffer.alloc(22); e.writeUInt32LE(0x06054b50,0); e.writeUInt16LE(entries.length,8); e.writeUInt16LE(entries.length,10); e.writeUInt32LE(cs,12); e.writeUInt32LE(off,16);
    return Buffer.concat([...parts,...cen,e]); }
  ejl.zipLogs=names=>{ const sel=listLogs().filter(f=>names.includes((f.old?'.old/':'')+f.name)), ent=[]; for(const f of sel){ ent.push([f.name,fs.readFileSync(pathOf(f))]); const mj=path.join(f.old?OLD():LD(),'.meta',f.name.replace(/\.csv$/i,'.json')); if(fs.existsSync(mj)) ent.push(['.meta/'+path.basename(mj),fs.readFileSync(mj)]); } return zipBuf(ent); };
  ejl.zipConfig=()=>{ const cz=path.join(CLD(),'customize'), ent=[]; for(const f of fs.readdirSync(cz)) if(/\.properties$/i.test(f)&&!/^network\.properties$/i.test(f)) ent.push(['customize/'+f,fs.readFileSync(path.join(cz,f))]); try{ for(const f of fs.readdirSync(path.join(CLD(),'profiles'))) if(/\.xml$/i.test(f)) ent.push(['profiles/'+f,fs.readFileSync(path.join(CLD(),'profiles',f))]); }catch(_){} return zipBuf(ent); };
  reg('ejl:logs',()=>({dir:LD(),recording:ejl.rec?path.basename(ejl.file||''):null,files:listLogs(),drives:ejl.drives||[]}));
  reg('ejl:logsDo',async(e,act,names,opt)=>{ const all=listLogs(), sel=all.filter(f=>names.includes((f.old?'.old/':'')+f.name)), recName=ejl.rec?path.basename(ejl.file||''):null;
    try{
      if(act==='delete'){ const r=opt&&opt.confirmed?1:dialog.showMessageBoxSync(win,{type:'warning',buttons:['Cancel','Delete'],defaultId:0,cancelId:0,message:`Delete ${sel.length} log${sel.length===1?'':'s'}?`,detail:'This cannot be undone.'}); if(r!==1) return {ok:false};
        let n=0; for(const f of sel){ if(!f.old&&f.name===recName) continue; fs.unlinkSync(pathOf(f)); try{ fs.unlinkSync(path.join(f.old?OLD():LD(),'.meta',f.name.replace(/\.csv$/i,'.json'))); }catch(_){} n++; } return {ok:true,n}; }
      if(act==='export'){ let dest=opt&&opt.dest; if(!dest){ const r=await dialog.showOpenDialog(win,{title:'Export logs to…',properties:['openDirectory','createDirectory']}); if(r.canceled||!r.filePaths[0]) return {ok:false}; dest=r.filePaths[0]; }
        for(const f of sel) copyLog(f,dest); return {ok:true,n:sel.length,dest}; }
      if(act==='zip'){ const d=new Date(), def=`ejlogger_logs_${d.toISOString().slice(0,10)}.zip`; const r=await dialog.showSaveDialog(win,{title:'Save logs as zip',defaultPath:path.join(app.getPath('downloads'),def),filters:[{name:'Zip',extensions:['zip']}]}); if(r.canceled||!r.filePath) return {ok:false};
        const ent=[]; for(const f of sel){ ent.push([f.name,fs.readFileSync(pathOf(f))]); const mj=path.join(f.old?OLD():LD(),'.meta',f.name.replace(/\.csv$/i,'.json')); if(fs.existsSync(mj)) ent.push(['.meta/'+path.basename(mj),fs.readFileSync(mj)]); }
        writeZip(r.filePath,ent); return {ok:true,n:sel.length,dest:r.filePath}; }
      if(act==='graph'){ send('open-files',sel.map(f=>readOut(pathOf(f)))); return {ok:true,n:sel.length}; }
      if(act==='toOld'||act==='fromOld'){ for(const f of sel) if(f.name!==recName) moveLog(f,act==='toOld'); return {ok:true}; }
    }catch(err){ elog('logs '+act+' '+err); return {ok:false,error:String(err.message||err)}; }
    return {ok:false}; });
  // ── USB sticks: shown as export targets; in car mode a matching stick offers to sync logs (like logsync.ps1) ──
  ejl.drives=[];
  function scanDrives(){ if(process.platform!=='win32') return; const now=[]; for(const L of 'DEFGHIJKLMNOPQRSTUVWXYZ'){ try{ if(fs.existsSync(L+':\\')) now.push(L); }catch(_){} }
    const prev=ejl.drives.map(d=>d.letter), added=now.filter(L=>!prev.includes(L));
    ejl.drives=ejl.drives.filter(d=>now.includes(d.letter));
    for(const L of added){ require('child_process').execFile('cmd',['/c','vol',L+':'],{windowsHide:true,timeout:3000},(err,out)=>{ const m=String(out||'').match(/is\s+(.+)\r?\n/), label=m?m[1].trim():'';
      if(/Volume Serial|has no label/i.test(label)&&!m) return; const d={letter:L,label:/has no label/i.test(String(out))?'':label,path:L+':\\'}; ejl.drives.push(d); send('ejl',{t:'usb',on:true,drive:d}); }); }
    for(const L of prev.filter(L=>!now.includes(L))) send('ejl',{t:'usb',on:false,drive:{letter:L}}); }
  setInterval(scanDrives,3000); setTimeout(scanDrives,1500);
  reg('ejl:usbSync',async(e,letter)=>{ const d=ejl.drives.find(x=>x.letter===letter); if(!d) return {ok:false,error:'Stick removed'}; const dest=path.join(d.path,'logs'), recName=ejl.rec?path.basename(ejl.file||''):null; let n=0, moved=0;
    const fresh=listLogs().filter(f=>!f.old&&f.name!==recName);
    for(const f of fresh){ try{ const t=path.join(dest,f.name); if(!(fs.existsSync(t)&&fs.statSync(t).size===f.size)){ copyLog(f,dest); n++; send('ejl',{t:'usbProgress',name:f.name,i:n,of:fresh.length}); }
      if(fs.existsSync(t)&&fs.statSync(t).size===f.size){ moveLog(f,true); moved++; } }catch(err){ elog('usb sync '+err); } }
    return {ok:true,copied:n,moved}; });
  // ── USB stick: find the newest .tune and an ejStudio update anywhere on the stick ──
  const verNum=v=>String(v||'').split('.').map(x=>parseInt(x,10)||0).reduce((a,x)=>a*1000+x,0);
  function stickWalk(root){ const tunes=[], exes=[], SKIP=/^(System Volume Information|\$RECYCLE\.BIN|logs|\..*)$/i;
    const walk=(dir,depth)=>{ if(depth>5) return; let ents=[]; try{ ents=fs.readdirSync(dir,{withFileTypes:true}); }catch(_){ return; }
      for(const e of ents){ const p=path.join(dir,e.name); if(e.isDirectory()){ if(!SKIP.test(e.name)) walk(p,depth+1); continue; }
        if(/\.tune$/i.test(e.name)) try{ const st=fs.statSync(p); tunes.push({path:p,name:e.name,mtime:st.mtimeMs,size:st.size}); }catch(_){}
        const m=e.name.match(/^ejStudio[- ]Setup[- ](\d+\.\d+\.\d+)\.exe$/i); if(m) try{ const st=fs.statSync(p); exes.push({path:p,name:e.name,version:m[1],size:st.size}); }catch(_){} } };
    walk(root,0); tunes.sort((a,b)=>b.mtime-a.mtime); exes.sort((a,b)=>verNum(b.version)-verNum(a.version)); return {tunes,exes}; }
  reg('ejl:usbScan',(e,letter)=>{ const d=ejl.drives.find(x=>x.letter===letter); if(!d) return null; const recName=ejl.rec?path.basename(ejl.file||''):null, dest=path.join(d.path,'logs');
    const fresh=listLogs().filter(f=>!f.old&&f.name!==recName&&!(()=>{ try{ return fs.statSync(path.join(dest,f.name)).size===f.size; }catch(_){ return false; } })());
    const w=stickWalk(d.path), t=w.tunes[0]||null, last=ejlCfg().usbTune||{}, up=w.exes[0]&&verNum(w.exes[0].version)>verNum(app.getVersion())?w.exes[0]:null;
    return {drive:d,logs:fresh.length,tune:t&&!(last.name===t.name&&last.size===t.size&&last.mtime===t.mtime)?t:null,update:up,version:app.getVersion()}; });
  // tune from the stick: keep a copy under userData\tunes, earlier ones in .old (last 3)
  reg('ejl:usbTune',(e,p,cur)=>{ try{ const dir=path.join(app.getPath('userData'),'tunes'), old=path.join(dir,'.old'); fs.mkdirSync(old,{recursive:true}); const stamp=new Date().toISOString().slice(0,16).replace(/[-:T]/g,'');
      if(cur&&cur.name&&cur.text) fs.writeFileSync(path.join(old,stamp+'_'+path.basename(cur.name)),cur.text);
      for(const f of fs.readdirSync(dir)) if(/\.tune$/i.test(f)) fs.renameSync(path.join(dir,f),path.join(old,stamp+'_'+f));
      const keep=fs.readdirSync(old).map(f=>({f,t:fs.statSync(path.join(old,f)).mtimeMs})).sort((a,b)=>b.t-a.t); for(const k of keep.slice(3)) try{ fs.unlinkSync(path.join(old,k.f)); }catch(_){}
      const text=fs.readFileSync(p,'utf8'), st=fs.statSync(p), tmp=path.join(dir,path.basename(p)+'.part'); fs.writeFileSync(tmp,text); fs.renameSync(tmp,path.join(dir,path.basename(p)));
      ejlCfg().usbTune={name:path.basename(p),size:st.size,mtime:st.mtimeMs}; ejlSave(); return {ok:true,name:path.basename(p),text}; }catch(err){ elog('usb tune '+err); return {ok:false,error:String(err.message||err)}; } });
  // update from the stick: copy the installer off the stick first, then run it silently (current user, no admin) and relaunch
  reg('ejl:usbUpdate',async(e,p,go)=>{ try{ const dir=path.join(app.getPath('temp'),'ejStudio-update'); fs.mkdirSync(dir,{recursive:true}); const dst=path.join(dir,path.basename(p));
      if(!go){ fs.copyFileSync(p,dst); if(fs.statSync(dst).size!==fs.statSync(p).size) throw new Error('copy check failed'); ejl.pendingUpdate=dst; return {ok:true,staged:dst,perMachine:/Program Files/i.test(process.execPath)}; }
      const f=ejl.pendingUpdate||dst; if(!fs.existsSync(f)) throw new Error('installer missing'); try{ ejl.proc&&ejl.proc.postMessage({t:'quit'}); }catch(_){}
      require('child_process').spawn(f,['/S','--force-run'],{detached:true,stdio:'ignore',windowsHide:true}).unref(); setTimeout(()=>app.quit(),600); return {ok:true}; }catch(err){ elog('usb update '+err); return {ok:false,error:String(err.message||err)}; } });
  // ── Log storage: move old logs to .old, optionally delete old .old logs, warn on low disk ──
  function storage(){ const c=ejlCfg(), S=c.storage||{}, day=864e5, now=Date.now(), recName=ejl.rec?path.basename(ejl.file||''):null;
    try{ const zd=S.zipAfterDays==null?30:+S.zipAfterDays; if(zd>0){ const z=listLogs().filter(f=>!(!f.old&&f.name===recName)&&now-f.mtime>zd*day);
        if(z.length){ const ent=[]; for(const f of z){ ent.push([f.name,fs.readFileSync(pathOf(f))]); const mj=path.join(f.old?OLD():LD(),'.meta',f.name.replace(/\.csv$/i,'.json')); if(fs.existsSync(mj)) ent.push(['.meta/'+path.basename(mj),fs.readFileSync(mj)]); }
          fs.mkdirSync(OLD(),{recursive:true}); const zf=path.join(OLD(),'archive_'+new Date().toISOString().slice(0,10)+'_'+Date.now().toString(36)+'.zip'); fs.writeFileSync(zf,zipBuf(ent));
          for(const f of z){ try{ fs.unlinkSync(pathOf(f)); fs.unlinkSync(path.join(f.old?OLD():LD(),'.meta',f.name.replace(/\.csv$/i,'.json'))); }catch(_){} } elog('archived '+z.length+' logs to '+path.basename(zf)); } }
      if(S.oldAfterDays>0) for(const f of listLogs()) if(!f.old&&f.name!==recName&&now-f.mtime>S.oldAfterDays*day) moveLog(f,true);
      if(S.deleteOldAfterDays>0) for(const f of listLogs()) if(f.old&&now-f.mtime>S.deleteOldAfterDays*day){ fs.unlinkSync(pathOf(f)); try{ fs.unlinkSync(path.join(OLD(),'.meta',f.name.replace(/\.csv$/i,'.json'))); }catch(_){} }
      fs.mkdirSync(LD(),{recursive:true}); const st=fs.statfsSync(LD()), free=st.bavail*st.bsize/1e9; send('ejl',{t:'disk',freeGB:+free.toFixed(1),low:free<(S.diskWarnGB==null?2:S.diskWarnGB)}); }catch(err){ elog('storage '+err); } }
  setTimeout(storage,8000); setInterval(storage,3600e3); reg('ejl:storageNow',()=>{ storage(); return true; });
  reg('ejl:relaunch',()=>{ ejlSave(); if(ejl.rec) return false; app.relaunch(); app.exit(0); return true; });
  // ── profiles: RomRaider profile XML in the cluster folder; only dash="selected" is edited ──
  const PDIR=()=>path.join(CLD(),'profiles'), pkey=n=>String(n).replace(/[^A-Za-z0-9_-]/g,'_');
  reg('ejl:saveProfile',(e,name,list)=>{ try{ seedCluster(); const f=path.join(PDIR(),pkey(name)+'.xml'); fs.mkdirSync(PDIR(),{recursive:true});
      const want=new Map(list.map(x=>[x.xid,x])); let x=fs.existsSync(f)?fs.readFileSync(f,'latin1'):'<?xml version="1.0" encoding="ISO-8859-1"?>\r\n<profile protocol="SSM">\r\n<parameters>\r\n</parameters>\r\n<switches>\r\n</switches>\r\n<externals>\r\n</externals>\r\n</profile>\r\n';
      const seen=new Set();
      x=x.replace(/<(parameter|ecuparam|switch|external)\s+([^>]*?)(\/?)>/g,(all,tag,attrs,sl)=>{ const id=(attrs.match(/\bid="([^"]*)"/)||[])[1]; if(!id) return all; seen.add(id);
        let a=attrs.replace(/\s*\bdash="[^"]*"/,''); if(want.has(id)){ a=a.replace(/\s*$/,'')+' dash="selected"'; const u=want.get(id).units; if(u&&!/\bunits="/.test(a)) a+=` units="${u}"`; } return `<${tag} ${a.trim()}${sl?'/':''}>`; });
      const add={parameters:[],switches:[],externals:[]};
      for(const [id,v] of want){ if(seen.has(id)) continue; const tag=v.kind==='switch'?'switch':v.kind==='external'?'external':'parameter'; add[tag==='switch'?'switches':tag==='external'?'externals':'parameters'].push(`<${tag} id="${id}" dash="selected"${v.units?` units="${v.units}"`:''}/>`); }
      for(const [sec,arr] of Object.entries(add)) if(arr.length){ if(x.includes(`</${sec}>`)) x=x.replace(`</${sec}>`,arr.join('\r\n')+'\r\n</'+sec+'>'); else x=x.replace('</profile>',`<${sec}>\r\n${arr.join('\r\n')}\r\n</${sec}>\r\n</profile>`); }
      fs.writeFileSync(f+'.tmp',x,'latin1'); fs.renameSync(f+'.tmp',f); send('ejl',{t:'cluster'}); return true; }catch(err){ elog('saveProfile '+err); return false; } });
  const pfiles=n=>{ const k=pkey(n), cz=path.join(CLD(),'customize'); return [path.join(PDIR(),k+'.xml'),path.join(cz,'page-'+k+'.properties'),path.join(cz,'theme-'+k+'.properties'),path.join(cz,'warnlimits-'+k+'.properties')]; };
  reg('ejl:profileOp',(e,op,name,to)=>{ try{ const A=pfiles(name), B=to?pfiles(to):null;
      if(op==='delete'){ for(const f of A) try{ fs.unlinkSync(f); }catch(_){} }
      else if(op==='rename'||op==='duplicate'){ if(fs.existsSync(B[0])) return {ok:false,error:'A profile with that name already exists'}; A.forEach((f,i)=>{ if(fs.existsSync(f)) (op==='rename'?fs.renameSync:fs.copyFileSync)(f,B[i]); }); if(op==='rename'&&ejlCfg().profile===name){ ejlCfg().profile=to; ejlSave(); } }
      send('ejl',{t:'cluster'}); return {ok:true}; }catch(err){ elog('profileOp '+err); return {ok:false,error:String(err.message||err)}; } });
  reg('ejl:backup',async()=>{ const r=await dialog.showSaveDialog(win,{title:'Back up the cluster config',defaultPath:path.join(app.getPath('documents'),`ejlogger_config_${new Date().toISOString().slice(0,10)}.zip`),filters:[{name:'Zip',extensions:['zip']}]}); if(r.canceled||!r.filePath) return false; fs.writeFileSync(r.filePath,ejl.zipConfig()); return true; });
  reg('ejl:net',()=>({port:phone.port||0,ips:localIPs(),on:!!phone.srv}));
  const panel=require('./ejLogger/phone')({H,root:__dirname,cfg:ejlCfg,clusterDir:CLD,zipLogs:n=>ejl.zipLogs(n),zipConfig:()=>ejl.zipConfig(),log:elog,onPass:()=>send('ejl',{t:'cluster',origin:'main'}),
    onState:()=>{ phone=panel.state; send('ejl',{t:'net',port:phone.port,ips:localIPs(),on:!!phone.srv}); }});
  phone=panel.state; phoneBroadcast=m=>panel.broadcast(m);
  phoneServe=()=>{ const c=ejlCfg(), want=c.phone==null?c.role==='car':!!c.phone; if(want) panel.start(); else { panel.stop(); send('ejl',{t:'net',port:0,ips:[],on:false}); } };
  setTimeout(phoneServe,1500);
  reg('ejl:state',()=>({state:ejl.state,rec:ejl.rec,recMs:ejl.rec&&ejl.recT0?Date.now()-ejl.recT0:0,file:ejl.file,last:ejl.last||null,running:!!ejl.proc}));
}
function create(){
  const CAR=ejlCfg().role==='car';
  win=new BrowserWindow({width:CAR?1024:1600,height:CAR?600:960,minWidth:CAR?640:1100,minHeight:CAR?400:680,fullscreen:CAR,frame:!CAR,backgroundColor:'#000000',title:'ejStudio',icon:path.join(__dirname,'logos/ejstudio.ico'),
    autoHideMenuBar:true,show:false,titleBarStyle:CAR?undefined:'hidden',titleBarOverlay:CAR?false:{color:'#000000',symbolColor:'#e8e8ea',height:38},webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,spellcheck:false}});
  win.removeMenu();
  win.on('close',e=>{ if(ejl.rec&&!ejl.quitting){ e.preventDefault(); const r=dialog.showMessageBoxSync(win,{type:'warning',buttons:['Keep recording','Stop and close'],defaultId:0,cancelId:0,title:'ejLogger is recording',message:'ejLogger is recording a log.',detail:'Stop the recording and close ejStudio? The log file is closed cleanly first.'});
    if(r===1){ ejl.quitting=true; try{ ejl.proc.postMessage({t:'rec',on:false}); }catch(_){ app.quit(); } setTimeout(()=>app.quit(),3000); } } });
  let shown=false; const showIt=()=>{ if(shown||!win||win.isDestroyed()) return; shown=true; win.maximize(); win.show(); }; win.once('ready-to-show',showIt); setTimeout(()=>{ if(!shown){ try{ elog('ready-to-show did not fire within 8 s; showing anyway'); }catch(_){} showIt(); } },8000);
  win.webContents.on('render-process-gone',(e,d)=>{ try{ elog('renderer gone: '+JSON.stringify(d)); }catch(_){} if(d&&d.reason!=='clean-exit'&&!win.isDestroyed()){ showIt(); win.reload(); } });
  win.webContents.on('did-fail-load',(e,code,desc)=>{ try{ elog('load failed: '+code+' '+desc); }catch(_){} showIt(); });
  win.webContents.setWindowOpenHandler(({url})=>(!url||url==='about:blank')?{action:'allow',overrideBrowserWindowOptions:{backgroundColor:'#000000',autoHideMenuBar:true,icon:path.join(__dirname,'logos/ejstudio.ico')}}:{action:'deny'});
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.on('will-download',(e,item)=>{ item.once('done',(ev,st)=>{ if(st==='completed') DLS.set(item.getFilename(),item.getSavePath()); }); });
  win.webContents.on('did-finish-load',()=>{ const f=argFiles(process.argv); if(f.length) send('open-files',f.map(readOut)); });
  win.loadFile(path.join(__dirname,'ejstudio.html'),CAR?{query:{car:'1'}}:undefined);
  if(CAR) win.webContents.on('before-input-event',(e,i)=>{ if(i.type==='keyDown'&&i.control&&i.shift&&i.key.toLowerCase()==='q'){ e.preventDefault(); win.close(); } });
}
process.on('uncaughtException',err=>{ try{ elog('main crash: '+(err&&err.stack||err)); }catch(_){} });
const SELFA=process.argv.find(a=>a.startsWith('--selftest')), SELF=!!SELFA, SELFOUT=v=>{ v=String(v).replace(/→/g,'->').replace(/[·•]/g,'-').replace(/[^\x00-\x7e\r\n]/g,''); const p=process.argv.find(a=>a.startsWith('--out=')); try{ if(p) fs.writeFileSync(p.slice(6),v); }catch(_){} console.log(v); };
if(SELF){ app.whenReady().then(async()=>{ const dir=SELFA.includes('=')?SELFA.slice(SELFA.indexOf('=')+1):path.join(__dirname,'tests','fixtures'); let files=[]; try{ files=fs.readdirSync(dir).filter(f=>/\.(csv|tune)$/i.test(f)).map(f=>({name:f,text:fs.readFileSync(path.join(dir,f),'utf8')})); }catch(_){}
  if(!files.length){ SELFOUT('No test fixtures found in '+dir); app.exit(1); return; }
  setTimeout(()=>{ SELFOUT('Self-test timed out after 3 minutes'); app.exit(2); },180000);
  const w=new BrowserWindow({show:false,width:1400,height:900,webPreferences:{contextIsolation:true}}); await w.loadFile(path.join(__dirname,'ejstudio.html'));
  try{ const r=await w.webContents.executeJavaScript('window.__selftest('+JSON.stringify(files)+')'); SELFOUT(r.out.join('\r\n')+(r.fail?`\r\n\r\n${r.fail} test(s) FAILED`:'\r\n\r\nAll tests passed')); app.exit(r.fail?1:0); }
  catch(e){ SELFOUT('Self-test crashed: '+(e&&e.stack||e)); app.exit(1); } }); }
else if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',(e,argv)=>{ if(win){ if(win.isMinimized()) win.restore(); if(!win.isVisible()) win.show(); win.focus(); const f=argFiles(argv); if(f.length) send('open-files',f.map(readOut)); } });
  app.whenReady().then(()=>{ try{ cfg=Object.assign(cfg,JSON.parse(fs.readFileSync(CFGF(),'utf8'))); }catch(_){}
    // 3.1.0: with no log folder chosen, follow the folder ejLogger records into (not on a car PC)
    if(!cfg.folder){ try{ const c=ejlCfg(); if(c.role!=='car'){ const d=c.logDir||path.join(require('os').homedir(),'Documents','ejStudio','logs'); fs.mkdirSync(d,{recursive:true}); cfg.folder=d; saveCfg(); } }catch(_){} }
    ipcMain.handle('watch:get',()=>cfg);
    ipcMain.handle('watch:pick',async()=>{ const r=await dialog.showOpenDialog(win,{title:'Choose the log folder',properties:['openDirectory'],defaultPath:cfg.folder||undefined});
      if(!r.canceled&&r.filePaths[0]){ cfg.folder=r.filePaths[0]; saveCfg(); startWatch(); } return cfg; });
    ipcMain.handle('watch:auto',(e,v)=>{ cfg.auto=!!v; saveCfg(); return cfg; });
    ipcMain.handle('watch:off',()=>{ cfg.folder=null; saveCfg(); startWatch(); return cfg; });
    ipcMain.handle('watch:newest',()=>{ if(!cfg.folder) return null; const l=csvs(cfg.folder).map(f=>({f,t:fs.statSync(path.join(cfg.folder,f)).mtimeMs})).sort((a,b)=>b.t-a.t);
      return l.length?readOut(path.join(cfg.folder,l[0].f)):null; });
    const DLS=new Map();
ipcMain.handle('dl:show',(e,n)=>{ const p=DLS.get(String(n)); if(p&&fs.existsSync(p)) shell.showItemInFolder(p); else shell.openPath(app.getPath('downloads')); return true; });
function askSpec(m){ if(m&&typeof m==='object') return m; const msg=String(m), ps=msg.split(/\n\n+/); let lab='OK', q='';
  if(ps.length>1&&/\?\s*$/.test(ps[ps.length-1])){ q=ps.pop().trim(); if(q.length<=28) lab=q.replace(/\?$/,''); }
  const r=msg.match(/^(Delete|Reset|Discard)\b/); if(r&&lab==='OK') lab=r[1];
  return {msg:ps.join('\n\n'),sub:q&&lab==='OK'?q:'',btns:['Cancel',lab],primary:1,cancel:0,red:!!r}; }
function askHtml(s){ const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])), red=!!s.red, A=red?'#ff6b6b':'#e4aa28', AD=red?'255,107,107':'228,170,40', foc=red?s.cancel:s.primary;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent;font:14px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#e8e8ea;user-select:none;overflow:hidden}
.c{margin:8px;background:#0c0c10;border:1px solid #2a2a31;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.6);padding:18px 20px 16px;animation:in .16s cubic-bezier(.16,1,.3,1)}
@keyframes in{from{opacity:0;transform:scale(.97)}}
.h{display:flex;gap:12px;align-items:flex-start}.i{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:700 14px Consolas,monospace;background:rgba(${AD},.12);color:${A};border:1px solid rgba(${AD},.35)}
p{margin:2px 0 8px;color:#c9c9cf;white-space:pre-wrap;word-wrap:break-word}p:first-child{color:#e8e8ea}.q{color:#8a8a92;font-size:13px}
.b{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}button{font:600 13px -apple-system,'Segoe UI',Roboto,sans-serif;border-radius:8px;padding:7px 16px;cursor:pointer;border:1px solid #2a2a31;background:#141419;color:#e8e8ea;transition:background-color .15s,border-color .15s}
button:hover{border-color:#3d3d47}.y{background:${A};border-color:${A};color:#000}.y:hover{filter:brightness(1.08);border-color:${A}}.l{margin-right:auto}button:focus-visible{outline:2px solid #e4aa28;outline-offset:2px}
</style></head><body><div class="c"><div class="h"><div class="i">!</div><div style="flex:1;min-width:0">${String(s.msg).split(/\n\n+/).map(x=>`<p>${esc(x)}</p>`).join('')}${s.sub?`<p class="q">${esc(s.sub)}</p>`:''}</div></div>
<div class="b">${s.btns.map((t,i)=>`<button id="b${i}" class="${i===s.primary?'y':''}${i===s.left?' l':''}">${esc(t)}</button>`).join('')}</div></div>
<script>const s=t=>{document.title='';document.title=t};document.querySelectorAll('button').forEach(b=>b.onclick=()=>s('b:'+b.id.slice(1)));addEventListener('keydown',e=>{if(e.key==='Escape')s('b:${s.cancel}');});addEventListener('load',()=>{document.title='h:'+Math.ceil(document.body.scrollHeight);document.getElementById('b${foc}').focus();});</script></body></html>`; }
function askWin(e,s,done){ const par=BrowserWindow.fromWebContents(e.sender); let fin=false, w=null; const end=i=>{ if(fin) return; fin=true; done(i); try{ w&&!w.isDestroyed()&&w.destroy(); }catch(_){} };
  try{ w=new BrowserWindow({parent:par||undefined,modal:!!par,show:false,frame:false,transparent:true,resizable:false,minimizable:false,maximizable:false,skipTaskbar:true,width:476,height:220,backgroundColor:'#00000000',webPreferences:{contextIsolation:true}});
    w.webContents.on('page-title-updated',(ev,t)=>{ if(t.startsWith('h:')){ const h=Math.min(640,+t.slice(2)); if(par){ const b=par.getBounds(); w.setBounds({x:Math.round(b.x+(b.width-476)/2),y:Math.round(b.y+(b.height-h)/2.4),width:476,height:h}); } else w.setContentSize(476,h); w.show(); w.focus(); } else if(t.startsWith('b:')) end(+t.slice(2)); });
    w.on('closed',()=>end(s.cancel)); w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(askHtml(s)));
  }catch(err){ end(s.cancel); } }
ipcMain.on('confirm-sync',(e,m)=>{ const s=askSpec(m); askWin(e,s,i=>{ e.returnValue=(i===s.primary); }); });
ipcMain.on('ask-sync',(e,m)=>{ const s=askSpec(m); askWin(e,s,i=>{ e.returnValue=i; }); });
ipcMain.handle('proj:save',async(e,o)=>{ let p=o&&o.path; if(!p){ const w=BrowserWindow.fromWebContents(e.sender), sg=(o&&o.suggest)||'project.ejsp';
    const r=await dialog.showSaveDialog(w,{title:'Save project',defaultPath:path.isAbsolute(sg)?sg:path.join(app.getPath('documents'),sg),filters:[{name:'ejStudio project',extensions:['ejsp']}]}); if(r.canceled||!r.filePath) return null; p=r.filePath; if(!/\.ejsp$/i.test(p)) p+='.ejsp'; }
  const tmp=p+'.tmp'; fs.writeFileSync(tmp,o.text); fs.renameSync(tmp,p); return p; });
ipcMain.handle('proj:open',async e=>{ const w=BrowserWindow.fromWebContents(e.sender); const r=await dialog.showOpenDialog(w,{title:'Open project',properties:['openFile'],filters:[{name:'ejStudio project',extensions:['ejsp','ejstudio','ejlab']}]}); if(r.canceled||!r.filePaths[0]) return null; return readOut(r.filePaths[0]); });
ipcMain.handle('proj:read',(e,p)=>{ try{ return p&&fs.existsSync(p)?readOut(p):null; }catch(_){ return null; } });
ipcMain.handle('capture',async(e,r)=>{ const w=BrowserWindow.fromWebContents(e.sender); const img=await e.sender.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.w),height:Math.round(r.h)});
      const s=await dialog.showSaveDialog(w,{defaultPath:r.name,filters:[{name:'PNG image',extensions:['png']}]}); if(s.canceled||!s.filePath) return null; fs.writeFileSync(s.filePath,img.toPNG()); return s.filePath; });
    ipcMain.handle('info',()=>({version:app.getVersion(),electron:process.versions.electron,chrome:process.versions.chrome,userData:app.getPath('userData')}));
    ipcMain.handle('readFiles',(e,ps)=>{ const out=[]; for(const p of (ps||[]).slice(0,60)){ if(!/\.(csv|tune|json)$/i.test(String(p))) continue; try{ if(fs.existsSync(p)) out.push(readOut(p)); }catch(_){} } return out; });
    ipcMain.handle('openData',()=>shell.openPath(app.getPath('userData')));
    ipcMain.handle('openUrl',(e,u)=>{ if(/^https:\/\//.test(String(u))) shell.openExternal(u); return true; });
    ipcMain.handle('log',(e,t)=>{ elog(String(t)); return true; });
    ipcMain.handle('readLog',()=>{ try{ return fs.readdirSync(LOGD()).sort().map(f=>fs.readFileSync(path.join(LOGD(),f),'utf8')).join('').slice(-200000); }catch(_){ return ''; } });
    pruneLogs();
    ipcMain.handle('paste',()=>clipboard.readText());
    ipcMain.handle('zoom',(e,f)=>{ const v=Math.max(0.8,Math.min(1.5,+f||1)); e.sender.setZoomFactor(v); return v; });
    ipcMain.handle('backup',(e,car,file,txt)=>{ try{ const d=path.join(app.getPath('userData'),'revisions',String(car).replace(/[^\w.-]+/g,'_')); fs.mkdirSync(d,{recursive:true}); const p=path.join(d,new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)+'_'+path.basename(String(file))); fs.writeFileSync(p,String(txt)); return p; }catch(err){ elog('backup '+err); return null; } });
    ipcMain.handle('copy',(e,t)=>{ clipboard.writeText(String(t)); return true; });
    const REPD=()=>path.join(app.getPath('userData'),'reports');
    ipcMain.handle('report:save',(e,name,b64)=>{ try{ const n=String(name).replace(/[^\w.-]+/g,'_'); fs.mkdirSync(REPD(),{recursive:true}); const p=path.join(REPD(),n); fs.writeFileSync(p+'.tmp',Buffer.from(String(b64),'base64')); fs.renameSync(p+'.tmp',p); return p; }catch(err){ elog('report:save '+err); return null; } });
    ipcMain.handle('report:open',(e,name)=>{ try{ fs.mkdirSync(REPD(),{recursive:true}); const p=name?path.join(REPD(),String(name).replace(/[^\w.-]+/g,'_')):''; if(p&&fs.existsSync(p)) shell.showItemInFolder(p); else shell.openPath(REPD()); }catch(_){} return true; });
    ejlIpc(); startWatch(); create(); });
  app.on('will-quit',()=>{ if(ejl.proc){ try{ ejl.proc.postMessage({t:'quit'}); }catch(_){} } });
  app.on('window-all-closed',()=>app.quit());
}
