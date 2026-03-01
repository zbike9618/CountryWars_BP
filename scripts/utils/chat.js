import * as server from "@minecraft/server";
const { world, system } = server;
//import { http, HttpRequestMethod, HttpHeader, HttpRequest } from "@minecraft/server-net";
import { Dypro } from "./dypro.js";
import config from "../config/config.js";

const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
const SERVER_URL = "http://localhost:3000/mc-to-discord";
const GET_URL = "http://localhost:3000/get-messages";

console.warn("CountryWars Script Loading...");

/**
 * サーバー起動通知
 * 起動時に一度だけNode.jsへ信号を送り、Discordに通知させます
 */
system.run(() => {
    const request = new HttpRequest(SERVER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [new HttpHeader("Content-Type", "application/json")];
    request.body = JSON.stringify({ type: "start" });
    http.request(request).catch(() => { });
});

/**
 * Discordからのメッセージ受信 & 死活監視(Ping)
 */
system.runInterval(() => {
    const request = new HttpRequest(GET_URL);
    request.method = HttpRequestMethod.Get;

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
function sendToDiscord(text, playerName = "Server") {
    const request = new HttpRequest(SERVER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [new HttpHeader("Content-Type", "application/json")];
    request.body = JSON.stringify({
        message: text,
        sender: playerName
    });
    http.request(request).catch(() => { });
}

/**
 * システム通知・翻訳用
 */
function sendTranslatedToDiscord(key, args = []) {
    const request = new HttpRequest(SERVER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [new HttpHeader("Content-Type", "application/json")];
    request.body = JSON.stringify({
        key: key,
        args: args
    });
    http.request(request).catch(e => console.error("[Discord Relay] Error:", e));
}

export const DiscordRelay = {
    send: (text) => sendToDiscord(text),
    sendTranslate: (key, args) => sendTranslatedToDiscord(key, args)
};

/**
 * チャット処理
 */
world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    const message = ev.message;
    const playerData = playerDatas.get(player.id);
    const countryname = countryDatas.get(playerData.country)?.name || "§7未所属";

    // --- AI質問の検知 ---
    if (message.startsWith("!ai ")) {
        sendToDiscord(message, player.name);
        // AIへの質問時は通常のチャットリレーは行わず終了
    }

    ev.cancel = true;

    let chatTypeSymbol = "";
    switch (playerData.chattype) {
        case "world": chatTypeSymbol = "§aW"; break;
        case "country": chatTypeSymbol = "§eC"; break;
        case "local": chatTypeSymbol = "§cL"; break;
    }

    const secondname = playerData.secondname;
    const send = `[${chatTypeSymbol}§r][${secondname.before[secondname.now[0]]}§r${secondname.after[secondname.now[1]]}§r/${countryname}§r] <${player.name}> ${message}`;

    switch (playerData.chattype) {
        case "world":
            world.sendMessage(send);
            if (!message.startsWith("!ai ")) sendToDiscord(send, player.name);
            break;
        case "country":
            for (const pc of world.getAllPlayers().filter(p => playerDatas.get(p.id).country == playerData.country)) {
                pc.sendMessage(send);
            }
            break;
        case "local":
            for (const pc of world.getPlayers({ location: player.location, maxDistance: config.localChatDistance })) {
                pc.sendMessage(send);
            }
            break;
    }
});

/**
 * その他（参加退出・タイプ変更）
 */
export function ChangeChatType(player, type) {
    const playerData = playerDatas.get(player.id);
    if (playerData.chattype == type) {
        player.sendMessage({ translate: "cw.chattype.already", with: [type] });
        player.playSound("note.bass");
        return;
    }
    playerData.chattype = type;
    playerDatas.set(player.id, playerData);
    player.sendMessage({ translate: "cw.chattype.changed", with: [type] });
    player.playSound("random.orb");
}

const lastSpawnNotice = new Map();

world.afterEvents.playerSpawn.subscribe((ev) => {
    const { player, initialSpawn } = ev;
    if (!initialSpawn) return;
    const now = Date.now();
    const lastTime = lastSpawnNotice.get(player.id) || 0;
    if (now - lastTime > 3000) {
        lastSpawnNotice.set(player.id, now);
        const playerCount = world.getAllPlayers().length;
        const msg = `[§aW§r] ${player.name} が参加しました (§f${playerCount}§7人)`;
        world.sendMessage(msg);
        sendToDiscord(msg);
    }
});

world.beforeEvents.playerLeave.subscribe((ev) => {
    const { player } = ev;
    lastSpawnNotice.delete(player.id);
    const playerCount = world.getAllPlayers().length - 1;
    const msg = `[§aW§r] ${player.name} が退出しました (§f${playerCount}§7人)`;
    world.sendMessage(msg);
    sendToDiscord(msg);
});