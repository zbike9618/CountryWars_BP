import { world, system, EntityDamageCause } from "@minecraft/server";
import { Util } from "../../../utils/util.js";

const TARGET_ITEM_ID = "cw:blood_axe";
const bloodBuffEndTick = new Map(); // player.id -> endTick
const SELF_DAMAGE = 10;              // 右クリック時の自傷ダメージ (ハート3個分)
const BUFF_DURATION_TICKS = 100;    // 5秒間 (100 ticks)
const COOLDOWN_TICKS = 160;         // 8秒クールダウン (160 ticks)
const BONUS_DAMAGE = 10;            // 攻撃力 +10

/**
 * プレイヤーのバフが有効か判定し、期限切れならMapから確実に削除する
 * @param {string} playerId 
 * @returns {boolean}
 */
function isBuffActive(playerId) {
    const endTick = bloodBuffEndTick.get(playerId);
    if (endTick === undefined) return false;
    if (system.currentTick < endTick) {
        return true;
    }
    // 期限切れ時は即座に削除
    bloodBuffEndTick.delete(playerId);
    return false;
}

/**
 * 攻撃者がブラッドアックスの発動条件（防具未装備・防御力0 かつ 攻撃/防御/速度バフ無し）を満たしているか判定
 * @param {import("@minecraft/server").Player} player 
 * @returns {boolean}
 */
function canAttackWithBloodAxe(player) {
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return false;

    // 1. 防御力が0であること（防具を一切装備していないこと）
    const totalArmor = equippable.totalArmor ?? 0;
    const hasArmor = totalArmor > 0 ||
        !!equippable.getEquipment("Head") ||
        !!equippable.getEquipment("Chest") ||
        !!equippable.getEquipment("Legs") ||
        !!equippable.getEquipment("Feet");

    if (hasArmor) return false;

    // 2. 攻撃上昇(strength)、防御上昇/耐性(resistance)、スピード上昇(speed)のいずれもついていないこと
    if (player.getEffect("strength") || player.getEffect("resistance") || player.getEffect("speed")) {
        return false;
    }

    return true;
}

// プレイヤー退出時のMap削除
world.afterEvents.playerLeave.subscribe((ev) => {
    bloodBuffEndTick.delete(ev.playerId);
});

// プレイヤー死亡時のMap削除
world.afterEvents.entityDie.subscribe((ev) => {
    if (ev.deadEntity?.typeId === "minecraft:player") {
        bloodBuffEndTick.delete(ev.deadEntity.id);
    }
});

// 右クリック (アイテム使用): 自傷ダメージを受け、5秒間ブラッドアックスの攻撃力+10
world.afterEvents.itemUse.subscribe((ev) => {
    try {
        const player = ev.source;
        if (!player || !player.isValid || player.typeId !== "minecraft:player") return;
        if (ev.itemStack.typeId !== TARGET_ITEM_ID) return;

        // クールダウンチェック
        if (player.getItemCooldown("cw:blood_axe") > 0) return;

        // クールダウン開始 (8秒)
        player.startItemCooldown("cw:blood_axe", COOLDOWN_TICKS);

        // 自傷ダメージ
        player.applyDamage(SELF_DAMAGE, { cause: EntityDamageCause.magic });

        // 5秒間のバフ終了Tickを設定
        const targetEndTick = system.currentTick + BUFF_DURATION_TICKS;
        bloodBuffEndTick.set(player.id, targetEndTick);

        // 5秒経過時のタイムアウトで確実に削除
        system.runTimeout(() => {
            if (bloodBuffEndTick.get(player.id) === targetEndTick) {
                bloodBuffEndTick.delete(player.id);
            }
        }, BUFF_DURATION_TICKS);

        // 演出 & 通知
        player.playSound("mob.wither.hurt", { volume: 0.9, pitch: 1.1 });
        player.playSound("ambient.weather.thunder", { volume: 0.5, pitch: 1.8 });
        player.onScreenDisplay?.setActionBar("§4§l5秒間攻撃力+10！");

        try {
            const loc = player.location;
            player.dimension.spawnParticle("minecraft:critical_hit_emitter", { x: loc.x, y: loc.y + 1, z: loc.z });
            player.dimension.spawnParticle("minecraft:redstone_ore_dust_particle", { x: loc.x, y: loc.y + 1, z: loc.z });
        } catch { }
    } catch (e) {
        console.error("blood_axe itemUse error:", e);
    }
});

