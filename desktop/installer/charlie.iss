; Inno Setup script for Charlie — produces CharlieSetup.exe, a real Windows
; installer (Start Menu shortcut, optional desktop icon, an entry in
; "Add or Remove Programs" with a proper uninstaller). No prerequisites to
; check for: the .exe built by PyInstaller bundles its own Python runtime,
; so nothing else needs to be installed on the target machine first.
;
; Built by .github/workflows/build-desktop.yml on a Windows runner, which
; passes the real version with /DMyAppVersion=X.Y.Z. Compile locally with:
;   iscc charlie.iss
; (defaults to version 0.0.0-dev if MyAppVersion isn't passed in).

#define MyAppName "Charlie"
#ifndef MyAppVersion
  #define MyAppVersion "0.0.0-dev"
#endif
#define MyAppPublisher "Charlie Assistant"
#define MyAppURL "https://github.com/AdasV-tech/Charlie-Assistant"
#define MyAppExeName "charlie.exe"

[Setup]
AppId={{B7B4E9D2-6F1A-4C8E-9B2D-3A1F5E7C9D01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; Installs per-user with no admin/UAC prompt by default; the user can still
; choose "install for all users" if they run it elevated.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=dist_installer
OutputBaseFilename=CharlieSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
; The exe itself: always overwritten by updates/reinstalls.
Source: "..\dist\charlie.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\VERSION"; DestDir: "{app}"; Flags: ignoreversion
; apps.json holds the user's own app-name -> path mappings. Installed once;
; never overwritten by a reinstall/update, and never deleted on uninstall —
; same "don't reset what's yours" principle as Charlie's built-in --update
; and --uninstall.
Source: "..\apps.json"; DestDir: "{app}"; Flags: onlyifdoesntexist uninsneveruninstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName} now"; Flags: nowait postinstall skipifsilent

; Deliberately no [UninstallRun] step calling charlie.exe --uninstall here:
; that command needs an interactive "type yes" console confirmation (see
; charlie_pc.py), which doesn't mix well with a silent/GUI uninstall flow.
; Removing the program via Add/Remove Programs only removes the program
; files themselves (never apps.json, see above) — your saved API key
; (charlie_config.json) and anything in ~/CharlieFiles are untouched. Run
; "charlie.exe --uninstall" yourself first if you also want those gone;
; see README.md "Uninstalling".
