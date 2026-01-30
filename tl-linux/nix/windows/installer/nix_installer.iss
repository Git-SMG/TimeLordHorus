; NIX Control Center Windows Installer Script
; Requires Inno Setup 6.0 or later
; Download from: https://jrsoftware.org/isinfo.php

#define MyAppName "NIX Control Center"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "TL Linux Project"
#define MyAppURL "https://github.com/TimeLordHorus/TimeLordHorus"
#define MyAppExeName "NIX_Control_Center.exe"

[Setup]
; Application information
AppId={{B4E9C5F6-7A2D-4F1B-9E3C-8D6A5B4C3E2F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\NIX
DefaultGroupName=NIX
AllowNoIcons=yes
LicenseFile=..\..\LICENSE
InfoBeforeFile=..\..\README.md
OutputDir=..\..\..\nix-windows-installer
OutputBaseFilename=NIX_Setup_v{#MyAppVersion}
SetupIconFile=..\nix_icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode
Name: "startmenu"; Description: "Create Start Menu shortcuts"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; Main application files
Source: "..\build\dist\NIX\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Documentation
Source: "..\..\README.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\NIX_ARCHITECTURE.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\SETUP.md"; DestDir: "{app}\docs"; Flags: ignoreversion
; Examples
Source: "..\..\examples\*.py"; DestDir: "{app}\examples"; Flags: ignoreversion
; Python scripts (for advanced users)
Source: "..\..\*.py"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs
Source: "..\..\requirements.txt"; DestDir: "{app}\src"; Flags: ignoreversion

[Icons]
; Start Menu
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Documentation"; Filename: "{app}\docs\README.md"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
; Desktop
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
; Quick Launch
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; Option to launch application after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
// Check for Python (optional, for advanced features)
function IsPythonInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('python', '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure InitializeWizard;
begin
  // Custom initialization if needed
end;

// Post-installation tasks
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Create wallet directory in AppData
    CreateDir(ExpandConstant('{userappdata}\NIX'));
    CreateDir(ExpandConstant('{userappdata}\NIX\wallet'));
    CreateDir(ExpandConstant('{userappdata}\NIX\config'));
    CreateDir(ExpandConstant('{userappdata}\NIX\logs'));
  end;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{userappdata}\NIX\logs"
Type: filesandordirs; Name: "{userappdata}\NIX\config"
; Note: We don't delete the wallet folder to preserve user documents

[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%nNIX is a File Verification Protocol and Authorization System that provides secure, blockchain-verified document management for government agencies, healthcare providers, and individuals.%n%nIt is recommended that you close all other applications before continuing.
