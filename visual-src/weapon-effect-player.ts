export interface Point {x:number;y:number}
export interface WeaponProfile {name:string;family:string;travel:number;flash?:number;tail?:number;width?:number;recoil?:number;impact?:number;sparks?:number;automatic?:boolean;interval?:number}
interface Round {delay:number;offset:number}
interface Ammo {name:string;color:string;kind:string}
interface Shot {hit:boolean;p:Ammo;gun:WeaponProfile;mode:string;rounds:Round[];scale:number;time:number;seed:number;reduced:boolean;label:string;sourcePan:number;targetPan:number}
export interface EffectOptions {lightOnly?:boolean;onLightMove?:(point:Point)=>void;onLightPulse?:(phase:'source'|'impact',point:Point)=>void;areaPending?:()=>boolean;onAreaImpact?:()=>void;resumeArea?:boolean;area?:()=>Point[][];areaAmmo?:string;weapon:string;mode?:string;ammo?:string;hit:boolean;visuals:boolean;sound:boolean;volume:number;intensity:number;sourceRadius?:number;targetRadius?:number;positions:()=>{source:Point;target:Point}|undefined;onDone?:()=>void}
let audio:AudioContext|null=null,master:GainNode|null=null,noise:AudioBuffer|null=null,volume=.35;
const nodes=new Set<AudioScheduledSourceNode>();
export function stopWeaponAudio():void {for(const node of nodes){try{node.stop()}catch{}}nodes.clear()}
export function setWeaponVolume(value:number):void {volume=Math.max(0,Math.min(1,value));if(audio&&master)master.gain.setTargetAtTime(volume*.65,audio.currentTime,.02)}
const profiles:Record<string,Ammo>={basic:{name:'Basic',color:'#ffc46b',kind:'spark'},armorPiercing:{name:'Armor Piercing',color:'#76dcff',kind:'pierce'},incendiary:{name:'Incendiary',color:'#ff783b',kind:'fire'},expansive:{name:'Expansive',color:'#ff759e',kind:'bloom'},rubber:{name:'Rubber',color:'#b49aff',kind:'bounce'},smart:{name:'Smart',color:'#74f4b1',kind:'smart'}};
export const weaponProfiles:Record<string,WeaponProfile>={
 pistol:{name:'Pistol',family:'gun',travel:180,flash:22,tail:55,width:2.5,recoil:6,impact:18,sparks:12},
 smg:{name:'SMG',family:'gun',travel:150,flash:16,tail:42,width:2,recoil:4,impact:14,sparks:9,automatic:true,interval:82},
 rifle:{name:'Rifle',family:'gun',travel:125,flash:31,tail:90,width:2,recoil:9,impact:23,sparks:18,automatic:true,interval:115},
 shotgun:{name:'Shotgun',family:'shotgun',travel:170,flash:38,tail:35,width:1.5,recoil:13,impact:24,sparks:24},
 sniper:{name:'Sniper Rifle',family:'gun',travel:105,flash:19,tail:110,width:1.5,recoil:10,impact:25,sparks:17},
 bow:{name:'Bow',family:'arrow',travel:410,recoil:3,impact:13,sparks:5},
 crossbow:{name:'Crossbow',family:'arrow',travel:300,recoil:4,impact:15,sparks:7},
 thrownAxe:{name:'Thrown Axe / Tomahawk / Improvised',family:'thrownAxe',travel:600,impact:22,sparks:8},
 boomerang:{name:'Boomerang',family:'boomerang',travel:680,impact:18,sparks:5},
 throwingStar:{name:'Mono-Star',family:'throwingStar',travel:400,impact:15,sparks:6},
 grenade:{name:'Grenade Throw',family:'grenade',travel:850,recoil:2,impact:60,sparks:36},
 rocket:{name:'Rocket',family:'rocket',travel:650,recoil:8,impact:75,sparks:42},
 melee:{name:'Melee',family:'melee',travel:460,impact:25,sparks:13},
 blade:{name:'Katana',family:'blade',travel:420,impact:22,sparks:12},
 sword:{name:'Sword',family:'blade',travel:420,impact:22,sparks:12},
 knife:{name:'Knife',family:'blade',travel:420,impact:22,sparks:12},
 whip:{name:'Monowire / Mono-Guard',family:'blade',travel:580,impact:20,sparks:10},
 punch:{name:'Brawling',family:'punch',travel:360,impact:17,sparks:8},
 grapple:{name:'Grapple',family:'grapple',travel:340,impact:20,sparks:0},
 martial:{name:'Martial Art Attack',family:'martial',travel:720,impact:22,sparks:12},
 quickhack:{name:'Netrunner Quickhack',family:'data',travel:900,impact:22,sparks:0}
};
export function unlockWeaponAudio(){if(!audio){audio=new AudioContext();master=audio!.createGain();const limiter=audio!.createDynamicsCompressor();limiter.threshold.value=-9;limiter.knee.value=6;limiter.ratio.value=12;limiter.attack.value=.001;limiter.release.value=.12;master!.connect(limiter);limiter.connect(audio!.destination);noise=audio!.createBuffer(1,audio!.sampleRate,audio!.sampleRate);const d=noise!.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}master!.gain.value=volume*.65;return audio!.resume()}
function voice(at:number,duration:number,level:number,freq:number,endFreq:number,type: OscillatorType|'noise'='noise',filterType:BiquadFilterType='lowpass',q=.7,pan=0){const node:AudioBufferSourceNode|OscillatorNode=type==='noise'?audio!.createBufferSource():audio!.createOscillator();if(node instanceof AudioBufferSourceNode)node.buffer=noise;else{node.type=type as OscillatorType;node.frequency.setValueAtTime(freq,at);node.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),at+duration)}const filter=audio!.createBiquadFilter();filter.type=filterType;filter.Q.value=q;filter.frequency.setValueAtTime(freq,at);filter.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),at+duration);const gain=audio!.createGain();gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level),at+.003);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);const stereo=audio!.createStereoPanner();stereo.pan.value=pan;node.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(master!);nodes.add(node);node.onended=()=>{nodes.delete(node);node.disconnect();filter.disconnect();gain.disconnect();stereo.disconnect()};node.start(at);node.stop(at+duration+.02)}
function gunReport(gun:WeaponProfile,at:number,sourcePan=-.5){
  // A cached pressure transient plus turbulent broadband blast. No pitched
  // oscillator sweep: reflections repeat the impulse rather than adding tones.
  const rifle=['Rifle','Sniper Rifle','Shotgun'].includes(gun.name),key=gun.name;
  const weight=gun.name==='Shotgun'?1.5:gun.name==='Sniper Rifle'?1.25:gun.name==='SMG'?.65:1;
  reportBuffers??={};
  if(!reportBuffers[key]){
    const rate=audio!.sampleRate,length=Math.ceil(rate*.85),buffer=audio!.createBuffer(1,length,rate),data=buffer.getChannelData(0);
    let low=0,mid=0,seed=rifle?9317:4813;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/2147483648-1};
    for(let i=0;i<length;i++){
      const t=i/rate,n=random();low+=.035*(n-low);mid+=.24*(n-mid);
      const onset=1-Math.exp(-t/.00012),crack=Math.exp(-t/(rifle?.007:.0045));
      const blast=Math.exp(-t/(rifle?.085*weight:.05*weight));
      const body=Math.exp(-t/(rifle?.18*weight:.10*weight));
      const pressure=(1-t/.002)*Math.exp(-t/.002);
      // Broadband crack, low/mid blast, and a short nonperiodic pressure pulse.
      data[i]=onset*((n-mid)*crack*.72+mid*blast*1.1+low*body*4.0+pressure*.5);
    }
    const dry=data.slice();
    for(const [delay,gain] of (rifle?[[.038,.24],[.081,.14],[.149,.08],[.23,.04]]:[[.026,.18],[.063,.10],[.124,.05]])){
      const offset=Math.round(delay!*rate);for(let i=offset;i<length;i++)data[i]=(data[i]??0)+(dry[i-offset]??0)*gain!;
    }
    let peak=0;for(let i=0;i<length;i++){data[i]=Math.tanh(data[i]!*1.6);peak=Math.max(peak,Math.abs(data[i]!))}
    for(let i=0;i<length;i++)data[i]=data[i]!/Math.max(peak,1e-6)*.82;
    fadeReportTail(data,rate);
    reportBuffers[key]=buffer;
  }
  const node=audio!.createBufferSource(),pan=audio!.createStereoPanner();node.buffer=reportBuffers[key];node.playbackRate.value=.98+Math.random()*.04;pan.pan.value=sourcePan;node.connect(pan);pan.connect(master!);nodes.add(node);node.onended=()=>{nodes.delete(node);node.disconnect();pan.disconnect()};node.start(at);node.stop(at+.9);
}
let reportBuffers:Record<string,AudioBuffer>|undefined;
/** Reach exact silence in cached PCM, without adding any playback nodes. */
function fadeReportTail(data:Float32Array,rate:number):void {
 const count=Math.min(data.length,Math.round(rate*.2)),start=data.length-count;
 for(let j=0;j<count;j++){const x=j/(count-1);data[start+j]=data[start+j]!*(1-x*x*(3-2*x));}
}
let explosionBuffers:Record<string,AudioBuffer>|undefined;
function explosionReport(rocket:boolean,at:number,targetPan:number):void {
 const key=rocket?'rocket':'grenade';explosionBuffers??={};
 if(!explosionBuffers[key]){
  const rate=audio!.sampleRate,length=Math.ceil(rate*(rocket?3.2:2.6)),buffer=audio!.createBuffer(2,length,rate);
  let peak=0;
  for(let channel=0;channel<2;channel++){
   const data=buffer.getChannelData(channel);let low=0,mid=0,seed=(rocket?18731:7193)+channel*137;
   for(let i=0;i<length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)|0;const n=(seed>>>0)/2147483648-1,t=i/rate;
    low+=.006*(n-low);mid+=.13*(n-mid);
    const onset=1-Math.exp(-t/.0004),crack=(n-mid)*Math.exp(-t/.012)*.5;
    const blast=mid*Math.exp(-t/(rocket?.27:.18))*2.2;
    const rumble=low*Math.exp(-t/(rocket?.75:.52))*7;
    const pressure=(1-t/.012)*Math.exp(-t/.012)*.55;
    const bass=Math.sin(2*Math.PI*(rocket?48:62)*t)*Math.exp(-t/(rocket?.38:.25))*.3;
    data[i]=onset*(crack+blast+rumble+pressure+bass);
   }
   const dry=data.slice();
   // Uneven, decorrelated reflections widen the blast and let debris settle.
   for(const [delay,level] of [[.073,.24],[.157,.18],[.293,.12],[.479,.075],[.731,.04]]){
    const offset=Math.round((delay!+channel*.009)*rate);
    for(let i=offset;i<length;i++)data[i]=data[i]!+dry[i-offset]!*level!;
   }
   for(let i=0;i<length;i++){data[i]=Math.tanh(data[i]!*1.4);peak=Math.max(peak,Math.abs(data[i]!));}
  }
  for(let channel=0;channel<2;channel++){
   const data=buffer.getChannelData(channel);for(let i=0;i<length;i++)data[i]=data[i]!/Math.max(peak,1e-6)*.86*.9;
   fadeReportTail(data,rate);
  }
  explosionBuffers[key]=buffer;
 }
 const node=audio!.createBufferSource(),pan=audio!.createStereoPanner();node.buffer=explosionBuffers[key];pan.pan.value=targetPan*.65;
 node.connect(pan);pan.connect(master!);nodes.add(node);
 node.onended=()=>{nodes.delete(node);node.disconnect();pan.disconnect();};node.start(at);
}
function closeCombatAudio(s:Shot,impact:number):void {
 const family=s.gun.family,pan=s.targetPan,swingPan=(s.sourcePan+pan)/2;
 if(family==='punch'){
  voice(impact-.15,.16,.08,1600,650,'noise','bandpass',.7,swingPan);
  if(!s.hit)return;
  // Short skin slap over a heavy, dry body impact.
  voice(impact,.035,.24,2300,900,'noise','bandpass',.8,pan);
  voice(impact,.15,.30,540,110,'noise','lowpass',.7,pan);
  voice(impact,.13,.22,125,48,'sine','lowpass',.7,pan);
 }else if(family==='melee'){
  voice(impact-.22,.24,.12,1900,550,'noise','bandpass',.7,swingPan);
  if(!s.hit)return;
  // Inharmonic steel resonances make the crowbar clank rather than thump.
  voice(impact,.025,.22,6500,2600,'noise','highpass',.6,pan);
  for(const [frequency,level,decay] of [[620,.12,.48],[1037,.09,.39],[1789,.06,.29],[2911,.035,.19]])
   voice(impact,decay!,level!,frequency!,frequency!*.97,'sine','bandpass',3,pan);
  voice(impact,.12,.13,180,65,'triangle','lowpass',.6,pan);
 }else if(family==='martial'){
  // Exaggerated film-style "wa-pooosh": rising air, then a broad falling rush.
  voice(impact-.42,.24,.17,450,1650,'noise','bandpass',2,s.sourcePan);
  voice(impact-.25,.29,.24,2600,500,'noise','bandpass',.8,swingPan);
  voice(impact-.12,.32,.13,5200,850,'noise','highpass',.5,pan);
  if(!s.hit)return;
  voice(impact,.045,.25,3200,1100,'noise','bandpass',.8,pan);
  voice(impact,.23,.29,700,100,'noise','lowpass',.7,pan);
  voice(impact,.20,.23,150,42,'sine','lowpass',.6,pan);
 }else{
  const duration=s.gun.name==='Knife'?.18:.32;
  // Layered air swishes; no metallic collision is implied by the blade swing.
  voice(impact-duration,duration+.05,.20,4200,650,'noise','bandpass',.8,swingPan);
  voice(impact-duration*.65,duration*.85,.13,7500,1800,'noise','highpass',.5,pan);
  if(s.hit)voice(impact,.07,.10,1100,250,'noise','lowpass',.6,pan);
 }
}
function weaponAudio(s:Shot,r:Round,index:number){const g=s.gun,f=g.family,at=audio!.currentTime+.012+r.delay*s.scale/1000,impact=at+g.travel*s.scale/1000,pan=s.targetPan;
 if(['punch','melee','martial'].includes(f)||(f==='blade'&&g.name!=='Monowire / Mono-Guard')){closeCombatAudio(s,impact);return;}
 if(f==='data'){voice(at,.48,.07,350,85,'sawtooth','lowpass',.5,s.sourcePan);for(let i=0;i<5;i++)voice(at+i*.075,.045,.035,720+i*170,720+i*170,'square','lowpass',.5,s.sourcePan+i*.1);voice(at,.35,.025,4200,2500,'noise','bandpass',.7,0)}else if(['gun','shotgun'].includes(f)){
  gunReport(g,at,s.sourcePan);
  if(g.name==='Shotgun')voice(at,.17,.2,800,350,'noise','lowpass',.5,s.sourcePan);
  if(g.name==='SMG')voice(at,.024,.1,5200,4200,'noise','highpass',.5,s.sourcePan);
  if(g.name==='Sniper Rifle')voice(at+.055,.3,.09,1400,500,'noise','bandpass',.5,-.25);
  voice(at+.035,.05,.018,6000,5000,'noise','highpass',.5,0);
 }else if(f==='arrow'){
  voice(at,.08,.14,g.name==='Crossbow'?3500:1900,800,'noise','bandpass',.6,s.sourcePan);voice(at+.01,.075,.06,260,160,'triangle','lowpass',.5,s.sourcePan);
 }else if(f==='rocket'){voice(at,.09,.24,4200,1500,'noise','highpass',.5,s.sourcePan);voice(at,.86,.32,3200,550,'noise','lowpass',.7,s.sourcePan);voice(at,.36,.19,115,42,'sine','lowpass',.5,s.sourcePan)}
 else if(f==='grenade'){voice(at,.07,.09,3800,1200,'noise','bandpass',.5,s.sourcePan);voice(at+.04,.27,.08,1400,350,'noise','bandpass',.5,s.sourcePan)}
 else{voice(impact-.20,.24,.16,f==='blade'?4800:2100,450,'noise','bandpass',.5,(s.sourcePan+pan)/2);if(f==='martial')voice(at+.08,.16,.10,1700,450,'noise','bandpass',.5,s.sourcePan)}
 if(f==='data'){voice(impact,.08,.06,s.hit?1400:350,s.hit?1400:220,'triangle','lowpass',.5,pan);voice(impact+.09,.1,.04,s.hit?1900:250,s.hit?1900:160,'triangle','lowpass',.5,pan)}else if(['rocket','grenade'].includes(f)){
  explosionReport(f==='rocket',impact,pan);
  for(let i=0;i<5;i++)voice(impact+.16+i*.15,.12+i*.025,.045*.9,4300-i*500,550,'noise','highpass',.5,Math.max(-1,Math.min(1,pan+(i%2?.3:-.3))));
 }else if(s.hit&&s.mode!=='suppression'){
  voice(impact,.18,['punch','martial','melee','grapple'].includes(f)?.19:.10,f==='martial'?115:85,35,'sine','lowpass',.5,pan);
  if(f==='blade')voice(impact+.015,.24,.065,2100,1400,'triangle','bandpass',.5,pan);
  if(f==='grapple'){voice(impact,.30,.18,1300,200,'noise','lowpass',.5,pan)}
  else{voice(impact,.025,.18,f==='blade'?6500:3800,2200,'noise','highpass',.5,pan);voice(impact,.20,.25,f==='arrow'?480:850,160,'noise','lowpass',.5,pan)}
  if(s.p.kind==='fire')for(let i=0;i<3;i++)voice(impact+i*.07,.055,.03,2400,1500,'noise','bandpass',.5,pan);
  if(s.p.kind==='bounce')voice(impact+.04,.12,.08,180,65,'triangle','lowpass',.5,pan);
  if(s.p.kind==='bloom')voice(impact+.02,.23,.10,700,130,'noise','lowpass',.5,pan);
  if(s.p.kind==='smart')voice(impact+.025,.09,.04,1700,2400,'triangle','lowpass',.5,pan);
  if(s.p.kind==='pierce')voice(impact+.01,.045,.065,7500,6000,'noise','highpass',.5,pan);
 }else{voice(impact-.03,.07,.06,4000,2700,'noise','bandpass',.5,pan);if(['gun','shotgun','arrow'].includes(f))voice(impact,.055,.1,6000,1800,'noise','highpass',.5,pan)}
}
/** Warm combustion colors are independent of the ammunition UI color. */
function muzzleFlash(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,alpha:number,angle:number){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;
 const flame=ctx.createRadialGradient(size*.2,0,1,size*.35,0,size);
 flame.addColorStop(0,'#fffdeb');flame.addColorStop(.22,'#fff2bf');flame.addColorStop(.5,'#ffc15c');flame.addColorStop(1,'#e96a1900');
 ctx.fillStyle=flame;ctx.shadowColor='#ffb34d';ctx.shadowBlur=12;
 ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(size*.3,-size*.28);ctx.lineTo(size*.25,-size*.12);ctx.lineTo(size*.92,-size*.18);ctx.lineTo(size*.68,-size*.02);ctx.lineTo(size,0);ctx.lineTo(size*.55,size*.12);ctx.lineTo(size*.7,size*.3);ctx.lineTo(size*.22,size*.16);ctx.lineTo(-4,3);ctx.closePath();ctx.fill();
 ctx.fillStyle='#fff9df';ctx.beginPath();ctx.ellipse(size*.14,0,size*.25,size*.08,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
/** Neutral material shading with a thin ammunition-colored silhouette. */
const PROJECTILE_SCALE=.65;
const projectileSprites=new Map<string,HTMLCanvasElement>();
function projectile(ctx:CanvasRenderingContext2D,family:string,x:number,y:number,angle:number,color:string){
 const key=family+color;let sprite=projectileSprites.get(key);
 if(!sprite){
  const body=document.createElement('canvas');body.width=96;body.height=48;
  projectileBody(body.getContext('2d')!,family,80,24,0,color);
  sprite=document.createElement('canvas');sprite.width=96;sprite.height=48;const c=sprite.getContext('2d')!;
  c.globalAlpha=.25;projectileBody(c,family,80,24,0,color,true);c.globalAlpha=1;
  // Subtract the silhouette from the halo before drawing the clean body.
  c.globalCompositeOperation='destination-out';c.drawImage(body,0,0);
  c.globalCompositeOperation='source-over';c.drawImage(body,0,0);
  if(projectileSprites.size>=64)projectileSprites.clear();projectileSprites.set(key,sprite);
 }
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(PROJECTILE_SCALE,PROJECTILE_SCALE);ctx.shadowBlur=0;ctx.drawImage(sprite,-80,-24);ctx.restore();
}
function projectileBody(ctx:CanvasRenderingContext2D,family:string,x:number,y:number,angle:number,color:string,halo=false){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.shadowColor=color;ctx.shadowBlur=halo?4:0;ctx.lineJoin='round';ctx.lineWidth=family==='shotgun'?1.8:2.25;ctx.strokeStyle=color;
 const metal=ctx.createLinearGradient(0,-5,0,5);metal.addColorStop(0,'#e4e6df');metal.addColorStop(.35,'#a9afb0');metal.addColorStop(1,'#424c50');
 const shape=(points:number[],fill:string|CanvasGradient)=>{ctx.fillStyle=fill;ctx.beginPath();for(let i=0;i<points.length;i+=2)i?ctx.lineTo(points[i]!,points[i+1]!):ctx.moveTo(points[i]!,points[i+1]!);ctx.closePath();ctx.fill();ctx.stroke();};
 if(family==='thrownAxe'){
  shape([-19,-18,-13,-18,-11,19,-17,19],'#805c3e');
  shape([-18,-17,-7,-16,5,-21,8,-11,4,-2,-8,-8,-18,-8],metal);
  ctx.strokeStyle='#f0f5f5';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(5,-20);ctx.quadraticCurveTo(11,-11,4,-3);ctx.stroke();
 }else if(family==='boomerang'){
  shape([-34,-17,-27,-20,-12,-4,3,-19,9,-15,-9,12,-15,13],'#91633c');
  ctx.strokeStyle='#d8a957';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-29,-14);ctx.lineTo(-13,5);ctx.lineTo(4,-13);ctx.stroke();
 }else if(family==='throwingStar'){
  shape([-13,-21,-7,-6,7,0,-7,6,-13,21,-19,6,-33,0,-19,-6],metal);
  ctx.fillStyle='#26343b';ctx.beginPath();ctx.arc(-13,0,3,0,Math.PI*2);ctx.fill();
 }else if(family==='arrow'){
  shape([-42,-2,-12,-2,-12,2,-42,2],'#84765c');
  shape([-43,-2,-50,-6,-37,-6,-31,-2,-31,2,-37,6,-50,6,-43,2],'#c5c9be');
  shape([-15,-5,0,0,-15,5,-11,0],metal);
 }else if(family==='rocket'){
  // Exhaust remains warm; the body, nose and fins remain visible above it.
  const exhaust=ctx.createLinearGradient(-62,0,-29,0);exhaust.addColorStop(0,'#f17b1700');exhaust.addColorStop(.65,'#ffb84e');exhaust.addColorStop(1,'#fff5d3');
  ctx.fillStyle=exhaust;ctx.beginPath();ctx.moveTo(-30,-3);ctx.lineTo(-63,0);ctx.lineTo(-30,3);ctx.fill();
  shape([-33,-4,-39,-10,-24,-5,-12,-5,0,0,-12,5,-24,5,-39,10,-33,4],'#70796a');
  shape([-13,-5,0,0,-13,5],metal);ctx.strokeStyle='#d6dbcc';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-30,-2);ctx.lineTo(-15,-2);ctx.stroke();
 }else if(family==='grenade'){
  ctx.fillStyle='#57614a';ctx.beginPath();ctx.ellipse(-7,0,9,6,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  shape([-9,-6,-9,-9,-3,-9,0,-3,-3,-2,-5,-6],metal);
  ctx.strokeStyle='#30372d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-11,-4);ctx.lineTo(-11,4);ctx.moveTo(-6,-5);ctx.lineTo(-6,5);ctx.stroke();
 }else if(family==='shotgun'){
  ctx.fillStyle=metal;ctx.beginPath();ctx.arc(-2.5,0,2.6,0,Math.PI*2);ctx.fill();ctx.stroke();
 }else{
  const copper=ctx.createLinearGradient(0,-3,0,3);copper.addColorStop(0,'#efd5a0');copper.addColorStop(.4,'#bd925d');copper.addColorStop(1,'#715034');
  ctx.fillStyle=copper;ctx.beginPath();ctx.moveTo(-16,-3);ctx.lineTo(-6,-3);ctx.quadraticCurveTo(-2,-2.5,0,0);ctx.quadraticCurveTo(-2,2.5,-6,3);ctx.lineTo(-16,3);ctx.closePath();ctx.fill();ctx.stroke();
 }
 ctx.restore();
}
/** Sample the actual flight path so curved shots leave curved, fading trails. */
function projectileTrail(ctx:CanvasRenderingContext2D,family:string,color:string,progress:number,distance:number,point:(t:number)=>Point){
 const length=(family==='gun'?105:family==='shotgun'?48:family==='arrow'?75:70)*PROJECTILE_SCALE;
 const start=Math.max(0,progress-length/Math.max(1,distance));
 ctx.save();ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=8*PROJECTILE_SCALE;ctx.lineCap='round';
 for(let i=0;i<12;i++){
  const p=point(start+(progress-start)*i/12),q=point(start+(progress-start)*(i+1)/12),fade=(i+1)/12;
  ctx.globalAlpha=fade*.65;ctx.lineWidth=(family==='shotgun'?2:3.5)*(.35+.65*fade)*PROJECTILE_SCALE;
  ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
 }
 ctx.restore();
}
export const grenadeVisuals:Record<string,{name:string;color:string;kind:string}>={
 armorPiercing:{name:'Armor-Piercing',color:'#ffc46b',kind:'blast'},
 incendiary:{name:'Incendiary',color:'#ef632e',kind:'fire'},
 smoke:{name:'Smoke',color:'#a7afb7',kind:'cloud'},
 poison:{name:'Poison',color:'#54ad49',kind:'cloud'},
 biotoxin:{name:'Biotoxin',color:'#ee912f',kind:'cloud'},
 emp:{name:'EMP',color:'#47c9dd',kind:'electric'},
 flashbang:{name:'Flashbang',color:'#f0d953',kind:'flash'},
 sleep:{name:'Sleep',color:'#ad80df',kind:'cloud'},
 teargas:{name:'Teargas',color:'#b3c84c',kind:'cloud'}
};
/** Shared palette lookup for native flash lights and the animation. */
export function attackAmmoColor(ammo='basic',areaAmmo?:string):string {
 return areaAmmo&&grenadeVisuals[areaAmmo]?grenadeVisuals[areaAmmo]!.color:profiles[ammo]?.color??profiles.basic!.color;
}
/** Union mask with an inward distance fade: no glow can spill into excluded cells. */
function createAreaBurst(){
 const mask=document.createElement('canvas'),surface=document.createElement('canvas');
 let key='',left=0,top=0,scale=1,polygons:Point[][]=[];
 function prepare(cells:Point[][]){
  const next=JSON.stringify(cells);if(next===key)return;key=next;
  const points=cells.flat();if(!points.length)return;
  left=Math.min(...points.map(p=>p.x))-2;top=Math.min(...points.map(p=>p.y))-2;
  const w=Math.max(...points.map(p=>p.x))-left+2,h=Math.max(...points.map(p=>p.y))-top+2;
  scale=Math.min(1,512/Math.max(w,h));mask.width=surface.width=Math.max(1,Math.ceil(w*scale));mask.height=surface.height=Math.max(1,Math.ceil(h*scale));
  polygons=cells.map(cell=>cell.map(p=>({x:(p.x-left)*scale,y:(p.y-top)*scale})));
  const c=mask.getContext('2d')!;c.fillStyle='#fff';
  c.beginPath();for(const poly of polygons){poly.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}c.fill();
  const image=c.getImageData(0,0,mask.width,mask.height),d=new Float32Array(mask.width*mask.height),mw=mask.width,mh=mask.height;
  for(let i=0;i<d.length;i++)d[i]=image.data[i*4+3]!>240?10000:0;
  for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){const i=y*mw+x;d[i]=Math.min(d[i]!,x?d[i-1]!+1:0,y?d[i-mw]!+1:0);}
  for(let y=mh-1;y>=0;y--)for(let x=mw-1;x>=0;x--){const i=y*mw+x;d[i]=Math.min(d[i]!,x<mw-1?d[i+1]!+1:0,y<mh-1?d[i+mw]!+1:0);}
  const first=polygons[0]!,cellWidth=Math.max(...first.map(p=>p.x))-Math.min(...first.map(p=>p.x));
  const feather=Math.max(3,cellWidth*.24);
  // A stable, continuous contour retreats into perimeter cells only. Interior
  // cells remain full, without seams or noise that changes on every frame.
  for(let i=0;i<d.length;i++){
   const x=(i%mw)/Math.max(1,cellWidth),y=Math.floor(i/mw)/Math.max(1,cellWidth);
   const noise=.5+.25*Math.sin(x*3.7+y*1.3)+.15*Math.sin(y*5.1-x*2.4)+.1*Math.sin(x*8.3+y*6.2);
   const inset=cellWidth*(.12+.22*noise);
   const a=Math.min(1,Math.max(0,(d[i]!-inset)/feather));
   image.data[i*4+3]=Math.round(255*a*a*(3-2*a));
  }
  c.putImageData(image,0,0);
 }
 return (ctx:CanvasRenderingContext2D,cells:Point[][],ammo:string,progress:number,stationary:boolean,lingering=false)=>{
  if(!cells.length)return;prepare(cells);
  const c=surface.getContext('2d')!,profile=grenadeVisuals[ammo]??grenadeVisuals.armorPiercing!,kind=profile.kind;
  const fade=lingering?Math.min(1,progress*9)*(.35+.65*Math.exp(-progress*3)):Math.min(1,progress*9)*Math.pow(Math.max(0,1-progress),.7),t=lingering?(stationary?.35:.35+.15*Math.sin(progress*1.6)):stationary?0:progress;
  c.clearRect(0,0,surface.width,surface.height);c.globalCompositeOperation='source-over';
  c.fillStyle=profile.color+'22';c.fillRect(0,0,surface.width,surface.height);
  const glow=(x:number,y:number,r:number,color:string,alpha:number)=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');c.globalAlpha=alpha;c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};
  polygons.forEach((poly,index)=>{
   const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
   for(let j=0;j<6;j++){
    const seed=index*19+j*7,px=x+w*(.15+((seed*37)%71)/100),py=y+h*(.15+((seed*23)%71)/100);
    if(kind==='electric'){
     c.globalAlpha=.7;c.strokeStyle=profile.color;c.lineWidth=1.5;c.shadowColor=profile.color;c.shadowBlur=5;
     c.beginPath();c.moveTo(px-w*.3,py);for(let n=1;n<=5;n++)c.lineTo(px-w*.3+n*w*.13,py+Math.sin(seed+n*9+t*35)*h*.16);c.stroke();c.shadowBlur=0;
    }else if(kind==='fire'){
     const rise=(t*1.4+j*.17)%1;glow(px,py-rise*h*.3,w*.45,'#eb5a22',.55);glow(px,py-rise*h*.4,w*.18,'#ffe5a1',.65);
    }else if(kind==='flash')glow(px,py,w*.8,'#fff8cb',.65);
    else if(kind==='cloud')glow(px+Math.sin(seed+t*3)*w*.12,py-t*h*.1,w*(.5+t*.2),profile.color,.32);
    else{glow(px,py,w*(.2+t*.65),'#ffb351',.5*(1-t));glow(px,py-t*h*.14,w*.45,'#77736b',.32);}
   }
  });
  c.globalAlpha=1;c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0);
  ctx.save();ctx.globalAlpha*=fade;ctx.drawImage(surface,left,top,surface.width/scale,surface.height/scale);ctx.restore();
 };
}

