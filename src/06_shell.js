function unitsChanged(){ TV.refreshUnits(); TVb.refreshUnits(); MT.render(); RP.dirty=true; }
function drawer(on){ const dr=$('drawer'); if(on==null) on=!dr.classList.contains('open'); dr.classList.toggle('open',on); document.body.classList.toggle('dpin',on&&UI.drawerPin); if(on) drawerRefresh(); RP.dirty=true; }

// ── wiring ──────────────────────────────────────────────────────────────────
function wire(){
  $('tabs').innerHTML=TAB_ORDER.map(v=>`<button data-v="${v}">${v==='maf'?'MAF Tools':VIEW_NAMES[v]}</button>`).join('');
  $('tabs').onclick=e=>{ const b=e.target.closest('button'); if(b&&!b.classList.contains('na')) setPaneView(UI.focus,b.dataset.v); };
  $('layouts').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; UI.layout=b.dataset.l; save(); buildStage(); };
  $('presets').onclick=e=>{ const b=e.target.closest('button'); if(b) preset(+b.dataset.k,e.shiftKey); };
  $('ed-top').onclick=()=>EDITOR.on(!EDIT.on);
  $('drawer-btn').onclick=()=>qMenu(); $('drawer-x').onclick=()=>drawer(false); $('drawer-back').onclick=()=>drawer(false);
  $('drawer-pin').onclick=()=>{ UI.drawerPin=!UI.drawerPin; $('drawer-pin').classList.toggle('on',UI.drawerPin); document.body.classList.toggle('dpin',UI.drawerPin&&$('drawer').classList.contains('open')); save(); RP.dirty=true; };
  $('drawer-pin').classList.toggle('on',UI.drawerPin); drawerBind();
  $('t-play').onclick=()=>rpPlay(!RP.playing); $('t-prev').onclick=()=>rpStep(-1); $('t-next').onclick=()=>rpStep(1);
  $('t-speed').querySelectorAll('button').forEach(b=>{ b.classList.toggle('on',+b.dataset.s===UI.speed); b.onclick=()=>{ UI.speed=+b.dataset.s; save(); $('t-speed').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); }; });
  $('t-a').onclick=()=>{ RP.a=RP.playT; rpAB(); }; $('t-b').onclick=()=>{ RP.b=RP.playT; rpAB(); }; $('t-abx').onclick=()=>{ RP.a=RP.b=null; rpAB(); }; $('t-flag').onclick=e=>flagKey(e.shiftKey); $('t-trim').onclick=e=>trimSet(e.altKey?'clear':e.shiftKey?'b':'a');
  $('t-evb').onclick=evMenu;
  tlBind($('tl'),false);
  { const cv=$('tlb'); let dn=false; const at=e=>{ const r=cv.getBoundingClientRect(); setB(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*(RP.B?RP.B.dur:0)); };
    cv.addEventListener('pointerdown',e=>{ if(!RP.B) return; dn=true; try{ cv.setPointerCapture(e.pointerId); }catch(_){} at(e); }); cv.addEventListener('pointermove',e=>{ if(dn) at(e); }); cv.addEventListener('pointerup',()=>{ dn=false; }); cv.addEventListener('pointercancel',()=>{ dn=false; }); }
  $('b-link').onclick=toggleLink; $('png-btn').onclick=exportPNG; $('b-x').onclick=()=>setCompare(null); tlBind($('tlpop-cv'),true); $('tlpop-x').onclick=()=>pop(false); document.addEventListener('pointerdown',e=>{ if(!$('tlpop').classList.contains('hidden')&&!e.target.closest('#tlpop')&&!e.target.closest('#tl')) pop(false); },true);
  $('f-tune').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f){ LAND.tuneP={name:f.name,path:pathFor(f)}; loadTuneText(await f.text(),f.name); } };
  $('f-logs').onchange=e=>{ const fs=[...e.target.files]; e.target.value=''; if(!$('land').classList.contains('hidden')) landQueue(fs); else addFiles(fs); };
  $('land-tune-b').onclick=e=>{ e.stopPropagation(); $('f-tune').click(); };
  $('land-back').onclick=()=>enterApp(); $('land-news').onclick=()=>whatsNew(); $('land-go').onclick=()=>landGo(); $('land-logs-b').onclick=()=>$('f-logs').click();
  const dz=$('st-logs'); dz.onclick=()=>$('f-logs').click(); dz.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); $('f-logs').click(); } };
  $('land').addEventListener('click',e=>{ const r=e.target.closest('.lrow'); if(r){ const k=r.dataset.k; LAND.sel.has(k)?LAND.sel.delete(k):LAND.sel.add(k); landRefresh(); return; }
    const ses=e.target.closest('[data-ses]'); if(ses) return landReopen(+ses.dataset.ses); const rv=e.target.closest('[data-rev]'); if(rv) return revOpen(rv.dataset.rev);
    const l=e.target.closest('[data-l]'); if(!l) return; const a=l.dataset.l; if(a==='tune') $('f-tune').click(); else if(a==='edit') openEditorOnly(); else if(a==='ejl'){ try{ EJL.setMode('logger'); }catch(_){} } else if(a==='caradd') carDialog(null); else if(a==='caredit') carDialog(UI.car); });
  $('land').addEventListener('change',e=>{ if(e.target.id==='land-carsel'){ UI.car=e.target.value; save(); carChanged(); } });
  setInterval(()=>{ if(!$('land').classList.contains('hidden')) landLoadEjl(); },15000);
  ['dragover','drop'].forEach(ev=>window.addEventListener(ev,e=>e.preventDefault()));
  window.addEventListener('dragenter',()=>document.body.classList.add('dragging')); window.addEventListener('dragleave',e=>{ if(!e.relatedTarget) document.body.classList.remove('dragging'); });
  window.addEventListener('dragover',e=>{ const z=e.target.closest&&e.target.closest('[data-dz]'); document.querySelectorAll('#dz [data-dz]').forEach(x=>x.classList.toggle('on',x===z)); });
  window.addEventListener('drop',async e=>{ document.body.classList.remove('dragging'); const z=e.target.closest&&e.target.closest('[data-dz]'), asB=z&&z.dataset.dz==='b'&&ST.logs.length>0; document.querySelectorAll('#dz [data-dz]').forEach(x=>x.classList.remove('on'));
    if(!(e.dataTransfer&&e.dataTransfer.files.length)) return; if(!$('land').classList.contains('hidden')) return landQueue(e.dataTransfer.files); const n0=ST.logs.length; await addFiles(e.dataTransfer.files); if(asB&&ST.logs.length>n0){ setCompare(ST.logs[ST.logs.length-1]); if(typeof cmpUI==='function') cmpUI(); } });
  document.addEventListener('keydown',e=>{ const tg=e.target; if(tg&&/^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName)) return; if($('app').classList.contains('hidden')) return;
    if((e.ctrlKey||e.metaKey)&&!e.altKey){ const k=e.key.toLowerCase(); if(k==='='||k==='+'){ e.preventDefault(); uiStep(1); return; } if(k==='-'){ e.preventDefault(); uiStep(-1); return; } if(k==='0'){ e.preventDefault(); uiScale(1); return; } }
    if(keyCapture) return; if(EDIT.on&&EDITOR.key(e)) return; { const ka=keyAction(e); if(ka){ e.preventDefault(); runAction(ka); return; } }
    if(e.key==='Escape'){ if(!$('tlpop').classList.contains('hidden')) pop(false); else if(!UI.drawerPin) drawer(false); } });
  if('ResizeObserver' in window){ const ro=new ResizeObserver(()=>{ for(const k in VIEWS) VIEWS[k].resize(); RP.tlcSk=RP.tlcBk=null; RP.dirty=true; }); ro.observe($('stage')); ro.observe($('tl')); ro.observe($('tlpop-cv')); }
  window.addEventListener('beforeunload',()=>{ UI.playT=RP.playT; UI.limits=ULIM; try{ localStorage.setItem('rrlab_ui_v1',JSON.stringify(UI)); }catch(_){} });
}

