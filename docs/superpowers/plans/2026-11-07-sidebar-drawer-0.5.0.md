# Сайдбар шторкой 0.5.0 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сайдбар Foundry спрятан и выезжает шторкой из верхней панели Night City UI. В панели кнопка «ЧАТ» со счётчиком непрочитанного, Enter открывает чат.

**Architecture:** Сайдбар ядра (`#sidebar`) остаётся тем же элементом. Класс `ncu-drawer` на `body` и CSS уводят его за правый край, `ncu-drawer-open` выдвигает. Логика без DOM (`drawerMode`, `toggleAction`, `addUnread`, `unreadLabel`, `chatTip`, `drawerBounds`) живёт в чистых функциях с тестами `node --test`. Управление DOM (`createDrawer`) — в `scripts/drawer/drawer.js`, связка с панелью — в `scripts/main.js`.

**Tech Stack:** Foundry VTT 12.331 (ApplicationV1 `Sidebar`, `game.keybindings`, хуки), ES-модули без сборщика, `node --test`, стенд `D:\FoundryDev\bench` и Playwright из `C:\Users\Horusian\foundry-dev`.

Спецификация: `docs/superpowers/specs/2026-11-07-sidebar-drawer-design.md`, разделы 3.1–3.6, 4, 5. Лента (3.7) и сообщения в стиле 2077 (3.8) — выпуски 0.5.1 и 0.5.2, в этот план не входят.

Факты ядра v12, на которые опирается код:
- `ui.sidebar.activateTab(name)`, `ui.sidebar.activeTab`, `ui.sidebar._collapsed`, `ui.sidebar.expand()`, `ui.sidebar.popouts.chat`;
- хук `collapseSidebar(app, collapsed)`; при свёрнутом сайдбаре щелчок по вкладке открывает окно (`_onLeftClickTab`), поэтому в режиме шторки сайдбар держим развёрнутым;
- `KeyboardManager` слушает `keydown` на `window` во всплытии и вызывает `preventDefault`, если привязка вернула `true`. Поэтому фокус, поставленный в обработчике Enter, не получит перевод строки, а перехват Esc на `document` в фазе захвата срабатывает раньше ядра;
- разметка: `#sidebar > nav#sidebar-tabs > a.item[data-tab]` и `a.collapse`; чат — `#chat-controls` (`select.roll-type-select`, `.control-buttons`), `form#chat-form > textarea#chat-message`;
- `#sidebar` лежит в `#interface` (слой `--z-index-ui: 60`), REDLINE — в `body` с тем же `z-index: 60`, позже по документу. Поэтому открытая шторка резервирует себе место в раскладке, а не перекрывает очередь.

Коммиты — только с согласия пользователя (правило проекта). Шаги «Commit» ниже заменены проверкой `git status`.

---

### Task 1: Чистая логика счётчика

**Files:**
- Create: `scripts/drawer/messages.js`
- Test: `tests/drawer.test.js`

- [ ] **Step 1: Тесты**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_UNREAD, addUnread, unreadLabel, chatTip } from '../scripts/drawer/messages.js';

