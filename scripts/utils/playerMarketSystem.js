import { Dypro } from "./dypro.js"
import * as server from "@minecraft/server"
const { world, system } = server;
import { ChestFormData } from "./chest_shop/chest-ui"
import { sendDataForPlayers } from "./sendData.js";
import { Util } from "./util.js";
const marketDatas = new Dypro("playermarket");
class playerMarketSystem {
    /**
     * 
     * @param {server.Player} player 
     * @param {Object} itemData 
     */

    static sell(player, itemData) {
        let page = 0
        while (JSON.parse(marketDatas.get(`${page}`) || []).length) {
            page++;
        }

        const marketData = marketDatas.get(`${page}`) || [];
        marketData.push({
            player: player.id,
            itemStack: itemData.itemStack,
            price: itemData.price,
            description: itemData.description
        })
        marketDatas.set(`${page}`, JSON.stringify(marketData));
    }
    static buy(player, slot, page) {
        const get = marketDatas.get(`${page}`);//仮として0
        const marketData = JSON.parse(get) || [];
        const itemData = marketData[slot];
        const itemStack = itemData.itemStack;
        const price = itemData.price;
        const seller = itemData.player;
        const comp = player.getComponent("minecraft:inventory");
        const inv = comp.container;
        inv.addItem(itemStack)
        Util.addMoney(player, -price)
        const data = `Util.addMoney(world.getEntity(${seller.id}), ${price})`
        sendDataForPlayers(data, seller.id)
        delete marketData[slot];
        marketDatas.set(`${page}`, JSON.stringify(marketData));
    }
    static show(player, page = 0) {
        const form = new ChestFormData()
        form.title({ translate: "cw.playermarket.title" })
        form.setButton(5, {
            iconPath: "texture/ui/arrow_dark_right_stretch",
            name: "Next", lore: "<Click here>",
            editedName: true
        })
        const marketData = JSON.parse(get) || [];
        for (let i = 0; i < marketData.length; i++) {
            const itemData = marketData[i];
            form.setButton(i, {
                iconPath: itemData.itemStack.typeId,
                name: itemData.itemStack.typeId,
                lore: `${itemData.description}\n§e§l${itemData.price}§r`,
                editedName: true
            })
        }
        form.show(player)
    }
}