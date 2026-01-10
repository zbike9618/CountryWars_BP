import * as server from "@minecraft/server"
const { world, system } = server;
import { Chunk } from "../utils/chunk";
import { Dypro } from "../utils/dypro.js";
const countryDatas = new Dypro("country")
const playerDatas = new Dypro("player")
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:chunkcheck", // コマンド名
        description: "今いるチャンクを確認する", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const scommand = {
        name: "cw:cc", // コマンド名
        description: "今いるチャンクを確認する", // コマンド説明
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
        const chunkId = Chunk.positionToChunkId(player.location);
        const countryId = Chunk.checkChunk(chunkId);

        if (countryId === "wasteland") {
            player.sendMessage({ translate: "cw.chunk.wasteland" });
        } else {
            const country = countryDatas.get(countryId);
            const countryName = country?.name || "Unknown";
            player.sendMessage({ translate: "cw.chunk.check", with: [countryName] });
        }
    })



    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}

