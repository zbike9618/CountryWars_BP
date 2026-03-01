import { world } from "@minecraft/server";
import { http, HttpRequestMethod, HttpHeader, HttpRequest } from "@minecraft/server-net";

const LOGGER_URL = "http://localhost:3001/block-break";

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const player = event.player;
    const block = event.block;

    // ブロック破壊情報を送信
    const request = new HttpRequest(LOGGER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [new HttpHeader("Content-Type", "application/json")];

    request.body = JSON.stringify({
        playerName: player.name,
        blockName: block.typeId,
        x: block.x,
        y: block.y,
        z: block.z
    });

    http.request(request).catch(() => {
        // エラーハンドリング（コンソールに出すと重くなる可能性があるので無視するか最小限に）
        console.warn(`[BlockLogger] サーバーへの送信に失敗しました`);
    });
});
