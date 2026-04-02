use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;
use std::path::PathBuf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 启动 Next.js 服务
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(500));
        
        // 获取资源目录
        let app_dir = PathBuf::from("/Applications/OnlineWebNote.app/Contents/Resources");
        let node_bin = app_dir.join("nodejs/bin/node");
        let app_path = app_dir.join("app");
        
        // 检查是否在开发模式（检查是否存在资源目录）
        let is_dev = !node_bin.exists();
        
        let mut cmd = if is_dev {
            // 开发模式：使用系统 npm
            let mut c = Command::new("npm");
            c.args(["run", "dev"]);
            c.current_dir("/Users/mac/Documents/trae_projects/onlinenote");
            c
        } else {
            // 生产模式：使用内置 Node.js
            let mut c = Command::new(node_bin);
            c.arg(app_path.join("node_modules/next/dist/bin/next"));
            c.arg("start");
            c.arg("-p");
            c.arg("3000");
            c.current_dir(&app_path);
            c.env("NODE_ENV", "production");
            c
        };
        
        let mut child = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("Failed to start Next.js server");
        
        // 等待服务启动
        thread::sleep(Duration::from_secs(4));
        
        // 保持进程运行
        let _ = child.wait();
    });
    
    // 等待 Next.js 服务启动
    thread::sleep(Duration::from_secs(3));
    
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
