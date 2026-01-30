import { Dypro } from "./dypro.js"
import * as server from "@minecraft/server"
const { world, system, RawMessage } = server;
import { ChestFormData } from "./chest_shop/chest-ui"
import { sendDataForPlayers } from "./sendData.js";
import { Util } from "./util.js";
import { itemIdToPath } from "../config/texture_config.js"
import { Data } from "./data.js";
import { Chunk } from "./chunk.js";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
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
        const marketData = marketDatas.get(`${page}`) || [];
        marketData.push({
            player: player.id,
            itemId: itemData.itemId,
            amount: itemData.amount,
            lore: itemData.lore,
            price: [itemData.price],
            description: itemData.description,
            enchants: itemData.enchants
        })
        marketDatas.set(`${page}`, marketData);

        player.sendMessage({
            translate: "cw.playermarket.sell.success",
            with: [itemData.amount.toString()]
        });

        world.sendMessage({
            rawtext: [
                { translate: "cw.playermarket.selled.success1" },
                {
                    translate: "cw.playermarket.selled.success2",
                    with: [itemData.amount.toString()]
                }
            ]
        });
    }
    /**
     * 
     * @param {server.Player} player 
     * @param {{ slot: number, page: number }} { slot, page } 
     */
    static async buy(player, { slot, page }) {
        const marketData = marketDatas.get(`${page}`);
        const itemData = marketData[slot];
        const itemId = itemData.itemId;
        const amount = itemData.amount;
        const seller = itemData.player;
        const currentPrice = Array.isArray(itemData.price) ? itemData.price[itemData.price.length - 1] : itemData.price;

        // 消費税 (Consumption Tax) の計算 (購入者ベース)
        const buyerData = playerDatas.get(player.id);
        const countryId = buyerData?.country;
        let taxRate = 0;
        if (countryId) {
            const countryData = countryDatas.get(countryId);
            if (countryData) {
                taxRate = countryData.tax.consumption || 0;
            }
        }
        const taxAmount = Math.floor(currentPrice * (taxRate / 100));
        const totalToPay = currentPrice + taxAmount;

        const playerMoney = Util.getMoney(player);

        // 詳細情報の作成 (Lore と エンチャント)
        let details = "";
        if (itemData.enchants) {
            details += "\n§f付与されている効果:";
            for (const enchant of itemData.enchants) {
                details += `\n §7- ${enchant.id} (Lv.${enchant.level})`;
            }
        }
        if (itemData.lore) {
            details += `\n§fアイテムのロア:\n §7${itemData.lore.replace(/\n/g, "\n ")}`;
        }

        if (playerMoney < totalToPay) {
            player.sendMessage({ translate: "cw.form.nomoney" });
            return;
        }

        const comp = player.getComponent("minecraft:inventory");
        const inv = comp.container;
        if (amount != 0) {
            const count = Math.floor(amount / 64);
            for (let i = 0; i < count; i++) {
                const item = new server.ItemStack(itemId, 64)
                if (itemData.lore) {
                    const lore = itemData.lore.split("\n")
                    item.setLore(lore)
                }
                if (itemData.enchants) {
                    const comp = item.getComponent("minecraft:enchantable")
                    const enchantments = itemData.enchants
                    for (const enchantment of enchantments) {
                        comp.addEnchantment({ type: new server.EnchantmentType(enchantment.id), level: enchantment.level })
                    }
                }
                inv.addItem(item)
            }
            const result = amount - (count * 64)
            if (result != 0) {

                const item = new server.ItemStack(itemId, result)
                if (itemData.lore) {
                    const lore = itemData.lore.split("\n")
                    item.setLore(lore)
                }
                if (itemData.enchants) {
                    const comp = item.getComponent("minecraft:enchantable")
                    const enchantments = itemData.enchants
                    for (const enchantment of enchantments) {
                        comp.addEnchantment({ type: new server.EnchantmentType(enchantment.id), level: enchantment.level })
                    }
                }
                inv.addItem(item)
            }
        }

        Util.addMoney(player, -totalToPay);

        // 消費税を国庫へ
        if (countryId && taxAmount > 0) {
            const countryData = countryDatas.get(countryId);
            if (countryData) {
                countryData.money += taxAmount;
                countryDatas.set(countryId, countryData);
            }
        }

        const data = `Util.addMoney(world.getEntity("${seller}"), ${currentPrice})`;
        sendDataForPlayers(data, seller);

        player.sendMessage({
            translate: "cw.playermarket.buy.success",
            with: [{ translate: Util.langChangeItemName(itemId) }]
        });

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
            let offInt = 0;
            let isDiscount = false;
            if (itemData.price.length > 1) {
                const oldPrice = itemData.price[0];
                const newPrice = itemData.price[itemData.price.length - 1];
                if (newPrice > oldPrice) {
                    offInt = Math.round(((newPrice - oldPrice) / oldPrice) * 100);
                } else if (newPrice < oldPrice) {
                    offInt = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
                    isDiscount = true;
                }
            }
            const lore = [{ text: `販売者:${playerDatas.get(itemData.player)?.name}` }]

            // 消費税 (Consumption Tax) の計算 (閲覧者ベース)
            const buyerData = playerDatas.get(player.id);
            const countryId = buyerData?.country;
            let taxRate = 0;
            if (countryId) {
                const countryData = countryDatas.get(countryId);
                if (countryData) {
                    taxRate = countryData.tax.consumption || 0;
                }
            }
            const currentPrice = itemData.price[itemData.price.length - 1];
            const taxAmount = Math.floor(currentPrice * (taxRate / 100));
            const totalWithTax = currentPrice + taxAmount;

            if (itemData.enchants) {
                lore.push({ text: "\nEnchants : " })
                for (const enchantment of itemData.enchants) {
                    lore.push({ text: "\n" })
                    lore.push({ translate: Data.enchantsLang[enchantment.id] })
                    lore.push({ translate: `enchantment.level.${enchantment.level}` })
                }
            }
            if (itemData.lore) lore.push({ text: `\nLore: ${itemData.lore}` })
            lore.push({ text: `\n${itemData.description}` })

            // 価格表示の更新
            if (itemData.price.length == 1) {
                lore.push({ text: `\n§e§l¥${currentPrice} (税込: ¥${totalWithTax})§r` })
            } else {
                const oldPrice = itemData.price[0];
                lore.push({ text: `\n§c§l¥${oldPrice}§r => §e§l¥${currentPrice} (税込: ¥${totalWithTax})§r` })
            }

            if (taxRate > 0) {
                lore.push({ text: `\n§7※あなたの国の消費税(${taxRate}%)が適用されています。` });
            }

            if (itemData.price.length > 1 && offInt > 0) {
                lore.push({ text: isDiscount ? `\n§4${offInt}％OFF` : `\n§c${offInt}％UP` });
            }
            form.setButton(i + 9, {
                iconPath: itemIdToPath[itemData.itemId],
                name: {
                    rawtext: [{ translate: Util.langChangeItemName(itemData.itemId) },
                    { text: `[${displayAmount}]` }]
                },
                lore,
                stackAmount: itemData.amount,
                editedName: true,
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
    static delete({ slot, page }) {

        const marketData = marketDatas.get(`${page}`);
        marketData.splice(slot, 1);
        marketDatas.set(`${page}`, marketData);
    }
    static edit(newData, { slot, page }) {
        const marketData = marketDatas.get(`${page}`);
        marketData[slot] = newData;
        marketDatas.set(`${page}`, marketData);
    }
}
