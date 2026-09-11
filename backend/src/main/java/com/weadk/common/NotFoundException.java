package com.weadk.common;

/** Asked for something by id that is not there. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String what, String id) {
        super(what + " " + id + " not found");
    }
}
