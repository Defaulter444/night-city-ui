import { layoutHUD } from './layout.js';
import { canOpenNet, sheetActor, atlasAccess } from './access.js';
import { ownsDockPresentation, resolveHUDPresentation, updateDock, removeDockAdapter } from './presentation.js';
import { createPopover } from './popover.js';
import { createPlayersPanel } from './players.js';

const ID = 'night-city-ui';
const moduleAPI = id => game.modules.get(id)?.active ? game.modules.get(id).api : null;
const active = id => Boolean(game.modules.get(id)?.active);
const pref = key => game.settings.get(ID, key);
let shell, frame, observer, resizing, timerObserver, currentTimer, events, lastLayout, morePopover, agentPopover, playersPanel, currentPlayers;
let ready = false;
const observed = new Set();

function cls(element, name, value) {
  if (element && element.classList.contains(name) !== Boolean(value)) element.classList.toggle(name, Boolean(value));
}
function css(name, value) {
  const next = `${Math.round(value)}px`;
  if (document.body.style.getPropertyValue(name) !== next) document.body.style.setProperty(name, next);
}
function rect(selector) {
  const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!element || element.hidden) return null;
  const style = getComputedStyle(element), bounds = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0 ? bounds : null;
}
function currentActor() { return sheetActor({user:game.user,controlled:canvas?.ready ? canvas.tokens?.controlled : []}); }
async function savePlayers(patch) {
  for(const [key,value] of Object.entries(patch))await game.settings.set(ID,{visible:'showPlayers',expanded:'playersExpanded',position:'playersPosition'}[key],value);
}
async function resetPlayers() {
  if(playersPanel)return playersPanel.reset();
  await savePlayers({visible:true,expanded:false,position:{}});
}
function updatePlayers() {
  const panel=document.querySelector('#ui-left > #players');
  if(panel!==currentPlayers||(!playersPanel&&panel)){
    playersPanel?.destroy();currentPlayers=panel;
    playersPanel=panel?createPlayersPanel({panel,onSave:savePlayers,onLayout:schedule,onError:error=>{console.error(`${ID} | Players`,error);ui.notifications.warn('Не удалось сохранить настройки панели игроков.');}}):null;
  }
  playersPanel?.update({visible:pref('showPlayers'),expanded:pref('playersExpanded'),position:pref('playersPosition'),spacious:pref('spacious')});
}
function redlineSheetButton() { return active('redline-combat') ? document.querySelector('#redline-combat-hud [data-action="sheet"]:not(:disabled)') : null; }
function netAccess() {
  return canOpenNet({ user:game.user, actors:game.actors?.contents ?? [], allowSpectators:active('cpr-netrunning') && game.settings.get('cpr-netrunning','allowSpectators') });
}
function actionDefinitions() {
  const agent = moduleAPI('night-city-agent');
  const atlas = moduleAPI('night-city-2045-atlas');
  const cityAccess = atlasAccess({ user: game.user, api: atlas });
  const definitions = {
    actor: { label:'Персонаж', icon:'fa-user', hint:'Лист персонажа из боевой панели или назначенного персонажа', available:Boolean(redlineSheetButton()||currentActor()), reason:'Выберите доступного персонажа на сцене или в очереди боя либо назначьте его пользователю.', run:async () => { const redlineButton=redlineSheetButton(); if(redlineButton){redlineButton.click();return;} const sheet=currentActor()?.sheet; if(!sheet)return; if(sheet.rendered){await sheet.maximize?.();sheet.bringToTop?.();}else sheet.render(true); } },
    agent: { label:'Агент', icon:'fa-mobile-screen-button', hint:'Связь, задания и личные файлы', available:typeof agent?.openAgent==='function', run:()=>agent.openAgent() },
    market: { label:'Торговля', icon:'fa-store', hint:'Магазины, услуги и покупки', available:active('night-city-market') && typeof game.nightCityMarket?.open==='function', reason:'Модуль торговли выключен, ещё загружается или обнаружил конфликт с другим торговым модулем.', run:()=>game.nightCityMarket.open() },
    net: { label:'СЕТЬ', icon:'fa-microchip', hint:'Нетраннер и NET-архитектуры', available:active('cpr-netrunning') && Boolean(globalThis.CRNS?.ui) && netAccess(), reason:'Нужен принадлежащий вам персонаж с экипированной кибердекой либо разрешённый ведущим просмотр. Модуль нетраннинга должен быть включён.', run:()=>{const app=globalThis.CRNS.ui; if(app.rendered){app.maximize?.();app.bringToTop?.();}else app.render(true);} },
    city: { label:'Город', icon:'fa-map-location-dot', hint:game.user.isGM?'Атлас Найт-Сити':'Карта города и доступные вам места', ...cityAccess, run:()=>atlas.open() },
    battle: { label:'Бой', icon:'fa-swords', hint:'Трекер боя и обзор персонажа', available:true, run:async()=>{ui.sidebar.activateTab('combat');if(active('redline-combat'))await moduleAPI('redline-combat')?.open?.();} },
    timer: { label:'Настроить таймер', icon:'fa-stopwatch', hint:'Подпись, длительность, запуск и видимость', gm:true, available:typeof moduleAPI('cpr-deadline')?.open==='function', run:()=>moduleAPI('cpr-deadline').open() },
    collapseTimer: { label:'Свернуть / развернуть таймер', icon:'fa-clock', available:typeof moduleAPI('cpr-deadline')?.toggleCollapsed==='function', run:()=>moduleAPI('cpr-deadline').toggleCollapsed() },
    positionTimer: { label:'Вернуть таймер на место', icon:'fa-arrow-rotate-left', hint:'Только положение на вашем экране', available:typeof moduleAPI('cpr-deadline')?.resetPosition==='function', run:()=>moduleAPI('cpr-deadline').resetPosition() },
    positionPlayers: { label:'Вернуть панель игроков на место', icon:'fa-users', hint:'Показать компактную панель в исходном положении на вашем экране', available:true, run:resetPlayers },
    gmAgent: { label:'Выдать Агент / пульт ведущего', icon:'fa-tower-broadcast', gm:true, available:typeof agent?.openGMPanel==='function', run:()=>agent.openGMPanel() },
    files: { label:game.user.isGM?'Файлы и терминалы':'Доступные терминалы', icon:'fa-folder-open', available:typeof agent?.openWorkspace==='function', run:()=>agent.openWorkspace(game.user.isGM ? {} : {tab:'terminals'}) },
    hud: { label:'Показать / скрыть боевую панель', icon:'fa-bars-progress', hint:'Личное переключение REDLINE', available:typeof moduleAPI('redline-combat')?.toggle==='function', run:()=>moduleAPI('redline-combat').toggle() },
    refreshHud: { label:'Обновить боевую панель', icon:'fa-rotate-right', hint:'Повторно получить текущие данные REDLINE', available:typeof moduleAPI('redline-combat')?.refresh==='function', run:()=>moduleAPI('redline-combat').refresh() }
  };
  return definitions;
}
function resolveAction(name) { return actionDefinitions()[name]; }