test('unread counts only visible messages of others while the chat is off screen', () => {
  const seen = { visible: true, own: false, whisperToMe: false, chatOnScreen: false };
  assert.deepEqual(addUnread(NO_UNREAD, seen), { count: 1, whisper: false });
  assert.equal(addUnread(NO_UNREAD, { ...seen, visible: false }), NO_UNREAD);
  assert.equal(addUnread(NO_UNREAD, { ...seen, own: true }), NO_UNREAD);
  assert.equal(addUnread(NO_UNREAD, { ...seen, chatOnScreen: true }), NO_UNREAD);
  assert.deepEqual(addUnread(undefined, seen), { count: 1, whisper: false });
});
test('a whisper to this user keeps the counter yellow until it is read', () => {
  const one = addUnread(NO_UNREAD, { visible: true, whisperToMe: true });
  assert.deepEqual(one, { count: 1, whisper: true });
  assert.deepEqual(addUnread(one, { visible: true }), { count: 2, whisper: true });
});
test('badge text: empty at zero, «9+» past nine', () => {
  assert.equal(unreadLabel(0), '');
  assert.equal(unreadLabel(-1), '');
  assert.equal(unreadLabel(Number.NaN), '');
  assert.equal(unreadLabel(3), '3');
  assert.equal(unreadLabel(9), '9');
  assert.equal(unreadLabel(10), '9+');
});
test('chat button tooltip names the count, the whisper and the key', () => {
  assert.equal(chatTip({ count: 0, key: 'Enter' }), 'Чат — новых сообщений нет. Enter — написать.');
  assert.equal(chatTip({ count: 3, whisper: true, key: 'Enter' }), 'Чат — непрочитанных: 3, есть шёпот вам. Enter — написать.');
  assert.equal(chatTip({ count: 12 }), 'Чат — непрочитанных: больше 9.');
});
```

- [ ] **Step 2: Запуск — падает**

Run: `node --test tests/drawer.test.js`
Expected: FAIL, `Cannot find module '../scripts/drawer/messages.js'`.

- [ ] **Step 3: Реализация**

```js
// Pure logic of the chat drawer: the unread counter on the «ЧАТ» button. The feed and message tones follow in 0.5.1.

export const NO_UNREAD = Object.freeze({ count: 0, whisper: false });

/**
 * Count a new chat message as unread: only a message this user can see, written by someone else, while the chat is
 * not on screen. A whisper addressed to this user keeps the counter yellow until the chat is opened.
 */
export function addUnread(state, { visible = false, own = false, whisperToMe = false, chatOnScreen = false } = {}) {
  const current = state ?? NO_UNREAD;
  if (!visible || own || chatOnScreen) return current;
  return { count: current.count + 1, whisper: current.whisper || Boolean(whisperToMe) };
}

/** Badge text: nothing at zero, «9+» past nine. */
export function unreadLabel(count) {
  if (!Number.isFinite(count) || count <= 0) return '';
  return count > 9 ? '9+' : String(Math.floor(count));
}

/** Tooltip of the «ЧАТ» button. */
export function chatTip({ count = 0, whisper = false, key = '' } = {}) {
  const unread = count > 0 ? `непрочитанных: ${count > 9 ? 'больше 9' : count}${whisper ? ', есть шёпот вам' : ''}` : 'новых сообщений нет';
  return `Чат — ${unread}.${key ? ` ${key} — написать.` : ''}`;
}
```

- [ ] **Step 4: Запуск — проходит**

Run: `node --test tests/drawer.test.js` → 4 pass.

### Task 2: Режим, переключение и место шторки в раскладке

**Files:**
- Create: `scripts/drawer/drawer.js` (пока только чистые функции)
- Modify: `scripts/layout.js` (константа `DRAWER_WIDTH`, функция `drawerBounds`)
- Test: `tests/drawer.test.js`, `tests/layout.test.js`

- [ ] **Step 1: Тесты** (дописать в `tests/drawer.test.js`)

```js
import { drawerMode, toggleAction } from '../scripts/drawer/drawer.js';
import { layoutHUD, drawerBounds, DRAWER_WIDTH } from '../scripts/layout.js';

