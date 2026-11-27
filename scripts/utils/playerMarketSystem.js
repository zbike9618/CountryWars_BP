import { Dypro } from "./dypro.js"
import * as server from "@minecraft/server"
const { world, system, RawMessage } = server;
import { ChestFormData } from "./chest_shop/chest-ui"
import { Util } from "./util.js";
import { itemIdToPath } from "../config/texture_config.js"
import { Data } from "./data.js";
import { Chunk } from "./chunk.js";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
const marketDatas = new Dypro("playermarket");

// 一覧の並び順。プレイヤーごとに最後に選んだものを覚えておく
const SORT_PROPERTY = "cw:pmSort";
const SORT_MODES = ["item", "new"];
const SORT_LABELS = { item: "アイテム別", new: "新着順" };
const PAGE_SIZE = 45;

function isValidItemId(itemId) {
    try {
        new server.ItemStack(itemId);
        return true;
    } catch (e) {
        return false;
    }
}
// 中身を持つ入れ物。出品データには中身を残せないので、出品できないことにする
function holdsItems(typeId) {
    return typeId.endsWith("shulker_box") || typeId.endsWith("bundle");
}
// 重ならないアイテムが、選んだときと同じものかを見分けるための印
function itemSignature(item) {
    let enchants = [];
    try {
        enchants = (item.getComponent("minecraft:enchantable")?.getEnchantments() || [])
            .map(e => `${e.type.id}:${e.level}`).sort();
    } catch (e) { }
    let damage = 0;
    try { damage = item.getComponent("minecraft:durability")?.damage || 0; } catch (e) { }
    return JSON.stringify([item.typeId, item.amount, item.nameTag || "", item.getLore(), enchants, damage]);
}
function latestPrice(data) {
    return Array.isArray(data.price) ? data.price[data.price.length - 1] : data.price;
}
function unitPrice(data) {
    const price = Number(latestPrice(data)) || 0;
    return data.amount > 0 ? price / data.amount : price;
}
// 新しい順。listedAt の無い古い出品は、それより前に出たものとして保存順の逆に並べる
function compareNewest(a, b) {
    const ta = a.data.listedAt || 0;
    const tb = b.data.listedAt || 0;
    if (ta !== tb) return tb - ta;
    return b.order - a.order;
}
const comparators = {
    // 同じアイテムをまとめ、その中は1個あたりの値段が安い順
    item(a, b) {
        if (a.invalid !== b.invalid) return a.invalid ? 1 : -1;
        if (a.data.itemId !== b.data.itemId) return a.data.itemId < b.data.itemId ? -1 : 1;
        const pa = unitPrice(a.data);
        const pb = unitPrice(b.data);
        if (pa !== pb) return pa - pb;
        return compareNewest(a, b);
    },
    new: compareNewest,
};

