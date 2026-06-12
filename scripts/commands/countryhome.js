import * as server from "@minecraft/server"
const { world, system } = server;
import { Dypro } from "../utils/dypro";

const countryDatas = new Dypro("country");
const playerDatas = new Dypro("player");

system.beforeEvents.startup.subscribe(ev => {
    const chomeCommand = {
        name: "cw:chome",
        description: "所属する国のホーム地点へ戻る",
        permissionLevel: server.CommandPermissionLevel.Any,
    };

    const countryHomeCommand = {
        name: "cw:countryhome",
        description: "所属する国のホーム地点へ戻る",
        permissionLevel: server.CommandPermissionLevel.Any,
    };

    ev.customCommandRegistry.registerCommand(chomeCommand, DoCommand);
    ev.customCommandRegistry.registerCommand(countryHomeCommand, DoCommand);
});

function DoCommand(origin) {
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        return {
            status: server.CustomCommandStatus.Failure,
            message: "このコマンドはプレイヤーのみ実行可能です",
        }
    }

    const player = origin.sourceEntity;

    system.run(() => {
        const playerData = playerDatas.get(player.id);
        if (!playerData.country) {
            player.sendMessage({ translate: "cw.countryhome.notmember" });
            return;
        }

        const countryData = countryDatas.get(playerData.country);
        if (!countryData.home) {
            player.sendMessage({ translate: "cw.countryhome.nothome" });
            return;
        }

        const targetPos = countryData.home;
        const targetDimension = world.getDimension(targetPos.dimension || "overworld");

        player.teleport(targetPos, { dimension: targetDimension });
        player.sendMessage({ translate: "cw.countryhome.teleport", args: [countryData.name] });
    });

    return {
        status: server.CustomCommandStatus.Success,
        message: undefined,
    }
}
