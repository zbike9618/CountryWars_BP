import {
  system,
  world,
  CommandPermissionLevel,
  CustomCommandStatus,
  CustomCommandParamType
} from "@minecraft/server";

import { ModalFormData } from "@minecraft/server-ui";

/*
  recentTargets
  key: 送信者名
  value: [直近送信先1, 2, 3]
*/
const recentTargets = new Map();

system.beforeEvents.startup.subscribe(ev => {

  const commandDef = {
    name: "cw:s",
    description: "フォームからプレイヤーを選んでメッセージ送信",
    permissionLevel: CommandPermissionLevel.Any,
    mandatoryParameters: [
      {
        name: "message",
        type: CustomCommandParamType.String
      }
    ],
    optionalParameters: []
  };

  ev.customCommandRegistry.registerCommand(commandDef, sendMessage);
});

/* ============================= */

function sendMessage(origin, message) {

  const sender = origin.sourceEntity;

  if (!sender || sender.typeId !== "minecraft:player") {
    return {
      status: CustomCommandStatus.Failure,
      message: "プレイヤーのみ実行可能"
    };
  }

  system.run(() => {
    openSelectForm(sender, message);
  });

  return {
    status: CustomCommandStatus.Success
  };
}

/* ============================= */
function openSelectForm(sender, message) {

  const senderName = sender.name;

  // 🔹 全オンラインプレイヤー（自分も含む）
  const onlinePlayers = [...world.getPlayers()];

  // 🔹 名前だけ抽出 → 文字列化 → アルファベット順
  const sortedNames = onlinePlayers
    .map(p => String(p.name))
    .sort((a, b) => a.localeCompare(b, "en"));

  const recent = recentTargets.get(senderName) ?? [];

  const recentOptions =
    Array.isArray(recent) && recent.length > 0
      ? recent.map(v => String(v))
      : ["なし"];

  const onlineOptions =
    sortedNames.length > 0
      ? sortedNames
      : ["オンラインプレイヤーなし"];

  const form = new ModalFormData()
    .title("送信先を選択")
    .dropdown(
      "直近の送信先",
      recentOptions,
      { defaultValueIndex: 0 }
    )
    .dropdown(
      "オンラインプレイヤー",
      onlineOptions,
      { defaultValueIndex: 0 }
    );

  form.show(sender).then(res => {

    if (res.canceled) return;

    const recentIndex = res.formValues[0];
    const onlineIndex = res.formValues[1];

    let targetName = null;

    if (recent.length > 0 && recentIndex < recent.length) {
      targetName = recent[recentIndex];
    } else if (sortedNames.length > 0 && onlineIndex < sortedNames.length) {
      targetName = sortedNames[onlineIndex];
    }

    if (!targetName) return;

    const target = world.getPlayers()
      .find(p => p.name === targetName);

    if (!target) return;

    const formatted =
      `>>>${senderName}からのメッセージです：${message}`;

    target.sendMessage(formatted);

    updateRecent(senderName, targetName);
  });
}

/* ============================= */

function updateRecent(senderName, targetName) {

  let list = recentTargets.get(senderName) ?? [];

  list = list.filter(name => name !== targetName);

  list.unshift(targetName);

  if (list.length > 3) {
    list = list.slice(0, 3);
  }

  recentTargets.set(senderName, list);
}