import * as server from "@minecraft/server"
import { ChangeChatType } from "../utils/chat";
const { world, system } = server;
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const world = {
        name: "cw:worldchat", // コマンド名
        description: "チャットタイプをワールドにする", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const worldS = {
        name: "cw:wchat", // コマンド名
        description: "チャットタイプをワールドにする", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const country = {
        name: "cw:countrychat", // コマンド名
        description: "チャットタイプをカントリーにする", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const countryS = {
        name: "cw:cchat", // コマンド名
        description: "チャットタイプをカントリーにする", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const local = {
        name: "cw:localchat", // コマンド名
        description: "チャットタイプをローカルにする", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const localS = {
        name: "cw:lchat", // コマンド名
        description: "チャットタイプをローカルにする", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }
    const ally = { 
        name: "cw:allychat", 
        description: "チャットタイプを同盟にする", 
        permissionLevel: server.CommandPermissionLevel.Any, 
        mandatoryParameters: [
        ],
        optionalParameters: [
        ] }
    const allyS = { 
        name: "cw:achat", 
        description: "チャットタイプを同盟にする", 
        permissionLevel: server.CommandPermissionLevel.Any, 
        mandatoryParameters: [
        ], 
        optionalParameters: [
        ] }

    ev.customCommandRegistry.registerCommand(world, worldChat);
    ev.customCommandRegistry.registerCommand(worldS, worldChat);
    ev.customCommandRegistry.registerCommand(country, countryChat);
    ev.customCommandRegistry.registerCommand(countryS, countryChat);
    ev.customCommandRegistry.registerCommand(local, localChat);
    ev.customCommandRegistry.registerCommand(localS, localChat);
    ev.customCommandRegistry.registerCommand(ally, allyChat);
    ev.customCommandRegistry.registerCommand(allyS, allyChat);

});

function worldChat(origin) {
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
        ChangeChatType(player, "world");
    })

    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}
function countryChat(origin) {
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
        ChangeChatType(player, "country");
    })

    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}
function localChat(origin) {
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
        ChangeChatType(player, "local");
    })

    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}


// 新しく追加した関数
function allyChat(origin) {
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        return { status: server.CustomCommandStatus.Failure, message: "実行者はプレイヤーである必要があります" }
    }
    const player = origin.sourceEntity;
    system.run(() => { ChangeChatType(player, "ally"); })
    return { status: server.CustomCommandStatus.Success, message: undefined }
}
