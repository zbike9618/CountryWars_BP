import * as server from "@minecraft/server";
import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { DiscordRelay } from "../utils/chat.js";

server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:admincall",
        description: "管理者呼び出しフォームを開きます",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ]
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            system.run(async () => {  // 1tick後に安全に実行
                const form = new ModalFormData();
                form.title({ translate: "cw.admincall.title" });
                form.textField({ translate: "cw.admincall.reason.label" }, { translate: "cw.admincall.reason.placeholder" });
                const res = await form.show(player)
                if (res.canceled) return;
                DiscordRelay.send(`<@&1401578585650892971> §e${player.name}§cが§e§l管理者呼び出し§cを行いました\n§e§l理由: ${res.formValues[0]}`); // Discord用なので翻訳キー不要
                player.sendMessage({ translate: "cw.admincall.success" });
            });
        }
    });
});
