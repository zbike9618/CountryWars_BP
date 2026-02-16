import * as server from "@minecraft/server"
import { getAttachment } from "./attachment";
const { world } = server;
world.afterEvents.entityDie.subscribe((ev) => {
    const entity = ev.deadEntity;
    const dimension = entity.dimension;
    if (entity.typeId === "cw:tank") {
        const attachments = getAttachment(entity);
        const explosion = attachments.explosion || 0
        if (explosion) {
            dimension.createExplosion(entity.location, 5 + 3 * explosion);
        }
    }
})