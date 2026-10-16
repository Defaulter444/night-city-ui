import test from 'node:test';
import assert from 'node:assert/strict';
import {placePopover, createPopover} from '../scripts/popover.js';

test('More opens immediately below its button, not the far corner of a wide bar', () => {
  const position = placePopover({anchor:{left:768.5,top:2.5,bottom:44.5},width:330,height:510,viewportWidth:1280,viewportHeight:720});
  assert.equal(position.left,768.5);
  assert.equal(position.top,50.5);
  assert.equal(position.placement,'below');
});
test('a menu beside the right edge shifts only enough to stay on screen', () => {
  const position = placePopover({anchor:{left:1220,top:8,bottom:48},width:330,height:200,viewportWidth:1280,viewportHeight:720});
  assert.equal(position.left,942);
  assert.equal(position.top,54);
});
test('a low toolbar opens its menu above the button when necessary', () => {
  const position = placePopover({anchor:{left:300,top:640,bottom:680},width:330,height:300,viewportWidth:1280,viewportHeight:720});
  assert.equal(position.placement,'above');
  assert.equal(position.top,334);
  assert.equal(position.top+300+6,640);
});
test('long menus use scrollable space instead of extending below the viewport', () => {
  const position = placePopover({anchor:{left:100,top:4,bottom:48},width:330,height:900,viewportWidth:800,viewportHeight:600});
  assert.equal(position.top,54);
  assert.equal(position.maxHeight,538);
  assert.equal(position.top+position.maxHeight,592);
});
test('small viewports cap panel width and keep all returned bounds nonnegative', () => {
  for(const [viewportWidth,viewportHeight] of [[320,240],[100,80],[14,14],[0,0]]) {
    const position = placePopover({anchor:{left:768,top:2,bottom:44},width:330,height:500,viewportWidth,viewportHeight});
    for(const key of ['left','top','maxWidth','maxHeight'])assert.ok(position[key]>=0,`${key}: ${position[key]}`);
    assert.ok(position.left<=viewportWidth);
    assert.ok(position.top<=viewportHeight);
    assert.ok(position.left+Math.min(330,position.maxWidth)<=viewportWidth);
    assert.ok(position.top+Math.min(500,position.maxHeight)<=viewportHeight);
  }
});
test('coordinates follow viewport rectangles after scrolling without adding page offsets', () => {
  const options = {width:290,height:70,viewportWidth:1000,viewportHeight:700};
  const before = placePopover({...options,anchor:{left:430,top:10,bottom:48}});
  const after = placePopover({...options,anchor:{left:180,top:10,bottom:48}});
  assert.equal(before.left-after.left,250);
  assert.equal(before.top,after.top);
});

