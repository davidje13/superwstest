#!/bin/sh
set -e

echo "Running package test...";
echo;

BASE_DIR="$(cd "$(dirname "$0")/.."; pwd)";
cd "$BASE_DIR";
rm superwstest-*.tgz 2>/dev/null || true;
npm pack;
rm test/package/superwstest.tgz 2>/dev/null || true;
rm test/package-no-supertest/superwstest.tgz 2>/dev/null || true;
cd - >/dev/null;

cp "$BASE_DIR/superwstest-"*.tgz "$BASE_DIR/test/package/superwstest.tgz";
cd "$BASE_DIR/test/package";
rm -rf node_modules/superwstest || true;
npm install --audit=false;
rm superwstest.tgz || true;
npm test;
cd - >/dev/null;

cp "$BASE_DIR/superwstest-"*.tgz "$BASE_DIR/test/package-no-supertest/superwstest.tgz";
cd "$BASE_DIR/test/package-no-supertest";
rm -rf node_modules/superwstest || true;
npm install --audit=false;
rm superwstest.tgz || true;
npm test;
cd - >/dev/null;

rm "$BASE_DIR/superwstest-"*.tgz;

echo;
echo "Package test complete";
echo;
