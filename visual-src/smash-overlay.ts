import {mountScreenEffect,removeScreenEffect} from './screen-effect-area.js';
const smileys=['😀','😄','😊','😁','🙂','😎'];
const partyColors=['#75e6ee','#f498dc','#ffd76b','#a99aff'];
export function createSmashScreenOverlay() {
 let layer:HTMLDivElement|undefined,confettiTimer:ReturnType<typeof setTimeout>|undefined;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function stop(){if(confettiTimer!==undefined)clearTimeout(confettiTimer);confettiTimer=undefined;layer?.getAnimations({subtree:true}).forEach(animation=>animation.cancel());removeScreenEffect(layer);layer=undefined;}
 function start(){
  if(layer||document.hidden)return;
  layer=document.createElement('div');layer.id='pneuma-smash-overlay';layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{position:'fixed',inset:'0',pointerEvents:'none',overflow:'hidden',zIndex:'1'});
  mountScreenEffect(layer,false);
  for(let side=0;side<2;side++) {
   const rail=document.createElement('div');Object.assign(rail.style,{position:'absolute',top:'0',bottom:'0',width:'clamp(160px, 24cqw, 220px)',overflow:'visible',[side?'right':'left']:'0'});layer.append(rail);
   for(let i=0;i<6;i++) {
    const face=document.createElement('span');face.textContent=smileys[(i+side*2)%smileys.length]!;
    Object.assign(face.style,{position:'absolute',left:`clamp(36px, ${20+(i%3)*25}%, calc(100% - 36px))`,transform:'translateX(-50%)',top:reduced.matches?`${16+i*12}%`:'100%',fontFamily:'"Segoe UI Emoji", "Apple Color Emoji", sans-serif',fontSize:`${26+(i%3)*5}px`,lineHeight:'1',opacity:reduced.matches?'.35':'0'});rail.append(face);
    if(!reduced.matches){
     face.animate([{transform:'translate(-50%, 30px)',opacity:0},{opacity:.75,offset:.08},{opacity:.7,offset:.87},{transform:'translate(-50%, calc(-100vh - 70px))',opacity:0}],{duration:11000+i*1300+side*800,delay:-i*2300-side*3700,iterations:Infinity,easing:'linear'});
     face.animate([{marginLeft:'-7px',rotate:'-12deg'},{marginLeft:'7px',rotate:'12deg'}],{duration:1500+i*230,delay:-i*611,iterations:Infinity,direction:'alternate',easing:'ease-in-out'});
    }
   }
   for(let i=0;i<4;i++){
    const bubble=document.createElement('span');const size=24+i*7;
    Object.assign(bubble.style,{position:'absolute',left:`clamp(36px, ${25+i*15}%, calc(100% - 36px))`,top:reduced.matches?`${23+i*17}%`:'100%',width:`${size}px`,height:`${size}px`,borderRadius:'50%',border:`1px solid ${partyColors[(i+side)%4]}99`,background:'radial-gradient(circle at 28% 25%,#ffffffaa,transparent 24%),radial-gradient(circle,transparent 55%,#bdefff44 85%,#fbbcee55)',boxShadow:'inset -3px -3px 8px #bfa4ee33',opacity:reduced.matches?'.25':'0',transform:'translateX(-50%)'});rail.append(bubble);
    if(!reduced.matches)bubble.animate([{transform:'translate(-50%, 35px)',opacity:0},{opacity:.5,offset:.12},{opacity:.4,offset:.82},{transform:'translate(calc(-50% + 8px), calc(-100vh - 70px))',opacity:0}],{duration:14500+i*1900,delay:-i*4100-side*5300,iterations:Infinity,easing:'linear'});
   }
  }
  const confetti=()=>{
   if(!layer||reduced.matches)return;
   for(const rail of Array.from(layer.children))for(let i=0;i<36;i++){
    const piece=document.createElement('span');Object.assign(piece.style,{position:'absolute',left:'50%',top:'-14px',width:'5px',height:'9px',background:partyColors[i%4],borderRadius:'1px'});rail.append(piece);
    // Fan out quickly from the top center, then flutter down across the smiley rail.
    // Stratified positions cover the rail even when a burst has unlucky random values.
    const spread=5+90*(i+Math.random())/36;
    const drift=(Math.random()-.5)*8;
    const landing=Math.max(4,Math.min(96,spread+drift));
    const animation=piece.animate([
     {left:'50%',opacity:0,transform:'translate(-50%, 0) rotate(0deg)',easing:'cubic-bezier(0, .6, .3, 1)'},
     {left:`${spread}%`,opacity:.7,offset:.10,transform:`translate(-50%, ${30+Math.random()*35}px) rotate(${90+i*11}deg)`},
     {left:`${landing}%`,opacity:.6,offset:.9,transform:`translate(-50%, 90vh) rotate(${480+i*39}deg)`},
     {left:`${spread}%`,opacity:0,transform:`translate(-50%, calc(100vh + 28px)) rotate(${540+i*43}deg)`}
    ],{duration:6500+Math.random()*2500,easing:'linear'});animation.onfinish=()=>piece.remove();
   }
   confettiTimer=setTimeout(confetti,14000+Math.random()*7000);
  };
  if(!reduced.matches)confettiTimer=setTimeout(confetti,6000);
 }
 reduced.addEventListener('change',()=>{if(layer){stop();start();}});
 return {start,stop};
}
export function createTokenSmashOverlay() {
 const container=new PIXI.Container();container.eventMode='none';
 const faces=Array.from({length:3},(_,i)=>{const face=new PIXI.Text(smileys[i*2]!,{fontFamily:'Segoe UI Emoji, Apple Color Emoji, sans-serif',fontSize:48});face.anchor.set(.5);face.eventMode='none';container.addChild(face);return face;});
 function update(w:number,h:number,time:number,phase:number,stationary:boolean){
  const size=Math.min(w,h)*.18;
  faces.forEach((face,i)=>{
   const t=stationary?0:time,p=stationary?(i+.5)/3:((t/(8+i*.8)+i/3+phase/7)%1);
   face.width=face.height=size;
   face.position.set(w*(.22+i*.28)+Math.sin(t*1.4+i*1.4)*w*.035,h*(1.15-p*1.3));
   face.rotation=stationary?0:Math.sin(t*1.5+i)*.16;
   face.alpha=stationary?.3:Math.min(1,p*8,(1-p)*8)*.65;
  });
 }
 return {container,update,destroy:()=>container.destroy({children:true})};
}
