import { weaponSilhouette } from "./weapon-silhouettes.js";
import { bindChatPortraitControls } from "./chat-portrait-controls.js";
/** MIGRATION: Combat Tools presentation adapter, not combat logic.
 * Move this renderer with the marked CSS block if Combat Tools takes ownership.
 * Contract: flags.redline-combat.exchange (names, title, defender UUIDs).
 * Use the saved title; artwork lookup must honor hideAttackWeapon and title match.
 * Never update message flags/content or replace native controls.
 */
interface ExchangeHeaderData {
  attackerName: string; defenderName: string; title: string;
  defender?: string; defenderActor?: string; attacker?: string; weaponId?: string;
}
interface PortraitOptions {
  preference: string; fallback: string;
  choose: (preference: string, token: string | null | undefined,
    actor: string | null | undefined, fallback: string) => string;
}

/** MIGRATION: optional weapon artwork. Fail closed if settings/documents are absent,
 * the saved title conceals the item, or the viewer cannot inspect the actor. */
function weaponImage(data: ExchangeHeaderData): string {
  if (!data.attacker || !data.weaponId) return "";
  try {
    if ((game.settings!.get as (module: string, key: string) => unknown)("redline-combat", "hideAttackWeapon") !== false) return "";
    const token = fromUuidSync(data.attacker as Parameters<typeof fromUuidSync>[0]);
    if (token?.documentName !== "Token") return "";
    const doc = token as TokenDocument;
    if (doc.hidden && !game.user!.isGM) return "";
    const actor = doc.actor;
    if (!actor || !actor.testUserPermission(game.user!, "LIMITED")) return "";
    const item = actor.items.get(data.weaponId);
    if (!item || item.name !== data.title) return "";
    const type = (item.system as {weaponType?: string}).weaponType;
    return weaponSilhouette(data.title, type);
  } catch { return ""; }
}

function defenderImage(data: ExchangeHeaderData, options: PortraitOptions): {src: string; actor?: Actor | null; token?: TokenDocument} {
  try {
    const token = data.defender ? fromUuidSync(data.defender as Parameters<typeof fromUuidSync>[0]) : null;
    if (token?.documentName === "Token") {
      const doc = token as TokenDocument;
      if (doc.hidden && !game.user!.isGM) return {src: ""};
      return {src: options.choose(options.preference, doc.texture.src, doc.actor?.img, options.fallback), actor: doc.actor, token: doc};
    }
    const actor = data.defenderActor ? fromUuidSync(data.defenderActor as Parameters<typeof fromUuidSync>[0]) : null;
    if (actor?.documentName === "Actor" && (actor as Actor).testUserPermission(game.user!, "LIMITED")) {
      const doc = actor as Actor;
      return {src: options.choose(options.preference, doc.prototypeToken.texture.src, doc.img, options.fallback), actor: doc};
    }
  } catch { /* Deleted or unavailable documents must not break chat history. */ }
  return {src: ""};
}

export function decorateExchangeHeader(message: ChatMessage, root: HTMLElement, options: PortraitOptions): void {
  if (!message.visible || message.isContentVisible === false || (message.blind && !game.user!.isGM)) return;
  const data = ((message.flags ?? {}) as Record<string, {exchange?: ExchangeHeaderData}>)["redline-combat"]?.exchange;
  const content = root.querySelector<HTMLElement>(".message-content");
  if (!data || !content || root.querySelector(".pneuma-exchange-header")
    || ![data.attackerName, data.defenderName, data.title].every(value => typeof value === "string" && value.trim())) return;
  const row = document.createElement("div");
  row.className = "pneuma-exchange-header";
  for (const [index, value] of [data.attackerName, data.title, data.defenderName].entries()) {
    if (index) {
      const arrow = document.createElement("span");
      arrow.className = "pneuma-exchange-arrow"; arrow.textContent = "→"; row.append(arrow);
    }
    const label = document.createElement("span");
    label.className = ["pneuma-exchange-attacker", "pneuma-exchange-weapon", "pneuma-exchange-defender"][index]!;
    label.textContent = value; label.title = value;
    if (index === 1) {
      const src = weaponImage(data) || weaponSilhouette(data.title);
      if (src) {
        const img = document.createElement("span"); img.className = "pneuma-exchange-weapon-image";
        img.setAttribute("aria-hidden", "true"); img.style.maskImage = `url("${src}")`;
        label.prepend(img);
      }
    }
    row.append(label);
  }
  const {src, actor, token} = defenderImage(data, options);
  if (src) {
    const img = document.createElement("img");
    img.className = "pneuma-exchange-defender-image"; img.alt = "";
    img.src = src; img.addEventListener("error", () => img.remove(), {once: true}); row.append(img);
    if (actor?.uuid) bindChatPortraitControls(img, {actor: actor.uuid, token: token?.uuid});
  }
  content.prepend(row);
  root.classList.add("pneuma-has-exchange-header");
}

/** Visual Tools-only rail portrait adapter. Never resolve participants by name
 * or reveal hidden token art. Historical/unknown defenders get a placeholder. */
export function decorateRailDefender(message: ChatMessage, root: HTMLElement, options: PortraitOptions): void {
  const rail = root.querySelector('.pneuma-participant-rail');
  const name = rail?.querySelector('.pneuma-exchange-defender');
  if (!rail || !name || !message.visible || message.isContentVisible === false || (message.blind && !game.user!.isGM)) return;
  // Grenade is an action object, not a defending actor.
  if (root.querySelector('.pneuma-aoe-card')) return;
  let image = rail.querySelector<HTMLImageElement>('.pneuma-exchange-defender-image');
  if (!image) {
    const flags = (message.flags as Record<string, {
      exchange?: ExchangeHeaderData;
      grapple?: {target?: {token?: string; actor?: string}};
      grappleParticipants?: {target?: {token?: string; actor?: string}};
      quickhack?: {type?: string; targetTokenUuid?: string; targetActorUuid?: string};
    }>)?.['redline-combat'];
    const data = flags?.exchange ?? {
      attackerName: '', defenderName: '', title: '',
      defender: flags?.grapple?.target?.token ?? flags?.grappleParticipants?.target?.token ?? (['jackIn', 'quickhack', 'breach'].includes(flags?.quickhack?.type ?? '') ? flags?.quickhack?.targetTokenUuid : undefined),
      defenderActor: flags?.grapple?.target?.actor ?? flags?.grappleParticipants?.target?.actor ?? (['jackIn', 'quickhack', 'breach'].includes(flags?.quickhack?.type ?? '') ? flags?.quickhack?.targetActorUuid : undefined),
    };
    image = document.createElement('img'); image.className = 'pneuma-exchange-defender-image'; image.alt = '';
    const {src, actor, token} = defenderImage(data, options);
    image.src = src || 'icons/svg/mystery-man.svg';
    if (actor?.uuid) bindChatPortraitControls(image, {actor: actor.uuid, token: token?.uuid});
    image.addEventListener('error', () => { if (!image!.src.endsWith('/icons/svg/mystery-man.svg')) image!.src = 'icons/svg/mystery-man.svg'; });
  }
  name.after(image);
}
