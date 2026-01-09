import * as server from "@minecraft/server";
import { world, system, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import * as ui from "@minecraft/server-ui";
import { JOB_CONFIG, JOB_LIMIT } from "../config/jobs_config.js";
import { Util } from "../utils/util";
import { default as config } from "../config/config.js";
import { Jobs } from "../utils/jobs.js";


function sendActionBar(player, message) {
    player.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"${message}"}]}`);
}
server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:jobs",
        description: "職業を選択するコマンド",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ]
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            system.run(() => {  // 1tick後に安全に実行
                Jobs.showForm(player);
            });
        }
    });
});

server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:money",
        description: "所持金を表示するコマンド",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ]
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            system.run(() => {  // 1tick後に安全に実行
                const score = Util.getMoney(player);
                player.sendMessage(`§a所持金:${config.coinname}${score}`);
            });
        }
    });
});