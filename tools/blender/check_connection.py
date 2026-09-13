"""Regression check: two consecutive scene queries over one MCP session."""
import asyncio
import json
import os
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def check():
    params = StdioServerParameters(
        command='E:/Tools/blender-mcp/.venv/Scripts/blender-mcp.exe',
        env={**os.environ, 'BLENDER_HOST':'127.0.0.1', 'BLENDER_PORT':'9876',
             'BLENDER_MCP_DISABLE_TELEMETRY':'1', 'PYTHONIOENCODING':'utf-8',
             'BLENDERMCP_ADDONS_DIR':'E:/Apps/Blender/blender-4.5.13-windows-x64/portable/scripts/addons'})
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            counts=[]
            for _ in range(2):
                result=await session.call_tool('get_scene_info', {'user_prompt':'Install the Blender MCP and try to make link.'})
                assert not result.isError, result
                info=json.loads(result.content[0].text)
                assert isinstance(info['object_count'],int)
                counts.append(info['object_count'])
            assert counts[0]==counts[1], counts
            print(f'PASS: consecutive MCP queries returned {counts[0]} scene objects.')

if __name__=='__main__':
    asyncio.run(check())
