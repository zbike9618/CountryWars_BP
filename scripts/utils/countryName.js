import config from "../config/config.js";

/**
 * 国名のチェック（文字数・使えない文字・不適切な名前）
 * 建国・国情報の編集・管理画面で国名を決めるときは、必ず validateCountryName を通す。
 * 文字数は config.js の countryNameMinLength / countryNameMaxLength で変えられる。
 * § による文字装飾（色・太字など）は使える。文字数には数えない（画面に出る文字で数える）。
 */

// Minecraft の装飾コード（§ とその次の1文字）。画面には出ない
const FORMAT_CODE = /§[\s\S]/g;

// 国名に使えない文字
// - " \ ` … 名前を文字列に埋め込む処理（tellraw や sendData）を壊す
// - 制御文字・見えない文字 … 空白に見える国名や、表示が崩れる国名を防ぐ
const FORBIDDEN_CHARS = /["\\`\u0000-\u001F\u007F-\u009F\u00AD\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u2028-\u202F\u205F-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB]/;

// 運営や「国なし」の表示になりすませる名前（照合は表記ゆれをそろえたあとの完全一致）
const RESERVED_NAMES = [
    "admin", "admins", "administrator", "moderator", "owner", "staff", "server", "system", "console", "unknown", "null", "undefined",
    "運営", "運営チーム", "管理者", "管理人", "公式", "オーナー", "スタッフ", "システム", "サーバー", "未所属", "無所属",
];

// 含まれていたら使えない言葉（照合は表記ゆれをそろえたあとの部分一致）
// 「Scunthorpe 問題」を避けるため、ほかの言葉の一部になりやすい短い語は入れていない。
// 足りない言葉があれば、ここに足す。
const NG_WORDS = [
    // 性的・下品
    "ちんこ", "ちんぽ", "おちんちん", "まんこ", "うんこ", "せっくす", "ふぇら", "おなにー", "ざーめん", "ぱいずり", "おっぱい", "れいぷ", "強姦", "痴漢", "びっち", "やりまん", "ぽるの",
    // 差別・侮辱
    "きちがい", "気違い", "がいじ", "池沼", "じゃっぷ", "穢多", "死ね", "氏ね", "くたばれ",
    // 差別的・過激な思想
    "ひとらー", "なちす",
    // English
    "fuck", "shit", "bitch", "nigger", "nigga", "faggot", "whore", "porn", "pussy", "asshole", "bastard", "rapist", "hitler", "nazi",
];

const LEET = { "@": "a", "$": "s", "0": "o", "1": "i", "3": "e", "4": "a", "5": "s" };

/**
 * 表記ゆれをそろえた照合用の文字列にする
 * 全角→半角・大文字→小文字・カタカナ→ひらがな・数字や記号による言い換えを戻し、
 * 空白や記号を取り除き、同じ文字の3回以上の連続を1つにまとめる。
 * 国名そのものは変えない（照合にだけ使う）。
 */
function toKey(text) {
    let s = String(text);
    try {
        s = s.normalize("NFKC");
    } catch (e) {
        // normalize が使えない環境でも、下の全角→半角の変換で続ける
    }
    s = s.toLowerCase();
    let out = "";
    for (const ch of s) {
        let c = ch.codePointAt(0);
        if (c >= 0xFF01 && c <= 0xFF5E) c -= 0xFEE0; // 全角英数字・記号 → 半角
        if (c >= 0x30A1 && c <= 0x30F6) c -= 0x60; // カタカナ → ひらがな
        const half = String.fromCodePoint(c);
        out += LEET[half] ?? half;
    }
    // 英小文字・ひらがな・長音・漢字だけ残す
    out = out.replace(/[^a-z\u3041-\u3096\u30FC\u3400-\u4DBF\u4E00-\u9FFF]/g, "");
    return out.replace(/(.)\1{2,}/g, "$1");
}

const RESERVED_KEYS = new Set(RESERVED_NAMES.map(toKey));
const NG_KEYS = NG_WORDS.map(toKey).filter(key => key.length > 0);

/**
 * 国名として使えるかを調べる
 * @param {string} rawName 入力された国名
 * @returns {{ ok: true, name: string } | { ok: false, message: string }}
 *   ok のときの name は、前後の空白を取り除いたもの。この値を保存すること。
 */
export function validateCountryName(rawName) {
    const name = typeof rawName === "string" ? rawName.trim() : "";
    const visible = name.replace(FORMAT_CODE, "").trim(); // 装飾コードを除いた、画面に出る部分
    const length = Array.from(visible).length; // 絵文字なども1文字として数える
    const min = config.countryNameMinLength;
    const max = config.countryNameMaxLength;

    if (name.length === 0) {
        return { ok: false, message: "§c国名を入力してください。" };
    }
    if (length === 0) {
        return { ok: false, message: "§c装飾コードだけでなく、画面に表示される文字を入れてください。" };
    }
    if (length < min) {
        return { ok: false, message: `§c国名は${min}文字以上にしてください。（今は${length}文字です）` };
    }
    if (length > max) {
        return { ok: false, message: `§c国名は${max}文字以内にしてください。（装飾コードは数えません。今は${length}文字です）` };
    }
    if (Array.from(name).length > config.countryNameMaxRawLength) {
        return { ok: false, message: `§c装飾コードが多すぎます。装飾コードを含めて${config.countryNameMaxRawLength}文字以内にしてください。` };
    }
    if (visible.includes("§")) {
        // 最後に残った § のように、あとに装飾コードの文字が続かないもの
        // （メッセージに § そのものを書くと装飾コードとして解釈されるので、書かない）
        return { ok: false, message: "§c装飾コードが途中で終わっています。名前の最後に、装飾コード用の記号（セクション記号）だけが残っていないか確認してください。" };
    }
    if (FORBIDDEN_CHARS.test(name)) {
        return { ok: false, message: "§c国名に使えない文字が含まれています。（\" \\ ` と、見えない文字・制御文字は使えません）" };
    }
    const key = toKey(visible); // 装飾コードを挟んだ言い換えを防ぐため、装飾コードを除いて調べる
    if (RESERVED_KEYS.has(key)) {
        return { ok: false, message: "§cその名前は運営などと間違えやすいため、国名に使えません。" };
    }
    if (NG_KEYS.some(word => key.includes(word))) {
        return { ok: false, message: "§c国名に不適切な言葉が含まれているため、使えません。" };
    }
    return { ok: true, name };
}
