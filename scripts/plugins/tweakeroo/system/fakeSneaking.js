import * as server from "@minecraft/server"
const { world, system } = server;
import { JsonDypro } from "../util/jsonDypro.js";
const settingData = new JsonDypro("tweakeroo_setting")


system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (!settingData.get(player)?.fakeSneaking) continue;
        if (player.isFalling) continue;
        const velocity = player.getVelocity();
        // Ignore if already jumping or falling significantly
        if (Math.abs(velocity.y) > 0.1) continue;
        const dim = player.dimension;
        const loc = player.location;
        if (!player.isOnGround) continue;
        // Check future position (simple linear prediction)
        const nextX = loc.x + velocity.x;
        const nextZ = loc.z + velocity.z;

        // Check the block below the next position
        // We check slightly below feet (y - 1)
        const blockBelow = dim.getBlock({ x: nextX, y: loc.y - 1, z: nextZ });

        if (blockBelow && (blockBelow.isAir || blockBelow.isLiquid)) {
            // Apply impulse in the opposite direction to stop movement
            player.applyImpulse({ x: -velocity.x * 2, y: 0, z: -velocity.z * 2 });
            const vero = player.getVelocity();
            if (Math.abs(vero.x) > 1 || Math.abs(vero.z) > 1) {
                player.clearVelocity();
            }
        }
    }
});