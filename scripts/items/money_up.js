import { world, system } from "@minecraft/server";

// money_up バフの定数
const BUFF_DURATION_TICKS = 30 * 60 * 20; // 30分 (20tick/s)
const MONEY_MULTIPLIER = 5;
const BUFF_TAG = "money_up_active";
const BUFF_EXPIRE_KEY = "money_up_expire";

/**
 * money_up の有効期限をDynamicPropertyに保存
 */
function setBuffExpire(player, expireTick) {
    player.setDynamicProperty(BUFF_EXPIRE_KEY, expireTick);
}

/**
 * money_up バフが有効かどうかを確認
 */
export function isMoneyUpActive(player) {
    const expire = player.getDynamicProperty(BUFF_EXPIRE_KEY);
    if (expire === undefined || expire === null) return false;
    return system.currentTick < expire;
}

/**
 * money_up 残り時間を秒で返す
 */
export function getMoneyUpRemaining(player) {
    const expire = player.getDynamicProperty(BUFF_EXPIRE_KEY);
    if (expire === undefined || expire === null) return 0;
    const remaining = expire - system.currentTick;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / 20);
}

// 右クリックで使用
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const itemStack = event.itemStack;

    if (itemStack.typeId !== "cw:money_up") return;

    const now = system.currentTick;
    const expire = player.getDynamicProperty(BUFF_EXPIRE_KEY);

    // 既にバフ中なら残り時間を延長（重ね掛け）
    const currentExpire = (expire !== undefined && expire !== null && expire > now) ? expire : now;
    const newExpire = currentExpire + BUFF_DURATION_TICKS;

    setBuffExpire(player, newExpire);

    // アイテムを1個消費
    system.run(() => {
        const inv = player.getComponent("minecraft:inventory");
        if (!inv || !inv.container) return;
        const slot = player.selectedSlotIndex;
        const item = inv.container.getItem(slot);
        if (!item || item.typeId !== "cw:money_up") return;
        if (item.amount <= 1) {
            inv.container.setItem(slot, undefined);
        } else {
            item.amount -= 1;
            inv.container.setItem(slot, item);
        }
    });

    const remainingSec = Math.ceil((newExpire - now) / 20);
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;

    player.sendMessage(`§6§l[MoneyUp] §r§eJobs報酬が §c§l${MONEY_MULTIPLIER}倍 §r§eになりました！`);
    player.sendMessage(`§7残り時間: §a${mins}分${secs}秒`);
    player.onScreenDisplay.setActionBar(`§6⚡ MoneyUp §a有効中 §7(残 ${mins}分${secs}秒)`);
});

// バフの状態をアクションバーに定期表示（20秒ごと）
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!isMoneyUpActive(player)) continue;

        const remainingSec = getMoneyUpRemaining(player);
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        // アクションバーに通知（他のアクションバーと競合する可能性があるので軽量に）
        // 期限切れ間際（60秒以下）に警告
        if (remainingSec <= 60 && remainingSec > 0) {
            player.onScreenDisplay.setActionBar(`§c⚡ MoneyUp §e残り ${secs}秒！`);
        }
    }
}, 200); // 10秒ごと
