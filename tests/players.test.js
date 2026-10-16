import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayersPanel, playerPanelPosition} from '../scripts/players.js';

// DOM/event doubles model propagation and local geometry; no Foundry data is used.
class DOMEvent extends Event {
  stopPropagation(){this.propagationStopped=true;super.stopPropagation();}
  stopImmediatePropagation(){this.immediateStopped=true;this.propagationStopped=true;super.stopImmediatePropagation();}
}
function emit(node,type,values={},bubble=false){
  const event=new DOMEvent(type,{cancelable:true});
  for(const [key,value] of Object.entries({target:node,...values}))Object.defineProperty(event,key,{value,configurable:true});
  for(let current=node;current;current=bubble?current.parentNode:null){
    current.dispatchEvent(event);
    if(event.propagationStopped)break;
  }
  return event;
}
class Classes {
  constructor(){this.values=new Set();}
  contains(name){return this.values.has(name);}
  add(...names){for(const name of names)this.values.add(name);}
  remove(...names){for(const name of names)this.values.delete(name);}
  toggle(name,force=!this.contains(name)){if(force)this.add(name);else this.remove(name);return force;}
}
class Style {
  constructor(){this.values=new Map();}
  getPropertyValue(name){return this.values.get(name)?.value??'';}
  getPropertyPriority(name){return this.values.get(name)?.priority??'';}
  setProperty(name,value,priority=''){this.values.set(name,{value:String(value),priority});}
  removeProperty(name){const value=this.getPropertyValue(name);this.values.delete(name);return value;}
}
class Element extends EventTarget {
  constructor(doc,tag='div',bounds={left:64,top:674,width:160,height:36}){
    super();this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.bounds=bounds;
    this.attributes=new Map();this.classList=new Classes();this.style=new Style();this.dataset={};
    this.children=[];this.parentNode=null;this.isConnected=true;this.captureListeners=new EventTarget();this.captured=new Set();
  }
  addEventListener(type,listener,options){
    const capture=options===true||options?.capture;
    if(capture)this.captureListeners.addEventListener(type,listener,options);else super.addEventListener(type,listener,options);
  }
  dispatchEvent(event){
    this.captureListeners.dispatchEvent(event);
    if(!event.immediateStopped)super.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  append(...children){for(const child of children){child.parentNode=this;this.children.push(child);}}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;this.isConnected=false;}
  querySelector(selector){
    if(selector===':scope > h3')return this.children.find(child=>child.tagName==='H3')??null;
    return null;
  }
  closest(selector){
    for(let node=this;node;node=node.parentNode){
      if(['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(node.tagName)&&selector.includes(node.tagName.toLowerCase()))return node;
      if(node.getAttribute('contenteditable')==='true'&&selector.includes('[contenteditable="true"]'))return node;
      if(node.getAttribute('role')==='button'&&selector.includes('[role="button"]'))return node;
    }
    return null;
  }
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  removeAttribute(name){this.attributes.delete(name);}
  set className(value){this.classList.values=new Set(value.split(/\s+/).filter(Boolean));}
  get className(){return [...this.classList.values].join(' ');}
  getBoundingClientRect(){
    const left=parseFloat(this.style.getPropertyValue('--ncu-players-left'))||this.bounds.left;
    const top=parseFloat(this.style.getPropertyValue('--ncu-players-top'))||this.bounds.top;
    return {...this.bounds,left,top,right:left+this.bounds.width,bottom:top+this.bounds.height};
  }
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({onSave,onError,beforeCreate,viewport={width:1280,height:720}}={}){
  const view=new EventTarget();const doc={defaultView:view,createElement:tag=>new Element(doc,tag)};
  const panel=new Element(doc,'aside'),header=new Element(doc,'h3'),list=new Element(doc,'ol'),foreign=new Element(doc,'section');
  header.setAttribute('role','button');panel.append(header,list,foreign);
  const saves=[],errors=[];let layouts=0,nativeClicks=0,foreignClicks=0;
  header.addEventListener('click',()=>nativeClicks++);foreign.addEventListener('click',()=>foreignClicks++);
  beforeCreate?.({panel,header,list,foreign});
  const options={panel,viewport:()=>viewport,onSave:patch=>{saves.push(patch);return onSave?.(patch);},onError:error=>{errors.push(error);onError?.(error);},onLayout:()=>layouts++};
  const controller=createPlayersPanel(options);controller.update();
  const button=panel.children.find(child=>child.dataset.ncuPlayersToggle==='true');
  return {view,doc,panel,header,list,foreign,button,saves,errors,viewport,controller,options,
    get layouts(){return layouts;},get nativeClicks(){return nativeClicks;},get foreignClicks(){return foreignClicks;}};
}
function down(f,values={}){return emit(f.header,'pointerdown',{button:0,isPrimary:true,pointerId:1,clientX:100,clientY:680,...values});}
function move(f,values={}){return emit(f.view,'pointermove',{pointerId:1,clientX:140,clientY:620,...values});}
function up(f,values={}){return emit(f.view,'pointerup',{pointerId:1,...values});}

test('saved position is finite, bounded and falls back for invalid values',()=>{
  assert.deepEqual(playerPanelPosition(),{x:64,y:674});
  assert.deepEqual(playerPanelPosition({width:1024,height:768,position:{x:9999,y:-50}}),{x:856,y:8});
  for(const position of [{x:NaN,y:Infinity},{x:'50',y:null},null,{}]){
    assert.deepEqual(playerPanelPosition({position}),{x:64,y:674});
  }
  assert.deepEqual(playerPanelPosition({width:500,height:300,spacious:false}),{x:12,y:254});
});

test('controller leaves a panel without the native direct h3 untouched',()=>{
  const doc={defaultView:new EventTarget()},panel=new Element(doc,'aside');
  assert.equal(createPlayersPanel({panel}),null);assert.equal(panel.children.length,0);
});

test('default panel is compact and own disclosure is a sibling of the native header',()=>{
  const f=fixture();
  assert.equal(f.panel.classList.contains('ncu-players-collapsed'),true);
  assert.equal(f.button.parentNode,f.panel);assert.equal(f.header.children.includes(f.button),false);
  assert.equal(f.button.getAttribute('aria-expanded'),'false');
  assert.equal(f.button.getAttribute('aria-label'),'Развернуть панель игроков');
  assert.equal(f.button.getAttribute('aria-controls'),'player-list');f.controller.destroy();
});

test('native header and foreign child listeners survive the enhancement',async()=>{
  const f=fixture();const originalChildren=[f.header,f.list,f.foreign];
  emit(f.header,'click',{detail:1},true);emit(f.foreign,'click',{detail:1},true);
  assert.equal(f.nativeClicks,1);assert.equal(f.foreignClicks,1);
  assert.deepEqual(f.panel.children.slice(0,3),originalChildren);
  emit(f.button,'click',{detail:1},true);await flush();
  assert.equal(f.nativeClicks,1);assert.equal(f.foreignClicks,1);
  assert.deepEqual(f.saves,[{expanded:true}]);assert.equal(f.button.getAttribute('aria-expanded'),'true');
  f.controller.destroy();emit(f.header,'click',{detail:1},true);emit(f.foreign,'click',{detail:1},true);
  assert.equal(f.nativeClicks,2);assert.equal(f.foreignClicks,2);
});

test('right-button and secondary pointers never drag or save',async()=>{
  const f=fixture();
  for(const values of [{button:2},{isPrimary:false}]){down(f,values);move(f);up(f);}
  const menu=emit(f.foreign,'contextmenu',{},true);await flush();
  assert.equal(menu.defaultPrevented,false);assert.equal(f.saves.length,0);
  assert.equal(f.panel.style.getPropertyValue('--ncu-players-left'),'64px');f.controller.destroy();
});

test('a click with movement below threshold preserves the native offline toggle',async()=>{
  const f=fixture();down(f);move(f,{clientX:103,clientY:682});up(f);
  const click=emit(f.header,'click',{detail:1},true);await flush();
  assert.equal(click.defaultPrevented,false);assert.equal(f.nativeClicks,1);assert.equal(f.saves.length,0);
  assert.equal(f.header.captured.size,0);f.controller.destroy();
});

test('drag saves local coordinates once and suppresses only the resulting pointer click',async()=>{
  const f=fixture();down(f);const movement=move(f);
  assert.equal(movement.defaultPrevented,true);assert.equal(f.header.hasPointerCapture(1),true);
  assert.equal(f.panel.classList.contains('ncu-players-dragging'),true);up(f);await flush();
  assert.deepEqual(f.saves,[{position:{x:104,y:614}}]);assert.equal(f.header.captured.size,0);
  assert.equal(f.panel.classList.contains('ncu-players-dragging'),false);
  const click=emit(f.header,'click',{detail:1},true);
  assert.equal(click.defaultPrevented,true);assert.equal(f.nativeClicks,0);
  emit(f.header,'click',{detail:1},true);assert.equal(f.nativeClicks,1);f.controller.destroy();
});

test('keyboard activation is not swallowed after a drag',async()=>{
  const f=fixture();down(f);move(f);up(f);await flush();
  const click=emit(f.header,'click',{detail:0},true);
  assert.equal(click.defaultPrevented,false);assert.equal(f.nativeClicks,1);f.controller.destroy();
});

test('embedded interactive controls do not start header drag',async()=>{
  const f=fixture();const input=new Element(f.doc,'input');f.header.append(input);
  emit(input,'pointerdown',{button:0,pointerId:1,clientX:100,clientY:680},true);move(f);up(f);await flush();
  assert.equal(f.saves.length,0);assert.equal(f.header.captured.size,0);f.controller.destroy();
});

test('pointer cancellation restores the previous position without persistence',async()=>{
  const f=fixture();f.controller.update({position:{x:200,y:500}});down(f);move(f);
  emit(f.view,'pointercancel',{pointerId:1});await flush();
  assert.equal(f.saves.length,0);assert.equal(f.header.captured.size,0);
  assert.equal(f.panel.style.getPropertyValue('--ncu-players-left'),'200px');
  assert.equal(f.panel.style.getPropertyValue('--ncu-players-top'),'500px');
  emit(f.header,'click',{detail:1});assert.equal(f.nativeClicks,1);f.controller.destroy();
});

test('a different pointer cannot move or finish an active drag',async()=>{
  const f=fixture();down(f);move(f,{pointerId:2});up(f,{pointerId:2});await flush();
  assert.equal(f.saves.length,0);assert.equal(f.panel.classList.contains('ncu-players-dragging'),false);
  move(f);up(f);await flush();assert.equal(f.saves.length,1);f.controller.destroy();
});

test('lost pointer capture cancels a drag without saving',async()=>{
  const f=fixture();down(f);move(f);emit(f.header,'lostpointercapture',{pointerId:1});up(f);await flush();
  assert.equal(f.saves.length,0);assert.equal(f.header.captured.size,0);f.controller.destroy();
});

test('leaving the browser window cancels an active drag without persistence',async()=>{
  const f=fixture();down(f);move(f);emit(f.view,'blur');up(f);await flush();
  assert.equal(f.saves.length,0);assert.equal(f.header.captured.size,0);
  assert.equal(f.panel.classList.contains('ncu-players-dragging'),false);
  assert.equal(f.panel.style.getPropertyValue('--ncu-players-left'),'64px');f.controller.destroy();
});

test('destroy releases active capture and ignores later events or API updates',async()=>{
  const f=fixture();down(f);move(f);f.controller.destroy();
  assert.equal(f.header.captured.size,0);const layouts=f.layouts;
  move(f);up(f);emit(f.view,'resize');f.controller.update({visible:false});await f.controller.reset();
  assert.equal(f.saves.length,0);assert.equal(f.layouts,layouts);
  assert.equal(f.panel.classList.contains('ncu-players-managed'),false);assert.equal(f.button.isConnected,false);
});

test('destroy restores owned style priorities, classes and header title only',()=>{
  const f=fixture({beforeCreate:({panel,header})=>{
    panel.classList.add('hidden','foreign-class','ncu-players-hidden');header.classList.add('native-header');
    panel.style.setProperty('--ncu-players-left','31px','important');panel.style.setProperty('color','red','important');
    header.setAttribute('title','Original native hint');
  }});
  f.controller.update({visible:true,expanded:true,position:{x:300,y:400}});f.controller.destroy();
  assert.equal(f.panel.classList.contains('hidden'),true);assert.equal(f.panel.classList.contains('foreign-class'),true);
  assert.equal(f.panel.classList.contains('ncu-players-hidden'),true);assert.equal(f.panel.classList.contains('ncu-players-managed'),false);
  assert.equal(f.panel.style.getPropertyValue('--ncu-players-left'),'31px');
  assert.equal(f.panel.style.getPropertyPriority('--ncu-players-left'),'important');
  assert.equal(f.panel.style.getPropertyValue('--ncu-players-top'),'');
  assert.equal(f.panel.style.getPropertyValue('color'),'red');assert.equal(f.panel.style.getPropertyPriority('color'),'important');
  assert.equal(f.header.getAttribute('title'),'Original native hint');assert.equal(f.header.classList.contains('native-header'),true);
  assert.equal(f.header.classList.contains('ncu-player-drag-handle'),false);
});

test('destroy removes a newly introduced header hint and preserves a pre-existing drag-handle class',()=>{
  const f=fixture({beforeCreate:({header})=>header.classList.add('ncu-player-drag-handle')});f.controller.destroy();
  assert.equal(f.header.getAttribute('title'),null);assert.equal(f.header.classList.contains('ncu-player-drag-handle'),true);
});

test('duplicate binding reuses the controller and a destroyed node can be bound again',async()=>{
  const f=fixture();assert.equal(createPlayersPanel(f.options),f.controller);
  assert.equal(f.panel.children.filter(child=>child.dataset.ncuPlayersToggle==='true').length,1);
  emit(f.button,'click');await flush();assert.equal(f.saves.length,1);f.controller.destroy();
  const replacement=createPlayersPanel(f.options);replacement.update();assert.notEqual(replacement,f.controller);
  assert.equal(f.panel.children.filter(child=>child.dataset.ncuPlayersToggle==='true').length,1);replacement.destroy();
});

test('replacement DOM receives saved preferences while old listeners stay detached',async()=>{
  const first=fixture();first.controller.destroy();const second=fixture();
  second.controller.update({visible:false,expanded:true,position:{x:400,y:120}});
  assert.equal(second.panel.classList.contains('ncu-players-hidden'),true);
  assert.equal(second.panel.classList.contains('ncu-players-collapsed'),false);
  assert.equal(second.panel.style.getPropertyValue('--ncu-players-left'),'400px');
  emit(first.button,'click');await flush();assert.equal(first.saves.length,0);second.controller.destroy();
});

test('resize clamps the visible header to the new viewport without rewriting saved preferences',()=>{
  const f=fixture();f.controller.update({position:{x:1100,y:680}});f.viewport.width=500;f.viewport.height=300;
  emit(f.view,'resize');assert.equal(f.panel.style.getPropertyValue('--ncu-players-left'),'332px');
  assert.equal(f.panel.style.getPropertyValue('--ncu-players-top'),'256px');assert.equal(f.saves.length,0);f.controller.destroy();
});

test('reset shows the compact panel at its default local position',async()=>{
  const f=fixture();f.controller.update({visible:false,expanded:true,position:{x:500,y:200}});await f.controller.reset();
  assert.deepEqual(f.saves,[{visible:true,expanded:false,position:{}}]);
  assert.equal(f.panel.classList.contains('ncu-players-hidden'),false);assert.equal(f.panel.classList.contains('ncu-players-collapsed'),true);
  assert.equal(f.panel.style.getPropertyValue('--ncu-players-left'),'64px');
  assert.equal(f.panel.style.getPropertyValue('--ncu-players-top'),'674px');f.controller.destroy();
});

test('stale refresh cannot undo local disclosure while its setting save is pending',async()=>{
  let resolveSave;const f=fixture({onSave:()=>new Promise(resolve=>{resolveSave=resolve;})});
  emit(f.button,'click');f.controller.update({expanded:false});
  assert.equal(f.button.getAttribute('aria-expanded'),'true');resolveSave();await flush();
  f.controller.update({expanded:true});assert.equal(f.button.getAttribute('aria-expanded'),'true');f.controller.destroy();
});

test('an earlier completed save does not unlock a newer pending update of the same preference',async()=>{
  const resolvers=[];const f=fixture({onSave:()=>new Promise(resolve=>resolvers.push(resolve))});
  emit(f.button,'click');emit(f.button,'click');
  assert.equal(f.button.getAttribute('aria-expanded'),'false');
  resolvers[0]();await flush();f.controller.update({expanded:true});
  assert.equal(f.button.getAttribute('aria-expanded'),'false','the latest local collapse remains pending');
  resolvers[1]();await flush();f.controller.update({expanded:false});
  assert.equal(f.button.getAttribute('aria-expanded'),'false');f.controller.destroy();
});

test('save errors are reported without removing native content or event handlers',async()=>{
  const failure=new Error('settings unavailable');const f=fixture({onSave:()=>Promise.reject(failure)});
  emit(f.button,'click');await flush();assert.deepEqual(f.errors,[failure]);
  assert.equal(f.panel.children.includes(f.list),true);emit(f.header,'click',{detail:1});assert.equal(f.nativeClicks,1);f.controller.destroy();
});

test('a rejected save after destroy cannot emit a late error or layout callback',async()=>{
  let rejectSave;const f=fixture({onSave:()=>new Promise((resolve,reject)=>{rejectSave=reject;})});
  emit(f.button,'click');f.controller.destroy();const layouts=f.layouts;rejectSave(new Error('late rejection'));await flush();
  assert.equal(f.errors.length,0);assert.equal(f.layouts,layouts);
});
