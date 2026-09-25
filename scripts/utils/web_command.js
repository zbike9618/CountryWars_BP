import { system } from "@minecraft/server";
import { http, HttpRequestMethod, HttpHeader, HttpRequest } from "@minecraft/server-net";
import { secrets } from "@minecraft/server-admin";
import { Ban } from "../plugins/admin/ban.js";

/**
 * cw-web-api（localhost:3003）のゲーム内コマンドキューを取りに行き、実行結果を報告する。
 * 設計書 00 §2.3。Web からゲーム内の状態を変える操作はすべてここを通す。
 *
 * 認証トークンはリポジトリに置かず、サーバー側の
 * config/<スクリプトモジュールのuuid>/secrets.json に "CW_WEB_API_AUTH": "Bearer <GAME_TOKEN>" として置く。
 * （SecretString は文字列連結できないため "Bearer " ごと保存する）
 */
const BASE_URL = "http://localhost:3003"; // 3002 は dypro_api.js 用
const POLL_INTERVAL = 100; // 5秒

const auth = secrets.get("CW_WEB_API_AUTH");

/**
 * 操作種別ごとの処理（ホワイトリスト。ここに無い op は実行しない）
 * 戻り値: { ok: boolean, result: object }。result.before に変更前の値を入れると監査ログに残る。
 * 取得後に結果報告が失敗すると同じ命令が再配布されるため、各処理は2回実行されても問題ない作りにする。
 */
const handlers = {
    /** @param {{ playerId?: string, playerName?: string }} payload */
    unban(payload) {
        const target = findBanned(payload);
        if (!target) return { ok: true, result: { alreadyUnbanned: true } };
        Ban.unBan([target.id]);
        return { ok: true, result: { before: target } };
    },
    // ban / restore / country_update は 04・15 で実装する（オフラインBANには ID 指定の BAN 処理が必要）
};

function findBanned({ playerId, playerName }) {
    return Ban.getBanList().find(b => (playerId && b.id === playerId) || (playerName && b.name === playerName));
}

function headers() {
    return [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", auth)
    ];
}

function run(cmd) {
    const handler = handlers[cmd.op];
    if (!handler) return { ok: false, result: { error: `unsupported op: ${cmd.op}` } };
    try {
        return handler(cmd.payload);
    } catch (e) {
        return { ok: false, result: { error: String(e) } };
    }
}

function report(id, { ok, result }) {
    const request = new HttpRequest(`${BASE_URL}/game/commands/${id}/result`);
    request.method = HttpRequestMethod.Post;
    request.headers = headers();
    request.body = JSON.stringify({ ok, result });
    http.request(request).catch(() => { });
}

if (!auth) {
    console.warn("[web_command] secrets.json に CW_WEB_API_AUTH が無いため、コマンドキューは無効です。");
} else {
    let polling = false; // 前回の取得が終わるまで次を投げない
    system.runInterval(() => {
        if (polling) return;
        polling = true;

        const request = new HttpRequest(`${BASE_URL}/game/commands`);
        request.method = HttpRequestMethod.Get;
        request.headers = headers();

        http.request(request).then(response => {
            if (response.status !== 200) return;
            for (const cmd of JSON.parse(response.body)) {
                const outcome = run(cmd);
                console.warn(`[web_command] #${cmd.id} ${cmd.op} -> ${outcome.ok ? "done" : "failed"}`);
                report(cmd.id, outcome);
            }
        }).catch(() => {
            // cw-web-api が落ちている場合などは無視して次回に再試行
        }).finally(() => {
            polling = false;
        });
    }, POLL_INTERVAL);
}
