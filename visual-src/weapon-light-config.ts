type FlashProfile={phase:'source'|'impact';duration:number;bright:number;dim:number;color:string;alpha:number;luminosity:number};
const gun:FlashProfile={phase:'source',duration:70,bright:1.3,dim:3,color:'#ffd29a',alpha:.35,luminosity:.65};
export function weaponLightProfile(weapon:string):FlashProfile|undefined {
 if(['pistol','smg','rifle','sniper'].includes(weapon))return gun;
 if(weapon==='shotgun')return {...gun,duration:140,bright:2,dim:4,alpha:.55,luminosity:.85};
 if(weapon==='grenade')return {phase:'impact',duration:220,bright:3,dim:6,color:'#ffc279',alpha:.6,luminosity:.85};
 if(weapon==='rocket')return {phase:'impact',duration:300,bright:4,dim:8,color:'#ffb86b',alpha:.7,luminosity:1};
 return undefined;
}


export const flashProfiles=[['gunfire','Выстрелы','pistol'],['shotgun','Дробовик','shotgun'],['grenade','Граната','grenade'],['rocket','Ракета','rocket']] as const;
export interface FlashCustomization {color:string;alpha:number;bright:number;dim:number;autoRadius?:boolean}
export type FlashSettings={matchAmmo:boolean;profiles:Record<string,FlashCustomization>};
declare global {interface SettingConfig {'night-city-ui.weaponLightSettings':FlashSettings;'night-city-ui.weaponLighting':boolean;'night-city-ui.weaponLightVision':boolean}}
const asRecord=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'?value as Record<string,unknown>:{};
const numeric=(value:unknown,fallback:number,min:number,max=Infinity)=>{const n=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
export function normalizeFlashSettings(raw:unknown,distance=2):FlashSettings {
 const input=asRecord(raw),values=asRecord(input.profiles),profiles:Record<string,FlashCustomization>={};
 for(const [id,,weapon] of flashProfiles){
  const base=weaponLightProfile(weapon)!,custom=asRecord(values[id]),bright=numeric(custom.bright,id==='grenade'?5:base.bright*distance,0);
  profiles[id]={color:typeof custom.color==='string'&&/^#[0-9a-f]{6}$/i.test(custom.color)?custom.color:base.color,
   alpha:numeric(custom.alpha,base.alpha,0,1),bright,dim:Math.max(bright,numeric(custom.dim,id==='grenade'?7:base.dim*distance,0)),
   ...(['grenade','rocket'].includes(id)?{autoRadius:custom.autoRadius!==false}:{})};
 }
 return {matchAmmo:input.matchAmmo===true,profiles};
}
export function currentFlashSettings():FlashSettings {
 return normalizeFlashSettings(game.settings!.get('night-city-ui','weaponLightSettings'),canvas.scene?.grid?.distance||2);
}
export function weaponLightConfig(weapon:string,ammoColor?:string,areaRadius?:number):FlashCustomization&{vision:boolean} {
 const settings=currentFlashSettings(),id=['shotgun','grenade','rocket'].includes(weapon)?weapon:'gunfire';
 const config={...settings.profiles[id]!,vision:game.settings!.get('night-city-ui','weaponLightVision')===true};
 if(['grenade','rocket'].includes(weapon)&&config.autoRadius){config.bright=areaRadius??5;config.dim=config.bright+2;}
 if(settings.matchAmmo&&ammoColor&&/^#[0-9a-f]{6}$/i.test(ammoColor))config.color=ammoColor;
 return config;
}

/** Combat Tools saves circle radius or square side length in canvas pixels. */
export function attackBlastRadius(flags:unknown):number|undefined {
 const area=asRecord(asRecord(asRecord(flags)['redline-combat']).aoe).area;
 const data=asRecord(area),length=Number(data.length),size=canvas.scene?.grid?.size,distance=canvas.scene?.grid?.distance;
 if(!(length>0)||!size||!distance)return;
 return length*(data.shape==='circle'?1:.5)*distance/size;
}
