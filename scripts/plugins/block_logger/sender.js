import { system } from "@minecraft/server";
import { http, HttpRequestMethod, HttpHeader, HttpRequest } from "@minecraft/server-net";
import config from "../../config/config.js";

// ブロックログの受け側（VM100 の data_websocket/server.js）とのやり取り。
// 記録は 1 秒ごとにまとめて送る。送れなかった分は残しておいて、間をあけて送り直す。

const BASE_URL = "http://localhost:3001";
const MAX_QUEUE = 20000; // これを超えたら古いものから捨てる（受け側が長く止まったとき）
const MAX_BATCH = 500;

const queue = [];
let sending = false;
let failCount = 0;
let retryAt = 0;
let dropped = 0;

/**
 * 記録を 1 件積む。
 * @param {{a: string, p: string, b?: string, d: string, x: number, y: number, z: number, e?: object}} ev
 *   a: 種類（Break / Place / Open / Sign / Explode / Use / Kill / Denied / Pos）、p: 名前、b: ブロックやアイテムの ID、
 *   d: ディメンション、x y z: 座標、e: 付け足し（状態・中身・差分など）
 */
export function record(ev) {
    ev.t = Date.now();
    queue.push(ev);
    if (queue.length > MAX_QUEUE) {
        const over = queue.length - MAX_QUEUE;
        queue.splice(0, over);
        dropped += over;
    }
}

function makeRequest(path, body) {
    const req = new HttpRequest(BASE_URL + path);
    req.method = HttpRequestMethod.Post;
    req.headers = [new HttpHeader("Content-Type", "application/json"), new HttpHeader("Authorization", "Bearer " + config.apiToken)];
    req.body = JSON.stringify(body);
    req.timeout = 10;
    return req;
}

/** 検索など。200 以外は例外にする */
export async function query(path, body) {
    const res = await http.request(makeRequest(path, body));
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(res.body);
}

async function flush() {
    if (sending || queue.length === 0 || system.currentTick < retryAt) return;
    sending = true;
    const batch = queue.splice(0, MAX_BATCH);
    try {
        const res = await http.request(makeRequest("/block-log/batch", { events: batch, dropped }));
        if (res.status === 200) {
            if (failCount > 0) console.warn(`[BlockLogger] 送信が戻りました（たまっている件数 ${queue.length}）`);
            failCount = 0;
            dropped = 0;
            // 爆発などでたまっているときは、次の 1 秒を待たずに続けて送る
            if (queue.length >= MAX_BATCH) system.runTimeout(() => flush(), 2);
        } else if (res.status === 400 || res.status === 413) {
            // 中身がおかしいものは送り直しても通らないので捨てる
            console.warn(`[BlockLogger] 受け側が受け付けませんでした（${res.status}）。${batch.length} 件を捨てます`);
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (e) {
        queue.unshift(...batch);
        if (queue.length > MAX_QUEUE) {
            const over = queue.length - MAX_QUEUE;
            queue.splice(0, over);
            dropped += over;
        }
        failCount++;
        // 1 秒・2 秒・4 秒…と間をあけ、最大 1 分ごと
        retryAt = system.currentTick + Math.min(20 * 2 ** Math.min(failCount - 1, 6), 1200);
        if (failCount === 1 || failCount % 10 === 0) {
            console.warn(`[BlockLogger] 送信に失敗しました（${failCount} 回目、たまっている件数 ${queue.length}）: ${e}`);
        }
    } finally {
        sending = false;
    }
}

system.runInterval(() => {
    flush();
}, 20);
