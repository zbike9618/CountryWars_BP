import * as server from "@minecraft/server";
import { system } from "@minecraft/server";
import { http, HttpRequest, HttpRequestMethod, HttpHeader } from "@minecraft/server-net";
import { secrets, variables } from "@minecraft/server-admin";

// /discord: Discord のアカウントと連携するためのコードを出す。
// コードは連携用の bot が出す。ここは「このプレイヤーのコードを出して」と頼んで、本人にだけ見せるだけ。
//
// 送り先とトークンはリポジトリに置かず、サーバー側の config/<スクリプトモジュールのuuid>/ に置く:
//   variables.json: "REGULARS_BOT_URL": "http://<bot の IP>:<ポート>"
//   secrets.json:   "REGULARS_BOT_AUTH": "Bearer <トークン>"（SecretString は文字列連結できないので "Bearer " ごと）
// どちらかが無ければ「準備中」と出すだけ。

const COOLDOWN_MS = 30 * 1000; // 同じプレイヤーは30秒に1回
const lastUsedAt = new Map(); // player.id -> 時刻（メモリだけ。reload・再起動で消える）

function readSettings() {
    let url, auth;
    try { url = variables.get("REGULARS_BOT_URL"); } catch { url = undefined; }
    try { auth = secrets.get("REGULARS_BOT_AUTH"); } catch { auth = undefined; }
    return typeof url === "string" && url && auth !== undefined ? { url, auth } : null;
}

async function requestCode(player) {
    const settings = readSettings();
    if (!settings) {
        player.sendMessage("§c[Discord連携] 今は使えません（準備中です）。");
        return;
    }
    const request = new HttpRequest(`${settings.url}/api/link/start`);
    request.method = HttpRequestMethod.Post;
    request.timeout = 10;
    request.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", settings.auth),
    ];
    request.body = JSON.stringify({ playerId: player.id, playerName: player.name });

    let res;
    try {
        res = await http.request(request);
    } catch (e) {
        console.warn(`[discord_link] 送れませんでした: ${e}`);
        if (player.isValid) player.sendMessage("§c[Discord連携] 連携用の bot につながりませんでした。少し待ってからもう一度試してください。");
        return;
    }
    if (!player.isValid) return;
    let body = {};
    try { body = JSON.parse(res.body || "{}"); } catch { body = {}; }

    if (res.status === 429) {
        player.sendMessage(`§c[Discord連携] あと${body.retryAfterSec ?? 30}秒待ってからもう一度試してください。`);
        return;
    }
    if (res.status !== 200 || typeof body.code !== "string") {
        console.warn(`[discord_link] bot の返事が想定外です: ${res.status}`);
        player.sendMessage("§c[Discord連携] コードを出せませんでした。少し待ってからもう一度試してください。");
        return;
    }
    const minutes = Math.round((body.expiresInSec ?? 600) / 60);
    const lines = [
        `§a[Discord連携] §fコード: §e§l${body.code}§r §7（${minutes}分有効・ほかの人に教えないでください）`,
        "§fDiscord のサーバーで §b/連携§f と打ち、このコードを入れてください。",
    ];
    if (typeof body.linkedTo === "string") {
        lines.push(`§7今は Discord の「${body.linkedTo.replace(/§/g, "")}」と連携しています。新しく連携すると、前の連携は外れます。`);
    }
    player.sendMessage(lines.join("\n"));
}

server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:discord",
        description: "Discord のアカウントと連携するためのコードを出します",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: [],
    }, origin => {
        if (origin.sourceEntity?.typeId !== "minecraft:player") return;
        const player = origin.sourceEntity;
        system.run(() => {
            const now = Date.now();
            const last = lastUsedAt.get(player.id);
            if (last !== undefined && now - last < COOLDOWN_MS) {
                player.sendMessage(`§c[Discord連携] あと${Math.ceil((last + COOLDOWN_MS - now) / 1000)}秒待ってからもう一度試してください。`);
                return;
            }
            lastUsedAt.set(player.id, now);
            requestCode(player).catch(e => console.warn(`[discord_link] ${e}`));
        });
    });
});
