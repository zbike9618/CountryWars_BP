import * as ui from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import { Util } from "../utils/util";
import { default as config } from "../config/config.js";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"

function getAllCoins(player) {
    return {
        1: getItemCount(player, "cw:coin_1"),
        10: getItemCount(player, "cw:coin_10"),
        50: getItemCount(player, "cw:coin_50"),
        100: getItemCount(player, "cw:coin_100"),
        500: getItemCount(player, "cw:coin_500"),
        1000: getItemCount(player, "cw:bill_1000"),
        5000: getItemCount(player, "cw:bill_5000"),
        10000: getItemCount(player, "cw:bill_10000"),
    };
}


export class Bank {
    static async bankForm(player) {
        const form = new ActionFormData()
        form.title({ translate: "cw.bankform.title" })
        form.button({ translate: "cw.bankform.tobank" })
        form.button({ translate: "cw.bankform.frombank" })
        form.button({ translate: "cw.bankform.exchange" })
        const res = await form.show(player)
        if (res.canceled) return;
        switch (res.selection) {
            case 0:
                ToBank.tobankForm(player)
                break;

            case 1:
                FromBank.frombankForm(player)
                break;
            case 2:
                Exchange.exchangeForm(player)
                break

        }
    }
}

export class ToBank {
    static async tobankForm(player) {

    }
}

export class FromBank {
    static async frombankForm(player) {

    }
}