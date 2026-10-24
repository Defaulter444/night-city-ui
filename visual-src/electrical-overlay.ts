import {createConditionScreen} from './condition-renderers.js';
import {mountScreenEffect,removeScreenEffect} from './screen-effect-area.js';
export function createElectricalOverlay(kind:'electrical'|'emp'='electrical'){
 if(kind==='emp')return createConditionScreen('emp');
 let layer:SVGSVGElement|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function arc(){
  if(!layer||reduced.matches)return;
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  const x=Math.random()*520+240,y=Math.random()*750+75,dx=(x>500?-1:1)*(150+Math.random()*300),dy=(Math.random()-.5)*180;
  let d=`M ${x} ${y}`;
  for(let i=1;i<=9;i++)d+=` L ${Math.max(20,Math.min(980,x+dx*i/9+(Math.random()-.5)*38))} ${Math.max(20,Math.min(980,y+dy*i/9+(Math.random()-.5)*65))}`;
  if(kind==='emp'){const r=65+Math.random()*100;d=`M ${x-r} ${y} A ${r} ${r*.65} 0 0 1 ${x+r} ${y} M ${x-r*1.4} ${y+20} A ${r*1.4} ${r*.9} 0 0 1 ${x+r*1.4} ${y+20}`;}
  path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke','#b5f3ff');path.setAttribute('stroke-width','2');path.setAttribute('stroke-linejoin','round');path.style.filter='drop-shadow(0 0 5px #54baff)';
  if(kind==='emp'){path.setAttribute('stroke','#8bbec7');path.style.filter='drop-shadow(0 0 3px #6999a5)';}
  layer.append(path);const animation=path.animate([{opacity:0},{opacity:kind==='emp'?.45:.9,offset:.2},{opacity:.2,offset:.55},{opacity:0}],{duration:kind==='emp'?1400:650,easing:'ease-out'});animation.onfinish=()=>path.remove();
  timer=setTimeout(arc,900+Math.random()*1000);
 }
 function stop(){if(timer!==undefined)clearTimeout(timer);timer=undefined;layer?.getAnimations({subtree:true}).forEach(animation=>animation.cancel());removeScreenEffect(layer);layer=undefined;}
 function start(){if(layer||document.hidden)return;layer=document.createElementNS('http://www.w3.org/2000/svg','svg');layer.id=`pneuma-${kind}-overlay`;layer.setAttribute('viewBox','0 0 1000 1000');layer.setAttribute('preserveAspectRatio','none');layer.setAttribute('aria-hidden','true');Object.assign(layer.style,{position:'fixed',inset:'0',width:'100cqw',height:'100vh',pointerEvents:'none',zIndex:'1'});mountScreenEffect(layer,false);if(!reduced.matches)arc();}
 reduced.addEventListener('change',()=>{if(layer){stop();start();}});return {start,stop};
}
