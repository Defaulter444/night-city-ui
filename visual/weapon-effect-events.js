const object = (value) => value && typeof value === 'object' ? value : {};
const text = (value) => typeof value === 'string' ? value : '';
const point = (value) => { const p = object(value); return typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : undefined; };
export function weaponKey(type, title = '') {
    const kind = type.toLowerCase();
    if (kind === 'martialarts')
        return 'martial';
    if (kind === 'unarmed')
        return 'punch';
    if (kind.includes('smg'))
        return 'smg';
    if (kind === 'assaultrifle')
        return /sniper|снайпер/i.test(title) ? 'sniper' : 'rifle';
    if (kind === 'sniperrifle')
        return 'sniper';
    if (kind === 'shotgun')
        return 'shotgun';
    if (kind === 'rocketlauncher')
        return 'rocket';
    if (kind === 'grenadelauncher')
        return 'grenade';
    if (kind === 'thrownweapon')
        return /boom[ae]rang|бумеранг/i.test(title) ? 'boomerang' : /mono[\s-]*star|shuriken|throwing star|сюрикен|метательн\S* звезд/i.test(title) ? 'throwingStar' : /grenade|molotov|гранат|молотов/i.test(title) ? 'grenade' : 'thrownAxe';
    if (kind === 'bow')
        return /crossbow|арбалет/i.test(title) ? 'crossbow' : 'bow';
    if (kind.includes('melee'))
        return /mono[\s-]*(?:wire|guard)|моно(?:нить|страж|струн)/i.test(title) ? 'whip' : /katana|wakizashi|катан|вакидзаси/i.test(title) ? 'blade' : /knife|нож/i.test(title) ? 'knife' : /sword|меч/i.test(title) ? 'sword' : /blade|machete|клинок|мачете/i.test(title) ? 'blade' : 'melee';
    return 'pistol';
}
export function ammoKey(value) { const normalized = value.replace(/[\s_-]/g, '').toLowerCase(); return { armorpiercing: 'armorPiercing', incendiary: 'incendiary', expansive: 'expansive', rubber: 'rubber', smart: 'smart' }[normalized] ?? 'basic'; }
/** Interpret saved final workflow state only. No rolls or state writes. */
export function actionEffects(id, flags, content = '') {
    const data = object(object(flags)['redline-combat']), aoe = object(data.aoe), exchange = object(data.exchange), quick = object(data.quickhack), grapple = object(data.grapple);
    if (data.rollsRevealed !== true)
        return [];
    if (Object.keys(aoe).length) {
        if (aoe.phase !== 'responses' || aoe.attackDiceRevealed !== true)
            return [];
        const ex = object(aoe.exchange), area = object(aoe.area), origin = point(area.origin), intended = point(aoe.intended);
        const kind = text(aoe.kind), direction = Number(area.direction), length = Number(area.length);
        const endpoint = kind === 'explosive' ? origin : origin && Number.isFinite(direction) && Number.isFinite(length) ? { x: origin.x + Math.cos(direction) * length, y: origin.y + Math.sin(direction) * length } : intended;
        if (!endpoint || !text(ex.attacker))
            return [];
        return [{ ...(kind === 'explosive' ? { areaMessage: id, areaAmmo: text(aoe.ammoType) || text(object(ex.areaAmmo).type) } : {}), key: id + ':area', source: text(ex.attacker), point: endpoint, scene: text(aoe.scene), weapon: kind === 'suppression' ? weaponKey(text(ex.weaponType)) : kind === 'shell' ? 'shotgun' : ex.thrownSource ? 'grenade' : weaponKey(text(ex.weaponType)), mode: kind === 'suppression' ? 'suppression' : 'single', ammo: ammoKey(text(aoe.ammoType) || text(object(ex.areaAmmo).type)), hit: true, title: text(ex.title), weaponId: text(ex.weaponId) }];
    }
    if (exchange.state === 'resolved' && typeof exchange.hit === 'boolean' && text(exchange.attacker) && text(exchange.defender)) {
        return [{ key: id + ':attack', source: text(exchange.attacker), target: text(exchange.defender), scene: text(exchange.sceneId), weapon: weaponKey(text(exchange.weaponType), text(exchange.title)), mode: exchange.attackMode === 'autofire' ? 'auto' : exchange.attackMode === 'suppressive' ? 'suppression' : 'single', ammo: ammoKey(text(object(exchange.areaAmmo).type) || text(object(object(exchange.damage).result).ammoType)), hit: exchange.hit, title: text(exchange.title), weaponId: text(exchange.weaponId) }];
    }
    if (['jackIn', 'quickhack', 'breach'].includes(text(quick.type)) && typeof quick.success === 'boolean' && text(quick.sourceTokenUuid) && text(quick.targetTokenUuid)) {
        return [{ key: id + ':quickhack', source: text(quick.sourceTokenUuid), target: text(quick.targetTokenUuid), weapon: 'quickhack', mode: 'single', ammo: 'basic', hit: quick.success, privateSource: quick.revealAttacker === false }];
    }
    if (grapple.defense && ['choice', 'active', 'ended'].includes(text(grapple.state)) && text(object(grapple.source).token) && text(object(grapple.target).token)) {
        return [{ key: id + ':grapple', source: text(object(grapple.source).token), target: text(object(grapple.target).token), scene: text(grapple.scene), weapon: 'grapple', mode: 'single', ammo: 'basic', hit: Number(object(grapple.attack).total) > Number(object(grapple.defense).total) }];
    }
    const participants = object(data.grappleParticipants);
    if (/<strong>\s*(Choke|Throw|Удушение|Бросок):/i.test(content) && text(object(participants.source).token) && text(object(participants.target).token)) {
        return [{ key: id + ':grapple-action', source: text(object(participants.source).token), target: text(object(participants.target).token), weapon: /<strong>\s*(?:Throw|Бросок):/i.test(content) ? 'melee' : 'grapple', mode: 'single', ammo: 'basic', hit: true }];
    }
    return [];
}
