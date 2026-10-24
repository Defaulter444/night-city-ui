import { decorateExchangeHeader, decorateRailDefender } from "./exchange-header.js";
import { arrangeChatCard, arrangeDamageSections, installRollPopovers } from "./chat-presentation.js";
import { bindChatPortraitControls } from "./chat-portrait-controls.js";
const MODULE_ID = "night-city-ui";
declare global {
  interface SettingConfig {
    "night-city-ui.chatCards": boolean;
    "night-city-ui.chatSkin": string;
    "night-city-ui.chatPortraitSource": string;
    "night-city-ui.chatFallbackImage": string;
  }
}

const localize = (key: string) => game.i18n!.localize(key);

/** Visual Tools owns skin selection; update presentation without re-rendering
 * chat or disturbing Combat Tools handlers and expanded roll details. */
function applyChatSkin(root: HTMLElement, skin: string): void {
  const nativePalette = skin === "technical" || skin === "redline" || skin === "compact";
  root.classList.toggle("pneuma-theme-technical", nativePalette);
  root.classList.toggle("pneuma-skin-compact", skin === "compact" || skin === "compact-hub");
  root.classList.remove("pneuma-theme-redline", "pneuma-theme-header");
  root.classList.toggle("pneuma-theme-cyberpunk", !nativePalette);
  arrangeDamageSections(root);
}

/** Ignore unresolved wildcard textures and Foundry's default placeholder. */
export function portraitPath(value: string | null | undefined): string {
  const path = value?.trim() ?? "";
  return !path || path.includes("*") || path.includes("icons/svg/mystery-man.svg") ? "" : path;
}

export function choosePortrait(preference: string, token: string | null | undefined,
  actor: string | null | undefined, fallback: string): string {
  return (preference === "actor" ? portraitPath(actor) || portraitPath(token)
    : portraitPath(token) || portraitPath(actor)) || fallback.trim();
}

function portraitFor(message: ChatMessage): {src: string; actor?: string; token?: string} {
  const speaker = message.speaker;
  const token = speaker.scene && speaker.token
    ? game.scenes?.get(speaker.scene)?.tokens.get(speaker.token) : undefined;
  const ordinary = !message.isRoll && [CONST.CHAT_MESSAGE_STYLES.OOC,
    CONST.CHAT_MESSAGE_STYLES.IC, CONST.CHAT_MESSAGE_STYLES.EMOTE].some(style => style === message.style);
  // OOC chat and whispers commonly save only an alias. Use the author, never
  // the viewing client's selected token or assigned character.
  const actor = token?.actor ?? (speaker.actor ? game.actors?.get(speaker.actor) : undefined)
    ?? (ordinary ? message.author?.character : undefined);
  const src = choosePortrait(game.settings!.get(MODULE_ID, "chatPortraitSource"),
    token?.texture.src ?? actor?.prototypeToken.texture.src, actor?.img,
    (ordinary ? portraitPath(message.author?.avatar) : "") || game.settings!.get(MODULE_ID, "chatFallbackImage"));
  return {src, actor: actor?.uuid, token: token?.uuid};
}

