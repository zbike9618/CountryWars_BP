import * as server from "@minecraft/server"
const { world, system, } = server;
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { ShortPlayerData } from "../utils/playerData";
import { Dypro } from "../utils/dypro";
const playerDatas = new Dypro("player");
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:tpaccept", // コマンド名
        description: "特定のプレイヤーにtpする", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
            { name: "cw:target", type: server.CustomCommandParamType.PlayerSelector },
            { name: "cw:type", type: server.CustomCommandParamType.String }

        ],
    }
    const scommand = {
        name: "cw:tpa", // コマンド名
        description: "特定のプレイヤーにtpする", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
            { name: "cw:target", type: server.CustomCommandParamType.PlayerSelector },
            { name: "cw:type", type: server.CustomCommandParamType.String }
        ],
    }

    ev.customCommandRegistry.registerCommand(command, DoCommand);
    ev.customCommandRegistry.registerCommand(scommand, DoCommand);
});

function DoCommand(origin, selector) {
    // もし実行者エンティティの種族がプレイヤーではないなら
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        // コマンド結果を返す
        return {
            status: server.CustomCommandStatus.Failure, // 失敗
            message: "実行者はプレイヤーである必要があります",
        }
    }
    const player = origin.sourceEntity;
    const target = selector ? selector[0] : undefined
    //関数を実行する（制限された実行コンテキストから抜けるためsystem.run()を使用）
    system.run(() => {
        tpaccept(player, target);
    });


    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}
/**
 * 
 * @param {import("@minecraft/server").Player} player 
 * @param {import("@minecraft/server").Player} target 
 */
function tpaccept(player, target = undefined, type = "accept") {
    if (target) {
        tpaSend(player, target, type)
    } else {
        tpaForm(player)
    }
}
async function tpaForm(player) {
    const playerData = new ShortPlayerData(player.id)
    const form = new ActionFormData()
    const tpaArray = playerData.get("tpa") || []
    const tpaRequestArray = playerData.get("tpaRequest") || []
    const totalRequests = tpaArray.length + tpaRequestArray.length
    form.title({ translate: "cw.tpaform.title" })
    form.button({ translate: "cw.tpaform.accept" })
    form.button({ translate: "cw.tpaform.request" })
    form.button({ translate: "cw.tpaform.recieve", with: [`${totalRequests}`] })
    const res = await form.show(player)
    if (res.canceled) return;
    if (res.selection == 0) {
        tpaSendForm(player)
    }
    if (res.selection == 1) {
        tpaRequest(player)
    }
    if (res.selection == 2) {
        tpaRecieve(player)
    }
}
/**
 * 
 * @param {import("@minecraft/server").Player} player 
 */
async function tpaRecieve(player) {
    const playerData = new ShortPlayerData(player.id)
    const form = new ActionFormData()
    const tpaArray = playerData.get("tpa") || []
    const tpaRequestArray = playerData.get("tpaRequest") || []
    const totalRequests = tpaArray.length + tpaRequestArray.length

    if (totalRequests === 0) {
        const mform = new MessageFormData()
        mform.title({ translate: "cw.tpaform.recieve", with: [`0`] })
        mform.body({ translate: "cw.tpaformR.nobodyAccept" })
        mform.button1({ translate: "cw.form.redo" })
        mform.button2({ translate: "cw.form.cancel" })
        const respone = await mform.show(player)
        if (respone.canceled) return;
        if (respone.selection == 0) {
            tpaForm(player)
        }
        return;
    }

    form.title({ translate: "cw.tpaform.recieve", with: [`${totalRequests}`] })

    // tpa（相手が自分のところにTPする）リストを追加
    for (const playerId of tpaArray) {
        const targetData = playerDatas.get(playerId)
        const targetName = targetData?.name || "Unknown"
        form.button({ rawtext: [{ text: `§a[Accept] §r${targetName}` }] })
    }

    // tpaRequest（自分が相手のところにTPする）リストを追加
    for (const playerId of tpaRequestArray) {
        const targetData = playerDatas.get(playerId)
        const targetName = targetData?.name || "Unknown"
        form.button({ rawtext: [{ text: `§b[Request] §r${targetName}` }] })
    }

    const res = await form.show(player)
    if (res.canceled) return;

    let playerId, target, isRequest;

    if (res.selection < tpaArray.length) {
        // tpa（相手が自分のところにTPする）を選択
        playerId = tpaArray[res.selection]
        target = playerDatas.get(playerId)
        isRequest = false
    } else {
        // tpaRequest（自分が相手のところにTPする）を選択
        const requestIndex = res.selection - tpaArray.length
        playerId = tpaRequestArray[requestIndex]
        target = playerDatas.get(playerId)
        isRequest = true
    }

    const mform = new MessageFormData()
    mform.title({ translate: "cw.tpaform.recieve", with: [`${totalRequests}`] })

    if (isRequest) {
        mform.body({ translate: "cw.tpaformReq.recieve", with: [target?.name || "Unknown", player.name] })
    } else {
        mform.body({ translate: "cw.tpaformR.body", with: [target?.name || "Unknown", player.name] })
    }

    mform.button2({ translate: "cw.form.deny" })
    mform.button1({ translate: "cw.form.accept" })
    const respone = await mform.show(player)
    if (respone.canceled) return;

    if (respone.selection == 0) {
        const targetEntity = world.getEntity(playerId)
        if (isRequest) {
            // 自分が相手のところにTPする
            player.teleport(targetEntity.location, { dimension: targetEntity.dimension })
            const newArray = tpaRequestArray.filter((_, i) => i !== (res.selection - tpaArray.length))
            playerData.set("tpaRequest", newArray)
        } else {
            // 相手が自分のところにTPする
            targetEntity.teleport(player.location, { dimension: player.dimension })
            const newArray = tpaArray.filter((_, i) => i !== res.selection)
            playerData.set("tpa", newArray)
        }
    }
}
/**
 * 
 * @param {import("@minecraft/server").Player} player 
 */
