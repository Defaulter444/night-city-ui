// Human label of a Foundry keybinding (spec 3.5): [{ key: 'KeyN', modifiers: ['Alt'] }] → 'Alt+N'.
const MODIFIERS = { Control: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Meta: 'Meta' };
const KEYS = { Space: 'Space', Escape: 'Esc', Backquote: '`' };

export function keyLabel(bindings) {
  const binding = Array.isArray(bindings) ? bindings.find(entry => typeof entry?.key === 'string' && entry.key) : null;
  if (!binding) return '';
  const key = KEYS[binding.key] ?? binding.key.replace(/^Key([A-Z])$/, '$1').replace(/^Digit(\d)$/, '$1').replace(/^Arrow/, '');
  const modifiers = [...new Set(binding.modifiers ?? [])].map(name => MODIFIERS[name] ?? name);
  return [...modifiers, key].join('+');
}
