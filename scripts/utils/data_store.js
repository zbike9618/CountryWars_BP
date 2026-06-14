import { saveUserDypro, getUserDypro, saveCountryDypro, getCountryDypro } from "./dypro_api.js";

/**
 * LRUキャッシュを用いたデータマネージャー（ページング方式）
 * メモリにデータを保持し、最大保持数（ページ数）を超えたら最も古くアクセスされた
 * データをAPI（外部DB）へ保存（ページアウト）してメモリを解放します。
 */
class LRUDataManager {
    /**
     * @param {number} maxSize キャッシュ（メモリ）に保持できる最大数
     * @param {"user"|"country"} type データの種類
     */
    constructor(maxSize, type) {
        this.maxSize = maxSize;
        this.type = type;
        this.cache = new Map(); // id -> data object (Mapは挿入順を保持するためLRUに最適)
        this.dirtyKeys = new Map(); // id -> Set of dirty keys (変更があったキー)
    }

    async _fetch(id) {
        let dyproData;
        if (this.type === "user") {
            dyproData = await getUserDypro(id);
        } else {
            dyproData = await getCountryDypro(id);
        }

        // 新しいAPI仕様ではオブジェクト全体が返ってくる
        return dyproData || {};
    }

    async _save(id, dataObject) {
        if (this.type === "user") {
            await saveUserDypro(id, dataObject);
        } else {
            await saveCountryDypro(id, dataObject);
        }
    }

    /**
     * データを丸ごと取得する（ページイン）。キャッシュに無ければAPIからロードする。
     * @param {string} id ユーザーIDまたは国ID
     */
    async get(id) {
        if (this.cache.has(id)) {
            // アクセスされたのでLRU更新 (削除して再挿入で末尾に移動)
            const data = this.cache.get(id);
            this.cache.delete(id);
            this.cache.set(id, data);
            return data;
        }

        // キャッシュに無い場合は取得（ページフォールト）
        const data = await this._fetch(id);

        // キャッシュサイズ超過時は最も古いデータを追い出す（ページアウト）
        if (this.cache.size >= this.maxSize) {
            await this.evict();
        }

        this.cache.set(id, data);
        return data;
    }

    /**
     * キャッシュから同期的にデータを取得する。
     * キャッシュミス時は undefined を返す（APIへの問い合わせは行わない）。
     * Dypro.get() から呼ばれる。事前に preload() でキャッシュに載せておくこと。
     * @param {string} id ユーザーIDまたは国ID
     */
    getSync(id) {
        if (this.cache.has(id)) {
            const data = this.cache.get(id);
            // LRU更新
            this.cache.delete(id);
            this.cache.set(id, data);
            return data;
        }
        return undefined; // キャッシュミス
    }

    /**
     * オブジェクト全体をセット（または上書き）する。
     */
    async setAll(id, data) {
        if (!this.cache.has(id)) {
            if (this.cache.size >= this.maxSize) {
                await this.evict();
            }
        } else {
            this.cache.delete(id);
        }
        
        this.cache.set(id, data);

        if (!this.dirtyKeys.has(id)) {
            this.dirtyKeys.set(id, new Set());
        }
        // 全てのキーをdirtyとしてマーク
        for (const key of Object.keys(data)) {
            this.dirtyKeys.get(id).add(key);
        }
    }

    /**
     * 特定のプロパティを取得する。
     */
    async getProperty(id, key) {
        const data = await this.get(id);
        return data[key];
    }

    /**
     * 特定のプロパティを設定する。キャッシュを更新し、dirtyとしてマークする。
     * （実際のAPIへの保存は追い出し時か、明示的なflush時に行われるため高速）
     */
    async setProperty(id, key, value) {
        const data = await this.get(id); // キャッシュに載せる
        
        data[key] = value;

        if (!this.dirtyKeys.has(id)) {
            this.dirtyKeys.set(id, new Set());
        }
        this.dirtyKeys.get(id).add(key);
    }

    /**
     * 最も古くアクセスされたデータを追い出し、変更があればAPIへ保存する（ページアウト）。
     */
    async evict() {
        if (this.cache.size === 0) return;
        
        // Mapの最初の要素（最も古くアクセスされた要素）を取得
        const firstId = this.cache.keys().next().value;
        const data = this.cache.get(firstId);
        
        // 変更があれば保存（ライトバック）
        if (this.dirtyKeys.has(firstId)) {
            await this._save(firstId, data);
            this.dirtyKeys.delete(firstId);
        }
        
        this.cache.delete(firstId);
    }

    /**
     * 特定のIDの変更をAPIへ明示的に保存する。
     */
    async flush(id) {
        if (this.dirtyKeys.has(id) && this.cache.has(id)) {
            const data = this.cache.get(id);
            await this._save(id, data);
            this.dirtyKeys.delete(id);
        }
    }

    /**
     * 全ての変更をAPIへ明示的に保存する。（サーバー終了時・定期保存用）
     */
    async flushAll() {
        for (const id of this.dirtyKeys.keys()) {
            await this.flush(id);
        }
    }
}

// PlayerData はオンライン人数を考慮して多めにキャッシュ（例: 50人分）
export const PlayerDataStore = new LRUDataManager(50, "user");

// CountryData はアクティブな国数を考慮してキャッシュ（例: 20国分）
export const CountryDataStore = new LRUDataManager(20, "country");
