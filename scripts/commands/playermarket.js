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
const LISTING_GONE_MESSAGE = "§cこの出品は、もう売れたか、内容が変わっています。もう一度開き直してください。";
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
    form.button({ translate: "cw.playermarket.history" })
    const res = await form.show(player)
    if (res.canceled) return;
    if (res.selection === 0) {
        const sel = await playerMarketSystem.show(player)
        if (sel == "none") return;
        buyForm(player, sel)
    }
    if (res.selection === 1) {
        sellForm(player)
    }
    if (res.selection === 2) {
        editForm(player)
    }
    if (res.selection === 3) {
        showHistoryForm(player)
    }
}
/**
 * @param {server.Player} player
 * @param {{ ref: { page: number, slot: number, data: Object }, viewPage: number }} sel 一覧で選んだ出品と、戻るときのページ
 */
async function buyForm(player, { ref, viewPage }) {
    const data = ref.data;
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

    const form = new ActionFormData()
    form.title({ translate: "cw.playermarket.buy" })

    // 詳細情報の作成 (Lore と エンチャント)
    let itemDetails = "";
    if (data.enchants && data.enchants.length > 0) {
        itemDetails += "\n§fエンチャント:";
        for (const enchant of data.enchants) {
            itemDetails += `\n §7- ${enchant.id} (Lv.${enchant.level})`;
        }
    }
    if (data.durability) {
        itemDetails += `\n§f耐久値の消耗: §c${data.durability}§r`;
    }
    if (data.lore) {
        itemDetails += `\n§fアイテムのロア:\n §7${data.lore.replace(/\n/g, "\n ")}`;
    }
    if (buyerData.money < totalToPay) {
        const mform = new MessageFormData()
        mform.title({ translate: "cw.playermarket.buy" })
        mform.body({ translate: "cw.form.nomoney" })
        mform.button1({ translate: "cw.form.redo" })
        mform.button2({ translate: "cw.form.cancel" })
        const res = await mform.show(player)
        if (res.canceled) return;
        if (res.selection == 0) {
            const sel = await playerMarketSystem.show(player, viewPage)
            if (sel == "none") return;
            buyForm(player, sel)
        }
        return;
    }

    const sellerName = playerDatas.get(data.player)?.name || "Unknown";
    const description = data.description || "---";
    const buyerMoney = buyerData.money.toString();

    form.body({
        rawtext: [
            { text: "§7----------------------\n§f商品: §b" },
            { translate: Util.langChangeItemName(data.itemId) },
            { text: `\n§f数量: §e${data.amount}個\n§f価格: §a¥${totalToPay} §7(税抜: ¥${currentPrice})\n§f出品者: §d${sellerName}\n§7----------------------\n§f説明: §7${description}\n§f詳細情報: ${itemDetails || "§7(なし)"}\n\n§f現在の所持金: §a¥${buyerMoney}` }
        ]
    });
    form.button({ translate: "cw.form.buy" })
    form.button({ translate: "cw.form.cancel" })

    const res = await form.show(player)
    if (res.canceled) {
        const sel = await playerMarketSystem.show(player, viewPage)
        if (sel !== "none") buyForm(player, sel);
        return;
    }

    if (res.selection === 0) {
        playerMarketSystem.buy(player, ref)
    } else {
        const sel = await playerMarketSystem.show(player, viewPage)
        if (sel !== "none") buyForm(player, sel);
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
    const AmountMax = item.maxAmount;
    const form = new ModalFormData()
    form.title({ translate: "cw.playermarket.sell" })
    form.textField({ translate: "cw.playermarket.sell.price" }, "Press Number")
    form.slider({ translate: "cw.playermarket.sell.amount" }, 1, maxamount)
    form.textField({ translate: "cw.playermarket.sell.description" }, "Press Description")
    const res = await form.show(player)
    if (res.canceled) return;
    const price = Number(res.formValues[0]);
    if (!Number.isInteger(price) || price < 0) {
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
        inv.setItem(i, undefined)
    }

    const amountC = maxamount - amount;
    if (amountC == 0) return;
    const count = Math.floor(amountC / AmountMax);
    for (let i = 0; i < count; i++) {
        const newItem = item.clone();
        newItem.clearDynamicProperties()
        newItem.amount = AmountMax;
        if (inv.emptySlotsCount == 0) {
            const ent = player.dimension.spawnItem(newItem, player.location)
            ent.clearVelocity()
        } else {
            inv.addItem(newItem)
        }
    }
    const remainder = amountC - (count * AmountMax);
    if (remainder > 0) {
        const newItem = item.clone();
        newItem.clearDynamicProperties()
        newItem.amount = remainder;
        if (inv.emptySlotsCount == 0) {
            const ent = player.dimension.spawnItem(newItem, player.location)
            ent.clearVelocity()
        } else {
            inv.addItem(newItem)
        }
    }

}
async function editForm(player) {
    const form = new ActionFormData()
    form.title({ translate: "cw.playermarket.edit" })
    // 一覧と同じ並び順で、自分の出品だけを出す
    const mine = playerMarketSystem.listAll().filter(l => l.data.player == player.id)
    const datas = playerMarketSystem.sortListings(mine, playerMarketSystem.getSortMode(player))
    for (const { data } of datas) {
        form.button({ translate: Util.langChangeItemName(data.itemId) }, itemIdToPath[data.itemId])
    }
    const res = await form.show(player)
    if (res.canceled) return;
    const { page, slot, data } = datas[res.selection]
    editForm2(player, { page, slot, data })
}
/**
 * @param {server.Player} player
 * @param {{ page: number, slot: number, data: Object }} ref 編集する自分の出品
 */
async function editForm2(player, ref) {
    const marketData = ref.data;
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
        let tempStack;
        if (amount != 0) {
            try {
                tempStack = new server.ItemStack(itemId);
            } catch (e) {
                player.sendMessage("§c警告: このアイテムは無効な識別子を持っているため、アイテムを返却できません。出品データのみを削除します。");
                playerMarketSystem.delete(ref)
                return;
            }
        }
        // 返す前に出品を消す。画面を開いている間に売れていたら、何も返さない
        if (!playerMarketSystem.delete(ref)) {
            player.sendMessage(LISTING_GONE_MESSAGE);
            return;
        }
        if (amount != 0) {
            const AmountMax = tempStack.maxAmount;
            const count = Math.floor(amount / AmountMax);
            for (let i = 0; i < count; i++) {
                const item = new server.ItemStack(itemId, AmountMax)
                if (lore) {
                    const lores = lore.split("\n")
                    item.setLore(lores)
                }
                if (marketData.enchants) {
                    const comp = item.getComponent("minecraft:enchantable")
                    const enchantments = marketData.enchants
                    for (const enchantment of enchantments) {
                        const type = server.EnchantmentTypes.get(enchantment.id);
                        if (type) comp.addEnchantment({ type: type, level: enchantment.level })
                    }
                }
                if (marketData.durability) {
                    const durComp = item.getComponent("minecraft:durability");
                    if (durComp) durComp.damage = marketData.durability;
                }
                if (inv.emptySlotsCount == 0) {
                    player.dimension.spawnItem(item, player.location)
                } else {
                    inv.addItem(item)
                }
            }
            const result = amount - (count * AmountMax)
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
                        const type = server.EnchantmentTypes.get(enchantment.id);
                        if (type) comp.addEnchantment({ type: type, level: enchantment.level })
                    }
                }
                if (marketData.durability) {
                    const durComp = item.getComponent("minecraft:durability");
                    if (durComp) durComp.damage = marketData.durability;
                }
                if (inv.emptySlotsCount == 0) {
                    const ent = player.dimension.spawnItem(item, player.location)
                    ent.clearVelocity()
                } else {
                    inv.addItem(item)
                }
            }
        }
        return;
    }
    const price = Number(res.formValues[1]);
    if (!Number.isInteger(price) || price < 0) {
        const mform = new MessageFormData()
        mform.title({ translate: "cw.playermarket.sell" })
        mform.body({ translate: "cw.playermarket.sell.priceerror" })
        mform.button1({ translate: "cw.form.redo" })
        mform.button2({ translate: "cw.form.cancel" })
        const res = await mform.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {
            editForm2(player, ref)
        }
        return
    }
    // ref.data は「開いたときの中身」として照合に使うので、書き換えずに写しを作る
    const newData = JSON.parse(JSON.stringify(marketData))
    newData.price.push(price)
    newData.description = res.formValues[2]
    if (!playerMarketSystem.edit(newData, ref)) {
        player.sendMessage(LISTING_GONE_MESSAGE);
    }
}
async function showHistoryForm(player) {
    const pmlogDatas = new Dypro("pmlog");
    const logs = pmlogDatas.get(player.id) || [];

    const form = new ActionFormData();
    form.title({ translate: "cw.playermarket.history.title" });

    if (logs.length === 0) {
        form.body({ translate: "cw.playermarket.history.empty" });
    } else {
        form.body(logs.join("\n"));
        pmlogDatas.delete(player.id);
    }

    form.button({ translate: "cw.playermarket.history.close" });
    await form.show(player);
}
