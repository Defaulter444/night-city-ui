import { createSubstanceOverlay } from './substance-overlay.js';
import { createSmashScreenOverlay } from './smash-overlay.js';
import { createHumanityOverlay } from './humanity-overlay.js';
import { createFlameOverlay } from './fire-overlay.js';
import { createElectricalOverlay } from './electrical-overlay.js';
import { createDazzleScreen } from './dazzle-screen.js';
import { createIntrusionGlitches } from './neural-glitch.js';
import { createPatternScreen } from './remaining-renderers.js';
import { patternKinds } from './remaining-effects.js';
import { setTokenPreview } from './effect-preview-state.js';
const MODULE = 'night-city-ui';
const choices = [['poison', 'Яд'], ['blueGlass', 'Blue Glass'], ['smash', 'Smash'], ['fire1', 'Горение — слабое'], ['fire2', 'Горение — сильное'], ['fire3', 'Горение — смертельное'], ['electrical', 'Электрошок'], ['emp', 'ЭМИ'], ['dazzle', 'Светошумовая / ослепление'], ['intrusion', 'Нейровторжение'], ['radiation', 'Радиация'], ['gas', 'Газ / слезоточивый газ'], ['blackLace', 'Black Lace'], ['boost', 'Boost'], ['synthcoke', 'Synthcoke'], ['berserker', 'Berserker'], ['primeTime', 'Prime Time'], ['sixgun', 'Sixgun'], ['timewarp', 'Timewarp'], ['choking1', 'Удушье 1'], ['choking2', 'Удушье 2'], ['dissociative', 'Диссоциация (только экран)'], ['psychopathy', 'Психопатия (только экран)'], ['cyberpsycho', 'Киберпсихоз (только экран)']];
let current, timer, touring = false, index = 0;
let open = () => { };
export function registerEffectsPreview() {
    const controllers = new Map();
    for (const kind of ['poison', 'blueGlass'])
        controllers.set(kind, createSubstanceOverlay(kind));
    controllers.set('smash', createSmashScreenOverlay());
    controllers.set('electrical', createElectricalOverlay());
    controllers.set('emp', createElectricalOverlay('emp'));
    controllers.set('dazzle', createDazzleScreen());
    for (const kind of patternKinds)
        controllers.set(kind, createPatternScreen(kind));
    for (const kind of ['dissociative', 'psychopathy', 'cyberpsycho']) {
        const overlay = createHumanityOverlay();
        controllers.set(kind, { start: () => overlay.start(kind), stop: overlay.stop });
    }
    for (const strength of [1, 2, 3]) {
        const overlay = createFlameOverlay();
        controllers.set(`fire${strength}`, { start: () => overlay.start(strength), stop: overlay.stop });
    }
    let intrusion = false;
    const glitch = createIntrusionGlitches(() => intrusion ? 'preview' : undefined);
    controllers.set('intrusion', { start: () => { intrusion = true; glitch.sync(); }, stop: () => { intrusion = false; glitch.stop(); } });
    const stop = () => { touring = false; if (timer !== undefined)
        clearTimeout(timer); timer = undefined; current?.stop(); current = undefined; setTokenPreview(undefined); };
    const show = (kind, mode = 'both', seconds = 15) => {
        stop();
        if (!choices.some(([key]) => key === kind))
            return;
        const screenOnly = ['dissociative', 'psychopathy', 'cyberpsycho'].includes(kind);
        const token = canvas.tokens?.controlled?.length === 1 ? canvas.tokens.controlled[0] : undefined;
        if (mode !== 'screen' && !screenOnly && !token) {
            ui.notifications.warn('Выберите один токен, чтобы посмотреть эффекты на токене.');
            if (mode === 'token')
                return;
        }
        if (mode !== 'token' || screenOnly) {
            current = controllers.get(kind);
            current?.start();
        }
        if (mode !== 'screen' && !screenOnly && token)
            setTokenPreview(token, kind === 'dazzle' ? 'dazzle:preview' : kind);
        timer = setTimeout(stop, Math.max(2, Math.min(120, seconds)) * 1000);
        ui.notifications.info(`Просмотр: ${choices.find(([key]) => key === kind)[1]}`);
    };
    const tour = (mode, seconds) => { index = 0; const next = () => { if (index >= choices.length) {
        stop();
        return;
    } show(choices[index++][0], mode, seconds); touring = true; if (timer !== undefined)
        clearTimeout(timer); timer = setTimeout(() => { if (touring)
        next(); }, Math.max(2, Math.min(120, seconds)) * 1000); }; next(); };
    open = () => { new Dialog({ title: 'Просмотр визуальных эффектов', content: `<p>Локальная проверка — видите только вы. Для эффектов на токене выделите один токен на карте. Эффекты Человечности — только на экране.</p><div class="form-group"><label>Эффект</label><select name="effect">${choices.map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></div><div class="form-group"><label>Где показать</label><select name="mode"><option value="both">Экран + выбранный токен</option><option value="screen">Только экран</option><option value="token">Только токен</option></select></div><div class="form-group"><label>Секунд на эффект</label><input name="seconds" type="number" value="15" min="2" max="120"></div><div style="display:flex;gap:6px;margin-top:12px"><button type="button" data-effect-preview>Показать</button><button type="button" data-effect-tour>Все по очереди</button><button type="button" data-effect-stop>Стоп</button></div>`, buttons: { close: { label: 'Закрыть' } }, render: html => { const root = html; const seconds = () => Number(root.find('[name=seconds]').val()) || 15; root.find('[data-effect-preview]').on('click', () => show(String(root.find('[name=effect]').val()), String(root.find('[name=mode]').val()), seconds())); root.find('[data-effect-tour]').on('click', () => tour(String(root.find('[name=mode]').val()), seconds())); root.find('[data-effect-stop]').on('click', stop); }, close: stop }).render(true); };
    class PreviewMenu extends FormApplication {
        constructor() { super({}); }
        async _updateObject(_event, _data) { }
        render(..._args) { open(); return this; }
    }
    game.settings.registerMenu(MODULE, 'effectsPreview', { name: 'Проверка визуальных эффектов', label: 'Просмотреть эффекты', hint: 'Покажите один эффект или прогоните все по очереди — только у вас. Акторы, предметы, бой и настройки не меняются.', icon: 'fas fa-eye', type: PreviewMenu, restricted: false });
    const module = game.modules.get(MODULE);
    module.api = { ...module.api, effectsPreview: { open: () => open(), show, stop, tour } };
    Hooks.on('canvasTearDown', stop);
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden)
        stop(); });
}
