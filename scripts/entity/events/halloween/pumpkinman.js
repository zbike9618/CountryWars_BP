import { world, system } from "@minecraft/server";

world.afterEvents.entitySpawn.subscribe((ev) => {
    const entity = ev.entity;
    if (entity.typeId == "cw:pumpkinman") {
        entity.runCommand("replaceitem entity @s slot.armor.head 0 carved_pumpkin")
    }
});
world.afterEvents.entityDie.subscribe((ev) => {
    const entity = ev.damageSource.damagingEntity.typeId
    const damager = ev.deadEntity;
    if (entity == "cw:pumpkinman") {
        const block = damager.dimension.getBlock(damager.location)
        if (!block.isAir) return
        block.setType("minecraft:carved_pumpkin")
    }
})