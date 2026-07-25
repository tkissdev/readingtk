; Script Inno Setup — genere un installeur classique et compresse pour ReadingTK.
; Compilation : ISCC.exe installer.iss /DAppVersion=X.X.X
; (le .exe autonome doit deja exister dans dist\ReadingTK.exe — voir build.py)

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{B7E2B7B2-8B6E-4F0B-9C8B-2E6F4E6E9C11}
AppName=ReadingTK
AppVersion={#AppVersion}
AppPublisher=TKISSDev
AppPublisherURL=https://readingtk.net
DefaultDirName={localappdata}\Programs\ReadingTK
DefaultGroupName=ReadingTK
UninstallDisplayIcon={app}\ReadingTK.exe
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=ReadingTK-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
SetupIconFile=icon.ico
DisableProgramGroupPage=yes
WizardStyle=modern
; Detecte via Restart Manager si ReadingTK.exe tourne (systray, demarrage auto avec
; Windows) et le ferme automatiquement avant d'ecraser le fichier, puis le relance
; apres l'installation — sans ca, une mise a jour avec l'app deja lancee echoue
; silencieusement (fichier verrouille).
CloseApplications=force
RestartApplications=yes

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "dist\ReadingTK.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\ReadingTK"; Filename: "{app}\ReadingTK.exe"
Name: "{group}\{cm:UninstallProgram,ReadingTK}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\ReadingTK"; Filename: "{app}\ReadingTK.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\ReadingTK.exe"; Description: "{cm:LaunchProgram,ReadingTK}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
