/** Replaceable 512x256 WebP alpha masks. MIGRATION: presentation only;
 * artwork selection never reads concealed ammunition or combat results. */
export const weaponAssets = {
    "medPistol": "weapon-med-pistol.webp",
    "heavyPistol": "weapon-heavy-pistol.webp",
    "vHeavyPistol": "weapon-v-heavy-pistol.webp",
    "smg": "weapon-smg.webp",
    "heavySmg": "weapon-heavy-smg.webp",
    "sniperRifle": "weapon-sniper-rifle.webp",
    "shotgun": "weapon-shotgun.webp",
    "grenadeLauncher": "weapon-grenade-launcher.webp",
    "rocketLauncher": "weapon-rocket-launcher.webp",
    "bow": "weapon-bow.webp",
    "crossbow": "weapon-crossbow.webp",
    "lightMelee": "weapon-light-melee.webp",
    "medMelee": "weapon-med-melee.webp",
    "heavyMelee": "weapon-heavy-melee.webp",
    "vHeavyMelee": "weapon-v-heavy-melee.webp",
    "unarmed": "weapon-unarmed.webp",
    "martialArts": "weapon-martial-arts.webp",
    "thrownWeapon": "weapon-thrown-weapon.webp",
    "grenade": "weapon-grenade.webp",
    "flamethrower": "weapon-flamethrower.webp",
    "assaultRifle": "weapon-assault-rifle.webp"
};
export function weaponSilhouette(title, type) {
    const key = type && Object.hasOwn(weaponAssets, type) ? type : [
        [/flamethrower/i, 'flamethrower'], [/crossbow/i, 'crossbow'], [/rocket/i, 'rocketLauncher'], [/grenade.*launcher/i, 'grenadeLauncher'],
        [/grenade/i, 'grenade'], [/sniper/i, 'sniperRifle'], [/assault|rifle/i, 'assaultRifle'], [/shotgun/i, 'shotgun'],
        [/heavy.*(?:smg|submachine)/i, 'heavySmg'], [/smg|submachine/i, 'smg'], [/very.*heavy.*pistol/i, 'vHeavyPistol'],
        [/heavy.*pistol/i, 'heavyPistol'], [/pistol|handgun/i, 'medPistol'], [/bow/i, 'bow'], [/very.*heavy.*melee|axe|hammer/i, 'vHeavyMelee'],
        [/heavy.*melee|sword|katana/i, 'heavyMelee'], [/medium.*melee|machete/i, 'medMelee'], [/light.*melee|knife|dagger/i, 'lightMelee'],
        [/martial/i, 'martialArts'], [/unarmed|brawling|fist/i, 'unarmed'], [/thrown/i, 'thrownWeapon'],
    ].find(([pattern]) => pattern.test(title))?.[1];
    if (!key)
        return '';
    return `modules/night-city-ui/visual/${weaponAssets[key]}`;
}
