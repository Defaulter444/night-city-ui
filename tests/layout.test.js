import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutHUD, intersects, presentationContext } from '../scripts/layout.js';

const r = (left,top,width,height) => ({left,top,width,height,right:left+width,bottom:top+height});
function fixture(width=1440,height=900) { return {width,height,sidebar:r(width-305,5,300,height-10),controls:r(14,72,88,480),navigation:r(170,12,500,38),hotbar:r(225,height-61,610,50),players:r(15,height-74,200,62),timer:r(width-617,72,300,166),dockHeight:180}; }
test('standard workspace reserves scene navigation, sidebar and bottom controls', () => {
  const input=fixture(); const layout=layoutHUD(input);
  for(const box of [layout.toolbar,layout.timer,layout.combat,layout.dock]) {
    assert.ok(!intersects(box,input.sidebar)); assert.ok(!intersects(box,input.navigation));
    assert.ok(!intersects(box,input.hotbar)); assert.ok(!intersects(box,input.players));
  }
  assert.ok(!intersects(layout.timer,layout.combat));
  assert.ok(!intersects(layout.toolbar,layout.timer));
  assert.ok(!intersects(layout.combat,layout.dock));
});
test('1366x768 keeps expanded timer separate from queue and dock', () => {
  const input=fixture(1366,768); const layout=layoutHUD(input);
  assert.ok(!intersects(layout.timer,layout.combat)); assert.ok(!intersects(layout.timer,layout.dock));
  assert.ok(layout.dock.bottom < input.hotbar.top);
});
test('collapsed sidebar frees usable width', () => {
  const input=fixture(); const open=layoutHUD(input); input.sidebar=r(1400,5,35,890);
  assert.ok(layoutHUD(input).toolbar.width>open.toolbar.width);
});
test('manually placed timer is preserved and the queue moves below it', () => {
  const input=fixture(); input.timer=r(200,112,300,166); input.timerManaged=false;
  const result=layoutHUD(input); assert.deepEqual(result.timer,input.timer);
  assert.ok(result.combat.top>=result.timer.bottom+10);
});
test('collapsed timer uses its actual height', () => {
  const input=fixture(); input.timer.height=40; input.timer.bottom=input.timer.top+40;
  assert.equal(layoutHUD(input).timer.height,40);
});
test('Blackglass keeps a stable topbar and HUD while the native scene/tool flyouts open', () => {
  const input={...fixture(),spacious:true,timer:r(800,58,264,54)};
  const closed=layoutHUD(input);
  const open=layoutHUD({...input,controls:{right:110},navigation:r(1070,56,360,160)});
  assert.deepEqual(open,closed);
  assert.deepEqual(closed.toolbar,r(0,0,1440,48));
  assert.equal(closed.combat.top,58);
  assert.equal(closed.combat.height,64);
  assert.ok(!intersects(closed.timer,closed.combat));
});
test('Blackglass keeps expanded and collapsed timers outside the queue across desktop sizes', () => {
  for(const width of [1024,1280,1440,1600])for(const timerHeight of [54,166]){
    const input={...fixture(width,768),spacious:true,timer:r(0,0,264,timerHeight),dockHeight:112,dockWidth:540};
    const result=layoutHUD(input);
    assert.ok(!intersects(result.timer,result.combat));
    assert.ok(!intersects(result.timer,result.dock));
    assert.ok(!intersects(result.dock,input.hotbar));
    assert.equal(result.toolbar.bottom,48);
  }
});
test('idle screen has no combat chrome; selecting an actor shows only actor data', () => {
  assert.deepEqual(presentationContext({}),{battle:false,hud:false,queue:false,actor:false});
  assert.deepEqual(presentationContext({selected:{id:'a'}}),{battle:false,hud:true,queue:false,actor:true});
});
test('active combat and preference to show all retain existing content', () => {
  assert.equal(presentationContext({combat:{round:1}}).queue,true);
  assert.equal(presentationContext({contextOnly:false}).hud,true);
});
test('short available canvas never places queue over actor dock',()=>{
  const result=layoutHUD({width:1100,height:768,sidebar:{left:782},controls:{right:100},navigation:{bottom:90},hotbar:{top:700},players:{top:600},timer:{width:300,height:200},dockHeight:210});
  assert.ok(!intersects(result.combat,result.dock));
  assert.ok(!intersects(result.timer,result.combat));
});
test('combat adjustment preserves the safe boundary above a manually placed timer',()=>{
  const result=layoutHUD({width:1280,height:768,sidebar:{left:962},controls:{right:100},navigation:{bottom:90},hotbar:{top:700},players:{top:600},timer:r(500,480,300,200),timerManaged:false,dockHeight:210});
  assert.ok(!intersects(result.combat,result.dock,10));
  assert.ok(!intersects(result.timer,result.dock,10));
  assert.ok(result.dock.height<=210);
});
