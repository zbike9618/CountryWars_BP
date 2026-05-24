import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { Country } from "../utils/country";
import { Dypro } from "../utils/dypro";
import { ShortPlayerData } from "../utils/playerData";
import { Util } from "../utils/util";
import { sendDataForPlayers } from "../utils/sendData";
const countryDatas = new Dypro("country");
const playerDatas = new Dypro("player");
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:messagebox", // コマンド名
        description: "メッセージの受信及び送信", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const scommand = {
        name: "cw:mb", // コマンド名
        description: "メッセージの受信及び送信", // コマンド説明
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
        openmessagebox(player);
    })



    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}


async function openmessagebox(player) {
    const playerData = new ShortPlayerData(player.id)
    const tpaArray = playerData.get("tpa") || []
    const tpaRequestArray = playerData.get("tpaRequest") || []
    const invitecountryArray = playerData.get("invitecountry") || []
    const messageArray = playerData.get("message") || []
    const totalRequests = (tpaArray.length + tpaRequestArray.length + invitecountryArray.length + messageArray.length)
    const form = new ActionFormData()
    form.title({ translate: "cw.messagebox.title" })
    form.button({ translate: "cw.messagebox.recieve", with: [`${totalRequests}`] })
    form.button({ translate: "cw.messagebox.send" })

    // 管理者のみボタンを表示 (タグまたはOP権限)
    const isAdmin = player.hasTag("admin") || player.permissionLevel >= 2;
    if (isAdmin) {
        form.button("§d全員に送信(アナウンス)")
    }

    const res = await form.show(player)
    if (res.canceled) return;
    if (res.selection == 0) {
        recieve(player)
    }
    if (res.selection == 1) {
        send(player)
    }
    if (res.selection == 2 && isAdmin) {
        sendAll(player)
    }
}
/**
 * すべての受信メッセージを表示する
 * @param {*} player 
 */
