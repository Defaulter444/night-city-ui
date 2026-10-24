export const COLOR_ROLES = [
    { key: 'deep', label: 'Глубокий акцент', hint: 'Насыщенный текст акцента и обводки' },
    { key: 'main', label: 'Основной акцент', hint: 'Активные вкладки, кнопки и рамки' },
    { key: 'middle', label: 'Средний акцент', hint: 'Наведение и отклик элементов' },
    { key: 'bright', label: 'Яркий акцент', hint: 'Заголовки разделов и плашки' },
    { key: 'pale', label: 'Бледный акцент', hint: 'Текст выделенной вкладки' },
    { key: 'name', label: 'Имена в чате', hint: 'Имена отправителей на фоне чата' },
    { key: 'odd', label: 'Тонированная строка 1', hint: 'Чередующиеся строки и выбранные панели' },
    { key: 'even', label: 'Тонированная строка 2', hint: 'Другие чередующиеся строки и ссылки' },
];
export const DEFAULT_THEME = {
    enabled: false, mode: 'automatic', method: 'simple', seed: '#4d771f',
    light: { deep: '#263f0e', main: '#4d771f', middle: '#5f9028', bright: '#92d050', pale: '#b5ffa1', name: '#365a18', odd: '#d9e7cc', even: '#edf4e7' },
    dark: { deep: '#a9cf86', main: '#456b2a', middle: '#557c35', bright: '#78a84f', pale: '#9dcc7c', name: '#9dcc7c', odd: '#20271d', even: '#293126' },
};
export const NEUTRALS = {
    light: { surface0: '#ffffff', surface1: '#eeeeee', surface2: '#dddddd', surface3: '#cccccc', chat: '#c0c0c0', border: '#888888', text: '#222222', strong: '#111111', inactive: '#202020' },
    dark: { surface0: '#262626', surface1: '#222222', surface2: '#1b1b1b', surface3: '#151515', chat: '#202020', border: '#787878', text: '#e8e8e8', strong: '#ffffff', inactive: '#303030' },
};
export function normalizeTheme(value) {
    const v = (value && typeof value === 'object' ? value : {});
    const result = structuredClone(DEFAULT_THEME);
    result.enabled = v.enabled === true;
    result.mode = v.mode === 'light' || v.mode === 'dark' ? v.mode : 'automatic';
    result.method = v.method === 'manual' ? 'manual' : 'simple';
    if (typeof v.seed === 'string' && /^#[0-9a-f]{6}$/i.test(v.seed))
        result.seed = v.seed.toLowerCase();
    for (const mode of ['light', 'dark'])
        for (const { key } of COLOR_ROLES) {
            const color = v[mode]?.[key];
            if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
                result[mode][key] = color.toLowerCase();
        }
    return result;
}
export function contrast(a, b) {
    const luminance = (hex) => {
        const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
    };
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function onColor(background) {
    return contrast('#111111', background) >= contrast('#ffffff', background) ? '#111111' : '#ffffff';
}
function hsl(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
    const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l];
}
function hexHsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
    return `#${f(0)}${f(8)}${f(4)}`;
}
export function generatePalette(seed, mode) {
    const [h, s] = hsl(seed);
    const template = DEFAULT_THEME[mode];
    const result = { ...template, main: seed };
    for (const { key } of COLOR_ROLES) {
        const [, , tl] = hsl(template[key]);
        result[key] = hexHsl(h, s === 0 ? 0 : Math.min(.85, s * (key === 'odd' || key === 'even' ? .35 : 1)), tl);
    }
    const n = NEUTRALS[mode];
    const fit = (key, background, target) => {
        const [hue, saturation, lightness] = hsl(result[key]);
        const toward = contrast('#ffffff', background) > contrast('#111111', background) ? 1 : 0;
        for (let step = 1; contrast(result[key], background) < target && step <= 100; step++)
            result[key] = hexHsl(hue, saturation, lightness + (toward - lightness) * step / 100);
    };
    fit('main', n.surface2, 3);
    fit('middle', n.surface0, 3);
    fit('deep', n.surface3, 4.5);
    fit('name', n.chat, 4.5);
    fit('bright', '#111111', 4.5);
    fit('pale', result.main, 4.5);
    return result;
}
export function paletteVariables(p, mode) {
    const n = NEUTRALS[mode];
    const vars = {
        '--pgt-green-900': p.deep, '--pgt-green-700': p.main, '--pgt-green-600': p.middle, '--pgt-green-400': p.bright, '--pgt-green-200': p.pale,
        '--pgt-chat-name': p.name, '--pgt-row-odd': p.odd, '--pgt-row-even': p.even,
        '--pgt-surface-0': n.surface0, '--pgt-surface-1': n.surface1, '--pgt-surface-2': n.surface2, '--pgt-surface-3': n.surface3, '--pgt-surface-chat': n.chat,
        '--pgt-text': n.text, '--pgt-text-strong': n.strong, '--pgt-border-muted': n.border, '--pgt-tab-inactive': n.inactive,
        '--pgt-tab-text': onColor(p.main), '--pgt-text-inverse': onColor(p.main), '--pgt-roll-text': onColor(p.main),
        '--pgt-skill-header': p.bright, '--pgt-skill-pill': p.bright, '--pgt-skill-pill-text': onColor(p.bright),
        '--pgt-skill-text': n.strong, '--pgt-skill-input': n.surface0, '--pgt-skill-row-odd': n.surface2, '--pgt-skill-row-even': n.surface1,
        '--pgt-gear-row-odd': n.surface2, '--pgt-gear-row-even': n.surface1, '--pgt-section-header': '#111111',
        '--pgt-chat-border': p.main, '--pgt-ui-accent': p.main, '--pgt-ui-highlight': p.middle, '--pgt-focus-ring': `${p.main}73`,
        '--pvt-custom-on-hover': onColor(p.middle), '--pvt-custom-on-odd': onColor(p.odd), '--pvt-custom-on-even': onColor(p.even),
    };
    // Define native aliases at the same scope as the palette. Inherited root aliases
    // otherwise keep their already-resolved system colors, including red dividers.
    const groups = [
        [p.main, ['color-red', 'background-border', 'background-tab-active', 'background-chat-card-block', 'background-chat-border', 'background-dialog-border', 'background-foundry-hover', 'darkmode-main', 'pause-highlight1', 'text-content-link-icon', 'text-header-line', 'text-header-arrow', 'text-icon-highlight', 'background-toggle-checked', 'icon-actor-image-overlay-border']],
        [p.middle, ['background-editor-button-hover', 'darkmode-red']],
        [p.bright, ['background-pill', 'background-tab-underlay', 'text-header', 'pause-highlight2']],
        [p.pale, ['text-tab-highlight']],
        [p.odd, ['color-pink', 'background-row-odd', 'background-cyberdeck-section-header', 'background-dialog-selected', 'background-editor-button-selected', 'background-journal-blockquote', 'darkmode-bluish-grey']],
        [p.even, ['background-row-even', 'background-content-link']],
        [n.surface0, ['background-foundry-input', 'background-editor-button-active']],
        [n.surface1, ['color-white', 'background-chat-card-block-before', 'background-foundry-button']],
        [n.surface2, ['background-box', 'background-editor-button', 'darkmode-background']],
        [n.surface3, ['color-light-grey', 'background-window']],
        [n.chat, ['background-chat-card']],
        [n.border, ['color-dark-grey']],
        [n.inactive, ['background-tab-inactive']],
        ['#111111', ['background-header', 'background-editor-header', 'background-dialog-hr-gradient-start', 'background-dialog-hr-gradient-end', 'darkmode-header']],
        [p.main, ['background-dialog-hr-gradient-middle']],
        [n.text, ['text-chat-normal', 'text-normal', 'text-window', 'text-icon-normal', 'text-hint', 'text-foundry-hint', 'text-mook-normal', 'darkmode-text-main']],
        [n.strong, ['text-foundry-input', 'text-input']],
        [onColor(p.main), ['text-tab-normal', 'text-dir-list', 'text-editor-header', 'text-mook-header', 'text-mook-name', 'text-pause', 'pause-text', 'text-journal-table-header']],
        [onColor(p.bright), ['text-pill']],
        [p.middle, ['text-foundry-hover']],
        [mode === 'dark' ? '#ff5b6f' : '#b71924', ['text-chat-failure']],
        [mode === 'dark' ? '#64d98b' : '#287a35', ['text-chat-success']],
    ];
    for (const [value, keys] of groups)
        for (const key of keys)
            vars[`--cpr-${key}`] = value;
    return vars;
}
export function contrastWarnings(p, mode) {
    const n = NEUTRALS[mode];
    const checks = [
        ['Имена в чате', p.name, n.chat, 4.5], ['Текст глубокого акцента', p.deep, n.surface3, 4.5],
        ['Заголовки разделов', p.bright, '#111111', 4.5], ['Текст выделенной вкладки', p.pale, p.main, 4.5],
        ['Рамка основного акцента', p.main, n.surface2, 3], ['Акцент наведения', p.middle, n.surface0, 3],
    ];
    return checks.filter(([, a, b, target]) => contrast(a, b) < target).map(([label, a, b]) => `${label}: ${contrast(a, b).toFixed(1)}:1 контраст`);
}
