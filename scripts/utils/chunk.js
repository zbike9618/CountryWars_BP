import * as server from "@minecraft/server";
const { world, system } = server;
import { MessageFormData } from "@minecraft/server-ui"
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
    static positionToChunkId(position) {//xを少数切り捨て
        const x = Math.floor(position.x / 16)
        const z = Math.floor(position.z / 16)
        return `${x}_${z}`
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
    static async buy(player, countryData) {
        const playerData = playerDatas.get(player.id)
        if (!playerData.country) {
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
            player.sendMessage({ translate: "cw.chunk.buy.maxchunk", with: [`${config.maxchunk}`] })
            return;
        }
        const cc = this.checkChunk(this.positionToChunkId(player.location))
        if (cc !== "wasteland") {
            player.sendMessage({ translate: "cw.chunk.buy.already", with: [countryDatas.get(cc)?.name || "Unknown"] })
            return;
        }
        const form = new MessageFormData()
        form.title({ translate: "cw.chunk.buy.title" })
        form.body({ translate: "cw.chunk.buy.body", with: [`${config.chunkprice}`, `${countryData.money}`] })
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
            this.setChunk(this.positionToChunkId(player.location), countryData)

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
        if (chunkData.country != playerData.country) {
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
        form.body({ translate: "cw.chunk.sell.check", with: [`${config.chunkprice / 2}`] })
        form.button1({ translate: "cw.form.sell" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {

            player.sendMessage({ translate: "cw.chunk.sell.success", with: [`${countryData.money}`, `${countryData.money + config.chunkprice / 2}`] })
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
            if (enemyData) {
                enemyData.chunkAmount -= 1;
                countryDatas.set(enemyData.id, enemyData)
            }
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
                hurtPlayer: false
            }
        });
    }
    static removeAdmin(chunkId) {
        const chunk = chunkDatas.get(chunkId);
        if (chunk && chunk.country === "admin") {
            chunkDatas.delete(chunkId);
        }
    }
    static checkPermission(player, chunkId, permType) {
        const countryId = this.checkChunk(chunkId);
        if (countryId === "wasteland") return { allowed: true };
        if (countryId === "admin") {
            const chunkData = chunkDatas.get(chunkId);
            if (!chunkData || !chunkData.setting) return { allowed: false, countryName: "Admin" };
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

        if (countryData.warcountry && countryData.warcountry.length > 0) return { allowed: true };

        const playerData = playerDatas.get(player.id);
        const playerCountryId = playerData.country;

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
}
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    const player = ev.player
    const loc = ev.block.location
    const chunkId = Chunk.positionToChunkId(loc)

    const check = Chunk.checkPermission(player, chunkId, "break_block");
    if (!check.allowed) {
        player.sendMessage({ translate: "cw.chunk.break", with: [check.countryName] })
        ev.cancel = true
    }
})
world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
    const player = ev.player
    const loc = ev.block.location
    const chunkId = Chunk.positionToChunkId(loc)

    const check = Chunk.checkPermission(player, chunkId, "place_block");
    if (!check.allowed) {
        ev.cancel = true;
        player.sendMessage({ translate: "cw.chunk.place", with: [check.countryName] })
    }
})
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    const player = ev.player
    const chunkId = Chunk.positionToChunkId(ev.block.location)
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

world.afterEvents.entityHurt.subscribe((ev) => {
    const entity = ev.hurtEntity

    const damageSource = ev.damageSource;
    const attacker = damageSource.damagingEntity;
    if (!attacker || attacker.typeId !== "minecraft:player") return;

    const loc = entity.location
    const chunkId = Chunk.positionToChunkId(loc)

    const permType = entity.typeId === "minecraft:player" ? "attack_player" : "attack_entity";
    const check = Chunk.checkPermission(attacker, chunkId, permType);

    if (!check.allowed) {
        attacker.sendMessage({ translate: "cw.chunk.hurt", with: [check.countryName] })
        const comp = entity.getComponent("minecraft:health")
        if (comp && ev.damage) {
            comp.setCurrentValue(Math.min(comp.currentValue + ev.damage, comp.effectiveMax));
            entity.clearVelocity()
        }
    }
})
world.beforeEvents.explosion.subscribe((ev) => {
    if (ev.source && explosionMap.has(ev.source.id)) {
        const locations = explosionMap.get(ev.source.id);
        const dimension = ev.dimension;
        const blocksToDestroy = [];

        for (const loc of locations) {
            const block = dimension.getBlock(loc);
            if (block) {
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
            const chunkId = Chunk.positionToChunkId(block.location);
            const countryDataId = Chunk.checkChunk(chunkId);

            if (countryDataId && countryDataId !== "wasteland" && countryDatas.get(countryDataId).warcountry.length == 0) {
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
