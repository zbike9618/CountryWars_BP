import { world, system, EquipmentSlot } from "@minecraft/server";

// 銃エイム セッション管理 Map: playerId -> { original: { amplifier: number, expireTick: number } | null }
const aimingSessions = new Map();

// 復活addEffect実行中のプレイヤー Set (beforeEvents再トリガー防止)
const restoringPlayers = new Set();

/**
 * プレイヤーが現在銃 (trenbankai:*) を所持してスニーク中 (エイム中) か判定
 * @param {import("@minecraft/server").Player} player
 * @returns {boolean}
 */
function isGunAiming(player) {
    if (!player.isValid) return false;
    if (!player.isSneaking) return false;

    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return false;

    const held = equippable.getEquipment(EquipmentSlot.Mainhand);
    return held ? held.typeId.startsWith("trenbankai:") : false;
}

// =============================================================
// beforeEvents: 既存slowness を判定し、エイム開始時にオリジナルエフェクトを記録
// =============================================================
world.beforeEvents.effectAdd.subscribe((ev) => {
    if (ev.effectType !== "slowness") return;
    const player = ev.entity;
    if (!player || player.typeId !== "minecraft:player") return;

    // 復活処理中は再トリガーしない
    if (restoringPlayers.has(player.id)) return;

    // 銃エイム中で、かつセッションが未作成の場合（スニーク直後にeffectAddが発火した場合）
    if (isGunAiming(player) && !aimingSessions.has(player.id)) {
        const existing = player.getEffect("slowness");
        const original = existing
            ? { amplifier: existing.amplifier, expireTick: system.currentTick + existing.duration }
            : null;
        aimingSessions.set(player.id, { original });
    }
});

// =============================================================
// 毎tickループ: エイム開始 / 終了の検知とオリジナルエフェクトの復元
// =============================================================
system.runInterval(() => {
    const currentOnlinePlayerIds = new Set();

    for (const player of world.getAllPlayers()) {
        currentOnlinePlayerIds.add(player.id);
        const aiming = isGunAiming(player);
        const hasSession = aimingSessions.has(player.id);

        if (aiming && !hasSession) {
            // エイム開始: 元々受けていた slowness を保存 (無ければ null)
            const existing = player.getEffect("slowness");
            const original = existing
                ? { amplifier: existing.amplifier, expireTick: system.currentTick + existing.duration }
                : null;
            aimingSessions.set(player.id, { original });
        } else if (!aiming && hasSession) {
            // エイム終了: セッションを取り出して元々のエフェクトがあれば復元
            const session = aimingSessions.get(player.id);
            aimingSessions.delete(player.id);
            restoreOriginalEffectIfNeeded(player, session);
        }
    }

    // サーバー離脱者のセッションクリーンアップ
    for (const id of aimingSessions.keys()) {
        if (!currentOnlinePlayerIds.has(id)) {
            aimingSessions.delete(id);
        }
    }
}, 1);

/**
 * エイム終了時に、エイム開始前に存在していた元の slowness を復元する
 * @param {import("@minecraft/server").Player} player
 * @param {{ original: { amplifier: number, expireTick: number } | null }} session
 */
function restoreOriginalEffectIfNeeded(player, session) {
    if (!session || !session.original) return;
    if (!player.isValid) return;

    const remainingDuration = session.original.expireTick - system.currentTick;
    if (remainingDuration <= 0) return;

    // 銃アドオンのエフェクト削除処理とのバッティングを防ぐため 1 tick 遅延させて復元
    system.run(() => {
        if (!player.isValid) return;
        restoringPlayers.add(player.id);
        try {
            player.addEffect("slowness", remainingDuration, {
                amplifier: session.original.amplifier,
                showParticles: true
            });
        } catch (e) {
            // プレイヤーが非有効状態の場合はスキップ
        }
        system.run(() => {
            restoringPlayers.delete(player.id);
        });
    });
}


