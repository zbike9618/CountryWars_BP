import * as server from "@minecraft/server"
const { world, system } = server;
import { War } from "../utils/war";
import { Dypro } from "../utils/dypro";
import { ActionFormData } from "@minecraft/server-ui";
import { Stock } from "../utils/stock";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");

system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:stock", // コマンド名
        description: "株関連の操作", // コマンド説明
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
        CountryList(player)

    })



    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}

async function CountryList(player) {
    const form = new ActionFormData()
    form.title({ translate: "cw.countrylist.title" })
    for (const id of countryDatas.idList) {
        const countryData = countryDatas.get(id)
        form.button(countryData.name)
    }
    const res = await form.show(player)
    if (res.canceled) {
        return
    }
    const countryData = countryDatas.get(countryDatas.idList[res.selection])
    const stock = new Stock(countryData)
    stock.show(player)
}

