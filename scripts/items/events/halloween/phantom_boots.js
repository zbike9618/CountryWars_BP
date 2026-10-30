import { world, system } from "@minecraft/server";

// 空中ジャンプの最大可能回数（1 = 2段ジャンプ）
const MAX_AIR_JUMPS = 2;

// プレイヤーごとのジャンプ状態を保持するMap
// Map<playerId, { airJumps: number, hasGroundJumped: boolean }>
const playerJumpData = new Map();

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
    playerJumpData.delete(playerId);
}

// 毎tick、着地したプレイヤーや使っていないプレイヤーのデータを確実にdelete
system.runInterval(() => {
    if (playerJumpData.size === 0) return;

    for (const [playerId] of playerJumpData) {
        const player = world.getEntity(playerId);

        // プレイヤーが存在しない、または無効な場合は即座にdelete
        if (!player || !player.isValid) {
            cleanupPlayer(playerId);
            continue;
        }

        // 地面に着地している、またはブーツを使っていない場合はdelete
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
    if (ev.newButtonState && ev.newButtonState !== "Pressed") return;

    const player = ev.player;
    if (!player || !player.isValid) return;

    // ファントムブーツを装備または保持しているか
    if (!hasPhantomBoots(player)) return;

    // 完全に地上にいる場合はバニラのジャンプに任せる
    if (player.isOnGround) return;

    // プレイヤーのジャンプ状態を取得
    const data = playerJumpData.get(player.id) ?? { airJumps: 0, hasGroundJumped: false };
    const velocity = player.getVelocity();

    // 【重要】地上で押したジャンプ入力がサーバーに届く頃には、バニラの上昇によって約0.82m浮いてしまっている。
    // この最初の検知（上昇中かつ地上ジャンプ未記録）は「地上ジャンプ」の入力なので、空中ジャンプは発動せず記録のみ行う。
    if (!data.hasGroundJumped && velocity.y != 0) {
        data.hasGroundJumped = true;
        playerJumpData.set(player.id, data);
        return;
    }

    // 回数制限チェック
    if (data.airJumps >= MAX_AIR_JUMPS) return;

    // 空中ジャンプ実行
    data.hasGroundJumped = true;
    data.airJumps++;
    playerJumpData.set(player.id, data);

    // 落下中でも安定して跳べるよう速度をクリア（メソッドが利用可能な場合）
    player.clearVelocity?.();

    // 上方向へインパルスを付与
    player.applyImpulse({ x: 0, y: 0.6, z: 0 });

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