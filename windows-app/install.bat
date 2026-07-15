@echo off
echo === ReadingTK Windows — Installation ===
echo.

:: Vérifier Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python n'est pas installé ou pas dans le PATH.
    echo Téléchargez Python sur https://python.org
    pause
    exit /b 1
)

:: Installer les dépendances
echo Installation des dépendances...
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERREUR] Echec de l'installation des dépendances.
    pause
    exit /b 1
)

:: Installer les navigateurs Playwright (nécessaire pour les sites JS-only)
echo.
echo Installation des navigateurs pour les sites nécessitant JavaScript...
playwright install chromium
if errorlevel 1 (
    echo [ATTENTION] Playwright n'a pas pu installer Chromium.
    echo Les sites marqués "needs_tab" ne seront pas scraped via navigateur.
    echo L'application fonctionnera quand même pour les autres sites.
)

echo.
echo === Installation terminée ! ===
echo Pour lancer l'application : python main.py
echo.
pause
