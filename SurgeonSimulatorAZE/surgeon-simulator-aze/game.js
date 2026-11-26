/* Surgeon Simulator AZE — browser surgical trauma simulator (HTML5 Canvas) */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const fx = document.getElementById('fxCanvas');
const fctx = fx.getContext('2d');
let width, height, cx, cy;
function resize(){
  const stage = document.getElementById('stage');
  width = canvas.width = stage.clientWidth;
  height = canvas.height = stage.clientHeight;
  fx.width = width; fx.height = height;
  cx = width / 2; cy = height / 2;
}
window.addEventListener('resize', resize);
resize();
const TOOLS = [
  {id:'hand', name:'Hand', cat:'hand', glyph:'\u261E', color:'#9aa3ad', key:'1'},
  {id:'scalpel', name:'Scalpel', cat:'surgery', glyph:'\u2702', color:'#e74c3c', key:'2'},
  {id:'forceps', name:'Forceps', cat:'surgery', glyph:'\u2696', color:'#2ecc71', key:'3'},
  {id:'suction', name:'Suction', cat:'surgery', glyph:'\u233A', color:'#3498db', key:'4'},
  {id:'bandage', name:'Bandage', cat:'medicine', glyph:'\u2610', color:'#e74c3c', key:'5'},
  {id:'tourniquet', name:'Tourniquet', cat:'medicine', glyph:'\u25A0', color:'#c0392b', key:'6'},
  {id:'sutures', name:'Sutures', cat:'surgery', glyph:'\u2713', color:'#9b59b6', key:'7'},
  {id:'clamps', name:'Clamps', cat:'surgery', glyph:'\u22EE', color:'#f39c12', key:'8'},
  {id:'saw', name:'Bone Saw', cat:'surgery', glyph:'\u2329', color:'#7f8c8d', key:'9'},
  {id:'syringe', name:'Syringe', cat:'medicine', glyph:'\u2694', color:'#2ecc71', key:'0'},
  {id:'defib', name:'Defib', cat:'medicine', glyph:'\u26A1', color:'#f39c12', key:'-'},
];
const CATS = [{id:'hand', label:'HAND'},{id:'surgery', label:'SURGERY'},{id:'medicine', label:'MEDICINE'}];
const WOUND_TYPES = {
  laceration:   {name:'Laceration', bleed: 2.0,  color:'#b22222', steps:['bandage'],        complex:['scalpel','clamps','sutures']},
  puncture:     {name:'Puncture Wound', bleed: 3.0, color:'#8b0000', steps:['bandage'],      complex:['scalpel','clamps','sutures']},
  fracture:     {name:'Compound Fracture', bleed: 0.5, color:'#d2b48c', steps:['saw'],       complex:['scalpel','clamps','saw','sutures']},
  organ:        {name:'Organ Damage', bleed: 1.5, color:'#27ae60', steps:['scalpel'],       complex:['scalpel','clamps','sutures']},
  internal:     {name:'Internal Bleeding', bleed: 4.0, color:'#8e44ad', steps:['scalpel'],   complex:['scalpel','clamps','sutures']},
  arrest:       {name:'Cardiac Arrest', bleed: 0, color:'#f39c12', steps:['defib','hand'],  complex:['defib','hand']},
};
const BODY = [
  {id:'head', name:'Head', x:-0.18, y:-0.42, r:26},
  {id:'chest', name:'Chest', x:0, y:-0.05, r:52},
  {id:'abdomen', name:'Abdomen', x:0, y:0.42, r:46},
  {id:'lArm', name:'Left Arm', x:-0.78, y:-0.05, r:20},
  {id:'rArm', name:'Right Arm', x:0.78, y:-0.05, r:20},
  {id:'lLeg', name:'Left Leg', x:-0.34, y:1.02, r:22},
  {id:'rLeg', name:'Right Leg', x:0.34, y:1.02, r:22},
];
let state = 'MENU', mode = 'simple', anim = 0;
let camera = {x:0, y:0, zoom:1};
let drag = {active:false, sx:0, sy:0, cx:0, cy:0};
let mouse = {x:0, y:0, wx:0, wy:0, down:false};
let touchId = null;
let selectedTool = null, selectedCat = 'hand', hoveredTool = null, xray = false;
let patient = null, wounds = [], toolsUsed = {};
let startTime = 0, time = 0, score = 0, messages = [], flash = 0;
const VITALS = {hr:80, bpSys:120, bpDia:80, o2:98, blood:100, conscious:true};
const $ = (id)=>document.getElementById(id);
const startScreen = $('startScreen'), hud = $('hud'), endScreen = $('endScreen');
const pauseOverlay = $('pauseOverlay'), statusEl = $('status');
const chartEl = $('chart'), toolbarEl = $('toolbar'), ecgEl = $('ecg');
const xrayBadge = $('xrayBadge');
function setScreen(name){
  const show = (el, cond)=>{
    if(cond){ el.classList.remove('hidden'); el.classList.add('active'); }
    else { el.classList.add('hidden'); el.classList.remove('active'); }
  };
  show(startScreen, name==='MENU');
  show(hud, name==='PLAYING');
  show(endScreen, name==='WON' || name==='LOST');
  show(pauseOverlay, name==='PAUSED');
}
function canvasToWorld(px, py){ return { x: (px - cx - camera.x)/camera.zoom + cx, y: (py - cy - camera.y)/camera.zoom + cy }; }
function clampCamera(){ const p=200; camera.x = Math.max(-p,Math.min(p,camera.x)); camera.y = Math.max(-p,Math.min(p,camera.y)); }
function resetCamera(){ camera.x=0; camera.y=0; camera.zoom=1; }
function cycleView(){}
function togglePause(){ if(state==='PLAYING'){ state='PAUSED'; setScreen('PAUSED'); } else if(state==='PAUSED'){ state='PLAYING'; setScreen('PLAYING'); } }
function selectToolById(id){
  selectedTool = TOOLS.find(t=>t.id===id);
  updateToolbar();
  if(selectedTool) status('Selected: ' + selectedTool.name);
}
function selectToolByKey(k){ const t = TOOLS.find(t=>t.key===k); if(t) selectToolById(t.id); }
function status(msg){ statusEl.textContent = msg; }
function addMsg(msg, color='#e8eaed'){ messages.push({text:msg, color, life:1.6}); }
function woundAt(wx, wy, r){
  for(let i=wounds.length-1;i>=0;i--){
    const w = wounds[i];
    const dx = w.x - wx, dy = w.y - wy;
    if(dx*dx + dy*dy <= r*r) return w;
  }
  return null;
}
function selectWound(w){ addMsg('Target: ' + w.type.name); }

