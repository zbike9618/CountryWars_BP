import * as server from "@minecraft/server"
const { world } = server;
import { getAttachment } from "./attachment.js"

world.afterEvents.itemUse.subscribe((ev) => {
    if (ev.itemStack.typeId !== "minecraft:tnt") return;
    const player = ev.source;
    const dimension = player.dimension;

    // プレイヤーが現在乗っているタンクを取得
    const tank = dimension.getEntities({ type: "cw:tank" }).find(e => {
        const riders = e.getComponent("minecraft:rideable")?.getRiders();
        return riders?.some(rider => rider.id === player.id);
    });

    if (!tank) return;

    // アタッチメント情報に基づいたコストとパラメータの計算
    const attachments = getAttachment(tank);

    // コスト計算: 基本 5個 + 攻撃アタッチメント数
    const needAmount = 5 + (attachments.attack || 0);

    // インベントリからTNTを消費
    const inventory = player.getComponent("inventory");
    if (!inventory?.container) return;

    if (!consumeItem(inventory.container, "minecraft:tnt", needAmount, player.selectedSlotIndex)) {
        // 足りない場合は発射しない
        return;
    }

    // 発射パラメータ
    const dir = player.getViewDirection();
    const loc = player.getHeadLocation();
    const spawnLoc = {
        x: loc.x + dir.x * 2,
        y: loc.y + dir.y * 2,
        z: loc.z + dir.z * 2
    };

    // 飛距離: 基本 1.5 + 飛行アタッチメントによる補正
    const impulseDistance = 1.5 + (attachments.more_fly * 2 || 0);
    // 爆発威力レベル: 爆発アタッチメントの数
    const explosionLevel = attachments.attack || 0;

    const entity = dimension.spawnEntity("cw:cannon_ball", spawnLoc);
    entity.applyImpulse({
        x: dir.x * impulseDistance,
        y: dir.y * impulseDistance,
        z: dir.z * impulseDistance
    });
    entity.setProperty("cw:explosion_level", explosionLevel);

    // 特殊アタッチメント（アンチウォーター）の処理
    if (attachments.antiwater) {
        entity.setProperty("cw:allow_water", true);
        if (attachments.antiwater >= 2) {
            entity.setProperty("cw:will_clear_water", true);
        }
    }
});

/**
 * 指定されたアイテムを必要数消費する（選択スロット以外を優先）
 * @param {server.Container} container 
 * @param {string} typeId 
 * @param {number} amount 
 * @param {number} preferredSkipSlot 優先的に後回しにするスロット
 * @returns {boolean} 消費できたかどうか
 */
function consumeItem(container, typeId, amount, preferredSkipSlot = -1) {
    let total = 0;
    // まず所持数を確認
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item?.typeId === typeId) total += item.amount;
    }

    if (total < amount) return false;

    let leftToConsume = amount;

    // 1. まずは選択スロット以外のインベントリから消費
    for (let i = 0; i < container.size; i++) {
        if (i === preferredSkipSlot) continue;

        const item = container.getItem(i);
        if (item?.typeId === typeId) {
            if (item.amount > leftToConsume) {
                item.amount -= leftToConsume;
                container.setItem(i, item);
                leftToConsume = 0;
                break;
            } else {
                leftToConsume -= item.amount;
                container.setItem(i, undefined);
                if (leftToConsume <= 0) break;
            }
        }
    }

    // 2. まだ足りない場合のみ、選択スロットから消費
    if (leftToConsume > 0 && preferredSkipSlot !== -1) {
        const item = container.getItem(preferredSkipSlot);
        if (item?.typeId === typeId) {
            if (item.amount > leftToConsume) {
                item.amount -= leftToConsume;
                container.setItem(preferredSkipSlot, item);
            } else {
                container.setItem(preferredSkipSlot, undefined);
            }
        }
    }

    return true;
}

// 爆発直前の処理
world.beforeEvents.explosion.subscribe((ev) => {
    const entity = ev.source;
    if (!entity || entity.typeId !== "cw:cannon_ball") return;

    const dimension = ev.dimension;
    const loc = entity.location;

    // 水抜きアタッチメントの効果
    if (entity.getProperty("cw:will_clear_water")) {
        server.system.run(() => {
            dimension.runCommand(`fill ${Math.floor(loc.x) - 5} ${Math.floor(loc.y) - 5} ${Math.floor(loc.z) - 5} ${Math.floor(loc.x) + 5} ${Math.floor(loc.y) + 20} ${Math.floor(loc.z) + 5} air replace water`);
        });
    }
});