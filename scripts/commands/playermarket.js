import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { playerMarketSystem } from "../utils/playerMarketSystem.js";
import { Dypro } from "../utils/dypro.js";
import { Util } from "../utils/util.js";
import { itemIdToPath } from "../config/texture_config.js";
import { ActionForm } from "../utils/form_class.js";
const marketDatas = new Dypro("playermarket");
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:playermarket", // コマンド名
        description: "プレイヤーマーケットをみる", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const scommand = {
        name: "cw:pm", // コマンド名
        description: "プレイヤーマーケットをみる", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }

    ev.customCommandRegistry.registerCommand(command, DoCommand);
    ev.customCommandRegistry.registerCommand(scommand, DoCommand);
});

function DoCommand(origin) {
    // もし実行者エンティティの種族がプレイヤーではないなら
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        // コマンド結果を返す
        return {
            status: server.CustomCommandStatus.Failure, // 失敗
            message: "実行者はプレイヤーである必要があります",
        }
    }

    const player = origin.sourceEntity;
    //関数を実行する
    system.run(() => {
        showPlayerMarket(player);
    })



    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}

async function showPlayerMarket(player) {
    const form = new ActionFormData()
    form.title({ translate: "cw.playermarket.title" })
    form.button({ translate: "cw.playermarket.see" })
    form.button({ translate: "cw.playermarket.sell" })
    form.button({ translate: "cw.playermarket.edit" })
    const res = await form.show(player)
    if (res.canceled) return;
    if (res.selection === 0) {
        const loc = await playerMarketSystem.show(player)
        if (loc == "none") return;
        buyForm(player, loc)
    }
    if (res.selection === 1) {
        sellForm(player)
    }
    if (res.selection === 2) {
        editForm(player)
    }

}
async function buyForm(player, { slot, page }) {
    const data = marketDatas.get(`${page}`)[slot];
    const buyerData = playerDatas.get(player.id);
    const countryId = buyerData?.country;

    // 消費税 (Consumption Tax) の計算 (購入者ベース)
    let taxRate = 0;
    if (countryId) {
        const countryData = countryDatas.get(countryId);
        if (countryData) {
            taxRate = countryData.tax.consumption || 0;
        }
    }
    const currentPrice = Array.isArray(data.price) ? data.price[data.price.length - 1] : data.price;
    const taxAmount = Math.floor(currentPrice * (taxRate / 100));
    const totalToPay = currentPrice + taxAmount;

    const form = new MessageFormData()
    form.title({ translate: "cw.playermarket.buy" })

    // 詳細情報の作成 (Lore と エンチャント)
    let itemDetails = "";
    if (data.enchants && data.enchants.length > 0) {
        itemDetails += "\n§f付与されている効果:";
        for (const enchant of data.enchants) {
            itemDetails += `\n §7- ${enchant.id} (Lv.${enchant.level})`;
        }
    }
    if (data.durability) {
        itemDetails += `\n§f耐久値の消耗: §c${data.durability}`;
    }
    if (data.lore) {
        itemDetails += `\n§fアイテムのロア:\n §7${data.lore.replace(/\n/g, "\n ")}`;
    }

    if (buyerData.money < totalToPay) {
        form.body({ translate: "cw.form.nomoney" })
        form.button1({ translate: "cw.form.redo" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection == 0) {
            const loc = await playerMarketSystem.show(player, page)
            if (loc == "none") return;
            buyForm(player, loc)
        }
        return;
    }

    form.body({
        translate: "cw.playermarket.buy.body2",
        with: [
            { translate: Util.langChangeItemName(data.itemId) }, // %1: 商品名
            data.amount.toString(),                             // %2: 数量
            totalToPay.toString(),                               // %3: 税込価格
            currentPrice.toString(),                             // %4: 税抜価格
            playerDatas.get(data.player)?.name || "Unknown",     // %5: 出品者
            data.description || "---",                           // %6: 説明
            itemDetails || "§7(なし)",                            // %7: 詳細情報
            buyerData.money.toString()                           // %8: 所持金
        ]
    })
    form.button1({ translate: "cw.form.buy" })
    form.button2({ translate: "cw.form.cancel" })

    const res = await form.show(player)
    if (res.canceled) {
        const loc = await playerMarketSystem.show(player, page)
        if (loc !== "none") buyForm(player, loc);
        return;
    }

    if (res.selection === 0) {
        player.sendMessage({
            rawtext: [
                { translate: "cw.playermarket.buy.success", with: [{ translate: Util.langChangeItemName(data.itemId) }] }
            ]
        })
        playerMarketSystem.buy(player, { slot, page })
    } else {
        const loc = await playerMarketSystem.show(player, page)
        if (loc !== "none") buyForm(player, loc);
    }
}
/**
 * @param {server.Player} player 
 */
async function sellForm(player) {
    const aform = new ActionFormData()
    aform.title({ translate: "cw.playermarket.sell" })
    const comp = player.getComponent("minecraft:inventory");
    const inv = comp.container;
    const size = inv.size;
    const items = [];
    for (let i = 0; i < size; i++) {
        const item = inv.getItem(i)
        if (!item) continue;
        if (items.find(i => i.typeId === item.typeId)) continue;
        items.push(item)
    }
    for (const item of items) {
        aform.button({ translate: Util.langChangeItemName(item.typeId) }, itemIdToPath[item.typeId])
    }
    const resItem = await aform.show(player)
    if (resItem.canceled) return;
    const item = items[resItem.selection]
    let amount = 0;
    for (let i = 0; i < size; i++) {
        const item = inv.getItem(i)
        if (!item) continue;
        if (item.typeId !== items[resItem.selection].typeId) continue;
        amount += item.amount;
    }
    sellFormS(player, item, amount)

}
/**
 * @param {server.Player} player 
 * @param {server.ItemStack} item 
 * @param {number} maxamount 
 */
async function sellFormS(player, item, maxamount) {
    const form = new ModalFormData()
    form.title({ translate: "cw.playermarket.sell" })
    form.textField({ translate: "cw.playermarket.sell.price" }, "Press Number")
    form.slider({ translate: "cw.playermarket.sell.amount" }, 1, maxamount)
    form.textField({ translate: "cw.playermarket.sell.description" }, "Press Description")
    const res = await form.show(player)
    if (res.canceled) return;
    if (!Number.isInteger(Number(res.formValues[0])) || Number < 0) {
        const mform = new MessageFormData()
        mform.title({ translate: "cw.playermarket.sell" })
        mform.body({ translate: "cw.form.error.int" })
        mform.button1({ translate: "cw.form.redo" })
        mform.button2({ translate: "cw.form.cancel" })
        const res = await mform.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {
            sellFormS(player, item, maxamount)
        }
        return;
    }
    const amount = res.formValues[1]
    const Ecomp = item.getComponent("minecraft:enchantable")
    let enchants = []
    if (Ecomp) {
        const enchantments = Ecomp.getEnchantments()

        for (const enchantment of enchantments) {
            enchants.push({ id: enchantment.type.id, level: enchantment.level })
        }
    }
    const durComp = item.getComponent("minecraft:durability");
    const durability = durComp ? durComp.damage : 0;

    playerMarketSystem.sell(player, { itemId: item.typeId, amount, enchants, lore: item.getLore().join("\n"), price: Number(res.formValues[0]), description: res.formValues[2], durability })
    const comp = player.getComponent("minecraft:inventory");
    const inv = comp.container;
    for (let i = 0; i < inv.size; i++) {
        const newItem = inv.getItem(i)
        if (!newItem) continue;
        if (newItem.typeId !== item.typeId) continue;
        inv.setItem(i)
    }
    player.sendMessage({
        rawtext: [
            { translate: `${Util.langChangeItemName(item.typeId)}` },
            { translate: "cw.playermarket.sell.success", with: [`${amount}`] }
        ]
    })
    world.sendMessage({
        rawtext: [
            { translate: "cw.playermarket.selled.success1" },
            { translate: `${Util.langChangeItemName(item.typeId)}` },
            { translate: "cw.playermarket.selled.success2", with: [`${amount}`] }
        ]
    })
    const amountC = maxamount - amount;
    if (amountC == 0) return;
    const count = Math.floor(amountC / 64);
    for (let i = 0; i < count; i++) {
        inv.addItem(new server.ItemStack(`${item.typeId}`, 64))
    }
    inv.addItem(new server.ItemStack(`${item.typeId}`, amountC - (count * 64)))

}
async function editForm(player) {
    const form = new ActionFormData()
    form.title({ translate: "cw.playermarket.edit" })
    const datas = []
    for (const page of marketDatas.idList) {
        let slot = 0;
        for (const data of marketDatas.get(`${page}`)) {

            if (data.player == player.id) {
                form.button({ translate: Util.langChangeItemName(data.itemId) }, itemIdToPath[data.itemId])
                datas.push({ page, slot })
            }
            slot++
        }
    }
    const res = await form.show(player)
    if (res.canceled) return;
    editForm2(player, { page: datas[res.selection].page, slot: datas[res.selection].slot })
}
async function editForm2(player, { page, slot }) {
    const marketData = marketDatas.get(`${page}`)[slot];
    const form = new ModalFormData()
    form.title({ translate: "cw.playermarket.sell" })
    form.toggle({ translate: "cw.playermarket.edit.toggle" })
    form.textField({ translate: "cw.playermarket.sell.price" }, "Press Number", { defaultValue: `${marketData.price[marketData.price.length - 1]}` })
    form.textField({ translate: "cw.playermarket.sell.description" }, "Press Description", { defaultValue: marketData.description })
    const res = await form.show(player)
    if (res.canceled) return;
    if (res.formValues[0]) {
        const comp = player.getComponent("minecraft:inventory");
        const inv = comp.container;
        const { itemId, lore, amount } = marketData
        if (amount != 0) {
            const count = Math.floor(amount / 64);
            for (let i = 0; i < count; i++) {
                const item = new server.ItemStack(itemId, 64)
                if (lore) {
                    const lores = lore.split("\n")
                    item.setLore(lores)
                }
                if (marketData.enchants) {
                    const comp = item.getComponent("minecraft:enchantable")
                    const enchantments = marketData.enchants
                    for (const enchantment of enchantments) {
                        comp.addEnchantment({ type: new server.EnchantmentType(enchantment.id), level: enchantment.level })
                    }
                }
                if (marketData.durability) {
                    const durComp = item.getComponent("minecraft:durability");
                    if (durComp) durComp.damage = marketData.durability;
                }
                inv.addItem(item)
            }
            const result = amount - (count * 64)
            if (result != 0) {
                const item = new server.ItemStack(itemId, result)
                if (lore) {
                    const lores = lore.split("\n")
                    item.setLore(lores)
                }
                if (marketData.enchants) {
                    const comp = item.getComponent("minecraft:enchantable")
                    const enchantments = marketData.enchants
                    for (const enchantment of enchantments) {
                        comp.addEnchantment({ type: new server.EnchantmentType(enchantment.id), level: enchantment.level })
                    }
                }
                if (marketData.durability) {
                    const durComp = item.getComponent("minecraft:durability");
                    if (durComp) durComp.damage = marketData.durability;
                }
                inv.addItem(item)
            }
        }
        playerMarketSystem.delete({ slot, page })
        return;
    }
    if (!Number.isInteger(Number(res.formValues[1])) || Number < 0) {
        const mform = new MessageFormData()
        mform.title({ translate: "cw.playermarket.sell" })
        mform.body({ translate: "cw.playermarket.sell.priceerror" })
        mform.button1({ translate: "cw.form.redo" })
        mform.button2({ translate: "cw.form.cancel" })
        const res = await mform.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {
            editForm2(player, { page, slot })
        }
        return
    }
    marketData.price.push(Number(res.formValues[1]))
    marketData.description = res.formValues[2]
    playerMarketSystem.edit(marketData, { page, slot })
}