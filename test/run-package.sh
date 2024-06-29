#!/bin/sh
set -e

echo "Running package test...";
echo;

BASE_DIR="$(cd "$(dirname "$0")/.."; pwd)";
cd "$BASE_DIR";
rm superwstest-*.tgz 2>/dev/null || true;
npm pack;
rm test/package/superwstest.tgz 2>/dev/null || true;
mv superwstest-*.tgz test/package/superwstest.tgz;
cd - >/dev/null;

cd "$BASE_DIR/test/package";
rm -rf node_modules || true;
npm install --audit=false;
rm superwstest.tgz || true;
npm test;
cd - >/dev/null;

echo;
echo "Package test complete";
echo;
