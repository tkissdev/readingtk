"""Génère un .exe Windows autonome avec PyInstaller."""
import subprocess
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))

cmd = [
    sys.executable, "-m", "PyInstaller",
    "--onefile",
    "--noconsole",
    "--name", "ReadingTK",
    "--icon", os.path.join(HERE, "icon.ico"),
    "--add-data", f"{HERE};.",
    os.path.join(HERE, "main.py"),
]

subprocess.run(cmd, check=True)
print("\nBuild terminé ! Exécutable dans dist/ReadingTK.exe")
