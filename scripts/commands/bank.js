import * as server from "@minecraft/server";
import { world, system, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import { Util } from "../utils/util";
import { Bank } from "../utils/bank";
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
                player.sendMessage({ translate: "cw.watchmoney", with: [`${score}`] });
            });
        }
    });
});

server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:bank",
        description: "銀行フォームを開きます",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ]
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            system.run(() => {  // 1tick後に安全に実行
                Bank.bankForm(player);
            });
        }
    });
});