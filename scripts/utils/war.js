import * as server from "@minecraft/server"
const { world, system } = server;
import { Chunk } from "./chunk.js";
import { Dypro } from "./dypro.js";
import { Util } from "./util.js";
import { Country } from "./country.js";
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
        const chunk = Chunk.checkChunk(Chunk.positionToChunkId(player.location));
        if (chunk == "wasteland") return false;
        const enemycountryData = countryDatas.get(chunk);
        if (enemycountryData.id == countryData.id) return false;
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
        world.sendMessage({ translate: "cw.war.invade", with: [player.name, `${Math.floor(player.location.x)}`, `${Math.floor(player.location.z)}`] })
    }
    /**
     * 宣戦布告
     * @param {Object} mineData 自分の国
     * @param {Object} enemyData 敵の国
     */
    static declareTo(mineData, enemyData) {
        const myplayers = Util.GetCountryPlayer(mineData).length;
        const enemyplayers = Util.GetCountryPlayer(enemyData).length;

        // バランスが取れている時のみ宣戦布告可能
        //if (this.isBalanced(myplayers, enemyplayers)) {
        mineData.warcountry.push(enemyData.id);
        enemyData.warcountry.push(mineData.id);
        countryDatas.set(mineData.id, mineData);
        countryDatas.set(enemyData.id, enemyData);
        //}
    }
    /**
     * 戦闘を終了する
     * @param {Object} winnerData 勝利者の国
     * @param {Object} loserData 敗北者の国
     * @param {string} type タイプ
     */
    static finish(winnerData, loserData, type) {
        if (type == "invade") {
            Country.delete(loserData)
        }
    }
}
world.afterEvents.entityDie.subscribe(ev => {
    const core = ev.deadEntity;
    const player = ev.damageSource.damagingEntity;
    if (player && player.typeId == "minecraft:player")
        if (core.typeId !== "cw:core") return;
    const playerData = playerDatas.get(player.id)
    const mineData = countryDatas.get(playerData.country)
    const chunkId = core.getDynamicProperty("core");
    const cc = Chunk.checkChunk(chunkId)
    const countryData = countryDatas.get(cc);
    if (!countryData) return;
    Chunk.setChunk(chunkId, mineData)
    if (countryData.chunkAmount == 0) {
        War.finish(mineData, countryData, "invade")
    }
    world.sendMessage({ translate: "cw.war.invade.success", with: [player.name, `${Math.floor(player.location.x)}`, `${Math.floor(player.location.z)}`] })
})