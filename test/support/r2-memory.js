// An in-memory R2 bucket with the slice of the R2 binding API the store uses:
// head(), get() and put(). `ops` records every call, so tests can assert that
// an idempotent upload didn't write twice.

import { createHash } from "node:crypto";

function toBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (typeof value === "string") return new TextEncoder().encode(value);
  throw new TypeError("r2-memory: unsupported put() value");
}

export function createR2() {
  const objects = new Map();
  const ops = [];

  const meta = (key, o) => ({
    key,
    size: o.bytes.byteLength,
    etag: o.etag,
    httpEtag: `"${o.etag}"`,
    httpMetadata: { ...o.httpMetadata },
    uploaded: o.uploaded
  });

  return {
    objects,
    ops,
    async head(key) {
      ops.push(["head", key]);
      const o = objects.get(key);
      return o ? meta(key, o) : null;
    },
    async get(key) {
      ops.push(["get", key]);
      const o = objects.get(key);
      if (!o) return null;
      return {
        ...meta(key, o),
        body: new Blob([o.bytes]).stream(),
        async arrayBuffer() { return o.bytes.slice().buffer; }
      };
    },
    async put(key, value, options = {}) {
      ops.push(["put", key]);
      const bytes = toBytes(value);
      const o = {
        bytes,
        etag: createHash("md5").update(bytes).digest("hex"),
        httpMetadata: options.httpMetadata || {},
        uploaded: new Date()
      };
      objects.set(key, o);
      return meta(key, o);
    }
  };
}
