import {actorRefreshCandidates,frameRefresh,watchScreenTokenVisibility,tokenEffectsChanged,conditionPublisher} from './effect-refresh.js';
import {createSubstanceOverlay} from './substance-overlay.js';
import {createSmashScreenOverlay} from './smash-overlay.js';
const MODULE='night-city-ui';
const exposures=new Map<string,{combat:string|undefined,expires:number}>();
const cleared=new Set<string>();
export function hasPoisonExposure(uuid:string):boolean {return exposures.has(uuid);}
function activePoison(actor:Actor):boolean {
 const module=game.modules?.get('redline-combat') as unknown as {active?:boolean,api?:{hasMonitorExposure?:(uuid:string,kind:string)=>boolean,hasReportedExposure?:(actor:Actor,kind:string)=>boolean|undefined}}|undefined;
 const saved=module?.active?module.api?.hasReportedExposure?.(actor,'poison'):undefined;
 if(saved!==undefined)return saved;
 if(module?.active&&module.api?.hasMonitorExposure?.(actor.uuid,'poison'))return true;
 return [...(actor.allApplicableEffects?.()??actor.effects)].some(effect=>!effect.disabled&&!effect.isSuppressed&&(
  /\bpoison(?:ed)?\b/i.test(game.i18n?.localize(effect.name??'')??effect.name??'')||[...effect.statuses].some(id=>/^poison(?:ed)?$/i.test(id))));
}
/** Honor native ActiveEffect expiry without deleting or modifying game conditions. */
export function hasBlueGlass(actor:Actor|undefined):boolean {
 return hasPrimaryDrug(actor,'Blue Glass','ms4wgzm5hmji55py');
}
export function hasSmash(actor:Actor|undefined):boolean {
 return hasPrimaryDrug(actor,'Smash','s2kb8cl4soikifa9');
}
export function hasPrimaryDrug(actor:Actor|undefined,drug:string,statusId:string):boolean {
 return !!actor && [...new Set([...(actor.allApplicableEffects?.()??actor.effects),...[...(actor.items??[])].flatMap(item=>[...item.effects])])].some(effect=>{
  if(effect.disabled||effect.isSuppressed||(effect as ActiveEffect & {system?:{isSuppressed?:boolean}}).system?.isSuppressed)return false;
  const name=game.i18n?.localize(effect.name??'')??effect.name??'';
  if(/addiction|addicted$/i.test(name))return false;
  const pattern=new RegExp('^'+drug.replace(' ','[ -]?')+'(?:\\s+(?:addicted )?primary(?: effect)?)?(?:\\s*\\(.*\\))?$','i');
  if(!pattern.test(name) && ![...effect.statuses].some(id=>id===statusId||id.toLowerCase().replace(/[ -]/g,'')===drug.toLowerCase().replace(/ /g,'')))return false;
  const duration=effect.duration as typeof effect.duration & {remaining?:number};
  if(duration.seconds!=null&&duration.startTime!=null&&Number(game.time?.worldTime??0)>=duration.startTime+duration.seconds)return false;
  return duration.remaining==null || duration.remaining>0;
 });
}
export function registerSubstanceEffects():void {
 const publish=conditionPublisher('pneumaVisualToolsExposureChanged');
 const poison=createSubstanceOverlay('poison'),glass=createSubstanceOverlay('blueGlass'),smash=createSmashScreenOverlay();
 let ready=false;
 const candidates=actorRefreshCandidates();
 const update=()=>{
  if(!ready)return;
  const selected=canvas.tokens?.controlled?.filter(token=>token.actor?.isOwner&&token.isVisible);
  const actor=selected?.length===1?selected[0]!.actor:game.user?.character;
  const now=Number(game.time?.worldTime??0);
  for(const [uuid,entry] of exposures)if(!entry.combat&&now>=entry.expires){exposures.delete(uuid);cleared.add(uuid);}
  const actors=candidates.take(actor);
  for(const candidate of actors.values()) {
   if(!activePoison(candidate)){cleared.delete(candidate.uuid);continue;}
   if(cleared.has(candidate.uuid)||exposures.has(candidate.uuid))continue;
   const combat=game.combats?.find(c=>c.started&&c.combatants.some(member=>member.actor?.uuid===candidate.uuid));
   exposures.set(candidate.uuid,{combat:combat?.id,expires:now+6});
  }
  publish(exposures.entries());
  const visible=!document.hidden&&!!actor;
  if(visible&&game.settings!.get(MODULE,'screenEffects')&&exposures.has(actor!.uuid))poison.start();else poison.stop();
  if(visible&&game.settings!.get(MODULE,'screenEffects')&&hasBlueGlass(actor??undefined))glass.start();else glass.stop();
  if(visible&&game.settings!.get(MODULE,'screenEffects')&&hasSmash(actor??undefined))smash.start();else smash.stop();
 };
 const refresh=frameRefresh(update),sync=refresh.schedule;
 Hooks.on('canvasTearDown',refresh.cancel);
 window.addEventListener('pagehide',refresh.cancel);
 Hooks.on('pneumaVisualToolsScreenEffectsChanged',sync);
 watchScreenTokenVisibility(sync);
 Hooks.once('ready',()=>{ready=true;sync();});
 Hooks.on('pneumaCombatToolsExposure',(uuid:string,kind:string)=>{
  if(kind!=='poison')return;
  cleared.delete(uuid);
  const combat=game.combats?.find(c=>c.started&&c.combatants.some(member=>member.actor?.uuid===uuid));
  exposures.set(uuid,{combat:combat?.id,expires:Number(game.time?.worldTime??0)+6});sync();
 });
 Hooks.on('updateCombat',(combat:Combat,changes:Record<string,unknown>)=>{
  for(const [uuid,entry] of exposures)if(entry.combat===combat.id&&(!combat.started||(('turn' in changes||'round' in changes)&&combat.combatant?.actor?.uuid===uuid))){exposures.delete(uuid);cleared.add(uuid);}
  sync();
 });
 Hooks.on('deleteCombat',(combat:Combat)=>{for(const [uuid,entry] of exposures)if(entry.combat===combat.id){exposures.delete(uuid);cleared.add(uuid);}sync();});
 for(const hook of ['controlToken','deleteToken','updateUser','pneumaVisualToolsScreenEffectsChanged','pneumaCombatToolsFlashbangChanged'])Hooks.on(hook,sync);
 for(const hook of ['canvasReady','updateWorldTime'])Hooks.on(hook,()=>{candidates.all();sync();});
 for(const hook of ['updateActor','createItem','updateItem','deleteItem','createActiveEffect','updateActiveEffect','deleteActiveEffect'])Hooks.on(hook,(doc:Actor|Item|ActiveEffect)=>{candidates.mark(doc);sync();});
 Hooks.on('createToken',(doc:TokenDocument)=>{candidates.mark(doc);sync();});
 Hooks.on('updateToken',(_doc:TokenDocument,changes:Record<string,unknown>)=>{if(tokenEffectsChanged(changes)){candidates.mark(_doc);sync();}});
 Hooks.on('canvasTearDown',()=>{poison.stop();glass.stop();smash.stop();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){refresh.cancel();update();}else sync();});
 window.addEventListener('pagehide',()=>{poison.stop();glass.stop();smash.stop();});
}
