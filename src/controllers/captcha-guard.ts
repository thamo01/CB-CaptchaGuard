import { parseBoolean } from "../misc/helpers";
import IJsonLists from "../models/IJsonLists";
import AccessControl, { Claim } from "./accesscontrol";
import MathCaptcha from "./mathcaptcha";
import Messenger from "./messenger";

export default class CaptchaGuard {
    private whiteListed: Set<string> = new Set();
    private blackListed: Set<string> = new Set();
    private onCooldown: Set<string> = new Set();
    private inCheck: Map<string, (input: string) => boolean> = new Map();
    private readonly coolDownCommands: string[] = [];
    private readonly accessControl: AccessControl;
    private readonly recentCommandActivators: Set<string> = new Set();

    constructor(
        public config: any,
    ) {
        this.initCBSettings();
        this.accessControl = new AccessControl(cb.settings.allow_mod_superuser_cmd, this.config.Dev, this.config.FairyHelper);
        this.coolDownCommands = [];

        if (cb.settings.import_list !== undefined && cb.settings.import_list.length > 0) {
            try {
                this.importFromJson(cb.settings.import_list);
                Messenger.sendSuccessMessage("Imported data from settings.", cb.room_slug);
            } catch (err) {
                Messenger.sendErrorMessage("An unexpected error happened during the import. Is your data correct?", cb.room_slug);
            }
        }
    }

    public sendDevInfo(user: user) {
        if (this.accessControl.hasPermission(user, "SUPERUSER")) {
            Messenger.sendSuccessMessage("Captcha Guard v" + this.config.Version + " is running.", user.user);
        }
    }

    public sendStatusInfo(user: user) {
        if (this.blackListed.has(user.user)) {
            Messenger.sendErrorMessage("You are blacklisted in this room and can't send any messages.", user.user);
            return;
        } else if (!this.whiteListed.has(user.user)) {
            Messenger.sendWarningMessage("This room requires people to verify using a simple math captcha before you can join the chat.", user.user);
        }
    }

    /**
     * Function to check the users claims and add to an appropriate list, if the user isn't already present in any list.
     * @param source The source containing the user information
     * @returns A boolean value whether the user was added to the check list or not.
     */
    public checkAndAddToLists(source: user | message): boolean {
        if (!this.isInAnyList(source.user)) {
            const userClaims = this.accessControl.getClaims(source);
            if (userClaims.some((claim) => this.getWhitelistedClaims().includes(claim))) {
                this.whiteListed.add(source.user);
                return false;
            } else {
                const [question, solution] = MathCaptcha.generateCaptcha();
                Messenger.sendWarningMessage(`Please solve the following question to join the chat (you got ${cb.settings.answering_time} seconds):`, source.user);
                cb.setTimeout(() => {
                    Messenger.sendInfoMessage(question, source.user);
                    this.inCheck.set(source.user, solution);
                    cb.setTimeout(() => this.inCheck.delete(source.user), 1000 * cb.settings.answering_time);
                }, 100);

                return true;
            }
        }
        return false;
    }

    public checkAnswer(message: message) {
        if (this.inCheck.has(message.user)) {
            message["X-Spam"] = true;
            message.c = "#FFFFFF";
            message.background = "#E7E7E7";

            const checkAnswer = this.inCheck.get(message.user)!;
            this.inCheck.delete(message.user);

            if (checkAnswer(message.m)) {
                Messenger.sendSuccessMessage("Captcha correct. Your messages are now visible to the others!", message.user);
                this.whiteListed.add(message.user);
            } else if (!this.isInAnyList(message.user)) { // If someone get black- or whitelisted during the process, stop creating checks for the user.
                Messenger.sendErrorMessage(`Wrong answer provided. You'll have a cooldown time of ${cb.settings.cooldown_time} seconds and then get another chance to answer a question.`, message.user);

                this.onCooldown.add(message.user);
                cb.setTimeout(() => {
                    this.onCooldown.delete(message.user);
                    const [question, solution] = MathCaptcha.generateCaptcha();
                    Messenger.sendSuccessMessage("Your cooldown time is over!", message.user);
                    cb.setTimeout(() => {
                        Messenger.sendWarningMessage(`Please solve the following question to join the chat (you got ${cb.settings.answering_time} seconds):`, message.user);
                        cb.setTimeout(() => {
                            Messenger.sendInfoMessage(question, message.user);
                            this.inCheck.set(message.user, solution);
                            cb.setTimeout(() => this.inCheck.delete(message.user), 1000 * cb.settings.answering_time);
                        }, 100);
                    }, 100);
                }, 1000 * cb.settings.cooldown_time);
            }
        }
    }

