import * as server from "@minecraft/server"
const { world, system } = server;
const heldItem = new Map();
const subscribe = [];

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const comp = player.getComponent("minecraft:inventory").container;
        const item = comp.getItem(player.selectedSlotIndex)
        if (!heldItem.has(player.id)) {
            heldItem.set(player.id, item?.typeId)
            continue;
        }
        if (heldItem.get(player.id) != item?.typeId) {
            heldItem.set(player.id, item?.typeId)
            subscribe.forEach(s => {
                s({ player, itemStack: item })
            })
        }
    }
}, 1)

export const changeMainItem = {
    call: (run) => {
        subscribe.push(run)
    }
}