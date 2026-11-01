import { world } from "@minecraft/server";
import { Util } from "../../../utils/util.js";

const TARGET_ITEM_ID = "cw:blood_axe";

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

// 攻撃前の判定: 条件を満たしていない場合はダメージを無効化（キャンセル）
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

        // 4. 重撃音
        attacker.playSound("item.mace.smash_ground_heavy", { location: target.location, volume: 1.2, pitch: 0.85 });
    } catch (e) {
        console.error("blood_axe hit error:", e);
    }
});
