package com.weadk.common;

/** The request is well formed but the state will not have it. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
