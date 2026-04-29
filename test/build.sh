#!/bin/sh
set -e

echo "Building package...";
echo;

BASE_DIR="$(cd "$(dirname "$0")/.."; pwd)";

rm -r "$BASE_DIR/package.tgz" "$BASE_DIR/build" 2>/dev/null || true;
cd "$BASE_DIR";
npx rollup --config rollup.config.mjs;
cd - >/dev/null;

cp "$BASE_DIR/README.md" "$BASE_DIR/LICENSE" "$BASE_DIR/index.d.ts" "$BASE_DIR/build";
"$BASE_DIR/test/map-package-json.mjs" < "$BASE_DIR/package.json" > "$BASE_DIR/build/package.json";

cd "$BASE_DIR/build";
npm pack;
cd - >/dev/null;
mv "$BASE_DIR/build/superwstest-"*.tgz "$BASE_DIR/package.tgz";

echo;
echo "Build complete";
echo;
