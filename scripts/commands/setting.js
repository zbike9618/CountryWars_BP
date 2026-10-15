import * as server from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { Dypro } from "../utils/dypro.js";
import { SecondName } from "../utils/secondname.js";

const { world, system } = server;
const playerDatas = new Dypro("player");

/**
 * 設定UIフォームを表示
 * @param {import("@minecraft/server").Player} player 
 */
export async function showSettingForm(player) {
    if (!player || !player.isValid) return;

    const playerData = playerDatas.get(player.id) || {};
    const isCombatHidden = !!playerData.hideCombat;

    const form = new ActionFormData();
    form.title({ translate: "cw.setting.title" });
    form.body({ translate: "cw.setting.body" });

    // ボタン1: Combat表示切替
    form.button(`Combat表示: ${isCombatHidden ? "§c[ OFF ]" : "§a[ ON ]"}`);
    // ボタン2: 二つ名 (称号) の設定
    form.button({ translate: "cw.secondnameform.title" });

    const res = await form.show(player);
    if (res.canceled) return;

    switch (res.selection) {
        case 0: {
            // Combat表示ON/OFF切替
            const updatedData = playerDatas.get(player.id) || { id: player.id };
            updatedData.hideCombat = !updatedData.hideCombat;
            playerDatas.set(player.id, updatedData);

            if (updatedData.hideCombat) {
                player.sendMessage("§cCombat表示を OFF (非表示) に設定しました。");
            } else {
                player.sendMessage("§aCombat表示を ON (表示) に設定しました。");
            }

            // フォームを再表示
            system.run(() => {
                showSettingForm(player);
            });
            break;
        }
        case 1: {
            // 二つ名設定フォームを表示
            system.run(() => {
                SecondName.secondNameForm(player);
            });
            break;
        }
    }
}

// カスタムコマンド登録 cw:setting (./setting)
system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:setting",
        description: "設定画面を開く (Combat表示切替 / 二つ名設定)",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: []
    }, (origin) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            const player = origin.sourceEntity;
            system.run(() => {
                showSettingForm(player);
            });
        }
        return {
            status: server.CustomCommandStatus.Success,
            message: undefined
        };
    });
});

// チャットでの ./setting または !setting コマンドの検知
world.beforeEvents.chatSend.subscribe((ev) => {
    const message = ev.message?.trim();
    if (message === "./setting" || message === "!setting" || message === "/setting") {
        ev.cancel = true;
        const player = ev.sender;
        system.run(() => {
            showSettingForm(player);
        });
    }
});
