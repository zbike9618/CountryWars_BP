import * as server from "@minecraft/server"
import { getAttachment } from "./attachment";
const { world } = server;
world.afterEvents.entityDie.subscribe((ev) => {
    const entity = ev.deadEntity;
    if (entity.isValid && entity.typeId === "cw:tank") {
        const dimension = entity.dimension;
        const attachments = getAttachment(entity);
        const explosion = attachments.explosion || 0
        if (explosion) {
            dimension.createExplosion(entity.location, 5 + 3 * explosion);
        }
    }
})