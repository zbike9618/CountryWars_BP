import { world, system } from "@minecraft/server";
import { blockInteractCallbacks } from "../utils/resister"
import { ChestFormData } from "../utils/chest_shop/chest-ui";
import { itemIdToPath } from "../../config/texture_config";
import { Util } from "../utils/util";

blockInteractCallbacks.push((arg) => {
    /** @type {import("@minecraft/server").BlockComponentPlayerInteractEvent} */
    const e = arg;
    if (e.block.typeId == "cw:potion_crafter") {
        _showForm(e.player);
    }
});
/**
 * 
 * @param {import("@minecraft/server").Player} player 
 */
async function _showForm(player, potionData = []) {
    const form = new ChestFormData("large");
    form.setTitle("MAkE POTION")
    //inventory
    const inventory = player.getComponent("inventory").container
    const countSlots = 27;
    const items = []
    for (let i = 0; i < countSlots; i++) {
        const item = inventory.getItem(i)
        if (item) {
            items.push(item.typeId)
            form.setButton(i + 9, {
                iconPath: itemIdToPath[item.typeId],
                name: Util.langChangeItemName(item.typeId),
                stackAmount: item.amount,
            })
        } else {
            items.push(null)
            form.setButton(i + 9, {
                iconPath: itemIdToPath["minecraft:barrier"],
                name: "None",
                stackAmount: 1,
                editedName: true
            })
        }
    }
    //Main UI Button
    form.setButton(1, {
        iconPath: itemIdToPath["minecraft:brewing_stand"],
        name: "調合する",
        stackAmount: 1,
        editedName: true
    })
    const res = await form.show(player)
    if (res.canceled) return;
    const buttonId = res.selection;
    if (buttonId === 1) {
        //調合する
    }
    if (8 < buttonId && buttonId < 18) {
        //材料削除
        const index = buttonId - 9
        const item = potionData[index]
        if (item) {
            inventory.setItem(index, item)
            potionData.splice(index, 1)
        }
        _showForm(player, potionData)
    }
    if (buttonId > 27) {
        //Inventoryを追加
        const item = items[buttonId - 28]
        if (item) {
            potionData.push(item)
        }
        _showForm(player, potionData)
    }

}