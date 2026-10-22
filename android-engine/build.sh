#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

NDK=${NDK:-/home/juwimana/Android/Sdk/ndk/27.1.12297006}
TOOLCHAIN=$NDK/toolchains/llvm/prebuilt/linux-x86_64
DEST_DIR=/home/juwimana/apps/find-streamer/android/app/src/main/jniLibs/arm64-v8a

mkdir -p "$DEST_DIR"

echo "=== Building libtorrentstreamer.so for arm64-v8a ==="
export CC=$TOOLCHAIN/bin/aarch64-linux-android24-clang
export CXX=$TOOLCHAIN/bin/aarch64-linux-android24-clang++
export CGO_ENABLED=1
export GOOS=android
export GOARCH=arm64

go build -ldflags="-s -w" -buildmode=c-shared -o "$DEST_DIR/libtorrentstreamer.so" .

echo "=== Verification ==="
ls -lh "$DEST_DIR/libtorrentstreamer.so"
nm -D "$DEST_DIR/libtorrentstreamer.so" | grep -E "Java_|InitTorrent"
echo "=== Done ==="
