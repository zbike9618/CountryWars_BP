import * as server from "@minecraft/server";
import { world, system, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import { Util } from "../utils/util";
import { default as config } from "../config/config.js";
import { Jobs } from "../utils/jobs.js";


server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:selfkill",
        description: "自殺コマンド",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ]
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            system.run(() => {  // 1tick後に安全に実行
                player.runCommand("kill @s")
            });
        }
    });
});
