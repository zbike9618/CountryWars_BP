import * as server from "@minecraft/server";
const { world, system } = server;
import { MessageFormData, ModalFormData } from "@minecraft/server-ui"
import { Dypro } from "./dypro"
import { Util } from "./util";
import config from "../config/config"
const countryDatas = new Dypro("country")
const playerDatas = new Dypro("player")
const chunkDatas = new Dypro("chunk")
import { Data } from "./data";
import { hasPermission } from "./country";
const explosionMap = new Map();



export class Chunk {
    static positionToChunkId(position, dimensionId = "minecraft:overworld") {//xを少数切り捨て
        const x = Math.floor(position.x / 16)
        const z = Math.floor(position.z / 16)
        if (dimensionId === "minecraft:overworld") {
            return `${x}_${z}`
        }
        return `${dimensionId}_${x}_${z}`
    }
    static checkChunk(chunkId) {
        const chunkData = chunkDatas.get(chunkId);
        if (chunkData && chunkData.country === "admin") return "admin";
        if (chunkData && !countryDatas.get(chunkData.country)) {
            chunkDatas.delete(chunkId);
            return "wasteland";
        }
        return chunkData ? chunkData.country : "wasteland";
    }
    /**
     * 
     * @param {server.Player} player 
     * @param {Object} countryData 
     */
    static async buy(player, countryData) {
        const playerData = playerDatas.get(player.id)
        if (player.dimension.id !== "minecraft:overworld") {
            player.sendMessage({ translate: "cw.chunk.buy.overworld" })
            return;
        }
        if (!playerData || !playerData.country) {
            player.sendMessage({ translate: "cw.form.unjoincountry" })
            return;
        }
        if (!hasPermission(player, "chunk_buy")) {
            player.sendMessage({ translate: "cw.scform.permission.nopermission" })
            return;
        }
        if (countryData.warcountry && countryData.warcountry.length > 0) {
            player.sendMessage({ translate: "cw.chunk.buy.war" })
            return;
        }
        if (countryData.chunkAmount >= config.maxchunk) {
            player.sendMessage({ translate: "cw.chunk.buy.maxchunk", with: [String(config.maxchunk)] })
            return;
        }
        const cc = this.checkChunk(this.positionToChunkId(player.location, player.dimension.id))
        if (cc !== "wasteland") {
            player.sendMessage({ translate: "cw.chunk.buy.already", with: [countryDatas.get(cc)?.name || "Unknown"] })
            return;
        }

        const cx = Math.floor(player.location.x / 16);
        const cz = Math.floor(player.location.z / 16);
        const margin = config.chunkBuyMargin || 0;
        if (margin > 0) {
            for (let dx = -margin; dx <= margin; dx++) {
                for (let dz = -margin; dz <= margin; dz++) {
                    if (dx === 0 && dz === 0) continue;
                    const checkId = player.dimension.id === "minecraft:overworld" ? `${cx + dx}_${cz + dz}` : `${player.dimension.id}_${cx + dx}_${cz + dz}`;
                    const nearCc = this.checkChunk(checkId);
                    if (nearCc !== "wasteland" && nearCc !== countryData.id) {
                        player.sendMessage(`§c半径${margin}チャンク以内に違う国があるため購入できません。`);
                        return;
                    }
                }
            }
        }
        const form = new MessageFormData()
        form.title({ translate: "cw.chunk.buy.title" })
        form.body({ translate: "cw.chunk.buy.body", with: [String(config.chunkprice), String(countryData.money)] })
        form.button1({ translate: "cw.form.buy" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {

            if (countryData.money < config.chunkprice) {
                player.sendMessage({ translate: "cw.form.nomoney" })
                return;
            }

            player.sendMessage({ translate: "cw.chunk.buy.success" })
            countryData.money -= config.chunkprice;
            countryDatas.set(countryData.id, countryData)
            this.setChunk(this.positionToChunkId(player.location, player.dimension.id), countryData)

        }
    }
    static async sell(player, chunkId) {
        const playerData = playerDatas.get(player.id)
        const chunkData = chunkDatas.get(chunkId);
        if (!chunkData) {
            player.sendMessage({ translate: "cw.chunk.sell.notfound" })
            return;
        }
        const countryData = countryDatas.get(chunkData.country)
        if (!playerData || chunkData.country != playerData.country) {
            player.sendMessage({ translate: "cw.chunk.sell.notfound" })
            return;
        }
        if (!hasPermission(player, "chunk_sell")) {
            player.sendMessage({ translate: "cw.scform.permission.nopermission" })
            return;
        }
        if (countryData.warcountry && countryData.warcountry.length > 0) {
            player.sendMessage({ translate: "cw.chunk.sell.war" })
            return;
        }
        const form = new MessageFormData()
        form.title({ translate: "cw.chunk.sell.title" })
        form.body({ translate: "cw.chunk.sell.check", with: [String(config.chunkprice / 2)] })
        form.button1({ translate: "cw.form.sell" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {

            player.sendMessage({ translate: "cw.chunk.sell.success", with: [String(countryData.money), String(countryData.money + config.chunkprice / 2)] })
            countryData.money += config.chunkprice / 2;
            countryData.chunkAmount -= 1;
            countryDatas.set(countryData.id, countryData)
            chunkDatas.delete(chunkId);

        }
    }
    static setChunk(chunkId, countryData) {
        const chunk = this.checkChunk(chunkId);
        if (chunk !== "wasteland" && chunk !== "admin") {
            const enemyData = countryDatas.get(chunk);
            world.sendMessage(`${enemyData.chunkAmount}`)
            enemyData.chunkAmount -= 1;
            world.sendMessage(`${enemyData.chunkAmount}`)
            countryDatas.set(chunk, enemyData)
        }
        chunkDatas.set(chunkId, {
            id: chunkId,
            country: countryData.id
        });
        countryData.chunkAmount += 1;
        countryDatas.set(countryData.id, countryData)

    }
    static setAdmin(chunkId) {
        chunkDatas.set(chunkId, {
            id: chunkId,
            country: "admin",
            setting: {
                place: false,
                break: false,
                interact: false,
                hurtEntity: false,
                hurtPlayer: false,
                allowedPlayers: []
            }
        });
    }
    static removeAdmin(chunkId) {
        const chunk = chunkDatas.get(chunkId);
        if (chunk && chunk.country === "admin") {
            chunkDatas.delete(chunkId);
        }
    }
    /**
     * 
     * @param {server.Player} player 
     * @param {*} chunkId 
     * @param {*} permType 
     * @returns 
     */
    static checkPermission(player, chunkId, permType) {
        if (player.hasTag("cw:chunkEditer")) return { allowed: true };
        const countryId = this.checkChunk(chunkId);
        if (countryId === "wasteland") return { allowed: true };
        if (countryId === "admin") {
            const chunkData = chunkDatas.get(chunkId);
            if (!chunkData || !chunkData.setting) return { allowed: false, countryName: "Admin" };
            if (chunkData.setting.allowedPlayers && chunkData.setting.allowedPlayers.includes(player.name)) return { allowed: true };
            let allowed = false;
            if (permType === "place_block") allowed = chunkData.setting.place;
            else if (permType === "break_block") allowed = chunkData.setting.break;
            else if (permType === "interact") allowed = chunkData.setting.interact;
            else if (permType === "attack_entity") allowed = chunkData.setting.hurtEntity;
            else if (permType === "attack_player") allowed = chunkData.setting.hurtPlayer;
            return { allowed, countryName: "Admin" };
        }

        const countryData = countryDatas.get(countryId);
        if (!countryData) return { allowed: true };

        const playerData = playerDatas.get(player.id);
        const playerCountryId = playerData ? playerData.country : undefined;

        if (countryData.warcountry && countryData.warcountry.length > 0) {
            if (countryData.warcountry.includes(playerCountryId)) {
                if (permType === "attack_player" || permType === "attack_entity") {
                    return { allowed: true };
                }
            }
        }

        // Check specific plot setting if exists
        const chunkData = chunkDatas.get(chunkId);
        if (chunkData && chunkData.setting && chunkData.setting[permType] !== undefined) {
            const settingLevel = chunkData.setting[permType];
            if (settingLevel > 0) {
                const hasChunkEdit = () => {
                    if (!playerCountryId) return false;
                    const pCountry = countryDatas.get(playerCountryId);
                    return hasPermission(player, "chunk_edit") || (pCountry && pCountry.owner === player.id);
                };

                if (settingLevel === 1) {
                    if (playerCountryId !== countryId) return { allowed: false, countryName: countryData.name };
                    return { allowed: true };
                } else if (settingLevel === 2) {
                    if (playerCountryId !== countryId) return { allowed: false, countryName: countryData.name };
                    if (!hasChunkEdit()) return { allowed: false, countryName: countryData.name };
                    return { allowed: true };
                } else if (settingLevel === 3) {
                    if (playerCountryId === countryId) {
                        if (hasChunkEdit()) return { allowed: true };
                        return { allowed: false, countryName: countryData.name };
                    }
                    if (countryData.diplomacy && countryData.diplomacy.ally && countryData.diplomacy.ally.includes(playerCountryId)) {
                        if (hasChunkEdit()) return { allowed: true };
                    }
                    return { allowed: false, countryName: countryData.name };
                }
            }
        }

        if (playerCountryId === countryId) return { allowed: true };

        let relation = "neutral";
        if (playerCountryId && countryData.diplomacy) {
            if (countryData.diplomacy.ally && countryData.diplomacy.ally.includes(playerCountryId)) relation = "ally";
            else if (countryData.diplomacy.friend && countryData.diplomacy.friend.includes(playerCountryId)) relation = "friend";
            else if (countryData.diplomacy.enemy && countryData.diplomacy.enemy.includes(playerCountryId)) relation = "enemy";
        }
        const perms = countryData.diplomacyPermissions ? (countryData.diplomacyPermissions[relation] || []) : [];
        if (perms.includes(permType)) return { allowed: true };

        return { allowed: false, countryName: countryData.name };
    }

    /**
     * 指定された座標から最も近い、指定された国が所有するチャンクの座標を返す
     * @param {string} originChunkId 基準となるチャンクID
     * @param {string} countryId 対象の国ID
     * @returns {{x: number, z: number} | null} 座標オブジェクト、または見つからない場合はnull
     */
    static getNearestChunk(originChunkId, countryId) {
        const allChunkIds = chunkDatas.idList;
        let nearestChunkId = null;
        let minDistance = Infinity;

        // 基準点のパース
        const originParts = originChunkId.split("_");
        let ox, oz, odim;
        if (originParts.length === 2) {
            ox = Number(originParts[0]);
            oz = Number(originParts[1]);
            odim = "minecraft:overworld";
        } else {
            odim = originParts[0];
            ox = Number(originParts[1]);
            oz = Number(originParts[2]);
        }

        for (const id of allChunkIds) {
            if (id === originChunkId) continue;
            const data = chunkDatas.get(id);
            if (data && data.country === countryId) {
                const parts = id.split("_");
                let tx, tz, tdim;
                if (parts.length === 2) {
                    tx = Number(parts[0]);
                    tz = Number(parts[1]);
                    tdim = "minecraft:overworld";
                } else {
                    tdim = parts[0];
                    tx = Number(parts[1]);
                    tz = Number(parts[2]);
                }

                if (tdim !== odim) continue; // 同一次元のみを対象とする

                const distance = Math.sqrt(Math.pow(tx - ox, 2) + Math.pow(tz - oz, 2));
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestChunkId = id;
                }
            }
        }

        if (nearestChunkId) {
            const parts = nearestChunkId.split("_");
            let nx, nz;
            if (parts.length === 2) {
                nx = Number(parts[0]);
                nz = Number(parts[1]);
            } else {
                nx = Number(parts[1]);
                nz = Number(parts[2]);
            }
            return { x: nx * 16 + 8, z: nz * 16 + 8 };
        }
        return null;
    }

    static getConnectedChunks(startChunkId, countryId) {
        const connected = new Set();
        const queue = [startChunkId];
        
        const parts = startChunkId.split("_");
        let odim, ox, oz;
        if (parts.length === 2) {
            odim = "minecraft:overworld";
            ox = Number(parts[0]);
            oz = Number(parts[1]);
        } else {
            odim = parts[0];
            ox = Number(parts[1]);
            oz = Number(parts[2]);
        }
    
        connected.add(startChunkId);
        
        let head = 0;
        while(head < queue.length) {
            const currentId = queue[head++];
            const cParts = currentId.split("_");
            let cx, cz;
            if (cParts.length === 2) { cx = Number(cParts[0]); cz = Number(cParts[1]); }
            else { cx = Number(cParts[1]); cz = Number(cParts[2]); }
            
            const neighbors = [
                [cx+1, cz], [cx-1, cz], [cx, cz+1], [cx, cz-1]
            ];
            
            for (const [nx, nz] of neighbors) {
                const nId = odim === "minecraft:overworld" ? `${nx}_${nz}` : `${odim}_${nx}_${nz}`;
                if (!connected.has(nId)) {
                    const cData = chunkDatas.get(nId);
                    if (cData && cData.country === countryId) {
                        connected.add(nId);
                        queue.push(nId);
                    }
                }
            }
        }
        return Array.from(connected);
    }

    static async settingMenu(player, chunkId) {
        try {
            const chunkData = chunkDatas.get(chunkId);
            if (!chunkData) {
                player.sendMessage({ translate: "cw.plotchunk.notowned" });
                return;
            }
            if (chunkData.country === "admin") {
                player.sendMessage({ translate: "cw.plotchunk.admin" });
                return;
            }
            const countryData = countryDatas.get(chunkData.country);
            if (!countryData) {
                player.sendMessage("§cエラー: 国のデータが見つかりません。");
                return;
            }
        
            const playerData = playerDatas.get(player.id);
            if (!playerData || playerData.country !== countryData.id) {
                player.sendMessage({ translate: "cw.plotchunk.notyourcountry" });
                return;
            }
        
            if (countryData.owner !== player.id && !hasPermission(player, "chunk_edit")) {
                player.sendMessage({ translate: "cw.plotchunk.nopermission" });
                return;
            }
        
            const form = new ModalFormData();
            form.title({ translate: "cw.plotchunk.form.title" });
            
            const options = [
                { translate: "cw.plotchunk.form.option.default" },
                { translate: "cw.plotchunk.form.option.citizen" },
                { translate: "cw.plotchunk.form.option.chunk_edit" },
                { translate: "cw.plotchunk.form.option.ally" }
            ];
        
            const currentSetting = chunkData.setting || {};
        
            form.dropdown({ translate: "cw.plotchunk.form.label.break" }, options, { defaultValueIndex: currentSetting.break_block || 0 });
            form.dropdown({ translate: "cw.plotchunk.form.label.place" }, options, { defaultValueIndex: currentSetting.place_block || 0 });
            form.dropdown({ translate: "cw.plotchunk.form.label.interact" }, options, { defaultValueIndex: currentSetting.interact || 0 });
            form.dropdown({ translate: "cw.plotchunk.form.label.attack_player" }, options, { defaultValueIndex: currentSetting.attack_player || 0 });
            form.dropdown({ translate: "cw.plotchunk.form.label.attack_entity" }, options, { defaultValueIndex: currentSetting.attack_entity || 0 });
            form.toggle({ translate: "cw.plotchunk.form.toggle.delete" }, false);
            form.toggle({ translate: "cw.plotchunk.form.toggle.apply_connected" }, false);
        
            const res = await form.show(player);
            if (res.canceled) return;
        
            const newSetting = {
                break_block: res.formValues[0],
                place_block: res.formValues[1],
                interact: res.formValues[2],
                attack_player: res.formValues[3],
                attack_entity: res.formValues[4],
            };
            const doDelete = res.formValues[5];
            const applyToConnected = res.formValues[6];
        
            let targetChunks = [chunkId];
            if (applyToConnected) {
                targetChunks = this.getConnectedChunks(chunkId, countryData.id);
            }
        
            for (const tid of targetChunks) {
                const tData = chunkDatas.get(tid);
                if (tData && tData.country === countryData.id) {
                    if (doDelete) {
                        delete tData.setting;
                    } else {
                        tData.setting = newSetting;
                    }
                    chunkDatas.set(tid, tData);
                }
            }
            player.sendMessage({ translate: "cw.plotchunk.success", with: [String(targetChunks.length)] });
        } catch (e) {
            player.sendMessage("§cプロット設定メニューの展開に失敗しました: " + e);
        }
    }
}
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    const player = ev.player
    const loc = ev.block.location
    const chunkId = Chunk.positionToChunkId(loc, ev.block.dimension.id)

    const check = Chunk.checkPermission(player, chunkId, "break_block");
    if (!check.allowed) {
        player.sendMessage({ translate: "cw.chunk.break", with: [check.countryName] })
        ev.cancel = true
    }
})
world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
    const player = ev.player
    const loc = ev.block.location
    const chunkId = Chunk.positionToChunkId(loc, ev.block.dimension.id)