// 攻撃前の判定: 条件を満たしていない場合はダメージ無効化 & バフ発動中なら攻撃力+10
world.beforeEvents.entityHurt.subscribe((ev) => {
    try {
        const attacker = ev.damageSource.damagingEntity;
        if (!attacker || !attacker.isValid || attacker.typeId !== "minecraft:player") return;

        const equippable = attacker.getComponent("minecraft:equippable");
        const mainhand = equippable?.getEquipment("Mainhand");
        if (!mainhand || mainhand.typeId !== TARGET_ITEM_ID) return;

        if (!canAttackWithBloodAxe(attacker)) {
            ev.cancel = true;
            attacker.onScreenDisplay?.setActionBar("§c【ブラッドアックス】防具未装備(防御力0) かつ バフ(攻撃・防御・速度)無しの時のみ攻撃可能です！");
            attacker.playSound?.("note.bass", { volume: 0.8, pitch: 0.6 });
            return;
        }

        // 5秒間の攻撃力+10バフ適用 (斧のみ)
        if (isBuffActive(attacker.id)) {
            ev.damage += BONUS_DAMAGE;
        }
    } catch (e) {
        console.error("blood_axe beforeHurt error:", e);
    }
});

// 攻撃命中時の追加効果（ノックバック・鈍足1秒・防具耐久値大量減少）
world.afterEvents.entityHitEntity.subscribe((ev) => {
    try {
        const attacker = ev.damagingEntity;
        const target = ev.hitEntity;
        if (!attacker || !attacker.isValid || attacker.typeId !== "minecraft:player") return;
        if (!target || !target.isValid) return;

        const equippable = attacker.getComponent("minecraft:equippable");
        const mainhand = equippable?.getEquipment("Mainhand");
        if (!mainhand || mainhand.typeId !== TARGET_ITEM_ID) return;

        if (!canAttackWithBloodAxe(attacker)) return;

        // 1. 相手に1秒の鈍足を与える (20 ticks = 1秒)
        target.addEffect("slowness", 20, { amplifier: 1, showParticles: true });

        // 2. ノックバックの発生
        const dx = target.location.x - attacker.location.x;
        const dz = target.location.z - attacker.location.z;
        const dist = Math.hypot(dx, dz) || 1;
        try {
            target.applyKnockback(dx / dist, dz / dist, 1.8, 0.6);
        } catch { }

        // 3. 相手の装備の多くの耐久値を削る (プレイヤー対象)
        if (target.typeId === "minecraft:player") {
            const targetEquip = target.getComponent("minecraft:equippable");
            if (targetEquip) {
                const armorSlots = ["Head", "Chest", "Legs", "Feet"];
                const reduceAmount = 25; // 多くの耐久値を削る (25ポイント)
                for (const slot of armorSlots) {
                    const item = targetEquip.getEquipment(slot);
                    if (!item) continue;
                    if (!Util.reduceDurability(target, item, reduceAmount, slot)) {
                        target.playSound("item.axe.break");
                    }
                }
            }
        }

        // 4. 重撃音 & バフ中の追加演出
        attacker.playSound("item.mace.smash_ground_heavy", { location: target.location, volume: 1.2, pitch: 0.85 });

        if (isBuffActive(attacker.id)) {
            try {
                attacker.dimension.spawnParticle("minecraft:critical_hit_emitter", {
                    x: target.location.x,
                    y: target.location.y + 1,
                    z: target.location.z
                });
            } catch { }
        }
    } catch (e) {
        console.error("blood_axe hit error:", e);
    }
});
