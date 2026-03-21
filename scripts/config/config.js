export default {
    // 初期所持金
    initialMoney: 2000,
    //localChatの範囲
    localChatDistance: 20,
    //通貨

    //建国するのに必要な金額
    countryprice: 1000,
    //1チャンクごとにおける土地の維持費
    maintenance: 100,
    //チャンク購入の金額
    chunkprice: 1000,
    //一国が保有できる最大チャンク数
    maxchunk: 128,
    //設定できるhomeの数
    maxhome: 5,
    //最大戦争勝利金
    maxWarMoney: 100000,
    //株売却時の国に必ず残るお金
    stockMaxSell: 5000,
    // タンクのアタッチメント最大数
    tankMaxSlots: 5,
    // 戦争保護期間 (日) - デフォルト7日間
    warProtectionPeriod: 7,
    // 外部通信用APIトークン
    apiToken: "SECRET_MINECRAFT_TOKEN_CW",
    //ロビーの座標
    lobby: { x: 9.01, y: 64.50, z: 8.95 },
    // 連勝によって自身が得られる報酬の最大倍率（例: 10連勝で最大1.3倍）
    maxWinStreakWinMultiplier: 1.3,
    // 連勝している国を倒した（その国が敗北した）時に適用される最大倍率（例: 10連勝の国を倒すと最大10倍）
    maxWinStreakLoseMultiplier: 10.0,
    // 連勝ボーナスがカンストする最大連勝数
    maxWinStreakBonusCount: 10
};
