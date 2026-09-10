import {
  system,
  world,
  CommandPermissionLevel,
  CustomCommandStatus,
  CustomCommandParamType
} from "@minecraft/server";

import { ModalFormData } from "@minecraft/server-ui";

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

  return { status: CustomCommandStatus.Success };
}

function openSelectForm(sender, message) {
  const senderName = sender.name;

  const onlinePlayers = [...world.getPlayers()];
  const sortedNames = onlinePlayers
    .map(p => String(p.name))
    .sort((a, b) => a.localeCompare(b, "en"));

  const recent = recentTargets.get(senderName) ?? [];

  const recentOptions =
    recent.length > 0 ? recent.map(v => String(v)) : ["なし"];

  const onlineOptions =
    sortedNames.length > 0 ? sortedNames : ["オンラインプレイヤーなし"];

const form = new ModalFormData()
  .title({ translate: "cw.sendmsg.title" })
  .toggle({ translate: "cw.sendmsg.toggle.recent" }, { defaultValue: false })
  .dropdown({ translate: "cw.sendmsg.dropdown.recent" }, recentOptions, { defaultValueIndex: 0 })
  .dropdown({ translate: "cw.sendmsg.dropdown.online" }, onlineOptions, { defaultValueIndex: 0 });

  form.show(sender).then(res => {
    if (res.canceled) return;

    const useRecent  = res.formValues[0]; // boolean
    const recentIndex  = res.formValues[1];
    const onlineIndex  = res.formValues[2];

    let targetName = null;

    // チェックON かつ recent に有効なエントリがある場合だけ直近を使う
    if (useRecent && recent.length > 0 && recentIndex < recent.length) {
      targetName = recent[recentIndex];
    } else if (sortedNames.length > 0 && onlineIndex < sortedNames.length) {
      targetName = sortedNames[onlineIndex];
    }

    if (!targetName) return;

    const target = world.getPlayers().find(p => p.name === targetName);
    if (!target) {
      sender.sendMessage({ translate: "cw.sendmsg.offline", with: [targetName] });
      return;
    }

    target.sendMessage({ translate: "cw.sendmsg.receive", with: [senderName, message] });

    // 送った側への確認メッセージ
    sender.sendMessage({ translate: "cw.sendmsg.sent", with: [targetName, message] });

    updateRecent(senderName, targetName);
  });
}

function updateRecent(senderName, targetName) {
  let list = recentTargets.get(senderName) ?? [];
  list = list.filter(name => name !== targetName);
  list.unshift(targetName);
  if (list.length > 3) list = list.slice(0, 3);
  recentTargets.set(senderName, list);
}