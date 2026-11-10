; ejStudio installer: dark pages matching the app (sidebar and header art in build/*.bmp).
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

; Finish page: same as electron-builder's, plus a light "Run ejStudio" label (Windows themes ignore
; text colours on checkboxes, so the theme is switched off for that one control).
!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW ejFinishShow
  !insertmacro MUI_PAGE_FINISH
  Function ejFinishShow
    !ifndef HIDE_RUN_AFTER_FINISH
      System::Call 'uxtheme::SetWindowTheme(p $mui.FinishPage.Run, w " ", w " ")'
      SetCtlColors $mui.FinishPage.Run 0xE8E8EA 0x0B0B0E
    !endif
  FunctionEnd
!macroend
