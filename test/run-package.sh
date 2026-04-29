#!/bin/sh
set -e

echo "Running package test...";
echo;

BASE_DIR="$(cd "$(dirname "$0")/.."; pwd)";

rm "$BASE_DIR/test/package/package.tgz" 2>/dev/null || true;
cp "$BASE_DIR/package.tgz" "$BASE_DIR/test/package/package.tgz";
rm -rf "$BASE_DIR/test/package/node_modules/superwstest" || true;
cd "$BASE_DIR/test/package";
npm install --audit=false;
rm package.tgz || true;
npm test;
cd - >/dev/null;

rm "$BASE_DIR/test/package-no-supertest/package.tgz" 2>/dev/null || true;
cp "$BASE_DIR/package.tgz" "$BASE_DIR/test/package-no-supertest/package.tgz";
rm -rf "$BASE_DIR/test/package-no-supertest/node_modules/superwstest" || true;
cd "$BASE_DIR/test/package-no-supertest";
npm install --audit=false;
rm package.tgz || true;
npm test;
cd - >/dev/null;

echo;
echo "Package test complete";
echo;
