import { world, system } from "@minecraft/server";

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const comp = player.getComponent("minecraft:equippable")
        const item = comp.getEquipmentSlot("Head")
        if (item.typeId == "cw:anshi_goggle") {
            player.addEffect("minecraft:night_vision", 40, {
                amplifier: 0,
                showParticles: false
            })
        }
    }

}, 20)