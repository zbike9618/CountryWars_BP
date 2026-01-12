import { world, system } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe((event) => {


    system.runInterval(() => {
        for (const player of world.getPlayers()) {
            const comp = player.getComponent("minecraft:equippable")
            if (!comp) return;
            const item = comp.getEquipmentSlot("Head")
            if (!item) return;
            if (item.typeId == "cw:anshi_goggle") {
                player.addEffect("minecraft:night_vision", 120, {
                    amplifier: 0,
                    showParticles: false
                })
            }
        }

    }, 20)
});