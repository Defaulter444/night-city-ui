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