test('the drawer needs the theme, the spacious layout, the setting and a usable core sidebar', () => {
  const all = { enabled: true, spacious: true, setting: true, sidebarReady: true };
  assert.equal(drawerMode(all), true);
  for (const key of Object.keys(all)) assert.equal(drawerMode({ ...all, [key]: false }), false, key);
  assert.equal(drawerMode(), false);
});
test('a bar button closes the drawer only when it already shows that tab', () => {
  assert.equal(toggleAction({ open: false, activeTab: 'chat', tab: 'chat' }), 'open');
  assert.equal(toggleAction({ open: true, activeTab: 'chat', tab: 'chat' }), 'close');
  assert.equal(toggleAction({ open: true, activeTab: 'combat', tab: 'chat' }), 'open');
});
test('a closed drawer takes no room; an open one reserves its width at the right edge', () => {
  assert.equal(drawerBounds({ width: 1920, height: 1080, open: false }), null);
  const box = drawerBounds({ width: 1920, height: 1080, open: true });
  assert.deepEqual(box, { left: 1560, top: 58, width: DRAWER_WIDTH, height: 1022, right: 1920, bottom: 1080 });
  const base = { width: 1920, height: 1080, controls: { right: 50 }, navigation: { bottom: 60 }, hotbar: { top: 1010 }, players: { top: 1000 }, spacious: true, dockHeight: 120 };
  assert.equal(layoutHUD({ ...base, sidebar: null }).combat.right, 1910);
  assert.equal(layoutHUD({ ...base, sidebar: box }).combat.right, 1550);
});
```

- [ ] **Step 2: Запуск — падает**

Run: `node --test tests/drawer.test.js`
Expected: FAIL, нет `drawer.js` и `drawerBounds`.

- [ ] **Step 3: Реализация**

`scripts/layout.js`, после `BAR_HEIGHT`:

```js
/** Width of the sidebar drawer; styles/drawer.css mirrors it. */
export const DRAWER_WIDTH = 360;
/** The open drawer reserves its strip at the right edge under the bar; a closed one takes no room. */
export function drawerBounds({ width, height, open = false }) {
  return open ? box(width - DRAWER_WIDTH, BAR_HEIGHT, DRAWER_WIDTH, height - BAR_HEIGHT) : null;
}
```

`scripts/drawer/drawer.js`:

```js
// Sidebar drawer. The core #sidebar stays the same element with the same tabs: this module only slides it out from
// under the top bar, hides it again and keeps the core from collapsing it (a collapsed sidebar opens tabs as windows).

/** The drawer works only with the theme and the spacious layout on, the user's setting on and a usable core sidebar. */
export function drawerMode({ enabled = false, spacious = false, setting = false, sidebarReady = false } = {}) {
  return Boolean(enabled && spacious && setting && sidebarReady);
}

/** A bar button that targets a tab closes the drawer when it already shows that tab, otherwise opens it there. */
export function toggleAction({ open = false, activeTab = null, tab } = {}) {
  return open && activeTab === tab ? 'close' : 'open';
}
```

- [ ] **Step 4: Запуск — проходит**

Run: `node --test tests/*.test.js` → все прежние 102 и 7 новых проходят.

### Task 3: Управление шторкой в DOM

**Files:**
- Modify: `scripts/drawer/drawer.js` (дописать `createDrawer`)

- [ ] **Step 1: Реализация** (дописать в конец `scripts/drawer/drawer.js`)

```js
/**
 * Show, hide and guard the core sidebar as a drawer. `onChange` runs after every change of state.
 * Listeners live on `signal`; setActive(false) gives the sidebar back exactly as it was.
 */