function button(action, detailed=false) {
  const data = resolveAction(action), element=document.createElement('button');
  element.type='button'; element.dataset.ncuAction=action;
  const icon=document.createElement('i');icon.className=`fa-solid ${data.icon}`;icon.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.textContent=data.label;
  if(detailed && data.hint){const hint=document.createElement('small');hint.className='ncu-hint';hint.textContent=data.hint;label.append(hint);}
  element.append(icon,label);return element;
}
function setMenu(open, focus=false) {
  morePopover?.setOpen(open,{focus});
}
function setScenes(open) {
  open=Boolean(open&&pref('spacious'));
  cls(document.body,'ncu-scenes-open',open);
  shell?.querySelector('.ncu-scene-toggle')?.setAttribute('aria-expanded',String(open));
}
function mount() {
  if(shell?.isConnected)return;
  shell=document.createElement('section');shell.id='ncu-shell';shell.setAttribute('aria-label','Найт-Сити — инструменты игры');
  shell.innerHTML='<nav class="ncu-bar" aria-label="Инструменты Найт-Сити"><div class="ncu-brand"><i class="fa-solid fa-city" aria-hidden="true"></i><span>НАЙТ-СИТИ</span></div><div class="ncu-tools"></div><span class="ncu-mode"></span><button type="button" class="ncu-more" aria-expanded="false" aria-controls="ncu-menu"><i class="fa-solid fa-sliders" aria-hidden="true"></i>Ещё</button></nav><section class="ncu-menu" id="ncu-menu" aria-label="Дополнительные инструменты" hidden><h3>Инструменты</h3></section>';
  const tools=shell.querySelector('.ncu-tools');
  const sceneToggle=document.createElement('button');sceneToggle.type='button';sceneToggle.className='ncu-scene-toggle';
  sceneToggle.setAttribute('aria-label','Сцены — открыть навигацию');sceneToggle.setAttribute('aria-expanded','false');sceneToggle.setAttribute('aria-controls','navigation');
  sceneToggle.innerHTML='<i class="fa-solid fa-location-dot" aria-hidden="true"></i><span class="ncu-scene-name"></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
  shell.querySelector('.ncu-bar').append(sceneToggle);
  const agentEntry=document.createElement('div');agentEntry.className='ncu-agent-entry';
  const agentToggle=document.createElement('button');agentToggle.type='button';agentToggle.className='ncu-agent-toggle';
  agentToggle.setAttribute('aria-label','Агент — инструменты ведущего');agentToggle.title='Агент — инструменты ведущего';
  agentToggle.setAttribute('aria-controls','ncu-agent-menu');agentToggle.hidden=!game.user.isGM;
  agentToggle.innerHTML='<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
  agentEntry.append(button('agent'),agentToggle);
  for(const action of ['actor','agent','market','net','city','battle'])tools.append(action==='agent'?agentEntry:button(action));
  const menu=shell.querySelector('.ncu-menu');
  for(const action of ['timer','files','hud','refreshHud','collapseTimer','positionTimer','positionPlayers'])menu.append(button(action,true));
  menu.insertAdjacentHTML('beforeend','<hr class="ncu-rule"><h3>На этом экране</h3>');
  for(const [key,label] of [['spacious','Просторный интерфейс Foundry'],['theme','Общая тема окон'],['compactTools','Убрать повторные значки слева'],['contextHud','Показывать боевые панели по ситуации'],['showPlayers','Показывать панель игроков']]) {
    const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.ncuSetting=key;input.checked=pref(key);row.append(input,document.createTextNode(label));menu.append(row);
  }
  const disable=document.createElement('button');disable.type='button';disable.dataset.ncuDisable='true';disable.innerHTML='<i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i><span>Вернуться к исходному интерфейсу</span>';
  menu.append(disable);
  menu.insertAdjacentHTML('beforeend','<p class="ncu-note">Alt + N — меню Найт-Сити. Оформление и расположение сохраняются только для вас.</p>');
  const agentMenu=document.createElement('section');agentMenu.id='ncu-agent-menu';agentMenu.className='ncu-menu ncu-agent-menu';
  agentMenu.setAttribute('aria-label','Агент — инструменты ведущего');agentMenu.hidden=true;agentMenu.append(button('gmAgent',true));
  shell.append(agentMenu);
  document.body.append(shell);
  events=new AbortController();const {signal}=events;
  morePopover=createPopover({anchor:shell.querySelector('.ncu-more'),toggle:shell.querySelector('.ncu-more'),panel:menu,signal,
    onOpen:()=>{agentPopover?.close();setScenes(false);}});
  agentPopover=createPopover({anchor:agentEntry,toggle:agentToggle,panel:agentMenu,hover:true,signal,
    canOpen:()=>Boolean(game.user?.isGM),onOpen:()=>{setMenu(false);setScenes(false);},nextFocus:()=>agentEntry.nextElementSibling});
  shell.addEventListener('pointerenter',schedule,{signal});
  shell.addEventListener('focusin',schedule,{signal});
  shell.addEventListener('click',async event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.matches('.ncu-scene-toggle')){setMenu(false);agentPopover?.close();setScenes(target.getAttribute('aria-expanded')!=='true');return;}
    if(target.dataset.ncuDisable){await game.settings.set(ID,'enabled',false);ui.notifications.info('Исходный интерфейс возвращён. Alt + N снова включит Найт-Сити.');return;}
    const action=resolveAction(target.dataset.ncuAction);if(!action)return;
    if(action.visible===false||(action.gm&&!game.user.isGM))return;
    if(!action.available){ui.notifications.info(action.reason||'Нужный модуль выключен или ещё загружается.');return;}
    target.disabled=true;
    try {await action.run();setMenu(false);agentPopover?.close();}catch(error){console.error(`${ID} |`,error);ui.notifications.error('Не удалось открыть инструмент. Подробности в консоли.');}
    finally{target.disabled=false;schedule();}
  },{signal});
  shell.addEventListener('change',event=>{const key=event.target.dataset.ncuSetting;if(key)void game.settings.set(ID,key,event.target.checked);},{signal});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#navigation,.ncu-scene-toggle'))setScenes(false);},{signal});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('ncu-scenes-open')){event.preventDefault();event.stopPropagation();setScenes(false);sceneToggle.focus();}},{signal,capture:true});
  // Native DEADLINE keeps ownership of drag coordinates. Stop docking once its own drag starts.
  window.addEventListener('pointermove',()=>queueMicrotask(()=>{const timer=document.querySelector('#cpr-deadline-hud');if(timer?.classList.contains('cprd-dragging'))cls(timer,'ncu-docked',false);}),{signal});
  window.addEventListener('pointerup',()=>{setTimeout(schedule,80);},{signal});
  window.addEventListener('resize',schedule,{signal});
  resizing=new ResizeObserver(schedule);
  observer=new MutationObserver(records=>{
    if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.matches?.('#sidebar,#controls,#navigation,#players,#hotbar,#cpr-deadline-hud,#redline-combat-hud,.window-app,.application')||node.querySelector?.('#redline-combat-hud')))))schedule();
  });
  observer.observe(document.body,{childList:true,subtree:true});
}

