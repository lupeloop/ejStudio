; ejStudio installer: dark welcome/finish pages and headers (Modern UI 2 colours).
; Inner-page boxes (folder picker, progress list) are standard Windows controls.
!ifndef MUI_BGCOLOR
  !define MUI_BGCOLOR "0B0B0E"
!endif
!ifndef MUI_TEXTCOLOR
  !define MUI_TEXTCOLOR "E8E8EA"
!endif
!ifndef MUI_INSTFILESPAGE_COLORS
  !define MUI_INSTFILESPAGE_COLORS "8A8A92 000000"
!endif

!include "FileFunc.nsh"

; Upgrading from ejLab: the old install folder is read back from the registry.
; Install into ...\ejStudio instead (the old ejLab uninstaller still removes the old folder).
!macro customInit
  ${GetFileName} "$INSTDIR" $R0
  ${If} $R0 == "ejLab"
    ${GetParent} "$INSTDIR" $R1
    StrCpy $INSTDIR "$R1\ejStudio"
  ${EndIf}
!macroend

; ── "This PC" question, asked once ─────────────────────────────────────────
; Car cluster: ejStudio starts straight into ejLogger full-screen. Laptop: the normal window.
; Suggests Car cluster when the screen is 1024 x 600. Skipped when ejStudio already has settings
; (upgrades), since the choice then lives in ejLogger -> Config -> This PC.
!include nsDialogs.nsh
Var ejRoleCar
Var ejRole
!macro customPageAfterChangeDir
  Page custom ejRolePage ejRoleLeave
!macroend
Function ejRolePage
  ${If} ${FileExists} "$APPDATA\ejStudio\ejlogger.json"
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "This PC" "Is this PC the car cluster, or a laptop?"
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 22u "ejStudio runs differently on a dedicated in-car PC. You can change this later in ejLogger, Config, This PC."
  Pop $0
  ${NSD_CreateRadioButton} 8u 30u 100% 14u "Laptop or desktop: opens ejStudio, records when you press Rec"
  Pop $1
  ${NSD_CreateRadioButton} 8u 48u 100% 14u "Car cluster: starts in ejLogger full-screen, connects and records on its own"
  Pop $ejRoleCar
  System::Call 'user32::GetSystemMetrics(i 0) i .r2'
  System::Call 'user32::GetSystemMetrics(i 1) i .r3'
  ${If} $2 == 1024
  ${AndIf} $3 == 600
    ${NSD_Check} $ejRoleCar
    ${NSD_CreateLabel} 8u 70u 100% 12u "A 1024 x 600 screen was found, so Car cluster is suggested."
    Pop $0
  ${Else}
    ${NSD_Check} $1
  ${EndIf}
  nsDialogs::Show
FunctionEnd
Function ejRoleLeave
  ${NSD_GetState} $ejRoleCar $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $ejRole "car"
  ${Else}
    StrCpy $ejRole "laptop"
  ${EndIf}
FunctionEnd
!macro customInstall
  ${If} $ejRole != ""
    FileOpen $0 "$INSTDIR\ejstudio-role.txt" w
    FileWrite $0 $ejRole
    FileClose $0
  ${EndIf}
!macroend