// ---- toolbar
function renderCatBtn(cat){
  const b = document.createElement('button');
  b.className = 'cat-btn' + (cat===selectedCat?' active':'');
  b.textContent = cat;
  b.onclick = ()=>{ selectedCat = cat; updateToolbar(); };
  return b;
}
function renderTool(tool){
  const b = document.createElement('button');
  b.className = 'tool-btn' + (selectedTool && selectedTool.id===tool.id?' active':'') + (toolsUsed[tool.id]?' used':'');
  b.title = tool.name + ' (' + tool.key + ')';
  const k = document.createElement('span'); k.className='kbd'; k.textContent = tool.key;
  const g = document.createElement('span'); g.textContent = tool.glyph;
  const n = document.createElement('span'); n.textContent = tool.name;
  b.append(k,g,n);
  b.onclick = ()=>selectToolById(tool.id);
  b.onmouseenter = ()=>{ hoveredTool = tool; };
  b.onmouseleave = ()=>{ hoveredTool = null; };
  return b;
}
function updateToolbar(){
  toolbarEl.innerHTML = '';
  const cats = document.createElement('div'); cats.className='cat-row';
  CATS.forEach(c=>cats.appendChild(renderCatBtn(c.id)));
  toolbarEl.appendChild(cats);
  const row = document.createElement('div'); row.className='tool-row';
  TOOLS.filter(t=>t.cat===selectedCat || selectedCat==='hand').forEach(t=>row.appendChild(renderTool(t)));
  toolbarEl.appendChild(row);
  // hand tool always shown in hand category
  if(selectedCat==='hand'){
    const row2 = document.createElement('div'); row2.className='tool-row';
    TOOLS.filter(t=>t.id==='hand').forEach(t=>row2.appendChild(renderTool(t)));
    toolbarEl.appendChild(row2);
  }
}