function destroy() {
  playersPanel?.destroy();playersPanel=null;currentPlayers=null;
  cancelAnimationFrame(frame);frame=null;events?.abort();morePopover=null;agentPopover=null;observer?.disconnect();resizing?.disconnect();timerObserver?.disconnect();currentTimer=null;observed.clear();shell?.remove();shell=null;
  for(const element of document.querySelectorAll('.ncu-relocated-tool'))element.classList.remove('ncu-relocated-tool');
  for(const element of document.querySelectorAll('#cpr-deadline-hud,#redline-combat-hud'))for(const c of ['ncu-docked','ncu-idle','ncu-no-queue','ncu-no-actor','ncu-tight-dock'])element.classList.remove(c);
  removeDockAdapter();
  cls(document.body,'ncu-enabled',false);cls(document.body,'ncu-theme',false);cls(document.body,'ncu-spacious',false);cls(document.body,'ncu-scenes-open',false);
}
function schedule() { if(!ready||frame)return;frame=requestAnimationFrame(()=>{frame=null;refresh();}); }

function refresh() {
  if(!pref('enabled')){destroy();return;}mount();cls(document.body,'ncu-enabled',true);cls(document.body,'ncu-theme',pref('theme'));cls(document.body,'ncu-spacious',pref('spacious'));
  updatePlayers();
  if(!pref('spacious'))setScenes(false);
  const scene=canvas?.scene;
  const sceneName=scene?.navName||scene?.name||'Сцены';
  const sceneLabel=shell.querySelector('.ncu-scene-name');
  if(sceneLabel.textContent!==sceneName)sceneLabel.textContent=sceneName;
  shell.querySelector('.ncu-scene-toggle').title=`Сцены: ${sceneName}`;
  const controlled=(canvas?.ready ? canvas.tokens?.controlled : []) ?? [];
  const battle=game.combat && (!game.combat.scene || game.combat.scene.id===canvas?.scene?.id) ? game.combat : null;
  const redlineState=moduleAPI('redline-combat')?.getState?.();
  const controlledSelected=controlled.find(token=>token.actor && ['character','mook'].includes(token.actor.type) && (game.user.isGM||token.actor.isOwner));
  const {context,dock:dockView}=resolveHUDPresentation({combat:battle,controlledSelected,projectedSelected:redlineState?.selected,contextOnly:pref('contextHud'),spacious:pref('spacious'),expanded:pref('dockExpanded'),hasTargets:Boolean(redlineState?.targets?.length)});
  const redline=document.querySelector('#redline-combat-hud');
  const nativeRedlinePresentation=ownsDockPresentation(redline);
  updateDock(redline,{spacious:pref('spacious'),expanded:pref('dockExpanded'),hasTargets:Boolean(redlineState?.targets?.length),onToggle:()=>game.settings.set(ID,'dockExpanded',!pref('dockExpanded'))});
  cls(redline,'ncu-idle',!nativeRedlinePresentation&&!context.hud);cls(redline,'ncu-no-queue',!nativeRedlinePresentation&&!context.queue);cls(redline,'ncu-no-actor',!nativeRedlinePresentation&&!context.actor);
  const timer=document.querySelector('#cpr-deadline-hud');
  const view=active('cpr-deadline') ? game.settings.get('cpr-deadline','view') : null;
  const timerManaged=!Number.isFinite(view?.x)&&!Number.isFinite(view?.y)&&!timer?.classList.contains('cprd-dragging');
  cls(timer,'ncu-docked',timerManaged);
  if(timer!==currentTimer){timerObserver?.disconnect();currentTimer=timer;if(timer){timerObserver=new MutationObserver(schedule);timerObserver.observe(timer,{attributes:true,attributeFilter:['class','hidden']});}}
  const controlBoxes=[...document.querySelectorAll('#controls .scene-control,#controls .control-tool')].map(rect).filter(Boolean);
  const controls=controlBoxes.length?{right:Math.max(...controlBoxes.map(b=>b.right))}:null;
  lastLayout=layoutHUD({width:innerWidth,height:innerHeight,sidebar:rect('#sidebar'),controls,navigation:rect('#navigation'),hotbar:rect('#hotbar'),players:rect(currentPlayers),playersFloating:Boolean(playersPanel),timer:rect(timer),timerManaged,dockHeight:dockView.height,dockWidth:dockView.width,spacious:pref('spacious')});
  const {toolbar,combat,dock}=lastLayout;
  for(const [name,value] of Object.entries({left:toolbar.left,top:toolbar.top,width:toolbar.width,'combat-left':combat.left,'combat-top':combat.top,'combat-width':combat.width,'dock-left':dock.left,'dock-width':dock.width,'dock-bottom':innerHeight-dock.bottom,'dock-height':dock.height,'timer-left':lastLayout.timer?.left??0,'timer-top':lastLayout.timer?.top??0}))css(`--ncu-${name}`,value);
  cls(shell,'ncu-compact',lastLayout.compact);
  cls(redline,'ncu-tight-dock',!nativeRedlinePresentation&&dock.height<120);
  const mode=shell.querySelector('.ncu-mode');mode.textContent=context.battle?`Бой · раунд ${battle.round}`:'Обычная игра';mode.dataset.battle=String(context.battle);
  cls(shell.querySelector('[data-ncu-action="battle"]'),'ncu-current',context.battle);
  const actions=actionDefinitions();
  for(const button of shell.querySelectorAll('[data-ncu-action]')) {
    const action=actions[button.dataset.ncuAction];button.hidden=Boolean(action.visible===false||(action.gm&&!game.user.isGM));button.setAttribute('aria-disabled',String(!action.available));button.title=action.available?(action.hint||action.label):(action.reason||'Нужный модуль выключен или ещё загружается.');
  }
  for(const input of shell.querySelectorAll('[data-ncu-setting]'))input.checked=pref(input.dataset.ncuSetting);
  shell.querySelector('.ncu-agent-toggle').hidden=!game.user.isGM;
  morePopover?.position();agentPopover?.position();
  const shortcuts={'nca-agent':'agent','nca-workspace':'files','nca-terminals':'files','nca-agent-gm':'gmAgent','night-city-market':'market','crns':'net','nightCityAtlas':'city','redline-combat':'hud','cpr-deadline':'timer'};
  for(const tool of document.querySelectorAll('#controls [data-tool]'))cls(tool,'ncu-relocated-tool',pref('compactTools')&&shortcuts[tool.dataset.tool]&&actions[shortcuts[tool.dataset.tool]].available);
  for(const selector of ['#sidebar','#controls','#navigation','#hotbar','#action-bar','#players','#cpr-deadline-hud']) {
    const element=document.querySelector(selector);if(element&&!observed.has(element)){observed.add(element);resizing.observe(element);}
  }
  for(const element of observed)if(!element.isConnected){resizing.unobserve(element);observed.delete(element);}
}

