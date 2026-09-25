#version 430 core

#ifndef MASKED
// No discard in this variant, so depth can be tested and written before shading: hidden far terrain costs
// no fragment work. Fading nodes and nodes near vanilla chunks use the MASKED variant.
layout(early_fragment_tests) in;
#endif

uniform sampler2D uAtlas;
uniform sampler2D uLightmap;
uniform usampler2D uVanillaMask;  // 256x256 torus of chunks vanilla is drawing
uniform vec4 uFogColor;
uniform vec3 uFog;                // start, end, haze strength
uniform ivec2 uCamChunk;
uniform vec2 uCamChunkOffset;     // camera position within its chunk (xz)
uniform float uVanillaRadius;     // horizontal blocks; beyond this the mask cannot be set
uniform vec2 uAtlasSize;
uniform int uTextures;
uniform float uAlpha;             // 1 for the opaque pass; <0 means "use the state's alpha" (translucent)
uniform int uDebug;               // 1 LOD level (translucent magenta), 2 light (R sky, G block), 3 tint, 4 ids

in vec3 vRel;
in vec2 vUV;
flat in vec4 vSprite;
flat in vec4 vAvg;
flat in vec3 vTint;
flat in vec2 vLight;
flat in float vShade;
flat in vec2 vFade;
flat in float vScale;
flat in float vLevel;
flat in vec3 vIds;

out vec4 fragColor;

// Interleaved gradient noise: a stable, well-distributed per-pixel threshold for the LOD cross-fade.
float ign(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
    float hd = length(vRel.xz);
#ifdef MASKED
    if (vFade.y > 0.5) {
        float n = ign(gl_FragCoord.xy);
        if (vFade.y < 1.5) { if (n >= vFade.x) discard; }
        else if (n < vFade.x) discard;
    }
    if (hd < uVanillaRadius) {
        ivec2 ch = uCamChunk + ivec2(floor((vRel.xz + uCamChunkOffset) / 16.0));
        if (texelFetch(uVanillaMask, ch & 255, 0).r != 0u) discard;
    }
#endif

    vec3 avg = vAvg.rgb;
    vec3 base = avg;
    if (uTextures != 0 && vScale <= 4.0) {
        vec2 spriteTexels = (vSprite.zw - vSprite.xy) * uAtlasSize;
        vec2 t = vUV * spriteTexels;
        vec2 dx = dFdx(t), dy = dFdy(t);
        float lod = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-8));
        float k = smoothstep(2.5, 4.0, lod);
        if (k < 1.0) {
            vec2 uv = mix(vSprite.xy, vSprite.zw, fract(vUV));
            vec4 tex = textureGrad(uAtlas, uv, dx / uAtlasSize, dy / uAtlasSize);
            vec3 texel = mix(avg, tex.rgb / max(tex.a, 1e-3), smoothstep(0.3, 0.6, tex.a));
            base = mix(texel, avg, k);
        }
    }

    vec2 lmUV = clamp(vLight * 16.0 / 256.0, vec2(0.5 / 16.0), vec2(15.5 / 16.0));
    vec3 lit = base * vTint * vShade * texture(uLightmap, lmUV).rgb;

    // Vanilla's cylindrical linear fog, plus aerial haze that grows with the square of distance so the
    // far field recedes smoothly into the horizon colour instead of ending at a visible ring.
    float d = max(hd, abs(vRel.y));
    float fog = d <= uFog.x ? 0.0 : d < uFog.y ? smoothstep(uFog.x, uFog.y, d) : 1.0;
    float r = d / uFog.y;
    float haze = uFog.z * (1.0 - exp(-r * r * 4.0));
    float f = clamp(max(fog, haze), 0.0, 1.0) * uFogColor.a;
    vec3 color = mix(lit, uFogColor.rgb, f);
    if (uDebug == 1 && uAlpha < 0.0) {
        color = vec3(1.0, 0.0, 1.0);
    } else if (uDebug == 1) {
        const vec3 LEVEL[8] = vec3[](vec3(1, 0.15, 0.1), vec3(1, 0.85, 0.1), vec3(0.2, 0.9, 0.2), vec3(0.1, 0.9, 0.9),
                                     vec3(0.15, 0.3, 1), vec3(0.95, 0.95, 0.95), vec3(0.5, 0.5, 0.5), vec3(0.1, 0.1, 0.1));
        vec3 lc = LEVEL[min(int(vLevel + 0.5), 7)];
        color = mix(base * vShade, lc, 0.65);
    } else if (uDebug == 3) {
        color = vTint;
    } else if (uDebug == 4) {
        color = vIds;
    } else if (uDebug == 2) {
        color = vec3(vLight.y, vLight.x, 0.0) / 15.0 * vShade;
    }

    float alpha = uAlpha < 0.0 ? max(vAvg.a, 0.55) : uAlpha;
    fragColor = vec4(color * alpha, alpha);
}
