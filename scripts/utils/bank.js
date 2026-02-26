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
        form.title("銀行")
        form.button("お金を預ける");
        form.button("お金を引き出す");
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
            .title("お金を預ける")
            .body(`持っているすべての現金が預けられます\n現在持っている現金の金額：§a${money}円`)
            .button1("はい")
            .button2("いいえ");

        form.show(player).then((result) => {
            if (result.canceled || result.selection === 1) {
                player.sendMessage("§c預け入れを中断しました");
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
                    player.sendMessage(`§a${amount}円を預けました！`);
                    this.bankForm(player);
                } catch (e) {
                    player.sendMessage("§cエラーが発生したため、預け入れを中断しました。");
                    console.warn(`Deposit Error: ${e}`);
                    this.bankForm(player);
                }
            } else {
                player.sendMessage("§c預けるための現金を持っていません。");
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
        .title("銀行：引き出し")
        .body(`現在の銀行残高: §a${currentBalance}円\n種類を選択してください。`);

    for (const d of denoms) {
        form.button(`${d.label}`);
    }

    form.show(player).then((res) => {
        if (res.canceled) return;

        const selected = denoms[res.selection];

        const balance = Util.getMoney(player);
        const maxAmount = Math.floor(balance / selected.value);

        if (maxAmount <= 0) {
            player.sendMessage("§c残高が不足しています。");
            return;
        }

        const sliderForm = new ModalFormData()
            .title(`${selected.label}を引き出す`)
            .slider(
                `何枚引き出しますか？\n1枚 = ${selected.value}円\n現在残高: ${balance}円`,
                1,
                maxAmount,
                1,
                1
            );

        sliderForm.show(player).then((sliderRes) => {
            if (sliderRes.canceled) return;

            const amount = sliderRes.formValues[0];
            const totalCost = amount * selected.value;

            if (Util.getMoney(player) < totalCost) {
                player.sendMessage("§c残高が不足しています。");
                return;
            }

            const inventory = player.getComponent("minecraft:inventory").container;
            if (inventory.emptySlotsCount === 0) {
                player.sendMessage("§cインベントリがいっぱいです。");
                return;
            }

            Util.addMoney(player, -totalCost);
            player.runCommand(`give @s ${selected.id} ${amount}`);

            player.sendMessage(
                `§a${selected.label}を${amount}枚引き出しました。（残高: ${Util.getMoney(player)}円）`
            );

            this.withdrawForm(player);
        });
    });
}
}
