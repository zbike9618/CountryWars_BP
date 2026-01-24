import * as server from "@minecraft/server";
const { world, system, ItemStack } = server;
import "./phone.js";
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
        if (!typeId) return "Unknown";
        try {
            const item = new ItemStack(typeId)
            return item.localizationKey;
        } catch (e) {
            return typeId.toString();
        }
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
    /**
    * パーティクルを周囲に出す
    * @param {server.DimensionType} dim dimension名
    * @param {Vecotr3} center 中央 {x,y,z}
    * @param {Number} count 出す数
    * @param {Number} range 範囲正方形
    * @param {String} par particle名
    */
    static expandParticle(dim, center, count, range, par) {

        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() * 2 - 1) * range;
            const offsetY = (Math.random() * 2 - 1) * range;
            const offsetZ = (Math.random() * 2 - 1) * range;

            const pos = {
                x: center.x + offsetX,
                y: center.y + offsetY,
                z: center.z + offsetZ,
            };

            dim.spawnParticle(par, pos);
        }
    }
    static distanceTo(pos, otherPos) {
        const dx = pos.x - otherPos.x;
        const dy = pos.y - otherPos.y;
        const dz = pos.z - otherPos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return distance
    }
    /**
     * 国のプレイヤーの中で現在いるプレイヤーを返す
     * @param {*} countryData 
     *@return {Array<server.Player>} プレイヤーのリスト
     */
    static GetCountryPlayer(countryData) {
        const players = world.getAllPlayers();
        const list = [];
        for (const player of players) {
            if (countryData.players.includes(player.id)) {
                list.push(player);
            }
        }
        return list;
    }
    /*static getForwardPosition(player, distance, floor = false) {

        // 基準位置（頭の位置が欲しければ getHeadLocation に変えてOK）
        const base = player.location;
        // 向いている方向（長さ1のベクトル）
        const dir = player.getViewDirection();
        if (floor) {
            return {
                x: Math.floor(base.x + dir.x * distance),
                y: Math.floor(base.y + dir.y * distance),
                z: Math.floor(base.z + dir.z * distance),
            };
        }
        return {
            x: base.x + dir.x * distance,
            y: base.y + dir.y * distance,
            z: base.z + dir.z * distance,
        };
    }*/
    /**
 * 回復する関数
 * @param {*} entity 
 * @param {*} number 
 * @returns 
 */
    static heal(entity, number = 0) {
        try {
            const comp = entity.getComponent("minecraft:health")
            const value = comp.currentValue
            let all = value + number
            if (comp.effectiveMax < all) {
                all = comp.effectiveMax
            }
            comp.setCurrentValue(all)
            return true;
        }
        catch (c) {
            return false;
        }
    }
    /**
 * @param {server.Player} player アイテムを持っているプレイヤー
 * @param {server.ItemStack} itemStack 耐久値を減らしたいアイテムスタック
 * @param {number} amount 減らす耐久値の量 (デフォルトは1)
 * @returns {boolean} アイテムが壊れなかった場合はtrue、壊れた場合はfalseを返す
 */
    static reduceDurability(player, itemStack, amount = 1) {
        const durability = itemStack.getComponent(server.ItemComponentTypes.Durability);
        if (!durability) {
            // 耐久コンポーネントがなければ何もしない
            return true;
        }

        const enchantments = itemStack.getComponent(server.ItemComponentTypes.Enchantable);

        const unbreakingEnchant = enchantments?.getEnchantment("unbreaking");
        const unbreakingLevel = unbreakingEnchant ? unbreakingEnchant.level : 0;

        const chanceToTakeDamage = 1 / (1 + unbreakingLevel);

        if (Math.random() > chanceToTakeDamage) {
            return true; // 耐久値が減らなかった（壊れてもいない）
        }

        const inventory = player.getComponent(server.EntityComponentTypes.Inventory).container;
        const slot = player.selectedSlotIndex;

        // 耐久ダメージが最大値以上になるかチェック
        if (durability.damage + amount >= durability.maxDurability) {
            // アイテム破壊処理
            inventory.setItem(slot, undefined);
            player.playSound("random.break");
            return false; // 壊れた
        } else {
            // 耐久値を減らす
            durability.damage += amount;
            inventory.setItem(slot, itemStack);
            return true; // 壊れなかった
        }
    }
}