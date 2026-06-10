import * as server from "@minecraft/server"
const { world, system } = server;
import { Chunk } from "../utils/chunk.js";

system.beforeEvents.startup.subscribe(ev => {
    const command = {
        name: "cw:plotchunk",
        description: "現在のプロット（領地）の権限設定を行います",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: [],
    }
    const scommand = {
        name: "cw:pc",
        description: "現在のプロット（領地）の権限設定を行います",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: [],
    }

    ev.customCommandRegistry.registerCommand(command, DoCommand);
    ev.customCommandRegistry.registerCommand(scommand, DoCommand);
});

function DoCommand(origin) {
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        return {
            status: server.CustomCommandStatus.Failure,
            message: "実行者はプレイヤーである必要があります",
        }
    }

    const player = origin.sourceEntity;
    system.run(() => {
        const chunkId = Chunk.positionToChunkId(player.location, player.dimension.id);
        Chunk.settingMenu(player, chunkId);
    })

    return {
        status: server.CustomCommandStatus.Success,
        message: undefined,
    }
}
