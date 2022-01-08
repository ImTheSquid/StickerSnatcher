#!/bin/sh

npm run build_plugin StickerSnatcher --prefix ../../
cp ../../release/StickerSnatcher.plugin.js .

# Remove all header data that is undefined
sed -i '/^ \* @.*undefined$/d' ./StickerSnatcher.plugin.js