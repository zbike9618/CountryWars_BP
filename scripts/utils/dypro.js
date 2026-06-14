import * as server from "@minecraft/server";
import { PlayerDataStore, CountryDataStore } from "./data_store.js";
const { world, system } = server;

export class Dypro {
    static instances = [];

    constructor(name, maxSize = 25) {
        this.name = name;
        this.limit = 32000; // 安全のため少し余裕を持たせる
        this.cache = new Map(); // path -> data
        this.dirtyKeys = new Set(); // path
        this.maxSize = maxSize;
        Dypro.instances.push(this);
    }

    get idList() {
        const idList = new Set();
        const prefix = `${this.name}.`;
        const oldPrefix = `${this.name}#`;

        for (const id of world.getDynamicPropertyIds()) {
            if (id.startsWith(prefix)) {
                let key = id.replace(prefix, "");
                // 分割用サフィックス（__part0, __count等）を削って元のIDを特定
                key = key.replace(/__part\d+$/, "").replace(/__count$/, "");
                idList.add(key);
            } else if (id.startsWith(oldPrefix)) {
                idList.add(id.replace(oldPrefix, ""));
            }
        }

        for (const key of this.cache.keys()) {
            idList.add(key);
        }

        return Array.from(idList);
    }

    async set(path, data) {
        const fullPath = `${this.name}.${path}`;

        // 外部APIへ保存する対象
        if (this.name === "player") {
            await PlayerDataStore.setAll(path, data);
            // IDリストのためにスタブを保存（これがないと idList で取得できなくなる）
            world.setDynamicProperty(fullPath, "{}");
            return;
        } else if (this.name === "country") {
            await CountryDataStore.setAll(path, data);
            world.setDynamicProperty(fullPath, "{}");
            return;
        }

        // 以降はLRUキャッシュ管理での保存
        if (!this.cache.has(path) && this.cache.size >= this.maxSize) {
            this.evict();
        } else if (this.cache.has(path)) {
            // LRU更新のため一旦削除
            this.cache.delete(path);
        }

        this.cache.set(path, data);
        this.dirtyKeys.add(path);
    }

    /**
     * キャッシュから同期的にデータを取得する。
     * player/country は事先に preload() でキャッシュに載せておく必要がある。
     */
    get(path) {
        // 外部API対象はキャッシュから同期取得
        if (this.name === "player") {
            return PlayerDataStore.getSync(path);
        } else if (this.name === "country") {
            return CountryDataStore.getSync(path);
        }

        // キャッシュから取得（ページヒット）
        if (this.cache.has(path)) {
            const data = this.cache.get(path);
            // LRU更新のため削除して末尾に追加
            this.cache.delete(path);
            this.cache.set(path, data);
            return data;
        }

        // キャッシュにない場合はワールドから読み込み（ページフォールト）
        const data = this._getFromWorld(path);

        if (data !== undefined) {
            if (this.cache.size >= this.maxSize) {
                this.evict();
            }
            this.cache.set(path, data);
        }

        return data;
    }

    /**
     * player/country のデータを非同期でAPIからキャッシュに読み込む。
     * ログイン時など、get()の前に必ず呼び出すこと。
     * @param {string} path player.id または country.id
     */
    async preload(path) {
        if (this.name === "player") {
            await PlayerDataStore.get(path); // 内部でAPIから取得しキャッシュに載せる
        } else if (this.name === "country") {
            await CountryDataStore.get(path);
        }
    }

    delete(path) {
        const fullPath = `${this.name}.${path}`;

        if (this.name === "player" || this.name === "country") {
            world.setDynamicProperty(fullPath, undefined);
            // 外部DBの削除ロジックが将来あればここに追加
        }

        // キャッシュから削除
        this.cache.delete(path);
        this.dirtyKeys.delete(path);

        // ワールドから完全に削除
        this._deleteFromWorld(path);
    }

    clear() {
        const data = this.idList;
        for (const id of data) {
            this.delete(id);
        }
    }

    evict() {
        if (this.cache.size === 0) return;

        // Map の最初の要素（最も古くアクセスされた要素）を取得して追い出す
        const firstKey = this.cache.keys().next().value;
        const data = this.cache.get(firstKey);

        // 変更があればワールドに保存（ライトバック）
        if (this.dirtyKeys.has(firstKey)) {
            this._saveToWorld(firstKey, data);
            this.dirtyKeys.delete(firstKey);
        }

        this.cache.delete(firstKey);
    }

    flushAll() {
        for (const path of this.dirtyKeys) {
            if (this.cache.has(path)) {
                this._saveToWorld(path, this.cache.get(path));
            }
        }
        this.dirtyKeys.clear();
    }

    _saveToWorld(path, data) {
        const fullPath = `${this.name}.${path}`;
        const json = JSON.stringify(data);

        // 既存のデータを（分割版含め）一旦全て削除してクリーンにする
        this._deleteFromWorld(path);

        if (json.length <= this.limit) {
            world.setDynamicProperty(fullPath, json);
        } else {
            // 分割保存
            const count = Math.ceil(json.length / this.limit);
            for (let i = 0; i < count; i++) {
                const chunk = json.slice(i * this.limit, (i + 1) * this.limit);
                world.setDynamicProperty(`${fullPath}__part${i}`, chunk);
            }
            world.setDynamicProperty(`${fullPath}__count`, count);
        }
    }

    _getFromWorld(path) {
        const fullPath = `${this.name}.${path}`;

        // 分割保存されているか確認
        const count = world.getDynamicProperty(`${fullPath}__count`);
        if (count !== undefined) {
            let json = "";
            for (let i = 0; i < count; i++) {
                const chunk = world.getDynamicProperty(`${fullPath}__part${i}`);
                if (chunk !== undefined) json += chunk;
            }
            try {
                return JSON.parse(json);
            } catch (e) {
                return undefined;
            }
        }

        // 通常保存（または古い形式）
        let data = world.getDynamicProperty(fullPath);
        if (data === undefined) {
            data = world.getDynamicProperty(`${this.name}#${path}`);
        }

        if (data === undefined || data === "{}") return undefined;
        try {
            return JSON.parse(data);
        } catch (e) {
            return undefined;
        }
    }

    _deleteFromWorld(path) {
        const fullPath = `${this.name}.${path}`;

        // 通常版および旧形式の削除
        world.setDynamicProperty(fullPath, undefined);
        world.setDynamicProperty(`${this.name}#${path}`, undefined);

        // 分割版の削除
        const count = world.getDynamicProperty(`${fullPath}__count`);
        if (count !== undefined) {
            for (let i = 0; i < count; i++) {
                world.setDynamicProperty(`${fullPath}__part${i}`, undefined);
            }
            world.setDynamicProperty(`${fullPath}__count`, undefined);
        }
    }
}

// 1分ごと（1200 ticks）にすべての Dypro インスタンスの変更を保存する（オートセーブ）
system.runInterval(() => {
    for (const instance of Dypro.instances) {
        instance.flushAll();
    }
}, 1200);