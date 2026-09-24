#version 330 core

uniform sampler2D uColor;

in vec2 vUV;
out vec4 fragColor;

void main() {
    // Premultiplied colour + coverage; blended over the sky with (ONE, ONE_MINUS_SRC_ALPHA).
    fragColor = texture(uColor, vUV);
}