export function playWeaponEffect(options:EffectOptions):()=>void {
 const drawArea=createAreaBurst();
 const gun=weaponProfiles[options.weapon]??weaponProfiles.pistol!;
 const mode=gun.automatic?options.mode??'single':'single';
 const p=['melee','blade','punch','martial','grapple'].includes(gun.family)?{name:'Physical',color:gun.family==='blade'?'#b6eaff':gun.family==='martial'?'#8ee7ff':'#efbf87',kind:'spark'}:gun.family==='data'?{name:'Data',color:'#66ffe0',kind:'spark'}:options.area&&options.areaAmmo&&grenadeVisuals[options.areaAmmo]?{...grenadeVisuals[options.areaAmmo]!,kind:'spark'}:profiles[options.ammo??'basic']??profiles.basic!;
 const count=mode==='auto'?5:mode==='suppression'?8:1;
 const rounds:Round[]=Array.from({length:count},(_,i)=>({delay:i*(gun.interval??100),offset:Math.sin(i*2.3)*80}));
 const layer=document.createElement('canvas');layer.setAttribute('aria-hidden','true');layer.className='pneuma-weapon-effects';
 Object.assign(layer.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',pointerEvents:'none',zIndex:'60',opacity:String(Math.max(0,Math.min(1,options.intensity)))});
 const context=layer.getContext('2d');if(!context){options.onDone?.();return ()=>{}}const ctx=context;
 if(options.visuals&&!options.lightOnly)document.body.append(layer);
 let source:Point={x:0,y:0},target:Point={x:0,y:0},frame=0,done=false;
 const initial:Shot={hit:options.hit,p,gun,mode,rounds,scale:1.38,time:performance.now(),seed:Math.random()*6,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,label:'',sourcePan:0,targetPan:0};
 const placement=options.positions();initial.sourcePan=placement?Math.max(-.85,Math.min(.85,placement.source.x/innerWidth*2-1)):0;initial.targetPan=placement?Math.max(-.85,Math.min(.85,placement.target.x/innerWidth*2-1)):0;
 if(options.resumeArea)initial.time-=gun.travel*initial.scale+1100;
 let areaStarted=false,areaEndedAt:number|undefined;
 const lightRounds=new Set<number>();
 let shot:Shot|null=initial;
 setWeaponVolume(options.volume);
 if(!options.lightOnly&&!options.resumeArea&&options.sound&&audio?.state==='running')rounds.forEach((r,i)=>weaponAudio(initial,r,i));
 function base(){const positions=options.positions();if(!positions){stop();return}source=positions.source;target=positions.target;
 if(options.lightOnly)return;
 if(layer.width!==innerWidth||layer.height!==innerHeight){layer.width=innerWidth;layer.height=innerHeight}
 ctx.clearRect(0,0,layer.width,layer.height);ctx.globalAlpha=1;
 }
 function stop(){if(done)return;done=true;shot=null;cancelAnimationFrame(frame);layer.remove();options.onDone?.()}
function star(x:number,y:number,r:number,alpha:number,color:string,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=Math.max(0,alpha);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=16;ctx.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6,size=i%2?r*.3:r;ctx.lineTo(Math.cos(a)*size,Math.sin(a)*size)}ctx.closePath();ctx.fill();ctx.restore()}
function line(x:number,y:number,x2:number,y2:number,color:string,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke()}
function digitalImpact(x:number,y:number,progress:number,color:string,explosive=false){
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=Math.max(0,1-progress);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.5;ctx.shadowColor=color;ctx.shadowBlur=8;
 const size=(explosive?28:12)+progress*(explosive?65:24),arm=explosive?13:7;
 for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]] as [number,number][]){ctx.beginPath();ctx.moveTo(sx*(size-arm),sy*size);ctx.lineTo(sx*size,sy*size);ctx.lineTo(sx*size,sy*(size-arm));ctx.stroke()}
 ctx.fillStyle=color+'44';ctx.fillRect(-size*.6,-3,size*1.2,6);
 for(let i=0;i<(explosive?12:7);i++){const sign=i%2?1:-1,dx=sign*(8+progress*(20+i*4)),dy=((i*17)%39-19)*(1+progress);ctx.fillStyle=i%3?color:'#e9ffff';ctx.fillRect(dx,dy,3+i%3*3,2)}
 ctx.restore();
}
function physicalImpact(x:number,y:number,k:number,color:string,s:Shot,ux:number,uy:number){
 const f=s.gun.family,explosive=['grenade','rocket'].includes(f),alpha=Math.max(0,1-k);ctx.save();ctx.translate(x,y);if(['melee','blade','punch','martial'].includes(f))ctx.scale(.8,.8);ctx.globalAlpha=alpha;ctx.shadowColor=color;ctx.shadowBlur=8;ctx.strokeStyle=color;ctx.fillStyle=color;
 if(s.reduced){ctx.globalAlpha=alpha*.7;ctx.beginPath();ctx.ellipse(0,0,9,5,Math.atan2(uy,ux),0,Math.PI*2);ctx.fill();ctx.restore();return}
 if(explosive){
  // Irregular expanding pressure front, hot core, and tumbling debris.
  ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,r=(15+k*100)*(1+.09*Math.sin(i*2.7));i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.stroke();
  const core=ctx.createRadialGradient(0,0,1,0,0,25+k*38);core.addColorStop(0,'#fff4d5');core.addColorStop(.25,color+'aa');core.addColorStop(1,color+'00');ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,25+k*38,0,Math.PI*2);ctx.fill();
 }else if(f==='blade'){
  // Two bright cuts peel apart; small fragments follow the cut direction.
  ctx.rotate(Math.atan2(uy,ux)-.65);for(let i=0;i<2;i++){const offset=(i?1:-1)*k*10;line(-7-k*20,offset,24+k*45,offset,color,Math.max(1,7*(1-k)));line(-4-k*17,offset,8+k*24,offset,'#f4ffff',1)}
  for(let i=0;i<6;i++){const px=(i-2)*8+k*20,py=(i%2?1:-1)*(3+k*16);line(px,py,px+5,py+2,color,1)}
 }else if(['punch','melee','martial'].includes(f)){
  // Flattened compression waves carry the direction of the strike.
  ctx.rotate(Math.atan2(uy,ux));for(let i=0;i<3;i++){const phase=k-i*.13;if(phase<0)continue;ctx.globalAlpha=alpha*(1-i*.22);ctx.lineWidth=4.5-i*.9;ctx.beginPath();ctx.ellipse(phase*18,0,6+phase*23,16+phase*42,0,-1.3,1.3);ctx.stroke()}
  ctx.globalAlpha=alpha;ctx.fillStyle='#edffff';ctx.beginPath();ctx.ellipse(0,0,Math.max(1,11*(1-k)),Math.max(1,19*(1-k)),0,0,Math.PI*2);ctx.fill();
 }else if(f==='grapple'){
  // The gripping hands supply the success cue without an abstract impact ring.
 }else{
  // A tiny contact flash and asymmetric fan of chips thrown away from the hit.
  ctx.rotate(Math.atan2(uy,ux));ctx.fillStyle='#fff4db';ctx.beginPath();ctx.ellipse(0,0,Math.max(1,7*(1-k)),Math.max(1,4*(1-k)),0,0,Math.PI*2);ctx.fill();
  const count=f==='shotgun'?17:f==='arrow'?5:10;
  for(let i=0;i<count;i++){const angle=-1.25+(i/(count-1))*2.5+(i%2*.13),speed=18+(i*13)%42,px=Math.cos(angle)*k*speed,py=Math.sin(angle)*k*speed+k*k*15;ctx.save();ctx.translate(px,py);ctx.rotate(angle+k*3);ctx.fillStyle=i%3?color:'#eaffff';ctx.beginPath();ctx.moveTo(-3,-1);ctx.lineTo(4,0);ctx.lineTo(-1,2);ctx.closePath();ctx.fill();ctx.restore()}
  if(s.p.kind==='pierce'){line(0,0,12+k*50,0,color,1);line(1,-3,8+k*22,-3,'#f1ffff',1)}
  if(s.p.kind==='bloom'){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(k*5,0,5+k*14,8+k*24,0,-1.4,1.4);ctx.stroke()}
 }
 ctx.restore();
}

