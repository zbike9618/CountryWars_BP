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
    const res = await form.show(player)
    if (res.canceled) return;
    if (res.selection == 0) {
        recieve(player)
    }
    if (res.selection == 1) {
        send(player)
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
        form.button({ translate: "cw.messagebox.recieve.tpa", with: [world.getEntity(tpa)] })
    }
    for (const tpaRequest of tpaRequestArray) {
        form.button({ translate: "cw.messagebox.recieve.tpaRequest", with: [world.getEntity(tpaRequest)] })
    }
    for (const invitecountry of invitecountryArray) {
        const countryData = countryDatas.get(invitecountry)
        form.button({ translate: "cw.messagebox.recieve.invitecountry", with: [countryData.name] })
    }
    for (const message of messageArray) {
        const senderName = playerDatas.get(message.player)?.name || "Unknown"
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
    const playersname = players.map(player => playerDatas.get(player).name)
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

async function readMessage(player, selection, type) {
    const form = new MessageFormData()
    form.title({ translate: "cw.messagebox.recieve", with: ["0"] })
    if (type == "tpa") {
        form.body({ translate: "cw.messagebox.recieve.tpa.read", with: [world.getEntity(selection).name] })
    }
    if (type == "tpaRequest") {
        form.body({ translate: "cw.messagebox.recieve.tpaRequest.read", with: [world.getEntity(selection).name] })
    }
    if (type == "invitecountry") {
        const countryData = countryDatas.get(selection)
        form.body({ translate: "cw.messagebox.recieve.invitecountry.read", with: [countryData.name] })

    }
    if (type == "message") {
        const senderName = playerDatas.get(selection.player)?.name || "Unknown"
        form.body({ translate: "cw.messagebox.recieve.message.read", with: [senderName, selection.message] })
    }
    form.button1({ translate: "cw.form.yes" })
    form.button2({ translate: "cw.form.no" })
    const res = await form.show(player)
    if (res.canceled) return;
    if (res.selection == 0) {
        if (type == "tpa") {
            tpa(player, selection)
        }
        if (type == "tpaRequest") {
            tpaRequest(player, selection)
        }
        if (type == "invitecountry") {
            invitecountry(player, selection)
        }
        // messageタイプは確認のみなので何もしない
    }
}

function tpa(player, selection) {
    player.teleport(world.getEntity(selection).location)
}
function tpaRequest(player, selection) {
    world.getEntity(selection).teleport(player.location)
}
function invitecountry(player, selection) {
    const countryData = countryDatas.get(selection)
    const playerData = playerDatas.get(player.id)
    playerData.country = selection
    playerDatas.set(player.id, playerData)
    countryData.players.push(player.id)
    countryDatas.set(selection, countryData)
}