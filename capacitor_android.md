# Capacitor 安卓打包指南

## 概述

使用 Capacitor 将 Next.js 应用打包成安卓 APK。

## 架构说明

由于 Next.js API 路由需要 Node.js 后端，而 Capacitor 是纯静态 WebView，有两种方案：

### 方案 A：静态导出 + 本地存储（推荐离线使用）
- Next.js 使用 `output: 'export'` 静态导出
- 移除所有 API 路由
- 使用浏览器 localStorage/IndexedDB 存储数据
- 完全离线运行

### 方案 B：静态导出 + 远程 API（推荐在线使用）
- Next.js 使用 `output: 'export'` 静态导出
- API 调用改为远程服务器
- 需要网络连接

## 配置步骤

### 1. 修改 Next.js 配置

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,  // 静态导出需要
  },
  output: 'export',     // 静态导出
  distDir: 'out',
};
```

### 2. 移除或改造 API 路由

API 路由（`/api/*`）在静态导出中不可用，需要：

**方案 A - 本地存储：**
```typescript
// 替换 API 调用为 localStorage
// src/lib/api.ts
export async function getNotes() {
  const data = localStorage.getItem('notes');
  return data ? JSON.parse(data) : [];
}

export async function saveNote(note) {
  const notes = await getNotes();
  notes.push(note);
  localStorage.setItem('notes', JSON.stringify(notes));
}
```

**方案 B - 远程 API：**
```typescript
// 改为调用远程服务器
const API_BASE = 'https://your-server.com/api';

export async function getNotes() {
  const res = await fetch(`${API_BASE}/notes`);
  return res.json();
}
```

### 3. 构建静态文件

```bash
npm run build
```

输出目录：`out/`

### 4. 添加安卓平台

```bash
npx cap add android
```

### 5. 同步代码到 Capacitor

```bash
npx cap sync android
```

### 6. 打开 Android Studio

```bash
npx cap open android
```

### 7. 在 Android Studio 中构建 APK

1. 打开 `android/app/build.gradle`
2. 配置签名（可选）
3. Build → Build Bundle(s) / APK(s) → Build APK(s)

## 命令行构建 APK（无需 Android Studio）

```bash
cd android
./gradlew assembleDebug
# APK 位于：android/app/build/outputs/apk/debug/app-debug.apk
```

## 配置签名（发布版本）

### 1. 生成签名密钥

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias online_note -keyalg RSA -keysize 2048 -validity 10000
```

### 2. 配置 gradle.properties

```properties
ONLINE_NOTE_STORE_FILE=my-release-key.keystore
ONLINE_NOTE_KEY_ALIAS=online_note
ONLINE_NOTE_STORE_PASSWORD=your_password
ONLINE_NOTE_KEY_PASSWORD=your_password
```

### 3. 修改 build.gradle

```gradle
android {
    signingConfigs {
        release {
            storeFile file(ONLINE_NOTE_STORE_FILE)
            storePassword ONLINE_NOTE_STORE_PASSWORD
            keyAlias ONLINE_NOTE_KEY_ALIAS
            keyPassword ONLINE_NOTE_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### 4. 构建发布版 APK

```bash
./gradlew assembleRelease
```

## 重要配置

### capacitor.config.ts

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.onlinenote.app',
  appName: 'OnlineNote',
  webDir: 'out',  // 静态输出目录
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#FFFFFF",
      showSpinner: false
    }
  }
};

export default config;
```

### Android 权限配置

编辑 `android/app/src/main/AndroidManifest.xml`：

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    
    <application ...>
        <!-- 允许明文 HTTP 流量（开发时需要） -->
        <meta-data android:name="android.allow_clear_text_traffic" android:value="true" />
    </application>
</manifest>
```

## 常见问题

### 1. 白屏/无法加载

检查 `capacitor.config.ts` 中的 `webDir` 是否指向正确的构建输出目录。

### 2. API 调用失败

静态导出后 API 路由不可用，需要改为：
- 本地存储（localStorage/IndexedDB）
- 远程服务器 API

### 3. 图片不显示

Next.js 静态导出需要 `images.unoptimized: true`。

### 4. 样式错乱

确保在 `npx cap sync` 之前已经运行 `npm run build`。

## 完整构建流程（方案 A - 本地存储）

```bash
# 1. 修改代码使用本地存储
# 2. 构建静态文件
npm run build

# 3. 同步到 Capacitor
npx cap sync android

# 4. 构建 APK
cd android
./gradlew assembleDebug

# 5. APK 位置
# android/app/build/outputs/apk/debug/app-debug.apk
```

## 完整构建流程（方案 B - 远程 API）

```bash
# 1. 修改 API 调用指向远程服务器
# 2. 构建静态文件
npm run build

# 3. 同步到 Capacitor
npx cap sync android

# 4. 打开 Android Studio 配置和构建
npx cap open android
```

## 优化建议

1. **减少包体积**：
   - 删除未使用的依赖
   - 使用 `npm prune --production`

2. **性能优化**：
   - 启用代码分割
   - 使用 React.lazy 懒加载组件

3. **离线支持**：
   - 使用 Service Worker
   - 预缓存关键资源

4. **用户体验**：
   - 添加启动屏
   - 实现下拉刷新
   - 添加返回按钮处理

## 测试

在真机或模拟器上测试：

```bash
npx cap run android
```

## 发布

1. 构建签名 APK
2. 测试所有功能
3. 上传到 Google Play 或直接分发
