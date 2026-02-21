import * as server from "@minecraft/server"
const { world, system } = server;
import { MessageFormData } from "@minecraft/server-ui";
import { Chunk } from "./chunk.js";
import { Dypro } from "./dypro.js";
import { Util } from "./util.js";
import { Country } from "./country.js";
import config from "../config/config.js";
import { DiscordRelay } from "./chat.js";
const countryDatas = new Dypro("country");
const playerDatas = new Dypro("player");
export class War {
    /**
     * 人数バランスが取れているか確認
     * @param {number} p1 
     * @param {number} p2 
     * @returns {boolean}
     */
    static isBalanced(p1, p2) {
        if (p1 === 0 || p2 === 0) return false; // 誰もいない国は不可
        const diff = Math.abs(p1 - p2);
        // 誤差が2人以内、または人数の多い方の50%以内ならバランスが良いとみなす
        const threshold = Math.max(2, Math.ceil(Math.max(p1, p2) * 0.5));
        return diff <= threshold;
    }

    /**
     * 国が戦争保護期間中か確認
     * @param {Object} countryData
     * @returns {boolean}
     */
    static isProtected(countryData) {
        if (!countryData || !countryData.buildtime) return false;
        const now = Date.now();
        const protectionEnd = countryData.buildtime + (config.warProtectionPeriod * 24 * 60 * 60 * 1000);
        return now < protectionEnd;
    }

    /**
     * 国王による戦争保護の解除フォーム
     * @param {server.Player} player
     * @param {Object} countryData
     */
    static async cancelProtectionForm(player, countryData) {
        if (player.id !== countryData.owner) {
            player.sendMessage({ translate: "cw.scform.protection.cancel.noowner" });
            return;
        }
        if (!this.isProtected(countryData)) {
            player.sendMessage({ translate: "cw.scform.protection.cancel.already" });
            return;
        }

        const now = Date.now();
        const defeatCutoff = (countryData.lastDefeated || 0) + (config.warProtectionPeriod * 24 * 60 * 60 * 1000);
        if (now < defeatCutoff) {
            const rem = defeatCutoff - now;
            player.sendMessage({ translate: "cw.scform.protection.cancel.defeated", with: [Util.formatTime(rem)] });
            return;
        }

        const form = new MessageFormData();
        form.title({ translate: "cw.scform.protection.cancel" });
        form.body({ translate: "cw.scform.protection.cancel.confirm" });
        form.button1({ translate: "cw.form.yes" });
        form.button2({ translate: "cw.form.no" });

        const res = await form.show(player);
        if (res.canceled || res.selection === 1) return;

        countryData.buildtime = 0;
        countryDatas.set(countryData.id, countryData);
        player.sendMessage({ translate: "cw.scform.protection.cancel.success" });
    }

