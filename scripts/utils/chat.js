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
 * チャットのスパム対策
 * 記録はメモリだけに持つ（抜けて入り直しても残る。reload・再起動で消える）。
 * OP（コマンドの権限が Admin 以上）は対象外。
 */
export const CHAT_GUARD = {
    minIntervalMs: 1000,          // 前の発言から1秒は空ける
    burstWindowMs: 10000,         // 10秒のあいだに
    burstMax: 5,                  // 5回まで
    duplicateWindowMs: 30000,     // 30秒以内に同じ内容は送れない
    duplicateHistory: 3,          // 直近3件と比べる
    duplicateMinLength: 3,        // 「w」「ok」のような短い発言は、同じ内容でも止めない
    maxLength: 200,               // これより長い発言は送れない
    strikeWindowMs: 60000,        // 1分のあいだに
    strikesToMute: 3,             // 3回止められたら、しばらく送れなくする
    muteMs: [60000, 300000, 900000], // 1回目は1分、2回目は5分、3回目から15分
    muteLevelResetMs: 3600000,    // 最後のミュートから1時間たったら、1回目に戻す
    aiCooldownMs: 30000,          // !ai は30秒に1回
};

/** 同じ内容かどうかを比べるための形（全角半角・大文字小文字・空白・§の装飾をそろえる） */
export function normalizeChat(message) {
    return String(message).normalize("NFKC").toLowerCase().replace(/§./g, "").replace(/\s+/g, "");
}

/**
 * 発言を通すかどうかを決めて、記録を更新する。
 * @param {object} state プレイヤーごとの記録（最初は {}）
 * @param {string} message
 * @param {number} now ミリ秒
 * @returns {{ ok: true } | { ok: false, reason: string, waitMs?: number, muteMs?: number }}
 */
export function checkChat(state, message, now, cfg = CHAT_GUARD) {
    state.sentAt ??= [];
    state.recent ??= [];
    state.strikes ??= [];

    if (state.mutedUntil > now) return { ok: false, reason: "muted", waitMs: state.mutedUntil - now };

    const text = normalizeChat(message);
    const isAi = message.startsWith("!ai ");
    state.sentAt = state.sentAt.filter(t => now - t < cfg.burstWindowMs);
    state.recent = state.recent.filter(r => now - r.at < cfg.duplicateWindowMs);

    let block;
    const last = state.sentAt[state.sentAt.length - 1];
    if (text.length === 0) {
        block = { reason: "empty" };
    } else if (message.length > cfg.maxLength) {
        block = { reason: "long" };
    } else if (text.length >= cfg.duplicateMinLength && state.recent.some(r => r.text === text)) {
        block = { reason: "duplicate" };
    } else if (last !== undefined && now - last < cfg.minIntervalMs) {
        block = { reason: "fast", waitMs: cfg.minIntervalMs - (now - last) };
    } else if (state.sentAt.length >= cfg.burstMax) {
        block = { reason: "fast", waitMs: cfg.burstWindowMs - (now - state.sentAt[0]) };
    } else if (isAi && state.lastAiAt !== undefined && now - state.lastAiAt < cfg.aiCooldownMs) {
        // !ai の待ち時間は連投には数えない
        return { ok: false, reason: "ai", waitMs: cfg.aiCooldownMs - (now - state.lastAiAt) };
    }

    if (block) {
        state.strikes = state.strikes.filter(t => now - t < cfg.strikeWindowMs);
        state.strikes.push(now);
        if (state.strikes.length >= cfg.strikesToMute) {
            const level = state.lastMuteAt !== undefined && now - state.lastMuteAt < cfg.muteLevelResetMs ? state.muteCount : 0;
            const muteMs = cfg.muteMs[Math.min(level, cfg.muteMs.length - 1)];
            state.mutedUntil = now + muteMs;
            state.muteCount = level + 1;
            state.lastMuteAt = now;
            state.strikes = [];
            return { ok: false, reason: block.reason, muteMs };
        }
        return { ok: false, ...block };
    }

    state.sentAt.push(now);
    state.recent.push({ text, at: now });
    if (state.recent.length > cfg.duplicateHistory) state.recent.shift();
    if (isAi) state.lastAiAt = now;
    return { ok: true };
}

/** 待ち時間を「N秒」「N分」で */
export function formatWait(ms) {
    const sec = Math.max(1, Math.ceil(ms / 1000));
    return sec < 60 ? `${sec}秒` : `${Math.ceil(sec / 60)}分`;
}

const BLOCK_MESSAGES = {
    empty: () => "§c空のメッセージは送れません。",
    long: (r, message) => `§cメッセージが長すぎます（${message.length}/${CHAT_GUARD.maxLength}文字）。`,
    duplicate: () => "§c同じ内容を続けて送ることはできません。",
    fast: (r) => `§cチャットの送信が速すぎます。${formatWait(r.waitMs)}待ってから送ってください。`,
    ai: (r) => `§c!ai は${formatWait(CHAT_GUARD.aiCooldownMs)}に1回までです。あと${formatWait(r.waitMs)}待ってください。`,
    muted: (r) => `§cチャットを送れるようになるまで、あと${formatWait(r.waitMs)}です。`,
};

const chatGuardStates = new Map();

/** 止めたら true（本人に理由を伝える） */
function guardChat(player, message) {
    if (player.commandPermissionLevel >= server.CommandPermissionLevel.Admin) return false;
    let state = chatGuardStates.get(player.id);
    if (!state) chatGuardStates.set(player.id, state = {});
    const result = checkChat(state, message, Date.now());
    if (result.ok) return false;
    if (result.muteMs) {
        player.sendMessage(`§cチャットの連投が続いたため、${formatWait(result.muteMs)}のあいだチャットを送れません。`);
        console.warn(`[chatguard] ${player.name} を ${Math.round(result.muteMs / 1000)}秒ミュート（${result.reason}、${state.muteCount}回目）`);
    } else {
        player.sendMessage(BLOCK_MESSAGES[result.reason](result, message));
    }
    return true;
}

/**
 * チャット処理
 */
world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    const message = ev.message;
    if (guardChat(player, message)) {
        ev.cancel = true;
        return;
    }
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