// Small event/geometry doubles exercise the disclosure controller, not a renderer.
function emit(node, type, values = {}, bubble = false) {
  const event = new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries({target:node,...values}))Object.defineProperty(event,key,{value,configurable:true});
  for(let current=node;current;current=bubble?current.parent:null) {
    current.dispatchEvent(event);
    if(event.cancelBubble)break;
  }
  return event;
}
class Element extends EventTarget {
  constructor(doc, tag='div', bounds={left:0,top:0,width:100,height:40}) {
    super();this.doc=doc;this.tag=tag;this.bounds=bounds;this.style={};this.attributes=new Map();this.children=[];this.hidden=false;
  }
  append(child){child.parent=this;this.children.push(child);}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name);}
  querySelectorAll(){return this.children.filter(child=>child.tag==='button'&&!child.hidden&&!child.disabled);}
  querySelector(){return this.querySelectorAll().find(child=>child.getAttribute('aria-disabled')!=='true')||null;}
  getBoundingClientRect(){
    const width=Math.min(this.bounds.width,parseFloat(this.style.maxWidth??Infinity));
    const height=Math.min(this.bounds.height,parseFloat(this.style.maxHeight??Infinity));
    return {...this.bounds,width,height,bottom:this.bounds.top+height,right:this.bounds.left+width};
  }
  get scrollHeight(){return this.bounds.height;}
  get offsetHeight(){return this.getBoundingClientRect().height;}
  get clientHeight(){return Math.max(0,this.offsetHeight-2);}
  focus(){
    const previous=this.doc.activeElement;this.doc.activeElement=this;
    if(previous&&previous!==this)emit(previous,'focusout',{relatedTarget:this},true);
    if(previous!==this)emit(this,'focusin',{relatedTarget:previous},true);
  }
}
function fixture(options={}) {
  const doc=new EventTarget();doc.activeElement=null;
  const view=new EventTarget();view.innerWidth=1280;view.innerHeight=720;
  const anchor=new Element(doc,'div',{left:500,top:10,width:100,height:38});
  const main=new Element(doc,'button'),toggle=new Element(doc,'button');anchor.append(main);anchor.append(toggle);
  const panel=new Element(doc,'section',{left:0,top:0,width:330,height:500});
  const item=new Element(doc,'button');panel.append(item);
  const next=new Element(doc,'button');
  let counter=0;const pending=new Map();
  const timers={setTimeout(fn){const id=++counter;pending.set(id,fn);return id;},clearTimeout(id){pending.delete(id);}};
  const controller=createPopover({anchor,toggle,panel,ownerDocument:doc,view,timers,nextFocus:()=>next,...options});
  return {doc,view,anchor,main,toggle,panel,item,next,controller,pending,
    flush(){for(const [id,fn] of [...pending]){pending.delete(id);fn();}}};
}
test('mouse click toggles More with synchronized accessible state', () => {
  const f=fixture();
  emit(f.toggle,'click',{detail:1});
  assert.equal(f.panel.hidden,false);assert.equal(f.toggle.getAttribute('aria-expanded'),'true');
  assert.equal(f.panel.style.left,'500px');assert.equal(f.panel.style.top,'54px');
  emit(f.toggle,'click',{detail:1});
  assert.equal(f.panel.hidden,true);assert.equal(f.toggle.getAttribute('aria-expanded'),'false');
  f.controller.destroy();
});
test('keyboard opens and focuses the first available action', () => {
  const f=fixture();
  f.item.setAttribute('aria-disabled','true');const enabled=new Element(f.doc,'button');f.panel.append(enabled);
  emit(f.toggle,'click',{detail:0});
  assert.equal(f.doc.activeElement,enabled);
  const escape=emit(f.doc,'keydown',{key:'Escape'});
  assert.equal(escape.defaultPrevented,true);assert.equal(f.panel.hidden,true);assert.equal(f.doc.activeElement,f.toggle);
  f.controller.destroy();
});
test('Agent hover remains open across the gap and while the panel is hovered', () => {
  const f=fixture({hover:true});
  emit(f.anchor,'pointerenter',{pointerType:'mouse'});assert.equal(f.panel.hidden,false);
  emit(f.anchor,'pointerleave',{pointerType:'mouse'});assert.equal(f.pending.size,1);
  emit(f.panel,'pointerenter',{pointerType:'mouse'});f.flush();assert.equal(f.panel.hidden,false);
  emit(f.panel,'pointerleave',{pointerType:'mouse'});f.flush();assert.equal(f.panel.hidden,true);
  f.controller.destroy();
});
test('keyboard focus exposes Agent tools and Enter on its arrow focuses the action', () => {
  const f=fixture({hover:true});
  f.main.focus();assert.equal(f.panel.hidden,false);assert.equal(f.doc.activeElement,f.main);
  f.toggle.focus();emit(f.toggle,'click',{detail:0});
  assert.equal(f.panel.hidden,false);assert.equal(f.doc.activeElement,f.item);
  emit(f.doc,'keydown',{key:'Escape'});
  assert.equal(f.panel.hidden,true);assert.equal(f.doc.activeElement,f.toggle);
  f.controller.destroy();
});
test('a touch tap on the disclosure arrow opens on its first tap', () => {
  const f=fixture({hover:true});
  emit(f.anchor,'pointerenter',{pointerType:'touch'});assert.equal(f.panel.hidden,true);
  f.toggle.focus();assert.equal(f.panel.hidden,true);
  emit(f.toggle,'click',{detail:1});assert.equal(f.panel.hidden,false);
  emit(f.toggle,'click',{detail:1});assert.equal(f.panel.hidden,true);
  f.controller.destroy();
});
test('ArrowDown opens Agent tools and Tab continues along the toolbar', () => {
  const f=fixture({hover:true});
  const down=emit(f.anchor,'keydown',{key:'ArrowDown'});
  assert.equal(down.defaultPrevented,true);assert.equal(f.doc.activeElement,f.item);
  const tab=emit(f.panel,'keydown',{key:'Tab',target:f.item,shiftKey:false});
  assert.equal(tab.defaultPrevented,true);assert.equal(f.doc.activeElement,f.next);assert.equal(f.panel.hidden,true);
  f.controller.setOpen(true,{focus:true});
  emit(f.panel,'keydown',{key:'Tab',target:f.item,shiftKey:true});
  assert.equal(f.doc.activeElement,f.toggle);assert.equal(f.panel.hidden,true);
  f.controller.destroy();
});
test('Agent panel remains available while focused after the pointer leaves', () => {
  const f=fixture({hover:true});
  f.controller.setOpen(true,{focus:true});
  emit(f.panel,'pointerleave',{pointerType:'mouse'});f.flush();assert.equal(f.panel.hidden,false);
  f.controller.destroy();
});
test('focus moving outside dismisses the Agent panel', async () => {
  const f=fixture({hover:true});f.controller.setOpen(true,{focus:true});f.next.focus();
  await Promise.resolve();assert.equal(f.panel.hidden,true);f.controller.destroy();
});
test('outside pointer dismissal does not move focus back from an application', () => {
  const f=fixture({hover:true});f.controller.setOpen(true);f.next.focus();
  emit(f.doc,'pointerdown',{target:f.next});
  assert.equal(f.panel.hidden,true);assert.equal(f.doc.activeElement,f.next);f.controller.destroy();
});
test('GM permission is checked for every opening and revoked access closes a visible panel', () => {
  let gm=false;const f=fixture({hover:true,canOpen:()=>gm});
  emit(f.anchor,'pointerenter',{pointerType:'mouse'});emit(f.toggle,'click',{detail:0});
  assert.equal(f.panel.hidden,true);assert.equal(f.doc.activeElement,null);
  gm=true;f.controller.setOpen(true);assert.equal(f.panel.hidden,false);
  gm=false;f.controller.position();assert.equal(f.panel.hidden,true);
  assert.equal(f.controller.setOpen(true,{focus:true}),false);assert.equal(f.doc.activeElement,null);
  f.controller.destroy();
});
test('open panels follow horizontal toolbar scrolling and viewport resizing', () => {
  const f=fixture();f.controller.setOpen(true);
  f.anchor.bounds.left=150;emit(f.doc,'scroll');assert.equal(f.panel.style.left,'150px');
  f.view.innerWidth=400;f.view.innerHeight=300;emit(f.view,'resize');
  assert.equal(f.panel.style.left,'62px');assert.equal(f.panel.style.maxHeight,'238px');
  f.view.innerHeight=720;emit(f.view,'resize');assert.equal(f.panel.style.maxHeight,'658px');
  f.controller.destroy();
});
test('scrolling a long menu never expands it or jumps away from its last action', () => {
  const f=fixture();f.view.innerHeight=300;f.controller.setOpen(true);
  const maxHeight=f.panel.style.maxHeight,writes=[];
  f.panel.style=new Proxy(f.panel.style,{set(target,key,value){writes.push([key,value]);target[key]=value;return true;}});
  emit(f.doc,'scroll',{target:f.panel});assert.deepEqual(writes,[]);
  f.controller.position();assert.deepEqual(writes,[]);assert.equal(f.panel.style.maxHeight,maxHeight);
  f.view.innerHeight=350;emit(f.view,'resize');
  assert.deepEqual(writes,[['maxHeight','288px']]);f.controller.destroy();
});
test('opening one panel can close another without stealing focus', () => {
  const more=fixture(),agent=fixture({hover:true,onOpen:()=>more.controller.close()});
  more.controller.setOpen(true);agent.controller.setOpen(true);
  assert.equal(more.panel.hidden,true);assert.equal(agent.panel.hidden,false);
  assert.equal(agent.doc.activeElement,null);more.controller.destroy();agent.controller.destroy();
});
test('abort clears pending hover work and removes all interactive listeners', () => {
  const lifecycle=new AbortController(),f=fixture({hover:true,signal:lifecycle.signal});
  emit(f.anchor,'pointerenter',{pointerType:'mouse'});emit(f.anchor,'pointerleave',{pointerType:'mouse'});
  assert.equal(f.pending.size,1);lifecycle.abort();assert.equal(f.pending.size,0);assert.equal(f.panel.hidden,true);
  emit(f.toggle,'click',{detail:1});emit(f.anchor,'pointerenter',{pointerType:'mouse'});f.flush();
  assert.equal(f.panel.hidden,true);assert.equal(f.controller.setOpen(true),false);
});
