import * as ui from "@minecraft/server-ui";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { system, world } from "@minecraft/server";
import { Util } from "../utils/util";
import { Dypro } from "../utils/dypro";
import { Country } from "../utils/country";
import { War } from "../utils/war";
import { Chunk } from "./chunk";
import { sendAll } from "../commands/messagebox";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
const chunkDatas = new Dypro("chunk");
export class Menu {
    static async showForm(player) {
        const form = new ui.ActionFormData();
        form.title({ translate: "cw.menu.title" });
        form.button({ translate: "cw.menu.movemoney" });
        form.button({ translate: "cw.menu.secondname" });
        form.button({ translate: "cw.menu.adminchunk" });
        form.button({ translate: "cw.menu.playerdatareset" });
        form.button({ translate: "cw.menu.deletecountry" })
        form.button("チャンク一覧");
        form.button("全体アナウンス");
        form.button("国データ編集");
        form.show(player).then((response) => {
            if (response.canceled) return;
            if (response.selection === 0) {
                movemoney(player);
            } else if (response.selection === 1) {
                SecondName(player);
            } else if (response.selection === 2) {
                AdminChunk(player);
            } else if (response.selection === 3) {
                PlayerDataReset(player);
            } else if (response.selection === 4) {
                DeleteCountry(player);
            } else if (response.selection === 5) {
                ChunkListCountrySelect(player);
            } else if (response.selection === 6) {
                sendAll(player);
            } else if (response.selection === 7) {
                CountryDataAdmin(player);
            }
        });
    }
}
async function movemoney(player) {
    const form = new ui.ModalFormData();
    form.title({ translate: "cw.menu.movemoney" });
    const allPlayers = world.getAllPlayers();
    const playerNames = allPlayers.map(p => p.name);
    form.dropdown({ translate: "cw.menu.movemoney.operation" }, [{ translate: "cw.menu.movemoney.action.add" }, { translate: "cw.menu.movemoney.action.remove" }, { translate: "cw.menu.movemoney.action.set" }]);
    form.dropdown({ translate: "cw.menu.movemoney.player" }, playerNames);
    form.textField({ translate: "cw.menu.movemoney.amount" }, { translate: "cw.menu.movemoney.amount.example" });
    form.show(player).then((response) => {
        if (response.canceled) {
            Menu.showForm(player);
            return;
        };
        const operation = response.formValues[0];
        const selectedIndex = response.formValues[1];
        const amountStr = response.formValues[2];
        const selectedPlayer = allPlayers[selectedIndex];
        const amount = parseInt(amountStr);
        if (isNaN(amount) || amount < 0) {
            player.sendMessage({ translate: "cw.menu.movemoney.error.invalidamount" });
            return;
        }
        const currentMoney = Util.getMoney(selectedPlayer);
        let newMoney;
        let actionmoney;
        let action;
        if (operation === 0) { // 増やす
            Util.addMoney(selectedPlayer, amount);
            newMoney = currentMoney + amount;
            actionmoney = amount;
            action = "add";
        } else if (operation === 1) { // 減らす
            Util.addMoney(selectedPlayer, -amount);
            newMoney = Math.max(0, currentMoney - amount); // マイナスにならないように
            actionmoney = -amount;
            action = "remove";
        } else if (operation === 2) { // 設定
            Util.setMoney(selectedPlayer, amount);
            newMoney = amount;
            actionmoney = amount;
            action = "set";
        } else {
            player.sendMessage({ translate: "cw.menu.movemoney.error.invalidoperation" });
            return;
        }
        player.sendMessage({ translate: `cw.menu.movemoney.success.${action}`, with: [`${selectedPlayer.name}`, `${actionmoney}`, `${newMoney}`] });
    });
}

