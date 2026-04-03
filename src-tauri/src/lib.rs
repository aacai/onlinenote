use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_favorite: bool,
    pub is_archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
}

fn get_data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./data"))
}

fn read_notes(app: &tauri::AppHandle) -> Vec<Note> {
    let data_dir = get_data_dir(app);
    let notes_path = data_dir.join("notes.json");
    
    if let Ok(content) = fs::read_to_string(notes_path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    }
}

fn write_notes(app: &tauri::AppHandle, notes: &[Note]) -> Result<(), String> {
    let data_dir = get_data_dir(app);
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    
    let notes_path = data_dir.join("notes.json");
    let content = serde_json::to_string_pretty(notes).map_err(|e| e.to_string())?;
    fs::write(notes_path, content).map_err(|e| e.to_string())?;
    
    Ok(())
}

fn read_categories(app: &tauri::AppHandle) -> Vec<Category> {
    let data_dir = get_data_dir(app);
    let categories_path = data_dir.join("categories.json");
    
    if let Ok(content) = fs::read_to_string(categories_path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    }
}

fn write_categories(app: &tauri::AppHandle, categories: &[Category]) -> Result<(), String> {
    let data_dir = get_data_dir(app);
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    
    let categories_path = data_dir.join("categories.json");
    let content = serde_json::to_string_pretty(categories).map_err(|e| e.to_string())?;
    fs::write(categories_path, content).map_err(|e| e.to_string())?;
    
    Ok(())
}

fn get_attachments_dir(app: &tauri::AppHandle, note_id: &str) -> PathBuf {
    let data_dir = get_data_dir(app);
    data_dir.join("attachments").join(note_id)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentInfo {
    pub filename: String,
    pub url: String,
}

fn read_attachments(app: &tauri::AppHandle, note_id: &str) -> Vec<AttachmentInfo> {
    let attachments_dir = get_attachments_dir(app, note_id);
    
    if let Ok(entries) = fs::read_dir(&attachments_dir) {
        entries
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.path().is_file())
            .filter_map(|entry| {
                let filename = entry.file_name().to_string_lossy().to_string();
                Some(AttachmentInfo {
                    filename: filename.clone(),
                    url: format!("file://{}", entry.path().display()),
                })
            })
            .collect()
    } else {
        Vec::new()
    }
}

fn save_attachment(app: &tauri::AppHandle, note_id: &str, filename: &str, data: &[u8]) -> Result<(), String> {
    let attachments_dir = get_attachments_dir(app, note_id);
    fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;
    
    let file_path = attachments_dir.join(filename);
    fs::write(file_path, data).map_err(|e| e.to_string())
}

fn delete_attachment_internal(app: &tauri::AppHandle, note_id: &str, filename: &str) -> Result<(), String> {
    let attachments_dir = get_attachments_dir(app, note_id);
    let file_path = attachments_dir.join(filename);
    
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())
    } else {
        Err("Attachment not found".to_string())
    }
}

#[tauri::command]
fn get_notes(app: tauri::AppHandle) -> Result<Vec<Note>, String> {
    Ok(read_notes(&app))
}

#[tauri::command]
fn create_note(app: tauri::AppHandle, note: Note) -> Result<Note, String> {
    let mut notes = read_notes(&app);
    notes.push(note.clone());
    write_notes(&app, &notes)?;
    Ok(note)
}

#[tauri::command]
fn update_note(app: tauri::AppHandle, id: String, updates: Note) -> Result<Note, String> {
    let mut notes = read_notes(&app);
    
    if let Some(note) = notes.iter_mut().find(|n| n.id == id) {
        *note = updates.clone();
        write_notes(&app, &notes)?;
        Ok(updates)
    } else {
        Err("Note not found".to_string())
    }
}

#[tauri::command]
fn delete_note(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut notes = read_notes(&app);
    notes.retain(|n| n.id != id);
    write_notes(&app, &notes)
}

#[tauri::command]
fn get_categories(app: tauri::AppHandle) -> Result<Vec<Category>, String> {
    Ok(read_categories(&app))
}

#[tauri::command]
fn create_category(app: tauri::AppHandle, name: String, color: String) -> Result<Category, String> {
    let mut categories = read_categories(&app);
    
    let category = Category {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        color,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    categories.push(category.clone());
    write_categories(&app, &categories)?;
    Ok(category)
}

#[tauri::command]
fn delete_category(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut categories = read_categories(&app);
    categories.retain(|c| c.id != id);
    write_categories(&app, &categories)
}

#[tauri::command]
fn get_attachments(app: tauri::AppHandle, note_id: String) -> Result<Vec<AttachmentInfo>, String> {
    Ok(read_attachments(&app, &note_id))
}

#[tauri::command]
fn delete_attachment(app: tauri::AppHandle, note_id: String, filename: String) -> Result<(), String> {
    delete_attachment_internal(&app, &note_id, &filename)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build())
        .invoke_handler(tauri::generate_handler![
            get_notes,
            create_note,
            update_note,
            delete_note,
            get_categories,
            create_category,
            delete_category,
            get_attachments,
            delete_attachment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
