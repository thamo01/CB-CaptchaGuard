import { MsgColors } from "../misc/colors";

export default class Messenger {
    public static sendMessageToUser(message: string, user: string, background?: MsgColors, foreground?: MsgColors) {
        this.sendMessage(message, user, background, foreground);
    }

    public static sendMessageToGroup(message: string, group: group, background?: MsgColors, foreground?: MsgColors) {
        this.sendMessage(message, undefined, background, foreground, undefined, group);
    }

    public static sendBroadcasterNotice(message: string): void {
        this.sendMessageToUser(message, cb.room_slug, MsgColors.Yellow, MsgColors.Purple);
    }

    public static sendErrorMessage(message: string, user?: string, group?: group) {
        this.sendMessage(message, user, undefined, MsgColors.Red, undefined, group);
    }

    public static sendWarningMessage(message: string, user?: string, group?: group) {
        this.sendMessage(message, user, undefined, MsgColors.Orange, undefined, group);
    }

    public static sendSuccessMessage(message: string, user?: string, group?: group) {
        this.sendMessage(message, user, undefined, MsgColors.Green, undefined, group);
    }

    public static sendInfoMessage(message: string, user?: string, group?: group) {
        this.sendMessage(message, user, undefined, MsgColors.Black, undefined, group);
    }

    private static sendMessage(message: string, user?: string, background?: MsgColors, foreground?: MsgColors, weight?: weight, group?: group) {
        if (weight === undefined) {
            weight = "bold";
        }

        cb.sendNotice(message, user, background as string, foreground as string, weight, group);
    }
}
