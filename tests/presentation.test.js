import test from 'node:test';
import assert from 'node:assert/strict';
import { dockSize, resolveHUDPresentation, updateDock } from '../scripts/presentation.js';
import { layoutHUD, intersects } from '../scripts/layout.js';

const box = (left, top, width, height) => ({left, top, width, height, right:left + width, bottom:top + height});
const actor = Object.freeze({id:'owned-actor'});
const view = overrides => ({spacious:true, expanded:false, selected:actor, hasTargets:false, ...overrides});
function workspace(width = 1440, height = 900) {
  return {
    width, height,
    sidebar:box(width - 305, 5, 300, height - 10),
    controls:box(14, 72, 88, 400),
    navigation:box(170, 12, 500, 38),
    hotbar:box(225, height - 61, 610, 50),
    players:box(15, height - 74, 200, 62),
    timer:box(width - 617, 72, 300, 166),
  };
}
function present(input, preferences) {
  const size = dockSize(preferences);
  return layoutHUD({...input, spacious:preferences.spacious, dockHeight:size.height, dockWidth:size.width});
}
function assertUsableBounds(result, input, size) {
  for (const [key, value] of Object.entries(result.dock)) assert.ok(Number.isFinite(value), `dock.${key} must be finite`);
  assert.ok(result.dock.height >= 0);
  assert.ok(result.dock.height <= size.height, 'collision handling must never enlarge the requested card');
  assert.ok(result.dock.width <= size.width);
  assert.ok(result.dock.left >= 0);
  assert.ok(result.dock.right <= input.width);
  assert.ok(result.dock.bottom <= result.bottom);
  if (result.dock.height > 0) {
    assert.ok(!intersects(result.dock, result.combat), 'card must not cover initiative controls');
    assert.ok(!intersects(result.dock, result.timer), 'card must not cover the timer');
    assert.ok(!intersects(result.dock, input.sidebar), 'card must not cover the sidebar');
    assert.ok(!intersects(result.dock, input.hotbar), 'card must not cover native macro controls');
  }
}

test('spacious default leaves an 80px card rather than inheriting the former 120px minimum', () => {
  const preferences = view();
  const size = dockSize(preferences);
  const result = present(workspace(), preferences);
  assert.equal(size.height, 80);
  assert.equal(result.dock.height, 80);
  assert.equal(result.dock.width, 540);
  assert.ok(result.dock.width < result.toolbar.width, 'the card leaves canvas space beside it');
});

test('a missing selected actor does not reserve an empty character card', () => {
  for (const expanded of [false, true]) {
    for (const hasTargets of [false, true]) {
      const preferences = view({selected:null, expanded, hasTargets});
      assert.equal(dockSize(preferences).height, 0);
      assert.equal(present(workspace(), preferences).dock.height, 0);
    }
  }
});

test('visible targets add their strip to both compact and expanded cards', () => {
  for (const expanded of [false, true]) {
    const empty = dockSize(view({expanded}));
    const populated = dockSize(view({expanded, hasTargets:true}));
    assert.equal(populated.height - empty.height, 32, '32px target strip without a redundant gap');
    assert.equal(populated.width, empty.width);
  }
  const result = present(workspace(), view({hasTargets:true}));
  assert.equal(result.dock.height, 112);
});

test('expanded actions request 340px while the compact actor remains 80px', () => {
  assert.equal(dockSize(view({expanded:true})).height, 340);
  assert.equal(dockSize(view({expanded:true,hasTargets:true})).height, 372);
  assert.equal(dockSize(view({expanded:false})).height, 80);
});

test('the actions toggle keeps its native button and reports the current expanded state', () => {
  class Element {
    constructor(tag) { this.tagName=tag; this.attributes={}; this.dataset={}; this.children=[]; this.listeners={}; }
    setAttribute(name,value) { this.attributes[name]=value; }
    addEventListener(type,handler) { this.listeners[type]=handler; }
    append(child) { this.children.push(child); }
    replaceChildren(...children) { this.children=children; }
    get textContent() { return this.children.length?this.children.map(child=>child.textContent).join(''):(this.text??''); }
    set textContent(value) { this.text=value; this.children=[]; }
  }
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>new Element(tag)};
  try {
    const card=new Element('section');
    const classes=new Set();
    const root={classList:{contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)},querySelector:selector=>selector.startsWith('.redline-actor')?card:card.children.find(child=>child.dataset.ncuDockToggle)};
    let calls=0;
    const options={spacious:true,expanded:false,hasTargets:false,onToggle:()=>calls++};
    updateDock(root,options);
    const button=card.children[0];
    assert.equal(button.tagName,'button');
    assert.equal(button.type,'button');
    assert.equal(button.textContent,'Действия');
    assert.equal(button.attributes['aria-expanded'],'false');
    assert.equal(button.children[1].attributes['aria-hidden'],'true');
    updateDock(root,{...options,expanded:true});
    assert.equal(card.children.length,1);
    assert.equal(card.children[0],button);
    assert.equal(button.textContent,'Свернуть');
    assert.equal(button.attributes['aria-expanded'],'true');
    assert.equal(button.children[1].className,'fa-solid fa-chevron-up');
    button.listeners.click({stopPropagation(){}});
    assert.equal(calls,1);
  } finally {
    if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
  }
});

