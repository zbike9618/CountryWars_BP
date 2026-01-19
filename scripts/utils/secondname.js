import * as server from "@minecraft/server"
import { ActionFormData } from "@minecraft/server-ui"
import { ShortPlayerData } from "./playerData"
import { Dypro } from "./dypro"
const playerDatas = new Dypro("player")

export class SecondName {
    static async secondNameForm(player) {
        const form = new ActionFormData()
        const playerData = playerDatas.get(player.id)
        const now = playerData.secondname.now
        form.title({ translate: "cw.secondnameform.title" })
        form.button({ translate: "cw.secondnameform.before", with: [playerData?.secondname.before[now[0]]] })
        form.button({ translate: "cw.secondnameform.after", with: [playerData?.secondname.after[now[1]]] })
        const res = await form.show(player)
        if (res.canceled) return;
        switch (res.selection) {
            case 0:
                beforeForm(player)
                break;

            case 1:
                afterForm(player)
                break;
        }
    }
}
// ?の意味を教えてくだせぇ
//|| といっしょ
//ああ　思い出した


//こんなもん？
//一旦テストしてくる

async function beforeForm(player) {
    const playerData = playerDatas.get(player.id)
    const form = new ActionFormData();
    form.title({ translate: "cw.secondnameform.before", with: [""] });
    for (const button of playerData.secondname.before) {
        form.button(`${button}`);
    }
    const res = await form.show(player);
    if (res.canceled) return;
    playerData.secondname.now[0] = res.selection
    playerDatas.set(player.id, playerData)
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
    if (res.canceled) return;
    playerData.secondname.now[1] = res.selection
    playerDatas.set(player.id, playerData)
    const now = playerData.secondname.now
    player.sendMessage({ translate: "cw.secondnameform.afterchanged", with: [playerData?.secondname.after[now[1]], playerData?.secondname.before[now[0]] + playerData?.secondname.after[now[1]]] });
    SecondName.secondNameForm(player);
}

