import { world, system, WorldAfterEvents } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe((event) => {


    system.runInterval(() => {
        for (const player of world.getPlayers()) {
            const comp = player.getComponent("minecraft:equippable")
            if (!comp) return;
            const item = comp.getEquipment("Head")
            if (!item) return;
            if (item.typeId == "cw:anshi_goggle") {
                player.addEffect("minecraft:night_vision", 240, {
                    amplifier: 0,
                    showParticles: false
                })
            }
        }

    }, 20)
});

world.afterEvents.itemUse.subscribe((event => {
    const player = event.source;
    const itemId = event.itemStack.Id;
    if(itemId === "cw:magnet"){
    }
}
))