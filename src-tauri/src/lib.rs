use ncm2mp3_core::{AudioFormat, NcmDecoder};
use serde::Serialize;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileInfo {
    name: String,
    path: String,
    size: u64,
    format: String,
    created_at: Option<u64>,
    modified_at: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DecryptNcmResult {
    /// 解密后的音频绝对路径
    path: String,
    /// 输出格式扩展名，如 mp3 / flac
    format: String,
    /// 是否跳过解密（目标文件已存在）
    cached: bool,
}

fn system_time_to_millis(time: SystemTime) -> Option<u64> {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

fn decode_text_bytes(bytes: &[u8]) -> String {
    if let Ok(text) = std::str::from_utf8(bytes) {
        return text.to_string();
    }

    let (gbk_text, _, gbk_had_errors) = encoding_rs::GBK.decode(bytes);
    if !gbk_had_errors {
        return gbk_text.into_owned();
    }

    String::from_utf8_lossy(bytes).into_owned()
}

fn resolve_ncm_extension(format: AudioFormat) -> &'static str {
    match format {
        AudioFormat::Unknown => "mp3",
        other => other.extension(),
    }
}

fn build_ncm_output_path(
    ncm_path: &Path,
    ext: &str,
    app: &tauri::AppHandle,
) -> Result<PathBuf, String> {
    let stem = ncm_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("ncm-audio");
    let file_name = format!("{stem}.{ext}");

    let sibling = ncm_path.with_file_name(&file_name);
    if sibling.exists() {
        return Ok(sibling);
    }

    if let Some(parent) = ncm_path.parent() {
        let probe = parent.join(format!(".{stem}.ncm-write-test"));
        if File::create(&probe).is_ok() {
            let _ = fs::remove_file(&probe);
            return Ok(sibling);
        }
    }

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| err.to_string())?
        .join("ncm-decoded");
    fs::create_dir_all(&cache_dir).map_err(|err| err.to_string())?;
    Ok(cache_dir.join(file_name))
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).is_file()
}

#[tauri::command]
fn get_file_info(path: String) -> Result<FileInfo, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("文件不存在".into());
    }

    let metadata = fs::metadata(file_path).map_err(|err| err.to_string())?;
    let name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(&path)
        .to_string();
    let format = file_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|ext| ext.to_uppercase())
        .unwrap_or_else(|| "未知".into());

    Ok(FileInfo {
        name,
        path,
        size: metadata.len(),
        format,
        created_at: metadata.created().ok().and_then(system_time_to_millis),
        modified_at: metadata.modified().ok().and_then(system_time_to_millis),
    })
}

#[tauri::command]
fn reveal_in_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    if !Path::new(&path).exists() {
        return Err("文件或文件夹不存在".into());
    }

    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn move_source_file_to_trash(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("文件不存在".into());
    }

    trash::delete(file_path).map_err(|err| err.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("文件不存在".into());
    }

    let bytes = fs::read(file_path).map_err(|err| err.to_string())?;
    Ok(decode_text_bytes(&bytes))
}

/// 将网易云 `.ncm` 解密为可播放音频（同目录优先，失败则写入应用缓存）
#[tauri::command]
fn decrypt_ncm(app: tauri::AppHandle, path: String) -> Result<DecryptNcmResult, String> {
    let ncm_path = PathBuf::from(&path);
    if !ncm_path.is_file() {
        return Err("NCM 文件不存在".into());
    }

    let ext_hint = ncm_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    if ext_hint.as_deref() != Some("ncm") {
        return Err("不是 .ncm 文件".into());
    }

    let (mut decoder, headers) =
        NcmDecoder::open(&ncm_path).map_err(|err| format!("解析 NCM 失败：{err}"))?;
    let format = resolve_ncm_extension(headers.effective_format());
    let output_path = build_ncm_output_path(&ncm_path, format, &app)?;

    if output_path.is_file() {
        let ncm_modified = fs::metadata(&ncm_path)
            .ok()
            .and_then(|meta| meta.modified().ok());
        let out_modified = fs::metadata(&output_path)
            .ok()
            .and_then(|meta| meta.modified().ok());
        let reuse = match (ncm_modified, out_modified) {
            (Some(ncm_time), Some(out_time)) => out_time >= ncm_time,
            _ => true,
        };
        if reuse {
            return Ok(DecryptNcmResult {
                path: output_path.to_string_lossy().into_owned(),
                format: format.to_string(),
                cached: true,
            });
        }
    }

    let mut output = File::create(&output_path).map_err(|err| {
        format!(
            "无法写入解密文件（{}）：{err}",
            output_path.to_string_lossy()
        )
    })?;
    decoder
        .decode_to_writer(&mut output)
        .map_err(|err| format!("解密 NCM 失败：{err}"))?;

    Ok(DecryptNcmResult {
        path: output_path.to_string_lossy().into_owned(),
        format: format.to_string(),
        cached: false,
    })
}

fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let about = PredefinedMenuItem::about(
        app,
        Some("关于咸鱼影音播放器"),
        Some(AboutMetadata {
            name: Some("咸鱼影音播放器".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            copyright: Some("© 咸鱼影音播放器".into()),
            ..Default::default()
        }),
    )?;
    let services = PredefinedMenuItem::services(app, Some("服务"))?;
    let hide = PredefinedMenuItem::hide(app, Some("隐藏咸鱼影音播放器"))?;
    let hide_others = PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?;
    let show_all = PredefinedMenuItem::show_all(app, Some("显示全部"))?;
    let quit = PredefinedMenuItem::quit(app, Some("退出咸鱼影音播放器"))?;

    // macOS：第一项会并入应用菜单（左侧应用名），不单独显示标题
    let app_menu = SubmenuBuilder::new(app, "咸鱼影音播放器")
        .item(&about)
        .separator()
        .item(&services)
        .separator()
        .item(&hide)
        .item(&hide_others)
        .item(&show_all)
        .separator()
        .item(&quit)
        .build()?;

    let undo = PredefinedMenuItem::undo(app, Some("撤销"))?;
    let redo = PredefinedMenuItem::redo(app, Some("重做"))?;
    let cut = PredefinedMenuItem::cut(app, Some("剪切"))?;
    let copy = PredefinedMenuItem::copy(app, Some("拷贝"))?;
    let paste = PredefinedMenuItem::paste(app, Some("粘贴"))?;
    let select_all = PredefinedMenuItem::select_all(app, Some("全选"))?;

    let edit_menu = SubmenuBuilder::new(app, "编辑")
        .item(&undo)
        .item(&redo)
        .separator()
        .item(&cut)
        .item(&copy)
        .item(&paste)
        .item(&select_all)
        .build()?;

    let play_pause = MenuItemBuilder::with_id("play-pause", "播放/暂停")
        .accelerator("CmdOrCtrl+P")
        .build(app)?;
    let play_prev = MenuItemBuilder::with_id("play-prev", "上一首")
        .accelerator("CmdOrCtrl+Left")
        .build(app)?;
    let play_next = MenuItemBuilder::with_id("play-next", "下一首")
        .accelerator("CmdOrCtrl+Right")
        .build(app)?;
    let cycle_play_mode = MenuItemBuilder::with_id("cycle-play-mode", "切换播放模式")
        .accelerator("CmdOrCtrl+M")
        .build(app)?;

    let control_menu = SubmenuBuilder::new(app, "控制")
        .item(&play_pause)
        .item(&play_prev)
        .item(&play_next)
        .separator()
        .item(&cycle_play_mode)
        .build()?;

    let minimize = PredefinedMenuItem::minimize(app, Some("最小化"))?;
    let maximize = PredefinedMenuItem::maximize(app, Some("缩放"))?;
    let fullscreen = PredefinedMenuItem::fullscreen(app, Some("进入全屏幕"))?;
    let close_window = PredefinedMenuItem::close_window(app, Some("关闭"))?;
    let bring_all_to_front = PredefinedMenuItem::bring_all_to_front(app, Some("将全部置于顶层"))?;

    let window_menu = SubmenuBuilder::new(app, "窗口")
        .item(&minimize)
        .item(&maximize)
        .separator()
        .item(&fullscreen)
        .separator()
        .item(&close_window)
        .item(&bring_all_to_front)
        .build()?;

    let help_about = MenuItemBuilder::with_id("help-about", "关于咸鱼影音播放器").build(app)?;
    let help_menu = SubmenuBuilder::new(app, "帮助")
        .item(&help_about)
        .build()?;

    MenuBuilder::new(app)
        .items(&[
            &app_menu,
            &edit_menu,
            &control_menu,
            &window_menu,
            &help_menu,
        ])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "play-pause" | "play-prev" | "play-next" | "cycle-play-mode" => {
                let _ = app.emit("menu-control", event.id().as_ref());
            }
            "help-about" => {
                let _ = app.emit("menu-control", "help-about");
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            path_exists,
            get_file_info,
            reveal_in_folder,
            move_source_file_to_trash,
            read_text_file,
            decrypt_ncm
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
