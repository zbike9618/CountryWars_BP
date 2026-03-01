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



const COMMANDS_URL = "http://localhost:3000/get-commands";

// --- コマンドリクエストの取得（1秒ごと） ---
system.runInterval(() => {
    const request = new HttpRequest(COMMANDS_URL);
    request.method = HttpRequestMethod.Get;

    http.request(request).then(async response => {
        if (response.status === 200) {
            const commands = JSON.parse(response.body);
            for (const cmd of commands) {
                if (cmd.type === "tps") {
                    try {
                        const resReq = new HttpRequest(SERVER_URL);
                        resReq.method = HttpRequestMethod.Post;
                        resReq.headers = [new HttpHeader("Content-Type", "application/json")];
                        resReq.body = JSON.stringify({
                            type: "tps_result",
                            interactionId: cmd.interactionId,
                            tpsResult: `現在のTPS: ${currentTps} / 20.0`
                        });
                        http.request(resReq).catch(() => { });
                    } catch (e) {
                        const resReq = new HttpRequest(SERVER_URL);
                        resReq.method = HttpRequestMethod.Post;
                        resReq.headers = [new HttpHeader("Content-Type", "application/json")];
                        resReq.body = JSON.stringify({
                            type: "tps_result",
                            interactionId: cmd.interactionId,
                            tpsResult: "エラーが発生しました: " + e
                        });
                        http.request(resReq).catch(() => { });
                    }
                }
            }
        }
    }).catch(() => { });
}, 20);

system.runInterval(() => {
    // 全プレイヤーの名前を取得
    const currentPlayers = world.getAllPlayers().map(p => p.name);

    const request = new HttpRequest(SERVER_URL); // SERVER_URLへPOST
    request.method = HttpRequestMethod.Post;
    request.headers = [new HttpHeader("Content-Type", "application/json")];
    request.body = JSON.stringify({
        type: "ping",
        players: currentPlayers // ここで名前リストを送る
    });

    http.request(request).catch(() => { });
}, 100);