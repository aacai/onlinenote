# Tauri 移动端打包指南

## 概述

使用 Tauri 2.x 将 Next.js 应用打包成 Android APK，同时支持 macOS 桌面版。

## 架构优势

✅ **一套代码，多端运行**
- macOS: 使用 Tauri 桌面版
- Android: 使用 Tauri 移动版
- 共享相同的 Rust 后端逻辑

✅ **保留所有功能**
- API 路由改为 Rust 命令
- 本地 SQLite/JSON 存储
- 完全离线运行

✅ **性能优秀**
- 原生 Rust 后端
- WebView 前端
- 包体积小（~10-20MB）

---

## 已完成配置

### 1. Rust 后端 (`src-tauri/src/lib.rs`)

实现了以下命令：
- `get_notes()` - 获取所有笔记
- `create_note(note)` - 创建笔记
- `update_note(id, updates)` - 更新笔记
- `delete_note(id)` - 删除笔记
- `get_categories()` - 获取分类
- `create_category(name, color)` - 创建分类
- `delete_category(id)` - 删除分类

数据存储：使用 JSON 文件存储在应用数据目录

### 2. 前端适配 (`src/lib/api.ts`)

自动检测运行环境：
- Tauri 环境：使用 `invoke()` 调用 Rust 命令
- 浏览器环境：使用 `fetch()` 调用 API

### 3. 依赖配置

**Cargo.toml**
```toml
[dependencies]
uuid = { version = "1.0", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
```

**package.json**
```json
{
  "devDependencies": {
    "@tauri-apps/cli": "^2.10.1",
    "@tauri-apps/api": "^2.10.1"
  }
}
```

---

## 构建步骤

### 前置条件

1. **Android SDK**
   ```bash
   # 已通过 Android Studio 安装
   # 路径：/Applications/Android Studio.app
   ```

2. **环境变量**
   ```bash
   export ANDROID_HOME=~/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   ```

3. **NDK（可选，用于原生代码编译）**
   ```bash
   # 在 Android Studio 中安装：
   # SDK Manager → SDK Tools → NDK (Side by side)
   ```

### 构建 Android APK

#### 方法 1：使用 Tauri CLI（推荐）

```bash
# 1. 进入 src-tauri 目录
cd src-tauri

# 2. 初始化 Android（如果还没初始化）
npx tauri android init

# 3. 添加 Android 平台
npx tauri android add com.onlinenote.app

# 4. 开发模式运行
npx tauri android dev

# 5. 构建 Release APK
npx tauri android build --apk
```

输出位置：
```
src-tauri/target/aarch64-linux-android/release/app.apk
src-tauri/target/x86_64-linux-android/release/app.apk
```

#### 方法 2：使用 Gradle

```bash
cd src-tauri/gen/android

# 开发版本
./gradlew assembleDebug

# 发布版本（需要签名）
./gradlew assembleRelease
```

---

## 配置签名（发布版本）

### 1. 生成签名密钥

