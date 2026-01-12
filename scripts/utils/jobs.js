import * as ui from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import { Util } from "../utils/util";
import { default as config } from "../config/config.js";
import { JobsConfig, JOB_CONFIG } from "../config/jobs_config.js";
function sendActionBar(player, rawtexts) {
    player.onScreenDisplay.setActionBar({ rawtext: rawtexts });
}




export class Jobs {
    static async showForm(player) {
        const form = new ui.ActionFormData();
        form.title({ translate: "cw.jobsform.title" });

        const playerJobs = player.getTags().filter(tag => tag.startsWith("job:"));

        // JOB_CONFIG からボタンを生成（就職中なら緑色）
        for (const jobId in JobsConfig.jobList) {
            if (player.hasTag(`job:${JobsConfig.jobList[jobId]}`)) {
                form.button({ rawtext: [{ translate: `cw.jobs.${JobsConfig.jobList[jobId]}` }, { translate: `cw.jobsform.working` }] });
            } else {
                form.button({ translate: `cw.jobs.${JobsConfig.jobList[jobId]}` });
            }
        }

        form.show(player).then((response) => {
            if (response.canceled) return;

            const selectedJobId = JobsConfig.jobList[response.selection];
            if (player.hasTag(`job:${selectedJobId}`)) {
                // すでに就職している → 離職
                player.removeTag(`job:${selectedJobId}`);
                sendActionBar(player, { translate: "cw.jobs.leave", with: [selectedJobId] });
            } else {
                // 上限チェック
                if (playerJobs.length >= JobsConfig.JOB_LIMIT) {
                    sendActionBar(player, { translate: "cw.jobs.limit", with: [`${JobsConfig.JOB_LIMIT}`] });
                    return;
                }
                // 新しく就職
                player.addTag(`job:${selectedJobId}`);
                sendActionBar(player, { translate: "cw.jobs.join", with: [selectedJobId] });
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
    const { player, brokenBlockPermutation } = ev;
    const blockId = brokenBlockPermutation.type.id;

    for (const jobId of ["miner", "lumberjack", "farmer", "netherdigger"]) { // ← 制限！
        if (!player.hasTag(`job:${jobId}`)) continue;

        const job = JOB_CONFIG[jobId];
        if (!job || !job.blockRewards) continue;

        const reward = job.blockRewards[blockId];
        if (reward !== undefined) {
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
 * → 建築者(builder)と農夫(farmer)のみ
 */
world.afterEvents.playerPlaceBlock.subscribe(ev => {
    const { player, block } = ev;
    const blockId = block.typeId;

    for (const jobId of ["builder", "farmer"]) { // ← 制限！
        if (!player.hasTag(`job:${jobId}`)) continue;

        const job = JOB_CONFIG[jobId];
        if (!job || !job.blockRewards) continue;

        const reward = job.blockRewards[blockId];
        if (reward !== undefined) {
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
    const killer = damageSource?.damagingEntity;
    if (!killer) return;

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