export function renderChatCard(message: ChatMessage, root: HTMLElement): void {
  if (game.settings!.get(MODULE_ID, 'chatSkin') === 'off') return;
  const header = root.querySelector<HTMLElement>(".message-header");
  // Never reconstruct a header or content removed by native visibility handling.
  if (!header || root.classList.contains("pneuma-chat-card") || root.style.display === "none") return;
  if (!message.visible || message.isContentVisible === false || (message.blind && !game.user!.isGM)) return;
  root.classList.add("pneuma-chat-card");
  // Shared layout, separate palette. Keep this setting in Visual Tools if the
  // annotated exchange renderer migrates to Combat Tools.
  applyChatSkin(root, game.settings!.get(MODULE_ID, "chatSkin"));
  const portrait = document.createElement("div");
  portrait.className = "pneuma-chat-portrait";
  portrait.setAttribute("aria-hidden", "true");
  const {src, actor, token} = portraitFor(message);
  if (src) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = src;
    img.addEventListener("error", () => {
      const fallback = game.settings!.get(MODULE_ID, "chatFallbackImage").trim();
      if (fallback && img.getAttribute("src") !== fallback) img.src = fallback;
      else img.remove();
    });
    portrait.append(img);
    if (actor) bindChatPortraitControls(portrait, {actor, token});
  }
  header.prepend(portrait);
  // Joining these two surfaces creates a stepped outline without covering the action.
  const identity = document.createElement("div");
  identity.className = "pneuma-chat-identity";
  for (const child of Array.from(header.children)) {
    if (child !== portrait) identity.append(child);
  }
  header.append(identity);

  // Move actual nodes, preserving native delegated and direct event handlers.
  const action = root.querySelector<HTMLElement>(".message-content > .rollcard > .rollcard-top");
  if (action) {
    action.classList.add("pneuma-chat-action");
    header.append(action);
  }
  // MIGRATION: exchange-only DOM enrichment; see exchange-header.ts and docs/combat-header-migration.md.
  decorateExchangeHeader(message, root, {
    preference: game.settings!.get(MODULE_ID, "chatPortraitSource"),
    fallback: game.settings!.get(MODULE_ID, "chatFallbackImage"), choose: choosePortrait,
  });
  const recipients = header.querySelector<HTMLElement>(".whisper-to");
  if (recipients) {
    recipients.classList.add("pneuma-chat-recipients");
    recipients.hidden = true;
    const metadata = header.querySelector(".message-metadata") ?? header;
    let tag = metadata.querySelector<HTMLElement>(".chat-mode-indicator");
    if (!tag) {
      tag = document.createElement("span");
      tag.className = "chat-mode-indicator";
      const self = message.whisper.length === 1 && message.whisper[0] === message.author?.id;
      tag.textContent = localize(message.blind ? "CPR.chat.blind" : self ? "CPR.chat.self" : "CPR.chat.whisper");
      metadata.prepend(tag);
    }
    tag.classList.add("pneuma-chat-privacy");
    tag.setAttribute("role", "button");
    tag.tabIndex = 0;
    tag.setAttribute("aria-expanded", "false");
    tag.title = localize("NIGHT_CITY_VISUAL.ChatRecipients");
    let pinned = false;
    const reveal = (visible: boolean) => {
      recipients.hidden = !visible;
      tag!.setAttribute("aria-expanded", String(visible));
    };
    const toggle = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      pinned = !pinned; reveal(pinned);
    };
    tag.addEventListener("click", toggle);
    tag.addEventListener("mouseenter", () => reveal(true));
    tag.addEventListener("focus", () => reveal(true));
    tag.addEventListener("mouseleave", event => {
      if (!pinned && !(event.relatedTarget instanceof Node && recipients.contains(event.relatedTarget))) reveal(false);
    });
    recipients.addEventListener("mouseleave", event => {
      if (!pinned && !(event.relatedTarget instanceof Node && tag!.contains(event.relatedTarget))) reveal(false);
    });
    tag.addEventListener("blur", () => { if (!pinned) reveal(false); });
    tag.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") toggle(event);
      if (event.key === "Escape") { pinned = false; reveal(false); }
    });
  }
}

const chatSkinOrder = ["cyberpunk", "compact-hub", "technical", "compact", "off"] as const;
let appliedSkin = 'cyberpunk';
let skinChanges: Promise<unknown> = Promise.resolve();
let skinRefresh: Promise<void> = Promise.resolve();

/** ChatLog.render deliberately skips an already rendered v12 log. Rebuild only
 * mounted messages with native getHTML, leaving the composer and scroll intact. */
