import { world, system } from "@minecraft/server";
import { DiscordRelay } from "../../utils/chat.js";

// 通報データを保持するマップ (targetPlayerName -> Array of reports)
// report: { from: string, reason: string, timestamp: number }
const reports = new Map();

// 同一プレイヤーによる連続通報制限 (reporterName_targetName -> lastReportTime)
const cooldowns = new Map();

/**
 * 通報を登録し、条件を満たせばKickを実行する
 */
export function addReport(reporter, targetName, reason) {
    const now = Date.now();
    const cooldownKey = `${reporter.name}_${targetName}`;

    // 1. 同一対象への連続通報チェック (1分間)
    const lastReportTime = cooldowns.get(cooldownKey);
    if (lastReportTime && now - lastReportTime < 60 * 1000) {
        const remaining = Math.ceil((60 * 1000 - (now - lastReportTime)) / 1000);
        reporter.sendMessage(`§c同じ相手への通報はあと ${remaining} 秒待ってください。§r`);
        return;
    }

    // 2. 通報の登録
    if (!reports.has(targetName)) {
        reports.set(targetName, []);
    }
    const targetReports = reports.get(targetName);
    targetReports.push({ from: reporter.name, reason, timestamp: now });
    cooldowns.set(cooldownKey, now);

    // 3. 有効な通報（5分以内）の絞り込み
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const activeReports = targetReports.filter(r => r.timestamp > fiveMinutesAgo);
    reports.set(targetName, activeReports);

    // 有効な通報者数（重複排除）
    const uniqueReporters = new Set(activeReports.map(r => r.from));
    const reportCount = uniqueReporters.size;

    // 4. 判定ロジック
    const allPlayers = world.getAllPlayers();
    const playerCount = allPlayers.length;
    const threshold = Math.max(2, Math.ceil(playerCount * 0.4)); // 40%以上 かつ 最低2人

    reporter.sendMessage(`§a${targetName} を通報しました。§r`);
    console.log(`[Report] ${reporter.name} -> ${targetName} (${reason}). Current Active Reports: ${reportCount}/${threshold}`);

    // Discord通知
    if (reportCount >= threshold) {
        executeKick(targetName, reportCount);
    }
}

/**
 * 指定されたプレイヤーをKickする
 */
function executeKick(targetName, count) {
    const target = world.getPlayers({ name: targetName })[0];
    if (!target) return;

    const kickReason = `§c大量の通報（${count}名以上）を受けたため、緊急Kickされました。§r\n§e再接続可能です。§r`;

    // 全体に通知
    world.sendMessage(`§e[緊急] §c${targetName} は多数のプレイヤーから通報されたため、システムにより退出させられました。§r`);
    DiscordRelay.send(`<@&1401578585650892971> §l§e[緊急Kick]§r §c${targetName}§r は多数の通報（${count}名以上）を受けたため、システムにより自動Kickされました。`);

    // 数秒後にKick（メッセージを読ませるため）
    system.runTimeout(() => {
        try {
            world.getDimension("overworld").runCommand(`kick "${targetName}" ${kickReason}`);
        } catch (e) {
            console.error(`Failed to kick ${targetName}: ${e}`);
        }
    }, 40);
}
