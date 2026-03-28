use pyo3::prelude::*;
use pyo3::exceptions::{PyRuntimeError, PyValueError};
use std::path::{Path, PathBuf};
use regex::Regex;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub enum ViolationType {
    Filesystem,
    Shell,
    Network,
}

#[pyclass]
pub struct RustPolicyEngine {
    #[pyo3(get)]
    pub version: String,
    pub shell_regex_cache: Vec<Regex>,
}

#[pymethods]
impl RustPolicyEngine {
    #[new]
    pub fn new() -> Self {
        Self {
            version: "0.2.0-hardened".to_string(),
            shell_regex_cache: Vec::new(),
        }
    }

    /// Robust filesystem guard with lexical path normalization.
    pub fn check_filesystem(&self, path: String, workspace: String, denied_zones: Vec<String>) -> PyResult<()> {
        let p = PathBuf::from(&path);
        let ws = PathBuf::from(&workspace);

        fn normalize_path(path: &Path) -> PathBuf {
            let mut components = Vec::new();
            for component in path.components() {
                match component {
                    std::path::Component::CurDir => {}
                    std::path::Component::ParentDir => {
                        components.pop();
                    }
                    c => components.push(c),
                }
            }
            components.iter().collect()
        }

        let normalized_p = normalize_path(&p);
        let normalized_ws = normalize_path(&ws);

        let normalized_p_str = normalized_p.to_string_lossy().to_string();
        let normalized_ws_str = normalized_ws.to_string_lossy().to_string();

        // 1. Deny zones check (lexical comparison)
        for zone in denied_zones {
            let zone_p = PathBuf::from(&zone);
            let normalized_zone = normalize_path(&zone_p);
            let normalized_zone_str = normalized_zone.to_string_lossy().to_string();
            
            if normalized_p_str.starts_with(&normalized_zone_str) {
                return Err(PyRuntimeError::new_err(format!(
                    "[RUST_FS_DENY] Access to sensitive zone blocked: {}", 
                    normalized_p_str
                )));
            }
        }

        // 2. Workspace containment check (lexical comparison)
        if !workspace.is_empty() && workspace != "$WORKSPACE" {
            if !normalized_p.starts_with(&normalized_ws) {
                return Err(PyRuntimeError::new_err(format!(
                    "[RUST_FS_BOUNDS] Path {} is outside the allowed workspace: {}", 
                    normalized_p_str, normalized_ws_str
                )));
            }
        }

        Ok(())
    }

    /// Shell command guard with regex pattern matching.
    pub fn check_shell_command(&self, command: String, allow_commands: Vec<String>, deny_patterns: Vec<String>) -> PyResult<()> {
        let _cmd_lower = command.to_lowercase();

        // 1. Regex Pattern check
        for pattern in deny_patterns {
            let re = Regex::new(&pattern).map_err(|e| {
                PyValueError::new_err(format!("Invalid regex pattern: {} - {}", pattern, e))
            })?;
            if re.is_match(&command) {
                return Err(PyRuntimeError::new_err(format!(
                    "[RUST_SHELL_PATTERN] Command blocked by restricted pattern: '{}'", 
                    pattern
                )));
            }
        }

        // 2. Allowlist check (first token)
        let first_token = command.split_whitespace().next().unwrap_or("").to_lowercase();
        if !allow_commands.is_empty() && !first_token.is_empty() {
             if !allow_commands.iter().any(|c| c.to_lowercase() == first_token) {
                 return Err(PyRuntimeError::new_err(format!(
                     "[RUST_SHELL_FORBIDDEN] Command '{}' is not in the enforced safe list", 
                     first_token
                 )));
             }
        }

        Ok(())
    }

    /// Network guard with host and port awareness.
    #[pyo3(signature = (host, port=None, allow_hosts=Vec::new()))]
    pub fn check_network(&self, host: String, port: Option<u16>, allow_hosts: Vec<String>) -> PyResult<()> {
        // Localhost is always allowed
        if host == "localhost" || host == "127.0.0.1" || host.starts_with("127.") || host == "::1" {
            return Ok(());
        }

        // 1. Host check
        if !allow_hosts.is_empty() && !allow_hosts.contains(&host) {
            return Err(PyRuntimeError::new_err(format!(
                "[RUST_NET_HOST] Network access to '{}' is blocked by policy", 
                host
            )));
        }

        // 2. Specific restriction on common sensitive ports (if not in allowlist)
        if let Some(p) = port {
            let blocked_ports = vec![22, 23, 25, 110, 143, 3306, 5432, 27017];
            if blocked_ports.contains(&p) {
                 return Err(PyRuntimeError::new_err(format!(
                    "[RUST_NET_PORT] Access to sensitive port {} on {} is restricted", 
                    p, host
                )));
            }
        }

        Ok(())
    }
}

/// A Python module implemented in Rust.
#[pymodule]
fn opengravity_core_rust(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<RustPolicyEngine>()?;
    Ok(())
}