```bash
keytool -genkey -v \
  -keystore ~/keystores/onlinenote.keystore \
  -alias onlinenote \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

输入密码（示例）：
- Keystore 密码：`your_keystore_password`
- 密钥密码：`your_key_password`

### 2. 配置 Gradle 属性

创建 `src-tauri/gen/android/gradle.properties`：

```properties
ONLINENOTE_STORE_FILE=/Users/mac/keystores/onlinenote.keystore
ONLINENOTE_KEY_ALIAS=onlinenote
ONLINENOTE_STORE_PASSWORD=your_keystore_password
ONLINENOTE_KEY_PASSWORD=your_key_password
```

### 3. 修改 build.gradle

编辑 `src-tauri/gen/android/app/build.gradle`：

```gradle
android {
    signingConfigs {
        release {
            storeFile file(ONLINENOTE_STORE_FILE)
            storePassword ONLINENOTE_STORE_PASSWORD
            keyAlias ONLINENOTE_KEY_ALIAS
            keyPassword ONLINENOTE_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 4. 构建签名 APK

```bash
cd src-tauri/gen/android
./gradlew assembleRelease
```

APK 位置：
```
src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk
```

---

## 测试

### 在模拟器上测试

```bash
# 1. 启动 Android 模拟器
# 在 Android Studio 中：Tools → Device Manager → Start

# 2. 运行开发版本
npx tauri android dev

# 或安装 APK
adb install -r src-tauri/target/aarch64-linux-android/release/app.apk
```

### 在真机上测试

```bash
# 1. 启用 USB 调试
# 设置 → 关于手机 → 连续点击"版本号"7 次
# 设置 → 开发者选项 → 开启"USB 调试"

# 2. 连接电脑
# 允许 USB 调试授权

# 3. 验证连接
adb devices

# 4. 安装 APK
adb install -r src-tauri/target/aarch64-linux-android/release/app.apk

# 5. 查看日志
adb logcat | grep -i "onlinenote"
```

---

## 常见问题

### 1. NDK 未安装

**错误信息：**
```
failed to ensure Android environment: NDK not found
```

**解决方案：**
```bash
# 在 Android Studio 中安装：
# SDK Manager → SDK Tools → NDK (Side by side)
# 版本建议：26.1.10909125 或更高
```

### 2. 构建失败 - 找不到 Rust 命令

**错误信息：**
```
failed to invoke Rust command: get_notes
```

**解决方案：**
- 确保 `src-tauri/src/lib.rs` 中定义了命令
- 确保在 `invoke_handler` 中注册了命令
- 检查前端 `isTauri()` 检测是否正确

### 3. 数据存储路径权限

**错误信息：**
```
Permission denied (os error 13)
```

**解决方案：**
```rust
// 使用 Tauri 提供的标准路径
fn get_data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap()
}
```

### 4. 前端无法调用 Rust 命令

**调试步骤：**
```typescript
// 1. 检查是否在 Tauri 环境
console.log('Is Tauri:', '__TAURI_INTERNALS__' in window);

// 2. 检查命令是否存在
try {
  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke('get_notes');
  console.log('Notes:', result);
} catch (error) {
  console.error('Failed to invoke:', error);
}
```

### 5. 包体积过大

**优化方案：**
```toml
# Cargo.toml - 优化编译
[profile.release]
lto = true
codegen-units = 1
opt-level = "z"
strip = true
```

---

## 发布流程

### 1. 构建 Release APK

```bash
cd src-tauri
npx tauri android build --apk --release
```

### 2. 测试所有功能

- [ ] 创建笔记
- [ ] 编辑笔记
- [ ] 删除笔记
- [ ] 添加分类
- [ ] 数据持久化（重启应用后数据还在）

### 3. 生成多个 ABI 版本

```bash
# ARM64 (现代手机)
npx tauri android build --target aarch64-linux-android

# x86_64 (模拟器)
npx tauri android build --target x86_64-linux-android

# ARMv7 (老款手机)
npx tauri android build --target armv7-linux-androideabi
```

### 4. 发布渠道

- **Google Play**: 上传 AAB 格式
  ```bash
  npx tauri android build --aab
  ```

- **直接分发**: APK 文件
  - 提供 ARM64 和 x86_64 两个版本
  - 或构建 Universal APK

---

## 性能优化

### 1. 减少包体积

```bash
# 安装 cargo-binstall
cargo install cargo-binstall

# 分析包体积
cargo bloat --release -n app
```

### 2. 优化启动速度

```rust
// src-tauri/src/lib.rs
// 延迟加载数据
#[tauri::command]
fn get_notes(app: tauri::AppHandle) -> Result<Vec<Note>, String> {
    // 使用缓存
    static CACHE: OnceCell<Mutex<Option<Vec<Note>>>> = OnceCell::new();
    
    if let Some(cached) = CACHE.get().and_then(|c| c.lock().unwrap().clone()) {
        return Ok(cached);
    }
    
    let notes = read_notes(&app);
    CACHE.set(Mutex::new(Some(notes.clone()))).ok();
    Ok(notes)
}
```

### 3. 异步处理

```rust
// 使用 tokio 异步
#[tauri::command]
async fn create_note(app: tauri::AppHandle, note: Note) -> Result<Note, String> {
    tokio::task::spawn_blocking(move || {
        let mut notes = read_notes(&app);
        notes.push(note.clone());
        write_notes(&app, &notes)?;
        Ok(note)
    }).await.unwrap()
}
```

---

## 下一步

### 已完成
- ✅ Rust 后端命令实现
- ✅ 前端 API 适配
- ✅ 桌面版测试通过

### 待完成
- [ ] Android NDK 安装
- [ ] Android 平台初始化
- [ ] APK 构建测试
- [ ] 真机测试
- [ ] 应用签名配置
- [ ] 发布到 Google Play

---

## 资源链接

- [Tauri 官方文档](https://tauri.app/)
- [Tauri Android 开发](https://tauri.app/develop/develop-android/)
- [Rust for Android](https://mozilla.github.io/firefox-browser-architecture/experiments/2017-09-21-rust-on-android.html)
- [Android 开发者指南](https://developer.android.com/guide)
