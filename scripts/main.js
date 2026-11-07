import { layoutHUD, drawerBounds } from './layout.js';
import { canOpenNet, sheetActor, atlasAccess } from './access.js';
import { ownsDockPresentation, resolveHUDPresentation, updateDock, removeDockAdapter } from './presentation.js';
import { createPopover } from './popover.js';
import { createPlayersPanel } from './players.js';
import { SECTION_ORDER, sectionState, windowSection, pickActiveSection } from './topbar/sections.js';
import { keyLabel } from './topbar/keys.js';
import { combatStatus, timerView } from './topbar/status.js';
import { createDrawer, drawerMode } from './drawer/drawer.js';
import { NO_UNREAD, addUnread, unreadLabel, chatTip, messageTone, feedCard } from './drawer/messages.js';
import { createFeed, readMessage } from './drawer/feed-view.js';
import { createScenePanel } from './topbar/scenes-view.js';

const ID = 'night-city-ui';
const moduleAPI = id => game.modules.get(id)?.active ? game.modules.get(id).api : null;
const active = id => Boolean(game.modules.get(id)?.active);
const pref = key => game.settings.get(ID, key);
let shell, frame, observer, resizing, timerObserver, currentTimer, events, lastLayout, morePopover, agentPopover, playersPanel, currentPlayers, timerTick, drawer, feed, scenePanel, scenePopover;
let ready = false, failed = false, readyAt = 0, deadlineWarned = false, drawerWarned = false, searchWarned = false, unread = NO_UNREAD;
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
// Foundry v12 declares its V1 classes with `class` in a classic script: they are global names, not globalThis properties.
function coreClass(name) {
  const classes={ActorSheet:typeof ActorSheet==='function'?ActorSheet:null,CombatTracker:typeof CombatTracker==='function'?CombatTracker:null};
  return classes[name]??null;
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
function currentBattle() {
  const combat=game.combat;
  return combat && (!combat.scene || combat.scene.id===canvas?.scene?.id) ? combat : null;
}
// The chat counts as on screen when the sidebar is not a drawer (no counter then), when the drawer shows the chat,
// or when the chat is popped out into its own window.
function chatOnScreen() {
  const popout=ui.sidebar?.popouts?.chat;
  if(popout?.rendered&&!popout._minimized)return true;
  if(!drawer?.active)return true;
  return drawer.open&&drawer.tab==='chat';
}
// «БОЙ» and the chat button toggle the drawer; the combat status only opens it. Without the drawer: as in 0.4.1.
function toggleSidebarTab(tab) {
  if(drawer?.active)return drawer.toggle(tab);
  ui.sidebar?.activateTab(tab);return true;
}
function showSidebarTab(tab) {
  if(drawer?.active)return drawer.show(tab);
  ui.sidebar?.activateTab(tab);ui.sidebar?.expand?.();return true;
}
function updateDrawerChrome() {
  const tabs=document.getElementById('sidebar-tabs');
  let close=tabs?.querySelector('.ncu-drawer-close');
  if(tabs&&drawer.active&&!close){
    close=document.createElement('button');close.type='button';close.className='ncu-drawer-close';
    close.setAttribute('aria-label','Закрыть сайдбар');close.dataset.tooltip='Закрыть (Esc)';
    close.innerHTML='<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    close.addEventListener('click',()=>drawer?.hide());tabs.append(close);
  }
  if(close)close.hidden=!drawer.active;
  if(chatOnScreen())unread=NO_UNREAD;
  const button=shell.querySelector('.ncu-chat');
  button.hidden=!drawer.active;
  const isOpen=drawer.open&&drawer.tab==='chat';
  cls(button,'is-open',isOpen);button.setAttribute('aria-expanded',String(isOpen));
  const badge=button.querySelector('.ncu-chat-count'),label=unreadLabel(unread.count);
  badge.hidden=!label;if(badge.textContent!==label)badge.textContent=label;cls(badge,'is-whisper',unread.whisper);
  const key=keyLabel(game.keybindings.get(ID,'chat'));
  const keyElement=button.querySelector('[data-ncu-key="chat"]');if(keyElement.textContent!==key)keyElement.textContent=key;
  setTip(button,chatTip({count:unread.count,whisper:unread.whisper,key}));
}
function toneOf(message) {
  const author=message.author??message.user;
  return messageTone({whisper:Boolean(message.whisper?.length),authorIsGM:Boolean(author?.isGM),hasActor:Boolean(message.speaker?.actor),style:message.style,isRoll:Boolean(message.isRoll),otherStyle:CONST.CHAT_MESSAGE_STYLES?.OTHER??0});
}
function feedCardFor(message) {
  const tone=toneOf(message);
  const {rollCard,text}=readMessage(message.content);
  const first=message.isRoll?message.rolls?.[0]:null;
  return feedCard({id:message.id,alias:message.alias,tone,rollCard,roll:first?{formula:first.formula,total:first.total}:null,text,blind:Boolean(message.blind),isGM:game.user.isGM});
}
// Runs a tick after createChatMessage, so Dice So Nice has already marked a roll it is about to animate.
function queueFeed(message) {
  if(!feed?.enabled||!message.visible)return;
  setTimeout(async()=>{
    try{
      if(message._dice3danimating)await feed?.waitForDice(message.id);
      if(!feed?.enabled||chatOnScreen()||!game.messages.get(message.id))return;
      feed.push(feedCardFor(message));
    }catch(error){console.error(`${ID} | лента сообщений`,error);}
  },0);
}
// Search through Quick Insert (0.5.4): the button exists only while its API does; the key label follows its binding.
function quickInsertKey() {
  try{return keyLabel(game.keybindings.get('quick-insert','toggleOpen'));}catch{return '';}
}
function updateSearch() {
  const button=shell.querySelector('.ncu-search');
  const installed=active('quick-insert'),usable=installed&&typeof globalThis.QuickInsert?.open==='function';
  if(installed&&!usable&&!searchWarned&&Date.now()-readyAt>5000){searchWarned=true;console.warn(`${ID} | API Quick Insert недоступен, кнопка поиска скрыта.`);}
  button.hidden=!usable;
  if(!usable)return;
  const key=quickInsertKey(),keyElement=button.querySelector('[data-ncu-key="search"]');
  if(keyElement.textContent!==key)keyElement.textContent=key;
  const label=`Поиск по миру${key?` (${key})`:''}`;
  if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
  setTip(button,`Поиск по миру: актёры, предметы, журналы, сцены и компендиумы. Quick Insert${key?`, ${key}`:''}.`);
}
function serverNow() { const time=game.time?.serverTime; return Number.isFinite(time) ? time : Date.now(); }
function warnDeadline(message, error) {
  if(deadlineWarned)return;deadlineWarned=true;
  console.warn(`${ID} | ${message}`,error??'');
}
// DEADLINE publishes its API in its own ready hook: give it a few seconds before calling a missing API a fault.
function deadlineState() {
  if(!active('cpr-deadline'))return null;
  const api=moduleAPI('cpr-deadline');
  if(typeof api?.getState!=='function'){if(Date.now()-readyAt>5000)warnDeadline('API таймера DEADLINE недоступен, таймер в панели скрыт.');return null;}
  try{const state=api.getState();if(state&&typeof state==='object')return state;throw new TypeError('getState() вернул не объект');}
  catch(error){warnDeadline('API таймера DEADLINE изменился, таймер в панели скрыт.',error);return null;}
}
const barOwnsTimer = () => active('cpr-deadline') && typeof moduleAPI('cpr-deadline')?.getState==='function';
const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Foundry renders data-tooltip as HTML and does not re-read it while the pointer stays on the element:
// escape names that players can choose, and refresh a tooltip that is open right now.
function setTip(element, text) {
  const tip=escapeHTML(text);
  if(element.dataset.tooltip===tip)return;
  element.dataset.tooltip=tip;
  // Only under the pointer: activating during the core's pending close would cancel the close and leave it stuck.
  if(game.tooltip?.element===element&&element.matches(':hover'))game.tooltip.activate(element);
}
function node(tag, text, className) {
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
}
function updateCombatStatus() {
  const element=shell.querySelector('.ncu-combat-status');
  const status=combatStatus(currentBattle(),{isGM:game.user.isGM});
  element.hidden=!status;
  if(!status){delete element.dataset.key;return;}
  const key=`${status.text}|${status.secret}`;
  if(element.dataset.key!==key){
    element.dataset.key=key;
    const full=element.querySelector('.ncu-status-full');
    if(status.state==='prep')full.replaceChildren(node('em',status.text));
    else {
      full.replaceChildren(document.createTextNode('Раунд'),node('b',String(status.round)));
      if(status.turn)full.append(document.createTextNode(status.concealed?'· ':'· ходит '),node('em',status.turn));
      if(status.secret)full.append(node('i',undefined,'fa-solid fa-eye-slash ncu-status-secret'));
    }
    element.querySelector('.ncu-status-short').textContent=status.short;
    setTip(element,status.tooltip);element.setAttribute('aria-label',status.text);
  }
  cls(element,'is-prep',status.state==='prep');cls(element,'is-concealed',status.concealed);
}
// Repaints only the countdown, so the once-a-second tick never runs the whole layout pass.
function updateTimer() {
  clearTimeout(timerTick);timerTick=null;
  const element=shell.querySelector('.ncu-timer');
  const view=timerView(deadlineState(),{now:serverNow(),isGM:game.user.isGM});
  element.hidden=!view;
  cls(document.querySelector('#cpr-deadline-hud'),'ncu-timer-in-bar',Boolean(view));
  if(!view)return;
  const icon={running:'fa-stopwatch',paused:'fa-pause',expired:'fa-hourglass-end'}[view.status];
  const iconElement=element.querySelector('.ncu-timer-icon'),iconClass=`fa-solid ${icon} ncu-timer-icon`;
  if(iconElement.className!==iconClass)iconElement.className=iconClass;
  for(const [selector,text] of [['.ncu-timer-label',view.label],['.ncu-timer-time',view.time]]){const part=element.querySelector(selector);if(part.textContent!==text)part.textContent=text;}
  element.querySelector('.ncu-timer-secret').hidden=!(view.hiddenFromPlayers&&game.user.isGM);
  element.dataset.status=view.status;
  cls(element,'is-warning',view.warning);
  setTip(element,view.tooltip);if(element.getAttribute('aria-label')!==view.tooltip)element.setAttribute('aria-label',view.tooltip);
  element.setAttribute('aria-disabled',String(!game.user.isGM));
  if(view.nextTick)timerTick=setTimeout(()=>{timerTick=null;if(!shell?.isConnected||failed)return;try{updateTimer();}catch(error){fail(error);}},view.nextTick);
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
    actor: { label:'Персонаж', icon:'fa-user', hint:'Лист персонажа из боевой панели или назначенного персонажа', installed:true, available:Boolean(redlineSheetButton()||currentActor()), reason:'Выберите доступного персонажа на сцене или в очереди боя либо назначьте его пользователю.', run:async () => { const redlineButton=redlineSheetButton(); if(redlineButton){redlineButton.click();return;} const sheet=currentActor()?.sheet; if(!sheet)return; if(sheet.rendered){await sheet.maximize?.();sheet.bringToTop?.();}else sheet.render(true); } },
    agent: { label:'Агент', icon:'fa-mobile-screen-button', hint:'Связь, задания и личные файлы', installed:active('night-city-agent'), available:typeof agent?.openAgent==='function', reason:'Агент включён, но ещё загружается или его API недоступен.', run:()=>agent.openAgent() },
    market: { label:'Торговля', icon:'fa-store', hint:'Магазины, услуги и покупки', installed:active('night-city-market'), available:active('night-city-market') && typeof game.nightCityMarket?.open==='function', reason:'Модуль торговли выключен, ещё загружается или обнаружил конфликт с другим торговым модулем.', run:()=>game.nightCityMarket.open() },
    net: { label:'СЕТЬ', icon:'fa-microchip', hint:'Нетраннер и NET-архитектуры', installed:active('cpr-netrunning'), available:active('cpr-netrunning') && Boolean(globalThis.CRNS?.ui) && netAccess(), reason:'Нужен принадлежащий вам персонаж с экипированной кибердекой либо разрешённый ведущим просмотр. Модуль нетраннинга должен быть включён.', run:()=>{const app=globalThis.CRNS.ui; if(app.rendered){app.maximize?.();app.bringToTop?.();}else app.render(true);} },
    city: { label:'Город', icon:'fa-map-location-dot', hint:game.user.isGM?'Атлас Найт-Сити':'Карта города и доступные вам места', ...cityAccess, installed:active('night-city-2045-atlas'), run:()=>atlas.open() },
    battle: { label:'Бой', icon:'fa-swords', hint:'Трекер боя и обзор персонажа', installed:true, available:true, run:async()=>{const opened=toggleSidebarTab('combat');if(opened&&active('redline-combat'))await moduleAPI('redline-combat')?.open?.();} },
    timer: { label:'Настроить таймер', icon:'fa-stopwatch', hint:'Подпись, длительность, запуск и видимость', gm:true, available:typeof moduleAPI('cpr-deadline')?.open==='function', run:()=>moduleAPI('cpr-deadline').open() },
    // While the bar shows the countdown, DEADLINE's own card is hidden and these two have nothing to act on.
    collapseTimer: { label:'Свернуть / развернуть таймер', icon:'fa-clock', visible:!barOwnsTimer(), available:typeof moduleAPI('cpr-deadline')?.toggleCollapsed==='function', run:()=>moduleAPI('cpr-deadline').toggleCollapsed() },
    positionTimer: { label:'Вернуть таймер на место', icon:'fa-arrow-rotate-left', hint:'Только положение на вашем экране', visible:!barOwnsTimer(), available:typeof moduleAPI('cpr-deadline')?.resetPosition==='function', run:()=>moduleAPI('cpr-deadline').resetPosition() },
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
// Section tabs of the top bar: state and reason live in Foundry's tooltip, the lock shows only when access is missing.
function tab(action) {
  const element=button(action);
  element.classList.add('ncu-tab');
  element.dataset.tooltipDirection='DOWN';element.dataset.tooltipClass='ncu-tooltip';
  element.insertAdjacentHTML('beforeend','<i class="fa-solid fa-lock ncu-lock" aria-hidden="true"></i>');
  return element;
}
function setMenu(open, focus=false) {
  morePopover?.setOpen(open,{focus});
}
// Data for the scene panel: plain objects, so the panel and its pure logic never touch documents.
function renderScenes() {
  if(!scenePanel)return;
  const scenes=(game.scenes?.contents??[]).map(scene=>({id:scene.id,name:scene.name,navName:scene.navName,navigation:scene.navigation,visible:scene.visible,active:scene.active,isView:scene.isView,navOrder:scene.navOrder,folder:scene.folder?.id??null,thumb:scene.thumb??''}));
  const folders=game.user.isGM?(game.folders?.contents??[]).filter(folder=>folder.type==='Scene').map(folder=>({id:folder.id,name:folder.name,parent:folder.folder?.id??null,sort:folder.sort})):[];
  scenePanel.render({scenes,folders,isGM:game.user.isGM});
}
async function sceneAction(id, activate) {
  const scene=game.scenes?.get(id);if(!scene)return;
  scenePopover?.close();
  try{if(activate){if(game.user.isGM)await scene.activate();}else await scene.view();}
  catch(error){console.error(`${ID} | сцена`,error);ui.notifications.error('Не удалось открыть сцену. Подробности в консоли.');}
}
function setScenes(open) {
  open=Boolean(open&&pref('spacious'));
  cls(document.body,'ncu-scenes-open',open);
}
function mount() {
  if(shell?.isConnected)return;
  shell=document.createElement('section');shell.id='ncu-shell';shell.classList.add('ncu-tb');shell.setAttribute('aria-label','Найт-Сити — инструменты игры');
  shell.innerHTML='<nav class="ncu-bar" aria-label="Инструменты Найт-Сити"><div class="ncu-brand"><i class="fa-solid fa-city" aria-hidden="true"></i><span>НАЙТ-СИТИ</span></div><div class="ncu-tools"></div><div class="ncu-status" role="group" aria-label="Бой и таймер"><button type="button" class="ncu-combat-status" data-tooltip-direction="DOWN" data-tooltip-class="ncu-tooltip" hidden><span class="ncu-status-full"></span><span class="ncu-status-short"></span></button><button type="button" class="ncu-timer" data-tooltip-direction="DOWN" data-tooltip-class="ncu-tooltip" hidden><i class="fa-solid fa-stopwatch ncu-timer-icon" aria-hidden="true"></i><span class="ncu-timer-label"></span><b class="ncu-timer-time"></b><i class="fa-solid fa-eye-slash ncu-timer-secret" aria-hidden="true" hidden></i></button></div><button type="button" class="ncu-more" aria-expanded="false" aria-controls="ncu-menu"><i class="fa-solid fa-sliders" aria-hidden="true"></i><span>Ещё</span><kbd class="ncu-key" data-ncu-key="menu"></kbd></button></nav><section class="ncu-menu" id="ncu-menu" aria-label="Дополнительные инструменты" hidden><h3>Инструменты</h3></section>';
  const tools=shell.querySelector('.ncu-tools');
  const sceneToggle=document.createElement('button');sceneToggle.type='button';sceneToggle.className='ncu-scene-toggle';
  sceneToggle.setAttribute('aria-label','Сцены — карточки и поиск');sceneToggle.setAttribute('aria-expanded','false');sceneToggle.setAttribute('aria-controls','ncu-scenes');
  sceneToggle.innerHTML='<i class="fa-solid fa-location-dot" aria-hidden="true"></i><span class="ncu-scene-name"></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
  shell.querySelector('.ncu-more').before(sceneToggle);
  const searchButton=document.createElement('button');searchButton.type='button';searchButton.className='ncu-search';searchButton.hidden=true;
  searchButton.dataset.tooltipDirection='DOWN';searchButton.dataset.tooltipClass='ncu-tooltip';
  searchButton.innerHTML='<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span>Поиск</span><kbd class="ncu-key" data-ncu-key="search"></kbd>';
  sceneToggle.before(searchButton);
  const chatButton=document.createElement('button');chatButton.type='button';chatButton.className='ncu-chat';chatButton.hidden=true;
  chatButton.setAttribute('aria-controls','sidebar');chatButton.setAttribute('aria-expanded','false');
  chatButton.dataset.tooltipDirection='DOWN';chatButton.dataset.tooltipClass='ncu-tooltip';
  chatButton.innerHTML='<i class="fa-solid fa-comments" aria-hidden="true"></i><span>Чат</span><b class="ncu-chat-count" hidden></b><kbd class="ncu-key" data-ncu-key="chat"></kbd>';
  shell.querySelector('.ncu-more').before(chatButton);
  const agentEntry=document.createElement('div');agentEntry.className='ncu-agent-entry';
  const agentToggle=document.createElement('button');agentToggle.type='button';agentToggle.className='ncu-agent-toggle';
  agentToggle.setAttribute('aria-label','Агент — инструменты ведущего');agentToggle.title='Агент — инструменты ведущего';
  agentToggle.setAttribute('aria-controls','ncu-agent-menu');agentToggle.hidden=!game.user.isGM;
  agentToggle.innerHTML='<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
  agentEntry.append(tab('agent'),agentToggle);
  for(const action of SECTION_ORDER)tools.append(action==='agent'?agentEntry:tab(action));
  const menu=shell.querySelector('.ncu-menu');
  for(const action of ['timer','files','hud','refreshHud','collapseTimer','positionTimer','positionPlayers'])menu.append(button(action,true));
  menu.insertAdjacentHTML('beforeend','<hr class="ncu-rule"><h3>На этом экране</h3>');
  for(const [key,label] of [['spacious','Просторный интерфейс Foundry'],['theme','Общая тема окон'],['compactTools','Убрать повторные значки слева'],['contextHud','Показывать боевые панели по ситуации'],['sidebarDrawer','Сайдбар шторкой из панели'],['showPlayers','Показывать панель игроков']]) {
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
  drawer=createDrawer({signal,onChange:schedule});
  feed=createFeed({onOpen:()=>{drawer?.show('chat',{focus:true});schedule();},reducedMotion:()=>matchMedia('(prefers-reduced-motion: reduce)').matches});
  morePopover=createPopover({anchor:shell.querySelector('.ncu-more'),toggle:shell.querySelector('.ncu-more'),panel:menu,signal,
    onOpen:()=>{agentPopover?.close();scenePopover?.close();setScenes(false);}});
  agentPopover=createPopover({anchor:agentEntry,toggle:agentToggle,panel:agentMenu,hover:true,signal,
    canOpen:()=>Boolean(game.user?.isGM),onOpen:()=>{setMenu(false);scenePopover?.close();setScenes(false);},nextFocus:()=>agentEntry.nextElementSibling});
  // Scene cards (0.5.3). «Штатная навигация» inside the panel still opens the core scene list with its context menu.
  scenePanel=createScenePanel({onView:id=>void sceneAction(id,false),onActivate:id=>void sceneAction(id,true),onNative:()=>{scenePopover?.close();setScenes(true);}});
  shell.append(scenePanel.element);
  scenePopover=createPopover({anchor:sceneToggle,toggle:sceneToggle,panel:scenePanel.element,signal,
    canOpen:()=>Boolean(pref('spacious')),onOpen:()=>{setMenu(false);agentPopover?.close();setScenes(false);renderScenes();}});
  shell.addEventListener('pointerenter',schedule,{signal});
  shell.addEventListener('focusin',schedule,{signal});
  shell.addEventListener('click',async event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.ncuDisable){await game.settings.set(ID,'enabled',false);ui.notifications.info('Исходный интерфейс возвращён. Alt + N снова включит Найт-Сити.');return;}
    // A mouse click must not leave focus on a bar button: Foundry ignores its shortcuts while anything has focus.
    if(target.matches('.ncu-combat-status')){setMenu(false);agentPopover?.close();showSidebarTab('combat');if(event.detail>0)target.blur();schedule();return;}
    if(target.matches('.ncu-search')){
      setMenu(false);agentPopover?.close();scenePopover?.close();setScenes(false);if(event.detail>0)target.blur();
      try{await globalThis.QuickInsert?.open?.();}catch(error){console.error(`${ID} | Quick Insert`,error);ui.notifications.error('Не удалось открыть поиск Quick Insert. Подробности в консоли.');}
      return;
    }
    if(target.matches('.ncu-chat')){setMenu(false);agentPopover?.close();scenePopover?.close();setScenes(false);drawer?.toggle('chat',{focus:true});schedule();return;}
    if(target.matches('.ncu-timer')){
      if(!game.user.isGM)return;
      try{await moduleAPI('cpr-deadline')?.open?.();}catch(error){console.error(`${ID} |`,error);ui.notifications.error('Не удалось открыть управление таймером. Подробности в консоли.');}
      return;
    }
    const action=resolveAction(target.dataset.ncuAction);if(!action)return;
    if(action.visible===false||(action.gm&&!game.user.isGM))return;
    if(!action.available){ui.notifications.info(action.reason||'Нужный модуль выключен или ещё загружается.');return;}
    target.disabled=true;
    try {await action.run();setMenu(false);agentPopover?.close();}catch(error){console.error(`${ID} |`,error);ui.notifications.error('Не удалось открыть инструмент. Подробности в консоли.');}
    finally{target.disabled=false;schedule();}
  },{signal});
  shell.addEventListener('change',event=>{const key=event.target.dataset.ncuSetting;if(key)void game.settings.set(ID,key,event.target.checked);},{signal});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#navigation,.ncu-scene-toggle'))setScenes(false);},{signal});
  // Clicking a window brings it to the front without any hook: re-read ui.activeWindow afterwards.
  document.addEventListener('pointerdown',()=>setTimeout(schedule,0),{signal,capture:true});
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
  feed?.destroy();feed=null;
  drawer?.setActive(false);drawer=null;unread=NO_UNREAD;document.querySelector('#sidebar-tabs .ncu-drawer-close')?.remove();
  playersPanel?.destroy();playersPanel=null;currentPlayers=null;
  cancelAnimationFrame(frame);frame=null;clearTimeout(timerTick);timerTick=null;events?.abort();morePopover=null;agentPopover=null;observer?.disconnect();resizing?.disconnect();timerObserver?.disconnect();currentTimer=null;observed.clear();shell?.remove();shell=null;
  for(const element of document.querySelectorAll('.ncu-relocated-tool'))element.classList.remove('ncu-relocated-tool');
  for(const element of document.querySelectorAll('#cpr-deadline-hud,#redline-combat-hud'))for(const c of ['ncu-docked','ncu-timer-in-bar','ncu-idle','ncu-no-queue','ncu-no-actor','ncu-tight-dock'])element.classList.remove(c);
  removeDockAdapter();
  cls(document.body,'ncu-enabled',false);cls(document.body,'ncu-theme',false);cls(document.body,'ncu-spacious',false);cls(document.body,'ncu-scenes-open',false);
}
// A broken bar must never break Foundry: drop the layer and give the native interface back.
function fail(error) {
  failed=true;console.error(`${ID} | панель отключена до перезагрузки`,error);destroy();
  ui.notifications.error('Найт-Сити: панель дала сбой и отключена до перезагрузки страницы. Подробности в консоли.');
}
function schedule() {
  if(!ready||frame||failed)return;
  frame=requestAnimationFrame(()=>{frame=null;try{refresh();}catch(error){fail(error);}});
}

function refresh() {
  if(!pref('enabled')){destroy();return;}mount();cls(document.body,'ncu-enabled',true);cls(document.body,'ncu-theme',pref('theme'));cls(document.body,'ncu-spacious',pref('spacious'));
  updatePlayers();
  const sidebarReady=Boolean(document.getElementById('sidebar')&&typeof ui.sidebar?.activateTab==='function');
  if(!sidebarReady&&pref('sidebarDrawer')&&pref('spacious')&&!drawerWarned&&Date.now()-readyAt>5000){drawerWarned=true;console.warn(`${ID} | Сайдбар ядра не найден, режим шторки выключен.`);}
  drawer.setActive(drawerMode({enabled:true,spacious:pref('spacious'),setting:pref('sidebarDrawer'),sidebarReady}));
  updateDrawerChrome();
  updateSearch();
  feed.setEnabled(drawer.active&&!chatOnScreen());
  if(!pref('spacious')){setScenes(false);scenePopover?.close();}
  const scene=canvas?.scene;
  const sceneName=scene?.navName||scene?.name||'Сцены';
  const sceneLabel=shell.querySelector('.ncu-scene-name');
  if(sceneLabel.textContent!==sceneName)sceneLabel.textContent=sceneName;
  shell.querySelector('.ncu-scene-toggle').title=`Сцены: ${sceneName}`;
  const controlled=(canvas?.ready ? canvas.tokens?.controlled : []) ?? [];
  const battle=currentBattle();
  updateCombatStatus();updateTimer();
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
  // DEADLINE re-assigns `hidden` five times a second; only a real change of the attribute needs a new layout.
  if(timer!==currentTimer){timerObserver?.disconnect();currentTimer=timer;if(timer){timerObserver=new MutationObserver(records=>{if(records.some(record=>record.oldValue!==record.target.getAttribute(record.attributeName)))schedule();});timerObserver.observe(timer,{attributes:true,attributeOldValue:true,attributeFilter:['class','hidden']});}}
  const controlBoxes=[...document.querySelectorAll('#controls .scene-control,#controls .control-tool')].map(rect).filter(Boolean);
  const controls=controlBoxes.length?{right:Math.max(...controlBoxes.map(b=>b.right))}:null;
  lastLayout=layoutHUD({width:innerWidth,height:innerHeight,sidebar:drawer.active?drawerBounds({width:innerWidth,height:innerHeight,open:drawer.open}):rect('#sidebar'),controls,navigation:rect('#navigation'),hotbar:rect('#hotbar'),players:rect(currentPlayers),playersFloating:Boolean(playersPanel),timer:rect(timer),timerManaged,dockHeight:dockView.height,dockWidth:dockView.width,spacious:pref('spacious'),queueVisible:Boolean(redline&&context.queue)});
  const {toolbar,combat,dock}=lastLayout;
  feed.place(lastLayout.feed);
  for(const [name,value] of Object.entries({left:toolbar.left,top:toolbar.top,width:toolbar.width,'combat-left':combat.left,'combat-top':combat.top,'combat-width':combat.width,'dock-left':dock.left,'dock-width':dock.width,'dock-bottom':innerHeight-dock.bottom,'dock-height':dock.height,'timer-left':lastLayout.timer?.left??0,'timer-top':lastLayout.timer?.top??0}))css(`--ncu-${name}`,value);
  cls(shell,'ncu-compact',lastLayout.compact);
  cls(redline,'ncu-tight-dock',!nativeRedlinePresentation&&dock.height<120);
  const actions=actionDefinitions();
  const states=Object.fromEntries(SECTION_ORDER.map(name=>[name,sectionState(actions[name])]));
  const frontSection=windowSection(ui.activeWindow,{ActorSheet:coreClass('ActorSheet'),CombatTracker:coreClass('CombatTracker'),netApp:globalThis.CRNS?.ui});
  const activeSection=pickActiveSection({frontSection,combatTab:drawer.active?drawer.open&&drawer.tab==='combat':ui.sidebar?.activeTab==='combat',states});
  for(const button of shell.querySelectorAll('[data-ncu-action]')) {
    const name=button.dataset.ncuAction,action=actions[name];
    if(Object.hasOwn(states,name)){
      const state=states[name];
      button.hidden=state==='hidden';
      cls(button,'is-locked',state==='locked');cls(button,'is-active',name===activeSection);
      button.setAttribute('aria-disabled',String(state!=='ready'));
      if(name===activeSection)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');
      const tip=state==='ready'?(action.hint||action.label):`${action.label}: ${action.reason||'нужный модуль ещё загружается.'}`;
      setTip(button,tip);
      button.removeAttribute('title');
      continue;
    }
    button.hidden=Boolean(action.visible===false||(action.gm&&!game.user.isGM));button.setAttribute('aria-disabled',String(!action.available));button.title=action.available?(action.hint||action.label):(action.reason||'Нужный модуль выключен или ещё загружается.');
  }
  for(const input of shell.querySelectorAll('[data-ncu-setting]'))input.checked=pref(input.dataset.ncuSetting);
  const menuKey=shell.querySelector('[data-ncu-key="menu"]'),menuLabel=keyLabel(game.keybindings.get(ID,'menu'));
  if(menuKey.textContent!==menuLabel)menuKey.textContent=menuLabel;
  shell.querySelector('.ncu-agent-toggle').hidden=!game.user.isGM||states.agent==='hidden';
  if(scenePanel?.open)renderScenes();
  morePopover?.position();agentPopover?.position();scenePopover?.position();
  const shortcuts={'nca-agent':'agent','nca-workspace':'files','nca-terminals':'files','nca-agent-gm':'gmAgent','night-city-market':'market','crns':'net','nightCityAtlas':'city','redline-combat':'hud','cpr-deadline':'timer'};
  for(const tool of document.querySelectorAll('#controls [data-tool]'))cls(tool,'ncu-relocated-tool',pref('compactTools')&&shortcuts[tool.dataset.tool]&&actions[shortcuts[tool.dataset.tool]].available);
  for(const selector of ['#sidebar','#controls','#navigation','#hotbar','#action-bar','#players','#cpr-deadline-hud']) {
    const element=document.querySelector(selector);if(element&&!observed.has(element)){observed.add(element);resizing.observe(element);}
  }
  for(const element of observed)if(!element.isConnected){resizing.unobserve(element);observed.delete(element);}
}

Hooks.once('init',()=>{
  for(const [key,name,defaultValue] of [['enabled','Найт-Сити: общий интерфейс',true],['spacious','Найт-Сити: просторный интерфейс Foundry',true],['dockExpanded','Найт-Сити: раскрытая карточка персонажа',false],['theme','Найт-Сити: общая тема окон',true],['compactTools','Найт-Сити: убрать повторные значки',true],['contextHud','Найт-Сити: боевые панели по ситуации',true],['sidebarDrawer','Найт-Сити: сайдбар шторкой из панели',true],['showPlayers','Найт-Сити: показывать панель игроков',true],['playersExpanded','Найт-Сити: развернуть панель игроков',false]])game.settings.register(ID,key,{name,scope:'client',config:!['dockExpanded','playersExpanded'].includes(key),type:Boolean,default:defaultValue,onChange:schedule});
  game.settings.register(ID,'playersPosition',{name:'Найт-Сити: положение панели игроков',scope:'client',config:false,type:Object,default:{},onChange:schedule});
  game.keybindings.register(ID,'menu',{name:'Найт-Сити — открыть меню',editable:[{key:'KeyN',modifiers:['Alt']}],onDown:()=>{void openMenu();return true;}});
  game.keybindings.register(ID,'chat',{name:'Найт-Сити — написать в чат',hint:'Открывает сайдбар-шторку на чате и ставит курсор в поле ввода. Работает, когда сайдбар убран в шторку.',editable:[{key:'Enter'}],onDown:()=>{if(!drawer?.active)return false;drawer.show('chat',{focus:true});return true;}});
});
async function openMenu(){if(!pref('enabled'))await game.settings.set(ID,'enabled',true);refresh();setMenu(true,true);}
Hooks.once('ready',()=>{
  if(game.system.id!=='cyberpunk-red-core')return;ready=true;readyAt=Date.now();refresh();
  game.modules.get(ID).api=Object.freeze({openMenu,refresh:schedule,getLayout:()=>structuredClone(lastLayout),setEnabled:enabled=>game.settings.set(ID,'enabled',Boolean(enabled))});
  // Some host modules publish their API after asynchronous ready work.
  setTimeout(schedule,600);setTimeout(schedule,1800);
  window.addEventListener('beforeunload',destroy,{once:true});
});
for(const hook of ['renderSceneControls','renderSceneNavigation','collapseSceneNavigation','renderSidebar','collapseSidebar','renderPlayerList','renderHotbar','renderRedlineHUD','closeRedlineHUD','controlToken','canvasReady','canvasTearDown','createCombat','updateCombat','deleteCombat','combatStart','createCombatant','updateCombatant','deleteCombatant','createScene','updateScene','deleteScene','createFolder','updateFolder','deleteFolder','updateUser','createActor','updateActor','deleteActor','createItem','updateItem','deleteItem','updateSetting','nightCityAtlasAccessChanged','renderApplication','closeApplication','renderApplicationV2','closeApplicationV2','changeSidebarTab'])Hooks.on(hook,schedule);
Hooks.on('createChatMessage',message=>{
  if(!ready||failed||!drawer?.active)return;
  try{
    const author=message.author??message.user;
    unread=addUnread(unread,{visible:message.visible,own:author?.id===game.user.id,whisperToMe:Boolean(message.whisper?.includes?.(game.user.id)),chatOnScreen:chatOnScreen()});
    schedule();
  }catch(error){console.error(`${ID} | счётчик чата`,error);}
  queueFeed(message);
});
// Stripe colour on every rendered message, also on those rendered before `ready` and in the popped-out chat.
// Harmless when the theme is off: every rule that reads it needs body.ncu-drawer.
Hooks.on('renderChatMessage',(message,html)=>{
  try{const element=html?.[0]??html;if(element instanceof HTMLElement)element.classList.add(`ncu-tone-${toneOf(message)}`);}
  catch(error){console.error(`${ID} | оформление сообщения`,error);}
});
Hooks.on('diceSoNiceRollComplete',id=>feed?.rollComplete(id));
Hooks.on('deleteChatMessage',message=>feed?.remove(message.id));
// A collapsed core sidebar opens tabs as windows: in drawer mode keep it expanded and just close the drawer.
Hooks.on('collapseSidebar',(app,collapsed)=>{if(collapsed&&drawer?.active){app.expand();drawer.hide({restoreFocus:false});}});