    public handleCommands(message: message) {
        if (message.m.indexOf(this.config.Prefix) !== 0) {
            return;
        }

        /* If it starts with the prefix, suppress that shit and assume it's a command */
        message["X-Spam"] = true;
        message.c = "#FFFFFF";
        message.background = "#E7E7E7";

        const args = message.m.slice(this.config.Prefix.length).trim().split(/ +/g);
        let command = args.shift();
        if (command === undefined) {
            return;
        }

        command = command.toLowerCase();

        if (this.coolDownCommands.includes(command)) {
            if (this.recentCommandActivators.has(message.user)) {
                Messenger.sendWarningMessage("Sorry some commands have a cooldown time. Wait a minute until your next command.", message.user);
                return;
            }

            if (!this.accessControl.hasPermission(message, "SUPERUSER")) {
                this.recentCommandActivators.add(message.user);
                cb.setTimeout(() => {
                    this.recentCommandActivators.delete(message.user);
                }, 1000 * 60);
            }
        }

        if (this.accessControl.hasPermission(message, "MOD")) {
            /* Broadcaster only commands at all times */
            if (command === this.config.CMDS.SUPPORT) {
                cb.settings.allow_mod_superuser_cmd = !cb.settings.allow_mod_superuser_cmd;
                Messenger.sendSuccessMessage(`Support mode for ${this.config.Name} Ver. ${this.config.Version} is now ${(cb.settings.allow_mod_superuser_cmd ? "ACTIVATED" : "DEACTIVATED")} !`, message.user);
            } else if (command === this.config.CMDS.DEBUG) {
                const lists = {
                    whitelisted: Array.from(this.whiteListed),
                    blacklisted: Array.from(this.blackListed),
                    incheck: Array.from(this.inCheck),
                    onCooldown: Array.from(this.onCooldown),
                };

                Messenger.sendInfoMessage(JSON.stringify(lists), message.user);
            }
        }

        if (this.accessControl.hasPermission(message, "SUPERUSER")) {
            switch (command) {
                case this.config.CMDS.RELOAD: {
                    if (cb.settings.import_list !== undefined && cb.settings.import_list.length > 0) {
                        try {
                            this.importFromJson(cb.settings.import_list);
                            Messenger.sendSuccessMessage("Imported data from settings.", message.user);
                        } catch (err) {
                            Messenger.sendErrorMessage("An unexpected error happened during the import. Is your data correct?", message.user);
                        }
                    } else {
                        Messenger.sendWarningMessage("No data found to import/reload", message.user);
                    }
                    break;
                }
                case this.config.CMDS.IMPORT: {
                    const json = args.join(" ");
                    try {
                        this.importFromJson(json);
                        Messenger.sendSuccessMessage("Imported given data", message.user);
                    } catch (err) {
                        Messenger.sendErrorMessage("An unexpected error happened during the import. Is your data correct?", message.user);
                    }
                    break;
                }
                case this.config.CMDS.EXPORT: {
                    Messenger.sendSuccessMessage(this.exportToJson(), message.user);
                    break;
                }
                case this.config.CMDS.CLEAR: {
                    this.whiteListed.clear();
                    this.blackListed.clear();
                    this.inCheck.clear();
                    this.onCooldown.clear();

                    // irrelevant in this context, but let's clear everything.
                    this.recentCommandActivators.clear();

                    Messenger.sendSuccessMessage("All lists have been cleared!", message.user);
                    break;
                }
                case this.config.CMDS.BLACKLIST: {
                    const [addOrRemoveFlag, user] = args;
                    if (addOrRemoveFlag === this.config.ARGS.BLACKLIST.ADD) {
                        this.deleteFromAllLists(user);
                        this.blackListed.add(user);
                        Messenger.sendSuccessMessage(`Added user ${user} to BLACKLIST. Recheck the username to make sure it's the right user.`, message.user);
                    } else if (addOrRemoveFlag === this.config.ARGS.BLACKLIST.REMOVE) {
                        this.blackListed.delete(user);
                        Messenger.sendSuccessMessage(`Removed user ${user} from the BLACKLIST (if user was present in list).`, message.user);
                    } else {
                        Messenger.sendErrorMessage(`Command not recognized. Usage: '${this.config.Prefix} ${this.config.CMDS.BLACKLIST} [${this.config.ARGS.BLACKLIST.ADD}/${this.config.ARGS.BLACKLIST.REMOVE}] username'.`, message.user);
                    }
                    break;
                }
                case this.config.CMDS.WHITELIST: {
                    const [addOrRemoveFlag, user] = args;
                    if (addOrRemoveFlag === this.config.ARGS.WHITELIST.ADD) {
                        this.deleteFromAllLists(user);
                        this.whiteListed.add(user);
                        Messenger.sendSuccessMessage(`Added user ${user} to WHITELIST. Recheck the username to make sure it's the right user.`, message.user);
                    } else if (addOrRemoveFlag === this.config.ARGS.WHITELIST.REMOVE) {
                        this.whiteListed.delete(user);
                        Messenger.sendSuccessMessage(`Removed user ${user} from the WHITELIST (if user was present in list).`, message.user);
                    } else {
                        Messenger.sendErrorMessage(`Command not recognized. Usage: '${this.config.Prefix} ${this.config.CMDS.WHITELIST} [${this.config.ARGS.WHITELIST.ADD}/${this.config.ARGS.WHITELIST.REMOVE}] username'.`, message.user);
                    }
                    break;
                }
            }
        }
    }

