import { system, world } from "@minecraft/server";
import { Util } from "../utils/util";


world.afterEvents.entityHurt.subscribe((ev) => {
    const player = ev.hurtEntity;
    if (player.typeId != "minecraft:player") return;
    const attacker = ev.damageSource.damagingEntity;
    if (!attacker || attacker.typeId != "minecraft:player") return;
    const armorSlot = player.getComponent("minecraft:equippable")
    let reduceAmount = 1;//%表記
    if (armorSlot.getEquipmentSlot("Head").typeId == "cw:platinum_helmet") {
        reduceAmount += 1;
    }
    if (armorSlot.getEquipmentSlot("Feet").typeId == "cw:platinum_boots") {
        reduceAmount += 1;
    }
    if (armorSlot.getEquipmentSlot("Legs").typeId == "cw:platinum_leggings") {
        reduceAmount += 3;
    }
    if (armorSlot.getEquipmentSlot("Chest").typeId == "cw:platinum_chestplate") {
        reduceAmount += 4;
    }
    if (reduceAmount == 1) return;

    const comp = attacker.getComponent("minecraft:inventory");

    const itemStack = comp.container?.getItem(attacker.selectedSlotIndex);
    if (!itemStack) return;
    const reduce = Math.floor(ev.damage * reduceAmount);
    if (!Util.reduceDurability(attacker, itemStack, reduce)) {
        attacker.playSound("item.axe.break");
    }
});
