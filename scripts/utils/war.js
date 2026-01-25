import * as server from "@minecraft/server"
const { world, system } = server;
import { Chunk } from "./chunk.js";
import { Dypro } from "./dypro.js";
import { Util } from "./util.js";
import { Country } from "./country.js";
import config from "../config/config.js";
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

    static CanInvade(player, countryData) {
        const chunkId = Chunk.positionToChunkId(player.location)
        const chunk = Chunk.checkChunk(chunkId);
        const dimension = player.dimension;
        if (chunk == "wasteland") return false;
        const enemycountryData = countryDatas.get(chunk);
        if (enemycountryData.id == countryData.id) return false;

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
        world.sendMessage({ translate: "cw.war.invade", with: [player.name, enemyCountryData.name, `${Math.floor(player.location.x)}`, `${Math.floor(player.location.z)}`] })
    }
    /**
     * 宣戦布告
     * @param {Object} mineData 自分の国
     * @param {Object} enemyData 敵の国
     */
    static declareTo(mineData, enemyData) {
        const myplayers = Util.GetCountryPlayer(mineData);
        const enemyplayers = Util.GetCountryPlayer(enemyData);

        // バランスが取れている時のみ宣戦布告可能
        //if (this.isBalanced(myplayers.length, enemyplayers.length)) {
        mineData.warcountry.push(enemyData.id);
        enemyData.warcountry.push(mineData.id);
        countryDatas.set(mineData.id, mineData);
        countryDatas.set(enemyData.id, enemyData);
        mineData.wardeath += myplayers.length;
        enemyData.wardeath += enemyplayers.length;
        for (const player of myplayers) {
            player.addTag("cw:duringwar")
        }
        for (const player of enemyplayers) {
            player.addTag("cw:duringwar")
        }
        //}
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

        loserData.money -= number
        winnerData.money += number
        winnerData.warcountry.splice(winnerData.warcountry.indexOf(loserData.id), 1)
        loserData.warcountry.splice(loserData.warcountry.indexOf(winnerData.id), 1)
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
        if (countryData.chunkAmount == 1) {
            War.finish(mineData, countryData, "invade")
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