    public filterMessage(message: message, report: boolean = true): message {
        if (this.whiteListed.has(message.user) && !this.blackListed.has(message.user)) {
            return message;
        }

        if (message["X-Spam"] === true) {
            return message;
        }

        message["X-Spam"] = true;
        message.c = "#FFFFFF";
        message.background = "#E7E7E7";

        if (report) {
            if (this.inCheck.has(message.user)) {
                Messenger.sendErrorMessage("Your message was not sent! You haven't provided the correct answer for the question yet. (How did you arrive to this stage of the bot? :S)", message.user);
            } else if (this.blackListed.has(message.user)) {
                Messenger.sendErrorMessage("Your message was not sent! You have been blacklisted in this room. You can't join the chat.", message.user);
            } else if (this.onCooldown.has(message.user)) {
                Messenger.sendWarningMessage(`Your message was not sent! You are on cooldown. Please wait until your cooldown of ${cb.settings.cooldown_time} seconds is over and the next question pops up, then answer that question correctly to join the chat.`, message.user);
            } else {
                Messenger.sendErrorMessage("Your message was not sent! It seems you arent in any of the lists yet (InCheck, Cooldown, Blacklist, Whitelist). Try to refresh your browser to automagically join an appropriate list.", message.user);
            }
        }

        return message;
    }

    public whitelistOnTip(tip: tip) {
        if (cb.settings.whitelist_tip && !this.whiteListed.has(tip.from_user)) {
            this.whiteListed.add(tip.from_user);
        }
    }

    private importFromJson(json: string) {
        const jsonLists: IJsonLists = JSON.parse(json);
        this.blackListed = new Set(jsonLists.blackListed);
        this.whiteListed = new Set(jsonLists.whiteListed);
    }

    private exportToJson(): string {
        const jsonLists: IJsonLists = {
            blackListed: Array.from(this.blackListed),
            whiteListed: Array.from(this.whiteListed),
        };

        return JSON.stringify(jsonLists);
    }

    private isInAnyList(user: string): boolean {
        return (
            this.inCheck.has(user)
            || this.onCooldown.has(user)
            || this.whiteListed.has(user)
            || this.blackListed.has(user)
        );
    }

    private deleteFromAllLists(user: string) {
        this.inCheck.delete(user);
        this.onCooldown.delete(user);
        this.whiteListed.delete(user);
        this.blackListed.delete(user);
    }

