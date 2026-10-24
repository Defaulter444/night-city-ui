import { currentFlashSettings, flashProfiles, normalizeFlashSettings } from './weapon-light-config.js';
export class WeaponLightSettings extends FormApplication {
    constructor() { super({}); }
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, { id: 'pneuma-weapon-light-settings', title: 'Вспышки света при атаках',
            template: 'modules/night-city-ui/visual/weapon-light-settings.hbs', width: 500, height: 560, resizable: true, closeOnSubmit: false,
            scrollY: ['.pvt-light-profiles'] });
    }
    getData() {
        const settings = currentFlashSettings();
        return { matchAmmo: settings.matchAmmo, profiles: flashProfiles.map(([id, name]) => ({ id, name, hasBlastArea: ['grenade', 'rocket'].includes(id), ...settings.profiles[id] })),
            units: canvas.scene?.grid?.units || 'scene units' };
    }
    activateListeners(html) {
        super.activateListeners(html);
        const root = html[0];
        if (!root)
            return;
        const match = root.querySelector('[name="matchAmmo"]');
        const sync = () => root.querySelectorAll('[data-flash-color]').forEach(group => { group.inert = !!match?.checked; group.style.opacity = match?.checked ? '.5' : ''; });
        match?.addEventListener('change', sync);
        sync();
        for (const id of ['grenade', 'rocket']) {
            const automatic = root.querySelector(`[name="profiles.${id}.autoRadius"]`);
            const syncRadius = () => root.querySelectorAll(`[name="profiles.${id}.bright"],[name="profiles.${id}.dim"]`).forEach(input => { input.readOnly = !!automatic?.checked; });
            automatic?.addEventListener('change', syncRadius);
            syncRadius();
        }
    }
    async _updateObject(_event, formData) {
        if (!game.user?.isGM)
            return;
        const data = normalizeFlashSettings(foundry.utils.expandObject(formData), canvas.scene?.grid?.distance || 2);
        await game.settings.set('night-city-ui', 'weaponLightSettings', data);
        await this.close();
    }
}
export function registerWeaponLightSettings() {
    game.settings.register('night-city-ui', 'weaponLightSettings', { scope: 'world', config: false, type: Object,
        default: { matchAmmo: false, profiles: {} } });
    game.settings.register('night-city-ui', 'weaponLighting', { name: 'Свет от атак', hint: 'Мастер: общий выключатель дульных вспышек, вспышек взрывов и света летящих ракет.', scope: 'world', config: true, type: Boolean, default: true, onChange: () => Hooks.callAll('pneumaWeaponLightingChanged') });
    game.settings.register('night-city-ui', 'weaponLightVision', { name: 'Даёт обзор', hint: 'Мастер: свет атак даёт штатный обзор во время вспышек и полёта ракет. Для новых атак.', scope: 'world', config: true, type: Boolean, default: false });
    game.settings.registerMenu('night-city-ui', 'weaponLightMenu', { name: 'Вспышки света при атаках', label: 'Настроить вспышки',
        hint: 'Мастер: цвет, яркость и радиусы яркого и тусклого света для каждого типа вспышки. Можно подстроить под цвета боеприпасов в анимации. Для новых атак.',
        icon: 'fas fa-lightbulb', type: WeaponLightSettings, restricted: true });
}
