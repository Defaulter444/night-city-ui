import { weaponSilhouette } from "./weapon-silhouettes.js";
import { bindChatPortraitControls } from "./chat-portrait-controls.js";
/** MIGRATION: optional weapon artwork. Fail closed if settings/documents are absent,
 * the saved title conceals the item, or the viewer cannot inspect the actor. */
function weaponImage(data) {
    if (!data.attacker || !data.weaponId)
        return "";
    try {
        if (game.settings.get("redline-combat", "hideAttackWeapon") !== false)
            return "";
        const token = fromUuidSync(data.attacker);
        if (token?.documentName !== "Token")
            return "";
        const doc = token;
        if (doc.hidden && !game.user.isGM)
            return "";
        const actor = doc.actor;
        if (!actor || !actor.testUserPermission(game.user, "LIMITED"))
            return "";
        const item = actor.items.get(data.weaponId);
        if (!item || item.name !== data.title)
            return "";
        const type = item.system.weaponType;
        return weaponSilhouette(data.title, type);
    }
    catch {
        return "";
    }
}
function defenderImage(data, options) {
    try {
        const token = data.defender ? fromUuidSync(data.defender) : null;
        if (token?.documentName === "Token") {
            const doc = token;
            if (doc.hidden && !game.user.isGM)
                return { src: "" };
            return { src: options.choose(options.preference, doc.texture.src, doc.actor?.img, options.fallback), actor: doc.actor, token: doc };
        }
        const actor = data.defenderActor ? fromUuidSync(data.defenderActor) : null;
        if (actor?.documentName === "Actor" && actor.testUserPermission(game.user, "LIMITED")) {
            const doc = actor;
            return { src: options.choose(options.preference, doc.prototypeToken.texture.src, doc.img, options.fallback), actor: doc };
        }
    }
    catch { /* Deleted or unavailable documents must not break chat history. */ }
    return { src: "" };
}
export function decorateExchangeHeader(message, root, options) {
    if (!message.visible || message.isContentVisible === false || (message.blind && !game.user.isGM))
        return;
    const data = (message.flags ?? {})["redline-combat"]?.exchange;
    const content = root.querySelector(".message-content");
    if (!data || !content || root.querySelector(".pneuma-exchange-header")
        || ![data.attackerName, data.defenderName, data.title].every(value => typeof value === "string" && value.trim()))
        return;
    const row = document.createElement("div");
    row.className = "pneuma-exchange-header";
    for (const [index, value] of [data.attackerName, data.title, data.defenderName].entries()) {
        if (index) {
            const arrow = document.createElement("span");
            arrow.className = "pneuma-exchange-arrow";
            arrow.textContent = "→";
            row.append(arrow);
        }
        const label = document.createElement("span");
        label.className = ["pneuma-exchange-attacker", "pneuma-exchange-weapon", "pneuma-exchange-defender"][index];
        label.textContent = value;
        label.title = value;
        if (index === 1) {
            const src = weaponImage(data) || weaponSilhouette(data.title);
            if (src) {
                const img = document.createElement("span");
                img.className = "pneuma-exchange-weapon-image";
                img.setAttribute("aria-hidden", "true");
                img.style.maskImage = `url("${src}")`;
                label.prepend(img);
            }
        }
        row.append(label);
    }
    const { src, actor, token } = defenderImage(data, options);
    if (src) {
        const img = document.createElement("img");
        img.className = "pneuma-exchange-defender-image";
        img.alt = "";
        img.src = src;
        img.addEventListener("error", () => img.remove(), { once: true });
        row.append(img);
        if (actor?.uuid)
            bindChatPortraitControls(img, { actor: actor.uuid, token: token?.uuid });
    }
    content.prepend(row);
    root.classList.add("pneuma-has-exchange-header");
}
/** Visual Tools-only rail portrait adapter. Never resolve participants by name
 * or reveal hidden token art. Historical/unknown defenders get a placeholder. */
export function decorateRailDefender(message, root, options) {
    const rail = root.querySelector('.pneuma-participant-rail');
    const name = rail?.querySelector('.pneuma-exchange-defender');
    if (!rail || !name || !message.visible || message.isContentVisible === false || (message.blind && !game.user.isGM))
        return;
    // Grenade is an action object, not a defending actor.
    if (root.querySelector('.pneuma-aoe-card'))
        return;
    let image = rail.querySelector('.pneuma-exchange-defender-image');
    if (!image) {
        const flags = message.flags?.['redline-combat'];
        const data = flags?.exchange ?? {
            attackerName: '', defenderName: '', title: '',
            defender: flags?.grapple?.target?.token ?? flags?.grappleParticipants?.target?.token ?? (['jackIn', 'quickhack', 'breach'].includes(flags?.quickhack?.type ?? '') ? flags?.quickhack?.targetTokenUuid : undefined),
            defenderActor: flags?.grapple?.target?.actor ?? flags?.grappleParticipants?.target?.actor ?? (['jackIn', 'quickhack', 'breach'].includes(flags?.quickhack?.type ?? '') ? flags?.quickhack?.targetActorUuid : undefined),
        };
        image = document.createElement('img');
        image.className = 'pneuma-exchange-defender-image';
        image.alt = '';
        const { src, actor, token } = defenderImage(data, options);
        image.src = src || 'icons/svg/mystery-man.svg';
        if (actor?.uuid)
            bindChatPortraitControls(image, { actor: actor.uuid, token: token?.uuid });
        image.addEventListener('error', () => { if (!image.src.endsWith('/icons/svg/mystery-man.svg'))
            image.src = 'icons/svg/mystery-man.svg'; });
    }
    name.after(image);
}