export function createDrawer({ signal, onChange = () => {} } = {}) {
  let active = false, open = false, returnFocus = null;
  const sidebar = () => document.getElementById('sidebar');
  const apply = () => {
    document.body.classList.toggle('ncu-drawer', active);
    document.body.classList.toggle('ncu-drawer-open', active && open);
    const element = sidebar();
    if (element) element.inert = active && !open;
  };
  const drawer = {
    get active() { return active; },
    get open() { return active && open; },
    get tab() { return globalThis.ui?.sidebar?.activeTab ?? null; },
    setActive(value) {
      value = Boolean(value);
      if (value === active) return;
      active = value;
      if (!active) { open = false; returnFocus = null; }
      else if (ui.sidebar?._collapsed) ui.sidebar.expand();
      apply(); onChange();
    },
    show(tab, { focus = false } = {}) {
      if (!active) return false;
      if (!open) {
        const current = document.activeElement;
        returnFocus = current instanceof HTMLElement && current !== document.body ? current : null;
      }
      if (tab && ui.sidebar.activeTab !== tab) ui.sidebar.activateTab(tab);
      open = true; apply();
      if (ui.sidebar.activeTab === 'chat') ui.chat?.scrollBottom?.();
      if (focus) document.getElementById('chat-message')?.focus();
      onChange();
      return true;
    },
    hide({ restoreFocus = true } = {}) {
      if (!open) return;
      open = false; apply();
      if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
      returnFocus = null; onChange();
    },
    toggle(tab, options) {
      if (toggleAction({ open: drawer.open, activeTab: drawer.tab, tab }) === 'close') { drawer.hide(); return false; }
      return drawer.show(tab, options);
    }
  };
  // Esc closes the drawer first; the core listens on window while bubbling, so the next Esc reaches Foundry.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !drawer.open) return;
    event.preventDefault(); event.stopPropagation(); drawer.hide();
  }, { signal, capture: true });
  // A press on the scene closes it. A drag out of the drawer starts inside it and never presses on the board.
  document.addEventListener('pointerdown', event => {
    if (drawer.open && event.target instanceof Element && event.target.closest('#board')) drawer.hide({ restoreFocus: false });
  }, { signal, capture: true });
  return drawer;
}
```

`inert` у закрытой шторки сам снимает с неё фокус, поэтому отдельный `blur` не нужен.

- [ ] **Step 2: Проверка синтаксиса**

Run (Git Bash, из корня репозитория): скопировать `scripts/drawer/drawer.js` в scratchpad как `.mjs` и выполнить `node --check` (правило памяти: `node --check` не проверяет `.js` как ES-модуль). Затем `node --test tests/*.test.js` — всё проходит, модуль импортируется без обращения к `document`.

### Task 4: Встраивание в панель

**Files:**
- Modify: `scripts/main.js`

- [ ] **Step 1: Импорты и состояние**

```js
import { layoutHUD, drawerBounds } from './layout.js';
import { createDrawer, drawerMode } from './drawer/drawer.js';
import { NO_UNREAD, addUnread, unreadLabel, chatTip } from './drawer/messages.js';
```

К объявлениям `let` добавить `drawer`, а также `let unread = NO_UNREAD, drawerWarned = false;`.

- [ ] **Step 2: Помощники** (рядом с `currentBattle`)

```js
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
```

- [ ] **Step 3: Действия**

В `actionDefinitions()` у `battle`:

```js
battle: { label:'Бой', icon:'fa-swords', hint:'Трекер боя и обзор персонажа', installed:true, available:true, run:async()=>{const opened=toggleSidebarTab('combat');if(opened&&active('redline-combat'))await moduleAPI('redline-combat')?.open?.();} },
```

В обработчике щелчков `mount()` статус боя заменить на `showSidebarTab('combat')` и добавить кнопку чата:

```js
if(target.matches('.ncu-combat-status')){setMenu(false);agentPopover?.close();showSidebarTab('combat');schedule();return;}
if(target.matches('.ncu-chat')){setMenu(false);agentPopover?.close();setScenes(false);drawer?.toggle('chat');schedule();return;}
```

- [ ] **Step 4: Разметка и создание шторки в `mount()`**

После вставки `sceneToggle`:

```js
const chatButton=document.createElement('button');chatButton.type='button';chatButton.className='ncu-chat';chatButton.hidden=true;
chatButton.setAttribute('aria-controls','sidebar');chatButton.setAttribute('aria-expanded','false');
chatButton.dataset.tooltipDirection='DOWN';chatButton.dataset.tooltipClass='ncu-tooltip';
chatButton.innerHTML='<i class="fa-solid fa-comments" aria-hidden="true"></i><span>Чат</span><b class="ncu-chat-count" hidden></b><kbd class="ncu-key" data-ncu-key="chat"></kbd>';
shell.querySelector('.ncu-more').before(chatButton);
```

В список галочек меню перед `showPlayers` добавить `['sidebarDrawer','Сайдбар шторкой из панели']`. После `const {signal}=events;`: `drawer=createDrawer({signal,onChange:schedule});`.

- [ ] **Step 5: `refresh()`**

Сразу после `updatePlayers();`:

```js
const sidebarReady=Boolean(document.getElementById('sidebar')&&typeof ui.sidebar?.activateTab==='function');
if(!sidebarReady&&pref('sidebarDrawer')&&pref('spacious')&&!drawerWarned&&Date.now()-readyAt>5000){drawerWarned=true;console.warn(`${ID} | Сайдбар ядра не найден, режим шторки выключен.`);}
drawer.setActive(drawerMode({enabled:true,spacious:pref('spacious'),setting:pref('sidebarDrawer'),sidebarReady}));
updateDrawerChrome();
```

В вызове `layoutHUD` заменить `sidebar:rect('#sidebar')` на:

```js
sidebar:drawer.active?drawerBounds({width:innerWidth,height:innerHeight,open:drawer.open}):rect('#sidebar')
```

В `pickActiveSection` заменить `combatTab:ui.sidebar?.activeTab==='combat'` на:

```js
combatTab:drawer.active?drawer.open&&drawer.tab==='combat':ui.sidebar?.activeTab==='combat'
```

- [ ] **Step 6: `destroy()`**

В начало `destroy()`:

```js
drawer?.setActive(false);drawer=null;unread=NO_UNREAD;document.querySelector('#sidebar-tabs .ncu-drawer-close')?.remove();
```

- [ ] **Step 7: Настройка, клавиша, хуки**

В цикл регистрации настроек (`Hooks.once('init')`) добавить `['sidebarDrawer','Найт-Сити: сайдбар шторкой из панели',true]`. Там же:

```js
game.keybindings.register(ID,'chat',{name:'Найт-Сити — написать в чат',hint:'Открывает сайдбар-шторку на чате и ставит курсор в поле ввода. Работает, когда сайдбар убран в шторку.',editable:[{key:'Enter'}],onDown:()=>{if(!drawer?.active)return false;drawer.show('chat',{focus:true});return true;}});
```

После списка хуков:

```js
Hooks.on('createChatMessage',message=>{
  if(!ready||failed||!drawer?.active)return;
  try{
    const author=message.author??message.user;
    unread=addUnread(unread,{visible:message.visible,own:author?.id===game.user.id,whisperToMe:Boolean(message.whisper?.includes?.(game.user.id)),chatOnScreen:chatOnScreen()});
    schedule();
  }catch(error){console.error(`${ID} | счётчик чата`,error);}
});
// A collapsed core sidebar opens tabs as windows: in drawer mode keep it expanded and just close the drawer.
Hooks.on('collapseSidebar',(app,collapsed)=>{if(collapsed&&drawer?.active){app.expand();drawer.hide({restoreFocus:false});}});
```

- [ ] **Step 8: Проверка синтаксиса и тестов**

Скопировать `scripts/*.js`, `scripts/topbar/*.js`, `scripts/drawer/*.js` в scratchpad как `.mjs`, выполнить `node --check` для каждого. `node --test tests/*.test.js` — все проходят.

### Task 5: Стили шторки и кнопки «ЧАТ»

**Files:**
- Create: `styles/drawer.css`
- Modify: `module.json` (`styles`: добавить `styles/drawer.css` последним)

- [ ] **Step 1: `styles/drawer.css`**

```css
/* Sidebar drawer (spec docs/superpowers/specs/2026-11-07-sidebar-drawer-design.md). Every drawer rule needs
   body.ncu-drawer: without it the 0.4.1 sidebar rules apply unchanged. 360px mirrors DRAWER_WIDTH in scripts/layout.js. */
