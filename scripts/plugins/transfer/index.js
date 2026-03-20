import * as server from "@minecraft/server"
const { world, system } = server;
import { transferPlayer } from "@minecraft/server-admin";

/**
 * サーバー転送プラグイン - メインロジック
 * カスタムコマンド: cw:transfer <ip> <port> [player]
 */

system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:servertransfer",
        description: "指定したサーバーにプレイヤーを転送します",
        // NPCからも実行できるようにAnyに変更 (必要に応じてアドオン側でOPのみの制限等を行う)
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
            { name: "ip", type: server.CustomCommandParamType.String },
            { name: "port", type: server.CustomCommandParamType.Integer }
        ],
        optionalParameters: [
            { name: "target", type: server.CustomCommandParamType.PlayerSelector }
        ]
    }, (origin, ip, port, targetSelector) => {
        // 実行権限のチェック: プレイヤーなら 'cw:host' タグが必要。NPC(コマンドブロック等)なら許可。
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            const player = origin.sourceEntity;
            if (!player.hasTag("cw:host")) {
                player.sendMessage("§c[ServerTransfer] 実行権限がありません。");
                return;
            }
        }

        // 1tick遅延させて非同期処理から抜ける (transferPlayerを安全に呼ぶため)
        system.run(() => {
            let targets = [];

            // ターゲットが指定されている場合 (セレクター)
            if (targetSelector && targetSelector.length > 0) {
                targets = targetSelector;
            }
            // ターゲットの指定がなく、実行者がプレイヤーである場合は自身を対象とする
            else if (origin.sourceEntity?.typeId === "minecraft:player") {
                targets = [origin.sourceEntity];
            }

            if (targets.length === 0) {
                console.warn(`[ServerTransfer] 転送対象のプレイヤーが見つかりませんでした。`);
                return;
            }

            for (const player of targets) {
                try {
                    console.warn(`[ServerTransfer] ${player.name} を ${ip}:${port} へ転送試行中...`);
                    transferPlayer(player, { hostname: ip, port: port });
                } catch (error) {
                    console.error(`[ServerTransfer] ${player.name} の転送エラー:`, error);
                    player.sendMessage(`§c[ServerTransfer] 転送中にエラーが発生しました。`);
                }
            }
        });
    });
});
