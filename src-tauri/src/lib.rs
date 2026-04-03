mod providers;
mod app_sync;

use std::sync::Mutex;
use tauri::Runtime;
use providers::{discover_calendars, fetch_events, get_provider_metadata, list_providers, sync_account, test_connection};
use app_sync::{
    app_sync_setup, app_sync_delete, app_sync_test,
    app_sync_push, app_sync_pull, app_sync_status,
    app_sync_generate_link_code, app_sync_join,
};

#[cfg(desktop)]
use tauri::menu::CheckMenuItem;

#[cfg(desktop)]
struct ThemeMenuState<R: Runtime> {
    light: CheckMenuItem<R>,
    dark: CheckMenuItem<R>,
    system: CheckMenuItem<R>,
}

#[cfg(desktop)]
fn apply_theme_checks<R: Runtime>(state: &ThemeMenuState<R>, theme: &str) {
    let _ = state.light.set_checked(theme == "light");
    let _ = state.dark.set_checked(theme == "dark");
    let _ = state.system.set_checked(theme == "system");
}

#[cfg(desktop)]
#[tauri::command]
fn sync_theme(theme: String, state: tauri::State<Mutex<ThemeMenuState<tauri::Wry>>>) {
    if let Ok(s) = state.lock() {
        apply_theme_checks(&s, &theme);
    }
}

#[cfg(all(desktop, debug_assertions))]
struct DevEmulationState<R: Runtime> {
    emulate_mobile: CheckMenuItem<R>,
    mobile_active: bool,
    original_physical_size: Option<(u32, u32)>,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // reqwest 0.13 (pulled in by tauri-plugin-updater) uses rustls 0.23, which
    // requires a crypto provider to be installed before any TLS client is created.
    // ring is already in the tree via hyper-rustls; install it as the default.
    let _ = rustls::crypto::ring::default_provider().install_default();

    #[cfg(debug_assertions)]
    let builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            #[cfg(desktop)]
            sync_theme,
            dev_commands::reset_database,
            test_connection,
            discover_calendars,
            sync_account,
            fetch_events,
            list_providers,
            get_provider_metadata,
            app_sync_setup,
            app_sync_delete,
            app_sync_test,
            app_sync_push,
            app_sync_pull,
            app_sync_status,
            app_sync_generate_link_code,
            app_sync_join,
        ]);
    #[cfg(not(debug_assertions))]
    let builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            #[cfg(desktop)]
            sync_theme,
            test_connection,
            discover_calendars,
            sync_account,
            fetch_events,
            list_providers,
            get_provider_metadata,
            app_sync_setup,
            app_sync_delete,
            app_sync_test,
            app_sync_push,
            app_sync_pull,
            app_sync_status,
            app_sync_generate_link_code,
            app_sync_join,
        ]);

    builder
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            use tauri::Manager;
            app.manage(Mutex::new(app_sync::AppSyncStateInner::default()));

            #[cfg(desktop)]
            {
                use tauri::menu::{CheckMenuItem, Submenu};

                let light  = CheckMenuItem::with_id(app, "theme_light",  "Light",  true, false, None::<&str>)?;
                let dark   = CheckMenuItem::with_id(app, "theme_dark",   "Dark",   true, false, None::<&str>)?;
                let system = CheckMenuItem::with_id(app, "theme_system", "System", true, true,  None::<&str>)?;
                let theme_menu = Submenu::with_items(app, "Theme", true, &[&light, &dark, &system])?;

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
                        let emulate_item = CheckMenuItem::with_id(app, "emulate_mobile", "Emulate Mobile", true, false, None::<&str>)?;
                        let dev_menu = Submenu::with_items(app, "Developer", true, &[&reset_item, &reload_item, &emulate_item])?;
                        menu.insert(&dev_menu, end_pos)?;

                        app.manage(Mutex::new(DevEmulationState {
                            emulate_mobile: emulate_item.clone(),
                            mobile_active: false,
                            original_physical_size: None,
                        }));
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
                    } else if event.id() == "emulate_mobile" {
                        if let Some(win) = app.get_webview_window("main") {
                            if let Some(state) = app.try_state::<Mutex<DevEmulationState<tauri::Wry>>>() {
                                if let Ok(mut s) = state.lock() {
                                    if !s.mobile_active {
                                        if let Ok(size) = win.inner_size() {
                                            s.original_physical_size = Some((size.width, size.height));
                                        }
                                        let _ = win.set_min_size(None::<tauri::LogicalSize<f64>>);
                                        let _ = win.set_size(tauri::LogicalSize::new(390.0_f64, 844.0_f64));
                                        s.mobile_active = true;
                                        let _ = s.emulate_mobile.set_checked(true);
                                        eprintln!("[dev] Mobile emulation on (390×844)");
                                    } else {
                                        let _ = win.set_min_size(Some(tauri::LogicalSize::new(800.0_f64, 600.0_f64)));
                                        if let Some((w, h)) = s.original_physical_size {
                                            let _ = win.set_size(tauri::PhysicalSize::new(w, h));
                                        } else {
                                            let _ = win.set_size(tauri::LogicalSize::new(1200.0_f64, 750.0_f64));
                                        }
                                        s.mobile_active = false;
                                        let _ = s.emulate_mobile.set_checked(false);
                                        eprintln!("[dev] Mobile emulation off");
                                    }
                                }
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
