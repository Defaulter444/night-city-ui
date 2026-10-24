import { registerChatCards } from "./chat-cards.js";
import { ensureChatStyles } from "./chat-styles.js";
import { registerChatDice } from './chat-dice.js';
import { registerChatDiceMenu } from './chat-dice-settings.js';
import { RELEASE_FEATURES } from './release-features.js';
import { registerScenePreviews } from './scene-preview.js';
import { registerAudioTools } from './audio-tools.js';
import { registerWindowEscapeProtection } from './sidebar-escape.js';
import { registerThemeCustomizer } from './theme-customizer.js';
import { registerVisualSettings } from "./settings-layout.js";
import { registerSubstanceEffects } from './substance-effects.js';
import { registerHumanityEffects } from './humanity-effects.js';
import { registerTokenEffects } from './token-effects.js';
import { registerElectricalEffects } from './electrical-effects.js';
import { registerFlashbangEffects } from './flashbang-effects.js';
import { registerRemainingEffects } from './remaining-effects.js';
import { registerFireEffects } from './fire-effects.js';
import { registerIntrusionEffects } from './intrusion-effects.js';
import { registerEffectsPreview } from './effects-preview.js';
const MODULE_ID = "night-city-ui";
/** The original Pneuma Visual Tools would draw the same overlays and chat skins twice. */
const ORIGINAL_MODULE = "pneuma-visualtools";
Hooks.once("init", async () => {
    if (game.modules?.get(ORIGINAL_MODULE)?.active) {
        Hooks.once("ready", () => {
            if (game.user?.isGM)
                ui.notifications?.warn("Визуальные инструменты Найт-Сити отключены: включён оригинальный Pneuma's Visual Tools. Выключите его, чтобы не было двойных эффектов.");
        });
        console.warn(MODULE_ID + " | visual layer skipped: " + ORIGINAL_MODULE + " is active");
        return;
    }
    registerThemeCustomizer();
    registerVisualSettings();
    if (game.settings.get(MODULE_ID, "scenePreviewsEnabled"))
        registerScenePreviews();
    if (game.settings.get(MODULE_ID, "audioToolsEnabled"))
        registerAudioTools();
    registerWindowEscapeProtection();
    if (RELEASE_FEATURES.chatCards) {
        ensureChatStyles(import.meta.url);
        registerChatCards();
    }
    if (RELEASE_FEATURES.chatDice) {
        registerChatDice();
        registerChatDiceMenu();
    }
    // Foundry does not await init hook promises. Register settings before yielding.
    for (const [name, register] of [
        ['Substance effects', registerSubstanceEffects],
        ['Humanity effects', registerHumanityEffects],
        ['Token effects', registerTokenEffects],
        ['Electrical effects', registerElectricalEffects],
        ['Flashbang effects', registerFlashbangEffects],
        ['Remaining effects', registerRemainingEffects],
        ['Fire effects', registerFireEffects],
        ['Intrusion effects', registerIntrusionEffects],
        ['Effect previews', registerEffectsPreview],
    ]) {
        try {
            register();
        }
        catch (error) {
            console.error(`${MODULE_ID} | ${name} initialization failed`, error);
        }
    }
    // Lazy imports keep unfinished modules and their settings/hooks out of initialization.
    if (RELEASE_FEATURES.weaponEffects)
        (await import('./weapon-effects.js')).registerWeaponEffects();
    console.info(MODULE_ID + " | visual layer initialized");
});
