import {DEFAULT_THEME,generatePalette,normalizeTheme,type CustomTheme} from './theme-palette.js';
export type ThemePreset={name:string;theme:CustomTheme};
export const PNEUMA_PRESETS:ThemePreset[] = [
  {name:'Pneuma — зелёный',theme:structuredClone(DEFAULT_THEME)},
  ...[{name:'Pneuma — бирюзовый',seed:'#64a9b6'},{name:'Pneuma — фиолетовый',seed:'#55475c'}].map(({name,seed})=>({name,theme:{...structuredClone(DEFAULT_THEME),seed,light:generatePalette(seed,'light'),dark:generatePalette(seed,'dark')}})),
];
export function normalizePersonalPresets(value:unknown):(ThemePreset|null)[] {
  const slots=Array.isArray(value)?value:[];
  return Array.from({length:3},(_,i)=>{
    const slot=slots[i];
    if (!slot||typeof slot!=='object'||typeof slot.name!=='string'||!slot.theme) return null;
    return {name:slot.name.trim().slice(0,32)||`Пресет ${i+1}`,theme:normalizeTheme(slot.theme)};
  });
}