async function recieve(player) {
    const playerData = new ShortPlayerData(player.id)
    const tpaArray = playerData.get("tpa") || []
    const tpaRequestArray = playerData.get("tpaRequest") || []
    const invitecountryArray = playerData.get("invitecountry") || []
    const messageArray = playerData.get("message") || []
    const totalRequests = (tpaArray.length + tpaRequestArray.length + invitecountryArray.length + messageArray.length)

    if (totalRequests == 0) {
        const form = new MessageFormData()
        form.title({ translate: "cw.messagebox.recieve" })
        form.body({ translate: "cw.messagebox.recieve.norequests" })
        form.button1({ translate: "cw.form.redo" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection == 0) {
            openmessagebox(player)
        }
        return;
    }
    const form = new ActionFormData()
    form.title({ translate: "cw.messagebox.recieve", with: [`${totalRequests}`] })
    for (const tpa of tpaArray) {
        const name = playerDatas.get(tpa)?.name || "Unknown"
        form.button({ translate: "cw.messagebox.recieve.tpa", with: [name] })
    }
    for (const tpaRequest of tpaRequestArray) {
        const name = playerDatas.get(tpaRequest)?.name || "Unknown"
        form.button({ translate: "cw.messagebox.recieve.tpaRequest", with: [name] })
    }
    for (const invitecountry of invitecountryArray) {
        const countryData = countryDatas.get(invitecountry)
        const name = countryData?.name || "Unknown"
        form.button({ translate: "cw.messagebox.recieve.invitecountry", with: [name] })
    }
    for (const message of messageArray) {
        const senderName = message.senderName || playerDatas.get(message.player)?.name || "Unknown"
        form.button({ translate: "cw.messagebox.recieve.message", with: [senderName] })
    }
    const res = await form.show(player)
    if (res.canceled) return;

    const selection = res.selection
    if (selection < tpaArray.length) {
        readMessage(player, tpaArray[selection], "tpa")
    } else if (selection < tpaArray.length + tpaRequestArray.length) {
        readMessage(player, tpaRequestArray[selection - tpaArray.length], "tpaRequest")
    } else if (selection < tpaArray.length + tpaRequestArray.length + invitecountryArray.length) {
        readMessage(player, invitecountryArray[selection - tpaArray.length - tpaRequestArray.length], "invitecountry")
    } else {
        readMessage(player, messageArray[selection - tpaArray.length - tpaRequestArray.length - invitecountryArray.length], "message")
    }
}

async function send(player) {
    const players = Util.getAllPlayerIdsSorted()//.filter(p => p != player.id)
    const playersname = players.map(player => playerDatas.get(player)?.name || "Unknown")
    if (players.length == 0) {
        const form = new MessageFormData()
        form.title({ translate: "cw.messagebox.send" })
        form.body({ translate: "cw.form.noplayers" })
        form.button1({ translate: "cw.form.redo" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection == 0) {
            openmessagebox(player)
        }
        return;
    }
    const form = new ModalFormData()
    form.title({ translate: "cw.messagebox.send" })
    form.dropdown({ translate: "cw.form.playerchoise" }, playersname)
    form.textField({ translate: "cw.messagebox.send.message" }, "Write Message")
    const res = await form.show(player)
    if (res.canceled) return;
    const playerId = players[res.formValues[0]];
    const message = { player: player.id, message: res.formValues[1] };
    const targetName = playerDatas.get(playerId)?.name || "Unknown";
    player.sendMessage({ translate: "cw.messagebox.send.success", with: [targetName] });
    const data = `
        const playerData = new ShortPlayerData("${playerId}");
        const messageArray = playerData.get("message") || [];
        messageArray.push(${JSON.stringify(message)});
        playerData.set("message", messageArray);
        const target = world.getEntity("${playerId}");
        if (target) target.sendMessage({ translate: "cw.messagebox.send.recieve", with: ["${player.name}"] });
    `;
    sendDataForPlayers(data, playerId)
}

/**
 * 全プレイヤーにメッセージを送信する（アナウンス用）
 * @param {server.Player} player 
 */
export async function sendAll(player) {
    const form = new ModalFormData()
    form.title("全員に送信(アナウンス)")
    form.textField("メッセージ内容を入力してください。\n全プレイヤーのメッセージボックスに送信されます。", "アナウンス内容を入力")
    const res = await form.show(player)
    if (res.canceled || !res.formValues[0]) return;

    const announcement = res.formValues[0];
    const players = Util.getAllPlayerIdsSorted();
    
    player.sendMessage(`§a[Success] §f全プレイヤー(${players.length}人)にアナウンスを送信しました。`);

    for (const playerId of players) {
        const message = { player: player.id, message: announcement, senderName: "運営" };
        const data = `
            const playerData = new ShortPlayerData("${playerId}");
            const messageArray = playerData.get("message") || [];
            messageArray.push(${JSON.stringify(message)});
            playerData.set("message", messageArray);
            const target = world.getAllPlayers().find(p => p.id === "${playerId}");
            if (target) {
                target.sendMessage("§e[全体アナウンス] §f運営§7: ${announcement}");
                target.sendMessage({ translate: "cw.messagebox.send.recieve", with: ["運営"] });
            }
        `;
        sendDataForPlayers(data, playerId);
    }
}

async function readMessage(player, selection, type) {
    const playerData = new ShortPlayerData(player.id);
    
    if (type == "message") {
        const form = new ActionFormData();
        form.title({ translate: "cw.messagebox.recieve", with: ["0"] });
        const senderName = selection.senderName || playerDatas.get(selection.player)?.name || "Unknown";
        form.body({ translate: "cw.messagebox.recieve.message.read", with: [senderName, selection.message] });
        form.button("閉じる");
        form.button("削除する");
        
        const res = await form.show(player);
        if (res.canceled) return;
        
        if (res.selection == 0) {
            recieve(player);
        } else if (res.selection == 1) {
            const messageArray = playerData.get("message") || [];
            const index = messageArray.findIndex(msg => msg.player === selection.player && msg.message === selection.message && msg.senderName === selection.senderName);
            if (index !== -1) {
                messageArray.splice(index, 1);
                playerData.set("message", messageArray);
            }
            recieve(player);
        }
        return;
    }

    // tpa, tpaRequest, invitecountry
    const form = new ActionFormData();
    form.title({ translate: "cw.messagebox.recieve", with: ["0"] });
    if (type == "tpa") {
        const name = playerDatas.get(selection)?.name || "Unknown";
        form.body({ translate: "cw.messagebox.recieve.tpa.read", with: [name] });
    }
    if (type == "tpaRequest") {
        const name = playerDatas.get(selection)?.name || "Unknown";
        form.body({ translate: "cw.messagebox.recieve.tpaRequest.read", with: [name] });
    }
    if (type == "invitecountry") {
        const countryData = countryDatas.get(selection);
        const name = countryData?.name || "Unknown";
        form.body({ translate: "cw.messagebox.recieve.invitecountry.read", with: [name] });
    }
    form.button({ translate: "cw.form.yes" });
    form.button({ translate: "cw.form.no" });
    
    const res = await form.show(player);
    if (res.canceled) return;

    if (res.selection == 0) {
        if (type == "tpa") {
            const target = world.getAllPlayers().find(p => p.id === selection) || world.getEntity(selection);
            if (target) {
                player.teleport(target.location);
            } else {
                player.sendMessage("プレイヤーが見つかりませんでした。");
            }
        }
        if (type == "tpaRequest") {
            const target = world.getAllPlayers().find(p => p.id === selection) || world.getEntity(selection);
            if (target) {
                target.teleport(player.location);
            } else {
                player.sendMessage("プレイヤーが見つかりませんでした。");
            }
        }
        if (type == "invitecountry") {
            Country.join(player, countryDatas.get(selection));
        }
    }

    // 承認(0)または拒否(1)が実行された場合、リストから削除して元のメニューに戻る
    if (res.selection == 0 || res.selection == 1) {
        if (type == "tpa") {
            const tpaArray = playerData.get("tpa") || [];
            const index = tpaArray.indexOf(selection);
            if (index !== -1) {
                tpaArray.splice(index, 1);
                playerData.set("tpa", tpaArray);
            }
        }
        if (type == "tpaRequest") {
            const tpaRequestArray = playerData.get("tpaRequest") || [];
            const index = tpaRequestArray.indexOf(selection);
            if (index !== -1) {
                tpaRequestArray.splice(index, 1);
                playerData.set("tpaRequest", tpaRequestArray);
            }
        }
        if (type == "invitecountry") {
            const invitecountryArray = playerData.get("invitecountry") || [];
            const index = invitecountryArray.indexOf(selection);
            if (index !== -1) {
                invitecountryArray.splice(index, 1);
                playerData.set("invitecountry", invitecountryArray);
            }
        }
        recieve(player);
    }
}
