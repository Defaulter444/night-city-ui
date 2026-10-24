let hazeTexture:PIXI.Texture|undefined;
export function createTokenDazzle(){
 if(!hazeTexture||hazeTexture.destroyed){
  const image=document.createElement('canvas');image.width=image.height=256;const ctx=image.getContext('2d')!;
  const gradient=ctx.createRadialGradient(128,128,0,128,128,128);gradient.addColorStop(0,'rgba(255,255,255,0)');gradient.addColorStop(.48,'rgba(255,255,255,0)');gradient.addColorStop(.75,'rgba(255,255,255,.3)');gradient.addColorStop(1,'rgba(255,255,255,.8)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);hazeTexture=PIXI.Texture.from(image);
 }
 const container=new PIXI.Container();container.eventMode='none';
 const haze=new PIXI.Sprite(hazeTexture),flash=new PIXI.Sprite(PIXI.Texture.WHITE);container.addChild(haze,flash);
 return {container,update:(w:number,h:number,strength:number)=>{haze.width=flash.width=w;haze.height=flash.height=h;flash.alpha=strength*.95;},destroy:()=>container.destroy({children:true,texture:false,baseTexture:false})};
}
