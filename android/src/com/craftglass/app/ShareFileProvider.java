package com.craftglass.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.Locale;

/**
 * Minimal dependency-free ContentProvider for sharing exported PNG Proof Cards and WebM timelapses
 * stored strictly under getCacheDir()/shared/.
 */
public final class ShareFileProvider extends ContentProvider {
    public static final String AUTHORITY = "com.craftglass.app.share";

    @Override
    public boolean onCreate() {
        return true;
    }

    private File resolveTarget(Uri uri) throws FileNotFoundException {
        if (getContext() == null || uri == null) {
            throw new FileNotFoundException("Invalid context or URI");
        }
        String rel = uri.getPath();
        if (rel == null) throw new FileNotFoundException("Missing path");
        String fileName = new File(rel).getName();
        File sharedDir = new File(getContext().getCacheDir(), "shared");
        File target = new File(sharedDir, fileName);
        if (!target.exists() || !target.isFile()) {
            throw new FileNotFoundException("Shared file not found: " + fileName);
        }
        return target;
    }

    @Override
    public String getType(Uri uri) {
        String name = uri != null && uri.getLastPathSegment() != null
                ? uri.getLastPathSegment().toLowerCase(Locale.ROOT)
                : "";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".webm")) return "video/webm";
        if (name.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) {
            throw new SecurityException("Read-only provider");
        }
        File file = resolveTarget(uri);
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        try {
            File file = resolveTarget(uri);
            String[] cols = projection != null ? projection : new String[]{
                    OpenableColumns.DISPLAY_NAME,
                    OpenableColumns.SIZE
            };
            MatrixCursor cursor = new MatrixCursor(cols, 1);
            Object[] row = new Object[cols.length];
            for (int i = 0; i < cols.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) {
                    row[i] = file.getName();
                } else if (OpenableColumns.SIZE.equals(cols[i])) {
                    row[i] = file.length();
                }
            }
            cursor.addRow(row);
            return cursor;
        } catch (FileNotFoundException e) {
            return new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, 0);
        }
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read-only provider");
    }
}
