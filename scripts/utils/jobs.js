import * as ui from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import { Util } from "../utils/util";
import { default as config } from "../config/config.js";
import { JobsConfig, JOB_CONFIG } from "../config/jobs_config.js";
function sendActionBar(player, rawtexts) {
    player.onScreenDisplay.setActionBar(rawtexts);
}

function jobLabel(jobId) {
    const name = JobsConfig.jobNames[jobId];
    return name ? { text: name } : { translate: `cw.jobs.${jobId}` };
}

function payJobReward(player, jobId, reward) {
    Util.addMoney(player, reward);
    const score = Util.getMoney(player);
    const name = JobsConfig.jobNames[jobId];
    sendActionBar(player, name
        ? `§a ${name}として¥ ${reward} 獲得！ 残高:￥ ${score}`
        : { translate: `cw.jobs.reward.actionbar.${jobId}`, with: [`${reward}`, `${score}`] });
}




export class Jobs {
    static async showForm(player) {
        const form = new ui.ActionFormData();
        form.title({ translate: "cw.jobsform.title" });

        const playerJobs = player.getTags().filter(tag => tag.startsWith("job:"));

        // JOB_CONFIG からボタンを生成（就職中なら緑色）
        for (const jobId in JobsConfig.jobList) {
            if (player.hasTag(`job:${JobsConfig.jobList[jobId]}`)) {
                form.button({ rawtext: [jobLabel(JobsConfig.jobList[jobId]), { translate: `cw.jobsform.working` }] });
            } else {
                form.button(jobLabel(JobsConfig.jobList[jobId]));
            }
        }

        form.show(player).then((response) => {
            if (response.canceled) return;

            const selectedJobId = JobsConfig.jobList[response.selection];
            if (player.hasTag(`job:${selectedJobId}`)) {
                // すでに就職している → 離職
                player.removeTag(`job:${selectedJobId}`);
                sendActionBar(player, { translate: "cw.jobs.leave", with: { rawtext: [jobLabel(selectedJobId)] } });
            } else {
                // 上限チェック
                if (playerJobs.length >= JobsConfig.JOB_LIMIT) {
                    sendActionBar(player, { translate: "cw.jobs.limit", with: [`${JobsConfig.JOB_LIMIT}`] });
                    return;
                }
                // 新しく就職
                player.addTag(`job:${selectedJobId}`);
                sendActionBar(player, { translate: "cw.jobs.join", with: { rawtext: [jobLabel(selectedJobId)] } });
            }

            system.run(() => Jobs.showForm(player));

        }).catch(error =>
            player.sendMessage("An error occurred: " + error.message)
        );
    }
};
/**
* ブロック破壊時の処理
*/
world.afterEvents.playerBreakBlock.subscribe(ev => {
    const { player, brokenBlockPermutation, itemStackBeforeBreak } = ev;
    const blockId = brokenBlockPermutation.type.id;

    if (player.hasTag("job:farmer")) {
        const crop = JOB_CONFIG.farmer.cropRewards[blockId];
        // シルクタッチで壊すと置き直せるものがあるので、報酬なし
        if (crop
            && (!crop.state || brokenBlockPermutation.getState(crop.state) === crop.ripe)
            && !itemStackBeforeBreak?.getComponent("minecraft:enchantable")?.hasEnchantment("silk_touch")) {
            payJobReward(player, "farmer", crop.reward);
        }
    }

    for (const jobId of ["miner", "lumberjack", "netherdigger"]) { // ← 制限！
        if (!player.hasTag(`job:${jobId}`)) continue;

        const job = JOB_CONFIG[jobId];
        if (!job || !job.blockRewards) continue;

        if (jobId === "miner") {
            const enchantable = itemStackBeforeBreak?.getComponent("minecraft:enchantable");
            if (enchantable?.hasEnchantment("silk_touch")) continue; // シルクタッチ採掘は報酬なし
        }

        const rewardInfo = Object.entries(job.blockRewards).find(([key]) => blockId.includes(key));
        if (rewardInfo) {
            const reward = rewardInfo[1];
            Util.addMoney(player, reward);
            const score = Util.getMoney(player);
            sendActionBar(player, [
                {
                    translate: `cw.jobs.reward.actionbar.${jobId}`,
                    with: [
                        `${reward}`,
                        `${score}`
                    ]
                }
            ]);
        }

    }
});

