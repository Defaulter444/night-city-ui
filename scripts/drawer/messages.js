// Pure logic of the chat drawer: the unread counter on the «ЧАТ» button. The feed and message tones follow in 0.5.1.

export const NO_UNREAD = Object.freeze({ count: 0, whisper: false });

/**
 * Count a new chat message as unread: only a message this user can see, written by someone else, while the chat is
 * not on screen. A whisper addressed to this user keeps the counter yellow until the chat is opened.
 */
export function addUnread(state, { visible = false, own = false, whisperToMe = false, chatOnScreen = false } = {}) {
  const current = state ?? NO_UNREAD;
  if (!visible || own || chatOnScreen) return current;
  return { count: current.count + 1, whisper: current.whisper || Boolean(whisperToMe) };
}

/** Badge text: nothing at zero, «9+» past nine. */
export function unreadLabel(count) {
  if (!Number.isFinite(count) || count <= 0) return '';
  return count > 9 ? '9+' : String(Math.floor(count));
}

/** Tooltip of the «ЧАТ» button. */
export function chatTip({ count = 0, whisper = false, key = '' } = {}) {
  const unread = count > 0 ? `непрочитанных: ${count > 9 ? 'больше 9' : count}${whisper ? ', есть шёпот вам' : ''}` : 'новых сообщений нет';
  return `Чат — ${unread}.${key ? ` ${key} — написать.` : ''}`;
}

// --- Feed over the scene (0.5.1) ---

export const FEED_LIMIT = 4;
export const FEED_LIFE_MS = 8000;

/**
 * Stripe colour of a message, checked in order: a whisper; a module card (written by the GM, no speaking actor,
 * plain «other» style, not a roll — how modules like FXMaster post greetings and reports); the GM; a player.
 */
export function messageTone({ whisper = false, authorIsGM = false, hasActor = false, style = null, isRoll = false, otherStyle = 0 } = {}) {
  if (whisper) return 'whisper';
  if (authorIsGM && !hasActor && style === otherStyle && !isRoll) return 'module';
  return authorIsGM ? 'gm' : 'player';
}

/** One line of text: whitespace collapsed, cut to `max` characters with an ellipsis. */
export function cleanText(text, max = 140) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

const CRIT_LABEL = { success: 'критический успех', fail: 'критический провал' };

/**
 * What one feed card shows. `rollCard` is read from a CPR roll card ({title, total, crit, details}), `roll` from a core
 * roll ({formula, total}); `text` is the message without markup. Players never see the content of a blind roll.
 */
export function feedCard({ id, alias = '', tone = 'player', rollCard = null, roll = null, text = '', blind = false, isGM = false } = {}) {
  const who = cleanText(alias, 60) || 'Без имени';
  const base = { id, tone, who, sub: '', text: '', total: null, crit: null, concealed: false };
  if (blind && !isGM) return { ...base, sub: 'скрытый бросок', concealed: true, label: `${who}, скрытый бросок` };
  let card;
  if (rollCard && (cleanText(rollCard.total) || cleanText(rollCard.title))) {
    card = { ...base, sub: cleanText(rollCard.title, 60), text: cleanText(rollCard.details), total: cleanText(rollCard.total, 8) || null, crit: CRIT_LABEL[rollCard.crit] ? rollCard.crit : null };
  } else if (roll && roll.total !== undefined && roll.total !== null) {
    card = { ...base, sub: 'бросок', text: cleanText(roll.formula, 80), total: String(roll.total) };
  } else {
    card = { ...base, sub: tone === 'whisper' ? 'шёпот' : tone === 'module' ? 'модуль' : '', text: cleanText(text) || '…' };
  }
  const label = [card.who, card.sub, card.text, card.total !== null ? `итог ${card.total}` : '', CRIT_LABEL[card.crit] ?? ''].filter(Boolean).join(', ');
  return { ...card, label };
}

/** Add a card as the newest; past the limit the oldest go. A card with the same id moves to the newest place. */
export function pushCard(cards, card, limit = FEED_LIMIT) {
  const next = [...cards.filter(c => c.id !== card.id), card];
  return { cards: next.slice(-limit), dropped: next.slice(0, Math.max(0, next.length - limit)) };
}
