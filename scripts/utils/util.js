import * as server from "@minecraft/server";
const { world, system, ItemStack } = server;
import "./phone.js";
import { Dypro } from "./dypro";
import { Data } from "./data";
const playerDatas = new Dypro("player");
export class Util {
    static getAllPlayerIdsSorted() {
        return playerDatas.idList.sort((a, b) => {
            const nameA = playerDatas.get(a)?.name?.[0] || "";
            const nameB = playerDatas.get(b)?.name?.[0] || "";
            return Data.wordOrder.indexOf(nameA) - Data.wordOrder.indexOf(nameB);
        });
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