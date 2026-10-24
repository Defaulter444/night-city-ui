/** Position and render-only updates do not change actor conditions. Unknown fields invalidate. */
export function tokenEffectsChanged(changes) {
    const visual = new Set(['x', 'y', 'elevation', 'rotation', 'width', 'height', 'texture', 'sort', 'locked', 'lockRotation', 'name', 'alpha', '_regions']);
    const ignores = ['flags.redline-combat.movement', 'flags.redline-combat.aoeEscape', 'flags.pneuma-scenetools.vehicleFootprint'];
    const meaningful = (value, prefix = '') => Object.entries(value).some(([key, entry]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (visual.has(path.split('.')[0]) || ignores.some(ignore => path === ignore || path.startsWith(ignore + '.')))
            return false;
        if (entry && typeof entry === 'object' && !Array.isArray(entry))
            return meaningful(entry, path);
        return true;
    });
    return meaningful(changes);
}
/** Publish only actors whose held condition state actually changed. */
export function conditionPublisher(hook) {
    let previous = new Map();
    return (entries) => {
        const next = new Map(Array.from(entries, ([uuid, state]) => [uuid, JSON.stringify(state)]));
        for (const uuid of new Set([...previous.keys(), ...next.keys()]))
            if (previous.get(uuid) !== next.get(uuid))
                Hooks.callAll(hook, uuid);
        previous = next;
    };
}
/** Coalesce document bursts while retaining synchronous condition bookkeeping. */
export function frameRefresh(work) {
    let frame = 0;
    const schedule = () => { if (!frame)
        frame = requestAnimationFrame(() => { frame = 0; work(); }); };
    const cancel = () => { if (frame)
        cancelAnimationFrame(frame); frame = 0; };
    return { schedule, cancel };
}
/** Screen effects depend on selected-token visibility, not its position. */
export function watchScreenTokenVisibility(sync) {
    const visible = new WeakMap(), batch = frameRefresh(sync);
    Hooks.on('refreshToken', (token) => {
        if (!token.controlled)
            return;
        const previous = visible.get(token);
        visible.set(token, token.isVisible);
        if (previous !== token.isVisible)
            batch.schedule();
    });
    Hooks.on('canvasTearDown', batch.cancel);
}
/** Batch actor hydration without visiting every scene actor for a document edit. */
export function actorRefreshCandidates() {
    let full = true;
    const dirty = new Map();
    return {
        all: () => { full = true; },
        mark: (document) => {
            if (!document) {
                full = true;
                return;
            }
            let current = document;
            while (current) {
                const doc = current;
                if (doc.actor) {
                    dirty.set(doc.actor.uuid, doc.actor);
                    return;
                }
                if (doc.documentName === 'Actor' || doc.uuid && /(?:^|\.)Actor\.[^.]+$/.test(doc.uuid)) {
                    dirty.set(doc.uuid, current);
                    return;
                }
                current = doc.parent;
            }
        },
        take: (selected) => {
            const actors = new Map(dirty);
            dirty.clear();
            if (full) {
                for (const token of canvas.tokens?.placeables ?? [])
                    if (token.actor)
                        actors.set(token.actor.uuid, token.actor);
                full = false;
            }
            if (selected)
                actors.set(selected.uuid, selected);
            return actors;
        }
    };
}
