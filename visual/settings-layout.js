const MODULE = 'night-city-ui';
const groups = [
    ['Интерфейс Найт-Сити', 'enabled', 'spacious', 'theme', 'compactTools', 'contextHud', 'showPlayers'],
    ['Карточки чата', 'chatCards', 'chatSkin', 'chatPortraitSource', 'chatFallbackImage'],
    ['Кубики в чате', 'chatDiceEnabled', 'chatDiceMenu'],
    ['Цвета', 'customThemeEnabled', 'themeCustomizer'],
    ['Превью сцен', 'scenePreviewsEnabled'],
    ['Звук и звуковая панель', 'audioToolsEnabled'],
    ['Эффекты атак', 'weaponAnimations', 'weaponIntensity', 'weaponSounds', 'weaponVolume', 'weaponLighting', 'weaponLightVision', 'weaponLightMenu'],
    ['Клавиша Esc', 'fixEscapeKey'],
    ['Эффекты на весь экран', 'screenEffects'],
    ['Эффекты на токенах', 'tokenEffects'],
    ['Просмотр эффектов', 'effectsPreview'],
];
export function groupVisualSettings(root) {
    const rows = new Map();
    root.querySelectorAll('[name^="' + MODULE + '."], button[data-key^="' + MODULE + '."]').forEach(control => {
        const key = (control.getAttribute('name') ?? control.dataset.key ?? '').slice(MODULE.length + 1);
        const row = control.closest('.form-group');
        if (row)
            rows.set(key, row);
    });
    if (!rows.size)
        return;
    const off = root.querySelector('[name="' + MODULE + '.chatSkin"] option[value="off"]');
    if (off)
        off.hidden = true; // Retain the saved OFF value and native form submission.
    let wrapper = root.querySelector('.pvt-settings-groups');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'pvt-settings-groups';
        rows.values().next().value.before(wrapper);
    }
    for (const [title, master, ...keys] of groups) {
        const ordered = [master, ...keys].map(key => rows.get(key)).filter((row) => !!row);
        if (!ordered.length)
            continue;
        let group = wrapper.querySelector('[data-pvt-settings-master="' + master + '"]');
        if (!group) {
            group = document.createElement('fieldset');
            group.dataset.pvtSettingsMaster = master;
            const heading = document.createElement('legend');
            heading.textContent = title;
            group.append(heading);
            wrapper.append(group);
        }
        group.append(...ordered);
        const toggle = group.querySelector('[name="' + MODULE + '.' + master + '"]');
        const sync = () => ordered.forEach(row => {
            if (row === rows.get(master)) {
                row.inert = false;
                return;
            }
            const sounds = group.querySelector('[name="' + MODULE + '.weaponSounds"]');
            row.inert = master === 'weaponAnimations' ? row === rows.get('weaponIntensity') ? !!toggle && !toggle.checked : row === rows.get('weaponVolume') ? !!sounds && !sounds.checked : false : toggle ? !toggle.checked : false;
            row.classList.toggle('pvt-setting-disabled', row.inert);
            row.setAttribute('aria-disabled', String(row.inert));
        });
        group.onchange = sync;
        sync();
    }
    const input = root.querySelector('[name="' + MODULE + '.chatFallbackImage"]');
    if (input && !input.closest('.form-group')?.querySelector('[data-pvt-portrait-picker]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'file-picker';
        button.dataset.pvtPortraitPicker = '';
        button.title = 'Выбрать запасной портрет для чата';
        button.setAttribute('aria-label', button.title);
        button.innerHTML = '<i class="fas fa-file-import" aria-hidden="true"></i>';
        button.addEventListener('click', event => { event.preventDefault(); new FilePicker({ type: 'image', current: input.value, callback: path => { input.value = path; input.dispatchEvent(new Event('change', { bubbles: true })); } }).render(true); });
        input.after(button);
    }
}
export function registerVisualSettings() {
    game.settings.register(MODULE, 'screenEffects', { name: 'Эффекты на весь экран', hint: 'Наложения на экран: яд, Blue Glass, Smash, Человечность, горение и нейровторжение (если доступно); ЭМИ — по отключениям из боевых инструментов REDLINE; электрошок ждёт игровой интеграции. Не зависит от эффектов на токенах. Учитывает системную настройку «уменьшить движение».', scope: 'client', config: true, type: Boolean, default: true, onChange: () => { Hooks.callAll('pneumaVisualToolsScreenEffectsChanged'); } });
    for (const [key, name, hint] of [
        ['scenePreviewsEnabled', 'Превью сцен', 'Наведите курсор на сцену в компендиуме — появится превью; щелчок открывает арт сцены. Нужна перезагрузка.'],
        ['audioToolsEnabled', 'Аудиоинструменты и звуковая панель', 'Перемотка и управление треками в плейлистах, звуковая панель и её горячая клавиша. Нужна перезагрузка.'],
    ])
        game.settings.register(MODULE, key, { name, hint, scope: 'client', config: true, type: Boolean, default: true, requiresReload: true });
    Hooks.on('renderSettingsConfig', (_app, html) => { if (html[0])
        groupVisualSettings(html[0]); });
}
