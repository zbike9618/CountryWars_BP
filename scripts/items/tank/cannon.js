import * as server from "@minecraft/server"
const { world } = server;

world.afterEvents.itemUse.subscribe((ev) => {
    if (ev.itemStack.typeId !== "minecraft:tnt") return;
    const player = ev.source;
    const dimension = player.dimension;

    let tank = undefined;
    for (const e of dimension.getEntities({ type: "cw:tank" })) {
        if (e.getComponent("minecraft:rideable").getRiders().map(en => en.id).includes(player.id)) {
            tank = e;
            break;
        }

    }
    if (!tank) return;
    //itemの設定
    const need = 5;
    const amount = ev.itemStack.amount;
    if (amount < need) return;
    const inventory = player.getComponent("inventory");
    const container = inventory.container
    container.setItem(player.selectedSlotIndex, new server.ItemStack("tnt", amount - need))



    const dir = player.getViewDirection();
    const loc = player.getHeadLocation()
    const spawnloc = {
        x: loc.x + dir.x * 2,
        y: loc.y + dir.y * 2,
        z: loc.z + dir.z * 2
    }
    const distance = 4;
    const power = 3;
    const entity = dimension.spawnEntity("cw:cannon_ball", spawnloc);
    entity.applyImpulse({
        x: dir.x * distance,
        y: dir.y * distance,
        z: dir.z * distance
    })
    entity.setProperty("cw:explosion_level", power)
})