import * as server from "@minecraft/server";
const { world, system, ItemStack } = server;
import "./phone.js";
import { Dypro } from "./dypro";
import { Data } from "./data";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
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
        if (!playerData) return;

        let amountToAdd = int;

        // 所得税 (Income Tax) の計算 - 収入がある場合のみ
        if (int > 0 && playerData.country) {
            const countryData = countryDatas.get(playerData.country);
            if (countryData && countryData.tax.income > 0) {
                const tax = Math.floor(int * (countryData.tax.income / 100));
                if (tax > 0) {
                    countryData.money += tax;
                    countryDatas.set(countryData.id, countryData);
                    amountToAdd -= tax;
                    // 通知が必要な場合はここに追記可能
                }
            }
        }

        playerData.money += amountToAdd;
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
    /**
 * @param {server.Player} player アイテムを持っているプレイヤー
 * @param {server.ItemStack} itemStack 耐久値を減らしたいアイテムスタック
 * @param {number} amount 減らす耐久値の量 (デフォルトは1)
 * @param {string} slotName 装備スロット名 (Head, Chest, Legs, Feet) - 省略時はメインハンドのアイテム
 * @returns {boolean} アイテムが壊れなかった場合はtrue、壊れた場合はfalseを返す
 */
    static reduceDurability(player, itemStack, amount = 1, slotName = undefined) {
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

        // 耐久ダメージが最大値以上になるかチェック
        if (durability.damage + amount >= durability.maxDurability) {
            // アイテム破壊処理
            if (slotName) {
                const equippable = player.getComponent("minecraft:equippable");
                equippable.setEquipment(slotName, undefined);
            } else {
                const inventory = player.getComponent(server.EntityComponentTypes.Inventory).container;
                inventory.setItem(player.selectedSlotIndex, undefined);
            }
            player.playSound("random.break");
            return false; // 壊れた
        } else {
            // 耐久値を減らす
            durability.damage += amount;
            if (slotName) {
                const equippable = player.getComponent("minecraft:equippable");
                equippable.setEquipment(slotName, itemStack);
            } else {
                const inventory = player.getComponent(server.EntityComponentTypes.Inventory).container;
                inventory.setItem(player.selectedSlotIndex, itemStack);
            }
            return true; // 壊れなかった
        }
    }
    /**
     * ミリ秒をフォーマット (D日 H時間 M分)
     * @param {number} ms 
     * @returns {string}
     */
    static formatTime(ms) {
        if (ms <= 0) return "0s";
        const totalMinutes = Math.floor(ms / (1000 * 60));
        const minutes = totalMinutes % 60;
        const totalHours = Math.floor(totalMinutes / 60);
        const hours = totalHours % 24;
        const days = Math.floor(totalHours / 24);

        let result = "";
        if (days > 0) result += `${days}d `;
        if (hours > 0 || days > 0) result += `${hours}h `;
        result += `${minutes}m`;
        return result.trim();
    }

    /**
     * プレイヤーの nameTag を更新 ( [二つ名/国名] プレイヤー名 )
     * @param {server.Player} player 
     */
    static updateNameTag(player) {
        if (!player || !player.isValid) return;
        const playerData = playerDatas.get(player.id);
        if (!playerData) return;

        const countryname = (playerData.country && countryDatas.get(playerData.country))?.name || "§7未所属";

        let secondNameText = "";
        if (playerData.secondname && playerData.secondname.now) {
            const b = playerData.secondname.before?.[playerData.secondname.now[0]] || "";
            const a = playerData.secondname.after?.[playerData.secondname.now[1]] || "";
            secondNameText = `${b}${a}`;
        }

        player.nameTag = `[${secondNameText}§r/${countryname}§r] ${player.name}`;
    }

    /**
     * オンライン中の全プレイヤーの nameTag を更新
     */
    static updateAllNameTags() {
        for (const player of world.getAllPlayers()) {
            this.updateNameTag(player);
        }
    }

    /**
     * 特定の国の所属メンバーの nameTag を更新
     * @param {Object} countryData 
     */
    static updateCountryNameTags(countryData) {
        if (!countryData || !countryData.players) return;
        for (const player of world.getAllPlayers()) {
            if (countryData.players.includes(player.id)) {
                this.updateNameTag(player);
            }
        }
    }

    /**
     * プレイヤーがCombat（戦闘）状態か判定（cw:combat スコアボードを参照）
     * @param {server.Player} player 
     * @returns {number} 残り秒数（0の場合は制限なし）
     */
    static isCombatCooling(player) {
        if (!player || !player.isValid) return 0;
        const obj = world.scoreboard.getObjective("cw:combat");
        if (!obj) return 0;
        try {
            const score = obj.getScore(player) ?? 0;
            return score > 0 ? score : 0;
        } catch (e) {
            return 0;
        }
    }

}

// スコアボード "cw:combat" の取得・初期化
function getCombatObjective() {
    let obj = world.scoreboard.getObjective("cw:combat");
    if (!obj) {
        obj = world.scoreboard.addObjective("cw:combat", "Combat Status");
    }
    return obj;
}

// 離脱時にCombat状態だったプレイヤーIDを記録
const combatLoggedPlayers = new Set();

// PvPダメージ時のみ Combat 状態(5秒)を適用
world.afterEvents.entityHurt.subscribe((ev) => {
    const victim = ev.hurtEntity;
    if (!victim || victim.typeId !== "minecraft:player") return;

    let attacker = ev.damageSource?.damagingEntity;
    if (attacker && (attacker.typeId === "minecraft:arrow" || attacker.typeId === "minecraft:thrown_trident")) {
        const owner = attacker.getComponent("minecraft:projectile")?.owner;
        if (owner) attacker = owner;
    }

    if (attacker && attacker.typeId === "minecraft:player" && attacker.id !== victim.id) {
        const obj = getCombatObjective();
        obj.setScore(victim, 5);
        obj.setScore(attacker, 5);
    }
});

// 毎秒 (20ticks) スコアを1減算
system.runInterval(() => {
    const obj = world.scoreboard.getObjective("cw:combat");
    if (!obj) return;

    for (const player of world.getAllPlayers()) {
        try {
            const score = obj.getScore(player) ?? 0;
            if (score > 0) {
                obj.setScore(player, score - 1);
            }
        } catch (e) {}
    }
}, 20);

// Combat中の離脱判定
world.afterEvents.playerLeave.subscribe((ev) => {
    const playerId = ev.playerId;
    const obj = world.scoreboard.getObjective("cw:combat");
    if (obj) {
        try {
            const score = obj.getScore(playerId) ?? 0;
            if (score > 0) {
                combatLoggedPlayers.add(playerId);
            }
        } catch (e) {}
    }
});

// 再ログイン時に死ぬ処理
world.afterEvents.playerSpawn.subscribe((ev) => {
    const { player, initialSpawn } = ev;
    if (!player || !player.isValid) return;

    if (initialSpawn && combatLoggedPlayers.has(player.id)) {
        combatLoggedPlayers.delete(player.id);

        system.run(() => {
            if (player.isValid) {
                player.applyDamage(99999);
                world.sendMessage(`§c[Combat Log] ${player.name} は戦闘中にログアウトしたため死亡しました§r`);
            }
        });
    }
});