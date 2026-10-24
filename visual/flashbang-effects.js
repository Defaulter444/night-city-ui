import { frameRefresh, watchScreenTokenVisibility, tokenEffectsChanged } from './effect-refresh.js';
import { mountScreenEffect, removeScreenEffect } from './screen-effect-area.js';
const MODULE = 'night-city-ui';
export function flashbangState(actor) {
    if (!actor)
        return;
    const module = game.modules?.get('redline-combat');
    return module?.active ? module.api?.getFlashbangState?.(actor) : undefined;
}
export function registerFlashbangEffects() {
    let ready = false, layer, key, flash;
    const seen = new Set(), reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { flash?.getAnimations().forEach(animation => animation.cancel()); flash?.remove(); flash = undefined; layer?.getAnimations({ subtree: true }).forEach(animation => animation.cancel()); removeScreenEffect(layer); layer = undefined; key = undefined; };
    const update = () => {
        if (!ready)
            return;
        const selected = canvas.tokens?.controlled?.filter(token => token.actor?.isOwner && token.isVisible);
        const actor = selected?.length === 1 ? selected[0].actor : game.user?.character;
        const state = flashbangState(actor ?? undefined);
        const fresh = state && !seen.has(state.id) && Date.now() - state.created < 1800;
        if (state)
            seen.add(state.id);
        if (!state || document.hidden || !game.settings.get(MODULE, 'screenEffects')) {
            stop();
            return;
        }
        if (key === state.id && layer)
            return;
        stop();
        key = state.id;
        layer = document.createElement('div');
        layer.id = 'pneuma-flashbang-overlay';
        layer.setAttribute('aria-hidden', 'true');
        Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1', background: 'radial-gradient(ellipse at center, transparent 48%, #ffffff44 72%, #ffffffbb 100%)' });
        mountScreenEffect(layer, true);
        if (fresh && !reduced.matches) {
            flash = document.createElement('div');
            const pulse = flash;
            Object.assign(pulse.style, { position: 'fixed', inset: '0', background: 'white', pointerEvents: 'none', zIndex: '1' });
            document.body.append(pulse);
            const animation = pulse.animate([{ opacity: 1 }, { opacity: .8, offset: .15 }, { opacity: 0 }], { duration: 1100, easing: 'ease-out' });
            animation.onfinish = () => { pulse.remove(); if (flash === pulse)
                flash = undefined; };
        }
    };
    const refresh = frameRefresh(update), sync = refresh.schedule;
    Hooks.on('canvasTearDown', refresh.cancel);
    window.addEventListener('pagehide', refresh.cancel);
    watchScreenTokenVisibility(sync);
    Hooks.once('ready', () => { ready = true; sync(); });
    for (const hook of ['canvasReady', 'controlToken', 'deleteToken', 'updateActor', 'updateCombat', 'deleteCombat', 'updateWorldTime', 'updateUser', 'pneumaVisualToolsScreenEffectsChanged', 'pneumaCombatToolsFlashbangChanged'])
        Hooks.on(hook, sync);
    Hooks.on('updateToken', (_doc, changes) => { if (tokenEffectsChanged(changes))
        sync(); });
    Hooks.on('canvasTearDown', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden) {
        refresh.cancel();
        update();
    }
    else
        sync(); });
    window.addEventListener('pagehide', stop);
    reduced.addEventListener('change', () => { stop(); sync(); });
}
