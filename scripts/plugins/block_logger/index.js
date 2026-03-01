import { world } from "@minecraft/server";
import { http, HttpRequestMethod, HttpHeader, HttpRequest } from "@minecraft/server-net";

const LOGGER_URL = "http://localhost:3001/block-log";

// サーバーへ情報を送る共有関数
function sendLog(action, player, block, blockType) {
    const request = new HttpRequest(LOGGER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [new HttpHeader("Content-Type", "application/json")];

    request.body = JSON.stringify({
        action: action, // "Break" もしくは "Place"
        playerName: player.name,
        blockName: blockType,
        x: block.x,
        y: block.y,
        z: block.z
    });

    http.request(request).catch(() => {
        // エラーハンドリング（コンソールに出すと重くなる可能性があるので無視するか最小限に）
        // console.warn(`[BlockLogger] サーバーへの送信に失敗しました`);
    });
}

// 破壊する直前のイベント（ブロックがAIRになる前の情報を取得）
world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const player = event.player;
    const block = event.block;
    sendLog("Break", player, block, block.typeId);
});

// 設置した後のイベント
world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const player = event.player;
    const block = event.block;
    sendLog("Place", player, block, block.typeId);
});
