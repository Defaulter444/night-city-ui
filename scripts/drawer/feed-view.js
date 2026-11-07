// The feed over the scene: short cards for new chat messages while the chat is not on screen (spec 3.7).
import { FEED_LIFE_MS, FEED_LIMIT, pushCard } from './messages.js';

/**
 * Fields of a chat message the feed needs, read from its HTML without rendering it: a <template> parses the markup
 * inert, so no image loads and no script runs. A CPR roll card (`.rollcard`) gives its title, total, critical result
 * (the die picture `_preem` or `_fail`) and details. Never throws.
 */
export function readMessage(content) {
  const result = { rollCard: null, text: '' };
  try {
    const template = document.createElement('template');
    template.innerHTML = String(content ?? '');
    const root = template.content;
    const card = root.querySelector('.rollcard');
    if (card) {
      const dice = card.querySelector('.d10-dice-div');
      result.rollCard = {
        title: (card.querySelector('.rollcard-top .text-center') ?? card.querySelector('.rollcard-top'))?.textContent ?? '',
        total: (card.querySelector('.d10-number-div span') ?? card.querySelector('.d10-number-div'))?.textContent ?? '',
        crit: dice?.querySelector('img[src*="_preem"]') ? 'success' : dice?.querySelector('img[src*="_fail"]') ? 'fail' : null,
        details: card.querySelector('.d10-data-details')?.textContent ?? ''
      };
    }
    // textContent glues neighbouring blocks together («Welcome<h2>…<p>Notes» → «WelcomeNotes»): space them first.
    for (const element of root.querySelectorAll('br, p, div, li, tr, h1, h2, h3, h4, h5, h6, section, header, footer, blockquote')) element.after(' ');
    result.text = root.textContent ?? '';
  } catch { /* an unreadable message falls back to an empty card */ }
  return result;
}

function part(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/**
 * Create the feed. `onOpen` runs when a card is clicked. Cards live FEED_LIFE_MS, all timers stop while the pointer is
 * over the feed, and no more than FEED_LIMIT stay at once. Text always goes in through textContent.
 */
export function createFeed({ onOpen = () => {}, reducedMotion = () => false } = {}) {
  const root = document.createElement('section');
  root.id = 'ncu-feed';
  root.hidden = true;
  root.setAttribute('role', 'log');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', 'Новые сообщения чата');
  document.body.append(root);
  let cards = [], enabled = false, paused = false;
  const timers = new Map(), waiting = new Map();
  const find = id => [...root.children].find(element => element.dataset.id === id);
  function drop(id) {
    clearTimeout(timers.get(id)?.timeout);
    timers.delete(id);
    cards = cards.filter(card => card.id !== id);
    const element = find(id);
    if (!element) return;
    if (reducedMotion()) { element.remove(); return; }
    element.classList.add('is-leaving');
    setTimeout(() => element.remove(), 220);
  }
  function arm(id) {
    const timer = { remaining: FEED_LIFE_MS, deadline: Date.now() + FEED_LIFE_MS, timeout: null };
    if (!paused) timer.timeout = setTimeout(() => drop(id), FEED_LIFE_MS);
    timers.set(id, timer);
  }
  function clear() {
    for (const timer of timers.values()) clearTimeout(timer.timeout);
    timers.clear(); cards = []; root.replaceChildren();
  }
  root.addEventListener('pointerenter', () => {
    paused = true; root.classList.add('is-paused');
    for (const timer of timers.values()) { clearTimeout(timer.timeout); timer.remaining = Math.max(0, timer.deadline - Date.now()); }
  });
  root.addEventListener('pointerleave', () => {
    paused = false; root.classList.remove('is-paused');
    for (const [id, timer] of timers) { timer.deadline = Date.now() + timer.remaining; timer.timeout = setTimeout(() => drop(id), timer.remaining); }
  });
  root.addEventListener('click', event => { if (event.target.closest('.ncu-feed-card')) onOpen(); });
  function render(card) {
    const button = part('button', `ncu-feed-card tone-${card.tone}`);
    button.type = 'button';
    button.dataset.id = card.id;
    button.setAttribute('aria-label', card.label);
    if (card.crit) button.classList.add(`crit-${card.crit}`);
    if (card.concealed) button.classList.add('is-concealed');
    const who = part('span', 'ncu-feed-who', card.who);
    if (card.sub) who.append(part('small', 'ncu-feed-sub', card.sub));
    button.append(who);
    if (card.text) button.append(part('span', 'ncu-feed-text', card.text));
    if (card.total !== null) { button.classList.add('has-total'); button.append(part('b', 'ncu-feed-total', card.total)); }
    button.append(part('i', 'ncu-feed-life'));
    return button;
  }
  return {
    get enabled() { return enabled; },
    push(card) {
      if (!enabled) return;
      const { cards: next, dropped } = pushCard(cards, card, FEED_LIMIT);
      for (const old of dropped) drop(old.id);
      cards = next;
      find(card.id)?.remove();
      root.prepend(render(card));
      arm(card.id);
    },
    remove(id) { drop(id); },
    setEnabled(value) {
      value = Boolean(value);
      if (value === enabled) return;
      enabled = value; root.hidden = !enabled;
      if (!enabled) clear();
    },
    place(box) {
      if (!box) return;
      for (const [name, value] of [['left', box.left], ['top', box.top], ['width', box.width], ['maxHeight', box.maxHeight]]) {
        const next = `${Math.round(value)}px`;
        if (root.style[name] !== next) root.style[name] = next;
      }
    },
    /** Wait until Dice So Nice has shown the roll of this message (hook `diceSoNiceRollComplete`), at most `timeout` ms. */
    waitForDice(id, timeout = 20000) {
      return new Promise(resolve => {
        const done = () => { clearTimeout(timer); if (waiting.get(id) === done) waiting.delete(id); resolve(); };
        const timer = setTimeout(done, timeout);
        waiting.set(id, done);
      });
    },
    rollComplete(id) { waiting.get(id)?.(); },
    destroy() { clear(); for (const done of [...waiting.values()]) done(); waiting.clear(); root.remove(); }
  };
}
