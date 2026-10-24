const previews=new Map<Token,{kind:string;created:number}>();
export function tokenPreview(token:Token){return previews.get(token);}
export function anyTokenPreview():boolean{return previews.size>0;}
export function setTokenPreview(token:Token|undefined,kind?:string):void {
 previews.clear();if(token&&kind)previews.set(token,{kind,created:Date.now()});Hooks.callAll('pneumaVisualToolsPreviewChanged');
}
