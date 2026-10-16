import test from 'node:test';
import assert from 'node:assert/strict';

test('Players preferences are registered only for the client, with a visible collapsed default',async()=>{
  const previous={Hooks:globalThis.Hooks,game:globalThis.game};
  const once=new Map(),settings=new Map();
  globalThis.Hooks={once:(name,callback)=>once.set(name,callback),on:()=>{}};
  globalThis.game={settings:{register:(module,key,options)=>{if(module==='night-city-ui')settings.set(key,options);}},keybindings:{register:()=>{}}};
  try{
    await import('../scripts/main.js?players-settings');
    once.get('init')();
    for(const key of ['showPlayers','playersExpanded','playersPosition']){
      assert.equal(settings.get(key)?.scope,'client',`${key} must not change another participant's interface`);
    }
    assert.equal(settings.get('showPlayers').type,Boolean);
    assert.equal(settings.get('showPlayers').default,true);
    assert.equal(settings.get('playersExpanded').default,false);
    assert.equal(settings.get('playersExpanded').config,false);
    assert.equal(settings.get('playersPosition').type,Object);
    assert.equal(settings.get('playersPosition').config,false);
    assert.deepEqual(settings.get('playersPosition').default,{});
  }finally{
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
  }
});
