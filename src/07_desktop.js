// ════════════════════════════════════════════════════════════════════════════
//  Desktop integration — only active inside the ejStudio app (window.rrlab)
// ════════════════════════════════════════════════════════════════════════════
DESK=(()=>{ const D=window.rrlab; if(!D||!D.desktop) return null;
  const asFile=o=>({name:o.name,path:o.path||'',text:async()=>o.text}), st={folder:null,auto:true};
  D.onOpenFiles(list=>addFiles(list.map(asFile)));
  D.onNewLog(o=>{ toast('New log: '+o.name); addFiles([asFile(o)]); });
  copyText=(txt,ok)=>{ D.copy(txt).then(()=>toast(ok),()=>toast('Copy failed')); };
  async function newest(){ const o=await D.newest(); if(o) addFiles([asFile(o)]); else toast(st.folder?'No CSV logs in the watched folder':'Choose a log folder first'); }
  const set=s=>{ Object.assign(st,s); drawerRefresh(); landRefresh(); };
  D.getWatch().then(set);
  return { st,
    act(a){ if(a==='wpick') D.pickFolder().then(set); else if(a==='woff') D.stopWatch().then(set); else if(a==='wauto') D.setAuto(!st.auto).then(set); else if(a==='wnew') newest(); },
    section(){ return st.folder?`<div class="kv"><span>Folder</span><b title="${esc(st.folder)}">${esc(st.folder)}</b></div><div class="drow"><span>Auto-load finished logs</span><div class="seg"><button data-act="wauto" class="${st.auto?'on':''}">On</button><button data-act="wauto" class="${st.auto?'':'on'}">Off</button></div></div><div class="drow"><button class="btn sm acc" data-act="wnew">Load newest</button><button class="btn sm ghost" data-act="wpick">Change</button><button class="btn sm ghost" data-act="woff">Stop watching</button></div>`
      :`<button class="btn sm" data-act="wpick">Choose log folder</button>`; },
    land(){ let b=$('land-newest'); if(!st.folder){ if(b) b.remove(); return; } if(!b){ b=mk('button','btn sm acc',$('st-logs')); b.id='land-newest'; b.onclick=e=>{ e.stopPropagation(); newest(); }; } b.textContent='Load newest log'; b.title=st.folder; } };
})();

