import {createConditionScreen,createConditionToken} from './condition-renderers.js';
import {mountScreenEffect,removeScreenEffect} from './screen-effect-area.js';
import type {PatternKind} from './remaining-effects.js';
const colors:Record<PatternKind,string>={choking1:'#24050e',choking2:'#24050e',radiation:'#becf36',gas:'#97a390',blackLace:'#b62743',boost:'#48b6ef',synthcoke:'#8af3fa',berserker:'#145c36',primeTime:'#b297eb',sixgun:'#68cfd4',timewarp:'#a7d1ff'};
type SpecialDrug='berserker'|'primeTime'|'sixgun'|'timewarp';
function isSpecialDrug(kind:PatternKind):kind is SpecialDrug{return ['berserker','primeTime','sixgun','timewarp'].includes(kind);}

/** Peripheral vector motifs: no opaque veil or distortion of Foundry controls. */
function createDrugScreen(kind:SpecialDrug){
 if(kind==='primeTime')return createShieldScreen();
 let layer:HTMLDivElement|undefined;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const ns='http://www.w3.org/2000/svg';
 function stop(){layer?.getAnimations({subtree:true}).forEach(a=>a.cancel());removeScreenEffect(layer);layer=undefined;}
 function start(){
  if(layer||document.hidden)return;
  layer=document.createElement('div');layer.id=`pneuma-${kind}-overlay`;layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{position:'fixed',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'1',maskImage:'radial-gradient(ellipse, transparent 43%, #000 77%)'});
  mountScreenEffect(layer,false);
  for(let side=0;side<2;side++)for(let i=0;i<6;i++){
   const tile=document.createElement('div'),svg=document.createElementNS(ns,'svg');
   svg.setAttribute('viewBox','0 0 200 180');svg.setAttribute('width','100%');svg.setAttribute('height','100%');
   svg.style.overflow='visible';
   Object.assign(tile.style,{position:'absolute',top:`${i*18-10}%`,width:'clamp(140px, 23cqw, 330px)',height:'28vh',[side?'right':'left']:'-3%',opacity:reduced.matches?'.38':'.65'});
   if(side)svg.style.transform='scaleX(-1)';
   const path=(d:string,color:string,width:number,opacity=1)=>{
    const node=document.createElementNS(ns,'path');node.setAttribute('d',d);node.setAttribute('fill','none');node.setAttribute('stroke',color);node.setAttribute('stroke-width',String(width));node.setAttribute('stroke-opacity',String(opacity));node.setAttribute('stroke-linejoin','round');svg.append(node);return node;
   };
   if(kind==='berserker'){
    const d=`M -12 ${30+i%3*10} L 84 52 L 48 82 L 154 66 L 91 115 L 171 138`;
    // Red halo sits behind the dark green cut, keeping the core green.
    path(d,'#a91c35',11,.48).style.filter='blur(6px)';
    path(d,'#d02942',6,.35);path(d,'#12472c',4.5);path(d,'#267748',1.2,.8);
    path('M 10 126 L 72 102 L 42 147 L 122 131','#184f31',3);
   }else if(kind==='sixgun'){
    path('M 0 37 L 56 37 L 86 67 L 144 67 M 12 119 L 64 119 L 90 93 L 164 93','#387982',1.3,.65);
    for(let n=0;n<6;n++){
     const packet=path(`M ${15+n*24} ${n%2?89:63} h 11 v 8 h -11 Z`,n%3?'#68cfd4':'#e7bc76',1.5,.85);
     if(!reduced.matches)packet.animate([{opacity:.12,transform:'translateX(-9px)'},{opacity:.95,offset:.35},{opacity:.12,transform:'translateX(12px)'}],{duration:2400,delay:-n*360-i*280-side*600,iterations:Infinity,easing:'linear'});
    }
    path('M 155 57 L 169 57 L 169 72 M 169 87 L 169 103 L 155 103','#e7bc76',1.5,.7);
   }else{
    for(let echo=0;echo<4;echo++){
     const x=echo*13;
     path(`M ${x-35} 12 C ${x+135} 35 ${x-20} 93 ${x+150} 163`,echo%2?'#af9ee8':'#a7d1ff',3-echo*.5,.7-echo*.15);
    }
    for(let tick=0;tick<5;tick++)path(`M ${20+tick*23} ${48+tick*19} l 14 -4`,'#c3dafe',1,.4);
    svg.style.filter='drop-shadow(-8px 0 5px #8177bd66)';
   }
   tile.append(svg);layer.append(tile);
   if(!reduced.matches){
    const duration=kind==='berserker'?2900+i*170:kind==='sixgun'?6200+i*230:4800+i*280;
    const shift=kind==='berserker'?'translate(9px,-6px)':kind==='timewarp'?'translate(32px,12px) skewY(-8deg)':'translate(0,6px)';
    tile.animate([{opacity:.18,transform:'translate(0,0)'},{opacity:kind==='berserker'?.85:.65,transform:shift,offset:.45},{opacity:.18,transform:'translate(0,0)'}],{duration,delay:-i*977-side*1300,iterations:Infinity,easing:'ease-in-out'});
   }
  }
 }
 reduced.addEventListener('change',()=>{if(layer){stop();start();}});
 return {start,stop};
}