async function ChunkListCountrySelect(player) {
    const countries = countryDatas.idList
        .map(id => countryDatas.get(id))
        .filter(country => country?.name);
    const form = new ui.ActionFormData();
    form.title("国家一覧 (チャンク表示)");
    for (const country of countries) {
        form.button(country.name);
    }
    form.show(player).then((response) => {
        if (response.canceled) {
            Menu.showForm(player);
            return;
        };
        const countryData = countries[response.selection];
        ShowCountryChunks(player, countryData);
    });
}

async function ShowCountryChunks(player, countryData) {
    const allChunkIds = chunkDatas.idList;
    const countryChunks = [];

    for (const id of allChunkIds) {
        const data = chunkDatas.get(id);
        if (data && data.country === countryData.id) {
            const parts = id.split("_");
            let x, z, dim = "Overworld";
            if (parts.length === 2) {
                x = parts[0];
                z = parts[1];
            } else {
                dim = parts[0];
                x = parts[1];
                z = parts[2];
            }
            countryChunks.push(`${dim}: (${x}, ${z})`);
        }
    }

    const form = new ui.ActionFormData();
    form.title(`${countryData.name} のチャンク一覧`);
    if (countryChunks.length === 0) {
        form.body("所有しているチャンクはありません。");
    } else {
        form.body(`所有チャンク数: ${countryChunks.length}\n\n` + countryChunks.join("\n"));
    }
    form.button("戻る");
    form.show(player).then((res) => {
        ChunkListCountrySelect(player);
    });
}

async function SecondName(player) {
    const form = new ui.ActionFormData();
    form.title({ translate: "cw.menu.secondname" });
    form.button({ translate: "cw.menu.secondname.addtitle" });
    form.button({ translate: "cw.menu.secondname.removetitle" });
    form.show(player).then((response) => {
        if (response.canceled) {
            Menu.showForm(player);
            return;
        };
        if (response.selection === 0) {
            addsecondname(player);
        } else if (response.selection === 1) {
            removesecondname(player);
        }
    })
}

