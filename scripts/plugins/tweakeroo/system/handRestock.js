import * as server from "@minecraft/server"
const { world, system } = server;
import { JsonDypro } from "../util/jsonDypro.js";
const settingData = new JsonDypro("tweakeroo_setting")

world.afterEvents.playerSwingStart.subscribe((ev) => {
    const player = ev.player;
    const item = ev.heldItemStack;
    if (ev.swingSource != "Build") return;
    if (!item) return;
    if (!settingData.get(player)?.handRestock) return;
    if (item.amount > 5) return;
    const comp = player.getComponent("inventory");
    if (!comp) return;
    const inv = comp.container;
    let slot = undefined;
    let totalAmount = item.amount;
    const targetAmount = 32;

    for (let i = 0; i < inv.size; i++) {
        if (i == player.selectedSlotIndex) continue;
        const item2 = inv.getItem(i);
        if (!item2) continue;
        if (item2.typeId == item.typeId) {
            slot = i;
            const needed = targetAmount - totalAmount;
            if (needed <= 0) break;

            if (item2.amount > needed) {
                item2.amount -= needed;
                totalAmount += needed;
                inv.setItem(i, item2);
            } else {
                totalAmount += item2.amount;
                inv.setItem(i);
            }
        }
    }

    // Update the main hand if changes were made
    if (totalAmount > item.amount) {
        inv.setItem(player.selectedSlotIndex, new server.ItemStack(item.typeId, totalAmount));
    }
});