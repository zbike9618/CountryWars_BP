import { ItemStack, world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { AttackFunction } from "../../AttackFunctions.js";

world.afterEvents.itemUse.subscribe(async (ev) => {
    const p = ev.source
    if (p.typeId != "minecraft:player") return;
    if (ev.itemStack.typeId != "cw:black_scythe") return;

    p.startItemCooldown("cw:black_scythe", 200)
    //向いてる前に飛ばす
    const rot = p.getRotation()
    p.applyImpulse({ x: Math.cos(rot.y) * 5, y: 0.3, z: Math.sin(rot.y) * 5 })
    await system.waitTicks(20)
    const af = new AttackFunction(p)
    af.ZangekiAttack(
        { damage: 15, damageCause: EntityDamageCause.entityAttack },
        "minecraft:soul",
        0.4,
        140,
        0,
        4.5
    )

    af.ZangekiAttack(
        { damage: 15, damageCause: EntityDamageCause.entityAttack },
        "minecraft:soul",
        0.4,
        140,
        0,
        -4.5
    )

})