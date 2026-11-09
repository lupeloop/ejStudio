
"use strict";
// ════════════════════════════════════════════════════════════════════════════
//  ejStudio core — parsing, real frames, filters, MAF math, knock, tune.  No DOM.
// ════════════════════════════════════════════════════════════════════════════
//  MAF math (per real frame):
//    CL (status 8) : m = 1 + (AFL + AFC)/100            — ECU trims only; WB not used
//    OL (status≥10): m = (λ_WB / λ_FFB) × (1 + AFL/100)  — "+AFL" mode (AFC forced 0)
//                    m = (λ_WB / λ_FFB)                  — "raw" mode
//    OL frames count only while the ECU commands enrichment (λ_FFB ≤ olEnr); status 10
//    at a ~stoich target is overrun / decel transition, not power enrichment.
//    Tune comps applied to load / MAF (load_map_comp with MAP, maf_iat_comp with IAT)
//    multiply in:  true/indicated air = m × (1 + comp/100).
//  Bins: each frame splits between the two neighbouring breakpoints by its
//  interpolation weight; per bin a weighted median of CL ∪ OL frames.
//  Copied row: new = old × (1 + (median − 1) × min(1, n / solidN)).
const LAM = 14.7, PSI = 6.894757, ATM = 101.325;
const BP_DEFAULT = [0.8984375,0.9375,0.9765625,1.015625,1.0546875,1.09375,1.1328125,1.171875,1.2109375,1.25,1.2890625,1.328125,1.3671875,1.40625,1.484375,1.5625,1.640625,1.71875,1.796875,1.875,1.953125,2.03125,2.109375,2.1875,2.2265625,2.34375,2.421875,2.5390625,2.656199932098389,2.7734375,2.890625,3.0078125,3.125,3.2421875,3.359375,3.4765625,3.59375,3.7109375,3.828125,3.9453125,4.0625,4.1796875,4.296875,4.4140625,4.4921875,4.5703125,4.609375,4.6484375,4.6875,4.7265625,4.8046875,4.8828125,4.9609375,5.0];
const CFG_DEF = { cutMafv:1.6, transVs:1.0, recoverS:1.0, railLo:7/LAM, railHi:20/LAM, leanLam:1.088,
                  richFloor:10.5/LAM, olEnr:0.97, solidN:50, kinkTol:0.03, olAfl:true, pullThr:90, pullDur:1.5, pullSpan:1500, idcWarn:85, idcCrit:90, fpDrop:10, tipRate:150, knockWin:0.5, lowLoad:1.0, bErr:2, bDur:1, tipAfr:1.5, avcsErr:3, clVal:8, olVal:10, clolWin:500 };
let CFG = Object.assign({}, CFG_DEF);
let BP = BP_DEFAULT.slice();
let AXIS_SRC = 'default';            // 'tune' | 'custom' | 'default'
let TUNE = null;

const median = a => { if(!a.length) return null; const s=[...a].sort((x,y)=>x-y), m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const fin = v => Number.isFinite(v) ? v : null;
function wmed(pairs){ const p=pairs.filter(q=>Number.isFinite(q[0])&&q[1]>0).sort((a,b)=>a[0]-b[0]); if(!p.length) return null;
  const tot=p.reduce((s,q)=>s+q[1],0); let acc=0; for(const q of p){ acc+=q[1]; if(acc>=tot/2) return q[0]; } return p[p.length-1][0]; }
const sumW = a => a.reduce((s,q)=>s+q[1],0);
function fi(a,v){ const n=a.length; if(n<2||v<=a[0]) return 0; if(v>=a[n-1]) return n-1;
  let lo=0,hi=n-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(a[m]<=v) lo=m; else hi=m; } return lo+(v-a[lo])/(a[hi]-a[lo]); }
function bil(t,fx,fy){ const ix=Math.floor(fx), iy=Math.floor(fy), ix1=Math.min(ix+1,t.x.length-1), iy1=Math.min(iy+1,t.z.length-1), ax=fx-ix, ay=fy-iy;
  return (t.z[iy][ix]*(1-ax)+t.z[iy][ix1]*ax)*(1-ay)+(t.z[iy1][ix]*(1-ax)+t.z[iy1][ix1]*ax)*ay; }
const at2 = (t,x,y) => bil(t, fi(t.x,x), t.yin?fi(t.y,y):0);
const lerpArr = (xs,ys,v) => { const f=fi(xs,v), i=Math.floor(f), j=Math.min(i+1,ys.length-1); return ys[i]+(ys[j]-ys[i])*(f-i); };
function round(x,d){ if(!Number.isFinite(x)) return null; const f=Math.pow(10,d); return Math.round(x*f)/f; }

// ── CSV parsing ─────────────────────────────────────────────────────────────
// RomRaider re-emits the header when parameters change mid-session; rows from
// every section are emitted under the union of all columns ('' where absent).
function parseCSV(text){
  const lines=text.replace(/^﻿/,'').replace(/\r\n?/g,"\n").split("\n").filter(l=>l.length);
  if(!lines.length) return {headers:[],rows:[],bad:0};
  const split=l=>l.split(",").map(s=>s.trim());
  const hIdx=[]; for(let i=0;i<lines.length;i++) if(/^Time\b/i.test(lines[i])) hIdx.push(i);
  if(!hIdx.length){ const headers=split(lines[0]), rows=[]; let bad=0;
    for(let i=1;i<lines.length;i++){ const f=split(lines[i]); if(f.length!==headers.length){bad++;continue;} rows.push(f); } return {headers,rows,bad}; }
  const secCols=hIdx.map(i=>split(lines[i])), union=[], seen=new Set();
  for(const cols of secCols) for(const c of cols) if(!seen.has(c)){ seen.add(c); union.push(c); }
  const uIdx={}; union.forEach((c,i)=>{uIdx[c]=i;});
  const rows=[]; let bad=0;
  for(let s=0;s<hIdx.length;s++){ const cols=secCols[s], end=s+1<hIdx.length?hIdx[s+1]:lines.length, map=cols.map(c=>uIdx[c]);
    for(let i=hIdx[s]+1;i<end;i++){ const f=split(lines[i]); if(f.length!==cols.length){bad++;continue;}
      const row=new Array(union.length).fill(''); for(let c=0;c<cols.length;c++) row[map[c]]=f[c]; rows.push(row); } }
  return {headers:union,rows,bad};
}
// Project Lambda (AEM merged export): the ECU stream is the last "Time" section; a
// wideband-only section may precede it. Original headers are kept (resolved like any
// other log); time (s) → ms; leading rows before the engine turns (RPM ≤ 0) are wiped.
const LAMBDA_SIG=/Power Mode\s*-\s*Fuel Ratio Target|AEM Lambda Ratio/i;
const detectLogFormat = text => { const h=text.slice(0,8000); return LAMBDA_SIG.test(h)||/^﻿?Time \(s\)/.test(h) ? 'lambda' : 'romraider'; };
function parseLambdaLog(text){
  const lines=text.replace(/^﻿/,'').replace(/\r\n?/g,"\n").split("\n").filter(l=>l.length), split=l=>l.split(",").map(s=>s.trim());
  let h=-1; for(let i=0;i<lines.length;i++) if(/^Time\b/i.test(lines[i])) h=i;
  if(h<0) throw 'no Time header found';
  const headers=split(lines[h]), rows=[]; let bad=0;
  for(let i=h+1;i<lines.length;i++){ if(/^Time\b/i.test(lines[i])) continue; const f=split(lines[i]); if(f.length!==headers.length){bad++;continue;} rows.push(f); }
  const ri=headers.findIndex(x=>/^Engine Speed|\bRPM\b/i.test(x)); let k=0;
  if(ri>=0){ while(k<rows.length&&!(parseFloat(rows[k][ri])>0)) k++; if(k>=rows.length) k=0; }
  else { const s0=rows.length?rows[0].slice(1).join(','):''; while(k<rows.length&&rows[k].slice(1).join(',')===s0) k++; if(k>=rows.length) k=0; }
  return {headers,rows:rows.slice(k),bad,wiped:k+h};
}
// RomRaider fast poll: the ECU streams continuously; over Bluetooth 3–4 real samples arrive
// together (0–2 ms apart), then a ~200–300 ms gap. Every row is a real sample, so keep them all
// and spread each burst evenly across the gap to the next burst (timing maths only).
function spreadBursts(headers,rows){
  const ti=headers.findIndex(h=>/^Time\b/i.test(h)); if(ti<0||rows.length<2) return rows;
  const out=rows.map(r=>r.slice()), B=[]; let prev=null;
  for(let i=0;i<out.length;i++){ const t=parseFloat(out[i][ti]); if(!Number.isFinite(t)) continue;
    if(prev===null||t-prev>=60) B.push({i,t,m:1}); else B[B.length-1].m++; prev=t; }
  if(B.length<2||B.every(b=>b.m===1)) return out;
  const sp=B.slice(0,-1).map((b,k)=>(B[k+1].t-b.t)/b.m).filter(v=>v>0).sort((x,y)=>x-y), typ=sp.length?sp[sp.length>>1]:80;
  for(let k=0;k<B.length;k++){ const b=B[k]; if(b.m<2) continue; const gap=k+1<B.length?B[k+1].t-b.t:typ*b.m, st=Math.min(gap/b.m,typ*1.5);
    for(let j=1,n=0;n<b.m-1&&b.i+j<out.length;j++){ if(!Number.isFinite(parseFloat(out[b.i+j][ti]))) continue; n++; out[b.i+j][ti]=String(Math.round((b.t+st*n)*10)/10); } }
  return out;
}
// Samples per RomRaider poll-equivalent (~256 ms): frame-count rules tuned on 3.9 Hz logs scale by this.
const POLL_MS=256;
function stepF(L){ if(L.F) return L.F; const T=L.t, d=[]; for(let i=1;i<T.length;i++){ const x=T[i]-T[i-1]; if(x>0) d.push(x); } d.sort((x,y)=>x-y);
  return L.F=d.length?Math.max(1,Math.min(8,Math.round(POLL_MS/d[d.length>>1]))):1; }
// Column family: strip *, (1/2/4-byte), trailing (unit), "(Calculated)".
function familyOf(h){ return String(h).replace(/\*/g,'').replace(/\s*\([^()]*\)\s*$/,'').replace(/\s*\((1|2|4)-byte\)/gi,'').replace(/\s*\(calculated\)/i,'').replace(/\s+/g,' ').trim(); }

