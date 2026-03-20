import { world, system } from "@minecraft/server";
import { transferPlayer } from "@minecraft/server-admin";

/**
 * サーバー転送プラグイン - メインロジック
 * /scriptevent servertransfer:go <player/selector> <ip> <port>
 */

system.afterEvents.scriptEventReceive.subscribe(eventData => {
    if (eventData.id === "servertransfer:go") {
        const message = eventData.message.trim();
        
        // メッセージの受信ログ
        console.warn(`[ServerTransfer] 受信しました: "${message}"`);

        if (!message) {
            console.warn("[ServerTransfer] 引数が空です");
            return;
        }

        const args = message.split(/\s+/);
        if (args.length < 3) {
            console.warn(`[ServerTransfer] 引数が不足しています (3つ必要): ${args.length}個検出`);
            return;
        }

        const selector = args[0];
        const hostname = args[1];
        const portStr = args[2];
        const port = parseInt(portStr, 10);

        if (isNaN(port)) {
            console.warn(`[ServerTransfer] ポート番号が数字ではありません: ${portStr}`);
            return;
        }

        const source = eventData.sourceEntity;
        const targets = getPlayersBySelector(selector, source);
        
        if (targets.length === 0) {
            console.warn(`[ServerTransfer] 対象プレイヤーが見つかりませんでした: ${selector}`);
            if (source && source.typeId === "minecraft:player") {
                source.sendMessage(`§c[ServerTransfer] プレイヤーが見つかりませんでした: ${selector}`);
            }
            return;
        }

        system.run(() => {
            for (const player of targets) {
                try {
                    console.warn(`[ServerTransfer] ${player.name} を ${hostname}:${port} へ転送試行中...`);
                    transferPlayer(player, { hostname, port });
                } catch (error) {
                    console.error(`[ServerTransfer] ${player.name} の転送エラー:`, error);
                    player.sendMessage(`§c[ServerTransfer] 転送中にエラーが発生しました。ログを確認してください。`);
                }
            }
        });
    }
});

/**
 * セレクターからプレイヤーを取得する
 * @param {string} selector 
 * @param {import("@minecraft/server").Entity} source 
 */
function getPlayersBySelector(selector, source) {
    if (selector.startsWith("@")) {
        // 実行位置（NPCやプレイヤー）のコンテキストを優先
        const commandSource = source || world.getDimension("overworld");
        const tempTag = `st_target_${Math.floor(Math.random() * 1000000)}`;
        
        try {
            // 一時的なタグを付与
            commandSource.runCommand(`tag ${selector} add ${tempTag}`);
            const players = world.getAllPlayers().filter(p => p.hasTag(tempTag));
            // タグを削除
            world.getDimension("overworld").runCommand(`tag @a[tag=${tempTag}] remove ${tempTag}`);
            return players;
        } catch (e) {
            console.warn(`[ServerTransfer] セレクター "${selector}" の解析エラー: ${e}`);
            return [];
        }
    } else {
        // 名前で検索（クォートの除去）
        const cleanName = selector.replace(/['"]/g, "");
        return world.getAllPlayers().filter(p => p.name === cleanName);
    }
}