    private getWhitelistedClaims(): Claim[] {
        const claims: Claim[] = [];

        if (!cb.settings.captcha_lightblue) {
            claims.push("IS_LIGHTBLUE");
        }
        if (!cb.settings.captcha_darkblue) {
            claims.push("IS_DARKBLUE");
        }
        if (!cb.settings.captcha_lightpurple) {
            claims.push("IS_LIGHTPURPLE");
        }
        if (!cb.settings.captcha_darkpurple) {
            claims.push("IS_DARKPURPLE");
        }
        if (!cb.settings.captcha_fanclub) {
            claims.push("IN_FANCLUB");
        }
        if (!cb.settings.captcha_mods) {
            claims.push("IS_MOD");
        }
        if (!cb.settings.captcha_broadcaster) {
            claims.push("IS_BROADCASTER");
        }

        return claims;
    }

    private initCBSettings() {
        cb.settings_choices = [
            {
                name: "captcha_grey",
                label: "Activate Captcha for Greys (if you turn this to 'No' the bot won't act for any of the below either), but (if activated) tips will get a user into the whitelist and commands still work for import/export purposes.",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "Yes",
            },
            {
                name: "captcha_lightblue",
                label: "Activate Captcha for Light Blues (own or have purchased tokens)",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "Yes",
            },
            {
                name: "captcha_darkblue",
                label: "Activate Captcha for Dark Blues (tipped at least 50 tokens in the past 2 weeks)",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "No",
            },
            {
                name: "captcha_lightpurple",
                label: "Activate Captcha for Light Purple (tipped at least 250 tokens in the past 2 weeks)",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "No",
            },
            {
                name: "captcha_darkpurple",
                label: "Activate Captcha for Dark Purple (tipped at least 1000 tokens in the past 2 weeks)",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "No",
            },
            {
                name: "captcha_fanclub",
                label: "Activate Captcha for Fan Club members",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "No",
            },
            {
                name: "captcha_mods",
                label: "Activate Captcha for Mods",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "No",
            },
            {
                name: "captcha_broadcaster",
                label: "Activate Captcha for Broadcaster (for testing for yourself)",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "No",
            },
            {
                name: "whitelist_tip",
                label: "Automagically whitelist users that have tipped in your current session",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "Yes",
            },
            {
                name: "mod_allow_broadcaster_cmd",
                label: "Allow mods and the developer to use commands? (Useful if you need a little extra help)",
                type: "choice",
                choice1: "Yes",
                choice2: "No",
                defaultValue: "Yes",
            },
            {
                name: "cooldown_time",
                label: "Time (in seconds) the user has to wait after wrongly answering before he gets another question (prevents bots from spamming answers)",
                type: "int",
                minValue: 10,
                maxValue: 180,
                required: true,
                defaultValue: 30,
            },
            {
                name: "answering_time",
                label: "Time (in seconds) the user has to correctly answering before he gets a new question after an interaction (clears the checking list to ease CB servers, not really necessary)",
                type: "int",
                minValue: 10,
                maxValue: 300,
                required: true,
                defaultValue: 60,
            },
            {
                name: "import_list",
                label: `Enter the white- and blacklist data here. Get your list export using the '${this.config.Prefix} ${this.config.CMDS.EXPORT}' command and paste the exact message (without 'Notice: ') in here to use the saved lists. Users don't have to repeat the catpcha again and blacklistet users stay blacklisted.`,
                type: "str",
                required: false,
                defaultValue: "",
            },
        ];

        cb.settings.captcha_grey = parseBoolean(cb.settings.captcha_grey);
        cb.settings.captcha_lightblue = parseBoolean(cb.settings.captcha_lightblue);
        cb.settings.captcha_darkblue = parseBoolean(cb.settings.captcha_darkblue);
        cb.settings.captcha_lightpurple = parseBoolean(cb.settings.captcha_lightpurple);
        cb.settings.captcha_darkpurple = parseBoolean(cb.settings.captcha_darkpurple);
        cb.settings.captcha_fanclub = parseBoolean(cb.settings.captcha_fanclub);
        cb.settings.captcha_mods = parseBoolean(cb.settings.captcha_mods);
        cb.settings.captcha_broadcaster = parseBoolean(cb.settings.captcha_broadcaster);
        cb.settings.whitelist_tip = parseBoolean(cb.settings.whitelist_tip);
        cb.settings.allow_mod_superuser_cmd = parseBoolean(cb.settings.mod_allow_broadcaster_cmd);
    }
}