/** Bounded graphics pool; the caller supplies the shared token artwork mask. */
function createDrugToken(kind:SpecialDrug){
 const container=new PIXI.Container();container.eventMode='none';
 const shapes=new PIXI.Graphics();container.addChild(shapes);
 function update(w:number,h:number,time:number,phase:number,stationary:boolean){
  const t=stationary?0:time,r=Math.min(w,h),pulse=stationary?.55:.5+.5*Math.sin(t*(kind==='berserker'?2.3:.85)+phase);
  shapes.clear();
  const stroke=(points:number[],width:number,color:number,alpha:number)=>{
   shapes.lineStyle(Math.max(.6,width),color,alpha);shapes.moveTo(points[0]!,points[1]!);
   for(let j=2;j<points.length;j+=2)shapes.lineTo(points[j]!,points[j+1]!);
  };
  if(kind==='berserker'){
   for(let i=0;i<5;i++){
    const y=h*(.1+i*.19),s=stationary?0:Math.sin(t*1.8+i+phase)*r*.025;
    const points=[w*.06,y+s,w*.46,y+h*.04+s,w*.29,y+h*.11+s,w*.82,y+h*.03+s,w*.64,y+h*.17+s];
    stroke(points,r*.10,0x95162e,.08+pulse*.08);stroke(points,r*.055,0xcc2740,.15+pulse*.13);
    stroke(points,r*.029,0x12472c,.9);stroke(points,r*.009,0x267748,.65);
   }
  }else if(kind==='primeTime'){
   drawShieldToken(shapes,w,h,t+phase,stationary);
  }else if(kind==='sixgun'){
   for(let i=0;i<6;i++){
    const y=h*(.13+i*.145),p=stationary?.5:(t*.22+i*.16+phase*.1)%1,x=w*(.1+p*.76);
    stroke([w*.09,y,w*.35,y,w*.44,y+h*.025,w*.91,y+h*.025],r*.008,0x387982,.35);
    shapes.lineStyle(0);shapes.beginFill(i%3?0x68cfd4:0xe7bc76,.65);shapes.drawRect(x,y-h*.015,r*.07,r*.035);shapes.endFill();
    stroke([w*.87,y-h*.02,w*.93,y-h*.02,w*.93,y+h*.045],r*.008,0x68cfd4,.45);
   }
  }else{
   for(let band=0;band<3;band++)for(let echo=3;echo>=0;echo--){
    const points:number[]=[];
    for(let j=0;j<=12;j++){const p=j/12;points.push(w*(.04+p*.92),h*(.18+band*.27+Math.sin(p*4-t*1.5+phase)*.065)+echo*r*.025);}
    stroke(points,r*(echo===0?.018:.01),echo%2?0xaf9ee8:0xa7d1ff,(.5-echo*.1)*(stationary?.65:.7+pulse*.3));
   }
  }
 }
 return {container,update,destroy:()=>container.destroy({children:true})};
}
export function createPatternScreen(kind:PatternKind){
 if(kind==='choking1'||kind==='choking2')return createConditionScreen(kind);
 if(kind==='blackLace')return createLaceScreen();
 if(kind==='boost')return createBoostJetScreen();
 if(isSpecialDrug(kind))return createDrugScreen(kind);
 let layer:HTMLDivElement|undefined;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function stop(){layer?.getAnimations({subtree:true}).forEach(a=>a.cancel());removeScreenEffect(layer);layer=undefined;}
 function start(){if(layer||document.hidden)return;
  layer=document.createElement('div');layer.id=`pneuma-${kind}-overlay`;layer.setAttribute('aria-hidden','true');Object.assign(layer.style,{position:'fixed',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'1',maskImage:'radial-gradient(ellipse, transparent 45%, #000 80%)'});mountScreenEffect(layer,!['boost','synthcoke'].includes(kind));
  if(['gas','blackLace','radiation'].includes(kind))layer.style.background=`radial-gradient(ellipse, transparent 55%, ${colors[kind]}44 85%, ${kind==='blackLace'?'#130e1bbb':colors[kind]+'66'})`;
  for(let i=0;i<(kind==='synthcoke'?14:8);i++){
   const patch=document.createElement('div'),side=i%2;const geometric=['boost','synthcoke'].includes(kind);
   Object.assign(patch.style,{position:'absolute',left:side?'83%':'-18%',top:`${i*14-15}%`,width:geometric?'35cqw':'44cqw',height:geometric?'24vh':'45vh',opacity:'.35',borderRadius:kind==='boost'?'15%':'50%',border:geometric?`2px solid ${colors[kind]}`:'none',background:geometric?'transparent':`radial-gradient(ellipse at 35% 45%, ${colors[kind]}99, transparent 65%)`,filter:geometric?'none':'blur(20px)'});
   if(geometric){patch.style.width='18cqw';patch.style.left=side?'calc(100% - 18cqw - 12px)':'12px';}
   if(kind==='boost')patch.style.transform='rotate(45deg)';
   if(kind==='synthcoke'){patch.style.top=`${(i*17)%105-5}%`;patch.style.width='46cqw';patch.style.left=side?'calc(100% - 46cqw - 12px)':'12px';patch.style.height=`${3+i%3}px`;patch.style.border='none';patch.style.background='linear-gradient(90deg,transparent,#8af3fa 25%,#ffffff 60%,transparent)';patch.style.boxShadow='0 0 12px #8af3fa99';}
   if(kind==='gas')patch.style.boxShadow='inset 0 0 30px #aa363633';
   if(kind==='blackLace'){patch.style.clipPath='polygon(0 0,85% 15%,40% 38%,100% 55%,45% 72%,70% 100%,0 85%)';patch.style.filter='blur(5px)';patch.style.background='linear-gradient(120deg,#140c18aa,#b6274377,transparent)';}
   if(kind==='radiation')patch.style.background='radial-gradient(ellipse,#becf3677,transparent 70%),repeating-linear-gradient(80deg,transparent 0 19px,#e4ed8044 20px,transparent 22px)';
   layer.append(patch);
   if(!reduced.matches){const duration=kind==='synthcoke'?1100+i*67:kind==='blackLace'?3300+i*137:6000+i*431;patch.animate([{opacity:.05,transform:'translate(-2cqw,-2vh) scale(.75)'},{opacity:kind==='synthcoke'?.9:kind==='blackLace'?.65:.45,transform:`translate(2cqw,3vh) scale(1.2) rotate(${kind==='boost'?45:0}deg)`,offset:.5},{opacity:.05,transform:'translate(-2cqw,-2vh) scale(.75)'}],{duration,delay:-i*871,iterations:Infinity,easing:'ease-in-out'});}
  }
 }
 reduced.addEventListener('change',()=>{if(layer){stop();start();}});return {start,stop};
}
/** Seamlessly repeating graphic exhaust flowing down both screen edges. */
function createBoostJetScreen(){
 let layer:HTMLDivElement|undefined,height=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),ns='http://www.w3.org/2000/svg';
 function stop(){layer?.getAnimations({subtree:true}).forEach(a=>a.cancel());removeScreenEffect(layer);layer=undefined;height=0;}
 function render(){
  if(!layer||height===innerHeight)return;height=innerHeight;
  layer.getAnimations({subtree:true}).forEach(a=>a.cancel());layer.replaceChildren();
  for(let side=0;side<2;side++){
   const rail=document.createElement('div');Object.assign(rail.style,{position:'absolute',top:'0',bottom:'0',width:'min(200px, 18cqw)',overflow:'hidden',[side?'right':'left']:'0',maskImage:'linear-gradient(to '+(side?'left':'right')+',#000,rgba(0,0,0,.8) 38%,transparent)'});
   const svg=document.createElementNS(ns,'svg');svg.setAttribute('width','200');svg.setAttribute('height',String(height));svg.setAttribute('viewBox','0 0 200 '+height);Object.assign(svg.style,{position:'absolute',top:'0',[side?'right':'left']:'0',maxWidth:'none',transform:side?'scaleX(-1)':'none'});
   // Each band repeats exactly every 240px, so the downward loop has no jump.
   for(let band=0;band<3;band++){
    const flow=document.createElementNS(ns,'g');flow.dataset.boostFlow=String(band);
    const scale=[1,.72,.42][band]!,color=['#e8ba15','#ffe329','#fff7a0'][band]!;
    for(let y=-240;y<height+480;y+=240){
     const flame=document.createElementNS(ns,'path');
     flame.setAttribute('d','M 0 '+y+' H 54 C 37 '+(y+40)+' 99 '+(y+71)+' 90 '+(y+124)+' C 83 '+(y+106)+' 69 '+(y+95)+' 65 '+(y+91)+' C 72 '+(y+147)+' 147 '+(y+177)+' 127 '+(y+233)+' C 114 '+(y+213)+' 100 '+(y+206)+' 88 '+(y+198)+' C 95 '+(y+222)+' 66 '+(y+237)+' 54 '+(y+240)+' H 0 Z');
     flame.setAttribute('fill',color);flame.setAttribute('fill-opacity',String([.176,.32,.52][band]));flame.setAttribute('transform','scale('+scale+' 1)');flow.append(flame);
     const streak=document.createElementNS(ns,'path');
     streak.setAttribute('d','M 110 '+(y+8)+' C 98 '+(y+53)+' 145 '+(y+105)+' 137 '+(y+159)+' C 168 '+(y+106)+' 120 '+(y+61)+' 110 '+(y+8)+' Z');
     streak.setAttribute('fill',color);streak.setAttribute('fill-opacity',String([.096,.224,.32][band]));streak.setAttribute('transform','scale('+scale+' 1)');flow.append(streak);
    }
    svg.append(flow);
    if(!reduced.matches)flow.animate([{transform:'translateY(-240px)'},{transform:'translateY(0px)'}],{duration:[1875,1312.5,925][band],delay:-band*317,iterations:Infinity,easing:'linear'});
   }
   rail.append(svg);layer.append(rail);
  }
 }
 function start(){if(layer||document.hidden)return;layer=document.createElement('div');layer.id='pneuma-boost-overlay';layer.setAttribute('aria-hidden','true');Object.assign(layer.style,{inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'1'});mountScreenEffect(layer,false,render);}
 reduced.addEventListener('change',()=>{if(layer){stop();start();}});
 return {start,stop};
}
let cloud:PIXI.Texture|undefined;
/** Rasterize the embroidery once; animation only moves the shared texture. */
let laceImage:HTMLCanvasElement|undefined,laceUrl:string|undefined,laceTexture:PIXI.Texture|undefined;
function laceTile():HTMLCanvasElement{
 if(laceImage)return laceImage;
 const image=document.createElement('canvas');image.width=image.height=384;
 const c=image.getContext('2d')!;c.scale(2,2);c.strokeStyle='#000';c.fillStyle='#000';c.lineCap='round';c.lineJoin='round';
 const stroke=(width:number,alpha=1)=>{c.lineWidth=width;c.globalAlpha=alpha;c.stroke();c.globalAlpha=1;};
 // Open net ground with embroidered shell motifs, not isolated rings.
 for(let y=-192;y<384;y+=12){c.beginPath();c.moveTo(0,y);c.lineTo(192,y+192);c.moveTo(0,y);c.lineTo(192,y-192);stroke(.65,.42);}
 for(let row=-1;row<3;row++)for(let col=-1;col<3;col++){
  const x=col*96+48+(row%2?48:0),y=row*96+44;
  c.save();c.translate(x,y);
  // Clear the net inside the scalloped shell so its openwork remains legible.
  c.globalCompositeOperation='destination-out';c.beginPath();c.moveTo(0,39);c.bezierCurveTo(-48,12,-43,-33,0,-35);c.bezierCurveTo(43,-33,48,12,0,39);c.fill();c.globalCompositeOperation='source-over';
  c.beginPath();c.moveTo(0,39);c.bezierCurveTo(-47,10,-43,-30,0,-34);c.bezierCurveTo(43,-30,47,10,0,39);stroke(4.4);
  // A scalloped fan and its stitched ribs form the lace body.
  for(let k=0;k<7;k++){
   const angle=Math.PI+(k+.5)*Math.PI/7,px=Math.cos(angle)*32,py=Math.sin(angle)*27;
   c.beginPath();c.moveTo(0,30);c.quadraticCurveTo(px*.9,5,px,py);stroke(1.7);
   c.beginPath();c.ellipse(px,py,6.3,8.5,angle+Math.PI/2,0,Math.PI*2);stroke(2.2);
  }
  c.beginPath();c.moveTo(-30,1);c.quadraticCurveTo(0,-18,30,1);stroke(2.5);
  c.beginPath();c.moveTo(-22,14);c.quadraticCurveTo(0,0,22,14);stroke(2);
  // Small stitch holes along the joining ribbons.
  c.beginPath();c.moveTo(0,39);c.bezierCurveTo(15,52,38,44,48,52);stroke(3.4);
  c.beginPath();c.moveTo(0,39);c.bezierCurveTo(-15,52,-38,44,-48,52);stroke(3.4);
  c.restore();
 }
 // Bake the subtle exterior softness once, then put opaque thread cores on top.
 const softened=document.createElement('canvas');softened.width=softened.height=384;const out=softened.getContext('2d')!;out.shadowColor='#000';out.shadowBlur=2;out.drawImage(image,0,0);out.shadowBlur=0;out.drawImage(image,0,0);
 laceImage=softened;return softened;
}
function createLaceScreen(){
 let layer:HTMLDivElement|undefined;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function stop(){layer?.getAnimations({subtree:true}).forEach(a=>a.cancel());removeScreenEffect(layer);layer=undefined;}
 function start(){
  if(layer||document.hidden)return;
  laceUrl??=laceTile().toDataURL();layer=document.createElement('div');layer.id='pneuma-blackLace-overlay';layer.setAttribute('aria-hidden','true');Object.assign(layer.style,{inset:'0',pointerEvents:'none',overflow:'hidden',zIndex:'1'});
  for(let side=0;side<2;side++){
   const rail=document.createElement('div');Object.assign(rail.style,{position:'absolute',top:'0',bottom:'0',width:'min(280px, 25cqw)',overflow:'hidden',[side?'right':'left']:'0',maskImage:'linear-gradient(to '+(side?'left':'right')+',#000 0%,#000 20%,transparent 100%)'});
   const fabric=document.createElement('div');fabric.dataset.laceFabric='';Object.assign(fabric.style,{position:'absolute',inset:'-8px',backgroundImage:'url('+laceUrl+')',backgroundSize:'192px 192px',backgroundRepeat:'repeat'});rail.append(fabric);layer.append(rail);
   if(!reduced.matches)fabric.animate([{transform:'translateY(-3px)'},{transform:'translateY(3px)'},{transform:'translateY(-3px)'}],{duration:9200,delay:-side*3100,iterations:Infinity,easing:'ease-in-out'});
  }
  mountScreenEffect(layer,false);
 }
 reduced.addEventListener('change',()=>{if(layer){stop();start();}});return {start,stop};
}
function createLaceToken(){
 if(!laceTexture||laceTexture.destroyed){
  const tile=document.createElement('canvas');tile.width=tile.height=64;
  const c=tile.getContext('2d')!;c.scale(2,2);c.strokeStyle='#000';c.lineWidth=.85;
  c.beginPath();c.moveTo(0,16);c.quadraticCurveTo(10,10,16,0);c.quadraticCurveTo(22,10,32,16);c.quadraticCurveTo(22,22,16,32);c.quadraticCurveTo(10,22,0,16);c.stroke();
  laceTexture=PIXI.Texture.from(tile);
 }
 const container=new PIXI.Container();container.eventMode='none';const fabric=new PIXI.TilingSprite(laceTexture,1,1);fabric.alpha=.22;container.addChild(fabric);
 function update(w:number,h:number,_time:number,_phase:number,_stationary:boolean){
  fabric.width=w;fabric.height=h;fabric.tileScale.set(Math.max(12,Math.min(w,h)*.15)/64);
 }
 return {container,update,destroy:()=>container.destroy({children:true,texture:false,baseTexture:false})};
}
export function createPatternToken(kind:PatternKind){
 if(kind==='choking1'||kind==='choking2')return createConditionToken(kind);
 if(kind==='blackLace')return createLaceToken();
 if(isSpecialDrug(kind))return createDrugToken(kind);
 const container=new PIXI.Container();container.eventMode='none';const shapes=new PIXI.Graphics();container.addChild(shapes);
 const fog:PIXI.Sprite[]=[];
 if(['radiation','gas'].includes(kind)){
  if(!cloud||cloud.destroyed){const image=document.createElement('canvas');image.width=image.height=128;const ctx=image.getContext('2d')!,gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,.7)');gradient.addColorStop(.4,'rgba(255,255,255,.4)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);cloud=PIXI.Texture.from(image);}
  for(let i=0;i<5;i++){const sprite=new PIXI.Sprite(cloud);sprite.anchor.set(.5);sprite.tint=Number.parseInt(colors[kind].slice(1),16);container.addChild(sprite);fog.push(sprite);}
 }
 function update(w:number,h:number,time:number,phase:number,stationary:boolean){
  const t=stationary?0:time,r=Math.min(w,h),color=Number.parseInt(colors[kind].slice(1),16);
  shapes.clear();
  fog.forEach((sprite,i)=>{const pulse=(Math.sin(t*.7+i*1.8+phase)+1)/2;sprite.position.set(w*(.2+(i%3)*.3)+Math.sin(t*.2+i)*w*.035,h*(i<3?.25:.75));sprite.width=w*(.6+pulse*.2);sprite.height=h*(.6+pulse*.2);sprite.alpha=.16+pulse*.28;});
  if(kind==='boost')drawBoostJetToken(shapes,w,h,t+phase,stationary);
  if(kind==='synthcoke'){shapes.lineStyle(Math.max(1,r*.018),color,.3+.2*Math.sin(t*2));for(let i=0;i<4;i++){const y=h*((i*.23+t*.14)%1);shapes.moveTo(w*.12,y);shapes.lineTo(w*.65,y-r*.08);}}
  if(kind==='radiation'){shapes.beginFill(0xe4ed80,.4);for(let i=0;i<7;i++)shapes.drawCircle(w*((i*.173+phase*.1)%1),h*((i*.137+t*.025)%1),Math.max(1,r*.012));shapes.endFill();}
 }
 return {container,update,destroy:()=>container.destroy({children:true,texture:false,baseTexture:false})};
}

