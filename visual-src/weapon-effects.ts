import {actionEffects,ammoKey,weaponKey,type ActionEffect} from './weapon-effect-events.js';
import {playWeaponEffect,attackAmmoColor,setWeaponVolume,stopWeaponAudio,unlockWeaponAudio,type Point} from './weapon-effect-player.js';
import {createWeaponLight,registerWeaponLightCleanup,weaponLightAuthority} from './weapon-light.js';
import {weaponLightProfile,weaponLightConfig,attackBlastRadius} from './weapon-light-config.js';
import {registerWeaponLightSettings} from './weapon-light-settings.js';
const MODULE='night-city-ui';
declare global {interface SettingConfig {
 'night-city-ui.weaponAnimations':boolean;
 'night-city-ui.weaponSounds':boolean;
 'night-city-ui.weaponVolume':number;
 'night-city-ui.weaponIntensity':number;
}}
interface LiveToken {document:{uuid:string;hidden?:boolean;elevation?:number;parent?:{id?:string}};center:Point;w:number;h:number;isVisible:boolean;actor?:Actor}
interface Viewport {stage?:{worldTransform:{a:number;b:number;c:number;d:number;tx:number;ty:number}};app?:{view:HTMLCanvasElement;renderer:{screen:{width:number;height:number}}}}
function token(uuid:string):LiveToken|undefined {return (canvas.tokens?.placeables as unknown as LiveToken[]|undefined)?.find(t=>t.document.uuid===uuid)}
function allowed(t:LiveToken):boolean {return !!game.user?.isGM||(!t.document.hidden&&t.isVisible)}
function screen(p:Point):Point|undefined {
 const view=canvas as unknown as Viewport,m=view.stage?.worldTransform,app=view.app;if(!m||!app)return;
 const rect=app.view.getBoundingClientRect(),w=app.renderer.screen.width,h=app.renderer.screen.height;if(!(w>0&&h>0))return;
 return {x:rect.left+(m.a*p.x+m.c*p.y+m.tx)*rect.width/w,y:rect.top+(m.b*p.x+m.d*p.y+m.ty)*rect.height/h};
}
function world(p:Point):Point|undefined {
 const view=canvas as unknown as Viewport,m=view.stage?.worldTransform,app=view.app;if(!m||!app)return;
 const rect=app.view.getBoundingClientRect(),det=m.a*m.d-m.b*m.c;if(!rect.width||!rect.height||!det)return;
 const x=(p.x-rect.left)*app.renderer.screen.width/rect.width-m.tx,y=(p.y-rect.top)*app.renderer.screen.height/rect.height-m.ty;
 return {x:(m.d*x-m.c*y)/det,y:(m.a*y-m.b*x)/det};
}
function areaTemplates(messageId:string):MeasuredTemplate[]{
 return (canvas.templates?.placeables??[]).filter(t=>foundry.utils.getProperty(t.document,'flags.redline-combat.areaMessage')===messageId);
}
/** Older Combat Tools builds still expose the exact clipped native template shape. */
function templateAreaCells(messageId:string):number[][]{
 const template=areaTemplates(messageId).find(t=>!foundry.utils.getProperty(t.document,'flags.redline-combat.originalAim'));
 if(!template||!canvas.grid)return [];
 if(canvas.grid.type===0){const points=(template.shape as PIXI.Polygon)?.points;return points?[points.map((v,i)=>v+(i%2?template.document.y:template.document.x))]:[];}
 const native=template as unknown as {_getGridHighlightPositions:()=>Point[]};
 return native._getGridHighlightPositions().map(p=>canvas.grid!.getVertices(p).flatMap(v=>[v.x,v.y]));
}
function hideAreaDuringPlayback(messageId:string):{hide:()=>void;restore:()=>void}{
 const saved=new Map<MeasuredTemplate,boolean>();
 const hide=()=>{for(const t of areaTemplates(messageId)){
  if(!saved.has(t))saved.set(t,t.renderable);
  t.renderable=false;const highlight=canvas.interface?.grid.getHighlightLayer(t.highlightId);if(highlight)highlight.renderable=false;
 }};
 hide();return {hide,restore:()=>{for(const [t,renderable] of saved){
  if(t.destroyed)continue;t.renderable=!t.document.hidden&&renderable;
  const highlight=canvas.interface?.grid.getHighlightLayer(t.highlightId);if(highlight)highlight.renderable=t.renderable;
 }saved.clear();}};
}
/** Combat Tools owns these flags; Visual Tools never writes resolution or visibility. */
function areaPending(message:ChatMessage):boolean{
 const state=(message.flags as Record<string,{aoe?:{phase?:string;resolutionComplete?:boolean;areaHidden?:boolean;exchange?:{combatId?:string|null;combatEpoch?:string;combatScene?:string}};rollsRevealed?:boolean}>|undefined)?.['redline-combat'];
 const ref=state?.aoe?.exchange;
 if(ref?.combatId){
  const combat=game.combats?.get(ref.combatId);
  if(!combat?.started||String(foundry.utils.getProperty(combat,'flags.redline-combat.evasionEpoch')??'')!==(ref.combatEpoch??'')||(ref.combatScene&&combat.scene&&combat.scene.id!==ref.combatScene))return false;
 }
 return !!message.visible&&message.isContentVisible!==false&&(!message.blind||!!game.user?.isGM)&&state?.rollsRevealed===true&&state.aoe?.phase==='responses'&&!state.aoe.resolutionComplete&&!state.aoe.areaHidden;
}
export function registerWeaponEffects():void {
 registerWeaponLightSettings();
 registerWeaponLightCleanup();
 const seen=new Set<string>(),active=new Set<()=>void>(),areaRuns=new Map<string,()=>void>(),runs=new Map<string,()=>void>(),messages=new Map<string,ChatMessage>(),displays=new Map<string,ReturnType<typeof hideAreaDuringPlayback>>();let ready=false;
 const resumable=new Map<string,ChatMessage>();
 const index=(message:ChatMessage)=>{
  const aoe=(message.flags as Record<string,{aoe?:{phase?:string;resolutionComplete?:boolean}}> | undefined)?.['redline-combat']?.aoe;
  if(aoe?.phase==='responses'&&!aoe.resolutionComplete)resumable.set(message.id??'',message);
  else resumable.delete(message.id??'');
 };
 const stop=()=>{for(const end of [...active])end();active.clear();stopWeaponAudio()};
 const resume=()=>{if(ready&&!document.hidden&&canvas.ready)for(const message of resumable.values())run(message,true)};
 const restart=()=>{stop();resume()};
 game.settings!.register(MODULE,'weaponAnimations',{name:'Анимация атак',hint:'Анимирует новые атаки из боевых инструментов REDLINE, атаки по области, захваты и нетраннинг на текущей сцене. Учитывает видимость сообщений и «уменьшить движение».',scope:'client',config:true,type:Boolean,default:true,onChange:restart});
 game.settings!.register(MODULE,'weaponSounds',{name:'Звуки атак',hint:'Локальные звуки выстрелов и попаданий для видимых действий. Браузер включает звук после первого щелчка или нажатия клавиши. Не зависит от анимации атак.',scope:'client',config:true,type:Boolean,default:true,onChange:restart});
 game.settings!.register(MODULE,'weaponVolume',{name:'Громкость звуков атак',hint:'Локальная громкость эффектов; громкость плейлистов не меняется.',scope:'client',config:true,type:Number,default:35,range:{min:0,max:100,step:1},onChange:(value:number)=>setWeaponVolume(value/100)});
 game.settings!.register(MODULE,'weaponIntensity',{name:'Яркость эффектов атак',hint:'Непрозрачность эффектов атак.',scope:'client',config:true,type:Number,default:80,range:{min:10,max:100,step:5},onChange:restart});
 // Keep the session's history identities: evicting old keys could replay a
 // historic attack when a damage receipt or recovery notice is updated later.
 const remember=(key:string)=>{seen.add(key)};
 function run(message:ChatMessage,recover=false):void {
  index(message);if(!ready)return;messages.set(message.id??'',message);
  for(const effect of actionEffects(message.id??'',message.flags,message.content??'')){
   const replay=seen.has(effect.key);
   if(replay&&(!effect.areaMessage||!recover||areaRuns.has(effect.key)||!areaPending(message)||!areaTemplates(effect.areaMessage).some(t=>!t.document.hidden&&!foundry.utils.getProperty(t.document,'flags.redline-combat.originalAim'))))continue;remember(effect.key);
   if(effect.areaMessage&&!areaPending(message))continue;
   if(!message.visible||message.isContentVisible===false||(message.blind&&!game.user!.isGM)||!canvas.ready)continue;
   if(effect.privateSource&&!game.user!.isGM)continue;
   const source=token(effect.source),target=effect.target?token(effect.target):undefined;
   if(!source||(!game.user?.isGM&&source.document.hidden)||(effect.target&&(!target||(!game.user?.isGM&&target.document.hidden)))||(effect.scene&&effect.scene!==canvas.scene?.id))continue;
   if(!target&&!effect.point)continue;
   const visuals=game.settings!.get(MODULE,'weaponAnimations'),sound=game.settings!.get(MODULE,'weaponSounds');if((!visuals&&!sound&&!weaponLightAuthority())||active.size-areaRuns.size>=8)continue;
   if(replay&&!visuals)continue;
   let weapon=effect.weapon,ammo=effect.ammo;
   // Combat Tools hides NPC weapon names only; saved weapon categories remain public.
   const combat=game.modules?.get('redline-combat');
   // Resolve currently loaded ammo only from a visible, inspectable source.
   const item=effect.weaponId&&allowed(source)&&source.actor?.testUserPermission(game.user!,'LIMITED')?source.actor.items.get(effect.weaponId):undefined;
   if(item){const system=item.system as unknown as {weaponType?:string};
    if(effect.weapon==='melee'||effect.weapon==='bow'||effect.weapon==='thrownAxe')weapon=weaponKey(system.weaponType??'',item.name??'');
    if(ammo==='basic'){const loaded=(item as Item & {getInstalledItems?:(type:string)=>Item[]}).getInstalledItems?.('ammo')?.[0];ammo=ammoKey(String((loaded?.system as unknown as {type?:string}|undefined)?.type??''))}
   }
   const areaApi=combat as unknown as {api?:{getAreaEffectCells?:(id:string)=>number[][]}}|undefined;
   let areaCells:number[][]=[];
   if(effect.areaMessage)try{areaCells=areaApi?.api?.getAreaEffectCells?.(effect.areaMessage)??[]}catch(error){console.warn('night-city-ui | area footprint unavailable',error)}
   if(effect.areaMessage&&!areaCells.length)try{areaCells=templateAreaCells(effect.areaMessage)}catch(error){console.warn('night-city-ui | template footprint unavailable',error)}
   const publicLight=!replay&&!message.blind&&!message.whisper?.length&&!effect.privateSource&&!source.document.hidden&&!target?.document.hidden;
   const lightOnly=!allowed(source)||!!target&&!allowed(target);
   // A vision-providing flash must be allowed to reveal its native area before token visibility is required.
   // Unseen attacks run only their flash timing, never projectile artwork or sound.
   if(lightOnly&&!(publicLight&&visuals&&game.settings!.get(MODULE,'weaponLighting')!==false&&game.users?.activeGM&&weaponLightProfile(weapon)&&weaponLightConfig(weapon).vision))continue;
   const destination=effect.point??target?.center??source.center,dx=destination.x-source.center.x,dy=destination.y-source.center.y,len=Math.max(1,Math.hypot(dx,dy));
   const origin=weapon==='grenade'?destination:{x:source.center.x+dx/len*source.w/2,y:source.center.y+dy/len*source.w/2};
   const light=createWeaponLight(weapon,origin,publicLight&&(visuals||weaponLightAuthority()),effect.key,attackAmmoColor(ammo,areaCells.length?effect.areaAmmo:undefined),attackBlastRadius(message.flags));
   if(document.hidden||(!visuals&&!sound)){void Promise.resolve(light.ready).then(()=>light.stop());continue;}
   let areaDisplay:ReturnType<typeof hideAreaDuringPlayback>|undefined;let areaImpacted=replay;
   const trackable=(t:LiveToken)=>allowed(t)||(lightOnly&&!t.document.hidden);
   const positions=()=>{areaDisplay?.hide();if(document.hidden)return;if(areaImpacted&&effect.point){const at=screen(effect.point);return at?{source:at,target:at}:undefined;}const liveSource=token(effect.source),liveTarget=effect.target?token(effect.target):undefined;if(document.hidden||!liveSource||!trackable(liveSource)||(effect.target&&(!liveTarget||!trackable(liveTarget))))return;
    const from=screen(liveSource.center),to=screen(liveTarget?.center??effect.point!);return from&&to?{source:from,target:to}:undefined};
   const initial=positions();if(!initial){light.stop();continue;}
   const sourceEdge=screen({x:source.center.x+source.w/2,y:source.center.y});
   const targetEdge=target?screen({x:target.center.x+target.w/2,y:target.center.y}):undefined;
   const area=effect.areaMessage?()=>areaCells.map(cell=>{
    const points:Point[]=[];for(let i=0;i<cell.length;i+=2){const p=screen({x:cell[i]!,y:cell[i+1]!});if(!p)return [];points.push(p)}return points;
   }).filter(cell=>cell.length>=3):undefined;


   const onLightPulse=(phase:'source'|'impact',point:Point)=>{
    const at=world(point);if(at)light.pulse(phase,at,(phase==='source'?source:target)?.document.elevation??0);
   };
   let cancelled=false,playback:(()=>void)|undefined;
   const finish=()=>{light.stop();areaDisplay?.restore();if(effect.areaMessage)displays.delete(effect.areaMessage);areaRuns.delete(effect.key);runs.delete(effect.key);active.delete(end);};
   const end=()=>{if(cancelled)return;cancelled=true;playback?.();finish();};
   active.add(end);runs.set(effect.key,end);if(effect.areaMessage)areaRuns.set(effect.key,end);
   const start=()=>{
    if(cancelled)return;
    if(document.hidden||!canvas.ready||source.document.parent?.id!==canvas.scene?.id||!messages.has(message.id??'')||!message.visible||message.isContentVisible===false||(effect.areaMessage&&!areaPending(message))||!positions()){end();return;}
   if(!lightOnly&&visuals&&areaCells.length&&effect.areaMessage){areaDisplay=hideAreaDuringPlayback(effect.areaMessage);displays.set(effect.areaMessage,areaDisplay);}
    playback=playWeaponEffect({weapon,lightOnly,onLightMove:point=>{const at=world(point);if(at)light.move(at);},onLightPulse,resumeArea:replay,areaPending:!lightOnly&&visuals&&areaCells.length&&effect.areaMessage&&['grenade','rocket'].includes(weapon)?()=>{const latest=messages.get(effect.areaMessage!);return !!latest&&areaPending(latest)}:undefined,onAreaImpact:()=>{areaImpacted=true;areaDisplay?.hide()},area:areaCells.length?area:undefined,areaAmmo:effect.areaAmmo,mode:effect.mode,ammo,hit:effect.hit,visuals,sound,volume:game.settings!.get(MODULE,'weaponVolume')/100,intensity:game.settings!.get(MODULE,'weaponIntensity')/100,sourceRadius:sourceEdge?Math.hypot(sourceEdge.x-initial.source.x,sourceEdge.y-initial.source.y):0,targetRadius:targetEdge?Math.hypot(targetEdge.x-initial.target.x,targetEdge.y-initial.target.y):0,positions,onDone:finish});
   };
   if(light.ready)void light.ready.then(start).catch(error=>{end();console.warn('night-city-ui | prepared attack playback failed',error);});else start();
  }
 }
 Hooks.once('ready',()=>{for(const message of game.messages??[]){index(message);for(const effect of actionEffects(message.id??'',message.flags,message.content??''))remember(effect.key);}ready=true;resume();
  const unlock=()=>{if(game.settings!.get(MODULE,'weaponSounds'))void unlockWeaponAudio().catch(()=>{})};document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
 });
 Hooks.on('createChatMessage',(message:ChatMessage)=>run(message));Hooks.on('updateChatMessage',(message:ChatMessage)=>run(message,true));
 // A removed gameplay marker must also remove its cached screen-space effect.
 Hooks.on('deleteMeasuredTemplate',(template:MeasuredTemplateDocument)=>{
  if(foundry.utils.getProperty(template,'flags.redline-combat.originalAim'))return;
  const id=foundry.utils.getProperty(template,'flags.redline-combat.areaMessage');
  if(typeof id!=='string')return;
  const message=messages.get(id);if(message)for(const effect of actionEffects(id,message.flags))areaRuns.get(effect.key)?.();
 });
 Hooks.on('canvasReady',resume);Hooks.on('refreshMeasuredTemplate',()=>{for(const display of displays.values())display.hide()});Hooks.on('updateMeasuredTemplate',()=>{for(const display of displays.values())display.hide()});Hooks.on('canvasTearDown',stop);Hooks.on('deleteChatMessage',(message:ChatMessage)=>{messages.delete(message.id??'');resumable.delete(message.id??'');for(const effect of actionEffects(message.id??'',message.flags)){remember(effect.key);runs.get(effect.key)?.();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else resume()});window.addEventListener('pagehide',stop);
}