function grappleStrike(ctx:CanvasRenderingContext2D, sx:number, sy:number, ex:number, ey:number, progress:number, size:number, hit:boolean) {
 const reach=Math.min(1,Math.max(0,progress)),ease=reach*reach*(3-2*reach);
 const after=Math.max(0,progress-1),resolve=Math.min(1,after/.35),fade=1-Math.min(1,Math.max(0,after-.3)/.35);
 const dx=ex-sx,dy=ey-sy,distance=Math.hypot(dx,dy),scale=size*.8;
 const travel=hit?ease: ease*(1-resolve*.65);
 ctx.save();ctx.translate(sx,sy);ctx.rotate(Math.atan2(dy,dx));ctx.globalAlpha*=fade;
 for(const side of [-1,1]){
  ctx.save();ctx.translate(distance*travel-(hit?resolve*6:0),side*(18*scale+(hit?-resolve*7:resolve*17)*scale));ctx.scale(scale,side*scale);
  // Same skin shading, outline, wrist and knuckle detail as the brawling fist.
  const skin=ctx.createLinearGradient(0,-15,0,16);skin.addColorStop(0,'#deb99a');skin.addColorStop(.48,'#b88a68');skin.addColorStop(1,'#79513d');
  ctx.fillStyle=skin;ctx.strokeStyle='#644635';ctx.lineWidth=.9;ctx.lineJoin='round';
  const curl=hit?resolve:0;
  ctx.beginPath();ctx.moveTo(-39,-6);ctx.lineTo(-17,-7);ctx.quadraticCurveTo(-12,-14,-4,-12);
  // Four separated fingers bend inward as the grip closes.
  for(let i=0;i<4;i++){
   const y=-11+i*6,tip=8- i*1.4-curl*8;
   ctx.lineTo(tip,y);ctx.quadraticCurveTo(tip+5,y+2,tip+1,y+4);ctx.lineTo(-7+curl*3,y+4);
  }
  ctx.quadraticCurveTo(-14,13,-19,7);ctx.lineTo(-39,6);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-17,5);ctx.bezierCurveTo(-13,-2,-5,-2,-2,2);ctx.quadraticCurveTo(2,6,-4,8);ctx.quadraticCurveTo(-12,11,-17,5);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#8b6047';for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-9,-8+i*6);ctx.lineTo(-5,-7+i*6);ctx.stroke();}
  ctx.restore();
 }
 ctx.restore();
}

