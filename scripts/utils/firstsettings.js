import * as server from "@minecraft/server";

server.afterEvents.worldInitialize.subscribe(ev => {
    ev.propertyRegistry.registerWorldDynamicProperties({
        initialSetupDone: {
            type: "boolean",
            defaultValue: false
        }
    });
});


server.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:setup",
        description: "初回設定コマンド",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ]
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            world.setDynamicProperty("initialSetupDone", true);
        }
    });
});