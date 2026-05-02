import * as server from "@minecraft/server";
import { system } from "@minecraft/server";
import { Sell } from "../utils/sell.js";

server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:sell",
        description: "所持しているアイテムを売却する",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: []
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            system.run(() => {
                Sell.showForm(player);
            });
        }
    });
});
