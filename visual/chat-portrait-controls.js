/** Keep document/token resolution on interaction, not on chat refresh. */
export function bindChatPortraitControls(element, reference) {
    if (element.dataset.pvtPortraitControls)
        return;
    element.dataset.pvtPortraitControls = 'true';
    element.removeAttribute('aria-hidden');
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    element.title = 'Удерживайте — пинг · двойной щелчок — лист персонажа · Shift+щелчок — к токену';
    element.setAttribute('aria-label', element.title);
    element.draggable = false;
    element.querySelectorAll('img').forEach(img => { img.draggable = false; });
    let hold;
    let suppressClick = false;
    const cancelHold = () => { if (hold)
        window.clearTimeout(hold.timer); hold = undefined; };
    const act = async (action) => {
        if (!element.isConnected)
            return;
        const doc = fromUuidSync(reference.actor);
        if (doc?.documentName !== 'Actor')
            return;
        const actor = doc;
        if (action === 'sheet') {
            if (actor.testUserPermission(game.user, 'OBSERVER'))
                actor.sheet?.render(true);
            return;
        }
        if (!canvas.ready)
            return;
        const tokenDoc = reference.token ? fromUuidSync(reference.token) : undefined;
        const token = reference.token ? (tokenDoc?.documentName === 'Token' ? tokenDoc.object : undefined)
            : actor.getActiveTokens().find(token => game.user.isGM || token.visible);
        if (!token || token.document.parent?.id !== canvas.scene?.id || (!game.user.isGM && !token.visible))
            return;
        if (action === 'pan')
            await canvas.animatePan(token.center);
        else if (game.user.isGM || game.user.hasPermission('PING_CANVAS'))
            await canvas.ping(token.center);
    };
    const run = (action) => {
        void act(action).catch(error => { console.error('night-city-ui | Chat portrait action failed', error); });
    };
    element.addEventListener('dragstart', event => event.preventDefault());
    element.addEventListener('pointerdown', event => {
        event.stopPropagation();
        cancelHold();
        suppressClick = false;
        if (event.button !== 0 || event.shiftKey)
            return;
        hold = { x: event.clientX, y: event.clientY, timer: window.setTimeout(() => {
                hold = undefined;
                suppressClick = true;
                run('ping');
            }, MouseInteractionManager.LONG_PRESS_DURATION_MS) };
    });
    element.addEventListener('pointermove', event => {
        if (hold && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 8) {
            cancelHold();
            suppressClick = true;
        }
    });
    for (const event of ['pointerup', 'pointercancel', 'pointerleave'])
        element.addEventListener(event, cancelHold);
    element.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        cancelHold();
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        if (event.shiftKey)
            run('pan');
    });
    element.addEventListener('dblclick', event => {
        event.preventDefault();
        event.stopPropagation();
        cancelHold();
        if (!event.shiftKey)
            run('sheet');
    });
    element.addEventListener('keydown', event => {
        if (event.repeat || !['Enter', ' '].includes(event.key))
            return;
        event.preventDefault();
        event.stopPropagation();
        cancelHold();
        run(event.shiftKey ? 'pan' : 'sheet');
    });
}