    static CanInvade(player, countryData) {
        const chunkId = Chunk.positionToChunkId(player.location)
        const chunk = Chunk.checkChunk(chunkId);
        const dimension = player.dimension;
        if (chunk == "wasteland" || chunk == "admin") return false;
        const enemycountryData = countryDatas.get(chunk);
        if (enemycountryData && enemycountryData.id == countryData.id) return false;

        // 周囲8チャンクの所有状況を確認
        const [cx, cz] = chunkId.split("_").map(Number);
        let enemyNeighborCount = 0;
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                if (x === 0 && z === 0) continue;
                const neighborId = `${cx + x}_${cz + z}`;
                if (Chunk.checkChunk(neighborId) === enemycountryData.id) {
                    enemyNeighborCount++;
                }
            }
        }
        if (enemyNeighborCount >= 5) {
            player.sendMessage({ translate: "cw.war.invade.cancel.surrounded" });
            return false;
        }

        const entities = dimension.getEntities({ location: player.location, maxDistance: 60 }).filter(e => e.typeId == "cw:core");
        for (const e of entities) {
            const coreChunkId = Chunk.positionToChunkId(e.location)
            if (coreChunkId == chunkId) {
                return false;
            }
        }

        if (countryData.warcountry.includes(enemycountryData.id)) return true;

    }
    /**
     * 戦闘を開始する
     * @param {server.Player} player 
     * @param {Object} countryData 
     */
    static invade(player, countryData) {
        const enemyCountryData = countryDatas.get(Chunk.checkChunk(Chunk.positionToChunkId(player.location)));
        const dimension = player.dimension;
        const core = dimension.spawnEntity("cw:core", player.location)
        core.nameTag = `Core : ${enemyCountryData.name}`
        core.setDynamicProperty("core", `${Chunk.positionToChunkId(player.location)}`)
        system.run(() => {
            const command = `tellraw @a {"rawtext":[{"translate":"cw.war.invade","with":["${player.name}", "${enemyCountryData.name}", "${Math.floor(player.location.x)}", "${Math.floor(player.location.z)}"]}]}`;
            world.getDimension("overworld").runCommand(command);
            DiscordRelay.sendTranslate("cw.war.invade", [player.name, enemyCountryData.name, `${Math.floor(player.location.x)}`, `${Math.floor(player.location.z)}`]);
        });
    }
    /**
     * 宣戦布告
     * @param {Object} mineData 自分の国
     * @param {Object} enemyData 敵の国
     */
    static declareTo(mineData, enemyData) {
        // 保護期間のチェック
        if (this.isProtected(mineData) || this.isProtected(enemyData)) {
            return false;
        }
        const myplayers = Util.GetCountryPlayer(mineData);
        const enemyplayers = Util.GetCountryPlayer(enemyData);

        // バランスが取れている時のみ宣戦布告可能
        if (this.isBalanced(myplayers.length, enemyplayers.length)) {
            mineData.warcountry.push(enemyData.id);
            enemyData.warcountry.push(mineData.id);
            if (mineData.isPeace) {
                mineData.wardeath += myplayers.length * 5;
            }
            else {
                mineData.wardeath += myplayers.length * 15;
            }
            if (enemyData.isPeace) {
                enemyData.wardeath += enemyplayers.length * 5;
            }
            else {
                enemyData.wardeath += enemyplayers.length * 15;
            }
            for (const player of myplayers) {
                player.addTag("cw:duringwar")
            }
            for (const player of enemyplayers) {
                player.addTag("cw:duringwar")
            }
            countryDatas.set(mineData.id, mineData);
            countryDatas.set(enemyData.id, enemyData);
        }
        return true;
    }

    /**
     * 戦闘を終了する
     * @param {Object} winnerData 勝利者の国
     * @param {Object} loserData 敗北者の国
     * @param {string} type タイプ
     */
    static finish(winnerData, loserData, type) {
        let number = 0;
        if (type == "killall") {//国は滅ぼさない
            const savePlayer = winnerData.wardeath || 0;
            number = Math.min(savePlayer * 30000 || 0, config.maxWarMoney);
            world.sendMessage({ translate: "cw.war.finish.killall", with: [winnerData.name, loserData.name] })

        }
        if (type == "invade") {//国は滅ぼさない
            const chunkAmount = winnerData.robbedChunkAmount || 0;
            number = Math.min(chunkAmount[loserData.id] * 20000 || 0, config.maxWarMoney);

            world.sendMessage({ translate: "cw.war.finish.invade", with: [winnerData.name, loserData.name] })
        }
        if (type == "force") {//国は滅ぼさない
            const chunkAmount = winnerData.robbedChunkAmount || 0;
            const savePlayer = winnerData.wardeath || 0;
            number = Math.min(chunkAmount[loserData.id] * 20000 || 0 + savePlayer * 30000 || 0, config.maxWarMoney);
            world.sendMessage({ translate: "cw.war.finish.force", with: [loserData.name, winnerData.name] })
        }
        if (winnerData.isPeace) {
            number *= 2;
        }
        if (loserData.isPeace) {
            number *= 0.5;
        }

        loserData.money -= number
        winnerData.money += number
        winnerData.warcountry.splice(winnerData.warcountry.indexOf(loserData.id), 1)
        loserData.warcountry.splice(loserData.warcountry.indexOf(winnerData.id), 1)

        // 敗北時の保護期間再設定
        loserData.buildtime = Date.now();
        loserData.lastDefeated = Date.now();

        countryDatas.set(loserData.id, loserData)
        countryDatas.set(winnerData.id, winnerData)

        const loserplayers = Util.GetCountryPlayer(loserData);
        for (const player of loserplayers) {
            player.sendMessage({ translate: "cw.war.invade.finish.money", with: [winnerData.name, `${number}`] })
            if (loserData.warcountry.length === 0) {
                player.removeTag("cw:duringwar")
            }
        }
        const winnerplayers = Util.GetCountryPlayer(winnerData);
        for (const player of winnerplayers) {
            if (winnerData.warcountry.length === 0) {
                player.removeTag("cw:duringwar")
            }
        }
        const cores = world.getDimension("minecraft:overworld").getEntities({ type: "cw:core" });
        for (const core of cores) {
            const chunkId = core.getDynamicProperty("core");
            const cc = Chunk.checkChunk(chunkId)
            const countryData = countryDatas.get(cc)
            if (countryData.id == winnerData.id) {
                core.remove()
            }
        }
    }

    /**
     * 講和を提案する
     * @param {Object} proposerCountry 提案する国
     * @param {Object} targetCountry 提案される国
     * @param {number} moneyOffer 金額（正=提供、負=要求）
     */
    static proposePeace(proposerCountry, targetCountry, moneyOffer) {
        if (!proposerCountry.peaceProposals) {
            proposerCountry.peaceProposals = {};
        }

        proposerCountry.peaceProposals[targetCountry.id] = {
            proposedMoney: moneyOffer,
            proposerAccepted: false,
            targetAccepted: false
        };

        countryDatas.set(proposerCountry.id, proposerCountry);

        // 両国のプレイヤーに通知
        const proposerPlayers = Util.GetCountryPlayer(proposerCountry);
        const targetPlayers = Util.GetCountryPlayer(targetCountry);
        const moneyText = moneyOffer > 0
            ? { translate: "cw.warform.peace.proposal.money.offer", with: [`${moneyOffer}`] }
            : moneyOffer < 0
                ? { translate: "cw.warform.peace.proposal.money.request", with: [`${Math.abs(moneyOffer)}`] }
                : { translate: "cw.warform.peace.proposal.equal" };

        for (const p of proposerPlayers) {
            p.sendMessage({
                rawtext: [
                    { text: "§a" },
                    { text: targetCountry.name },
                    { translate: "cw.war.peace.proposed.sender.middle" },
                    moneyText,
                    { text: ")" }
                ]
            });
        }
        for (const p of targetPlayers) {
            p.sendMessage({
                rawtext: [
                    { text: "§6" },
                    { text: proposerCountry.name },
                    { translate: "cw.war.peace.proposed.receiver.middle" },
                    moneyText,
                    { text: ")" }
                ]
            });
        }
    }

    /**
     * 講和を承認する
     * @param {Object} acceptingCountry 承認する国
     * @param {Object} otherCountry 相手国
     */
    static acceptPeace(acceptingCountry, otherCountry) {
        // 提案を探す
        let proposal = null;
        let proposerCountry = null;
        let targetCountry = null;

        if (acceptingCountry.peaceProposals && acceptingCountry.peaceProposals[otherCountry.id]) {
            proposal = acceptingCountry.peaceProposals[otherCountry.id];
            proposerCountry = acceptingCountry;
            targetCountry = otherCountry;
            proposal.proposerAccepted = true;
        } else if (otherCountry.peaceProposals && otherCountry.peaceProposals[acceptingCountry.id]) {
            proposal = otherCountry.peaceProposals[acceptingCountry.id];
            proposerCountry = otherCountry;
            targetCountry = acceptingCountry;
            proposal.targetAccepted = true;
        } else {
            return false; // 提案が存在しない
        }

        countryDatas.set(proposerCountry.id, proposerCountry);

        // 両方が承認したか確認
        if (proposal.proposerAccepted && proposal.targetAccepted) {
            this.finalizePeace(proposerCountry, targetCountry, proposal);
        } else {
            // 片方だけ承認した通知
            const acceptingPlayers = Util.GetCountryPlayer(acceptingCountry);
            const otherPlayers = Util.GetCountryPlayer(otherCountry);

            for (const p of acceptingPlayers) {
                p.sendMessage({ translate: "cw.war.peace.accepted.self", with: [otherCountry.name] });
            }
            for (const p of otherPlayers) {
                p.sendMessage({ translate: "cw.war.peace.accepted.other", with: [acceptingCountry.name] });
            }
        }

        return true;
    }

    /**
     * 講和を拒否する
     * @param {Object} rejectingCountry 拒否する国
     * @param {Object} otherCountry 相手国
     */
    static rejectPeace(rejectingCountry, otherCountry) {
        let proposerCountry = null;

        if (rejectingCountry.peaceProposals && rejectingCountry.peaceProposals[otherCountry.id]) {
            proposerCountry = rejectingCountry;
            delete rejectingCountry.peaceProposals[otherCountry.id];
        } else if (otherCountry.peaceProposals && otherCountry.peaceProposals[rejectingCountry.id]) {
            proposerCountry = otherCountry;
            delete otherCountry.peaceProposals[rejectingCountry.id];
        } else {
            return false;
        }

        countryDatas.set(proposerCountry.id, proposerCountry);

        // 両国に通知
        const rejectingPlayers = Util.GetCountryPlayer(rejectingCountry);
        const otherPlayers = Util.GetCountryPlayer(otherCountry);

        for (const p of rejectingPlayers) {
            p.sendMessage({ translate: "cw.war.peace.rejected.self", with: [otherCountry.name] });
        }
        for (const p of otherPlayers) {
            p.sendMessage({ translate: "cw.war.peace.rejected.other", with: [rejectingCountry.name] });
        }

        return true;
    }

    /**
     * 講和を成立させる
     * @param {Object} proposerCountry 提案した国
     * @param {Object} targetCountry 提案された国
     * @param {Object} proposal 提案内容
     */
    static finalizePeace(proposerCountry, targetCountry, proposal) {
        const moneyAmount = proposal.proposedMoney;
        // お金の移動（正=提案者が支払う、負=提案者が受け取る）
        if (moneyAmount > 0) {
            // 提案者が支払う
            if (proposerCountry.money < moneyAmount) {
                // お金が足りない
                const players = Util.GetCountryPlayer(proposerCountry);
                for (const p of players) {
                    p.sendMessage({ translate: "cw.war.peace.insufficient" });
                }
                return false;
            }
            proposerCountry.money -= moneyAmount;
            targetCountry.money += moneyAmount;
        } else if (moneyAmount < 0) {
            // 提案者が受け取る
            const actualAmount = Math.abs(moneyAmount);
            if (targetCountry.money < actualAmount) {
                // お金が足りない
                const players = Util.GetCountryPlayer(targetCountry);
                for (const p of players) {
                    p.sendMessage({ translate: "cw.war.peace.insufficient" });
                }
                return false;
            }
            targetCountry.money -= actualAmount;
            proposerCountry.money += actualAmount;
        }

        // 戦争状態を解除
        proposerCountry.warcountry.splice(proposerCountry.warcountry.indexOf(targetCountry.id), 1);
        targetCountry.warcountry.splice(targetCountry.warcountry.indexOf(proposerCountry.id), 1);

        // 講和提案を削除
        if (proposerCountry.peaceProposals) {
            delete proposerCountry.peaceProposals[targetCountry.id];
        }

        // データを保存
        countryDatas.set(proposerCountry.id, proposerCountry);
        countryDatas.set(targetCountry.id, targetCountry);

        // プレイヤーからタグを削除
        const proposerPlayers = Util.GetCountryPlayer(proposerCountry);
        const targetPlayers = Util.GetCountryPlayer(targetCountry);

        for (const p of proposerPlayers) {
            if (proposerCountry.warcountry.length === 0) {
                p.removeTag("cw:duringwar");
            }
        }
        for (const p of targetPlayers) {
            if (targetCountry.warcountry.length === 0) {
                p.removeTag("cw:duringwar");
            }
        }

        // コアを削除
        const cores = world.getDimension("minecraft:overworld").getEntities({ type: "cw:core" });
        for (const core of cores) {
            const chunkId = core.getDynamicProperty("core");
            const cc = Chunk.checkChunk(chunkId);
            const countryData = countryDatas.get(cc);
            if (countryData && (countryData.id === proposerCountry.id || countryData.id === targetCountry.id)) {
                core.remove();
            }
        }

        // 講和を発表
        const moneyMsg = moneyAmount > 0
            ? { translate: "cw.war.peace.finalized.offer", with: [proposerCountry.name, targetCountry.name, `${moneyAmount}`] }
            : moneyAmount < 0
                ? { translate: "cw.war.peace.finalized.request", with: [targetCountry.name, proposerCountry.name, `${Math.abs(moneyAmount)}`] }
                : { translate: "cw.war.peace.finalized.equal", with: [proposerCountry.name, targetCountry.name] };

        world.sendMessage({
            rawtext: [
                { translate: "cw.war.peace.finalized.prefix" },
                moneyMsg
            ]
        });

        return true;
    }
}
world.afterEvents.entityDie.subscribe(ev => {
    const core = ev.deadEntity;
    const player = ev.damageSource.damagingEntity;
    if (player && player.typeId == "minecraft:player") {
        if (core.typeId !== "cw:core") return;




        //----------------------------------------------
        const playerData = playerDatas.get(player.id)
        const mineData = countryDatas.get(playerData.country)
        const chunkId = core.getDynamicProperty("core");
        const cc = Chunk.checkChunk(chunkId)
        const countryData = countryDatas.get(cc);
        if (!countryData) return;
        if (!mineData.robbedChunkAmount[countryData.id]) {
            mineData.robbedChunkAmount[countryData.id] = 0;
        }
        mineData.robbedChunkAmount[countryData.id]++;
        countryDatas.set(mineData.id, mineData);
        countryDatas.set(countryData.id, countryData);
        Chunk.setChunk(chunkId, mineData)
        world.sendMessage({ translate: "cw.war.invade.success", with: [player.name, countryData.name, `${Math.floor(player.location.x)}`, `${Math.floor(player.location.z)}`] })
        const newcountryData = countryDatas.get(countryData.id)
        if (newcountryData.chunkAmount == 0) {
            War.finish(mineData, newcountryData, "invade")
        }
    }
    //----------------------------------------------
})