// ------------------------------------------------------------------ level / patient
const WOUND_POS = [
  {x:-0.35,y:-0.28},{x:0.35,y:-0.28},{x:-0.55,y:0.05},{x:0.55,y:0.05},
  {x:-0.3,y:0.5},{x:0.3,y:0.5},{x:-0.7,y:-0.05},{x:0.7,y:-0.05},
  {x:-0.35,y:0.95},{x:0.35,y:0.95},{x:0,y:-0.5},{x:0,y:0.75},
];
function newPatient(){
  VITALS.hr=80; VITALS.bpSys=120; VITALS.bpDia=80; VITALS.o2=98; VITALS.blood=100; VITALS.conscious=true;
  wounds = []; toolsUsed = {}; time = 0; score = 0; messages = [];
  const rng = ()=>Math.random();
  const nWounds = mode==='simple'? 3 + Math.floor(rng()*3) : 4 + Math.floor(rng()*3);
  const keys = Object.keys(WOUND_TYPES);
  const used = new Set();
  for(let i=0;i<nWounds;i++){
    let t = keys[Math.floor(rng()*keys.length)];
    if(used.has(t) && rng()<0.5) continue;
    used.add(t);
    const pos = WOUND_POS[Math.floor(rng()*WOUND_POS.length)];
    const sev = ['minor','serious','critical'][Math.floor(rng()*3)];
    wounds.push({
      id: Date.now()+i, type: WOUND_TYPES[t], key: t, pos, sev,
      x: pos.x*140 + cx, y: pos.y*140 + cy,
      progress: 0, treated: false, bleedTimer: 0,
    });
  }
  // guarantee at least one bleed and often an arrest-ish challenge
  startTime = performance.now();
  renderUI();
  status('Case started. Select a tool.');
}
function canUse(tool, wound){
  if(mode==='simple'){
    const ok = (tool.id==='bandage' || tool.id==='tourniquet') && wound.type.bleed>0;
    const ok2 = (tool.id==='defib') && wound.key==='arrest';
    const ok3 = (tool.id==='hand') && wound.key==='arrest';
    const ok4 = (tool.id==='saw') && wound.type.name==='Compound Fracture';
    return ok || ok2 || ok3 || ok4 || (tool.id==='syringe');
  }
  // complex: must follow the step sequence
  const steps = wound.type.complex;
  const next = steps[Math.floor(wound.progress * steps.length)];
  return tool.id === next || tool.id==='syringe' || tool.id==='defib';
}
function applyTool(tool, wound){
  if(wound.treated) return;
  let advanced = false;
  if(mode==='simple'){
    const good = canUse(tool, wound);
    if(good || tool.id==='syringe'){
      wound.progress += 0.34;
      advanced = true;
      toolsUsed[tool.id] = (toolsUsed[tool.id]||0)+1;
      if(wound.progress>=1){ treatWound(wound); }
    }
  } else {
    if(canUse(tool, wound)){
      wound.progress += 0.25;
      advanced = true;
      toolsUsed[tool.id] = (toolsUsed[tool.id]||0)+1;
      if(wound.progress>=1){ treatWound(wound); }
    }
  }
  if(advanced){
    addMsg(tool.name + ' applied to ' + wound.type.name);
    if(tool.id==='defib') addMsg('Defibrillator charged!');
    if(tool.id==='hand' && wound.key==='arrest') addMsg('Chest compressions!');
    if(tool.id==='syringe') addMsg('Stimulant injected.');
  }
}
function treatWound(w){
  w.treated = true;
  addMsg(w.type.name + ' treated.', '#45d686');
  renderUI();
  checkWin();
}
function useToolAt(wx, wy){
  const w = woundAt(wx, wy, 45);
  if(!w){
    addMsg('No wound there.', '#9aa3ad');
    return;
  }
  if(!selectedTool){ status('Select a tool first.'); return; }
  applyTool(selectedTool, w);
}
function syringeBoost(){
  VITALS.blood = Math.min(100, VITALS.blood + 15);
  VITALS.o2 = Math.min(100, VITALS.o2 + 8);
  VITALS.hr = Math.min(110, VITALS.hr + 12);
  addMsg('Vitals stabilized.');
}
function checkWin(){
  if(wounds.every(w=>w.treated) && VITALS.blood>25 && VITALS.hr>40){
    endGame('WON');
  }
}