// ── boot: tune → stored logs → app (or landing) ─────────────────────────────
(async function boot(){
  if(!UI.mig210){ UI.sync.maf_table=true; UI.mig210=1; save(); } if(!UI.mig218){ UI.sync.table=true; UI.mig218=1; save(); }
  if(window.rrlab&&window.rrlab.desktop) document.body.classList.add('desk'); if(UI.scale&&UI.scale!==1) uiScale(UI.scale); setInterval(tstat,700);
  { const bad=[]; for(const [k,f] of [['tt',x=>x&&x.opt],['g',x=>x&&Array.isArray(x.lanes)],['panes',Array.isArray]]) if(!f(UI[k])){ bad.push(k); UI[k]=JSON.parse(JSON.stringify(UI_DEF[k])); }
    if(bad.length||window.__quar){ elog('self-check reset: '+(bad.join(',')||'settings unreadable')); save(); setTimeout(()=>toast('Some saved settings were unreadable and were reset'),1500); } } profApply(); makeViews(); wire(); if(window.rrlab&&window.rrlab.info) window.rrlab.info().then(i=>{ INFO=i; drawerRefresh(); }).catch(()=>{}); if(new URLSearchParams(location.search).get('car')!=='1') setTimeout(()=>checkUpdates(false),5000); { const j=UI.panes.indexOf('table'); if(j>0) UI.panes[j]=UI.panes[0]; UI.panes[0]='table'; UI.focus=0; }
  try{ profMigrate(); profApply(); }catch(_){}
  try{ const s=JSON.parse(localStorage.getItem('rrlab_tune_v1')||'null'); if(s&&s.text){ TUNE=parseTune(s.text,s.name); applyTuneAxis(); profAuto(TUNE); revBoot(s.text,s.name); } }catch(_){ try{ localStorage.removeItem('rrlab_tune_v1'); }catch(e){} }
  UI.axis=null;
  landRefresh(); IDB.clear(); const stored=[], errs=[];   // logs are never kept between sessions; only the tune is
  if(stored.length){ if(TUNE){ busy(true,'Restoring session',stored.length+' log'+(stored.length>1?'s':'')); await sleep(80); for(const o of stored) await ingest(o,false,errs); busy(false); } else ST.queue.push(...stored); }
  if(ST.logs.length){ recompute(false); selectLog(ST.logs.find(L=>L.fp===UI.fp)||ST.logs[0],false); if(UI.playT) rpSeek(UI.playT,true); enterApp(); } else showLanding();
  offerRecovery();
  if(errs.length) toast(errs.join(' · '));
})();