async function addsecondname(player) {
    const allPlayers = world.getAllPlayers();
    const playerNames = allPlayers.map(p => p.name);
    const form = new ui.ModalFormData();
    form.title({ translate: "cw.menu.secondname.addtitle" });
    form.dropdown({ translate: "cw.menu.secondname.player" }, playerNames);
    form.dropdown({ translate: "cw.menu.secondname.position" }, [{ translate: "cw.menu.secondname.position.before" }, { translate: "cw.menu.secondname.position.after" }]);
    form.textField({ translate: "cw.menu.secondname.add.secondname" }, { translate: "cw.menu.secondname.add.secondname.example" });
    form.show(player).then((response) => {
        if (response.canceled) {
            SecondName(player);
            return;
        };
        const selectedIndex = response.formValues[0];
        const position = response.formValues[1];
        const newSecondName = response.formValues[2];
        const selectedPlayer = allPlayers[selectedIndex];
        const targetData = playerDatas.get(selectedPlayer.id);
        if (!targetData) return;

        const playerData = playerDatas.get(selectedPlayer.id);

        if (position === 0) {
            targetData.secondname.before.push(newSecondName)
            playerDatas.set(selectedPlayer.id, targetData)
            player.sendMessage({ translate: "cw.menu.secondname.add.before.success", with: [`${selectedPlayer.name}`, `${newSecondName}`] });
        } else if (position === 1) {
            targetData.secondname.after.push(newSecondName)
            playerDatas.set(selectedPlayer.id, targetData)
            player.sendMessage({ translate: "cw.menu.secondname.add.after.success", with: [`${selectedPlayer.name}`, `${newSecondName}`] });
        }
    })
}
async function AdminChunk(player) {
    const form = new ui.ActionFormData();
    form.title({ translate: "cw.menu.adminchunk" });
    const chunkId = Chunk.positionToChunkId(player.location, player.dimension.id);
    const countryId = Chunk.checkChunk(chunkId);

    let status = countryId === "admin" ? "§cAdmin" : countryId === "wasteland" ? "§7Wasteland" : `§6${countryDatas.get(countryId)?.name || countryId}`;
    form.body({ translate: "cw.menu.adminchunk.status", with: [chunkId, status] });
    if (countryId === "admin") {
        form.button({ translate: "cw.menu.adminchunk.remove" });
        form.button({ translate: "cw.menu.adminchunk.setting" });
    } else if (countryId === "wasteland") {
        form.button({ translate: "cw.menu.adminchunk.set" });
    }

    form.show(player).then((res) => {
        if (res.canceled) {
            Menu.showForm(player);
            return;
        };
        if (countryId == "admin") {
            if (res.selection === 0) {
                removeAdminChunk(player);
            } else if (res.selection === 1) {
                AdminChunkSetting(player, chunkId);
            }
        } else if (countryId == "wasteland") {
            if (res.selection === 0) {
                addAdminChunk(player);
            }
        }
    })
}
async function addAdminChunk(player) {
    const chunkId = Chunk.positionToChunkId(player.location, player.dimension.id);
    Chunk.setAdmin(chunkId);
    player.sendMessage({ translate: "cw.menu.adminchunk.set.success", with: [chunkId] });
    AdminChunk(player);
}
async function removeAdminChunk(player) {
    const chunkId = Chunk.positionToChunkId(player.location, player.dimension.id);
    Chunk.removeAdmin(chunkId);
    player.sendMessage({ translate: "cw.menu.adminchunk.remove.success", with: [chunkId] });
    AdminChunk(player);
}
async function AdminChunkSetting(player, chunkId) {
    const chunkData = chunkDatas.get(chunkId)
    if (!chunkData.setting) chunkData.setting = { place: false, break: false, interact: false, hurtEntity: false, hurtPlayer: false, allowedPlayers: [] };

    const form = new ui.ModalFormData();
    form.title({ translate: "cw.menu.adminchunk.setting" });
    form.toggle({ translate: "cw.menu.adminchunk.setting.place" }, { defaultValue: chunkData.setting.place });
    form.toggle({ translate: "cw.menu.adminchunk.setting.break" }, { defaultValue: chunkData.setting.break });
    form.toggle({ translate: "cw.menu.adminchunk.setting.interact" }, { defaultValue: chunkData.setting.interact });
    form.toggle({ translate: "cw.menu.adminchunk.setting.hurtEntity" }, { defaultValue: chunkData.setting.hurtEntity });
    form.toggle({ translate: "cw.menu.adminchunk.setting.hurtPlayer" }, { defaultValue: chunkData.setting.hurtPlayer });
    form.textField({ translate: "cw.menu.adminchunk.setting.allowedPlayers" }, { translate: "cw.menu.adminchunk.setting.allowedPlayers.example" }, { defaultValue: chunkData.setting.allowedPlayers?.join(",") || "" });

    form.show(player).then((res) => {
        if (res.canceled) {
            AdminChunk(player);
            return;
        };
        chunkData.setting.place = res.formValues[0]
        chunkData.setting.break = res.formValues[1]
        chunkData.setting.interact = res.formValues[2]
        chunkData.setting.hurtEntity = res.formValues[3]
        chunkData.setting.hurtPlayer = res.formValues[4]
        chunkData.setting.allowedPlayers = res.formValues[5].split(",").map(name => name.trim()).filter(name => name !== "");
        chunkDatas.set(chunkId, chunkData)
        player.sendMessage({ translate: "cw.menu.adminchunk.setting.success", with: [chunkId] });
        AdminChunk(player);
    })
}
async function removesecondname(player) {
    const allPlayers = world.getAllPlayers();
    const playerNames = allPlayers.map(p => p.name);
    const form = new ui.ModalFormData();
    form.title({ translate: "cw.menu.secondname.removetitle" });
    form.dropdown({ translate: "cw.menu.secondname.player" }, playerNames);
    form.show(player).then((response) => {
        if (response.canceled) {
            SecondName(player);
            return;
        };
        const selectedIndex = response.formValues[0];
        const selectedPlayer = allPlayers[selectedIndex];
        removesecondnameSelect(player, selectedPlayer);
    })
}

