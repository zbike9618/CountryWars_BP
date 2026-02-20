export const blockInteractCallbacks = [];
export const redstoneUpdateCallbacks = [];

/**
 * @param {import("@minecraft/server").BlockComponentPlayerInteractEvent} arg
 */
export function BlockInteract(arg) {
    for (const callback of blockInteractCallbacks) {
        callback(arg);
    }
}
export function RedstoneUpdate(arg) {
    for (const callback of redstoneUpdateCallbacks) {
        callback(arg);
    }
}
