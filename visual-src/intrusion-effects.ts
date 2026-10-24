import {createIntrusionGlitches} from "./neural-glitch.js";
const MODULE = "night-city-ui";
interface CombatAPI {getNeuralIntrusionActor?: () => string | undefined}
export function registerIntrusionEffects(): void {
  const state = () => {
    if (!game.settings!.get(MODULE,"screenEffects")) return;
    const combat = game.modules!.get("redline-combat");
    if (!combat?.active) return;
    return (combat as unknown as {api?:CombatAPI}).api?.getNeuralIntrusionActor?.();
  };
  const glitches = createIntrusionGlitches(state);
  Hooks.on("pneumaVisualToolsScreenEffectsChanged",()=>glitches.sync());
  Hooks.once("ready",()=>glitches.sync());
  Hooks.on("pneumaCombatToolsNeuralIntrusionChanged",()=>glitches.sync());
  Hooks.on("canvasReady",()=>glitches.sync());
  Hooks.on("canvasTearDown",()=>glitches.stop());
}
