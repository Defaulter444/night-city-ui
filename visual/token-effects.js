import { frameRefresh, tokenEffectsChanged } from './effect-refresh.js';
import { createConditionToken } from './condition-renderers.js';
import { hasBlueGlass, hasPoisonExposure, hasSmash } from './substance-effects.js';
import { createTokenSmashOverlay } from './smash-overlay.js';
import { burningStrength } from './fire-status.js';
import { createTokenPoisonFog } from './token-poison-fog.js';
import { createTokenEffectMask } from './token-effect-mask.js';
import { hasElectricalShock, hasEMP } from './electrical-effects.js';
import { flashbangState } from './flashbang-effects.js';
import { createTokenDazzle } from './token-dazzle.js';
import { actorPatternKinds, patternKinds } from './remaining-effects.js';
import { createPatternToken } from './remaining-renderers.js';
import { tokenPreview, anyTokenPreview } from './effect-preview-state.js';
import { createTokenFireParticles } from './token-fire-particles.js';
import { createTokenBlueGlassCloud } from './blue-glass-cloud.js';
const MODULE = 'night-city-ui';
export function tokenEffectKinds(actor) {
    if (!actor)
        return [];
    const kinds = [];
    kinds.push(...actorPatternKinds(actor));
    if (hasPoisonExposure(actor.uuid))
        kinds.push('poison');
    if (hasBlueGlass(actor))
        kinds.push('blueGlass');
    if (hasSmash(actor))
        kinds.push('smash');
    if (hasElectricalShock(actor))
        kinds.push('electrical');
    if (hasEMP(actor))
        kinds.push('emp');
    const dazzle = flashbangState(actor);
    if (dazzle)
        kinds.push(`dazzle:${dazzle.id}`);
    const combat = game.modules?.get('redline-combat');
    if (combat?.active && combat.api?.hasNeuralIntrusion?.(actor))
        kinds.push('intrusion');
    const fire = burningStrength(actor);
    if (fire)
        kinds.push(`fire${fire}`);
    return kinds;
}
export function registerTokenEffects() {
    const layers = new Map();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let ready = false, ticking = false, elapsed = 0;
    function remove(token) { const entry = layers.get(token); if (entry) {
        entry.emp?.destroy();
        entry.blueGlass?.destroy();
        entry.fire?.destroy();
        entry.fog?.destroy();
        entry.smash?.destroy();
        entry.dazzle?.destroy();
        entry.patterns?.forEach(pattern => pattern.destroy());
        entry.mask.destroy();
        token.removeChild(entry.graphic);
        entry.graphic.destroy();
        layers.delete(token);
    } }
    function stop() { for (const token of layers.keys())
        remove(token); if (ticking) {
        canvas.app?.ticker.remove(tick);
        ticking = false;
    } }
    function paint(token, entry) {
        const g = entry.graphic, w = token.w, h = token.h, r = Math.min(w, h), time = reduced.matches ? 0 : elapsed;
        entry.width = w;
        entry.height = h;
        g.clear();
        if (entry.kinds.includes('emp')) {
            if (!entry.emp) {
                entry.emp = createConditionToken('emp');
                g.addChild(entry.emp.container);
            }
            entry.emp.update(w, h, time, entry.phase, reduced.matches);
        }
        else if (entry.emp) {
            entry.emp.destroy();
            entry.emp = undefined;
        }
        if (entry.kinds.includes('blueGlass')) {
            if (!entry.blueGlass) {
                entry.blueGlass = createTokenBlueGlassCloud();
                g.addChild(entry.blueGlass.container);
            }
            entry.blueGlass.update(w, h, time, reduced.matches);
        }
        else if (entry.blueGlass) {
            entry.blueGlass.destroy();
            entry.blueGlass = undefined;
        }
        const fireKind = entry.kinds.find(kind => /^fire[123]$/.test(kind));
        if (fireKind) {
            if (!entry.fire) {
                entry.fire = createTokenFireParticles();
                g.addChild(entry.fire.container);
            }
            entry.fire.update(w, h, time, Number(fireKind.slice(4)), reduced.matches);
        }
        else if (entry.fire) {
            entry.fire.destroy();
            entry.fire = undefined;
        }
        const patterns = entry.patternKinds;
        entry.patterns ??= new Map();
        for (const [kind, pattern] of entry.patterns)
            if (!patterns.has(kind)) {
                pattern.destroy();
                entry.patterns.delete(kind);
            }
        for (const kind of patterns) {
            let pattern = entry.patterns.get(kind);
            if (!pattern) {
                pattern = createPatternToken(kind);
                entry.patterns.set(kind, pattern);
                g.addChild(pattern.container);
            }
            pattern.update(w, h, time, entry.phase, reduced.matches);
        }
        if (entry.kinds.includes('poison')) {
            if (!entry.fog) {
                entry.fog = createTokenPoisonFog();
                g.addChild(entry.fog.container);
            }
            entry.fog.update(w, h, time, entry.phase, reduced.matches);
        }
        else if (entry.fog) {
            entry.fog.destroy();
            entry.fog = undefined;
        }
        if (entry.kinds.includes('smash')) {
            if (!entry.smash) {
                entry.smash = createTokenSmashOverlay();
                g.addChild(entry.smash.container);
            }
            entry.smash.update(w, h, time, entry.phase, reduced.matches);
        }
        else if (entry.smash) {
            entry.smash.destroy();
            entry.smash = undefined;
        }
        const dazzle = entry.dazzleCreated === undefined ? undefined : { created: entry.dazzleCreated };
        if (dazzle) {
            if (!entry.dazzle) {
                entry.dazzle = createTokenDazzle();
                g.addChild(entry.dazzle.container);
            }
            entry.dazzle.update(w, h, reduced.matches ? 0 : Math.max(0, 1 - (Date.now() - dazzle.created) / 1100));
        }
        else if (entry.dazzle) {
            entry.dazzle.destroy();
            entry.dazzle = undefined;
        }
        for (const kind of entry.kinds) {
            if (patterns.has(kind))
                continue;
            if (kind === 'poison' || kind === 'smash' || kind === 'blueGlass' || kind.startsWith('fire'))
                continue;
            if (kind.startsWith('dazzle:')) {
                continue;
            }
            if (kind === 'electrical') {
                if (reduced.matches)
                    continue;
                const cycle = (time + entry.phase) % 2;
                if (cycle > .55)
                    continue;
                g.lineStyle(Math.max(1, r * .014), 0xb5f3ff, Math.sin(cycle / .55 * Math.PI) * .9);
                const seed = Math.floor(time / 2) + entry.phase;
                g.moveTo(w * .15, h * .3);
                for (let i = 1; i < 8; i++)
                    g.lineTo(w * (.15 + i * .1), h * (.5 + Math.sin(i * 7.3 + seed) * .25));
                continue;
            }
            if (kind === 'emp')
                continue;
            if (kind === 'intrusion') {
                if (reduced.matches)
                    continue;
                const cycle = (time + entry.phase) % 7;
                if (cycle > .65)
                    continue;
                for (let i = 0; i < 5; i++) {
                    const y = h * ((i * .173 + cycle * .13 + entry.phase / 8) % 1), x = w * (.08 + Math.sin(i * 3 + Math.floor(time * 8)) * .06);
                    g.lineStyle(0);
                    g.beginFill(i % 2 ? 0x56e1ef : 0xdc69fa, .22);
                    g.drawRect(x, y, w * .75, Math.max(1, h * .025));
                    g.endFill();
                }
                continue;
            }
        }
    }
    // Condition state is independent of movement and retained while a token is hidden.
    const states = new Map();
    const pending = new Set();
    let all = true;
    const batch = frameRefresh(flush);
    function queue(token) { if (token)
        pending.add(token);
    else
        all = true; batch.schedule(); }
    function sync() { queue(); }
    function tick(delta) {
        elapsed += Math.min(delta, 3) / 60;
        for (const [token, entry] of layers) {
            entry.graphic.visible = token.isVisible;
            if (token.isVisible && token.renderable)
                paint(token, entry);
        }
    }
    function reconcile(token) {
        if (token.destroyed)
            return;
        const preview = tokenPreview(token), state = states.get(token);
        const key = preview?.kind ?? state?.key ?? '';
        if (!key) {
            remove(token);
            return;
        }
        let entry = layers.get(token);
        if (!entry) {
            if (!token.isVisible)
                return;
            const graphic = new PIXI.Graphics();
            graphic.eventMode = 'none';
            token.addChild(graphic);
            entry = { graphic, key, kinds: [], patternKinds: new Set(), phase: Math.random() * Math.PI * 2, mask: createTokenEffectMask(token, graphic) };
            layers.set(token, entry);
        }
        entry.key = key;
        entry.kinds = key.split(',');
        entry.patternKinds = new Set(entry.kinds.filter(kind => patternKinds.includes(kind)));
        entry.dazzleCreated = preview ? (preview.kind.startsWith('dazzle:') ? preview.created : undefined) : state?.dazzleCreated;
        entry.graphic.visible = token.isVisible;
        if (token.isVisible)
            paint(token, entry);
    }
    function tickerState() {
        const animate = layers.size > 0 && !reduced.matches;
        if (animate && !ticking) {
            canvas.app?.ticker.add(tick);
            ticking = true;
        }
        if (!animate && ticking) {
            canvas.app?.ticker.remove(tick);
            ticking = false;
        }
    }
    function flush() {
        if (!ready)
            return;
        if (document.hidden || (!game.settings.get(MODULE, 'tokenEffects') && !anyTokenPreview()) || !canvas.ready) {
            stop();
            states.clear();
            pending.clear();
            all = true;
            return;
        }
        const tokens = all ? canvas.tokens?.placeables ?? [] : [...pending];
        if (all) {
            const live = new Set(tokens);
            for (const token of states.keys())
                if (!live.has(token)) {
                    states.delete(token);
                    remove(token);
                }
        }
        pending.clear();
        all = false;
        const actors = new Map();
        for (const token of tokens) {
            if (token.destroyed || token.isPreview)
                continue;
            const actor = token.actor;
            let state = actor ? actors.get(actor) : undefined;
            if (!state) {
                state = { key: game.settings.get(MODULE, 'tokenEffects') ? tokenEffectKinds(actor ?? undefined).join(',') : '', dazzleCreated: flashbangState(actor ?? undefined)?.created };
                if (actor)
                    actors.set(actor, state);
            }
            states.set(token, state);
            reconcile(token);
        }
        tickerState();
    }
    function actorChanged(doc) {
        let parent = doc;
        while (parent && parent.documentName !== 'Actor')
            parent = parent.parent;
        if (!parent)
            return;
        for (const token of canvas.tokens?.placeables ?? [])
            if (token.actor?.uuid === parent.uuid)
                queue(token);
    }
    game.settings.register(MODULE, 'tokenEffects', { name: 'Эффекты на токенах', hint: 'Наложения на токены карты: яд, Blue Glass, Smash, горение и обнаруженное нейровторжение; ЭМИ — по штатным состояниям ЭМИ или отключениям из боевых инструментов REDLINE; электрошок ждёт игровой интеграции. Те же условия и длительность, что у эффектов на экран, но включаются отдельно. Только видимые токены; при «уменьшить движение» наложения неподвижны. Локальная настройка.', scope: 'client', config: true, type: Boolean, default: true, onChange: sync });
    Hooks.once('ready', () => { ready = true; sync(); });
    Hooks.on('pneumaVisualToolsPreviewChanged', sync);
    for (const hook of ['canvasReady', 'updateUser', 'updateWorldTime', 'updateCombat', 'deleteCombat', 'pneumaCombatToolsFlashbangChanged'])
        Hooks.on(hook, sync);
    for (const hook of ['pneumaVisualToolsExposureChanged', 'pneumaVisualToolsElectricalChanged', 'pneumaCombatToolsNeuralIntrusionChanged', 'pneumaVisualToolsPatternsChanged'])
        Hooks.on(hook, (uuid) => { if (uuid) {
            for (const token of canvas.tokens?.placeables ?? [])
                if (token.actor?.uuid === uuid)
                    queue(token);
        }
        else
            sync(); });
    for (const hook of ['updateActor', 'createItem', 'updateItem', 'deleteItem', 'createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect'])
        Hooks.on(hook, actorChanged);
    Hooks.on('drawToken', (token) => queue(token));
    Hooks.on('updateToken', (doc, changes) => { if (doc.object && tokenEffectsChanged(changes))
        queue(doc.object); });
    Hooks.on('refreshToken', (token) => {
        // Attached graphics and their render-time mask already follow position/rotation.
        const entry = layers.get(token);
        if (entry) {
            entry.graphic.visible = token.isVisible;
            if (token.isVisible && (entry.width !== token.w || entry.height !== token.h))
                paint(token, entry);
        }
        else if (token.isVisible && states.get(token)?.key) {
            reconcile(token);
            tickerState();
        }
    });
    Hooks.on('destroyToken', (token) => { pending.delete(token); states.delete(token); remove(token); tickerState(); });
    Hooks.on('deleteToken', (doc) => { if (doc.object) {
        pending.delete(doc.object);
        states.delete(doc.object);
        remove(doc.object);
        tickerState();
    } });
    Hooks.on('canvasTearDown', () => { batch.cancel(); pending.clear(); states.clear(); all = true; stop(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) {
        batch.cancel();
        stop();
    }
    else
        sync(); });
    window.addEventListener('pagehide', () => { batch.cancel(); stop(); });
    reduced.addEventListener('change', sync);
}