/** Same descending flame silhouette, palette and cadence as the screen jets. */
function drawBoostJetToken(shapes:PIXI.Graphics,w:number,h:number,time:number,stationary:boolean){
 const period=h*.65,sy=period/240;
 shapes.lineStyle(0);
 for(let side=0;side<2;side++)for(let band=0;band<3;band++){
  const scale=[1,.72,.42][band]!,sx=w*.28/150*scale;
  const x=(v:number)=>side?w-v*sx:v*sx;
  const offset=stationary?0:((time*1000+band*317)/[1875,1312.5,925][band]!%1)*period;
  for(let row=-2;row*period<h;row++){
   const y=(v:number)=>row*period+offset+v*sy;
   shapes.beginFill([0xe8ba15,0xffe329,0xfff7a0][band]!,[.176,.32,.52][band]);
   shapes.moveTo(x(0),y(0));shapes.lineTo(x(54),y(0));
   shapes.bezierCurveTo(x(37),y(40),x(99),y(71),x(90),y(124));
   shapes.bezierCurveTo(x(83),y(106),x(69),y(95),x(65),y(91));
   shapes.bezierCurveTo(x(72),y(147),x(147),y(177),x(127),y(233));
   shapes.bezierCurveTo(x(114),y(213),x(100),y(206),x(88),y(198));
   shapes.bezierCurveTo(x(95),y(222),x(66),y(237),x(54),y(240));
   shapes.lineTo(x(0),y(240));shapes.closePath();shapes.endFill();
   shapes.beginFill([0xe8ba15,0xffe329,0xfff7a0][band]!,[.096,.224,.32][band]);
   shapes.moveTo(x(110),y(8));shapes.bezierCurveTo(x(98),y(53),x(145),y(105),x(137),y(159));
   shapes.bezierCurveTo(x(168),y(106),x(120),y(61),x(110),y(8));shapes.closePath();shapes.endFill();
  }
 }
}

