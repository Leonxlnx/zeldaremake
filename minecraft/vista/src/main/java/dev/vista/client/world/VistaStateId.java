package dev.vista.client.world;

/** Duck interface mixed into {@code BlockStateBase}; ids are valid only for the session epoch that set them. */
public interface VistaStateId {
    int vista$getId(int epoch);

    void vista$setId(int epoch, int id);
}
