import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageTone, cleanText, feedCard, pushCard, FEED_LIMIT } from '../scripts/drawer/messages.js';
import { layoutHUD, drawerBounds, FEED_WIDTH } from '../scripts/layout.js';

test('stripe colour is checked in order: whisper, module card, GM, player', () => {
  assert.equal(messageTone({ whisper: true, authorIsGM: true }), 'whisper');
  assert.equal(messageTone({ authorIsGM: true, hasActor: false, style: 0, isRoll: false }), 'module');
  assert.equal(messageTone({ authorIsGM: true, hasActor: true, style: 0 }), 'gm');
  assert.equal(messageTone({ authorIsGM: true, style: 1 }), 'gm');
  assert.equal(messageTone({ authorIsGM: true, style: 0, isRoll: true }), 'gm');
  assert.equal(messageTone({ authorIsGM: false, style: 0 }), 'player');
  assert.equal(messageTone({ authorIsGM: true, style: 5, otherStyle: 5 }), 'module');
});

test('text is flattened and cut with an ellipsis', () => {
  assert.equal(cleanText('  За   дверью\n шаги  '), 'За дверью шаги');
  assert.equal(cleanText('а'.repeat(200)).length, 140);
  assert.ok(cleanText('а'.repeat(200)).endsWith('…'));
  assert.equal(cleanText(null), '');
});

test('a CPR roll card shows its title, details, total and critical result', () => {
  const card = feedCard({ id: 'm1', alias: 'Веспер', tone: 'player', rollCard: { title: ' Рефлексы ', total: ' 17 ', crit: 'success', details: 'Рефлексы + 8\n Удача: 1' }, text: 'whatever' });
  assert.equal(card.who, 'Веспер');
  assert.equal(card.sub, 'Рефлексы');
  assert.equal(card.text, 'Рефлексы + 8 Удача: 1');
  assert.equal(card.total, '17');
  assert.equal(card.crit, 'success');
  assert.match(card.label, /Веспер, Рефлексы, .*итог 17, критический успех/);
});

test('a core roll shows the formula and the total', () => {
  const card = feedCard({ id: 'm2', alias: 'Игрок', roll: { formula: '1d10 + 2', total: 9 } });
  assert.deepEqual([card.sub, card.text, card.total], ['бросок', '1d10 + 2', '9']);
  assert.equal(feedCard({ id: 'z', roll: { formula: '1d10', total: 0 } }).total, '0');
});

test('plain messages, whispers and module cards', () => {
  assert.deepEqual(pick(feedCard({ id: 'a', alias: 'Мастер', tone: 'gm', text: 'За дверью шаги' })), ['Мастер', '', 'За дверью шаги', null]);
  assert.equal(feedCard({ id: 'b', tone: 'whisper', text: 'Тебе' }).sub, 'шёпот');
  assert.equal(feedCard({ id: 'c', tone: 'module', text: 'Welcome' }).sub, 'модуль');
  assert.equal(feedCard({ id: 'd', text: '' }).text, '…');
  assert.equal(feedCard({ id: 'e', alias: '   ' }).who, 'Без имени');
});

test('a blind roll hides everything but the author from players, not from the GM', () => {
  const input = { id: 'b1', alias: 'Игрок', rollCard: { title: 'Рефлексы', total: '17' }, blind: true };
  const player = feedCard({ ...input, isGM: false });
  assert.deepEqual([player.sub, player.text, player.total, player.concealed], ['скрытый бросок', '', null, true]);
  assert.doesNotMatch(player.label, /17|Рефлексы/);
  assert.equal(feedCard({ ...input, isGM: true }).total, '17');
});

test('the queue keeps the newest four and reports the dropped ones', () => {
  let cards = [];
  const dropped = [];
  for (let i = 1; i <= 6; i++) { const r = pushCard(cards, { id: `m${i}` }); cards = r.cards; dropped.push(...r.dropped.map(c => c.id)); }
  assert.equal(FEED_LIMIT, 4);
  assert.deepEqual(cards.map(c => c.id), ['m3', 'm4', 'm5', 'm6']);
  assert.deepEqual(dropped, ['m1', 'm2']);
  assert.deepEqual(pushCard(cards, { id: 'm5' }).cards.map(c => c.id), ['m3', 'm4', 'm6', 'm5']);
});

test('the feed sits at the right under the bar, under the REDLINE queue in combat, left of an open drawer', () => {
  const base = { width: 1920, height: 1080, controls: { right: 50 }, navigation: { bottom: 60 }, hotbar: { top: 1010 }, players: { top: 1000 }, spacious: true, dockHeight: 120, sidebar: null };
  const calm = layoutHUD(base).feed;
  assert.deepEqual([calm.left, calm.top, calm.width], [1910 - FEED_WIDTH, 68, FEED_WIDTH]);
  const fight = layoutHUD({ ...base, queueVisible: true });
  assert.equal(fight.feed.top, fight.combat.bottom + 10);
  const open = layoutHUD({ ...base, sidebar: drawerBounds({ width: 1920, height: 1080, open: true }) }).feed;
  assert.equal(open.left + open.width, 1550);
  assert.ok(open.maxHeight > 600);
  const card = layoutHUD({ ...base, timer: { left: 1600, top: 68, width: 300, height: 120 }, timerManaged: false }).feed;
  assert.equal(card.top, 198);
});

function pick(card) { return [card.who, card.sub, card.text, card.total]; }
