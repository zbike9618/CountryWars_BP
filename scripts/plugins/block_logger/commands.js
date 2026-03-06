import * as server from "@minecraft/server"
const { world, system } = server;
import { http, HttpRequestMethod, HttpHeader, HttpRequest } from "@minecraft/server-net";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import config from "../../config/config.js";

const VIEWER_URL = "http://localhost:3001/block-log-viewer";

system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:blocklog",
        description: "自分の周辺のブロックログを表示する",
        permissionLevel: server.CommandPermissionLevel.Admin,
        optionalParameters: [
            { name: "radius", type: server.CustomCommandParamType.Integer }
        ]
    }, (origin, radius) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            const player = origin.sourceEntity;
            // 1tick遅延させて非同期処理を開始する
            system.run(() => executeBlockLog(player, radius));
        } else {
            console.warn("このコマンドはプレイヤーのみ実行可能です");
        }
    });
});

/**
 * チャット画面などの影響で「UserBusy」エラーでキャンセルされた時に、
 * フォームが正常に開く（またはユーザーが自発的に閉じる）までリトライするためのヘルパー関数
 */
async function forceShow(player, form) {
    while (true) {
        const response = await form.show(player);
        if (response.cancelationReason === "UserBusy") {
            // 次のtickまで待機して再パルス
            await new Promise(resolve => system.run(resolve));
            continue;
        }
        return response;
    }
}

async function executeBlockLog(player, radius, days) {
    let searchRadius = radius;
    let searchDays = days;

    // 半径または期間が指定されていない場合はフォームを表示して入力を促す
    if (searchRadius === undefined || searchDays === undefined) {
        const timeOptions = ["全期間", "1ヶ月以内", "2週間以内", "1週間以内", "6日以内", "5日以内", "4日以内", "3日以内", "2日以内", "1日以内"];
        const radiusForm = new ModalFormData()
            .title("§e検索条件の選択§r")
            .slider("半径 (マス)", 1, 25, { defaultValue: searchRadius ?? 5 })
            .dropdown("期間", timeOptions, { defaultValueIndex: 0 });

        const radiusRes = await forceShow(player, radiusForm);
        if (radiusRes.canceled) return;

        searchRadius = radiusRes.formValues[0];
        const timeIndex = radiusRes.formValues[1];

        // 選択されたインデックスから日数を計算
        const dayMap = [0, 30, 14, 7, 6, 5, 4, 3, 2, 1];
        searchDays = dayMap[timeIndex];
    }

    const loc = player.location;
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);

    player.sendMessage(`§e周辺のログを検索中... (半径${searchRadius} / 期間:${searchDays === 0 ? "全期間" : searchDays + "日以内"})§r`);

    // リクエストパラメータの組み立て
    const requestBody = { x, y, z, radius: searchRadius, days: searchDays };

    const request = new HttpRequest(VIEWER_URL);
    request.method = HttpRequestMethod.Post;
    request.headers = [
        new HttpHeader("Content-Type", "application/json"),
        new HttpHeader("Authorization", "Bearer " + config.apiToken)
    ];
    request.body = JSON.stringify(requestBody);

    try {
        // --- サーバーへデータ要求 ---
        const httpResponse = await http.request(request);

        if (httpResponse.status !== 200) {
            player.sendMessage("§cログの取得に失敗しました。サーバーが起動しているか確認してください。");
            return;
        }

        let logs;
        try {
            logs = JSON.parse(httpResponse.body);
        } catch (e) {
            player.sendMessage("§cデータのパースに失敗しました。");
            return;
        }

        // --- 検索結果の表示 ---
        if (logs.length === 0) {
            const emptyForm = new ActionFormData()
                .title(`§e検索結果 (半径${searchRadius}マス)§r`)
                .body(`§7指定された条件で見つかりませんでした。§r\n§7(期間: ${searchDays === 0 ? "全期間" : searchDays + "日以内"})`)
                .button("条件を変えて検索")
                .button("閉じる");
            const emptyRes = await forceShow(player, emptyForm);
            if (emptyRes.selection === 0) {
                system.run(() => executeBlockLog(player, undefined, undefined));
            }
            return;
        }

        const resultForm = new ActionFormData()
            .title(`§e検索結果 (${logs.length}件)§r`)
            .body(`半径${searchRadius}マスの範囲で見つかったログです。\n§7(期間: ${searchDays === 0 ? "全期間" : searchDays + "日以内"})§r`);

        logs.forEach(log => {
            const actionColor = log.action === "Place" ? "§a" : "§c";
            const timeStr = log.timestamp.substring(11, 16);
            resultForm.button(`${actionColor}[${timeStr}] ${log.playerName}\n§7${log.blockName}§r`);
        });

        const response = await forceShow(player, resultForm);
        if (response.canceled) return;

        // 選択されたログの詳細を表示
        const selectedLog = logs[response.selection];
        const actionColor = selectedLog.action === "Place" ? "§a" : "§c";
        const actionName = selectedLog.action === "Place" ? "設置" : "破壊";

        const detailForm = new ActionFormData()
            .title("§eログ詳細§r")
            .body(
                `§7時刻:§r ${selectedLog.timestamp}\n` +
                `§7プレイヤー:§r §b${selectedLog.playerName}§r\n` +
                `§7アクション:§r ${actionColor}${actionName}§r\n` +
                `§7ブロック:§r ${selectedLog.blockName}\n` +
                `§7座標:§r [${selectedLog.x}, ${selectedLog.y}, ${selectedLog.z}]`
            )
            .button("戻る")
            .button("閉じる");

        const detailRes = await forceShow(player, detailForm);
        if (detailRes.selection === 0) {
            // 「戻る」が押されたら再帰的に結果を表示
            system.run(() => executeBlockLog(player, searchRadius, searchDays));
        }

    } catch (err) {
        player.sendMessage("§cサーバーとの通信エラーが発生しました。");
    }
}