async function removesecondnameSelect(player, selectedPlayer) {
    const playerData = playerDatas.get(selectedPlayer.id);
    const form = new ui.ModalFormData();
    let before = [...playerData.secondname.before, "-"]
    let after = [...playerData.secondname.after, "-"]
    // player.sendMessage(`${before}><${after}`);//debug
    form.title({ translate: "cw.menu.secondname.removetitle" });
    form.dropdown({ translate: "cw.menu.secondname.remove.before" }, before, { tooltip: { translate: "cw.menu.secondname.remove.tooltip" } })
    form.dropdown({ translate: "cw.menu.secondname.remove.after" }, after, { tooltip: { translate: "cw.menu.secondname.remove.tooltip" } })
    form.show(player).then((response) => {
        if (response.canceled) {
            removesecondname(player);
            return;
        };
        const beforeIndex = response.formValues[0];
        const afterIndex = response.formValues[1];

        // Before (前) の削除処理
        if (beforeIndex !== before.length - 1) { // 最後の "-" 以外が選択された場合
            if (beforeIndex !== 0) {
                // 削除するインデックス
                const indexToRemove = beforeIndex;

                // 削除実行
                playerData.secondname.before.splice(indexToRemove, 1);
                // 現在装着中の二つ名への影響をチェック
                if (playerData.secondname.now[0] === indexToRemove) {
                    // 装着中のものが削除された場合、0に戻す
                    playerData.secondname.now[0] = 0;
                } else if (playerData.secondname.now[0] > indexToRemove) {
                    // 装着中のものが削除されたものより後ろにある場合、インデックスを1詰める
                    playerData.secondname.now[0]--;
                }
                playerDatas.set(selectedPlayer.id, playerData);
                player.sendMessage({ translate: "cw.menu.secondname.remove.before.success", with: [`${selectedPlayer.name}`, `${before[indexToRemove]}`] });
            } else {
                player.sendMessage({ translate: "cw.menu.secondname.remove.error" });
            }



        }

        // After (後) の削除処理
        if (afterIndex !== after.length - 1) { // 最後の "-" 以外が選択された場合
            if (afterIndex !== 0) {
                // 削除するインデックス
                const indexToRemove = afterIndex;

                // 削除実行
                playerData.secondname.after.splice(indexToRemove, 1);
                // 現在装着中の二つ名への影響をチェック
                if (playerData.secondname.now[1] === indexToRemove) {
                    // 装着中のものが削除された場合、0に戻す
                    playerData.secondname.now[1] = 0;
                } else if (playerData.secondname.now[1] > indexToRemove) {
                    // 装着中のものが削除されたものより後ろにある場合、インデックスを1詰める
                    playerData.secondname.now[1]--;
                }
                playerDatas.set(selectedPlayer.id, playerData);
                player.sendMessage({ translate: "cw.menu.secondname.remove.after.success", with: [`${selectedPlayer.name}`, `${after[indexToRemove]}`] });
            } else {
                player.sendMessage({ translate: "cw.menu.secondname.remove.error" });

            }

        }
    })
}

async function PlayerDataReset(player) {
    const form = new ui.ModalFormData();
    const allPlayers = world.getAllPlayers();
    const playerNames = allPlayers.map(p => p.name);
    form.title({ translate: "cw.menu.playerdatareset.title" });
    form.dropdown({ translate: "cw.menu.playerdatareset.player" }, playerNames);
    form.toggle({ translate: "cw.menu.playerdatareset.reset" }, { tooltip: { translate: "cw.menu.playerdatareset.tooltip" } });
    form.show(player).then((response) => {
        if (response.canceled) {
            Menu.showForm(player);
            return;
        };
        if (!response.formValues[1]) {
            player.sendMessage({ translate: "cw.menu.playerdatareset.error" });
            return;
        } else {
            const player = allPlayers[response.formValues[0]];
            playerDatas.delete(player.id)
            player.setDynamicProperty("initial", false);
            player.sendMessage({ translate: "cw.menu.playerdatareset.success", with: [`${player.name}`] });
        }
    })
}

