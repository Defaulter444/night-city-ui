const mounted=new Map<Element,{host:HTMLDivElement,soft:boolean,onResize?:()=>void}>();
let resize:ResizeObserver|undefined,mutation:MutationObserver|undefined,sidebar:HTMLElement|null=null,frame=0;
export function screenEffectBounds(){
 const width=innerWidth,element=document.getElementById('sidebar'),rect=element?.getBoundingClientRect();
 const expanded=!!element&&!element.classList.contains('collapsed')&&!!rect&&rect.width>60&&rect.right>=width-80;
 const visible=expanded?Math.max(0,Math.min(width,rect!.left)):width;
 return {visible,fade:expanded?Math.min(110,width-visible):0};
}
export function screenEffectWidth():number {const bounds=screenEffectBounds();return bounds.visible+bounds.fade;}
function refresh(){
 frame=0;
 const next=document.getElementById('sidebar');if(next!==sidebar){resize?.disconnect();sidebar=next;if(sidebar)resize?.observe(sidebar);}
 const bounds=screenEffectBounds();
 for(const {host,soft,onResize} of mounted.values()){
  const fade=soft?bounds.fade:0;
  host.style.width=`${bounds.visible+fade}px`;
  host.style.maskImage=fade?`linear-gradient(to right, #000 0px, #000 ${bounds.visible}px, transparent ${bounds.visible+fade}px)`:'none';
  onResize?.();
 }
}
function schedule(){if(!frame)frame=requestAnimationFrame(refresh);}
/** Shared play-area host. Soft effects can fade under a transparent sidebar;
 * distinct particles stay within the unobstructed map area. */
export function mountScreenEffect(layer:HTMLElement|SVGSVGElement,soft=true,onResize?:()=>void):void {
 const host=document.createElement('div');host.dataset.pvtScreenEffectArea='';
 Object.assign(host.style,{position:'fixed',left:'0',top:'0',height:'100vh',overflow:'hidden',pointerEvents:'none',zIndex:layer.style.zIndex||'1',containerType:'inline-size',transition:'width 160ms ease-out'});
 layer.style.position='absolute';layer.style.width='100%';
 host.append(layer);document.body.append(host);mounted.set(layer,{host,soft,onResize});
 if(mounted.size===1){
  resize=new ResizeObserver(schedule);
  mutation=new MutationObserver(records=>{
   // Ignore our own layout writes and animation nodes: they must not create
   // an observer/resize feedback loop.
   if(records.some(record=>record.type==='attributes'
    ? record.target===sidebar||!!sidebar&&record.target instanceof Element&&record.target.contains(sidebar)
    : [...Array.from(record.addedNodes),...Array.from(record.removedNodes)].some(node=>node===sidebar||node instanceof Element&&(node.id==='sidebar'||!!node.querySelector('#sidebar')))))schedule();
  });
  mutation.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']});window.addEventListener('resize',schedule);
 }
 refresh();
}
export function removeScreenEffect(layer:Element|undefined):void {
 if(!layer)return;
 const entry=mounted.get(layer);if(entry){entry.host.remove();mounted.delete(layer);}else layer.remove();
 if(!mounted.size){resize?.disconnect();mutation?.disconnect();resize=undefined;mutation=undefined;sidebar=null;window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);frame=0;}
}
