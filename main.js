// ejStudio desktop shell (Electron). Runs ejstudio.html (ejStudio + ejLogger); adds native file open, a watched
// RomRaider log folder, clipboard and app-data storage.
const {app,BrowserWindow,ipcMain,dialog,clipboard,shell,utilityProcess}=require('electron');
const fs=require('fs'), path=require('path');
// ejLab → ejStudio: the settings folder moved with the new name; carry the old one over once (before anything touches userData)
try{ const nu=app.getPath('userData'), old=path.join(app.getPath('appData'),'ejLab'); if(!fs.existsSync(nu)&&fs.existsSync(old)) fs.cpSync(old,nu,{recursive:true}); }catch(_){}
const GH_REPO='lupeloop/ejLab'; let GHT=''; try{ GHT=Buffer.from(require('./ghtoken.js'),'base64').toString('utf8').split('').reverse().join('').trim(); }catch(_){}
const CFGF=()=>path.join(app.getPath('userData'),'desktop.json');
let cfg={folder:null,auto:true}, win=null, watcher=null, seen=new Set(); const pending=new Map();
const LOGD=()=>path.join(app.getPath('userData'),'logs');
function elog(t){ try{ fs.mkdirSync(LOGD(),{recursive:true}); fs.appendFileSync(path.join(LOGD(),new Date().toISOString().slice(0,10)+'.log'),t+'\n'); }catch(_){} }
function pruneLogs(){ try{ const cut=Date.now()-5*864e5; for(const f of fs.readdirSync(LOGD())){ const p=path.join(LOGD(),f); if(fs.statSync(p).mtimeMs<cut) fs.unlinkSync(p); } }catch(_){} }
process.on('uncaughtException',e=>elog(new Date().toISOString()+' MAIN '+(e&&e.stack||e)));
const saveCfg=()=>{ try{ fs.writeFileSync(CFGF(),JSON.stringify(cfg)); }catch(_){} };
const argFiles=argv=>argv.slice(1).filter(a=>/\.(csv|tune|json|ejlab)$/i.test(a)&&fs.existsSync(a));
const readOut=p=>({name:path.basename(p),text:fs.readFileSync(p,'utf8')});
const send=(ch,d)=>{ if(win&&!win.isDestroyed()) win.webContents.send(ch,d); };
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
const EJL_DEF={role:'laptop',defPath:'',ecuPort:'',wbType:'none',wbPort:'',wbUnits:'AFR Gasoline',autoConnect:false,logDir:'',openOnStop:false,fastPoll:true,sel:[],profiles:{},profile:''};
let ejl={cfg:null,proc:null,rec:false,file:null,state:'idle',quitting:false};
function ejlCfg(){ if(!ejl.cfg){ ejl.cfg=Object.assign({},EJL_DEF); try{ Object.assign(ejl.cfg,JSON.parse(fs.readFileSync(EJL_CFGF(),'utf8'))); }catch(_){} if(!ejl.cfg.logDir) ejl.cfg.logDir=path.join(app.getPath('documents'),'ejStudio','logs'); } return ejl.cfg; }
function ejlSave(){ try{ const f=EJL_CFGF(); fs.writeFileSync(f+'.tmp',JSON.stringify(ejl.cfg,null,1)); fs.renameSync(f+'.tmp',f); }catch(e){ elog('ejl cfg '+e); } }
const ejlEngineCfg=c=>({defPath:c.defPath,ecuPort:c.ecuPort,wbType:c.wbType,wbPort:c.wbPort,wbUnits:c.wbUnits,logDir:c.logDir,fastPoll:c.fastPoll!==false});
function ejlStart(){
  if(ejl.proc) return ejl.proc;
  const p=utilityProcess.fork(path.join(__dirname,'ejLogger','engine','engine.js'),[],{serviceName:'ejLogger engine',stdio:'pipe'});
  if(p.stdout) p.stdout.on('data',d=>elog('ENGINE '+String(d).trim())); if(p.stderr) p.stderr.on('data',d=>elog('ENGINE ERR '+String(d).trim()));
  p.on('message',m=>{ if(!m) return;
    if(m.t==='status') ejl.state=m.state;
    if(m.t==='rec'){ ejl.rec=!!m.on; if(m.file) ejl.file=m.file; if(!m.on&&m.file){ ejl.last=m.file; } if(!m.on&&ejl.quitting) setTimeout(()=>app.quit(),150); }
    if(m.t==='error') elog('ejLogger: '+m.text);
    send('ejl',m); });
  p.on('exit',code=>{ elog('ejLogger engine exited '+code); ejl.proc=null; ejl.rec=false; ejl.state='idle'; send('ejl',{t:'status',state:'idle',msg:'Engine stopped'}); });
  p.postMessage({t:'config',cfg:ejlEngineCfg(ejlCfg())}); if((ejlCfg().sel||[]).length) p.postMessage({t:'select',list:ejlCfg().sel});
  ejl.proc=p; return p;
}
const ejlPost=m=>ejlStart().postMessage(m);
function ejlIpc(){
  ipcMain.handle('ejl:send',(e,m)=>{ if(m&&m.t==='select'){ ejlCfg().sel=m.list||[]; ejlSave(); } ejlPost(m); return true; });
  ipcMain.handle('ejl:cfg',()=>ejlCfg());
  ipcMain.handle('ejl:set',(e,patch)=>{ const c=ejlCfg(); Object.assign(c,patch||{}); ejlSave(); if(ejl.proc) ejl.proc.postMessage({t:'config',cfg:ejlEngineCfg(c)}); return c; });
  ipcMain.handle('ejl:pickDef',async()=>{ const r=await dialog.showOpenDialog(win,{title:'Choose the RomRaider logger definition (logger_METRIC_EN_v370.xml)',properties:['openFile'],filters:[{name:'Logger definition',extensions:['xml']}]});
    if(r.canceled||!r.filePaths[0]) return ejlCfg();
    try{ const d=path.join(app.getPath('userData'),'ejLogger'); fs.mkdirSync(d,{recursive:true}); const dst=path.join(d,path.basename(r.filePaths[0])); if(path.resolve(dst)!==path.resolve(r.filePaths[0])) fs.copyFileSync(r.filePaths[0],dst); ejlCfg().defPath=dst; }
    catch(err){ elog('pickDef '+err); ejlCfg().defPath=r.filePaths[0]; }
    ejlSave(); ejlPost({t:'config',cfg:ejlEngineCfg(ejlCfg())}); return ejlCfg(); });
  ipcMain.handle('ejl:pickDir',async()=>{ const c=ejlCfg(); const r=await dialog.showOpenDialog(win,{title:'Choose the ejLogger log folder',properties:['openDirectory','createDirectory'],defaultPath:c.logDir||undefined});
    if(!r.canceled&&r.filePaths[0]){ c.logDir=r.filePaths[0]; ejlSave(); if(ejl.proc) ejl.proc.postMessage({t:'config',cfg:ejlEngineCfg(c)}); } return c; });
  ipcMain.handle('ejl:openDir',()=>{ const d=ejlCfg().logDir; try{ fs.mkdirSync(d,{recursive:true}); }catch(_){} shell.openPath(d); return true; });
  ipcMain.handle('ejl:openLast',()=>{ const f=ejl.last; if(!f||!fs.existsSync(f)) return false; send('open-files',[readOut(f)]); return true; });
  // cluster sidecars: <userData>/ejLogger/cluster/{customize,profiles}, seeded once from the app's defaults
  const CLD=()=>ejlCfg().clusterDir||path.join(app.getPath('userData'),'ejLogger','cluster');
  const copyDir=(src,dst,re)=>{ try{ fs.mkdirSync(dst,{recursive:true}); for(const f of fs.readdirSync(src)) if(re.test(f)&&fs.statSync(path.join(src,f)).isFile()) fs.copyFileSync(path.join(src,f),path.join(dst,f)); return true; }catch(e){ elog('cluster copy '+e); return false; } };
  function seedCluster(){ const d=CLD(); if(fs.existsSync(path.join(d,'customize'))) return; const def=path.join(__dirname,'ejLogger','defaults'); copyDir(path.join(def,'customize'),path.join(d,'customize'),/\.properties$/i); copyDir(path.join(def,'profiles'),path.join(d,'profiles'),/\.xml$/i); }
  const readAll=(dir,re)=>{ const o={}; try{ for(const f of fs.readdirSync(dir)) if(re.test(f)) o[f]=fs.readFileSync(path.join(dir,f),'utf8'); }catch(_){} return o; };
  ipcMain.handle('ejl:cluster',()=>{ seedCluster(); const d=CLD(); return {dir:d,files:readAll(path.join(d,'customize'),/\.properties$/i),profiles:readAll(path.join(d,'profiles'),/\.xml$/i)}; });
  ipcMain.handle('ejl:importCluster',async()=>{ const r=await dialog.showOpenDialog(win,{title:'Choose a ClusterConfig folder (or its customize folder)',properties:['openDirectory']}); if(r.canceled||!r.filePaths[0]) return false;
    let root=r.filePaths[0]; if(/customize$/i.test(root)) root=path.dirname(root); const cz=path.join(root,'customize'), pf=path.join(root,'profiles');
    if(!fs.existsSync(cz)&&!fs.existsSync(pf)){ dialog.showMessageBox(win,{type:'info',message:'No customize or profiles folder there.',detail:'Pick the ClusterConfig folder that contains customize\\ and profiles\\.'}); return false; }
    const d=CLD(); if(fs.existsSync(cz)) copyDir(cz,path.join(d,'customize'),/\.properties$/i); if(fs.existsSync(pf)) copyDir(pf,path.join(d,'profiles'),/\.xml$/i); return true; });
  // sidecar writes: only the keys given change; comments, order and other keys stay; atomic (tmp + rename)
  ipcMain.handle('ejl:writeProp',(e,file,patchObj)=>{ try{ seedCluster(); const name=String(file).replace(/[^\w.-]/g,''); if(!name) return false; const f=path.join(CLD(),'customize',name+'.properties');
    let lines=[]; try{ lines=fs.readFileSync(f,'utf8').split(/\r?\n/); }catch(_){ lines=['# '+name+'.properties - written by ejStudio']; }
    for(const [k,v] of Object.entries(patchObj||{})){ const i=lines.findIndex(l=>{ const t=l.trim(); if(!t||t[0]==='#'||t[0]===';') return false; const j=t.indexOf('='); return j>0&&t.slice(0,j).trim()===k; });
      if(v===null||v===undefined){ if(i>=0) lines.splice(i,1); } else if(i>=0) lines[i]=k+' = '+String(v).replace(/[\r\n]+/g,' '); else { while(lines.length&&lines[lines.length-1].trim()==='') lines.pop(); lines.push(k+' = '+String(v).replace(/[\r\n]+/g,' ')); } }
    fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f+'.tmp',lines.join('\r\n').replace(/(\r\n)*$/,'')+'\r\n'); fs.renameSync(f+'.tmp',f); return true; }catch(err){ elog('writeProp '+err); return false; } });
  ipcMain.handle('ejl:openCluster',()=>{ seedCluster(); shell.openPath(CLD()); return true; });
  ipcMain.handle('ejl:state',()=>({state:ejl.state,rec:ejl.rec,file:ejl.file,last:ejl.last||null,running:!!ejl.proc}));
}
function create(){
  win=new BrowserWindow({width:1600,height:960,minWidth:1100,minHeight:680,backgroundColor:'#000000',title:'ejStudio',icon:path.join(__dirname,'logos/ejstudio.ico'),
    autoHideMenuBar:true,show:false,titleBarStyle:'hidden',titleBarOverlay:{color:'#000000',symbolColor:'#e8e8ea',height:38},webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,spellcheck:false}});
  win.removeMenu();
  win.on('close',e=>{ if(ejl.rec&&!ejl.quitting){ e.preventDefault(); const r=dialog.showMessageBoxSync(win,{type:'warning',buttons:['Keep recording','Stop and close'],defaultId:0,cancelId:0,title:'ejLogger is recording',message:'ejLogger is recording a log.',detail:'Stop the recording and close ejStudio? The log file is closed cleanly first.'});
    if(r===1){ ejl.quitting=true; try{ ejl.proc.postMessage({t:'rec',on:false}); }catch(_){ app.quit(); } setTimeout(()=>app.quit(),3000); } } });
  let shown=false; const showIt=()=>{ if(shown||!win||win.isDestroyed()) return; shown=true; win.maximize(); win.show(); }; win.once('ready-to-show',showIt); setTimeout(()=>{ if(!shown){ try{ elog('ready-to-show did not fire within 8 s; showing anyway'); }catch(_){} showIt(); } },8000);
  win.webContents.on('render-process-gone',(e,d)=>{ try{ elog('renderer gone: '+JSON.stringify(d)); }catch(_){} if(d&&d.reason!=='clean-exit'&&!win.isDestroyed()){ showIt(); win.reload(); } });
  win.webContents.on('did-fail-load',(e,code,desc)=>{ try{ elog('load failed: '+code+' '+desc); }catch(_){} showIt(); });
  win.webContents.setWindowOpenHandler(({url})=>(!url||url==='about:blank')?{action:'allow',overrideBrowserWindowOptions:{backgroundColor:'#000000',autoHideMenuBar:true,icon:path.join(__dirname,'logos/ejstudio.ico')}}:{action:'deny'});
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.on('did-finish-load',()=>{ const f=argFiles(process.argv); if(f.length) send('open-files',f.map(readOut)); });
  win.loadFile(path.join(__dirname,'ejstudio.html'));
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
    ipcMain.handle('watch:get',()=>cfg);
    ipcMain.handle('watch:pick',async()=>{ const r=await dialog.showOpenDialog(win,{title:'Choose your RomRaider log folder',properties:['openDirectory'],defaultPath:cfg.folder||undefined});
      if(!r.canceled&&r.filePaths[0]){ cfg.folder=r.filePaths[0]; saveCfg(); startWatch(); } return cfg; });
    ipcMain.handle('watch:auto',(e,v)=>{ cfg.auto=!!v; saveCfg(); return cfg; });
    ipcMain.handle('watch:off',()=>{ cfg.folder=null; saveCfg(); startWatch(); return cfg; });
    ipcMain.handle('watch:newest',()=>{ if(!cfg.folder) return null; const l=csvs(cfg.folder).map(f=>({f,t:fs.statSync(path.join(cfg.folder,f)).mtimeMs})).sort((a,b)=>b.t-a.t);
      return l.length?readOut(path.join(cfg.folder,l[0].f)):null; });
    ipcMain.handle('capture',async(e,r)=>{ const w=BrowserWindow.fromWebContents(e.sender); const img=await e.sender.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.w),height:Math.round(r.h)});
      const s=await dialog.showSaveDialog(w,{defaultPath:r.name,filters:[{name:'PNG image',extensions:['png']}]}); if(s.canceled||!s.filePath) return null; fs.writeFileSync(s.filePath,img.toPNG()); return s.filePath; });
    ipcMain.handle('info',()=>({version:app.getVersion(),electron:process.versions.electron,chrome:process.versions.chrome,userData:app.getPath('userData')}));
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
    ipcMain.handle('gh:ready',()=>!!GHT);
    ipcMain.handle('gh:issue',async(e,title,body)=>{ if(!GHT) return {ok:false,status:'no token'}; try{ const r=await fetch('https://api.github.com/repos/'+GH_REPO+'/issues',{method:'POST',headers:{Authorization:'Bearer '+GHT,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'ejStudio'},body:JSON.stringify({title:String(title).slice(0,200),body:String(body).slice(0,65000),labels:['bug']})}); const j=await r.json().catch(()=>({})); return {ok:r.ok,status:r.status,url:j.html_url}; }catch(err){ elog('gh:issue '+err); return {ok:false,status:String(err)}; } });
    ipcMain.handle('report:save',(e,name,b64)=>{ try{ const n=String(name).replace(/[^\w.-]+/g,'_'); fs.mkdirSync(REPD(),{recursive:true}); const p=path.join(REPD(),n); fs.writeFileSync(p+'.tmp',Buffer.from(String(b64),'base64')); fs.renameSync(p+'.tmp',p); return p; }catch(err){ elog('report:save '+err); return null; } });
    ipcMain.handle('report:open',(e,name)=>{ try{ fs.mkdirSync(REPD(),{recursive:true}); const p=name?path.join(REPD(),String(name).replace(/[^\w.-]+/g,'_')):''; if(p&&fs.existsSync(p)) shell.showItemInFolder(p); else shell.openPath(REPD()); }catch(_){} return true; });
    ejlIpc(); startWatch(); create(); });
  app.on('will-quit',()=>{ if(ejl.proc){ try{ ejl.proc.postMessage({t:'quit'}); }catch(_){} } });
  app.on('window-all-closed',()=>app.quit());
}
