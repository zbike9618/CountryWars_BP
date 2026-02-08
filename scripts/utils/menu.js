import * as ui from "@minecraft/server-ui";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { system, world } from "@minecraft/server";
import { Util } from "../utils/util";
import { Dypro } from "../utils/dypro";
import { Country } from "../utils/country";
import { War } from "../utils/war";
import { Chunk } from "./chunk";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
const chunkDatas = new Dypro("chunk");
export class Menu {
    static async showForm(player) {
        const form = new ui.ActionFormData();
        form.title("cw.menu.title");
        form.button({ translate: "cw.menu.movemoney" });
        form.button({ translate: "cw.menu.secondname" });
        form.button({ translate: "cw.menu.adminchunk" });
        form.button({ translate: "cw.menu.playerdatareset" });
        form.button({ translate: "cw.menu.deletecountry" })
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
            }
        });
    }
}
async function movemoney(player) {
    const form = new ui.ModalFormData();
    form.title("cw.menu.movemoney");
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

async function SecondName(player) {
    const form = new ui.ActionFormData();
    form.title("cw.menu.secondname");
    form.button("cw.menu.secondname.addtitle");
    form.button("cw.menu.secondname.removetitle");
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
    const playerData = playerDatas.get(player.id);
    const form = new ui.ModalFormData();
    form.title("cw.menu.secondname.addtitle");
    form.dropdown({ translate: "cw.menu.secondname.player" }, playerNames);
    form.dropdown({ translate: "cw.menu.secondname.position" }, ["cw.menu.secondname.position.before", "cw.menu.secondname.position.after"]);
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
        if (position === 0) {
            playerData.secondname.before.push(response.formValues[2])
            playerDatas.set(selectedPlayer.id, playerData)
            player.sendMessage({ translate: "cw.menu.secondname.add.before.success", with: [`${selectedPlayer.name}`, `${newSecondName}`] });
        } else if (position === 1) {
            playerData.secondname.after.push(response.formValues[2])
            playerDatas.set(selectedPlayer.id, playerData)
            player.sendMessage({ translate: "cw.menu.secondname.add.after.success", with: [`${selectedPlayer.name}`, `${newSecondName}`] });
        }
    })
}
async function AdminChunk(player) {
    const form = new ui.ActionFormData();
    form.title("cw.menu.adminchunk");
    const chunkId = Chunk.positionToChunkId(player.location);
    const countryId = Chunk.checkChunk(chunkId);

    let status = countryId === "admin" ? "§cAdmin" : countryId === "wasteland" ? "§7Wasteland" : `§6${countryDatas.get(countryId)?.name || countryId}`;
    form.body(`Chunk ID: ${chunkId}\nStatus: ${status}`);
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
    const chunkId = Chunk.positionToChunkId(player.location);
    Chunk.setAdmin(chunkId);
    player.sendMessage({ translate: "cw.menu.adminchunk.set.success", with: [chunkId] });
    AdminChunk(player);
}
async function removeAdminChunk(player) {
    const chunkId = Chunk.positionToChunkId(player.location);
    Chunk.removeAdmin(chunkId);
    player.sendMessage({ translate: "cw.menu.adminchunk.remove.success", with: [chunkId] });
    AdminChunk(player);
}
async function AdminChunkSetting(player, chunkId) {
    const form = new ui.ModalFormData();
    form.title("cw.menu.adminchunk.setting");
    form.toggle({ translate: "cw.menu.adminchunk.setting.place" });
    form.toggle({ translate: "cw.menu.adminchunk.setting.break" });
    form.toggle({ translate: "cw.menu.adminchunk.setting.interact" });
    form.toggle({ translate: "cw.menu.adminchunk.setting.hurtEntity" });
    form.toggle({ translate: "cw.menu.adminchunk.setting.hurtPlayer" });
    form.show(player).then((res) => {
        if (res.canceled) {
            AdminChunk(player);
            return;
        };
        const chunkData = chunkDatas.get(chunkId)
        chunkData.setting.place = res.formValues[0]
        chunkData.setting.break = res.formValues[1]
        chunkData.setting.interact = res.formValues[2]
        chunkData.setting.hurtEntity = res.formValues[3]
        chunkData.setting.hurtPlayer = res.formValues[4]
        chunkDatas.set(chunkId, chunkData)
        player.sendMessage({ translate: "cw.menu.adminchunk.setting.success", with: [chunkId] });
        AdminChunk(player);
    })
}
async function removesecondname(player) {
    const allPlayers = world.getAllPlayers();
    const playerNames = allPlayers.map(p => p.name);
    const playerData = playerDatas.get(player.id);
    const form = new ui.ModalFormData();
    let before = [...playerData.secondname.before, "-"]
    let after = [...playerData.secondname.after, "-"]
    // player.sendMessage(`${before}><${after}`);//debug
    form.title("cw.menu.secondname.removetitle");
    form.dropdown({ translate: "cw.menu.secondname.player" }, playerNames);
    form.dropdown({ translate: "cw.menu.secondname.remove.before" }, before, { tooltip: { translate: "cw.menu.secondname.remove.tooltip" } })
    form.dropdown({ translate: "cw.menu.secondname.remove.after" }, after, { tooltip: { translate: "cw.menu.secondname.remove.tooltip" } })
    form.show(player).then((response) => {
        if (response.canceled) {
            SecondName(player);
            return;
        };
        const selectedIndex = response.formValues[0];
        const beforeIndex = response.formValues[1];
        const afterIndex = response.formValues[2];
        const selectedPlayer = allPlayers[selectedIndex];

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
    form.title("cw.menu.playerdatareset.title");
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
            player.runCommand("kick @s プレイヤーデータのリセット")
            player.sendMessage({ translate: "cw.menu.playerdatareset.success", with: [`${player.name}`] });
        }
    })
}

async function DeleteCountry(player) {
    const countries = countryDatas.idList
        .map(id => countryDatas.get(id))
        .filter(country => country?.name);
    const form = new ui.ActionFormData();
    form.title("cw.menu.deletecountry");
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