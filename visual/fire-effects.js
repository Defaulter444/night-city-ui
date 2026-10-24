import { frameRefresh, watchScreenTokenVisibility, tokenEffectsChanged } from './effect-refresh.js';
import { createFlameOverlay } from './fire-overlay.js';
import { burningStrength } from './fire-status.js';
const MODULE = 'night-city-ui';
export function registerFireEffects() {
    const flames = createFlameOverlay();
    let ready = false;
    const update = () => {
        if (!ready)
            return;
        if (document.hidden || !game.settings.get(MODULE, 'screenEffects')) {
            flames.stop();
            return;
        }
        const selected = canvas.tokens?.controlled?.filter(token => token.actor?.isOwner && token.isVisible);
        const actor = selected?.length === 1 ? selected[0].actor : game.user?.character;
        const strength = burningStrength(actor ?? undefined);
        if (strength)
            flames.start(strength);
        else
            flames.stop();
    };
    const refresh = frameRefresh(update), sync = refresh.schedule;
    Hooks.on('canvasTearDown', refresh.cancel);
    window.addEventListener('pagehide', refresh.cancel);
    Hooks.on('pneumaVisualToolsScreenEffectsChanged', sync);
    watchScreenTokenVisibility(sync);
    Hooks.once('ready', () => { ready = true; sync(); });
    for (const hook of ['controlToken', 'deleteToken', 'updateActor', 'createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect', 'updateUser', 'canvasReady'])
        Hooks.on(hook, sync);
    Hooks.on('updateToken', (_doc, changes) => { if (tokenEffectsChanged(changes))
        sync(); });
    Hooks.on('canvasTearDown', () => flames.stop());
    document.addEventListener('visibilitychange', () => { if (document.hidden) {
        refresh.cancel();
        update();
    }
    else
        sync(); });
    window.addEventListener('pagehide', () => flames.stop());
}
