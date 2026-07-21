import { Util } from "../utils/util";
import { world, system } from "@minecraft/server";
import { Dypro } from "../utils/dypro";
import { PlayerDataStore, CountryDataStore, PlayerMarketDataStore } from "../utils/data_store";
import { getUserDypro, getCountryDypro } from "../utils/dypro_api";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");

// ===== 管理者用金銭操作コマンド =====
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id == "cw:setmoney") {
        let args = ev.message.split(" ");
        if (ev.sourceType == "Entity") {
            Util.setMoney(ev.sourceEntity, Number(args[0]));
            ev.sourceEntity.sendMessage({ translate: "cw.admin.setmoney", with: [ev.sourceEntity.name, args[0]] });
        }
    }
})
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id == "cw:addmoney") {
        let args = ev.message.split(" ");
        if (ev.sourceType == "Entity") {
            Util.addMoney(ev.sourceEntity, Number(args[0]));
            ev.sourceEntity.sendMessage({ translate: "cw.admin.addmoney", with: [ev.sourceEntity.name, args[0]] });
        }
    }
})
// タグリセット
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id == "cw:resetjob") {
        if (ev.sourceType == "Entity") {
            ev.sourceEntity.removeTag("job:0");
            ev.sourceEntity.removeTag("job:1");
            ev.sourceEntity.removeTag("job:2");
            ev.sourceEntity.removeTag("job:3");
            ev.sourceEntity.removeTag("job:4");
            ev.sourceEntity.removeTag("job:5");
            ev.sourceEntity.sendMessage({ translate: "cw.admin.resetjob", with: [ev.sourceEntity.name] });
        }
    }
    if (ev.id == "cw:test") {
        const player = ev.sourceEntity;
        player.dimension.getEntities({ type: "cw:tank" }).forEach(entity => {
            entity.setProperty("cw:health_type", 3);
            const comp = entity.getComponent("minecraft:health");
            comp.resetToMaxValue();
        })
    }
    if (ev.id == "cw:allreset") {
        world.clearDynamicProperties();
        for (const player of world.getAllPlayers()) {
            player.clearDynamicProperties();
            player.runCommand(`kick @s 初期化のため\nもう一度入りなおしてください`);

        }
    }
    if (ev.id == "cw:initial") {
        const playerData = playerDatas.get(ev.sourceEntity.id);
        if (!playerData) {
            ev.sourceEntity?.clearDynamicProperties();
            ev.sourceEntity?.runCommand(`kick @s 初期化のため\nもう一度入りなおしてください`);
        } else {
            ev.sourceEntity?.sendMessage(`§cプレイヤーデータが破損していないため実行できません。`);
        }
    }
    if (ev.id == "cw:force_initial") {
        ev.sourceEntity?.clearDynamicProperties();
        ev.sourceEntity?.runCommand(`kick @s 初期化のため\nもう一度入りなおしてください`);
    }
    if (ev.id === "cw:migrate") {
        const player = ev.sourceEntity;
        if (player) {
            player.sendMessage("§e[システム] Dyproデータのマイグレーションを開始します...");
        } else {
            console.warn("[システム] Dyproデータのマイグレーションを開始します...");
        }

        // 非同期処理を正しく行うため、内部で即時実行関数（IIFE）を使うか、外側をasyncにします。
        // （admin_command.jsは他のコマンドと同居しているため、非同期として処理を切り出します）
        (async () => {
            // 既存の全ダイナミックプロパティのIDを取得
            const allIds = world.getDynamicPropertyIds();
            const dyproKeys = new Map(); // name -> Set of paths

            for (const id of allIds) {
                // パターン: "name.path" または "name#path"
                const match = id.match(/^([^.#]+)[.#](.*)$/);
                if (match) {
                    const name = match[1];
                    let path = match[2];
                    // 分割保存用のサフィックスを除去して純粋なキーにする
                    path = path.replace(/__part\d+$/, "").replace(/__count$/, "");

                    if (!dyproKeys.has(name)) dyproKeys.set(name, new Set());
                    dyproKeys.get(name).add(path);
                }
            }

            let totalCount = 0;

            for (const [name, paths] of dyproKeys.entries()) {
                const dypro = new Dypro(name); // データ操作用の一時インスタンス

                for (const path of paths) {
                    try {
                        // 古い形式（#や分割保存）を含めてワールドからデータを復元
                        const data = dypro._getFromWorld(path);

                        if (data !== undefined) {
                            // 一旦古いワールドデータを完全に消去（#のキーや分割キーの掃除）
                            dypro._deleteFromWorld(path);

                            // 新しい形式で保存（playerとcountryは外部DBへ、それ以外はLRUキャッシュへ）
                            await dypro.set(path, data);
                            totalCount++;
                        }
                    } catch (e) {
                        console.warn(`[Migrate] ${name}.${path} の移行中にエラー: ${e}`);
                    }
                }

                // 一般データについて、LRUキャッシュに乗った変更をワールドに書き出し
                dypro.flushAll();
            }

            // playerとcountryとplayermarketのデータを外部DBに書き出し
            await PlayerDataStore.flushAll();
            await CountryDataStore.flushAll();
            await PlayerMarketDataStore.flushAll();


            if (player) {
                player.sendMessage(`§a[システム] マイグレーション完了！計 ${totalCount} 件のデータを新しい形式に変換・保存しました。`);
            } else {
                console.warn(`[システム] マイグレーション完了！計 ${totalCount} 件のデータを新しい形式に変換・保存しました。`);
            }
        })();
    }
})

// ===== 強制サーバー保存 =====
// 実行コマンド: /scriptevent cw:save
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id !== "cw:save") return;

    const player = ev.sourceEntity;
    const notify = (msg) => {
        if (player) player.sendMessage(msg);
        console.warn(msg);
    };

    notify("§e[システム] 強制保存を開始します...");

    (async () => {
        try {
            // 1. Dypro インスタンス（ワールドのダイナミックプロパティ側）を全て書き出し
            for (const instance of Dypro.registry.values()) {
                instance.flushAll();
            }

            // 2. player / country / playermarket の LRU キャッシュを外部DB（API）へ書き出し
            await PlayerDataStore.flushAll();
            await CountryDataStore.flushAll();
            await PlayerMarketDataStore.flushAll();

            notify("§a[システム] 強制保存が完了しました！");
        } catch (e) {
            notify(`§c[システム] 強制保存中にエラーが発生しました: ${e}`);
            console.error("[cw:save] エラー:", e);
        }
    })();
});