// ------------------------------------------------------------------ vitals simulation
let last = performance.now();
function simVitals(dt){
  // bleeding reduces blood
  let bleed = 0;
  for(const w of activeBleedWounds()){
    bleed += w.type.bleed * (w.sev==='critical'?1.6 : w.sev==='serious'?1.2 : 1);
  }
  VITALS.blood -= bleed * dt * 0.5;
  if(VITALS.blood<0) VITALS.blood = 0;

  // cardiac arrest accelerates death
  const arrest = wounds.find(w=>w.key==='arrest' && !w.treated);
  if(arrest){
    VITALS.hr -= 22 * dt;
    if(VITALS.hr<0) VITALS.hr = 0;
  }

  // blood pressure follows blood volume & hr
  const bloodPct = VITALS.blood/100;
  VITALS.bpSys = 110 * bloodPct + 10 * (VITALS.hr/80);
  VITALS.bpDia = 70 * bloodPct + 5 * (VITALS.hr/80);
  if(VITALS.bpSys<40) VITALS.bpSys = 40;
  if(VITALS.bpDia<20) VITALS.bpDia = 20;

  // oxygen drops with blood loss / low hr
  const o2Target = 98 * bloodPct * Math.min(1, VITALS.hr/60);
  VITALS.o2 += (o2Target - VITALS.o2) * dt * 1.5;
  if(VITALS.o2<10) VITALS.o2 = 10;
  if(VITALS.o2>100) VITALS.o2 = 100;

  // heart rate: compensatory tachycardia under blood loss, then crash
  let hrTarget = 80;
  if(VITALS.blood<60) hrTarget = 110 + (60 - VITALS.blood);
  if(VITALS.blood<30) hrTarget = 30; // decompensating -> bradycardia
  if(arrest) hrTarget = 0;
  VITALS.hr += (hrTarget - VITALS.hr) * dt * 1.2;
  if(VITALS.hr<0) VITALS.hr = 0;

  VITALS.conscious = VITALS.blood>20 && VITALS.o2>25 && VITALS.hr>25;

  // death conditions
  if(VITALS.blood<=0 || VITALS.hr<=5 || VITALS.o2<=5){
    endGame('LOST');
  }
}
function renderUI(){
  $('vHR').textContent = Math.round(VITALS.hr);
  $('vBP').textContent = Math.round(VITALS.bpSys);
  $('vBP').textContent += '\u2009/\u2009' + Math.round(VITALS.bpDia);
  $('vO2').textContent = Math.round(VITALS.o2);
  $('vBlood').textContent = Math.round(VITALS.blood);
  // color coding
  const setCol = (el, val, good, warn)=>{
    el.style.color = val<good? 'var(--danger)' : (val<warn? 'var(--warn)' : '');
  };
  setCol($('vHR'), VITALS.hr, 45, 100);
  setCol($('vBlood'), VITALS.blood, 35, 60);
  setCol($('vO2'), VITALS.o2, 70, 88);
  const treated = wounds.filter(w=>w.treated).length;
  const crit = wounds.filter(w=>!w.treated && w.sev==='critical').length;
  chartEl.innerHTML = '<div class="chart-title">PATIENT CHART</div>';
  wounds.forEach(w=>{
    const div = document.createElement('div');
    div.className = 'wound-item' + (w.treated?' treated':'');
    const left = document.createElement('div');
    left.innerHTML = '<div class="name">' + w.type.name + '</div><div class="type">' + w.pos.name + ' \u2022 ' + w.sev + '</div>';
    const right = document.createElement('div'); right.style.display='flex'; right.style.flexDirection='column'; right.style.alignItems='flex-end'; right.style.gap='4px';
    const sev = document.createElement('div'); sev.className='sev' + (w.sev==='critical'?' critical':'');
    sev.textContent = w.sev.toUpperCase();
    const prog = document.createElement('div'); prog.className='progress';
    const fill = document.createElement('div'); fill.className='fill'; fill.style.width = Math.round(w.progress*100) + '%';
    prog.appendChild(fill);
    right.appendChild(sev); right.appendChild(prog);
    div.appendChild(left); div.appendChild(right);
    chartEl.appendChild(div);
  });
  if(wounds.every(w=>w.treated)){
    const done = document.createElement('div');
    done.className='wound-item treated'; done.style.justifyContent='center';
    done.innerHTML = '<div class="name" style="color:var(--success)">All wounds treated</div>';
    chartEl.appendChild(done);
  }
}

