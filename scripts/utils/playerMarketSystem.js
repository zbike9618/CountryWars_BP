import { Dypro } from "./dypro.js"
import * as server from "@minecraft/server"
const { world, system, RawMessage } = server;
import { ChestFormData } from "./chest_shop/chest-ui"
import { sendDataForPlayers } from "./sendData.js";
import { Util } from "./util.js";
import { itemIdToPath } from "../config/texture_config.js"
const playerDatas = new Dypro("player");
const marketDatas = new Dypro("playermarket");
export class playerMarketSystem {
    /**
     * 
     * @param {server.Player} player 
     * @param {Object} itemData 
     */

    static sell(player, itemData) {
        let page = 0
        while ((marketDatas.get(`${page}`) || []).length == 45) {
            page++;
        }
        const marketData = /*marketDatas.get(`${page}`) || */[];
        marketData.push({
            player: player.id,
            itemId: itemData.itemId,
            amount: itemData.amount,
            price: itemData.price,
            description: itemData.description
        })
        marketDatas.set(`${page}`, marketData);
    }
    /**
     * 
     * @param {server.Player} player 
     * @param {{ slot: number, page: number }} { slot, page } 
     */
    static buy(player, { slot, page }) {
        const marketData = marketDatas.get(`${page}`);//仮として0
        const itemData = marketData[slot];
        const itemId = itemData.itemId;
        const amount = itemData.amount
        const price = itemData.price;
        const seller = itemData.player;
        const comp = player.getComponent("minecraft:inventory");
        const inv = comp.container;
        if (amount != 0) {
            const count = Math.floor(amount / 64);
            for (let i = 0; i < count; i++) {
                inv.addItem(new server.ItemStack(itemId, 64))
            }
            const result = amount - (count * 64)
            if (result != 0) {
                inv.addItem(new server.ItemStack(itemId, result))
            }
        }
        Util.addMoney(player, -price)

        const data = `Util.addMoney(world.getEntity("${seller}"), ${price})`
        sendDataForPlayers(data, seller)
        marketData.splice(slot, 1);
        marketDatas.set(`${page}`, marketData);
    }
    static async show(player, page = 0) {
        const form = new ChestFormData("large")
        form.setTitle({ translate: "cw.playermarket.title" })
        const marketData = marketDatas.get(`${page}`) || [];
        if (marketDatas.get(`${page - 1}`)) {
            form.setButton(0, {
                iconPath: "textures/ui/arrow_dark_left_stretch",
                name: "Undo", lore: ["<Click here>"],
                editedName: true
            })
        }
        if (marketDatas.get(`${page + 1}`)) {
            form.setButton(8, {
                iconPath: "textures/ui/arrow_dark_right_stretch",
                name: "Next", lore: ["<Click here>"],
                editedName: true
            })
        }
        for (let i = 0; i < marketData.length; i++) {
            const itemData = marketData[i];
            const number = Math.floor(itemData.amount / 64)
            const restAmount = itemData.amount - (number * 64)
            const displayAmount = `${number > 0 ? number.toString() + "st + " + restAmount.toString() : restAmount}`

            form.setButton(i + 9, {
                iconPath: itemIdToPath[itemData.itemId],
                name: {
                    rawtext: [{ translate: Util.langChangeItemName(itemData.itemId) },
                    { text: `[${displayAmount}]` }]
                },
                lore: [`販売者:${playerDatas.get(itemData.player)?.name}`, `${itemData.description}`, `§e§l¥${itemData.price}§r`],
                stackAmount: itemData.amount,
                editedName: true
            })
        }
        const res = await form.show(player)
        if (res.canceled) return "none";
        if (res.selection == 0) {
            const loc = await this.show(player, page - 1)
            return loc;
        }
        if (res.selection == 8) {
            const loc = await this.show(player, page + 1)
            return loc;
        }
        const slot = res.selection - 9;
        return { slot, page }

    }
}