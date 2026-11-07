// Pure logic of the top bar sections (spec 3.1). No Foundry globals: callers pass what they read.
export const SECTION_ORDER = Object.freeze(['actor', 'agent', 'market', 'net', 'city', 'battle']);

/** hidden: the module is absent or disabled; locked: present, no access right now; ready: usable. */
export function sectionState({ installed = true, available = false } = {}) {
  if (!installed) return 'hidden';
  return available ? 'ready' : 'locked';
}

const elementOf = app => app?.element?.[0] ?? app?.element ?? null;
const hasClass = (element, name) => Boolean(element?.classList?.contains(name));

/**
 * Section owning a window, or null. ctx carries Foundry classes and the Netrunning app read by the caller.
 * Checked against night-city-agent 0.17.3, night-city-market 0.3.2 and cpr-netrunning 1.12.0.
 */
export function windowSection(app, { ActorSheet = null, CombatTracker = null, netApp = null } = {}) {
  if (!app || app.rendered === false) return null;
  if (netApp && app === netApp) return 'net';
  if (ActorSheet && app instanceof ActorSheet) return ['character', 'mook'].includes(app.actor?.type) ? 'actor' : null;
  if (CombatTracker && app instanceof CombatTracker) return app.options?.popOut ? 'battle' : null;
  const element = elementOf(app);
  if (hasClass(element, 'nca-app') || hasClass(element, 'nca-workspace')) return 'agent';
  if (element?.id === 'night-city-market-window') return 'market';
  return null;
}

/** The front window's section wins; otherwise «Бой» while the sidebar shows the combat tab. */
export function pickActiveSection({ frontSection = null, combatTab = false, states = {} } = {}) {
  const shown = name => Boolean(states[name]) && states[name] !== 'hidden';
  if (frontSection && shown(frontSection)) return frontSection;
  return combatTab && shown('battle') ? 'battle' : null;
}
