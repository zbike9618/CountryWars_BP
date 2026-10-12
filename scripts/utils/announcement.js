import * as server from "@minecraft/server";
const { world, system } = server;
import { Dypro } from "./dypro";

/*
 * 運営からの全体アナウンス
 * 以前はオフラインのプレイヤー全員のキュー(sendDataQueue)に1件ずつ積んでいたため、
 * アナウンス1回でワールドの dynamic property が約0.5MB増え、TPS低下の原因になっていた。
 * 今はアナウンス本体をワールドに1か所だけ保存し、既読・削除はプレイヤー側
 * （プレイヤーエンティティの dynamic property）で持つ。
 */
const announcementDypro = new Dypro("announcement");
const LIST_PATH = "list";
const MAX_ITEMS = 20; // 保存しておく件数
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30日より古いものは表示しない
const SEEN_KEY = "cw:announcementSeen"; // 通知済みの最大ID
const HIDDEN_KEY = "cw:announcementHidden"; // メッセージボックスから削除したIDの配列(JSON)

function load() {
    const data = announcementDypro.get(LIST_PATH) || { nextId: 1, items: [] };
    const cutoff = Date.now() - MAX_AGE_MS;
    data.items = data.items.filter(item => item.date >= cutoff).slice(-MAX_ITEMS);
    return data;
}

function getHiddenIds(player) {
    try {
        return JSON.parse(player.getDynamicProperty(HIDDEN_KEY) ?? "[]");
    } catch (e) {
        return [];
    }
}

export class Announcement {
    /**
     * アナウンスを保存する
     * @param {string} message
     * @param {string} senderName
     */
    static add(message, senderName) {
        const data = load();
        const item = { id: data.nextId, message, senderName, date: Date.now() };
        data.nextId++;
        data.items.push(item);
        data.items = data.items.slice(-MAX_ITEMS);
        announcementDypro.set(LIST_PATH, data);
        return item;
    }

    /**
     * プレイヤーが削除していないアナウンス（新しい順）
     * @param {server.Player} player
     */
    static listFor(player) {
        const hidden = new Set(getHiddenIds(player));
        return load().items.filter(item => !hidden.has(item.id)).reverse();
    }

    /**
     * メッセージボックスから削除する（このプレイヤーにだけ表示しなくなる）
     * @param {server.Player} player
     * @param {number} id
     */
    static hide(player, id) {
        const existingIds = new Set(load().items.map(item => item.id));
        // もう保存されていないアナウンスのIDは持ち続けない
        const hidden = getHiddenIds(player).filter(hiddenId => existingIds.has(hiddenId));
        if (!hidden.includes(id)) hidden.push(id);
        player.setDynamicProperty(HIDDEN_KEY, JSON.stringify(hidden));
    }

    /**
     * @param {server.Player} player
     * @param {number} id
     */
    static markSeen(player, id) {
        player.setDynamicProperty(SEEN_KEY, id);
    }

    /**
     * 日本時間の "M/D HH:mm"
     * @param {number} ms
     */
    static formatDate(ms) {
        const date = new Date(ms + 9 * 60 * 60 * 1000);
        const hh = String(date.getUTCHours()).padStart(2, "0");
        const mm = String(date.getUTCMinutes()).padStart(2, "0");
        return `${date.getUTCMonth() + 1}/${date.getUTCDate()} ${hh}:${mm}`;
    }
}

// 参加時に、まだ通知していないアナウンスがあれば知らせる
world.afterEvents.playerSpawn.subscribe(ev => {
    if (!ev.initialSpawn) return;
    const player = ev.player;
    system.runTimeout(() => {
        if (!player.isValid) return;
        const seen = player.getDynamicProperty(SEEN_KEY) ?? 0;
        const unseen = Announcement.listFor(player).filter(item => item.id > seen);
        if (unseen.length === 0) return;
        player.sendMessage(`§e[お知らせ] §f運営からのアナウンスが${unseen.length}件届いています §7(/mb で確認できます)`);
        Announcement.markSeen(player, unseen[0].id);
    }, 40);
});
