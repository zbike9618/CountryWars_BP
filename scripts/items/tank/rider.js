import * as server from "@minecraft/server";
const { world, system } = server
system.runInterval(() => {
    for (const dimension of [world.getDimension("overworld"), world.getDimension("nether"), world.getDimension("the_end")]) {
        for (const tank of dimension.getEntities({ type: "cw:tank" })) {
            const comp = tank.getComponent("minecraft:rideable")
            if (!comp) continue;
            const riders = comp.getRiders()
            if (riders.length == 0) continue;
            riders[0].addEffect("resistance", 30, { amplifier: 2, showParticles: false })
        }
    }
}, 20)