    const check = Chunk.checkPermission(player, chunkId, "place_block");
    if (!check.allowed) {
        ev.cancel = true;
        player.sendMessage({ translate: "cw.chunk.place", with: [check.countryName] })
    }
})
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    const player = ev.player
    const chunkId = Chunk.positionToChunkId(ev.block.location, ev.block.dimension.id)
    const blockId = ev.block.typeId

    const inventory = ev.block.getComponent("minecraft:inventory");
    let permType = "interact";

    if (!inventory && ((!Data.usableBlocks.includes(blockId) && !player.isSneaking) || player.isSneaking)) return;

    const check = Chunk.checkPermission(player, chunkId, permType);
    if (!check.allowed) {
        player.sendMessage({ translate: "cw.chunk.interact", with: [check.countryName] })
        ev.cancel = true
    }
})

world.beforeEvents.entityHurt.subscribe((ev) => {
    const entity = ev.hurtEntity

    const damageSource = ev.damageSource;
    const attacker = damageSource.damagingEntity;
    if (!attacker || attacker.typeId !== "minecraft:player") return;

    const loc = entity.location
    const chunkId = Chunk.positionToChunkId(loc, entity.dimension.id)

    const permType = entity.typeId === "minecraft:player" ? "attack_player" : "attack_entity";
    const check = Chunk.checkPermission(attacker, chunkId, permType);

    if (!check.allowed) {
        attacker.sendMessage({ translate: "cw.chunk.hurt", with: [check.countryName] })
        ev.cancel = true;
    }
})
world.beforeEvents.explosion.subscribe((ev) => {
    if (ev.source && explosionMap.has(ev.source.id)) {
        if (ev.source.typeId == "minecraft:wind_charge_projectile") return;
        const locations = explosionMap.get(ev.source.id);
        const dimension = ev.dimension;
        const blocksToDestroy = [];

        for (const loc of locations) {
            const block = dimension.getBlock(loc);
            if (block) {
                if (block.typeId === "minecraft:bedrock") continue;
                blocksToDestroy.push(block);
            }
        }
        if (blocksToDestroy.length > 0) {
            ev.setImpactedBlocks(blocksToDestroy);
        }

        // Cleanup to prevent data bloat
        explosionMap.delete(ev.source.id);
    } else {
        const blocks = ev.getImpactedBlocks();
        if (blocks.length === 0) return;
        const dimension = ev.dimension;
        let explodedInCountry = false;
        const destroyBlockLocations = [];

        for (const block of blocks) {
            const chunkId = Chunk.positionToChunkId(block.location, ev.dimension.id);
            const countryDataId = Chunk.checkChunk(chunkId);

            if (countryDataId && (countryDataId == "admin" || (countryDataId !== "wasteland" && countryDatas.get(countryDataId).warcountry.length == 0))) {
                if (!explodedInCountry) {
                    ev.cancel = true;
                    system.run(() => {
                        dimension.createExplosion(block.location, 4, {
                            breaksBlocks: false
                        });
                    });
                    explodedInCountry = true;
                }
                if (block.typeId === "minecraft:tnt") {
                    destroyBlockLocations.push({
                        x: block.location.x,
                        y: block.location.y,
                        z: block.location.z
                    });
                }
            } else {
                // Store only the location properties
                destroyBlockLocations.push({
                    x: block.location.x,
                    y: block.location.y,
                    z: block.location.z
                });
            }
        }

        if (destroyBlockLocations.length > 0) {
            const players = world.getAllPlayers();
            if (players.length === 0) return;
            const spawnpos = players[0].location;
            system.run(() => {
                const entity = dimension.spawnEntity("cw:explosion", { x: spawnpos.x, y: 320, z: spawnpos.z });
                explosionMap.set(entity.id, destroyBlockLocations);
            });
        }
    }
});
