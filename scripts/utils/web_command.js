import { system } from "@minecraft/server";
import { webApiEnabled, webApiRequest } from "./web_api.js";
import { PlayerNameIndex } from "./playerNameIndex.js";
import { Ban } from "../plugins/admin/ban.js";
import { requestBanSync } from "../plugins/admin/ban_sync.js";

/**
 * cw-web-api のゲーム内コマンドキューを取りに行き、実行結果を報告する。
 * 設計書 00 §2.3。Web からゲーム内の状態を変える操作はすべてここを通す。
 */
const POLL_INTERVAL = 100; // 5秒

/**
 * payload の playerId / playerName から対象プレイヤーを特定する
 * @param {{ playerId?: string, playerName?: string }} payload
 * @returns {{ id: string, name: string } | null}
 */
function resolveTarget({ playerId, playerName }) {
    if (playerId) return { id: playerId, name: playerName ?? playerId };
    if (playerName) return PlayerNameIndex.resolve(playerName);
    return null;
}

/**
 * 操作種別ごとの処理（ホワイトリスト。ここに無い op は実行しない）
 * 戻り値: { ok: boolean, result: object }。result.before に変更前の値を入れると監査ログに残る。
 * 取得後に結果報告が失敗すると同じ命令が再配布されるため、各処理は2回実行されても問題ない作りにする。
 */
const handlers = {
    /** @param {{ playerId?: string, playerName?: string }} payload */
    unban(payload) {
        const target = resolveTarget(payload);
        if (!target) return { ok: false, result: { error: "player not found" } };
        const before = Ban.getAllBanEntries().find(b => b.id === target.id);
        if (!before) return { ok: true, result: { alreadyUnbanned: true } };
        Ban.unBan([target.id]);
        requestBanSync();
        return { ok: true, result: { before } };
    },
    /** @param {{ playerId?: string, playerName?: string, reason?: string, timeEnum?: string, time?: number, bannedBy?: string }} payload */
    ban(payload) {
        const target = resolveTarget(payload);
        if (!target) return { ok: false, result: { error: "player not found" } };
        const banned = Ban.banById(target.id, {
            reason: payload.reason,
            timeEnum: payload.timeEnum ?? "day",
            time: payload.time ?? 365,
            bannedBy: payload.bannedBy ?? "web"
        });
        if (!banned) return { ok: false, result: { error: "player data not found" } };
        requestBanSync();
        return { ok: true, result: { playerId: banned.id, playerName: banned.name, before: banned.before } };
    },
    // restore / country_update は 15 で実装する
};

function run(cmd) {
    const handler = handlers[cmd.op];
    if (!handler) return { ok: false, result: { error: `unsupported op: ${cmd.op}` } };
    try {
        return handler(cmd.payload);
    } catch (e) {
        return { ok: false, result: { error: String(e) } };
    }
}

if (webApiEnabled) {
    let polling = false; // 前回の取得が終わるまで次を投げない
    system.runInterval(() => {
        if (polling) return;
        polling = true;

        webApiRequest("GET", "/game/commands").then(response => {
            if (response.status !== 200) return;
            for (const cmd of JSON.parse(response.body)) {
                const outcome = run(cmd);
                console.warn(`[web_command] #${cmd.id} ${cmd.op} -> ${outcome.ok ? "done" : "failed"}`);
                webApiRequest("POST", `/game/commands/${cmd.id}/result`, outcome).catch(() => { });
            }
        }).catch(() => {
            // cw-web-api が落ちている場合などは無視して次回に再試行
        }).finally(() => {
            polling = false;
        });
    }, POLL_INTERVAL);
}
