import { world, system } from "@minecraft/server";

system.runInterval(() => {
  for (const airboard of world.getDimension("overworld").getEntities({ type: "cw:airboard" })) {
    const rideable = airboard.getComponent("minecraft:rideable");
    if (!rideable) continue;
    const riders = rideable.getRiders();
    
    // ライダーがいない、またはプレイヤーがいない場合は下に落とす
    if (!riders || riders.length === 0 || riders[0].typeId !== "minecraft:player") {
      airboard.applyImpulse({
        x: 0,
        y: -0.05,
        z: 0
      });
      continue;
    }
    
    const player = riders[0];
    const dir = player.getViewDirection();
    const velocity = airboard.getVelocity();
    
    // Y軸の速度減衰（慣性を減らす）
    // 上昇中に下を向いた場合、または下降中に上を向いた場合に速度を打ち消す
    let yDamping = 0;
    if ((velocity.y > 0 && dir.y < 0) || (velocity.y < 0 && dir.y > 0)) {
      // 逆方向を向いたら現在の速度を強く減衰
      yDamping = -velocity.y * 0.3;
    } else {
      // 同じ方向なら軽く減衰
      yDamping = -velocity.y * 0.1;
    }
    
    // 飛行力の付与
    airboard.applyImpulse({
      x: dir.x * 0.05,
      y: dir.y * 0.05 + yDamping,
      z: dir.z * 0.05
    });

    // 向きの設定（setRotation）
    const yaw = Math.atan2(-dir.x, dir.z) * (180 / Math.PI);
    const pitch = Math.asin(dir.y) * (180 / Math.PI);
    const location = {
      x: airboard.location.x,
      y: airboard.location.y,
      z: airboard.location.z
    };
    airboard.setRotation({ x: pitch, y: yaw });
    
    // パーティクルを出すためのやつ
    airboard.dimension.spawnParticle("cw:airboard", location);
  }
}, 1);