async function tpaRequest(player) {
    const form = new ActionFormData()
    form.title({ translate: "cw.tpaform.request" })
    const AllPlayerIds = world.getAllPlayers().filter(p => p != player).map(player => player.id)
    if (AllPlayerIds.length == 0) {
        const mform = new MessageFormData()
        mform.title({ translate: "cw.tpaform.request" })
        mform.body({ translate: "cw.tpaformS.nobodyAccept" })
        mform.button1({ translate: "cw.form.redo" })
        mform.button2({ translate: "cw.form.cancel" })
        const respone = await mform.show(player)
        if (respone.canceled) return;
        if (respone.selection == 0) {
            tpaForm(player)
        }
        return;
    }
    for (const playerId of AllPlayerIds) {
        const playerData = playerDatas.get(playerId)
        form.button(playerData?.name || "Unknown")
    }
    const res = await form.show(player)
    if (res.canceled) return;
    const playerId = AllPlayerIds[res.selection]
    const target = playerDatas.get(playerId);
    const mform = new MessageFormData()
    mform.title({ translate: "cw.tpaform.request" })
    mform.body({ translate: "cw.tpaformReq.body", with: [target?.name || "Unknown", player.name] })
    mform.button2({ translate: "cw.form.no" })
    mform.button1({ translate: "cw.form.yes" })
    const respone = await mform.show(player)
    if (respone.canceled) return;
    if (respone.selection == 0) {
        tpaSend(player, world.getEntity(playerId), "request")
    }
}

async function tpaSendForm(player) {
    const form = new ActionFormData()
    form.title({ translate: "cw.tpaform.accept" })
    const AllPlayerIds = world.getAllPlayers().filter(p => p != player).map(player => player.id)
    if (AllPlayerIds.length == 0) {
        const mform = new MessageFormData()
        mform.title({ translate: "cw.tpaform.accept" })
        mform.body({ translate: "cw.tpaformS.nobodyAccept" })
        mform.button1({ translate: "cw.form.redo" })
        mform.button2({ translate: "cw.form.cancel" })
        const respone = await mform.show(player)
        if (respone.canceled) return;
        if (respone.selection == 0) {
            tpaForm(player)
        }
        return;
    }
    for (const playerId of AllPlayerIds) {
        const playerData = playerDatas.get(playerId)
        form.button(playerData?.name || "Unknown")
    }
    const res = await form.show(player)
    if (res.canceled) return;
    const playerId = AllPlayerIds[res.selection]
    const target = playerDatas.get(playerId);
    const mform = new MessageFormData()
    mform.title({ translate: "cw.tpaform.accept" })
    mform.body({ translate: "cw.tpaformS.body", with: [player.name, target?.name || "Unknown"] })
    mform.button2({ translate: "cw.form.no" })
    mform.button1({ translate: "cw.form.yes" })
    const respone = await mform.show(player)
    if (respone.canceled) return;
    if (respone.selection == 0) {
        tpaSend(player, world.getEntity(playerId), "accept")
    }
}
function tpaSend(player, target, type) {
    if (type == "accept") {
        const playerData = new ShortPlayerData(target.id)
        const tpa = playerData.get("tpa") || [];
        if (tpa.includes(player.id)) {

            player.sendMessage({ translate: "cw.tpa.secondsend", with: [target?.name || "Unknown"] })
            if (target) target.sendMessage({ translate: "cw.tpa.secondnotice", with: [player.name] })
            return;
        }
        tpa.push(player.id)
        playerData.set("tpa", tpa)
        player.sendMessage({ translate: "cw.tpa.send", with: [target?.name || "Unknown"] })
        if (target) target.sendMessage({ translate: "cw.tpa.notice", with: [player.name] })
    } else if (type == "request") {
        const playerData = new ShortPlayerData(target.id)
        const tpaReq = playerData.get("tpaRequest") || [];
        if (tpaReq.includes(player.id)) {
            player.sendMessage({ translate: "cw.tpa.secondrequest", with: [target?.name || "Unknown"] })
            if (target) target.sendMessage({ translate: "cw.tpa.secondrequestnotice", with: [player.name] })
            return;
        }
        tpaReq.push(player.id)
        playerData.set("tpaRequest", tpaReq)
        player.sendMessage({ translate: "cw.tpa.request", with: [target?.name || "Unknown"] })
        if (target) target.sendMessage({ translate: "cw.tpa.requestnotice", with: [player.name] })
    }
}
