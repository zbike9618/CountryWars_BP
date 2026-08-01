import { system, world } from "@minecraft/server";
import { Util } from "../utils/util";


world.afterEvents.entityHurt.subscribe((ev) => {
    const player = ev.hurtEntity;
    if (player.typeId != "minecraft:player") return;
    /** @type {import("@minecraft/server").Player} */
    const attacker = ev.damageSource.damagingEntity;
    if (!attacker || attacker.typeId != "minecraft:player") return;
    const armorSlot = player.getComponent("minecraft:equippable")
    let reduceAmount = 1;//%表記
    if (armorSlot.getEquipment("Head")?.typeId == "cw:platinum_helmet") {
        reduceAmount += 2;
    }
    if (armorSlot.getEquipment("Feet")?.typeId == "cw:platinum_boots") {
        reduceAmount += 1;
    }
    if (armorSlot.getEquipment("Legs")?.typeId == "cw:platinum_leggings") {
        reduceAmount += 3;
    }
    if (armorSlot.getEquipment("Chest")?.typeId == "cw:platinum_chestplate") {
        reduceAmount += 4;
    }
    if (reduceAmount == 1) return;

    const comp = attacker.getComponent("minecraft:inventory");

    const itemStack = comp.container?.getItem(attacker.selectedSlotIndex);
    if (!itemStack) return;
    const dura = itemStack.getComponent("minecraft:durability");
    const reduce = Math.floor(ev.damage * reduceAmount);
    if (!dura) {
        if (itemStack.typeId.includes("trenbankai:")) {
            attacker.applyDamage(reduce * 0.5, { cause: "thorns", damagingEntity: player })
        }
    }
    if (!Util.reduceDurability(attacker, itemStack, reduce)) {
        attacker.playSound("item.axe.break");
    }
});

world.afterEvents.entityHitEntity.subscribe((ev) => {
    const damager = ev.damagingEntity;
    const hurter = ev.hitEntity;

    if (damager.typeId !== "minecraft:player" || hurter.typeId !== "minecraft:player") return;

    const inventory = damager.getComponent("minecraft:inventory");
    const heldItem = inventory.container.getItem(damager.selectedSlotIndex);
    if (!heldItem || heldItem.typeId !== "cw:platinum_sword") return;
    const armorSlot = hurter.getComponent("minecraft:equippable")
    // 相手の合計防御力を計算
    const totalDefense = armorSlot.totalArmor + armorSlot.totalToughness

    // 削る耐久値の計算（防御力の5倍）
    const reduce = Math.max(1, Math.floor(totalDefense));

    const armorSlots = ["Head", "Chest", "Legs", "Feet"];
    for (const slot of armorSlots) {
        const armorItem = armorSlot.getEquipment(slot);
        if (!armorItem) continue;

        const dura = armorItem.getComponent("minecraft:durability");
        if (!dura) continue;

        if (!Util.reduceDurability(hurter, armorItem, reduce, slot)) {
            // アイテムが壊れた場合
            hurter.playSound("item.axe.break");
        }
    }
});