test('revealing and collapsing details preserves timer, toolbar and the bottom anchor', () => {
  const input = workspace();
  const compact = present(input, view());
  const full = present(input, view({expanded:true}));
  const compactAgain = present(input, view());
  assert.ok(full.dock.height > compact.dock.height);
  assert.ok(full.dock.width > compact.dock.width);
  assert.deepEqual(full.timer, compact.timer);
  assert.deepEqual(full.toolbar, compact.toolbar);
  assert.equal(full.dock.bottom, compact.dock.bottom);
  assert.deepEqual(compactAgain, compact);
});

test('disabling spacious mode restores the legacy requested presentation size', () => {
  for (const expanded of [false, true]) {
    const size = dockSize(view({spacious:false, expanded, hasTargets:true}));
    assert.equal(size.height, 210);
    assert.equal(size.width, Infinity);
    const result = present(workspace(), view({spacious:false, expanded}));
    assert.equal(result.dock.width, result.toolbar.width);
    assert.equal(result.toolbar.height, 44);
  }
});

test('small workspaces constrain both card states without covering native controls', () => {
  for (const [width, height] of [[1366,768], [1100,768], [1024,600], [768,600]]) {
    for (const expanded of [false, true]) {
      for (const hasTargets of [false, true]) {
        const input = workspace(width, height);
        const preferences = view({expanded, hasTargets});
        assertUsableBounds(present(input, preferences), input, dockSize(preferences));
      }
    }
  }
});

test('manual timer placement survives reveal and reserves space above or beside the dock', () => {
  const input = {
    width:1280, height:768,
    sidebar:box(962, 5, 310, 758), controls:{right:100}, navigation:{bottom:90},
    hotbar:box(225, 700, 610, 50), players:{top:600},
    timer:box(500, 480, 300, 200), timerManaged:false,
  };
  for (const expanded of [false, true]) {
    for (const hasTargets of [false, true]) {
      const preferences = view({expanded, hasTargets});
      const result = present(input, preferences);
      assert.deepEqual(result.timer, input.timer, 'presentation must not rewrite native timer coordinates');
      assertUsableBounds(result, input, dockSize(preferences));
      if (result.dock.height > 0 && result.dock.right > input.timer.left - result.gap)
        assert.ok(result.dock.bottom <= input.timer.top - result.gap);
    }
  }
});

test('presentation calculations leave caller preferences and geometry unchanged', () => {
  const input = workspace();
  const preferences = view({expanded:true, hasTargets:true});
  const before = structuredClone({input, preferences});
  Object.values(input).filter(value => value && typeof value === 'object').forEach(Object.freeze);
  Object.freeze(input);
  Object.freeze(preferences);
  present(input, preferences);
  assert.deepEqual({input, preferences}, before);
});

test('always-visible mode reserves the assigned REDLINE card outside combat without a controlled token', () => {
  for (const expanded of [false, true]) {
    const result=resolveHUDPresentation({combat:null,projectedSelected:actor,contextOnly:false,spacious:true,expanded,hasTargets:false});
    assert.equal(result.selected,actor);
    assert.equal(result.context.actor,true);
    assert.equal(result.context.hud,true);
    assert.ok(result.dock.height>0,'an explicitly visible assigned card must not receive a zero-height dock');
    const layout=layoutHUD({...workspace(),spacious:true,dockHeight:result.dock.height,dockWidth:result.dock.width});
    assert.ok(layout.dock.height>0);
  }
});

test('contextual mode still leaves the idle scene clear when only an assigned actor is available', () => {
  const result=resolveHUDPresentation({combat:null,projectedSelected:actor,contextOnly:true,spacious:true,expanded:false,hasTargets:false});
  assert.equal(result.selected,null);
  assert.equal(result.context.hud,false);
  assert.equal(result.context.actor,false);
  assert.equal(result.dock.height,0);
});

test('the shared subject logic retains controlled-token and active-combat fallback behavior', () => {
  const controlled=Object.freeze({actor:{id:'controlled-actor'}});
  const base={projectedSelected:actor,contextOnly:true,spacious:true,expanded:false,hasTargets:false};
  const idle=resolveHUDPresentation({...base,combat:null,controlledSelected:controlled});
  assert.equal(idle.selected,controlled);
  assert.equal(idle.context.actor,true);
  assert.equal(idle.dock.height,80);
  const combat=resolveHUDPresentation({...base,combat:{started:true,round:1}});
  assert.equal(combat.selected,actor);
  assert.equal(combat.context.queue,true);
  assert.equal(combat.context.actor,true);
  assert.equal(combat.dock.height,80);
});
