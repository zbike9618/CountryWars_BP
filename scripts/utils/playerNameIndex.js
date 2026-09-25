import { world } from "@minecraft/server";
import { Dypro } from "./dypro.js";

const playerDatas = new Dypro("player");
// { name: 最新の表示名, id } を小文字の名前をキーに保存する
const nameIndex = new Dypro("playerNameIndex");

/**
 * プレイヤー名 → プレイヤーID の解決（オフラインのプレイヤーも対象）
 *
 * playerData.name は初参加時の名前のまま更新されないため、参加のたびに最新の名前を索引に登録する。
 * 索引に無い名前（導入前から参加していない人）は playerData.name を走査して探す。
 */
export class PlayerNameIndex {
    /**
     * @param {string} id
     * @param {string} name
     */
    static upsert(id, name) {
        const key = name.toLowerCase();
        if (nameIndex.get(key)?.id === id) return;
        nameIndex.set(key, { name, id });
    }

    /**
     * 名前が完全一致（大文字小文字は区別しない）するプレイヤー
     * @param {string} name
     * @returns {{ id: string, name: string } | null}
     */
    static resolve(name) {
        const key = name.toLowerCase();
        const indexed = nameIndex.get(key);
        if (indexed) return indexed;
        return PlayerNameIndex.scanPlayerData(n => n.toLowerCase() === key)[0] ?? null;
    }

    /**
     * 名前の部分一致検索（オンラインのプレイヤーを先頭にする）
     * @param {string} query
     * @param {number} limit
     * @returns {{ id: string, name: string, online: boolean }[]}
     */
    static search(query, limit = 20) {
        const q = query.toLowerCase();
        const found = new Map();
        for (const key of nameIndex.idList) {
            if (!key.includes(q)) continue;
            const entry = nameIndex.get(key);
            if (entry) found.set(entry.id, entry.name);
        }
        for (const entry of PlayerNameIndex.scanPlayerData(n => n.toLowerCase().includes(q))) {
            if (!found.has(entry.id)) found.set(entry.id, entry.name);
        }
        const onlineIds = new Set(world.getAllPlayers().map(p => p.id));
        return [...found]
            .map(([id, name]) => ({ id, name, online: onlineIds.has(id) }))
            .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
            .slice(0, limit);
    }

    /**
     * @param {(name: string) => boolean} predicate
     * @returns {{ id: string, name: string }[]}
     */
    static scanPlayerData(predicate) {
        const result = [];
        for (const id of playerDatas.idList) {
            const name = playerDatas.get(id)?.name;
            if (typeof name === "string" && predicate(name)) result.push({ id, name });
        }
        return result;
    }
}

world.afterEvents.playerSpawn.subscribe(ev => {
    if (!ev.initialSpawn) return;
    PlayerNameIndex.upsert(ev.player.id, ev.player.name);
});