async function DeleteCountry(player) {
    const countries = countryDatas.idList
        .map(id => countryDatas.get(id))
        .filter(country => country?.name);
    const form = new ui.ActionFormData();
    form.title({ translate: "cw.menu.deletecountry" });
    for (const country of countries) {
        form.button(country.name);
    }
    form.show(player).then((response) => {
        if (response.canceled) {
            Menu.showForm(player);
            return;
        };
        const newform = new MessageFormData()
        const playerData = playerDatas.get(player.id)
        const countryData = countries[response.selection];
        newform.title({ translate: "cw.scform.delete" })
        newform.body({ translate: "cw.scform.delete.check", with: [countryData.name] })
        newform.button1({ translate: "cw.form.yes" })
        newform.button2({ translate: "cw.form.no" })
        newform.show(player).then((res) => {
            if (res.canceled || res.selection == 1) return;

            if (!countryData) return; // safety check
            Country.delete(countryData);
        })
    });
}

// ==============================
// 国データ管理 (Admin)
// ==============================

/**
 * 配列をカンマ区切り文字列に変換
 * @param {any[]} arr
 */
function arrToStr(arr) {
    if (!Array.isArray(arr)) return String(arr ?? "");
    return arr.join(",");
}

/**
 * カンマ区切り文字列を配列に変換
 * @param {string} str
 * @param {boolean} asNumbers - trueなら各要素をNumber()変換
 */
function parseCommaArray(str, asNumbers = false) {
    if (!str || str.trim() === "") return [];
    return str.split(",")
        .map(s => s.trim())
        .filter(s => s !== "")
        .map(s => asNumbers ? Number(s) : s);
}

/**
 * 国データ管理 — 国選択
 */
async function CountryDataAdmin(player) {
    const countries = countryDatas.idList
        .map(id => countryDatas.get(id))
        .filter(c => c?.name);

    if (countries.length === 0) {
        player.sendMessage("§c[管理] 国が存在しません。");
        Menu.showForm(player);
        return;
    }

    const form = new ui.ActionFormData();
    form.title("国データ編集 - 国選択");
    for (const country of countries) {
        form.button(`${country.name}\nID: ${country.id}`);
    }

    form.show(player).then((response) => {
        if (response.canceled) {
            Menu.showForm(player);
            return;
        }
        const countryData = countryDatas.get(countries[response.selection].id);
        CountryDataView(player, countryData);
    });
}

/**
 * 国データ閲覧・編集ハブ
 * [ルール] 配列フィールド → カンマ(,)区切りで入力  例: id1,id2,id3
 * [ルール] JSON配列フィールド → JSON文字列で入力  例: [{"price":10,"date":0}]
 * [ルール] 数値フィールド → 数値のみ入力
 * [ルール] 真偽値フィールド → トグルで切替
 */
