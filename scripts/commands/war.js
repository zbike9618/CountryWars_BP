import * as server from "@minecraft/server"
const { world, system } = server;
import { War } from "../utils/war.js";
import { Dypro } from "../utils/dypro.js";
const countryDatas = new Dypro("country")
const playerDatas = new Dypro("player")
import { Util } from "../utils/util.js";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:war", // コマンド名
        description: "戦争関連のフォーム", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }


    ev.customCommandRegistry.registerCommand(command, DoCommand);
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
        const playerData = playerDatas.get(player.id);
        const countryData = countryDatas.get(playerData.country);
        warForm(player, countryData)
    })



    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}
async function warForm(player, countryData) {
    if (!countryData) {
        player.sendMessage({ translate: "cw.form.unjoincountry" })
        return;
    }
    const form = new ActionFormData()
    form.title({ translate: `cw.warform.title` })
    form.button({ translate: `cw.warform.declare` })//宣戦布告
    form.button({ translate: `cw.warform.join` })
    const res = await form.show(player)
    if (res.selection === 0) {
        declareForm(player, countryData)
    }
    if (res.selection == 1) {
        joinForm(player)
    }
}
async function declareForm(player, countryData) {
    const form = new ModalFormData()
    const countriesData = countryDatas.idList.map(id => countryDatas.get(id)).filter(data => data.id !== countryData.id && !data.warcountry.includes(countryData.id))
    if (countriesData.length == 0) {
        player.sendMessage({ translate: "cw.warform.declare.none" })
        return
    }
    form.title({ translate: `cw.warform.declare` })
    world.sendMessage(`${countriesData.map(data => data.name)}`)
    form.dropdown({ translate: `cw.form.countrychoise` }, countriesData.map(data => data.name))
    const res = await form.show(player)
    if (res.canceled) return;
    const enemyData = countriesData[res.formValues[0]];
    if (enemyData.chunkAmount == 0 || countryData.chunkAmount == 0) {
        const mform = new MessageFormData()
        mform.title({ translate: `cw.warform.declare` })
        mform.body({ translate: `cw.warform.declare.nochunk` })
        mform.button1({ translate: "cw.form.redo" })
        mform.button2({ translate: "cw.form.cancel" })
        const resp = await mform.show(player)
        if (resp.selection === 0) {
            declareForm(player, countryData)
        }
        return
    }
    const mform = new MessageFormData()
    mform.title({ translate: `cw.warform.declare` })
    mform.body({ translate: `cw.warform.declare.check`, with: [enemyData.name] })
    mform.button1({ translate: "cw.form.yes" })
    mform.button2({ translate: "cw.form.no" })
    const resp = await mform.show(player)
    if (resp.selection === 0) {
        War.declareTo(countryData, enemyData)
        //宣戦布告を送信
        world.sendMessage({ translate: `cw.warform.declare.message`, with: [countryData.name, enemyData.name] })
        for (const player of world.getAllPlayers()) {
            player.playSound("mob.enderdragon.growl")
        }
        for (const player of Util.GetCountryPlayer(enemyData)) {
            player.onScreenDisplay.setTitle({ translate: `cw.warform.declared`, with: [countryData.name] })
            player.playSound("random.anvil_use")
        }
    }
}

