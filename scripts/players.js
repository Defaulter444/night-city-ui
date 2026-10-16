const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(Math.max(value,min),Math.max(min,max));
const classes = ['ncu-players-managed','ncu-players-hidden','ncu-players-collapsed','ncu-players-dragging'];
const properties = ['--ncu-players-left','--ncu-players-top'];
const managedPanels = new WeakMap();

/** Local HUD coordinates only. Invalid saved data falls back to the bottom left. */
export function playerPanelPosition({width,height,panelWidth=160,panelHeight=36,position,spacious=true}={}) {
  width=Math.max(1,finite(width,1280));height=Math.max(1,finite(height,720));
  panelWidth=Math.max(1,finite(panelWidth,160));panelHeight=Math.max(1,finite(panelHeight,36));
  const margin=Math.min(8,width/4,height/4);
  return {
    x:Math.round(clamp(finite(position?.x,spacious?64:12),margin,width-panelWidth-margin)),
    y:Math.round(clamp(finite(position?.y,height-panelHeight-10),margin,height-panelHeight-margin)),
  };
}

/** Enhance the existing PlayerList without replacing its header, list or listeners. */
export function createPlayersPanel({panel,viewport=()=>({width:innerWidth,height:innerHeight}),onSave=()=>{},onLayout=()=>{},onError=()=>{}}) {
  const header=panel?.querySelector(':scope > h3');
  if(!header)return null;
  if(managedPanels.has(panel))return managedPanels.get(panel);
  const doc=panel.ownerDocument;
  const view=doc.defaultView;
  const events=new AbortController();
  const {signal}=events;
  const originalClasses=new Map(classes.map(name=>[name,panel.classList.contains(name)]));
  const originalProperties=new Map(properties.map(name=>[name,[panel.style.getPropertyValue(name),panel.style.getPropertyPriority(name)]]));
  const originalTitle=header.getAttribute('title');
  const originalHandle=header.classList.contains('ncu-player-drag-handle');
  const button=doc.createElement('button');
  button.type='button';button.className='ncu-players-toggle';button.dataset.ncuPlayersToggle='true';
  button.setAttribute('aria-controls','player-list');
  const icon=doc.createElement('i');icon.setAttribute('aria-hidden','true');button.append(icon);panel.append(button);
  header.classList.add('ncu-player-drag-handle');
  header.setAttribute('title','Перетащите заголовок. Щелчок показывает или скрывает отключившихся игроков.');
  let state={visible:true,expanded:false,position:{},spacious:true};
  let drag=null, suppressClick=false, destroyed=false;
  const pending=new Map();
  let saveRevision=0;

  function toggle(name,on) {
    if(panel.classList.contains(name)!==Boolean(on))panel.classList.toggle(name,Boolean(on));
  }
  function apply() {
    if(destroyed)return;
    toggle('ncu-players-managed',true);toggle('ncu-players-hidden',!state.visible);
    toggle('ncu-players-collapsed',!state.expanded);toggle('ncu-players-dragging',Boolean(drag?.moved));
    const label=state.expanded?'Свернуть панель игроков':'Развернуть панель игроков';
    button.setAttribute('aria-label',label);button.setAttribute('aria-expanded',String(state.expanded));button.title=label;
    icon.className=`fa-solid fa-chevron-${state.expanded?'down':'up'}`;
    const bounds=panel.getBoundingClientRect();
    const position=playerPanelPosition({...viewport(),panelWidth:bounds.width||160,panelHeight:bounds.height||36,position:drag?.position||state.position,spacious:state.spacious});
    for(const [name,value] of [['--ncu-players-left',position.x],['--ncu-players-top',position.y]]){
      const next=`${value}px`;if(panel.style.getPropertyValue(name)!==next)panel.style.setProperty(name,next);
    }
    return position;
  }
  async function commit(patch) {
    if(destroyed)return;
    const revision=++saveRevision;
    Object.assign(state,patch);for(const key of Object.keys(patch))pending.set(key,revision);apply();onLayout();
    try{await onSave(patch);}catch(error){if(!destroyed)onError(error);}
    finally{for(const key of Object.keys(patch))if(pending.get(key)===revision)pending.delete(key);if(!destroyed)onLayout();}
  }
  function finish(event,cancel=false) {
    if(!drag||event.pointerId!==drag.pointerId)return;
    const finished=drag;drag=null;
    try{if(header.hasPointerCapture?.(finished.pointerId))header.releasePointerCapture(finished.pointerId);}catch{}
    if(cancel){suppressClick=false;apply();return;}
    if(finished.moved){
      suppressClick=true;
      if(!destroyed&&panel.isConnected!==false)void commit({position:finished.position});
    }
    apply();
  }
  button.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();
    void commit({expanded:!state.expanded});
  },{signal});
  header.addEventListener('click',event=>{
    // A drag must not trigger Foundry's h3 offline-user toggle and rerender.
    if(suppressClick&&event.detail!==0){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}
  },{capture:true,signal});
  header.addEventListener('pointerdown',event=>{
    suppressClick=false;
    if(destroyed||event.button!==0||event.isPrimary===false)return;
    const interactive=event.target.closest?.('button,a,input,select,textarea,[contenteditable="true"],[role="button"]');
    if(interactive&&interactive!==header)return;
    const bounds=panel.getBoundingClientRect();
    drag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,left:bounds.left,top:bounds.top,moved:false,position:null};
  },{signal});
  view.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId||destroyed)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(!drag.moved&&Math.hypot(dx,dy)<5)return;
    if(!drag.moved){drag.moved=true;try{header.setPointerCapture?.(event.pointerId);}catch{}}
    const bounds=panel.getBoundingClientRect();
    drag.position=playerPanelPosition({...viewport(),panelWidth:bounds.width,panelHeight:bounds.height,position:{x:drag.left+dx,y:drag.top+dy},spacious:state.spacious});
    event.preventDefault();apply();
  },{signal});
  view.addEventListener('pointerup',event=>finish(event),{signal});
  view.addEventListener('pointercancel',event=>finish(event,true),{signal});
  view.addEventListener('blur',()=>{if(drag)finish({pointerId:drag.pointerId},true);},{signal});
  header.addEventListener('lostpointercapture',event=>finish(event,true),{signal});
  view.addEventListener('resize',apply,{signal});

  const controller={
    update({visible=true,expanded=false,position={},spacious=true}={}){
      if(destroyed)return;
      for(const [key,value] of Object.entries({visible:Boolean(visible),expanded:Boolean(expanded),position,spacious:Boolean(spacious)}))if(!pending.has(key))state[key]=value;
      apply();
    },
    reset:()=>commit({visible:true,expanded:false,position:{}}),
    destroy(){
      if(destroyed)return;destroyed=true;
      const activeDrag=drag;drag=null;events.abort();
      try{if(activeDrag&&header.hasPointerCapture?.(activeDrag.pointerId))header.releasePointerCapture(activeDrag.pointerId);}catch{}
      button.remove();
      for(const [name,wasPresent] of originalClasses)panel.classList.toggle(name,wasPresent);
      for(const [name,[value,priority]] of originalProperties){if(value)panel.style.setProperty(name,value,priority);else panel.style.removeProperty(name);}
      header.classList.toggle('ncu-player-drag-handle',originalHandle);
      if(originalTitle===null)header.removeAttribute('title');else header.setAttribute('title',originalTitle);
      managedPanels.delete(panel);
    },
  };
  managedPanels.set(panel,controller);
  return controller;
}
