import {frameRefresh,watchScreenTokenVisibility,tokenEffectsChanged} from './effect-refresh.js';
import {createHumanityOverlay, type HumanityStage} from './humanity-overlay.js';
const MODULE='night-city-ui';
export function humanityStage(value:unknown):HumanityStage|undefined {
 if(typeof value!=='number'||!Number.isFinite(value)||value>=30)return;
 return value>=20?'dissociative':value>=10?'psychopathy':'cyberpsycho';
}
export function registerHumanityEffects():void {
 const overlay=createHumanityOverlay();let ready=false;
 const update=()=>{
  if(!ready)return;
  if(document.hidden||!game.settings!.get(MODULE,'screenEffects')){overlay.stop();return;}
  const selected=canvas.tokens?.controlled?.filter(token=>token.actor?.isOwner&&token.isVisible);
  const actor=selected?.length===1?selected[0]!.actor:game.user?.character;
  const value=(actor?.system as {derivedStats?:{humanity?:{value?:unknown}}}|undefined)?.derivedStats?.humanity?.value;
  const stage=humanityStage(value);if(stage)overlay.start(stage);else overlay.stop();
 };
 const refresh=frameRefresh(update),sync=refresh.schedule;
 Hooks.on('canvasTearDown',refresh.cancel);
 window.addEventListener('pagehide',refresh.cancel);
 Hooks.on('pneumaVisualToolsScreenEffectsChanged',sync);
 watchScreenTokenVisibility(sync);
 Hooks.once('ready',()=>{ready=true;sync();});
 for(const hook of ['controlToken','deleteToken','updateActor','updateUser','canvasReady','createActiveEffect','updateActiveEffect','deleteActiveEffect'])Hooks.on(hook,sync);
 Hooks.on('updateToken',(_doc:TokenDocument,changes:Record<string,unknown>)=>{if(tokenEffectsChanged(changes))sync();});
 Hooks.on('canvasTearDown',()=>overlay.stop());
 document.addEventListener('visibilitychange',()=>{if(document.hidden){refresh.cancel();update();}else sync();});
 window.addEventListener('pagehide',()=>overlay.stop());
}
