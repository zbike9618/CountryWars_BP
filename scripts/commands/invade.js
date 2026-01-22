import * as server from "@minecraft/server"
const { world, system } = server;
import { War } from "../utils/war";
import { Dypro } from "../utils/dypro";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");

system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:invade", // コマンド名
        description: "侵略する", // コマンド説明
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
        if (!countryData) {
            player.sendMessage({ translate: "cw.form.unjoincountry" })
            return;
        }
        if (War.CanInvade(player, countryData)) {
            if (!player.hasTag("cw:duringwar")) {
                player.sendMessage({ translate: "cw.war.nozanki" })
                return;
            }
            War.invade(player, countryData);
        } else {
            player.sendMessage("現在は侵略できません（人数バランスが悪いか、対象外のエリアです）");
        }
    })



    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}

