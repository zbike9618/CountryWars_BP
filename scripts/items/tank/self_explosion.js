import * as server from "@minecraft/server";
import { getAttachment } from "./attachment.js";
const { world } = server;

/**
 * インベントリから指定アイテムを必要数消費
 * @param {server.Container} container 
 * @param {string} typeId 
 * @param {number} count 
 * @returns {boolean}
 */
function consumeItem(container, typeId, count) {
    let total = 0;
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && item.typeId === typeId) {
            total += item.amount;
        }
    }
    if (total < count) return false;

    let remaining = count;
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && item.typeId === typeId) {
            if (item.amount <= remaining) {
                remaining -= item.amount;
                container.setItem(i, undefined);
            } else {
                item.amount -= remaining;
                container.setItem(i, item);
                break;
            }
        }
    }
    return true;
}

// エンドクリスタル10個とHP100を消費して大爆発（耐性255を事前付与、自爆強化で威力上昇）
world.afterEvents.itemUse.subscribe((ev) => {
    if (ev.itemStack?.typeId !== "minecraft:end_crystal") return;
    const player = ev.source;
    if (!player || !player.isValid) return;
    const dimension = player.dimension;

    // プレイヤーが現在乗っている戦車を取得
    const tank = dimension.getEntities({ type: "cw:tank" }).find(e => {
        const riders = e.getComponent("minecraft:rideable")?.getRiders();
        return riders?.some(rider => rider.id === player.id);
    });

    if (!tank || !tank.isValid) return;

    // HPのチェック (100より多く残っていること)
    const healthComp = tank.getComponent("minecraft:health");
    if (!healthComp || healthComp.currentValue <= 100) {
        player.sendMessage("§c自爆するには戦車のHPが100より多く残っている必要があります§r");
        return;
    }

    // インベントリのチェック (エンドクリスタル10個)
    const inventory = player.getComponent("inventory");
    if (!inventory?.container) return;

    if (!consumeItem(inventory.container, "minecraft:end_crystal", 10)) {
        player.sendMessage("§c自爆にはエンドクリスタルが10個必要です§r");
        return;
    }

    // HP 100 消費
    healthComp.setCurrentValue(healthComp.currentValue - 100);


    // 自爆強化（アタッチメント）の取得
    const attachments = getAttachment(tank);
    const explosionBonus = attachments.explosion || 0;

    // 大爆発 (基本威力 12 + 自爆強化レベル * 6)
    const explosionPower = 12 + (explosionBonus * 6);
    dimension.createExplosion(tankLoc, explosionPower, { breakBlocks: true, causesFire: true });

    world.sendMessage(`§c[戦車自爆] ${player.name} の戦車が大爆発を起こしました！ (威力: ${explosionPower})§r`);
});

// 戦車死亡時の爆発処理
world.afterEvents.entityDie.subscribe((ev) => {
    const entity = ev.deadEntity;
    if (entity && entity.isValid && entity.typeId === "cw:tank") {
        const dimension = entity.dimension;
        const attachments = getAttachment(entity);
        const explosion = attachments.explosion || 0;
        if (explosion) {
            dimension.createExplosion(entity.location, 5 + 5 * explosion, { breakBlocks: true, causesFire: true });
        }
    }
});