import * as server from "@minecraft/server";
const { world, system } = server;
import { DiscordRelay, sendChatToDiscord, sendToDiscord } from "./discord.js";
export { DiscordRelay, sendChatToDiscord, sendToDiscord };
import { Dypro } from "./dypro.js";
import config from "../config/config.js";

const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");

const deathMessageMap = {
    "anvil": (v) => `${v} は落下してきた金床に押しつぶされた`,
    "blockExplosion": (v) => `${v} は爆発に巻き込まれた`,
    "contact": (v) => `${v} はサボテンに刺されて死んでしまった`,
    "drowning": (v) => `${v} は溺れ死んだ`,
    "entityAttack": (v, a) => a ? `${v} は ${a} に殺害された` : `${v} は殺害された`,
    "entityExplosion": (v, a) => a ? `${v} は ${a} に爆破された` : `${v} は爆発に巻き込まれた`,
    "fall": (v) => `${v} は高いところから落ちた`,
    "fallingBlock": (v) => `${v} は落下してきたブロックに押しつぶされた`,
    "fire": (v) => `${v} は炎に巻かれた`,
    "fireTick": (v) => `${v} は燃え尽きた`,
    "fireworks": (v) => `${v} は爆発に巻き込まれた`,
    "flyIntoWall": (v) => `${v} は激突した`,
    "freezing": (v) => `${v} は凍死した`,
    "lava": (v) => `${v} は溶岩の中で泳ごうとした`,
    "lightning": (v) => `${v} は雷に打たれた`,
    "magic": (v) => `${v} は魔法によって殺された`,
    "magma": (v) => `${v} は溶岩の上を歩いた`,
    "none": (v) => `${v} は死んだ`,
    "piston": (v) => `${v} は押しつぶされた`,
    "projectile": (v, a) => a ? `${v} は ${a} に射抜かれた` : `${v} は射抜かれた`,
    "starve": (v) => `${v} は飢え死にした`,
    "suffocation": (v) => `${v} は壁の中に埋まった`,
    "suicide": (v) => `${v} は命を絶った`,
    "thorns": (v, a) => a ? `${v} は ${a} を攻撃しようとして殺害された` : `${v} は殺害された`,
    "void": (v) => `${v} は世界の外へ落ちた`,
    "wither": (v) => `${v} は萎びてしまった`,
    "sonicBoom": (v, a) => a ? `${v} は ${a} の放った衝撃波で消し飛ばされた` : `${v} は衝撃波で消し飛ばされた`,
};

/**
 * 死亡ログ処理
 */
world.afterEvents.entityDie.subscribe((ev) => {
    const { deadEntity, damageSource } = ev;
    if (deadEntity.typeId !== "minecraft:player") return;

    const victim = deadEntity.name;
    const attacker = damageSource.damagingEntity?.name;
    const cause = damageSource.cause;

    let msg = "";
    if (deathMessageMap[cause]) {
        msg = deathMessageMap[cause](victim, attacker);
    } else {
        msg = `${victim} は死んだ`;
    }

    DiscordRelay.send(msg);
});

/**
 * チャット処理
 */
world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    const message = ev.message;
    const playerData = playerDatas.get(player.id);
    // --- 国に加入していないのに国・同盟チャットになっている場合の修正 ---
    if ((playerData.chattype === "country" || playerData.chattype === "ally") && (!playerData.country || !countryDatas.get(playerData.country))) {
        playerData.chattype = "world";
        playerDatas.set(player.id, playerData);
    }

    const countryname = countryDatas.get(playerData.country)?.name || "§7未所属";


    // --- AI質問の検知 ---
    if (message.startsWith("!ai ")) {
        sendChatToDiscord(message, player.name);
        ev.cancel = true;
        world.sendMessage(`[!ai] <${player.name}> ${message}`);
        return;
    }

    ev.cancel = true;

    let chatTypeSymbol = "";
    switch (playerData.chattype) {
        case "world": chatTypeSymbol = "§aW"; break;
        case "country": chatTypeSymbol = "§eC"; break;
        case "local": chatTypeSymbol = "§cL"; break;
        case "ally": chatTypeSymbol = "§dA"; break;
    }


    const secondname = playerData.secondname;
    const send = `[${chatTypeSymbol}§r][${secondname.before[secondname.now[0]]}§r${secondname.after[secondname.now[1]]}§r/${countryname}§r] <${player.name}> ${message}`;

    switch (playerData.chattype) {
        case "world":
            world.sendMessage(send);
            if (!message.startsWith("!ai ")) sendChatToDiscord(send, player.name, "world");
            break;
        case "country":
            for (const pc of world.getAllPlayers().filter(p => playerDatas.get(p.id).country == playerData.country)) {
                pc.sendMessage(send);
            }
            sendChatToDiscord(send, player.name, "country");
            break;
        case "local":
            for (const pc of player.dimension.getPlayers({ location: player.location, maxDistance: config.localChatDistance })) {
                pc.sendMessage(send);
            }
            sendChatToDiscord(send, player.name, "local");
            break;
        case "ally": { // ← 追加
            const myCountryData = countryDatas.get(playerData.country);
            if (!myCountryData) {
                player.sendMessage("§c国に所属していないため同盟チャットは使用できません。");
                break;
            }
            const allyIds = myCountryData.diplomacy?.ally ?? [];
            const allowedCountries = new Set([playerData.country, ...allyIds]);
            for (const pc of world.getAllPlayers().filter(p => allowedCountries.has(playerDatas.get(p.id).country))) {
                pc.sendMessage(send);
            }
            sendChatToDiscord(send, player.name, "ally");
            break;
        }
    }

}
);

/**
 * その他（参加退出・タイプ変更）
 */
export function ChangeChatType(player, type) {
    const playerData = playerDatas.get(player.id);
    if (playerData.chattype == type) {
        player.sendMessage({ translate: "cw.chattype.already", with: [type] });
        player.playSound("note.bass");
        return;
    }
    playerData.chattype = type;
    playerDatas.set(player.id, playerData);
    player.sendMessage({ translate: "cw.chattype.changed", with: [type] });
    player.playSound("random.orb");
}

const lastSpawnNotice = new Map();

world.afterEvents.playerSpawn.subscribe((ev) => {
    const { player, initialSpawn } = ev;
    if (!initialSpawn) return;
    const now = Date.now();
    const lastTime = lastSpawnNotice.get(player.id) || 0;
    if (now - lastTime > 3000) {
        lastSpawnNotice.set(player.id, now);
        const playerCount = world.getAllPlayers().length;
        const msg = `[§aW§r] ${player.name} が参加しました (§f${playerCount}§7人)`;
        world.sendMessage(msg);
        sendToDiscord(msg);
    }
});

world.beforeEvents.playerLeave.subscribe((ev) => {
    const { player } = ev;
    lastSpawnNotice.delete(player.id);
    const playerCount = world.getAllPlayers().length - 1;
    const msg = `[§aW§r] ${player.name} が退出しました (§f${playerCount}§7人)`;
    world.sendMessage(msg);
    sendToDiscord(msg);
});