// Prime Time: aligned rounded triangle outlines with sparse cyan highlights.
const shieldColor='#617c91';
function shieldJunctions(cells:number[][]):number[][]{
 const points=new Map<string,number[]>();
 for(const cell of cells)for(const j of [0,2,4]){
  const x=cell[j]!,y=cell[j+1]!;
  if(x>=0&&x<=1&&y>=0&&y<=1)points.set(`${x},${y}`,[x,y]);
 }
 return [...points.values()];
}
function shieldCells(cols:number,rows:number):number[][]{
 const cells:number[][]=[];
 // Alternate orientation in both axes so adjacent triangles share full edges.
 // The extra top row closes the mesh at the viewport boundary.
 for(let y=-1;y<rows;y++)for(let x=0;x<cols;x++){
  const left=x/cols,right=(x+1)/cols,top=y/rows,middle=(y+1)/rows,bottom=(y+2)/rows;
  cells.push((x+y)%2===0?[left,top,right,middle,left,bottom]:[right,top,left,middle,right,bottom]);
 }
 return cells;
}
function roundedShield(vertices:number[]):number[][]{
 const cx=(vertices[0]!+vertices[2]!+vertices[4]!)/3,cy=(vertices[1]!+vertices[3]!+vertices[5]!)/3;
 // Inset each outline ten percent, leaving a narrow seam between neighbors.
 const points=vertices.map((v,i)=>(i%2?cy:cx)+(v-(i%2?cy:cx))*.9);
 return [0,2,4].map(i=>{
  const prev=(i+4)%6,next=(i+2)%6,x=points[i]!,y=points[i+1]!;
  return [x+(points[prev]!-x)*.20,y+(points[prev+1]!-y)*.20,x,y,x+(points[next]!-x)*.20,y+(points[next+1]!-y)*.20];
 });
}
/** A permutation keeps highlights staggered regardless of the polygon count. */
function shieldOrder(count:number):number[]{
 const order=Array.from({length:count},(_,i)=>i);let seed=193;
 for(let i=count-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j]!,order[i]!];}
 return order;
}
function createShieldScreen(){
 let layer:HTMLDivElement|undefined;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function stop(){layer?.getAnimations({subtree:true}).forEach(a=>a.cancel());removeScreenEffect(layer);layer=undefined;}
 function start(){
  if(layer||document.hidden)return;
  layer=document.createElement('div');layer.id='pneuma-primeTime-overlay';layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{position:'fixed',inset:'0',pointerEvents:'none',overflow:'hidden',zIndex:'1'});
  let renderedHeight=0;
  const render=()=>{
  if(!layer||renderedHeight===innerHeight)return;renderedHeight=innerHeight;
  layer.getAnimations({subtree:true}).forEach(a=>a.cancel());layer.replaceChildren();
  // Fixed pixel cells: resizing changes row count and clipping, not proportions.
  const rows=Math.max(2,Math.ceil(innerHeight/35)),height=rows*35,width=240;
  const ns='http://www.w3.org/2000/svg',cells=shieldCells(4,rows);
  for(let side=0;side<2;side++){
   // Keep highlights within the visible band, away from clipped/faded cells.
   const eligible=cells.map((p,i)=>({i,x:(p[0]!+p[2]!+p[4]!)/3,p})).filter(({x,p})=>p[1]!>=0&&p[5]!<=1&&(side?x>.35:x<.65)).map(({i})=>i);
   const order=shieldOrder(eligible.length),slots=new Map(eligible.map((i,j)=>[i,order[j]!])),cycle=eligible.length*1200;
   const rail=document.createElement('div');Object.assign(rail.style,{position:'absolute',top:'0',bottom:'0',width:'min(240px, 20cqw)',overflow:'hidden',[side?'right':'left']:'0',maskImage:`linear-gradient(to ${side?'left':'right'},rgba(0,0,0,.85) 0%,rgba(0,0,0,.45) 40%,transparent 100%)`});
   const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));Object.assign(svg.style,{position:'absolute',top:'0',[side?'right':'left']:'0',maxWidth:'none'});
   const defs=document.createElementNS(ns,'defs'),gradient=document.createElementNS(ns,'radialGradient');
   const gradientId=`pneuma-primeTime-surface-${side}`;gradient.id=gradientId;
   gradient.setAttribute('cx','35%');gradient.setAttribute('cy','30%');gradient.setAttribute('r','75%');
   for(const [offset,opacity] of [['0%','.28'],['55%','.12'],['100%','0']]){
    const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',offset!);stop.setAttribute('stop-color',shieldColor);stop.setAttribute('stop-opacity',opacity!);gradient.append(stop);
   }
   defs.append(gradient);svg.append(defs);
   cells.forEach((coords,i)=>{
    const piece=document.createElementNS(ns,'path'),base=shieldColor;
    const corners=roundedShield(coords.map((v,j)=>v*(j%2?height:width)));
    const d=corners.map((p,j)=>`${j?'L':'M'} ${p[0]} ${p[1]} Q ${p[2]} ${p[3]} ${p[4]} ${p[5]}`).join(' ')+' Z';
    piece.setAttribute('d',d);piece.setAttribute('fill',`url(#${gradientId})`);piece.setAttribute('stroke',base);piece.setAttribute('stroke-width','1.2');piece.setAttribute('stroke-linejoin','round');piece.style.opacity='.45';piece.style.filter='drop-shadow(0 0 2px #617c9180)';svg.append(piece);
    if(!reduced.matches&&slots.has(i)){
     const slot=slots.get(i)!;
     piece.animate([{stroke:base,opacity:.45,offset:0},{stroke:'#2ce9ff',opacity:.85,offset:300/cycle},{stroke:base,opacity:.45,offset:4800/cycle},{stroke:base,opacity:.45,offset:1}],{duration:cycle,delay:-cycle+slot*1200-side*600,iterations:Infinity,easing:'linear'});
    }
   });
   for(const [x,y] of shieldJunctions(cells)){
    const node=document.createElementNS(ns,'polygon'),px=x!*width,py=y!*height;
    node.setAttribute('points',`${px},${py-3.6} ${px+3},${py} ${px},${py+3.6} ${px-3},${py}`);
    node.setAttribute('fill','#c39b69');node.setAttribute('opacity','.32');node.style.filter='drop-shadow(0 0 2px #c39b6940)';svg.append(node);
   }
   rail.append(svg);layer!.append(rail);
  }
  };
  mountScreenEffect(layer,false,render);
 }
 reduced.addEventListener('change',()=>{if(layer){stop();start();}});return {start,stop};
}
const shieldTokenCells=shieldCells(4,7),shieldTokenOrder=shieldOrder(shieldTokenCells.length);
function drawShieldToken(shapes:PIXI.Graphics,w:number,h:number,time:number,stationary:boolean){
 const cells=shieldTokenCells,cycle=cells.length*3.1;
 cells.forEach((coords,i)=>{
  const age=(time+shieldTokenOrder[i]!*3.1)%cycle;
  const glow=stationary?0:age<.3?age/.3:age<4.8?Math.pow(1-(age-.3)/4.5,1.4):0;
  const base=0x617c91,cyan=0x2ce9ff;
  const color=[16,8,0].reduce((value,shift)=>value|(Math.round(((base>>shift)&255)*(1-glow)+((cyan>>shift)&255)*glow)<<shift),0);
  const corners=roundedShield(coords.map((v,j)=>v*(j%2?h:w)));
  const trace=()=>{
   shapes.moveTo(corners[0]![0]!,corners[0]![1]!);
   for(const p of corners){shapes.lineTo(p[0]!,p[1]!);shapes.quadraticCurveTo(p[2]!,p[3]!,p[4]!,p[5]!);}shapes.closePath();
  };
  // Layered translucent strokes soften the outline without per-token filters.
  for(const [width,alpha] of [[.025,.035],[.014,.07],[.0045,.38+glow*.45]]){
   shapes.lineStyle(Math.max(.65,Math.min(w,h)*width!),color,alpha!);trace();
  }
  const cx=(coords[0]!+coords[2]!+coords[4]!)*w/3,cy=(coords[1]!+coords[3]!+coords[5]!)*h/3;
  shapes.lineStyle(0);
  for(let band=0;band<6;band++){
   const scale=1-band*.14;shapes.beginFill(color,.018);
   const point=(x:number,y:number)=>[cx+(x-cx)*scale,cy+(y-cy)*scale];
   const first=point(corners[0]![0]!,corners[0]![1]!);shapes.moveTo(first[0]!,first[1]!);
   for(const p of corners){const a=point(p[0]!,p[1]!),b=point(p[2]!,p[3]!),c=point(p[4]!,p[5]!);shapes.lineTo(a[0]!,a[1]!);shapes.quadraticCurveTo(b[0]!,b[1]!,c[0]!,c[1]!);}shapes.closePath();shapes.endFill();
  }
 });
 shapes.lineStyle(0);shapes.beginFill(0xc39b69,.48);
 for(const [x,y] of shieldJunctions(cells)){const px=x!*w,py=y!*h,r=Math.min(w,h)*.011;shapes.drawPolygon([px,py-r,px+r,py,px,py+r,px-r,py]);}
 shapes.endFill();
}