function endGame(res){
  state = res;
  setScreen(res);
  const treated = wounds.filter(w=>w.treated).length;
  const t = Math.max(0, Math.round((performance.now()-startTime)/1000));
  let bonus = treated * 100;
  if(res==='WON') bonus += Math.round(VITALS.blood) * 2 + Math.round(VITALS.hr/10);
  score = Math.round(bonus + (res==='WON'? 500 : 0) - t*2);
  if(score<0) score = 0;
  const icon = $('endIcon'), title = $('endTitle'), msg = $('endMsg');
  if(res==='WON'){
    icon.className='end-icon win'; icon.textContent='\u2713';
    title.textContent = 'Patient Stabilized';
    msg.textContent = 'All wounds treated. Vitals holding. Excellent work, surgeon.';
  } else {
    icon.className='end-icon lose'; icon.textContent='\u2717';
    title.textContent = 'Patient Lost';
    msg.textContent = 'Vitals flatlined. The patient could not be saved.';
  }
  $('sScore').textContent = score;
  $('sTreated').textContent = treated + ' / ' + wounds.length;
  $('sTime').textContent = t + 's';
}
function showStart(){
  mode = $('mode-simple')? 'simple' : 'complex';
  setScreen('MENU');
}
// wire mode radios
document.querySelectorAll('input[name="mode"]').forEach(r=>{
  r.onchange = ()=>{ mode = r.value; };
});
// ------------------------------------------------------------------ rendering
function drawBodyPart(bp, sx, sy, r){
  ctx.save();
  ctx.translate(cx + bp.x*sx + camera.x, cy + bp.y*sy + camera.y);
  ctx.scale(camera.zoom, camera.zoom);
  // skin
  ctx.fillStyle = '#e8dcc8';
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#c9b9a3'; ctx.lineWidth=2; ctx.stroke();
  // x-ray bone hint
  if(xray){
    ctx.strokeStyle = '#e8f4f2'; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.6,-r*0.6); ctx.lineTo(r*0.6,r*0.6); ctx.stroke();
  }
  ctx.restore();
}
function drawWound(w){
  const treated = w.treated;
  ctx.save();
  ctx.translate(cx + w.pos.x*140 + camera.x, cy + w.pos.y*140 + camera.y);
  ctx.scale(camera.zoom, camera.zoom);
  // bleeding drops
  if(!treated && w.type.bleed>0 && (anim*10)%2<1){
    ctx.fillStyle = w.type.color;
    for(let d=0; d<3; d++){
      const dd = (anim*30 + d*40)%60;
      ctx.beginPath(); ctx.arc(0, -12-dd, 2+Math.sin(dd)*1, 0, Math.PI*2); ctx.fill();
    }
  }
  // wound mark
  ctx.beginPath(); ctx.arc(0,0, treated? 6 : 10, 0, Math.PI*2);
  ctx.fillStyle = treated ? '#2ecc71' : (w.type.color);
  ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = treated? 1 : 2; ctx.stroke();
  if(!treated){
    ctx.strokeStyle = 'rgba(178,34,34,0.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0, 12+Math.sin(anim*8)*2, 0, Math.PI*2); ctx.stroke();
  }
  if(xray){
    ctx.strokeStyle = '#e8f4f2'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(0,0, 14, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }
  // label
  ctx.fillStyle = '#e8eaed'; ctx.font = '10px "Share Tech Mono",monospace'; ctx.textAlign='center';
  ctx.fillText(w.sev.toUpperCase(), 0, -16);
  ctx.restore();
}
function drawPatient(){
  const sx = 1, sy = 1;
  // table
  ctx.save();
  ctx.translate(cx+camera.x, cy+150+camera.y); ctx.scale(camera.zoom,camera.zoom);
  ctx.fillStyle='#1a1e24'; ctx.fillRect(-170, -10, 340, 22);
  ctx.strokeStyle='#333'; ctx.lineWidth=2; ctx.strokeRect(-170,-10,340,22);
  ctx.restore();
  // organs (xray hint)
  if(xray){
    ctx.save(); ctx.translate(cx+camera.x, cy+camera.y); ctx.scale(camera.zoom,camera.zoom);
    ctx.fillStyle='rgba(232,244,242,0.15)';
    ctx.beginPath(); ctx.arc(-18,-40,22,0,Math.PI*2); ctx.fill(); // heart
    ctx.beginPath(); ctx.arc(18,-40,20,0,Math.PI*2); ctx.fill(); // lung
    ctx.beginPath(); ctx.arc(-16,40,24,0,Math.PI*2); ctx.fill(); // liver
    ctx.beginPath(); ctx.arc(16,40,20,0,Math.PI*2); ctx.fill(); // stomach
    ctx.restore();
  }
  BODY.forEach(bp=>drawBodyPart(bp, sx, sy, bp.r));
  wounds.forEach(drawWound);
  // tool cursor
  if(selectedTool){
    ctx.save();
    ctx.translate(mouse.x, mouse.y); ctx.scale(camera.zoom,camera.zoom);
    ctx.fillStyle = selectedTool.color;
    ctx.font = '22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(selectedTool.glyph, 0, 0);
    ctx.strokeStyle = '#fff'; ctx.lineWidth=2; ctx.strokeText(selectedTool.glyph, 0, 0);
    ctx.restore();
  }
  // mouse crosshair when no tool
  if(!selectedTool){
    ctx.strokeStyle='rgba(154,163,173,0.4)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(mouse.x-8,mouse.y); ctx.lineTo(mouse.x+8,mouse.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mouse.x,mouse.y-8); ctx.lineTo(mouse.x,mouse.y+8); ctx.stroke();
  }
}
function drawECG(){
  // draw scrolling ECG into a small offscreen then blit to html? We render ECG via CSS-div pulses instead.
  // keep ecgEl updated with a flashing beat line
  const beat = Math.sin(anim*5)>0.85;
  ecgEl.style.background = `linear-gradient(90deg, ${beat?'#0e7c7b':'transparent'} 2px, transparent 2px)`;
}
function drawFX(){
  fctx.clearRect(0,0,width,height);
  if(flash>0){
    fctx.fillStyle = 'rgba(231,76,60,' + flash + ')';
    fctx.fillRect(0,0,width,height);
    flash *= 0.85;
  }
}
function draw(){
  ctx.fillStyle='#0a0c10'; ctx.fillRect(0,0,width,height);
  // grid floor
  ctx.strokeStyle='rgba(14,124,123,0.07)'; ctx.lineWidth=1;
  const gs=60, z=camera.zoom;
  for(let x=-cx/z; x<cx/z; x+=gs){
    const px = cx + x*z + camera.x;
    ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,height); ctx.stroke();
  }
  for(let y=-cy/z; y<cy/z; y+=gs){
    const py = cy + y*z + camera.y;
    ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(width,py); ctx.stroke();
  }
  drawPatient();
  drawECG();
  drawFX();
  anim += 0.016;
}
function loop(now){
  if(state==='PLAYING'){
    const dt = Math.min(0.05, (now-last)/1000); last = now;
    time += dt;
    simVitals(dt);
    renderUI();
    draw();
    requestAnimationFrame(loop);
  } else if(state==='PAUSED'){
    last = now;
    draw();
    requestAnimationFrame(loop);
  } else {
    draw();
    requestAnimationFrame(loop);
  }
}
requestAnimationFrame(loop);

