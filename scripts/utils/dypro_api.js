import { http, HttpRequest, HttpRequestMethod, HttpHeader } from "@minecraft/server-net";

// 新しいdypro専用サーバーのポート (3002) に設定
const SERVER_URL = "http://localhost:3002"; 
const API_TOKEN = "SECRET_MINECRAFT_TOKEN_CW";

/**
 * 外部DBにユーザーのdyproデータを一括保存
 * @param {string} userId - プレイヤーのUUIDや名前
 * @param {object} dataObject - 保存するデータ全体（JSONオブジェクト）
 */
export async function saveUserDypro(userId, dataObject) {
    const req = new HttpRequest(`${SERVER_URL}/dypro/user`);
    req.method = HttpRequestMethod.Post;
    req.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", `Bearer ${API_TOKEN}`)
    ];
    req.body = JSON.stringify({ id: userId, data: dataObject });
    
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
 * @returns {Promise<object>} - { key: value, ... } のオブジェクト
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
    return {};
}

/**
 * 外部DBに国のdyproデータを一括保存
 * @param {string} countryId - 国ID
 * @param {object} dataObject - 保存するデータ全体（JSONオブジェクト）
 */
export async function saveCountryDypro(countryId, dataObject) {
    const req = new HttpRequest(`${SERVER_URL}/dypro/country`);
    req.method = HttpRequestMethod.Post;
    req.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", `Bearer ${API_TOKEN}`)
    ];
    req.body = JSON.stringify({ id: countryId, data: dataObject });
    
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
 * @returns {Promise<object>} - { key: value, ... } のオブジェクト
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
    return {};
}

/**
 * 外部DBにマーケットのdyproデータを一括保存
 * @param {string} page - ページID（"0", "1"など）
 * @param {object} dataObject - 保存するデータ全体（JSON配列）
 */
export async function savePlayerMarketDypro(page, dataObject) {
    const req = new HttpRequest(`${SERVER_URL}/dypro/playermarket`);
    req.method = HttpRequestMethod.Post;
    req.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", `Bearer ${API_TOKEN}`)
    ];
    req.body = JSON.stringify({ id: page, data: dataObject });
    
    try {
        const res = await http.request(req);
        if (res.status !== 200) console.warn(`[Dypro API] マーケットデータの保存に失敗: ${res.status}`);
    } catch (e) {
        console.error(`[Dypro API] 通信エラー: ${e}`);
    }
}

/**
 * 外部DBからマーケットの全dyproデータを取得
 * @param {string} page - ページID
 * @returns {Promise<object>} - 配列
 */
export async function getPlayerMarketDypro(page) {
    const req = new HttpRequest(`${SERVER_URL}/dypro/playermarket/${page}`);
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
