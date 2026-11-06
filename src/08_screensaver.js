// ════════════════════════════════════════════════════════════════════════════
//  ejLogger screensaver — Header Pulses · Ink · Night Sky (style chosen per profile)
//  Engages after N minutes stopped under the idle rpm (car cluster only); wakes on speed or a touch.
// ════════════════════════════════════════════════════════════════════════════
const SS=(()=>{
  const DPR=Math.min(2,window.devicePixelRatio||1), num=(v,d)=>{ const n=parseFloat(v); return Number.isFinite(n)?n:d; }, bool=(v,d)=>v==null||v===''?d:String(v).toLowerCase()==='true';
  const STYLES={header:'Header Pulses',ink:'Ink',sky:'Night Sky'};
  let cv=null,ctx=null,buf=null,bx=null,W=0,H=0,on=false,style='header',P={},since=0,fadeT=0,fadeDir=0,preview=false;
  const IN={rpm:800,load:.3,clt:85};
  let rpmS=800,lastRpm=800,bloom=0,wasBlip=false,lastRpmT=0;
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*Math.max(0,Math.min(1,t)));
  function cltCol(t){ const c0=num(P['cold.c'],40), c2=num(P['warm.c'],65), c3=num(P['normal.c'],80), c1=(c0+c2)/2, C=[90,159,212],T=[72,168,172],G=[59,175,132],R=[228,170,40];
    if(t<=c0) return C; if(t<=c1) return mix(C,T,(t-c0)/(c1-c0)); if(t<=c2) return mix(T,G,(t-c1)/(c2-c1)); if(t<=c3) return mix(G,R,(t-c2)/(c3-c2)); return R; }
  const rgba=(c,a)=>`rgba(${c.map(Math.round).join(',')},${Math.max(0,Math.min(1,a))})`;
  function ensure(){ if(cv) return; const host=document.body; cv=document.createElement('canvas'); cv.id='ejl-ss';
    cv.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:350;background:#000;opacity:0;pointer-events:none;display:none';
    host.appendChild(cv); ctx=cv.getContext('2d'); buf=document.createElement('canvas'); bx=buf.getContext('2d');
    const wake=()=>{ if(on) stop(); }; cv.addEventListener('pointerdown',wake); addEventListener('keydown',e=>{ if(on){ e.stopPropagation(); wake(); } },true); addEventListener('resize',()=>{ if(on) size(); }); }
  function size(){ W=cv.width=Math.max(1,Math.round(innerWidth*DPR)); H=cv.height=Math.max(1,Math.round(innerHeight*DPR)); buf.width=W; buf.height=H; bx.fillStyle='#000'; bx.fillRect(0,0,W,H); buildPipes(); initStars(); ink=[]; pulses=[]; nextDrop=0; }

  // shared crank: 720° cycle, EJ firing order 1-3-2-4, 10× slower than real rpm
  const FA={1:0,3:180,2:360,4:540}; let th=0; const sinceC={1:700,2:700,3:700,4:700}, glow={1:0,2:0,3:0,4:0};
  function crank(dt){ th=(th+rpmS/10/60*360*dt/1000)%720;
    for(const c of [1,2,3,4]){ const s=((th-FA[c])%720+720)%720; if(s<sinceC[c]) glow[c]=1+bloom*.8; if(sinceC[c]<180&&s>=180) pulses.push({p:c,s:0,b:1+bloom}); sinceC[c]=s; glow[c]*=Math.exp(-dt/240); } }

  // Header Pulses: unequal-length headers, pulses reach the collector unevenly
  let pipes={},pulses=[];
  const PDEF={1:[[.76,.31],[.93,.40],[.70,.88],[.5,.74]],3:[[.76,.45],[.86,.56],[.62,.70],[.5,.74]],2:[[.24,.31],[.05,.50],[.20,.97],[.5,.74]],4:[[.24,.45],[.14,.56],[.38,.70],[.5,.74]],o:[[.5,.74],[.5,.82],[.5,.9],[.5,1.02]]};
  function buildPipes(){ pipes={}; for(const k in PDEF){ const Q=PDEF[k].map(([x,y])=>[x*W,y*H]), pts=[], cum=[0];
    for(let i=0;i<=60;i++){ const t=i/60,u=1-t; pts.push([0,1].map(j=>u*u*u*Q[0][j]+3*u*u*t*Q[1][j]+3*u*t*t*Q[2][j]+t*t*t*Q[3][j])); if(i) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])); }
    pipes[k]={pts,cum,len:cum[60]}; } }
  function at(pp,s){ s=Math.max(0,Math.min(pp.len,s)); let i=1; while(i<60&&pp.cum[i]<s) i++; const f=(s-pp.cum[i-1])/(pp.cum[i]-pp.cum[i-1]||1); return [pp.pts[i-1][0]+(pp.pts[i][0]-pp.pts[i-1][0])*f,pp.pts[i-1][1]+(pp.pts[i][1]-pp.pts[i-1][1])*f]; }
  function header(dt){ ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); const col=cltCol(IN.clt); ctx.lineCap='round'; ctx.lineJoin='round';
    for(const k in pipes){ const pp=pipes[k]; ctx.beginPath(); pp.pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.strokeStyle=rgba(col,.06); ctx.lineWidth=13*DPR; ctx.stroke(); ctx.strokeStyle=rgba(col,.16); ctx.lineWidth=1.2*DPR; ctx.stroke(); }
    ctx.lineWidth=1.3*DPR; ctx.strokeStyle=rgba(col,.2); ctx.strokeRect(W*.42,H*.22,W*.16,H*.32);
    const cyl={1:[.58,.27],3:[.58,.41],2:[.24,.27],4:[.24,.41]};
    for(const c of [1,2,3,4]){ const [x,y]=cyl[c], g=Math.min(1.6,glow[c]);
      if(g>.01){ ctx.save(); ctx.shadowColor=rgba(col,1); ctx.shadowBlur=30*DPR*g; ctx.fillStyle=rgba(col,.6*Math.min(1,g)); ctx.fillRect(W*x,H*y,W*.18,H*.08); ctx.restore(); }
      ctx.strokeStyle=rgba(col,.22); ctx.strokeRect(W*x,H*y,W*.18,H*.08);
      ctx.font=`700 ${H*.03}px ejMono,monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=rgba(col,.3+.5*Math.min(1,g)); ctx.fillText(c,W*(x+.09),H*(y+.04)); }
    ctx.fillStyle=rgba(col,.06); ctx.fillRect(W*.76,H*.24,W*.03,H*.3); ctx.fillRect(W*.21,H*.24,W*.03,H*.3); ctx.strokeRect(W*.76,H*.24,W*.03,H*.3); ctx.strokeRect(W*.21,H*.24,W*.03,H*.3);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    const sp=W*.32*(.7+rpmS/2200)*dt/1000;
    for(let i=pulses.length-1;i>=0;i--){ const q=pulses[i]; q.s+=sp; const pp=pipes[q.p]; if(q.s>pp.len){ if(q.p==='o'){ pulses.splice(i,1); continue; } q.s-=pp.len; q.p='o'; }
      const Pp=pipes[q.p], b=Math.min(1.6,q.b), fade=q.p==='o'?1-q.s/Pp.len:1;
      for(let j=10;j>=0;j--){ const [x,y]=at(Pp,q.s-j*5*DPR); ctx.fillStyle=rgba(col,(.5-j*.045)*fade*b); ctx.beginPath(); ctx.arc(x,y,(4-j*.28)*DPR,0,7); ctx.fill(); }
      const [x,y]=at(Pp,q.s), rr=16*DPR*b, gr=ctx.createRadialGradient(x,y,0,x,y,rr); gr.addColorStop(0,rgba(col,.6*fade)); gr.addColorStop(1,rgba(col,0)); ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(x,y,rr,0,7); ctx.fill(); }
    if(pulses.length>200) pulses.splice(0,pulses.length-200); }

  // Ink: drops unfurling into tendrils in still water
  let ink=[],nextDrop=0,frameN=0;
  function drop(){ const x=W*(.15+Math.random()*.7), y=H*(.04+Math.random()*.1);
    for(let i=0;i<170;i++){ const a=Math.random()*Math.PI*2, s=Math.random(); ink.push({x:x+Math.cos(a)*3*DPR*s,y:y+Math.sin(a)*3*DPR*s,vx:Math.cos(a)*.7*s,vy:.6+Math.random()*1.3,l:0,life:7000+Math.random()*6000,k:Math.random()}); }
    if(ink.length>3200) ink.splice(0,ink.length-3200); }
  function inkFrame(now,dt){ bx.globalCompositeOperation='source-over'; bx.fillStyle='rgba(0,0,0,0.012)'; bx.fillRect(0,0,W,H);
    if(++frameN%3===0){ bx.globalCompositeOperation='difference'; bx.fillStyle='rgb(1,1,1)'; bx.fillRect(0,0,W,H); bx.globalCompositeOperation='source-over'; }
    if(now>nextDrop){ drop(); nextDrop=now+1000*Math.max(.7,3.4-IN.load*2.6)*(.7+Math.random()*.6); }
    const col=cltCol(IN.clt), rise=.55+(rpmS-650)/1400+bloom*1.2, t=now/1000, k=dt/16; bx.lineWidth=.9*DPR; bx.lineCap='round';
    for(let i=ink.length-1;i>=0;i--){ const p=ink[i]; p.l+=dt; const u=p.l/p.life; if(u>=1||p.y>H+20){ ink.splice(i,1); continue; }
      const nx=p.x/DPR*.006, ny=p.y/DPR*.006, ang=Math.sin(nx*2.1+t*.15+p.k)*2+Math.cos(ny*2.7-t*.12)*1.6+Math.sin((nx+ny)*4.3)*1.1;
      p.vx+=Math.cos(ang)*.05*rise*k; p.vy+=(Math.sin(ang)*.05+.012)*rise*k; p.vx*=Math.pow(.982,k); p.vy*=Math.pow(.982,k);
      const ox=p.x, oy=p.y; p.x+=p.vx*DPR*rise*k; p.y+=p.vy*DPR*rise*k;
      bx.strokeStyle=rgba(col,.3*(1-u)*(1+bloom*.5)); bx.beginPath(); bx.moveTo(ox,oy); bx.lineTo(p.x,p.y); bx.stroke(); }
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); ctx.drawImage(buf,0,0); }

  // Night Sky: wheeling stars, a shooting star on every blip
  let stars=[],shoots=[];
  function initStars(){ stars=[]; const R=Math.hypot(W,H); for(let i=0;i<520;i++){ const r=Math.sqrt(Math.random())*R; stars.push({r,a:Math.random()*Math.PI*2,m:Math.random(),tw:Math.random()*10,tint:Math.random()<.12}); } }
  function sky(now){ ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
    const px=W*1.05, py=-H*.25, rot=now/1000*0.006, tw=.15+(rpmS-650)/2350*.8, col=cltCol(IN.clt);
    for(const s of stars){ const x=px+Math.cos(s.a+rot)*s.r, y=py+Math.sin(s.a+rot)*s.r; if(x<0||x>W||y<0||y>H) continue;
      const b=(.25+.75*s.m)*(1-tw*.5+tw*.5*Math.sin(now/1000*(2+s.tw)+s.tw*7)), c=s.tint?col:[230,232,255]; ctx.fillStyle=rgba(c,b); const sz=(.5+s.m*1.4)*DPR; ctx.fillRect(x-sz/2,y-sz/2,sz,sz); }
    for(let i=shoots.length-1;i>=0;i--){ const s=shoots[i], age=(now-s.t)/900; if(age>1){ shoots.splice(i,1); continue; }
      const x=s.x+s.dx*age, y=s.y+s.dy*age, g=ctx.createLinearGradient(x,y,x-s.dx*.25,y-s.dy*.25); g.addColorStop(0,`rgba(255,255,255,${1-age})`); g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.strokeStyle=g; ctx.lineWidth=2*DPR; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-s.dx*.25,y-s.dy*.25); ctx.stroke(); } }

  function clock(){ if(!bool(P['clock.enabled'],true)) return; const d=new Date(), t=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    ctx.font=`700 ${H*num(P['clock.size'],.16)}px ejDIN,"Arial Narrow",sans-serif`; ctx.fillStyle=`rgba(200,200,205,${num(P['clock.alpha'],.22)})`; const m=H*.04, w=ctx.measureText(t).width;
    if(String(P['clock.position']||'corner')==='centre'){ ctx.textAlign='center'; ctx.fillText(t,W/2,H/2+H*num(P['clock.size'],.16)*.35); ctx.textAlign='left'; } else ctx.fillText(t,W-m-w,H-m-H*.02); }

  function start(st,isPreview){ ensure(); style=STYLES[st]?st:'header'; preview=!!isPreview; size(); on=true; cv.style.display='block'; cv.style.pointerEvents='auto';
    cv.style.transition=`opacity ${num(P['fadein.ms'],1200)}ms ease`; requestAnimationFrame(()=>{ cv.style.opacity='1'; }); }
  function stop(){ if(!cv||!on) return; on=false; since=0; cv.style.pointerEvents='none'; cv.style.transition=`opacity ${num(P['dissipate.ms'],1600)}ms ease`; cv.style.opacity='0';
    setTimeout(()=>{ if(!on) cv.style.display='none'; },num(P['dissipate.ms'],1600)+50); }

  // called every animation frame while ejLogger is open
  // c = {P, style, enabled, logging, rpm, speed, load, clt, dt, now}
  function tick(c){ P=c.P||{}; const dt=c.dt||16, now=c.now||performance.now();
    if(Number.isFinite(c.rpm)) IN.rpm=c.rpm; if(Number.isFinite(c.load)) IN.load=c.load; if(Number.isFinite(c.clt)) IN.clt=c.clt;
    if(!on){ const idle=c.enabled&&bool(P.enabled,true)&&c.logging&&Number.isFinite(c.rpm)&&c.rpm<num(P['idle.rpm.max'],1800)&&!(c.speed>=1);
      since=idle?since+dt:0; if(since>=num(P['idle.minutes'],5)*60000) start(c.style); return; }
    if(!preview&&Number.isFinite(c.speed)&&c.speed>=num(P['dismiss.speed'],5)){ stop(); return; }
    if(preview&&c.previewRpm){ IN.rpm=c.previewRpm; }
    rpmS+=(IN.rpm-rpmS)*(1-Math.exp(-dt/150)); const rise=rpmS-lastRpm; if(rise>4) bloom=Math.min(1,bloom+rise/900); lastRpm=rpmS; bloom*=Math.exp(-dt/900);
    const blip=bloom>.35; if(blip&&!wasBlip){ if(style==='sky') shoots.push({x:W*(.2+Math.random()*.5),y:H*(.08+Math.random()*.3),dx:W*(.25+Math.random()*.2),dy:H*(.18+Math.random()*.15),t:now}); if(style==='ink') drop(); } wasBlip=blip;
    crank(dt); if(style==='header') header(dt); else if(style==='ink') inkFrame(now,dt); else sky(now); clock(); }
  // preview: runs with a simulated idle and an occasional blip until touched
  let pv=null;
  function showPreview(st,P0){ P=P0||{}; start(st,true); let t0=performance.now(), last=t0; IN.clt=88;
    cancelAnimationFrame(pv); const loop=now=>{ if(!on){ pv=null; return; } const e=(now-t0)%6000; const r=e>4200&&e<4900?780+2200*Math.sin(Math.PI*(e-4200)/700):780; tick({P,style:st,preview:true,previewRpm:r,rpm:r,load:.3,clt:88,dt:Math.min(100,now-last),now}); last=now; pv=requestAnimationFrame(loop); }; pv=requestAnimationFrame(loop); }
  return {STYLES,tick,stop,showPreview,get on(){ return on; },get preview(){ return preview; }};
})();
