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

; Always install for the current user only (no "all users" page). The app then lives under
; %LOCALAPPDATA%\Programs\ejStudio and USB updates can install silently without admin rights.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
