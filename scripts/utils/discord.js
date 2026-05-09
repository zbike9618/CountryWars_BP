import * as server from "@minecraft/server";
const { world, system } = server;
import { http, HttpRequestMethod, HttpHeader, HttpRequest } from "@minecraft/server-net";
import config from "../config/config.js";

const SERVER_URL = "http://localhost:3000/mc-to-discord";
const GET_URL = "http://localhost:3000/get-messages";

console.warn("Discord Relay Module Loading...");

/**
 * サーバー起動通知
 * 起動時に一度だけNode.jsへ信号を送り、Discordに通知させます
 */
system.run(() => {
    const request = new HttpRequest(SERVER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", "Bearer " + config.apiToken)
    ];
    request.body = JSON.stringify({ type: "start" });
    http.request(request).catch(() => { });
});

/**
 * Discordからのメッセージ受信 & 死活監視(Ping)
 */
system.runInterval(() => {
    const request = new HttpRequest(GET_URL);
    request.method = HttpRequestMethod.Get;
    request.headers = [new HttpHeader("Authorization", "Bearer " + config.apiToken)];

    http.request(request).then(response => {
        if (response.status === 200) {
            const messages = JSON.parse(response.body);
            for (const msg of messages) {
                // AIの回答は青色、通常は水色などで区別
                const prefix = msg.author === "AI" ? "§b[AI]§r " : "§b[Discord] §r";
                world.sendMessage(`${prefix}${msg.author}: ${msg.content}`);
            }
        }
    }).catch(() => {
        // 接続失敗時はエラーを出さず無視（Node側が落ちている場合など）
    });
}, 20);

/**
 * 通常チャット・AI質問用
 */
export function sendChatToDiscord(text, playerName = "Server", chatType = "world") {
    // メンション防止: 半角の「@」を全角の「＠」に変更します。
    const safeText = text.replace(/@/g, "＠");

    const request = new HttpRequest(SERVER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", "Bearer " + config.apiToken)
    ];
    request.body = JSON.stringify({
        message: safeText,
        sender: playerName,
        chatType: chatType
    });
    http.request(request).catch(() => { });
}

/**
 * サーバー通知・管理者呼び出し用
 */
export function sendToDiscord(text, playerName = "Server") {
    const request = new HttpRequest(SERVER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", "Bearer " + config.apiToken)
    ];
    request.body = JSON.stringify({
        message: text,
        sender: playerName
    });
    http.request(request).catch(() => { });
}

/**
 * システム通知・翻訳用
 */
export function sendTranslatedToDiscord(key, args = []) {
    const request = new HttpRequest(SERVER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", "Bearer " + config.apiToken)
    ];
    request.body = JSON.stringify({
        key: key,
        args: args
    });
    http.request(request).catch(e => console.error("[Discord Relay] Error:", e));
}

export const DiscordRelay = {
    send: (text) => sendToDiscord(text),
    sendChat: (text, playerName, chatType) => sendChatToDiscord(text, playerName, chatType),
    sendTranslate: (key, args) => sendTranslatedToDiscord(key, args)
};
