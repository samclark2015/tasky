mod providers;

use std::sync::Mutex;
use tauri::{Runtime, menu::CheckMenuItem};
use providers::caldav::{caldav_discover_calendars, caldav_fetch_events, caldav_sync_account, caldav_test_connection};

struct ThemeMenuState<R: Runtime> {
    light: CheckMenuItem<R>,
    dark: CheckMenuItem<R>,
    system: CheckMenuItem<R>,
}

fn apply_theme_checks<R: Runtime>(state: &ThemeMenuState<R>, theme: &str) {
    let _ = state.light.set_checked(theme == "light");
    let _ = state.dark.set_checked(theme == "dark");
    let _ = state.system.set_checked(theme == "system");
}

#[tauri::command]
fn sync_theme(theme: String, state: tauri::State<Mutex<ThemeMenuState<tauri::Wry>>>) {
    if let Ok(s) = state.lock() {
        apply_theme_checks(&s, &theme);
    }
}

#[cfg(debug_assertions)]
mod dev_commands {
    use tauri::{AppHandle, Manager};

    #[tauri::command]
    pub fn reset_database(app: AppHandle) -> Result<(), String> {
        let mut path = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?;
        path.push("tasky.db");
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

pub fn run() {
    #[cfg(debug_assertions)]
    let builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            sync_theme,
            dev_commands::reset_database,
            caldav_test_connection,
            caldav_discover_calendars,
            caldav_sync_account,
            caldav_fetch_events,
        ]);
    #[cfg(not(debug_assertions))]
    let builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            sync_theme,
            caldav_test_connection,
            caldav_discover_calendars,
            caldav_sync_account,
            caldav_fetch_events,
        ]);

    builder
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            use tauri::menu::{CheckMenuItem, Submenu};

            let light  = CheckMenuItem::with_id(app, "theme_light",  "Light",  true, false, None::<&str>)?;
            let dark   = CheckMenuItem::with_id(app, "theme_dark",   "Dark",   true, false, None::<&str>)?;
            let system = CheckMenuItem::with_id(app, "theme_system", "System", true, true,  None::<&str>)?;
            let theme_menu = Submenu::with_items(app, "Theme", true, &[&light, &dark, &system])?;

            use tauri::Manager;
            app.manage(Mutex::new(ThemeMenuState {
                light: light.clone(),
                dark: dark.clone(),
                system: system.clone(),
            }));

            if let Some(menu) = app.menu() {
                if let Some(view_item) = menu.items()?.get(3) {
                    if let tauri::menu::MenuItemKind::Submenu(view_menu) = view_item {
                        view_menu.append(&theme_menu)?;
                    }
                }

                #[cfg(debug_assertions)]
                {
                    use tauri::menu::MenuItem;

                    let items = menu.items()?;
                    let end_pos = items.len().saturating_sub(1);
                    let reset_item = MenuItem::with_id(app, "reset_db", "Reset Database", true, None::<&str>)?;
                    let reload_item = MenuItem::with_id(app, "reload_window", "Reload", true, None::<&str>)?;
                    let dev_menu = Submenu::with_items(app, "Developer", true, &[&reset_item, &reload_item])?;
                    menu.insert(&dev_menu, end_pos)?;
                }
            }

            app.on_menu_event(|app, event| {
                use tauri::Manager;
                let theme = match event.id().as_ref() {
                    "theme_light"  => Some("light"),
                    "theme_dark"   => Some("dark"),
                    "theme_system" => Some("system"),
                    _ => None,
                };
                if let Some(t) = theme {
                    if let Some(state) = app.try_state::<Mutex<ThemeMenuState<tauri::Wry>>>() {
                        if let Ok(s) = state.lock() {
                            apply_theme_checks(&s, t);
                        }
                    }
                    if let Some(win) = app.get_webview_window("main") {
                        use tauri::Emitter;
                        let _ = win.emit("set-theme", t);
                    }
                    return;
                }

                #[cfg(debug_assertions)]
                if event.id() == "reset_db" {
                    match dev_commands::reset_database(app.clone()) {
                        Ok(_) => {
                            eprintln!("[dev] Database reset. Reloading…");
                            if let Some(win) = app.get_webview_window("main") {
                                let _: tauri::Result<()> = win.eval("location.reload()");
                            }
                        }
                        Err(e) => eprintln!("[dev] Failed to reset database: {e}"),
                    }
                } else if event.id() == "reload_window" {
                    if let Some(win) = app.get_webview_window("main") {
                        let _: tauri::Result<()> = win.eval("location.reload()");
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
