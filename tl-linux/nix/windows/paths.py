"""
Windows-specific path and configuration utilities for NIX
"""

import os
import sys
from pathlib import Path


def get_app_data_dir():
    """Get the NIX application data directory on Windows"""
    if sys.platform == 'win32':
        # Use AppData/Roaming for user data
        appdata = os.environ.get('APPDATA')
        if appdata:
            nix_dir = os.path.join(appdata, 'NIX')
        else:
            nix_dir = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'NIX')
    else:
        # Linux/Mac
        nix_dir = os.path.expanduser('~/.nix')

    return nix_dir


def get_wallet_dir():
    """Get the wallet directory"""
    return os.path.join(get_app_data_dir(), 'wallet')


def get_config_dir():
    """Get the configuration directory"""
    return os.path.join(get_app_data_dir(), 'config')


def get_log_dir():
    """Get the log directory"""
    if sys.platform == 'win32':
        return os.path.join(get_app_data_dir(), 'logs')
    else:
        return os.path.join(get_app_data_dir(), 'logs')


def get_temp_dir():
    """Get temporary directory"""
    if sys.platform == 'win32':
        return os.path.join(os.environ.get('TEMP', 'C:\\Temp'), 'NIX')
    else:
        return '/tmp/nix'


def ensure_directories():
    """Create all necessary directories"""
    dirs = [
        get_app_data_dir(),
        get_wallet_dir(),
        get_config_dir(),
        get_log_dir(),
        get_temp_dir()
    ]

    for directory in dirs:
        os.makedirs(directory, exist_ok=True)


def get_install_dir():
    """Get the installation directory"""
    if sys.platform == 'win32':
        # Check if running from installed location
        if getattr(sys, 'frozen', False):
            # Running as compiled executable
            return os.path.dirname(sys.executable)
        else:
            # Running as script
            return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    else:
        return '/opt/tl-linux/nix'


def is_windows():
    """Check if running on Windows"""
    return sys.platform == 'win32'


def is_linux():
    """Check if running on Linux"""
    return sys.platform.startswith('linux')


def get_executable_path(name):
    """Get path to bundled executable"""
    if getattr(sys, 'frozen', False):
        # Running as compiled
        base_path = sys._MEIPASS
    else:
        base_path = get_install_dir()

    if is_windows():
        return os.path.join(base_path, f'{name}.exe')
    else:
        return os.path.join(base_path, name)


# Initialize directories on import
if __name__ != '__main__':
    ensure_directories()
