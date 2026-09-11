package com.weadk.state;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

public final class StateDtos {

    private StateDtos() {}

    @Schema(
            name = "WorkspaceStateSnapshot",
            description = "Everything the caller can see, as one map. Read once when the workspace "
                    + "loads, because the code that consumes it reads synchronously.")
    public record Snapshot(
            @Schema(description = "Key to the exact string that was stored.") Map<String, String> entries,
            @Schema(description = "Keys that belong to this viewer rather than the team.")
                    List<String> personalKeys) {}

    @Schema(
            name = "WorkspaceStateWrite",
            description = "One key to write, or to delete when `value` is null.")
    public record Write(
            @NotBlank @Size(max = 400) String key,
            @Schema(description = "The string to store. Null deletes the key.")
                    @Size(max = 8_000_000)
                    String value) {}

    @Schema(
            name = "WorkspaceStatePatch",
            description = "A batch of writes, applied together. The browser batches its changes and "
                    + "sends them as one request rather than one per key.")
    public record Patch(@Valid @NotNull @Size(max = 500) List<Write> entries) {}

    @Schema(name = "WorkspaceStateResult")
    public record Result(int written, int deleted, List<String> rejected) {}
}
