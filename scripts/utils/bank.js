import * as ui from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import { Util } from "../utils/util";
import { default as config } from "../config/config.js";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"

function getTotalMoney(player) {
    // 1回のループで全種類を計算する方が効率的なので書き換えます
    const inventory = player.getComponent("minecraft:inventory");
    if (!inventory || !inventory.container) return 0;

    const container = inventory.container;
    let totalMoney = 0;

    // 金額の定義
    const values = {
        "cw:coin_1": 1,
        "cw:coin_10": 10,
        "cw:coin_50": 50,
        "cw:coin_100": 100,
        "cw:coin_500": 500,
        "cw:bill_1000": 1000,
        "cw:bill_5000": 5000,
        "cw:bill_10000": 10000
    };

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && values[item.typeId]) {
            // (アイテムの単価) × (個数) を足していく
            totalMoney += values[item.typeId] * item.amount;
        }
    }
    return totalMoney;
}


export class Bank {
    static bankForm(player) {
        const money = getTotalMoney(player)
        const form = new ActionFormData()
        form.title({ translate: "cw.bankform.title" })
        form.button({ translate: "cw.bankform.tobank" });
        form.button({ translate: "cw.bankform.frombank" });
        form.show(player).then((res) => {
            if (res.canceled) return;
            switch (res.selection) {
                case 0:
                    this.depositForm(player);
                    break;
                case 1:
                    this.withdrawForm(player);
                    break;
            }
        });
    }

    static depositForm(player) {
        const money = getTotalMoney(player);

        const form = new MessageFormData()
            .title({ translate: "cw.bankform.tobank" })
            .body({ translate: "cw.scform.money.title", with: [String(money), "???"] /* ※実際の国庫金額は別フォーム用だが仮当てするか、UI用キーを後で調整 */ })
            // TODO: 専用キーが無い場合は既存の近いキーを使用するか、とりあえず RawMessage形式の文字列にします。
            // "持っているすべての現金が預けられます\n現在持っている現金の金額：§a${money}円"
            .body({ rawtext: [{ text: "持っているすべての現金が預けられます\n現在持っている現金の金額：§a" }, { text: String(money) }, { text: "円" }] })
            .button1({ translate: "cw.form.yes" })
            .button2({ translate: "cw.form.no" });

        form.show(player).then((result) => {
            if (result.canceled || result.selection === 1) {
                player.sendMessage({ translate: "cw.form.cancel" }); // 代用キー
                this.bankForm(player);
                return;
            }
            const amount = getTotalMoney(player);
            if (amount > 0) {
                try {
                    Util.addMoney(player, amount);
                    const coinIds = [
                        "cw:coin_1", "cw:coin_10", "cw:coin_50", "cw:coin_100", "cw:coin_100", "cw:coin_500",
                        "cw:bill_1000", "cw:bill_5000", "cw:bill_10000"
                    ];

                    const container = player.getComponent("minecraft:inventory").container;
                    for (let i = 0; i < container.size; i++) {
                        const item = container.getItem(i);
                        if (item && coinIds.includes(item.typeId)) {
                            container.setItem(i, undefined);
                        }
                    }
                    player.sendMessage({ rawtext: [{ text: "§a" }, { text: String(amount) }, { text: "円を預けました！" }] }); // 専用キーがないためRawText化
                    this.bankForm(player);
                } catch (e) {
                    player.sendMessage({ translate: "cw.form.cancel" }); // エラー中断
                    console.warn(`Deposit Error: ${e}`);
                    this.bankForm(player);
                }
            } else {
                player.sendMessage({ translate: "cw.scform.money.deposit.noenough" }); // 手持ちなし
                this.bankForm(player);
            }
        });
    }

    static withdrawForm(player) {
        const currentBalance = Util.getMoney(player);

        const denoms = [
            { label: "1円", value: 1, id: "cw:coin_1" },
            { label: "10円", value: 10, id: "cw:coin_10" },
            { label: "50円", value: 50, id: "cw:coin_50" },
            { label: "100円", value: 100, id: "cw:coin_100" },
            { label: "500円", value: 500, id: "cw:coin_500" },
            { label: "1000円", value: 1000, id: "cw:bill_1000" },
            { label: "5000円", value: 5000, id: "cw:bill_5000" },
            { label: "10000円", value: 10000, id: "cw:bill_10000" }
        ];

        const form = new ActionFormData()
            .title({ translate: "cw.bankform.frombank" })
            .body({ rawtext: [{ text: "現在の銀行残高: §a" }, { text: String(currentBalance) }, { text: "円\n種類を選択してください。" }] });

        for (const d of denoms) {
            form.button(`${d.label}`);
        }

        form.show(player).then((res) => {
            if (res.canceled) return;

            const selected = denoms[res.selection];

            const balance = Util.getMoney(player);
            const maxAmount = Math.floor(balance / selected.value);

            if (maxAmount <= 0) {
                player.sendMessage({ translate: "cw.pay.nomoney" });
                return;
            }

            const sliderForm = new ModalFormData()
                .title({ rawtext: [{ text: selected.label + "を引き出す" }] })
                .slider(
                    `何枚引き出しますか？\n1枚 = ${selected.value}円\n現在残高: ${balance}円`,
                    1,
                    Math.min(maxAmount, 1000), // マイクラのgiveコマンド上限や負荷対策で最大1000枚まで
                    { valueStep: 1, defaultValue: 1 }  // ← 4つ目にオブジェクトでまとめる
                )

            sliderForm.show(player).then((sliderRes) => {
                if (sliderRes.canceled) return;

                const amount = sliderRes.formValues[0];
                const totalCost = amount * selected.value;

                if (Util.getMoney(player) < totalCost) {
                    player.sendMessage({ translate: "cw.pay.nomoney" });
                    return;
                }

                const inventory = player.getComponent("minecraft:inventory").container;

                // 64個で1スタックとして、必要なスタック数を計算
                const requiredSlots = Math.ceil(amount / 64);
                if (inventory.emptySlotsCount < requiredSlots) {
                    player.sendMessage({ translate: "cw.playermarket.invfull" });
                    return;
                }

                Util.addMoney(player, -totalCost);

                // 【修正: 大量に引き出す場合のバグを防ぐため、give処理を安全に行う】
                try {
                    let remainingAmount = amount;
                    while (remainingAmount > 0) {
                        const giveAmount = Math.min(remainingAmount, 32767); // giveの1回の最大値
                        player.runCommand(`give @s ${selected.id} ${giveAmount}`);
                        remainingAmount -= giveAmount;
                    }
                } catch (e) {
                    // 万が一giveコマンドが失敗した場合は返金する
                    Util.addMoney(player, totalCost);
                    player.sendMessage({ translate: "cw.form.cancel" }); // 代替
                    return;
                }

                player.sendMessage({ rawtext: [{ text: `§a${selected.label}を${amount}枚引き出しました。（残高: ` }, { text: String(Util.getMoney(player)) }, { text: "円）" }] });

                this.withdrawForm(player);
            });
        });
    }
}
