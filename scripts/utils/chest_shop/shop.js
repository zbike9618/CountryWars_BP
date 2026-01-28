import * as server from "@minecraft/server"
const { world, system, ItemStack } = server;
import { ModalFormData } from "@minecraft/server-ui";
import { ChestFormData } from "./chest-ui";
import shop_config from "../../config/shop_config";
import { itemIdToPath } from "../../config/texture_config"
import { Util } from "../util";
export async function openShop(player) {
    const form = new ChestFormData("small");
    form.setTitle({ translate: "cw.shop.title" });
    for (const i in shop_config) {
        form.setButton(i, {
            name: shop_config[i].name,
            iconPath: itemIdToPath[shop_config[i].icon],
            lore: shop_config[i].lore,
            editedName: true
        });
    }
    const res = await form.show(player);
    if (res.canceled) {
        return;
    }
    const items = shop_config[res.selection].items;
    const inform = new ChestFormData();
    inform.setTitle({ translate: "cw.shop.title" });
    for (const i in items) {
        inform.setButton(i, {
            name: Util.langChangeItemName(items[i].id),
            iconPath: itemIdToPath[items[i].id],
            lore: `¥${items[i].price}`
        });
    }
    const resp = await inform.show(player);
    if (resp.canceled || resp.selection === undefined) {
        openShop(player);
        return;
    }
    buyForm(player, items[resp.selection]);
}
/**
 * @param {server.Player} player
 * @param {Object} itemData
 */
async function buyForm(player, itemData) {
    const { id, price } = itemData;
    const modal = new ModalFormData();
    modal.title({ translate: "cw.shop.purchase_confirm" });
    modal.slider({ translate: "cw.shop.amount" }, 1, 64);
    modal.toggle({ translate: "cw.shop.stack_calculation" });

    const res = await modal.show(player);
    if (res.canceled) return;

    const [amount, isStack] = res.formValues;
    const finalAmount = isStack ? amount * 64 : amount;
    const totalPrice = finalAmount * price;

    const playerMoney = Util.getMoney(player);

    if (playerMoney < totalPrice) {
        player.sendMessage({
            rawtext: [
                { text: "§c" },
                {
                    translate: "cw.shop.not_enough_money",
                    with: [totalPrice.toString(), playerMoney.toString()]
                }
            ]
        });
        return;
    }

    const inv = player.getComponent("minecraft:inventory").container;

    Util.addMoney(player, -totalPrice);
    if (finalAmount != 0) {
        const count = Math.floor(finalAmount / 64);
        for (let i = 0; i < count; i++) {
            const item = new server.ItemStack(id, 64)
            inv.addItem(item)
        }
        const result = finalAmount - (count * 64)
        if (result != 0) {

            const item = new server.ItemStack(id, result)
            inv.addItem(item)
        }
    }

    player.sendMessage({
        rawtext: [
            { text: "§a" },
            { translate: "cw.shop.purchased" },
            { translate: Util.langChangeItemName(id) },
            { text: ` x${finalAmount} ` },
            { translate: "cw.shop.total_price" },
            { text: `¥${totalPrice}` }
        ]
    });

}