async function refreshMountedChatCards(): Promise<void> {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('.chat-message[data-message-id]'));
  const scroll = Array.from(document.querySelectorAll<HTMLElement>('#chat-log, #chat-log-popout'))
    .map(root => ({root, top: root.scrollTop}));
  try {
    for (const root of roots) {
      const message = game.messages?.get(root.dataset.messageId!);
      if (!message || !root.isConnected) continue;
      const html = await message.getHTML();
      if (root.isConnected) root.replaceWith(...Array.from(html));
    }
  } finally {
    for (const {root, top} of scroll) if (root.isConnected) root.scrollTop = top;
  }
}
export function registerChatCards(): void {
  game.keybindings!.register(MODULE_ID, "cycleChatSkin", {
    name: "Переключить оформление чата",
    hint: "По кругу переключает четыре оформления чата и режим «выкл.» на этом клиенте. Уже показанные карточки обновляются сразу.",
    editable: [{key:"KeyC", modifiers:["Alt", "Shift"]}],
    restricted: false, repeat: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
    onUp: () => !!game.settings!.get(MODULE_ID, "chatCards"),
    onDown: () => {
      if (!game.settings!.get(MODULE_ID, "chatCards")) return false;
      skinChanges = skinChanges.catch(() => {}).then(async () => {
        const current = game.settings!.get(MODULE_ID, "chatSkin");
        const index = chatSkinOrder.indexOf(current as typeof chatSkinOrder[number]);
        await game.settings!.set(MODULE_ID, "chatSkin", chatSkinOrder[(index + 1) % chatSkinOrder.length]!);
        await skinRefresh;
      }).catch(error => { console.error(MODULE_ID, error); ui.notifications!.error("Не удалось сменить оформление чата."); });
      return true;
    },
  });
  game.settings!.register(MODULE_ID, "chatSkin", {
    name: "NIGHT_CITY_VISUAL.ChatSkinName", hint: "NIGHT_CITY_VISUAL.ChatSkinHint",
    scope: "client", config: true, type: String, default: "cyberpunk",
    choices: { cyberpunk: "NIGHT_CITY_VISUAL.ChatSkinCyberpunk", "compact-hub": "NIGHT_CITY_VISUAL.ChatSkinCompactHub", technical: "NIGHT_CITY_VISUAL.ChatSkinTechnical", compact: "NIGHT_CITY_VISUAL.ChatSkinCompact", off: "Выкл. (горячая клавиша)" },
    onChange: (skin: string) => {
      const rebuild = skin === 'off' || appliedSkin === 'off';
      appliedSkin = skin;
      if (rebuild) {
        document.getElementById('pneuma-roll-popover')?.remove();
        document.querySelectorAll<HTMLElement>('.pneuma-chat-composer, #chat, #chat-popout').forEach(root => {
          root.classList.toggle('pneuma-chat-composer', skin !== 'off');
          if (skin === 'off') root.classList.remove('pneuma-theme-technical', 'pneuma-theme-cyberpunk', 'pneuma-skin-compact');
          else applyChatSkin(root, skin);
        });
        skinRefresh = skinRefresh.catch(() => {}).then(refreshMountedChatCards);
        return skinRefresh;
      }
      document.querySelectorAll<HTMLElement>(".chat-message.pneuma-chat-card, .pneuma-chat-composer")
        .forEach(root => applyChatSkin(root, skin));
    },
  });
  appliedSkin = game.settings!.get(MODULE_ID, 'chatSkin') || 'cyberpunk';
  game.settings!.register(MODULE_ID, "chatCards", {
    name: "NIGHT_CITY_VISUAL.ChatCardsName", hint: "NIGHT_CITY_VISUAL.ChatCardsHint",
    scope: "client", config: true, type: Boolean, default: true, requiresReload: true,
  });
  game.settings!.register(MODULE_ID, "chatPortraitSource", {
    name: "NIGHT_CITY_VISUAL.ChatPortraitSourceName", hint: "NIGHT_CITY_VISUAL.ChatPortraitSourceHint",
    // Foundry world settings are GM-controlled and shared by every client.
    scope: "world", config: true, type: String, default: "token", requiresReload: true,
    choices: { token: "NIGHT_CITY_VISUAL.ChatTokenImage", actor: "NIGHT_CITY_VISUAL.ChatActorImage" },
  });
  game.settings!.register(MODULE_ID, "chatFallbackImage", {
    name: "NIGHT_CITY_VISUAL.ChatFallbackImageName", hint: "NIGHT_CITY_VISUAL.ChatFallbackImageHint",
    scope: "world", config: true, type: String, default: "", requiresReload: true,
  });
  // Register during init: saved chat history is rendered before the ready hook.
  Hooks.on("renderChatLog", (_app: unknown, html: JQuery) => {
    const root = html[0];
    if (!root || !game.settings!.get(MODULE_ID, "chatCards") || game.settings!.get(MODULE_ID, 'chatSkin') === 'off') return;
    root.classList.add('pneuma-chat-composer');
    applyChatSkin(root, game.settings!.get(MODULE_ID, "chatSkin"));
  });
  Hooks.on("renderChatMessage", (message: ChatMessage, html: JQuery) => {
    if (game.settings!.get(MODULE_ID, "chatCards") && game.settings!.get(MODULE_ID, 'chatSkin') !== 'off' && html[0]) {
      renderChatCard(message, html[0]);
      if (html[0].classList.contains('pneuma-chat-card')) {
        if (!html[0].classList.contains('pneuma-layout-participants')) arrangeChatCard(html[0], message);
        decorateRailDefender(message, html[0], {
          preference: game.settings!.get(MODULE_ID, 'chatPortraitSource'),
          fallback: game.settings!.get(MODULE_ID, 'chatFallbackImage'), choose: choosePortrait,
        });
        installRollPopovers(html[0]);
      }
    }
  });
}
