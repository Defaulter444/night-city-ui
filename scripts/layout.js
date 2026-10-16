const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
export const intersects = (a, b, gap = 0) => Boolean(a && b && a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top);
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

/** Calculate only presentation bounds; never move tokens or alter world data. */
export function layoutHUD({ width, height, sidebar, controls, navigation, hotbar, players, timer, timerManaged = true, dockHeight = 180, spacious = false, dockWidth = Infinity }) {
  width = Math.max(320, finite(width, 1440));
  height = Math.max(320, finite(height, 900));
  const gap = 10;
  // The Blackglass rail has a hover flyout; opening it must not move the battlefield HUD.
  const left = clamp(spacious ? 66 : (controls ? controls.right + gap : 112), gap, width - 220);
  const right = clamp(sidebar && sidebar.left >= left + 220 ? sidebar.left - gap : width - gap, left + 210, width - gap);
  const top = spacious ? 0 : clamp(Math.max(60, navigation?.bottom + gap || 0), gap, height - 180);
  const bottom = Math.max(top + 120, Math.min(height - gap, hotbar?.top - gap || height, players?.top - gap || height));
  const toolbar = spacious ? box(0, 0, width, 48) : box(left, top, right - left, 44);
  const contentTop = toolbar.bottom + gap;
  const timerWidth = Math.min(timer?.width || 300, right - left);
  const timerBox = !timer ? null : timerManaged
    ? box(right - timerWidth, contentTop, timerWidth, timer.height)
    : box(timer.left, timer.top, timer.width, timer.height);
  const queueHeight = spacious ? 64 : 128;
  let combat = box(left, contentTop, right - left, queueHeight);
  if (intersects(combat, timerBox, gap)) {
    const beside = timerBox.left - gap - left;
    if (beside >= 350) combat = box(left, contentTop, beside, queueHeight);
    else combat = box(left, Math.max(contentTop, timerBox.bottom + gap), right - left, queueHeight);
  }
  const minimumDock = spacious ? 0 : 120;
  const actualDockHeight = Math.min(Math.max(minimumDock, dockHeight), Math.max(minimumDock, (bottom - contentTop) * .46));
  let dock = box(left, bottom - actualDockHeight, Math.min(right - left, dockWidth), actualDockHeight);
  if (intersects(dock, timerBox, gap)) {
    const beside = timerBox.left - gap - left;
    if (beside >= 390) dock = box(left, bottom - actualDockHeight, Math.min(beside, dock.width), actualDockHeight);
    else dock = box(left, Math.max(contentTop, timerBox.top - gap - actualDockHeight), dock.width, actualDockHeight);
  }
  if (intersects(combat, dock, gap)) {
    const available = Math.min(dock.height, Math.max(0, dock.bottom - combat.bottom - gap));
    dock = box(dock.left, dock.bottom - available, dock.width, available);
  }
  return { toolbar, timer: timerBox, combat, dock, bottom, gap, compact: spacious ? width < 1180 : right - left < 820 };
}

export function presentationContext({ combat, selected, contextOnly = true }) {
  const battle = Boolean(combat?.started || Number(combat?.round) > 0);
  return { battle, hud: !contextOnly || battle || Boolean(selected), queue: !contextOnly || battle, actor: !contextOnly || Boolean(selected) };
}