// ------------------------------------------------------------------ startup wiring
$('startBtn').onclick = ()=>{
  const simple = document.querySelector('input[name="mode"][value="simple"]');
  mode = simple.checked ? 'simple' : 'complex';
  resize();
  newPatient();
  state = 'PLAYING';
  last = performance.now();
  setScreen('PLAYING');
  renderCatBtnsInit();
  updateToolbar();
  selectToolById('bandage');
  requestAnimationFrame(loop);
};
function renderCatBtnsInit(){ updateToolbar(); }
$('backBtn').onclick = ()=>{ if(confirm('Leave this case? Progress will be lost.')){ state='MENU'; setScreen('MENU'); } };
$('retryBtn').onclick = ()=>{ newPatient(); state='PLAYING'; last=performance.now(); setScreen('PLAYING'); selectToolById('bandage'); requestAnimationFrame(loop); };
$('portalBtn').onclick = ()=>{ state='MENU'; setScreen('MENU'); location.href = '../index.html'; };

// ------------------------------------------------------------------ input (mouse / touch / keyboard)
function getMousePos(e){
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(r.width,1);
  const sy = canvas.height / Math.max(r.height,1);
  return { x: (e.clientX - r.left)*sx, y: (e.clientY - r.top)*sy };
}
canvas.addEventListener('mousemove', e=>{
  const p = getMousePos(e);
  mouse.x = p.x; mouse.y = p.y;
  const w = canvasToWorld(mouse.x, mouse.y);
  mouse.wx = w.x; mouse.wy = w.y;
  if(drag.active){
    camera.x = drag.cx + (drag.sx - mouse.x)/camera.zoom;
    camera.y = drag.cy + (drag.sy - mouse.y)/camera.zoom;
    clampCamera();
  }
});
canvas.addEventListener('mousedown', e=>{
  const p = getMousePos(e);
  mouse.x = p.x; mouse.y = p.y;
  const w = canvasToWorld(mouse.x, mouse.y);
  mouse.wx = w.x; mouse.wy = w.y;
  drag.active = true; drag.sx = mouse.x; drag.sy = mouse.y;
  drag.cx = camera.x; drag.cy = camera.y;
  mouse.down = true;
});
window.addEventListener('mouseup', ()=>{ drag.active = false; mouse.down = false; });
canvas.addEventListener('mouseleave', ()=>{ drag.active = false; mouse.down = false; });
canvas.addEventListener('click', e=>{
  if(drag.active){ drag.active = false; return; }
  if(state!=='PLAYING') return;
  const w = canvasToWorld(mouse.x, mouse.y);
  useToolAt(w.x, w.y);
});
canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const before = canvasToWorld(mouse.x, mouse.y);
  camera.zoom = Math.min(3, Math.max(0.4, camera.zoom - e.deltaY*0.001));
  const after = canvasToWorld(mouse.x, mouse.y);
  camera.x += (before.x - after.x);
  camera.y += (before.y - after.y);
  clampCamera();
}, {passive:false});

