@ECHO OFF
SET BINDIR=%~dp0
CD /D "%BINDIR%"
"%ProgramFiles%\Java\jre6\bin\java.exe" -Xmx1024M -Xms1024M -jar spigot.jar
PAUSE