async function CountryDataView(player, countryData) {
    const d = countryDatas.get(countryData.id) || countryData;
    const dp = d.diplomacy || {};
    const tax = d.tax || {};

    const form = new ui.ActionFormData();
    form.title(`§l国データ: ${d.name}`);
    form.body(
        `§lid§r: ${d.id}\n` +
        `§lname§r: ${d.name}\n` +
        `§ldescription§r: ${d.description ?? ""}\n` +
        `§lmoney§r: ${d.money ?? 0}\n` +
        `§lisPeace§r: ${d.isPeace}\n` +
        `§lowner§r: ${d.owner}\n` +
        `§lplayers§r: ${arrToStr(d.players)} (${(d.players ?? []).length}人)\n` +
        `§lchunkAmount§r: ${d.chunkAmount ?? 0}\n` +
        `§lwardeath§r: ${d.wardeath ?? 0}\n` +
        `§lwarcountry§r: ${arrToStr(d.warcountry)}\n` +
        `§lwinStreak§r: ${d.winStreak ?? 0}\n` +
        `§lbuildtime§r: ${d.buildtime ?? 0}\n` +
        `§llastDefeated§r: ${d.lastDefeated ?? 0}\n` +
        `§ltax§r: 消費${tax.consumption ?? 0}% 所得${tax.income ?? 0}% 国民${tax.country ?? 0}% 関税${tax.customs ?? 0}%\n` +
        `§l--- 外交 ---§r\n` +
        `ally: ${arrToStr(dp.ally)}\n` +
        `friend: ${arrToStr(dp.friend)}\n` +
        `neutral: ${arrToStr(dp.neutral)}\n` +
        `enemy: ${arrToStr(dp.enemy)}\n` +
        `requests: ${arrToStr(dp.requests)}`
    );
    form.button("§e基本情報を編集");
    form.button("§6税率を編集");
    form.button("§b外交を編集");
    form.button("§aメンバー/配列を編集");
    form.button("← 国選択へ戻る");

    form.show(player).then((res) => {
        if (res.canceled || res.selection === 4) {
            CountryDataAdmin(player);
            return;
        }
        const freshData = countryDatas.get(d.id) || d;
        switch (res.selection) {
            case 0: CountryDataEditBasic(player, freshData); break;
            case 1: CountryDataEditTax(player, freshData); break;
            case 2: CountryDataEditDiplomacy(player, freshData); break;
            case 3: CountryDataEditMembers(player, freshData); break;
        }
    });
}

/**
 * 基本情報編集
 * [ルール] 数値フィールドは数値のみ入力
 * [ルール] buildtime/lastDefeated はUnixミリ秒タイムスタンプ
 */
async function CountryDataEditBasic(player, countryData) {
    const form = new ui.ModalFormData();
    form.title(`基本情報編集: ${countryData.name}`);
    form.textField("name (国名 文字列)", "国名を入力", { defaultValue: String(countryData.name ?? "") });
    form.textField("description (説明 文字列)", "説明文を入力", { defaultValue: String(countryData.description ?? "") });
    form.textField("money (国庫 数値)", "例: 1000", { defaultValue: String(countryData.money ?? 0) });
    form.toggle("isPeace (平和主義 真偽値)", { defaultValue: Boolean(countryData.isPeace) });
    form.textField("chunkAmount (チャンク数 数値)", "例: 5", { defaultValue: String(countryData.chunkAmount ?? 0) });
    form.textField("wardeath (戦争死亡許容数 数値)", "例: 3", { defaultValue: String(countryData.wardeath ?? 0) });
    form.textField("winStreak (連勝数 数値)", "例: 2", { defaultValue: String(countryData.winStreak ?? 0) });
    form.textField("buildtime (建国日時 Unixミリ秒)", "例: 1700000000000", { defaultValue: String(countryData.buildtime ?? 0) });
    form.textField("lastDefeated (最終敗北 Unixミリ秒)", "例: 0", { defaultValue: String(countryData.lastDefeated ?? 0) });

    form.show(player).then((res) => {
        if (res.canceled) {
            CountryDataView(player, countryData);
            return;
        }
        const d = countryDatas.get(countryData.id) || countryData;
        d.name = String(res.formValues[0]).trim() || d.name;
        d.description = String(res.formValues[1]);
        d.money = Number(res.formValues[2]) || 0;
        d.isPeace = Boolean(res.formValues[3]);
        d.chunkAmount = Number(res.formValues[4]) || 0;
        d.wardeath = Number(res.formValues[5]) || 0;
        d.winStreak = Number(res.formValues[6]) || 0;
        const bt = Number(res.formValues[7]);
        if (!isNaN(bt) && bt > 0) d.buildtime = bt;
        d.lastDefeated = Number(res.formValues[8]) || 0;
        countryDatas.set(d.id, d);
        player.sendMessage(`§a[管理] ${d.name} の基本情報を更新しました。`);
        CountryDataView(player, d);
    });
}

