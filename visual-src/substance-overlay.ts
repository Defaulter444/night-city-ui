import {mountScreenEffect,removeScreenEffect} from './screen-effect-area.js';
export type SubstanceKind = 'poison' | 'blueGlass';
import {blueGlassCloud} from './blue-glass-cloud.js';
export function createSubstanceOverlay(kind: SubstanceKind) {
 let layer: HTMLDivElement | undefined, timer: ReturnType<typeof setTimeout> | undefined;
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 function burst() {
  if (!layer || reduced.matches) return;
  const cloud=blueGlassCloud().toDataURL();
  for(let i=0;i<2;i++){
   const swirl = document.createElement('div'),left=i===0?Math.random()<.5:i===1;
   Object.assign(swirl.style, {position:'absolute', width:'54cqw', height:'78vh', top:`${Math.random()*65-22}%`, left:left?'-24cqw':'70cqw', borderRadius:'50%',backgroundImage:`url("${cloud}")`,backgroundSize:'100% 100%',filter:'blur(8px) saturate(1.1)'});
   layer.append(swirl);
   const animation = swirl.animate([{opacity:0,transform:'rotate(0deg) scale(.75)'},{opacity:.6,offset:.25},{opacity:.42,offset:.65},{opacity:0,transform:`rotate(${i%2?-150:150}deg) scale(1.2)`}], {duration:8500+i*650,easing:'ease-in-out'});
   animation.onfinish = () => swirl.remove();
  }
  timer = setTimeout(burst, 9000 + Math.random()*4000);
 }
 function stop() {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  layer?.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
  removeScreenEffect(layer); layer=undefined;
 }
 function start() {
  if (layer || document.hidden) return;
  layer = document.createElement('div'); layer.id=`pneuma-${kind}-overlay`; layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{position:'fixed',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'1'});
  mountScreenEffect(layer,true);
  if (kind === 'poison') {
   layer.style.background='radial-gradient(ellipse at center, transparent 55%, #386c1718 85%, #70bc4b30 100%)';
   layer.style.maskImage='radial-gradient(ellipse at center, transparent 0%, transparent 58%, #000 80%)';
   const patches=[[-28,-20,55,62],[76,-18,52,55],[-28,42,58,75],[78,43,55,70],[12,-40,55,60],[25,82,60,55],[-28,15,48,62],[80,5,48,60],[43,-40,48,58],[-5,82,50,60]];
   for (let i=0;i<patches.length;i++) {
    const [x,y,width,height]=patches[i]!;
    const wisp=document.createElement('div');
    const peak=.8;
    Object.assign(wisp.style,{position:'absolute',width:`${width}cqw`,height:`${height}vh`,left:`${x}cqw`,top:`${y}vh`,borderRadius:'43% 57% 61% 39%',opacity:String(reduced.matches?peak*.4:.05),background:'radial-gradient(ellipse at 32% 42%, #91d82b99, transparent 58%),radial-gradient(ellipse at 67% 60%, #45b329bb, transparent 62%),radial-gradient(ellipse at 50% 30%, #badb4266, transparent 60%)',filter:'blur(22px)'});
    layer.append(wisp);
    if (!reduced.matches) wisp.animate([{transform:'translate(-3cqw, -4vh) scale(.8)',opacity:.02},{transform:'translate(2cqw, 3vh) scale(1.14)',opacity:peak,offset:.35},{transform:'translate(4cqw, -2vh) scale(1.02)',opacity:peak*.5,offset:.6},{transform:'translate(-3cqw, -4vh) scale(.8)',opacity:.02}],{duration:7400+i*913,delay:-i*2173,iterations:Infinity,easing:'ease-in-out'});
   }
  } else if (reduced.matches) layer.style.background='radial-gradient(ellipse at center, transparent 65%, #a34bdd22 90%, #37dada33)';
  else burst();
 }
 reduced.addEventListener('change',()=>{if(layer){stop();start();}});
 return {start,stop};
}
