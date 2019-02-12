import CaptchaGuard from "./controllers/captcha-guard";

const App = {
    Name: "Captcha Guard - Protecc your room!",
    Version: "0.1.0",
    Dev: "thmo_",
    FairyHelper: [],
    Prefix: "/guard ",
    CMDS: {
        RELOAD: "reload",
        IMPORT: "import",
        EXPORT: "export",
        CLEAR: "clear",
        DEBUG: "debug",
        WHITELIST: "whitelist",
        BLACKLIST: "blacklist",
    },
    ARGS: {
        WHITELIST: {
            ADD: "-add",
            REMOVE: "-remove",
        },
        BLACKLIST: {
            ADD: "-add",
            REMOVE: "-remove",
        },
    },
};

const guard = new CaptchaGuard(App);

cb.onEnter((user) => {
    guard.sendDevInfo(user);
    guard.sendStatusInfo(user);
    guard.checkAndAddToLists(user);
});

cb.onMessage((message) => {
    guard.checkAnswer(message);
    // If the user was not freshly added to the check (has already received information)..
    const addedToCheck = guard.checkAndAddToLists(message);
    // .. then don't send more messages (report = false);
    guard.filterMessage(message, !addedToCheck);

    guard.handleCommands(message);
    return message;
});

cb.onTip((tip) => {
    guard.whitelistOnTip(tip);
});
