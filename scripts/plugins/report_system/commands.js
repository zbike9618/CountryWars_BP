import * as server from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { addReport } from "./index.js";

const { system, world } = server;

system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:report",
        description: "荒らしプレイヤーを通報する",
        permissionLevel: server.CommandPermissionLevel.Any
    }, (origin, targetName, reason) => {
        if (origin.sourceEntity?.typeId !== "minecraft:player") return;
        const reporter = origin.sourceEntity;

        // 引数がない場合はUIを表示
        if (!targetName) {
            system.run(() => showReportForm(reporter));
            return;
        }

        // 名前からプレイヤーを特定
        const target = world.getPlayers({ name: targetName })[0];
        if (!target) {
            reporter.sendMessage(`§cプレイヤー "${targetName}" は見つかりません。§r`);
            return;
        }

        if (target.name === reporter.name) {
            reporter.sendMessage("§c自分自身を通報することはできません。§r");
            return;
        }

        addReport(reporter, target.name, reason || "理由なし");
    });
});

/**
 * 通報用UIフォームを表示する
 */
async function showReportForm(player) {
    const players = world.getAllPlayers().filter(p => p.name !== player.name);

    if (players.length === 0) {
        player.sendMessage("§c通報可能なプレイヤーが他にいません。§r");
        return;
    }

    const form = new ActionFormData()
        .title("§eプレイヤー通報§r")
        .body("通報するプレイヤーを選択してください。");

    players.forEach(p => {
        form.button(`§b${p.name}§r`);
    });

    const response = await form.show(player);
    if (response.canceled) return;

    const target = players[response.selection];

    // 理由入力フォーム
    const reasonForm = new ModalFormData()
        .title(`§e通報: ${target.name}§r`)
        .textField("通報の理由を入力してください", "例: 荒らし、暴言など");

    const reasonRes = await reasonForm.show(player);
    if (reasonRes.canceled) return;

    const reason = reasonRes.formValues[0] || "理由なし";
    addReport(player, target.name, reason);
}
