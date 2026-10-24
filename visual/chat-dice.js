/** Artwork only. Read published face images; never evaluate or change rolls. */
const MODULE = 'night-city-ui';
export const diceFiles = [
    ...Array.from({ length: 10 }, (_, i) => `d10_${i + 1}`), 'd10_preem', 'd10_fail',
    ...Array.from({ length: 10 }, (_, i) => `critical_d10_${i + 1}`), 'critical_d10_preem', 'critical_d10_fail',
    ...Array.from({ length: 6 }, (_, i) => `d6_${i + 1}`), 'd6_6_preem',
];
const failed = new Set();
const states = new WeakMap();
const observed = new WeakSet();
export function diceSets() { return game.settings.get(MODULE, 'chatDiceSets') || []; }
export function selectedDiceSet() {
    return diceSets().find(set => set.id === game.settings.get(MODULE, 'chatDiceSet'));
}
export function bundledDicePath(file) { return `modules/${MODULE}/visual/dice-pneuma-${file}.webp`; }
export function customDicePath(set, file) { return `${set.folder.replace(/\/+$/, '')}/${file}.${set.extension}`; }
export function systemDie(source) {
    const match = source.match(/systems\/cyberpunk-red-core\/icons\/dice\/(black|red)\/(d10|d6)_(\d+)(?:_(preem|fail))?\.svg(?:[?#].*)?$/i);
    if (!match)
        return;
    const [, color, die, faceText, special] = match;
    const face = Number(faceText);
    if (face < 1 || face > (die === 'd10' ? 10 : 6))
        return;
    const file = die === 'd10' ? `${color === 'red' ? 'critical_' : ''}d10_${special || face}` : `d6_${face}${special === 'preem' && face === 6 ? '_preem' : ''}`;
    return { file, face, die: die };
}
function setImage(image, native, file) {
    let state = states.get(image);
    if (!state) {
        state = { native, candidates: [], index: 0 };
        states.set(image, state);
        image.addEventListener('error', () => {
            const current = states.get(image);
            if (image.getAttribute('src') !== current.candidates[current.index])
                return;
            failed.add(current.candidates[current.index]);
            const next = current.candidates[++current.index];
            if (next)
                image.setAttribute('src', next);
        });
    }
    const custom = selectedDiceSet();
    const enabled = game.settings.get(MODULE, 'chatDiceEnabled') && game.settings.get(MODULE, 'chatSkin') !== 'off';
    state.candidates = enabled ? [...(custom ? [customDicePath(custom, file)] : []), bundledDicePath(file), state.native].filter(path => !failed.has(path) || path === state.native) : [state.native];
    state.index = 0;
    if (image.getAttribute('src') !== state.candidates[0])
        image.setAttribute('src', state.candidates[0]);
}
export function replaceChatDice(root) {
    root.classList.toggle('pvt-chat-dice', game.settings.get(MODULE, 'chatDiceEnabled') && game.settings.get(MODULE, 'chatSkin') !== 'off');
    const images = Array.from(root.querySelectorAll('img[src]'));
    const data = images.map(image => ({ image, native: states.get(image)?.native || image.dataset.pvtDieOriginal || image.getAttribute('src') || '' }));
    for (const { image, native } of data) {
        const die = systemDie(native);
        if (!die)
            continue;
        image.dataset.pvtDieOriginal = native; // Copies used by saved-roll popovers retain their original image.
        let file = die.file;
        if (die.die === 'd6' && die.face === 6) {
            const group = image.closest('.d6-dice-div');
            const sixes = data.filter(entry => group && group.contains(entry.image) && systemDie(entry.native)?.face === 6).length;
            if (sixes >= 2)
                file = 'd6_6_preem';
        }
        setImage(image, native, file);
    }
}
export function refreshChatDice() {
    failed.clear(); // Allow newly uploaded or repaired custom files to be retried.
    document.querySelectorAll('.chat-message, #pneuma-roll-popover').forEach(replaceChatDice);
}
export function registerChatDice() {
    game.settings.register(MODULE, 'chatDiceEnabled', { name: 'Свои кубики в чате', hint: 'Показывать в чате выбранные изображения кубиков. Применяется сразу на этом клиенте.', scope: 'client', config: true, type: Boolean, default: true, onChange: refreshChatDice });
    game.settings.register(MODULE, 'chatDiceSet', { scope: 'client', config: false, type: String, default: 'pneuma', onChange: refreshChatDice });
    game.settings.register(MODULE, 'chatDiceSets', { scope: 'world', config: false, type: Array, default: [], onChange: refreshChatDice });
    Hooks.on('renderChatMessage', (_message, html) => {
        const root = html[0];
        if (!root)
            return;
        replaceChatDice(root);
        if (observed.has(root))
            return;
        observed.add(root);
        new MutationObserver(records => {
            if (records.some(record => record.addedNodes.length || record.removedNodes.length))
                replaceChatDice(root);
        }).observe(root, { childList: true, subtree: true });
    });
}
