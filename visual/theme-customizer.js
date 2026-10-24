import { COLOR_ROLES, DEFAULT_THEME, normalizeTheme, generatePalette, paletteVariables, contrastWarnings } from './theme-palette.js';
import { PNEUMA_PRESETS, normalizePersonalPresets } from './theme-presets.js';
const MODULE = 'night-city-ui';
let activeMode;
let liveDraft;
export function effectiveThemeMode(theme) {
    if (theme.mode !== 'automatic')
        return theme.mode;
    return document.documentElement.dataset.cprTheme === 'darkmode' || document.body.classList.contains('theme-dark') ? 'dark' : 'light';
}
export function applyCustomTheme() {
    const theme = liveDraft ? { ...liveDraft.theme, enabled: true } : normalizeTheme(game.settings.get(MODULE, 'customTheme'));
    const root = document.documentElement;
    root.classList.toggle('pvt-custom-theme', theme.enabled);
    let style = document.getElementById('pvt-custom-palette');
    if (!theme.enabled) {
        style?.remove();
        activeMode = undefined;
        return;
    }
    activeMode = liveDraft?.mode || effectiveThemeMode(theme);
    if (!style) {
        style = document.createElement('style');
        style.id = 'pvt-custom-palette';
        document.head.append(style);
    }
    const declarations = Object.entries(paletteVariables(theme[activeMode], activeMode)).map(([key, value]) => `${key}:${value};`).join('');
    style.textContent = `html.pvt-custom-theme, html.pvt-custom-theme body {${declarations} color-scheme:${activeMode};}`;
}
export class ThemeCustomizer extends FormApplication {
    draft;
    editing;
    manual = false;
    seed = '#4d771f';
    constructor() {
        super({});
        this.draft = normalizeTheme(game.settings.get(MODULE, 'customTheme'));
        this.editing = effectiveThemeMode(this.draft);
        this.manual = false;
        this.seed = this.draft.seed;
    }
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'pvt-theme-customizer', title: 'Настройка цветов', width: 620, height: 'auto',
            template: foundry.utils.getRoute(`modules/${MODULE}/visual/theme-customizer.hbs`), closeOnSubmit: true, submitOnChange: false, submitOnClose: false,
        });
    }
    getData() {
        return { enabled: normalizeTheme(game.settings.get(MODULE, 'customTheme')).enabled, light: this.editing === 'light', dark: this.editing === 'dark',
            overrideSystem: this.draft.mode !== 'automatic',
            modes: [{ id: 'light', label: 'Светлая' }, { id: 'dark', label: 'Тёмная' }].map(m => ({ ...m, selected: m.id === this.editing })),
            mainAccent: this.draft[this.editing].main,
            colors: COLOR_ROLES.filter(role => role.key !== 'main').map(role => ({ ...role, value: this.draft[this.editing][role.key] })),
            manual: this.manual, seed: this.seed, legacyActive: game.modules?.get('pneuma-green-theme')?.active,
            pneumaPresets: PNEUMA_PRESETS.map((preset, index) => ({ index, name: preset.name })),
            personalPresets: normalizePersonalPresets(game.user?.getFlag(MODULE, 'themePresets')).map((preset, index) => ({ index, slot: index + 1, name: preset?.name || `Моя тема ${index + 1}`, empty: !preset, accent: preset?.theme[this.editing].main ?? 'transparent' })), };
    }
    readDraft(root) {
        this.draft.mode = root.querySelector('[name="overrideSystem"]')?.checked ? (root.querySelector('[name="mode"]')?.value ?? this.editing) : 'automatic';
        for (const { key } of COLOR_ROLES) {
            const input = root.querySelector(`[name="${key}"]`);
            if (!input)
                continue;
            if (/^#[0-9a-f]{6}$/i.test(input.value))
                this.draft[this.editing][key] = input.value.toLowerCase();
        }
    }
    preview(root) {
        liveDraft = { owner: this, theme: structuredClone(this.draft), mode: this.editing };
        applyCustomTheme();
        const warnings = contrastWarnings(this.draft[this.editing], this.editing);
        const status = root.querySelector('[data-status]');
        status.textContent = warnings.length ? `Низкий контраст: ${warnings.join('; ')}. Поправьте эти цвета, если текст или элементы плохо читаются.` : 'Контраст текста и акцентов в норме.';
    }
    activateListeners(html) {
        super.activateListeners(html);
        const root = html[0];
        if (!root)
            return;
        this.preview(root);
        root.querySelector('[name="overrideSystem"]')?.addEventListener('change', () => { this.readDraft(root); this.editing = effectiveThemeMode(this.draft); this.render(false); });
        root.querySelector('[name="mode"]')?.addEventListener('change', () => {
            this.readDraft(root);
            this.editing = effectiveThemeMode(this.draft);
            this.render(false);
        });
        root.querySelectorAll('[data-pneuma-preset]').forEach(button => button.addEventListener('click', () => {
            this.readDraft(root);
            const preset = PNEUMA_PRESETS[Number(button.dataset.pneumaPreset)];
            if (preset)
                this.loadPreset(preset.theme);
        }));
        root.querySelectorAll('[data-load-preset]').forEach(button => button.addEventListener('click', () => {
            this.readDraft(root);
            const preset = normalizePersonalPresets(game.user?.getFlag(MODULE, 'themePresets'))[Number(button.dataset.loadPreset)];
            if (preset)
                this.loadPreset(preset.theme);
        }));
        root.querySelectorAll('[data-save-preset]').forEach(button => button.addEventListener('click', async () => {
            if (!form?.reportValidity())
                return;
            this.readDraft(root);
            const index = Number(button.dataset.savePreset);
            const slots = normalizePersonalPresets(game.user?.getFlag(MODULE, 'themePresets'));
            slots[index] = { name: root.querySelector(`[data-preset-name="${index}"]`).value.trim().slice(0, 32) || `Моя тема ${index + 1}`, theme: structuredClone(this.draft) };
            try {
                await game.user.setFlag(MODULE, 'themePresets', slots);
                this.render(false);
            }
            catch (error) {
                root.querySelector('[data-status]').textContent = `Не удалось сохранить пресет: ${String(error)}`;
            }
        }));
        root.querySelector('[data-disable-theme]')?.addEventListener('click', async () => {
            const saved = normalizeTheme(game.settings.get(MODULE, 'customTheme'));
            saved.enabled = false;
            if (liveDraft?.owner === this)
                liveDraft = undefined;
            await game.settings.set(MODULE, 'customTheme', saved);
            applyCustomTheme();
            this.draft.enabled = false;
            root.querySelector('[data-status]').textContent = 'Своя палитра выключена. Действуют стандартные цвета.';
        });
        const form = root.matches('form') ? root : root.querySelector('form');
        root.querySelectorAll('[data-function]').forEach(button => button.addEventListener('click', () => {
            if (!form?.reportValidity())
                return;
            this.readDraft(root);
            this.manual = !this.manual;
            this.draft.method = this.manual ? 'manual' : 'simple';
            this.render(false);
        }));
        root.querySelectorAll('[data-picker]').forEach(picker => picker.addEventListener('input', () => {
            root.querySelector(`[name="${picker.dataset.picker}"]`).value = picker.value;
            this.readDraft(root);
            if (picker.dataset.picker === 'main' && !this.manual) {
                this.seed = picker.value;
                this.draft.seed = this.seed;
                this.draft.light = generatePalette(this.seed, 'light');
                this.draft.dark = generatePalette(this.seed, 'dark');
            }
            this.preview(root);
        }));
        root.querySelectorAll('[data-hex]').forEach(input => input.addEventListener('input', () => {
            if (/^#[0-9a-f]{6}$/i.test(input.value)) {
                root.querySelector(`[data-picker="${input.name}"]`).value = input.value;
                this.readDraft(root);
                if (input.name === 'main' && !this.manual) {
                    this.seed = input.value;
                    this.draft.seed = this.seed;
                    this.draft.light = generatePalette(this.seed, 'light');
                    this.draft.dark = generatePalette(this.seed, 'dark');
                }
                this.preview(root);
            }
        }));
        root.querySelector('[data-generate]')?.addEventListener('click', () => {
            if (!form?.reportValidity())
                return;
            this.readDraft(root);
            this.draft[this.editing] = generatePalette(this.draft[this.editing].main, this.editing);
            this.render(false);
        });
        root.querySelector('[data-reset]')?.addEventListener('click', () => {
            this.readDraft(root);
            this.draft[this.editing] = { ...DEFAULT_THEME[this.editing] };
            this.render(false);
        });
        root.querySelector('[data-cancel]')?.addEventListener('click', () => { void this.close(); });
    }
    loadPreset(theme) {
        const mode = this.draft.mode;
        this.draft = normalizeTheme(theme);
        this.draft.mode = mode;
        this.manual = this.draft.method === 'manual';
        this.seed = this.draft.seed;
        this.render(false);
    }
    async close(options) {
        if (liveDraft?.owner === this) {
            liveDraft = undefined;
            applyCustomTheme();
        }
        await super.close(options);
    }
    async _updateObject(_event, data) {
        const next = structuredClone(this.draft);
        for (const { key } of COLOR_ROLES) {
            if (!this.manual)
                break;
            const value = String(data[key]);
            if (!/^#[0-9a-f]{6}$/i.test(value))
                throw Error('Используйте шестизначные hex-цвета, например #4d771f.');
            next[this.editing][key] = value.toLowerCase();
        }
        // Applying explicitly activates the theme; saving a palette cannot silently disable it.
        next.enabled = true;
        next.mode = data.overrideSystem ? data.mode : 'automatic';
        await game.settings.set(MODULE, 'customTheme', normalizeTheme(next));
        if (liveDraft?.owner === this)
            liveDraft = undefined;
        applyCustomTheme();
    }
}
export function registerThemeCustomizer() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = foundry.utils.getRoute(`modules/${MODULE}/visual/theme-customizer.css`);
    document.head.append(link);
    game.settings.register(MODULE, 'customTheme', { name: 'Своя цветовая тема', scope: 'client', config: false, type: Object, default: structuredClone(DEFAULT_THEME), onChange: async (theme) => { applyCustomTheme(); if (game.settings.get(MODULE, 'customThemeEnabled') !== theme.enabled)
            await game.settings.set(MODULE, 'customThemeEnabled', theme.enabled); } });
    game.settings.register(MODULE, 'customThemeEnabled', { name: 'Включить свои цвета', hint: 'Использовать сохранённую палитру. Если выключить, цвета и пресеты сохранятся.', scope: 'client', config: true, type: Boolean, default: normalizeTheme(game.settings.get(MODULE, 'customTheme')).enabled, onChange: async (enabled) => { const theme = normalizeTheme(game.settings.get(MODULE, 'customTheme')); if (theme.enabled !== enabled)
            await game.settings.set(MODULE, 'customTheme', { ...theme, enabled }); } });
    game.settings.registerMenu(MODULE, 'themeCustomizer', { name: 'Своя цветовая тема', label: 'Настроить цвета', hint: 'Восемь акцентных цветов с отдельными светлой и тёмной палитрами — для этого игрока.', icon: 'fas fa-palette', type: ThemeCustomizer, restricted: false });
    Hooks.once('ready', () => {
        applyCustomTheme();
        const observer = new MutationObserver(() => {
            if (liveDraft)
                return;
            const theme = normalizeTheme(game.settings.get(MODULE, 'customTheme'));
            if (theme.enabled && effectiveThemeMode(theme) !== activeMode)
                applyCustomTheme();
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-cpr-theme'] });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });
}
