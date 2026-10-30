import { ItemStack, world, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { AttackFunction } from "../../AttackFunctions.js";
import { Lore } from "../../../utils/Lore.js";
import { Util } from "../../../utils/util.js";

// お菓子ごとの設定 [ドロップ個数, ドロップ確率(%), チャージ量(%)]
const CANDY_ITEMS = {
    "minecraft:cookie": { count: 1, dropWeight: 45, chargeValue: 10, name: "クッキー" },
    "minecraft:pumpkin_pie": { count: 1, dropWeight: 25, chargeValue: 25, name: "パンプキンパイ" },
    "minecraft:honey_bottle": { count: 1, dropWeight: 20, chargeValue: 20, returnItem: "minecraft:glass_bottle", name: "ハチミツ入りの瓶" },
    "minecraft:cake": { count: 1, dropWeight: 10, chargeValue: 50, name: "ケーキ" }
};

const MAX_GAUGE = 100;
const LORE_KEY = "キャンディゲージ";

/**
 * お菓子を消費してゲージをチャージする
 * @param {import("@minecraft/server").Player} player 
 * @param {number} slot 
 */
function chargeWithCandy(player, slot) {
    const currentGauge = parseInt(Lore.getLore(player, slot, LORE_KEY) || "0", 10);
    if (currentGauge >= MAX_GAUGE) {
        player.onScreenDisplay.setActionBar("§cキャンディゲージは既にMAXです！");
        player.dimension.playSound("note.bass", player.location, { pitch: 0.8 });
        return;
    }

    const equippable = player.getComponent("minecraft:equippable");
    const offhandItem = equippable?.getEquipment(EquipmentSlot.Offhand);

    let usedTypeId = null;
    let candyConfig = null;

    // 1. オフハンド（左手）に対象のお菓子を持っているかチェック
    if (offhandItem && CANDY_ITEMS[offhandItem.typeId]) {
        usedTypeId = offhandItem.typeId;
        candyConfig = CANDY_ITEMS[usedTypeId];
        if (offhandItem.amount > 1) {
            offhandItem.amount -= 1;
            equippable.setEquipment(EquipmentSlot.Offhand, offhandItem);
        } else {
            equippable.setEquipment(EquipmentSlot.Offhand, undefined);
        }
    } else {
        // 2. メインインベントリから対象のお菓子を検索
        const inv = player.getComponent("minecraft:inventory");
        if (inv?.container) {
            for (let i = 0; i < inv.container.size; i++) {
                if (i === slot) continue; // 剣スロットは除外
                const item = inv.container.getItem(i);
                if (item && CANDY_ITEMS[item.typeId]) {
                    usedTypeId = item.typeId;
                    candyConfig = CANDY_ITEMS[usedTypeId];
                    if (item.amount > 1) {
                        item.amount -= 1;
                        inv.container.setItem(i, item);
                    } else {
                        inv.container.setItem(i, undefined);
                    }
                    break;
                }
            }
        }
    }

    // お菓子が見つからなかった場合
    if (!usedTypeId || !candyConfig) {
        player.onScreenDisplay.setActionBar("§cチャージ用のお菓子（クッキー、パイ、ハチミツ、ケーキ）がありません！");
        player.dimension.playSound("note.bass", player.location, { pitch: 0.5 });
        return;
    }

    // ハチミツ瓶を消費した場合は空のガラス瓶を返却
    if (candyConfig.returnItem) {
        const inv = player.getComponent("minecraft:inventory");
        if (inv?.container) {
            inv.container.addItem(new ItemStack(candyConfig.returnItem, 1));
        }
    }

    const newGauge = Math.min(MAX_GAUGE, currentGauge + candyConfig.chargeValue);
    Lore.setLore(player, slot, LORE_KEY, `${newGauge}%`);

    // サウンド・表示演出
    player.dimension.playSound("random.burp", player.location, { pitch: 1.2, volume: 0.8 });
    player.dimension.playSound("random.orb", player.location, { pitch: 1.0 + (newGauge / MAX_GAUGE) * 0.5 });

    if (newGauge >= MAX_GAUGE) {
        player.onScreenDisplay.setActionBar("§d§l★☆★ キャンディゲージがMAXになりました！ ★☆★");
        player.dimension.playSound("random.levelup", player.location, { pitch: 1.5 });
    } else {
        player.onScreenDisplay.setActionBar(`§e${candyConfig.name}をチャージ！ §d[+${candyConfig.chargeValue}%] §f(${newGauge}/${MAX_GAUGE})`);
    }
}

/**
 * 特殊効果「キャンディ斬」を発動
 * @param {import("@minecraft/server").Player} player 
 * @param {number} slot 
 */
function executeCandySlash(player, slot) {
    const currentGauge = parseInt(Lore.getLore(player, slot, LORE_KEY) || "0", 10);
    if (currentGauge < MAX_GAUGE) {
        player.onScreenDisplay.setActionBar(`§eゲージ不足: §f${currentGauge}/${MAX_GAUGE} §7(スニーク使用でお菓子をチャージ)`);
        player.dimension.playSound("note.bass", player.location, { pitch: 0.6 });
        return;
    }

    // AttackFunction を使ってキャンディ斬のエフェクト攻撃
    const af = new AttackFunction(player);

    // 斬撃1: 水平スイング（ハート＆お菓子エフェクト）
    af.ZangekiAttack(
        "minecraft:heart_particle",
        0.3,
        140,
        0,
        4.5,
        (target) => {
            target.applyDamage(16, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
            target.addEffect("hunger", 60, { amplifier: 4, showParticles: false });
            target.addEffect("mining_fatigue", 100, { amplifier: 1, showParticles: false });
        }
    );

    // 斬撃2: 斜めスイング（クリティカルスターエフェクト）
    af.ZangekiAttack(
        "minecraft:critical_hit_emitter",
        0.5,
        120,
        45,
        4.0,
        (target) => {
            target.applyDamage(10, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
            target.addEffect("hunger", 60, { amplifier: 4, showParticles: false });
            target.addEffect("mining_fatigue", 100, { amplifier: 1, showParticles: false });
        }
    );

    // サウンド演出
    player.dimension.playSound("mob.player.attack.strong", player.location, { volume: 1.2, pitch: 1.2 });
    player.dimension.playSound("random.explode", player.location, { volume: 0.6, pitch: 1.8 });
    player.dimension.playSound("random.levelup", player.location, { volume: 0.8, pitch: 2.0 });

    player.onScreenDisplay.setActionBar("§d§l★☆★ キャンディ斬！！ ★☆★");
    //HP回復
    Util.heal(player, 5)
    // ゲージを0にリセット
    Lore.setLore(player, slot, LORE_KEY, "0%");
}

// ----------------------------------------------------
// アイテム使用イベント（チャージ or キャンディ斬）
// ----------------------------------------------------
world.afterEvents.itemUse.subscribe((ev) => {
    const { source: player, itemStack: item } = ev;
    if (!player || player.typeId !== "minecraft:player") return;
    if (item?.typeId !== "cw:candy_sword") return;

    const slot = player.selectedSlotIndex;

    if (player.isSneaking) {
        // スニーク時: お菓子と合わせてチャージ
        chargeWithCandy(player, slot);
    } else {
        // 通常使用時: キャンディ斬を発動
        executeCandySlash(player, slot);
    }
});

// ----------------------------------------------------
// モブ討伐時の確率お菓子ドロップ
// ----------------------------------------------------
world.afterEvents.entityDie.subscribe((ev) => {
    const entity = ev.deadEntity;
    const damager = ev.damageSource.damagingEntity;

    if (!damager || damager.typeId !== "minecraft:player") return;

    const comp = damager.getComponent("minecraft:equippable");
    if (!comp) return;

    const item = comp.getEquipment(EquipmentSlot.Mainhand);
    if (!item || item.typeId !== "cw:candy_sword") return;

    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const [typeId, data] of Object.entries(CANDY_ITEMS)) {
        cumulative += data.dropWeight;
        if (rand < cumulative) {
            const dropItem = new ItemStack(typeId, data.count);
            entity.dimension.spawnItem(dropItem, entity.location);
            break;
        }
    }
});