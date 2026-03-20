import { world, system } from "@minecraft/server";
import { transferPlayer } from "@minecraft/server-admin";

/**
 * サーバー転送プラグイン - メインロジック
 * /scriptevent servertransfer:go <player/selector> <ip> <port>
 */

system.afterEvents.scriptEventReceive.subscribe(eventData => {
    if (eventData.id === "servertransfer:go") {
        const message = eventData.message.trim();
        if (!message) return;

        const args = message.split(/\s+/);
        if (args.length < 3) return;

        const selector = args[0];
        const hostname = args[1];
        const port = parseInt(args[2], 10);

        if (isNaN(port)) return;

        const targets = getPlayersBySelector(selector);
        
        system.run(() => {
            for (const player of targets) {
                try {
                    transferPlayer(player, { hostname, port });
                } catch (error) {
                    console.error(`[ServerTransfer] ${player.name} の転送エラー:`, error);
                }
            }
        });
    }
});

function getPlayersBySelector(selector) {
    if (selector.startsWith("@")) {
        const dimension = world.getDimension("overworld");
        const tempTag = `st_target_${Math.floor(Math.random() * 1000000)}`;
        try {
            dimension.runCommand(`tag ${selector} add ${tempTag}`);
            const players = world.getAllPlayers().filter(p => p.hasTag(tempTag));
            dimension.runCommand(`tag ${selector} remove ${tempTag}`);
            return players;
        } catch (e) {
            return [];
        }
    } else {
        return world.getAllPlayers().filter(p => p.name === selector);
    }
}
