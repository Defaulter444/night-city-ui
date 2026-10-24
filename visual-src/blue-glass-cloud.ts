let image:HTMLCanvasElement|undefined,texture:PIXI.Texture|undefined;
/** Broad, smoothly blended color bands twist into a soft spiral cloud. */
export function blueGlassCloud():HTMLCanvasElement {
 if(image)return image;
 image=document.createElement('canvas');image.width=image.height=256;const ctx=image.getContext('2d')!,pixels=ctx.createImageData(256,256);
 const palette=[[72,237,238],[106,76,246],[233,56,211],[253,129,91],[244,220,79],[77,232,169]];
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const dx=(x-128)/128,dy=(y-128)/128,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
  const warp=.22*Math.sin(dx*6+dy*3)+.17*Math.sin(dy*7-dx*2);
  // One full angular turn spans the entire palette, so atan2's wrap cannot
  // create a hard radial seam that looks like a rotating line.
  const phase=((angle/(Math.PI*2)*palette.length+r*2.8+warp)%palette.length+palette.length)%palette.length;
  const n=Math.floor(phase),f=(1-Math.cos((phase-n)*Math.PI))/2,a=palette[n]!,b=palette[(n+1)%palette.length]!,offset=(y*256+x)*4;
  for(let c=0;c<3;c++)pixels.data[offset+c]=a[c]!*(1-f)+b[c]!*f;
  pixels.data[offset+3]=Math.round(Math.max(0,Math.min(1,(1-r)/.3))*(.82+.16*Math.sin(r*8+angle))*255);
 }
 ctx.putImageData(pixels,0,0);return image;
}
export function createTokenBlueGlassCloud(){
 if(!texture||texture.destroyed)texture=PIXI.Texture.from(blueGlassCloud());
 const container=new PIXI.Container();container.eventMode='none';
 const clouds=Array.from({length:3},()=>{const sprite=new PIXI.Sprite(texture!);sprite.anchor.set(.5);container.addChild(sprite);return sprite;});
 function update(w:number,h:number,time:number,stationary:boolean){const t=stationary?0:time;
  clouds.forEach((sprite,i)=>{const swell=.96+Math.sin(t*.55+i*2)*.06;sprite.width=w*(i===0?1.35:.95)*swell;sprite.height=h*(i===0?1.35:.95)*swell;sprite.position.set(w*(i===0?.5:i===1?.22:.78)+Math.sin(t*.25+i)*w*.03,h*(i===0?.5:i===1?.7:.3));sprite.rotation=t*(i%2?-.12:.16)+i*2.1;sprite.alpha=stationary?.2:i===0?.38:.15+Math.sin(t*.7+i)*.04;});
 }
 return {container,update,destroy:()=>container.destroy({children:true,texture:false,baseTexture:false})};
}
