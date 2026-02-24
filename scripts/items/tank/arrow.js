import * as server from "@minecraft/server";
const { world, system } = server
const counter = new Set();
system.runInterval(() => {
    for (const dimension of [world.getDimension("overworld"), world.getDimension("nether"), world.getDimension("the_end")]) {
        for (const tank of dimension.getEntities({ type: "cw:tank" })) {
            for (const arrow of dimension.getEntities({ type: "minecraft:arrow", maxDistance: 5, location: tank.location })) {
                if (counter.has(arrow.id)) continue;
                const vel = arrow.getVelocity()
                const rotation = arrow.getRotation()
                dimension.spawnParticle("minecraft:critical_hit_emitter", arrow.location)
                dimension.getPlayers({ maxDistance: 10, location: arrow.location }).forEach(player => {
                    player.playSound("random.anvil_land", arrow.location)
                })
                arrow.setRotation({
                    x: -rotation.x,
                    y: -rotation.y,
                    z: -rotation.z
                })
                arrow.applyImpulse({
                    x: vel.x * -1.5,
                    y: vel.y * -1.5,
                    z: vel.z * -1.5
                })
                counter.add(arrow.id)
                system.runTimeout(() => {
                    counter.delete(arrow.id)
                }, 20)
            }
        }
    }
}, 5)