// Surgeon Simulator AZE - landing page preview canvas animation
// Self-contained, no external assets. Draws a stylized operating table + vitals monitor.
(function(){
  const canvas = document.getElementById('prevCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height, t = 0;

  function resize(){ width = canvas.parentElement.clientWidth; height = 460; canvas.width = width; canvas.height = height; }
  window.addEventListener('resize', resize);
  resize();

  const AC = '#0e7c7b';      // accent teal
  const MON = '#0fffd5';     // monitor cyan
  const DARK = '#0a0c10';

  // Beating heart line points
  function ecg(x, phase){
    let y = 0;
    const p = phase % 1;
    if (p < 0.06) y = Math.sin((p/0.06)*Math.PI) * -40;
    else if (p < 0.10) y = 40;
    else if (p < 0.14) y = -20;
    else y = 0;
    return y;
  }

  // Draw a simple torso + organ placeholder
  function drawBody(cx, cy, scale){
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(scale, scale);
    // table
    ctx.fillStyle = '#1a1e24';
    ctx.fillRect(-70, 40, 140, 14);
    // body outline
    ctx.fillStyle = '#e3d7c8';
    ctx.beginPath();
    ctx.moveTo(-42,-40); ctx.lineTo(-34,20); ctx.lineTo(-26,44);
    ctx.lineTo(26,44); ctx.lineTo(34,20); ctx.lineTo(42,-40);
    ctx.quadraticCurveTo(38,-34, 0,-56);
    ctx.quadraticCurveTo(-38,-34, -42,-40);
    ctx.fill();
    ctx.strokeStyle = '#c9b9a3'; ctx.lineWidth=2; ctx.stroke();
    // chest cavity hint
    ctx.strokeStyle = 'rgba(14,124,123,0.35)'; ctx.lineWidth=2; ctx.beginPath();
    ctx.moveTo(-22,-8); ctx.lineTo(-22,28); ctx.lineTo(22,28); ctx.lineTo(22,-8);
    ctx.stroke();
    // heart (pulses)
    const beat = 1 + Math.sin(t*4.5)*0.12;
    ctx.fillStyle = '#b22222';
    ctx.beginPath(); ctx.moveTo(0,2); ctx.bezierCurveTo(-6,-6,-14,2,-14,10);
    ctx.bezierCurveTo(-14,18,0,22,6,16); ctx.bezierCurveTo(12,22,14,18,14,10);
    ctx.bezierCurveTo(14,2,6,-6,0,2); ctx.fill();
    // rib hints
    ctx.strokeStyle = 'rgba(200,185,160,0.35)'; ctx.lineWidth=1.5;
    for(let r of [-16,0,16]){ ctx.beginPath(); ctx.ellipse(r,12,14,6,0,0,Math.PI); ctx.stroke(); }
    ctx.restore();
  }

  function drawMonitor(x, y, w, h){
    ctx.save();
    ctx.translate(x,y);
    // bezel
    ctx.fillStyle='#14181f'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=AC; ctx.lineWidth=3; ctx.strokeRect(1,1,w-2,h-2);
    // screen
    ctx.fillStyle='#050a06'; ctx.fillRect(8,8,w-16,h-16);
    // grid
    ctx.strokeStyle='rgba(14,124,123,0.12)'; ctx.lineWidth=1;
    for(let gy=8; gy<h-8; gy+=24){ ctx.beginPath(); ctx.moveTo(8,gy); ctx.lineTo(w-8,gy); ctx.stroke(); }
    // ecg wave scrolling
    ctx.strokeStyle=MON; ctx.lineWidth=2; ctx.beginPath();
    const len = 200; const amp=26; const base = h/2 + 6;
    for(let i=0;i<=len;i++){
      const wx = 12 + (i/len)*(w-24);
      const phase = (t*1.6 + (i/len)*3.2) % 1;
      const wy = base + ecg(wx/40, phase)* (amp/40);
      if(i===0) ctx.moveTo(wx,wy); else ctx.lineTo(wx,wy);
    }
    ctx.stroke();
    // labels
    ctx.fillStyle='#0e7c7b'; ctx.font='11px "Share Tech Mono",monospace';
    ctx.fillText('HR  '+Math.floor(70+20*Math.sin(t)), 14, h-20);
    ctx.fillText('BP  120/80', 110, h-20);
    ctx.fillText('SpO2 98%', 200, h-20);
    ctx.fillStyle=MON;
    ctx.fillText('SURGEON SIMULATOR AZE', 14, 24);
    ctx.restore();
  }

  function draw(){
    ctx.fillStyle=DARK; ctx.fillRect(0,0,width,height);
    // subtle grid
    ctx.strokeStyle='rgba(14,124,123,0.06)'; ctx.lineWidth=1;
    const gs=40;
    for(let x=0;x<width;x+=gs){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
    for(let y=0;y<height;y+=gs){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }

    drawBody(width*0.42, height*0.5, 1.15);
    drawMonitor(width*0.62, height*0.22, width*0.34, height*0.42);

    // title overlay text
    ctx.fillStyle='#fff'; ctx.font='bold 22px Rajdhani,sans-serif';
    ctx.textAlign='center'; ctx.fillText('SURGEON SIMULATOR AZE', width/2, height*0.86);
    ctx.fillStyle=AC; ctx.font='14px "Share Tech Mono",monospace';
    ctx.fillText('click a tool &bull; treat the patient &bull; save a life', width/2, height*0.91);
    t += 0.016;
    requestAnimationFrame(draw);
  }
  draw();
})();
