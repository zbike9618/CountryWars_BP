import * as server from "@minecraft/server"
const { world, system } = server;
import { War } from "../utils/war.js";
import { Dypro } from "../utils/dypro.js";
const countryDatas = new Dypro("country")
const playerDatas = new Dypro("player")
import { Util } from "../utils/util.js";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
system.beforeEvents.startup.subscribe(ev => {
    /**
     * setLivesコマンドを定義
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:war", // コマンド名
        description: "戦争関連のフォーム", // コマンド説明
        permissionLevel: server.CommandPermissionLevel.Any, // 権限レベル: ope
        // 必須の引数
        mandatoryParameters: [
        ], // なし
        // 引数
        optionalParameters: [
        ],
    }


    ev.customCommandRegistry.registerCommand(command, DoCommand);
});

function DoCommand(origin) {
    // もし実行者エンティティの種族がプレイヤーではないなら
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        // コマンド結果を返す
        return {
            status: server.CustomCommandStatus.Failure, // 失敗
            message: "実行者はプレイヤーである必要があります",
        }
    }

    const player = origin.sourceEntity;
    //関数を実行する
    system.run(() => {
        const playerData = playerDatas.get(player.id);
        const countryData = countryDatas.get(playerData.country);
        warForm(player, countryData)
    })



    // コマンド結果を返す
    return {
        status: server.CustomCommandStatus.Success, // 成功
        message: undefined, // メッセージなし
    }
}
async function warForm(player, countryData) {
    if (!countryData) {
        player.sendMessage({ translate: "cw.form.unjoincountry" })
        return;
    }
    const form = new ActionFormData()
    form.title({ translate: `cw.warform.title` })
    form.button({ translate: `cw.warform.declare` })//宣戦布告
    form.button({ translate: `cw.warform.peace` })
    const res = await form.show(player)
    if (res.selection === 0) {
        declareForm(player, countryData)
    }
    if (res.selection == 1) {
        peaceForm(player, countryData)
    }
}
async function declareForm(player, countryData) {
    const form = new ModalFormData()
    const countriesData = countryDatas.idList.map(id => countryDatas.get(id)).filter(data => data.id !== countryData.id && !data.warcountry.includes(countryData.id))
    if (countriesData.length == 0) {
        player.sendMessage({ translate: "cw.warform.declare.none" })
        return
    }
    if (countryData.isPeace) {
        player.sendMessage({ translate: "cw.warform.declare.peace" })
        return
    }

    form.title({ translate: `cw.warform.declare` })
    world.sendMessage(`${countriesData.map(data => data.name)}`)
    form.dropdown({ translate: `cw.form.countrychoise` }, countriesData.map(data => data.name))
    const res = await form.show(player)
    if (res.canceled) return;
    const enemyData = countriesData[res.formValues[0]];
    if (enemyData.chunkAmount == 0 || countryData.chunkAmount == 0) {
        const mform = new MessageFormData()
        mform.title({ translate: `cw.warform.declare` })
        mform.body({ translate: `cw.warform.declare.nochunk` })
        mform.button1({ translate: "cw.form.redo" })
        mform.button2({ translate: "cw.form.cancel" })
        const resp = await mform.show(player)
        if (resp.selection === 0) {
            declareForm(player, countryData)
        }
        return
    }
    const mform = new MessageFormData()
    mform.title({ translate: `cw.warform.declare` })
    mform.body({ translate: `cw.warform.declare.check`, with: [enemyData.name] })
    mform.button1({ translate: "cw.form.yes" })
    mform.button2({ translate: "cw.form.no" })
    const resp = await mform.show(player)
    if (resp.selection === 0) {
        War.declareTo(countryData, enemyData)
        //宣戦布告を送信
        world.sendMessage({ translate: `cw.warform.declare.message`, with: [countryData.name, enemyData.name] })
        for (const player of world.getAllPlayers()) {
            player.playSound("mob.enderdragon.growl")
        }
        for (const player of Util.GetCountryPlayer(enemyData)) {
            player.onScreenDisplay.setTitle({ translate: `cw.warform.declared`, with: [countryData.name] })
            player.playSound("random.anvil_use")
        }
    }
}

async function peaceForm(player, countryData) {
    const warCountries = countryData.warcountry || [];

    if (warCountries.length === 0) {
        player.sendMessage({ translate: "cw.warform.peace.nowar" });
        return;
    }

    const form = new ActionFormData();
    form.title({ translate: "cw.warform.peace" });
    form.body({ translate: "cw.warform.peace.select" });

    for (const enemyId of warCountries) {
        const enemyData = countryDatas.get(enemyId);
        if (!enemyData) continue;

        // 提案状態を確認
        // 提案状態を確認
        let statusPart;
        if (countryData.peaceProposals && countryData.peaceProposals[enemyId]) {
            const proposal = countryData.peaceProposals[enemyId];
            statusPart = proposal.proposerAccepted && proposal.targetAccepted
                ? { translate: "cw.warform.peace.status.both_accepted" }
                : proposal.proposerAccepted
                    ? { translate: "cw.warform.peace.status.self_accepted" }
                    : { translate: "cw.warform.peace.status.pending_out" };
        } else if (enemyData.peaceProposals && enemyData.peaceProposals[countryData.id]) {
            const proposal = enemyData.peaceProposals[countryData.id];
            statusPart = proposal.proposerAccepted && proposal.targetAccepted
                ? { translate: "cw.warform.peace.status.both_accepted" }
                : proposal.targetAccepted
                    ? { translate: "cw.warform.peace.status.self_accepted" }
                    : { translate: "cw.warform.peace.status.pending_in" };
        } else {
            statusPart = { text: "" };
        }

        form.button({
            rawtext: [
                { text: enemyData.name },
                statusPart
            ]
        });
    }

    const res = await form.show(player);
    if (res.canceled) return;

    const enemyData = countryDatas.get(warCountries[res.selection]);
    if (enemyData) {
        peaceManageForm(player, countryData, enemyData);
    }
}

async function peaceManageForm(player, myCountry, enemyCountry) {
    // 提案を確認
    let proposal = null;
    let isProposer = false;
    let hasAccepted = false;
    let otherAccepted = false;

    if (myCountry.peaceProposals && myCountry.peaceProposals[enemyCountry.id]) {
        proposal = myCountry.peaceProposals[enemyCountry.id];
        isProposer = true;
        hasAccepted = proposal.proposerAccepted;
        otherAccepted = proposal.targetAccepted;
    } else if (enemyCountry.peaceProposals && enemyCountry.peaceProposals[myCountry.id]) {
        proposal = enemyCountry.peaceProposals[myCountry.id];
        isProposer = false;
        hasAccepted = proposal.targetAccepted;
        otherAccepted = proposal.proposerAccepted;
    }

    const form = new ActionFormData();
    form.title({ translate: "cw.warform.peace.manage", with: [enemyCountry.name] });

    let bodyText;
    if (proposal) {
        const moneyAmount = proposal.proposedMoney;
        const proposerName = isProposer ? myCountry.name : enemyCountry.name;
        const targetName = isProposer ? enemyCountry.name : myCountry.name;

        let proposalPart;
        if (moneyAmount > 0) {
            proposalPart = { translate: "cw.warform.peace.proposal.offer", with: [proposerName, targetName, `${moneyAmount}`] };
        } else if (moneyAmount < 0) {
            proposalPart = { translate: "cw.warform.peace.proposal.request", with: [targetName, proposerName, `${Math.abs(moneyAmount)}`] };
        } else {
            proposalPart = { translate: "cw.warform.peace.proposal.equal" };
        }

        const acceptedText = { translate: "cw.warform.peace.status.accepted" };
        const pendingText = { translate: "cw.warform.peace.status.pending" };

        bodyText = {
            rawtext: [
                proposalPart,
                { text: "\n\n" },
                { text: `${myCountry.name}: ` },
                hasAccepted ? acceptedText : pendingText,
                { text: `\n${enemyCountry.name}: ` },
                otherAccepted ? acceptedText : pendingText
            ]
        };
    } else {
        bodyText = { translate: "cw.warform.peace.noproposal" };
    }

    form.body(bodyText);

    // ボタンを追加
    form.button({ translate: "cw.warform.peace.propose" });

    if (proposal && !hasAccepted) {
        form.button({ translate: "cw.warform.peace.accept" });
    }

    if (proposal) {
        form.button({ translate: "cw.warform.peace.reject" });
    }

    form.button({ translate: "cw.form.redo" });

    const res = await form.show(player);
    if (res.canceled) return;

    let buttonIndex = 0;

    // 新しい提案
    if (res.selection === buttonIndex) {
        peaceProposalForm(player, myCountry, enemyCountry);
        return;
    }
    buttonIndex++;

    // 承認
    if (proposal && !hasAccepted) {
        if (res.selection === buttonIndex) {
            War.acceptPeace(myCountry, enemyCountry);
            return;
        }
        buttonIndex++;
    }

    // 拒否
    if (proposal) {
        if (res.selection === buttonIndex) {
            const confirmForm = new MessageFormData();
            confirmForm.title({ translate: "cw.warform.peace.reject" });
            confirmForm.body({ translate: "cw.warform.peace.reject.confirm" });
            confirmForm.button1({ translate: "cw.form.yes" });
            confirmForm.button2({ translate: "cw.form.no" });

            const confirmRes = await confirmForm.show(player);
            if (confirmRes.selection === 0) {
                War.rejectPeace(myCountry, enemyCountry);
            }
            return;
        }
        buttonIndex++;
    }

    // 戻る
    if (res.selection === buttonIndex) {
        peaceForm(player, myCountry);
    }
}

async function peaceProposalForm(player, myCountry, enemyCountry) {
    const form = new ModalFormData();
    form.title({ translate: "cw.warform.peace.propose" });
    form.label({ translate: "cw.form.nowmoney", with: [`${myCountry.money}`] });
    form.textField({ translate: "cw.warform.peace.money" }, "Press Money");
    form.dropdown({ translate: "cw.warform.peace.type" }, [
        { translate: "cw.warform.peace.offer" },
        { translate: "cw.warform.peace.request" },
        { translate: "cw.warform.peace.equal" }
    ]);

    const res = await form.show(player);
    if (res.canceled) return;

    let moneyAmount = Number(res.formValues[1]);
    if (!Number.isInteger(moneyAmount) || moneyAmount < 0) {
        const errorForm = new MessageFormData();
        errorForm.title({ translate: "cw.warform.peace.propose" });
        errorForm.body({ translate: "cw.form.error.int" });
        errorForm.button1({ translate: "cw.form.redo" });
        errorForm.button2({ translate: "cw.form.cancel" });

        const errorRes = await errorForm.show(player);
        if (errorRes.selection === 0) {
            peaceProposalForm(player, myCountry, enemyCountry);
        }
        return;
    }
    const type = res.formValues[2];

    if (type === 1) {
        // 要求の場合は負の値
        moneyAmount = -moneyAmount;
    } else if (type === 2) {
        // 対等な講和
        moneyAmount = 0;
    }

    // 確認フォーム
    const confirmForm = new MessageFormData();
    confirmForm.title({ translate: "cw.warform.peace.propose" });

    if (moneyAmount > 0) {
        confirmForm.body({ translate: "cw.warform.peace.confirm.offer", with: [enemyCountry.name, `${moneyAmount}`] });
    } else if (moneyAmount < 0) {
        confirmForm.body({ translate: "cw.warform.peace.confirm.request", with: [enemyCountry.name, `${Math.abs(moneyAmount)}`] });
    } else {
        confirmForm.body({ translate: "cw.warform.peace.confirm.equal", with: [enemyCountry.name] });
    }
    confirmForm.button1({ translate: "cw.form.yes" });
    confirmForm.button2({ translate: "cw.form.no" });

    const confirmRes = await confirmForm.show(player);
    if (confirmRes.selection === 0) {
        War.proposePeace(myCountry, enemyCountry, moneyAmount);
    }
}
