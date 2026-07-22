import {
    saveUserDypro, getUserDypro, deleteUserDypro,
    saveCountryDypro, getCountryDypro, deleteCountryDypro,
    savePlayerMarketDypro, getPlayerMarketDypro, deletePlayerMarketDypro
} from "./dypro_api.js";

/**
 * LRUキャッシュを用いたデータマネージャー（ページング方式）
 * メモリにデータを保持し、最大保持数（ページ数）を超えたら最も古くアクセスされた
 * データをAPI（外部DB）へ保存（ページアウト）してメモリを解放します。
 *
 * APIの仕様（server.js の3テーブルすべてで統一されている一括形式）:
 *   GET    -> { key: value, ... } （データ全体のオブジェクト）
 *   POST   -> { id, data }        （id単位で全体を上書き保存）
 *   DELETE -> id単位で行ごと削除
 *
 * ※ POSTがid単位の全体上書きのため、dirtyはキー単位ではなくid単位で管理する。
 */
class LRUDataManager {
    /**
     * @param {number} maxSize キャッシュ（メモリ）に保持できる最大数
     * @param {"user"|"country"|"playermarket"} type データの種類
     */
    constructor(maxSize, type) {
        this.maxSize = maxSize;
        this.type = type;
        this.cache = new Map();     // id -> data object (Mapは挿入順を保持するためLRUに最適)
        this.dirtyIds = new Set();  // 変更があったid
    }

    /**
     * APIからデータ全体を取得する。
     * user/countryは想定外の型（配列・null等）が返った場合は空オブジェクトとして扱う。
     * playermarketは1ページ分の出品リストが配列で保存される仕様のため、
     * オブジェクト向けの型チェック（Array.isArrayを弾く）を適用してはいけない
     * （適用すると出品リストが常に{}へ潰れ、marketData.push(...)がTypeErrorになる）。
     */
    async _fetch(id) {
        let data;
        if (this.type === "user") {
            data = await getUserDypro(id);
        } else if (this.type === "country") {
            data = await getCountryDypro(id);
        } else {
            data = await getPlayerMarketDypro(id);
        }

        if (this.type === "playermarket") {
            return Array.isArray(data) ? data : [];
        }

        if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
        return data;
    }

    /**
     * データ全体をid単位で一括保存する（APIが全体上書きのため部分保存はしない）。
     * @param {string} id
     * @param {object} dataObject
     */
    async _save(id, dataObject) {
        if (this.type === "user") {
            await saveUserDypro(id, dataObject);
        } else if (this.type === "country") {
            await saveCountryDypro(id, dataObject);
        } else {
            await savePlayerMarketDypro(id, dataObject);
        }
    }

    /**
     * 外部DBからid単位で削除する。
     * @param {string} id
     */
    async _delete(id) {
        if (this.type === "user") {
            await deleteUserDypro(id);
        } else if (this.type === "country") {
            await deleteCountryDypro(id);
        } else {
            await deletePlayerMarketDypro(id);
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
        this.dirtyIds.add(id);
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

        this.dirtyIds.add(id);
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
        if (this.dirtyIds.has(firstId)) {
            await this._save(firstId, data);
            this.dirtyIds.delete(firstId);
        }

        this.cache.delete(firstId);
    }

    /**
     * 特定のIDの変更をAPIへ明示的に保存する。
     */
    async flush(id) {
        if (this.dirtyIds.has(id) && this.cache.has(id)) {
            await this._save(id, this.cache.get(id));
            this.dirtyIds.delete(id);
        }
    }

    /**
     * 全ての変更をAPIへ明示的に保存する。（サーバー終了時・定期保存用）
     */
    async flushAll() {
        for (const id of [...this.dirtyIds]) {
            await this.flush(id);
        }
    }

    /**
     * キャッシュ内の全てのデータを、変更の有無に関わらず強制的にAPIへ保存する。
     */
    async forceSaveAll() {
        for (const [id, data] of this.cache.entries()) {
            await this._save(id, data);
        }
        this.dirtyIds.clear();
    }

    /**
     * キャッシュと外部DBの両方からデータを削除する。
     */
    async remove(id) {
        this.cache.delete(id);
        this.dirtyIds.delete(id);
        await this._delete(id);
    }
}

// PlayerData はオンライン人数を考慮して多めにキャッシュ（例: 30人分）
export const PlayerDataStore = new LRUDataManager(30, "user");

// CountryData はアクティブな国数を考慮してキャッシュ（例: 20国分）
export const CountryDataStore = new LRUDataManager(20, "country");

// PlayerMarketData はアクティブなマーケットページ数を考慮してキャッシュ（例: 20ページ分）
export const PlayerMarketDataStore = new LRUDataManager(20, "playermarket");
