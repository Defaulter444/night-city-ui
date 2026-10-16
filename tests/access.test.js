import test from 'node:test';
import assert from 'node:assert/strict';
import {canOpenNet,sheetActor,atlasAccess} from '../scripts/access.js';
const actor=(owned=true,deck=true)=>({type:'character',getEquippedCyberdeck:()=>deck?{}:null,testUserPermission:()=>owned});
test('NET permits GM and explicitly allowed spectators',()=>{
  assert.equal(canOpenNet({user:{isGM:true}}),true);
  assert.equal(canOpenNet({user:{},allowSpectators:true}),true);
});
test('NET requires ownership and a deck for ordinary players',()=>{
  assert.equal(canOpenNet({user:{},actors:[actor(false)]}),false);
  assert.equal(canOpenNet({user:{},actors:[actor(true,false)]}),false);
  assert.equal(canOpenNet({user:{},actors:[actor()]}),true);
});
test('unavailable system deck APIs fail closed',()=>{
  assert.equal(canOpenNet({user:{character:{type:'character',getEquippedCyberdeck(){throw Error('unavailable');}}}}),false);
});
test('character action follows one controlled token then assigned actor, never arbitrary ownership',()=>{
  const assigned=actor(),selected=actor();
  assert.equal(sheetActor({user:{character:assigned},controlled:[{actor:selected}]}),selected);
  assert.equal(sheetActor({user:{character:assigned},controlled:[{actor:selected},{actor:selected}]}),assigned);
  assert.equal(sheetActor({user:{},controlled:[]}),null);
});
test('character action rejects a token without viewing permission',()=>{
  assert.equal(sheetActor({user:{},controlled:[{actor:actor(false)}]}),null);
});
test('Atlas missing or loading remains unavailable with an honest reason',()=>{
  for (const api of [undefined, {}, {canOpen:()=>true}]) {
    const gm=atlasAccess({user:{isGM:true},api});
    assert.equal(gm.available,false);assert.equal(gm.visible,true);
    assert.match(gm.reason,/выключен или ещё загружается/);
    assert.equal(atlasAccess({user:{isGM:false},api}).visible,false);
  }
});
test('legacy Atlas preserves GM entry and never grants player entry',()=>{
  const api={open(){throw Error('Checking availability must not open the Atlas');}};
  assert.deepEqual(atlasAccess({user:{isGM:true},api}),{available:true,visible:true,reason:''});
  const player=atlasAccess({user:{isGM:false},api});
  assert.equal(player.available,false);assert.equal(player.visible,false);
  assert.match(player.reason,/только ведущему/);
});
test('modern Atlas explicitly permits a player through its own canOpen contract',()=>{
  const api={permission:true,open(){},canOpen(){return this.permission;}};
  assert.deepEqual(atlasAccess({user:{isGM:false},api}),{available:true,visible:true,reason:''});
});
test('modern Atlas denial is respected for players and GMs',()=>{
  const api={open(){},canOpen:()=>false};
  for(const isGM of [false,true]) {
    const result=atlasAccess({user:{isGM},api});
    assert.equal(result.available,false);assert.equal(result.visible,isGM);
    assert.match(result.reason,/недоступен этому пользователю/);
  }
});
test('Atlas errors and nonboolean permissions fail closed',()=>{
  const throwing={open(){},canOpen(){throw Error('Atlas unavailable');}};
  const failed=atlasAccess({user:{isGM:false},api:throwing});
  assert.equal(failed.available,false);assert.equal(failed.visible,false);
  assert.match(failed.reason,/Не удалось проверить доступ/);
  for(const permission of [undefined,null,1,'true',{},Promise.resolve(true)]) {
    assert.equal(atlasAccess({user:{isGM:false},api:{open(){},canOpen:()=>permission}}).available,false);
  }
});
test('Atlas permission is refreshed instead of caching a previous grant',()=>{
  let permitted=true;
  const api={open(){},canOpen:()=>permitted},user={isGM:false};
  assert.equal(atlasAccess({user,api}).visible,true);
  permitted=false;
  assert.equal(atlasAccess({user,api}).visible,false);
});
test('Atlas access requires the current user to be ready',()=>{
  const result=atlasAccess({api:{open(){},canOpen:()=>true}});
  assert.equal(result.available,false);assert.equal(result.visible,false);
});
