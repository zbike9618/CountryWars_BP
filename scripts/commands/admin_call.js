import * as server from "@minecraft/server";
import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { DiscordRelay } from "../utils/chat.js";

// 続けて呼び出せないようにする（連投でロールのメンションが飛び続けるのを防ぐ）
// 時刻はメモリにだけ持つので、reload・再起動で空に戻る
const COOLDOWN_MS = 5 * 60 * 1000;    // 同じプレイヤーは5分に1回
const GLOBAL_COOLDOWN_MS = 30 * 1000; // 全員で30秒に1回（別のアカウントに替えての連投も止める）
const lastCallAt = new Map(); // player.id -> 最後に呼び出しを送った時刻
let lastAnyCallAt = 0;        // だれかが最後に呼び出しを送った時刻

// 待つ必要がなければ null。あれば { ms: 残りのミリ秒, mine: 自分の制限か }
function cooldownFor(player) {
    const now = Date.now();
    const last = lastCallAt.get(player.id);
    const mine = last === undefined ? 0 : Math.max(0, last + COOLDOWN_MS - now);
    const all = Math.max(0, lastAnyCallAt + GLOBAL_COOLDOWN_MS - now);
    if (mine === 0 && all === 0) return null;
    return mine >= all ? { ms: mine, mine: true } : { ms: all, mine: false };
}

function tellCooldown(player, wait) {
    const sec = Math.ceil(wait.ms / 1000);
    const text = sec >= 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec}秒`;
    if (wait.mine) {
        player.sendMessage(`§c管理者呼び出しは1人${COOLDOWN_MS / 60000}分に1回までです。あと${text}待ってください。`);
    } else {
        player.sendMessage(`§c少し前にほかの人が管理者呼び出しをしました。あと${text}待ってから送ってください。`);
    }
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
                const before = cooldownFor(player);
                if (before) {
                    tellCooldown(player, before);
                    return;
                }
                const form = new ModalFormData();
                form.title({ translate: "cw.admincall.title" });
                form.textField({ translate: "cw.admincall.reason.label" }, { translate: "cw.admincall.reason.placeholder" });
                const res = await form.show(player)
                if (res.canceled) return;
                if (!player.isValid) return;
                // フォームを開いている間にほかの人（または自分）が送っていないか、送る直前にも確かめる
                const after = cooldownFor(player);
                if (after) {
                    tellCooldown(player, after);
                    return;
                }
                const now = Date.now();
                lastCallAt.set(player.id, now);
                lastAnyCallAt = now;
                DiscordRelay.send(`<@&1401578585650892971> §e${player.name}§cが§e§l管理者呼び出し§cを行いました\n§e§l理由: ${res.formValues[0]}`); // Discord用なので翻訳キー不要
                player.sendMessage({ translate: "cw.admincall.success" });
            });
        }
    });
});
