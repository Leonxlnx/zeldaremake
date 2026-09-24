#version 430 core

// One quad = 2 uints (see MeshData). Vertices are generated from gl_VertexID; no vertex buffers.
layout(std430, binding = 0) readonly buffer Quads { uvec2 quads[]; };

struct StateInfo {
    vec4 uv[3];     // atlas rect per face class (0 bottom, 1 top, 2 side)
    uvec4 color;    // average RGBA8 per face class, w = light emission
    uvec4 tint;     // per face class: type << 24 | constant RGB; w = flags
};
layout(std430, binding = 1) readonly buffer States { StateInfo states[]; };
layout(std430, binding = 2) readonly buffer Biomes { uvec4 biomes[]; }; // grass, foliage, water RGB

layout(location = 0) in vec4 aOrigin; // camera-relative section origin (blocks), voxel size in blocks
layout(location = 1) in vec4 aParams; // fade progress, fade mode (0 none, 1 in, 2 out), level, translucent

uniform mat4 uViewProj;
uniform vec3 uCamFrac;

out vec3 vRel;
out vec2 vUV;
flat out vec4 vSprite;
flat out vec4 vAvg;
flat out vec3 vTint;
flat out vec2 vLight;
flat out float vShade;
flat out vec2 vFade;
flat out float vScale;
flat out float vLevel;

const float SHADE[6] = float[](0.5, 1.0, 0.8, 0.8, 0.6, 0.6);
const vec2 CORNERS[6] = vec2[](vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 0), vec2(1, 1), vec2(0, 1));
const vec2 CORNERS_FLIP[6] = vec2[](vec2(0, 0), vec2(1, 1), vec2(1, 0), vec2(0, 0), vec2(0, 1), vec2(1, 1));

vec3 rgb(uint c) {
    return vec3(float((c >> 16) & 255u), float((c >> 8) & 255u), float(c & 255u)) / 255.0;
}

void main() {
    uint vid = uint(gl_VertexID);
    uvec2 q = quads[vid / 6u];
    uint corner = vid % 6u;
    uint w0 = q.x;
    vec3 p = vec3(float(w0 & 31u), float((w0 >> 5) & 31u), float((w0 >> 10) & 31u));
    float w = float(((w0 >> 15) & 31u) + 1u);
    float h = float(((w0 >> 20) & 31u) + 1u);
    uint dir = (w0 >> 25) & 7u;

    // Triangle corners in (u, v); the winding is flipped for faces whose (U x V) opposes the normal.
    bool flip = dir == 1u || dir == 2u || dir == 5u;
    vec2 c = flip ? CORNERS_FLIP[corner] : CORNERS[corner];

    vec3 U, V, off;
    if (dir < 2u) { U = vec3(1, 0, 0); V = vec3(0, 0, 1); off = vec3(0, float(dir), 0); }
    else if (dir < 4u) { U = vec3(1, 0, 0); V = vec3(0, 1, 0); off = vec3(0, 0, float(dir - 2u)); }
    else { U = vec3(0, 0, 1); V = vec3(0, 1, 0); off = vec3(float(dir - 4u), 0, 0); }

    float scale = aOrigin.w;
    vec3 local = p + off + U * (c.x * w) + V * (c.y * h);
    vec3 rel = aOrigin.xyz + local * scale;
    vRel = rel;
    gl_Position = uViewProj * vec4(rel, 1.0);

    // Block-space texture coordinates (unwrapped, so derivatives stay continuous across blocks).
    vec3 bp = rel + uCamFrac;
    vUV = vec2(dot(bp, U), -dot(bp, V));
    if (dir < 2u) vUV.y = -vUV.y;

    uint state = q.y & 0xFFFFu;
    uint biome = (q.y >> 16) & 0xFFu;
    uint light = q.y >> 24;
    uint fc = dir == 0u ? 0u : dir == 1u ? 1u : 2u;
    StateInfo s = states[state];
    vSprite = s.uv[fc];
    uint col = s.color[fc];
    vAvg = vec4(float(col & 255u), float((col >> 8) & 255u), float((col >> 16) & 255u), float(col >> 24)) / 255.0;
    uint t = s.tint[fc];
    uint tt = t >> 24;
    uvec4 b = biomes[biome];
    vTint = tt == 1u ? rgb(b.x) : tt == 2u ? rgb(b.y) : tt == 3u ? rgb(b.z) : tt == 4u ? rgb(t) : vec3(1.0);
    float emission = float(s.color.w);
    vLight = vec2(max(float(light & 15u), emission), float(light >> 4));
    vShade = SHADE[dir];
    vFade = aParams.xy;
    vScale = scale;
    vLevel = aParams.z;
}
