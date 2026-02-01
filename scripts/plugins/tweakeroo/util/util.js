import * as server from "@minecraft/server"
const { world } = server;
import { JsonDypro } from "./jsonDypro.js";
const settingData = new JsonDypro("tweakeroo_setting")

export class TwUtil {
    static placeBlock(player, loc) {
        const dim = player.dimension;
        const comp = player.getComponent("minecraft:inventory").container;
        const slot = player.selectedSlotIndex;
        let item = comp.getItem(slot);
        if (!item) return false;

        const typeId = item.typeId; // Remember typeId before consumption
        const block = dim.getBlock(loc);
        if (!block?.isAir) return false;

        dim.setBlockType(loc, typeId);

        // Consume item
        if (item.amount > 1) {
            item.amount--;
            comp.setItem(slot, item);
        } else {
            comp.setItem(slot, undefined);
            item = undefined;
        }

        // Hand Restock logic
        if (settingData.get(player)?.handRestock) {
            const currentItem = comp.getItem(slot);
            const amount = currentItem?.amount || 0;
            if (amount <= 5) {
                let totalAmount = amount;
                const targetAmount = 32;

                for (let i = 0; i < comp.size; i++) {
                    if (i === slot) continue;
                    const item2 = comp.getItem(i);
                    if (item2 && item2.typeId === typeId) {
                        const needed = targetAmount - totalAmount;
                        if (needed <= 0) break;

                        if (item2.amount > needed) {
                            item2.amount -= needed;
                            totalAmount += needed;
                            comp.setItem(i, item2);
                        } else {
                            totalAmount += item2.amount;
                            comp.setItem(i, undefined);
                        }
                    }
                }
                if (totalAmount > amount) {
                    comp.setItem(slot, new server.ItemStack(typeId, totalAmount));
                }
            }
        }
        return true;
    }
}