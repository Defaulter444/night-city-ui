import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ownsDockPresentation, updateDock } from '../scripts/presentation.js';

const legacyStates=['ncu-actor-compact','ncu-empty-targets','ncu-idle','ncu-no-queue','ncu-no-actor','ncu-tight-dock'];

test('only the REDLINE Blackglass marker opts out of the legacy dock adapter',()=>{
  assert.equal(ownsDockPresentation(null),false);
  assert.equal(ownsDockPresentation({classList:{contains:()=>false},dataset:{}}),false);
  assert.equal(ownsDockPresentation({classList:{contains:name=>name==='redline-blackglass'},dataset:{}}),true);
  assert.equal(ownsDockPresentation({classList:{contains:()=>false},dataset:{layout:'blackglass-dock'}}),true);
});

test('Blackglass keeps native collapse controls and clears legacy presentation in every spacious/expanded state',()=>{
  for(const marker of ['class','data'])for(const spacious of [false,true])for(const expanded of [false,true])for(const hasTargets of [false,true]){
    const classes=new Set([...legacyStates,...(marker==='class'?['redline-blackglass']:[])]);
    let removed=0;
    const oldButton={remove:()=>removed++};
    const root={
      classList:{contains:name=>classes.has(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)},
      dataset:marker==='data'?{layout:'blackglass-dock'}:{},
      querySelector:selector=>{
        if(selector==='[data-ncu-dock-toggle]')return oldButton;
        assert.fail(`The self-managed dock must not be adapted through ${selector}`);
      },
    };
    updateDock(root,{spacious,expanded,hasTargets,onToggle:()=>assert.fail('Native collapse must not change Night City UI settings')});
    assert.equal(removed,1,'remove a stale injected control when upgrading the HUD');
    for(const name of legacyStates)assert.equal(classes.has(name),false,name);
    assert.equal(ownsDockPresentation(root),true,'retain the native layout marker');
  }
});

test('all legacy REDLINE CSS excludes both native-layout markers, including geometry and visibility rules',async()=>{
  const guard=':not(.redline-blackglass):not([data-layout="blackglass-dock"])';
  for(const file of ['shell.css','spacious.css','blackglass-hud.css']){
    const source=await readFile(new URL(`../styles/${file}`,import.meta.url),'utf8');
    let count=0;
    for(const match of source.matchAll(/#redline-combat-hud/g)){
      count++;
      assert.equal(source.slice(match.index+match[0].length,match.index+match[0].length+guard.length),guard,
        `${file}: REDLINE rule must not override Blackglass when the theme is enabled`);
    }
    assert.ok(count>0,`${file} still styles the legacy HUD`);
  }
});
