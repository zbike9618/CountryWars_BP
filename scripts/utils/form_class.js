import { Player } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

export class ActionForm {
    constructor() {
        this.form = new ActionFormData;
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} bodyText 
     */
    body(bodyText) {
        return this.form.body(bodyText);
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} text 
     * @param {undefined|string} iconPath 
     */
    button(text, iconPath = undefined) {
        return this.form.button(text, iconPath);
    }

    divider() {
        return this.form.divider();
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} text 
     * @returns 
     */
    header(text) {
        return this.form.header(text);
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} text 
     * @returns 
     */
    label(text) {
        return this.form.label(text);
    }

    /**
     * 
     * @param {Player} player 
     * @returns 
     */
    show(player) {
        return this.form.show(player);
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} titleText 
     * @returns 
     */
    title(titleText) {
        return this.form.title(titleText);
    }
}

export class ModalForm {
    constructor() {
        this.form = new ModalFormData();
    }

    divider() {
        return this.form.divider()
    }

    /**
     * 
     * @param {string|import("@minecraft/server").RawMessage} label 
     * @param {Array<string|import("@minecraft/server").RawMessage>} options 
     * @param {number|undefined} defaultValueIndex 
     * @returns 
     */
    dropdown(label, options, defaultValueIndex = undefined) {
        return this.form.dropdown(label, options, { defaultValueIndex: defaultValueIndex })
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} text 
     * @returns 
     */
    header(text) {
        return this.form.header(text);
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} text 
     * @returns 
     */
    label(text) {
        return this.form.label(text);
    }

    /**
     * 
     * @param {Player} player 
     * @returns 
     */
    show(player) {
        return this.form.show(player);
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} label 
     * @param {number} minimumValue 
     * @param {number} maximumValue 
     * @param {number} valueStep 
     * @param {number|undefined} defaultValue 
     * @returns 
     */
    slider(label, minimumValue, maximumValue, valueStep, defaultValue = undefined) {
        return this.form.slider(label, minimumValue, maximumValue, { valueStep: valueStep, defaultValue: defaultValue })
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} submitButtonText 
     * @returns 
     */
    submitButton(submitButtonText) {
        return this.form.submitButton(submitButtonText);
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} label 
     * @param {import("@minecraft/server").RawMessage|string} placeholderText 
     * @param {import("@minecraft/server").RawMessage|string|undefined} defaultValue 
     * @returns 
     */
    textField(label, placeholderText, defaultValue = undefined) {
        return this.form.textField(label, placeholderText, { defaultValue: defaultValue });
    }

    /**
     * @param {import("@minecraft/server").RawMessage|string} titleText 
     * @returns 
     */
    title(titleText) {
        return this.form.title(titleText)
    }

    /**
     * 
     * @param {import("@minecraft/server").RawMessage|string} label 
     * @param {boolean} defaultValue 
     * @returns 
     */
    toggle(label, defaultValue = undefined) {
        return this.form.toggle(label, { defaultValue: defaultValue })
    }
}