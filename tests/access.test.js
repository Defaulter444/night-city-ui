import test from 'node:test';
import assert from 'node:assert/strict';
import {canOpenNet,sheetActor} from '../scripts/access.js';
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
