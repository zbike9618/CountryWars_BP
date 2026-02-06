import { ChestFormData } from "./chest_shop/chest-ui";
import { world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { Dypro } from "./dypro";

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
                name: { translate: "cw.stock.price_label", with: [String(entry.price)] },
                lore: [{ translate: "cw.stock.date_label", with: [this.formatDate(entry.date)] }],
            });
        });

        // Navigation & Actions
        if (currentPage > 0) {
            form.setButton(45, {
                iconPath: "textures/ui/arrow_dark_left_stretch",
                name: { translate: "cw.form.prev_page" },
                lore: [{ translate: "cw.form.page_info", with: [String(currentPage), String(totalPages)] }],
                stackAmount: 1
            });
        }

        const currentPrice = this.latestPrice;
        const ownedCount = playerData?.stock?.[this.countryData.id] || 0;

        form.setButton(49, {
            iconPath: "textures/items/nether_star",
            name: { translate: "cw.stock.now_price" },
            lore: [{ translate: "cw.stock.price_value", with: [String(currentPrice)] }],
            stackAmount: 1
        });

        form.setButton(50, {
            iconPath: "textures/items/emerald",
            name: { translate: "cw.stock.buy" },
            lore: [{ translate: "cw.stock.price_value", with: [String(currentPrice)] }],
            stackAmount: 1
        });

        form.setButton(51, {
            iconPath: "textures/items/gold_nugget",
            name: { translate: "cw.stock.sell" },
            lore: [{ translate: "cw.stock.owned_value", with: [String(ownedCount), String(currentPrice * ownedCount)] }],
            stackAmount: 1
        });

        if (startIndex + pageSize < stockData.length) {
            form.setButton(53, {
                iconPath: "textures/ui/arrow_dark_right_stretch",
                name: { translate: "cw.form.next_page" },
                lore: [{ translate: "cw.form.page_info", with: [String(currentPage + 2), String(totalPages)] }],
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
        form.textField({ translate: "cw.stock.buy.text", with: [String(price)] }, "Amount", "1");

        const res = await form.show(player);
        if (res.canceled) return;

        const amount = Math.floor(Number(res.formValues[0]));
        if (isNaN(amount) || amount <= 0) {
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
        form.textField({ translate: "cw.stock.sell.text", with: [String(price), String(owned)] }, "Amount", String(owned));

        const res = await form.show(player);
        if (res.canceled) return;

        const amount = Math.floor(Number(res.formValues[0]));
        if (isNaN(amount) || amount <= 0 || amount > owned) {
            player.sendMessage({ translate: "cw.stock.invalid_amount" });
            return;
        }

        const total = price * amount;
        playerData.money += total;
        playerData.stock[this.countryData.id] -= amount;

        playerDatas.set(player.id, playerData);
        player.sendMessage({ translate: "cw.stock.sell_success", with: [String(amount)] });
    }

    /** @param {number} int */
    set(int) {
        if (!this.countryData.stock) this.countryData.stock = [];
        this.countryData.stock.push({ price: int, date: Date.now() });
        countryDatas.set(this.countryData.id, this.countryData);
    }
}