export class playerMarketSystem {
    static getSortMode(player) {
        let mode;
        try { mode = player.getDynamicProperty(SORT_PROPERTY); } catch (e) { }
        return SORT_MODES.includes(mode) ? mode : SORT_MODES[0];
    }
    static setSortMode(player, mode) {
        try { player.setDynamicProperty(SORT_PROPERTY, mode); } catch (e) { }
    }
    /**
     * 全ページの出品を、保存されている場所と一緒に返す（保存順）
     * @returns {{ page: number, slot: number, data: Object, order: number }[]}
     */
    static listAll() {
        const pages = marketDatas.idList
            .map(id => Number(id))
            .filter(n => Number.isInteger(n) && n >= 0)
            .sort((a, b) => a - b);
        const listings = [];
        for (const page of pages) {
            const marketData = marketDatas.get(`${page}`);
            if (!Array.isArray(marketData)) continue;
            marketData.forEach((data, slot) => {
                if (data) listings.push({ page, slot, data, order: listings.length });
            });
        }
        return listings;
    }
    /**
     * @param {{ page: number, slot: number, data: Object, order: number }[]} listings
     * @param {string} mode
     */
    static sortListings(listings, mode) {
        const compare = comparators[mode] || comparators[SORT_MODES[0]];
        const validity = new Map();
        for (const l of listings) {
            if (!validity.has(l.data.itemId)) validity.set(l.data.itemId, !isValidItemId(l.data.itemId));
            l.invalid = validity.get(l.data.itemId);
        }
        return listings.sort(compare);
    }
    /**
     * 画面を開いている間に出品が売れたり変わったりして、保存場所がずれていることがある。
     * 開いたときと中身がまったく同じ出品の、今の場所を探す。もう無ければ null
     * @param {{ page: number, slot: number, data: Object }} ref
     * @returns {{ page: number, slot: number } | null}
     */
    static resolve(ref) {
        if (!ref || !ref.data) return null;
        const key = JSON.stringify(ref.data);
        const atSame = (marketDatas.get(`${ref.page}`) || [])[ref.slot];
        if (atSame && JSON.stringify(atSame) === key) return { page: ref.page, slot: ref.slot };
        for (const l of this.listAll()) {
            if (JSON.stringify(l.data) === key) return { page: l.page, slot: l.slot };
        }
        return null;
    }
    static holdsItems(typeId) {
        return holdsItems(typeId);
    }
    /**
     * 出品できるアイテムを、持ち物から選べる単位に分ける。
     * 重なるアイテムは「重ねられるもの同士」で1つ、重ならないアイテム（道具など）は1マスずつ。
     * 中身を持つ入れ物（シュルカーボックス・バンドル）は入れない
     * @param {server.Container} container
     * @returns {{ ref: server.ItemStack, amount: number, slot?: number, signature?: string }[]}
     */
    static sellableGroups(container) {
        const groups = [];
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item || holdsItems(item.typeId)) continue;
            if (item.maxAmount === 1) {
                groups.push({ ref: item, amount: 1, slot: i, signature: itemSignature(item) });
                continue;
            }
            const group = groups.find(g => g.slot === undefined && g.ref.typeId === item.typeId && g.ref.isStackableWith(item));
            if (group) group.amount += item.amount;
            else groups.push({ ref: item, amount: item.amount });
        }
        return groups;
    }
    /**
     * 出品する分だけを持ち物から取る。画面を開いている間に持ち物が変わって足りなければ、何も取らずに false。
     * 残りのマスには触らない
     * @param {server.Container} container
     * @param {{ ref: server.ItemStack, slot?: number, signature?: string }} group sellableGroups の1つ
     * @param {number} amount
     * @returns {boolean}
     */
    static takeForSale(container, group, amount) {
        if (!Number.isInteger(amount) || amount < 1) return false;
        if (group.slot !== undefined) {
            if (amount !== 1) return false;
            const item = container.getItem(group.slot);
            if (!item || itemSignature(item) !== group.signature) return false;
            container.setItem(group.slot, undefined);
            return true;
        }
        const found = [];
        let have = 0;
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item || item.typeId !== group.ref.typeId || !group.ref.isStackableWith(item)) continue;
            found.push({ i, item });
            have += item.amount;
        }
        if (have < amount) return false;
        let rest = amount;
        for (const { i, item } of found) {
            if (rest <= 0) break;
            if (item.amount <= rest) {
                rest -= item.amount;
                container.setItem(i, undefined);
            } else {
                item.amount -= rest;
                container.setItem(i, item);
                rest = 0;
            }
        }
        return true;
    }
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
            enchants: itemData.enchants,
            durability: itemData.durability,
            listedAt: Date.now()
        })
        marketDatas.set(`${page}`, marketData);

        player.sendMessage({
            rawtext: [
                { translate: Util.langChangeItemName(itemData.itemId) },
                { translate: "cw.playermarket.sell.success", with: [itemData.amount.toString()] }
            ]
        });

        world.sendMessage({
            rawtext: [
                { translate: "cw.playermarket.selled.success1" },
                { translate: Util.langChangeItemName(itemData.itemId) },
                { translate: "cw.playermarket.selled.success2" }
            ]
        });
    }
    /**
     * 
     * @param {server.Player} player 
     * @param {{ page: number, slot: number, data: Object }} ref 画面で選んだ出品
     */
    static async buy(player, ref) {
        const loc = this.resolve(ref);
        if (!loc) {
            player.sendMessage("§cこの商品は、もう売れたか、出品者が内容を変えました。もう一度マーケットを開いてください。");
            return;
        }
        const { slot, page } = loc;
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
            const tempItem = new server.ItemStack(itemId);
            const AmountMax = tempItem.maxAmount;
            const count = Math.floor(amount / AmountMax);
            for (let i = 0; i < count; i++) {
                const item = new server.ItemStack(itemId, AmountMax)
                if (itemData.lore) {
                    const lore = itemData.lore.split("\n")
                    item.setLore(lore)
                }
                if (itemData.enchants) {
                    const comp = item.getComponent("minecraft:enchantable")
                    const enchantments = itemData.enchants
                    for (const enchantment of enchantments) {
                        const type = server.EnchantmentTypes.get(enchantment.id);
                        if (type) comp.addEnchantment({ type: type, level: enchantment.level })
                    }
                }
                if (itemData.durability) {
                    const durComp = item.getComponent("minecraft:durability");
                    if (durComp) durComp.damage = itemData.durability;
                }
                if (inv.emptySlotsCount == 0) {
                    const ent = player.dimension.spawnItem(item, player.location)
                    ent.clearVelocity()
                } else {
                    inv.addItem(item)
                }
            }
            const result = amount - (count * AmountMax)
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
                        const type = server.EnchantmentTypes.get(enchantment.id);
                        if (type) comp.addEnchantment({ type: type, level: enchantment.level })
                    }
                }
                if (itemData.durability) {
                    const durComp = item.getComponent("minecraft:durability");
                    if (durComp) durComp.damage = itemData.durability;
                }
                if (inv.emptySlotsCount == 0) {
                    const ent = player.dimension.spawnItem(item, player.location)
                    ent.clearVelocity()
                } else {
                    inv.addItem(item)
                }
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

        // お金はワールドのデータなので、売り手がオフラインでもその場で足せる（キューに積むと48時間で捨てられる）
        Util.addMoney({ id: seller }, currentPrice);

        player.sendMessage({
            rawtext: [
                { translate: "cw.playermarket.buy.success.prefix" },
                { translate: Util.langChangeItemName(itemId) },
                { translate: "cw.playermarket.buy.success.suffix" }
            ]
        });
        // ログ保存
        const pmlogDatas = new Dypro("pmlog");
        const logEntry = `${itemId}  ×  ${amount}      +§a${currentPrice}§r \n          sold by ${player.name}`;
        const sellerLogs = pmlogDatas.get(seller) || [];
        sellerLogs.push(logEntry);
        pmlogDatas.set(seller, sellerLogs);

        // オンラインなら通知
        const sellerEntity = world.getEntity(seller);
        if (sellerEntity) {
            sellerEntity.sendMessage({ translate: "cw.playermarket.sold.notify", with: [itemId, `${amount}`, `${currentPrice}`, player.name] });
        }
        marketData.splice(slot, 1);
        marketDatas.set(`${page}`, marketData);
    }
    /**
     * 出品の一覧を開く。全ページの出品を並べ替えてから、45件ずつ見せる
     * @param {server.Player} player
     * @param {number} viewPage 見せるページ（並べ替えた後の番号）
     * @returns {Promise<"none" | { ref: { page: number, slot: number, data: Object }, viewPage: number }>}
     */
    static async show(player, viewPage = 0) {
        const mode = this.getSortMode(player);
        const listings = this.sortListings(this.listAll(), mode);
        const pageCount = Math.max(1, Math.ceil(listings.length / PAGE_SIZE));
        viewPage = Math.min(Math.max(Math.floor(viewPage) || 0, 0), pageCount - 1);
        const shown = listings.slice(viewPage * PAGE_SIZE, (viewPage + 1) * PAGE_SIZE);
        const hasPrev = viewPage > 0;
        const hasNext = viewPage < pageCount - 1;

        const form = new ChestFormData("large")
        form.setTitle({ rawtext: [{ translate: "cw.playermarket.title" }, { text: ` (${viewPage + 1}/${pageCount})` }] })
        if (hasPrev) {
            form.setButton(0, {
                iconPath: "textures/ui/arrow_dark_left_stretch",
                name: "Undo", lore: ["<Click here>"],
                editedName: true
            })
        }
        if (hasNext) {
            form.setButton(8, {
                iconPath: "textures/ui/arrow_dark_right_stretch",
                name: "Next", lore: ["<Click here>"],
                editedName: true
            })
        }
        const nextMode = SORT_MODES[(SORT_MODES.indexOf(mode) + 1) % SORT_MODES.length];
        form.setButton(4, {
            iconPath: "textures/items/hopper",
            name: { rawtext: [{ text: `§e並び順: ${SORT_LABELS[mode]}` }] },
            lore: [
                { text: mode === "item" ? "§7同じアイテムをまとめて、1個あたりが安い順" : "§7新しく出品された順" },
                { text: `§7出品 ${listings.length}件・${viewPage + 1}/${pageCount}ページ` },
                { text: `§a押すと「${SORT_LABELS[nextMode]}」に切り替え` }
            ],
            editedName: true
        })

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

        for (let i = 0; i < shown.length; i++) {
            const itemData = shown[i].data;
            let AmountMax = 64;
            let isInvalid = false;
            try {
                const tempStack = new server.ItemStack(itemData.itemId);
                AmountMax = tempStack.maxAmount;
            } catch (e) {
                isInvalid = true;
            }
            const number = Math.floor(itemData.amount / AmountMax)
            const restAmount = itemData.amount - (number * AmountMax)
            const displayAmount = `${number > 0 ? (AmountMax === 1 ? itemData.amount.toString() : number.toString() + "st + " + restAmount.toString()) : restAmount}`
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
            const lore = [{ translate: "cw.playermarket.seller", with: [playerDatas.get(itemData.player)?.name || "Unknown"] }]

            const currentPrice = itemData.price[itemData.price.length - 1];
            const taxAmount = Math.floor(currentPrice * (taxRate / 100));
            const totalWithTax = currentPrice + taxAmount;

            if (itemData.enchants) {
                lore.push({ translate: "cw.playermarket.enchants" })
                for (const enchantment of itemData.enchants) {
                    lore.push({ text: "\n" })
                    lore.push({ translate: Data.enchantsLang[enchantment.id] })
                    lore.push({ translate: `enchantment.level.${enchantment.level}` })
                }
            }
            if (itemData.durability) {
                lore.push({ translate: "cw.playermarket.item.durability", with: [itemData.durability.toString()] })
            }
            if (itemData.lore) {
                lore.push({ text: `\n` });
                lore.push({ translate: "cw.playermarket.lore" });
                lore.push({ text: ` ${itemData.lore}` });
            }
            lore.push({ text: `\n${itemData.description}` })

            // 価格表示の更新
            if (itemData.price.length == 1) {
                lore.push({ text: `\n§e§l¥${currentPrice} (税込: ¥${totalWithTax})§r` })
            } else {
                const oldPrice = itemData.price[0];
                lore.push({ text: `\n§c§l¥${oldPrice}§r => §e§l¥${currentPrice} (税込: ¥${totalWithTax})§r` })
            }

            if (taxRate > 0) {
                lore.push({ translate: "cw.playermarket.tax_notice", with: [taxRate.toString()] });
            }

            if (itemData.price.length > 1 && offInt > 0) {
                lore.push({ text: "\n" });
                lore.push({ translate: isDiscount ? "cw.playermarket.discount" : "cw.playermarket.price_up", with: [offInt.toString()] });
            }
            if (isInvalid) {
                lore.push({ text: `\n§c§l[ERROR]§r\n§7アイテム識別子が無効です:\n§7${itemData.itemId}` });
            }

            form.setButton(i + 9, {
                iconPath: isInvalid ? "textures/ui/warning_alex" : itemIdToPath[itemData.itemId],
                name: {
                    rawtext: [
                        { text: isInvalid ? "§c[Error: Invalid Item] " : "" },
                        { translate: isInvalid ? "" : Util.langChangeItemName(itemData.itemId) },
                        { text: ` [${displayAmount}]` }
                    ]
                },
                lore,
                stackAmount: itemData.amount,
                editedName: true,
            })
        }
        const res = await form.show(player)
        if (!res || res.canceled) return "none";
        if (res.selection == 0 && hasPrev) {
            return await this.show(player, viewPage - 1);
        }
        if (res.selection == 8 && hasNext) {
            return await this.show(player, viewPage + 1);
        }
        if (res.selection == 4) {
            this.setSortMode(player, nextMode);
            return await this.show(player, 0);
        }
        const index = res.selection - 9;
        if (index < 0 || index >= shown.length) {
            // 空いているマスを押したときは、同じページを開き直す
            return await this.show(player, viewPage);
        }
        const { page, slot, data } = shown[index];
        return { ref: { page, slot, data }, viewPage };
    }
    /**
     * @param {{ page: number, slot: number, data: Object }} ref
     * @returns {boolean} 消せたら true（もう無ければ false）
     */
    static delete(ref) {
        const loc = this.resolve(ref);
        if (!loc) return false;
        const marketData = marketDatas.get(`${loc.page}`);
        marketData.splice(loc.slot, 1);
        marketDatas.set(`${loc.page}`, marketData);
        return true;
    }
    /**
     * @param {Object} newData
     * @param {{ page: number, slot: number, data: Object }} ref
     * @returns {boolean} 書き換えられたら true（もう無ければ false）
     */
    static edit(newData, ref) {
        const loc = this.resolve(ref);
        if (!loc) return false;
        const marketData = marketDatas.get(`${loc.page}`);
        marketData[loc.slot] = newData;
        marketDatas.set(`${loc.page}`, marketData);
        return true;
    }
}