/**
 * ブロック設置時の処理
 * → 建築者(builder)のみ
 */
world.afterEvents.playerPlaceBlock.subscribe(ev => {
    const { player, block } = ev;
    const blockId = block.typeId;

    for (const jobId of ["builder"]) { // ← 制限！
        if (!player.hasTag(`job:${jobId}`)) continue;

        const job = JOB_CONFIG[jobId];
        if (!job || !job.blockRewards) continue;

        const rewardInfo = Object.entries(job.blockRewards).find(([key]) => blockId.includes(key));
        if (rewardInfo) {
            const reward = rewardInfo[1];
            Util.addMoney(player, reward);
            const score = Util.getMoney(player);
            sendActionBar(player, [
                {
                    translate: `cw.jobs.reward.actionbar.${jobId}`,
                    with: [
                        `${reward}`,
                        `${score}`
                    ]
                }
            ]);
        }

    }
});

/**
 * Mob討伐時の処理
 */
world.afterEvents.entityDie.subscribe(ev => {
    const { deadEntity, damageSource } = ev;
    const killer = damageSource.damagingEntity;
    if (!killer || killer.typeId !== "minecraft:player") return;

    const mobId = deadEntity.typeId;

    for (const jobId of ["hunter"]) { // ← 制限！
        if (!killer.hasTag(`job:${jobId}`)) continue;

        const job = JOB_CONFIG[jobId];
        if (!job || !job.mobRewards) continue;

        const reward = job.mobRewards[mobId];
        if (reward !== undefined) {
            Util.addMoney(killer, reward);
            const score = Util.getMoney(killer);
            sendActionBar(killer, [
                {
                    translate: `cw.jobs.reward.actionbar.${jobId}`,
                    with: [
                        `${reward}`,
                        `${score}`
                    ]
                }
            ]);
        }

    }
});

/**
 * 釣りの処理
 * Script API に釣りのイベントはないので、浮きから判定する。釣れたときは、竿を引いた tick に
 * 浮きが消え、浮きと同じ座標に釣れた物のアイテムが出る（手で捨てた物は座標が違う）。
 */
const fisherHooks = new Map(); // 漁師の浮きの id → 持ち主
let removedHooks = []; // 消えたばかりの漁師の浮き

world.beforeEvents.entityRemove.subscribe(({ removedEntity }) => {
    if (fisherHooks.size === 0) return;
    const player = fisherHooks.get(removedEntity.id);
    if (!player) return;
    fisherHooks.delete(removedEntity.id);
    removedHooks.push({
        player,
        tick: system.currentTick,
        location: removedEntity.location,
        dimensionId: removedEntity.dimension.id
    });
});

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (!entity.isValid) return;
    const typeId = entity.typeId;

    if (typeId === "minecraft:fishing_hook") {
        const owner = entity.getComponent("minecraft:projectile")?.owner;
        if (owner?.typeId === "minecraft:player" && owner.hasTag("job:fisher")) {
            fisherHooks.set(entity.id, owner);
        }
        return;
    }
    if (typeId !== "minecraft:item" || removedHooks.length === 0) return;

    removedHooks = removedHooks.filter(hook => system.currentTick - hook.tick <= 1);
    const { x, y, z } = entity.location;
    const index = removedHooks.findIndex(hook =>
        hook.dimensionId === entity.dimension.id
        && Math.abs(hook.location.x - x) < 0.1
        && Math.abs(hook.location.y - y) < 0.1
        && Math.abs(hook.location.z - z) < 0.1
    );
    if (index < 0) return;

    const [{ player }] = removedHooks.splice(index, 1);
    if (!player.isValid) return;
    const itemId = entity.getComponent("minecraft:item")?.itemStack?.typeId;
    const { catchRewards, otherCatchReward } = JOB_CONFIG.fisher;
    payJobReward(player, "fisher", catchRewards[itemId] ?? otherCatchReward);
});
