import * as server from "@minecraft/server";
import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { DiscordRelay } from "../utils/chat.js";

// 同じプレイヤーが続けて呼び出せないようにする（連投でロールのメンションが飛び続けるのを防ぐ）
const COOLDOWN_MS = 5 * 60 * 1000;
const lastCallAt = new Map(); // player.id -> 最後に呼び出しを送った時刻（reload・再起動で空に戻る）

function cooldownRemainingMs(player) {
    const last = lastCallAt.get(player.id);
    if (last === undefined) return 0;
    return Math.max(0, last + COOLDOWN_MS - Date.now());
}

function tellCooldown(player, remainingMs) {
    const sec = Math.ceil(remainingMs / 1000);
    const text = sec >= 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec}秒`;
    player.sendMessage(`§c管理者呼び出しは${COOLDOWN_MS / 60000}分に1回までです。あと${text}待ってください。`);
}

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
                const before = cooldownRemainingMs(player);
                if (before > 0) {
                    tellCooldown(player, before);
                    return;
                }
                const form = new ModalFormData();
                form.title({ translate: "cw.admincall.title" });
                form.textField({ translate: "cw.admincall.reason.label" }, { translate: "cw.admincall.reason.placeholder" });
                const res = await form.show(player)
                if (res.canceled) return;
                if (!player.isValid) return;
                // フォームを開いている間に別の経路で送っていないか、送る直前にも確かめる
                const after = cooldownRemainingMs(player);
                if (after > 0) {
                    tellCooldown(player, after);
                    return;
                }
                lastCallAt.set(player.id, Date.now());
                DiscordRelay.send(`<@&1401578585650892971> §e${player.name}§cが§e§l管理者呼び出し§cを行いました\n§e§l理由: ${res.formValues[0]}`); // Discord用なので翻訳キー不要
                player.sendMessage({ translate: "cw.admincall.success" });
            });
        }
    });
});
