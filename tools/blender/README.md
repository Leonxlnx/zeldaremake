# Local Blender and MCP

Installed on the owner's Windows PC, 2026-09-13:

- Blender **4.5.13 LTS**, `E:/Apps/Blender/blender-4.5.13-windows-x64/`.
- Start-menu shortcut: **Blender 4.5 LTS**. Open it manually when you want the visible editor.
- Portable settings/addon under that installation's `portable/` directory.
- Blender MCP **1.9.1**, `E:/Tools/blender-mcp/.venv/`.
- Original upstream source: `E:/Tools/blender-mcp/source/`.
- Upstream commit: `5f8ddaf6e987c4aa0c3467fcc548838b28f64477`.
- uv **0.12.13**, `E:/Tools/uv/`; existing Python 3.11.15 reused.
- Codex global MCP name: `blender`. Localhost only, port 9876. Telemetry disabled.

Blender archive SHA256: `b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6`.
Verified against the Blender project's published checksums before extraction.

Sources: [Blender releases](https://download.blender.org/release/Blender4.5/),
[Blender MCP](https://github.com/ahujasid/blender-mcp),
[Codex MCP configuration](https://developers.openai.com/codex/mcp/).

## Work without taking the mouse

Blender's GUI process must be running for this addon's command queue. It can remain hidden;
modelling and renders in this task were sent through MCP. There is no mouse/keyboard
automation in this workflow. Renders use four CPU threads so other laptop work has room.

If Blender is closed, start it from PowerShell (the paths below are specific to this PC):

```powershell
$blenderSession = Start-Process -FilePath 'E:\Apps\Blender\blender-4.5.13-windows-x64\blender.exe' -ArgumentList 'E:\zeldaremake\art\characters\link\link-study.blend','--python','E:\zeldaremake\tools\blender\start_session.py' -WindowStyle Hidden -PassThru
$blenderSession.PriorityClass = 'BelowNormal'
```

After restarting Codex, the registered server can appear in its native tool catalog. This
session predates registration, so `mcp_call.py` uses the official MCP SDK and standard stdio
transport to the same installed server. It does not emulate MCP or use screen control.

```powershell
& 'E:\Tools\blender-mcp\.venv\Scripts\python.exe' tools/blender/check_connection.py
& 'E:\Tools\blender-mcp\.venv\Scripts\python.exe' tools/blender/mcp_call.py --script art/characters/link/build_link.py
1..6 | ForEach-Object {
  & 'E:\Tools\blender-mcp\.venv\Scripts\python.exe' tools/blender/mcp_call.py --script art/characters/link/render_review.py
  if ($LASTEXITCODE -ne 0) { throw 'Render failed' }
}
& 'E:\Tools\blender-mcp\.venv\Scripts\python.exe' tools/blender/mcp_call.py --script art/characters/link/export_check.py
```

`build_link.py` rebuilds only its own named Blender scene; it replaces the current
`link-study.blend`. Save manual edits under another name before rebuilding. Renders always
create a new dated directory. The `.blend` keeps separate editable parts and materials.
Each render call handles one view to stay below the addon socket timeout; the next call
resumes the matching incomplete checkpoint. Six calls produce body, face and boot views.

## Local compatibility repair

On this PC, the first request on a persistent addon socket returned correctly; subsequent
requests executed inside Blender but their responses never reached the waiting client.
A fresh socket returned the same scene query successfully. `windows-socket.patch` closes
the socket after each decoded response; the stdio MCP session and request lock stay intact.
This is a measured compatibility workaround, not a proven diagnosis of the underlying
Windows/addon issue. It affects only the installed server's transport, not modelling code.

Upstream server backup: `E:/Tools/blender-mcp/server.upstream.py`. A server upgrade can
overwrite the local patch; run `check_connection.py` afterward. The check makes two
consecutive scene queries in one MCP session and fails on missing/malformed responses.

The addon's install command copied the file successfully but failed printing a Unicode
arrow under Windows cp1252. `PYTHONIOENCODING=utf-8` is persisted in the MCP configuration.
The installed addon matches the downloaded upstream addon bytes.
