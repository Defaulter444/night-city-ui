import {frameRefresh,watchScreenTokenVisibility,tokenEffectsChanged,conditionPublisher} from './effect-refresh.js';
import {createElectricalOverlay} from './electrical-overlay.js';
export type ElectricalKind='electrical'|'emp';
type Entry={combat?:string,expires:number};
const held=new Map<string,Map<ElectricalKind,Entry>>();
export function hasElectricalShock(actor:Actor|undefined):boolean {return !!actor&&!!held.get(actor.uuid)?.has('electrical');}
export function hasEMP(actor:Actor|undefined):boolean {
 if(!actor)return false;
 const module=game.modules?.get('redline-combat') as unknown as {active?:boolean,api?:{hasActorEMP?:(actor:Actor)=>boolean}}|undefined;
 const status=[...(actor.allApplicableEffects?.()??actor.effects)].some(effect=>{
  if(!effect.statuses.has('3l6yrmvd37862mll')||effect.disabled||effect.isSuppressed||(effect as ActiveEffect & {system?:{isSuppressed?:boolean}}).system?.isSuppressed)return false;
  const duration=effect.duration as typeof effect.duration & {remaining?:number};
  if(duration.seconds!=null&&duration.startTime!=null&&Number(game.time?.worldTime??0)>=duration.startTime+duration.seconds)return false;
  return duration.remaining==null||duration.remaining>0;
 });
 return status||!!(module?.active&&module.api?.hasActorEMP?.(actor))||!!held.get(actor.uuid)?.has('emp');
}
/** Prepared renderer API; gameplay integrations will call this later. */
export function registerElectricalEffects():void {
 const publish=conditionPublisher('pneumaVisualToolsElectricalChanged');
 const electrical=createElectricalOverlay('electrical'),emp=createElectricalOverlay('emp');let ready=false;
 const update=()=>{
  if(!ready)return;
  const selected=canvas.tokens?.controlled?.filter(token=>token.actor?.isOwner&&token.isVisible);
  const actor=selected?.length===1?selected[0]!.actor:game.user?.character;
  const now=Number(game.time?.worldTime??0);
  for(const [uuid,entries] of held){for(const [kind,entry] of entries)if(!entry.combat&&now>=entry.expires)entries.delete(kind);if(!entries.size)held.delete(uuid);}
  const visible=!document.hidden&&game.settings!.get('night-city-ui','screenEffects');
  if(visible&&hasElectricalShock(actor??undefined))electrical.start();else electrical.stop();
  if(visible&&hasEMP(actor??undefined))emp.start();else emp.stop();
  publish(Array.from(held,([uuid,entries])=>[uuid,[...entries]] as const));
 };
 const refresh=frameRefresh(update),sync=refresh.schedule;
 Hooks.on('canvasTearDown',refresh.cancel);
 window.addEventListener('pagehide',refresh.cancel);
 const activate=(actor:Actor,kind:ElectricalKind)=>{
  if(kind!=='electrical'&&kind!=='emp')return;
  const combat=game.combats?.find(c=>c.started&&c.combatants.some(member=>member.actor?.uuid===actor.uuid));
  const entries=held.get(actor.uuid)??new Map<ElectricalKind,Entry>();entries.set(kind,{combat:combat?.id,expires:Number(game.time?.worldTime??0)+6});held.set(actor.uuid,entries);sync();
 };
 const module=game.modules!.get('night-city-ui') as unknown as {api?:Record<string,unknown>};
 module.api={...module.api,activateElectricalEffect:activate};
 watchScreenTokenVisibility(sync);
 Hooks.once('ready',()=>{ready=true;sync();});
 Hooks.on('updateCombat',(combat:Combat,changes:Record<string,unknown>)=>{for(const [uuid,entries] of held){for(const [kind,entry] of entries)if(entry.combat===combat.id&&(!combat.started||(('turn' in changes||'round' in changes)&&combat.combatant?.actor?.uuid===uuid)))entries.delete(kind);if(!entries.size)held.delete(uuid);}sync();});
 Hooks.on('deleteCombat',(combat:Combat)=>{for(const [uuid,entries] of held){for(const [kind,entry] of entries)if(entry.combat===combat.id)entries.delete(kind);if(!entries.size)held.delete(uuid);}sync();});
 for(const hook of ['controlToken','deleteToken','updateActor','createItem','updateItem','deleteItem','createActiveEffect','updateActiveEffect','deleteActiveEffect','canvasReady','updateWorldTime','updateUser','pneumaVisualToolsScreenEffectsChanged'])Hooks.on(hook,sync);
 Hooks.on('updateToken',(_doc:TokenDocument,changes:Record<string,unknown>)=>{if(tokenEffectsChanged(changes))sync();});
 Hooks.on('canvasTearDown',()=>{electrical.stop();emp.stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden){refresh.cancel();update();}else sync();});window.addEventListener('pagehide',()=>{electrical.stop();emp.stop();});
}
