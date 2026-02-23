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
                form.title("管理者呼び出し");
                form.textField("§c§l管理者呼び出しフォームを開きます\n§e§l意味なく呼び出すと処罰が課されます\n\n理由を入力してください", "§c§l理由を入力してください");
                const res = await form.show(player)
                if (res.canceled) return;
                DiscordRelay.send(`<@&1401578585650892971> §e${player.name}§cが§e§l管理者呼び出し§cを行いました\n§e§l理由: ${res.formValues[0]}`);
                player.sendMessage("§c§l管理者呼び出しをしました");
            });
        }
    });
});
