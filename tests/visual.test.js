import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('module.json', 'utf8'));
const sources = readdirSync('visual-src').filter(file => file.endsWith('.ts'));
const read = file => readFileSync(`visual-src/${file}`, 'utf8');

test('manifest loads the built visual layer, its styles and the Russian strings', () => {
  assert.ok(manifest.esmodules.includes('visual/main.js'));
  for (const path of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(lang => lang.path)]) assert.ok(existsSync(path), path);
  assert.deepEqual(manifest.languages.map(lang => [lang.lang, lang.path]), [['ru', 'visual/ru.json'], ['en', 'visual/ru.json']]);
  assert.ok(manifest.styles.indexOf('styles/visual-blackglass.css') > manifest.styles.indexOf('visual/chat-hub.css'));
});

test('every localization key used by the visual layer exists in ru.json', () => {
  const ru = JSON.parse(readFileSync('visual-src/ru.json', 'utf8'));
  const keys = new Set(sources.flatMap(file => read(file).match(/NIGHT_CITY_VISUAL\.[A-Za-z]+/g) ?? []));
  assert.ok(keys.size > 10);
  for (const key of keys) assert.equal(typeof ru[key], 'string', key);
  assert.ok(!sources.some(file => read(file).includes('PNEUMA_VISUALTOOLS')));
});

test('templates and art resolve inside this module, and combat data comes from REDLINE', () => {
  const all = sources.map(read).join('\n') + readdirSync('visual-src').filter(f => f.endsWith('.hbs')).map(f => read(f)).join('\n');
  for (const path of all.match(/modules\/(?:\$\{MODULE\}|night-city-ui)\/visual\/[a-z0-9_-]+\.(?:hbs|css|webp|zip)/g) ?? []) {
    assert.ok(existsSync('visual-src/' + path.split('/').pop()), path);
  }
  assert.ok(existsSync('visual-src/dice-pneuma-d10_preem.webp') && existsSync('visual-src/dice-pneuma-critical_d10_10.webp'));
  assert.ok(!/modules\/pneuma-visualtools|['"]pneuma-combattools['"]/.test(all));
  assert.match(read('main.ts'), /ORIGINAL_MODULE = "pneuma-visualtools"/);
  assert.ok(all.includes("'redline-combat'"));
});

test('chat recognition accepts the Russian labels REDLINE writes', () => {
  const chat = read('chat-presentation.ts');
  for (const label of ['Бросок урона', 'Урон', 'Атака', 'Захват', 'Удушение', 'критическ']) assert.ok(chat.includes(label), label);
  const damageRoll = /^(?:Damage roll|Бросок урона)/;
  assert.ok(damageRoll.test('Бросок урона — подробности броска'));
  assert.ok(damageRoll.test('Damage roll — show roll details'));
  const grapple = /^(Grab|Break Grapple|Release|Choke|Throw|Захват|Разорвать захват|Отпустить|Удушение|Бросок):\s*(.+?)\s*→\s*(.+)$/;
  assert.deepEqual('Удушение: Ви → Джеки'.match(grapple)?.slice(1), ['Удушение', 'Ви', 'Джеки']);
});

test('user-facing settings of the visual layer are Russian', () => {
  for (const file of sources) {
    for (const [, name] of read(file).matchAll(/register(?:Menu)?\([^,]+,\s*['"][A-Za-z]+['"],\s*\{\s*name:\s*['"]([^'"]+)['"]/g)) {
      if (!name.startsWith('NIGHT_CITY_VISUAL.')) assert.match(name, /[А-Яа-яЁё]/, `${file}: ${name}`);
    }
  }
});