/**
 * 税率編集
 * [ルール] 各税率は 0〜100 のスライダーで設定
 */
async function CountryDataEditTax(player, countryData) {
    const tax = countryData.tax || { consumption: 0, income: 0, country: 0, customs: 0 };
    const form = new ui.ModalFormData();
    form.title(`税率編集: ${countryData.name}`);
    form.slider("consumption (消費税 %)", 0, 100, { defaultValue: tax.consumption ?? 0 });
    form.slider("income (所得税 %)", 0, 100, { defaultValue: tax.income ?? 0 });
    form.slider("country (国民税 %)", 0, 100, { defaultValue: tax.country ?? 0 });
    form.slider("customs (関税 %)", 0, 100, { defaultValue: tax.customs ?? 0 });

    form.show(player).then((res) => {
        if (res.canceled) {
            CountryDataView(player, countryData);
            return;
        }
        const d = countryDatas.get(countryData.id) || countryData;
        if (!d.tax) d.tax = {};
        d.tax.consumption = res.formValues[0];
        d.tax.income = res.formValues[1];
        d.tax.country = res.formValues[2];
        d.tax.customs = res.formValues[3];
        countryDatas.set(d.id, d);
        player.sendMessage(`§a[管理] ${d.name} の税率を更新しました。`);
        CountryDataView(player, d);
    });
}

/**
 * 外交データ編集
 * [ルール] 国ID → 数値をカンマ(,)区切りで入力  例: 1,2,3
 * [ルール] 権限 → 権限名をカンマ(,)区切りで入力  例: break_block,place_block
 * [有効な権限名] break_block / place_block / interact / attack_player / attack_entity
 */
async function CountryDataEditDiplomacy(player, countryData) {
    const dp = countryData.diplomacy || { ally: [], friend: [], neutral: [], enemy: [], requests: [] };
    const dpp = countryData.diplomacyPermissions || { ally: [], friend: [], neutral: [], enemy: [] };

    const form = new ui.ModalFormData();
    form.title(`外交編集: ${countryData.name} §r[IDはカンマ区切り]`);
    form.textField("diplomacy.ally (同盟 国ID カンマ区切り)", "例: 1,2,3", { defaultValue: arrToStr(dp.ally) });
    form.textField("diplomacy.friend (友好 国ID カンマ区切り)", "例: 1,2,3", { defaultValue: arrToStr(dp.friend) });
    form.textField("diplomacy.neutral (中立 国ID カンマ区切り)", "例: 1,2,3", { defaultValue: arrToStr(dp.neutral) });
    form.textField("diplomacy.enemy (敵対 国ID カンマ区切り)", "例: 1,2,3", { defaultValue: arrToStr(dp.enemy) });
    form.textField("diplomacy.requests (同盟申請中 国ID カンマ区切り)", "例: 1,2,3", { defaultValue: arrToStr(dp.requests) });
    form.textField("diplomacyPerms.ally (同盟権限 カンマ区切り)", "例: break_block,place_block", { defaultValue: arrToStr(dpp.ally) });
    form.textField("diplomacyPerms.friend (友好権限 カンマ区切り)", "例: break_block,place_block", { defaultValue: arrToStr(dpp.friend) });
    form.textField("diplomacyPerms.neutral (中立権限 カンマ区切り)", "例: interact", { defaultValue: arrToStr(dpp.neutral) });
    form.textField("diplomacyPerms.enemy (敵対権限 カンマ区切り)", "例: ", { defaultValue: arrToStr(dpp.enemy) });

    form.show(player).then((res) => {
        if (res.canceled) {
            CountryDataView(player, countryData);
            return;
        }
        const d = countryDatas.get(countryData.id) || countryData;
        if (!d.diplomacy) d.diplomacy = { ally: [], friend: [], neutral: [], enemy: [], requests: [] };
        d.diplomacy.ally = parseCommaArray(res.formValues[0], true);
        d.diplomacy.friend = parseCommaArray(res.formValues[1], true);
        d.diplomacy.neutral = parseCommaArray(res.formValues[2], true);
        d.diplomacy.enemy = parseCommaArray(res.formValues[3], true);
        d.diplomacy.requests = parseCommaArray(res.formValues[4], true);
        if (!d.diplomacyPermissions) d.diplomacyPermissions = { ally: [], friend: [], neutral: [], enemy: [] };
        d.diplomacyPermissions.ally = parseCommaArray(res.formValues[5]);
        d.diplomacyPermissions.friend = parseCommaArray(res.formValues[6]);
        d.diplomacyPermissions.neutral = parseCommaArray(res.formValues[7]);
        d.diplomacyPermissions.enemy = parseCommaArray(res.formValues[8]);
        countryDatas.set(d.id, d);
        player.sendMessage(`§a[管理] ${d.name} の外交データを更新しました。`);
        CountryDataView(player, d);
    });
}

