import * as server from "@minecraft/server";
import { ChestFormData } from "../../utils/chest_shop/chest-ui";
import { itemIdToPath } from "../../config/texture_config";
import { Util } from "../../utils/util";
/**
 * @param {server.Player} player
 * @param {server.Player} target
 */
export async function CheckInventory(player, target) {
    const form = new ChestFormData();
    const comp = target.getComponent("inventory")
    const inv = comp.container;
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        form.setButton(i,
            {
                iconPath: itemIdToPath[item.typeId],
                name: Util.langChangeItemName(item.typeId),
                stackAmount: item.amount,
                lore: [item.nameTag ? item.nameTag : ""]
            })
    }
    form.setTitle("Inventory");
    form.show(player);

}