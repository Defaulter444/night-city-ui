const MODULE = 'night-city-ui';
/** Keep Foundry's dismiss behavior, but restrict its close-all phase to one window. */
export function registerWindowEscapeProtection() {
    game.settings.register(MODULE, 'fixEscapeKey', {
        name: 'Умная клавиша Esc',
        hint: "Esc закрывает только текущее всплывающее окно. А на холсте без выделения Esc больше не открывает меню выхода и перезагрузки.",
        scope: 'client', config: true, type: Boolean, default: true,
    });
    const enabled = () => game.settings.get(MODULE, 'fixEscapeKey');
    const protectedApps = new WeakSet();
    let escapeTarget;
    let escapeRoot = null;
    const element = (app) => {
        return app.element instanceof HTMLElement ? app.element : app.element?.[0];
    };
    const protect = (app) => {
        if (protectedApps.has(app))
            return;
        protectedApps.add(app);
        const nativeClose = app.close;
        app.close = function (options) {
            if (enabled() && options?.closeKey && this !== escapeTarget && element(this) !== escapeRoot)
                return Promise.resolve();
            return nativeClose.call(this, options);
        };
    };
    const windows = () => {
        const classic = Object.values(ui.windows);
        const modern = foundry.utils.getProperty(foundry, 'applications.instances');
        return [...new Set([...classic, ...(modern?.values() ?? [])])];
    };
    // Capture at the window before Foundry's document keyboard dispatch.
    window.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !enabled())
            return;
        const apps = windows().filter(app => {
            const root = element(app);
            return app.rendered && app.hasFrame !== false && app.options?.popOut !== false
                && !!root?.isConnected && (app.hasFrame === true || root.matches('.window-app, .application'));
        });
        if (!apps.length && game.view === 'game') {
            const controlled = foundry.utils.getProperty(canvas, 'activeLayer.controlled');
            const preview = foundry.utils.getProperty(canvas, 'activeLayer.preview.children');
            const canRelease = game.user?.isGM && !!controlled?.length && !preview?.length;
            const contextOpen = !!ui.context?.menu.length;
            if (!canRelease && !contextOpen && !Tour.tourInProgress) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
        }
        for (const app of apps)
            protect(app);
        const active = foundry.utils.getProperty(ui, 'activeWindow');
        const focused = document.activeElement?.closest('.window-app, .application') ?? null;
        // Native front-window z-index reflects title-bar clicks, even with stale input focus.
        const top = apps.filter(app => element(app)?.isConnected).sort((a, b) => {
            const z = (app) => Number(getComputedStyle(element(app)).zIndex) || 0;
            return z(b) - z(a);
        })[0];
        escapeTarget = top ?? (active?.rendered ? active : apps.find(app => element(app) === focused));
        escapeRoot = escapeTarget ? element(escapeTarget) ?? null : focused;
    }, true);
    // Also protect explicit closeKey requests routed through native render hooks.
    for (const hook of ['renderSidebarTab', 'renderCompendium', 'renderApplication', 'renderApplicationV2'])
        Hooks.on(hook, protect);
}
