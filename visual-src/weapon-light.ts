import type {Point} from './weapon-effect-player.js';
import {weaponLightProfile,weaponLightConfig} from './weapon-light-config.js';

const flashFlag='attackFlash';
export const weaponLightAuthority=()=>!!game.user?.isGM&&!!game.users?.activeGM&&game.users.activeGM.id===game.user.id;
const marker=(light:AmbientLightDocument)=>foundry.utils.getProperty(light.flags,'night-city-ui.'+flashFlag) as {pool?:boolean;key?:string;expires?:number}|undefined;
const preparingLights=new Map<string,Promise<AmbientLightDocument|undefined>>();
const activeLights=new Set<()=>void>();
let preparationQueue:Promise<unknown>=Promise.resolve();
function queueLightWork<T>(work:()=>Promise<T>):Promise<T>{
 const result=preparationQueue.then(work);preparationQueue=result.catch(()=>{});return result;
}
function releaseWeaponLight(scene:Scene,doc:AmbientLightDocument,key:string):Promise<void>{
 return queueLightWork(async()=>{
  if(!weaponLightAuthority()||!scene.lights.has(doc.id!)||marker(doc)?.key!==key)return;
  await doc.update({hidden:true,flags:{'night-city-ui':{[flashFlag]:{pool:true,key:'',expires:0}}} as never});
 });
}