body.ncu-enabled.ncu-spacious.ncu-drawer #ui-right{flex:0 0 0;width:0;min-width:0}
body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar{top:var(--ncu-bar-height,58px);right:0;bottom:0;z-index:70;width:360px;height:auto;max-height:none;border:0;border-left:1px solid var(--ncu-tb-line);border-radius:0;background:linear-gradient(180deg,#120a0efc,#0c1117fd);box-shadow:-18px 0 40px #000c;transform:translateX(calc(100% + 40px));visibility:hidden;transition:transform .18s ease-out,visibility 0s linear .18s}
body.ncu-enabled.ncu-spacious.ncu-drawer.ncu-drawer-open #sidebar{transform:none;visibility:visible;transition:transform .18s ease-out}
body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar::before{content:'';position:absolute;inset:0;z-index:-1;background:url('../assets/decorations/hud-hex.svg') 0 0/26px 45px;opacity:.18;pointer-events:none}

/* Tab strip: red icons with an underline, the open tab cyan; the core collapse toggle is replaced by ✕. */
body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar-tabs{flex:0 0 46px;min-height:46px;margin:0;padding:0 6px 0 10px;gap:2px;align-items:flex-end;justify-content:flex-start;border-bottom:1px solid #9a2d3688;background:none;box-shadow:none}
body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar-tabs>.item{flex:0 0 26px;height:38px;line-height:36px;margin:0;border:0;border-bottom:2px solid transparent;border-radius:0;background:none;box-shadow:none;color:var(--ncu-tb-red);font-size:15px;text-shadow:none}
body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar-tabs>.item:hover{color:#ffb3ad;background:none}
body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar-tabs>.item.active{color:var(--ncu-tb-cyan);border-bottom-color:var(--ncu-tb-cyan);background:none;box-shadow:none;text-shadow:0 0 10px #5ef6ff99}
body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar-tabs>.collapse{display:none}
body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar-tabs>.ncu-drawer-close{flex:0 0 30px;width:30px;height:30px;margin:0 0 5px auto;padding:0;border:0;border-radius:0;background:none;box-shadow:none;color:var(--ncu-tb-dim);font-size:16px;line-height:30px;cursor:pointer}
body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar-tabs>.ncu-drawer-close:is(:hover,:focus-visible){color:var(--ncu-tb-red);outline:none}

/* Roll mode, chat buttons and the message box in the bar palette; the select stays a select. */
body.ncu-enabled.ncu-spacious.ncu-drawer #chat-controls{gap:10px;margin:0;padding:10px 12px 6px;border-top:1px solid #9a2d3688}
body.ncu-enabled.ncu-spacious.ncu-drawer #chat-controls .chat-control-icon,body.ncu-enabled.ncu-spacious.ncu-drawer #chat-controls .control-buttons a{color:var(--ncu-tb-red)}
body.ncu-enabled.ncu-spacious.ncu-drawer #chat-controls select.roll-type-select{height:30px;border:1px solid var(--ncu-tb-line);border-radius:0;background:#140a0e;color:var(--ncu-tb-muted);font:500 14px var(--ncu-tb-heading);letter-spacing:1px;text-transform:uppercase}
body.ncu-enabled.ncu-spacious.ncu-drawer #chat-form{margin:0 12px 12px}
body.ncu-enabled.ncu-spacious.ncu-drawer #chat-message{border:1px solid #5ef6ff55;border-radius:0;background:#050c10e6;color:var(--ncu-tb-text);font:14px/1.4 var(--ncu-tb-body)}
body.ncu-enabled.ncu-spacious.ncu-drawer #chat-message:focus{border-color:#5ef6ffaa;outline:none;box-shadow:0 0 0 1px #5ef6ff22,0 0 14px #5ef6ff22}

/* «ЧАТ» in the bar: red like the tabs, cyan while the drawer shows the chat; the badge turns yellow for a whisper. */
body.ncu-enabled #ncu-shell.ncu-tb .ncu-bar button.ncu-chat{display:flex;align-items:center;gap:8px;flex-shrink:0;height:34px;min-height:0;margin:0;padding:0 4px;border:0;border-bottom:2px solid transparent;border-radius:0;background:none;box-shadow:none;opacity:1;color:var(--ncu-tb-red);font:500 16px var(--ncu-tb-heading);letter-spacing:1px;text-transform:uppercase;white-space:nowrap}
body.ncu-enabled #ncu-shell.ncu-tb .ncu-bar button.ncu-chat i{width:auto;margin:0;color:inherit;font-size:16px}
body.ncu-enabled #ncu-shell.ncu-tb .ncu-bar button.ncu-chat:is(:hover,:focus-visible){color:#ffb3ad;border-bottom-color:var(--ncu-tb-red);background:none;outline:none}
body.ncu-enabled #ncu-shell.ncu-tb .ncu-bar button.ncu-chat.is-open{color:var(--ncu-tb-cyan);border-bottom-color:var(--ncu-tb-cyan);text-shadow:0 0 12px #5ef6ff88}
body.ncu-enabled #ncu-shell.ncu-tb .ncu-bar .ncu-chat-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;background:var(--ncu-tb-cyan);color:#050c10;font:500 13px/1 var(--ncu-tb-heading);letter-spacing:0;clip-path:polygon(0 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%)}
body.ncu-enabled #ncu-shell.ncu-tb .ncu-bar .ncu-chat-count.is-whisper{background:#ffd42a}
@media(max-width:1599px){body.ncu-enabled #ncu-shell.ncu-tb .ncu-bar button.ncu-chat .ncu-key{display:none}}
@media(max-width:1279px){body.ncu-enabled #ncu-shell.ncu-tb .ncu-bar button.ncu-chat>span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}}
@media(prefers-reduced-motion:reduce){body.ncu-enabled.ncu-spacious.ncu-drawer #sidebar{transition:none!important}}
```

- [ ] **Step 2: `module.json`**

В `styles` после `"styles/topbar.css"` добавить `"styles/drawer.css"`. Версия `0.5.0`, `download` — `.../releases/download/v0.5.0/night-city-ui.zip`. `package.json` — `0.5.0`.

### Task 6: Документы версии

**Files:**
- Modify: `CHANGELOG.md`, `README.md`

- [ ] **Step 1:** В `CHANGELOG.md` раздел `## 0.5.0 — 2026-11-07`: шторка и галочка, «ЧАТ» со счётчиком и подсказкой, Enter, закрытие (Esc, ✕, повторный щелчок, нажатие на сцену), «БОЙ» и статус открывают трекер, раскладка резервирует открытую шторку, оформление вкладок и поля ввода, нужен перезапуск Foundry из-за нового файла стилей, число тестов. Итог стенда дописать после Task 7.
- [ ] **Step 2:** В `README.md` строку версии заменить на «**Версия 0.5.0 — верхняя панель в стиле Cyberpunk 2077, сайдбар шторкой из панели**».
- [ ] **Step 3:** Выровнять LF: `python -I` с заменой `b'\r\n'` на `b'\n'` для изменённых файлов, затем `grep -rlI $'\r' --exclude-dir=.git --exclude-dir=dist .` — пусто.

### Task 7: Проверка на стенде

**Files:**
- Create (scratchpad): `tools/ncu-050-check.mjs`

- [ ] **Step 1:** `npm run bench:backup` в `C:\Users\Horusian\foundry-dev`. Скопировать `Data\modules\dice-so-nice` из рабочей Foundry на стенд (только чтение исходника) — пригодится в 0.5.1, в 0.5.0 не включать.
- [ ] **Step 2:** `python -I build-module.py`, затем `node tools/bench/install-from-zip.mjs C:/Users/Horusian/night-city-ui/dist/night-city-ui.zip` → «файлов установлены … и совпадают с архивом». Сборка меняет список стилей: установщик перезапускает мир, этого достаточно.
- [ ] **Step 3:** Сценарий `ncu-050-check.mjs` (helpers из `foundry-dev/tools/browser/foundry.mjs`, мастер и игрок в разных контекстах, 1920×1080), проверки:
  1. Режим включён: у `body` класс `ncu-drawer`, `#sidebar.inert === true`, `getComputedStyle(#sidebar).visibility === 'hidden'`, кнопка «ЧАТ» видна, ✕ есть в `#sidebar-tabs`, `.collapse` скрыт.
  2. Щелчок по «ЧАТ» → `ncu-drawer-open`, `ui.sidebar.activeTab === 'chat'`, кнопка `is-open`, правая граница `#sidebar` = 1920, ширина 360. Повторный щелчок закрывает.
  3. Раскладка: закрыта — `--ncu-combat-left + --ncu-combat-width` ≥ 1900; открыта — ≤ 1560 − 10.
  4. Enter с фокусом на `body` → шторка на чате, `document.activeElement.id === 'chat-message'`, значение поля пустое.
  5. Esc → закрыта. Открыть лист актёра, открыть шторку, Esc → шторка закрыта, лист открыт. Ещё Esc → ядро закрыло лист.
  6. Нажатие на холст (`#board`, `mouse.click(700, 600)`) закрывает. Нажатие на заголовок окна листа не закрывает.
  7. «БОЙ» → шторка на трекере, вкладка «БОЙ» `is-active`. Повторный щелчок закрывает. Статус боя (создать бой на активной сцене) → открывает на трекере.
  8. Перетаскивание актёра из вкладки «Актёры» шторки на холст (`locator.dragTo('#board')`) у мастера: токенов на сцене стало на один больше, шторка открыта. Созданный токен удалить.
  9. Правый щелчок по вкладке «Журналы» → окно `#journal-popout`, закрыть.
  10. Счётчик игрока: мастер создаёт 2 сообщения → у игрока «2», бирюзовый. Шёпот игроку → «3», `is-whisper`. Ещё 7 сообщений → «9+». Игрок открывает чат → счётчик скрыт. Сообщение, пока чат открыт, не считается.
  11. Ширины 1920, 1440, 1280 с боем и таймером DEADLINE: вкладки, статус, сцена, «ЧАТ» и «Ещё» не пересекаются (объединение потомков, как в ncu-041), «Ещё» не выходит за правый край.
  12. Галочка `sidebarDrawer` = false → нет `ncu-drawer`, `#sidebar` видим, `inert === false`, «ЧАТ» скрыт. Вернуть true.
  13. Тема выключена → сайдбар на месте, ✕ удалён. Включить обратно.
  14. Непросторный режим → шторки нет. Вернуть просторный.
  15. Ошибок `night-city-ui` в консоли у обоих нет.
- [ ] **Step 4:** Снимки: панель с «ЧАТ» и счётчиком (игрок, с шёпотом), открытая шторка на чате (мастер), на трекере, ширины. Посмотреть глазами.
- [ ] **Step 5:** `node tools/bench/backup.mjs restore <копия из Step 1>`, `npm run bench:stop`.

### Task 8: Выпуск в рабочую Foundry

- [ ] **Step 1:** Пересобрать ZIP, если после стенда менялись файлы. Если менялись — повторить Task 7 Step 2–3.
- [ ] **Step 2:** Скопировать текущую `AppData\Local\FoundryVTT\Data\modules\night-city-ui` в `D:\FoundryDev\backups\night-city-ui-0.4.1-working-2026-11-07`, сверить `diff -rq`.
- [ ] **Step 3:** Распаковать ZIP в scratchpad, скопировать поверх модуля в рабочей Foundry, сверить каждый файл `cmp` и убедиться, что лишних файлов нет.
- [ ] **Step 4:** Сообщить пользователю: что изменилось, что нужен перезапуск Foundry (новый файл стилей), что проверить, где копия 0.4.1; обновить память проекта.

---

## Самопроверка плана

- Спецификация 3.1 — Task 4 Step 5 и 7 (`drawerMode`, настройка, мгновенный возврат через `setActive(false)`).
- 3.2 — Task 5 (`transform`, `visibility`, `#ui-right`), Task 3 (`inert`), Task 4 Step 5 (`drawerBounds` в раскладке), Task 3 `setActive` разворачивает свёрнутый сайдбар.
- 3.3 — Task 1, Task 4 Step 2, 4, 7 (счётчик, «9+», жёлтый, обнуление, `aria-expanded`, подпись клавиши).
- 3.4 — Task 3 `show` (`activateTab`, `scrollBottom`), Task 5 (строка вкладок, ✕, скрытый `.collapse`), Task 4 Step 3 (БОЙ, статус, REDLINE только при открытии), Step 5 (подсветка «БОЯ»). Правый щелчок — поведение ядра, проверяется в Task 7.
- 3.5 — Task 3 (Esc в фазе захвата, нажатие на `#board`, возврат фокуса), Task 4 Step 3 (повторный щелчок по «ЧАТ» и «БОЮ»).
- 3.6 — Task 4 Step 7 (привязка `chat`, `false` вне режима шторки).
- 5 — сбой в `refresh()` уже ведёт в `fail()` → `destroy()` → `setActive(false)`. Ошибка в хуке счётчика ловится на месте. Предупреждение об отсутствующем сайдбаре — одно за сессию.
- Имена: `drawerMode`, `toggleAction`, `createDrawer`, `drawerBounds`, `DRAWER_WIDTH`, `NO_UNREAD`, `addUnread`, `unreadLabel`, `chatTip`, `toggleSidebarTab`, `showSidebarTab`, `updateDrawerChrome`, `chatOnScreen` — одинаковы во всех задачах.
