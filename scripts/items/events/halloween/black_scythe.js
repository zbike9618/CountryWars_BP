import { ItemStack, world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { AttackFunction } from "../../AttackFunctions.js";

world.afterEvents.itemUse.subscribe(async (ev) => {
    const p = ev.source
    if (p.typeId != "minecraft:player") return;
    if (ev.itemStack.typeId != "cw:black_scythe") return;

    p.startItemCooldown("cw:black_scythe", 200);
    // 向いている前方に飛ばす
    const view = p.getViewDirection();
    const hLen = Math.hypot(view.x, view.z) || 1;
    const speed = 2.5;
    p.applyImpulse({
        x: (view.x / hLen) * speed,
        y: 0.35,
        z: (view.z / hLen) * speed
    });
    await system.waitTicks(20);
    const af = new AttackFunction(p)
    af.ZangekiAttack(
        "minecraft:soul",
        0.4,
        140,
        0,
        4.5,
        (target) => {
            target.applyDamage(15, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: p
            });
        }
    );

    af.ZangekiAttack(
        "minecraft:soul",
        0.4,
        140,
        0,
        -4.5,
        (target) => {
            target.applyDamage(15, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: p
            });
        }
    );

})