/** GM prepares a real OFF light; each client renders its pulses without server updates. */
export function createWeaponLight(weapon:string,origin?:Point,enabled=true,attackKey?:string,ammoColor?:string,areaRadius?:number){
 const profile=weaponLightProfile(weapon),config=weaponLightConfig(weapon,ammoColor,areaRadius),scene=canvas.scene,key=attackKey??foundry.utils.randomID();
 const eligible=enabled&&game.settings!.get('night-city-ui','weaponLighting')!==false&&!!profile&&!!scene&&!!game.users?.activeGM;
 const fullConfig={bright:config.bright,dim:config.dim,luminosity:profile?.luminosity??1};
 let light:AmbientLightDocument|undefined,preparedDocument:AmbientLightDocument|undefined,snapshot:{x:number;y:number;hidden:boolean}|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined,waitTimer:ReturnType<typeof setTimeout>|undefined;
 let closed=false,finishWait:(()=>void)|undefined;
 const release=(doc:AmbientLightDocument)=>releaseWeaponLight(scene!,doc,key);
 const refresh=(data:{x?:number;y?:number;hidden:boolean;config?:typeof fullConfig})=>{
  if(!light||!scene!.lights.has(light.id!)||marker(light)?.key!==key)return;
  light.updateSource(data);
  if(canvas.scene!==scene||!canvas.ready)return;
  const object=light.object;if(!object)return;
  object.initializeLightSource();object.renderFlags.set({refreshPosition:true,refreshState:true});
  canvas.perception.update({refreshLighting:true,...(light.vision?{refreshVision:true}:{})});
 };
 if(eligible&&weaponLightAuthority()){
  const id=scene!.id+':'+key;
  if(!preparingLights.has(id)){
   const created=queueLightWork(async()=>{
    if(closed)return undefined;
    const existing=scene!.lights.find(doc=>marker(doc)?.key===key);if(existing)return existing;
    const pool=scene!.lights.filter(doc=>marker(doc)?.pool===true);
    const reusable=pool.find(doc=>!marker(doc)?.key||(marker(doc)?.expires??0)<=Date.now());
    const data={x:origin?.x??0,y:origin?.y??0,hidden:true,walls:true,vision:config.vision,
     config:{bright:config.bright,dim:config.dim,color:config.color,alpha:config.alpha,
      luminosity:profile!.luminosity,attenuation:.5,angle:360},
     flags:{'night-city-ui':{[flashFlag]:{pool:true,key,expires:Date.now()+20000}}} as never};
    if(reusable){await reusable.update(data);return reusable;}
    if(pool.length>=8)return undefined;
    return (await scene!.createEmbeddedDocuments('AmbientLight',[data]))?.[0];
   });
   preparingLights.set(id,created);
   void created.then(doc=>{
    if(!doc)return;preparedDocument=doc;
    // A lease timeout returns an interrupted attack light to the pool.
    setTimeout(()=>{void release(doc).catch(error=>console.warn('night-city-ui | expired attack light release failed',error));},20000);
    if(closed)void release(doc).catch(error=>console.warn('night-city-ui | cancelled attack light release failed',error));
   }).catch(error=>console.warn('night-city-ui | attack light preparation failed',error)).finally(()=>preparingLights.delete(id));
  }
 }
 const ready=eligible?new Promise<void>(resolve=>{
  const deadline=Date.now()+3000;
  finishWait=()=>{if(waitTimer!==undefined)clearTimeout(waitTimer);waitTimer=undefined;finishWait=undefined;resolve();};
  const check=()=>{
   if(closed||!canvas.ready||canvas.scene!==scene||Date.now()>=deadline){finishWait?.();return;}
   const candidate=scene!.lights.find(doc=>marker(doc)?.key===key);
   // The native placeable must have completed drawing, not merely arrived over the socket.
   if(candidate?.object?.field){light=candidate;snapshot={x:light.x,y:light.y,hidden:true};finishWait?.();return;}
   waitTimer=setTimeout(check,20);
  };
  check();
 }):undefined;
 const stop=()=>{
  if(closed)return;closed=true;activeLights.delete(stop);finishWait?.();if(timer!==undefined)clearTimeout(timer);timer=undefined;
  if(snapshot)refresh({...snapshot,config:fullConfig});
  if(preparedDocument&&!light&&weaponLightAuthority())void release(preparedDocument).catch(error=>console.warn('night-city-ui | cancelled attack light release failed',error));
  if(light&&weaponLightAuthority()){
   const doc=light;
   // Return to the pool only after slower clients have had time to finish.
   setTimeout(()=>{void release(doc).catch(error=>console.warn('night-city-ui | attack light cleanup failed',error));},5000);
  }
 };
 const pulse=(phase:'source'|'impact',point:Point,_elevation=0)=>{
  if(closed||!light||profile?.phase!==phase||!canvas.ready||canvas.scene!==scene||document.hidden)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!game.settings!.get('night-city-ui','weaponAnimations'))return;
  if(game.settings!.get('night-city-ui','weaponLighting')===false){stop();return;}
  try{
   refresh({x:point.x,y:point.y,hidden:false,config:fullConfig});if(timer!==undefined)clearTimeout(timer);
   timer=setTimeout(()=>{timer=undefined;refresh({hidden:true});},profile.duration);
  }catch(error){stop();console.warn('night-city-ui | local attack light rendering failed',error);}
 };
 let lastMove=-Infinity;
 const move=(point:Point)=>{
  if(weapon!=='rocket'||closed||!light||!canvas.ready||canvas.scene!==scene||document.hidden||Date.now()-lastMove<33)return;
  if(game.settings!.get('night-city-ui','weaponLighting')===false){stop();return;}
  if(!game.settings!.get('night-city-ui','weaponAnimations')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  lastMove=Date.now();const distance=scene?.grid?.distance||2;
  try{refresh({x:point.x,y:point.y,hidden:false,config:{bright:Math.min(config.bright,distance*.5),dim:Math.min(config.dim,distance),luminosity:.65}});}
  catch(error){stop();console.warn('night-city-ui | rocket light movement failed',error);}
 };
 if(eligible)activeLights.add(stop);
 return {ready,pulse,move,stop};
}

/** Recover only expired module-owned lights after an interrupted client. */
export function registerWeaponLightCleanup():void {
 Hooks.on('pneumaWeaponLightingChanged',()=>{if(game.settings!.get('night-city-ui','weaponLighting')===false)for(const stop of [...activeLights])stop();});
 const cleanup=async()=>{
  if(!weaponLightAuthority()||!canvas.scene)return;
  const scene=canvas.scene;
  const expired=scene.lights.filter(light=>{const data=marker(light);return typeof data?.expires==='number'&&data.expires>0&&data.expires<Date.now();});
  for(const doc of expired){const data=marker(doc)!;
   if(data.pool)await releaseWeaponLight(scene,doc,data.key??'');else await doc.delete();
  }
 };
 const run=()=>{void cleanup().catch(error=>console.warn('night-city-ui | stale attack light cleanup failed',error));};
 Hooks.once('ready',run);Hooks.on('canvasReady',run);
 const timer=setInterval(run,15000);window.addEventListener('pagehide',()=>clearInterval(timer));
}
