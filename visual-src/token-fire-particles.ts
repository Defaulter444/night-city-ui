let flame:PIXI.Texture|undefined;
function flameTexture():PIXI.Texture {
 if(flame&&!flame.destroyed)return flame;
 const image=document.createElement('canvas');image.width=64;image.height=128;const ctx=image.getContext('2d')!;
 ctx.scale(1,2);const glow=ctx.createRadialGradient(32,39,0,32,32,31);
 glow.addColorStop(0,'rgba(255,247,192,.95)');glow.addColorStop(.18,'rgba(255,203,65,.85)');glow.addColorStop(.43,'rgba(255,105,12,.6)');glow.addColorStop(.7,'rgba(225,43,4,.24)');glow.addColorStop(1,'rgba(180,25,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,64,64);
 flame=PIXI.Texture.from(image);return flame;
}
/** Fixed particle pool; new emission paths are generated for each lifetime. */
export function createTokenFireParticles(){
 const container=new PIXI.Container();container.eventMode='none';
 const particles=Array.from({length:72},(_,i)=>{const ember=i>=54;const sprite=new PIXI.Sprite(ember?PIXI.Texture.WHITE:flameTexture());sprite.anchor.set(.5);sprite.eventMode='none';container.addChild(sprite);return {sprite,ember,seed:Math.random()*1000};});
 const noise=(seed:number)=>{const value=Math.sin(seed*12.9898)*43758.5453;return value-Math.floor(value);};
 function update(w:number,h:number,time:number,strength:number,stationary:boolean){
  const level=Math.max(1,Math.min(3,strength)),r=Math.min(w,h),t=stationary?0:time;
  particles.forEach(({sprite,ember,seed},i)=>{
   sprite.visible=ember?i-54<level*6:i<level*18;if(!sprite.visible)return;
   const life=ember?1.7+noise(seed)*1.5:1.05+noise(seed)*.9;
   const emission=t/life+noise(seed+5),cycle=Math.floor(emission),age=emission-cycle;
   const x=noise(seed+cycle*3.1+11),sway=Math.sin(age*7+seed)*.025+Math.sin(t*2.1+seed)*.012;
   sprite.position.set(w*(.04+x*.92+sway),h*(1.03-age*(ember?1.15:.5+level*.12)));
   sprite.alpha=Math.sin(Math.PI*age)* (ember?.8:.58);
   sprite.rotation=ember?Math.PI/4:Math.sin(age*5+seed)*.17;
   if(ember){sprite.tint=0xffc759;sprite.width=sprite.height=Math.max(1,r*(.008+noise(seed+1)*.009));}
   else {sprite.width=r*(.11+level*.02)*(1-age*.55);sprite.height=r*(.29+level*.06)*(1-age*.65);}
  });
 }
 return {container,update,destroy:()=>container.destroy({children:true,texture:false,baseTexture:false})};
}
