"""Génère un installateur .msi Windows avec cx_Freeze."""
import sys
from cx_Freeze import setup, Executable

APP_VERSION = "1.0.9"

build_exe_options = {
    "packages": [
        "tkinter", "pystray", "PIL", "winotify", "requests",
        "scrapling", "curl_cffi", "patchright", "browserforge", "msgspec",
        "apify_fingerprint_datapoints",
    ],
    "include_files": ["icon.ico", "icon.png"],
}

bdist_msi_options = {
    "add_to_path": False,
    "initial_target_dir": r"[ProgramFilesFolder]\ReadingTK",
    "upgrade_code": "{5945245E-DBCA-47D1-979A-1B99743F0060}",
    "summary_data": {
        "author": "TKISSDev",
        "comments": "ReadingTK — suivi automatique de lectures manga/manhwa/manhua",
    },
}

executables = [
    Executable(
        "main.py",
        base="gui",
        target_name="ReadingTK.exe",
        icon="icon.ico",
        shortcut_name="ReadingTK",
        shortcut_dir="ProgramMenuFolder",
    )
]

setup(
    name="ReadingTK",
    version=APP_VERSION,
    description="ReadingTK — suivi automatique de lectures manga/manhwa/manhua",
    author="TKISSDev",
    options={"build_exe": build_exe_options, "bdist_msi": bdist_msi_options},
    executables=executables,
)
