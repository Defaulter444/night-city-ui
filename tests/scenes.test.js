import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigationScenes, sceneLabel, folderOptions, folderScope, folderPath, searchScenes } from '../scripts/topbar/scenes.js';

const scene = (id, patch = {}) => ({ id, name: id, navName: '', navigation: false, visible: true, active: false, isView: false, navOrder: 0, folder: null, thumb: '', ...patch });

test('cards follow the core navigation: in navigation and visible, plus the active and the viewed scene, by navOrder', () => {
  const list = [
    scene('c', { navigation: true, navOrder: 30 }), scene('a', { navigation: true, navOrder: 10 }),
    scene('hidden', { navigation: true, visible: false, navOrder: 5 }), scene('off', { navOrder: 1 }),
    scene('live', { active: true, navOrder: 50 }), scene('here', { isView: true, navOrder: 20 })
  ];
  assert.deepEqual(navigationScenes(list).map(s => s.id), ['a', 'here', 'c', 'live']);
  assert.deepEqual(navigationScenes([]), []);
});

test('players see the navigation name, the GM the real one', () => {
  const s = scene('x', { name: 'Склад 7 (засада)', navName: 'Склад' });
  assert.equal(sceneLabel(s, { isGM: true }), 'Склад 7 (засада)');
  assert.equal(sceneLabel(s, { isGM: false }), 'Склад');
  assert.equal(sceneLabel(scene('y', { name: 'Бар' }), { isGM: false }), 'Бар');
});

const folders = [
  { id: 'lib', name: 'Библиотека карт', parent: null, sort: 200 },
  { id: 'wat', name: 'Уотсон', parent: 'lib', sort: 0 },
  { id: 'hey', name: 'Хейвуд', parent: 'lib', sort: -10 },
  { id: 'camp', name: 'Кампания', parent: null, sort: 100 },
  { id: 'deep', name: 'Подвалы', parent: 'wat', sort: 0 }
];

test('folder options: parents before children, sorted, with depth', () => {
  assert.deepEqual(folderOptions(folders).map(f => [f.id, f.depth]), [['camp', 0], ['lib', 0], ['hey', 1], ['wat', 1], ['deep', 2]]);
});

test('a folder scope takes all its subfolders; the path names the chain', () => {
  assert.deepEqual([...folderScope(folders, 'lib')].sort(), ['deep', 'hey', 'lib', 'wat']);
  assert.deepEqual([...folderScope(folders, 'camp')], ['camp']);
  assert.equal(folderPath(folders, 'deep'), 'Библиотека карт / Уотсон / Подвалы');
  assert.equal(folderPath(folders, null), '');
  assert.equal(folderPath(folders, 'missing'), '');
});

test('search: by real or navigation name, ё as е, prefix matches first, at most the limit', () => {
  const list = [
    scene('1', { name: 'Ночной бар', folder: 'wat' }), scene('2', { name: 'Бар «Койот-Койо»', folder: 'hey' }),
    scene('3', { name: 'Склад', navName: 'Барахолка', folder: 'camp' }), scene('4', { name: 'Ёлки у бара', folder: 'deep' }),
    scene('5', { name: 'Парковка' })
  ];
  assert.deepEqual(searchScenes(list, { query: 'бар' }).map(s => s.id), ['2', '3', '4', '1']);
  assert.deepEqual(searchScenes(list, { query: 'елки' }).map(s => s.id), ['4']);
  assert.deepEqual(searchScenes(list, { query: 'бар', folderId: 'lib', folders }).map(s => s.id), ['2', '4', '1']);
  assert.deepEqual(searchScenes(list, { query: '', folderId: 'wat', folders }).map(s => s.id), ['4', '1']);
  assert.deepEqual(searchScenes(list, { query: '   ' }), []);
  assert.equal(searchScenes(Array.from({ length: 30 }, (_, i) => scene(`s${i}`, { name: `Бар ${i}` })), { query: 'бар' }).length, 20);
  assert.equal(searchScenes(list, { query: 'бар', limit: 2 }).length, 2);
});

test('scene count in Russian', async () => {
  const { scenesCount } = await import('../scripts/topbar/scenes.js');
  assert.deepEqual([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 165, 0].map(scenesCount),
    ['1 сцена', '2 сцены', '4 сцены', '5 сцен', '11 сцен', '12 сцен', '14 сцен', '21 сцена', '22 сцены', '25 сцен', '101 сцена', '111 сцен', '165 сцен', '0 сцен']);
});
