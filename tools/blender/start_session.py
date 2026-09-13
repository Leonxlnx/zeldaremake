"""Run with Blender --python to enable the installed local MCP addon."""
import bpy
import addon_utils
import sys

sys.stdout.reconfigure(line_buffering=True)
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
