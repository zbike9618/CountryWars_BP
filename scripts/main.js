import { world } from "@minecraft/server"
import { http, HttpRequestMethod, HttpHeader, HttpRequest } from "@minecraft/server-net";
import { system } from "@minecraft/server";
import "./commands/command"
import "./utils/playerData"
import "./utils/interval"
import "./items/items"
import "./utils/chat"
import "./utils/bank"
import "./plugin_controller"
world.afterEvents.worldLoad.subscribe(() => {
    for (const player of world.getAllPlayers()) {
        player.inputPermissions.setPermissionCategory(6, true)
    }
})
const SERVER_URL = "http://localhost:3000/mc-to-discord";
const GET_URL = "http://localhost:3000/get-messages";
// --- [追加] サーバー起動時の通知 ---
system.run(() => {
    const request = new HttpRequest(SERVER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [new HttpHeader("Content-Type", "application/json")];
    request.body = JSON.stringify({ type: "start" }); // 起動通知を送る

    http.request(request).catch(e => { });
});

// --- [既存] 1秒ごとのメッセージ取得（これがPingの代わりになります） ---
system.runInterval(() => {
    const request = new HttpRequest(GET_URL);
    request.method = HttpRequestMethod.Get;

    http.request(request).then(response => {
        // 通信に成功すればNode.js側の lastPing が更新される
        if (response.status === 200) {
            // ...メッセージ処理...
        }
    }).catch(() => { });
}, 20);