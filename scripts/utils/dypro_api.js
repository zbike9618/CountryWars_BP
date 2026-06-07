import { http, HttpRequest, HttpRequestMethod, HttpHeader } from "@minecraft/server-net";

// 新しいdypro専用サーバーのポート (3002) に設定
const SERVER_URL = "http://localhost:3002"; 
const API_TOKEN = "SECRET_MINECRAFT_TOKEN_CW";

/**
 * 外部DBにユーザーのdyproデータを保存
 * @param {string} userId - プレイヤーのUUIDや名前
 * @param {string} key - プロパティのキー名
 * @param {any} value - 保存する値
 */
export async function saveUserDypro(userId, key, value) {
    const req = new HttpRequest(`${SERVER_URL}/dypro/user`);
    req.method = HttpRequestMethod.Post;
    req.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", `Bearer ${API_TOKEN}`)
    ];
    req.body = JSON.stringify({ id: userId, key: key, value: value });
    
    try {
        const res = await http.request(req);
        if (res.status !== 200) console.warn(`[Dypro API] ユーザーデータの保存に失敗: ${res.status}`);
    } catch (e) {
        console.error(`[Dypro API] 通信エラー: ${e}`);
    }
}

/**
 * 外部DBからユーザーの全dyproデータを取得
 * @param {string} userId - プレイヤーのUUIDや名前
 * @returns {Promise<Array<{key: string, value: string}>>} - {key, value} の配列
 */
export async function getUserDypro(userId) {
    const req = new HttpRequest(`${SERVER_URL}/dypro/user/${userId}`);
    req.method = HttpRequestMethod.Get;
    req.headers = [
        new HttpHeader("Authorization", `Bearer ${API_TOKEN}`)
    ];
    
    try {
        const res = await http.request(req);
        if (res.status === 200) {
            return JSON.parse(res.body); 
        }
    } catch (e) {
        console.error(`[Dypro API] 通信エラー: ${e}`);
    }
    return [];
}

/**
 * 外部DBに国のdyproデータを保存
 * @param {string} countryId - 国ID
 * @param {string} key - プロパティのキー名
 * @param {any} value - 保存する値
 */
export async function saveCountryDypro(countryId, key, value) {
    const req = new HttpRequest(`${SERVER_URL}/dypro/country`);
    req.method = HttpRequestMethod.Post;
    req.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", `Bearer ${API_TOKEN}`)
    ];
    req.body = JSON.stringify({ id: countryId, key: key, value: value });
    
    try {
        const res = await http.request(req);
        if (res.status !== 200) console.warn(`[Dypro API] 国データの保存に失敗: ${res.status}`);
    } catch (e) {
        console.error(`[Dypro API] 通信エラー: ${e}`);
    }
}

/**
 * 外部DBから国の全dyproデータを取得
 * @param {string} countryId - 国ID
 * @returns {Promise<Array<{key: string, value: string}>>} - {key, value} の配列
 */
export async function getCountryDypro(countryId) {
    const req = new HttpRequest(`${SERVER_URL}/dypro/country/${countryId}`);
    req.method = HttpRequestMethod.Get;
    req.headers = [
        new HttpHeader("Authorization", `Bearer ${API_TOKEN}`)
    ];
    
    try {
        const res = await http.request(req);
        if (res.status === 200) {
            return JSON.parse(res.body);
        }
    } catch (e) {
        console.error(`[Dypro API] 通信エラー: ${e}`);
    }
    return [];
}
