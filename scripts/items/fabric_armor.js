import { world, system, EntityComponentTypes } from "@minecraft/server";

/**

- エンティティの移動速度を変更する関数
- @param {Entity} entity - 対象のエンティティ（プレイヤーやモブ）
- @param {number} speed - 設定したい速度（例: 0.1 = 遅い, 0.5 = 速い）
- @returns {boolean} - 成功したらtrue、失敗したらfalse
  */
export function setEntitySpeed(entity, speed) {
  try {
    const movement = entity.getComponent(EntityComponentTypes.Movement);

    if (!movement) {
      console.warn(`${entity.typeId} には移動コンポーネントがありません`);
      return false;
    }

    movement.setCurrentValue(speed);
    return true;
  } catch (error) {
    console.error("速度設定エラー:", error);
    return false;
  }
}

/**

- エンティティの移動速度を取得する関数
- @param {Entity} entity - 対象のエンティティ
- @returns {number|null} - 現在の速度値、取得できない場合はnull
  */
export function getEntitySpeed(entity) {
  try {
    const movement = entity.getComponent(EntityComponentTypes.Movement);

    if (!movement) {
      return null;
    }

    return movement.currentValue;
  } catch (error) {
    console.error("速度取得エラー:", error);
    return null;
  }
}

/**

- エンティティの移動速度をデフォルトに戻す関数
- @param {Entity} entity - 対象のエンティティ
- @returns {boolean} - 成功したらtrue
  */
export function resetEntitySpeed(entity) {
  try {
    const movement = entity.getComponent(EntityComponentTypes.Movement);

    if (!movement) {
      return false;
    }

    movement.resetToDefaultValue();
    return true;
  } catch (error) {
    console.error("速度リセットエラー:", error);
    return false;
  }
}

/**

- エンティティの移動速度を倍率で変更する関数
- @param {Entity} entity - 対象のエンティティ
- @param {number} multiplier - 倍率（例: 2.0 = 2倍速, 0.5 = 半分の速度）
- @returns {boolean} - 成功したらtrue
  */
export function multiplyEntitySpeed(entity, multiplier) {
  try {
    const movement = entity.getComponent(EntityComponentTypes.Movement);

    if (!movement) {
      return false;
    }

    const currentSpeed = movement.currentValue;
    const newSpeed = currentSpeed * multiplier;

    movement.setCurrentValue(newSpeed);
    return true;
  } catch (error) {
    console.error("速度倍率変更エラー:", error);
    return false;
  }
}


system.runInterval(() => {
  const players = world.getPlayers();
  for (const player of players) {
    const equip = player.getComponent("minecraft:equippable");
    let power = 0;
    if (equip.getEquipment("Chest")?.typeId === "cw:fabric_chestplate") { power++ };
    if (equip.getEquipment("Legs")?.typeId === "cw:fabric_leg") { power++ };
    if (equip.getEquipment("Feet")?.typeId === "cw:fabric_boots") { power++ };
    if (equip.getEquipment("Head")?.typeId === "cw:fabric_helmet") { power++ };
    const speed = 0.1 + power * 0.05;
    //player.sendMessage(`${power} ${speed}`);
    if (speed == 0.1) return;
    if (power > 0) {
      setEntitySpeed(player, speed); // 速度を0.2に設定
    } else {
      resetEntitySpeed(player);
    }
  }
}, 10);