module.exports = (Plugin, Library) => {
    "use strict";

    const {Logger, Patcher, WebpackModules, ContextMenu} = Library;

    class StickerSnatcher extends Plugin {
        onStart() {
            this.messageContextMenu = WebpackModules.find(mod => mod.default?.displayName === "MessageContextMenu");
            this.imageUtils = WebpackModules.getByProps("copyImage", "saveImage");

            ContextMenu.getDiscordMenu("MessageContextMenu").then(menu => {
                Patcher.after(menu, "default", (_, [arg], ret) => {
                    if (arg.message.stickerItems.length == 0) {
                        return;
                    }
    
                    ret.props.children.splice(4, 0, ContextMenu.buildMenuItem({type: "separator"}), ContextMenu.buildMenuItem({label: "Save Sticker", action: () => {
                        this.imageUtils.saveImage(this.getLinkForStickerInMessageWithID(arg.message.id));
                    }}));
                });
            });
        };

        getLinkForStickerInMessageWithID(messageID) {
            const accessories = document.getElementById(`message-accessories-${messageID}`);

            if (!accessories) {
                Logger.log("Unable to find accessories element");
                return null;
            }

            const sticker = this.findFirstInDOMChildren(accessories, /clickableSticker/, element => element.className);

            if (!sticker) {
                Logger.log("Unable to find sticker element");
                return null;
            }

            return sticker.children[0].children[0].children[0].src;
        };

        findFirstInDOMChildren(element, regex, childFormat) {
            for (const child of element.children) {
                if (childFormat(child) && regex.test(childFormat(child))) {
                    return child;
                }
            }
            return null;
        };

        onStop() {
            Patcher.unpatchAll();
        };
    };

    return StickerSnatcher;
}