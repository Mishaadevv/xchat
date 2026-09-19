use std::io::{BufRead, BufReader};
use std::process::{Child, Command as ProcCommand, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, State};

/// Handle of the bundled llama-server sidecar (spawned from an absolute path,
/// so no shell-scope entry is needed — the app downloads/owns the binary).
struct EngineState(Mutex<Option<Child>>);

fn pump_lines<R: std::io::Read + Send + 'static>(stream: R, app: tauri::AppHandle, tag: &'static str) {
  std::thread::spawn(move || {
    let reader = BufReader::new(stream);
    for line in reader.lines().map_while(Result::ok) {
      let text = line.trim().to_string();
      if !text.is_empty() {
        let _ = app.emit("engine-log", format!("[{tag}] {text}"));
      }
    }
  });
}

#[tauri::command]
fn engine_start(
  app: tauri::AppHandle,
  state: State<'_, EngineState>,
  path: String,
  args: Vec<String>,
) -> Result<u32, String> {
  // One engine at a time.
  if let Ok(mut slot) = state.0.lock() {
    if let Some(mut old) = slot.take() {
      let _ = old.kill();
      let _ = old.wait();
    }
  }

  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(meta) = std::fs::metadata(&path) {
      let mut perm = meta.permissions();
      perm.set_mode(0o755);
      let _ = std::fs::set_permissions(&path, perm);
    }
  }

  let mut child = ProcCommand::new(&path)
    .args(&args)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .stdin(Stdio::null())
    .spawn()
    .map_err(|e| format!("spawn failed: {e}"))?;

  let pid = child.id();
  if let Some(out) = child.stdout.take() {
    pump_lines(out, app.clone(), "out");
  }
  if let Some(err) = child.stderr.take() {
    pump_lines(err, app.clone(), "err");
  }
  // Fast-fail: a broken binary (antivirus block, missing DLLs, bad flags)
  // exits almost immediately — report it at once instead of a 120s timeout.
  std::thread::sleep(std::time::Duration::from_millis(1200));
  if let Ok(Some(status)) = child.try_wait() {
    let hint = match status.code() {
      // STATUS_DLL_NOT_FOUND — sibling DLLs or the MSVC runtime are missing.
      Some(c) if c as u32 == 0xC0000135 => {
        " — a required DLL is missing: install Microsoft Visual C++ Redistributable (aka.ms/vs/17/release/vc_redist.x64.exe)"
      }
      _ => " — antivirus quarantine or missing DLLs likely, see engine log",
    };
    return Err(format!("engine exited immediately ({status}){hint}"));
  }
  if let Ok(mut slot) = state.0.lock() {
    *slot = Some(child);
  }
  Ok(pid)
}

#[tauri::command]
fn engine_stop(state: State<'_, EngineState>) -> Result<(), String> {
  if let Ok(mut slot) = state.0.lock() {
    if let Some(mut child) = slot.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
  Ok(())
}

/// Unpack a release zip into the folder of `dest_path`, then move the wanted
/// `llama-server` binary exactly to `dest_path`.
///
/// The whole archive is extracted (not just the exe): release builds ship
/// sibling DLLs next to the binary, and without them Windows kills the
/// process on startup with 0xC0000135 (STATUS_DLL_NOT_FOUND).
#[tauri::command]
fn engine_unzip(zip_path: String, dest_path: String) -> Result<u64, String> {
  use std::path::PathBuf;

  fn find_file(dir: &std::path::Path, name: &str) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.map_while(Result::ok) {
      let path = entry.path();
      if path.is_dir() {
        if let Some(hit) = find_file(&path, name) {
          return Some(hit);
        }
      } else if path.file_name().and_then(|n| n.to_str()) == Some(name) {
        return Some(path);
      }
    }
    None
  }

  let dest_path = std::path::Path::new(&dest_path);
  let dir = dest_path.parent().filter(|p| !p.as_os_str().is_empty()).map(|p| p.to_path_buf())
    .unwrap_or_else(|| std::path::PathBuf::from("."));
  std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {e}"))?;
  let want = dest_path
    .file_name()
    .and_then(|n| n.to_str())
    .ok_or_else(|| "bad destination filename".to_string())?
    .to_string();

  let file = std::fs::File::open(&zip_path).map_err(|e| format!("open zip: {e}"))?;
  let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("read zip: {e}"))?;

  let mut count = 0u64;
  for i in 0..archive.len() {
    let mut entry = archive.by_index(i).map_err(|e| format!("zip entry: {e}"))?;
    let name = entry.name().replace('\\', "/");
    // zip-slip guard
    if name.contains("..") {
      continue;
    }
    let rel = name.trim_start_matches('/');
    if rel.is_empty() || rel.ends_with('/') {
      continue;
    }
    let out_path = dir.join(rel);
    if entry.is_dir() {
      std::fs::create_dir_all(&out_path).map_err(|e| format!("mkdir: {e}"))?;
      continue;
    }
    if let Some(parent) = out_path.parent() {
      std::fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
    }
    let mut out = std::fs::File::create(&out_path).map_err(|e| format!("create file: {e}"))?;
    std::io::copy(&mut entry, &mut out).map_err(|e| format!("extract: {e}"))?;
    count += 1;
  }

  // The binary may sit in a subfolder (release zips are nested) — move it up.
  let have = dir.join(&want);
  if !have.is_file() {
    if let Some(found) = find_file(&dir, &want) {
      std::fs::rename(&found, &have).map_err(|e| format!("move engine binary: {e}"))?;
    } else {
      return Err(format!("{want} not found in zip"));
    }
  }

  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    let mut perm = std::fs::metadata(&have)
      .map_err(|e| format!("stat: {e}"))?
      .permissions();
    perm.set_mode(0o755);
    std::fs::set_permissions(&have, perm).map_err(|e| format!("chmod: {e}"))?;
  }
  Ok(count)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
    .plugin(tauri_plugin_opener::init())
    .manage(EngineState(Mutex::new(None)))
    .invoke_handler(tauri::generate_handler![engine_start, engine_stop, engine_unzip])
    .setup(|_app| {
      // ensure workspace dir exists
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
