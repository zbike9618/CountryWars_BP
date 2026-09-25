import { world } from "@minecraft/server";

const COOLDOWN_MS = 30 * 60 * 1000;
const cooldowns = new Map();
const DEFAULT_MAX_AMPLIFIER = 3;
// 強すぎる効果は個別に上限を下げる (amplifier 0 = Lv1)
const MAX_AMPLIFIER = {
  resistance: 1, // 耐性II (被ダメ-40%)
  regeneration: 1, // 再生II
};

world.afterEvents.itemUse.subscribe((event) => {
  const { source: player, itemStack } = event;

  if (itemStack?.typeId !== "cw:end_sword") return;

  const now = Date.now();
  const lastUsed = cooldowns.get(player.name) ?? 0;
  const remaining = COOLDOWN_MS - (now - lastUsed);

  if (remaining > 0) {
    const m = Math.ceil(remaining / 60000);
    player.sendMessage(`§cクールタイム中...あと約${m}分`);
    return;
  }

  const effects = player.getEffects();

  if (effects.length === 0) {
    player.sendMessage("失敗!!!!");
    return;
  }

  for (const effect of effects) {
    const maxAmplifier = MAX_AMPLIFIER[effect.typeId] ?? DEFAULT_MAX_AMPLIFIER;
    const amplifier = Math.min(effect.amplifier, maxAmplifier);

    player.addEffect(effect.typeId, 20000000, {
      amplifier: amplifier,
      showParticles: effect.isVisible,
    });
  }
  player.addEffect("hunger", 20000000, { amplifier: 100 });


  cooldowns.set(player.name, now);

  player.sendMessage(`§5EndLess`);
  player.dimension.playSound("random.explode", player.location, {
    volume: 1.0,
    pitch: 1.0,
  });
});