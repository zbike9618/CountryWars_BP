import { ItemStack, EntityComponentTypes } from "@minecraft/server";
import { ModalFormData, ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { Dypro } from "./dypro";
import { Util } from "./util";

// ============================================================
// SerialCode — シリアルコードシステム
//
// データ構造 (Dypro key: "serial.<code>"):
// {
//   code:      string,          // コード文字列
//   rewards: [
//     { type: "item",  typeId: "minecraft:diamond", amount: 1 },
//     { type: "money", amount: 500 }
//   ],
//   maxUses:   number,   // 最大使用回数 (0 = 無制限)
//   usedBy:    string[], // 使用済みプレイヤーID
//   useCount:  number,   // 使用回数合計
//   expiresAt: number,   // 有効期限 Unix ms (0 = 無期限)
//   createdAt: number    // 作成日時 Unix ms
// }
//
// 将来 Database へ移行する場合は、_db の get/set/delete/idList を
// DatabaseAdapter に差し替えるだけで対応できます。
// ============================================================

/** @type {Dypro} */
const _db = new Dypro("serial");

export class SerialCode {

    // ----------------------------------------------------------
    // CRUD
    // ----------------------------------------------------------

    /**
     * シリアルコードを作成して保存する
     * @param {string} code - コード文字列
     * @param {Array<{type:"item"|"money", typeId?:string, amount:number}>} rewards - 報酬リスト
     * @param {{ maxUses?: number, expiresAt?: number }} [options]
     * @returns {{ success: boolean, message: string }}
     */
    static create(code, rewards, options = {}) {
        code = code.trim().toUpperCase();
        if (!code) return { success: false, message: "コードが空です。" };
        if (_db.get(code)) return { success: false, message: `コード "${code}" は既に存在します。` };

        const data = {
            code,
            rewards,
            maxUses: options.maxUses ?? 1,
            usedBy: [],
            useCount: 0,
            expiresAt: options.expiresAt ?? 0,
            createdAt: Date.now(),
        };
        _db.set(code, data);
        return { success: true, message: `コード "${code}" を作成しました。` };
    }

    /**
     * コードデータを取得する
     * @param {string} code
     * @returns {object|undefined}
     */
    static get(code) {
        return _db.get(code.trim().toUpperCase());
    }

    /**
     * コードを削除する
     * @param {string} code
     */
    static delete(code) {
        _db.delete(code.trim().toUpperCase());
    }

    /**
     * 全コード一覧を返す
     * @returns {Array<object>}
     */
    static list() {
        return _db.idList.map(id => _db.get(id)).filter(Boolean);
    }

    // ----------------------------------------------------------
    // 使用（Redeem）
    // ----------------------------------------------------------

    /**
     * プレイヤーがシリアルコードを使用する
     * @param {import("@minecraft/server").Player} player
     * @param {string} code
     * @returns {{ success: boolean, message: string }}
     */
    static redeem(player, code) {
        code = code.trim().toUpperCase();
        const data = _db.get(code);

        if (!data) {
            return { success: false, message: "無効なコードです。" };
        }

        // 有効期限チェック
        if (data.expiresAt > 0 && Date.now() > data.expiresAt) {
            return { success: false, message: "このコードは有効期限切れです。" };
        }

        // 重複使用チェック
        if (data.usedBy.includes(player.id)) {
            return { success: false, message: "このコードは既に使用済みです。" };
        }

        // 最大使用回数チェック (0 = 無制限)
        if (data.maxUses > 0 && data.useCount >= data.maxUses) {
            return { success: false, message: "このコードの使用上限に達しています。" };
        }

        // 報酬付与
        const giveResult = this._giveRewards(player, data.rewards);
        if (!giveResult.success) {
            return giveResult;
        }

        // 使用履歴を更新
        data.usedBy.push(player.id);
        data.useCount++;
        _db.set(code, data);

        return { success: true, message: giveResult.message };
    }

    // ----------------------------------------------------------
    // 報酬付与 (private)
    // ----------------------------------------------------------

    /**
     * 報酬をプレイヤーに付与する
     * @param {import("@minecraft/server").Player} player
     * @param {Array<{type:string, typeId?:string, amount:number}>} rewards
     * @returns {{ success: boolean, message: string }}
     */
    static _giveRewards(player, rewards) {
        const messages = [];

        for (const reward of rewards) {
            if (reward.type === "item") {
                try {
                    const item = new ItemStack(reward.typeId, reward.amount ?? 1);
                    const inventory = player.getComponent(EntityComponentTypes.Inventory)?.container;
                    if (!inventory) continue;
                    inventory.addItem(item);
                    messages.push(`${reward.typeId} x${reward.amount ?? 1}`);
                } catch (e) {
                    return { success: false, message: `アイテム付与に失敗しました: ${reward.typeId}` };
                }
            } else if (reward.type === "money") {
                Util.addMoney(player, reward.amount ?? 0);
                messages.push(`${reward.amount ?? 0}G`);
            }
        }

        const rewardText = messages.length > 0 ? messages.join(", ") : "なし";
        return { success: true, message: `コードを使用しました！報酬: ${rewardText}` };
    }

    // ----------------------------------------------------------
    // フォーム (プレイヤー用)
    // ----------------------------------------------------------

    /**
     * コード入力フォームを表示する（プレイヤー用）
     * @param {import("@minecraft/server").Player} player
     */
    static async redeemForm(player) {
        const form = new ModalFormData();
        form.title("シリアルコード入力");
        form.textField("コードを入力", "例: XXXX-YYYY-ZZZZ");

        const res = await form.show(player);
        if (res.canceled) return;

        const code = res.formValues[0];
        if (!code || code.trim() === "") {
            player.sendMessage("§cコードを入力してください。");
            return;
        }

        const result = this.redeem(player, code);
        if (result.success) {
            player.sendMessage(`§a${result.message}`);
        } else {
            player.sendMessage(`§c${result.message}`);
        }
    }

    // ----------------------------------------------------------
    // 管理者用フォーム群 (Admin)
    // ----------------------------------------------------------

    /**
     * 管理者メインメニュー
     * @param {import("@minecraft/server").Player} player
     */
    static async adminMenu(player) {
        const form = new ActionFormData();
        form.title("シリアルコード管理");
        form.button("コードを作成");
        form.button("コード一覧");

        const res = await form.show(player);
        if (res.canceled) return;

        if (res.selection === 0) {
            await this.adminCreateForm(player);
        } else if (res.selection === 1) {
            await this.adminListForm(player);
        }
    }

    /**
     * コード作成フォーム (Admin) — Phase 1: コード基本情報
     * @param {import("@minecraft/server").Player} player
     */
    static async adminCreateForm(player) {
        // --- Phase 1: コード基本情報 ---
        const infoForm = new ModalFormData();
        infoForm.title("シリアルコード作成 (1/2)");
        infoForm.textField("コード文字列", "例: CWARS-2026-GIFT");
        infoForm.textField(
            "最大使用回数 (0=無制限)",
            "例: 1",
            { defaultValue: "1" },
        );

        const infoRes = await infoForm.show(player);
        if (infoRes.canceled) {
            await this.adminMenu(player);
            return;
        }

        const [codeStr, maxUsesStr] = infoRes.formValues;

        if (!codeStr || codeStr.trim() === "") {
            player.sendMessage("§cコード文字列を入力してください。");
            await this.adminMenu(player);
            return;
        }

        const maxUses = Math.max(0, parseInt(maxUsesStr) || 1);

        // --- Phase 2: アイテム追加ループ ---
        const rewards = [];
        await this._adminAddItemLoop(player, codeStr, rewards, maxUses);
    }

    /**
     * アイテム追加ループ (内部)
     * @param {import("@minecraft/server").Player} player
     * @param {string} codeStr
     * @param {Array} rewards - 追加中の報酬リスト (参照渡しで蓄積)
     * @param {number} maxUses
     */
    static async _adminAddItemLoop(player, codeStr, rewards, maxUses) {
        // 現在の追加済みリストを表示しながらアイテム入力フォームを出す
        const addedSummary = rewards.length > 0
            ? rewards.map((r, i) => `  ${i + 1}. ${r.typeId} x${r.amount}`).join("\n")
            : "  (まだなし)";

        const itemForm = new ModalFormData();
        itemForm.title(`アイテム追加 (${rewards.length}個追加済み)`);
        itemForm.textField(
            `アイテムID\n追加済み:\n${addedSummary}`,
            "例: minecraft:diamond",
        );
        itemForm.textField(
            "個数",
            "例: 1",
            { defaultValue: "1" },
        );

        const itemRes = await itemForm.show(player);
        if (itemRes.canceled) {
            // キャンセルは完了扱い
            await this._finishCreate(player, codeStr, rewards, maxUses);
            return;
        }

        const typeId = (itemRes.formValues[0] ?? "").trim();
        const amount = Math.max(1, parseInt(itemRes.formValues[1]) || 1);

        if (typeId !== "") {
            rewards.push({ type: "item", typeId, amount });
        }

        // 続けて追加するか確認
        const nextForm = new MessageFormData();
        nextForm.title("アイテム追加");
        const nextSummary = rewards.map((r, i) => `${i + 1}. ${r.typeId} x${r.amount}`).join("\n");
        nextForm.body(
            `追加済み (${rewards.length}個):\n${nextSummary || "なし"}\n\nさらにアイテムを追加しますか？`
        );
        nextForm.button1("さらに追加する");
        nextForm.button2("完了");

        const nextRes = await nextForm.show(player);
        if (nextRes.canceled || nextRes.selection === 1) {
            // 完了
            await this._finishCreate(player, codeStr, rewards, maxUses);
        } else {
            // さらに追加
            await this._adminAddItemLoop(player, codeStr, rewards, maxUses);
        }
    }

    /**
     * コード作成を確定する (内部)
     * @param {import("@minecraft/server").Player} player
     * @param {string} codeStr
     * @param {Array} rewards
     * @param {number} maxUses
     */
    static async _finishCreate(player, codeStr, rewards, maxUses) {
        if (rewards.length === 0) {
            player.sendMessage("§cアイテムが1つも追加されていないため作成をキャンセルしました。");
            await this.adminMenu(player);
            return;
        }

        const result = this.create(codeStr, rewards, { maxUses });
        if (result.success) {
            const itemList = rewards.map(r => `${r.typeId} x${r.amount}`).join(", ");
            player.sendMessage(`§a[管理] ${result.message}\n報酬: ${itemList}`);
        } else {
            player.sendMessage(`§c[管理] ${result.message}`);
        }
        await this.adminMenu(player);
    }


    /**
     * コード一覧 → 詳細/削除フォーム (Admin)
     * @param {import("@minecraft/server").Player} player
     */
    static async adminListForm(player) {
        const codes = this.list();

        if (codes.length === 0) {
            player.sendMessage("§c登録されているシリアルコードはありません。");
            await this.adminMenu(player);
            return;
        }

        const form = new ActionFormData();
        form.title("シリアルコード一覧");
        for (const c of codes) {
            const usedLabel = c.maxUses > 0
                ? `${c.useCount}/${c.maxUses}回使用`
                : `${c.useCount}回使用 (無制限)`;
            form.button(`${c.code}\n${usedLabel}`);
        }

        const res = await form.show(player);
        if (res.canceled) {
            await this.adminMenu(player);
            return;
        }

        const selected = codes[res.selection];
        await this.adminDetailForm(player, selected);
    }

    /**
     * コード詳細 + 削除フォーム (Admin)
     * @param {import("@minecraft/server").Player} player
     * @param {object} codeData
     */
    static async adminDetailForm(player, codeData) {
        const rewardLines = (codeData.rewards ?? []).map(r => {
            if (r.type === "item") return `アイテム: ${r.typeId} x${r.amount}`;
            if (r.type === "money") return `お金: ${r.amount}G`;
            return JSON.stringify(r);
        }).join("\n");

        const usedLabel = codeData.maxUses > 0
            ? `${codeData.useCount} / ${codeData.maxUses} 回`
            : `${codeData.useCount} 回 (無制限)`;

        const body =
            `コード: ${codeData.code}\n` +
            `使用回数: ${usedLabel}\n` +
            `報酬:\n${rewardLines || "なし"}\n` +
            `使用者数: ${codeData.usedBy.length}人`;

        const delForm = new MessageFormData();
        delForm.title(`コード詳細: ${codeData.code}`);
        delForm.body(body);
        delForm.button1("削除する");
        delForm.button2("戻る");

        const res = await delForm.show(player);
        if (res.canceled || res.selection === 1) {
            await this.adminListForm(player);
            return;
        }

        // 削除確認
        const confirmForm = new MessageFormData();
        confirmForm.title("削除確認");
        confirmForm.body(`コード "${codeData.code}" を削除しますか？`);
        confirmForm.button1("削除");
        confirmForm.button2("キャンセル");

        const confirmRes = await confirmForm.show(player);
        if (confirmRes.canceled || confirmRes.selection === 1) {
            await this.adminListForm(player);
            return;
        }

        this.delete(codeData.code);
        player.sendMessage(`§a[管理] コード "${codeData.code}" を削除しました。`);
        await this.adminMenu(player);
    }
}
