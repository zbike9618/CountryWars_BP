import * as server from "@minecraft/server";
const { world, system, EntityDamageCause } = server;

export class AttackFunction {
  /**
   * @param {import("@minecraft/server").Entity} executor 攻撃者
   */
  constructor(executor) {
    this.executor = executor;
  }

  /**
   * 斬撃攻撃（同一tick内で完了）
   * @param {string | ((target: import("@minecraft/server").Entity) => void) | {damage:number, damageCause?: import("@minecraft/server").EntityDamageCause}} arg1 パーティクルID、またはコールバック (target) => {}、またはdamageInfo
   * @param {number | string} [arg2] 離心率、またはパーティクルID
   * @param {number} [arg3] 扇形の広がり角度（度）、または離心率
   * @param {number} [arg4] 0=水平斬り / 180=縦斬り（度）、または扇形の広がり角度
   * @param {number} [arg5] 扇の基本半径、または角度
   * @param {((target: import("@minecraft/server").Entity) => void) | number} [arg6] コールバック (target) => {}、または半径
   * @param {((target: import("@minecraft/server").Entity) => void)} [arg7] コールバック (target) => {}
   * @returns {import("@minecraft/server").Entity[]} ヒットしたターゲットの配列
   */
  ZangekiAttack(...args) {
    const source = this.executor;
    if (!source) return [];

    let callback = null;
    let damageInfo = null;
    let particle = "";
    let eccentricity = 0;
    let spandeg = 120;
    let angle = 0;
    let radius = 3.0;

    // パラメータの判定（コールバックを先頭または末尾どちらでも受け取れるように対応）
    if (typeof args[0] === "function") {
      // (callback, particle, eccentricity, spandeg, angle, radius)
      callback = args[0];
      particle = args[1] ?? "";
      eccentricity = args[2] ?? 0;
      spandeg = args[3] ?? 120;
      angle = args[4] ?? 0;
      radius = args[5] ?? 3.0;
    } else if (typeof args[0] === "string") {
      // (particle, eccentricity, spandeg, angle, radius, callback)
      particle = args[0];
      eccentricity = args[1] ?? 0;
      spandeg = args[2] ?? 120;
      angle = args[3] ?? 0;
      radius = args[4] ?? 3.0;
      if (typeof args[5] === "function") {
        callback = args[5];
      }
    } else if (args[0] && typeof args[0] === "object") {
      // 後方互換: (damageInfo, particle, eccentricity, spandeg, angle, radius, callback)
      damageInfo = args[0];
      particle = args[1] ?? "";
      eccentricity = args[2] ?? 0;
      spandeg = args[3] ?? 120;
      angle = args[4] ?? 0;
      radius = args[5] ?? 3.0;
      if (typeof args[6] === "function") {
        callback = args[6];
      }
    } else {
      particle = args[1] ?? "";
      eccentricity = args[2] ?? 0;
      spandeg = args[3] ?? 120;
      angle = args[4] ?? 0;
      radius = args[5] ?? 3.0;
      if (typeof args[6] === "function") {
        callback = args[6];
      }
    }

    const dim = source.dimension;
    const headPos = source.getHeadLocation();
    const origin = { x: headPos.x, y: headPos.y - 1, z: headPos.z };

    // ---- パラメータ ----
    const steps = Math.floor(spandeg / 10);              // 斬撃の分割数（多いほどなめらか）
    const baseRadius = radius;     // 扇の基本半径（見た目＆基準射程）
    const spanDeg = spandeg;           // 扇形の角度（左右方向の広がり）
    const spanRad = (spanDeg * Math.PI) / 180;
    const ecc = Math.max(0, Math.min(1, eccentricity ?? 0));

    // angle(0〜180) を 0〜1 に正規化 → 0=水平, 1=垂直
    const tAngle = Math.max(0, Math.min(180, angle)) / 180;

    // ダメージ判定は「半径+1」
    const maxRadius = baseRadius + 1;

    // ====== ローカル座標系（forward/right/upLocal） ======

    // プレイヤーの視線方向ベクトル
    const view = source.getViewDirection();
    let forward = { x: view.x, y: view.y, z: view.z };
    let fLen = Math.hypot(forward.x, forward.y, forward.z);
    if (fLen === 0) {
      forward = { x: 0, y: 0, z: 1 };
      fLen = 1;
    } else {
      forward.x /= fLen;
      forward.y /= fLen;
      forward.z /= fLen;
    }

    // 世界の上方向
    const upWorld = { x: 0, y: 1, z: 0 };

    // 右方向（視線と世界の上方向から計算） forward × upWorld
    let right = {
      x: forward.y * upWorld.z - forward.z * upWorld.y,
      y: forward.z * upWorld.x - forward.x * upWorld.z,
      z: forward.x * upWorld.y - forward.y * upWorld.x,
    };
    let rLen = Math.hypot(right.x, right.y, right.z);
    if (rLen === 0) {
      right = { x: 1, y: 0, z: 0 };
      rLen = 1;
    } else {
      right.x /= rLen;
      right.y /= rLen;
      right.z /= rLen;
    }

    // ローカルな「上方向」 = right × forward
    let upLocal = {
      x: right.y * forward.z - right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y - right.y * forward.x,
    };
    let uLen = Math.hypot(upLocal.x, upLocal.y, upLocal.z);
    if (uLen === 0) {
      upLocal = { x: 0, y: 1, z: 0 };
      uLen = 1;
    } else {
      upLocal.x /= uLen;
      upLocal.y /= uLen;
      upLocal.z /= uLen;
    }

    // ---- 任意軸回転関数（Rodrigues） ----
    function rotateVec(v, axis, theta) {
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const vx = v.x, vy = v.y, vz = v.z;
      const kx = axis.x, ky = axis.y, kz = axis.z;

      const dot = vx * kx + vy * ky + vz * kz;

      return {
        x:
          vx * cos +
          (ky * vz - kz * vy) * sin +
          kx * dot * (1 - cos),
        y:
          vy * cos +
          (kz * vx - kx * vz) * sin +
          ky * dot * (1 - cos),
        z:
          vz * cos +
          (kx * vy - ky * vx) * sin +
          kz * dot * (1 - cos),
      };
    }

    // ====== angle を「横〜縦」の切り替えに使う ======
    //
    // angle = 0   → swingAxis = upLocal  （水平スイング）
    // angle = 180 → swingAxis = right    （垂直スイング）
    const swingAxis = (() => {
      const ax = upLocal.x * (1 - tAngle) + right.x * tAngle;
      const ay = upLocal.y * (1 - tAngle) + right.y * tAngle;
      const az = upLocal.z * (1 - tAngle) + right.z * tAngle;
      const len = Math.hypot(ax, ay, az);
      if (len === 0) return upLocal;
      return { x: ax / len, y: ay / len, z: az / len };
    })();

    // スイングの中心方向：forward を swingAxis に直交な平面へ投影
    let centerDir = (() => {
      const dot = forward.x * swingAxis.x + forward.y * swingAxis.y + forward.z * swingAxis.z;
      const px = forward.x - swingAxis.x * dot;
      const py = forward.y - swingAxis.y * dot;
      const pz = forward.z - swingAxis.z * dot;
      const len = Math.hypot(px, py, pz);
      if (len === 0) return forward;
      return { x: px / len, y: py / len, z: pz / len };
    })();

    // 判定用：中心方向からの最大角度
    const cosLimit = Math.cos(spanRad / 2);

    // ====== パーティクル描画（扇形の外周） ======

    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0〜1
      const phi = (t - 0.5) * spanRad; // -span/2〜+span/2

      // 離心率による「前に伸びる量」（見た目用）
      const rCircle = baseRadius;
      const rParabola = baseRadius * (1 + 0.8 * (t - 0.5));
      const r = rCircle * (1 - ecc) + rParabola * ecc;

      // centerDir を swingAxis まわりに左右に回転させて弧を作る
      const dir = rotateVec(centerDir, swingAxis, phi);

      const pos = {
        x: origin.x + dir.x * r,
        y: origin.y + dir.y * r,
        z: origin.z + dir.z * r,
      };

      if (particle) {
        try {
          dim.spawnParticle(particle, pos);
        } catch (e) {
          console.warn("particle spawn error", e);
        }
      }
    }

