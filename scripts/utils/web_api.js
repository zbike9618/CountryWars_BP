import { http, HttpRequestMethod, HttpHeader, HttpRequest } from "@minecraft/server-net";
import { secrets } from "@minecraft/server-admin";

/**
 * cw-web-api（localhost:3003）への通信の共通部分。
 *
 * 認証トークンはリポジトリに置かず、サーバー側の
 * config/<スクリプトモジュールのuuid>/secrets.json に "CW_WEB_API_AUTH": "Bearer <GAME_TOKEN>" として置く。
 * （SecretString は文字列連結できないため "Bearer " ごと保存する。
 *   config/<uuid>/ を作るときは permissions.json も同じ場所に置かないと BP が読み込まれない）
 */
const BASE_URL = "http://localhost:3003"; // 3002 は dypro_api.js 用

const auth = secrets.get("CW_WEB_API_AUTH");

export const webApiEnabled = auth !== undefined;
if (!webApiEnabled) {
    console.warn("[web_api] secrets.json に CW_WEB_API_AUTH が無いため、cw-web-api 連携は無効です。");
}

/**
 * @param {"GET" | "POST"} method
 * @param {string} path
 * @param {any} [body]
 * @returns {Promise<import("@minecraft/server-net").HttpResponse>}
 */
export function webApiRequest(method, path, body) {
    const request = new HttpRequest(BASE_URL + path);
    request.method = method === "POST" ? HttpRequestMethod.Post : HttpRequestMethod.Get;
    request.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", auth)
    ];
    if (body !== undefined) request.body = JSON.stringify(body);
    return http.request(request);
}
