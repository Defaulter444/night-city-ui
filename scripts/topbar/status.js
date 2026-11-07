// Pure logic of the top bar status: the combat round with whose turn it is, and the DEADLINE countdown.
// Inputs are plain objects shaped like Foundry's Combat and DEADLINE's api.getState(), so node --test covers them.

const pad = value => String(value).padStart(2, '0');
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** Same rounding as DEADLINE: whole seconds rounded up, hours only from one hour. */
export function clockText(ms) {
  const total = Math.ceil(Math.max(0, finite(ms) ? ms : 0) / 1000);
  const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), seconds = total % 60;
  return hours ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Status of a combat on the current scene, or null outside combat.
 * A hidden combatant is named only to the GM and to its owner; players see «ход скрыт».
 */
export function combatStatus(combat, { isGM = false } = {}) {
  if (!combat) return null;
  const round = Number.isInteger(combat.round) ? combat.round : 0;
  const started = typeof combat.started === 'boolean' ? combat.started : round > 0;
  if (!started) return { state: 'prep', text: 'Подготовка к бою', short: 'Подготовка', tooltip: 'Бой ещё не начат. Щелчок — вкладка «Бой».' };
  const combatant = combat.combatant ?? null;
  const name = typeof combatant?.name === 'string' ? combatant.name.trim() : '';
  const concealed = Boolean(combatant?.hidden) && !isGM && combatant?.isOwner !== true;
  const secret = Boolean(combatant?.hidden) && !concealed;
  let text = `Раунд ${round}`, short = `Р${round}`, turn = '';
  if (combatant && concealed) { turn = 'ход скрыт'; text += ' · ход скрыт'; short += ' · скрыт'; }
  else if (name) { turn = name; text += ` · ходит ${name}`; short += ` · ${name}`; }
  const tooltip = `${text}${secret ? ' (скрыт от игроков)' : ''}. Щелчок — вкладка «Бой».`;
  return { state: 'round', round, name: concealed ? '' : name, concealed, secret, turn, text, short, tooltip };
}

/**
 * The countdown as the bar shows it, or null when this user must not see it: no DEADLINE state, an idle timer,
 * or a timer hidden from players. `now` is the server clock in milliseconds.
 */
export function timerView(state, { now = Date.now(), isGM = false } = {}) {
  if (!state || typeof state !== 'object') return null;
  const visible = state.visible !== false;
  if (!visible && !isGM) return null;
  const stored = ['running', 'paused', 'expired'].includes(state.effectiveStatus) ? state.effectiveStatus : state.status;
  if (!['running', 'paused', 'expired'].includes(stored)) return null;
  const saved = finite(state.remainingMs) ? Math.max(0, state.remainingMs) : 0;
  let remaining = stored === 'expired' ? 0 : saved;
  if (stored === 'running' && finite(state.deadlineMs)) remaining = Math.max(0, state.deadlineMs - now);
  const status = stored === 'running' && remaining <= 0 ? 'expired' : stored;
  const label = typeof state.label === 'string' && state.label.trim() ? state.label.trim() : 'Таймер';
  const warningMs = (finite(state.warningSeconds) ? Math.max(0, state.warningSeconds) : 60) * 1000;
  const warning = status === 'running' && remaining <= warningMs;
  const time = status === 'expired' ? 'Время вышло' : clockText(remaining);
  const phrase = { running: 'идёт отсчёт', paused: 'на паузе', expired: 'время вышло' }[status];
  const tooltip = `${label}: ${status === 'expired' ? phrase : `${clockText(remaining)}, ${phrase}`}${!visible ? ' (скрыт от игроков)' : ''}`
    + (isGM ? '. Щелчок — управление таймером.' : '.');
  // Next repaint lands just after the displayed second changes; stopped timers do not tick.
  const nextTick = status === 'running' ? (remaining % 1000 || 1000) + 20 : null;
  return { status, label, time, remaining, warning, hiddenFromPlayers: !visible, tooltip, nextTick };
}
