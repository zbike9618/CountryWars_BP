import { world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { selectPlayer } from "../utils/player_picker.js";

export async function openTransceiver(sender) {
    const recipient = await selectPlayer(sender, () => world.getPlayers()
        .filter(p => p.id !== sender.id).map(p => ({ id: p.id, name: p.name })));
    if (!recipient) return;
    const result = await new ModalFormData().title("トランシーバー")
        .textField({ text: "送信先: " + recipient.name + "\nメッセージ" }, "メッセージを入力")
        .show(sender);
    if (result.canceled) return;
    const message = String(result.formValues[0] ?? "").trim();
    if (!message) return;
    const target = world.getPlayers().find(p => p.id === recipient.id);
    if (!target) {
        sender.sendMessage({ translate: "cw.sendmsg.offline", with: [recipient.name] });
        return;
    }
    target.sendMessage({ translate: "cw.sendmsg.receive", with: [sender.name, message] });
    sender.sendMessage({ translate: "cw.sendmsg.sent", with: [target.name, message] });
}
