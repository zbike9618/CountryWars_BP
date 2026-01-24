import { world, system } from "@minecraft/server";

system.runInterval(() => {
  for (const airboard of world.getDimension("overworld").getEntities({ type: "cw:airboard" })) {
    const rideable = airboard.getComponent("minecraft:rideable");
    if (!rideable) continue;
    const riders = rideable.getRiders();
    
    // ライダーがいない、またはプレイヤーがいない場合は下に落とす
    if (!riders || riders.length === 0 || riders[0].typeId !== "minecraft:player") {
      // 下方向に力を加える（重力のように）
      airboard.applyImpulse({
        x: 0,
        y: -0.05, // 下向きの力（値を調整可能）
        z: 0
      });
      continue;
    }
    
    const player = riders[0];

    const dir = player.getViewDirection();
    
    // 飛行力の付与（前進）
    airboard.applyImpulse({
      x: dir.x * 0.05,
      y: dir.y * 0.000000005,
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
