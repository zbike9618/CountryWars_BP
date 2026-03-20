console.warn("[ServerTransfer] index.js の読み込みを開始します...");
import { world, system } from "@minecraft/server";

/** @type {any} */
let transferPlayerFunc;

// サーバー管理者モジュールの動的読み込み試行
(async () => {
    try {
        const { transferPlayer } = await import("@minecraft/server-admin");
        transferPlayerFunc = transferPlayer;
        console.warn("[ServerTransfer] @minecraft/server-admin の読み込みに成功しました");
    } catch (e) {
        console.error("[ServerTransfer] @minecraft/server-admin の読み込みに失敗しました。BDS環境であるか確認してください。:", e);
    }
})();

system.afterEvents.scriptEventReceive.subscribe(eventData => {
    if (eventData.id === "servertransfer:go") {
        const message = eventData.message.trim();
        console.warn(`[ServerTransfer] 受信: "${message}"`);

        if (!message) return;

        const args = message.split(/\s+/);
        if (args.length < 3) {
            console.warn(`[ServerTransfer] 引数が不足しています: ${args.length}個`);
            return;
        }

        const selector = args[0];
        const hostname = args[1];
        const port = parseInt(args[2], 10);

        if (isNaN(port)) {
            console.warn(`[ServerTransfer] ポート番号が不正です: ${args[2]}`);
            return;
        }

        if (!transferPlayerFunc) {
            console.error("[ServerTransfer] transferPlayer 関数が利用できません。モジュールの読み込みに失敗している可能性があります。");
            return;
        }

        const source = eventData.sourceEntity;
        const targets = getPlayersBySelector(selector, source);
        
        if (targets.length === 0) {
            console.warn(`[ServerTransfer] プレイヤーが見つかりません: ${selector}`);
            return;
        }

        system.run(() => {
            for (const player of targets) {
                try {
                    console.warn(`[ServerTransfer] ${player.name} を転送します...`);
                    transferPlayerFunc(player, { hostname, port });
                } catch (error) {
                    console.error(`[ServerTransfer] 転送実行エラー:`, error);
                }
            }
        });
    }
});

function getPlayersBySelector(selector, source) {
    if (selector.startsWith("@")) {
        const commandSource = source || world.getDimension("overworld");
        const tempTag = `st_target_${Math.floor(Math.random() * 1000000)}`;
        try {
            commandSource.runCommand(`tag ${selector} add ${tempTag}`);
            const players = world.getAllPlayers().filter(p => p.hasTag(tempTag));
            world.getDimension("overworld").runCommand(`tag @a[tag=${tempTag}] remove ${tempTag}`);
            return players;
        } catch (e) {
            console.warn(`[ServerTransfer] セレクター解析エラー: ${e}`);
            return [];
        }
    } else {
        const cleanName = selector.replace(/['"]/g, "");
        return world.getAllPlayers().filter(p => p.name === cleanName);
    }
}

console.warn("[ServerTransfer] index.js の読み込みが完了しました");
