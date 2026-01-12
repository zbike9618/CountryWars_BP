import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData } from "@minecraft/server-ui";
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:playermarket", // コマンド名
        description: "プレイヤーマーケットをみる", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const scommand = {
        name: "cw:pm", // コマンド名
        description: "プレイヤーマーケットをみる", // コマンド説明
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
        showPlayerMarket(player);
    })



    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}

async function showPlayerMarket(player) {
    const form = new ActionFormData()
    form.title({ translate: "cw.playermarket.title" })
    form.button({ translate: "cw.playermarket.see" })
    form.button({ translate: "cw.playermarket.sell" })
    form.button({ translate: "cw.playermarket.return" })
    const res = await form.show(player)
    if (res.canceled) return;
    if (res.selection === 0) {

    }

}