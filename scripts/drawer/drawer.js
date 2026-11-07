// Sidebar drawer. The core #sidebar stays the same element with the same tabs: this module only slides it out from
// under the top bar, hides it again and keeps the core from collapsing it (a collapsed sidebar opens tabs as windows).

/** The drawer works only with the theme and the spacious layout on, the user's setting on and a usable core sidebar. */
export function drawerMode({ enabled = false, spacious = false, setting = false, sidebarReady = false } = {}) {
  return Boolean(enabled && spacious && setting && sidebarReady);
}

/** A bar button that targets a tab closes the drawer when it already shows that tab, otherwise opens it there. */
export function toggleAction({ open = false, activeTab = null, tab } = {}) {
  return open && activeTab === tab ? 'close' : 'open';
}

const isTextField = element => element instanceof HTMLElement && element.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]');

/**
 * Show, hide and guard the core sidebar as a drawer. `onChange` runs after every change of state.
 * Listeners live on `signal`; setActive(false) gives the sidebar back exactly as it was.
 */
export function createDrawer({ signal, onChange = () => {} } = {}) {
  let active = false, open = false, returnFocus = null;
  const sidebar = () => document.getElementById('sidebar');
  const apply = () => {
    document.body.classList.toggle('ncu-drawer', active);
    document.body.classList.toggle('ncu-drawer-open', active && open);
    const element = sidebar();
    if (element) element.inert = active && !open;
  };
  const drawer = {
    get active() { return active; },
    get open() { return active && open; },
    get tab() { return globalThis.ui?.sidebar?.activeTab ?? null; },
    setActive(value) {
      value = Boolean(value);
      if (value === active) return;
      active = value;
      if (!active) { open = false; returnFocus = null; }
      else if (ui.sidebar?._collapsed) ui.sidebar.expand();
      apply(); onChange();
    },
    show(tab, { focus = false } = {}) {
      if (!active) return false;
      if (!open) {
        const current = document.activeElement;
        returnFocus = current instanceof HTMLElement && current !== document.body ? current : null;
      }
      if (tab && ui.sidebar.activeTab !== tab) ui.sidebar.activateTab(tab);
      open = true; apply();
      if (ui.sidebar.activeTab === 'chat') ui.chat?.scrollBottom?.();
      if (focus) document.getElementById('chat-message')?.focus();
      onChange();
      return true;
    },
    hide({ restoreFocus = true } = {}) {
      if (!open) return;
      open = false; apply();
      // Foundry ignores its shortcuts while any element has focus (KeyboardManager.hasFocus): give focus back only to
      // a field the user was typing in, otherwise let go of it so Esc and the other keys reach Foundry again.
      const current = document.activeElement;
      if (restoreFocus && isTextField(returnFocus) && returnFocus.isConnected) returnFocus.focus();
      else if (current instanceof HTMLElement && (sidebar()?.contains(current) || current.closest('#ncu-shell'))) current.blur();
      returnFocus = null; onChange();
    },
    toggle(tab, options) {
      if (toggleAction({ open: drawer.open, activeTab: drawer.tab, tab }) === 'close') { drawer.hide(); return false; }
      return drawer.show(tab, options);
    }
  };
  // Esc closes the drawer first; the core listens on window while bubbling, so the next Esc reaches Foundry.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !drawer.open) return;
    event.preventDefault(); event.stopPropagation(); drawer.hide();
  }, { signal, capture: true });
  // A press on the scene closes it. A drag out of the drawer starts inside it and never presses on the board.
  document.addEventListener('pointerdown', event => {
    if (drawer.open && event.target instanceof Element && event.target.closest('#board')) drawer.hide({ restoreFocus: false });
  }, { signal, capture: true });
  return drawer;
}
