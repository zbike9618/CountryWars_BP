import * as server from "@minecraft/server";
import { system, world } from "@minecraft/server";
import { Menu } from "../utils/menu.js";


server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:menu",
        description: "管理者用ツール[管理者専用]",
        permissionLevel: server.CommandPermissionLevel.Admin,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ]
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            system.run(() => {  // 1tick後に安全に実行
                Menu.showForm(player);
            });
        }
    });
});
