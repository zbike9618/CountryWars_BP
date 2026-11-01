import { world, system, EntityDamageCause } from "@minecraft/server";

const TARGET_ITEM_ID = "cw:cursed_sword";
const GAUGE_PER_HIT = 5;            // 攻撃1回ごとのゲージ蓄積量 (+5%)
const RAMPAGE_DURATION_TICKS = 200; // 暴走持続時間: 10秒 (200 ticks)
const RAMPAGE_TICK_STEP = 20;       // 1秒 (20 ticks) ごとに継続ダメージ & パーティクル
const RAMPAGE_DAMAGE = 1;           // 暴走時の1秒ごとの自傷ダメージ (ハート半分)
const RECOIL_CHANCE = 0.35;         // 75〜99%時の自傷確率 (35%)
const RECOIL_DAMAGE = 2;            // 反動自傷ダメージ (ハート1個分)

// 状態管理Map (リーク防止のため退出・死亡時に完全削除)
const curseGaugeMap = new Map(); // playerId -> number (0〜100)
const rampageMap = new Map();    // playerId -> { endTick: number, sequenceId: number }

let sequenceCounter = 0;

/**
 * プレイヤーIDからオンラインプレイヤーを取得
 * @param {string} playerId 
 * @returns {import("@minecraft/server").Player | undefined}
 */
function getPlayerById(playerId) {
    for (const player of world.getAllPlayers()) {
        if (player.id === playerId) return player;
    }
    return undefined;
}

/**
 * 紫色の呪いパーティクルを発生
 * @param {import("@minecraft/server").Entity} entity 
 */
function spawnPurpleParticles(entity) {
    try {
        const dim = entity.dimension;
        const loc = entity.location;
        dim.spawnParticle("minecraft:witch_spell_particle", { x: loc.x, y: loc.y + 1, z: loc.z });
        dim.spawnParticle("minecraft:dragon_breath_fire", { x: loc.x, y: loc.y + 1.2, z: loc.z });
        dim.spawnParticle("minecraft:portal_directional_particle", { x: loc.x, y: loc.y + 0.8, z: loc.z });
    } catch { }
}

/**
 * 呪いゲージと段階に応じたアクションバー表示
 * @param {import("@minecraft/server").Player} player 
 * @param {number} gauge 
 * @param {boolean} playSound 
 */
function displayCurseActionBar(player, gauge, playSound = false) {
    let msg = "";
    if (gauge >= 75) {
        msg = `§5【呪いの侵食】 §c${gauge}% §4[攻撃力+10 / 反動侵食]`;
    } else if (gauge >= 50) {
        msg = `§5【呪いの侵食】 §6${gauge}% §c[攻撃力+6 / 鈍足]`;
    } else if (gauge >= 25) {
        msg = `§5【呪いの侵食】 §e${gauge}% §a[攻撃力+3]`;
    } else {
        msg = `§5【呪いの侵食】 §7${gauge}% [通常]`;
    }
    player.onScreenDisplay?.setActionBar(msg);
    if (playSound) {
        player.playSound("ambient.weather.thunder", { volume: 0.2, pitch: 2.0 });
    }
}

/**
 * 100% 呪いの暴走開始
 * @param {import("@minecraft/server").Player} player 
 */
function startRampage(player) {
    const sequenceId = ++sequenceCounter;
    const endTick = system.currentTick + RAMPAGE_DURATION_TICKS;
    rampageMap.set(player.id, { endTick, sequenceId });
    curseGaugeMap.set(player.id, 100);

    // 暴走開始演出
    player.playSound("mob.wither.spawn", { volume: 0.8, pitch: 1.1 });
    player.playSound("ambient.weather.thunder", { volume: 0.7, pitch: 1.4 });
    player.onScreenDisplay?.setActionBar("§5§l【呪いの暴走】 呪いが暴走した！ (10秒間)");
    spawnPurpleParticles(player);

    // 1秒ごとの処理を runTimeout で連鎖実行 (runIntervalは一切不使用)
    system.runTimeout(() => {
        runRampageStep(player.id, sequenceId);
    }, RAMPAGE_TICK_STEP);
}

/**
 * 暴走中の1秒ごとの継続処理
 * @param {string} playerId 
 * @param {number} sequenceId 
 */
function runRampageStep(playerId, sequenceId) {
    const state = rampageMap.get(playerId);
    if (!state || state.sequenceId !== sequenceId) {
        return; // キャンセルまたは既に終了
    }

    const player = getPlayerById(playerId);
    if (!player || !player.isValid) {
        rampageMap.delete(playerId);
        curseGaugeMap.delete(playerId);
        return;
    }

    // 暴走時間終了判定
    if (system.currentTick >= state.endTick) {
        endRampage(player);
        return;
    }

    try {
        // 使用者への継続ダメージ
        player.applyDamage(RAMPAGE_DAMAGE, { cause: EntityDamageCause.magic });
        spawnPurpleParticles(player);
        player.playSound("mob.wither.hurt", { volume: 0.3, pitch: 1.5 });

        const remainingSec = Math.max(1, Math.ceil((state.endTick - system.currentTick) / 20));
        player.onScreenDisplay?.setActionBar(`§5§l【呪いの暴走】 100% §d残り ${remainingSec}秒 §4[超強化+16 / 侵食ダメージ]`);
    } catch { }

    // 次のステップを予約
    system.runTimeout(() => {
        runRampageStep(playerId, sequenceId);
    }, RAMPAGE_TICK_STEP);
}

/**
 * 暴走終了処理 (ゲージリセット)
 * @param {import("@minecraft/server").Player} player 
 */
