import * as server from "@minecraft/server";
const { world, system } = server;
import { SecondName } from "../utils/secondname.js";

system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:user",
        description: "ユーザーメニューを開きます",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: []
    }, (origin) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            const player = origin.sourceEntity;
            system.run(() => {
                SecondName.secondNameForm(player);
            });
        }
    });

    ev.customCommandRegistry.registerCommand({
        name: "cw:usermenu",
        description: "ユーザーメニューを開きます",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: []
    }, (origin) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            const player = origin.sourceEntity;
            system.run(() => {
                SecondName.secondNameForm(player);
            });
        }
    });
});
