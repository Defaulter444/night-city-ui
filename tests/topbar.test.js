import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_ORDER, sectionState, windowSection, pickActiveSection } from '../scripts/topbar/sections.js';
import { keyLabel } from '../scripts/topbar/keys.js';

test('sections keep the bar order', () => {
  assert.deepEqual([...SECTION_ORDER], ['actor', 'agent', 'market', 'net', 'city', 'battle']);
});
test('absent module hides the section, missing access locks it', () => {
  assert.equal(sectionState({ installed: false, available: true }), 'hidden');
  assert.equal(sectionState({ installed: true, available: false }), 'locked');
  assert.equal(sectionState({ installed: true, available: true }), 'ready');
  assert.equal(sectionState({ available: true }), 'ready');
});
test('windows are matched to their sections', () => {
  class ActorSheet { constructor(type) { this.actor = { type }; this.rendered = true; } }
  class CombatTracker { constructor(popOut) { this.options = { popOut }; this.rendered = true; } }
  const netApp = { rendered: true };
  const ctx = { ActorSheet, CombatTracker, netApp };
  const app = (classes, id = '') => ({ rendered: true, element: { id, classList: { contains: name => classes.includes(name) } } });
  assert.equal(windowSection(new ActorSheet('character'), ctx), 'actor');
  assert.equal(windowSection(new ActorSheet('mook'), ctx), 'actor');
  assert.equal(windowSection(new ActorSheet('container'), ctx), null);
  assert.equal(windowSection(new CombatTracker(true), ctx), 'battle');
  assert.equal(windowSection(new CombatTracker(false), ctx), null);
  assert.equal(windowSection(netApp, ctx), 'net');
  assert.equal(windowSection(app(['nca-app']), ctx), 'agent');
  assert.equal(windowSection(app(['nca-workspace']), ctx), 'agent');
  assert.equal(windowSection({ rendered: true, element: [{ id: 'night-city-market-window', classList: { contains: () => false } }] }, ctx), 'market');
  assert.equal(windowSection({ ...app(['nca-app']), rendered: false }, ctx), null);
  assert.equal(windowSection(app(['night-city-menu']), ctx), null);
  assert.equal(windowSection(null, ctx), null);
});
test('front window wins, the combat tab is the fallback, hidden sections never light up', () => {
  const states = { actor: 'ready', agent: 'locked', market: 'hidden', battle: 'ready' };
  assert.equal(pickActiveSection({ frontSection: 'agent', combatTab: true, states }), 'agent');
  assert.equal(pickActiveSection({ frontSection: 'market', combatTab: true, states }), 'battle');
  assert.equal(pickActiveSection({ frontSection: null, combatTab: true, states }), 'battle');
  assert.equal(pickActiveSection({ frontSection: null, combatTab: false, states }), null);
  assert.equal(pickActiveSection({ frontSection: null, combatTab: true, states: { battle: 'hidden' } }), null);
});
test('keybinding labels follow the current binding', () => {
  assert.equal(keyLabel([{ key: 'KeyN', modifiers: ['Alt'] }]), 'Alt+N');
  assert.equal(keyLabel([{ key: 'Space', modifiers: ['Control'] }]), 'Ctrl+Space');
  assert.equal(keyLabel([{ key: 'KeyQ', modifiers: [] }]), 'Q');
  assert.equal(keyLabel([{ key: 'Digit1', modifiers: ['Shift', 'Shift'] }]), 'Shift+1');
  assert.equal(keyLabel([{ key: '' }, { key: 'KeyE' }]), 'E');
  assert.equal(keyLabel([]), '');
  assert.equal(keyLabel(undefined), '');
});
