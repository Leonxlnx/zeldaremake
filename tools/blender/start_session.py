"""Run with Blender --python to enable the installed local MCP addon."""
import bpy
import addon_utils
import sys

sys.stdout.reconfigure(line_buffering=True)
# This is the hidden MCP worker. Its unused viewport can redraw stale evaluated
# objects after a source rebuild; keep the event loop without rendering that view.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.type = 'CONSOLE'
assert all(area.type != 'VIEW_3D' for screen in bpy.data.screens for area in screen.areas)
if not addon_utils.check('blender_mcp')[1]:
    addon_utils.enable('blender_mcp', default_set=True, persistent=True)
prefs = bpy.context.preferences.addons['blender_mcp'].preferences
prefs.telemetry_consent = False
bpy.context.scene.blendermcp_port = 9876
bpy.context.scene.blendermcp_auto_start_server = True
bpy.ops.wm.save_userpref()
if not getattr(bpy.types, 'blendermcp_server', None):
    bpy.ops.blendermcp.start_server()
print('ASTRA_BLENDER_MCP_READY', bpy.app.version_string)
