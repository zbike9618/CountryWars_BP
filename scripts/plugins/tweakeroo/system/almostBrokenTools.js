import * as server from "@minecraft/server"
const { world, system } = server;
import { JsonDypro } from "../util/jsonDypro.js";
const settingData = new JsonDypro("tweakeroo_setting")

world.afterEvents.playerSwingStart.subscribe((ev) => {
    const player = ev.player;
    if (ev.swingSource != "Mine") return
    if (!settingData.get(player)?.swapAlmostBrokenTools) return;
    const comp = player.getComponent("inventory");
    if (!comp) return;
    const inv = comp.container;
    const item = inv.getItem(player.selectedSlotIndex);
    if (!item) return;
    const dura = item.getComponent("minecraft:durability")
    if (!dura) return;
    if (dura.maxDurability - dura.damage <= 5) {
        let slot = undefined;
        let airSlot = undefined;
        for (let i = inv.size - 1; i >= 0; i--) {
            const item2 = inv.getItem(i);

            if (!item2 && !airSlot) {
                airSlot = i;
                continue;
            }
            if (!item2) continue;
            const dura2 = item2.getComponent("minecraft:durability")
            if (!dura2) continue;
            if (dura2.maxDurability - dura2.damage > 5 && item2.typeId.includes(item.typeId.split("_")[1])) {
                slot = i;
                break;
            }
        }
        if (slot == undefined && airSlot) {
            slot = airSlot;
        }
        if (!slot && slot != 0) {
            player.onScreenDisplay.setActionBar(`§cAlmost Broken Tools,but unchangeable...`)
            return;
        }

        player.onScreenDisplay.setActionBar(`§cAlmost Broken Tools,so changed...`)
        inv.swapItems(player.selectedSlotIndex, slot, inv)
    }
})
