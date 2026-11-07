// Pure logic of the scene panel (spec 3.4): which scenes become cards, folder filter and search over the whole world.
// Scenes and folders come in as plain objects, so node --test covers it:
//   scene  {id, name, navName, navigation, visible, active, isView, navOrder, folder, thumb}
//   folder {id, name, parent, sort}

const norm = text => String(text ?? '').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ru', { sensitivity: 'base' });

/** Cards of the panel, chosen like the core navigation: in navigation and visible, plus the active and the viewed scene. */
export function navigationScenes(scenes) {
  return scenes.filter(s => (s.navigation && s.visible) || s.active || s.isView).sort((a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0));
}

/** Players see the navigation name when there is one; the GM sees the real name. */
export function sceneLabel(scene, { isGM = false } = {}) {
  return (!isGM && scene.navName?.trim()) || scene.name || '';
}

/** Folders flattened for the filter: parents before their children, siblings by sort and name, with depth. */
export function folderOptions(folders) {
  const children = new Map();
  for (const folder of folders) {
    const key = folder.parent ?? null;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(folder);
  }
  const out = [];
  const walk = (parent, depth) => {
    for (const folder of [...(children.get(parent) ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || byName(a, b))) {
      out.push({ id: folder.id, name: folder.name, depth });
      if (depth < 10) walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** A folder together with all its subfolders. */
export function folderScope(folders, id) {
  const scope = new Set(id ? [id] : []);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) if (scope.has(folder.parent) && !scope.has(folder.id)) { scope.add(folder.id); grew = true; }
  }
  return scope;
}

/** «Library / Watson / Cellars» for a folder, empty for none or an unknown one. */
export function folderPath(folders, id) {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const names = [];
  for (let folder = byId.get(id); folder && names.length < 10; folder = byId.get(folder.parent)) names.unshift(folder.name);
  return names.join(' / ');
}

/**
 * Search the whole world by real or navigation name (ё counts as е) inside a folder and its subfolders.
 * Names that start with the query come first, then the rest, each group by name. An empty query lists the folder;
 * no query and no folder give nothing.
 */
export function searchScenes(scenes, { query = '', folderId = '', folders = [], limit = 20 } = {}) {
  const needle = norm(query);
  if (!needle && !folderId) return [];
  const scope = folderId ? folderScope(folders, folderId) : null;
  const ranked = [];
  for (const scene of scenes) {
    if (scope && !scope.has(scene.folder)) continue;
    const names = [norm(scene.name), norm(scene.navName)].filter(Boolean);
    if (needle && !names.some(name => name.includes(needle))) continue;
    ranked.push({ scene, rank: !needle || names.some(name => name.startsWith(needle)) ? 0 : 1 });
  }
  ranked.sort((a, b) => a.rank - b.rank || byName(a.scene, b.scene));
  return ranked.slice(0, limit).map(entry => entry.scene);
}

/** «1 сцена», «3 сцены», «165 сцен». */
export function scenesCount(count) {
  const n = Math.abs(Math.trunc(Number(count) || 0)), last = n % 10, tens = n % 100;
  const word = last === 1 && tens !== 11 ? 'сцена' : last >= 2 && last <= 4 && (tens < 12 || tens > 14) ? 'сцены' : 'сцен';
  return `${n} ${word}`;
}
