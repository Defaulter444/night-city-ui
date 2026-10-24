import {mountScreenEffect,removeScreenEffect} from './screen-effect-area.js';
export function createDazzleScreen(){
 let layer:HTMLDivElement|undefined,white:HTMLDivElement|undefined;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const stop=()=>{white?.getAnimations().forEach(a=>a.cancel());white?.remove();white=undefined;layer?.getAnimations({subtree:true}).forEach(a=>a.cancel());removeScreenEffect(layer);layer=undefined;};
 const start=(flash=true)=>{
  if(layer||document.hidden)return;
  layer=document.createElement('div');layer.id='pneuma-flashbang-overlay';layer.setAttribute('aria-hidden','true');Object.assign(layer.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'1',background:'radial-gradient(ellipse at center, transparent 48%, #ffffff44 72%, #ffffffbb 100%)'});mountScreenEffect(layer,true);
  if(flash&&!reduced.matches){white=document.createElement('div');const pulse=white;Object.assign(pulse.style,{position:'fixed',inset:'0',background:'white',pointerEvents:'none',zIndex:'1'});document.body.append(pulse);const animation=pulse.animate([{opacity:1},{opacity:.8,offset:.15},{opacity:0}],{duration:1100,easing:'ease-out'});animation.onfinish=()=>{pulse.remove();if(white===pulse)white=undefined;};}
 };
 return {start,stop};
}