world.afterEvents.entityDie.subscribe(ev => {
    const player = ev.deadEntity;
    const damager = ev.damageSource.damagingEntity;
    if (player && player.typeId == "minecraft:player" && damager && damager.typeId == "minecraft:player") {
        const playerData = playerDatas.get(player.id)
        if (!playerData.country) return;
        const countryData = countryDatas.get(playerData.country)
        const warCountries = countryData.warcountry
        if (warCountries && warCountries.length > 0) {
            const damagerData = playerDatas.get(damager.id);
            if (!damagerData.country) return;

            // 攻撃者が敵国のいずれかに所属しているか確認
            if (warCountries.includes(damagerData.country)) {
                if (countryData.wardeath <= 0) {
                    // 全ての戦争を終了させる（あるいは特定の国とのみ終了させるかはルール次第だが、現状のロジックに合わせ全解除を検討）
                    // ここでは wardeath が 0 になったので、敗北処理
                    const activeWars = [...warCountries];
                    for (const enemyId of activeWars) {
                        War.finish(countryDatas.get(enemyId), countryData, "killall");
                    }
                }
                else {
                    countryData.wardeath--;
                    countryDatas.set(countryData.id, countryData);
                    world.sendMessage({
                        translate: "cw.war.death", with: [countryData.name, `${countryData.wardeath}`]
                    })
                    DiscordRelay.sendTranslate("cw.war.death", [countryData.name, `${countryData.wardeath}`]);
                }
            }
        }
    }
});
//ダメージを相殺
world.afterEvents.entityHurt.subscribe((ev) => {
    const player = ev.damageSource.damagingEntity;
    const hitEntity = ev.hurtEntity;
    if (!player || player.typeId != "minecraft:player") return
    if (!hitEntity || hitEntity.typeId !== "minecraft:player") return
    if (player.isValid) {
        if (!player.hasTag("cw:duringwar") && hitEntity.hasTag("cw:duringwar")) {
            Util.heal(hitEntity, ev.damage)
            hitEntity.clearVelocity()
            player.addEffect("weakness", 60, { amplifier: 255, showParticles: false })
            player.addEffect("slowness", 60, { amplifier: 4, showParticles: false })
            player.sendMessage({ translate: "cw.war.attacknowar" })
        }
    }
})
world.afterEvents.entityHurt.subscribe((ev) => {
    const player = ev.damageSource.damagingEntity;
    const hitEntity = ev.hurtEntity;
    if (!player || player.typeId !== "minecraft:player") return
    if (!hitEntity || hitEntity.typeId !== "cw:core") return
    if (player.isValid) {

        const chunkId = Chunk.positionToChunkId(hitEntity.location)
        const countryData = countryDatas.get(Chunk.checkChunk(chunkId))
        if (countryData.players.includes(player.id)) {
            Util.heal(hitEntity, ev.damage)
            hitEntity.clearVelocity()
            player.sendMessage({ translate: "cw.war.attacknoown" })
            return;
        }

        if (!player.hasTag("cw:duringwar")) {
            Util.heal(hitEntity, ev.damage)
            hitEntity.clearVelocity()
            player.addEffect("weakness", 20, { amplifier: 255, showParticles: false })
            player.addEffect("slowness", 20, { amplifier: 4, showParticles: false })
            player.sendMessage({ translate: "cw.war.attacknowar" })
        }

    }
})