import {mountScreenEffect,removeScreenEffect,screenEffectWidth} from './screen-effect-area.js';
export interface FlameOverlay {start:(strength?:number)=>void;stop:()=>void}
/** Fixed-size canvas, upscaled by the compositor. Advected heat field: cooling, turbulent rising flow, and luminous combustion. */
export function createFlameOverlay():FlameOverlay {
 let layer:HTMLDivElement|undefined,frame=0,last=0,strength=1;
 const tiles:HTMLCanvasElement[]=[];
 function fitTiles(){
  if(!layer)return;
  const displayHeight=Math.min(260,innerHeight*.26),tileWidth=displayHeight*600/180;
  const count=Math.max(1,Math.ceil(screenEffectWidth()/tileWidth));
  while(tiles.length>count){const tile=tiles.pop()!;tile.remove();tile.width=0;tile.height=0}
  while(tiles.length<count){const tile=document.createElement('canvas');tile.width=600;tile.height=180;tile.style.flex='0 0 auto';tile.style.height='100%';tiles.push(tile);layer.append(tile)}
  tiles.forEach((tile,i)=>{tile.style.width=`${tileWidth}px`;tile.style.transform=i%2?'scaleX(-1)':'';tile.getContext('2d')!.drawImage(buffer,0,0)});
 }
 const width=600,height=180,cells=width*height;
 let heat=new Float32Array(cells),next=new Float32Array(cells),noiseOffset=0;
 const noise=Float32Array.from({length:65536},()=>.005+Math.random()*.009);
 const sinX=Float32Array.from({length:width},(_,x)=>Math.sin(x*.045));
 const cosX=Float32Array.from({length:width},(_,x)=>Math.cos(x*.045));
 const sinY=Float32Array.from({length:height},(_,y)=>Math.sin(y*.07));
 const cosY=Float32Array.from({length:height},(_,y)=>Math.cos(y*.07));
 const drift=new Float32Array(width),rowSin=new Float32Array(height),rowCos=new Float32Array(height);
 const buffer=document.createElement('canvas');buffer.width=width;buffer.height=height;
 const raster=buffer.getContext('2d')!;const pixels=raster.createImageData(width,height);
 const rgba=new Uint32Array(pixels.data.buffer),palette=new Uint32Array(height*256);
 // Resolve colors and row transparency once, rather than for every cell every frame.
 for(let y=0;y<height;y++)for(let n=0;n<256;n++){
  const v=n/255,p=(y*256+n)*4;
  const bytes=new Uint8ClampedArray(palette.buffer,p,4);
  bytes[0]=Math.min(255,130+v*200);bytes[1]=Math.max(0,Math.min(255,(v-.24)*380));
  bytes[2]=Math.max(0,Math.min(220,(v-.7)*730));
  bytes[3]=Math.round(Math.min(1,v*2.3)*Math.min(1,y/24)*(v<.1?0:Math.min(1,(v-.1)*2))*230);
 }
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function paint(time:number){
  if(!layer)return;
  if(document.hidden){stop();return}
  if(time-last<50){frame=requestAnimationFrame(paint);return}last=time;
  const t=time*.001;
  for(let x=0;x<width;x++){
   const fuel=.56+.24*Math.sin(x*.13+t*3.1)+.2*Math.sin(x*.057-t*4.4)+.16*Math.sin(x*.31+t*5.2);
   heat[(height-1)*width+x]=Math.max(0,Math.min(1,fuel+Math.random()*.2));
  }
  const st=Math.sin(t*2),ct=Math.cos(t*2),cooling=1.25-.2*strength;
  for(let x=0;x<width;x++)drift[x]=Math.sin(x*.09-t*2.6)*.4;
  for(let y=0;y<height;y++){rowSin[y]=sinY[y]!*ct+cosY[y]!*st;rowCos[y]=cosY[y]!*ct-sinY[y]!*st}
  for(let y=0;y<height-1;y++){
   const offset=y*width,sampleRow=Math.min(height-1,y+2+Math.floor((height-y)/90))*width;
   for(let x=0;x<width;x++){
    const swirl=(rowSin[y]!*cosX[x]!+rowCos[y]!*sinX[x]!)*.7+drift[x]!;
    const sampleX=Math.max(1,Math.min(width-2,Math.round(x+swirl))),below=sampleRow+sampleX;
    next[offset+x]=Math.max(0,(heat[below]!*2+heat[below-1]!+heat[below+1]!)*.25-noise[(offset+x+noiseOffset)&65535]!*cooling);
   }
  }
  next.set(heat.subarray((height-1)*width),(height-1)*width);
  const previous=heat;heat=next;next=previous;noiseOffset=(noiseOffset+997)&65535;
  for(let y=0;y<height;y++){const offset=y*width,colorRow=y*256;
   for(let x=0;x<width;x++)rgba[offset+x]=palette[colorRow+Math.min(255,(heat[offset+x]!*255)|0)]!;
  }
  raster.putImageData(pixels,0,0);
  const ctx=raster;
  // Sparse embers, moving independently from the heat front.
  if(!reduced.matches){for(let i=0;i<12;i++){const age=(t*.35+i*.173)%1,x=((i*.618)%1)*width+Math.sin(t+i)*12,y=height*(1-age);ctx.fillStyle=`rgba(255,190,80,${(1-age)*.45})`;ctx.beginPath();ctx.arc(x,y,.65,0,Math.PI*2);ctx.fill()}}
  for(const tile of tiles){const context=tile.getContext('2d')!;context.clearRect(0,0,width,height);context.drawImage(buffer,0,0)}
  if(!reduced.matches)frame=requestAnimationFrame(paint);
 }
 function stop(){cancelAnimationFrame(frame);frame=0;if(layer){removeScreenEffect(layer);for(const tile of tiles){tile.width=0;tile.height=0}tiles.length=0;buffer.width=0;buffer.height=0}layer=undefined;heat.fill(0);next.fill(0);last=0}
 function start(level=1){strength=Math.max(1,Math.min(3,level));if(layer){layer.style.opacity=String(.65+strength*.08);return}
  buffer.width=width;buffer.height=height;layer=document.createElement('div');layer.id='pneuma-fire-overlay';layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{display:'flex',overflow:'hidden',position:'fixed',bottom:'0',left:'0',width:'100cqw',height:'26vh',maxHeight:'260px',pointerEvents:'none',zIndex:'1',opacity:String(.65+strength*.08)});mountScreenEffect(layer,true,fitTiles);fitTiles();
  if(reduced.matches){for(let i=0;i<heat.length;i++){const y=Math.floor(i/width);heat[i]=Math.max(0,(y/height-.25)*.85)}paint(performance.now()+40)}else frame=requestAnimationFrame(paint);
 }
 window.addEventListener('resize',fitTiles);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});reduced.addEventListener('change',()=>{if(layer){stop();start(strength)}});
 return {start,stop};
}

