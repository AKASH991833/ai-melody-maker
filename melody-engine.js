/* ai-melody-maker — procedural melody generator. Seeded random-walk over scales with
   phrase structure, chord pads (I-V-vi-IV), editable piano roll, WAV export.
   HONEST: rule-based procedural generation, not a neural net. */
(function(){
'use strict';
const SCALES={
  major:{name:'Major',steps:[0,2,4,5,7,9,11]},
  minor:{name:'Natural minor',steps:[0,2,3,5,7,8,10]},
  penta:{name:'Pentatonic major',steps:[0,2,4,7,9]},
  pentaMin:{name:'Pentatonic minor',steps:[0,3,5,7,10]},
  blues:{name:'Blues',steps:[0,3,5,6,7,10]},
  dorian:{name:'Dorian',steps:[0,2,3,5,7,9,10]}
};
const KEYS=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const CHORDS=[[0,4,7],[5,9,12],[7,11,14],[9,12,16]]; // I, IV, V, vi (semitone offsets from root, 3rds stacked)
const PROG=[[0,1,2,1],[0,1,2,3],[0,3,1,2],[0,2,3,1]]; // progressions over [I,IV,V,vi] indices? use I-V-vi-IV order
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function midiOf(keyIdx,degree,octave,scale){
  const steps=scale.steps;const len=steps.length;
  const oct=octave+Math.floor(degree/len);
  const st=steps[((degree%len)+len)%len];
  return 12*(oct+1)+keyIdx+st;
}
const mtof=m=>440*Math.pow(2,(m-69)/12);
function generate(opts){
  const {seed=1,key='C',scaleKey='major',bars=8,density=0.6}=opts;
  const rnd=mulberry32(seed);
  const scale=SCALES[scaleKey]||SCALES.major;
  const keyIdx=KEYS.indexOf(key);
  const stepsPerBar=8; // 8th notes
  const total=bars*stepsPerBar;
  const notes=[];let degree=7;let i=0;
  const chordProg=PROG[Math.floor(rnd()*PROG.length)];
  while(i<total){
    const bar=Math.floor(i/stepsPerBar);
    const phrasePos=i%(stepsPerBar*2);
    // rest probability shaped by phrase: fewer rests at bar starts
    let pRest=1-density;
    if(i%stepsPerBar===0)pRest*=0.4;
    if(phrasePos===stepsPerBar*2-2)pRest*=0.3; // lead into phrase end
    const roll=rnd();
    let len=1;
    const r2=rnd();
    if(r2<0.55)len=1;else if(r2<0.8)len=2;else if(r2<0.93)len=3;else len=4;
    if(roll<pRest){i+=1;continue}
    // random walk with chord-tone bias
    const chord=CHORDS[chordProg[bar%4]%CHORDS.length];
    const dir=rnd()<0.5?-1:1;
    let step=(rnd()<0.7)?dir*(rnd()<0.8?1:2):dir*3;
    // bias to chord tones on strong beats
    if(i%2===0&&rnd()<0.55){
      const ct=chord.map(s=>Math.round(s/2));
      step=ct[Math.floor(rnd()*ct.length)]-degree;
      if(step===0)step=dir;
      step=Math.max(-4,Math.min(4,step));
    }
    degree=Math.max(0,Math.min(scale.steps.length*2-1,degree+step));
    // phrase contour: drift up first half, resolve down at end
    if(phrasePos<stepsPerBar&&rnd()<0.15)degree=Math.min(scale.steps.length*2-1,degree+1);
    if(phrasePos>=stepsPerBar*2-3)degree=Math.max(0,degree-1);
    const endNote=i+len>=total;
    const midi=midiOf(keyIdx,degree,4+(degree>=scale.steps.length?0:0),scale);
    notes.push({start:i,len:endNote?total-i:len,midi,vel:0.75+rnd()*0.25});
    i+=notes[notes.length-1].len;
  }
  // final note resolves to tonic
  if(notes.length){notes[notes.length-1].midi=midiOf(keyIdx,0,4,scale)+12;notes[notes.length-1].len=Math.max(notes[notes.length-1].len,4)}
  // chord pad: one chord per bar (root position triad, octave 3)
  const pad=[];
  for(let b=0;b<bars;b++){
    const ch=CHORDS[chordProg[b%4]%CHORDS.length];
    pad.push({bar:b,notes:ch.map(s=>midiOf(keyIdx,Math.round(s/2),3,scale))});
  }
  return {notes,pad,scaleKey,key,bars,seed};
}
window.MelodyEngine={SCALES,KEYS,generate,mtof,midiOf};
})();
