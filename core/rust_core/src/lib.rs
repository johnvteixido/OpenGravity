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

    /// Robust filesystem guard using canonicalize.
    pub fn check_filesystem(&self, path: String, workspace: String, denied_zones: Vec<String>) -> PyResult<()> {
        let p = PathBuf::from(&path);
        
        // Canonicalize the target path if it exists, otherwise just get absolute
        let resolved_p = if p.exists() {
            p.canonicalize().unwrap_or_else(|_| p.to_path_buf())
        } else {
            p
        };

        // Resolve workspace
        let ws = PathBuf::from(&workspace);
        let resolved_ws = if ws.exists() {
            ws.canonicalize().unwrap_or_else(|_| ws.to_path_buf())
        } else {
            ws
        };

        let resolved_p_str = resolved_p.to_string_lossy().to_string();
        let resolved_ws_str = resolved_ws.to_string_lossy().to_string();

        // 1. Deny zones check (prefix matches)
        for zone in denied_zones {
            let zone_p = PathBuf::from(&zone);
            let resolved_zone = if zone_p.exists() {
                zone_p.canonicalize().unwrap_or_else(|_| zone_p.to_path_buf())
            } else {
                zone_p
            };
            let resolved_zone_str = resolved_zone.to_string_lossy().to_string();
            
            if resolved_p_str.starts_with(&resolved_zone_str) {
                return Err(PyRuntimeError::new_err(format!(
                    "[RUST_FS_DENY] Access to sensitive zone blocked: {}", 
                    resolved_p_str
                )));
            }
        }

        // 2. Workspace containment check
        if !workspace.is_empty() && workspace != "$WORKSPACE" {
            if !resolved_p_str.starts_with(&resolved_ws_str) {
                return Err(PyRuntimeError::new_err(format!(
                    "[RUST_FS_BOUNDS] Path {} is outside the allowed workspace: {}", 
                    resolved_p_str, resolved_ws_str
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