// ===== 外部DBデータ取得コマンド =====
system.afterEvents.scriptEventReceive.subscribe(ev => {
    // プレイヤーデータを取得するコマンド
    if (ev.id === "cw:getplayerdata") {
        const targetId = ev.message.trim(); // 送信されたメッセージ（ID）を取得
        if (!targetId) {
            ev.sourceEntity?.sendMessage("§c対象のIDを指定してください。");
            return;
        }

        ev.sourceEntity?.sendMessage(`§e[システム] プレイヤーデータ(${targetId})を取得中...`);

        // 非同期（裏側）でデータを取得して表示する
        (async () => {
            const data = await getUserDypro(targetId);
            // 取得したデータを文字列（JSON形式）にしてチャットに表示します
            ev.sourceEntity?.sendMessage(`§a[プレイヤーデータ: ${targetId}]\n${JSON.stringify(data, null, 2)}`);
        })();
    }

    // 国データを取得するコマンド
    if (ev.id === "cw:getcountrydata") {
        const targetId = ev.message.trim(); // 送信されたメッセージ（ID）を取得
        if (!targetId) {
            ev.sourceEntity?.sendMessage("§c対象のIDを指定してください。");
            return;
        }

        ev.sourceEntity?.sendMessage(`§e[システム] 国データ(${targetId})を取得中...`);

        // 非同期（裏側）でデータを取得して表示する
        (async () => {
            const data = await getCountryDypro(targetId);
            // 取得したデータを文字列（JSON形式）にしてチャットに表示します
            ev.sourceEntity?.sendMessage(`§a[国データ: ${targetId}]\n${JSON.stringify(data, null, 2)}`);
        })();
    }
});
