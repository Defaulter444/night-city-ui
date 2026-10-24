import {mountScreenEffect,removeScreenEffect} from './screen-effect-area.js';
export type ConditionVisual='emp'|'choking1'|'choking2';
export function createConditionScreen(kind:ConditionVisual){
 let layer:HTMLDivElement|undefined,positionTimer:ReturnType<typeof setInterval>|undefined;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function stop(){if(positionTimer!==undefined)clearInterval(positionTimer);positionTimer=undefined;layer?.getAnimations({subtree:true}).forEach(a=>a.cancel());removeScreenEffect(layer);layer=undefined;}
 function start(){
  if(layer||document.hidden)return;layer=document.createElement('div');layer.id='pneuma-'+kind+'-overlay';layer.setAttribute('aria-hidden','true');Object.assign(layer.style,{inset:'0',pointerEvents:'none',overflow:'hidden',zIndex:'1'});
  if(kind==='emp'){
   for(let side=0;side<2;side++){
    const rail=document.createElement('div');Object.assign(rail.style,{position:'absolute',top:'0',bottom:'0',width:'min(220px, 20cqw)',[side?'right':'left']:'0',maskImage:'linear-gradient(to '+(side?'left':'right')+',#000,transparent)'});
    for(let i=0;i<3;i++){
     const cluster=document.createElement('div');cluster.dataset.empCluster='';rail.append(cluster);
     const populate=()=>{
      if(!layer||!rail.contains(cluster))return;
      cluster.getAnimations({subtree:true}).forEach(a=>a.cancel());cluster.replaceChildren();
      const cols=2+Math.floor(Math.random()*4),rows=2+Math.floor(Math.random()*4),size=8+Math.floor(Math.random()*13),gap=2+Math.floor(Math.random()*4);
      Object.assign(cluster.style,{position:'absolute',top:(i*30+3+Math.random()*10)+'%',left:(4+Math.random()*40)+'px',width:(cols*(size+gap))+'px',height:(rows*(size+gap))+'px'});
      const cells=Array.from({length:cols*rows},(_,j)=>j);
      for(let j=cells.length-1;j>0;j--){const k=Math.floor(Math.random()*(j+1));[cells[j],cells[k]]=[cells[k]!,cells[j]!];}
      const count=Math.max(3,Math.floor(cells.length*(.65+Math.random()*.35))),duration=6500+count*180;
      for(const [order,cell] of cells.slice(0,count).entries()){
       const pixel=document.createElement('div');Object.assign(pixel.style,{position:'absolute',left:((cell%cols)*(size+gap))+'px',top:(Math.floor(cell/cols)*(size+gap))+'px',width:size+'px',height:size+'px',background:'#edf6ff',opacity:reduced.matches?'.4':'0'});cluster.append(pixel);
       if(!reduced.matches){const on=700+order*140,off=on+count*140+1500;
        const animation=pixel.animate([{opacity:0,offset:0},{opacity:0,offset:on/duration},{opacity:.85,offset:(on+90)/duration},{opacity:.85,offset:off/duration},{opacity:0,offset:(off+120)/duration},{opacity:0,offset:1}],{duration,delay:i*650+side*350});
        if(order===count-1)animation.onfinish=()=>{if(cluster.isConnected)populate();};
       }
      }
     };
     populate();
    }
    layer.append(rail);
   }
   const words=['Сбой','Отказ питания','Перезапуск системы','Сигнал потерян','Просадка напряжения','Переинициализация'];
   const relocations:(()=>void)[]=[];
   for(const [i,word] of words.entries()){
    if(reduced.matches&&i>1)break;
    const readout=document.createElement('div');readout.dataset.empReadout='';
    Object.assign(readout.style,{position:'absolute',fontFamily:'monospace',fontSize:'clamp(10px, 1.4cqw, 18px)',fontWeight:'600',lineHeight:'1.7',color:'#edf6ff',textShadow:'0 1px 4px #000,0 0 8px #000',pointerEvents:'none',opacity:reduced.matches?'.85':'0'});
    let previousTop=-100;
    const relocate=()=>{let top=14+Math.random()*70;if(Math.abs(top-previousTop)<16)top=14+((top-14+35)%70);previousTop=top;readout.style.top=top+'%';readout.style[i%2?'right':'left']=(2+Math.random()*10)+'%';};
    relocate();
    const text=document.createElement('span');text.textContent='> '+word;const length=word.length+2;
    Object.assign(text.style,{display:'block',overflow:'hidden',whiteSpace:'nowrap',width:length+'ch',borderRight:'2px solid #edf6ff',boxSizing:'content-box'});readout.append(text);layer.append(readout);
    if(!reduced.matches){
     // One starts every five seconds and lasts 3.6 seconds, leaving a quiet gap.
     const timing={duration:30000,delay:i*5000,iterations:Infinity};
     text.animate([{width:'0ch',offset:0,easing:'steps('+length+', end)'},{width:length+'ch',offset:.036},{width:length+'ch',offset:1}],timing);
     const visibility=readout.animate([{opacity:.9,offset:0},{opacity:.9,offset:.1},{opacity:0,offset:.12},{opacity:0,offset:1}],timing);
     let preparedIteration=-1;
     relocations.push(()=>{const state=visibility.effect?.getComputedTiming();if(state?.progress!=null&&state.progress>.15&&state.currentIteration!=null&&state.currentIteration!==preparedIteration){preparedIteration=state.currentIteration;relocate();}});
    }
   }
   // Reposition during the invisible interval, keeping typing and overlap timing intact.
   if(relocations.length)positionTimer=setInterval(()=>{for(const relocate of relocations)relocate();},500);
  }else{
   const strong=kind==='choking2';Object.assign(layer.style,{background:'radial-gradient(ellipse at center, transparent '+(strong?'39%':'51%')+',rgba(32,5,13,.2) 68%,rgba(0,0,0,.9) 100%)',opacity:strong?'.8':'.55'});
   if(!reduced.matches)layer.animate([{opacity:strong?.5:.3},{opacity:strong?.9:.65,offset:.45},{opacity:strong?.5:.3}],{duration:strong?2900:4200,iterations:Infinity,easing:'ease-in-out'});
  }
  mountScreenEffect(layer,false);
 }
 reduced.addEventListener('change',()=>{if(layer){stop();start();}});return {start,stop};
}
let chokeTexture:PIXI.Texture|undefined;
export function createConditionToken(kind:ConditionVisual){
 const container=new PIXI.Container();container.eventMode='none';
 const bars=kind==='emp'?new PIXI.Graphics():undefined;let shade:PIXI.Sprite|undefined,lastWidth=0,lastHeight=0,lastPixelStep=-1;
 if(bars)container.addChild(bars);else{
  if(!chokeTexture||chokeTexture.destroyed){const image=document.createElement('canvas');image.width=image.height=128;const c=image.getContext('2d')!,gradient=c.createRadialGradient(64,64,18,64,64,78);gradient.addColorStop(0,'transparent');gradient.addColorStop(.55,'rgba(36,5,14,.25)');gradient.addColorStop(1,'rgba(0,0,0,.9)');c.fillStyle=gradient;c.fillRect(0,0,128,128);chokeTexture=PIXI.Texture.from(image);}shade=new PIXI.Sprite(chokeTexture);container.addChild(shade);
 }
 function update(w:number,h:number,time:number,phase:number,stationary:boolean){
  if(shade){shade.width=w;shade.height=h;const strong=kind==='choking2',pulse=stationary?.5:(1-Math.cos(time*Math.PI*2/(strong?2.9:4.2)+phase))/2;shade.alpha=(strong?.5:.25)+pulse*(strong?.4:.3);}
  if(bars){
   const pixelStep=stationary?0:Math.floor((time+phase)*6);
   if(w!==lastWidth||h!==lastHeight||pixelStep!==lastPixelStep){
    lastPixelStep=pixelStep;
    lastWidth=w;lastHeight=h;bars.clear();
    for(let cluster=0;cluster<2;cluster++){
     const local=stationary?3:time+phase+cluster*3,cycle=Math.floor(local/10),age=local%10;
     let seed=(cycle*7919+cluster*197+41)>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
     const cols=2+Math.floor(random()*3),rows=2+Math.floor(random()*3),size=Math.min(w,h)*(.035+random()*.018),cells=Array.from({length:cols*rows},(_,i)=>i);
     for(let i=cells.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cells[i],cells[j]]=[cells[j]!,cells[i]!];}
     for(const [order,cell] of cells.entries()){
      const on=.3+order*.16,off=on+cells.length*.16+1.3;
      if(!stationary&&(age<on||age>=off))continue;
      bars.beginFill(0xedf6ff,.7);bars.drawRect(w*(cluster?.66:.12)+(cell%cols)*size,h*(cluster?.16:.24)+Math.floor(cell/cols)*size,size*.8,size*.8);bars.endFill();
     }
    }
    // Compact warning badge below the face; shared token mask clips to artwork.
    const r=Math.min(w,h),cx=w*.5,cy=h*.73;
    bars.lineStyle(Math.max(1,r*.014),0xffd05b,1);bars.beginFill(0x100d08,.85);bars.drawPolygon([cx,cy-r*.16,cx+r*.16,cy+r*.12,cx-r*.16,cy+r*.12]);bars.endFill();
    bars.lineStyle(Math.max(2,r*.025),0xffd05b,1);bars.moveTo(cx,cy-r*.07);bars.lineTo(cx,cy+r*.015);bars.lineStyle(0);bars.beginFill(0xffd05b,1);bars.drawCircle(cx,cy+r*.065,r*.015);bars.endFill();
    bars.lineStyle(Math.max(1,r*.013),0xffd05b,.65);
    for(const side of [0,1]){const x=w*(side?.84:.16),dx=side?-1:1;bars.moveTo(x+dx*r*.08,h*.33);bars.lineTo(x,h*.33);bars.lineTo(x,h*.43);bars.moveTo(x,h*.59);bars.lineTo(x,h*.68);bars.lineTo(x+dx*r*.06,h*.68);}
   }
   bars.alpha=stationary?.7:.62+.3*(1+Math.sin((time+phase)*Math.PI*2/4.6))/2;
  }
 }
 return {container,update,destroy:()=>container.destroy({children:true,texture:false,baseTexture:false})};
}
