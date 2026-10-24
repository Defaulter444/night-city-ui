import {customDicePath, diceFiles, diceSets, refreshChatDice, type DiceSet} from './chat-dice.js';
const MODULE = 'night-city-ui';

export class ChatDiceSettings extends FormApplication {
  constructor() { super({}); }
  static override get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'pneuma-chat-dice-settings', title: 'Наборы кубиков в чате', width: 460,
      template: `modules/${MODULE}/visual/chat-dice-settings.hbs`, closeOnSubmit: true,
    });
  }
  override getData() {
    const selected = game.settings!.get(MODULE, 'chatDiceSet');
    return {isGM: game.user!.isGM, sets: diceSets(),
      choices: [{id: 'pneuma', name: 'Pneuma (по умолчанию)'}, ...diceSets()].map(set => ({...set, selected: set.id === selected})),
      files: diceFiles.join(', '), legacyActive: game.modules?.get('pneuma-chat-dice')?.active};
  }
  override activateListeners(html: JQuery) {
    super.activateListeners(html);
    const root = html[0]; if (!root) return;
    const status = root.querySelector<HTMLElement>('[data-status]')!;
    const readSet = (): DiceSet => {
      const name = root.querySelector<HTMLInputElement>('[name="setName"]')!.value.trim();
      const folder = root.querySelector<HTMLInputElement>('[name="folder"]')!.value.trim().replace(/\/+$/, '');
      const extension = root.querySelector<HTMLSelectElement>('[name="extension"]')!.value;
      if (!name || !folder) throw Error('Введите название набора и выберите папку.');
      if (!['webp', 'png', 'svg'].includes(extension) || /^(?!https?:)[a-z]+:/i.test(folder)) throw Error('Укажите папку Foundry или папку изображений по HTTP(S).');
      return {id: foundry.utils.randomID(), name, folder, extension: extension as DiceSet['extension']};
    };
    root.querySelector('[data-browse]')?.addEventListener('click', () => {
      const input = root.querySelector<HTMLInputElement>('[name="folder"]')!;
      new FilePicker({type: 'folder', current: input.value, callback: path => {input.value = path;}}).render(true);
    });
    root.querySelector('[data-validate]')?.addEventListener('click', async event => {
      const button = event.currentTarget as HTMLButtonElement;
      try {
        const set = readSet(); button.disabled = true; status.textContent = 'Проверяю 31 изображение…';
        const missing = (await Promise.all(diceFiles.map(file => new Promise<string | undefined>(resolve => {
          const image = new Image(); let timer: ReturnType<typeof setTimeout>;
          const finish = (value?: string) => {clearTimeout(timer); image.onload = image.onerror = null; resolve(value);};
          timer = setTimeout(() => finish(file), 8000);
          image.onload = () => finish(); image.onerror = () => finish(file); image.src = customDicePath(set, file);
        })))).filter(Boolean);
        status.textContent = missing.length ? `Нет или не читаются: ${missing.join(', ')}. Вместо них будут кубики Pneuma.` : 'Все 31 изображение на месте.';
      } catch (error) {status.textContent = String(error);} finally {button.disabled = false;}
    });
    root.querySelector('[data-add]')?.addEventListener('click', async () => {
      if (!game.user!.isGM) return;
      try {
        const set = readSet();
        if (diceSets().some(existing => existing.name.toLowerCase() === set.name.toLowerCase())) throw Error('Набор с таким названием уже есть.');
        await game.settings!.set(MODULE, 'chatDiceSets', [...diceSets(), set]);
        await game.settings!.set(MODULE, 'chatDiceSet', set.id); this.render(false);
      } catch (error) {status.textContent = String(error);}
    });
    root.querySelectorAll<HTMLElement>('[data-remove]').forEach(button => button.addEventListener('click', async () => {
      if (!game.user!.isGM) return;
      await game.settings!.set(MODULE, 'chatDiceSets', diceSets().filter(set => set.id !== button.dataset.remove));
      // Other clients automatically fall back when a selected set is removed.
      refreshChatDice(); this.render(false);
    }));
  }
  protected override async _updateObject(_event: Event, data: Record<string, unknown>) {
    const id = String(data.selectedSet);
    if (id !== 'pneuma' && !diceSets().some(set => set.id === id)) throw Error('Этот набор кубиков недоступен.');
    await game.settings!.set(MODULE, 'chatDiceSet', id);
  }
}
export function registerChatDiceMenu(): void {
  game.settings!.registerMenu(MODULE, 'chatDiceMenu', {name: 'Наборы кубиков в чате', label: 'Наборы кубиков', hint: 'Выберите оформление кубиков. Мастер может добавить общие папки со своими наборами.', icon: 'fas fa-dice', type: ChatDiceSettings, restricted: false});
}
