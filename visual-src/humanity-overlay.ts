import {mountScreenEffect,removeScreenEffect} from './screen-effect-area.js';
export type HumanityStage = 'dissociative' | 'psychopathy' | 'cyberpsycho';
/** Peripheral shapes only: no scene duplication, HUD glitching or flashing. */
export function createHumanityOverlay() {
 let layer:HTMLDivElement|undefined, current:HumanityStage|undefined;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function stop() {
  layer?.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
  removeScreenEffect(layer);layer=undefined;current=undefined;
 }
 function start(stage:HumanityStage) {
  if(layer&&current===stage)return;
  stop();if(document.hidden)return;current=stage;
  layer=document.createElement('div');layer.id='pneuma-humanity-overlay';layer.dataset.stage=stage;layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{position:'fixed',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'1'});
  const level=stage==='dissociative'?1:stage==='psychopathy'?2:3;
  layer.style.background=level===1?'radial-gradient(ellipse, transparent 58%, #afbbca22 85%, #c8d4df44)':level===2?'radial-gradient(ellipse, transparent 55%, #54607133 82%, #31172066)':'radial-gradient(ellipse, transparent 50%, #650b2633 76%, #960d3a77)';
  mountScreenEffect(layer,true);
  for(let i=0;i<4;i++) {
   const shape=document.createElement('div');
   Object.assign(shape.style,{position:'absolute',left:i%2?'89cqw':'-13cqw',top:`${i*24-15}vh`,width:'24cqw',height:'48vh',border:level===1?'2px solid #cbd9e644':'none',borderRadius:level===3?'0':'50%',background:level===1?'transparent':level===2?'radial-gradient(ellipse,#9b294b33,transparent 65%)':'linear-gradient(130deg,transparent 35%,#cd285444 48%,transparent 62%)',filter:`blur(${level===3?3:12}px)`});
   if(level===3)shape.style.clipPath='polygon(5% 0,95% 15%,65% 48%,100% 78%,20% 100%,40% 55%)';
   layer.append(shape);
   if(!reduced.matches)shape.animate([{opacity:.25,transform:'translateY(-3vh) scale(.92)'},{opacity:level===3?.85:.6,transform:`translateY(4vh) scale(1.08) rotate(${level===3?8:0}deg)`}],{duration:level===1?11000+i*700:level===2?7000+i*600:4000+i*500,iterations:Infinity,direction:'alternate',easing:'ease-in-out'});
  }
 }
 reduced.addEventListener('change',()=>{const stage=current;if(stage){stop();start(stage);}});
 return {start,stop};
}
