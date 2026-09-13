"""Call the installed Blender MCP through its standard stdio transport.

python tools/blender/mcp_call.py [--script path.py | --tool name --args '{...}']
Uses this bridge in sessions whose native tool catalog predates MCP registration.
"""
import argparse
import asyncio
import base64
import json
import os
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', default='E:/Tools/blender-mcp/.venv/Scripts/blender-mcp.exe')
    parser.add_argument('--script', type=Path)
    parser.add_argument('--tool', default='get_scene_info')
    parser.add_argument('--args', default='{}')
    parser.add_argument('--output', type=Path, help='Save an image tool result to this file')
    parser.add_argument('--prompt', default='Install the Blender MCP and try to make link.')
    args = parser.parse_args()
    params = StdioServerParameters(command=args.server, env={
        **os.environ, 'BLENDER_HOST': '127.0.0.1', 'BLENDER_PORT': '9876',
        'BLENDER_MCP_DISABLE_TELEMETRY': '1', 'PYTHONIOENCODING': 'utf-8',
        'BLENDERMCP_ADDONS_DIR': 'E:/Apps/Blender/blender-4.5.13-windows-x64/portable/scripts/addons',
    })
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            if args.tool == 'list':
                result = await session.list_tools()
            else:
                name = 'execute_blender_code' if args.script else args.tool
                payload = {'code': f'__file__ = {str(args.script.resolve())!r}\n' + args.script.read_text(encoding='utf-8')} if args.script else json.loads(args.args)
                payload.setdefault('user_prompt', args.prompt)
                result = await session.call_tool(name, payload)
            if args.output:
                picture = next(c for c in result.content if c.type == 'image')
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_bytes(base64.b64decode(picture.data))
                print(f'Saved {args.output}')
            else:
                print(result.model_dump_json(indent=2))
            failed_text = any(c.type == 'text' and c.text.lower().startswith(('error', 'failed to '))
                              for c in getattr(result, 'content', []))
            if getattr(result, 'isError', False) or failed_text:
                raise RuntimeError('Blender MCP tool failed; see the response above.')


if __name__ == '__main__':
    asyncio.run(main())
