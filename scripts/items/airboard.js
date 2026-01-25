import { world, system } from "@minecraft/server";

const dims = [];
const boosted = new Map();
const stopped = new Set();
const lastUse = new Map();

system.runTimeout(() => {
  dims.push(
    world.getDimension("overworld"),
    world.getDimension("nether"),
    world.getDimension("the_end")
  );
}, 0);

system.beforeEvents.startup.subscribe((e) => {
  e.itemComponentRegistry.registerCustomComponent('cw:airboard_key_component', {
    onUse(e) {
      const id = e.source.id;
      const now = system.currentTick;
      
      // 前回の使用から時間を記録
      lastUse.set(id, now);
      
      // 20tick後にチェック（長押しされなかったら短押し）
      system.runTimeout(() => {
        const current = lastUse.get(id);
        // まだ同じ使用時刻なら短押し確定
        if (current === now) {
          const ab = findAirboard(e.source);
          if (!ab) return e.source.sendMessage("§cエアボードに乗っていません");
          if (stopped.has(ab.id)) return e.source.sendMessage("§c停止モード中");
          
          boosted.set(ab.id, system.currentTick + 60);
          e.source.sendMessage("§e§lブースト！");
          e.source.playSound("mob.irongolem.throw", { pitch: 2.0 });
        }
      }, 20);
    },
    
    onCompleteUse(e) {
      const id = e.source.id;
      // 長押し完了したので使用時刻をクリア
      lastUse.delete(id);
      
      const ab = findAirboard(e.source);
      if (!ab) return e.source.sendMessage("§cエアボードに乗っていません");

      if (stopped.has(ab.id)) {
        stopped.delete(ab.id);
        e.source.sendMessage("§a移動モード");
        e.source.playSound("random.click", { pitch: 1.5 });
      } else {
        stopped.add(ab.id);
        ab.clearVelocity();
        e.source.sendMessage("§c停止モード");
        e.source.playSound("random.click", { pitch: 1.0 });
      }
    }
  });
});

function findAirboard(p) {
  for (const d of dims) {
    for (const ab of d.getEntities({ type: "cw:airboard", location: p.location, maxDistance: 3 })) {
      const r = ab.getComponent("minecraft:rideable");
      if (r?.getRiders().some(x => x.id === p.id)) return ab;
    }
  }
}

function hasPlayerAbove(ab) {
  const l = ab.location;
  for (const p of ab.dimension.getEntities({ type: "minecraft:player", location: l, maxDistance: 2 })) {
    if (p.location.y > l.y && p.location.y - l.y < 2) return true;
  }
}

system.runInterval(() => {
  const t = system.currentTick;

  for (const d of dims) {
    for (const ab of d.getEntities({ type: "cw:airboard" })) {
      const r = ab.getComponent("minecraft:rideable")?.getRiders();
      const id = ab.id;

      if (!r || !r[0] || r[0].typeId !== "minecraft:player") {
        hasPlayerAbove(ab) ? ab.clearVelocity() : ab.applyImpulse({ x: 0, y: -0.01, z: 0 });
        stopped.delete(id);
        boosted.delete(id);
        continue;
      }

      if (stopped.has(id)) { ab.clearVelocity(); continue; }

      const p = r[0];
      const dir = p.getViewDirection();
      const v = ab.getVelocity();
      const yDamp = (v.y > 0 && dir.y < 0) || (v.y < 0 && dir.y > 0) ? -v.y * 0.3 : -v.y * 0.1;
      const f = boosted.get(id) && t < boosted.get(id) ? 0.15 : 0.05;

      if (boosted.has(id) && t >= boosted.get(id)) boosted.delete(id);

      ab.applyImpulse({ x: dir.x * f, y: dir.y * f + yDamp, z: dir.z * f });
      ab.setRotation({ x: Math.asin(dir.y) * 180 / Math.PI, y: Math.atan2(-dir.x, dir.z) * 180 / Math.PI });
      d.spawnParticle("cw:airboard", ab.location);
    }
  }
}, 1);
