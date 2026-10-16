export function eligibleNetrunner(actor) {
  try { return ['character','mook'].includes(actor?.type) && Boolean(actor.getEquippedCyberdeck?.()); }
  catch { return false; }
}
// Match cpr-netrunning 1.12.0's toolbar contract; do not bypass module permissions.
export function canOpenNet({ user, actors = [], allowSpectators = false }) {
  return Boolean(user?.isGM || allowSpectators || eligibleNetrunner(user?.character)
    || actors.some(actor => actor.testUserPermission?.(user, 'OWNER') && eligibleNetrunner(actor)));
}
export function sheetActor({ user, controlled = [] }) {
  const actor = controlled.length === 1 ? controlled[0]?.actor : user?.character;
  return actor && (user?.isGM || actor.testUserPermission?.(user, 'OBSERVER')) ? actor : null;
}

/** The Atlas owns access decisions; legacy versions remain GM-only. */
export function atlasAccess({ user, api } = {}) {
  const denied = reason => ({ available: false, visible: Boolean(user?.isGM), reason });
  if (!user) return denied('Данные пользователя ещё не готовы.');
  try {
    if (typeof api?.open !== 'function') return denied('Модуль атласа выключен или ещё загружается.');
    const supportsAccess = typeof api.canOpen === 'function';
    const allowed = supportsAccess ? api.canOpen() === true : Boolean(user.isGM);
    if (allowed) return { available: true, visible: true, reason: '' };
    return denied(supportsAccess
      ? 'Атлас сейчас недоступен этому пользователю.'
      : 'Эта версия атласа открывается только ведущему.');
  } catch {
    return denied('Не удалось проверить доступ к атласу. Попробуйте позже.');
  }
}
