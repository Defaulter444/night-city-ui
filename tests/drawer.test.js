import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_UNREAD, addUnread, unreadLabel, chatTip } from '../scripts/drawer/messages.js';
import { drawerMode, toggleAction } from '../scripts/drawer/drawer.js';
import { layoutHUD, drawerBounds, DRAWER_WIDTH } from '../scripts/layout.js';

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