function endRampage(player) {
    rampageMap.delete(player.id);
    curseGaugeMap.delete(player.id); // 0%にリセット (Mapから完全削除)
    try {
        player.playSound("random.fizz", { volume: 0.8, pitch: 0.8 });
        player.onScreenDisplay?.setActionBar("§a§l呪いの暴走が収まり、呪いゲージがリセットされた。");
    } catch { }
}

// プレイヤー退出時のMap完全削除
world.afterEvents.playerLeave.subscribe((ev) => {
    curseGaugeMap.delete(ev.playerId);
    rampageMap.delete(ev.playerId);
});

// プレイヤー死亡時のMap完全削除
world.afterEvents.entityDie.subscribe((ev) => {
    if (ev.deadEntity?.typeId === "minecraft:player") {
        curseGaugeMap.delete(ev.deadEntity.id);
        rampageMap.delete(ev.deadEntity.id);
    }
});

// 攻撃前の判定: 段階に応じた攻撃力上昇
world.beforeEvents.entityHurt.subscribe((ev) => {
    try {
        const attacker = ev.damageSource.damagingEntity;
        if (!attacker || !attacker.isValid || attacker.typeId !== "minecraft:player") return;

        const equippable = attacker.getComponent("minecraft:equippable");
        const mainhand = equippable?.getEquipment("Mainhand");
        if (!mainhand || mainhand.typeId !== TARGET_ITEM_ID) return;

        const isRampage = rampageMap.has(attacker.id);
        const gauge = isRampage ? 100 : (curseGaugeMap.get(attacker.id) ?? 0);

        let bonusDamage = 0;
        if (isRampage) {
            bonusDamage = 16; // 100%: 攻撃力大幅上昇
        } else if (gauge >= 75) {
            bonusDamage = 10; // 75〜99%: 大幅に攻撃力上昇
        } else if (gauge >= 50) {
            bonusDamage = 6;  // 50〜74%: 攻撃力がさらに上昇
        } else if (gauge >= 25) {
            bonusDamage = 3;  // 25〜49%: 攻撃力上昇
        }

        if (bonusDamage > 0) {
            ev.damage += bonusDamage;
        }
    } catch (e) {
        console.error("cursed_sword beforeHurt error:", e);
    }
});

// 攻撃命中時の追加効果 & ゲージ蓄積
world.afterEvents.entityHitEntity.subscribe((ev) => {
    try {
        const attacker = ev.damagingEntity;
        const target = ev.hitEntity;
        if (!attacker || !attacker.isValid || attacker.typeId !== "minecraft:player") return;
        if (!target || !target.isValid || target.typeId === "minecraft:armor_stand") return;

        const equippable = attacker.getComponent("minecraft:equippable");
        const mainhand = equippable?.getEquipment("Mainhand");
        if (!mainhand || mainhand.typeId !== TARGET_ITEM_ID) return;

        // 暴走中の攻撃
        if (rampageMap.has(attacker.id)) {
            spawnPurpleParticles(attacker);
            spawnPurpleParticles(target);
            attacker.playSound("item.mace.smash_ground_heavy", { location: target.location, volume: 0.9, pitch: 1.2 });
            return;
        }

        // 呪いゲージ蓄積 (+5%)
        const prevGauge = curseGaugeMap.get(attacker.id) ?? 0;
        const newGauge = Math.min(100, prevGauge + GAUGE_PER_HIT);
        curseGaugeMap.set(attacker.id, newGauge);

        // 100% 到達判定
        if (newGauge >= 100) {
            startRampage(attacker);
            return;
        }

        // 段階別効果
        if (newGauge >= 75) {
            // 75〜99%: 確率で自分もダメージ
            if (Math.random() < RECOIL_CHANCE) {
                attacker.applyDamage(RECOIL_DAMAGE, { cause: EntityDamageCause.magic });
                attacker.playSound("mob.warden.heartbeat", { volume: 0.8, pitch: 1.2 });
                attacker.dimension.spawnParticle("minecraft:critical_hit_emitter", {
                    x: attacker.location.x,
                    y: attacker.location.y + 1,
                    z: attacker.location.z
                });
            }
            attacker.playSound("ambient.weather.thunder", { volume: 0.3, pitch: 1.8 });
        } else if (newGauge >= 50) {
            // 50〜74%: 移動速度低下 (Slowness I 2.5秒付与)
            attacker.addEffect("slowness", 50, { amplifier: 0, showParticles: false });
            attacker.playSound("mob.wither.hurt", { volume: 0.3, pitch: 1.6 });
        } else if (newGauge >= 25) {
            attacker.playSound("random.orb", { volume: 0.4, pitch: 0.8 });
        }

        displayCurseActionBar(attacker, newGauge, false);
    } catch (e) {
        console.error("cursed_sword hitEntity error:", e);
    }
});

// 右クリック (アイテム使用): 現在の呪いゲージ状態の確認
world.afterEvents.itemUse.subscribe((ev) => {
    try {
        const player = ev.source;
        if (!player || !player.isValid || player.typeId !== "minecraft:player") return;
        if (ev.itemStack.typeId !== TARGET_ITEM_ID) return;

        const isRampage = rampageMap.has(player.id);
        if (isRampage) {
            const state = rampageMap.get(player.id);
            const remainingSec = state ? Math.max(1, Math.ceil((state.endTick - system.currentTick) / 20)) : 0;
            player.onScreenDisplay?.setActionBar(`§5§l【呪いの暴走】 100% §d残り ${remainingSec}秒 §4[超強化+16 / 侵食ダメージ]`);
            player.playSound("mob.wither.hurt", { volume: 0.3, pitch: 1.5 });
        } else {
            const gauge = curseGaugeMap.get(player.id) ?? 0;
            displayCurseActionBar(player, gauge, true);
        }
    } catch (e) {
        console.error("cursed_sword itemUse error:", e);
    }
});
