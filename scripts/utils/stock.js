import { ChestFormData } from "./chest_shop/chest-ui";
import { world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { Dypro } from "./dypro";
import { hasPermission } from "./country";
import config from "../config/config";

const playerDatas = new Dypro("player")
const countryDatas = new Dypro("country")

/**
 * 株関連のclass
 */
export class Stock {
    /** @param {any} countryData */
    constructor(countryData) {
        this.countryData = countryData;
    }

    /** @private */
    get latestPrice() {
        const stock = this.countryData.stock || [];
        return stock.length > 0 ? stock[stock.length - 1].price : 0;
    }

    /** 
     * @private 
     * @param {number} timestamp 
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        date.setHours(date.getHours() + 9); // JST
        return date.toLocaleString("ja-JP");
    }

    /**
     * 株価の変化を表示する
     * @param {import("@minecraft/server").Player} player 
     * @param {number} [page]
     */
    async show(player, page) {
        const pageSize = 9;
        const stockData = this.countryData.stock || [];
        const totalPages = Math.ceil(stockData.length / pageSize);

        const currentPage = page ?? Math.max(0, totalPages - 1);
        const startIndex = currentPage * pageSize;
        const currentEntries = stockData.slice(startIndex, startIndex + pageSize);

        const playerData = playerDatas.get(player.id);
        const form = new ChestFormData("large");
        form.setTitle({ translate: "cw.stock.title", with: [`${currentPage + 1} / ${totalPages}`] });

        // Calculate scaling
        const prices = currentEntries.map(e => e.price);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 100;
        const range = maxPrice - minPrice || 1;

        // Draw Graph
        currentEntries.forEach((entry, i) => {
            const row = 4 - Math.round(((entry.price - minPrice) / range) * 4);
            const slot = row * 9 + i;

            form.setButton(slot, {
                iconPath: "textures/items/paper",
                name: `§ePrice: ¥${entry.price}`,
                lore: [`§7Date: ${this.formatDate(entry.date)}`],
            });
        });

        // Navigation & Actions
        if (currentPage > 0) {
            form.setButton(45, {
                iconPath: "textures/ui/arrow_dark_left_stretch",
                name: "§aPrevious Page",
                lore: [`§7${currentPage} / ${totalPages} Page`],
                stackAmount: 1
            });
        }

        const currentPrice = this.latestPrice;
        const ownedCount = playerData?.stock?.[this.countryData.id] || 0;

        form.setButton(49, {
            iconPath: "textures/items/nether_star",
            name: "§bCurrent Price",
            lore: [`§e¥${currentPrice}`],
            stackAmount: 1
        });

        form.setButton(50, {
            iconPath: "textures/items/emerald",
            name: "§aBuy",
            lore: [`§ePrice: ¥${currentPrice}/1 stock`],
            stackAmount: 1
        });

        form.setButton(51, {
            iconPath: "textures/items/gold_nugget",
            name: "§6Sell",
            lore: [
                `§7Owned: ${ownedCount} Stocks`,
                `§7AllPrice: §e¥${currentPrice * ownedCount}`
            ],
            stackAmount: 1
        });

        if (startIndex + pageSize < stockData.length) {
            form.setButton(53, {
                iconPath: "textures/ui/arrow_dark_right_stretch",
                name: "§a次のページ",
                lore: [`§7${currentPage + 2} / ${totalPages} ページ`],
                stackAmount: 1
            });
        }

        const res = await form.show(player);
        if (res.canceled) return;

        switch (res.selection) {
            case 45: return await this.show(player, currentPage - 1);
            case 50:
                await this.buy(player);
                return await this.show(player, currentPage);
            case 51:
                await this.sell(player);
                return await this.show(player, currentPage);
            case 53: return await this.show(player, currentPage + 1);
        }
    }

    /** @param {import("@minecraft/server").Player} player */
    async buy(player) {
        const playerData = playerDatas.get(player.id);
        const price = this.latestPrice;

        const form = new ModalFormData();
        form.title({ rawtext: [{ translate: "cw.stock.buy" }, { text: ` (¥${playerData.money})` }] });
        form.textField({ translate: "cw.stock.buy.text", with: [String(price)] }, "Press Amount");

        const res = await form.show(player);
        if (res.canceled) return;

        const amount = Math.floor(Number(res.formValues[0]));
        if (!Number.isInteger(amount) || amount <= 0) {
            player.sendMessage({ translate: "cw.stock.invalid_amount" });
            return;
        }

        const total = price * amount;
        if (playerData.money < total) {
            player.sendMessage({ translate: "cw.stock.no_money" });
            return;
        }

        playerData.money -= total;
        playerData.stock[this.countryData.id] = (playerData.stock[this.countryData.id] || 0) + amount;

        playerDatas.set(player.id, playerData);
        const countryData = this.countryData
        countryData.money += total;
        countryDatas.set(countryData.id, countryData);
        player.sendMessage({ translate: "cw.stock.buy_success", with: [String(amount)] });
    }

    /** @param {import("@minecraft/server").Player} player */
    async sell(player) {
        const playerData = playerDatas.get(player.id);
        const owned = playerData.stock?.[this.countryData.id] || 0;

        if (owned <= 0) {
            player.sendMessage({ translate: "cw.stock.no_owned" });
            return;
        }

        const price = this.latestPrice;
        const form = new ModalFormData();
        form.title({ translate: "cw.stock.sell" });
        form.textField({ translate: "cw.stock.sell.text", with: [String(price), String(owned)] }, "Press Amount");

        const res = await form.show(player);
        if (res.canceled) return;

        const amount = Math.floor(Number(res.formValues[0]));
        if (!Number.isInteger(amount) || amount <= 0 || amount > owned) {
            player.sendMessage({ translate: "cw.stock.invalid_amount" });
            return;
        }
        const total = price * amount;
        let resultAmount = amount;
        let resultTotal = total;
        if (total + config.stockMaxSell > this.countryData.money) {
            player.sendMessage({ translate: "cw.stock.no_money_country" });
            const reduceamount = amount - Math.floor((total + config.stockMaxSell - this.countryData.money) / price);
            resultAmount = reduceamount;
            resultTotal = price * reduceamount;
        }

        playerData.money += resultTotal;
        playerData.stock[this.countryData.id] -= resultAmount;

        playerDatas.set(player.id, playerData);
        this.countryData.money -= resultTotal;
        countryDatas.set(this.countryData.id, this.countryData);
        player.sendMessage({ translate: "cw.stock.sell_success", with: [String(resultAmount)] });
    }

    /** @param {number} int */
    set(int) {
        if (!this.countryData.stock) this.countryData.stock = [];
        if (this.countryData.stock.length > 72) this.countryData.stock.shift();
        this.countryData.stock.push({ price: int, date: Date.now() });
        countryDatas.set(this.countryData.id, this.countryData);
    }
    randomset() {
        const countryData = this.countryData
        const playeramount = countryData.players.length;

        const chunkamount = countryData.chunkAmount
        const money = countryData.money
        const nowprice = this.latestPrice
        //nowpriceの10パーセントを+-する
        const moneyInt = Math.floor(money * 0.001);
        const playerInt = Math.floor(playeramount * 100);
        const chunkInt = Math.floor(chunkamount * 10);
        const nowpriceInt = Math.floor((Math.random() * nowprice * 0.2) - (nowprice * 0.1));
        const int = moneyInt + playerInt + chunkInt + nowpriceInt
        this.set(Math.floor(int));
    }
}