function closeStrike(ctx:CanvasRenderingContext2D, family:string, sourceX:number, sourceY:number, x:number, y:number, angle:number, progress:number, size:number, weapon:string, penetration=0) {
 const wind=.28, strike=Math.max(0,Math.min(1,(progress-wind)/(1-wind))), eased=1-Math.pow(1-strike,3);
 const recovery=Math.max(0,progress-1), fade=Math.max(0,1-recovery*2.5);
 const swing=-Math.PI/2*(1-eased);
 const armed=family==='blade'||family==='melee';
 const tip=armed?(weapon==='knife'?43:weapon==='melee'?74:76):14;
 const distance=Math.hypot(x-sourceX,y-sourceY);
 if(weapon==='whip'){
  // Short wind-up, lengthening lash, a curl around the target, then a small tug.
  ctx.save();ctx.translate(sourceX,sourceY);ctx.rotate(angle);ctx.globalAlpha*=fade;
  ctx.lineCap='round';ctx.lineJoin='round';
  const whipFade=1-Math.min(1,Math.max(0,progress-1.18)/.22);
  const wire=(phase:number)=>{
   ctx.beginPath();ctx.moveTo(0,0);
   if(phase<.22){
    const back=phase/.22;
    ctx.bezierCurveTo(8*size,-12*size,-12*size,-22*size,(-6-18*back)*size,(-8-8*back)*size);return;
   }
   const cast=Math.min(1,(phase-.22)/.53),extend=cast*cast*(3-2*cast);
   const radius=penetration>0?penetration/1.2:0;
   const tug=Math.min(1,Math.max(0,(phase-1)/.25))*Math.min(14*size,radius*.4);
   const center=distance+radius-tug,tipX=-24*size+(center+24*size)*extend;
   const tipY=-16*size*(1-extend)-radius*.35*extend;
   ctx.bezierCurveTo(tipX*.25,-(22*size+Math.sin(cast*Math.PI)*32*size),tipX*.72,tipY-12*size*(1-extend),tipX,tipY);
   if(phase>=.75&&radius>0){
    const curl=Math.min(1,(phase-.75)/.25),sweep=Math.PI*1.4*curl;
    for(let i=1;i<=24;i++){const theta=-Math.PI/2+sweep*i/24;ctx.lineTo(center+Math.cos(theta)*radius,Math.sin(theta)*radius*.35);}
   }
  };
  if(progress>.22&&progress<1.1){
   ctx.strokeStyle='#66dfff';ctx.shadowBlur=8;ctx.shadowColor='#75eaff';ctx.lineWidth=3*size;
   for(let i=3;i>0;i--){ctx.globalAlpha=whipFade*(.12-i*.025);wire(Math.max(0,progress-i*.035));ctx.stroke();}
  }
  const flicker=.82+.18*Math.sin(progress*83)*Math.sin(progress*137);
  ctx.globalAlpha=whipFade*flicker;
  ctx.shadowColor='#75eaff';ctx.shadowBlur=12+6*flicker;ctx.strokeStyle='#66dfff';ctx.lineWidth=4*size;wire(progress);ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle='#efffff';ctx.lineWidth=1.5*size;wire(progress);ctx.stroke();
  ctx.globalAlpha=whipFade;
  // A small grip fixes the origin at the attacker rather than the defender.
  ctx.strokeStyle='#354551';ctx.lineWidth=5*size;ctx.beginPath();ctx.moveTo(-9*size,0);ctx.lineTo(0,0);ctx.stroke();
  ctx.restore();return;
 }
 // Preserve readable artwork at short range. A long weapon can overlap the
 // defender at contact, but its grip must never travel back into the attacker.
 const scale=size*.8;
 const start=armed?0:-tip*scale;
 const finish=armed?Math.max(0,distance-tip*scale):distance-tip*scale;
 const anchor=start+(finish-start)*eased;
 ctx.save();ctx.translate(sourceX,sourceY);ctx.rotate(angle);ctx.translate(anchor,0);ctx.scale(scale,scale);ctx.globalAlpha*=fade;
 const shape=(points:[number,number][],fill:string,stroke='#e4f4fc')=>{ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fill();ctx.stroke()};
 const skin=ctx.createLinearGradient(0,-15,0,16);skin.addColorStop(0,'#deb99a');skin.addColorStop(.48,'#b88a68');skin.addColorStop(1,'#79513d');
 const fist=()=>{
  ctx.fillStyle=skin;ctx.strokeStyle='#644635';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(-49,-7);ctx.quadraticCurveTo(-30,-10,-17,-7);ctx.quadraticCurveTo(-13,-8,-11,-12);ctx.quadraticCurveTo(-8,-16,-3,-13);ctx.quadraticCurveTo(2,-16,5,-12);ctx.quadraticCurveTo(10,-13,12,-8);ctx.quadraticCurveTo(16,-3,13,5);ctx.quadraticCurveTo(12,11,6,12);ctx.quadraticCurveTo(-6,15,-16,7);ctx.quadraticCurveTo(-33,9,-49,7);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#8b6047';for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-6+i*6,-10);ctx.quadraticCurveTo(-4+i*6,-6,-5+i*6,-2);ctx.stroke()}
  ctx.fillStyle=skin;ctx.beginPath();ctx.moveTo(-15,5);ctx.bezierCurveTo(-12,-1,-5,-1,2,3);ctx.quadraticCurveTo(6,7,1,9);ctx.quadraticCurveTo(-8,11,-15,5);ctx.fill();ctx.stroke();
 };
 ctx.shadowBlur=0;
 if(family==='blade'||family==='melee') {
  // Broad fading sweep follows the weapon tip, with an opaque weapon above it.
  if(progress>wind){for(let i=5;i>0;i--){ctx.save();ctx.globalAlpha*=.08+(5-i)*.025;ctx.rotate(swing-i*.13);shape([[8,-5],[70,-3],[78,0],[70,3],[8,5]],family==='blade'?'#afedff':'#d9b480');ctx.restore()}}
  ctx.rotate(swing);
  shape([[-24,-5],[0,-5],[0,5],[-24,5]],'#273746','#8eabb9');
  for(let i=-20;i<0;i+=5){ctx.strokeStyle='#7892a1';ctx.beginPath();ctx.moveTo(i,-4);ctx.lineTo(i+2,4);ctx.stroke()}
  if(family==='blade'&&weapon!=='blade') {
   const tip=weapon==='knife'?43:76;
   // Straight blade with a distinct point, guard, and bright cutting edge.
   shape([[2,-11],[6,-11],[6,11],[2,11]],'#77664b','#bba782');
   shape([[7,-5],[tip-15,-5],[tip,0],[tip-15,5],[7,5]],'#a5b5bd','#53636c');
   ctx.strokeStyle='#f0f5f5';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(8,4);ctx.lineTo(tip-15,4);ctx.lineTo(tip,0);ctx.stroke();
  } else if(family==='blade') {
   // Compact round tsuba and a single-edged, gently curved katana blade.
   ctx.fillStyle='#322e29';ctx.strokeStyle='#a58d60';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(2,0,3,10,0,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle='#9eafb6';ctx.strokeStyle='#56656c';ctx.beginPath();ctx.moveTo(5,-3);ctx.quadraticCurveTo(44,-2,68,-10);ctx.lineTo(76,-12);ctx.lineTo(71,-6);ctx.quadraticCurveTo(44,4,5,3);ctx.closePath();ctx.fill();ctx.stroke();
   ctx.strokeStyle='#e5ecec';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(7,2);ctx.quadraticCurveTo(44,3,71,-7);ctx.lineTo(76,-12);ctx.stroke();
  }
  else {
   // Narrow steel shaft with a hooked, split pry end.
   ctx.strokeStyle='#34414b';ctx.lineWidth=10;ctx.lineCap='round';ctx.lineJoin='round';
   ctx.beginPath();ctx.moveTo(-24,0);ctx.lineTo(57,0);ctx.quadraticCurveTo(74,0,74,-14);ctx.quadraticCurveTo(74,-24,63,-24);ctx.lineTo(56,-21);ctx.stroke();
   ctx.strokeStyle='#95a5af';ctx.lineWidth=5;ctx.stroke();
   ctx.strokeStyle='#d9e2e7';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-22,-2);ctx.lineTo(57,-2);ctx.quadraticCurveTo(71,-2,71,-14);ctx.stroke();
   ctx.strokeStyle='#263039';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(54,-21);ctx.lineTo(61,-23);ctx.stroke();
  }
 } else {
  const reach=0;
  const lift=Math.sin((1-eased)*Math.PI)*12;
  if(progress>wind&&progress<1.15){ctx.strokeStyle=family==='martial'?'#8ee7ff':'#efbf87';ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.globalAlpha=fade*(.28-i*.06);ctx.beginPath();ctx.moveTo(reach-66-i*8,lift-12+i*12);ctx.lineTo(reach-24,lift-12+i*12);ctx.stroke()}ctx.globalAlpha=fade;}
  ctx.translate(reach,lift);
  fist();
  if(family==='martial'){
   // Separate black-belt emblem: clear air below the fist, symmetric sash and knot.
   ctx.save();ctx.translate(-3,29);
   shape([[-23,-5],[-5,-3],[0,1],[-5,5],[-23,3]],'#111318','#89929b');
   shape([[23,-5],[5,-3],[0,1],[5,5],[23,3]],'#111318','#89929b');
   shape([[-5,2],[0,5],[-9,21],[-17,17]],'#111318','#89929b');
   shape([[5,2],[0,5],[9,21],[17,17]],'#111318','#89929b');
   shape([[-5,-4],[5,-4],[7,2],[0,7],[-7,2]],'#252930','#a4adb5');
   ctx.restore();
  }
 }
 ctx.restore();
}

