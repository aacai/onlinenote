# Tauri 多平台构建指南

## 前置条件

```bash
# macOS 基础
brew install rustup
rustup target add aarch64-apple-darwin x86_64-apple-darwin

# iOS (仅 macOS)
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
brew install ios-deploy

# Android
export ANDROID_HOME=~/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android

# Windows (macOS 交叉编译)
brew install mingw-w64
rustup target add x86_64-pc-windows-gnu
```

## 构建命令

### macOS
```bash
npm run tauri:build
# 输出: src-tauri/target/release/bundle/macos/*.app
# 输出: src-tauri/target/release/bundle/dmg/*.dmg
```

### iOS
```bash
cd src-tauri
npx tauri ios init      # 首次
npx tauri ios build     # 构建 IPA
# 输出: src-tauri/target/aarch64-apple-ios/release/app.ipa
```

### Android
```bash
cd src-tauri
npx tauri android init  # 首次
npx tauri android build --apk
# 输出: src-tauri/target/*/release/app.apk

# AAB (Google Play)
npx tauri android build --aab
```

### Windows
```bash
# macOS 交叉编译
npm run tauri:build -- --target x86_64-pc-windows-gnu
# 输出: src-tauri/target/x86_64-pc-windows-gnu/release/bundle/msi/*.msi
```

## 一键构建脚本

```bash
#!/bin/bash
# build-all.sh

npm run build:static

cd src-tauri

# macOS
echo "Building macOS..."
npx tauri build

# iOS
echo "Building iOS..."
npx tauri ios build 2>/dev/null || echo "iOS skipped (需 Xcode)"

# Android
echo "Building Android..."
npx tauri android build --apk 2>/dev/null || echo "Android skipped (需 NDK)"

echo "Done!"
```

## 输出目录

```
src-tauri/target/
├── release/bundle/macos/        *.app, *.dmg
├── release/bundle/msi/          *.msi (Windows)
├── aarch64-apple-ios/release/   *.ipa
└── aarch64-linux-android/release/ *.apk
```

## 签名配置

### macOS
```bash
codesign --sign "Developer ID" --force --deep OnlineWebNote.app
```

### iOS
Xcode → Signing & Capabilities → Team

### Android
```bash
keytool -genkey -keystore release.keystore -alias key -keyalg RSA -validity 10000
# 配置 src-tauri/gen/android/gradle.properties
```

### Windows
```bash
# 需 Windows + signtool.exe
signtool sign /f cert.pfx /p password installer.msi
```
