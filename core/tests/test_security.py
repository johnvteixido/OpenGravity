import pytest
from pathlib import Path
from security.policy import PolicyEngine, PolicyViolation

def test_rust_fs_traversal(tmp_path):
    # Setup
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    sensitive = tmp_path / "sensitive"
    sensitive.mkdir()
    
    policy_file = tmp_path / "policy.json"
    engine = PolicyEngine(policy_file)
    
    # Allowed access
    engine.check_filesystem(workspace / "file.txt", workspace)
    
    # Traversal attempt (normalized)
    with pytest.raises(PolicyViolation) as exc:
        engine.check_filesystem(workspace / "../sensitive/stolen.txt", workspace)
    assert "outside the allowed workspace" in str(exc.value)

def test_rust_shell_patterns(tmp_path):
    policy_file = tmp_path / "policy.json"
    engine = PolicyEngine(policy_file)
    
    # Forbidden pattern (regex)
    with pytest.raises(PolicyViolation) as exc:
        engine.check_shell_command("rm -rf /")
    assert "restricted pattern" in str(exc.value)
    
    # Forbidden command
    with pytest.raises(PolicyViolation) as exc:
        engine.check_shell_command("format C:")
    assert "not in the enforced safe list" in str(exc.value)

def test_rust_network_ports(tmp_path):
    policy_file = tmp_path / "policy.json"
    engine = PolicyEngine(policy_file)
    
    # Use an allowed host but restricted port
    # 'openclaw.io' is in DEFAULT_POLICY['network']['allow']
    with pytest.raises(PolicyViolation) as exc:
        engine.check_network("openclaw.io", port=22)
    assert "Access to sensitive port 22" in str(exc.value)
    
    # Allowed host (localhost)
    engine.check_network("localhost", port=22)
