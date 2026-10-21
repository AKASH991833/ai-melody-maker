/* ai-melody-maker UI + WebAudio playback + WAV export */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let melody=null,seed=Math.floor(Math.random()*99999)+1,playing=false,playTimer=null,actx=null;
const LS='aimm-saves-v1';
function opts(){return{seed:+$('seed').value||1,key:$('key').value,scaleKey:$('scale').value,bars:+$('bars').value,density:+$('density').value/100}}
function gen(){
  seed=+$('seed').value||1;
  melody=MelodyEngine.generate(opts());
  drawRoll();updateInfo();
  pkToast('New melody generated');
}
function updateInfo(){
  const n=melody.notes.length;
  const lo=Math.min(...melody.notes.map(x=>x.midi)),hi=Math.max(...melody.notes.map(x=>x.midi));
  $('mel-info').innerHTML=`<span class="pill ok">${n} notes</span> <span class="pill warn">${melody.bars} bars</span> <span class="hint">${MelodyEngine.SCALES[melody.scaleKey].name} in ${melody.key} · range ${noteName(lo)}–${noteName(hi)}</span>`;
}
function noteName(m){const n=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];return n[m%12]+(Math.floor(m/12)-1)}
function drawRoll(highlightStep){
  const cv=$('roll');const ctx=cv.getContext('2d');
  const W=cv.width=cv.clientWidth*2,H=cv.height=380;
  const dark=document.documentElement.dataset.theme==='dark';
  ctx.clearRect(0,0,W,H);
  const total=melody.bars*8;
  const midis=melody.notes.map(n=>n.midi);
  const lo=Math.min(...midis,55)-1,hi=Math.max(...midis,77)+1;
  const cw=W/total,ch=H/(hi-lo+1);
  // grid
  ctx.strokeStyle=dark?'#1e2c49':'#e9eef6';ctx.lineWidth=1;
  for(let s=0;s<=total;s++){ctx.beginPath();ctx.moveTo(s*cw,0);ctx.lineTo(s*cw,H);ctx.stroke()}
  for(let m=lo;m<=hi;m++){const y=H-(m-lo+1)*ch;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  // bar lines heavier
  ctx.strokeStyle=dark?'#2a3c60':'#c9d5e8';
  for(let b=0;b<=melody.bars;b++){ctx.beginPath();ctx.moveTo(b*8*cw,0);ctx.lineTo(b*8*cw,H);ctx.lineWidth=b%4===0?3:1.6;ctx.stroke()}
  ctx.lineWidth=1;
  // pad chord tint per bar
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#4f46e5';
  // notes
  melody.notes.forEach(n=>{
    const x=n.start*cw+1.5,w=n.len*cw-3,y=H-(n.midi-lo+1)*ch+1.5;
    ctx.fillStyle=accent;ctx.globalAlpha=0.55+n.vel*0.4;
    roundRect(ctx,x,y,w,ch-3,5);ctx.fill();ctx.globalAlpha=1;
  });
  // playhead
  if(highlightStep!=null){ctx.fillStyle=dark?'rgba(255,255,255,.18)':'rgba(12,35,64,.10)';ctx.fillRect(highlightStep*cw,0,cw,H)}
  // note names on left
  ctx.fillStyle=dark?'#8ea2c4':'#5d6f8e';ctx.font='17px JetBrains Mono, monospace';
  for(let m=lo;m<=hi;m++){if(m%12===0||m%12===7){ctx.fillText(noteName(m),4,H-(m-lo)*ch-5)}}
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
// ---- audio ----
function ensureCtx(){if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();return actx}
function scheduleNote(ctx,dest,freq,t,dur,wave,vel,isPad){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type=wave;o.frequency.value=freq;
  const peak=(isPad?0.05:0.22)*vel;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.linearRampToValueAtTime(peak,t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur*(isPad?1.02:0.92));
  o.connect(g).connect(dest);o.start(t);o.stop(t+dur+0.05);
}
function scheduleAll(ctx,dest,wave,padWave){
  const tempo=+$('tempo').value;const spb=60/tempo/2; // 8th note seconds
  const t0=ctx.currentTime+0.06;
  melody.notes.forEach(n=>scheduleNote(ctx,dest,MelodyEngine.mtof(n.midi),t0+n.start*spb,n.len*spb,wave,n.vel,false));
  if($('pad-on').checked)melody.pad.forEach(p=>p.notes.forEach(m=>scheduleNote(ctx,dest,MelodyEngine.mtof(m),t0+p.bar*8*spb,8*spb,padWave,0.8,true)));
  return {t0,spb,total:melody.bars*8*spb};
}
function play(){
  if(!melody)return;
  if(playing){stop();return}
  const ctx=ensureCtx();ctx.resume();
  const {t0,spb,total}=scheduleAll(ctx,ctx.destination,$('wave').value,'triangle');
  playing=true;$('play').innerHTML=svgStop()+' Stop';
  const start=performance.now();
  playTimer=setInterval(()=>{
    const el=(performance.now()-start)/1000;
    const step=Math.floor(el/spb);
    if(el>total+0.3){stop();return}
    drawRoll(Math.min(step,melody.bars*8-1));
  },60);
}
function stop(){
  playing=false;clearInterval(playTimer);
  if(actx)actx.close(),actx=null;
  $('play').innerHTML=svgPlay()+' Play';
  if(melody)drawRoll();
}
const svgPlay=()=>'<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M8 5v14l11-7z"/></svg>';
const svgStop=()=>'<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
// ---- WAV export ----
async function exportWav(){
  if(!melody){pkToast('Generate a melody first');return}
  const tempo=+$('tempo').value;const spb=60/tempo/2;const total=melody.bars*8*spb;
  const sr=44100;const ctx=new OfflineAudioContext(2,Math.ceil((total+0.8)*sr),sr);
  const t0=0.06;
  melody.notes.forEach(n=>scheduleNote(ctx,ctx.destination,MelodyEngine.mtof(n.midi),t0+n.start*spb,n.len*spb,$('wave').value,n.vel,false));
  if($('pad-on').checked)melody.pad.forEach(p=>p.notes.forEach(m=>scheduleNote(ctx,ctx.destination,MelodyEngine.mtof(m),t0+p.bar*8*spb,8*spb,'triangle',0.8,true)));
  const buf=await ctx.startRendering();
  const blob=wavBlob(buf);
  pkDownload(`melody-${melody.key}-${melody.scaleKey}-seed${melody.seed}.wav`,blob,'audio/wav');
  pkToast('WAV downloaded');
}
function wavBlob(buf){
  const ch=buf.numberOfChannels,sr=buf.sampleRate,len=buf.length;
  // interleave to 16-bit PCM
  const out=new DataView(new ArrayBuffer(44+len*ch*2));
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)out.setUint8(o+i,s.charCodeAt(i))};
  ws(0,'RIFF');out.setUint32(4,36+len*ch*2,true);ws(8,'WAVE');ws(12,'fmt ');
  out.setUint32(16,16,true);out.setUint16(20,1,true);out.setUint16(22,ch,true);
  out.setUint32(24,sr,true);out.setUint32(28,sr*ch*2,true);out.setUint16(32,ch*2,true);out.setUint16(34,16,true);
  ws(36,'data');out.setUint32(40,len*ch*2,true);
  let o=44;
  const chans=[];for(let c=0;c<ch;c++)chans.push(buf.getChannelData(c));
  for(let i=0;i<len;i++)for(let c=0;c<ch;c++){let v=Math.max(-1,Math.min(1,chans[c][i]));out.setInt16(o,v<0?v*0x8000:v*0x7FFF,true);o+=2}
  return new Blob([out.buffer],{type:'audio/wav'});
}
// ---- save/load ----
function saves(){try{return JSON.parse(localStorage.getItem(LS)||'[]')}catch(e){return[]}}
function saveMelody(){
  if(!melody)return;
  const name=($('save-name').value||'').trim()||('Melody '+(saves().length+1));
  const list=saves();list.unshift({name,opts:opts(),ts:Date.now()});localStorage.setItem(LS,JSON.stringify(list.slice(0,20)));
  $('save-name').value='';renderSaves();pkToast('Saved "'+name+'"');
}
function renderSaves(){
  const list=saves();
  $('save-list').innerHTML=list.map((s,i)=>`<div class="save-row"><button class="save-load" data-i="${i}"><strong>${s.name.replace(/</g,'&lt;')}</strong><span class="hint">${s.opts.key} ${MelodyEngine.SCALES[s.opts.scaleKey].name} · ${s.opts.bars} bars · seed ${s.opts.seed}</span></button><button class="fb-btn save-del" data-i="${i}" title="Delete">✕</button></div>`).join('')||'<p class="hint">No saved melodies yet.</p>';
  document.querySelectorAll('.save-load').forEach(b=>b.onclick=()=>{
    const s=saves()[+b.dataset.i];if(!s)return;
    $('seed').value=s.opts.seed;$('key').value=s.opts.key;$('scale').value=s.opts.scaleKey;$('bars').value=s.opts.bars;$('density').value=Math.round(s.opts.density*100);
    gen();
  });
  document.querySelectorAll('.save-del').forEach(b=>b.onclick=()=>{const l=saves();l.splice(+b.dataset.i,1);localStorage.setItem(LS,JSON.stringify(l));renderSaves()});
}
document.addEventListener('DOMContentLoaded',()=>{
  $('key').innerHTML=MelodyEngine.KEYS.map(k=>`<option>${k}</option>`).join('');
  $('scale').innerHTML=Object.entries(MelodyEngine.SCALES).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');
  $('seed').value=seed;
  $('generate').onclick=gen;
  $('randomize').onclick=()=>{$('seed').value=Math.floor(Math.random()*99999)+1;gen()};
  $('play').onclick=play;
  $('export').onclick=exportWav;
  $('save-btn').onclick=saveMelody;
  $('tempo').oninput=()=>{$('tempo-val').textContent=$('tempo').value+' BPM'};
  $('density').oninput=()=>{$('density-val').textContent=$('density').value+'%'};
  window.addEventListener('resize',()=>{if(melody)drawRoll()});
  new MutationObserver(()=>{if(melody&&!playing)drawRoll()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  renderSaves();gen();
});
})();
