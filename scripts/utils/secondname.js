import * as server from "@minecraft/server";
const { system } = server;
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { ShortPlayerData } from "./playerData.js";
import { Dypro } from "./dypro.js";
import { Util } from "./util.js";
const playerDatas = new Dypro("player");

/**
 * 画面遷移やチャットクローズ時の「UserBusy」を待機して確実にフォームを開くヘルパー
 * @param {server.Player} player 
 * @param {ActionFormData | ModalFormData} form 
 * @returns {Promise<any>}
 */
async function forceShow(player, form) {
    while (player.isValid) {
        const response = await form.show(player);
        if (response.cancelationReason === "UserBusy") {
            await new Promise(resolve => system.run(resolve));
            continue;
        }
        return response;
    }
    return { canceled: true };
}

export class SecondName {
    static async secondNameForm(player) {
        if (!player || !player.isValid) return;
        const playerData = playerDatas.get(player.id);
        if (!playerData) return;

        if (!playerData.secondname) {
            playerData.secondname = {
                before: ["一般的な"],
                after: ["鯖民"],
                now: [0, 0]
            };
            playerDatas.set(player.id, playerData);
        }

        const form = new ActionFormData();
        const now = playerData.secondname.now ?? [0, 0];
        form.title({ translate: "cw.usermenu.title" });
        form.button({ translate: "cw.secondnameform.before", with: [playerData.secondname.before[now[0]] ?? ""] });
        form.button({ translate: "cw.secondnameform.after", with: [playerData.secondname.after[now[1]] ?? ""] });
        form.button({ translate: "cw.usermenu.settings" });

        const res = await forceShow(player, form);
        if (res.canceled) return;
        switch (res.selection) {
            case 0:
                beforeForm(player);
                break;

            case 1:
                afterForm(player);
                break;

            case 2:
                settingsForm(player);
                break;
        }
    }
}

export const UserMenu = SecondName;

async function beforeForm(player) {
    if (!player || !player.isValid) return;
    const playerData = playerDatas.get(player.id);
    if (!playerData || !playerData.secondname) return;

    const form = new ActionFormData();
    form.title({ translate: "cw.secondnameform.before", with: [""] });
    for (const button of playerData.secondname.before) {
        form.button(`${button}`);
    }
    const res = await forceShow(player, form);
    if (res.canceled) {
        SecondName.secondNameForm(player);
        return;
    }
    playerData.secondname.now[0] = res.selection;
    playerDatas.set(player.id, playerData);
    Util.updateNameTag(player);
    const now = playerData.secondname.now;
    player.sendMessage({ translate: "cw.secondnameform.beforechanged", with: [playerData?.secondname.before[now[0]], playerData?.secondname.before[now[0]] + playerData?.secondname.after[now[1]]] });
    SecondName.secondNameForm(player);
}

async function afterForm(player) {
    if (!player || !player.isValid) return;
    const playerData = playerDatas.get(player.id);
    if (!playerData || !playerData.secondname) return;

    const form = new ActionFormData();
    form.title({ translate: "cw.secondnameform.after", with: [""] });
    for (const button of playerData.secondname.after) {
        form.button(`${button}`);
    }
    const res = await forceShow(player, form);
    if (res.canceled) {
        SecondName.secondNameForm(player);
        return;
    }
    playerData.secondname.now[1] = res.selection;
    playerDatas.set(player.id, playerData);
    Util.updateNameTag(player);
    const now = playerData.secondname.now;
    player.sendMessage({ translate: "cw.secondnameform.afterchanged", with: [playerData?.secondname.after[now[1]], playerData?.secondname.before[now[0]] + playerData?.secondname.after[now[1]]] });
    SecondName.secondNameForm(player);
}

async function settingsForm(player) {
    if (!player || !player.isValid) return;
    const playerData = playerDatas.get(player.id);
    if (!playerData) return;

    const form = new ModalFormData();
    form.title({ translate: "cw.usermenu.settings" });
    const showCombat = playerData?.settings?.showCombat ?? true;
    form.toggle({ translate: "cw.usermenu.settings.combat" }, { defaultValue: showCombat });

    const res = await forceShow(player, form);
    if (res.canceled) {
        SecondName.secondNameForm(player);
        return;
    }
    playerData.settings = playerData.settings || {};
    playerData.settings.showCombat = Boolean(res.formValues?.[0]);
    playerDatas.set(player.id, playerData);
    player.sendMessage({ translate: "cw.usermenu.settings.saved" });
    SecondName.secondNameForm(player);
}