    // ====== 攻撃判定：自分中心＋半径 (radius + 1) の扇形全域 ======

    const hitIds = new Set();
    let targets = [];
    try {
      const candidates = dim.getEntities({
        location: origin,
        maxDistance: maxRadius, // radius + 1
      });
      for (const target of candidates) {
        if (target.id === source.id) continue;

        const tPos = target.getHeadLocation();
        const vx = tPos.x - origin.x;
        const vy = tPos.y - origin.y;
        const vz = tPos.z - origin.z;

        const dist = Math.hypot(vx, vy, vz);
        if (dist === 0 || dist > maxRadius) continue;

        const invDist = 1 / dist;
        const vnx = vx * invDist;
        const vny = vy * invDist;
        const vnz = vz * invDist;

        // 扇の中心方向（centerDir）からの角度チェック
        const cosTheta =
          vnx * centerDir.x + vny * centerDir.y + vnz * centerDir.z;

        // 規定角度より外側ならヒットさせない
        if (cosTheta < cosLimit) continue;

        if (hitIds.has(target.id)) continue;
        hitIds.add(target.id);

        targets.push(target);

        if (typeof callback === "function") {
          try {
            callback(target);
          } catch (e) {
            console.error("ZangekiAttack callback error", e);
          }
        } else if (damageInfo && typeof damageInfo.damage === "number") {
          try {
            target.applyDamage(damageInfo.damage, {
              cause: damageInfo.damageCause ?? EntityDamageCause.entityAttack,
              damagingEntity: source,
            });
          } catch (e) {
            console.error("applyDamage error", e);
          }
        }
      }
    } catch (e) {
      console.error("AoE getEntities error", e);
    }
    finally {
      return targets;
    }
  }
}
