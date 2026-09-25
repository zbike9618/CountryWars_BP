import { system } from "@minecraft/server";
import { Ban } from "./ban.js";
import { webApiEnabled, webApiRequest } from "../../utils/web_api.js";

/**
 * 期限切れBANの自動解除と、BAN一覧の cw-web-api への同期（設計書 04 T6 / T7）
 *
 * 1分ごと（BAN/解除があった場合は5秒以内）に全プレイヤーデータを走査し、
 * 期限切れを解除したうえで、一覧が前回送信から変わっていれば全件を POST /ban-sync で送る。
 */
const CHECK_INTERVAL = 100;     // 5秒
const FULL_SCAN_EVERY = 12;     // 12回に1回 = 1分

let dirty = true;
let lastSent = null;
let sending = false;
let counter = 0;

/** BAN/解除をしたら呼ぶ。次のチェックで同期する */
export function requestBanSync() {
    dirty = true;
}

system.runInterval(() => {
    counter++;
    if (!dirty && counter % FULL_SCAN_EVERY !== 0) return;
    dirty = false;

    const started = Date.now();
    // finishtime が数値でない壊れたデータも期限切れとして扱う（参加時チェックと同じ判定）
    const all = Ban.getAllBanEntries();
    const expired = all.filter(b => !(b.finishtime > started));
    const bans = all.filter(b => b.finishtime > started);
    Ban.unBan(expired.map(b => b.id));
    const elapsed = Date.now() - started;
    if (expired.length > 0) console.warn(`[ban_sync] 期限切れのBANを${expired.length}件解除しました`);
    if (elapsed > 50) console.warn(`[ban_sync] BAN一覧の走査に${elapsed}msかかりました`);

    if (!webApiEnabled || sending) return;
    const payload = JSON.stringify(bans);
    if (payload === lastSent) return;

    sending = true;
    webApiRequest("POST", "/ban-sync", { bans }).then(response => {
        if (response.status === 200) lastSent = payload;
    }).catch(() => {
        // cw-web-api が落ちている場合は次回に再送
    }).finally(() => {
        sending = false;
    });
}, CHECK_INTERVAL);
