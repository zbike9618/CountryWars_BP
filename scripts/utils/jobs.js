import * as ui from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import { JOB_CONFIG, JOB_LIMIT } from "../config/jobs_config.js";
import { Util } from "../utils/util";
import { default as config } from "../config/config.js";
function sendActionBar(player, message) {
    player.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"${message}"}]}`);
}

export class Jobs {
    static async showForm(player) {
        const form = new ui.ActionFormData();
        form.title("職業選択");

        const playerJobs = player.getTags().filter(tag => tag.startsWith("job:"));

        // JOB_CONFIG からボタンを生成（就職中なら緑色）
        for (const jobId in JOB_CONFIG) {
            const job = JOB_CONFIG[jobId];
            if (player.hasTag(`job:${jobId}`)) {
                form.button(`§a${job.name}（就職中）`);
            } else {
                form.button(job.name);
            }
        }

        form.show(player).then((response) => {
            if (response.canceled) return;

            const selectedJobId = Object.keys(JOB_CONFIG)[response.selection];
            const selectedJob = JOB_CONFIG[selectedJobId];

            if (player.hasTag(`job:${selectedJobId}`)) {
                // すでに就職している → 離職
                player.removeTag(`job:${selectedJobId}`);
                sendActionBar(player, `§e職業「${selectedJob.name}」を辞めました`);
            } else {
                // 上限チェック
                if (playerJobs.length >= JOB_LIMIT) {
                    sendActionBar(player, `§c職業は最大 ${JOB_LIMIT} 個までです！`);
                    return;
                }
                // 新しく就職
                player.addTag(`job:${selectedJobId}`);
                sendActionBar(player, `§a職業「${selectedJob.name}」に就きました！`);
            }

            system.run(() => Jobs.showForm(player));

        }).catch(error =>
            player.sendMessage("An error occurred: " + error.message)
        );
    }
    static async jobs() {
        /**
 * ブロック破壊時の処理
 */
        world.afterEvents.playerBreakBlock.subscribe(ev => {
            const { player, brokenBlockPermutation } = ev;
            const blockId = brokenBlockPermutation.type.id;

            for (const jobId of ["miner", "lumberjack", "farmer", "netherdigger"]) { // ← 制限！
                if (!player.hasTag(`job:${jobId}`)) continue;

                const job = JOB_CONFIG[jobId];
                if (!job.blockRewards) continue;

                const reward = job.blockRewards[blockId];
                if (reward !== undefined) {
                    Util.addMoney(player, reward)
                    const score = Util.getMoney(player);
                    player.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"§a${job.name}として${config.coinname}${reward}獲得！ 残高: ${config.coinname}${score}"}]}`);

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
                if (!job.blockRewards) continue;

                const reward = job.blockRewards[blockId];
                if (reward !== undefined) {
                    Util.addMoney(player, reward)
                    const score = Util.getMoney(player);
                    player.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"§a${job.name}として${config.coinname}${reward}獲得！ 残高: ${config.coinname}${score}"}]}`);

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
                if (!job.mobRewards) continue;

                const reward = job.mobRewards[mobId];
                if (reward !== undefined) {
                    Util.addMoney(killer, reward)
                    const score = Util.getMoney(killer);
                    killer.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"§a${job.name}として${config.coinname}${reward}獲得！ 残高: ${config.coinname}${score}"}]}`);

                }
            }
        });
    }
}