canvas.addEventListener('touchstart', e=>{
  e.preventDefault();
  const t = e.touches[0];
  const p = getMousePos(t);
  mouse.x = p.x; mouse.y = p.y;
  const w = canvasToWorld(mouse.x, mouse.y);
  mouse.wx = w.x; mouse.wy = w.y;
  touchId = t.identifier;
  drag.active = true; drag.sx = mouse.x; drag.sy = mouse.y;
  drag.cx = camera.x; drag.cy = camera.y;
}, {passive:false});
canvas.addEventListener('touchmove', e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    if(t.identifier!==touchId) continue;
    const p = getMousePos(t);
    mouse.x = p.x; mouse.y = p.y;
    const w = canvasToWorld(mouse.x, mouse.y);
    mouse.wx = w.x; mouse.wy = w.y;
    if(drag.active){
      camera.x = drag.cx + (drag.sx - mouse.x)/camera.zoom;
      camera.y = drag.cy + (drag.sy - mouse.y)/camera.zoom;
      clampCamera();
    }
  }
}, {passive:false});
canvas.addEventListener('touchend', e=>{
  for(const t of e.changedTouches){
    if(t.identifier!==touchId) continue;
    if(drag.active){ drag.active = false; touchId = null; return; }
    if(state!=='PLAYING'){ touchId = null; return; }
    const w = canvasToWorld(mouse.x, mouse.y);
    useToolAt(w.x, w.y);
    touchId = null;
  }
}, {passive:false});

window.addEventListener('keydown', e=>{
  if(e.code==='Space'){ e.preventDefault(); togglePause(); return; }
  if(e.code==='KeyX'){ xray = !xray; xrayBadge.style.display = xray?'block':'none'; addMsg(xray?'X-ray on':'X-ray off'); return; }
  if(e.code==='Tab'){ e.preventDefault(); selectedCat = selectedCat==='hand'?'surgery': selectedCat==='surgery'?'medicine':'hand'; updateToolbar(); return; }
  const t = TOOLS.find(t=>t.key && e.key===t.key);
  if(t){ selectToolById(t.id); return; }
});

function activeBleedWounds(){ return wounds.filter(w=>!w.treated && w.type.bleed>0); }

