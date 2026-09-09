package com.weadk.common;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Stored and serialised as the exact strings the workspace already uses.
 *
 * <p>Java would spell these SCREEN and PC; the database check constraints and
 * the TypeScript unions spell them in lower case. Rather than translate at
 * three boundaries and get one of them wrong, the wire value is carried on the
 * constant and used by both Jackson and JPA.
 */
public enum TaskSource {
    MEETING("meeting"),
    FEEDBACK("feedback"),
    SUGGESTION("suggestion");

    private final String value;

    TaskSource(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static TaskSource from(String raw) {
        for (TaskSource candidate : values()) {
            if (candidate.value.equalsIgnoreCase(raw)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("Unknown TaskSource: " + raw);
    }

    @Converter(autoApply = true)
    public static class JpaConverter implements AttributeConverter<TaskSource, String> {
        @Override
        public String convertToDatabaseColumn(TaskSource attribute) {
            return attribute == null ? null : attribute.value;
        }

        @Override
        public TaskSource convertToEntityAttribute(String dbData) {
            return dbData == null ? null : from(dbData);
        }
    }
}
