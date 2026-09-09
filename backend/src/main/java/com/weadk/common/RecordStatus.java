package com.weadk.common;

/**
 * The one flag that separates a row that is still here from one that has been deleted.
 *
 * <p>Delete does not remove rows anywhere in this service: it writes {@link #DELETED}
 * and every read asks for {@link #ACTIVE}. Constants rather than an enum because the
 * column is an integer the workspace reads directly, and an enum would put a name in
 * the database where a 1 and a 0 are what was asked for.
 */
public final class RecordStatus {

    /** Live: the row is part of the workspace and every read returns it. */
    public static final int ACTIVE = 1;

    /** Deleted: the row is kept, and no read returns it. */
    public static final int DELETED = 0;

    private RecordStatus() {}
}