function dataStream(sx:number,sy:number,ex:number,ey:number,progress:number,color:string){
 const point=(t:number)=>({x:sx+(ex-sx)*t,y:sy+(ey-sy)*t-Math.sin(t*Math.PI)*145});
 ctx.save();ctx.shadowColor=color;ctx.shadowBlur=8;ctx.strokeStyle=color+'33';ctx.lineWidth=1;ctx.beginPath();for(let j=0;j<=40;j++){const p=point(j/40);j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();
 for(let i=0;i<24;i++){const t=progress-i*.019;if(t<0||t>1)continue;const p=point(t);ctx.globalAlpha=Math.max(.1,1-i/24);ctx.fillStyle=i%4===0?'#eaffff':color;ctx.fillRect(p.x-4,p.y-2,8,4);if(i%3===0){ctx.font='10px monospace';ctx.fillText(i%2?'01':'0x',p.x-6,p.y-9)}}
 ctx.globalAlpha=1;const p=point(Math.min(1,progress));ctx.strokeStyle=color;ctx.strokeRect(p.x-6,p.y-6,12,12);ctx.restore();
}

function draw(now:number){if(!shot){base();return}const s=shot,g=s.gun,f=g.family,t=(now-s.time)/s.scale,close=['melee','blade','punch','grapple','martial'].includes(f),color=s.p.color;
 const last=s.rounds.at(-1)!,end=last.delay+g.travel+(['grenade','rocket'].includes(f)?1100:650);
 let glow=0,recoil=0;for(const r of s.rounds){const age=t-r.delay-g.travel;if(s.hit&&s.mode!=='suppression'&&age>=0)glow=Math.max(glow,Math.max(0,1-age/400));if(t>=r.delay&&t<r.delay+120)recoil=-((g.recoil||4)*Math.sin((t-r.delay)/120*Math.PI))}
 base();if(done)return;if(!options.lightOnly&&glow>0){ctx.save();ctx.globalAlpha=glow*.25;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(target.x,target.y,options.targetRadius??28,0,Math.PI*2);ctx.stroke();ctx.restore()}
 if(!options.lightOnly&&s.mode==='suppression'){ctx.fillStyle=color+'12';ctx.fillRect(target.x-65,target.y-105,170,210);ctx.strokeStyle=color+'66';ctx.setLineDash([5,6]);ctx.strokeRect(target.x-65,target.y-105,170,210);ctx.setLineDash([])}
 for(const [index,r] of s.rounds.entries()){
  const age=t-r.delay;if(age<0)continue;const a=age/g.travel,impactAge=age-g.travel;
  const aimLength=Math.max(1,Math.hypot(target.x-source.x,target.y-source.y)),aimX=(target.x-source.x)/aimLength,aimY=(target.y-source.y)/aimLength;
  const sx=source.x+aimX*(options.sourceRadius??28),sy=source.y+aimY*(options.sourceRadius??28);
  const miss=!s.hit&&f!=='data',range=miss?(close?12:90):-(options.targetRadius??28),spread=s.mode==='suppression'?r.offset:miss?55:0;
  const ex=target.x+aimX*range-aimY*spread,ey=target.y+aimY*range+aimX*spread,dx=ex-sx,dy=ey-sy,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len;
  if(options.visuals&&!s.reduced&&!options.resumeArea&&options.onLightPulse&&!lightRounds.has(index)){
   const explosive=f==='grenade'||f==='rocket',due=explosive?impactAge:age;
   if(due>=0){lightRounds.add(index);if(due*s.scale<150&&(explosive||f==='gun'||f==='shotgun'))options.onLightPulse(explosive?'impact':'source',explosive?{x:ex,y:ey}:{x:sx,y:sy});}
  }
  if(f==='rocket'&&a>=0&&a<1&&options.visuals&&!s.reduced&&!options.resumeArea){const curve=s.p.kind==='smart'?20:0;options.onLightMove?.({x:sx+dx*a,y:sy+dy*a+Math.sin(a*Math.PI)*curve});}
  if(options.lightOnly)continue;
  if(age<65&&['gun','shotgun','rocket'].includes(f))muzzleFlash(ctx,sx,sy,(g.flash||28)*(1-age/90),1-age/65,Math.atan2(uy,ux));
  if(a>=0&&a<1&&!s.reduced){ctx.save();ctx.shadowColor=color;ctx.shadowBlur=9;
   if(['thrownAxe','boomerang','throwingStar'].includes(f)){
    const arc=f==='boomerang'?65:25;
    const point=(p:number)=>({x:sx+dx*p-uy*Math.sin(p*Math.PI)*arc,y:sy+dy*p+ux*Math.sin(p*Math.PI)*arc});
    const at=point(a);projectileTrail(ctx,f,color,a,len,point);
    projectile(ctx,f,at.x,at.y,Math.atan2(dy,dx)+a*Math.PI*(f==='throwingStar'?10:6),color);
   }else if(f==='data'){dataStream(sx,sy,ex,ey,a,color)}else if(f==='grapple'){/* Hands are drawn through the grip/release phase below. */}else if(f==='grenade'||f==='arrow'){
    const arc=f==='grenade'?150:20,x=sx+dx*a,y=sy+dy*a-Math.sin(a*Math.PI)*arc;
    projectileTrail(ctx,f,color,a,len,p=>({x:sx+dx*p,y:sy+dy*p-Math.sin(p*Math.PI)*arc}));
    projectile(ctx,f,x,y,f==='grenade'?a*Math.PI*3:Math.atan2(dy-Math.cos(a*Math.PI)*Math.PI*arc,dx),color);
   }else if(f==='gun'||f==='shotgun'||f==='rocket'){
    const pellets=f==='shotgun'?7:1;
    for(let j=0;j<pellets;j++){
     const spread=(j-(pellets-1)/2)*7,curve=s.p.kind==='smart'?20:0,x=sx+dx*a,y=sy+dy*a+spread*a+Math.sin(a*Math.PI)*curve;
     const angle=Math.atan2(dy+spread+Math.cos(a*Math.PI)*Math.PI*curve,dx);
     projectileTrail(ctx,f,color,a,len,p=>({x:sx+dx*p,y:sy+dy*p+spread*p+Math.sin(p*Math.PI)*curve}));
     if(f==='rocket'){ctx.shadowBlur=0;line(x-Math.cos(angle)*68*PROJECTILE_SCALE,y-Math.sin(angle)*68*PROJECTILE_SCALE,x-Math.cos(angle)*35*PROJECTILE_SCALE,y-Math.sin(angle)*35*PROJECTILE_SCALE,'#9caaa52b',7*PROJECTILE_SCALE)}
     projectile(ctx,f,x,y,angle,color);
    }
   }
   ctx.restore();
  }
  if(f==='grapple'&&a<1.65&&!s.reduced)grappleStrike(ctx,sx,sy,target.x-aimX*(options.targetRadius??28),target.y-aimY*(options.targetRadius??28),a,Math.max(.75,Math.min(1.8,(options.sourceRadius??28)/28)),s.hit);
  if(['melee','blade','punch','martial'].includes(f)&&a<1.4&&!s.reduced)closeStrike(ctx,f,sx,sy,ex,ey,Math.atan2(uy,ux),a,Math.max(.75,Math.min(1.8,(options.sourceRadius??28)/28)),options.weapon,s.hit?(options.targetRadius??28)*1.2:0);
  if(options.area&&['grenade','rocket'].includes(f)&&impactAge>=0){
   const cells=options.area();
   if(options.areaPending){
    if(!areaStarted){areaStarted=true;if(cells.length)options.onAreaImpact?.();}
    if((!options.areaPending()||!cells.length)&&areaEndedAt===undefined)areaEndedAt=now;
    ctx.save();ctx.globalAlpha=areaEndedAt===undefined?1:Math.max(0,1-(now-areaEndedAt)/450);
    drawArea(ctx,cells,options.areaAmmo??options.ammo??'armorPiercing',impactAge/1100,s.reduced,true);ctx.restore();
   }else if(impactAge<1100)drawArea(ctx,cells,options.areaAmmo??options.ammo??'armorPiercing',impactAge/1100,s.reduced);
   continue;
  }
  if(impactAge>=0&&impactAge<650&&(!close||s.hit)){const k=impactAge/650,explosive=['grenade','rocket'].includes(f),radius=explosive?(g.impact??18)*(.2+k*2):(g.impact??18)*(1-k);
   if(f==='data')digitalImpact(ex,ey,k,!s.hit?'#ff536c':color);else physicalImpact(ex,ey,k,color,s,ux,uy);
   if(!s.reduced){ctx.save();ctx.globalAlpha=1-k;ctx.strokeStyle=color;ctx.lineWidth=explosive?3:1.5;
    for(let j=0;j<(explosive?(g.sparks??0):0);j++){const angle=j*2.399+s.seed,dist=6+k*(explosive?160:55);line(ex+Math.cos(angle)*dist,ey+Math.sin(angle)*dist,ex+Math.cos(angle)*(dist+7),ey+Math.sin(angle)*(dist+7)+k*k*15,color)}
    if(s.p.kind==='fire'||explosive){for(let j=0;j<10;j++){ctx.fillStyle=explosive?'#82909a44':color+'88';ctx.beginPath();ctx.arc(ex+Math.sin(j*5)*k*35,ey-k*65+j%3*5,Math.max(1,4+k*12),0,Math.PI*2);ctx.fill()}}
    if(f==='blade')line(ex-20,ey+25*k,ex+20,ey-25*k,color,2);
    ctx.restore();}
  }
 }
 if(options.areaPending?(!areaStarted||areaEndedAt===undefined||now-areaEndedAt<450):t<end)frame=requestAnimationFrame(draw);else{stop()}
}

frame=requestAnimationFrame(draw);return stop;
}
