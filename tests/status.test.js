import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockText, combatStatus, timerView } from '../scripts/topbar/status.js';

test('clock text rounds seconds up and adds hours only past one hour', () => {
  assert.equal(clockText(272000), '04:32');
  assert.equal(clockText(271001), '04:32');
  assert.equal(clockText(0), '00:00');
  assert.equal(clockText(-5), '00:00');
  assert.equal(clockText(Number.NaN), '00:00');
  assert.equal(clockText(3600000), '01:00:00');
  assert.equal(clockText(3599001), '01:00:00');
  assert.equal(clockText(3599000), '59:59');
});

test('no combat, no status; before round one — preparation', () => {
  assert.equal(combatStatus(null), null);
  const prep = combatStatus({ round: 0, started: false, combatant: { name: 'Веспер' } });
  assert.equal(prep.state, 'prep');
  assert.equal(prep.text, 'Подготовка к бою');
  assert.equal(prep.short, 'Подготовка');
});

test('round and whose turn, full and short', () => {
  const status = combatStatus({ round: 3, started: true, combatant: { name: '  Веспер ', hidden: false } });
  assert.equal(status.text, 'Раунд 3 · ходит Веспер');
  assert.equal(status.short, 'Р3 · Веспер');
  assert.equal(status.name, 'Веспер');
  assert.equal(status.round, 3);
  assert.match(status.tooltip, /^Раунд 3 · ходит Веспер\. Щелчок — вкладка «Бой»\.$/);
});

test('started is derived from the round when the document lacks it', () => {
  assert.equal(combatStatus({ round: 2, combatant: { name: 'А' } }).text, 'Раунд 2 · ходит А');
  assert.equal(combatStatus({ round: 0, combatant: { name: 'А' } }).state, 'prep');
});

test('hidden combatant: players see «ход скрыт», the GM sees the name with a note', () => {
  const combat = { round: 4, started: true, combatant: { name: 'Снайпер', hidden: true } };
  const player = combatStatus(combat, { isGM: false });
  assert.equal(player.text, 'Раунд 4 · ход скрыт');
  assert.equal(player.short, 'Р4 · скрыт');
  assert.equal(player.name, '');
  assert.equal(player.concealed, true);
  assert.doesNotMatch(player.tooltip, /Снайпер/);
  const gm = combatStatus(combat, { isGM: true });
  assert.equal(gm.text, 'Раунд 4 · ходит Снайпер');
  assert.equal(gm.secret, true);
  assert.match(gm.tooltip, /скрыт от игроков/);
  const owner = combatStatus({ ...combat, combatant: { ...combat.combatant, isOwner: true } });
  assert.equal(owner.text, 'Раунд 4 · ходит Снайпер');
});

test('round without a current combatant shows the round only', () => {
  assert.equal(combatStatus({ round: 1, started: true, combatant: undefined }).text, 'Раунд 1');
  assert.equal(combatStatus({ round: 1, started: true, combatant: { name: '' } }).short, 'Р1');
});

const deadline = (patch = {}) => ({ label: 'Сброс груза', durationMs: 600000, remainingMs: 600000, deadlineMs: null, status: 'idle', visible: true, warningSeconds: 60, ...patch });

test('idle timer, missing state and a timer hidden from players are not shown', () => {
  assert.equal(timerView(null), null);
  assert.equal(timerView('broken'), null);
  assert.equal(timerView(deadline()), null);
  assert.equal(timerView(deadline({ status: 'running', deadlineMs: 1000000, visible: false }), { now: 900000 }), null);
});

test('running timer counts from the deadline and asks to repaint at the next second', () => {
  const view = timerView(deadline({ status: 'running', effectiveStatus: 'running', deadlineMs: 1272000 }), { now: 1000000 });
  assert.equal(view.status, 'running');
  assert.equal(view.time, '04:32');
  assert.equal(view.label, 'Сброс груза');
  assert.equal(view.warning, false);
  assert.equal(view.nextTick, 1020);
  assert.equal(timerView(deadline({ status: 'running', deadlineMs: 1271500 }), { now: 1000000 }).nextTick, 520);
  assert.match(view.tooltip, /^Сброс груза: 04:32, идёт отсчёт\.$/);
});

test('last minute warns, the warning threshold follows DEADLINE and zero disables it', () => {
  assert.equal(timerView(deadline({ status: 'running', deadlineMs: 1060000 }), { now: 1000000 }).warning, true);
  assert.equal(timerView(deadline({ status: 'running', deadlineMs: 1061000 }), { now: 1000000 }).warning, false);
  assert.equal(timerView(deadline({ status: 'running', deadlineMs: 1100000, warningSeconds: 120 }), { now: 1000000 }).warning, true);
  assert.equal(timerView(deadline({ status: 'running', deadlineMs: 1001000, warningSeconds: 0 }), { now: 1000000 }).warning, false);
});

test('paused timer shows the saved remainder and does not tick', () => {
  const view = timerView(deadline({ status: 'paused', remainingMs: 95000 }), { now: 5 });
  assert.equal(view.status, 'paused');
  assert.equal(view.time, '01:35');
  assert.equal(view.warning, false);
  assert.equal(view.nextTick, null);
  assert.match(view.tooltip, /на паузе/);
});

test('reaching the deadline turns into «Время вышло», also when DEADLINE says expired', () => {
  const late = timerView(deadline({ status: 'running', deadlineMs: 1000000 }), { now: 1000500 });
  assert.equal(late.status, 'expired');
  assert.equal(late.time, 'Время вышло');
  assert.equal(late.warning, false);
  assert.equal(late.nextTick, null);
  assert.equal(timerView(deadline({ status: 'running', effectiveStatus: 'expired', deadlineMs: 2000000 }), { now: 1 }).status, 'expired');
});

test('the GM sees a hidden timer with a note and a click hint', () => {
  const view = timerView(deadline({ status: 'paused', remainingMs: 1000, visible: false }), { isGM: true });
  assert.equal(view.hiddenFromPlayers, true);
  assert.match(view.tooltip, /\(скрыт от игроков\)\. Щелчок — управление таймером\.$/);
  assert.equal(timerView(deadline({ status: 'paused', remainingMs: 1000, label: '   ' })).label, 'Таймер');
});
