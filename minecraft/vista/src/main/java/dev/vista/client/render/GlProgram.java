package dev.vista.client.render;

import org.lwjgl.opengl.GL20C;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** Minimal GLSL program wrapper with cached uniform locations. */
final class GlProgram implements AutoCloseable {
    final int id;
    private final Map<String, Integer> uniforms = new HashMap<>();

    GlProgram(String vertexResource, String fragmentResource, String... defines) {
        int vs = compile(GL20C.GL_VERTEX_SHADER, withDefines(read(vertexResource), defines), vertexResource);
        int fs = compile(GL20C.GL_FRAGMENT_SHADER, withDefines(read(fragmentResource), defines), fragmentResource);
        id = GL20C.glCreateProgram();
        GL20C.glAttachShader(id, vs);
        GL20C.glAttachShader(id, fs);
        GL20C.glLinkProgram(id);
        GL20C.glDeleteShader(vs);
        GL20C.glDeleteShader(fs);
        if (GL20C.glGetProgrami(id, GL20C.GL_LINK_STATUS) == 0) {
            String log = GL20C.glGetProgramInfoLog(id);
            GL20C.glDeleteProgram(id);
            throw new IllegalStateException("Vista shader link failed: " + log);
        }
    }

    private static String withDefines(String src, String... defines) {
        if (defines.length == 0) return src;
        int eol = src.indexOf('\n');
        StringBuilder sb = new StringBuilder(src.substring(0, eol + 1));
        for (String d : defines) sb.append("#define ").append(d).append('\n');
        return sb.append(src.substring(eol + 1)).toString();
    }

    private static String read(String path) {
        try (InputStream in = GlProgram.class.getResourceAsStream("/assets/vista/shaders/" + path)) {
            if (in == null) throw new IllegalStateException("missing shader " + path);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static int compile(int type, String src, String name) {
        int s = GL20C.glCreateShader(type);
        GL20C.glShaderSource(s, src);
        GL20C.glCompileShader(s);
        if (GL20C.glGetShaderi(s, GL20C.GL_COMPILE_STATUS) == 0) {
            String log = GL20C.glGetShaderInfoLog(s);
            GL20C.glDeleteShader(s);
            throw new IllegalStateException("Vista shader " + name + " failed to compile: " + log);
        }
        return s;
    }

    int uniform(String name) {
        return uniforms.computeIfAbsent(name, n -> GL20C.glGetUniformLocation(id, n));
    }

    @Override
    public void close() {
        GL20C.glDeleteProgram(id);
    }
}
