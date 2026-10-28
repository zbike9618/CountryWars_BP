import { world, system } from "@minecraft/server";

// 空中ジャンプの最大可能回数（1 = 2段ジャンプ）
const MAX_AIR_JUMPS = 1;

// プレイヤーごとの空中ジャンプ使用回数を保持するMap
const airJumpCounts = new Map();

/**
 * プレイヤーがファントムブーツを足に装備しているか、または手持ちスロットにあるかを判定
 */
function hasPhantomBoots(player) {
    // 1. 足スロットの装備をチェック
    const equippable = player.getComponent("minecraft:equippable");
    if (equippable) {
        const feetItem = equippable.getEquipment("Feet");
        if (feetItem?.typeId === "cw:phantom_boots") return true;
    }

    // 2. メインハンド（手持ち）をチェック
    const inventory = player.getComponent("minecraft:inventory");
    if (inventory?.container) {
        const item = inventory.container.getItem(player.selectedSlotIndex);
        if (item?.typeId === "cw:phantom_boots") return true;
    }

    return false;
}

/**
 * プレイヤーに関連するMapデータを完全に削除・クリーンアップ
 * @param {string} playerId 
 */
function cleanupPlayer(playerId) {
    airJumpCounts.delete(playerId);
}

// 毎tick、Mapにデータが存在する場合に状態を検証し、不要・未使用のデータを確実にdelete
system.runInterval(() => {
    if (airJumpCounts.size === 0) return;

    for (const [playerId] of airJumpCounts) {
        const player = world.getEntity(playerId);

        // プレイヤーが存在しない、または無効な場合は即座にdelete
        if (!player || !player.isValid) {
            cleanupPlayer(playerId);
            continue;
        }

        // 地面に着地している、またはブーツを使っていない（装備・手持ちから外した）場合はdelete
        if (player.isOnGround || !hasPhantomBoots(player)) {
            cleanupPlayer(playerId);
        }
    }
}, 1);

// プレイヤー退出時のメモリクリーンアップ
world.afterEvents.playerLeave.subscribe((ev) => {
    cleanupPlayer(ev.playerId);
});

// プレイヤー死亡時のクリーンアップ
world.afterEvents.entityDie.subscribe((ev) => {
    if (ev.deadEntity?.typeId === "minecraft:player") {
        cleanupPlayer(ev.deadEntity.id);
    }
});

// ボタン入力検知
world.afterEvents.playerButtonInput.subscribe((ev) => {
    // ジャンプボタンかつボタンが押された瞬間のみ処理
    if (ev.button !== "Jump") return;
    if (ev.buttonState && ev.buttonState !== "Pressed") return;

    const player = ev.player;
    if (!player || !player.isValid) return;

    // ファントムブーツを装備または保持しているか
    if (!hasPhantomBoots(player)) return;

    // 地上にいる場合は通常のジャンプなので空中ジャンプは行わない
    if (player.isOnGround) return;

    // 回数制限チェック
    const currentJumps = airJumpCounts.get(player.id) ?? 0;
    if (currentJumps >= MAX_AIR_JUMPS) return;

    // 空中ジャンプ回数をカウント
    airJumpCounts.set(player.id, currentJumps + 1);

    // 落下中でも安定して跳べるよう速度をクリア（メソッドが利用可能な場合）
    player.clearVelocity?.();

    // 上方向へインパルスを付与
    player.applyImpulse({ x: 0, y: 0.4, z: 0 });

    // ファントムの羽ばたき音と煙パーティクル演出
    try {
        player.playSound("mob.phantom.flap", { volume: 0.6, pitch: 1.2 });
        player.dimension.spawnParticle("minecraft:basic_smoke_particle", {
            x: player.location.x,
            y: player.location.y + 0.1,
            z: player.location.z
        });
    } catch (e) { }
});