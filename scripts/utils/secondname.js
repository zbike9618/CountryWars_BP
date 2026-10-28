import * as server from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"
import { ShortPlayerData } from "./playerData"
import { Dypro } from "./dypro"
import { Util } from "./util"
const playerDatas = new Dypro("player")

export class SecondName {
    static async secondNameForm(player) {
        const form = new ActionFormData()
        const playerData = playerDatas.get(player.id)
        const now = playerData.secondname.now
        form.title({ translate: "cw.usermenu.title" })
        form.button({ translate: "cw.secondnameform.before", with: [playerData?.secondname.before[now[0]]] })
        form.button({ translate: "cw.secondnameform.after", with: [playerData?.secondname.after[now[1]]] })
        form.button({ translate: "cw.usermenu.settings" })
        const res = await form.show(player)
        if (res.canceled) return;
        switch (res.selection) {
            case 0:
                beforeForm(player)
                break;

            case 1:
                afterForm(player)
                break;

            case 2:
                settingsForm(player)
                break;
        }
    }
}

export const UserMenu = SecondName;

async function beforeForm(player) {
    const playerData = playerDatas.get(player.id)
    const form = new ActionFormData();
    form.title({ translate: "cw.secondnameform.before", with: [""] });
    for (const button of playerData.secondname.before) {
        form.button(`${button}`);
    }
    const res = await form.show(player);
    if (res.canceled) {
        SecondName.secondNameForm(player);
        return;
    }
    playerData.secondname.now[0] = res.selection
    playerDatas.set(player.id, playerData)
    Util.updateNameTag(player);
    const now = playerData.secondname.now
    player.sendMessage({ translate: "cw.secondnameform.beforechanged", with: [playerData?.secondname.before[now[0]], playerData?.secondname.before[now[0]] + playerData?.secondname.after[now[1]]] });
    SecondName.secondNameForm(player);
}

async function afterForm(player) {
    const playerData = playerDatas.get(player.id)
    const form = new ActionFormData();
    form.title({ translate: "cw.secondnameform.after", with: [""] });
    for (const button of playerData.secondname.after) {
        form.button(`${button}`);
    }
    const res = await form.show(player);
    if (res.canceled) {
        SecondName.secondNameForm(player);
        return;
    }
    playerData.secondname.now[1] = res.selection
    playerDatas.set(player.id, playerData)
    Util.updateNameTag(player);
    const now = playerData.secondname.now
    player.sendMessage({ translate: "cw.secondnameform.afterchanged", with: [playerData?.secondname.after[now[1]], playerData?.secondname.before[now[0]] + playerData?.secondname.after[now[1]]] });
    SecondName.secondNameForm(player);
}

async function settingsForm(player) {
    const playerData = playerDatas.get(player.id);
    const form = new ModalFormData();
    form.title({ translate: "cw.usermenu.settings" });
    const showCombat = playerData?.settings?.showCombat ?? true;
    form.toggle({ translate: "cw.usermenu.settings.combat" }, showCombat);
    const res = await form.show(player);
    if (res.canceled) {
        SecondName.secondNameForm(player);
        return;
    }
    playerData.settings = playerData.settings || {};
    playerData.settings.showCombat = res.formValues[0];
    playerDatas.set(player.id, playerData);
    player.sendMessage({ translate: "cw.usermenu.settings.saved" });
    SecondName.secondNameForm(player);
}
