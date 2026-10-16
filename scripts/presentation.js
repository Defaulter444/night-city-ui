import { presentationContext } from './layout.js';

/** REDLINE Blackglass owns its layout, visibility and collapse controls. */
export function ownsDockPresentation(root) {
  return Boolean(root?.classList?.contains('redline-blackglass') || root?.dataset?.layout === 'blackglass-dock');
}

const adapterClasses = ['ncu-actor-compact','ncu-empty-targets','ncu-idle','ncu-no-queue','ncu-no-actor','ncu-tight-dock'];
function clearDockAdapter(root) {
  if(!root)return;
  for(const name of adapterClasses)if(root.classList.contains(name))root.classList.toggle(name,false);
  root.querySelector('[data-ncu-dock-toggle]')?.remove();
}

/** Use the same permitted subject for visibility and the space reserved for its card. */
export function resolveHUDPresentation({combat,controlledSelected,projectedSelected,contextOnly=true,spacious,expanded,hasTargets}) {
  // In contextual mode an assigned character alone must not occupy an idle scene.
  const selected=controlledSelected || ((combat?.started || !contextOnly) ? projectedSelected : null);
  return {
    selected,
    context:presentationContext({combat,selected,contextOnly}),
    dock:dockSize({spacious,expanded,selected:Boolean(selected),hasTargets}),
  };
}

/** Requested presentation bounds; no document data or permissions are modified. */
export function dockSize({spacious,expanded,selected,hasTargets}) {
  if(!spacious)return {height:210,width:Infinity};
  if(!selected)return {height:0,width:540};
  return {height:(expanded?340:80)+(hasTargets?32:0),width:expanded?980:540};
}

export function updateDock(root,{spacious,expanded,hasTargets,onToggle}) {
  if(!root)return;
  if(ownsDockPresentation(root)){clearDockAdapter(root);return;}
  for(const [name,value] of [['ncu-actor-compact',spacious&&!expanded],['ncu-empty-targets',spacious&&!hasTargets]]) {
    if(root.classList.contains(name)!==value)root.classList.toggle(name,value);
  }
  const card=root.querySelector('.redline-actor:not(.redline-empty)');
  let button=root.querySelector('[data-ncu-dock-toggle]');
  if(!spacious||!card){button?.remove();return;}
  if(!button){
    button=document.createElement('button');button.type='button';button.dataset.ncuDockToggle='true';
    button.addEventListener('click',event=>{event.stopPropagation();void onToggle();});
    card.append(button);
  }
  button.setAttribute('aria-expanded',String(expanded));
  const label=expanded?'Свернуть':'Действия';
  if(button.textContent!==label){
    const text=document.createElement('span');text.textContent=label;
    const icon=document.createElement('i');icon.className=`fa-solid fa-chevron-${expanded?'up':'down'}`;icon.setAttribute('aria-hidden','true');
    button.replaceChildren(text,icon);
  }
  button.title=expanded?'Свернуть действия персонажа':'Открыть оружие, навыки и броски персонажа';
}

export function removeDockAdapter(){
  document.querySelectorAll('[data-ncu-dock-toggle]').forEach(button=>button.remove());
  clearDockAdapter(document.querySelector('#redline-combat-hud'));
}