Hooks.once('init',()=>{
  for(const [key,name,defaultValue] of [['enabled','Найт-Сити: общий интерфейс',true],['spacious','Найт-Сити: просторный интерфейс Foundry',true],['dockExpanded','Найт-Сити: раскрытая карточка персонажа',false],['theme','Найт-Сити: общая тема окон',true],['compactTools','Найт-Сити: убрать повторные значки',true],['contextHud','Найт-Сити: боевые панели по ситуации',true],['showPlayers','Найт-Сити: показывать панель игроков',true],['playersExpanded','Найт-Сити: развернуть панель игроков',false]])game.settings.register(ID,key,{name,scope:'client',config:!['dockExpanded','playersExpanded'].includes(key),type:Boolean,default:defaultValue,onChange:schedule});
  game.settings.register(ID,'playersPosition',{name:'Найт-Сити: положение панели игроков',scope:'client',config:false,type:Object,default:{},onChange:schedule});
  game.keybindings.register(ID,'menu',{name:'Найт-Сити — открыть меню',editable:[{key:'KeyN',modifiers:['Alt']}],onDown:()=>{void openMenu();return true;}});
});
async function openMenu(){if(!pref('enabled'))await game.settings.set(ID,'enabled',true);refresh();setMenu(true,true);}
Hooks.once('ready',()=>{
  if(game.system.id!=='cyberpunk-red-core')return;ready=true;refresh();
  game.modules.get(ID).api=Object.freeze({openMenu,refresh:schedule,getLayout:()=>structuredClone(lastLayout),setEnabled:enabled=>game.settings.set(ID,'enabled',Boolean(enabled))});
  // Some host modules publish their API after asynchronous ready work.
  setTimeout(schedule,600);setTimeout(schedule,1800);
  window.addEventListener('beforeunload',destroy,{once:true});
});
for(const hook of ['renderSceneControls','renderSceneNavigation','collapseSceneNavigation','renderSidebar','collapseSidebar','renderPlayerList','renderHotbar','renderRedlineHUD','closeRedlineHUD','controlToken','canvasReady','canvasTearDown','createCombat','updateCombat','deleteCombat','combatStart','updateUser','createActor','updateActor','deleteActor','createItem','updateItem','deleteItem','updateSetting','nightCityAtlasAccessChanged'])Hooks.on(hook,schedule);
