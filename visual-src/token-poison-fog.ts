let texture:PIXI.Texture|undefined;
function cloudTexture():PIXI.Texture {
 if(texture&&!texture.destroyed)return texture;
 const image=document.createElement('canvas');image.width=image.height=256;
 const ctx=image.getContext('2d')!;
 // Overlapping soft lobes form one irregular cloud, with no hard circle edges.
 for(const [x,y,r] of [[90,100,88],[160,115,82],[128,163,75],[72,156,58],[168,67,53]]) {
  const gradient=ctx.createRadialGradient(x!,y!,0,x!,y!,r!);
  gradient.addColorStop(0,'rgba(115,205,39,.55)');gradient.addColorStop(.4,'rgba(68,169,30,.34)');gradient.addColorStop(1,'rgba(68,169,30,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
 }
 texture=PIXI.Texture.from(image);return texture;
}
export function createTokenPoisonFog() {
 const container=new PIXI.Container();container.eventMode='none';
 const mask=new PIXI.Graphics();container.addChild(mask);container.mask=mask;
 const sprites=Array.from({length:6},()=>{const sprite=new PIXI.Sprite(cloudTexture());sprite.anchor.set(.5);container.addChild(sprite);return sprite;});
 let maskWidth=0,maskHeight=0;
 function update(w:number,h:number,time:number,phase:number,stationary:boolean) {
  if(w!==maskWidth||h!==maskHeight){mask.clear();mask.beginFill(0xffffff);mask.drawRoundedRect(0,0,w,h,Math.min(w,h)*.12);mask.endFill();maskWidth=w;maskHeight=h;}
  sprites.forEach((sprite,i)=>{
   const t=time/(1.5+i*.31)+phase+i*2.17;
   const bloom=stationary?.4:Math.pow((Math.sin(t)+1)/2,1.7);
   sprite.alpha=stationary?.32:.08+bloom*.64;
   // Clouds swell locally rather than orbiting the token.
   sprite.position.set(w*(.22+(i%3)*.28)+Math.sin(t*.57)*w*.035,h*(i<3?.25:.73)+Math.cos(t*.43)*h*.04);
   sprite.width=w*(.58+bloom*.25);sprite.height=h*(.58+bloom*.25);sprite.rotation=i*.73+Math.sin(t*.2)*.08;
  });
 }
 return {container,update,destroy:()=>container.destroy({children:true,texture:false,baseTexture:false})};
}