/**
 * メンバー・配列データ編集
 * [ルール] owner / players → プレイヤーIDを入力 (プレイヤーIDは文字列)
 * [ルール] players / warcountry → カンマ(,)区切りで複数入力  例: id1,id2
 * [ルール] warcountry → 国IDを数値でカンマ区切り  例: 1,2
 * [ルール] robbedChunkAmount / stock → JSON文字列で入力  例: [] や [{"price":10,"date":0}]
 */
async function CountryDataEditMembers(player, countryData) {
    const form = new ui.ModalFormData();
    form.title(`メンバー/配列編集: ${countryData.name}`);
    form.textField("owner (国王 プレイヤーID 文字列)", "プレイヤーIDを入力", { defaultValue: String(countryData.owner ?? "") });
    form.textField("players (メンバー プレイヤーID カンマ区切り)", "例: id1,id2", { defaultValue: arrToStr(countryData.players) });
    form.textField("warcountry (戦争中の国ID 数値 カンマ区切り)", "例: 1,2", { defaultValue: arrToStr(countryData.warcountry) });
    const robbedStr = (() => { try { return JSON.stringify(countryData.robbedChunkAmount ?? []); } catch { return "[]"; } })();
    const stockStr = (() => { try { return JSON.stringify(countryData.stock ?? []); } catch { return "[]"; } })();
    form.textField("robbedChunkAmount (JSON配列)", "例: []", { defaultValue: robbedStr });
    form.textField("stock (JSON配列 例: [{\"price\":10,\"date\":0}])", "例: [{\"price\":10,\"date\":0}]", { defaultValue: stockStr });

    form.show(player).then((res) => {
        if (res.canceled) {
            CountryDataView(player, countryData);
            return;
        }
        const d = countryDatas.get(countryData.id) || countryData;
        d.owner = String(res.formValues[0]).trim() || d.owner;
        d.players = parseCommaArray(res.formValues[1]);
        d.warcountry = parseCommaArray(res.formValues[2], true);
        try {
            d.robbedChunkAmount = JSON.parse(res.formValues[3]);
        } catch {
            player.sendMessage("§c[管理] robbedChunkAmount のJSONが不正です。変更をスキップします。");
        }
        try {
            d.stock = JSON.parse(res.formValues[4]);
        } catch {
            player.sendMessage("§c[管理] stock のJSONが不正です。変更をスキップします。");
        }
        countryDatas.set(d.id, d);
        player.sendMessage(`§a[管理] ${d.name} のメンバーデータを更新しました。`);
        CountryDataView(player, d);
    });
}