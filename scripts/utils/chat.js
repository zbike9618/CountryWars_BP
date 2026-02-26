import * as server from "@minecraft/server";
const { world, system } = server;
import { Dypro } from "./dypro.js";
import config from "../config/config.js";

// server-netモジュールを安全に読み込む（なければnull）
let httpModule = null;
try {
    httpModule = require("@minecraft/server-net");
} catch (e) {
    // 警告はmain.jsで出しているのでここでは静かにする
}

const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
const SERVER_URL = "http://localhost:3000/mc-to-discord";
const GET_URL = "http://localhost:3000/get-messages";

console.warn("CountryWars Script Loading...");

// --- Discordからのメッセージ受信（ポーリング） ---
system.runInterval(() => {
    if (!httpModule) return; // ネットワークモジュールがなければ無視して終了

    try {
        const { http, HttpRequestMethod, HttpRequest } = httpModule;
        const request = new HttpRequest(GET_URL);
        request.method = HttpRequestMethod.GET;

        http.request(request).then(response => {
            if (response.status === 200) {
                try {
                    const messages = JSON.parse(response.body);
                    for (const msg of messages) {
                        world.sendMessage(`§b[Discord] §r${msg.author}: ${msg.content}`);
                    }
                } catch (e) { }
            }
        }).catch(() => { });
    } catch (e) { }
}, 20);

/**
 * 汎用的な送信関数（通常のチャット用）
 */
function sendToDiscord(text) {
    if (!httpModule) return;
    try {
        const { http, HttpRequestMethod, HttpHeader, HttpRequest } = httpModule;
        const request = new HttpRequest(SERVER_URL);
        request.method = HttpRequestMethod.POST;
        request.headers = [new HttpHeader("Content-Type", "application/json")];
        request.body = JSON.stringify({ message: text });
        http.request(request).catch(() => { });
    } catch (e) { }
}

/**
 * 翻訳通知用の送信関数（重複を削除して一本化）
 */
function sendTranslatedToDiscord(key, args = []) {
    if (!httpModule) return;
    try {
        const { http, HttpRequestMethod, HttpHeader, HttpRequest } = httpModule;
        const request = new HttpRequest(SERVER_URL);
        request.method = HttpRequestMethod.POST;
        request.headers = [new HttpHeader("Content-Type", "application/json")];

        // Node.js側の .lang 翻訳機能を利用するために key と args を分離して送信
        request.body = JSON.stringify({
            key: key,
            args: args
        });

        http.request(request).catch(() => { });
    } catch (e) { }
}

// 📌 外部リレー用オブジェクトの公開
export const DiscordRelay = {
    send: (text) => sendToDiscord(text),
    sendTranslate: (key, args) => sendTranslatedToDiscord(key, args)
};

// --- 以下、チャット・参加退出処理は既存のまま ---
// (コードが長くなるため省略しますが、sendToDiscord(send) を呼んでいる箇所はそのままで大丈夫です)

// --- チャット処理 ---
world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    const message = ev.message;
    const playerData = playerDatas.get(player.id);
    const countryname = countryDatas.get(playerData.country)?.name || "§7未所属";

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
            sendToDiscord(send);
            break;
        case "country":
            for (const pc of world.getAllPlayers().filter(p => playerDatas.get(p.id).country == playerData.country)) {
                pc.sendMessage(send);
            }
            break;
        case "local":
            for (const pc of player.dimension.getPlayers({ location: player.location, maxDistance: config.localChatDistance })) {
                pc.sendMessage(send);
            }
            break;
    }
});

/**
 * チャットタイプを変更する関数
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

// --- 参加・退出通知 ---
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