// ── column resolution: saved mapping → names → data fingerprint → user ──────
//  FIELDS: key → [label, name aliases (RomRaider · Project Lambda · AccessPort · generic)]
const FIELDS={
  rpm:['Engine Speed',[/^Engine Speed/i,/^RPM\b/i,/\bRPM\b/i]],
  load:['Engine Load',[/^Engine Load\s*\((2|4)-byte\)/i,/^Engine Load/i,/^Calculated Load/i,/\bLoad\b.*g\/rev/i]],
  mafv:['MAF Voltage',[/^Mass Air ?flow (Sensor )?Voltage/i,/^MAF\s*(Sensor\s*)?Volt/i,/\bMAF\b.*\bvolt/i]],
  maf:['Mass Airflow',[/^Mass Air ?flow(?!.*volt)/i,/^MAF\b(?!.*volt)/i]],
  afl:['A/F Learning #1',[/^A\/F Learning #1/i,/^AF Learning 1/i,/Fuel Trim\s*-\s*Long Term/i,/\bLTFT\b/i,/Long Term.*Trim|Trim.*Long Term/i]],
  afc:['A/F Correction #1',[/^A\/F Correction #1/i,/^AF Correction 1/i,/Fuel Trim\s*-\s*Short Term/i,/\bSTFT\b/i,/Short Term.*Trim|Trim.*Short Term/i]],
  clol:['CL/OL Fueling',[/^CL\/OL Fueling/i,/^CL\/OL\b/i,/closed.?loop.*status|loop status/i]],
  ffb:['Target λ (FFB)',[/^Final Fueling Base/i,/Fuel Ratio Target/i,/^Comm(anded)? Fuel Final/i,/^(?!.*closed loop).*(target|commanded).*(afr|lambda|λ)/i]],
  wb:['Wideband',[/(uego|wideband|aem).*(lambda|λ)|(lambda|λ).*(uego|wideband)/i,/afr gasoline|(uego|wideband|aem).*afr/i,/uego|wideband|aem lambda|^WB\b/i]],
  fbkc:['FBKC',[/^Feedback Knock/i,/^Knock Retard/i,/\bFBKC\b/i]],
  flkc:['FLKC',[/^Fine Learning Knock/i,/^Fine Knock Learn/i,/Ignition Advance\s*-\s*Fine Learn/i,/\bFLKC\b/i]],
  kca:['KCA',[/^Knock Correction Advance/i,/\bKCA\b/]],
  iam:['IAM',[/^IAM\b/i,/Ignition Advance Multiplier/i,/^Dyn(amic)? Adv(ance)? Mult/i,/\bDAM\b/]],
  total:['Total timing',[/^Ignition Total Timing/i,/^Ignition Advance\s*(\(°\))?$/i,/^Ignition Timing\b/i,/^Timing Advance\b/i]],
  ect:['Coolant Temp',[/^Coolant Temp/i,/\bECT\b/,/Coolant/i]],
  iat:['Intake Air Temp',[/^Intake Air Temp/i,/^Intake Temp/i,/\bIAT\b/]],
  map:['Manifold Abs. Pressure',[/^Manifold Absolute Pressure/i]],
  baro:['Atmospheric Pressure',[/^Atmospheric Pressure/i,/^Baro/i]],
  torque:['Requested Torque',[/^Requested Torque/i]],
  accel:['Accelerator Pedal',[/^Accelerator Pedal/i,/^Accel(erator)? Pos/i]],
  thr:['Throttle',[/^Throttle Opening Angle/i,/^Throttle Pos/i,/^Throttle\b/i]],
  batt:['Battery Voltage',[/^Battery Voltage/i,/^Battery\b/i]],
  tipin:['Tip-in Throttle',[/^Tip-in Throttle/i]],
  vss:['Vehicle Speed',[/^Vehicle Speed/i,/\bVSS\b/]],
  wgdc:['Wastegate Duty',[/Wastegate Duty/i,/\bWGDC\b/i]],
  tboost:['Target Boost',[/^Target Boost/i,/^Boost Target/i]],
  mapr:['Manifold Rel. Pressure',[/Manifold Relative Pressure/i,/^Boost\b(?!.*target)/i]],
  avcsi:['AVCS Intake',[/^(?!.*target)Intake (VVT|AVCS|Cam)\b.*(Advance|Angle)/i,/^(?!.*target)AVCS Intake/i]],
  avcse:['AVCS Exhaust',[/^(?!.*target)Exhaust (VVT|AVCS|Cam)\b.*(Advance|Angle)/i,/^(?!.*target)AVCS Exhaust/i]],
  avcsit:['AVCS Intake Target',[/target.*intake.*(cam|avcs|vvt)|intake.*(cam|avcs|vvt).*target/i]],
  avcset:['AVCS Exhaust Target',[/target.*exhaust.*(cam|avcs|vvt)|exhaust.*(cam|avcs|vvt).*target/i]],
  avcsd:['AVCS Duty',[/(AVCS|OCV|VVT).*Duty/i]],
  ksum:['Knock Sum',[/Knock Sum/i]],
  tthr:['Target Throttle',[/^Target Throttle/i]],
  tgv:['TGV',[/\bTGV\b.*(Output|Drive|Position)|Tumble Generator/i]],
  ipw:['Injector Pulse Width',[/^Fuel Injector #1 Pulse Width/i,/Injector.*Pulse Width/i,/\bIPW\b/]],
  idc:['Injector Duty',[/Injector Duty/i,/\bIDC\b/]],
  fp:['Fuel Pressure',[/Fuel (Rail )?Pressure/i,/Rail Pressure/i]] };
const IN_NAMES={}; for(const k in FIELDS) IN_NAMES[k]=FIELDS[k][0];
const WB_COL=/uego|wideband|aem lambda/i;
// keyword families: a header naming one family is never data-guessed as another family's field
const KW=[[/knock|retard|fine learn/i,['fbkc','flkc','kca','iam']],[/trim|learning|correction/i,['afl','afc','fbkc','flkc','kca']],[/lambda|λ|afr|ratio|target/i,['wb','ffb']],
  [/volt/i,['mafv','batt']],[/load|g\/rev/i,['load']],[/temp/i,['ect','iat']],[/rpm|speed/i,['rpm']],[/timing|advance|ign/i,['total','kca','iam','flkc']],
  [/throttle|pedal|accel/i,['thr','accel','tipin']],[/pulse|ipw|inj/i,['ipw']],[/pressure|boost|kpa|psi|duty|pump|sum|count|gear|speed \(k|vehicle/i,[]]];
function colStats(rows,j){ const n=rows.length, step=Math.max(1,Math.floor(n/4000)), v=[]; let ok=0, tot=0;
  for(let i=0;i<n;i+=step){ tot++; const x=parseFloat(rows[i][j]); if(Number.isFinite(x)){ ok++; v.push(x); } }
  if(!v.length) return {ok:0}; const s=v.slice().sort((a,b)=>a-b), q=p=>s[Math.min(s.length-1,Math.floor(p*(s.length-1)))], cnt=new Map(); let di=0, ints=0;
  for(let i=0;i<v.length;i++){ const r=Math.round(v[i]*1000)/1000; cnt.set(r,(cnt.get(r)||0)+1); if(Math.abs(v[i]-Math.round(v[i]))<1e-9) ints++; if(i) di+=Math.abs(v[i]-v[i-1]); }
  let mode=0, mc=0; cnt.forEach((c,k)=>{ if(c>mc){ mc=c; mode=k; } });
  const rg=s[s.length-1]-s[0];
  return {ok:ok/tot,min:s[0],max:s[s.length-1],p5:q(.05),med:q(.5),p95:q(.95),nd:cnt.size,mode,modeF:mc/v.length,intF:ints/v.length,rough:rg>0?di/(v.length-1)/rg:0}; }
// data score 0..1 for "column with stats s is field k"
function dataScore(k,s){ if(!s||!(s.ok>0.5)) return 0; const {min,max,p5,med,p95,nd,mode,modeF,intF,rough}=s, inr=(a,b)=>min>=a&&max<=b;
  switch(k){
    case 'rpm': return inr(0,10000)&&p95>=1500&&med>=500&&med<=5500&&intF>0.9?0.9:0;
    case 'mafv': return inr(0,5.2)&&p95>1.3&&med>=0.9&&med<=3.6&&nd>40?0.8:0;
    case 'load': return inr(0,5)&&p95>=0.5&&med>=0.12&&med<=1.4&&nd>40?0.7:0;
    case 'maf': return inr(0,700)&&p95>=10&&med>=2&&nd>60&&intF<0.9?0.45:0;
    case 'afc': return inr(-50,50)&&Math.abs(med)<10&&nd>30&&rough>0.03?0.6:0;
    case 'afl': return inr(-50,50)&&nd<=80&&modeF>0.15&&rough<0.03?0.55:0;
    case 'wb': return (p5>=0.55&&p95<=2.5&&med>=0.8&&med<=1.2&&nd>20&&!(Math.abs(mode-1)<1e-6&&modeF>0.4))||(p5>=8&&p95<=30&&med>=11.5&&med<=17.5&&nd>20&&!(Math.abs(mode-14.7)<0.01&&modeF>0.4))?0.7:0;
    case 'ffb': return (inr(0.6,1.25)&&Math.abs(mode-1)<0.002&&modeF>0.3)||(inr(9,18)&&Math.abs(mode-14.7)<0.05&&modeF>0.3)?0.8:0;
    case 'clol': return intF>0.999&&nd<=8&&inr(0,16)&&(Math.abs(mode-8)<1e-9||Math.abs(mode-10)<1e-9)?0.8:0;
    case 'fbkc': return ((max<=0.01&&min>=-15)||(min>=-0.01&&max<=15))&&Math.abs(mode)<1e-9&&modeF>0.75&&max-min>0?0.6:0;
    case 'flkc': return inr(-15,10)&&nd<=60&&Math.abs(mode)<1e-9&&modeF>0.3?0.45:0;
    case 'kca': return inr(-0.01,16)&&nd>8&&p95>0?0.3:0;
    case 'iam': return (inr(0,1)||inr(0,16))&&nd<=20&&max>0?0.45:0;
    case 'total': return inr(-20,70)&&med>=5&&med<=45&&nd>15?0.4:0;
    case 'ect': return inr(-40,135)&&med>=50&&med<=110&&rough<0.01?0.45:0;
    case 'iat': return inr(-40,90)&&med>=-15&&med<=60&&rough<0.01?0.35:0;
    case 'batt': return inr(8,17)&&med>=11.5&&med<=15.2?0.75:0;
    case 'thr': case 'accel': return inr(0,101)&&p95>15?0.3:0;
    case 'ipw': return inr(0,40)&&med>=1&&med<=12&&nd>40?0.35:0; }
  return 0; }
function nameAllows(h,k){ let hit=false; for(const [re,ks] of KW) if(re.test(h)){ hit=true; if(ks.includes(k)) return 1.15; } return hit?0.25:1; }
// Prepare a log: parse + propose an assignment {field: {j, how:'saved'|'name'|'data'}} and unsure guesses.
function prepLog(name,text,saved){
  const fmt=detectLogFormat(text);
  let {headers,rows,bad,wiped} = fmt==='lambda' ? parseLambdaLog(text) : parseCSV(text);
  if(!headers.length||!rows.length) throw 'no readable rows';
  if(fmt!=='lambda') rows=spreadBursts(headers,rows);
  const ti=headers.findIndex(h=>/^Time\b/i.test(h)), sig=headers.filter((h,j)=>j!==ti).join('|'), A={}, used=new Set(), unsure=[];
  if(typeof saved==='function') saved=saved(sig);
  if(saved){ for(const j in headers){ const k=saved[headers[j]]; if(k&&FIELDS[k]&&!A[k]){ A[k]={j:+j,how:'saved'}; used.add(+j); } }
    return {name,fmt,headers,rows,bad,wiped:wiped||0,ti,sig,A,unsure,stats:[],saved:true}; }
  for(const k in FIELDS){ for(const re of FIELDS[k][1]){ const j=headers.findIndex((h,x)=>x!==ti&&!used.has(x)&&re.test(h)&&(k==='wb'||!WB_COL.test(h))); if(j>=0){ A[k]={j,how:'name'}; used.add(j); break; } } }
  const stats=headers.map((h,j)=>j===ti||used.has(j)?null:colStats(rows,j));
  const cand=[]; headers.forEach((h,j)=>{ if(!stats[j]) return; for(const k in FIELDS){ if(A[k]) continue; const sc=dataScore(k,stats[j])*nameAllows(h,k); if(sc>=0.4) cand.push({j,k,sc}); } });
  cand.sort((a,b)=>b.sc-a.sc);
  for(const c of cand){ if(A[c.k]||used.has(c.j)) continue; const rivals=cand.filter(o=>o!==c&&(o.j===c.j||o.k===c.k)&&!A[o.k]&&!used.has(o.j)), r=rivals.length?rivals[0].sc:0;
    if(c.sc>=0.75&&c.sc-r>=0.2){ A[c.k]={j:c.j,how:'data'}; used.add(c.j); } else if(!unsure.some(u=>u.j===c.j)){ unsure.push(c); used.add(c.j); } }
  return {name,fmt,headers,rows,bad,wiped:wiped||0,ti,sig,A,unsure,stats,saved:false};
}
// Build the log from a prepared parse and a final assignment.
function finishLog(P,A){
  const {name,fmt,headers,rows,bad,ti}=P, N=rows.length, idx={}, colArr=j=>{ const a=new Float64Array(N); for(let i=0;i<N;i++){ const x=parseFloat(rows[i][j]); a[i]=Number.isFinite(x)?x:NaN; } return a; };
  for(const k in FIELDS) idx[k]=A[k]?A[k].j:-1;
  const c={}, cols={}; for(const k in idx) if(idx[k]>=0&&k!=='wb') c[k]=cols[idx[k]]=colArr(idx[k]);
  const wbj=idx.wb, wb=new Float64Array(N).fill(NaN), ffb=new Float64Array(N).fill(NaN);
  if(wbj>=0){ const r=colArr(wbj), m=median(Array.from(r).filter(v=>v>0).slice(0,3000)), k=/afr/i.test(headers[wbj])||(m!=null&&m>3)?1/LAM:1; for(let i=0;i<N;i++) wb[i]=r[i]*k; c.wb=wb; }
  let ffbK=1; if(c.ffb){ const m=median(Array.from(c.ffb).filter(v=>v>0).slice(0,2000)); if(/afr/i.test(headers[idx.ffb])||(m!=null&&m>3)) ffbK=1/LAM; for(let i=0;i<N;i++) ffb[i]=c.ffb[i]*ffbK; }
  // sign / scale normalisation
  for(const k of ['fbkc','flkc']){ const a=c[k]; if(!a) continue; if(k==='fbkc'||/retard/i.test(headers[idx[k]])){ let mx=-1e9, mn=1e9; for(const v of a) if(Number.isFinite(v)){ if(v>mx) mx=v; if(v<mn) mn=v; } if(mn>=-0.001&&mx>0.001) for(let i=0;i<N;i++) a[i]=-Math.abs(a[i]); } }
  const unitOf=k=>idx[k]>=0?String(headers[idx[k]]):'', psi=k=>/psi/i.test(unitOf(k)), scl=(a,f)=>{ for(let i=0;i<N;i++) a[i]*=f; };
  if(c.baro&&psi('baro')) scl(c.baro,PSI); if(c.map&&psi('map')) scl(c.map,PSI); if(c.tboost&&psi('tboost')) scl(c.tboost,PSI);
  if(c.tboost&&/relative|gauge/i.test(unitOf('tboost'))) for(let i=0;i<N;i++) c.tboost[i]+=c.baro&&Number.isFinite(c.baro[i])?c.baro[i]:ATM;
  if(c.mapr){ if(psi('mapr')) scl(c.mapr,PSI); if(!c.map&&c.baro){ c.map=new Float64Array(N); for(let i=0;i<N;i++) c.map[i]=c.mapr[i]+(c.baro&&Number.isFinite(c.baro[i])?c.baro[i]:ATM); } }
  if(c.vss&&/mph/i.test(unitOf('vss'))) scl(c.vss,1.609344);
  if(c.iam){ let mx=0; for(const v of c.iam) if(v>mx) mx=v; if(mx>1.5) for(let i=0;i<N;i++) c.iam[i]/=16; }
  const tu=ti>=0?(/\((s|sec|secs|seconds)\)/i.test(headers[ti])?1000:1):1, t=new Float64Array(N); let t0=null;
  for(let i=0;i<N;i++){ let v=ti>=0?parseFloat(rows[i][ti])*tu:NaN; if(!Number.isFinite(v)) v=i*255; if(t0===null) t0=v; t[i]=v-t0; if(i&&!(t[i]>=t[i-1])) t[i]=t[i-1]; }
  const L={ name, fmt, headers, rows, bad, wiped:P.wiped, N, t, dur:N?t[N-1]:0, c, cols, idx, wbj, wb, ffb, ffbK, ffbSrc:c.ffb?'log':null, st:new Float64Array(N).fill(NaN),
    fam:headers.map(familyOf), an:null, sig:P.sig, map:A };
  L.cap=logCap(L); return L;
}
// What a log can feed: CL bins need MAF V + both trims; OL bins need MAF V + WB + a target
// (logged, or the tune's open-loop table at logged load/RPM).
function logCap(L){ const C=L.c, tuneTgt=!!(TUNE&&TUNE.byId.fuel_pe&&C.load&&C.rpm);
  const cl=!!(C.mafv&&C.afl&&C.afc), ol=!!(C.mafv&&C.wb&&(C.ffb||tuneTgt));
  return {cl,ol,maf:cl||ol,wb:!!C.wb,tgt:C.ffb?(L.fmt==='lambda'?'pl':'log'):tuneTgt?'tune':null,loop:C.clol?'log':'inferred',knock:!!(C.fbkc||C.flkc||C.kca||C.iam),rpm:!!C.rpm}; }
function mafNeeds(L){ if(!L) return [IN_NAMES.mafv]; const C=L.c, m=[]; if(!C.mafv) m.push(IN_NAMES.mafv);
  if(!(C.afl&&C.afc)&&!(C.wb&&(C.ffb||(TUNE&&TUNE.byId.fuel_pe&&C.load)))){ if(!C.afl) m.push(IN_NAMES.afl); if(!C.afc) m.push(IN_NAMES.afc); if(!C.wb) m.push('or Wideband + target λ'); } return m; }
function buildLog(name,text,saved){ const P=prepLog(name,text,saved); return finishLog(P,P.A); }
function logCol(L,j){ let a=L.cols[j]; if(a) return a; const N=L.N; a=new Float64Array(N); for(let i=0;i<N;i++){ const x=parseFloat(L.rows[i][j]); a[i]=Number.isFinite(x)?x:NaN; } return L.cols[j]=a; }

// ── per-frame filters + corrections ────────────────────────────────────────
//  Fuel cut, best signal first: IPW ≈ 0 → pedal closed + RPM falling → status 10 at
//  closed-throttle airflow (MAF V < cutMafv); backstop: WB > leanLam at low airflow.
//  Every cut is followed by a recovery window (WB sweeping back is never used).
const DROP_LABEL={nowb:'no wideband',notgt:'no target λ',notrim:'no trims',nan:'unreadable',idle:'idle/crank',warmup:'warmup',cut:'fuel cut',recover:'cut recovery',overrun:'OL overrun',rail:'WB rail',trans:'transient'};
function analyzeLog(L){
  const N=L.N, C=L.c, t=L.t, wb=L.wb, ff=L.ffb;
  const drop=new Array(N).fill(null), loop=new Int8Array(N), lean=new Uint8Array(N), cutF=new Uint8Array(N);
  const mCL=new Float64Array(N).fill(NaN), mOLa=new Float64Array(N).fill(NaN), mOLr=new Float64Array(N).fill(NaN), dv=new Float64Array(N);
  const aud={total:N,bad:L.bad||0,nowb:0,notgt:0,notrim:0,nan:0,idle:0,warmup:0,cut:0,recover:0,rail:0,trans:0,overrun:0,kept:0,lean:0,
             tier:C.ipw?'IPW':(C.accel||C.thr)?'Pedal':'Status 10 + MAF V'};
  const ped=C.accel||C.thr; L.cap=logCap(L);
  // target λ: logged, else the tune's open-loop table at logged load/RPM (OL values only)
  if(!C.ffb){ const fp=TUNE&&TUNE.byId.fuel_pe; L.ffbSrc=null; if(fp&&C.load&&C.rpm){ L.ffbSrc='tune'; for(let i=0;i<N;i++) ff[i]=Number.isFinite(C.load[i])&&Number.isFinite(C.rpm[i])?at2(fp,C.load[i],C.rpm[i]):NaN; } else ff.fill(NaN); }
  // loop status: logged, else inferred — target enrichment, or AFC held at exactly 0 ≥ 1 s once trims were active
  const S=L.st; if(C.clol) S.set(C.clol); else { let warm=false, z0=-1;
    for(let i=0;i<N;i++){ const a=C.afc?C.afc[i]:NaN, f=L.ffbSrc==='log'||C.ffb?ff[i]:NaN; if(Number.isFinite(a)&&Math.abs(a)>1e-9) warm=true;
      if(Number.isFinite(a)&&Math.abs(a)<1e-9){ if(z0<0) z0=i; } else z0=-1;
      const enr=Number.isFinite(f)&&f<(L.fmt==='lambda'?0.9995:CFG.olEnr), held=z0>=0&&warm&&t[i]-t[z0]>=1000;
      S[i]=enr||(!Number.isFinite(f)&&held&&C.rpm&&C.rpm[i]>1500)?10:(warm||!C.afc?8:7); } }
  aud.loopInf=!C.clol; aud.tgt=L.cap.tgt; aud.noWB=!C.wb;
  if(!C.mafv){ L.an={drop,loop,lean,cutF,mCL,mOLa,mOLr,dv,aud:Object.assign(aud,{na:true})}; return L.an; }
  const lmc=TUNE&&TUNE.byId.load_map_comp, mic=TUNE&&TUNE.byId.maf_iat_comp, sc=TUNE&&TUNE.mafScale;
  const useLmc=lmc&&C.map&&lmc.z.some(r=>r.some(v=>v!==0)), useMic=mic&&C.iat&&sc&&mic.z.some(r=>r.some(v=>v!==0));
  aud.lmcUnlogged = !!(lmc && !C.map && lmc.z.some(r=>r.some(v=>v!==0)));
  const F=stepF({t}); if(C.mafv) for(let i=1;i<N;i++){ const j=Math.max(0,i-F); dv[i]=Math.abs(C.mafv[i]-C.mafv[j])/Math.max(0.05,(t[i]-t[j])/1000); }
  let lastCut=-1e12;
  for(let i=0;i<N;i++){
    const rpm=C.rpm?C.rpm[i]:NaN, mv=C.mafv[i], st=S[i], w=wb[i], f=ff[i];
    let cut=false;
    if(C.ipw && C.ipw[i]<0.3 && rpm>1000) cut=true;
    if(!cut && ped && ped[i]<2 && rpm>1200 && i>0 && rpm<C.rpm[i-1]) cut=true;
    if(!cut && st>=10 && mv<CFG.cutMafv) cut=true;
    if(!cut && w>CFG.leanLam && mv<CFG.cutMafv) cut=true;
    if(cut){ lastCut=t[i]; cutF[i]=1; }
    let d=null;
    if(!Number.isFinite(rpm)||!Number.isFinite(mv)||!Number.isFinite(st)) d='nan';
    else if(rpm<600) d='idle';
    else if(!(st>=10) && st!==8) d='warmup';
    else if(cut) d='cut';
    else if(t[i]-lastCut<CFG.recoverS*1000) d='recover';
    else if(dv[i]>CFG.transVs||(i>0&&dv[Math.max(0,i-F)]>CFG.transVs)) d='trans';
    else if(st>=10){ if(!C.wb) d='nowb'; else if(!(Number.isFinite(f)&&f>0)) d='notgt'; else if(!Number.isFinite(w)) d='nan'; else if(f>CFG.olEnr) d='overrun'; else if(w<CFG.railLo||w>CFG.railHi) d='rail'; }
    else if(!C.afl||!C.afc) d='notrim'; else if(!Number.isFinite(C.afl[i])) d='nan';
    if(d){ drop[i]=d; aud[d]++; continue; }
    aud.kept++;
    let cf=1;
    if(useLmc && Number.isFinite(C.map[i])) cf*=1+at2(lmc,C.map[i],rpm)/100;
    if(useMic && Number.isFinite(C.iat[i])) cf*=1+at2(mic,C.iat[i],lerpArr(TUNE.axis,sc,mv))/100;
    if(st>=10){ loop[i]=2; const r=w/f, afl=C.afl&&Number.isFinite(C.afl[i])?C.afl[i]:0; mOLr[i]=r*cf; mOLa[i]=r*(1+afl/100)*cf; if(w>CFG.leanLam){ lean[i]=1; aud.lean++; } }
    else { loop[i]=1; const afc=C.afc&&Number.isFinite(C.afc[i])?C.afc[i]:0; mCL[i]=(1+(C.afl[i]+afc)/100)*cf; }
  }
  L.an={drop,loop,lean,cutF,mCL,mOLa,mOLr,dv,aud};
  return L.an;
}

// ── bins ────────────────────────────────────────────────────────────────────
// spans: [{L, lo, hi}] frame ranges (whole logs, to-playhead, or A–B).
function computeBins(spans){
  const nb=BP.length, A=Array.from({length:nb},()=>({cl:[],ola:[],olr:[],afl:[],afc:[],wb:[],ff:[],lean:0}));
  for(const {L,lo,hi} of spans){ const an=L.an, C=L.c; if(!an) continue;
    for(let i=Math.max(0,lo);i<=Math.min(L.N-1,hi);i++){ const lp=an.loop[i]; if(!lp) continue;
      const x=fi(BP,C.mafv[i]), b0=Math.floor(x), a=x-b0, b1=Math.min(b0+1,nb-1);
      for(const [b,w] of [[b0,1-a],[b1,a]]){ if(w<0.01) continue; const B=A[b];
        if(lp===1){ B.cl.push([an.mCL[i],w]); B.afc.push([C.afc?C.afc[i]:0,w]); }
        else { B.ola.push([an.mOLa[i],w]); B.olr.push([an.mOLr[i],w]); B.wb.push([L.wb[i],w]); B.ff.push([L.ffb[i],w]); if(an.lean[i]) B.lean+=w; }
        B.afl.push([C.afl?C.afl[i]:NaN,w]); } } }
  return finalizeBins(A.map((B,b)=>({i:b,v:BP[b],_cl:B.cl,_ola:B.ola,_olr:B.olr,nCL:sumW(B.cl),nOL:sumW(B.ola),
    afl:wmed(B.afl),afc:wmed(B.afc),wb:wmed(B.wb),ff:wmed(B.ff),lean:B.lean,cl:wmed(B.cl),olA:wmed(B.ola),olR:wmed(B.olr)})));
}
// Depends on CFG.olAfl / solidN → re-run when those change (cheap: no log pass).
function finalizeBins(bins){
  for(const b of bins){
    b.n=b.nCL+b.nOL; b.ol=CFG.olAfl?b.olA:b.olR;
    b.m=b.n?wmed(b._cl.concat(CFG.olAfl?b._ola:b._olr)):null;
    b.conf=Math.min(1,b.n/CFG.solidN); b.trust=!b.n?'none':b.n>=CFG.solidN?'solid':'provisional';
    b.src=!b.n?null:b.nOL&&b.nCL?'MIX':b.nOL?'OL':'CL';
    b.agree=(b.nCL>=5&&b.nOL>=5&&b.cl!=null&&b.ol!=null)?b.ol-b.cl:null;
    b.rich=b.wb!=null&&b.wb<=CFG.richFloor;
  }
  return bins;
}
// CL/OL seam: mean OL−CL gap over bins carrying ≥5 of each; else adjacent boundary bins.
function seamGap(bins){
  const both=bins.filter(b=>b.agree!=null); if(both.length) return {gap:both.reduce((s,b)=>s+b.agree,0)/both.length, bins:both.map(b=>b.i)};
  let lastCL=null; for(const b of bins){ if(b.nCL>=5&&b.nCL>=b.nOL) lastCL=b; else if(b.nOL>=5&&lastCL) return {gap:b.ol-lastCL.cl,bins:[lastCL.i,b.i]}; }
  return null;
}
// Copied row + checks. fixes: Set of bin indices whose suggested kink fix is accepted.
function scaleRow(bins, fixes){
  const sc=TUNE&&TUNE.mafScale; if(!sc||!bins||sc.length!==bins.length) return null;
  const f=bins.map(b=>b.m!=null?1+(b.m-1)*b.conf:1), n=f.length, kink=new Array(n).fill(null);
  for(let i=1;i<n-1;i++){ if(!bins[i].n||!bins[i-1].n||!bins[i+1].n) continue; const exp=(f[i-1]+f[i+1])/2; if(Math.abs(f[i]-exp)>CFG.kinkTol) kink[i]=exp; }
  const used=f.slice(); if(fixes) for(const i of fixes) if(kink[i]!=null) used[i]=kink[i];
  const nv=sc.map((g,i)=>g*used[i]), mono=nv.map((v,i)=>i>0&&v<=nv[i-1]);
  return {f:used,raw:f,nv,kink,mono,text:nv.map(v=>v.toFixed(2)).join(', ')};
}

// ── IPW check: which trims the ECU really applies in open loop ──────────────
//  Commanded fuel per cylinder event = (IPW − latency) × flow; expected (no trims)
//  = (load/2) / (14.7 × λ_target). The ratio R carries injector/density constants,
//  so K is calibrated from CL frames (R / (1 + (AFL+AFC)/100)); then in OL R/K is
//  compared with 1 + AFL/100 ("AFL applied") and with 1 ("not applied").
function ipwCheck(logs){
  if(!TUNE||!TUNE.injFlow||!logs.some(L=>L.c.ipw&&L.c.load&&L.c.afl)) return null;
  const lat=TUNE.byId.inj_latency, K=[], q=[], qa=[];
  for(const L of logs){ const C=L.c, an=L.an; if(!C.ipw||!C.load||!C.afl||!an) continue;
    for(let i=0;i<L.N;i++){ const lp=an.loop[i]; if(!lp) continue;
      const lt=lat?at2(lat,C.batt&&Number.isFinite(C.batt[i])?C.batt[i]:14,0):0, eff=C.ipw[i]-lt; if(!(eff>0.3)||!(C.load[i]>0)||!(L.ffb[i]>0)) continue;
      const R=(eff*TUNE.injFlow/60000*0.74)/((C.load[i]/2)/(LAM*L.ffb[i]));
      if(lp===1){ const afc=C.afc&&Number.isFinite(C.afc[i])?C.afc[i]:0; K.push(R/(1+(C.afl[i]+afc)/100)); }
      else { q.push(R); qa.push(1+(Number.isFinite(C.afl[i])?C.afl[i]:0)/100); } } }
  if(K.length<30||q.length<10) return {n:K.length+q.length, verdict:null};
  const k=median(K), r=median(q.map(v=>v/k)), a=median(qa), dA=Math.abs(r-a), dR=Math.abs(r-1);
  return {nCL:K.length,nOL:q.length,ratio:r,afl:a,verdict:Math.abs(a-1)<0.01?'inconclusive':(dA<dR?'applied':'not applied'),dA,dR};
}

// ── tune ────────────────────────────────────────────────────────────────────
const TT_SPEC=`spark_base|Timing|timing|Base timing|TGV Closed / VVT Off · Cruise|deg|1|spark_base_load_index|load|spark_base_rpm_index|rpm|closed
spark_base_b|Timing|timing|Base timing|TGV Closed / VVT On · Cruise|deg|1|spark_base_load_index_b|load|spark_base_rpm_index_b|rpm|closed
spark_base_c|Timing|timing|Base timing|TGV Open / VVT Off · Non-Cruise|deg|1|spark_base_load_index_c|load|spark_base_rpm_index_c|rpm|open
spark_base_d|Timing|timing|Base timing|TGV Open / VVT On · Non-Cruise|deg|1|spark_base_load_index_d|load|spark_base_rpm_index_d|rpm|open
spark_iat_factor|Timing|iatact|Timing IAT activation|Activation|%|0|spark_iat_factor_rpm_index|rpm|spark_iat_factor_load_index|load|
spark_iat|Timing|tiat|Timing comp (IAT)|IAT|deg|1|spark_iat_index|iat|||
spark_ect|Timing|tect|Timing comp (ECT)|ECT|deg|1|spark_ect_index|ect|||
spark_cyl|Timing|tcyl|Per-cylinder timing|A|deg|1|spark_cyl_rpm_index|rpm|spark_cyl_load_index|load|
spark_cyl_b|Timing|tcyl|Per-cylinder timing|B|deg|1|spark_cyl_rpm_index_b|rpm|spark_cyl_load_index_b|load|
spark_cyl_c|Timing|tcyl|Per-cylinder timing|C|deg|1|spark_cyl_rpm_index_c|rpm|spark_cyl_load_index_c|load|
spark_cyl_d|Timing|tcyl|Per-cylinder timing|D|deg|1|spark_cyl_rpm_index_d|rpm|spark_cyl_load_index_d|load|
spark_learned|Knock|kca|Knock advance max|TGV Closed|deg|1|spark_learned_load_index|load|spark_learned_rpm_index|rpm|closed
spark_learned_b|Knock|kca|Knock advance max|TGV Open|deg|1|spark_learned_load_index_b|load|spark_learned_rpm_index_b|rpm|open
fuel_pe|Fuel|fuel|Open loop fuel|Normal|lam|3|fuel_pe_load_index|load|fuel_pe_rpm_index|rpm|normal
fuel_pe_b|Fuel|fuel|Open loop fuel|Safe Mode|lam|3|fuel_pe_load_index_b|load|fuel_pe_rpm_index_b|rpm|safe
fuel_base|Fuel|fbase|Base fuel target|AT|lam|3|fuel_base_load_index|load|fuel_base_rpm_index|rpm|
fuel_base_b|Fuel|fbase|Base fuel target|MT|lam|3|fuel_base_load_index_b|load|fuel_base_rpm_index_b|rpm|
inj_latency|Fuel|lat|Injector latency|Latency|ms|2|inj_latency_bat_index|batt|||
accel_enrich|Fuel|tipin|Tip-in enrichment|Tip-in|ms|2|accel_enrich_index|tipin|||
fuel_cranking|Fuel|crank|Cranking fuel|Cranking|ms|1|#|idx|#|idy|
front_o2_baro_comp|Fuel|o2baro|Front O2 comp (baro)|Baro|%|1|front_o2_baro_comp_index|baro|||
maf_scale|Airflow|maf|MAF scaling|MAF|g/s|2|maf_scale_index|mafv|||
maf_iat_comp|Airflow|mafiat|MAF comp (IAT)|IAT comp|%|1|maf_iat_comp_iat_index|iat|maf_iat_comp_maf_index|maf|
load_map_comp|Airflow|loadmap|Load comp (MAP)|MAP comp|%|1|load_map_comp_map_index|map|load_map_comp_rpm_index|rpm|
boost_target|Boost|boost|Boost target|A|kPa|1|boost_target_torque_index|torque|boost_target_rpm_index|rpm|
boost_target_b|Boost|boost|Boost target|B|kPa|1|boost_target_torque_index_b|torque|boost_target_rpm_index_b|rpm|
boost_target_baro_comp|Boost|bbaro|Boost comp (baro)|Baro|%|1|boost_target_baro_comp_index|baro|||
boost_target_iat_comp|Boost|biat|Boost comp (IAT)|IAT|%|1|boost_target_iat_index|iat|||
boost_target_ect_comp|Boost|bect|Boost comp (ECT)|A|%|1|boost_target_ect_index|ect|||
boost_target_ect_comp_b|Boost|bect|Boost comp (ECT)|B|%|1|boost_target_ect_index|ect|||
boost_limit|Boost|blim|Boost limit (fuel cut)|Limit|kPa|1|boost_limit_index|baro|||
wg_base|Wastegate|wgb|Wastegate base|A|%|1|wg_base_torque_index|torque|wg_base_rpm_index|rpm|
wg_base_b|Wastegate|wgb|Wastegate base|B|%|1|wg_base_torque_index_b|torque|wg_base_rpm_index_b|rpm|
wg_max|Wastegate|wgm|Wastegate max|A|%|1|wg_max_torque_index|torque|wg_max_rpm_index|rpm|
wg_max_b|Wastegate|wgm|Wastegate max|B|%|1|wg_max_torque_index_b|torque|wg_max_rpm_index_b|rpm|
wg_baro_comp|Wastegate|wgbaro|Wastegate comp (baro)|A|%|1|wg_baro_comp_baro_index|baro|wg_baro_comp_rpm_index|rpm|
wg_baro_comp_b|Wastegate|wgbaro|Wastegate comp (baro)|B|%|1|wg_baro_comp_baro_index_b|baro|wg_baro_comp_rpm_index_b|rpm|
wg_iat_comp|Wastegate|wgiat|Wastegate comp (IAT)|A|%|1|wg_iat_comp_index|iat|||
wg_iat_comp_b|Wastegate|wgiat|Wastegate comp (IAT)|B|%|1|wg_iat_comp_index_b|iat|||
wg_ect_comp|Wastegate|wgect|Wastegate comp (ECT)|A|%|1|boost_target_ect_index|ect|||
wg_ect_comp_b|Wastegate|wgect|Wastegate comp (ECT)|B|%|1|boost_target_ect_index|ect|||
wg_prop|Wastegate|wgp|Wastegate P (boost error)|P|%|2|wg_prop_index|berr|||
wg_prop_iat_comp|Wastegate|wgpi|Wastegate P comp (IAT)|IAT|%|1|wg_prop_iat_comp_index|iat|||
wg_int_pos|Wastegate|wgi|Wastegate I (boost error)|Positive|%|2|wg_int_pos_index|berr|||
wg_int_neg|Wastegate|wgi|Wastegate I (boost error)|Negative|%|2|wg_int_neg_index|berr|||
wg_int_pos_iat_comp|Wastegate|wgii|Wastegate I comp (IAT)|Positive|%|1|wg_int_pos_iat_comp_index|iat|||
wg_int_neg_iat_comp|Wastegate|wgii|Wastegate I comp (IAT)|Negative|%|1|wg_int_neg_iat_comp_index|iat|||
throttle_target|Throttle/Torque|thr|Throttle target|TGV Closed|%|1|throttle_target_tq_index|torque|throttle_target_rpm_index|rpm|closed
throttle_target_b|Throttle/Torque|thr|Throttle target|TGV Open|%|1|throttle_target_tq_index_b|torque|throttle_target_rpm_index_b|rpm|open
throttle_target_c|Throttle/Torque|thr|Throttle target|Maximum|%|1|throttle_target_tq_index_c|torque|throttle_target_rpm_index_c|rpm|
torque_request|Throttle/Torque|tq|Requested torque|A1|Nm|0|torque_request_acc_index|accel|torque_request_rpm_index|rpm|
torque_request_b|Throttle/Torque|tq|Requested torque|B1|Nm|0|torque_request_acc_index_b|accel|torque_request_rpm_index_b|rpm|
torque_request_c|Throttle/Torque|tq|Requested torque|C1|Nm|0|torque_request_acc_index_c|accel|torque_request_rpm_index_c|rpm|
torque_request_a2|Throttle/Torque|tq|Requested torque|A2|Nm|0|torque_request_acc_index_a2|accel|torque_request_rpm_index_a2|rpm|
torque_request_b2|Throttle/Torque|tq|Requested torque|B2|Nm|0|torque_request_acc_index_b2|accel|torque_request_rpm_index_b2|rpm|
torque_request_c2|Throttle/Torque|tq|Requested torque|C2|Nm|0|torque_request_acc_index_c2|accel|torque_request_rpm_index_c2|rpm|
throttle_limit|Throttle/Torque|tlim|Throttle limit (speed)|Normal|%|1|throttle_limit_index|vss|||
throttle_limit_sport_a|Throttle/Torque|tlim|Throttle limit (speed)|Sport A|%|1|throttle_limit_sport_a_index|vss|||
throttle_limit_sport_b|Throttle/Torque|tlim|Throttle limit (speed)|Sport B|%|1|throttle_limit_sport_b_index|vss|||
throttle_limit_rpm_a|Throttle/Torque|tlimr|Throttle limit (rpm)|A|%|1|throttle_limit_rpm_a_index|rpm|||
throttle_limit_rpm_b|Throttle/Torque|tlimr|Throttle limit (rpm)|B|%|1|throttle_limit_rpm_b_index|rpm|||
vvt_intake_a|AVCS|avcsi|AVCS intake|TGV Closed|deg|1|vvt_intake_load_index_a|load|vvt_intake_rpm_index_a|rpm|closed
vvt_intake_b|AVCS|avcsi|AVCS intake|TGV Open|deg|1|vvt_intake_load_index_b|load|vvt_intake_rpm_index_b|rpm|open
vvt_exhaust_a|AVCS|avcse|AVCS exhaust|TGV Closed|deg|1|vvt_exhaust_load_index_a|load|vvt_exhaust_rpm_index_a|rpm|closed
vvt_exhaust_b|AVCS|avcse|AVCS exhaust|TGV Open|deg|1|vvt_exhaust_load_index_b|load|vvt_exhaust_rpm_index_b|rpm|open
front_o2_scale|Sensors|o2s|Front O2 scale|Scale|lam|3|front_o2_scale_index|o2ma|||
iat_scale|Sensors|iats|IAT sensor scale|Scale|°C|0|iat_scale_index|iatv|||
coolant_temp_scale|Sensors|ects|Coolant sensor scale|Scale|°C|0|#|idx|||`.split('\n').map(l=>l.split('|'));
// Single values / short lists → settings cards.  id|cat|label|unit|dp|live key|pressure kind
const SC_SPEC=`spark_cyl_ect|Timing|Per-cylinder timing: min coolant|°C|0|||Per-cylinder timing corrections only apply at or above this coolant temperature
spark_cyl_load|Timing|Per-cylinder timing: min load|g/rev|2|||Per-cylinder timing corrections only apply at or above this load
spark_cyl_rpm|Timing|Per-cylinder timing: max RPM|rpm|0|||Per-cylinder timing corrections only apply below this RPM
knock_load|Knock|FBKC active above load|g/rev|2|||Feedback knock correction can only pull timing above this load (Low = turn-off, High = turn-on)
knock_rpm_range|Knock|Knock Retard - Engine Speed Range|rpm|0|||Feedback knock correction only works inside this RPM range (Low = turn-off, High = turn-on)
knock_attack|Knock|FBKC retard per knock event|deg|1|||Timing pulled by FBKC each time knock is detected
knock_decay|Knock|FBKC recovery step|deg|1|||Timing given back each recovery interval once knock stops
knock_decay_interval|Knock|FBKC recovery interval||0|||How often (in ECU ticks) FBKC gives timing back
knock_max|Knock|FBKC max retard|deg|1|||Most timing FBKC can pull
spark_fine_load_limit|Knock|FLKC learning load range|g/rev|2|||Fine learning knock correction only learns inside this load range
spark_fine_rpm_min|Knock|FLKC learning minimum RPM|rpm|0|||Fine learning knock correction only learns above this RPM
spark_fine_rpm_max|Knock|FLKC learning maximum RPM|rpm|0|||Fine learning knock correction only learns below this RPM
spark_fine_advance_step|Knock|FLKC advance step|deg|1|||Timing FLKC adds back per learning step when no knock
spark_fine_retard_step|Knock|FLKC retard step|deg|1|||Timing FLKC removes per learning step on knock
spark_fine_max|Knock|FLKC max advance|deg|1|||Most timing FLKC can add
spark_fine_min|Knock|FLKC max retard|deg|1|||Most timing FLKC can remove
iam_init|Knock|IAM after reset||2|||IAM value the ECU starts from after a reset
iam_step_init|Knock|IAM step||2|||How much IAM moves per learning step
iam_load_limit|Knock|IAM learning load range|g/rev|2|||IAM only learns inside this load range
iam_rpm_limit|Knock|IAM learning RPM range|rpm|0|||IAM only learns inside this RPM range
iam_min_learned_spark|Knock|IAM learning min advance|deg|1|||Knock advance max must be at least this for IAM to learn
fuel_rear_comp_max|Fuel|Rear O2 comp max|%|1|||Most the rear O2 can add to fuelling
fuel_rear_comp_min|Fuel|Rear O2 comp min|%|1|||Most the rear O2 can remove from fuelling
stft_rear_limit|Fuel|Rear O2 short-term limits|%|1|||Rear O2 short-term trim limits (max / min)
ltft_rear_limit|Fuel|Rear O2 long-term limits|%|1|||Rear O2 long-term trim limits (max / min)
front_o2_limit|Fuel|Front O2 limit|λ|3|||Front O2 sensor reading limit
inj_flow|Fuel|Injector flow|cc/min|2|||Injector flow rate used for fuel pulse width
boost_target_low_comp|Boost|Low speed boost comp|%|1|||Boost target change applied below the speed set next to it
boost_target_low_comp_vss|Boost|Low speed boost comp below|km/h|0|||Vehicle speed below which the low speed boost comp applies
wg_enable_rpm_min|Wastegate|Wastegate Control - Enable, Minimum Engine Speed|rpm|0|||Wastegate control only runs above this RPM
wg_enable_boost_min|Wastegate|Wastegate Control - Enable, Minimum Boost|kPa|1||rel|Wastegate control only runs once target boost is this far above atmospheric
wg_dc_int_deadzone|Wastegate|Wastegate Duty Cycle - Integral Deadzone|kPa|1||rel|Boost error inside this band does not change the integral
wg_dc_int_limit|Wastegate|WG integral limits|%|1|||Lowest / highest the wastegate integral can go
wg_dc_int_wg_min|Wastegate|WG integral min duty|%|1|||Minimum duty before the integral is allowed to act
rev_limit|Limits|Rev limit (cut / resume)|rpm|0|||Fuel cut RPM and the RPM fuel resumes
rev_limit_map|Limits|Rev limit MAP|kPa|1||abs|Manifold pressure tied to the rev limiter
load_max|Limits|Load max|g/rev|2|||Highest load the ECU will calculate
maf_limit|Limits|MAF limit|g/s|1|||Highest airflow the ECU will calculate
speed_limit_on|Limits|Speed Limiter - Fuel Cut Enable|km/h|0|||Speed where the limiter cuts fuel
speed_limit_off|Limits|Speed Limiter - Fuel Cut Disable|km/h|0|||Speed where the limiter releases
map_offset|Sensors|MAP sensor offset|kPa|1|||MAP sensor calibration offset
map_slope|Sensors|MAP sensor slope|kPa/V|1|||MAP sensor calibration slope
map_voltage_limit|Sensors|MAP sensor voltage limits|V|2|||MAP sensor voltage range (high / low) before a fault
dtc_enable|Sensors|DTCs enabled||0|||Diagnostic trouble codes switched on in the tune`.split('\n').map(l=>l.split('|'));
// pressure kind of kPa tables: absolute or relative (boost error)
const P_REL={wg_prop:1,wg_int_pos:1,wg_int_neg:1};
function parseTune(text,name){
  let j; try{ j=JSON.parse(text); }catch(_){ throw 'not a Project Lambda .tune (JSON expected)'; }
  if(!j||!Array.isArray(j.maps)) throw 'no maps[] in tune';
  const M={}; for(const m of j.maps) if(m&&m.id) M[m.id]=m;
  const rows=id=>M[id]&&Array.isArray(M[id].data)?M[id].data.map(r=>String(r).split(',').map(Number)):null;
  const raw=[], byId={};
  for(const [id,cat,group,gname,variant,unit,dp,xi,xin,yi,yin,tag] of TT_SPEC){
    const z=rows(id); if(!z) continue;
    const X=xi==='#'?z[0].map((_,i)=>i+1):(rows(xi)||[])[0], Y=!yi?[0]:yi==='#'?z.map((_,i)=>i+1):(rows(yi)||[])[0]; if(!X||!Y) continue;
    if(z.length!==Y.length||z.some(r=>r.length!==X.length)) continue;
    const t={id,cat,group,gname,name:variant,unit,dp:+dp,lam:unit==='lam',x:X,y:Y,z,xin,yin:yi?yin:'',tag:tag||'',xid:xi,yid:yi,_ids:[id],pk:unit==='kPa'?(P_REL[id]?'rel':'abs'):''}; raw.push(t); byId[id]=t; }
  if(!raw.length) throw 'no known tables in tune';
  const tables=[];
  for(const t of raw){ const sig=JSON.stringify([t.x,t.y,t.z]), d=tables.find(o=>o.group===t.group&&o.tag===t.tag&&o._sig===sig);
    if(d){ d.name+=' = '+t.name; d._ids.push(t.id); } else { t._sig=sig; tables.push(Object.assign({},t)); } }
  const sc0=[]; for(const [id,cat,label,unit,dp,live,pk,tip] of SC_SPEC){ const r=rows(id); if(r) sc0.push({id,cat,label,unit,dp:+dp,live,pk:pk||'',tip:tip||'',v:r}); }
  const m={}; for(const id in M) m[id]=rows(id);
  const ax=rows('maf_scale_index'), sc=rows('maf_scale'), fl=rows('inj_flow');
  const rng=id=>{ const r=rows(id); return r?[Math.min(...r[0]),Math.max(...r[0])]:null; };
  return { name, src:text, car:j['.car_id']||'', cal:j['.cal_id']||'', rom:j['.rom_id']||'', read:String((j['.meta']||{}).Comments||'').replace(/^Read from ECU on\s*/i,''),
    tables, byId, m, cards:sc0, nMaps:Object.keys(M).length, axis:ax?ax[0]:null, mafScale:sc?sc[0]:null, injFlow:fl?fl[0][0]:null,
    ranges:{ rpm:rng('spark_base_rpm_index'), load:rng('spark_base_load_index_d')||rng('spark_base_load_index'), mafv:rng('maf_scale_index'),
             ect:rng('spark_ect_index'), iat:rng('spark_iat_index'), batt:rng('inj_latency_bat_index') } };
}
function applyTuneAxis(){ if(TUNE&&TUNE.axis&&TUNE.axis.length>=2&&TUNE.axis.every((v,i)=>!i||v>TUNE.axis[i-1])){ BP=TUNE.axis.slice(); AXIS_SRC='tune'; } }

// ── auto table picks (per frame) ────────────────────────────────────────────
//  Base timing: residual = Total − KCA − table, learned only in steady state (load step
//  < 0.04, rpm step < 80, ECT ≥ 70, rpm ≥ 1200) where tables differ ≥ 1.5° and the best
//  fits within 2.5°; EMA 0.15, switch on > 1° margin held 10 frames (per poll-equivalent, see stepF).
//  Fuel Normal/Safe: OL frames, FFB vs each table; EMA 0.2, switch on 0.3 AFR × 6.
function computePicks(L){
  const N=L.N, pick=new Array(N).fill(null), fuel=new Array(N).fill('normal'); L.pick=pick; L.fuel=fuel;
  if(!TUNE||!N) return;
  const K=L.c, R=K.rpm, LD=K.load, TT=K.total, KA=K.kca, EC=K.ect, CL=L.st, FF=L.ffb;
  const tim=TUNE.tables.filter(t=>t.group==='timing'); let fn=null, fs=null;
  for(const t of TUNE.tables){ if(t.group==='fuel'&&t.tag==='normal') fn=t; if(t.group==='fuel'&&t.tag==='safe') fs=t; }
  const F=stepF(L), A1=1-Math.pow(0.85,1/F), A2=1-Math.pow(0.8,1/F); const ema={}, fema={}; let cur=null, held=0, cand=null, fcur='normal', fheld=0, fast=0, fcand=null; const LT=TUNE.byId||{}, IM=K.iam, FB=K.fbkc, FL=K.flkc;
  const kAt=(i,ld,rpm,open)=>{ if(KA) return KA[i]; const lt=LT[open?'spark_learned_b':'spark_learned']||LT.spark_learned; return (IM&&lt&&Number.isFinite(IM[i])?IM[i]*tAt(lt,ld,rpm):0)+(FB&&Number.isFinite(FB[i])?FB[i]:0)+(FL&&Number.isFinite(FL[i])?FL[i]:0); };
  for(let i=1;i<N;i++){
    if(R&&LD){ const rpm=R[i], ld=LD[i], j0=Math.max(0,i-F), dl=Math.abs(ld-LD[j0]), dr=Math.abs(rpm-R[j0]);
      let kv=NaN; if(TT&&(KA||IM)&&tim.length>=2&&rpm>=1200&&Number.isFinite(TT[i])&&Number.isFinite(kv=kAt(i,ld,rpm,cur&&LT[cur]&&LT[cur].tag==='open'))&&!(EC&&EC[i]<70)&&dl<0.04&&dr<80){
        let mn=1e9,vmin=1e9,vmax=-1e9; const res={};
        for(const t of tim){ const b=at2(t,ld,rpm); vmin=Math.min(vmin,b); vmax=Math.max(vmax,b); const r=Math.abs(TT[i]-kv-b); res[t.id]=r; mn=Math.min(mn,r); }
        if(vmax-vmin>=1.5&&mn<=2.5){ let best=null;
          for(const t of tim){ const e=ema[t.id]; ema[t.id]=e==null?res[t.id]:e+(res[t.id]-e)*A1; if(best==null||ema[t.id]<ema[best]) best=t.id; }
          let ib=null; for(const t of tim) if(ib==null||res[t.id]<res[ib]) ib=t.id;   // TGV / VVT switches show as a sudden 3°+ jump: follow them within 3 frames
          if(cur!=null&&ib!==cur&&res[cur]-res[ib]>=3&&res[ib]<=1.5){ fast=fcand===ib?fast+1:1; fcand=ib; if(fast>=2*F){ cur=ib; for(const t of tim) ema[t.id]=res[t.id]; fast=0; held=0; cand=null; } } else { fast=0; fcand=null; }
          if(cur==null) cur=best; else if(best!==cur&&ema[best]+1.0<ema[cur]){ held=cand===best?held+1:1; cand=best; if(held>=10*F){ cur=best; held=0; } } else { held=0; cand=null; } } }
      if(fn&&fs&&L.ffbSrc!=='tune'&&CL[i]>=10&&Number.isFinite(FF[i])&&dl<0.06&&dr<150){ const a=at2(fn,ld,rpm), b=at2(fs,ld,rpm);
        if(Math.abs(a-b)>=0.2/LAM){ const ra=Math.abs(FF[i]-a), rb=Math.abs(FF[i]-b);
          fema.normal=fema.normal==null?ra:fema.normal+(ra-fema.normal)*A2; fema.safe=fema.safe==null?rb:fema.safe+(rb-fema.safe)*A2;
          const best=fema.normal<=fema.safe?'normal':'safe'; if(best!==fcur&&fema[best]+0.3/LAM<fema[fcur]){ if(++fheld>=6*F){ fcur=best; fheld=0; } } else fheld=0; } } }
    pick[i]=cur; fuel[i]=fcur; }
  if(N>1) pick[0]=pick[1];
  { let on=0, n=0; for(const p of pick) if(p){ n++; if(/_(b|d)$/.test(p)) on++; } L.vvtOn=n>200?on/n:null; }
}

// ── rebuilds: what the ECU should command, recomputed from the tune ─────────
//  Torque request  = torque_request(pedal, RPM)                         (variant: best fit to log)
//  Throttle target = throttle_target(torque, RPM)                       (variant: best fit to log)
//  Boost target    = boost_target(torque, RPM) × (1+IAT%) × (1+ECT%) × (1+baro%), capped at boost_limit(baro)
//                    baro comp only below its last breakpoint (sea-level logs show no comp at 100 kPa)
//  WG duty         = base × (1+IAT%) × (1+ECT%) × (1+baro%) + P(err) + I, clamped 0..wg_max
//                    err = target − MAP; I integrates int_pos/int_neg (× IAT comp) at WG_RATE/s outside the
//                    deadzone, limited by wg_dc_int_limit; control active above wg_enable_rpm_min with target ≥ baro.
//  Total timing    = base(auto pick) + KCA + ECT comp + IAT comp × activation; the logged KCA already carries
//                    FBKC + FLKC (verified: KCA = FBKC at low load). Without KCA: IAM × knock advance max + FBKC + FLKC.
const WG_RATE=10;
function tAt(t,x,y){ return t?at2(t,x,t.yin?y:0):NaN; }
function vecAt(v,ax,x){ return v&&ax?lerpArr(ax,v,x):0; }
function bestVar(ids,f,logged,N){ const B=TUNE.byId; let best=null, be=Infinity;
  for(const id of ids){ const t=B[id]; if(!t) continue; if(!logged){ return t; } const e=[]; for(let i=0;i<N;i+=3){ const p=f(t,i); if(Number.isFinite(p)&&Number.isFinite(logged[i])) e.push(Math.abs(p-logged[i])); }
    const m=e.length?median(e):Infinity; if(m<be){ be=m; best=t; } }
  return best; }
function rebuildLog(L){ if(!TUNE) return null; const C=L.c, N=L.N, B=TUNE.byId, m=TUNE.m, R=C.rpm, rb={};
  const v1=id=>m[id]?m[id][0]:null, last=a=>a?a[a.length-1]:null;
  if(R&&C.accel){ const t=bestVar(['torque_request','torque_request_b','torque_request_c','torque_request_a2','torque_request_b2','torque_request_c2'],(t,i)=>tAt(t,C.accel[i],R[i]),C.torque,N);
    if(t){ const p=new Float64Array(N); for(let i=0;i<N;i++) p[i]=tAt(t,C.accel[i],R[i]); rb.tq={id:t.id,name:t.name,pred:p,log:C.torque||null}; } }
  const TQ=C.torque||(rb.tq&&rb.tq.pred);
  if(R&&TQ){ const t=bestVar(['throttle_target','throttle_target_b','throttle_target_c'],(t,i)=>tAt(t,TQ[i],R[i]),C.tthr,N);
    if(t){ const p=new Float64Array(N); for(let i=0;i<N;i++) p[i]=tAt(t,TQ[i],R[i]); rb.thr={id:t.id,name:t.name,pred:p,log:C.tthr||null}; } }
  if(R&&TQ&&B.boost_target){ const t=bestVar(['boost_target','boost_target_b'],(t,i)=>tAt(t,TQ[i],R[i]),C.tboost,N);
    const bi=B.boost_target_iat_comp, be=B.boost_target_ect_comp, bb=B.boost_target_baro_comp, bl=B.boost_limit;
    const base=new Float64Array(N), ci=new Float64Array(N), ce=new Float64Array(N), cb=new Float64Array(N), lim=new Float64Array(N).fill(NaN), fin=new Float64Array(N);
    for(let i=0;i<N;i++){ const ba=C.baro&&Number.isFinite(C.baro[i])?C.baro[i]:ATM; base[i]=tAt(t,TQ[i],R[i]);
      ci[i]=bi&&C.iat?tAt(bi,C.iat[i]):0; ce[i]=be&&C.ect?tAt(be,C.ect[i]):0; cb[i]=bb&&ba<=last(bb.x)?tAt(bb,ba):0;
      let f=base[i]*(1+ci[i]/100)*(1+ce[i]/100)*(1+cb[i]/100); if(bl){ lim[i]=tAt(bl,ba); if(f>lim[i]) f=lim[i]; } fin[i]=f; }
    rb.boost={id:t.id,name:t.name,base,ci,ce,cb,lim,fin,log:C.tboost||null,act:C.map||null}; }
  if(R&&TQ&&B.wg_base){ const tb=bestVar(['wg_base','wg_base_b'],(t,i)=>tAt(t,TQ[i],R[i]),null,N), tm=B[tb.id==='wg_base_b'?'wg_max_b':'wg_max']||B.wg_max;
    const wi=B.wg_iat_comp, we=B.wg_ect_comp, wb=B.wg_baro_comp, P=B.wg_prop, Pi=B.wg_prop_iat_comp, Ip=B.wg_int_pos, In=B.wg_int_neg, Ipi=B.wg_int_pos_iat_comp, Ini=B.wg_int_neg_iat_comp;
    const dz=Math.max(...(m.wg_dc_int_deadzone||[[0]]).flat()), il=v1('wg_dc_int_limit')||[-90,15], rpmMin=Math.max(...(m.wg_enable_rpm_min||[[0]]).flat());
    const tgt=C.tboost||(rb.boost&&rb.boost.fin), base=new Float64Array(N), pp=new Float64Array(N), ii=new Float64Array(N), mx=new Float64Array(N), dc=new Float64Array(N).fill(NaN), err=new Float64Array(N).fill(NaN); let I=0;
    for(let i=0;i<N;i++){ const ba=C.baro&&Number.isFinite(C.baro[i])?C.baro[i]:ATM, iat=C.iat?C.iat[i]:NaN, dt=i?(L.t[i]-L.t[i-1])/1000:0;
      let b=tAt(tb,TQ[i],R[i]); if(wi&&Number.isFinite(iat)) b*=1+tAt(wi,iat)/100; if(we&&C.ect) b*=1+tAt(we,C.ect[i])/100; if(wb) b*=1+tAt(wb,ba,R[i])/100;
      base[i]=b; mx[i]=tm?tAt(tm,TQ[i],R[i]):100;
      const on=R[i]>=rpmMin&&tgt&&C.map&&Number.isFinite(tgt[i])&&Number.isFinite(C.map[i])&&tgt[i]>=ba;
      if(!on){ I=0; pp[i]=0; ii[i]=0; dc[i]=Math.max(0,Math.min(mx[i],b)); continue; }
      const e=tgt[i]-C.map[i]; err[i]=e; const ik=Number.isFinite(iat)?1+(e>0?(Ipi?tAt(Ipi,iat):0):(Ini?tAt(Ini,iat):0))/100:1;
      if(Math.abs(e)>dz) I+=(e>0?(Ip?tAt(Ip,e):0):(In?tAt(In,e):0))*ik*WG_RATE*dt; I=Math.max(il[0],Math.min(il[1],I));
      pp[i]=P?tAt(P,e)*(Pi&&Number.isFinite(iat)?1+tAt(Pi,iat)/100:1):0; ii[i]=I; dc[i]=Math.max(0,Math.min(mx[i],b+pp[i]+I)); }
    rb.wg={id:tb.id,base,P:pp,I:ii,max:mx,dc,err,log:C.wgdc||null}; }
  if(R&&C.load&&B.spark_base){ const pk=L.pick, F=B.spark_iat_factor, SI=B.spark_iat, SE=B.spark_ect;
    const base=new Float64Array(N), kca=new Float64Array(N), kn=new Float64Array(N), ce=new Float64Array(N), ci=new Float64Array(N), tot=new Float64Array(N);
    for(let i=0;i<N;i++){ const t=(pk&&pk[i]&&B[pk[i]])||B.spark_base, ld=C.load[i], r=R[i]; base[i]=tAt(t,ld,r);
      const lt=B[t.tag==='open'?'spark_learned_b':'spark_learned']||B.spark_learned;
      kca[i]=C.kca&&Number.isFinite(C.kca[i])?C.kca[i]:(C.iam&&lt?C.iam[i]*tAt(lt,ld,r):0);
      kn[i]=(C.fbkc&&Number.isFinite(C.fbkc[i])?C.fbkc[i]:0)+(C.flkc&&Number.isFinite(C.flkc[i])?C.flkc[i]:0);
      ce[i]=SE&&C.ect?tAt(SE,C.ect[i]):0; ci[i]=SI&&C.iat?tAt(SI,C.iat[i])*(F?tAt(F,r,ld)/100:1):0;
      tot[i]=base[i]+kca[i]+(C.kca?0:kn[i])+ce[i]+ci[i]; }
    rb.tim={base,kca,kn,ce,ci,tot,log:C.total||null,knIn:!!C.kca}; }
  return rb; }
// mismatch events: logged vs rebuilt beyond a threshold for ≥ 3 poll-equivalents (single-poll lag ignored)
function rbEvents(L){ const rb=L.rb, ev=[], T=L.t, N=L.N, F=stepF(L); if(!rb) return ev;
  const scan=(a,b,thr,kind,fmt,gate,minMs)=>{ if(!a||!b) return; let run=0, s=-1, w=0;
    for(let i=0;i<=N;i++){ const d=i<N&&(!gate||gate(i))?a[i]-b[i]:NaN, bad=Number.isFinite(d)&&Math.abs(d)>thr;
      if(bad){ if(!run){ s=i; w=d; } run++; if(Math.abs(d)>Math.abs(w)) w=d; }
      else { if(run>=3*F&&!(minMs&&T[Math.min(i,N-1)]-T[s]<minMs)) ev.push({t:T[s],kind,label:fmt(w)+` · ${((T[Math.min(i,N-1)]-T[s])/1000).toFixed(1)} s`}); run=0; } } };
  const C=L.c, R=C.rpm, ab=v=>Math.abs(v).toFixed(1), TQ=C.torque||(rb.tq&&rb.tq.pred), ba=i=>C.baro&&Number.isFinite(C.baro[i])?C.baro[i]:ATM;
  const st=(a,d)=>i=>a&&i>=F&&i<N-F&&Math.abs(a[i]-a[i-F])<d&&Math.abs(a[i+F]-a[i])<d, stTq=st(TQ,10), stLd=st(C.load,0.04);
  if(rb.boost){ const B=rb.boost; scan(B.log,B.fin,5,'Boost model',w=>`target ${w>0?'+':'−'}${ab(w)} kPa vs rebuilt`,i=>stTq(i)&&Math.max(B.log?B.log[i]:0,B.fin[i])>ba(i));
    if(B.act&&B.log){
      scan(B.log,B.act,10,'Under boost',w=>`${ab(w)} kPa under target`,i=>B.log[i]>ba(i)+15&&B.log[i]-B.act[i]>0);
      scan(B.act,B.log,7,'Over boost',w=>`${ab(w)} kPa over target`,i=>B.act[i]>ba(i)+5&&B.act[i]-B.log[i]>0); } }
  if(rb.wg) scan(rb.wg.log,rb.wg.dc,5,'WG model',w=>`duty ${w>0?'+':'−'}${ab(w)} % vs rebuilt`,stTq);
  if(rb.tim) scan(rb.tim.log,rb.tim.tot,2,'Timing model',w=>`total ${w>0?'+':'−'}${ab(w)}° vs rebuilt`,i=>R&&R[i]>=1500&&C.load&&C.load[i]>=0.35&&stLd(i),1500);
  if(rb.thr) scan(rb.thr.log,rb.thr.pred,8,'Throttle model',w=>`target ${w>0?'+':'−'}${ab(w)} % vs table`,stTq);
  return ev; }
// tune limits → warning limits for this log's columns, in the log's own units
function tuneLimits(L){ const out={}; if(!TUNE||!L) return out; const m=TUNE.m, put=(k,hi)=>{ const j=L.idx[k]; if(j==null||j<0) return; out[L.fam[j]]={lo:[null,null,null],hi}; };
  const h=k=>L.idx[k]>=0?String(L.headers[L.idx[k]]):'';
  if(m.rev_limit) put('rpm',[null,m.rev_limit[0][1]??null,m.rev_limit[0][0]]);
  if(m.load_max) put('load',[null,null,m.load_max[0][0]]);
  if(m.maf_limit) put('maf',[null,null,m.maf_limit[0][0]]);
  if(m.speed_limit_on){ const k=/mph/i.test(h('vss'))?1/1.609344:1; put('vss',[null,m.speed_limit_off?round(m.speed_limit_off[0][0]*k,1):null,round(m.speed_limit_on[0][0]*k,1)]); }
  const bl=TUNE.byId.boost_limit; if(bl){ const ba=L.c.baro?median(Array.from(L.c.baro).filter(Number.isFinite)):ATM, kpa=tAt(bl,ba??ATM);
    for(const k of ['map','mapr']){ const hh=h(k); if(!hh) continue; let v=kpa; if(k==='mapr'||/relative|gauge/i.test(hh)) v-=ba??ATM; if(/psi/i.test(hh)) v/=PSI; put(k,[null,null,round(v,2)]); } }
  return out; }

// ── knock summary (per log, all frames) ─────────────────────────────────────
function knockSummary(L){
  const out={}, N=L.N;
  for(const [k,key] of [['fbkc','FBKC'],['flkc','FLKC'],['kca','KCA']]){ const a=L.c[k]; if(!a) continue;
    let worst=0, cnt=0, runs=0, iso=0, sus=0, longest=0, adv=0; const act=[];
    for(let i=0;i<N;i++){ const v=a[i]; if(!Number.isFinite(v)) continue; if(v>adv) adv=v; if(v<0){ cnt++; act.push(v); if(v<worst) worst=v; } }
    for(let i=0;i<N;){ if(a[i]<0){ let j=i; while(j+1<N&&a[j+1]<0) j++; let tI=i; for(let q=i;q<=j;q++) if(a[q]<a[tI]) tI=q; const len=tI-i+1; runs++; if(len===1) iso++; else sus++; longest=Math.max(longest,len); i=j+1; } else i++; }
    out[k]={label:key,worst:round(worst,2),cnt,med:act.length?round(median(act),2):null,runs,iso,sus,longest,adv:k==='kca'&&adv>0?round(adv,2):null}; }
  if(L.c.iam){ const v=Array.from(L.c.iam).filter(Number.isFinite); if(v.length){ const s=v[0], mn=Math.min(...v), mx=Math.max(...v);
    out.iam={min:round(mn,2),status:s>=0.999?(mn<0.999?'Mid-log drop':'Sustained'):s<=0.6?(mx>=0.999?'Recovered mid-drive':mx>s+0.001?'Partially recovered':'ECU Reset'):(mn<s-0.001?'Mid-log drop':'Sustained')}; } }
  return out;
}
// Knock colour ramp (plasma): [0,−0.5] dark; clamps at −8°.
const KNOCK_STOPS=['#6a00a8','#8f0da4','#b12a90','#cc4778','#e16462','#f2844b','#fca636','#fcce25','#f0f921'];
function lerpHex(a,b,t){ const p=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)), A=p(a), B=p(b); return '#'+A.map((c,i)=>Math.round(c+(B[i]-c)*t).toString(16).padStart(2,'0')).join(''); }
function knockRamp(v){ if(v==null||!(v<-0.5)) return KNOCK_STOPS[0]; const t=Math.min(1,(v+0.5)/(-8+0.5)), x=t*(KNOCK_STOPS.length-1), i=Math.min(KNOCK_STOPS.length-2,Math.floor(x)); return lerpHex(KNOCK_STOPS[i],KNOCK_STOPS[i+1],x-i); }

// ── events (per log) ────────────────────────────────────────────────────────
function logEvents(L){ L.rb=rebuildLog(L);
  const N=L.N, T=L.t, K=L.c, FB=K.fbkc, FL=K.flkc, CL=L.st, MV=K.mafv, LD=K.load, R=K.rpm, an=L.an, km=[], kt=[], ev=[];
  for(let i=1;i<N;i++){
    if(FB&&FB[i]<FB[i-1]-0.01&&R&&LD&&Number.isFinite(R[i])&&Number.isFinite(LD[i])) km.push({i,t:T[i],rpm:R[i],load:LD[i]});
    if((FB&&FB[i]<-0.005&&!(FB[i-1]<-0.005))||(FL&&FL[i]<-0.005&&!(FL[i-1]<-0.005))) kt.push(T[i]);
    if(FB&&FB[i]<-0.005&&!(FB[i-1]<-0.005)){ let w=FB[i]; for(let j=i;j<N&&FB[j]<-0.005;j++) w=Math.min(w,FB[j]); ev.push({t:T[i],kind:'Knock',label:`FBKC ${w.toFixed(2)}°`+(R?` @ ${Math.round(R[i])} rpm`:'')}); }
    if(MV&&CL[i]>=10&&!(CL[i-1]>=10)&&!(an&&an.cutF[i])){ let mx=-Infinity,j=i; for(;j<N&&CL[j]>=10;j++) if(MV[j]>mx) mx=MV[j];
      ev.push({t:T[i],kind:mx>2.5?'WOT pull':'Open loop',label:`${((T[Math.min(j,N-1)]-T[i])/1000).toFixed(1)} s · peak ${mx.toFixed(2)} V`}); }
    if(an&&an.lean[i]&&!an.lean[i-1]) ev.push({t:T[i],kind:'Lean outlier',label:`λ ${L.wb[i].toFixed(3)} vs target ${L.ffb[i].toFixed(3)}`}); }
  if(LD){ let bi=-1; for(let i=0;i<N;i++) if(Number.isFinite(LD[i])&&(bi<0||LD[i]>LD[bi])) bi=i; if(bi>=0) ev.push({t:T[bi],kind:'Max load',label:`${LD[bi].toFixed(2)} g/rev`+(R?` @ ${Math.round(R[bi])} rpm`:'')}); }
  for(const e of rbEvents(L)) ev.push(e);
  L.pulls=findPulls(L); for(const p of L.pulls) ev.push({t:p.t,t1:p.t1,kind:'Pull',label:p.label});
  for(const e of fuelEvents(L)) ev.push(e);
  diagEvents(L,ev);
  L.kmarks=km; L.kticks=kt; L.events=ev.sort((a,b)=>a.t-b.t);
}

// ── warning limits: {family:{lo:[approach,warn,crit], hi:[…]}}; blank = off ───
let LIMITS={};
function warnTier(fam,v){ const l=LIMITS[fam]; if(!l||!Number.isFinite(v)) return 0; let t=0;
  if(l.hi) l.hi.forEach((x,k)=>{ if(Number.isFinite(x)&&v>=x) t=Math.max(t,k+1); });
  if(l.lo) l.lo.forEach((x,k)=>{ if(Number.isFinite(x)&&v<=x) t=Math.max(t,k+1); });
  return t; }
function warnCrossings(L){ const out=[];
  for(const fam in LIMITS){ const j=L.fam.findIndex((f,x)=>f===fam&&x!==L.wbj); if(j<0) continue; const a=logCol(L,j); let prev=0;
    for(let i=0;i<L.N;i++){ const t=warnTier(fam,a[i]); if(t>=2&&t>prev) out.push({t:L.t[i],kind:'Warning',label:`${fam} ${a[i]}`,tier:t}); prev=t; } }
  return out; }

// ── WOT pulls: throttle ≥ pullThr for ≥ pullDur s, sweeping ≥ pullSpan rpm ──
function findPulls(L){ const C=L.c, T=L.t, N=L.N, P=C.thr||C.accel, R=C.rpm, out=[]; if(!P||!R) return out; let s=-1;
  for(let i=0;i<=N;i++){ const on=i<N&&P[i]>=CFG.pullThr&&Number.isFinite(R[i]);
    if(on&&s<0) s=i; else if(!on&&s>=0){ const e=i-1; let hi=-Infinity; for(let j=s;j<=e;j++) if(R[j]>hi) hi=R[j];
      if(T[e]-T[s]>=CFG.pullDur*1000&&hi-R[s]>=CFG.pullSpan) out.push({i0:s,i1:e,t:T[s],t1:T[e],r0:Math.round(R[s]/50)*50,r1:Math.round(hi/50)*50}); s=-1; } }
  out.forEach((p,k)=>{ const V=C.vss, gs=[]; if(V) for(let j=p.i0;j<=p.i1;j++){ const g=gearAt(R[j],V[j]); if(g) gs.push(g); } p.gear=gs.length?Math.round(median(gs)):null;
    p.label=`Pull ${k+1}: ${p.gear?ORD(p.gear)+' gear ':''}${p.r0.toLocaleString()}–${p.r1.toLocaleString()} rpm · ${((p.t1-p.t)/1000).toFixed(1)} s`; }); return out; }
// ── fuel saturation: IDC (logged, else IPW × RPM / 1200) and rail pressure drop in pulls ──
function idcOf(L){ if(L.idcA!==undefined) return L.idcA; const C=L.c; let a=null;
  if(C.idc) a=C.idc; else if(C.ipw&&C.rpm){ a=new Float64Array(L.N); for(let i=0;i<L.N;i++) a[i]=C.ipw[i]*C.rpm[i]/1200; } return L.idcA=a; }
function fuelEvents(L){ const ev=[], T=L.t, N=L.N, a=idcOf(L), R=L.c.rpm;
  if(a){ let s=-1, pk=0; for(let i=0;i<=N;i++){ const v=i<N?a[i]:NaN; if(v>=CFG.idcWarn){ if(s<0){ s=i; pk=v; } else if(v>pk) pk=v; }
      else if(s>=0){ ev.push({t:T[s],kind:'Fuel',sev:pk>=CFG.idcCrit?'crit':'warn',label:`IDC ${pk.toFixed(1)} %`+(R?` @ ${Math.round(R[s])} rpm`:'')+(L.c.idc?'':' (calc)')}); s=-1; } } }
  const F=L.c.fp; if(F&&L.pulls) for(const p of L.pulls){ const b=median(Array.from(F.slice(p.i0,Math.min(p.i1+1,p.i0+5))).filter(Number.isFinite)); if(!(b>0)) continue;
    let mi=-1; for(let i=p.i0;i<=p.i1;i++) if(Number.isFinite(F[i])&&(mi<0||F[i]<F[mi])) mi=i; if(mi<0) continue; const d=(b-F[mi])/b*100;
    if(d>=CFG.fpDrop) ev.push({t:T[mi],kind:'Fuel',sev:'crit',label:`Fuel pressure −${d.toFixed(0)} %`+(R?` @ ${Math.round(R[mi])} rpm`:'')}); }
  return ev; }
// ════════ vehicle profile + diagnostics ════════
let PROF=null;
const ORD=n=>n+(n===1?'st':n===2?'nd':n===3?'rd':'th');
function tireCirc(s){ const m=/(\d{3})\s*\/\s*(\d{2})\s*Z?R\s*(\d{2})/i.exec(String(s||'')); return m?Math.PI*((+m[3])*25.4+2*(+m[1])*(+m[2])/100)/1000:null; }
function gearAt(rpm,kmh){ const P=PROF; if(!P||!(kmh>8)||!(rpm>0)) return null; const g=String(P.gears||'').split(/[\s,]+/).map(Number).filter(x=>x>0), fd=+P.fd, c=tireCirc(P.tire);
  if(!g.length||!(fd>0)||!c) return null; const r=rpm*c/((kmh/3.6)*60*fd); let b=0; g.forEach((x,k)=>{ if(Math.abs(x-r)<Math.abs(g[b]-r)) b=k; }); return Math.abs(g[b]-r)/g[b]<0.12?b+1:null; }
// shared tip-in / tip-out detector (throttle plate, else pedal)
function tipsOf(L){ if(L.tips) return L.tips; const C=L.c, P=C.thr||C.accel, T=L.t, o={in:[],out:[]}; if(!P) return L.tips=o; let last=-1e9;
  for(let i=1;i<L.N;i++){ const dt=(T[i]-T[i-1])/1000; if(!(dt>0)) continue; const r=(P[i]-P[i-1])/dt; if(Math.abs(r)>=CFG.tipRate&&T[i]-last>500){ (r>0?o.in:o.out).push({t:T[i-1],i:i-1,rate:r}); last=T[i]; } }
  return L.tips=o; }
function dThr(L){ if(L.dthrA!==undefined) return L.dthrA; const P=L.c.thr||L.c.accel; if(!P) return L.dthrA=null; const a=new Float64Array(L.N).fill(NaN);
  for(let i=1;i<L.N;i++){ const dt=(L.t[i]-L.t[i-1])/1000; if(dt>0) a[i]=(P[i]-P[i-1])/dt; } return L.dthrA=a; }
const wbLag=()=>PROF&&+PROF.wbLag||0;
function afrErr(L){ if(L.aerr!==undefined) return L.aerr; if(!L.c.wb||!L.ffbSrc) return L.aerr=null; const a=new Float64Array(L.N), lag=wbLag();
  for(let i=0;i<L.N;i++){ const j=lag?Math.round(fi(L.t,L.t[i]+lag)):i; a[i]=(L.wb[j]-L.ffb[i])*LAM; } return L.aerr=a; }
function avcsTgt(L,ak){ const key='_'+ak+'t'; if(L[key]!==undefined) return L[key]; const C=L.c; if(C[ak+'t']) return L[key]=C[ak+'t'];
  const B=TUNE&&TUNE.byId; if(!B||!C.load||!C.rpm) return L[key]=null; const nm=ak==='avcsi'?'vvt_intake':'vvt_exhaust', ta=B[nm+'_a'], tb=B[nm+'_b']; if(!ta&&!tb) return L[key]=null;
  const a=new Float64Array(L.N); for(let i=0;i<L.N;i++){ const p=L.pick&&L.pick[i]&&B[L.pick[i]], t=(p&&p.tag==='open'?tb:ta)||ta||tb; a[i]=tAt(t,C.load[i],C.rpm[i]); } return L[key]=a; }
function diagEvents(L,ev){
  L.tips=null; L.dthrA=undefined; L.aerr=undefined; L._avcsit=undefined; L._avcset=undefined;
  const C=L.c, T=L.t, N=L.N, R=C.rpm, LD=C.load, P=C.thr||C.accel, lag=wbLag(), W=i=>L.wb[lag?Math.round(fi(T,T[i]+lag)):i], cut=i=>L.an&&L.an.cutF[i];
  const tips=tipsOf(L), allT=tips.in.concat(tips.out).map(x=>x.t), near=(t,a,b)=>allT.some(x=>x>=t-a&&x<=t+b);
  const push=(i,kind,sev,label)=>ev.push({t:T[i],kind,sev,label});
  const run=(test,minMs,fn)=>{ let s=-1; for(let i=0;i<=N;i++){ const on=i<N&&test(i); if(on&&s<0) s=i; else if(!on&&s>=0){ if(T[i-1]-T[s]>=minMs) fn(s,i-1); s=-1; } } };
  const osc=(err,thr,gate,i0,kind,sev,label)=>{ const fl=[]; let sg=0; for(let j=0;j<N;j++){ const d=err(j); if(!gate(j)||!Number.isFinite(d)||Math.abs(d)<thr) continue; const g=Math.sign(d); if(sg&&g!==sg) fl.push(j); sg=g; }
    for(let k=0;k+3<fl.length;k++) if(T[fl[k+3]]-T[fl[k]]<=2000){ push(fl[k],kind,sev,label); const te=T[fl[k]]+5000; while(k+1<fl.length&&T[fl[k+1]]<te) k++; } };
  const tg=C.tboost||(L.rb&&L.rb.boost&&L.rb.boost.fin), M=C.map, WG=C.wgdc, ba=i=>C.baro&&Number.isFinite(C.baro[i])?C.baro[i]:ATM, ps=v=>(v*0.1450377).toFixed(1);
  // knock: transient vs sustained, repeats across pulls, low-load / WOT FLKC, IAM drops
  const pulls=L.pulls||[], zones={};
  for(const e of ev){ if(e.kind!=='Knock') continue; const i=Math.round(fi(T,e.t));
    if(near(e.t,CFG.knockWin*1000,100)){ e.sev='info'; e.label+=' · transient (tip-in/out)'; continue; }
    e.sev='warn'; e.label+=' · sustained'; const p=pulls.find(q=>i>=q.i0&&i<=q.i1);
    if(p&&R&&LD){ e._z=Math.round(R[i]/500)+'|'+Math.round(LD[i]*5); (zones[e._z]=zones[e._z]||new Set()).add(p); }
    if(C.ksum){ const F=stepF(L), k0=C.ksum[Math.max(0,i-3*F)]; let k1=k0; for(let j=i;j<Math.min(N,i+5*F);j++) if(C.ksum[j]>k1) k1=C.ksum[j]; if(k1>k0) e.label+=` · knock sum +${k1-k0}`; } }
  for(const e of ev) if(e._z&&zones[e._z].size>=2) e.label+=' · repeats across pulls';
  for(const [k,lab] of [['fbkc','FBKC'],['flkc','FLKC']]){ const A=C[k]; if(!A||!LD) continue;
    run(i=>A[i]<=-4.2&&LD[i]<CFG.lowLoad&&(!P||P[i]<30),0,(s0,e0)=>{ let w=0; for(let j=s0;j<=e0;j++) w=Math.min(w,A[j]); push(s0,'Knock','crit',`${lab} ${w.toFixed(2)}° at low load`); }); }
  if(C.flkc&&P) run(i=>C.flkc[i]<=-2.8&&P[i]>=CFG.pullThr,0,(s0,e0)=>{ let w=0; for(let j=s0;j<=e0;j++) w=Math.min(w,C.flkc[j]); push(s0,'Knock','crit',`FLKC ${w.toFixed(2)}° at WOT`); });
  if(C.iam) for(let i=1;i<N;i++) if(C.iam[i]<C.iam[i-1]-1e-3) push(i,'IAM','crit',`IAM drop ${C.iam[i-1].toFixed(2)} → ${C.iam[i].toFixed(2)}`);
  // boost / WGDC health
  if(tg&&M){ const be=CFG.bErr/0.1450377;
    if(WG) run(i=>tg[i]>ba(i)&&tg[i]-M[i]>be&&WG[i]>=90,CFG.bDur*1000,(s0,e0)=>{ let w=0; for(let j=s0;j<=e0;j++) w=Math.max(w,tg[j]-M[j]); push(s0,'Boost','warn',`Can't reach target: −${ps(w)} psi at WGDC ≥ 90 % · leak (intake or exhaust), weak solenoid or turbo limit`); });
    if(WG&&R) run(i=>WG[i]>=90&&R[i]>=5500,1000,s0=>push(s0,'Boost','warn','WGDC ≥ 90 % above 5,500 rpm · overspin risk'));
    osc(j=>M[j]-tg[j],3.4,j=>tg[j]>ba(j)+7,0,'Boost','info','Boost oscillating around target · check solenoid'); }
  // tip-in / tip-out AFR response (wideband shifted by the profile lag)
  if(C.wb&&P) for(const [lst,dir] of [[tips.in,1],[tips.out,-1]]) for(const tp of lst){ const i0=tp.i, pre=[];
    for(let j=i0;j>=0&&T[i0]-T[j]<=300;j--){ const w=W(j); if(Number.isFinite(w)) pre.push(w); } const b=median(pre); if(b==null) continue;
    let ln=0,li=-1,rc=0; for(let j=i0;j<N&&T[j]-T[i0]<=2000;j++){ if(cut(j)) continue; const w=W(j); if(!Number.isFinite(w)) continue; const d=(w-b)*LAM; if(d>ln){ ln=d; li=j; } if(-d>rc) rc=-d; }
    const rt=` · ${Math.round(Math.abs(tp.rate))} %/s`+(R?` @ ${Math.round(R[i0])} rpm`:'');
    if(ln>=CFG.tipAfr){ const late=T[li]-T[i0]>1000; push(i0,'Tip-in',late||dir<0?'info':'warn',`${late?'Late lean spike (not tip-in, check elsewhere)':dir>0?'Tip-in lean':'Tip-out lean'} +${ln.toFixed(1)} AFR${rt}`); }
    if(rc>=CFG.tipAfr) push(i0,'Tip-in','info',`${dir>0?'Tip-in':'Tip-out'} rich dip −${rc.toFixed(1)} AFR${rt}`); }
  // AVCS tracking
  for(const [ak,nm] of [['avcsi','intake'],['avcse','exhaust']]){ const A=C[ak], Tg=avcsTgt(L,ak); if(!A||!Tg) continue; const er=i=>Tg[i]-A[i], live=i=>!R||R[i]>800;
    run(i=>live(i)&&Math.abs(er(i))>CFG.avcsErr,500,(s0,e0)=>{ let w=0; for(let j=s0;j<=e0;j++) if(Math.abs(er(j))>Math.abs(w)) w=er(j);
      push(s0,'AVCS','warn',`AVCS ${nm} ${T[e0]-T[s0]>2000?'offset':'slow response'}: ${w>0?'behind':'past'} target ${Math.abs(w).toFixed(1)}°`); });
    osc(er,1.5,live,0,'AVCS','info',`AVCS ${nm} hunting around target`);
    if(C.ect&&R){ const idx=[]; for(let i=0;i<N;i++) if(R[i]>1500&&Number.isFinite(er(i))&&Number.isFinite(C.ect[i])) idx.push(i);
      if(idx.length>60){ const n3=Math.floor(idx.length/3), m=a=>a.reduce((s1,i)=>s1+Math.abs(er(i)),0)/a.length, A1=idx.slice(0,n3), A3=idx.slice(-n3);
        if(C.ect[A3[A3.length-1]]-C.ect[A1[0]]>=15&&m(A3)-m(A1)>=1.5) push(A3[0],'AVCS','crit',`AVCS ${nm} error grows as the engine warms (${m(A1).toFixed(1)}° → ${m(A3).toFixed(1)}°) · oil pressure or filter screen`); } } }
  if(C.avcsd) run(i=>C.avcsd[i]>50,1000,s0=>push(s0,'AVCS','warn',`AVCS solenoid duty > 50 % holding target · restriction or internal leak`));
  // CL/OL transitions
  const S=L.st; if(S){ const isCL=v=>v===CFG.clVal, isOL=v=>v>=CFG.olVal, tog=[];
    for(let i=1;i<N;i++){ const up=isCL(S[i-1])&&isOL(S[i]), dn=isOL(S[i-1])&&isCL(S[i]); if(!up&&!dn) continue; tog.push(i); if(cut(i)||!C.wb) continue;
      let ln=0,rc=0; for(let j=i;j<N&&T[j]-T[i]<=CFG.clolWin;j++){ if(T[j]-T[i]<200||cut(j)) continue; const w=W(j), f=L.ffb[j]; if(!Number.isFinite(w)||!Number.isFinite(f)) continue; const d=(w-f)*LAM; if(d>ln) ln=d; if(-d>rc) rc=-d; }
      const bst=M&&M[i]>ba(i), tag=up?'CL→OL':'OL→CL';
      if(ln>=CFG.tipAfr) push(i,'CL/OL',bst?'crit':'warn',`${tag} lean spike +${ln.toFixed(1)} AFR${bst?' under boost':''}`); else if(rc>=CFG.tipAfr) push(i,'CL/OL','info',`${tag} rich bog −${rc.toFixed(1)} AFR`); }
    for(let k=0;k+2<tog.length;k++) if(T[tog[k+2]]-T[tog[k]]<=2000){ push(tog[k],'CL/OL','info','CL/OL dithering · causes bucking'); const te=T[tog[k]]+5000; while(k+1<tog.length&&T[tog[k+1]]<te) k++; }
    if(M&&C.afc) run(i=>isCL(S[i])&&M[i]>ba(i)&&C.afc[i]>=8,500,(s0,e0)=>{ let w=0; for(let j=s0;j<=e0;j++) w=Math.max(w,C.afc[j]); push(s0,'CL/OL','warn',`Still closed loop under boost, AFC +${w.toFixed(1)} % · CL→OL delay too long or OL table lean`); });
    if(LD&&P) run(i=>isOL(S[i])&&LD[i]<0.6&&P[i]>2&&P[i]<20&&!cut(i),1000,s0=>push(s0,'CL/OL','info','Open loop at cruise · check lean comp tables')); }
}
if(typeof module!=='undefined') module.exports={buildLog,prepLog,finishLog,logCap,rebuildLog,rbEvents,tuneLimits,analyzeLog,computeBins,finalizeBins,seamGap,scaleRow,ipwCheck,parseTune,applyTuneAxis,computePicks,knockSummary,logEvents,
  get CFG(){return CFG}, get BP(){return BP}, setTune(t){TUNE=t}, get TUNE(){return TUNE}};
