// The scene panel under the bar (spec 3.4): cards of the navigation scenes and, for the GM, a search over the world.
// Text goes in through textContent only; scene names come from the world and may contain anything.
import { navigationScenes, sceneLabel, folderOptions, folderPath, searchScenes, scenesCount } from './scenes.js';

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function button(className, text) {
  const element = el('button', className, text);
  element.type = 'button';
  return element;
}
/** Thumbnail, or a plate with the name when the scene has none or the picture fails to load. */
function thumb(src, label, className = 'ncu-scene-thumb') {
  const box = el('span', className);
  const placeholder = () => el('span', 'ncu-scene-placeholder', label);
  if (!src) { box.append(placeholder()); return box; }
  const image = el('img');
  image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.src = src;
  image.addEventListener('error', () => image.replaceWith(placeholder()), { once: true });
  box.append(image);
  return box;
}

/**
 * Build the panel. `onView(id)`, `onActivate(id)` and `onNative()` are called on clicks; `render(data)` refreshes the
 * contents from {scenes, folders, isGM} and rebuilds only what changed, so typing in the search is never disturbed.
 */
export function createScenePanel({ onView = () => {}, onActivate = () => {}, onNative = () => {} } = {}) {
  const panel = el('section', 'ncu-scenes');
  panel.id = 'ncu-scenes';
  panel.setAttribute('aria-label', 'Сцены');
  panel.hidden = true;
  const head = el('header', 'ncu-scenes-head');
  const title = el('h3', '', 'Сцены · навигация');
  const hint = el('small', 'ncu-scenes-hint');
  const native = button('ncu-scenes-native', 'Штатная навигация');
  native.dataset.tooltip = 'Прежний список сцен Foundry с контекстным меню';
  head.append(title, hint, native);
  const grid = el('div', 'ncu-scenes-grid');
  const empty = el('p', 'ncu-scenes-empty', 'В навигации нет сцен.');
  const search = el('section', 'ncu-scenes-search');
  const searchHead = el('header', 'ncu-scenes-head');
  const searchTitle = el('h3', '', 'Все сцены мира');
  const count = el('small', 'ncu-scenes-hint');
  searchHead.append(searchTitle, count);
  const row = el('div', 'ncu-scenes-find');
  const field = el('label', 'ncu-scenes-field');
  field.append(el('i', 'fa-solid fa-magnifying-glass'));
  const input = el('input');
  input.type = 'search'; input.placeholder = 'Название сцены'; input.setAttribute('aria-label', 'Поиск по всем сценам');
  field.append(input);
  const select = el('select');
  select.setAttribute('aria-label', 'Папка');
  row.append(field, select);
  const results = el('ol', 'ncu-scenes-results');
  const note = el('p', 'ncu-scenes-empty');
  search.append(searchHead, row, results, note);
  panel.append(head, grid, empty, search);

  let data = { scenes: [], folders: [], isGM: false }, cardsKey = '', foldersKey = '', resultsKey = '';
  function renderCards() {
    const cards = navigationScenes(data.scenes).map(s => ({ id: s.id, label: sceneLabel(s, data), thumb: s.thumb || '', active: Boolean(s.active), here: Boolean(s.isView) }));
    const key = JSON.stringify([data.isGM, cards]);
    if (key === cardsKey) return;
    cardsKey = key;
    grid.replaceChildren(...cards.map(card => {
      const box = el('div', 'ncu-scene-card');
      box.classList.toggle('is-active', card.active);
      box.classList.toggle('is-here', card.here);
      const open = button('ncu-scene-open');
      open.dataset.view = card.id;
      const state = [card.active ? 'активна, игроки здесь' : '', card.here ? 'вы здесь' : ''].filter(Boolean).join(', ');
      open.setAttribute('aria-label', `Открыть у себя: ${card.label}${state ? ` (${state})` : ''}`);
      open.append(thumb(card.thumb, card.label));
      const flags = el('span', 'ncu-scene-flags');
      if (card.active) flags.append(el('span', 'ncu-scene-flag is-live', 'Активна · игроки здесь'));
      if (card.here) flags.append(el('span', 'ncu-scene-flag is-here', 'Вы здесь'));
      open.append(flags, el('span', 'ncu-scene-name', card.label));
      box.append(open);
      if (data.isGM && !card.active) {
        const activate = button('ncu-scene-activate');
        activate.dataset.activate = card.id;
        activate.setAttribute('aria-label', `Сделать активной: ${card.label}. Игроки перейдут на неё.`);
        activate.append(el('i', 'fa-solid fa-users'), document.createTextNode('Сделать активной'));
        box.append(activate);
      }
      return box;
    }));
    empty.hidden = cards.length > 0;
  }
  function renderFolders() {
    const options = folderOptions(data.folders);
    const key = JSON.stringify(options);
    if (key === foldersKey) return;
    foldersKey = key;
    const value = select.value;
    select.replaceChildren(el('option', '', 'Все папки'), ...options.map(option => {
      const item = el('option', '', `${'  '.repeat(option.depth)}${option.name}`);
      item.value = option.id;
      return item;
    }));
    select.options[0].value = '';
    select.value = options.some(option => option.id === value) ? value : '';
  }
  function renderResults() {
    const found = searchScenes(data.scenes, { query: input.value, folderId: select.value, folders: data.folders });
    const key = JSON.stringify([input.value, select.value, found.map(s => [s.id, s.name, s.thumb, s.folder, s.active, s.isView])]);
    if (key === resultsKey) return;
    resultsKey = key;
    results.replaceChildren(...found.map(scene => {
      const item = el('li');
      const open = button('ncu-scene-row');
      open.dataset.view = scene.id;
      open.setAttribute('aria-label', `Открыть у себя: ${scene.name}`);
      const name = el('span', 'ncu-scene-row-name', scene.name);
      if (scene.active) name.append(el('span', 'ncu-scene-mark is-live', 'активна'));
      if (scene.isView) name.append(el('span', 'ncu-scene-mark is-here', 'вы здесь'));
      open.append(thumb(scene.thumb, scene.name, 'ncu-scene-thumb is-small'), name, el('span', 'ncu-scene-row-path', folderPath(data.folders, scene.folder)), el('span', 'ncu-scene-row-open', 'Открыть'));
      item.append(open);
      return item;
    }));
    const searching = Boolean(input.value.trim() || select.value);
    note.textContent = searching ? (found.length ? (found.length === 20 ? 'Показаны первые 20. Уточните название.' : '') : 'Ничего не найдено.') : 'Введите название или выберите папку.';
    note.hidden = !note.textContent;
  }
  function render(next) {
    data = { scenes: next?.scenes ?? [], folders: next?.folders ?? [], isGM: Boolean(next?.isGM) };
    hint.textContent = data.isGM ? 'щелчок — открыть у себя, кнопка — перенести игроков' : 'щелчок — открыть у себя';
    renderCards();
    search.hidden = !data.isGM;
    if (!data.isGM) return;
    count.textContent = `${scenesCount(data.scenes.length)} · поиск по названию и папке`;
    renderFolders();
    renderResults();
  }
  panel.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target || !panel.contains(target)) return;
    if (target === native) onNative();
    else if (target.dataset.activate) onActivate(target.dataset.activate);
    else if (target.dataset.view) onView(target.dataset.view);
  });
  input.addEventListener('input', renderResults);
  select.addEventListener('change', renderResults);
  return { element: panel, render, get open() { return !panel.hidden; } };
}
