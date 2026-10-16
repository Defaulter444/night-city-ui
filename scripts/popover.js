const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

/** Viewport coordinates for a fixed panel, preferentially below its own button. */
export function placePopover({anchor, width, height, viewportWidth, viewportHeight, margin = 8, gap = 6}) {
  const vw = Math.max(0, finite(viewportWidth)), vh = Math.max(0, finite(viewportHeight));
  const insetX = Math.min(Math.max(0, finite(margin)), vw / 2);
  const insetY = Math.min(Math.max(0, finite(margin)), vh / 2);
  const spacing = Math.max(0, finite(gap));
  const maxWidth = Math.max(0, vw - insetX * 2);
  const panelWidth = clamp(finite(width), 0, maxWidth);
  const panelHeight = Math.max(0, finite(height));
  const topEdge = clamp(finite(anchor?.top), insetY, vh - insetY);
  const bottomEdge = clamp(finite(anchor?.bottom, topEdge), insetY, vh - insetY);
  const below = Math.max(0, vh - insetY - bottomEdge - spacing);
  const above = Math.max(0, topEdge - insetY - spacing);
  const placement = panelHeight <= below || below >= above ? 'below' : 'above';
  const maxHeight = placement === 'below' ? below : above;
  const renderedHeight = Math.min(panelHeight, maxHeight);
  return {
    left: clamp(finite(anchor?.left), insetX, vw - insetX - panelWidth),
    top: placement === 'below'
      ? clamp(bottomEdge + spacing, insetY, vh - insetY - renderedHeight)
      : Math.max(insetY, topEdge - spacing - renderedHeight),
    maxWidth, maxHeight, placement
  };
}

/** A disclosure panel outside the scrollable toolbar, with hover as an optional shortcut. */
export function createPopover({anchor, toggle, panel, hover = false, canOpen = () => true,
  onOpen = () => {}, nextFocus, signal, ownerDocument = document, view = window,
  timers = globalThis, closeDelay = 160}) {
  const listeners = new AbortController();
  let disposed = false, closeTimer, overAnchor = false, overPanel = false, restoringFocus = false;
  const contains = node => Boolean(node && (anchor.contains(node) || panel.contains(node)));
  const focused = () => contains(ownerDocument.activeElement);
  const listen = (node, type, handler, options = {}) => node.addEventListener(type, handler, {...options, signal:listeners.signal});
  const clearClose = () => { if(closeTimer !== undefined)timers.clearTimeout(closeTimer);closeTimer = undefined; };
  const style = (key, value) => { const next = `${value}px`;if(panel.style[key] !== next)panel.style[key] = next; };
  panel.hidden = true;
  panel.tabIndex = -1;
  toggle.setAttribute('aria-expanded', 'false');

  function close({focus = false} = {}) {
    const wasOpen = !panel.hidden;
    clearClose();overAnchor = false;overPanel = false;
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if(focus && wasOpen && !disposed) {
      restoringFocus = true;
      try { toggle.focus(); } finally { restoringFocus = false; }
    }
  }
  function position() {
    if(disposed || panel.hidden)return;
    if(!canOpen()){close();return;}
    // Read the full content height without expanding a scrolled panel first:
    // a temporary expansion can clamp its scrollTop and jump away from the last item.
    const viewportWidth = Math.max(0, finite(view.innerWidth)), viewportHeight = Math.max(0, finite(view.innerHeight));
    style('maxWidth', Math.max(0, viewportWidth - 16));
    const bounds = panel.getBoundingClientRect();
    const border = Math.max(0, finite(panel.offsetHeight) - finite(panel.clientHeight));
    const height = Math.max(bounds.height, finite(panel.scrollHeight) + border);
    const placement = placePopover({anchor:anchor.getBoundingClientRect(), width:bounds.width, height, viewportWidth, viewportHeight});
    for(const key of ['left','top','maxWidth','maxHeight'])style(key, placement[key]);
  }
  function setOpen(open, {focus = false} = {}) {
    if(!open || disposed || !canOpen()){close();return false;}
    clearClose();
    if(panel.hidden)onOpen();
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    position();
    if(focus)(panel.querySelector('button:not([hidden]):not(:disabled):not([aria-disabled="true"]), input:not(:disabled), [tabindex="0"]') || panel).focus();
    return true;
  }
  function deferClose() {
    clearClose();
    closeTimer = timers.setTimeout(() => {
      closeTimer = undefined;
      if(!overAnchor && !overPanel && !focused())close();
    }, closeDelay);
  }
  function destroy() {
    if(disposed)return;
    disposed = true;close();listeners.abort();
    signal?.removeEventListener('abort', destroy);
  }

  listen(toggle, 'click', event => {
    event.preventDefault();event.stopPropagation();
    const keyboard = event.detail === 0;
    setOpen(hover && keyboard ? true : panel.hidden, {focus:keyboard});
  });
  listen(anchor, 'keydown', event => {
    if(event.key !== 'ArrowDown' || !canOpen())return;
    event.preventDefault();event.stopPropagation();setOpen(true, {focus:true});
  });
  if(hover) {
    for(const [node, isAnchor] of [[anchor,true],[panel,false]]) {
      listen(node, 'pointerenter', event => {
        if(event.pointerType === 'touch')return;
        if(isAnchor)overAnchor = true;else overPanel = true;
        clearClose();setOpen(true);
      });
      listen(node, 'pointerleave', event => {
        if(event.pointerType === 'touch')return;
        if(isAnchor)overAnchor = false;else overPanel = false;
        deferClose();
      });
      // The disclosure button itself opens on click/Enter, avoiding a touch focus
      // opening the panel just before that same tap would toggle it closed.
      listen(node, 'focusin', event => {
        if(!restoringFocus && event.target !== toggle){clearClose();setOpen(true);}
      });
      listen(node, 'focusout', () => {
        queueMicrotask(() => { if(!disposed && !focused() && !overAnchor && !overPanel)close(); });
      });
    }
    listen(panel, 'keydown', event => {
      if(event.key !== 'Tab')return;
      const buttons = [...panel.querySelectorAll('button:not([hidden]):not(:disabled)')];
      if(event.shiftKey && (event.target === buttons[0] || event.target === panel)) {
        event.preventDefault();close({focus:true});
      } else if(!event.shiftKey && (event.target === buttons.at(-1) || event.target === panel)) {
        const next = nextFocus?.();
        if(next){event.preventDefault();close();next.focus();}
      }
    });
  }
  listen(ownerDocument, 'pointerdown', event => { if(!contains(event.target))close(); });
  listen(ownerDocument, 'keydown', event => {
    if(event.key !== 'Escape' || panel.hidden)return;
    event.preventDefault();event.stopPropagation();close({focus:true});
  }, {capture:true});
  listen(ownerDocument, 'scroll', event => { if(!panel.contains(event.target))position(); }, {capture:true});
  listen(view, 'resize', position);
  signal?.addEventListener('abort', destroy, {once:true});
  if(signal?.aborted)destroy();
  return {setOpen, close, position, destroy};
}
