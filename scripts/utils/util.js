import * as server from "@minecraft/server";
const { world, system, ItemStack } = server;
import "./phone.js";
import "./kaihuku_kit.js";
import { Dypro } from "./dypro";
import { Data } from "./data";
const playerDatas = new Dypro("player");
export class Util {
    static getAllPlayerIdsSorted() {
        return playerDatas.idList.sort((a, b) => {
            const nameA = playerDatas.get(a)?.name || "";
            const nameB = playerDatas.get(b)?.name || "";
            return this.compareStrings(nameA, nameB);
        });
    }
    static compareStrings(a, b) {
        const order = Data.wordOrder;
        const minLen = Math.min(a.length, b.length);
        for (let i = 0; i < minLen; i++) {
            const charA = a[i];
            const charB = b[i];
            const indexA = order.indexOf(charA);
            const indexB = order.indexOf(charB);
            if (indexA !== indexB) {
                // wordOrderにない文字は後ろに回す
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            }
        }
        return a.length - b.length;
    }
    /**
 * アイテムの名前をLangに変換
 * @param {string} typeId 
 * @returns {string}
 */
    static langChangeItemName(typeId) {
        const item = new ItemStack(typeId)
        return item.localizationKey;
    }
    static addMoney(player, int) {
        const playerData = playerDatas.get(player.id);
        playerData.money += int;
        playerDatas.set(player.id, playerData);
    }
    static getMoney(player) {
        return playerDatas.get(player.id)?.money ?? 0;
    }
    static setMoney(player, int) {
        const playerData = playerDatas.get(player.id);
        playerData.money = int;
        playerDatas.set(player.id, playerData);
    }
}