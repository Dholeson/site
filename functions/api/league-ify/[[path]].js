var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@anthropic-ai/sdk/internal/errors.mjs
function isAbortError(err) {
  return typeof err === "object" && err !== null && // Spec-compliant fetch implementations
  ("name" in err && err.name === "AbortError" || // Expo fetch
  "message" in err && String(err.message).includes("FetchRequestCanceledException"));
}
var castToError;
var init_errors = __esm({
  "node_modules/@anthropic-ai/sdk/internal/errors.mjs"() {
    castToError = (err) => {
      if (err instanceof Error)
        return err;
      if (typeof err === "object" && err !== null) {
        try {
          if (Object.prototype.toString.call(err) === "[object Error]") {
            const error = new Error(err.message, err.cause ? { cause: err.cause } : {});
            if (err.stack)
              error.stack = err.stack;
            if (err.cause && !error.cause)
              error.cause = err.cause;
            if (err.name)
              error.name = err.name;
            return error;
          }
        } catch {
        }
        try {
          return new Error(JSON.stringify(err));
        } catch {
        }
      }
      return new Error(err);
    };
  }
});

// node_modules/@anthropic-ai/sdk/core/error.mjs
var AnthropicError, APIError, APIUserAbortError, APIConnectionError, APIConnectionTimeoutError, RetryableError, BadRequestError, AuthenticationError, PermissionDeniedError, NotFoundError, ConflictError, UnprocessableEntityError, RateLimitError, InternalServerError;
var init_error = __esm({
  "node_modules/@anthropic-ai/sdk/core/error.mjs"() {
    init_errors();
    AnthropicError = class extends Error {
    };
    APIError = class _APIError extends AnthropicError {
      constructor(status, error, message, headers, type) {
        super(`${_APIError.makeMessage(status, error, message)}`);
        this.status = status;
        this.headers = headers;
        this.requestID = headers?.get("request-id");
        this.error = error;
        this.type = type ?? null;
      }
      static makeMessage(status, error, message) {
        const msg = error?.message ? typeof error.message === "string" ? error.message : JSON.stringify(error.message) : error ? JSON.stringify(error) : message;
        if (status && msg) {
          return `${status} ${msg}`;
        }
        if (status) {
          return `${status} status code (no body)`;
        }
        if (msg) {
          return msg;
        }
        return "(no status code or body)";
      }
      static generate(status, errorResponse, message, headers) {
        if (!status || !headers) {
          return new APIConnectionError({ message, cause: castToError(errorResponse) });
        }
        const error = errorResponse;
        const type = error?.["error"]?.["type"];
        if (status === 400) {
          return new BadRequestError(status, error, message, headers, type);
        }
        if (status === 401) {
          return new AuthenticationError(status, error, message, headers, type);
        }
        if (status === 403) {
          return new PermissionDeniedError(status, error, message, headers, type);
        }
        if (status === 404) {
          return new NotFoundError(status, error, message, headers, type);
        }
        if (status === 409) {
          return new ConflictError(status, error, message, headers, type);
        }
        if (status === 422) {
          return new UnprocessableEntityError(status, error, message, headers, type);
        }
        if (status === 429) {
          return new RateLimitError(status, error, message, headers, type);
        }
        if (status >= 500) {
          return new InternalServerError(status, error, message, headers, type);
        }
        return new _APIError(status, error, message, headers, type);
      }
    };
    APIUserAbortError = class extends APIError {
      constructor({ message } = {}) {
        super(void 0, void 0, message || "Request was aborted.", void 0);
      }
    };
    APIConnectionError = class extends APIError {
      constructor({ message, cause }) {
        super(void 0, void 0, message || "Connection error.", void 0);
        if (cause)
          this.cause = cause;
      }
    };
    APIConnectionTimeoutError = class extends APIConnectionError {
      constructor({ message } = {}) {
        super({ message: message ?? "Request timed out." });
      }
    };
    RetryableError = class extends AnthropicError {
      constructor(message, { cause } = {}) {
        super(message ?? "Retryable error.");
        if (cause !== void 0)
          this.cause = cause;
      }
    };
    BadRequestError = class extends APIError {
    };
    AuthenticationError = class extends APIError {
    };
    PermissionDeniedError = class extends APIError {
    };
    NotFoundError = class extends APIError {
    };
    ConflictError = class extends APIError {
    };
    UnprocessableEntityError = class extends APIError {
    };
    RateLimitError = class extends APIError {
    };
    InternalServerError = class extends APIError {
    };
  }
});

// node_modules/standardwebhooks/dist/timing_safe_equal.js
var require_timing_safe_equal = __commonJS({
  "node_modules/standardwebhooks/dist/timing_safe_equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.timingSafeEqual = void 0;
    function assert(expr, msg = "") {
      if (!expr) {
        throw new Error(msg);
      }
    }
    function timingSafeEqual(a, b) {
      if (a.byteLength !== b.byteLength) {
        return false;
      }
      if (!(a instanceof DataView)) {
        a = new DataView(ArrayBuffer.isView(a) ? a.buffer : a);
      }
      if (!(b instanceof DataView)) {
        b = new DataView(ArrayBuffer.isView(b) ? b.buffer : b);
      }
      assert(a instanceof DataView);
      assert(b instanceof DataView);
      const length = a.byteLength;
      let out = 0;
      let i = -1;
      while (++i < length) {
        out |= a.getUint8(i) ^ b.getUint8(i);
      }
      return out === 0;
    }
    exports.timingSafeEqual = timingSafeEqual;
  }
});

// node_modules/@stablelib/base64/lib/base64.js
var require_base64 = __commonJS({
  "node_modules/@stablelib/base64/lib/base64.js"(exports) {
    "use strict";
    var __extends = exports && exports.__extends || /* @__PURE__ */ (function() {
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (b2.hasOwnProperty(p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      return function(d, b) {
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    var INVALID_BYTE = 256;
    var Coder = (
      /** @class */
      (function() {
        function Coder2(_paddingCharacter) {
          if (_paddingCharacter === void 0) {
            _paddingCharacter = "=";
          }
          this._paddingCharacter = _paddingCharacter;
        }
        Coder2.prototype.encodedLength = function(length) {
          if (!this._paddingCharacter) {
            return (length * 8 + 5) / 6 | 0;
          }
          return (length + 2) / 3 * 4 | 0;
        };
        Coder2.prototype.encode = function(data) {
          var out = "";
          var i = 0;
          for (; i < data.length - 2; i += 3) {
            var c = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
            out += this._encodeByte(c >>> 3 * 6 & 63);
            out += this._encodeByte(c >>> 2 * 6 & 63);
            out += this._encodeByte(c >>> 1 * 6 & 63);
            out += this._encodeByte(c >>> 0 * 6 & 63);
          }
          var left = data.length - i;
          if (left > 0) {
            var c = data[i] << 16 | (left === 2 ? data[i + 1] << 8 : 0);
            out += this._encodeByte(c >>> 3 * 6 & 63);
            out += this._encodeByte(c >>> 2 * 6 & 63);
            if (left === 2) {
              out += this._encodeByte(c >>> 1 * 6 & 63);
            } else {
              out += this._paddingCharacter || "";
            }
            out += this._paddingCharacter || "";
          }
          return out;
        };
        Coder2.prototype.maxDecodedLength = function(length) {
          if (!this._paddingCharacter) {
            return (length * 6 + 7) / 8 | 0;
          }
          return length / 4 * 3 | 0;
        };
        Coder2.prototype.decodedLength = function(s) {
          return this.maxDecodedLength(s.length - this._getPaddingLength(s));
        };
        Coder2.prototype.decode = function(s) {
          if (s.length === 0) {
            return new Uint8Array(0);
          }
          var paddingLength = this._getPaddingLength(s);
          var length = s.length - paddingLength;
          var out = new Uint8Array(this.maxDecodedLength(length));
          var op = 0;
          var i = 0;
          var haveBad = 0;
          var v0 = 0, v1 = 0, v2 = 0, v3 = 0;
          for (; i < length - 4; i += 4) {
            v0 = this._decodeChar(s.charCodeAt(i + 0));
            v1 = this._decodeChar(s.charCodeAt(i + 1));
            v2 = this._decodeChar(s.charCodeAt(i + 2));
            v3 = this._decodeChar(s.charCodeAt(i + 3));
            out[op++] = v0 << 2 | v1 >>> 4;
            out[op++] = v1 << 4 | v2 >>> 2;
            out[op++] = v2 << 6 | v3;
            haveBad |= v0 & INVALID_BYTE;
            haveBad |= v1 & INVALID_BYTE;
            haveBad |= v2 & INVALID_BYTE;
            haveBad |= v3 & INVALID_BYTE;
          }
          if (i < length - 1) {
            v0 = this._decodeChar(s.charCodeAt(i));
            v1 = this._decodeChar(s.charCodeAt(i + 1));
            out[op++] = v0 << 2 | v1 >>> 4;
            haveBad |= v0 & INVALID_BYTE;
            haveBad |= v1 & INVALID_BYTE;
          }
          if (i < length - 2) {
            v2 = this._decodeChar(s.charCodeAt(i + 2));
            out[op++] = v1 << 4 | v2 >>> 2;
            haveBad |= v2 & INVALID_BYTE;
          }
          if (i < length - 3) {
            v3 = this._decodeChar(s.charCodeAt(i + 3));
            out[op++] = v2 << 6 | v3;
            haveBad |= v3 & INVALID_BYTE;
          }
          if (haveBad !== 0) {
            throw new Error("Base64Coder: incorrect characters for decoding");
          }
          return out;
        };
        Coder2.prototype._encodeByte = function(b) {
          var result = b;
          result += 65;
          result += 25 - b >>> 8 & 0 - 65 - 26 + 97;
          result += 51 - b >>> 8 & 26 - 97 - 52 + 48;
          result += 61 - b >>> 8 & 52 - 48 - 62 + 43;
          result += 62 - b >>> 8 & 62 - 43 - 63 + 47;
          return String.fromCharCode(result);
        };
        Coder2.prototype._decodeChar = function(c) {
          var result = INVALID_BYTE;
          result += (42 - c & c - 44) >>> 8 & -INVALID_BYTE + c - 43 + 62;
          result += (46 - c & c - 48) >>> 8 & -INVALID_BYTE + c - 47 + 63;
          result += (47 - c & c - 58) >>> 8 & -INVALID_BYTE + c - 48 + 52;
          result += (64 - c & c - 91) >>> 8 & -INVALID_BYTE + c - 65 + 0;
          result += (96 - c & c - 123) >>> 8 & -INVALID_BYTE + c - 97 + 26;
          return result;
        };
        Coder2.prototype._getPaddingLength = function(s) {
          var paddingLength = 0;
          if (this._paddingCharacter) {
            for (var i = s.length - 1; i >= 0; i--) {
              if (s[i] !== this._paddingCharacter) {
                break;
              }
              paddingLength++;
            }
            if (s.length < 4 || paddingLength > 2) {
              throw new Error("Base64Coder: incorrect padding");
            }
          }
          return paddingLength;
        };
        return Coder2;
      })()
    );
    exports.Coder = Coder;
    var stdCoder = new Coder();
    function encode2(data) {
      return stdCoder.encode(data);
    }
    exports.encode = encode2;
    function decode(s) {
      return stdCoder.decode(s);
    }
    exports.decode = decode;
    var URLSafeCoder = (
      /** @class */
      (function(_super) {
        __extends(URLSafeCoder2, _super);
        function URLSafeCoder2() {
          return _super !== null && _super.apply(this, arguments) || this;
        }
        URLSafeCoder2.prototype._encodeByte = function(b) {
          var result = b;
          result += 65;
          result += 25 - b >>> 8 & 0 - 65 - 26 + 97;
          result += 51 - b >>> 8 & 26 - 97 - 52 + 48;
          result += 61 - b >>> 8 & 52 - 48 - 62 + 45;
          result += 62 - b >>> 8 & 62 - 45 - 63 + 95;
          return String.fromCharCode(result);
        };
        URLSafeCoder2.prototype._decodeChar = function(c) {
          var result = INVALID_BYTE;
          result += (44 - c & c - 46) >>> 8 & -INVALID_BYTE + c - 45 + 62;
          result += (94 - c & c - 96) >>> 8 & -INVALID_BYTE + c - 95 + 63;
          result += (47 - c & c - 58) >>> 8 & -INVALID_BYTE + c - 48 + 52;
          result += (64 - c & c - 91) >>> 8 & -INVALID_BYTE + c - 65 + 0;
          result += (96 - c & c - 123) >>> 8 & -INVALID_BYTE + c - 97 + 26;
          return result;
        };
        return URLSafeCoder2;
      })(Coder)
    );
    exports.URLSafeCoder = URLSafeCoder;
    var urlSafeCoder = new URLSafeCoder();
    function encodeURLSafe(data) {
      return urlSafeCoder.encode(data);
    }
    exports.encodeURLSafe = encodeURLSafe;
    function decodeURLSafe(s) {
      return urlSafeCoder.decode(s);
    }
    exports.decodeURLSafe = decodeURLSafe;
    exports.encodedLength = function(length) {
      return stdCoder.encodedLength(length);
    };
    exports.maxDecodedLength = function(length) {
      return stdCoder.maxDecodedLength(length);
    };
    exports.decodedLength = function(s) {
      return stdCoder.decodedLength(s);
    };
  }
});

// node_modules/fast-sha256/sha256.js
var require_sha256 = __commonJS({
  "node_modules/fast-sha256/sha256.js"(exports, module) {
    (function(root, factory) {
      var exports2 = {};
      factory(exports2);
      var sha256 = exports2["default"];
      for (var k in exports2) {
        sha256[k] = exports2[k];
      }
      if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = sha256;
      } else if (typeof define === "function" && define.amd) {
        define(function() {
          return sha256;
        });
      } else {
        root.sha256 = sha256;
      }
    })(exports, function(exports2) {
      "use strict";
      exports2.__esModule = true;
      exports2.digestLength = 32;
      exports2.blockSize = 64;
      var K = new Uint32Array([
        1116352408,
        1899447441,
        3049323471,
        3921009573,
        961987163,
        1508970993,
        2453635748,
        2870763221,
        3624381080,
        310598401,
        607225278,
        1426881987,
        1925078388,
        2162078206,
        2614888103,
        3248222580,
        3835390401,
        4022224774,
        264347078,
        604807628,
        770255983,
        1249150122,
        1555081692,
        1996064986,
        2554220882,
        2821834349,
        2952996808,
        3210313671,
        3336571891,
        3584528711,
        113926993,
        338241895,
        666307205,
        773529912,
        1294757372,
        1396182291,
        1695183700,
        1986661051,
        2177026350,
        2456956037,
        2730485921,
        2820302411,
        3259730800,
        3345764771,
        3516065817,
        3600352804,
        4094571909,
        275423344,
        430227734,
        506948616,
        659060556,
        883997877,
        958139571,
        1322822218,
        1537002063,
        1747873779,
        1955562222,
        2024104815,
        2227730452,
        2361852424,
        2428436474,
        2756734187,
        3204031479,
        3329325298
      ]);
      function hashBlocks(w2, v, p, pos, len) {
        var a, b, c, d, e, f, g, h, u, i, j, t1, t2;
        while (len >= 64) {
          a = v[0];
          b = v[1];
          c = v[2];
          d = v[3];
          e = v[4];
          f = v[5];
          g = v[6];
          h = v[7];
          for (i = 0; i < 16; i++) {
            j = pos + i * 4;
            w2[i] = (p[j] & 255) << 24 | (p[j + 1] & 255) << 16 | (p[j + 2] & 255) << 8 | p[j + 3] & 255;
          }
          for (i = 16; i < 64; i++) {
            u = w2[i - 2];
            t1 = (u >>> 17 | u << 32 - 17) ^ (u >>> 19 | u << 32 - 19) ^ u >>> 10;
            u = w2[i - 15];
            t2 = (u >>> 7 | u << 32 - 7) ^ (u >>> 18 | u << 32 - 18) ^ u >>> 3;
            w2[i] = (t1 + w2[i - 7] | 0) + (t2 + w2[i - 16] | 0);
          }
          for (i = 0; i < 64; i++) {
            t1 = (((e >>> 6 | e << 32 - 6) ^ (e >>> 11 | e << 32 - 11) ^ (e >>> 25 | e << 32 - 25)) + (e & f ^ ~e & g) | 0) + (h + (K[i] + w2[i] | 0) | 0) | 0;
            t2 = ((a >>> 2 | a << 32 - 2) ^ (a >>> 13 | a << 32 - 13) ^ (a >>> 22 | a << 32 - 22)) + (a & b ^ a & c ^ b & c) | 0;
            h = g;
            g = f;
            f = e;
            e = d + t1 | 0;
            d = c;
            c = b;
            b = a;
            a = t1 + t2 | 0;
          }
          v[0] += a;
          v[1] += b;
          v[2] += c;
          v[3] += d;
          v[4] += e;
          v[5] += f;
          v[6] += g;
          v[7] += h;
          pos += 64;
          len -= 64;
        }
        return pos;
      }
      var Hash = (
        /** @class */
        (function() {
          function Hash2() {
            this.digestLength = exports2.digestLength;
            this.blockSize = exports2.blockSize;
            this.state = new Int32Array(8);
            this.temp = new Int32Array(64);
            this.buffer = new Uint8Array(128);
            this.bufferLength = 0;
            this.bytesHashed = 0;
            this.finished = false;
            this.reset();
          }
          Hash2.prototype.reset = function() {
            this.state[0] = 1779033703;
            this.state[1] = 3144134277;
            this.state[2] = 1013904242;
            this.state[3] = 2773480762;
            this.state[4] = 1359893119;
            this.state[5] = 2600822924;
            this.state[6] = 528734635;
            this.state[7] = 1541459225;
            this.bufferLength = 0;
            this.bytesHashed = 0;
            this.finished = false;
            return this;
          };
          Hash2.prototype.clean = function() {
            for (var i = 0; i < this.buffer.length; i++) {
              this.buffer[i] = 0;
            }
            for (var i = 0; i < this.temp.length; i++) {
              this.temp[i] = 0;
            }
            this.reset();
          };
          Hash2.prototype.update = function(data, dataLength) {
            if (dataLength === void 0) {
              dataLength = data.length;
            }
            if (this.finished) {
              throw new Error("SHA256: can't update because hash was finished.");
            }
            var dataPos = 0;
            this.bytesHashed += dataLength;
            if (this.bufferLength > 0) {
              while (this.bufferLength < 64 && dataLength > 0) {
                this.buffer[this.bufferLength++] = data[dataPos++];
                dataLength--;
              }
              if (this.bufferLength === 64) {
                hashBlocks(this.temp, this.state, this.buffer, 0, 64);
                this.bufferLength = 0;
              }
            }
            if (dataLength >= 64) {
              dataPos = hashBlocks(this.temp, this.state, data, dataPos, dataLength);
              dataLength %= 64;
            }
            while (dataLength > 0) {
              this.buffer[this.bufferLength++] = data[dataPos++];
              dataLength--;
            }
            return this;
          };
          Hash2.prototype.finish = function(out) {
            if (!this.finished) {
              var bytesHashed = this.bytesHashed;
              var left = this.bufferLength;
              var bitLenHi = bytesHashed / 536870912 | 0;
              var bitLenLo = bytesHashed << 3;
              var padLength = bytesHashed % 64 < 56 ? 64 : 128;
              this.buffer[left] = 128;
              for (var i = left + 1; i < padLength - 8; i++) {
                this.buffer[i] = 0;
              }
              this.buffer[padLength - 8] = bitLenHi >>> 24 & 255;
              this.buffer[padLength - 7] = bitLenHi >>> 16 & 255;
              this.buffer[padLength - 6] = bitLenHi >>> 8 & 255;
              this.buffer[padLength - 5] = bitLenHi >>> 0 & 255;
              this.buffer[padLength - 4] = bitLenLo >>> 24 & 255;
              this.buffer[padLength - 3] = bitLenLo >>> 16 & 255;
              this.buffer[padLength - 2] = bitLenLo >>> 8 & 255;
              this.buffer[padLength - 1] = bitLenLo >>> 0 & 255;
              hashBlocks(this.temp, this.state, this.buffer, 0, padLength);
              this.finished = true;
            }
            for (var i = 0; i < 8; i++) {
              out[i * 4 + 0] = this.state[i] >>> 24 & 255;
              out[i * 4 + 1] = this.state[i] >>> 16 & 255;
              out[i * 4 + 2] = this.state[i] >>> 8 & 255;
              out[i * 4 + 3] = this.state[i] >>> 0 & 255;
            }
            return this;
          };
          Hash2.prototype.digest = function() {
            var out = new Uint8Array(this.digestLength);
            this.finish(out);
            return out;
          };
          Hash2.prototype._saveState = function(out) {
            for (var i = 0; i < this.state.length; i++) {
              out[i] = this.state[i];
            }
          };
          Hash2.prototype._restoreState = function(from, bytesHashed) {
            for (var i = 0; i < this.state.length; i++) {
              this.state[i] = from[i];
            }
            this.bytesHashed = bytesHashed;
            this.finished = false;
            this.bufferLength = 0;
          };
          return Hash2;
        })()
      );
      exports2.Hash = Hash;
      var HMAC = (
        /** @class */
        (function() {
          function HMAC2(key) {
            this.inner = new Hash();
            this.outer = new Hash();
            this.blockSize = this.inner.blockSize;
            this.digestLength = this.inner.digestLength;
            var pad = new Uint8Array(this.blockSize);
            if (key.length > this.blockSize) {
              new Hash().update(key).finish(pad).clean();
            } else {
              for (var i = 0; i < key.length; i++) {
                pad[i] = key[i];
              }
            }
            for (var i = 0; i < pad.length; i++) {
              pad[i] ^= 54;
            }
            this.inner.update(pad);
            for (var i = 0; i < pad.length; i++) {
              pad[i] ^= 54 ^ 92;
            }
            this.outer.update(pad);
            this.istate = new Uint32Array(8);
            this.ostate = new Uint32Array(8);
            this.inner._saveState(this.istate);
            this.outer._saveState(this.ostate);
            for (var i = 0; i < pad.length; i++) {
              pad[i] = 0;
            }
          }
          HMAC2.prototype.reset = function() {
            this.inner._restoreState(this.istate, this.inner.blockSize);
            this.outer._restoreState(this.ostate, this.outer.blockSize);
            return this;
          };
          HMAC2.prototype.clean = function() {
            for (var i = 0; i < this.istate.length; i++) {
              this.ostate[i] = this.istate[i] = 0;
            }
            this.inner.clean();
            this.outer.clean();
          };
          HMAC2.prototype.update = function(data) {
            this.inner.update(data);
            return this;
          };
          HMAC2.prototype.finish = function(out) {
            if (this.outer.finished) {
              this.outer.finish(out);
            } else {
              this.inner.finish(out);
              this.outer.update(out, this.digestLength).finish(out);
            }
            return this;
          };
          HMAC2.prototype.digest = function() {
            var out = new Uint8Array(this.digestLength);
            this.finish(out);
            return out;
          };
          return HMAC2;
        })()
      );
      exports2.HMAC = HMAC;
      function hash(data) {
        var h = new Hash().update(data);
        var digest = h.digest();
        h.clean();
        return digest;
      }
      exports2.hash = hash;
      exports2["default"] = hash;
      function hmac(key, data) {
        var h = new HMAC(key).update(data);
        var digest = h.digest();
        h.clean();
        return digest;
      }
      exports2.hmac = hmac;
      function fillBuffer(buffer, hmac2, info, counter) {
        var num = counter[0];
        if (num === 0) {
          throw new Error("hkdf: cannot expand more");
        }
        hmac2.reset();
        if (num > 1) {
          hmac2.update(buffer);
        }
        if (info) {
          hmac2.update(info);
        }
        hmac2.update(counter);
        hmac2.finish(buffer);
        counter[0]++;
      }
      var hkdfSalt = new Uint8Array(exports2.digestLength);
      function hkdf(key, salt, info, length) {
        if (salt === void 0) {
          salt = hkdfSalt;
        }
        if (length === void 0) {
          length = 32;
        }
        var counter = new Uint8Array([1]);
        var okm = hmac(salt, key);
        var hmac_ = new HMAC(okm);
        var buffer = new Uint8Array(hmac_.digestLength);
        var bufpos = buffer.length;
        var out = new Uint8Array(length);
        for (var i = 0; i < length; i++) {
          if (bufpos === buffer.length) {
            fillBuffer(buffer, hmac_, info, counter);
            bufpos = 0;
          }
          out[i] = buffer[bufpos++];
        }
        hmac_.clean();
        buffer.fill(0);
        counter.fill(0);
        return out;
      }
      exports2.hkdf = hkdf;
      function pbkdf2(password, salt, iterations, dkLen) {
        var prf = new HMAC(password);
        var len = prf.digestLength;
        var ctr = new Uint8Array(4);
        var t = new Uint8Array(len);
        var u = new Uint8Array(len);
        var dk = new Uint8Array(dkLen);
        for (var i = 0; i * len < dkLen; i++) {
          var c = i + 1;
          ctr[0] = c >>> 24 & 255;
          ctr[1] = c >>> 16 & 255;
          ctr[2] = c >>> 8 & 255;
          ctr[3] = c >>> 0 & 255;
          prf.reset();
          prf.update(salt);
          prf.update(ctr);
          prf.finish(u);
          for (var j = 0; j < len; j++) {
            t[j] = u[j];
          }
          for (var j = 2; j <= iterations; j++) {
            prf.reset();
            prf.update(u).finish(u);
            for (var k = 0; k < len; k++) {
              t[k] ^= u[k];
            }
          }
          for (var j = 0; j < len && i * len + j < dkLen; j++) {
            dk[i * len + j] = t[j];
          }
        }
        for (var i = 0; i < len; i++) {
          t[i] = u[i] = 0;
        }
        for (var i = 0; i < 4; i++) {
          ctr[i] = 0;
        }
        prf.clean();
        return dk;
      }
      exports2.pbkdf2 = pbkdf2;
    });
  }
});

// node_modules/standardwebhooks/dist/index.js
var require_dist = __commonJS({
  "node_modules/standardwebhooks/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Webhook = exports.WebhookVerificationError = void 0;
    var timing_safe_equal_1 = require_timing_safe_equal();
    var base64 = require_base64();
    var sha256 = require_sha256();
    var WEBHOOK_TOLERANCE_IN_SECONDS = 5 * 60;
    var ExtendableError = class _ExtendableError extends Error {
      constructor(message) {
        super(message);
        Object.setPrototypeOf(this, _ExtendableError.prototype);
        this.name = "ExtendableError";
        this.stack = new Error(message).stack;
      }
    };
    var WebhookVerificationError = class _WebhookVerificationError extends ExtendableError {
      constructor(message) {
        super(message);
        Object.setPrototypeOf(this, _WebhookVerificationError.prototype);
        this.name = "WebhookVerificationError";
      }
    };
    exports.WebhookVerificationError = WebhookVerificationError;
    var Webhook2 = class _Webhook {
      constructor(secret, options) {
        if (!secret) {
          throw new Error("Secret can't be empty.");
        }
        if ((options === null || options === void 0 ? void 0 : options.format) === "raw") {
          if (secret instanceof Uint8Array) {
            this.key = secret;
          } else {
            this.key = Uint8Array.from(secret, (c) => c.charCodeAt(0));
          }
        } else {
          if (typeof secret !== "string") {
            throw new Error("Expected secret to be of type string");
          }
          if (secret.startsWith(_Webhook.prefix)) {
            secret = secret.substring(_Webhook.prefix.length);
          }
          this.key = base64.decode(secret);
        }
      }
      verify(payload, headers_) {
        const headers = {};
        for (const key of Object.keys(headers_)) {
          headers[key.toLowerCase()] = headers_[key];
        }
        const msgId = headers["webhook-id"];
        const msgSignature = headers["webhook-signature"];
        const msgTimestamp = headers["webhook-timestamp"];
        if (!msgSignature || !msgId || !msgTimestamp) {
          throw new WebhookVerificationError("Missing required headers");
        }
        const timestamp = this.verifyTimestamp(msgTimestamp);
        const computedSignature = this.sign(msgId, timestamp, payload);
        const expectedSignature = computedSignature.split(",")[1];
        const passedSignatures = msgSignature.split(" ");
        const encoder2 = new globalThis.TextEncoder();
        for (const versionedSignature of passedSignatures) {
          const [version, signature2] = versionedSignature.split(",");
          if (version !== "v1") {
            continue;
          }
          if ((0, timing_safe_equal_1.timingSafeEqual)(encoder2.encode(signature2), encoder2.encode(expectedSignature))) {
            return JSON.parse(payload.toString());
          }
        }
        throw new WebhookVerificationError("No matching signature found");
      }
      sign(msgId, timestamp, payload) {
        if (typeof payload === "string") {
        } else if (payload.constructor.name === "Buffer") {
          payload = payload.toString();
        } else {
          throw new Error("Expected payload to be of type string or Buffer.");
        }
        const encoder2 = new TextEncoder();
        const timestampNumber = Math.floor(timestamp.getTime() / 1e3);
        const toSign = encoder2.encode(`${msgId}.${timestampNumber}.${payload}`);
        const expectedSignature = base64.encode(sha256.hmac(this.key, toSign));
        return `v1,${expectedSignature}`;
      }
      verifyTimestamp(timestampHeader) {
        const now3 = Math.floor(Date.now() / 1e3);
        const timestamp = parseInt(timestampHeader, 10);
        if (isNaN(timestamp)) {
          throw new WebhookVerificationError("Invalid Signature Headers");
        }
        if (now3 - timestamp > WEBHOOK_TOLERANCE_IN_SECONDS) {
          throw new WebhookVerificationError("Message timestamp too old");
        }
        if (timestamp > now3 + WEBHOOK_TOLERANCE_IN_SECONDS) {
          throw new WebhookVerificationError("Message timestamp too new");
        }
        return new Date(timestamp * 1e3);
      }
    };
    exports.Webhook = Webhook2;
    Webhook2.prefix = "whsec_";
  }
});

// node_modules/@anthropic-ai/sdk/tools/agent-toolset/node.browser.mjs
var node_browser_exports = {};
__export(node_browser_exports, {
  BashSession: () => BashSession,
  betaAgentToolset20260401: () => betaAgentToolset20260401,
  betaBashTool: () => betaBashTool,
  betaEditTool: () => betaEditTool,
  betaGlobTool: () => betaGlobTool,
  betaGrepTool: () => betaGrepTool,
  betaReadTool: () => betaReadTool,
  betaWriteTool: () => betaWriteTool,
  extractSkillArchive: () => extractSkillArchive,
  resolvePath: () => resolvePath,
  resolveSkillVersion: () => resolveSkillVersion,
  setupSkills: () => setupSkills
});
function nodeOnly(name) {
  throw new AnthropicError(`${name} requires Node.js or a Node-compatible runtime`);
}
function setupSkills(_ctx) {
  return nodeOnly("setupSkills");
}
function resolveSkillVersion(_client, _skillId, _version) {
  return nodeOnly("resolveSkillVersion");
}
function extractSkillArchive(_resp, _dest) {
  return nodeOnly("extractSkillArchive");
}
function betaAgentToolset20260401(_ctx) {
  return nodeOnly("betaAgentToolset20260401");
}
function resolvePath(_ctx, _p) {
  return nodeOnly("resolvePath");
}
function betaBashTool(_ctx) {
  return nodeOnly("betaBashTool");
}
function betaReadTool(_ctx) {
  return nodeOnly("betaReadTool");
}
function betaWriteTool(_ctx) {
  return nodeOnly("betaWriteTool");
}
function betaEditTool(_ctx) {
  return nodeOnly("betaEditTool");
}
function betaGlobTool(_ctx) {
  return nodeOnly("betaGlobTool");
}
function betaGrepTool(_ctx) {
  return nodeOnly("betaGrepTool");
}
var BashSession;
var init_node_browser = __esm({
  "node_modules/@anthropic-ai/sdk/tools/agent-toolset/node.browser.mjs"() {
    init_error();
    BashSession = class {
      constructor(_dir, _env) {
        nodeOnly("BashSession");
      }
      get closed() {
        return nodeOnly("BashSession");
      }
      exec(_command, _opts = {}) {
        return nodeOnly("BashSession");
      }
      close() {
        nodeOnly("BashSession");
      }
    };
  }
});

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item2 of items) {
      obj[item2] = item2;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item2 of arr) {
      if (checker(item2))
        return item2;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path: path2, errorMaps, issueData } = params;
  const fullPath = [...path2, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path2, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path2;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def8) {
    this.spa = this.safeParseAsync;
    this._def = def8;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def8) {
    const defaultValueFunc = typeof def8 === "function" ? def8 : () => def8;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def8) {
    const catchValueFunc = typeof def8 === "function" ? def8 : () => def8;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max2 = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max2 === null || ch.value < max2)
          max2 = ch.value;
      }
    }
    return max2;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max2 = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max2 === null || ch.value < max2)
          max2 = ch.value;
      }
    }
    return max2;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max2 = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max2 === null || ch.value < max2)
          max2 = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max2);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max2 = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max2 === null || ch.value < max2)
          max2 = ch.value;
      }
    }
    return max2;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max2 = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max2 === null || ch.value < max2)
          max2 = ch.value;
      }
    }
    return max2 != null ? new Date(max2) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def8 = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def8.exactLength !== null) {
      const tooBig = ctx.data.length > def8.exactLength.value;
      const tooSmall = ctx.data.length < def8.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def8.exactLength.value : void 0,
          maximum: tooBig ? def8.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def8.exactLength.message
        });
        status.dirty();
      }
    }
    if (def8.minLength !== null) {
      if (ctx.data.length < def8.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def8.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def8.minLength.message
        });
        status.dirty();
      }
    }
    if (def8.maxLength !== null) {
      if (ctx.data.length > def8.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def8.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def8.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item2, i) => {
        return def8.type._parseAsync(new ParseInputLazyPath(ctx, item2, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item2, i) => {
      return def8.type._parseSync(new ParseInputLazyPath(ctx, item2, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item2) => deepPartialify(item2)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item2, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item2, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def8 = this._def;
    if (def8.minSize !== null) {
      if (ctx.data.size < def8.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def8.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def8.minSize.message
        });
        status.dirty();
      }
    }
    if (def8.maxSize !== null) {
      if (ctx.data.size > def8.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def8.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def8.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item2, i) => valueType._parse(new ParseInputLazyPath(ctx, item2, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// server/storage/index.ts
import { AsyncLocalStorage } from "node:async_hooks";

// server/storage/fsStore.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
var __dirname = dirname(fileURLToPath("file:///worker.mjs"));
var DEFAULT_DATA_DIR = resolve(__dirname, "..", "..", "data");
function fileFor(dataDir, key) {
  switch (key) {
    case "live":
      return resolve(dataDir, "league-ify.json");
    case "demo":
      return resolve(dataDir, "league-ify.demo.json");
    case "profile":
      return resolve(dataDir, "league-ify.profile.json");
    case "meta":
      return resolve(dataDir, "league-ify.meta.json");
    default: {
      if (!key.startsWith("profiles/")) throw new Error(`unknown document key: ${key}`);
      const name = key.slice("profiles/".length);
      if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error(`unsafe profile key: ${name}`);
      return resolve(dataDir, "profiles", `${name}.json`);
    }
  }
}
function ensureDirFor(file) {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
function createFsStore(dataDir = DEFAULT_DATA_DIR) {
  const fileFor_ = (key) => fileFor(dataDir, key);
  return {
    read(key) {
      const file = fileFor_(key);
      if (!existsSync(file)) return null;
      try {
        return JSON.parse(readFileSync(file, "utf8"));
      } catch {
        return null;
      }
    },
    write(key, value) {
      const file = fileFor_(key);
      ensureDirFor(file);
      writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
    },
    exists(key) {
      return existsSync(fileFor_(key));
    },
    async hydrate() {
    },
    async flush() {
    },
    hydratedKeys() {
      const keys = [];
      for (const k of ["live", "demo", "profile", "meta"]) {
        if (existsSync(fileFor_(k))) keys.push(k);
      }
      return keys;
    }
  };
}

// server/storage/d1Store.ts
function createD1Store(db, tenant) {
  const prefix = tenant ? tenant.replace(/\/+$/, "") + "/" : "";
  const physical = (key) => prefix + key;
  const snapshots = /* @__PURE__ */ new Map();
  const staged = /* @__PURE__ */ new Map();
  function requireHydrated(key) {
    const snap = snapshots.get(key);
    if (!snap) {
      throw new Error(
        `document "${key}" was read before hydrate(). Add it to the hydrate() key set.`
      );
    }
    return snap;
  }
  function currentDoc(key) {
    if (staged.has(key)) return staged.get(key);
    const snap = requireHydrated(key);
    if (!snap.existed || !snap.body) return null;
    if (snap.matches.size === 0) return { ...snap.body };
    const matches = [...snap.matches.values()].map((m) => JSON.parse(m));
    return { ...snap.body, matches };
  }
  return {
    read(key) {
      return currentDoc(key);
    },
    write(key, value) {
      requireHydrated(key);
      staged.set(key, value ?? {});
    },
    exists(key) {
      if (staged.has(key)) return true;
      return requireHydrated(key).existed;
    },
    async hydrate(keys) {
      const wanted = keys ?? await allKeys(db, prefix);
      for (const key of wanted) {
        if (snapshots.has(key)) continue;
        const row = await db.prepare("SELECT body FROM documents WHERE doc_key = ?").bind(physical(key)).first();
        const matchRows = await db.prepare("SELECT match_id, body FROM matches WHERE doc_key = ? ORDER BY ord").bind(physical(key)).all();
        const matches = /* @__PURE__ */ new Map();
        const order = /* @__PURE__ */ new Map();
        matchRows.results.forEach((r, i) => {
          matches.set(r.match_id, r.body);
          order.set(r.match_id, i);
        });
        let body = null;
        if (row) {
          try {
            body = JSON.parse(row.body);
          } catch {
            body = null;
          }
        }
        snapshots.set(key, { body, matches, order, existed: row != null });
      }
    },
    async flush() {
      const statements = [];
      const now3 = Math.floor(Date.now() / 1e3);
      for (const [key, doc] of staged) {
        const snap = snapshots.get(key);
        const { matches: incomingMatches, ...withoutMatches } = doc;
        const rest = Array.isArray(incomingMatches) && incomingMatches.length === 0 ? { ...withoutMatches, matches: [] } : withoutMatches;
        const bodyText = JSON.stringify(rest);
        if (!snap.existed || JSON.stringify(snap.body ?? {}) !== bodyText) {
          statements.push(
            db.prepare(
              `INSERT INTO documents (doc_key, body, updated_at) VALUES (?, ?, ?)
               ON CONFLICT(doc_key) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`
            ).bind(physical(key), bodyText, now3)
          );
        }
        const incoming = /* @__PURE__ */ new Map();
        for (const m of incomingMatches ?? []) {
          if (!m || typeof m.id !== "string") continue;
          incoming.set(m.id, JSON.stringify(m));
        }
        let ord = 0;
        for (const [id, text] of incoming) {
          const position = ord++;
          if (snap.matches.get(id) === text && snap.order.get(id) === position) continue;
          statements.push(
            db.prepare(
              `INSERT INTO matches (doc_key, match_id, ord, body, updated_at) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(doc_key, match_id) DO UPDATE SET
                 ord = excluded.ord, body = excluded.body, updated_at = excluded.updated_at`
            ).bind(physical(key), id, position, text, now3)
          );
        }
        for (const id of snap.matches.keys()) {
          if (incoming.has(id)) continue;
          statements.push(
            db.prepare("DELETE FROM matches WHERE doc_key = ? AND match_id = ?").bind(physical(key), id)
          );
        }
        snap.body = rest;
        snap.matches = incoming;
        snap.order = new Map([...incoming.keys()].map((id, i) => [id, i]));
        snap.existed = true;
      }
      if (statements.length) await db.batch(statements);
      staged.clear();
    },
    hydratedKeys() {
      return [...snapshots.keys()];
    }
  };
}
async function allKeys(db, prefix) {
  const rows = await db.prepare("SELECT doc_key FROM documents").all();
  return rows.results.map((r) => r.doc_key).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}

// server/storage/contract.ts
function profileDocKey(key) {
  return `profiles/${key}`;
}

// server/storage/index.ts
var active = null;
var requestStore = new AsyncLocalStorage();
function runWithDocumentStore(store2, fn) {
  return requestStore.run(store2, fn);
}
function docs() {
  const scoped2 = requestStore.getStore();
  if (scoped2) return scoped2;
  if (!active) active = createFsStore();
  return active;
}

// server/activeProfile.ts
import { AsyncLocalStorage as AsyncLocalStorage2 } from "node:async_hooks";
var SEASON_WINDOW_DAYS = 150;
var seasonCutoffMs = () => Date.now() - SEASON_WINDOW_DAYS * 864e5;
var SELF_PROFILE = {
  isSelf: true,
  key: null,
  gameName: null,
  tagLine: null,
  platform: null
};
var als = new AsyncLocalStorage2();
function runWithProfile(p, fn) {
  return als.run(p, fn);
}
function activeProfile() {
  return als.getStore() ?? SELF_PROFILE;
}
function fileKey(gameName, tagLine, platform) {
  return `${gameName}-${tagLine}-${platform}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}
function parseProfileHeader(header) {
  if (!header) return SELF_PROFILE;
  const parts = header.split("|");
  if (parts.length < 3) return SELF_PROFILE;
  try {
    const gameName = decodeURIComponent(parts[0]).trim();
    const tagLine = decodeURIComponent(parts[1]).trim();
    const platform = decodeURIComponent(parts[2]).trim();
    if (!gameName || !tagLine || !platform) return SELF_PROFILE;
    return { isSelf: false, key: fileKey(gameName, tagLine, platform), gameName, tagLine, platform };
  } catch {
    return SELF_PROFILE;
  }
}

// server/store.ts
function derivePool(matches, manual) {
  const MIN_GAMES2 = 3;
  const byChamp = /* @__PURE__ */ new Map();
  for (const m of matches) {
    const c = m.objective.champion;
    if (!c) continue;
    const e = byChamp.get(c) ?? { roles: /* @__PURE__ */ new Map(), total: 0 };
    e.total++;
    const r = m.objective.role;
    if (r && r !== "UNKNOWN") e.roles.set(r, (e.roles.get(r) ?? 0) + 1);
    byChamp.set(c, e);
  }
  const manualByKey = new Map(manual.map((e) => [e.champion.toLowerCase(), e]));
  const out = [];
  for (const [champion, e] of byChamp) {
    const man = manualByKey.get(champion.toLowerCase());
    if (e.total < MIN_GAMES2 && !man) continue;
    const dominant = [...e.roles.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const tier = man?.tier ?? (e.total >= 15 ? "main" : e.total >= 6 ? "secondary" : "lab");
    out.push({ champion, tier, roles: man?.roles ?? (dominant ? [dominant] : void 0) });
  }
  for (const man of manual) {
    if (!byChamp.has(man.champion) && !out.some((o) => o.champion.toLowerCase() === man.champion.toLowerCase())) out.push(man);
  }
  return out.sort((a, b) => (b.tier === "main" ? 1 : 0) - (a.tier === "main" ? 1 : 0));
}
var DEFAULT_TUNING = {
  verdictGood: 65,
  verdictBad: 45,
  benchmarks: {
    cs10: 70,
    gold15: 250,
    deaths15: 2,
    deaths: 5,
    kp: 55,
    objectives: 5,
    vision: 1,
    tilt: 70,
    flame: 100,
    process: 65,
    first_dead_fights: 30,
    deaths_before_objective: 0.5
  }
};
var LIVE_KEY = "live";
var DEMO_KEY = "demo";
var PROFILE_KEY = "profile";
var META_KEY = "meta";
var DEFAULT_PROFILE = {
  mainRole: null,
  primaryRole: null,
  secondaryRole: null,
  championPool: [],
  favorites: [],
  preferredRank: null,
  updatedAt: null
};
var favKey = (g, t) => `${g}#${t}`.toLowerCase();
var DEFAULT_DB = {
  version: 1,
  seasons: [],
  matches: [],
  goals: [],
  notifications: [],
  settings: {
    activeSeasonId: null,
    sessionGapMinutes: 180,
    lastLp: null,
    lastTier: null,
    lastDivision: null,
    rollingQuestState: {},
    tuning: DEFAULT_TUNING,
    coachPlan: null,
    lastSyncAt: null,
    notifSeen: null
  }
};
var DEFAULT_META = {
  demoMode: false
};
var cachesByStore = /* @__PURE__ */ new WeakMap();
function docCaches() {
  const store2 = docs();
  let c = cachesByStore.get(store2);
  if (!c) {
    c = { live: null, demo: null, profile: null, meta: null, profileDbs: /* @__PURE__ */ new Map() };
    cachesByStore.set(store2, c);
  }
  return c;
}
function readJson(key) {
  return docs().read(key);
}
function persistJson(key, data) {
  docs().write(key, data);
}
function docExists(key) {
  return docs().exists(key);
}
function hydrateDb(parsed) {
  return {
    ...structuredClone(DEFAULT_DB),
    ...parsed,
    settings: {
      ...DEFAULT_DB.settings,
      ...parsed?.settings,
      tuning: {
        ...DEFAULT_TUNING,
        ...parsed?.settings?.tuning,
        benchmarks: {
          ...DEFAULT_TUNING.benchmarks,
          ...parsed?.settings?.tuning?.benchmarks
        }
      }
    }
  };
}
function loadMeta() {
  const c = docCaches();
  if (c.meta) return c.meta;
  c.meta = { ...DEFAULT_META, ...readJson(META_KEY) ?? {} };
  persistJson(META_KEY, c.meta);
  return c.meta;
}
function persistMeta() {
  persistJson(META_KEY, docCaches().meta ?? DEFAULT_META);
}
function loadProfile() {
  const c = docCaches();
  if (c.profile) return c.profile;
  const parsed = readJson(PROFILE_KEY);
  if (parsed) {
    c.profile = { ...DEFAULT_PROFILE, ...parsed };
    return c.profile;
  }
  const legacy = readJson(LIVE_KEY);
  c.profile = { ...DEFAULT_PROFILE, ...legacy?.profile ?? {} };
  persistJson(PROFILE_KEY, c.profile);
  return c.profile;
}
function persistProfile() {
  persistJson(PROFILE_KEY, docCaches().profile ?? DEFAULT_PROFILE);
}
function loadDb(kind) {
  const c = docCaches();
  const cached = kind === "live" ? c.live : c.demo;
  if (cached) return cached;
  const key = kind === "live" ? LIVE_KEY : DEMO_KEY;
  const parsed = hydrateDb(readJson(key));
  if (kind === "live") c.live = parsed;
  else c.demo = parsed;
  if (!docExists(key)) persistJson(key, parsed);
  return parsed;
}
function persistDb(kind) {
  const key = kind === "live" ? LIVE_KEY : DEMO_KEY;
  persistJson(key, kind === "live" ? docCaches().live ?? DEFAULT_DB : docCaches().demo ?? DEFAULT_DB);
}
function profileFile(key) {
  return profileDocKey(key);
}
function loadProfileDb(key) {
  const cached = docCaches().profileDbs.get(key);
  if (cached) return cached;
  const parsed = hydrateDb(readJson(profileFile(key)));
  docCaches().profileDbs.set(key, parsed);
  if (!docExists(profileFile(key))) persistJson(profileFile(key), parsed);
  return parsed;
}
function persistProfileDb(key) {
  const db = docCaches().profileDbs.get(key);
  if (!db) return;
  persistJson(profileFile(key), db);
}
function currentKind() {
  return loadMeta().demoMode ? "demo" : "live";
}
function currentDb() {
  const ap = activeProfile();
  if (!ap.isSelf && ap.key) return loadProfileDb(ap.key);
  const kind = currentKind();
  if (kind === "demo" && !docExists(DEMO_KEY)) {
    docCaches().demo = seedDemoDb();
    persistDb("demo");
  }
  return loadDb(kind);
}
function saveCurrent() {
  const ap = activeProfile();
  if (!ap.isSelf && ap.key) {
    persistProfileDb(ap.key);
    return;
  }
  persistDb(currentKind());
}
function isoDaysAgo(days, hour = 19) {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 10, 0, 0);
  return d.toISOString();
}
function baseScorecard(patch) {
  return {
    grade: "B",
    tiltBefore: 1,
    tiltAfter: 1,
    biggestMistake: "",
    firstDeathCause: null,
    bestDecision: "",
    oneAdjustment: "",
    doomedCollapse: false,
    flamed: false,
    mutedAppropriately: true,
    reviewed: true,
    ...patch
  };
}
function baseObjective(patch) {
  return {
    role: "TOP",
    side: "BLUE",
    queue: "RANKED_SOLO_5x5",
    durationSec: 1800,
    kills: 4,
    deaths: 3,
    assists: 7,
    csAt10: 64,
    totalCs: 190,
    goldDiffAt15: 50,
    deathsBefore10: 1,
    deathsBefore15: 2,
    firstDeathSec: 420,
    killParticipation: 0.54,
    visionScore: 23,
    dragons: 2,
    voidgrubs: 2,
    heralds: 1,
    barons: 0,
    towers: 6,
    ...patch
  };
}
function seedDemoDb() {
  const prevSeasonId = globalThis.crypto.randomUUID();
  const activeSeasonId = globalThis.crypto.randomUUID();
  const now3 = (/* @__PURE__ */ new Date()).toISOString();
  const seasons = [
    {
      id: prevSeasonId,
      name: "Patch 14.13: Stop Donating Lane",
      theme: "Play the first 12 minutes like they matter.",
      goal: "Stop losing the game before first Herald.",
      identityId: "stonewall",
      targetGames: 20,
      startedAt: isoDaysAgo(26),
      endedAt: isoDaysAgo(12),
      status: "complete",
      retro: {
        writtenAt: isoDaysAgo(12),
        whatWorked: "Reviewing losses caught the same recall greed pattern fast.",
        whatBroke: "Still over-trading waves I could have let bounce.",
        keepDoing: "Respect jungle timings and mute early.",
        stopDoing: "Blindly contesting every top crab fight.",
        nextBlockFocus: "Turn stable lanes into actual leads instead of just surviving."
      }
    },
    {
      id: activeSeasonId,
      name: "Patch 14.14: Convert the Stable Lane",
      theme: "Stable lanes are only good if they cash out into gold and objectives.",
      goal: "Keep the lane floor while actually building advantages on my comfort picks.",
      identityId: "lane_bully",
      targetGames: 30,
      startedAt: isoDaysAgo(11),
      endedAt: null,
      status: "active",
      retro: null
    }
  ];
  const demos = [
    {
      seasonId: prevSeasonId,
      playedAt: isoDaysAgo(25),
      objective: baseObjective({
        champion: "Malphite",
        opponentChampion: "Renekton",
        win: false,
        lpDelta: -21,
        csAt10: 51,
        goldDiffAt15: -620,
        deaths: 6,
        deathsBefore15: 3,
        firstDeathSec: 240
      }),
      scorecard: baseScorecard({
        grade: "D",
        tiltAfter: 4,
        firstDeathCause: "overextension",
        biggestMistake: "Forced a bad trade on stacked wave.",
        oneAdjustment: "Give up the wave and wait for bounce."
      })
    },
    {
      seasonId: prevSeasonId,
      playedAt: isoDaysAgo(23),
      objective: baseObjective({
        champion: "Ornn",
        opponentChampion: "Aatrox",
        win: true,
        lpDelta: 24,
        csAt10: 61,
        goldDiffAt15: -80,
        deaths: 2,
        deathsBefore15: 1,
        firstDeathSec: 690
      }),
      scorecard: baseScorecard({
        grade: "B",
        bestDecision: "Held TP for dragon instead of ego fight.",
        oneAdjustment: "Use windows after base to drop deeper wards."
      })
    },
    {
      seasonId: prevSeasonId,
      playedAt: isoDaysAgo(21),
      objective: baseObjective({
        champion: "Garen",
        opponentChampion: "Darius",
        win: false,
        lpDelta: -20,
        csAt10: 57,
        goldDiffAt15: -430,
        deaths: 5,
        deathsBefore15: 3,
        firstDeathSec: 300
      }),
      scorecard: baseScorecard({
        grade: "C",
        tiltAfter: 3,
        firstDeathCause: "laning_mistake",
        biggestMistake: "Took a short trade with his cooldowns up.",
        oneAdjustment: "Track his ghost and only trade with wave advantage."
      })
    },
    {
      seasonId: prevSeasonId,
      playedAt: isoDaysAgo(18),
      objective: baseObjective({
        champion: "Ornn",
        opponentChampion: "Jax",
        win: true,
        lpDelta: 23,
        csAt10: 66,
        goldDiffAt15: 130,
        deaths: 2,
        deathsBefore15: 1,
        firstDeathSec: 840
      }),
      scorecard: baseScorecard({
        grade: "A",
        bestDecision: "Synced reset before second drake.",
        oneAdjustment: "Push harder when teleport advantage is up."
      })
    },
    {
      seasonId: activeSeasonId,
      playedAt: isoDaysAgo(10),
      objective: baseObjective({
        champion: "Malphite",
        opponentChampion: "Camille",
        win: true,
        lpDelta: 22,
        csAt10: 68,
        goldDiffAt15: 220,
        deaths: 2,
        deathsBefore15: 1,
        firstDeathSec: 780,
        dragons: 3
      }),
      scorecard: baseScorecard({
        grade: "A",
        bestDecision: "Gave wave to keep health and won the next objective fight.",
        oneAdjustment: "Hold ult for carry flash next time."
      })
    },
    {
      seasonId: activeSeasonId,
      playedAt: isoDaysAgo(9),
      objective: baseObjective({
        champion: "Garen",
        opponentChampion: "K'Sante",
        win: false,
        lpDelta: -19,
        csAt10: 59,
        goldDiffAt15: -140,
        deaths: 4,
        deathsBefore15: 2,
        firstDeathSec: 390
      }),
      scorecard: baseScorecard({
        grade: "C",
        tiltAfter: 2,
        firstDeathCause: "greedy_recall",
        biggestMistake: "One more plate brain before reset.",
        oneAdjustment: "Base on tempo, not desire."
      })
    },
    {
      seasonId: activeSeasonId,
      playedAt: isoDaysAgo(8),
      objective: baseObjective({
        champion: "Malphite",
        opponentChampion: "Jayce",
        win: true,
        lpDelta: 24,
        csAt10: 63,
        goldDiffAt15: 80,
        deaths: 1,
        deathsBefore15: 0,
        firstDeathSec: 1260
      }),
      scorecard: baseScorecard({
        grade: "B",
        bestDecision: "Muted after first spam ping and kept map reads clean.",
        oneAdjustment: "Crash wave earlier before roam timer."
      })
    },
    {
      seasonId: activeSeasonId,
      playedAt: isoDaysAgo(7),
      objective: baseObjective({
        champion: "Renekton",
        opponentChampion: "Sion",
        win: true,
        lpDelta: 23,
        csAt10: 74,
        totalCs: 215,
        goldDiffAt15: 510,
        deaths: 3,
        deathsBefore15: 1,
        firstDeathSec: 810,
        killParticipation: 0.62
      }),
      scorecard: baseScorecard({
        grade: "A",
        bestDecision: "Pressed lead into Herald instead of another solo dive.",
        oneAdjustment: "Convert the second crash into deeper vision."
      })
    },
    {
      seasonId: activeSeasonId,
      playedAt: isoDaysAgo(5),
      objective: baseObjective({
        champion: "Malphite",
        opponentChampion: "Fiora",
        win: false,
        lpDelta: -20,
        csAt10: 54,
        goldDiffAt15: -510,
        deaths: 5,
        deathsBefore15: 3,
        firstDeathSec: 270
      }),
      scorecard: baseScorecard({
        grade: "D",
        tiltAfter: 4,
        firstDeathCause: "mechanical_misplay",
        biggestMistake: "Burned cooldowns before her riposte.",
        oneAdjustment: "Play for wave and jungle, not lane fantasy."
      })
    },
    {
      seasonId: activeSeasonId,
      playedAt: isoDaysAgo(4),
      objective: baseObjective({
        champion: "Ornn",
        opponentChampion: "Rumble",
        win: true,
        lpDelta: 21,
        csAt10: 65,
        goldDiffAt15: 120,
        deaths: 2,
        deathsBefore15: 1,
        firstDeathSec: 780
      }),
      scorecard: baseScorecard({
        grade: "B",
        bestDecision: "Reset for dragon 45 seconds early.",
        oneAdjustment: "Trim wave sooner when his heat is low."
      })
    },
    {
      seasonId: activeSeasonId,
      playedAt: isoDaysAgo(3),
      objective: baseObjective({
        champion: "Renekton",
        opponentChampion: "Aatrox",
        win: true,
        lpDelta: 24,
        csAt10: 77,
        totalCs: 223,
        goldDiffAt15: 640,
        deaths: 2,
        deathsBefore15: 1,
        firstDeathSec: 960,
        killParticipation: 0.65
      }),
      scorecard: baseScorecard({
        grade: "A",
        bestDecision: "Called off a bad Baron flip and took soul point setup instead.",
        oneAdjustment: "Use prio to invade earlier."
      })
    },
    {
      seasonId: activeSeasonId,
      playedAt: isoDaysAgo(2),
      objective: baseObjective({
        champion: "Malphite",
        opponentChampion: "Yone",
        win: false,
        lpDelta: -21,
        csAt10: 58,
        goldDiffAt15: -260,
        deaths: 4,
        deathsBefore15: 2,
        firstDeathSec: 360
      }),
      scorecard: baseScorecard({
        grade: "C",
        tiltAfter: 2,
        firstDeathCause: "objective_setup",
        biggestMistake: "Walked into river late with no vision.",
        oneAdjustment: "Base earlier for objective setup."
      })
    },
    {
      seasonId: activeSeasonId,
      playedAt: isoDaysAgo(1),
      objective: baseObjective({
        champion: "Renekton",
        opponentChampion: "Gragas",
        win: true,
        lpDelta: 25,
        csAt10: 72,
        totalCs: 210,
        goldDiffAt15: 470,
        deaths: 2,
        deathsBefore15: 1,
        firstDeathSec: 870
      }),
      scorecard: baseScorecard({
        grade: "A",
        bestDecision: "Turned lane lead into first two grubs and Herald.",
        oneAdjustment: "Ping roam timing sooner for mid."
      })
    }
  ];
  const matches = demos.map((d, i) => ({
    id: globalThis.crypto.randomUUID(),
    seasonId: d.seasonId,
    playedAt: d.playedAt,
    loggedAt: d.playedAt,
    source: "manual",
    objective: d.objective,
    scorecard: d.scorecard
  }));
  const goals = [
    {
      id: globalThis.crypto.randomUUID(),
      seasonId: activeSeasonId,
      templateId: "gold_diff_15",
      title: "Gold lead at 15",
      description: "Average +250 gold vs your opponent by 15.",
      category: "aggression",
      target: 250,
      unit: "gold@15",
      direction: "higher",
      champion: null,
      createdAt: now3,
      status: "active"
    },
    {
      id: globalThis.crypto.randomUUID(),
      seasonId: activeSeasonId,
      templateId: "deaths_before_15",
      title: "Deaths before 15",
      description: "No more than 2 deaths before 15 minutes, on average.",
      category: "survival",
      target: 2,
      unit: "deaths <15",
      direction: "lower",
      champion: null,
      createdAt: now3,
      status: "active"
    },
    {
      id: globalThis.crypto.randomUUID(),
      seasonId: activeSeasonId,
      templateId: "champion_focus",
      title: "Commit to Renekton",
      description: "Play Renekton at least 10 games this block.",
      category: "champion",
      target: 10,
      unit: "games",
      direction: "higher",
      champion: "Renekton",
      createdAt: now3,
      status: "active"
    }
  ];
  return {
    version: 1,
    seasons,
    matches,
    goals,
    notifications: [],
    settings: {
      activeSeasonId,
      sessionGapMinutes: 180,
      lastLp: 76,
      lastTier: "PLATINUM",
      lastDivision: "IV",
      rollingQuestState: {},
      tuning: DEFAULT_TUNING,
      coachPlan: null,
      lastSyncAt: null,
      notifSeen: null
    }
  };
}
var store = {
  raw: () => currentDb(),
  seasons: () => currentDb().seasons,
  // Data views see the active season span (set per-request); "all-time" opens
  // the full history. Ingest/backfill use allMatches() to bypass the filter.
  matches: () => {
    const cutoff = activeProfile().spanCutoff;
    const all = currentDb().matches;
    if (cutoff == null) return all;
    return all.filter((m) => {
      const t = m.playedAt ? Date.parse(m.playedAt) : NaN;
      return isNaN(t) || t >= cutoff;
    });
  },
  allMatches: () => currentDb().matches,
  settings: () => currentDb().settings,
  demoState() {
    const meta = loadMeta();
    return { enabled: meta.demoMode, available: docExists(DEMO_KEY) };
  },
  setDemoMode(enabled) {
    const meta = loadMeta();
    meta.demoMode = enabled;
    docCaches().meta = meta;
    if (enabled && !docExists(DEMO_KEY)) {
      docCaches().demo = seedDemoDb();
      persistDb("demo");
    }
    persistMeta();
  },
  resetDemo() {
    docCaches().demo = seedDemoDb();
    persistDb("demo");
  },
  activeSeason() {
    const db = currentDb();
    return db.seasons.find((s) => s.id === db.settings.activeSeasonId) ?? null;
  },
  getSeason(id) {
    return currentDb().seasons.find((s) => s.id === id);
  },
  addSeason(season) {
    const db = currentDb();
    db.seasons.push(season);
    db.settings.activeSeasonId = season.id;
    saveCurrent();
  },
  updateSeason(id, patch) {
    const db = currentDb();
    const i = db.seasons.findIndex((s) => s.id === id);
    if (i === -1) return;
    db.seasons[i] = { ...db.seasons[i], ...patch };
    saveCurrent();
  },
  setActiveSeason(id) {
    const db = currentDb();
    db.settings.activeSeasonId = id;
    saveCurrent();
  },
  matchesForSeason(seasonId) {
    return currentDb().matches.filter((m) => m.seasonId === seasonId);
  },
  hasRiotMatch(riotMatchId) {
    return currentDb().matches.some((m) => m.objective.riotMatchId === riotMatchId);
  },
  addMatch(match2) {
    const rid = match2.objective.riotMatchId;
    const db = currentDb();
    if (rid && db.matches.some((m) => m.objective.riotMatchId === rid)) return;
    db.matches.push(match2);
    saveCurrent();
  },
  updateMatch(id, patch) {
    const db = currentDb();
    const i = db.matches.findIndex((m) => m.id === id);
    if (i === -1) return;
    db.matches[i] = { ...db.matches[i], ...patch };
    saveCurrent();
  },
  deleteMatch(id) {
    const db = currentDb();
    db.matches = db.matches.filter((m) => m.id !== id);
    saveCurrent();
  },
  updateSettings(patch) {
    const db = currentDb();
    db.settings = { ...db.settings, ...patch };
    saveCurrent();
  },
  isDemo() {
    return activeProfile().isSelf && loadMeta().demoMode;
  },
  // The champion pool is your personal curation — searched profiles don't have one.
  activePool() {
    const manual = activeProfile().isSelf ? loadProfile().championPool : [];
    return derivePool(currentDb().matches, manual);
  },
  lastSyncAt() {
    return currentDb().settings.lastSyncAt;
  },
  setLastSyncAt(iso) {
    currentDb().settings.lastSyncAt = iso;
    saveCurrent();
  },
  pullPending() {
    return currentDb().settings.pullPending ?? [];
  },
  setPullPending(ids) {
    currentDb().settings.pullPending = ids;
    saveCurrent();
  },
  pullComplete() {
    return currentDb().settings.pullComplete ?? false;
  },
  setPullComplete(done) {
    currentDb().settings.pullComplete = done;
    saveCurrent();
  },
  coachPlan() {
    return currentDb().settings.coachPlan;
  },
  setCoachPlan(plan, forGameCount, forQueue = "all", forMode = "llm") {
    const db = currentDb();
    db.settings.coachPlan = { plan, forGameCount, forQueue, forMode };
    saveCurrent();
  },
  coachMode() {
    return currentDb().settings.coachMode ?? "llm";
  },
  setCoachMode(mode) {
    currentDb().settings.coachMode = mode;
    saveCurrent();
  },
  // --- Notifications ---
  notifications() {
    return currentDb().notifications;
  },
  notifSeen() {
    return currentDb().settings.notifSeen;
  },
  setNotifSeen(seen) {
    currentDb().settings.notifSeen = seen;
    saveCurrent();
  },
  pushNotifications(items) {
    if (!items.length) return;
    const db = currentDb();
    db.notifications = [...items, ...db.notifications].slice(0, 60);
    saveCurrent();
  },
  markNotificationsRead() {
    const db = currentDb();
    let changed = false;
    for (const n of db.notifications) if (!n.read) {
      n.read = true;
      changed = true;
    }
    if (changed) saveCurrent();
  },
  clearNotifications() {
    currentDb().notifications = [];
    saveCurrent();
  },
  claimRollingQuest(familyKey) {
    const db = currentDb();
    db.settings.rollingQuestState = {
      ...db.settings.rollingQuestState,
      [familyKey]: (db.settings.rollingQuestState[familyKey] ?? 0) + 1
    };
    saveCurrent();
  },
  profile() {
    return loadProfile();
  },
  favorites() {
    return loadProfile().favorites ?? [];
  },
  addFavorite(f) {
    const p = loadProfile();
    const favs = p.favorites ?? [];
    if (!favs.some((x) => favKey(x.gameName, x.tagLine) === favKey(f.gameName, f.tagLine))) {
      docCaches().profile = { ...p, favorites: [...favs, f] };
      persistProfile();
    }
  },
  removeFavorite(gameName, tagLine) {
    const p = loadProfile();
    docCaches().profile = {
      ...p,
      favorites: (p.favorites ?? []).filter((x) => favKey(x.gameName, x.tagLine) !== favKey(gameName, tagLine))
    };
    persistProfile();
  },
  updateProfile(patch) {
    const profile = loadProfile();
    docCaches().profile = {
      ...profile,
      ...patch,
      championPool: patch.championPool ?? profile.championPool,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    persistProfile();
  },
  goals() {
    return currentDb().goals;
  },
  goalsForSeason(seasonId) {
    return currentDb().goals.filter(
      (g) => g.seasonId === seasonId && g.status !== "archived"
    );
  },
  addGoal(goal) {
    currentDb().goals.push(goal);
    saveCurrent();
  },
  updateGoal(id, patch) {
    const db = currentDb();
    const i = db.goals.findIndex((g) => g.id === id);
    if (i === -1) return;
    db.goals[i] = { ...db.goals[i], ...patch };
    saveCurrent();
  },
  deleteGoal(id) {
    const db = currentDb();
    db.goals = db.goals.filter((g) => g.id !== id);
    saveCurrent();
  },
  tuning() {
    return currentDb().settings.tuning;
  },
  updateTuning(patch) {
    const db = currentDb();
    db.settings.tuning = {
      ...db.settings.tuning,
      ...patch,
      benchmarks: { ...db.settings.tuning.benchmarks, ...patch.benchmarks ?? {} }
    };
    saveCurrent();
  },
  exportAll() {
    return currentDb();
  },
  importAll(incoming) {
    const merged = {
      ...structuredClone(DEFAULT_DB),
      ...incoming,
      settings: {
        ...DEFAULT_DB.settings,
        ...incoming.settings,
        tuning: {
          ...DEFAULT_TUNING,
          ...incoming.settings?.tuning,
          benchmarks: {
            ...DEFAULT_TUNING.benchmarks,
            ...incoming.settings?.tuning?.benchmarks
          }
        }
      }
    };
    if (currentKind() === "live") docCaches().live = merged;
    else docCaches().demo = merged;
    saveCurrent();
    if (incoming.profile) {
      docCaches().profile = { ...DEFAULT_PROFILE, ...incoming.profile };
      persistProfile();
    }
  },
  cloneSeason(id, name) {
    const src = this.getSeason(id);
    if (!src) return null;
    const clone = {
      id: globalThis.crypto.randomUUID(),
      name,
      theme: src.theme,
      goal: src.goal,
      identityId: src.identityId,
      targetGames: src.targetGames,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      endedAt: null,
      status: "active",
      retro: null
    };
    this.addSeason(clone);
    for (const g of this.goalsForSeason(id)) {
      this.addGoal({
        ...g,
        id: globalThis.crypto.randomUUID(),
        seasonId: clone.id,
        status: "active",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return clone;
  }
};

// server/userContext.ts
import { AsyncLocalStorage as AsyncLocalStorage3 } from "node:async_hooks";
var als2 = new AsyncLocalStorage3();
function runWithUser(user, fn) {
  return als2.run(user, fn);
}
function currentUser() {
  return als2.getStore() ?? null;
}
function selfIdentity() {
  const u = currentUser();
  return {
    gameName: u?.gameName ?? process.env.RIOT_GAME_NAME ?? null,
    tagLine: u?.tagLine ?? process.env.RIOT_TAG_LINE ?? null,
    platform: u?.platform ?? process.env.RIOT_PLATFORM ?? "na1"
  };
}

// server/engine/identities.ts
var w = (o) => ({
  earlyStability: 1,
  deathDiscipline: 1,
  objectiveMacro: 1,
  teamfight: 1,
  mental: 1,
  review: 1,
  ...o
});
var IDENTITIES = [
  {
    id: "stonewall",
    name: "The Stonewall Climber",
    tagline: "Stable laning, low deaths, boring on purpose. You win by not losing.",
    weights: w({ earlyStability: 3, deathDiscipline: 3, mental: 1.5, teamfight: 1 }),
    focusQuests: ["no_early_deaths", "clean_early", "review_streak"]
  },
  {
    id: "tempo_goblin",
    name: "The Tempo Goblin",
    tagline: "Roams, resets, map pressure. You are always somewhere useful.",
    weights: w({ objectiveMacro: 3, earlyStability: 1.5, deathDiscipline: 1.5 }),
    focusQuests: ["objective_present", "reset_discipline", "clean_early"]
  },
  {
    id: "teamfight_architect",
    name: "The Teamfight Architect",
    tagline: "Positioning, fight timing, target discipline. Never first to die.",
    weights: w({ teamfight: 3, objectiveMacro: 2, deathDiscipline: 1.5 }),
    focusQuests: ["not_first_dead", "objective_present", "review_streak"]
  },
  {
    id: "lane_bully",
    name: "The Lane Bully",
    tagline: "Pressure, CS leads, plates, controlled aggression. Own the lane.",
    weights: w({ earlyStability: 3, objectiveMacro: 1.5, deathDiscipline: 2 }),
    focusQuests: ["cs_milestone", "no_early_deaths", "clean_early"]
  },
  {
    id: "shotcaller_monk",
    name: "The Shotcaller Monk",
    tagline: "Clean pings, calm macro, zero chat nonsense. The adult in the room.",
    weights: w({ mental: 3, objectiveMacro: 2, review: 1.5 }),
    focusQuests: ["no_flame", "adult_in_room", "review_streak"]
  }
];
function getIdentity(id) {
  return IDENTITIES.find((i) => i.id === id) ?? IDENTITIES[0];
}

// server/engine/processScore.ts
var clamp01 = (n) => Math.max(0, Math.min(1, n));
var isAram = (o) => (o.queue ?? "").toUpperCase().includes("ARAM");
var AVOIDABLE = [
  "greedy_recall",
  "facecheck",
  "overextension",
  "shutdown_donation",
  "sidelane_greed",
  "mechanical_misplay"
];
function earlyStability(o, s) {
  if (isAram(o)) return null;
  const signals = [];
  if (o.deathsBefore15 != null) {
    signals.push(clamp01(1 - o.deathsBefore15 / 4));
  }
  if (o.goldDiffAt15 != null) {
    signals.push(clamp01(0.5 + o.goldDiffAt15 / 3e3));
  } else if (o.goldDiffAt10 != null) {
    signals.push(clamp01(0.5 + o.goldDiffAt10 / 2e3));
  }
  if (o.csAt10 != null) {
    signals.push(clamp01((o.csAt10 - 30) / 50));
  }
  if (signals.length === 0) {
    return gradePrior(s.grade) * 0.9;
  }
  return avg(signals);
}
function deathDiscipline(o, s) {
  const signals = [];
  if (o.deaths != null && o.durationSec != null) {
    const per10 = o.deaths / (o.durationSec / 600);
    const good = isAram(o) ? 4 : 1;
    const span = isAram(o) ? 8 : 5;
    signals.push(clamp01(1 - (per10 - good) / span));
  }
  if (s.firstDeathCause) {
    if (s.firstDeathCause === "unavoidable_team_collapse") signals.push(0.8);
    else if (AVOIDABLE.includes(s.firstDeathCause)) signals.push(0.25);
    else signals.push(0.55);
  }
  if (s.doomedCollapse && signals.length > 0) {
    return clamp01(Math.max(...signals, 0.6));
  }
  if (signals.length === 0) return null;
  return avg(signals);
}
function objectiveMacro(o, s) {
  if (isAram(o)) {
    const sig = [];
    if (o.teamDamageShare != null) sig.push(clamp01(o.teamDamageShare / 0.28));
    if (o.killParticipation != null) sig.push(clamp01(o.killParticipation / 0.7));
    return sig.length ? avg(sig) : null;
  }
  const signals = [];
  if (o.dragons != null || o.heralds != null || o.barons != null || o.voidgrubs != null) {
    const taken = (o.dragons ?? 0) + (o.heralds ?? 0) + (o.barons ?? 0) + (o.voidgrubs ?? 0) * 0.25;
    signals.push(clamp01(taken / 6));
  }
  if (o.visionScore != null && o.durationSec != null) {
    const vpm = o.visionScore / (o.durationSec / 60);
    signals.push(clamp01(vpm / 1.5));
  }
  if (signals.length === 0) return gradePrior(s.grade) * 0.85;
  return avg(signals);
}
function teamfight(o, s) {
  const signals = [];
  if (o.teamDamageShare != null) {
    signals.push(clamp01(o.teamDamageShare / 0.3));
  }
  if (o.kills != null && o.assists != null && o.deaths != null) {
    const kda2 = (o.kills + o.assists) / Math.max(1, o.deaths);
    signals.push(clamp01(kda2 / 5));
  }
  if (isAram(o) && o.killParticipation != null) {
    signals.push(clamp01(o.killParticipation / 0.7));
  }
  if (signals.length === 0) return gradePrior(s.grade) * 0.85;
  return avg(signals);
}
function mental(s) {
  let score = 1;
  score -= s.tiltAfter * 0.12;
  if (s.flamed) score -= 0.35;
  if (!s.mutedAppropriately && s.tiltAfter >= 3) score -= 0.1;
  return clamp01(score);
}
function review(s) {
  let score = 0;
  if (s.reviewed) score += 0.4;
  if (s.oneAdjustment.trim().length > 0) score += 0.35;
  if (s.biggestMistake.trim().length > 0) score += 0.15;
  if (s.bestDecision.trim().length > 0) score += 0.1;
  return clamp01(score);
}
function gradePrior(grade) {
  return { A: 0.9, B: 0.72, C: 0.55, D: 0.35, F: 0.15 }[grade];
}
var avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function computeProcess(match2, identity) {
  const { objective: o, scorecard: s } = match2;
  const selfReported = match2.source !== "riot";
  const raw = {
    earlyStability: earlyStability(o, s),
    deathDiscipline: deathDiscipline(o, s),
    objectiveMacro: objectiveMacro(o, s),
    teamfight: teamfight(o, s),
    mental: selfReported ? mental(s) : null,
    review: selfReported ? review(s) : null
  };
  const subMetrics = {};
  const usedWeights = {};
  let weightSum = 0;
  let acc = 0;
  Object.keys(raw).forEach((k) => {
    const v = raw[k];
    if (v == null) return;
    const weight = identity.weights[k];
    subMetrics[k] = Math.round(v * 100) / 100;
    usedWeights[k] = weight;
    weightSum += weight;
    acc += v * weight;
  });
  const score = weightSum > 0 ? Math.round(acc / weightSum * 100) : 50;
  return { score, subMetrics, usedWeights };
}

// server/engine/classify.ts
var GOOD = 65;
var BAD = 45;
function classify(win, process2, good = GOOD, bad = BAD) {
  if (win === void 0) return "standard";
  if (win) return process2 >= good ? "clean_win" : process2 < bad ? "bad_win" : "standard";
  return process2 >= good ? "good_loss" : process2 < bad ? "deserved_loss" : "standard";
}
function slope(ys) {
  const n = ys.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (ys[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
function detectBorrowedLp(enriched, window2 = 8) {
  const recent = enriched.slice(-window2);
  const lp = recent.map((m) => m.objective.lpDelta ?? 0);
  const cumulativeLp = [];
  lp.reduce((acc, d, i) => cumulativeLp[i] = acc + d, 0);
  const proc = recent.map((m) => m.process.score);
  const lpSlope = slope(cumulativeLp);
  const processSlope = slope(proc);
  const borrowed = recent.length >= 4 && lpSlope > 0 && processSlope < -1.2;
  return {
    borrowed,
    lpSlope: Math.round(lpSlope * 10) / 10,
    processSlope: Math.round(processSlope * 10) / 10,
    window: recent.length,
    message: borrowed ? "Borrowed LP: your rank is climbing but your play is decaying. This is a loan, not a trend \u2014 tighten the process before it gets called in." : null
  };
}
function detectGoodBlock(enriched, window2 = 10) {
  const recent = enriched.slice(-window2);
  const proc = recent.map((m) => m.process.score);
  const lp = recent.map((m) => m.objective.lpDelta ?? 0);
  const cumulativeLp = [];
  lp.reduce((acc, d, i) => cumulativeLp[i] = acc + d, 0);
  const processSlope = slope(proc);
  const lpSlope = slope(cumulativeLp);
  const goodBlock = recent.length >= 5 && processSlope > 1 && lpSlope <= 0;
  return {
    goodBlock,
    processSlope: Math.round(processSlope * 10) / 10,
    message: goodBlock ? "Good block: LP is flat or down, but your process is trending up. This is what improvement looks like before the results catch up. Keep going." : null
  };
}

// server/engine/goals.ts
var def = (x) => x !== null && x !== void 0;
var round1 = (n) => Math.round(n * 10) / 10;
var mins = (m) => m.objective.durationSec ? m.objective.durationSec / 60 : null;
function scoped(ms, champion) {
  return champion ? ms.filter(
    (m) => m.objective.champion?.toLowerCase() === champion.toLowerCase()
  ) : ms;
}
function avgOf(ms, pick, label) {
  const vals = ms.map(pick).filter(def);
  if (vals.length === 0) return { value: null, sampleSize: 0, detail: "no data yet" };
  const value = round1(vals.reduce((a, b) => a + b, 0) / vals.length);
  return { value, sampleSize: vals.length, detail: `avg over ${vals.length} ${label}` };
}
function rateOf(ms, pred, guard, label) {
  const eligible = ms.filter(guard);
  if (eligible.length === 0) return { value: null, sampleSize: 0, detail: "no data yet" };
  const hits = eligible.filter((m) => pred(m) === true).length;
  return {
    value: Math.round(hits / eligible.length * 100),
    sampleSize: eligible.length,
    detail: `${hits}/${eligible.length} ${label}`
  };
}
function countOf(ms, pred, label) {
  const hits = ms.filter(pred).length;
  return { value: hits, sampleSize: ms.length, detail: `${hits} so far \xB7 ${label}` };
}
var kdaOf = (m) => {
  const { kills, deaths, assists } = m.objective;
  if (kills == null || deaths == null || assists == null) return null;
  return (kills + assists) / Math.max(1, deaths);
};
var objsOf = (m) => (m.objective.dragons ?? 0) + (m.objective.heralds ?? 0) + (m.objective.barons ?? 0);
var ACHIEVEMENTS = [
  {
    id: "positive_games",
    category: "achievement",
    unit: "games",
    direction: "higher",
    defaultTarget: 10,
    title: (c) => c ? `${c}: finish positive` : "Finish games positive",
    describe: (t, c) => `Get ${t} games where your takedowns beat your deaths${c ? ` on ${c}` : ""} \u2014 no coin-flip int games.`,
    measure: (ms, c) => countOf(scoped(ms, c), (m) => {
      const k = m.objective.kills, d = m.objective.deaths, a = m.objective.assists;
      return k != null && d != null && a != null && k + a > d;
    }, "positive KDA")
  },
  {
    id: "carry_games",
    category: "achievement",
    unit: "games",
    direction: "higher",
    defaultTarget: 5,
    title: (c) => c ? `${c}: carry games` : "Stack carry games",
    describe: (t, c) => `Get ${t} games where you carried \u2014 60%+ kill participation and a 3+ KDA${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => countOf(scoped(ms, c), (m) => (m.objective.killParticipation ?? 0) >= 0.6 && (kdaOf(m) ?? 0) >= 3, "carried")
  },
  {
    id: "clean_lane_games",
    category: "achievement",
    unit: "games",
    direction: "higher",
    defaultTarget: 8,
    title: (c) => c ? `${c}: clean laning` : "Clean laning games",
    describe: (t, c) => `Get ${t} games with a calm early game \u2014 at most 1 death before 15 minutes${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => countOf(scoped(ms, c), (m) => m.objective.deathsBefore15 != null && m.objective.deathsBefore15 <= 1, "clean starts")
  },
  {
    id: "deathless_openings",
    category: "achievement",
    unit: "games",
    direction: "higher",
    defaultTarget: 5,
    title: (c) => c ? `${c}: deathless openings` : "Deathless openings",
    describe: (t, c) => `Get ${t} games where you take zero deaths before 15 minutes${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => countOf(scoped(ms, c), (m) => m.objective.deathsBefore15 === 0, "flawless starts")
  },
  {
    id: "disciplined_games",
    category: "achievement",
    unit: "games",
    direction: "higher",
    defaultTarget: 12,
    title: (c) => c ? `${c}: disciplined games` : "Disciplined games",
    describe: (t, c) => `Get ${t} games at 4 deaths or fewer \u2014 respect the map${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => countOf(scoped(ms, c), (m) => m.objective.deaths != null && m.objective.deaths <= 4, "low-death games")
  },
  {
    id: "comeback_wins",
    category: "achievement",
    unit: "wins",
    direction: "higher",
    defaultTarget: 3,
    title: () => "Comeback wins",
    describe: (t) => `Win ${t} games you were losing at 15 \u2014 down 1000+ gold and still closed it.`,
    measure: (ms) => countOf(ms, (m) => m.objective.win === true && (m.objective.goldDiffAt15 ?? 0) <= -1e3, "comebacks")
  },
  {
    id: "objective_games",
    category: "achievement",
    unit: "games",
    direction: "higher",
    defaultTarget: 6,
    title: () => "Objective dominance",
    describe: (t) => `Get ${t} games where your team stacks 6+ major objectives (drakes / heralds / barons).`,
    measure: (ms) => countOf(ms, (m) => objsOf(m) >= 6, "objective games")
  },
  {
    id: "win_count",
    category: "achievement",
    unit: "wins",
    direction: "higher",
    defaultTarget: 10,
    title: (c) => c ? `${c}: rack up wins` : "Rack up wins",
    describe: (t, c) => `Win ${t} games this block${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => countOf(scoped(ms, c), (m) => m.objective.win === true, "wins")
  }
];
var TEMPLATES = [
  ...ACHIEVEMENTS,
  {
    id: "cs10",
    category: "farm",
    unit: "CS@10",
    direction: "higher",
    defaultTarget: 70,
    title: (c) => c ? `${c}: CS at 10 minutes` : "CS at 10 minutes",
    describe: (t, c) => `Average ${t}+ CS by 10 minutes${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(scoped(ms, c), (m) => m.objective.csAt10, "games")
  },
  {
    id: "cs_per_min",
    category: "farm",
    unit: "CS/min",
    direction: "higher",
    defaultTarget: 6.5,
    title: (c) => c ? `${c}: CS per minute` : "CS per minute",
    describe: (t, c) => `Average ${t}+ CS per minute across the game${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(
      scoped(ms, c),
      (m) => {
        const mm = mins(m);
        return m.objective.totalCs != null && mm ? m.objective.totalCs / mm : null;
      },
      "games"
    )
  },
  {
    id: "deaths_before_15",
    category: "survival",
    unit: "deaths <15",
    direction: "lower",
    defaultTarget: 2,
    title: (c) => c ? `${c}: Deaths before 15` : "Deaths before 15",
    describe: (t, c) => `No more than ${t} deaths before 15 minutes, on average${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(scoped(ms, c), (m) => m.objective.deathsBefore15, "games")
  },
  {
    id: "deaths_per_game",
    category: "survival",
    unit: "deaths",
    direction: "lower",
    defaultTarget: 5,
    title: (c) => c ? `${c}: Deaths per game` : "Deaths per game",
    describe: (t, c) => `Keep average deaths at or below ${t}${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(scoped(ms, c), (m) => m.objective.deaths, "games")
  },
  {
    id: "clean_early_rate",
    category: "survival",
    unit: "%",
    direction: "higher",
    defaultTarget: 70,
    title: (c) => c ? `${c}: Clean early games` : "Clean early games",
    describe: (t, c) => `${t}%+ of games with <=1 death before 10 minutes${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => rateOf(
      scoped(ms, c),
      (m) => (m.objective.deathsBefore10 ?? 99) <= 1,
      (m) => m.objective.deathsBefore10 != null,
      "clean"
    )
  },
  {
    id: "kill_participation",
    category: "aggression",
    unit: "% KP",
    direction: "higher",
    defaultTarget: 55,
    title: (c) => c ? `${c}: Kill participation` : "Kill participation",
    describe: (t, c) => `Be involved in ${t}%+ of your team's kills${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(
      scoped(ms, c),
      (m) => m.objective.killParticipation != null ? m.objective.killParticipation * 100 : null,
      "games"
    )
  },
  {
    id: "solo_kills",
    category: "aggression",
    unit: "solo kills",
    direction: "higher",
    defaultTarget: 1,
    title: (c) => c ? `${c}: Solo kills` : "Solo kills",
    describe: (t, c) => `Average ${t}+ solo kills${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(scoped(ms, c), (m) => m.objective.soloKills, "games")
  },
  {
    id: "gold_diff_15",
    category: "aggression",
    unit: "gold@15",
    direction: "higher",
    defaultTarget: 250,
    title: (c) => c ? `${c}: Gold lead at 15` : "Gold lead at 15",
    describe: (t, c) => `Average +${t} gold vs your lane opponent by 15${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(scoped(ms, c), (m) => m.objective.goldDiffAt15, "games")
  },
  {
    id: "damage_share",
    category: "aggression",
    unit: "% dmg",
    direction: "higher",
    defaultTarget: 25,
    title: (c) => c ? `${c}: Damage share` : "Team damage share",
    describe: (t, c) => `Deal ${t}%+ of your team's champion damage${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(
      scoped(ms, c),
      (m) => m.objective.teamDamageShare != null ? m.objective.teamDamageShare * 100 : null,
      "games"
    )
  },
  {
    id: "objectives",
    category: "objectives",
    unit: "obj/game",
    direction: "higher",
    defaultTarget: 5,
    title: (c) => c ? `${c}: Objectives secured` : "Objectives secured",
    describe: (t, c) => `Team averages ${t}+ major objectives per game${c ? ` when you play ${c}` : ""}.`,
    measure: (ms, c) => avgOf(
      scoped(ms, c),
      (m) => {
        const o = m.objective;
        if (o.dragons == null && o.heralds == null && o.barons == null) return null;
        return (o.dragons ?? 0) + (o.heralds ?? 0) + (o.barons ?? 0);
      },
      "games"
    )
  },
  {
    id: "vision_per_min",
    category: "vision",
    unit: "vis/min",
    direction: "higher",
    defaultTarget: 1,
    title: (c) => c ? `${c}: Vision per minute` : "Vision per minute",
    describe: (t, c) => `Average ${t}+ vision score per minute${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(
      scoped(ms, c),
      (m) => {
        const mm = mins(m);
        return m.objective.visionScore != null && mm ? m.objective.visionScore / mm : null;
      },
      "games"
    )
  },
  {
    id: "avg_process",
    category: "process",
    unit: "process",
    direction: "higher",
    defaultTarget: 65,
    title: (c) => c ? `${c}: Process score` : "Process score",
    describe: (t, c) => `Keep your average process score at ${t}+${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(scoped(ms, c), (m) => m.process.score, "games")
  },
  {
    id: "full_review_rate",
    category: "process",
    unit: "%",
    direction: "higher",
    defaultTarget: 80,
    title: () => "Full review rate",
    describe: (t) => `${t}%+ of games fully reviewed with both a mistake and a next adjustment logged.`,
    measure: (ms) => rateOf(
      ms,
      (m) => m.scorecard.reviewed && m.scorecard.oneAdjustment.trim().length > 0 && m.scorecard.biggestMistake.trim().length > 0,
      () => true,
      "fully reviewed"
    )
  },
  {
    id: "tilt_control",
    category: "mental",
    unit: "%",
    direction: "higher",
    defaultTarget: 70,
    title: (c) => c ? `${c}: Tilt control` : "Tilt control",
    describe: (t, c) => `End ${t}%+ of games at tilt <=2${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => rateOf(scoped(ms, c), (m) => m.scorecard.tiltAfter <= 2, () => true, "calm")
  },
  {
    id: "no_flame_rate",
    category: "mental",
    unit: "%",
    direction: "higher",
    defaultTarget: 100,
    title: (c) => c ? `${c}: No flame` : "No flame",
    describe: (t, c) => `${t}% of games with zero chat nonsense${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => rateOf(scoped(ms, c), (m) => !m.scorecard.flamed, () => true, "clean")
  },
  {
    id: "close_out_time",
    category: "tempo",
    unit: "min (wins)",
    direction: "lower",
    defaultTarget: 30,
    title: (c) => c ? `${c}: Close games out` : "Close games out",
    describe: (t, c) => `Average winning-game length under ${t} min${c ? ` on ${c}` : ""}.`,
    measure: (ms, c) => avgOf(
      scoped(ms, c).filter((m) => m.objective.win === true),
      (m) => mins(m),
      "wins"
    )
  },
  {
    id: "champion_focus",
    category: "champion",
    unit: "games",
    direction: "higher",
    defaultTarget: 10,
    needsChampion: true,
    title: (c) => `Commit to ${c ?? "a champion"}`,
    describe: (t, c) => `Play ${c ?? "your pick"} at least ${t} games this block.`,
    measure: (ms, c) => {
      const n = scoped(ms, c).length;
      return { value: n, sampleSize: ms.length, detail: `${n} games on ${c ?? "?"}` };
    }
  },
  {
    id: "champion_winrate",
    category: "champion",
    unit: "% WR",
    direction: "higher",
    defaultTarget: 55,
    needsChampion: true,
    title: (c) => `Win rate on ${c ?? "a champion"}`,
    describe: (t, c) => `Hit ${t}%+ win rate on ${c ?? "your pick"}.`,
    measure: (ms, c) => {
      const on = scoped(ms, c);
      if (on.length === 0) return { value: null, sampleSize: 0, detail: "no games yet" };
      const wins = on.filter((m) => m.objective.win).length;
      return {
        value: Math.round(wins / on.length * 100),
        sampleSize: on.length,
        detail: `${wins}/${on.length} on ${c ?? "?"}`
      };
    }
  }
];
function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id);
}
var WHAT_COUNTS = {
  cs10: "Your creep score at the 10-minute mark, averaged.",
  cs_per_min: "Total CS \xF7 minutes played.",
  deaths_before_15: "Deaths you take before 15 minutes.",
  deaths_per_game: "Total deaths per game.",
  clean_early_rate: "Share of games with \u22641 death before 10 minutes.",
  kill_participation: "Your share of the team's kills (kills + assists \xF7 team kills).",
  solo_kills: "Kills you get with no ally assisting.",
  gold_diff_15: "Your gold minus your lane opponent's at 15 minutes.",
  damage_share: "Your champion damage as a share of your team's total.",
  objectives: "Dragons + heralds + barons your team secures.",
  vision_per_min: "Vision score \xF7 minutes played.",
  avg_process: "Your game-score \u2014 how clean you played, independent of the win.",
  full_review_rate: "Games you logged with both a mistake and an adjustment.",
  tilt_control: "Games you finished at tilt 2 or lower.",
  no_flame_rate: "Games with zero chat nonsense.",
  close_out_time: "Average length of your winning games.",
  champion_focus: "Games played on this champion.",
  champion_winrate: "Win rate on this champion.",
  positive_games: "Counts a game when kills + assists is greater than deaths.",
  carry_games: "Counts a game with 60%+ kill participation AND a 3.0+ KDA.",
  clean_lane_games: "Counts a game with 1 or fewer deaths before 15 minutes.",
  deathless_openings: "Counts a game with zero deaths before 15 minutes.",
  disciplined_games: "Counts a game with 4 or fewer deaths total.",
  comeback_wins: "Counts a win where you were down 1000+ gold at 15 minutes.",
  objective_games: "Counts a game where your team took 6+ major objectives.",
  win_count: "Counts a win."
};
var BASELINE_KEY = {
  cs10: "cs10",
  cs_per_min: "cs_per_min",
  deaths_before_15: "deaths_before_15",
  deaths_per_game: "deaths",
  kill_participation: "kill_participation",
  solo_kills: "solo_kills",
  gold_diff_15: "gold_diff_15",
  damage_share: "damage_share",
  objectives: "objectives",
  vision_per_min: "vision_per_min",
  avg_process: "avg_process"
};
function baselineKeyFor(templateId) {
  return BASELINE_KEY[templateId] ?? null;
}
function computeBaselines(career, windowN = 20) {
  const recent = career.slice(-windowN);
  const av = (pick) => {
    const v = recent.map(pick).filter(def);
    return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  return {
    cs10: av((m) => m.objective.csAt10),
    cs_per_min: av((m) => {
      const mm = mins(m);
      return m.objective.totalCs != null && mm ? m.objective.totalCs / mm : null;
    }),
    deaths: av((m) => m.objective.deaths),
    deaths_before_15: av((m) => m.objective.deathsBefore15),
    kill_participation: av((m) => m.objective.killParticipation != null ? m.objective.killParticipation * 100 : null),
    solo_kills: av((m) => m.objective.soloKills),
    gold_diff_15: av((m) => m.objective.goldDiffAt15),
    damage_share: av((m) => m.objective.teamDamageShare != null ? m.objective.teamDamageShare * 100 : null),
    objectives: av((m) => {
      const o = m.objective;
      if (o.dragons == null && o.heralds == null && o.barons == null) return null;
      return (o.dragons ?? 0) + (o.heralds ?? 0) + (o.barons ?? 0);
    }),
    vision_per_min: av((m) => {
      const mm = mins(m);
      return m.objective.visionScore != null && mm ? m.objective.visionScore / mm : null;
    }),
    avg_process: av((m) => m.process.score)
  };
}
function personalizedTarget(key, baseline) {
  switch (key) {
    case "cs10":
      return Math.round(baseline + 8);
    case "cs_per_min":
      return round1(baseline + 0.6);
    case "deaths":
      return Math.max(2, round1(baseline - 1));
    case "deaths_before_15":
      return Math.max(1, round1(baseline - 0.7));
    case "kill_participation":
      return Math.min(80, Math.round(baseline + 6));
    case "damage_share":
      return Math.min(45, Math.round(baseline + 4));
    case "solo_kills":
      return round1(baseline + 0.5);
    case "gold_diff_15":
      return Math.round(baseline + 250);
    case "objectives":
      return round1(baseline + 0.8);
    case "vision_per_min":
      return round1(baseline + 0.25);
    case "avg_process":
      return Math.min(85, Math.round(baseline + 6));
    default:
      return baseline;
  }
}
function pctToward(value, target, direction) {
  const clamp2 = (n) => Math.max(0, Math.min(100, Math.round(n)));
  if (direction === "higher") return clamp2(target === 0 ? 100 : value / target * 100);
  if (value <= target) return 100;
  return clamp2(value === 0 ? 100 : target / value * 100);
}
function fillToward(baseline, current, target) {
  if (baseline == null || current == null || target === baseline) return 0;
  const prog = (current - baseline) / (target - baseline);
  return Math.max(0, Math.min(100, Math.round(prog * 100)));
}
function evaluateGoal(goal, ms) {
  const tpl = getTemplate(goal.templateId);
  const whatCounts = WHAT_COUNTS[goal.templateId] ?? null;
  if (!tpl) {
    return {
      goal,
      current: null,
      target: goal.target,
      baseline: goal.baseline ?? null,
      pct: 0,
      fillPct: 0,
      met: false,
      sampleSize: 0,
      detail: "unknown metric",
      whatCounts
    };
  }
  const m = tpl.measure(ms, goal.champion);
  const met = m.value != null && (goal.direction === "higher" ? m.value >= goal.target : m.value <= goal.target);
  const baseline = goal.baseline ?? null;
  return {
    goal,
    current: m.value,
    target: goal.target,
    baseline,
    pct: m.value == null ? 0 : pctToward(m.value, goal.target, goal.direction),
    fillPct: baseline != null ? fillToward(baseline, m.value, goal.target) : m.value == null ? 0 : pctToward(m.value, goal.target, goal.direction),
    met,
    sampleSize: m.sampleSize,
    detail: m.detail,
    whatCounts
  };
}
function goalFromTemplate(templateId, opts) {
  const tpl = getTemplate(templateId);
  if (!tpl) return null;
  const target = opts.target ?? tpl.defaultTarget;
  return {
    id: globalThis.crypto.randomUUID(),
    seasonId: opts.seasonId,
    templateId,
    title: tpl.title(opts.champion),
    description: tpl.describe(target, opts.champion),
    category: tpl.category,
    target,
    unit: tpl.unit,
    direction: tpl.direction,
    champion: opts.champion ?? null,
    baseline: opts.baseline ?? null,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: "active"
  };
}

// server/engine/xp.ts
function matchXp(match2, process2, verdict) {
  const awards = [];
  const s = match2.scorecard;
  const o = match2.objective;
  awards.push({ reason: "Logged the game", amount: 10 });
  if (s.reviewed && s.oneAdjustment.trim() && s.biggestMistake.trim()) {
    awards.push({ reason: "Full review (mistake + adjustment)", amount: 15 });
  } else if (s.oneAdjustment.trim()) {
    awards.push({ reason: "Wrote one adjustment", amount: 8 });
  }
  if (!s.flamed && s.mutedAppropriately) {
    awards.push({ reason: "Clean comms (no flame, muted well)", amount: 10 });
  }
  if (o.deathsBefore15 != null && o.deathsBefore15 <= 2 && (o.goldDiffAt15 ?? 0) >= -500) {
    awards.push({ reason: "Clean early game", amount: 20 });
  }
  if (verdict === "good_loss") {
    awards.push({ reason: "Good loss \u2014 process over outcome", amount: 25 });
  }
  if (process2.score >= 80) {
    awards.push({ reason: "Excellent process (80+)", amount: 15 });
  }
  if (o.win === false && s.tiltAfter <= 2) {
    awards.push({ reason: "Lost without tilting", amount: 12 });
  }
  return awards;
}
function matchFlags(match2, pool) {
  const flags = [];
  const s = match2.scorecard;
  const o = match2.objective;
  if (o.champion && (o.queue?.includes("RANKED") ?? true)) {
    const entry = pool.find(
      (p) => p.champion.toLowerCase() === o.champion.toLowerCase()
    );
    if (entry?.tier === "lab") {
      flags.push({
        kind: "warn",
        code: "no_culinary_innovation",
        message: `${o.champion} is in your lab pool, not your ranked pool. No culinary innovation in ranked \u2014 experiment in normals, climb on your mains.`
      });
    } else if (!entry && pool.length > 0) {
      flags.push({
        kind: "warn",
        code: "off_pool",
        message: `${o.champion} isn't in this block's champion pool at all. If this was a fill or an autofill, fine. If it was a whim, that's how blocks lose their thesis.`
      });
    }
  }
  if (s.firstDeathCause === "shutdown_donation" || s.firstDeathCause === "overextension" || s.firstDeathCause === "sidelane_greed") {
    flags.push({
      kind: "info",
      code: "not_the_protagonist",
      message: "First death was a greed/overextension death. You are not the anime protagonist \u2014 the 1v3 backdoor works in the highlight reel, not the ranked ladder."
    });
  }
  if (o.win && !s.reviewed) {
    flags.push({
      kind: "info",
      code: "review_the_win",
      message: "Wins get skipped in review \u2014 that's how bad habits survive. Thirty seconds: what did you get away with today?"
    });
  }
  if (s.doomedCollapse) {
    flags.push({
      kind: "info",
      code: "doomed",
      message: "Marked as a team collapse \u2014 score adjusted. If more than ~1 in 4 games are 'doomed,' the common denominator conversation is due."
    });
  }
  return flags;
}
var LEVEL_SPECS = [
  {
    level: 0,
    title: "Queueing With Intent",
    xpToNext: 60,
    promotionQuests: [
      {
        id: "l1-process",
        templateId: "avg_process",
        target: 55,
        window: 3,
        rationale: "Start with a basic process floor. No one gets promoted on vibes."
      },
      {
        id: "l1-review",
        templateId: "full_review_rate",
        target: 100,
        window: 3,
        rationale: "Every game should leave behind one mistake and one adjustment."
      }
    ]
  },
  {
    level: 1,
    title: "Footing",
    xpToNext: 70,
    promotionQuests: [
      {
        id: "l2-calm",
        templateId: "tilt_control",
        target: 70,
        window: 4,
        rationale: "Promotions should be calm, not emotional coin flips."
      },
      {
        id: "l2-clean",
        templateId: "deaths_before_15",
        target: 2.5,
        window: 4,
        rationale: "A playable early game is the minimum cost of admission."
      }
    ]
  },
  {
    level: 2,
    title: "Stabilizing",
    xpToNext: 80,
    promotionQuests: [
      {
        id: "l3-farm",
        templateId: "cs10",
        target: 62,
        window: 5,
        rationale: "Farm is the most repeatable lead you can manufacture yourself."
      },
      {
        id: "l3-noflame",
        templateId: "no_flame_rate",
        target: 100,
        window: 5,
        rationale: "We do not let chat sabotage the block."
      }
    ]
  },
  {
    level: 3,
    title: "Review Habit",
    xpToNext: 90,
    promotionQuests: [
      {
        id: "l4-process",
        templateId: "avg_process",
        target: 60,
        window: 5,
        rationale: "The floor needs to stay above random ladder chaos."
      },
      {
        id: "l4-early",
        templateId: "clean_early_rate",
        target: 60,
        window: 5,
        rationale: "Low-variance openings are how blocks survive bad matchmaking."
      }
    ]
  },
  {
    level: 4,
    title: "Lane Floor",
    xpToNext: 100,
    promotionQuests: [
      {
        id: "l5-gold",
        templateId: "gold_diff_15",
        target: 50,
        window: 5,
        rationale: "Stability should start converting into real lane value."
      },
      {
        id: "l5-vision",
        templateId: "vision_per_min",
        target: 0.8,
        window: 5,
        rationale: "If you want cleaner decisions, pay the vision tax."
      }
    ]
  },
  {
    level: 5,
    title: "Reliable Reset",
    xpToNext: 110,
    promotionQuests: [
      {
        id: "l6-objects",
        templateId: "objectives",
        target: 4,
        window: 6,
        rationale: "Lane only matters if it cashes out into map control."
      },
      {
        id: "l6-deaths",
        templateId: "deaths_per_game",
        target: 5,
        window: 6,
        rationale: "Midgame throws do not get a free pass."
      }
    ]
  },
  {
    level: 6,
    title: "Tempo Learner",
    xpToNext: 120,
    promotionQuests: [
      {
        id: "l7-close",
        templateId: "close_out_time",
        target: 33,
        window: 6,
        rationale: "A lead is only real when you close with it."
      },
      {
        id: "l7-review",
        templateId: "full_review_rate",
        target: 100,
        window: 6,
        rationale: "Review discipline should hold even when games feel routine."
      }
    ]
  },
  {
    level: 7,
    title: "Map Respect",
    xpToNext: 130,
    promotionQuests: [
      {
        id: "l8-process",
        templateId: "avg_process",
        target: 63,
        window: 7,
        rationale: "The whole block should now feel more deliberate."
      },
      {
        id: "l8-gold",
        templateId: "gold_diff_15",
        target: 125,
        window: 7,
        rationale: "Winning the map starts with arriving with more resources."
      }
    ]
  },
  {
    level: 8,
    title: "Objective Student",
    xpToNext: 140,
    promotionQuests: [
      {
        id: "l9-early",
        templateId: "clean_early_rate",
        target: 70,
        window: 7,
        rationale: "You should be reliably showing up to the first objectives alive."
      },
      {
        id: "l9-objects",
        templateId: "objectives",
        target: 4.5,
        window: 7,
        rationale: "Better setups should start showing up on the map count."
      }
    ]
  },
  {
    level: 9,
    title: "Comfort Pilot",
    xpToNext: 150,
    promotionQuests: [
      {
        id: "l10-cs",
        templateId: "cs10",
        target: 66,
        window: 8,
        rationale: "Comfort should make lane cleaner, not lazier."
      },
      {
        id: "l10-kp",
        templateId: "kill_participation",
        target: 55,
        window: 8,
        rationale: "Your clean lanes should now be reaching the fights that matter."
      }
    ]
  },
  {
    level: 10,
    title: "Block Grinder",
    xpToNext: 160,
    promotionQuests: [
      {
        id: "l11-process",
        templateId: "avg_process",
        target: 65,
        window: 8,
        rationale: "This is the line where the scoreboard you built starts beating the one Riot gives you."
      },
      {
        id: "l11-tilt",
        templateId: "tilt_control",
        target: 80,
        window: 8,
        rationale: "Consistency is emotional discipline wearing work clothes."
      }
    ]
  },
  {
    level: 11,
    title: "Lead Converter",
    xpToNext: 170,
    promotionQuests: [
      {
        id: "l12-gold",
        templateId: "gold_diff_15",
        target: 175,
        window: 9,
        rationale: "If lane is solved, the lead should be visible."
      },
      {
        id: "l12-close",
        templateId: "close_out_time",
        target: 31,
        window: 9,
        rationale: "You do not need extra scenes once the game is already yours."
      }
    ]
  },
  {
    level: 12,
    title: "Fight Chooser",
    xpToNext: 180,
    promotionQuests: [
      {
        id: "l13-vision",
        templateId: "vision_per_min",
        target: 1,
        window: 9,
        rationale: "Fight selection gets much easier when the map stops being dark."
      },
      {
        id: "l13-objects",
        templateId: "objectives",
        target: 5,
        window: 9,
        rationale: "Objective play should now be a habit, not a reminder."
      }
    ]
  },
  {
    level: 13,
    title: "Pressure Holder",
    xpToNext: 190,
    promotionQuests: [
      {
        id: "l14-cs",
        templateId: "cs10",
        target: 68,
        window: 10,
        rationale: "Pressure players still farm their way into relevance."
      },
      {
        id: "l14-survive",
        templateId: "deaths_before_15",
        target: 1.8,
        window: 10,
        rationale: "You should be very hard to kill before the map opens."
      }
    ]
  },
  {
    level: 14,
    title: "Closer",
    xpToNext: 200,
    promotionQuests: [
      {
        id: "l15-process",
        templateId: "avg_process",
        target: 68,
        window: 10,
        rationale: "This is no longer about flashes of good play. It is about a strong average."
      },
      {
        id: "l15-kp",
        templateId: "kill_participation",
        target: 58,
        window: 10,
        rationale: "Closing players are present when games actually end."
      }
    ]
  },
  {
    level: 15,
    title: "Anchor",
    xpToNext: 999999,
    promotionQuests: []
  }
];
var MAX_LEVEL = LEVEL_SPECS[LEVEL_SPECS.length - 1].level;
function specFor(level) {
  return LEVEL_SPECS[Math.max(0, Math.min(level, MAX_LEVEL))];
}
function xpForLevel(level) {
  return specFor(level).xpToNext;
}
function cumulativeXpThreshold(level) {
  let total = 0;
  for (let i = 0; i < level; i++) total += xpForLevel(i);
  return total;
}
function titleForLevel(level) {
  return specFor(level).title;
}
function pctToward2(value, target, direction) {
  const clamp2 = (n) => Math.max(0, Math.min(100, Math.round(n)));
  if (direction === "higher") return clamp2(target === 0 ? 100 : value / target * 100);
  if (value <= target) return 100;
  return clamp2(value === 0 ? 100 : target / value * 100);
}
function buildPromotionQuest(spec, matches) {
  const tpl = getTemplate(spec.templateId);
  const scope = matches.slice(-spec.window);
  if (!tpl) {
    return {
      id: spec.id,
      title: "Unknown promotion quest",
      description: "This promotion quest references an unavailable metric.",
      rationale: spec.rationale,
      current: null,
      target: spec.target,
      unit: "",
      direction: "higher",
      pct: 0,
      complete: false,
      sampleSize: 0,
      detail: "unknown template"
    };
  }
  const measurement = tpl.measure(scope);
  const complete = measurement.value != null && (tpl.direction === "higher" ? measurement.value >= spec.target : measurement.value <= spec.target);
  return {
    id: spec.id,
    title: tpl.title(),
    description: tpl.describe(spec.target),
    rationale: spec.rationale,
    current: measurement.value,
    target: spec.target,
    unit: tpl.unit,
    direction: tpl.direction,
    pct: measurement.value == null ? 0 : pctToward2(measurement.value, spec.target, tpl.direction),
    complete,
    sampleSize: measurement.sampleSize,
    detail: measurement.sampleSize > 0 ? `${measurement.detail} \xB7 last ${scope.length} games` : "no data yet"
  };
}
function levelFromXp(totalXp2, matches = []) {
  let level = 0;
  for (let nextLevel2 = 1; nextLevel2 <= MAX_LEVEL; nextLevel2++) {
    const threshold = cumulativeXpThreshold(nextLevel2);
    const quests = specFor(nextLevel2 - 1).promotionQuests.map(
      (q) => buildPromotionQuest(q, matches)
    );
    const questsReady = quests.every((q) => q.complete);
    if (totalXp2 >= threshold && questsReady) level = nextLevel2;
    else break;
  }
  const currentSpec = specFor(level);
  const nextLevel = level >= MAX_LEVEL ? null : level + 1;
  const currentThreshold = cumulativeXpThreshold(level);
  const nextThreshold = nextLevel == null ? null : cumulativeXpThreshold(nextLevel);
  const promotionQuests = nextLevel == null ? [] : currentSpec.promotionQuests.map((q) => buildPromotionQuest(q, matches));
  const xpReady = nextThreshold == null ? true : totalXp2 >= nextThreshold;
  const promotionReady = xpReady && promotionQuests.every((q) => q.complete);
  const xpForNextLevel = nextThreshold == null ? 0 : nextThreshold - currentThreshold;
  const xpIntoLevel = nextThreshold == null ? 0 : Math.min(totalXp2 - currentThreshold, xpForNextLevel);
  return {
    totalXp: totalXp2,
    level,
    xpIntoLevel,
    xpForNextLevel,
    title: currentSpec.title,
    nextLevel,
    nextTitle: nextLevel == null ? null : specFor(nextLevel).title,
    currentThreshold,
    nextThreshold,
    xpReady,
    promotionReady,
    promotionQuests
  };
}

// server/engine/tags.ts
function matchTags(match2, process2) {
  const o = match2.objective;
  const s = match2.scorecard;
  const tags = [];
  const win = o.win;
  const isAram2 = (o.queue ?? "").toUpperCase().includes("ARAM");
  const kills = o.kills ?? 0, deaths = o.deaths ?? 0, assists = o.assists ?? 0;
  const kda2 = o.kills != null && o.deaths != null && o.assists != null ? (kills + assists) / Math.max(1, deaths) : null;
  const g15 = o.goldDiffAt15;
  const d15 = o.deathsBefore15;
  const durMin = o.durationSec ? o.durationSec / 60 : null;
  const kp = o.killParticipation;
  const dmgShare = o.teamDamageShare;
  if (!isAram2) {
    if (win && g15 != null && g15 >= 1500 && process2 >= 60) {
      tags.push({ label: "Stomp", tone: "good", hint: "Won with a big lead by 15 and clean play." });
    } else if (win && g15 != null && g15 <= -1200) {
      tags.push({ label: "Comeback", tone: "good", hint: "Won from behind \u2014 you were down gold at 15 and turned it." });
    } else if (!win && g15 != null && g15 >= 1200) {
      tags.push({ label: "Threw the lead", tone: "bad", hint: "Lost despite a gold lead at 15. A macro/teamfight leak, not a laning one." });
    }
  } else if (win && process2 >= 70) {
    tags.push({ label: "Snowball", tone: "good", hint: "Won a clean ARAM \u2014 kept the pressure on and closed it out." });
  }
  if (kda2 != null && kda2 >= 5 && deaths <= 3) {
    tags.push({ label: "Hard carry", tone: "good", hint: `KDA ${kda2.toFixed(1)} on ${deaths} deaths \u2014 you were the reason.` });
  }
  if (deaths === 0 && kills + assists >= 8) {
    tags.push({ label: "Deathless", tone: "good", hint: `${kills}/${deaths}/${assists} \u2014 never gave one up.` });
  }
  if (kills >= (isAram2 ? 20 : 12)) {
    tags.push({ label: "Kill hungry", tone: "good", hint: `${kills} kills \u2014 took over the fights.` });
  }
  if (dmgShare != null && dmgShare >= 0.3) {
    tags.push({ label: "Damage carry", tone: "good", hint: `${Math.round(dmgShare * 100)}% of your team's champion damage.` });
  } else if (dmgShare != null && dmgShare <= 0.12 && durMin && durMin >= 12) {
    tags.push({ label: "Low output", tone: "bad", hint: `Only ${Math.round(dmgShare * 100)}% of team damage \u2014 struggled to contribute.` });
  }
  if (kp != null && kp >= 0.65) {
    tags.push({ label: "Everywhere", tone: "good", hint: `${Math.round(kp * 100)}% kill participation \u2014 present for the fights.` });
  } else if (kp != null && kp <= 0.4 && !isAram2) {
    tags.push({ label: "Absent", tone: "bad", hint: `${Math.round(kp * 100)}% kill participation \u2014 missing the map's fights.` });
  }
  if (o.soloKills != null && o.soloKills >= 2) {
    tags.push({ label: "1v1 diff", tone: "good", hint: `${o.soloKills} solo kills \u2014 you won your matchup outright.` });
  }
  if (assists >= (isAram2 ? 20 : 13)) {
    tags.push({ label: "Playmaker", tone: "good", hint: `${assists} assists \u2014 set the table for your team all game.` });
  }
  if (kda2 != null && kda2 >= 3 && kda2 < 5 && deaths <= (isAram2 ? 8 : 5)) {
    tags.push({ label: "Steady hand", tone: "good", hint: `KDA ${kda2.toFixed(1)} \u2014 a reliable, low-risk game.` });
  }
  const dmgMin = o.damageToChampions != null && durMin ? o.damageToChampions / durMin : null;
  if (dmgMin != null && dmgMin >= (isAram2 ? 1200 : 900)) {
    tags.push({ label: "DPS", tone: "good", hint: `${Math.round(dmgMin)} damage/min to champions \u2014 constant output.` });
  }
  if (!isAram2) {
    if (d15 != null && d15 === 0 && (o.csAt10 ?? 0) >= 70) {
      tags.push({ label: "Clean lane", tone: "good", hint: `0 deaths before 15 and ${o.csAt10} CS@10 \u2014 textbook.` });
    } else if (d15 != null && d15 >= 4) {
      tags.push({ label: "Fed early", tone: "bad", hint: `${d15} deaths before 15 \u2014 the game was hard from the start.` });
    }
    if (o.csAt10 != null && o.csAt10 >= 85) {
      tags.push({ label: "Farm machine", tone: "good", hint: `${o.csAt10} CS@10 \u2014 elite wave management.` });
    } else if (durMin && durMin >= 18 && o.totalCs != null && o.totalCs / durMin < 5) {
      tags.push({ label: "CS starved", tone: "bad", hint: `Under 5 CS/min \u2014 gold left on the map.` });
    }
    if (g15 != null && g15 >= 1e3) {
      tags.push({ label: "Lane bully", tone: "good", hint: `+${g15} gold at 15 \u2014 you won the matchup.` });
    } else if (g15 != null && g15 <= -1200) {
      tags.push({ label: "Behind early", tone: "bad", hint: `${g15} gold at 15 \u2014 lost the lane, had to play from behind.` });
    }
  }
  const selfReported = match2.source !== "riot";
  if (selfReported && (s.firstDeathCause === "shutdown_donation" || s.firstDeathCause === "overextension")) {
    tags.push({ label: "Hero death", tone: "bad", hint: "First death was greed/overextension \u2014 donated a shutdown." });
  }
  if (deaths >= (isAram2 ? 12 : 9) && durMin && deaths / (durMin / 10) >= 4) {
    tags.push({ label: "Int check", tone: "bad", hint: `${deaths} deaths \u2014 a lot of them, fast.` });
  }
  if (!isAram2) {
    if (o.visionScore != null && durMin && o.visionScore / durMin >= 1.6) {
      tags.push({ label: "Vision god", tone: "good", hint: `${(o.visionScore / durMin).toFixed(1)} vision/min.` });
    }
    const objs = (o.dragons ?? 0) + (o.heralds ?? 0) + (o.barons ?? 0);
    if (win && objs >= 6) {
      tags.push({ label: "Objective diff", tone: "good", hint: `${objs} major objectives taken.` });
    }
  }
  if (selfReported) {
    if (s.flamed) {
      tags.push({ label: "Tilted", tone: "bad", hint: "You typed something you shouldn't have. It rarely helps." });
    } else if (win === false && s.tiltAfter <= 1) {
      tags.push({ label: "Ice cold", tone: "good", hint: "Lost and stayed calm \u2014 the hard part of climbing." });
    }
    if (s.doomedCollapse) {
      tags.push({ label: "4v5", tone: "neutral", hint: "Marked as a team collapse \u2014 not on you." });
    }
  }
  if (tags.length === 0) {
    if (win) tags.push({ label: "Grind win", tone: "good", hint: "A workmanlike win. They count." });
    else tags.push({ label: "Standard loss", tone: "neutral", hint: "Nothing decisive \u2014 review for the small edges." });
  }
  return tags.slice(0, 6);
}

// server/engine/enrich.ts
function enrichMatch(match2, season, pool) {
  const identity = getIdentity(season?.identityId);
  const process2 = computeProcess(match2, identity);
  const verdict = classify(match2.objective.win, process2.score);
  const xpAwarded = matchXp(match2, process2, verdict);
  const flags = matchFlags(match2, pool);
  const tags = matchTags(match2, process2.score);
  return { ...match2, process: process2, verdict, xpAwarded, flags, tags };
}
function enrichAll(matches, seasons, pool) {
  const byId = new Map(seasons.map((s) => [s.id, s]));
  return matches.map((m) => enrichMatch(m, m.seasonId && byId.get(m.seasonId) || null, pool)).sort((a, b) => +new Date(a.playedAt) - +new Date(b.playedAt));
}
function totalXp(enriched) {
  return enriched.reduce(
    (acc, m) => acc + m.xpAwarded.reduce((a, x) => a + x.amount, 0),
    0
  );
}

// server/engine/benchmarks.ts
var RANK_KEYS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER"
];
var RANK_BENCH = {
  IRON: { cs10: 42, deaths15: 3.2, gold15: -400, kp: 44, vision: 0.6, kda: 1.7, solo: 0.4, obj: 3.2 },
  BRONZE: { cs10: 47, deaths15: 3, gold15: -280, kp: 46, vision: 0.65, kda: 1.9, solo: 0.5, obj: 3.6 },
  SILVER: { cs10: 52, deaths15: 2.7, gold15: -160, kp: 48, vision: 0.72, kda: 2.1, solo: 0.6, obj: 4 },
  GOLD: { cs10: 58, deaths15: 2.4, gold15: -40, kp: 51, vision: 0.82, kda: 2.3, solo: 0.8, obj: 4.4 },
  PLATINUM: { cs10: 63, deaths15: 2.1, gold15: 60, kp: 53, vision: 0.92, kda: 2.5, solo: 1, obj: 4.8 },
  EMERALD: { cs10: 67, deaths15: 1.9, gold15: 140, kp: 55, vision: 1.02, kda: 2.7, solo: 1.15, obj: 5.1 },
  DIAMOND: { cs10: 71, deaths15: 1.7, gold15: 240, kp: 57, vision: 1.15, kda: 2.9, solo: 1.35, obj: 5.4 },
  MASTER: { cs10: 75, deaths15: 1.5, gold15: 350, kp: 58, vision: 1.28, kda: 3.1, solo: 1.55, obj: 5.7 },
  GRANDMASTER: { cs10: 78, deaths15: 1.4, gold15: 430, kp: 59, vision: 1.4, kda: 3.3, solo: 1.7, obj: 5.9 },
  CHALLENGER: { cs10: 81, deaths15: 1.3, gold15: 520, kp: 60, vision: 1.5, kda: 3.5, solo: 1.85, obj: 6.1 }
};
function normalizeRank(rank) {
  if (!rank) return null;
  const u = rank.toUpperCase();
  return RANK_KEYS.find((k) => k === u) ?? null;
}
function benchFor(preferred, ownTier) {
  const rank = normalizeRank(preferred) ?? normalizeRank(ownTier) ?? "GOLD";
  return { rank, bench: RANK_BENCH[rank] };
}
var cap = (s) => s[0] + s.slice(1).toLowerCase();
var rankLabel = (k) => cap(k);
function compareStat(key, label, value, benchmark, unit, direction) {
  const better = value != null && (direction === "higher" ? value >= benchmark : value <= benchmark);
  let pct2 = 50;
  if (value != null) {
    const mag = Math.max(1, Math.abs(benchmark));
    const imp = direction === "higher" ? value - benchmark : benchmark - value;
    pct2 = Math.max(4, Math.min(100, Math.round(50 + imp / mag * 50)));
  }
  return { key, label, value, benchmark, unit, direction, better, pct: pct2 };
}
var ARAM_REF = { kda: 2.6, kp: 62, dmgShare: 22, csmin: 4.6 };
function matchComparison(o, bench, isAram2) {
  const durMin = o.durationSec ? o.durationSec / 60 : null;
  const kda2 = o.kills != null && o.deaths != null && o.assists != null ? Math.round((o.kills + o.assists) / Math.max(1, o.deaths) * 10) / 10 : null;
  const kp = o.killParticipation != null ? Math.round(o.killParticipation * 100) : null;
  if (isAram2) {
    const dmgShare = o.teamDamageShare != null ? Math.round(o.teamDamageShare * 100) : null;
    const csmin = o.totalCs != null && durMin ? Math.round(o.totalCs / durMin * 10) / 10 : null;
    return [
      compareStat("kda", "KDA", kda2, ARAM_REF.kda, "", "higher"),
      compareStat("kp", "Kill participation", kp, ARAM_REF.kp, "%", "higher"),
      compareStat("dmgshare", "Damage share", dmgShare, ARAM_REF.dmgShare, "%", "higher"),
      compareStat("csmin", "CS / min", csmin, ARAM_REF.csmin, "", "higher")
    ].filter((c) => c.value != null);
  }
  const vision = o.visionScore != null && durMin ? Math.round(o.visionScore / durMin * 100) / 100 : null;
  const objs = o.dragons == null && o.heralds == null && o.barons == null ? null : (o.dragons ?? 0) + (o.heralds ?? 0) + (o.barons ?? 0);
  return [
    compareStat("cs10", "CS @ 10", o.csAt10 ?? null, bench.cs10, "", "higher"),
    compareStat("deaths15", "Deaths before 15", o.deathsBefore15 ?? null, bench.deaths15, "", "lower"),
    compareStat("gold15", "Gold @ 15", o.goldDiffAt15 ?? null, bench.gold15, "gold", "higher"),
    compareStat("kp", "Kill participation", kp, bench.kp, "%", "higher"),
    compareStat("vision", "Vision / min", vision, bench.vision, "", "higher"),
    compareStat("kda", "KDA", kda2, bench.kda, "", "higher"),
    compareStat("solo", "Solo kills", o.soloKills ?? null, bench.solo, "", "higher"),
    compareStat("obj", "Team objectives", objs, bench.obj, "", "higher")
  ].filter((c) => c.value != null);
}

// server/engine/insights.ts
var wr = (ms) => ms.length ? Math.round(ms.filter((m) => m.objective.win).length / ms.length * 100) : 0;
var SPLITS = [
  {
    id: "cs10",
    icon: "ti-pick",
    when: (m) => m.objective.csAt10 == null ? null : m.objective.csAt10 >= 70,
    headline: (a) => `You win ${a}% when you hit 70 CS by 10`,
    detail: (a, b) => `Versus ${b}% when you don't. Farming the early game is your single highest-leverage habit.`,
    href: "/progress",
    goodWhenAHigher: true
  },
  {
    id: "early_deaths",
    icon: "ti-skull",
    when: (m) => m.objective.deathsBefore15 == null ? null : m.objective.deathsBefore15 <= 1,
    headline: (a) => `${a}% win rate when you survive the early game`,
    detail: (a, b) => `With 1 or fewer deaths before 15 you win ${a}%; with more it drops to ${b}%. Stay alive, stay ahead.`,
    href: "/progress",
    goodWhenAHigher: true
  },
  {
    id: "calm",
    icon: "ti-flame",
    when: (m) => m.scorecard.tiltBefore <= 1,
    headline: (a) => `Calm queues win ${a}% for you`,
    detail: (a, b) => `Queueing calm you win ${a}%; queueing hot, ${b}%. The tilt tax is real \u2014 take the break.`,
    href: "/progress",
    goodWhenAHigher: true
  },
  {
    id: "flame",
    icon: "ti-message-report",
    when: (m) => !m.scorecard.flamed,
    headline: (a) => `Muted, you win ${a}%`,
    detail: (a, b) => `When you don't type you win ${a}%; when you flame, ${b}%. Chat has never carried a game.`,
    href: null,
    goodWhenAHigher: true
  },
  {
    id: "kp",
    icon: "ti-users",
    when: (m) => m.objective.killParticipation == null ? null : m.objective.killParticipation >= 0.6,
    headline: (a) => `${a}% win rate when you're in the fights`,
    detail: (a, b) => `With 60%+ kill participation you win ${a}%; below that, ${b}%. Show up for the map's plays.`,
    href: "/progress",
    goodWhenAHigher: true
  },
  {
    id: "gold15",
    icon: "ti-coins",
    when: (m) => m.objective.goldDiffAt15 == null ? null : m.objective.goldDiffAt15 >= 0,
    headline: (a) => `Even-or-ahead at 15 \u2192 ${a}% wins`,
    detail: (a, b) => `When you're not behind in gold at 15 you win ${a}%; behind, ${b}%. The lane still decides a lot.`,
    href: "/progress",
    goodWhenAHigher: true
  },
  {
    id: "low_deaths",
    icon: "ti-shield-half",
    when: (m) => m.objective.deaths == null ? null : m.objective.deaths <= 4,
    headline: (a) => `Under 5 deaths, you win ${a}%`,
    detail: (a, b) => `Keeping deaths to 4 or fewer wins ${a}%; more than that drops to ${b}%. Fewer deaths, more wins.`,
    href: "/progress",
    goodWhenAHigher: true
  },
  {
    id: "objectives",
    icon: "ti-topology-star-3",
    when: (m) => {
      const o = m.objective;
      if (o.dragons == null && o.heralds == null && o.barons == null) return null;
      return (o.dragons ?? 0) + (o.heralds ?? 0) + (o.barons ?? 0) >= 4;
    },
    headline: (a) => `${a}% when your team stacks objectives`,
    detail: (a, b) => `Games with 4+ major objectives win ${a}%; fewer, ${b}%. Play the map, not just the lane.`,
    href: "/progress",
    goodWhenAHigher: true
  }
];
function daySessionPosition(career) {
  const pos = /* @__PURE__ */ new Map();
  const byDay = /* @__PURE__ */ new Map();
  for (const m of career) {
    const d = new Date(m.playedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    (byDay.get(key) ?? byDay.set(key, []).get(key)).push(m);
  }
  for (const ms of byDay.values()) {
    ms.sort((a, b) => +new Date(a.playedAt) - +new Date(b.playedAt));
    ms.forEach((m, i) => pos.set(m.id, i));
  }
  return pos;
}
function buildInsights(career) {
  if (career.length < 6) return [];
  const out = [];
  for (const sp of SPLITS) {
    const a = career.filter((m) => sp.when(m) === true);
    const b = career.filter((m) => sp.when(m) === false);
    if (a.length < 4 || b.length < 4) continue;
    const wa = wr(a);
    const wb = wr(b);
    const gap = wa - wb;
    if (Math.abs(gap) < 12) continue;
    if (sp.goodWhenAHigher && gap < 0) continue;
    if (!sp.goodWhenAHigher && gap > 0) continue;
    const tone = sp.goodWhenAHigher ? "good" : "bad";
    out.push({
      gap: Math.abs(gap),
      insight: {
        id: sp.id,
        tone,
        icon: sp.icon,
        title: sp.headline(wa, wb),
        detail: sp.detail(wa, wb),
        href: sp.href
      }
    });
  }
  const pos = daySessionPosition(career);
  const fresh = career.filter((m) => (pos.get(m.id) ?? 0) <= 1);
  const deep = career.filter((m) => (pos.get(m.id) ?? 0) >= 3);
  if (fresh.length >= 4 && deep.length >= 4) {
    const wf = wr(fresh);
    const wd = wr(deep);
    if (wf - wd >= 12) {
      out.push({
        gap: wf - wd,
        insight: {
          id: "fatigue",
          tone: "bad",
          icon: "ti-battery-2",
          title: `Your win rate falls to ${wd}% deep in a session`,
          detail: `Games 1\u20132 of a session win ${wf}%; game 4+ drops to ${wd}%. This is where the "one more" habit costs you LP.`,
          href: "/progress"
        }
      });
    }
  }
  const byChamp = /* @__PURE__ */ new Map();
  for (const m of career) {
    const c = m.objective.champion;
    if (!c) continue;
    (byChamp.get(c) ?? byChamp.set(c, []).get(c)).push(m);
  }
  const champStats = [...byChamp.entries()].filter(([, ms]) => ms.length >= 3).map(([champion, ms]) => ({
    champion,
    games: ms.length,
    proc: Math.round(ms.reduce((a, m) => a + m.process.score, 0) / ms.length)
  }));
  if (champStats.length >= 2) {
    const byProc = [...champStats].sort((a, b) => b.proc - a.proc);
    const byGames = [...champStats].sort((a, b) => b.games - a.games);
    const best2 = byProc[0];
    if (best2.champion !== byGames[0].champion && best2.proc - byProc[byProc.length - 1].proc >= 8) {
      out.push({
        gap: 20,
        insight: {
          id: "champ_mismatch",
          tone: "neutral",
          icon: "ti-star",
          title: `${best2.champion} is your highest-process champ`,
          detail: `Process ${best2.proc} on ${best2.champion}, yet ${byGames[0].champion} gets more games. Consider leaning into what works.`,
          href: `/champions/${best2.champion}`
        }
      });
    }
  }
  return out.sort((a, b) => b.gap - a.gap).slice(0, 6).map((x) => x.insight);
}
function championPersonalTier(winRate, avgProcess, games) {
  const score = winRate * 0.5 + avgProcess * 0.5;
  const confidence = Math.min(1, games / 6);
  const adjusted = 40 + (score - 40) * confidence;
  if (adjusted >= 70) return "S";
  if (adjusted >= 60) return "A";
  if (adjusted >= 50) return "B";
  if (adjusted >= 42) return "C";
  return "D";
}
function championForm(processChrono) {
  if (processChrono.length < 4) return "flat";
  const half = Math.floor(processChrono.length / 2);
  const early = processChrono.slice(0, half);
  const late2 = processChrono.slice(half);
  const avg8 = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const delta = avg8(late2) - avg8(early);
  if (delta >= 5) return "up";
  if (delta <= -5) return "down";
  return "flat";
}

// server/engine/championTrack.ts
var sum = (ms, pick) => ms.reduce((a, m) => a + (pick(m) ?? 0), 0);
var count = (ms, pred) => ms.filter(pred).length;
var best = (ms, pick) => ms.reduce((a, m) => Math.max(a, pick(m) ?? 0), 0);
var kCompact = (v) => v >= 1e3 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`;
var MILESTONES = [
  {
    id: "games",
    label: "Games mastered",
    unit: "games",
    tiers: [10, 25, 60],
    agg: (ms) => ms.length,
    detail: (v) => `${v} games played`
  },
  {
    id: "wins",
    label: "Victories",
    unit: "wins",
    tiers: [5, 15, 35],
    agg: (ms) => count(ms, (m) => !!m.objective.win),
    detail: (v) => `${v} wins`
  },
  {
    id: "takedowns",
    label: "Takedown collector",
    unit: "takedowns",
    tiers: [100, 400, 1e3],
    agg: (ms) => sum(ms, (m) => (m.objective.kills ?? 0) + (m.objective.assists ?? 0)),
    detail: (v) => `${v} kills + assists`
  },
  {
    id: "flawless",
    label: "Flawless openings",
    unit: "games",
    tiers: [3, 10, 25],
    agg: (ms) => count(ms, (m) => m.objective.deathsBefore15 != null && m.objective.deathsBefore15 <= 1),
    detail: (v) => `${v} games with \u22641 death before 15`
  },
  {
    id: "damage",
    label: "Damage dealt",
    unit: "dmg",
    tiers: [5e4, 2e5, 6e5],
    agg: (ms) => sum(ms, (m) => m.objective.damageToChampions),
    fmt: kCompact,
    detail: (v) => `${kCompact(v)} damage to champions`
  },
  {
    id: "playmaker",
    label: "High-impact games",
    unit: "games",
    tiers: [3, 12, 30],
    agg: (ms) => count(ms, (m) => (m.objective.killParticipation ?? 0) >= 0.6),
    detail: (v) => `${v} games at 60%+ kill participation`
  },
  {
    id: "objectives",
    label: "Objectives secured",
    unit: "objectives",
    tiers: [15, 60, 150],
    agg: (ms) => sum(
      ms,
      (m) => (m.objective.dragons ?? 0) + (m.objective.heralds ?? 0) + (m.objective.barons ?? 0)
    ),
    detail: (v) => `${v} drakes / heralds / barons on your teams`
  },
  // --- role-specific ---
  {
    id: "solo_kills",
    label: "Solo kills",
    unit: "kills",
    tiers: [5, 25, 75],
    roles: ["TOP", "MID", "BOT", "UNKNOWN"],
    agg: (ms) => sum(ms, (m) => m.objective.soloKills),
    detail: (v) => `${v} 1v1 kills`
  },
  {
    id: "cs_best",
    label: "Best CS @ 10",
    unit: "cs",
    tiers: [70, 85, 100],
    roles: ["TOP", "MID", "BOT", "JUNGLE", "UNKNOWN"],
    agg: (ms) => best(ms, (m) => m.objective.csAt10),
    detail: (v) => `best game: ${v} CS at 10`
  },
  {
    id: "vision",
    label: "Vision score",
    unit: "vision",
    tiers: [200, 800, 2500],
    roles: ["SUPPORT", "JUNGLE"],
    agg: (ms) => sum(ms, (m) => m.objective.visionScore),
    fmt: kCompact,
    detail: (v) => `${kCompact(v)} lifetime vision score`
  }
];
var RANKS = [
  { min: 0.85, title: "Virtuoso" },
  { min: 0.6, title: "Expert" },
  { min: 0.4, title: "Adept" },
  { min: 0.2, title: "Apprentice" },
  { min: 1e-4, title: "Initiate" },
  { min: 0, title: "Unproven" }
];
function rankTitle(level, maxLevel) {
  const r = maxLevel ? level / maxLevel : 0;
  return RANKS.find((x) => r >= x.min).title;
}
function inferRole(ms, hint) {
  const counts = /* @__PURE__ */ new Map();
  for (const m of ms) {
    const r = m.objective.role;
    if (!r || r === "UNKNOWN") continue;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ?? (hint && hint !== "UNKNOWN" ? hint : "UNKNOWN");
}
function buildMilestone(d, ms) {
  const value = Math.round(d.agg(ms));
  let tierIndex = 0;
  for (const t of d.tiers) if (value >= t) tierIndex++;
  const maxed = tierIndex >= d.tiers.length;
  const prev = tierIndex === 0 ? 0 : d.tiers[tierIndex - 1];
  const nextTarget = maxed ? null : d.tiers[tierIndex];
  const pct2 = maxed ? 100 : Math.max(0, Math.min(100, Math.round((value - prev) / (nextTarget - prev) * 100)));
  return {
    id: d.id,
    label: d.label,
    unit: d.unit,
    tiers: d.tiers,
    value,
    tierIndex,
    nextTarget,
    pct: pct2,
    detail: d.detail(value, tierIndex),
    tone: tierIndex >= 2 ? "good" : "neutral"
  };
}
function buildChampionTrack(champion, ms, roleHint) {
  const role = inferRole(ms, roleHint);
  const defs = MILESTONES.filter((d) => !d.roles || d.roles.includes(role));
  const milestones = defs.map((d) => buildMilestone(d, ms));
  const level = milestones.reduce((a, m) => a + m.tierIndex, 0);
  const maxLevel = milestones.length * 3;
  const nextUp = milestones.filter((m) => m.nextTarget != null).sort((a, b) => b.pct - a.pct)[0] ?? null;
  return {
    champion,
    role,
    games: ms.length,
    level,
    maxLevel,
    rank: rankTitle(level, maxLevel),
    pct: maxLevel ? Math.round(level / maxLevel * 100) : 0,
    milestones,
    nextUp
  };
}

// server/engine/championStats.ts
function buildChampionStats(enriched, pool) {
  const poolTier2 = (champ) => pool.find((p) => p.champion.toLowerCase() === champ.toLowerCase())?.tier ?? null;
  const groups = /* @__PURE__ */ new Map();
  for (const m of enriched) {
    const c = m.objective.champion;
    if (!c) continue;
    (groups.get(c) ?? groups.set(c, []).get(c)).push(m);
  }
  return [...groups.entries()].map(([champion, ms]) => {
    const wins = ms.filter((m) => m.objective.win).length;
    const winRate = Math.round(wins / ms.length * 100);
    const avgProcess = Math.round(
      ms.reduce((a2, m) => a2 + m.process.score, 0) / ms.length
    );
    const k = ms.reduce((a2, m) => a2 + (m.objective.kills ?? 0), 0);
    const d = ms.reduce((a2, m) => a2 + (m.objective.deaths ?? 0), 0);
    const a = ms.reduce((acc, m) => acc + (m.objective.assists ?? 0), 0);
    const r1 = (n) => Math.round(n * 10) / 10;
    const csGames = ms.filter((m) => m.objective.totalCs != null);
    const totalCs = csGames.reduce((acc, m) => acc + (m.objective.totalCs ?? 0), 0);
    const totalMin = csGames.reduce((acc, m) => acc + (m.objective.durationSec ? m.objective.durationSec / 60 : 0), 0);
    const track = buildChampionTrack(champion, ms);
    return {
      champion,
      tier: poolTier2(champion),
      games: ms.length,
      wins,
      winRate,
      avgProcess,
      netLp: ms.reduce((acc, m) => acc + (m.objective.lpDelta ?? 0), 0),
      personalTier: championPersonalTier(winRate, avgProcess, ms.length),
      form: championForm(ms.map((m) => m.process.score)),
      kda: Math.round((k + a) / Math.max(1, d) * 10) / 10,
      avgKills: r1(k / ms.length),
      avgDeaths: r1(d / ms.length),
      avgAssists: r1(a / ms.length),
      avgCs: csGames.length ? Math.round(totalCs / csGames.length) : 0,
      csPerMin: totalMin ? r1(totalCs / totalMin) : 0,
      masteryLevel: track.level,
      masteryRank: track.rank,
      role: track.role
    };
  }).sort((x, y) => y.games - x.games);
}

// server/engine/quests.ts
var DEFS = [
  {
    id: "no_early_deaths",
    title: "No Early Deaths",
    description: "Max 1 death before 10 minutes.",
    scope: "daily",
    xp: 20,
    target: 2,
    focusKey: "clean_early",
    predicate: (m) => (m.objective.deathsBefore10 ?? 0) <= 1
  },
  {
    id: "clean_early",
    title: "Clean Early Game",
    description: "\u22642 deaths before 15 and not behind in gold.",
    scope: "daily",
    xp: 20,
    target: 2,
    focusKey: "clean_early",
    predicate: (m) => (m.objective.deathsBefore15 ?? 99) <= 2 && (m.objective.goldDiffAt15 ?? 0) >= -500
  },
  {
    id: "cs_milestone",
    title: "CS Milestone",
    description: "70+ CS at 10 minutes.",
    scope: "daily",
    xp: 15,
    target: 2,
    focusKey: "cs_milestone",
    predicate: (m) => (m.objective.csAt10 ?? 0) >= 70
  },
  {
    id: "not_first_dead",
    title: "Not First to Die",
    description: "Self-report: you weren't the opener in the fights that mattered.",
    scope: "daily",
    xp: 20,
    target: 2,
    focusKey: "not_first_dead",
    predicate: (m) => m.scorecard.firstDeathCause !== "teamfight_execution" && m.scorecard.firstDeathCause !== "facecheck"
  },
  {
    id: "objective_present",
    title: "Present for Objectives",
    description: "Grade the game B or better \u2014 you were where the map needed you.",
    scope: "daily",
    xp: 15,
    target: 2,
    focusKey: "objective_present",
    predicate: (m) => ["A", "B"].includes(m.scorecard.grade)
  },
  {
    id: "reset_discipline",
    title: "Reset Discipline",
    description: "No greedy-recall first deaths.",
    scope: "daily",
    xp: 15,
    target: 3,
    focusKey: "reset_discipline",
    predicate: (m) => m.scorecard.firstDeathCause !== "greedy_recall"
  },
  {
    id: "no_flame",
    title: "No Flame",
    description: "Zero chat nonsense. Muted when needed.",
    scope: "daily",
    xp: 15,
    target: 3,
    focusKey: "no_flame",
    predicate: (m) => !m.scorecard.flamed && m.scorecard.mutedAppropriately
  },
  {
    id: "adult_in_room",
    title: "The Adult in the Room",
    description: "Ended the game at tilt \u22642 regardless of result.",
    scope: "daily",
    xp: 15,
    target: 2,
    focusKey: "adult_in_room",
    predicate: (m) => m.scorecard.tiltAfter <= 2
  },
  {
    id: "review_streak",
    title: "Review Everything",
    description: "Full review (mistake + adjustment) on every game today.",
    scope: "daily",
    xp: 20,
    target: 3,
    focusKey: "review_streak",
    predicate: (m) => m.scorecard.reviewed && m.scorecard.oneAdjustment.trim().length > 0 && m.scorecard.biggestMistake.trim().length > 0
  }
];
function evaluateQuests(todaysMatches, focusIds) {
  const progress = DEFS.map((def8) => {
    const current = todaysMatches.filter(def8.predicate).length;
    return {
      quest: {
        id: def8.id,
        title: def8.title,
        description: def8.description,
        scope: def8.scope,
        xp: def8.xp
      },
      current: Math.min(current, def8.target),
      target: def8.target,
      complete: current >= def8.target
    };
  });
  return progress.sort((a, b) => {
    const af = focusIds.includes(a.quest.id) ? 0 : 1;
    const bf = focusIds.includes(b.quest.id) ? 0 : 1;
    if (af !== bf) return af - bf;
    return Number(a.complete) - Number(b.complete);
  });
}
var WEEKLY_DEFS = [
  {
    id: "weekly_clean_early",
    title: "Stable Openings",
    description: "Bank 4 clean early games this week.",
    scope: "season",
    xp: 50,
    target: 4,
    focusKey: "clean_early",
    predicate: DEFS.find((d) => d.id === "clean_early").predicate
  },
  {
    id: "weekly_review",
    title: "Review Habit",
    description: "Complete 5 full reviews this week.",
    scope: "season",
    xp: 55,
    target: 5,
    focusKey: "review_streak",
    predicate: DEFS.find((d) => d.id === "review_streak").predicate
  },
  {
    id: "weekly_no_flame",
    title: "Zero Chat Tax",
    description: "Play 6 games with clean comms this week.",
    scope: "season",
    xp: 45,
    target: 6,
    focusKey: "no_flame",
    predicate: DEFS.find((d) => d.id === "no_flame").predicate
  },
  {
    id: "weekly_cs",
    title: "Farm Stays Honest",
    description: "Hit 70+ CS at 10 in 4 games this week.",
    scope: "season",
    xp: 45,
    target: 4,
    focusKey: "cs_milestone",
    predicate: DEFS.find((d) => d.id === "cs_milestone").predicate
  },
  {
    id: "weekly_calm",
    title: "Leave Queue Calm",
    description: "Finish 5 games at tilt 2 or lower this week.",
    scope: "season",
    xp: 45,
    target: 5,
    focusKey: "adult_in_room",
    predicate: DEFS.find((d) => d.id === "adult_in_room").predicate
  }
];
function evaluateWeeklyQuests(recentMatches, focusIds) {
  const progress = WEEKLY_DEFS.map((def8) => {
    const current = recentMatches.filter(def8.predicate).length;
    return {
      quest: {
        id: def8.id,
        title: def8.title,
        description: def8.description,
        scope: def8.scope,
        xp: def8.xp
      },
      current: Math.min(current, def8.target),
      target: def8.target,
      complete: current >= def8.target
    };
  });
  return progress.sort((a, b) => {
    const aDef = WEEKLY_DEFS.find((d) => d.id === a.quest.id);
    const bDef = WEEKLY_DEFS.find((d) => d.id === b.quest.id);
    const af = aDef?.focusKey && focusIds.includes(aDef.focusKey) ? 0 : 1;
    const bf = bDef?.focusKey && focusIds.includes(bDef.focusKey) ? 0 : 1;
    if (af !== bf) return af - bf;
    return Number(a.complete) - Number(b.complete);
  });
}

// server/engine/badges.ts
function longestStreak(ms, pred) {
  const sorted = [...ms].sort(
    (a, b) => +new Date(a.playedAt) - +new Date(b.playedAt)
  );
  let best2 = 0;
  let cur = 0;
  for (const m of sorted) {
    if (pred(m)) cur++, best2 = Math.max(best2, cur);
    else cur = 0;
  }
  return best2;
}
var DEFS2 = [
  {
    id: "no_hero_tax",
    name: "No Hero Tax",
    description: "10 games in a row with no greed/overextension first-death.",
    evaluate: (ms) => {
      const s = longestStreak(
        ms,
        (m) => m.scorecard.firstDeathCause !== "shutdown_donation" && m.scorecard.firstDeathCause !== "overextension" && m.scorecard.firstDeathCause !== "sidelane_greed"
      );
      return { earned: s >= 10, label: `${Math.min(s, 10)}/10 streak` };
    }
  },
  {
    id: "the_monk",
    name: "The Monk",
    description: "Ended 5 sessions after a loss without revenge-queueing (tilt \u22642 on last loss).",
    evaluate: (ms) => {
      const calm = ms.filter(
        (m) => m.objective.win === false && m.scorecard.tiltAfter <= 2
      ).length;
      return { earned: calm >= 5, label: `${Math.min(calm, 5)}/5` };
    }
  },
  {
    id: "the_surgeon",
    name: "The Surgeon",
    description: "20 full reviews \u2014 you can name the exact moment games turned.",
    evaluate: (ms) => {
      const n = ms.filter(
        (m) => m.scorecard.reviewed && m.scorecard.biggestMistake.trim()
      ).length;
      return { earned: n >= 20, label: `${Math.min(n, 20)}/20` };
    }
  },
  {
    id: "stonewall",
    name: "Stonewall",
    description: "8-game streak of clean early games (\u22642 deaths pre-15).",
    evaluate: (ms) => {
      const s = longestStreak(ms, (m) => (m.objective.deathsBefore15 ?? 99) <= 2);
      return { earned: s >= 8, label: `${Math.min(s, 8)}/8 streak` };
    }
  },
  {
    id: "good_loser",
    name: "The Good Loser",
    description: "10 'good losses' \u2014 you kept playing well when the result didn't.",
    evaluate: (ms) => {
      const n = ms.filter((m) => m.verdict === "good_loss").length;
      return { earned: n >= 10, label: `${Math.min(n, 10)}/10` };
    }
  },
  {
    id: "no_flame_100",
    name: "Silent Assassin",
    description: "25 straight games with no flame.",
    evaluate: (ms) => {
      const s = longestStreak(ms, (m) => !m.scorecard.flamed);
      return { earned: s >= 25, label: `${Math.min(s, 25)}/25 streak` };
    }
  },
  {
    id: "adult_in_room",
    name: "Adult in the Room",
    description: "15 games ended at tilt \u22642.",
    evaluate: (ms) => {
      const n = ms.filter((m) => m.scorecard.tiltAfter <= 2).length;
      return { earned: n >= 15, label: `${Math.min(n, 15)}/15` };
    }
  }
];
function evaluateBadges(ms) {
  return DEFS2.map((def8) => {
    const { earned, label } = def8.evaluate(ms);
    return {
      id: def8.id,
      name: def8.name,
      description: def8.description,
      earned,
      progressLabel: label
    };
  });
}

// server/engine/session.ts
function groupSessions(matches, gapMinutes) {
  const sorted = [...matches].sort(
    (a, b) => +new Date(a.playedAt) - +new Date(b.playedAt)
  );
  const groups = [];
  const gapMs = gapMinutes * 6e4;
  for (const m of sorted) {
    const last = groups[groups.length - 1];
    if (!last) {
      groups.push([m]);
      continue;
    }
    const prev = last[last.length - 1];
    if (+new Date(m.playedAt) - +new Date(prev.playedAt) > gapMs) {
      groups.push([m]);
    } else {
      last.push(m);
    }
  }
  return groups.map(summarize);
}
function summarize(games) {
  const wins = games.filter((g) => g.objective.win).length;
  const losses = games.filter((g) => g.objective.win === false).length;
  const netLp = games.reduce((a, g) => a + (g.objective.lpDelta ?? 0), 0);
  const avgProcess = Math.round(
    games.reduce((a, g) => a + g.process.score, 0) / games.length
  );
  const peakTilt = Math.max(...games.map((g) => g.scorecard.tiltAfter), 0);
  let currentLossStreak = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if (games[i].objective.win === false) currentLossStreak++;
    else break;
  }
  const guardrails = evaluateGuardrails(games, {
    currentLossStreak,
    peakTilt
  });
  const healthScore = sessionHealth(games, peakTilt, avgProcess);
  return {
    id: games[0].id,
    startedAt: games[0].playedAt,
    endedAt: games[games.length - 1].playedAt,
    matchIds: games.map((g) => g.id),
    games: games.length,
    wins,
    losses,
    netLp,
    avgProcess,
    currentLossStreak,
    peakTilt,
    guardrails,
    healthScore
  };
}
function evaluateGuardrails(games, ctx) {
  const rails = [];
  const last = games[games.length - 1];
  const tiltAfter = last?.scorecard.tiltAfter ?? 0;
  if (ctx.currentLossStreak === 2 && tiltAfter >= 3) {
    rails.push({
      code: "best_of_3",
      severity: "caution",
      title: "Best-of-3 broken",
      message: "Two down and the temperature's up. One more game \u2014 but decide now that it's the LAST one, win or lose. Don't let the queue decide for you."
    });
  }
  if (ctx.currentLossStreak >= 3 || tiltAfter >= 4) {
    rails.push({
      code: "hard_stop",
      severity: "stop",
      title: "Hard stop recommended",
      message: ctx.currentLossStreak >= 3 ? "Three straight. Your MMR is fine tomorrow; your judgment is not fine right now. The Monk move is to close the client. Log it as a win for the mental game." : "Tilt is at molten. Nothing good queues from here. Stop is the correct play \u2014 that's not weakness, it's the read."
    });
  }
  if (games.length >= 2) {
    const prev = games[games.length - 2];
    const gapMin = (+new Date(last.playedAt) - +new Date(prev.playedAt)) / 6e4;
    if (prev.objective.win === false && prev.scorecard.tiltAfter >= 4 && gapMin < 8) {
      rails.push({
        code: "casino",
        severity: "caution",
        title: "The casino has you",
        message: "You re-queued fuming, fast, to 'fix it.' That's the one-more-to-get-it-back reflex. The house wins those. Step away for ten minutes before the next call."
      });
    }
  }
  if (games.length >= 6) {
    rails.push({
      code: "fatigue",
      severity: "info",
      title: "Long session",
      message: `${games.length} games in. Focus decays even when tilt doesn't. If the last two felt sloppy rather than tilted, that's fatigue \u2014 a clean stop beats a foggy climb.`
    });
  }
  return rails;
}
function sessionHealth(games, peakTilt, avgProcess) {
  let score = avgProcess;
  score -= peakTilt * 4;
  if (games.some((g) => g.scorecard.flamed)) score -= 10;
  const trailingLosses = trailing(games);
  if (trailingLosses >= 3) score -= 15;
  if (games.length > 6) score -= (games.length - 6) * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}
function trailing(games) {
  let n = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if (games[i].objective.win === false) n++;
    else break;
  }
  return n;
}

// server/engine/recommend.ts
var MIN_GAMES = 5;
var WINDOW = 20;
var DIAGS = [
  { key: "cs10", templateId: "cs10", benchmark: 70, identities: ["lane_bully"], weakNote: "you're leaving gold on the map - farm is a free lead" },
  { key: "gold15", templateId: "gold_diff_15", benchmark: 250, identities: ["lane_bully"], weakNote: "you're not translating lane into a gold lead" },
  { key: "deaths15", templateId: "deaths_before_15", benchmark: 2, identities: ["stonewall"], weakNote: "early deaths are handing the enemy tempo before the game starts" },
  { key: "deaths", templateId: "deaths_per_game", benchmark: 5, identities: ["stonewall"], weakNote: "total deaths are high - you're donating shutdowns" },
  { key: "kp", templateId: "kill_participation", benchmark: 55, identities: ["teamfight_architect"], weakNote: "you're missing the fights that decide games" },
  { key: "objectives", templateId: "objectives", benchmark: 5, identities: ["tempo_goblin"], weakNote: "objective control is thin - the map is slipping" },
  { key: "vision", templateId: "vision_per_min", benchmark: 1, identities: ["tempo_goblin"], weakNote: "you're fighting blind - vision is low" },
  { key: "tilt", templateId: "tilt_control", benchmark: 70, identities: ["shotcaller_monk"], weakNote: "too many games end hot - tilt is following you into queue" },
  { key: "flame", templateId: "no_flame_rate", benchmark: 100, identities: ["shotcaller_monk"], weakNote: "chat is costing you focus" },
  { key: "process", templateId: "avg_process", benchmark: 65, identities: [], weakNote: "overall process needs to come up" }
];
var def2 = (x) => x !== null && x !== void 0;
function assess(value, benchmark, direction) {
  if (value == null) return { status: "watch", severity: 0 };
  let sev = direction === "higher" ? (benchmark - value) / benchmark : (value - benchmark) / benchmark;
  sev = Math.max(0, Math.min(1, sev));
  const status = sev <= 0.05 ? "good" : sev <= 0.2 ? "watch" : "weak";
  return { status, severity: sev };
}
function championStats(ms) {
  const map = /* @__PURE__ */ new Map();
  const byChampion = /* @__PURE__ */ new Map();
  for (const match2 of ms) {
    const champion = match2.objective.champion;
    if (!champion) continue;
    (byChampion.get(champion) ?? byChampion.set(champion, []).get(champion)).push(match2);
  }
  for (const [champion, games] of byChampion) {
    const process2 = games.map((g) => g.process.score);
    const gold15 = games.map((g) => g.objective.goldDiffAt15).filter(def2);
    const deaths15 = games.map((g) => g.objective.deathsBefore15).filter(def2);
    map.set(champion, {
      champion,
      games: games.length,
      avgProcess: Math.round(process2.reduce((a, b) => a + b, 0) / process2.length),
      avgGold15: gold15.length ? Math.round(gold15.reduce((a, b) => a + b, 0) / gold15.length * 10) / 10 : null,
      avgDeaths15: deaths15.length ? Math.round(deaths15.reduce((a, b) => a + b, 0) / deaths15.length * 10) / 10 : null,
      wins: games.filter((g) => g.objective.win).length,
      roles: [...new Set(games.map((g) => g.objective.role).filter(def2))]
    });
  }
  return map;
}
function poolEntryForChampion(pool, champion) {
  return pool.find((p) => p.champion.toLowerCase() === champion.toLowerCase());
}
function fitRole(entry, mainRole) {
  if (!mainRole || mainRole === "UNKNOWN") return true;
  const roles = entry.roles ?? [];
  return roles.length === 0 || roles.includes(mainRole);
}
function chooseFocusChampion(ms, pool, mainRole) {
  const stats = championStats(ms);
  const candidates = pool.filter((entry) => fitRole(entry, mainRole)).map((entry) => {
    const stat = stats.get(entry.champion);
    const tierScore = entry.tier === "main" ? 3 : entry.tier === "secondary" ? 2 : 1;
    const sampleBonus = stat ? Math.min(1.5, stat.games / 4) : 0;
    const processBonus = stat ? stat.avgProcess / 40 : 0;
    return {
      entry,
      stat,
      score: tierScore + sampleBonus + processBonus
    };
  }).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}
function buildRosterRecommendations(ms, pool, mainRole, identityId) {
  const roster = [];
  const focus = chooseFocusChampion(ms, pool, mainRole);
  if (focus) {
    roster.push({
      kind: "commit_existing",
      champion: focus.entry.champion,
      title: `Double down on ${focus.entry.champion}`,
      rationale: focus.stat ? `${focus.entry.champion} is your cleanest ${focus.entry.tier} option right now (${focus.stat.avgProcess} process over ${focus.stat.games} games).` : `${focus.entry.champion} sits in your ${focus.entry.tier} pool and fits the current plan. Stack reps instead of reopening champ select chaos.`,
      roles: focus.entry.roles ?? (mainRole ? [mainRole] : [])
    });
  }
  const promote = pool.find(
    (entry) => entry.tier !== "main" && fitRole(entry, mainRole) && (poolEntryForChampion(pool, entry.champion)?.roles?.length ?? 0) >= 0
  );
  if (promote) {
    roster.push({
      kind: "promote_pool",
      champion: promote.champion,
      title: `Keep ${promote.champion} in the rotation`,
      rationale: `${promote.champion} stays inside the pool as your change-up instead of reaching for an off-pool impulse pick.`,
      roles: promote.roles ?? (mainRole ? [mainRole] : [])
    });
  }
  const alignedPool = pool.filter((entry) => fitRole(entry, mainRole));
  if (alignedPool.length === 0) {
    roster.push({
      kind: "consider_new",
      champion: null,
      title: identityId === "stonewall" ? "Add a steadier anchor pick" : identityId === "lane_bully" ? "Add a lane-pressure backup" : "Add one more role-fit comfort pick",
      rationale: "Your saved pool does not currently show a clear option for this role/plan, so the coach would consider adding one new fit instead of improvising in ranked.",
      roles: mainRole ? [mainRole] : []
    });
  }
  return roster.slice(0, 3);
}
function toInsight(signal) {
  return {
    label: signal.label,
    value: signal.value,
    benchmark: signal.benchmark,
    unit: signal.unit,
    note: signal.note
  };
}
function buildPlan(identityName, identityId, goals, diagnostics, roster, sampleSize) {
  const keepDoing = diagnostics.filter((d) => d.status === "good").slice(0, 3).map(toInsight);
  const fixNext = diagnostics.filter((d) => d.status !== "good" && d.value != null).sort((a, b) => {
    const as = Math.abs(a.benchmark - (a.value ?? 0));
    const bs = Math.abs(b.benchmark - (b.value ?? 0));
    return bs - as;
  }).slice(0, 3).map(toInsight);
  const focusChampion = roster.find((r) => r.champion)?.champion;
  const nameSeed = identityId === "stonewall" ? "Stability Before LP" : identityId === "lane_bully" ? "Cash Out the Lane" : identityId === "tempo_goblin" ? "Play the Map First" : identityId === "teamfight_architect" ? "Fight Later, Better" : "Calm Queue Discipline";
  const theme = fixNext[0]?.label === "Gold lead at 15" ? "Turn playable lanes into actual leads." : fixNext[0]?.label === "Deaths before 15" ? "Keep the game boring until your champ gets to play." : fixNext[0]?.label === "Tilt control" ? "Protect judgment first, LP second." : "Keep the good habits and tighten the biggest leaks.";
  const goal = goals.length > 0 ? `${goals[0].title}${focusChampion ? ` while stacking reps on ${focusChampion}` : ""}.` : "Play a cleaner block than the last 20 games.";
  return {
    name: `${nameSeed}${focusChampion ? `: ${focusChampion}` : ""}`,
    theme,
    goal,
    targetGames: sampleSize >= 12 ? 30 : 20,
    summary: `${identityName} is the right frame for the next block. Keep ${keepDoing.map((x) => x.label.toLowerCase()).join(", ") || "your current strengths"} stable and attack ${fixNext.map((x) => x.label.toLowerCase()).join(", ") || "the next leak"} first.`,
    keepDoing,
    fixNext,
    roster
  };
}
function recommend(recent, pool, mainRole = null) {
  const ms = recent.slice(-WINDOW);
  const enough = ms.length >= MIN_GAMES;
  const diagnostics = [];
  const identityScore = /* @__PURE__ */ new Map();
  const goalCandidates = [];
  for (const cfg of DIAGS) {
    const tpl = getTemplate(cfg.templateId);
    const { value } = tpl.measure(ms);
    const { status, severity } = assess(value, cfg.benchmark, tpl.direction);
    diagnostics.push({
      key: cfg.key,
      label: tpl.title(),
      value,
      benchmark: cfg.benchmark,
      unit: tpl.unit,
      direction: tpl.direction,
      status,
      note: value == null ? "not enough data yet" : status === "good" ? "solid - keep this stable" : cfg.weakNote
    });
    if (value != null && status !== "good") {
      for (const id of cfg.identities) {
        identityScore.set(id, (identityScore.get(id) ?? 0) + severity);
      }
      goalCandidates.push({
        templateId: cfg.templateId,
        category: tpl.category,
        title: tpl.title(),
        description: tpl.describe(cfg.benchmark),
        target: cfg.benchmark,
        unit: tpl.unit,
        direction: tpl.direction,
        rationale: `Currently ${value}${tpl.unit === "%" ? "%" : ` ${tpl.unit}`} - ${cfg.weakNote}.`,
        severity,
        current: value
      });
    }
  }
  const withFights = ms.filter((m) => m.scorecard.firstDeathCause);
  if (withFights.length >= 3) {
    const firstDead = withFights.filter(
      (m) => m.scorecard.firstDeathCause === "teamfight_execution" || m.scorecard.firstDeathCause === "facecheck"
    ).length / withFights.length;
    if (firstDead > 0.3) {
      identityScore.set(
        "teamfight_architect",
        (identityScore.get("teamfight_architect") ?? 0) + firstDead
      );
    }
  }
  let identityId = "stonewall";
  let best2 = -1;
  for (const [id, score] of identityScore) {
    if (score > best2) {
      best2 = score;
      identityId = id;
    }
  }
  const identity = getIdentity(identityId);
  goalCandidates.sort((a, b) => b.severity - a.severity);
  const goals = goalCandidates.slice(0, 4);
  const focus = chooseFocusChampion(ms, pool, mainRole);
  if (focus) {
    for (const goal of goals) {
      if (goal.category !== "mental" && goal.category !== "champion") {
        goal.champion = focus.entry.champion;
        goal.title = getTemplate(goal.templateId)?.title(focus.entry.champion) ?? goal.title;
        goal.description = getTemplate(goal.templateId)?.describe(goal.target, focus.entry.champion) ?? goal.description;
      }
    }
  }
  if (focus && !goals.some((g) => g.templateId === "champion_focus")) {
    const tpl = getTemplate("champion_focus");
    goals.push({
      templateId: "champion_focus",
      category: "champion",
      title: tpl.title(focus.entry.champion),
      description: tpl.describe(10, focus.entry.champion),
      target: 10,
      unit: tpl.unit,
      direction: tpl.direction,
      champion: focus.entry.champion,
      rationale: `Keep the block narrow by stacking reps on ${focus.entry.champion}.`,
      severity: 0.3,
      current: focus.stat?.games ?? null
    });
  }
  const roster = buildRosterRecommendations(ms, pool, mainRole, identityId);
  if (!enough) {
    const starterIds = ["cs10", "deaths_before_15", "avg_process", "tilt_control"];
    const starterGoals = starterIds.map((id) => {
      const tpl = getTemplate(id);
      return {
        templateId: id,
        category: tpl.category,
        title: tpl.title(),
        description: tpl.describe(tpl.defaultTarget),
        target: tpl.defaultTarget,
        unit: tpl.unit,
        direction: tpl.direction,
        rationale: "Starter goal - the coach personalizes this after ~5 logged games.",
        severity: 0.5,
        current: null
      };
    });
    if (focus) {
      const tpl = getTemplate("champion_focus");
      starterGoals.push({
        templateId: "champion_focus",
        category: "champion",
        title: tpl.title(focus.entry.champion),
        description: tpl.describe(10, focus.entry.champion),
        target: 10,
        unit: tpl.unit,
        direction: tpl.direction,
        champion: focus.entry.champion,
        rationale: `Commit reps to ${focus.entry.champion}.`,
        severity: 0.3,
        current: focus.stat?.games ?? null
      });
    }
    return {
      hasEnoughData: false,
      sampleSize: ms.length,
      identityId: "stonewall",
      identityName: getIdentity("stonewall").name,
      identityRationale: "Not enough games yet to read your play. Starting you on The Stonewall Climber - stability first is never the wrong opening.",
      goals: starterGoals,
      diagnostics,
      plan: buildPlan(
        getIdentity("stonewall").name,
        "stonewall",
        starterGoals,
        diagnostics,
        roster,
        ms.length
      )
    };
  }
  const weakest = diagnostics.filter((d) => d.status === "weak" && d.value != null).slice(0, 2).map((d) => d.label.toLowerCase());
  const identityRationale = best2 <= 0 ? `Your recent block looks reasonably balanced over ${ms.length} games. ${identity.name} keeps you consolidating instead of chasing noise.` : `Over your last ${ms.length} games, your biggest leaks (${weakest.join(", ") || "a few areas"}) point at ${identity.name}: ${identity.tagline}`;
  return {
    hasEnoughData: true,
    sampleSize: ms.length,
    identityId,
    identityName: identity.name,
    identityRationale,
    goals,
    diagnostics,
    plan: buildPlan(identity.name, identityId, goals, diagnostics, roster, ms.length)
  };
}

// server/engine/statboard.ts
var def3 = (x) => x !== null && x !== void 0;
var avg2 = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
var perMin = (v, dur) => v != null && dur ? v / (dur / 60) : null;
var round = (v, d = 1) => {
  const p = 10 ** d;
  return Math.round(v * p) / p;
};
var avgOf2 = (ms, pick) => {
  const v = avg2(ms.map(pick).filter(def3));
  return v == null ? null : round(v);
};
var METRICS = [
  {
    id: "winrate",
    label: "Win rate",
    unit: "%",
    direction: "higher",
    hint: "Wins over the window.",
    href: "/progress",
    fmt: (v) => `${Math.round(v)}%`,
    modes: ["sr", "aram"],
    agg: (ms) => ms.length ? Math.round(ms.filter((m) => m.objective.win).length / ms.length * 100) : null
  },
  {
    id: "kda",
    label: "KDA",
    unit: "",
    direction: "higher",
    hint: "(Kills + assists) / deaths.",
    href: "/progress",
    fmt: (v) => `${round(v, 2)}`,
    modes: ["sr", "aram"],
    agg: (ms) => {
      const vals = ms.filter((m) => m.objective.deaths != null).map((m) => (m.objective.kills + m.objective.assists) / Math.max(1, m.objective.deaths));
      return avg2(vals) == null ? null : round(avg2(vals), 2);
    }
  },
  {
    id: "kp",
    label: "Kill participation",
    unit: "%",
    direction: "higher",
    hint: "Share of your team's kills you're part of.",
    href: "/progress",
    fmt: (v) => `${Math.round(v)}%`,
    modes: ["sr", "aram"],
    agg: (ms) => avgOf2(ms, (m) => m.objective.killParticipation != null ? m.objective.killParticipation * 100 : null)
  },
  {
    id: "kills",
    label: "Kills / game",
    unit: "",
    direction: "higher",
    hint: "Average kills \u2014 the ARAM aggression metric.",
    href: "/progress",
    fmt: (v) => `${round(v)}`,
    modes: ["aram"],
    agg: (ms) => avgOf2(ms, (m) => m.objective.kills)
  },
  {
    id: "dmgmin",
    label: "Damage / min",
    unit: "",
    direction: "higher",
    hint: "Damage to champions per minute \u2014 the ARAM output metric.",
    href: "/progress",
    fmt: (v) => `${round(v)}`,
    modes: ["aram"],
    agg: (ms) => avgOf2(ms, (m) => perMin(m.objective.damageToChampions, m.objective.durationSec))
  },
  {
    id: "cs10",
    label: "CS @ 10",
    unit: "",
    direction: "higher",
    hint: "Creep score at 10 minutes.",
    href: "/progress",
    fmt: (v) => `${round(v)}`,
    modes: ["sr"],
    agg: (ms) => avgOf2(ms, (m) => m.objective.csAt10)
  },
  {
    id: "csmin",
    label: "CS / min",
    unit: "",
    direction: "higher",
    hint: "Total creep score per minute.",
    href: "/progress",
    fmt: (v) => `${round(v)}`,
    modes: ["sr"],
    agg: (ms) => avgOf2(ms, (m) => perMin(m.objective.totalCs, m.objective.durationSec))
  },
  {
    id: "gold15",
    label: "Gold @ 15",
    unit: "",
    direction: "higher",
    hint: "Gold difference vs your lane opponent at 15.",
    href: "/progress",
    fmt: (v) => `${v >= 0 ? "+" : ""}${Math.round(v)}`,
    modes: ["sr"],
    agg: (ms) => avgOf2(ms, (m) => m.objective.goldDiffAt15)
  },
  {
    id: "vision",
    label: "Vision / min",
    unit: "",
    direction: "higher",
    hint: "Vision score per minute.",
    href: "/progress",
    fmt: (v) => `${round(v)}`,
    modes: ["sr"],
    agg: (ms) => avgOf2(ms, (m) => perMin(m.objective.visionScore, m.objective.durationSec))
  },
  {
    id: "deaths15",
    label: "Deaths < 15",
    unit: "",
    direction: "lower",
    hint: "Average deaths before 15 minutes. Lower is better.",
    href: "/progress",
    fmt: (v) => `${round(v)}`,
    modes: ["sr"],
    agg: (ms) => avgOf2(ms, (m) => m.objective.deathsBefore15)
  },
  {
    id: "deaths",
    label: "Deaths / game",
    unit: "",
    direction: "lower",
    hint: "Average deaths. Lower is better.",
    href: "/progress",
    fmt: (v) => `${round(v)}`,
    modes: ["sr", "aram"],
    agg: (ms) => avgOf2(ms, (m) => m.objective.deaths)
  },
  {
    id: "process",
    label: "Process",
    unit: "",
    direction: "higher",
    hint: "How well you played, independent of the result.",
    href: "/progress",
    fmt: (v) => `${Math.round(v)}`,
    modes: ["sr", "aram"],
    agg: (ms) => avgOf2(ms, (m) => m.process.score)
  }
];
var PICKS = {
  winrate: (m) => m.objective.win === true ? 100 : m.objective.win === false ? 0 : null,
  kda: (m) => m.objective.deaths != null ? (m.objective.kills + m.objective.assists) / Math.max(1, m.objective.deaths) : null,
  kp: (m) => m.objective.killParticipation != null ? m.objective.killParticipation * 100 : null,
  kills: (m) => m.objective.kills ?? null,
  dmgmin: (m) => perMin(m.objective.damageToChampions, m.objective.durationSec),
  cs10: (m) => m.objective.csAt10 ?? null,
  csmin: (m) => perMin(m.objective.totalCs, m.objective.durationSec),
  gold15: (m) => m.objective.goldDiffAt15 ?? null,
  vision: (m) => perMin(m.objective.visionScore, m.objective.durationSec),
  deaths15: (m) => m.objective.deathsBefore15 ?? null,
  deaths: (m) => m.objective.deaths ?? null,
  process: (m) => m.process.score
};
function buildStatBoard(career, mode = "sr", windowSize = 10) {
  const recent = career.slice(-windowSize);
  const prior = career.slice(-windowSize * 2, -windowSize);
  return METRICS.filter((m) => m.modes.includes(mode)).map((m) => {
    const value = m.agg(recent);
    const baseline = prior.length >= 3 ? m.agg(prior) : null;
    const series = PICKS[m.id] ? recent.map(PICKS[m.id]).filter(def3).map((v) => round(v, 2)) : [];
    const delta = value != null && baseline != null ? round(value - baseline, 2) : null;
    const better = value != null && baseline != null ? m.direction === "higher" ? value > baseline : value < baseline : null;
    return {
      id: m.id,
      label: m.label,
      unit: m.unit,
      value,
      valueFmt: value == null ? "\u2014" : m.fmt(value),
      baseline,
      delta,
      direction: m.direction,
      better,
      hint: m.hint,
      href: m.href,
      series
    };
  });
}

// server/engine/blocks.ts
function queueMatchesBlock(queue, type) {
  if (!type || type === "any") return true;
  const q = (queue ?? "").toUpperCase();
  if (type === "ranked") return q.includes("RANKED");
  if (type === "aram") return q.includes("ARAM");
  if (type === "normal") return q.includes("NORMAL") || q.includes("DRAFT") || q.includes("QUICKPLAY") || q.includes("BLIND");
  return true;
}
function matchInBlock(m, season) {
  if (season.focusChampion && m.objective.champion?.toLowerCase() !== season.focusChampion.toLowerCase()) {
    return false;
  }
  if (!queueMatchesBlock(m.objective.queue, season.blockType)) return false;
  if (m.seasonId === season.id) return true;
  const t = +new Date(m.playedAt);
  return t >= +new Date(season.startedAt) && (!season.endedAt || t <= +new Date(season.endedAt));
}

// server/engine/rollingQuests.ts
var FAMILIES = [
  {
    key: "cs10",
    templateId: "cs10",
    label: "Lane Farm",
    rationale: "Reliable farm is the cleanest lane advantage Riot still makes universally valuable.",
    targetForStage: (stage) => Math.min(85, 70 + stage * 3)
  },
  {
    key: "gold15",
    templateId: "gold_diff_15",
    label: "Lead Conversion",
    rationale: "Riot's objective and map updates keep emphasizing lane priority and converting it into gold and setup.",
    targetForStage: (stage) => 250 + stage * 150
  },
  {
    key: "deaths15",
    templateId: "deaths_before_15",
    label: "Stable Opener",
    rationale: "The first 10-15 minutes decide whether your champion gets to play the game on your terms.",
    targetForStage: (stage) => Math.max(0.5, 2 - stage * 0.25)
  },
  {
    key: "objectives",
    templateId: "objectives",
    label: "Objective Presence",
    rationale: "Riot's recent gameplay notes repeatedly center contested neutral objectives as major turning points.",
    targetForStage: (stage) => 5 + stage
  },
  {
    key: "vision",
    templateId: "vision_per_min",
    label: "Setup Vision",
    rationale: "Objective fights and lane pushes are both easier when you can move first and move informed.",
    targetForStage: (stage) => +(1 + stage * 0.15).toFixed(1)
  },
  {
    key: "close",
    templateId: "close_out_time",
    label: "Close the Door",
    rationale: "A champion that gets ahead should help end games before the map state gets messy again.",
    targetForStage: (stage) => Math.max(24, 30 - stage)
  }
];
var clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
function pct(current, target, direction) {
  if (current == null) return 0;
  if (direction === "higher") return clamp(current / target * 100);
  if (current <= target) return 100;
  return clamp(target / current * 100);
}
function weakOrder(ms, champion, state) {
  const familyScores = FAMILIES.map((family) => {
    const tpl = getTemplate(family.templateId);
    const target = family.targetForStage(state[`${champion}:${family.key}`] ?? 0);
    const measurement = tpl.measure(ms, champion);
    let severity = 0;
    if (measurement.value != null) {
      severity = tpl.direction === "higher" ? Math.max(0, (target - measurement.value) / Math.max(1, target)) : Math.max(0, (measurement.value - target) / Math.max(1, target));
    }
    return { family, tpl, measurement, target, severity };
  });
  return familyScores.sort((a, b) => b.severity - a.severity);
}
function buildRollingQuests(matches, champion, state) {
  if (!champion) return [];
  const scored = weakOrder(matches, champion, state).slice(0, 3);
  return scored.map(({ family, tpl, measurement, target }) => {
    const stage = state[`${champion}:${family.key}`] ?? 0;
    const id = `${champion}:${family.key}:${stage}`;
    const current = measurement.value;
    return {
      id,
      familyKey: `${champion}:${family.key}`,
      champion,
      title: `${champion}: ${family.label}`,
      description: tpl.describe(target, champion),
      current,
      target,
      unit: tpl.unit,
      direction: tpl.direction,
      pct: pct(current, target, tpl.direction),
      complete: current != null && (tpl.direction === "higher" ? current >= target : current <= target),
      rationale: family.rationale,
      stage
    };
  });
}

// server/riot.ts
var ACCOUNT_CLUSTER = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",
  kr: "asia",
  jp1: "asia",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe"
};
var MATCH_ROUTE = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  kr: "asia",
  jp1: "asia",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  oc1: "sea"
};
var QUEUE_NAMES = {
  420: "RANKED_SOLO_5x5",
  440: "RANKED_FLEX_SR",
  400: "NORMAL_DRAFT",
  430: "NORMAL_BLIND",
  480: "SWIFTPLAY",
  490: "NORMAL_QUICKPLAY",
  700: "CLASH",
  450: "ARAM",
  // Non-Rift / rotating modes.
  1700: "ARENA",
  1710: "ARENA",
  1300: "NEXUS_BLITZ",
  1900: "URF",
  900: "ARURF",
  720: "ARAM_CLASH",
  1200: "NEXUS_BLITZ",
  1e3: "ARAM_MAYHEM",
  1010: "ARAM_MAYHEM"
};
var ARENA_QUEUES = /* @__PURE__ */ new Set([1700, 1710]);
var NO_LANE_QUEUES = /* @__PURE__ */ new Set([450, 1700, 1710, 1e3, 1010, 900, 1900, 1300, 1200]);
var POSITION_TO_ROLE = {
  TOP: "TOP",
  JUNGLE: "JUNGLE",
  MIDDLE: "MID",
  BOTTOM: "BOT",
  UTILITY: "SUPPORT"
};
var RiotError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  status;
};
var RiotClient = class {
  constructor(apiKey, gameName, tagLine, platform) {
    this.apiKey = apiKey;
    this.gameName = gameName;
    this.tagLine = tagLine;
    this.platform = platform;
  }
  apiKey;
  gameName;
  tagLine;
  platform;
  get accountCluster() {
    return ACCOUNT_CLUSTER[this.platform] ?? "americas";
  }
  get matchRoute() {
    return MATCH_ROUTE[this.platform] ?? "americas";
  }
  async get(url) {
    const res = await fetch(url, { headers: { "X-Riot-Token": this.apiKey } });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.status?.message ?? detail;
      } catch {
      }
      const hint = res.status === 401 || res.status === 403 ? " (check your RIOT_API_KEY \u2014 dev keys expire every 24h)" : res.status === 404 ? " (not found \u2014 check your Riot ID / platform)" : res.status === 429 ? " (rate limited \u2014 wait a moment)" : "";
      throw new RiotError(res.status, `Riot API ${res.status}: ${detail}${hint}`);
    }
    return res.json();
  }
  async getPuuid() {
    const url = `https://${this.accountCluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      this.gameName
    )}/${encodeURIComponent(this.tagLine)}`;
    const acc = await this.get(url);
    return acc.puuid;
  }
  async getRank(puuid) {
    const entries = await this.get(
      `https://${this.platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`
    );
    const mk = (e) => e ? { tier: e.tier, division: e.rank, leaguePoints: e.leaguePoints } : null;
    const solo = mk(entries.find((e) => e.queueType === "RANKED_SOLO_5x5"));
    const flex = mk(entries.find((e) => e.queueType === "RANKED_FLEX_SR"));
    const primary = solo ?? flex ?? mk(entries[0]);
    return { ...primary ?? {}, solo, flex };
  }
  // Top champion masteries straight from Riot — the real "main", independent of
  // which games we've captured. championId is the numeric key (map via DDragon).
  async getTopMastery(puuid, count3 = 3) {
    const rows = await this.get(
      `https://${this.platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count3}`
    );
    return rows.map((r) => ({ championId: r.championId, level: r.championLevel, points: r.championPoints }));
  }
  async getSummonerInfo(puuid) {
    const s = await this.get(
      `https://${this.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
    );
    return { level: s.summonerLevel ?? null, profileIconId: s.profileIconId ?? null };
  }
  // startTime (epoch seconds) scopes the pull to a season/window; start paginates.
  async getRecentMatchIds(puuid, count3 = 10, queue, startTime, start = 0) {
    const q = queue ? `&queue=${queue}` : "";
    const st = startTime ? `&startTime=${startTime}` : "";
    return this.get(
      `https://${this.matchRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${count3}${q}${st}`
    );
  }
  get platformHost() {
    return this.platform;
  }
  // Full 10-player scoreboard for a match (iTero-style match detail), including
  // each player's build, summoner spells, and rune style ids (icons resolved
  // by the caller against Data Dragon).
  async getMatchScoreboard(matchId, myPuuid) {
    const match2 = await this.get(
      `https://${this.matchRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}`
    );
    const info = match2.info;
    const players = (info.participants ?? []).map((p) => {
      const core = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((i) => i > 0);
      const styles = p.perks?.styles ?? [];
      const keystone = styles[0]?.selections?.[0]?.perk ?? null;
      const secondaryStyle = styles[1]?.style ?? null;
      return {
        champion: p.championName,
        name: p.riotIdGameName ?? p.summonerName ?? "",
        tagLine: p.riotIdTagline ?? "",
        kills: p.kills ?? 0,
        deaths: p.deaths ?? 0,
        assists: p.assists ?? 0,
        damage: p.totalDamageDealtToChampions ?? 0,
        damageTaken: p.totalDamageTaken ?? 0,
        cs: (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0),
        gold: p.goldEarned ?? 0,
        wards: p.wardsPlaced ?? 0,
        visionScore: p.visionScore ?? 0,
        level: p.champLevel ?? 0,
        role: POSITION_TO_ROLE[p.teamPosition] ?? "UNKNOWN",
        team: p.teamId === 100 ? "BLUE" : "RED",
        win: !!p.win,
        isMe: p.puuid === myPuuid,
        items: core,
        trinket: p.item6 ?? 0,
        spells: [p.summoner1Id ?? 0, p.summoner2Id ?? 0],
        _keystone: keystone,
        _secondaryStyle: secondaryStyle
      };
    });
    return { players, durationSec: info.gameDuration ?? 0 };
  }
  // Per-minute series for all ten players: gold, xp, and cs. Index-aligned to
  // the participants array we return alongside.
  async getMatchTimeline(matchId, myPuuid) {
    const match2 = await this.get(
      `https://${this.matchRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}`
    );
    const pids = match2.metadata.participants;
    const participants = (match2.info.participants ?? []).map((p) => ({
      champion: p.championName,
      name: p.riotIdGameName ?? p.summonerName ?? "",
      team: p.teamId === 100 ? "BLUE" : "RED",
      isMe: p.puuid === myPuuid
    }));
    const timeline = await this.get(
      `https://${this.matchRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`
    );
    const rawFrames = timeline.info?.frames ?? [];
    const order = pids.map((_, i) => String(i + 1));
    const frames = rawFrames.map((f) => {
      const pf = f.participantFrames ?? {};
      const read = (fn) => order.map((k) => fn(pf[k] ?? {}));
      return {
        minute: Math.round((f.timestamp ?? 0) / 6e4),
        gold: read((x) => x.totalGold ?? 0),
        xp: read((x) => x.xp ?? 0),
        cs: read((x) => (x.minionsKilled ?? 0) + (x.jungleMinionsKilled ?? 0))
      };
    });
    return { participants, frames };
  }
  async getObjectiveData(matchId, puuid) {
    const match2 = await this.get(
      `https://${this.matchRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}`
    );
    const info = match2.info;
    const participants = match2.metadata.participants;
    const idx = participants.indexOf(puuid);
    const me = info.participants[idx];
    const myPid = idx + 1;
    const side = me.teamId === 100 ? "BLUE" : "RED";
    const role = POSITION_TO_ROLE[me.teamPosition] ?? "UNKNOWN";
    const queueId = info.queueId;
    const isArena = ARENA_QUEUES.has(queueId);
    const noLane = NO_LANE_QUEUES.has(queueId);
    const opp = !noLane && me.teamPosition ? info.participants.find(
      (p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition
    ) : void 0;
    const oppPid = opp ? info.participants.indexOf(opp) + 1 : null;
    const myTeam = info.teams.find((t) => t.teamId === me.teamId);
    const obj = myTeam?.objectives ?? {};
    const ch = me.challenges ?? {};
    const placement = isArena ? me.placement ?? me.subteamPlacement ?? null : null;
    const win = isArena && placement != null ? placement <= 4 : me.win;
    const data = {
      riotMatchId: matchId,
      playedAt: new Date(
        info.gameStartTimestamp ?? info.gameCreation ?? Date.now()
      ).toISOString(),
      champion: me.championName,
      opponentChampion: opp?.championName ?? null,
      opponentName: opp?.riotIdGameName ?? opp?.summonerName ?? null,
      role,
      side,
      win,
      placement,
      build: {
        items: [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5].map((i) => i ?? 0).filter((_, idx2) => idx2 < 6),
        trinket: me.item6 ?? 0,
        spells: [me.summoner1Id ?? 0, me.summoner2Id ?? 0],
        keystone: me.perks?.styles?.[0]?.selections?.[0]?.perk ?? null,
        secondaryStyle: me.perks?.styles?.[1]?.style ?? null
      },
      queue: QUEUE_NAMES[queueId] ?? `QUEUE_${queueId}`,
      durationSec: info.gameDuration,
      kills: me.kills,
      deaths: me.deaths,
      assists: me.assists,
      totalCs: (me.totalMinionsKilled ?? 0) + (me.neutralMinionsKilled ?? 0),
      damageToChampions: me.totalDamageDealtToChampions,
      visionScore: me.visionScore,
      soloKills: ch.soloKills,
      teamDamageShare: ch.teamDamagePercentage ?? null,
      killParticipation: ch.killParticipation ?? null,
      dragons: obj.dragon?.kills,
      voidgrubs: obj.horde?.kills,
      heralds: obj.riftHerald?.kills,
      barons: obj.baron?.kills,
      towers: obj.tower?.kills,
      adv: {
        doubleKills: me.doubleKills,
        tripleKills: me.tripleKills,
        quadraKills: me.quadraKills,
        pentaKills: me.pentaKills,
        dmgTaken: me.totalDamageTaken,
        dmgMitigated: me.damageSelfMitigated,
        dmgToTurrets: me.damageDealtToTurrets,
        dmgToObjectives: me.damageDealtToObjectives,
        skillshotsHit: ch.skillshotsHit,
        skillshotsDodged: ch.skillshotsDodged,
        immobilizations: ch.enemyChampionImmobilizations,
        controlWards: ch.controlWardsPlaced ?? me.detectorWardsPlaced,
        wardsKilled: me.wardsKilled,
        wardsPlaced: me.wardsPlaced,
        turretPlates: ch.turretPlatesTaken,
        dragonTakedowns: ch.dragonTakedowns,
        baronTakedowns: ch.baronTakedowns,
        heraldTakedowns: ch.riftHeraldTakedowns,
        grubTakedowns: ch.hordeTakedowns ?? ch.voidMonsterKill
      }
    };
    try {
      const timeline = await this.get(
        `https://${this.matchRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`
      );
      Object.assign(data, parseTimeline(timeline, myPid, oppPid));
      Object.assign(data.adv, parsePhaseDamage(timeline, myPid));
      if (!isArena) {
        const teamOf = (pid) => info.participants[pid - 1]?.teamId ?? 0;
        Object.assign(data.adv, parseFights(timeline, myPid, me.teamId, teamOf));
      }
    } catch {
    }
    return data;
  }
};
function frameAt(frames, targetMs) {
  let best2 = null;
  for (const f of frames) {
    if (f.timestamp <= targetMs + 3e4) best2 = f;
    else break;
  }
  return best2 ?? frames[0] ?? null;
}
function csOf(pf) {
  return (pf?.minionsKilled ?? 0) + (pf?.jungleMinionsKilled ?? 0);
}
function parseTimeline(timeline, myPid, oppPid) {
  const frames = timeline.info?.frames ?? [];
  const out = {};
  const f10 = frameAt(frames, 6e5);
  const f14 = frameAt(frames, 84e4);
  const f15 = frameAt(frames, 9e5);
  const mine = (f) => f?.participantFrames?.[String(myPid)];
  const theirs = (f) => oppPid ? f?.participantFrames?.[String(oppPid)] : null;
  if (f10) {
    out.csAt10 = csOf(mine(f10));
    if (theirs(f10)) {
      out.goldDiffAt10 = (mine(f10).totalGold ?? 0) - (theirs(f10).totalGold ?? 0);
      out.xpDiffAt10 = (mine(f10).xp ?? 0) - (theirs(f10).xp ?? 0);
    }
  }
  if (f14) out.csAt14 = csOf(mine(f14));
  if (f15 && theirs(f15)) {
    out.goldDiffAt15 = (mine(f15).totalGold ?? 0) - (theirs(f15).totalGold ?? 0);
  }
  let deathsBefore10 = 0;
  let deathsBefore15 = 0;
  let firstDeath = null;
  for (const f of frames) {
    for (const ev of f.events ?? []) {
      if (ev.type === "CHAMPION_KILL" && ev.victimId === myPid) {
        if (firstDeath === null) firstDeath = ev.timestamp;
        if (ev.timestamp < 6e5) deathsBefore10++;
        if (ev.timestamp < 9e5) deathsBefore15++;
      }
    }
  }
  out.deathsBefore10 = deathsBefore10;
  out.deathsBefore15 = deathsBefore15;
  out.firstDeathSec = firstDeath !== null ? Math.round(firstDeath / 1e3) : null;
  return out;
}
function parsePhaseDamage(timeline, myPid) {
  const frames = timeline.info?.frames ?? [];
  if (!frames.length) return {};
  const dmgAt = (f) => f?.participantFrames?.[String(myPid)]?.damageStats?.totalDamageDoneToChampions ?? null;
  const f14 = frameAt(frames, 84e4);
  const f25 = frameAt(frames, 15e5);
  const last = frames[frames.length - 1];
  const at14 = dmgAt(f14);
  const at25 = dmgAt(f25);
  const atEnd = dmgAt(last);
  if (atEnd == null) return {};
  const early = at14 ?? 0;
  const mid = at25 != null ? Math.max(0, at25 - early) : Math.max(0, atEnd - early);
  const late2 = at25 != null ? Math.max(0, atEnd - at25) : 0;
  return { dmgEarly: early, dmgMid: mid, dmgLate: late2 };
}
function parseFights(timeline, myPid, myTeamId, teamOf) {
  const frames = timeline.info?.frames ?? [];
  const kills = [];
  for (const f of frames) {
    for (const ev of f.events ?? []) {
      if (ev.type === "CHAMPION_KILL" && ev.killerId > 0 && ev.victimId > 0) kills.push(ev);
    }
  }
  kills.sort((a, b) => a.timestamp - b.timestamp);
  const out = {
    duels: 0,
    duelWins: 0,
    skirmishes: 0,
    skirmishWins: 0,
    teamfights: 0,
    teamfightWins: 0
  };
  const GAP = 15e3;
  let cluster = [];
  const flush = () => {
    if (!cluster.length) return;
    const involved = /* @__PURE__ */ new Set();
    let myKills = 0;
    let enemyKills = 0;
    let iWasIn = false;
    for (const ev of cluster) {
      const parts = [ev.killerId, ev.victimId, ...ev.assistingParticipantIds ?? []].filter((p) => p > 0);
      for (const p of parts) involved.add(p);
      if (parts.includes(myPid)) iWasIn = true;
      if (teamOf(ev.killerId) === myTeamId) myKills++;
      else enemyKills++;
    }
    if (iWasIn) {
      const won = myKills > enemyKills;
      const n = involved.size;
      if (n <= 2) {
        out.duels++;
        if (won) out.duelWins++;
      } else if (n <= 5) {
        out.skirmishes++;
        if (won) out.skirmishWins++;
      } else {
        out.teamfights++;
        if (won) out.teamfightWins++;
      }
    }
    cluster = [];
  };
  for (const ev of kills) {
    if (cluster.length && ev.timestamp - cluster[cluster.length - 1].timestamp > GAP) flush();
    cluster.push(ev);
  }
  flush();
  return out;
}
function riotFromEnv() {
  const key = process.env.RIOT_API_KEY;
  const { gameName, tagLine, platform } = selfIdentity();
  if (!key || !gameName || !tagLine) return null;
  return new RiotClient(key, gameName, tagLine, platform);
}
function riotForAccount(gameName, tagLine, platform) {
  const key = process.env.RIOT_API_KEY;
  if (!key) return null;
  return new RiotClient(key, gameName, tagLine, platform);
}

// server/championRoles.ts
var CHAMPION_ROLES = {
  Aatrox: ["TOP"],
  Ahri: ["MID"],
  Akali: ["MID", "TOP"],
  Akshan: ["MID", "TOP"],
  Alistar: ["SUPPORT"],
  Ambessa: ["TOP"],
  Amumu: ["JUNGLE", "SUPPORT"],
  Anivia: ["MID"],
  Annie: ["MID", "SUPPORT"],
  Aphelios: ["BOT"],
  Ashe: ["BOT", "SUPPORT"],
  AurelionSol: ["MID"],
  Aurora: ["MID", "TOP"],
  Azir: ["MID"],
  Bard: ["SUPPORT"],
  Belveth: ["JUNGLE"],
  Blitzcrank: ["SUPPORT"],
  Brand: ["SUPPORT", "MID"],
  Braum: ["SUPPORT"],
  Briar: ["JUNGLE"],
  Caitlyn: ["BOT"],
  Camille: ["TOP"],
  Cassiopeia: ["MID"],
  Chogath: ["TOP"],
  Corki: ["MID", "BOT"],
  Darius: ["TOP"],
  Diana: ["JUNGLE", "MID"],
  Draven: ["BOT"],
  DrMundo: ["TOP"],
  Ekko: ["JUNGLE", "MID"],
  Elise: ["JUNGLE"],
  Evelynn: ["JUNGLE"],
  Ezreal: ["BOT"],
  Fiddlesticks: ["JUNGLE"],
  Fiora: ["TOP"],
  Fizz: ["MID"],
  Galio: ["MID", "SUPPORT"],
  Gangplank: ["TOP"],
  Garen: ["TOP"],
  Gnar: ["TOP"],
  Gragas: ["JUNGLE", "TOP"],
  Graves: ["JUNGLE"],
  Gwen: ["TOP", "JUNGLE"],
  Hecarim: ["JUNGLE"],
  Heimerdinger: ["MID", "SUPPORT", "TOP"],
  Hwei: ["MID", "SUPPORT"],
  Illaoi: ["TOP"],
  Irelia: ["TOP", "MID"],
  Ivern: ["JUNGLE"],
  Janna: ["SUPPORT"],
  JarvanIV: ["JUNGLE"],
  Jax: ["TOP", "JUNGLE"],
  Jayce: ["TOP", "MID"],
  Jhin: ["BOT"],
  Jinx: ["BOT"],
  Kaisa: ["BOT"],
  Kalista: ["BOT"],
  Karma: ["SUPPORT", "MID"],
  Karthus: ["JUNGLE", "MID"],
  Kassadin: ["MID"],
  Katarina: ["MID"],
  Kayle: ["TOP"],
  Kayn: ["JUNGLE"],
  Kennen: ["TOP"],
  Khazix: ["JUNGLE"],
  Kindred: ["JUNGLE"],
  Kled: ["TOP"],
  KogMaw: ["BOT"],
  KSante: ["TOP"],
  Leblanc: ["MID"],
  LeeSin: ["JUNGLE"],
  Leona: ["SUPPORT"],
  Lillia: ["JUNGLE"],
  Lissandra: ["MID"],
  Lucian: ["BOT", "MID"],
  Lulu: ["SUPPORT"],
  Lux: ["SUPPORT", "MID"],
  Malphite: ["TOP", "SUPPORT"],
  Malzahar: ["MID"],
  Maokai: ["SUPPORT", "JUNGLE", "TOP"],
  MasterYi: ["JUNGLE"],
  Milio: ["SUPPORT"],
  MissFortune: ["BOT"],
  MonkeyKing: ["TOP", "JUNGLE"],
  Mordekaiser: ["TOP"],
  Morgana: ["SUPPORT", "MID"],
  Naafiri: ["MID", "JUNGLE"],
  Nami: ["SUPPORT"],
  Nasus: ["TOP"],
  Nautilus: ["SUPPORT"],
  Neeko: ["MID", "SUPPORT"],
  Nidalee: ["JUNGLE"],
  Nilah: ["BOT"],
  Nocturne: ["JUNGLE"],
  Nunu: ["JUNGLE"],
  Olaf: ["TOP", "JUNGLE"],
  Orianna: ["MID"],
  Ornn: ["TOP"],
  Pantheon: ["TOP", "SUPPORT", "MID"],
  Poppy: ["TOP", "JUNGLE", "SUPPORT"],
  Pyke: ["SUPPORT"],
  Qiyana: ["MID"],
  Quinn: ["TOP"],
  Rakan: ["SUPPORT"],
  Rammus: ["JUNGLE"],
  RekSai: ["JUNGLE"],
  Rell: ["SUPPORT"],
  Renata: ["SUPPORT"],
  Renekton: ["TOP"],
  Rengar: ["JUNGLE", "TOP"],
  Riven: ["TOP"],
  Rumble: ["TOP", "MID"],
  Ryze: ["MID", "TOP"],
  Samira: ["BOT"],
  Sejuani: ["JUNGLE"],
  Senna: ["SUPPORT", "BOT"],
  Seraphine: ["SUPPORT", "MID", "BOT"],
  Sett: ["TOP", "SUPPORT"],
  Shaco: ["JUNGLE"],
  Shen: ["TOP"],
  Shyvana: ["JUNGLE"],
  Singed: ["TOP"],
  Sion: ["TOP"],
  Sivir: ["BOT"],
  Skarner: ["JUNGLE"],
  Smolder: ["BOT"],
  Sona: ["SUPPORT"],
  Soraka: ["SUPPORT"],
  Swain: ["MID", "SUPPORT", "BOT"],
  Sylas: ["MID", "TOP"],
  Syndra: ["MID"],
  TahmKench: ["TOP", "SUPPORT"],
  Taliyah: ["JUNGLE", "MID"],
  Talon: ["MID", "JUNGLE"],
  Taric: ["SUPPORT"],
  Teemo: ["TOP"],
  Thresh: ["SUPPORT"],
  Tristana: ["BOT", "MID"],
  Trundle: ["JUNGLE", "TOP"],
  Tryndamere: ["TOP"],
  TwistedFate: ["MID"],
  Twitch: ["BOT"],
  Udyr: ["JUNGLE"],
  Urgot: ["TOP"],
  Varus: ["BOT"],
  Vayne: ["BOT", "TOP"],
  Veigar: ["MID", "SUPPORT"],
  Velkoz: ["SUPPORT", "MID"],
  Vex: ["MID"],
  Vi: ["JUNGLE"],
  Viego: ["JUNGLE"],
  Viktor: ["MID"],
  Vladimir: ["MID", "TOP"],
  Volibear: ["JUNGLE", "TOP"],
  Warwick: ["JUNGLE", "TOP"],
  Xayah: ["BOT"],
  Xerath: ["MID", "SUPPORT"],
  XinZhao: ["JUNGLE"],
  Yasuo: ["MID", "TOP"],
  Yone: ["MID", "TOP"],
  Yorick: ["TOP"],
  Yunara: ["BOT"],
  Yuumi: ["SUPPORT"],
  Zac: ["JUNGLE"],
  Zed: ["MID"],
  Zeri: ["BOT"],
  Ziggs: ["MID", "BOT"],
  Zilean: ["SUPPORT", "MID"],
  Zoe: ["MID"],
  Zyra: ["SUPPORT"]
};
function rolesFor(id) {
  return CHAMPION_ROLES[id] ?? [];
}

// server/ddragon.ts
var cache = null;
var inflight = null;
async function fetchChampions() {
  const versions = await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json();
  const version = versions[0];
  const data = await (await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  )).json();
  const champions = Object.values(data.data).map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    title: c.title,
    tags: c.tags,
    roles: rolesFor(c.id),
    imageUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.id}.png`
  })).sort((a, b) => a.name.localeCompare(b.name));
  return { version, champions };
}
async function getChampions() {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetchChampions().then((r) => {
      cache = r;
      return r;
    }).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
async function getVersion() {
  return (await getChampions()).version;
}
var runeMeta = null;
var runeInflight = null;
async function fetchRuneMeta() {
  const version = await getVersion();
  const data = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`)).json();
  const map = /* @__PURE__ */ new Map();
  const url = (icon) => `https://ddragon.leagueoflegends.com/cdn/img/${icon}`;
  for (const path2 of data) {
    map.set(path2.id, { icon: url(path2.icon), name: path2.name });
    for (const slot of path2.slots) for (const rune of slot.runes) map.set(rune.id, { icon: url(rune.icon), name: rune.name });
  }
  return map;
}
async function runeLookup(id) {
  if (!runeMeta) {
    if (!runeInflight) runeInflight = fetchRuneMeta().then((m) => runeMeta = m).finally(() => runeInflight = null);
    await runeInflight;
  }
  return runeMeta?.get(id);
}
async function getRuneIcon(id) {
  if (!id) return null;
  return (await runeLookup(id))?.icon ?? null;
}
async function getRuneName(id) {
  if (!id) return null;
  return (await runeLookup(id))?.name ?? null;
}
var itemNames = null;
var itemInflight = null;
async function fetchItemNames() {
  const version = await getVersion();
  const data = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`)).json();
  const map = /* @__PURE__ */ new Map();
  for (const [id, it] of Object.entries(data.data)) map.set(Number(id), it.name);
  return map;
}
async function getItemName(id) {
  if (!id) return "";
  if (!itemNames) {
    if (!itemInflight) itemInflight = fetchItemNames().then((m) => itemNames = m).finally(() => itemInflight = null);
    await itemInflight;
  }
  return itemNames?.get(id) ?? `Item ${id}`;
}

// server/mastery.ts
var def4 = (x) => x !== null && x !== void 0;
var round12 = (n) => Math.round(n * 10) / 10;
function avg3(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
function kdaOf2(ms) {
  const kills = ms.map((m) => m.objective.kills).filter(def4);
  const deaths = ms.map((m) => m.objective.deaths).filter(def4);
  const assists = ms.map((m) => m.objective.assists).filter(def4);
  const k = round12(avg3(kills));
  const d = round12(avg3(deaths));
  const a = round12(avg3(assists));
  return {
    k,
    d,
    a,
    ratio: round12((k + a) / Math.max(1, d))
  };
}
function poolTier(pool, champion) {
  return pool.find((p) => p.champion.toLowerCase() === champion.toLowerCase())?.tier ?? null;
}
function championSuggestions(champion, ms) {
  const suggestions = [];
  const cs10Vals = ms.map((m) => m.objective.csAt10).filter(def4);
  if (cs10Vals.length >= 3) {
    const current = round12(avg3(cs10Vals));
    if (current < 70) {
      const tpl = getTemplate("cs10");
      suggestions.push({
        templateId: tpl.id,
        category: tpl.category,
        title: `${champion}: ${tpl.title()}`,
        description: tpl.describe(70),
        target: 70,
        unit: tpl.unit,
        direction: tpl.direction,
        champion,
        rationale: `${champion} is averaging ${current} CS@10. More stable farm turns this pick into a real win condition.`,
        severity: Math.min(1, (70 - current) / 70),
        current
      });
    }
  }
  const goldVals = ms.map((m) => m.objective.goldDiffAt15).filter(def4);
  if (goldVals.length >= 3) {
    const current = round12(avg3(goldVals));
    if (current < 250) {
      const tpl = getTemplate("gold_diff_15");
      suggestions.push({
        templateId: tpl.id,
        category: tpl.category,
        title: `${champion}: ${tpl.title()}`,
        description: tpl.describe(250),
        target: 250,
        unit: tpl.unit,
        direction: tpl.direction,
        champion,
        rationale: `${champion} is only at ${current >= 0 ? "+" : ""}${current} gold@15 on average. The lane pressure is not cashing out yet.`,
        severity: Math.min(1, (250 - current) / 250),
        current
      });
    }
  }
  const deathVals = ms.map((m) => m.objective.deathsBefore15).filter(def4);
  if (deathVals.length >= 3) {
    const current = round12(avg3(deathVals));
    if (current > 2) {
      const tpl = getTemplate("deaths_before_15");
      suggestions.push({
        templateId: tpl.id,
        category: tpl.category,
        title: `${champion}: ${tpl.title()}`,
        description: tpl.describe(2),
        target: 2,
        unit: tpl.unit,
        direction: tpl.direction,
        champion,
        rationale: `${champion} is dying ${current} times before 15 on average. This pick needs a calmer opening to scale into the game.`,
        severity: Math.min(1, (current - 2) / 3),
        current
      });
    }
  }
  const firstDeathVals = ms.map((m) => m.objective.firstDeathSec).filter(def4);
  if (firstDeathVals.length >= 3) {
    const current = Math.round(avg3(firstDeathVals));
    if (current < 360) {
      const tpl = getTemplate("deaths_before_15");
      suggestions.push({
        templateId: tpl.id,
        category: tpl.category,
        title: `${champion}: survive to first reset`,
        description: "Push your first death later by stabilizing lane, recalls, and jungle respect.",
        target: 2,
        unit: "deaths <15",
        direction: tpl.direction,
        champion,
        rationale: `${champion} is first dying around ${Math.round(current / 60)}:${String(current % 60).padStart(2, "0")}. The early lane is leaking before the game opens up.`,
        severity: Math.min(1, (360 - current) / 180),
        current: round12(current / 60)
      });
    }
  }
  if (ms.length >= 5) {
    const wins = ms.filter((m) => m.objective.win).length;
    const current = Math.round(wins / ms.length * 100);
    if (current < 55) {
      const tpl = getTemplate("champion_winrate");
      suggestions.push({
        templateId: tpl.id,
        category: tpl.category,
        title: tpl.title(champion),
        description: tpl.describe(55, champion),
        target: 55,
        unit: tpl.unit,
        direction: tpl.direction,
        champion,
        rationale: `${champion} is at ${current}% win rate over ${ms.length} games. Tighten the details before adding more experimentation elsewhere.`,
        severity: Math.min(1, (55 - current) / 30),
        current
      });
    }
  }
  const processVals = ms.map((m) => m.process.score);
  const avgProcess = round12(avg3(processVals));
  if (avgProcess < 65) {
    const tpl = getTemplate("avg_process");
    suggestions.push({
      templateId: tpl.id,
      category: tpl.category,
      title: `${champion}: ${tpl.title()}`,
      description: tpl.describe(65),
      target: 65,
      unit: tpl.unit,
      direction: tpl.direction,
      champion,
      rationale: `${champion} is averaging ${avgProcess} process. The wins may come and go, but the floor still needs work.`,
      severity: Math.min(1, (65 - avgProcess) / 25),
      current: avgProcess
    });
  }
  if (suggestions.length < 2) {
    const have = new Set(suggestions.map((s) => s.templateId));
    const wins = ms.filter((m) => m.objective.win).length;
    const wrNow = ms.length ? Math.round(wins / ms.length * 100) : 0;
    const avgProc = round12(avg3(ms.map((m) => m.process.score)));
    if (!have.has("champion_winrate") && ms.length >= 3) {
      const target = Math.min(75, Math.max(wrNow + 5, 55));
      const tpl = getTemplate("champion_winrate");
      suggestions.push({
        templateId: tpl.id,
        category: tpl.category,
        title: tpl.title(champion),
        description: tpl.describe(target, champion),
        target,
        unit: tpl.unit,
        direction: tpl.direction,
        champion,
        rationale: `${champion} is at ${wrNow}% over ${ms.length} games \u2014 push it toward ${target}%.`,
        severity: 0.4,
        current: wrNow
      });
      have.add(tpl.id);
    }
    if (!have.has("avg_process")) {
      const target = Math.min(95, Math.max(Math.round(avgProc) + 6, 65));
      const tpl = getTemplate("avg_process");
      suggestions.push({
        templateId: tpl.id,
        category: tpl.category,
        title: `${champion}: ${tpl.title()}`,
        description: tpl.describe(target),
        target,
        unit: tpl.unit,
        direction: tpl.direction,
        champion,
        rationale: `${champion} averages ${avgProc} performance \u2014 aim for ${target} to raise the floor.`,
        severity: 0.35,
        current: avgProc
      });
      have.add(tpl.id);
    }
    const cs10Now = cs10Vals.length ? round12(avg3(cs10Vals)) : null;
    if (!have.has("cs10") && cs10Now != null) {
      const target = Math.min(90, Math.round(cs10Now) + 8);
      const tpl = getTemplate("cs10");
      suggestions.push({
        templateId: tpl.id,
        category: tpl.category,
        title: `${champion}: ${tpl.title()}`,
        description: tpl.describe(target),
        target,
        unit: tpl.unit,
        direction: tpl.direction,
        champion,
        rationale: `${champion} farms ${cs10Now} CS@10 \u2014 tighten it to ${target}.`,
        severity: 0.3,
        current: cs10Now
      });
    }
  }
  const byTemplate = /* @__PURE__ */ new Map();
  for (const s of suggestions.sort((a, b) => b.severity - a.severity)) {
    if (!byTemplate.has(s.templateId)) byTemplate.set(s.templateId, s);
  }
  return [...byTemplate.values()].slice(0, 5);
}
function buildChampionDetail(champion, roleFilter = null) {
  const seasons = store.seasons();
  const pool = store.activePool();
  const enriched = enrichAll(store.matches(), seasons, pool);
  const allOnChamp = enriched.filter(
    (m) => m.objective.champion?.toLowerCase() === champion.toLowerCase()
  );
  if (allOnChamp.length === 0) return null;
  const availableRoles = [...new Set(
    allOnChamp.map((m) => m.objective.role).filter((r) => !!r && r !== "UNKNOWN")
  )];
  const activeRole = roleFilter && availableRoles.includes(roleFilter) ? roleFilter : null;
  const onChamp = activeRole ? allOnChamp.filter((m) => m.objective.role === activeRole) : allOnChamp;
  const wins = onChamp.filter((m) => m.objective.win).length;
  const matchupsMap = /* @__PURE__ */ new Map();
  for (const match2 of onChamp) {
    const opponent = match2.objective.opponentChampion;
    if (!opponent) continue;
    (matchupsMap.get(opponent) ?? matchupsMap.set(opponent, []).get(opponent)).push(match2);
  }
  const matchups = [...matchupsMap.entries()].map(([opponent, ms]) => {
    const matchupWins = ms.filter((m) => m.objective.win).length;
    const goldVals = ms.map((m) => m.objective.goldDiffAt15).filter(def4);
    return {
      opponent,
      games: ms.length,
      wins: matchupWins,
      winRate: Math.round(matchupWins / ms.length * 100),
      avgGoldDiff15: goldVals.length ? round12(avg3(goldVals)) : null,
      avgProcess: Math.round(avg3(ms.map((m) => m.process.score)))
    };
  }).sort((a, b) => b.games - a.games || a.winRate - b.winRate);
  const cs10Vals = onChamp.map((m) => m.objective.csAt10).filter(def4);
  const deaths15Vals = onChamp.map((m) => m.objective.deathsBefore15).filter(def4);
  const firstDeathVals = onChamp.map((m) => m.objective.firstDeathSec).filter(def4);
  const gold15Vals = onChamp.map((m) => m.objective.goldDiffAt15).filter(def4);
  const poolRoles = pool.find((p) => p.champion.toLowerCase() === champion.toLowerCase())?.roles;
  const track = buildChampionTrack(champion, onChamp, poolRoles?.[0]);
  const wr2 = Math.round(wins / onChamp.length * 100);
  const avgProc = Math.round(avg3(onChamp.map((m) => m.process.score)));
  const cs10 = cs10Vals.length ? round12(avg3(cs10Vals)) : null;
  const d15 = deaths15Vals.length ? round12(avg3(deaths15Vals)) : null;
  const g15 = gold15Vals.length ? round12(avg3(gold15Vals)) : null;
  const kpVals = onChamp.map((m) => m.objective.killParticipation).filter(def4);
  const kp = kpVals.length ? Math.round(avg3(kpVals) * 100) : null;
  const visVals = onChamp.map((m) => m.objective.visionScore != null && m.objective.durationSec ? m.objective.visionScore / (m.objective.durationSec / 60) : null).filter(def4);
  const vis = visVals.length ? round12(avg3(visVals)) : null;
  const soloVals = onChamp.map((m) => m.objective.soloKills).filter(def4);
  const solo = soloVals.length ? round12(avg3(soloVals)) : null;
  const objVals = onChamp.map((m) => {
    const o = m.objective;
    if (o.dragons == null && o.heralds == null && o.barons == null) return null;
    return (o.dragons ?? 0) + (o.heralds ?? 0) + (o.barons ?? 0);
  }).filter(def4);
  const objAvg = objVals.length ? round12(avg3(objVals)) : null;
  const sgn = (n) => `${n >= 0 ? "+" : ""}${n}`;
  const k = kdaOf2(onChamp);
  const aram = onChamp.filter((m) => (m.objective.queue ?? "").toUpperCase().includes("ARAM")).length / onChamp.length >= 0.5;
  const dmgShareVals = onChamp.map((m) => m.objective.teamDamageShare).filter(def4);
  const dmgShare = dmgShareVals.length ? Math.round(avg3(dmgShareVals) * 100) : null;
  const pt = [];
  const add = (cond, pri, label, tone, hint) => {
    if (cond) pt.push({ label, tone, hint, pri });
  };
  add(wr2 >= 58 && onChamp.length >= 5, 10, "Comfort pick", "good", `${wr2}% win rate across ${onChamp.length} games \u2014 a proven, reliable pick.`);
  add(wr2 <= 40 && onChamp.length >= 5, 10, "Struggle pick", "bad", `${wr2}% win rate across ${onChamp.length} games \u2014 the results aren't there yet.`);
  add(k.ratio >= 4, 8, "Reliable", "good", `${k.ratio} average KDA \u2014 rarely a liability.`);
  add(k.ratio <= 1.6, 9, "Feeding risk", "bad", `${k.ratio} average KDA \u2014 deaths are outrunning impact.`);
  add(dmgShare != null && dmgShare >= 28, 8, "Damage carry", "good", `${dmgShare}% of your team's champion damage \u2014 the output engine.`);
  add(dmgShare != null && dmgShare <= 15, 7, "Low output", "bad", `${dmgShare}% team damage share \u2014 struggling to contribute damage.`);
  add(kp != null && kp >= 62, 6, "Always in the fight", "good", `${kp}% average kill participation \u2014 present for the team's plays.`);
  add(kp != null && kp <= 42, 7, "Missing fights", "bad", `${kp}% kill participation \u2014 often absent from the map's fights.`);
  add(k.k >= (aram ? 11 : 7), 6, "Aggressive", "good", `${k.k} kills per game \u2014 you hunt for plays.`);
  add(k.a >= (aram ? 18 : 11), 6, "Playmaker", "good", `${k.a} assists per game \u2014 you set the table.`);
  add(k.k >= 6 && k.d >= (aram ? 9 : 7), 5, "Feast or famine", "neutral", `${k.k} kills but ${k.d} deaths \u2014 high-variance, all-in style.`);
  add(solo != null && solo >= 1.3, 5, "Lane duelist", "good", `${solo} solo kills per game \u2014 you win the 1v1.`);
  add(cs10 != null && cs10 >= 72, 6, "Farm machine", "good", `${cs10} CS@10 on average \u2014 elite early farm.`);
  add(cs10 != null && cs10 < 55, 6, "Farms low", "bad", `${cs10} CS@10 \u2014 gold is being left on the map.`);
  add(g15 != null && g15 >= 200, 7, "Lane bully", "good", `+${Math.round(g15 ?? 0)} gold@15 on average \u2014 you win lane early.`);
  add(g15 != null && g15 <= -300, 7, "Loses lane", "bad", `${Math.round(g15 ?? 0)} gold@15 on average \u2014 starting games behind.`);
  add(k.d >= (aram ? 9 : 6.5), 8, "Dies a lot", "bad", `${k.d} deaths per game \u2014 too many, too fast.`);
  add(d15 != null && d15 >= 3, 6, "Fed early", "bad", `${d15} deaths before 15 \u2014 the opening is leaking.`);
  add(d15 != null && d15 <= 1.5, 5, "Ice in the veins", "good", `${d15} deaths before 15 \u2014 disciplined early game.`);
  add(vis != null && vis >= 1.2, 4, "Map hawk", "good", `${vis} vision score per minute \u2014 you light up the map.`);
  add(objAvg != null && objAvg >= 5, 4, "Objective hound", "good", `${objAvg} team objectives per game \u2014 you play the map.`);
  add(avgProc >= 68, 5, "High floor", "good", `${avgProc} average performance \u2014 consistently clean games.`);
  add(avgProc < 45, 5, "Low floor", "bad", `${avgProc} average performance \u2014 the baseline needs raising.`);
  pt.sort((a, b) => b.pri - a.pri);
  const playstyle = pt.slice(0, 7).map(({ pri, ...t }) => t);
  if (playstyle.length === 0) {
    playstyle.push({ label: `${onChamp.length}-game read`, tone: "neutral", hint: `Only ${onChamp.length} game${onChamp.length === 1 ? "" : "s"} logged \u2014 play more to read a clear style.` });
  }
  const strengths = [];
  const improvements = [];
  const push = (ok, good, bad) => (ok ? strengths : improvements).push(ok ? good : bad);
  if (cs10 != null) push(cs10 >= 70, `Strong early farm \u2014 ${cs10} CS@10`, `Farm floor is low \u2014 ${cs10} CS@10 (aim 70+)`);
  if (d15 != null) push(d15 <= 2, `Disciplined early \u2014 ${d15} deaths before 15`, `Dying too early \u2014 ${d15} deaths before 15`);
  if (g15 != null) push(g15 >= 0, `Winning your lane \u2014 ${sgn(g15)} gold@15`, `Losing lane gold \u2014 ${sgn(g15)} gold@15`);
  if (kp != null) push(kp >= 55, `Present for fights \u2014 ${kp}% kill participation`, `Missing fights \u2014 ${kp}% kill participation`);
  push(avgProc >= 60, `Clean games \u2014 ${avgProc} avg performance`, `Raise your floor \u2014 ${avgProc} avg performance`);
  const clamp2 = (n) => Math.max(4, Math.min(100, Math.round(n)));
  const phases = [
    { phase: "early", label: "Early game", value: `${cs10 ?? "\u2014"} CS@10 \xB7 ${d15 ?? "\u2014"} deaths<15`, score: cs10 != null ? clamp2(cs10 / 85 * 100) : 50, hint: "Laning: farm and survive to your first reset." },
    { phase: "mid", label: "Mid game", value: `${g15 != null ? sgn(g15) : "\u2014"} gold@15 \xB7 ${kp ?? "\u2014"}% KP`, score: kp != null ? clamp2(kp * 1.3) : g15 != null ? clamp2(50 + g15 / 20) : 50, hint: "Skirmishes and objectives from ~15\u201325 min." },
    { phase: "late", label: "Late game", value: `${wr2}% WR \xB7 ${kdaOf2(onChamp).ratio} KDA`, score: clamp2(wr2), hint: "Closing: teamfights and converting the lead." }
  ];
  const recentMatches = [...onChamp].reverse().slice(0, 10);
  const ownTier = [...onChamp].reverse().find((m) => m.objective.tier)?.objective.tier ?? null;
  const { rank: benchRank, bench } = benchFor(
    activeProfile().isSelf ? store.profile().preferredRank : null,
    ownTier
  );
  const cmp = (key, label, value, benchmark, unit, direction) => {
    const better = value != null && (direction === "higher" ? value >= benchmark : value <= benchmark);
    let pct2 = 50;
    if (value != null) {
      const mag = Math.max(1, Math.abs(benchmark));
      const imp = direction === "higher" ? value - benchmark : benchmark - value;
      pct2 = Math.max(4, Math.min(100, Math.round(50 + imp / mag * 50)));
    }
    return { key, label, value, benchmark, unit, direction, better, pct: pct2 };
  };
  const comparison = [
    cmp("cs10", "CS @ 10", cs10, bench.cs10, "", "higher"),
    cmp("deaths15", "Deaths before 15", d15, bench.deaths15, "", "lower"),
    cmp("gold15", "Gold @ 15", g15, bench.gold15, "gold", "higher"),
    cmp("kp", "Kill participation", kp, bench.kp, "%", "higher"),
    cmp("vision", "Vision / min", vis, bench.vision, "", "higher"),
    cmp("kda", "KDA", kdaOf2(onChamp).ratio, bench.kda, "", "higher"),
    cmp("solo", "Solo (lane) kills", solo, bench.solo, "", "higher"),
    cmp("obj", "Team objectives", objAvg, bench.obj, "", "higher")
  ].filter((c) => c.value != null);
  return {
    champion,
    role: activeRole ?? track.role,
    availableRoles,
    activeRole,
    track,
    playstyle,
    strengths,
    improvements,
    comparison,
    comparisonRank: rankLabel(benchRank),
    phases,
    recentMatches,
    tier: poolTier(pool, champion),
    games: onChamp.length,
    wins,
    winRate: Math.round(wins / onChamp.length * 100),
    netLp: onChamp.reduce((a, m) => a + (m.objective.lpDelta ?? 0), 0),
    avgProcess: Math.round(avg3(onChamp.map((m) => m.process.score))),
    kda: kdaOf2(onChamp),
    avgCs10: cs10Vals.length ? round12(avg3(cs10Vals)) : null,
    avgDeathsBefore15: deaths15Vals.length ? round12(avg3(deaths15Vals)) : null,
    avgFirstDeathSec: firstDeathVals.length ? Math.round(avg3(firstDeathVals)) : null,
    avgGoldDiff15: gold15Vals.length ? round12(avg3(gold15Vals)) : null,
    trend: onChamp.map((m, i) => ({
      index: i + 1,
      date: m.playedAt,
      process: m.process.score,
      cs10: m.objective.csAt10 ?? null,
      win: m.objective.win ?? null
    })),
    matchups,
    suggestedGoals: championSuggestions(champion, onChamp)
  };
}

// server/briefing.ts
function championRoles(pool, champion, mainRole) {
  const entry = pool.find((p) => p.champion.toLowerCase() === champion.toLowerCase());
  return entry?.roles?.[0] ?? mainRole ?? null;
}
function signed(n) {
  if (n == null) return null;
  return `${n >= 0 ? "+" : ""}${n}`;
}
function buildItemNotes(tags, detail) {
  const earlyDeaths = detail?.avgDeathsBefore15 ?? null;
  const laneGold = detail?.avgGoldDiff15 ?? null;
  if (tags.includes("Tank")) {
    return [
      {
        label: "Lane itemization",
        note: earlyDeaths != null && earlyDeaths > 2 ? "Solve lane damage first. Early resist, health, and boots beat greed when the first 15 minutes are still leaking." : "Open with the lane answer first, then stack durability so your engages actually finish."
      },
      {
        label: "Fight job",
        note: "Itemize to start fights and survive first contact. Your value is forcing space for carries, not side-lane vanity damage."
      },
      {
        label: "Pivot rule",
        note: "If one enemy threat is fed or the comp has heavy healing, buy the answer before luxury stats."
      }
    ];
  }
  if (tags.includes("Marksman") || tags.includes("Mage")) {
    return [
      {
        label: "Core plan",
        note: laneGold != null && laneGold > 0 ? "Keep the gold lead liquid. Finish your main damage spike on time instead of detouring into panic buys." : "Tempo and lane stability come first. If the lane is shaky, buy the safety that gets you to your real spike."
      },
      {
        label: "Defensive pivot",
        note: "One defensive purchase is allowed if dive or burst is the reason fights are failing. Dead carries do zero DPS."
      },
      {
        label: "Fight rule",
        note: "Itemize for the fight you can actually take next, not the full six-item fantasy board."
      }
    ];
  }
  return [
    {
      label: "Core plan",
      note: laneGold != null && laneGold > 100 ? "You are already generating leads here. Keep the first damage spike on time so lane pressure cashes out." : "Open with the item that stabilizes your lane, then accelerate into your main threat curve."
    },
    {
      label: "Defensive pivot",
      note: earlyDeaths != null && earlyDeaths > 2 ? "If early deaths are the leak, take the cheaper defensive breakpoint before greedier damage." : "Only pivot defensive when the enemy comp can actually deny you from playing the fight."
    },
    {
      label: "Snowball rule",
      note: "When ahead, turn gold into objective-ready power instead of another ego skirmish purchase."
    }
  ];
}
function buildObjectives(detail, recommendation) {
  const items = [];
  const diag = new Map(recommendation.diagnostics.map((d) => [d.key, d]));
  if ((detail?.avgDeathsBefore15 ?? 0) > 2) {
    items.push("Make the first 12 minutes boring: give the wave, base on tempo, and do not donate lane before the map opens.");
  }
  if ((detail?.avgGoldDiff15 ?? 0) < 150) {
    items.push("Use the first three waves and recall timing to aim for a real lane edge by 15 instead of a merely survivable lane.");
  }
  if ((diag.get("objectives")?.status ?? "watch") !== "good" || (diag.get("vision")?.status ?? "watch") !== "good") {
    items.push("Base 45 to 60 seconds before dragon or grubs, arrive first, and spend wards before the fight starts.");
  }
  if ((diag.get("process")?.status ?? "watch") !== "good") {
    items.push("Protect the process floor: one review, one adjustment, and no chat spiral even if the LP swing hurts.");
  }
  if (items.length < 3) {
    items.push("Once you win space, convert it into plates, Herald, dragon setup, or wave crash instead of another random fight.");
  }
  return items.slice(0, 3);
}
function buildBanRecommendation(detail) {
  if (!detail || detail.matchups.length === 0) {
    return { champion: null, reason: null };
  }
  const worst = [...detail.matchups].sort((a, b) => {
    const wr2 = a.winRate - b.winRate;
    if (wr2 !== 0) return wr2;
    return (a.avgGoldDiff15 ?? 0) - (b.avgGoldDiff15 ?? 0);
  })[0];
  return {
    champion: worst.opponent,
    reason: `${worst.opponent} is your roughest logged lane into this pick so far (${worst.winRate}% WR${signed(worst.avgGoldDiff15) ? `, ${signed(worst.avgGoldDiff15)} gold@15` : ""}).`
  };
}
function buildMatchupFocus(detail) {
  if (!detail || detail.matchups.length === 0) {
    return { champion: null, reason: null };
  }
  const common = [...detail.matchups].sort((a, b) => b.games - a.games)[0];
  return {
    champion: common.opponent,
    reason: `${common.opponent} is the matchup you see the most. Use it as the reference lane for wave, recall, and first-objective discipline.`
  };
}
async function buildNextGameBriefing(champion, detail, pool, recommendation, mainRole) {
  if (!champion) return null;
  const data = await getChampions().catch(() => null);
  const tags = data?.champions.find((c) => c.name.toLowerCase() === champion.toLowerCase())?.tags ?? [];
  return {
    champion,
    rationale: recommendation.plan.roster.find((r) => r.champion?.toLowerCase() === champion.toLowerCase())?.rationale ?? recommendation.plan.summary,
    role: championRoles(pool, champion, mainRole),
    poolTier: detail?.tier ?? pool.find((p) => p.champion.toLowerCase() === champion.toLowerCase())?.tier ?? null,
    recommendedBan: buildBanRecommendation(detail),
    matchupFocus: buildMatchupFocus(detail),
    mastery: detail ? {
      games: detail.games,
      winRate: detail.winRate,
      avgProcess: detail.avgProcess,
      avgCs10: detail.avgCs10,
      avgGoldDiff15: detail.avgGoldDiff15,
      avgDeathsBefore15: detail.avgDeathsBefore15,
      avgFirstDeathSec: detail.avgFirstDeathSec,
      netLp: detail.netLp
    } : null,
    buildNotes: buildItemNotes(tags, detail),
    objectiveChecklist: buildObjectives(detail, recommendation)
  };
}

// server/dashboard.ts
var liveCache = /* @__PURE__ */ new Map();
var LIVE_TTL = 5 * 60 * 1e3;
async function liveProfile() {
  const ap = activeProfile();
  const riot = ap.isSelf ? riotFromEnv() : riotForAccount(ap.gameName, ap.tagLine, ap.platform);
  if (!riot || store.isDemo()) return null;
  const cacheKey = ap.isSelf ? "self" : ap.key ?? "unknown";
  const hit = liveCache.get(cacheKey);
  if (hit && Date.now() - hit.at < LIVE_TTL) return hit.data;
  try {
    const puuid = await riot.getPuuid();
    const [rank, mastery, dd] = await Promise.all([
      riot.getRank(puuid).catch(() => ({})),
      riot.getTopMastery(puuid, 1).catch(() => []),
      getChampions().catch(() => null)
    ]);
    let topChampion = null;
    let masteryTitle = null;
    if (mastery[0] && dd) {
      const champ = dd.champions.find((c) => c.key === String(mastery[0].championId));
      if (champ) {
        topChampion = champ.id;
        masteryTitle = `${champ.name} \xB7 ${(mastery[0].points / 1e3).toFixed(0)}k pts`;
      }
    }
    const data = {
      tier: rank.tier ?? null,
      division: rank.division ?? null,
      leaguePoints: rank.leaguePoints ?? null,
      solo: rank.solo ?? null,
      flex: rank.flex ?? null,
      topChampion,
      masteryTitle
    };
    liveCache.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}
var VERDICTS = [
  "clean_win",
  "bad_win",
  "good_loss",
  "deserved_loss",
  "standard"
];
function isSameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isWithinLastDays(iso, days, now3) {
  const then = new Date(iso);
  const start = new Date(now3);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return then >= start && then <= now3;
}
function splitBy(matches, keyFn) {
  const groups = /* @__PURE__ */ new Map();
  for (const m of matches) {
    const k = keyFn(m);
    if (!k) continue;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(m);
  }
  return [...groups.entries()].map(([key, ms]) => statBlock(key, ms)).sort((a, b) => b.games - a.games);
}
function statBlock(key, ms) {
  const wins = ms.filter((m) => m.objective.win).length;
  const netLp = ms.reduce((a, m) => a + (m.objective.lpDelta ?? 0), 0);
  const avgProcess = Math.round(
    ms.reduce((a, m) => a + m.process.score, 0) / ms.length
  );
  return {
    key,
    games: ms.length,
    wins,
    winRate: Math.round(wins / ms.length * 100),
    avgProcess,
    netLp
  };
}
function queueMatch(m, queue) {
  if (!queue || queue === "all") return true;
  const q = (m.objective.queue ?? "").toUpperCase();
  if (queue === "aram") return q.includes("ARAM");
  if (queue === "ranked_flex" || queue === "flex") return q.includes("FLEX");
  if (queue === "ranked_solo" || queue === "solo") return q.includes("SOLO");
  if (queue === "ranked") return q.includes("RANKED");
  if (queue === "swiftplay") return q.includes("SWIFTPLAY") || q.includes("QUICKPLAY");
  if (queue === "draft") return q.includes("DRAFT") || q.includes("BLIND");
  return true;
}
async function buildDashboard(queue, role) {
  const season = store.activeSeason();
  const seasons = store.seasons();
  const pool = store.activePool();
  const careerAll = enrichAll(store.matches(), seasons, pool);
  const careerEnriched = careerAll.filter((m) => queueMatch(m, queue)).filter((m) => !role || m.objective.role === role);
  const enriched = careerEnriched;
  const blockEnriched = season ? careerEnriched.filter((m) => matchInBlock(m, season)) : [];
  const recommendation = recommend(careerAll, pool, store.profile().mainRole);
  const focusChampion = recommendation.plan.roster.find((r) => r.champion)?.champion ?? null;
  const focusDetail = focusChampion ? buildChampionDetail(focusChampion) : null;
  const briefing = await buildNextGameBriefing(
    focusChampion,
    focusDetail,
    pool,
    recommendation,
    store.profile().mainRole
  );
  const identity = season ? getIdentity(season.identityId) : null;
  const level = levelFromXp(totalXp(enriched), enriched);
  const wins = enriched.filter((m) => m.objective.win).length;
  const losses = enriched.filter((m) => m.objective.win === false).length;
  const netLp = enriched.reduce((a, m) => a + (m.objective.lpDelta ?? 0), 0);
  const verdictCounts = Object.fromEntries(
    VERDICTS.map((v) => [v, enriched.filter((m) => m.verdict === v).length])
  );
  const avgProcess = enriched.length ? Math.round(enriched.reduce((a, m) => a + m.process.score, 0) / enriched.length) : 0;
  const trend = [];
  let cumLp = 0;
  const WINDOW2 = 5;
  enriched.forEach((m, i) => {
    cumLp += m.objective.lpDelta ?? 0;
    const from = Math.max(0, i - WINDOW2 + 1);
    const slice = enriched.slice(from, i + 1);
    const processAvg = Math.round(
      slice.reduce((a, x) => a + x.process.score, 0) / slice.length
    );
    trend.push({
      index: i + 1,
      playedAt: m.playedAt,
      cumulativeLp: cumLp,
      process: m.process.score,
      processAvg,
      win: m.objective.win ?? null,
      verdict: m.verdict,
      champion: m.objective.champion ?? null
    });
  });
  const champions = buildChampionStats(enriched, pool);
  const roles = splitBy(enriched, (m) => m.objective.role);
  const sides = splitBy(enriched, (m) => m.objective.side);
  const causeCounts = /* @__PURE__ */ new Map();
  for (const m of enriched) {
    const c = m.scorecard.firstDeathCause;
    if (c) causeCounts.set(c, (causeCounts.get(c) ?? 0) + 1);
  }
  const deathCauses = [...causeCounts.entries()].map(([cause, count3]) => ({ cause, count: count3 })).sort((a, b) => b.count - a.count);
  const now3 = /* @__PURE__ */ new Date();
  const todays = enriched.filter((m) => isSameLocalDay(new Date(m.playedAt), now3));
  const quests = evaluateQuests(todays, identity?.focusQuests ?? []);
  const weekly = enriched.filter((m) => isWithinLastDays(m.playedAt, 7, now3));
  const weeklyQuests = evaluateWeeklyQuests(weekly, identity?.focusQuests ?? []);
  const badges = evaluateBadges(enriched);
  const sessions = groupSessions(enriched, store.settings().sessionGapMinutes);
  const currentSession = sessions.length ? sessions[sessions.length - 1] : null;
  const borrowedLp = detectBorrowedLp(enriched);
  const goodBlock = detectGoodBlock(enriched);
  const goals = season ? store.goalsForSeason(season.id).map((g) => evaluateGoal(g, blockEnriched)) : [];
  const rollingQuests = season ? buildRollingQuests(
    enriched,
    focusChampion,
    store.settings().rollingQuestState ?? {}
  ) : [];
  const recentMatches = enriched.slice(-12).reverse();
  const insights = buildInsights(careerAll);
  const statBoard = buildStatBoard(careerEnriched, queue === "aram" ? "aram" : "sr");
  const latestRank = [...careerAll].reverse().find((m) => m.objective.tier)?.objective;
  const careerWins = careerEnriched.filter((m) => m.objective.win).length;
  const careerLosses = careerEnriched.filter((m) => m.objective.win === false).length;
  const masteryChamps = buildChampionStats(careerAll, pool);
  const topChamp = [...masteryChamps].sort(
    (a, b) => b.masteryLevel - a.masteryLevel || b.games - a.games
  )[0] ?? null;
  const masteryLevel = masteryChamps.reduce((a, c) => a + c.masteryLevel, 0);
  const ap = activeProfile();
  const live = await liveProfile();
  const wantFlex = queue === "ranked_flex" || queue === "flex";
  const shownRank = wantFlex ? live?.flex ?? null : live?.solo ?? (live?.tier ? { tier: live.tier, division: live.division ?? "", leaguePoints: live.leaguePoints ?? 0 } : null) ?? (latestRank?.tier ? { tier: latestRank.tier, division: latestRank.division ?? "", leaguePoints: latestRank.leaguePoints ?? 0 } : null);
  const profile = {
    gameName: ap.isSelf ? process.env.RIOT_GAME_NAME ?? null : ap.gameName,
    tagLine: ap.isSelf ? process.env.RIOT_TAG_LINE ?? null : ap.tagLine,
    platform: ap.isSelf ? process.env.RIOT_PLATFORM ?? null : ap.platform,
    tier: shownRank?.tier ?? null,
    division: shownRank?.division ?? null,
    leaguePoints: shownRank?.leaguePoints ?? null,
    rankQueue: wantFlex ? "Flex" : "Solo/Duo",
    masteryLevel,
    masteryTitle: live?.masteryTitle ?? (topChamp ? `${topChamp.champion} \xB7 ${topChamp.masteryRank}` : "No games yet"),
    topChampion: live?.topChampion ?? topChamp?.champion ?? null,
    wins: careerWins,
    losses: careerLosses,
    winRate: careerWins + careerLosses ? Math.round(careerWins / (careerWins + careerLosses) * 100) : 0,
    games: careerEnriched.length
  };
  return {
    season,
    identity,
    focusChampion: {
      champion: focusChampion,
      rationale: recommendation.plan.roster[0]?.rationale ?? null
    },
    briefing,
    gamesLogged: blockEnriched.length,
    target: season?.targetGames ?? 0,
    level,
    record: { wins, losses, netLp },
    verdictCounts,
    avgProcess,
    trend,
    champions,
    roles,
    sides,
    deathCauses,
    quests,
    weeklyQuests,
    badges,
    sessions,
    currentSession,
    borrowedLp,
    goodBlock,
    goals,
    rollingQuests,
    recommendation,
    recentMatches,
    insights,
    profile,
    statBoard,
    pullRemaining: store.pullPending().length
  };
}

// server/progress.ts
var round13 = (n) => Math.round(n * 10) / 10;
var def5 = (x) => x !== null && x !== void 0;
var perMin2 = (v, durSec) => v != null && durSec ? v / (durSec / 60) : null;
var METRICS2 = [
  {
    key: "process",
    label: "Game score",
    unit: "",
    direction: "higher",
    pick: (m) => m.process.score
  },
  {
    key: "cs10",
    label: "CS @ 10",
    unit: "cs",
    direction: "higher",
    pick: (m) => m.objective.csAt10 ?? null
  },
  {
    key: "csPerMin",
    label: "CS / min",
    unit: "/min",
    direction: "higher",
    pick: (m) => {
      const v = perMin2(m.objective.totalCs, m.objective.durationSec);
      return v == null ? null : round13(v);
    }
  },
  {
    key: "deaths15",
    label: "Deaths before 15",
    unit: "",
    direction: "lower",
    pick: (m) => m.objective.deathsBefore15 ?? null
  },
  {
    key: "deaths",
    label: "Deaths",
    unit: "",
    direction: "lower",
    pick: (m) => m.objective.deaths ?? null
  },
  {
    key: "kp",
    label: "Kill participation",
    unit: "%",
    direction: "higher",
    pick: (m) => m.objective.killParticipation != null ? Math.round(m.objective.killParticipation * 100) : null
  },
  {
    key: "gold15",
    label: "Gold diff @ 15",
    unit: "g",
    direction: "higher",
    pick: (m) => m.objective.goldDiffAt15 ?? null
  },
  {
    key: "vision",
    label: "Vision / min",
    unit: "/min",
    direction: "higher",
    pick: (m) => {
      const v = perMin2(m.objective.visionScore, m.objective.durationSec);
      return v == null ? null : round13(v);
    }
  },
  {
    key: "tilt",
    label: "Tilt after",
    unit: "",
    direction: "lower",
    pick: (m) => m.scorecard.tiltAfter
  }
];
var RADAR_METRICS = [
  { key: "earlyStability", label: "Early" },
  { key: "deathDiscipline", label: "Deaths" },
  { key: "objectiveMacro", label: "Macro" },
  { key: "teamfight", label: "Fights" },
  { key: "mental", label: "Mental" },
  { key: "review", label: "Review" }
];
function localDay(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function avg4(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function streaks(ms, pred) {
  let current = 0;
  let longest = 0;
  let run = 0;
  for (const m of ms) {
    if (pred(m)) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  for (let i = ms.length - 1; i >= 0; i--) {
    if (pred(ms[i])) current++;
    else break;
  }
  return { current, longest };
}
function protectedStreak(ms, pred, earnedShields) {
  let kept = 0;
  let used = 0;
  for (let i = ms.length - 1; i >= 0; i--) {
    if (pred(ms[i])) {
      kept++;
      continue;
    }
    if (used < earnedShields) {
      used++;
      continue;
    }
    break;
  }
  return { protectedCount: kept, shieldsLeft: Math.max(0, earnedShields - used) };
}
function nextMilestone(current) {
  for (const m of [3, 5, 10, 15, 20, 25, 30, 50, 75, 100]) {
    if (m > current) return m;
  }
  return current + 25;
}
function buildLevelPath(totalXpValue, matches) {
  const currentLevel = levelFromXp(totalXpValue, matches).level;
  const start = Math.max(0, currentLevel - 1);
  const end = currentLevel + 4;
  const path2 = [];
  for (let level = start; level <= end; level++) {
    const threshold = cumulativeXpThreshold(level);
    path2.push({
      level,
      title: titleForLevel(level),
      xpThreshold: threshold,
      reached: totalXpValue >= threshold,
      current: level === currentLevel
    });
  }
  return path2;
}
function subAvg(ms, key) {
  const vals = ms.map((m) => m.process.subMetrics[key]).filter(def5);
  return vals.length ? avg4(vals) : 0;
}
function computeBests(ms) {
  const bests = [];
  const best2 = (label, pick, fmt, dir = "max") => {
    const withVal = ms.map((m) => ({ m, v: pick(m) })).filter((x) => x.v != null);
    if (!withVal.length) return;
    const winner = withVal.reduce(
      (a, b) => dir === "max" ? b.v > a.v ? b : a : b.v < a.v ? b : a
    );
    bests.push({
      label,
      value: fmt(winner.v),
      when: localDay(winner.m.playedAt),
      matchId: winner.m.id
    });
  };
  best2("Best process score", (m) => m.process.score, (n) => String(n));
  best2("Highest CS @ 10", (m) => m.objective.csAt10 ?? null, (n) => String(n));
  best2(
    "Biggest gold lead @ 15",
    (m) => m.objective.goldDiffAt15 ?? null,
    (n) => `+${n}`
  );
  best2(
    "Longest game survived",
    (m) => m.objective.durationSec ?? null,
    (n) => `${Math.round(n / 60)}m`
  );
  return bests;
}
function compareMetric(key, label, unit, direction, nowVals, thenVals) {
  if (nowVals.length === 0 || thenVals.length === 0) return null;
  const now3 = round13(avg4(nowVals));
  const then = round13(avg4(thenVals));
  const delta = round13(now3 - then);
  const improved = direction === "higher" ? delta > 0 : direction === "lower" ? delta < 0 : null;
  return { key, label, unit, direction, now: now3, then, delta, improved };
}
function buildPastComparison(ms) {
  const window2 = Math.max(5, Math.min(10, Math.floor(ms.length / 2)));
  const nowSlice = ms.slice(-window2);
  const thenSlice = ms.slice(-window2 * 2, -window2);
  if (nowSlice.length === 0 || thenSlice.length === 0) {
    return { rows: [], window: window2 };
  }
  const row = (...args) => compareMetric(...args);
  const rows = [
    row(
      "process",
      "Game score",
      "",
      "higher",
      nowSlice.map((m) => m.process.score),
      thenSlice.map((m) => m.process.score)
    ),
    row(
      "cs10",
      "CS @ 10",
      "cs",
      "higher",
      nowSlice.map((m) => m.objective.csAt10).filter(def5),
      thenSlice.map((m) => m.objective.csAt10).filter(def5)
    ),
    row(
      "gold15",
      "Gold diff @ 15",
      "g",
      "higher",
      nowSlice.map((m) => m.objective.goldDiffAt15).filter(def5),
      thenSlice.map((m) => m.objective.goldDiffAt15).filter(def5)
    ),
    row(
      "deaths15",
      "Deaths before 15",
      "",
      "lower",
      nowSlice.map((m) => m.objective.deathsBefore15).filter(def5),
      thenSlice.map((m) => m.objective.deathsBefore15).filter(def5)
    ),
    row(
      "tilt",
      "Tilt after",
      "",
      "lower",
      nowSlice.map((m) => m.scorecard.tiltAfter),
      thenSlice.map((m) => m.scorecard.tiltAfter)
    ),
    row(
      "review",
      "Review completion",
      "%",
      "higher",
      [
        Math.round(
          nowSlice.filter(
            (m) => m.scorecard.reviewed && m.scorecard.oneAdjustment.trim().length > 0 && m.scorecard.biggestMistake.trim().length > 0
          ).length / nowSlice.length * 100
        )
      ],
      [
        Math.round(
          thenSlice.filter(
            (m) => m.scorecard.reviewed && m.scorecard.oneAdjustment.trim().length > 0 && m.scorecard.biggestMistake.trim().length > 0
          ).length / thenSlice.length * 100
        )
      ]
    )
  ].filter(def5);
  return { rows, window: window2 };
}
function buildProgress() {
  const seasons = store.seasons();
  const pool = store.activePool();
  const enriched = enrichAll(store.matches(), seasons, pool);
  const metrics = METRICS2.map(({ key, label, unit, direction }) => ({
    key,
    label,
    unit,
    direction
  }));
  if (enriched.length === 0) {
    return {
      hasData: false,
      totalGames: 0,
      metrics,
      series: [],
      matches: [],
      insights: [],
      blocks: [],
      calendar: [],
      streaks: [],
      radar: [],
      lpTimeline: [],
      personalBests: [],
      levelPath: [],
      pastComparison: [],
      pastComparisonWindow: 0
    };
  }
  const seasonName = new Map(seasons.map((s) => [s.id, s.name]));
  const series = enriched.map((m, i) => {
    const values = {};
    for (const md of METRICS2) values[md.key] = md.pick(m);
    return {
      index: i + 1,
      date: m.playedAt,
      blockId: m.seasonId ?? "career",
      blockName: m.seasonId && seasonName.get(m.seasonId) || "Career",
      win: m.objective.win ?? null,
      values
    };
  });
  const matches = enriched.map((m, i) => ({
    index: i + 1,
    matchId: m.id,
    champion: m.objective.champion ?? null,
    queue: m.objective.queue ?? null,
    win: m.objective.win ?? null,
    kills: m.objective.kills ?? 0,
    deaths: m.objective.deaths ?? 0,
    assists: m.objective.assists ?? 0,
    process: m.process.score,
    verdict: m.verdict,
    playedAt: m.playedAt
  })).reverse();
  const blocks = [...seasons].sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt)).map((s) => {
    const bm = enriched.filter((m) => matchInBlock(m, s));
    const wins = bm.filter((m) => m.objective.win).length;
    const metricAvgs = {};
    for (const md of METRICS2) {
      const vals = bm.map(md.pick).filter(def5);
      metricAvgs[md.key] = vals.length ? round13(avg4(vals)) : null;
    }
    return {
      id: s.id,
      name: s.name,
      identityName: getIdentity(s.identityId).name,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      games: bm.length,
      wins,
      winRate: bm.length ? Math.round(wins / bm.length * 100) : 0,
      netLp: bm.reduce((a, m) => a + (m.objective.lpDelta ?? 0), 0),
      avgProcess: bm.length ? Math.round(avg4(bm.map((m) => m.process.score))) : 0,
      metrics: metricAvgs
    };
  }).filter((b) => b.games > 0);
  const byDay = /* @__PURE__ */ new Map();
  for (const m of enriched) {
    const d = localDay(m.playedAt);
    (byDay.get(d) ?? byDay.set(d, []).get(d)).push(m);
  }
  const calendar = [...byDay.entries()].map(([date, ds]) => ({
    date,
    games: ds.length,
    avgProcess: Math.round(avg4(ds.map((m) => m.process.score))),
    reviewedRate: ds.filter((m) => m.scorecard.reviewed).length / ds.length
  })).sort((a, b) => a.date.localeCompare(b.date));
  const streakDefs = [
    {
      key: "review",
      label: "Review streak",
      unit: "games",
      pred: (m) => m.scorecard.reviewed && m.scorecard.oneAdjustment.trim().length > 0
    },
    {
      key: "noFlame",
      label: "No-flame streak",
      unit: "games",
      pred: (m) => !m.scorecard.flamed
    },
    {
      key: "cleanEarly",
      label: "Clean-early streak",
      unit: "games",
      pred: (m) => (m.objective.deathsBefore15 ?? 99) <= 2
    },
    {
      key: "calm",
      label: "Calm-exit streak",
      unit: "games",
      pred: (m) => m.scorecard.tiltAfter <= 2
    }
  ];
  const streakStats = streakDefs.map((d) => {
    const raw = streaks(enriched, d.pred);
    const earnedShields = Math.min(2, Math.floor(raw.longest / 5));
    const forgiven = protectedStreak(enriched, d.pred, earnedShields);
    return {
      key: d.key,
      label: d.label,
      current: raw.current,
      protected: forgiven.protectedCount,
      shields: forgiven.shieldsLeft,
      longest: raw.longest,
      nextMilestone: nextMilestone(forgiven.protectedCount),
      unit: d.unit
    };
  });
  const active2 = store.activeSeason();
  const activeMatches = active2 ? enriched.filter((m) => matchInBlock(m, active2)) : enriched;
  const radar = RADAR_METRICS.map(({ key, label }) => ({
    metric: key,
    label,
    current: Math.round(subAvg(activeMatches, key) * 100),
    career: Math.round(subAvg(enriched, key) * 100)
  }));
  const rankedGames = enriched.filter((m) => (m.objective.queue ?? "").toUpperCase().includes("RANKED"));
  let cum = 0;
  const lpTimeline = rankedGames.map((m, i) => {
    const delta = m.objective.lpDelta ?? (m.objective.win === true ? 20 : m.objective.win === false ? -18 : 0);
    cum += delta;
    return {
      index: i + 1,
      date: m.playedAt,
      cumulativeLp: cum,
      leaguePoints: m.objective.leaguePoints ?? null
    };
  });
  const personalBests = computeBests(enriched);
  const totalCareerXp = totalXp(enriched);
  const levelPath = buildLevelPath(totalCareerXp, enriched);
  const past = buildPastComparison(enriched);
  return {
    hasData: true,
    totalGames: enriched.length,
    metrics,
    series,
    matches,
    insights: buildInsights(enriched),
    blocks,
    calendar,
    streaks: streakStats,
    radar,
    lpTimeline,
    personalBests,
    levelPath,
    pastComparison: past.rows,
    pastComparisonWindow: past.window
  };
}

// node_modules/@anthropic-ai/sdk/internal/tslib.mjs
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m")
    throw new TypeError("Private method is not writable");
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

// node_modules/@anthropic-ai/sdk/internal/utils/uuid.mjs
var uuid4 = function() {
  const { crypto: crypto2 } = globalThis;
  if (crypto2?.randomUUID) {
    uuid4 = crypto2.randomUUID.bind(crypto2);
    return crypto2.randomUUID();
  }
  const u8 = new Uint8Array(1);
  const randomByte = crypto2 ? () => crypto2.getRandomValues(u8)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ randomByte() & 15 >> +c / 4).toString(16));
};

// node_modules/@anthropic-ai/sdk/internal/utils/values.mjs
init_error();
var startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
var isAbsoluteURL = (url) => {
  return startsWithSchemeRegexp.test(url);
};
var isArray = (val) => (isArray = Array.isArray, isArray(val));
var isReadonlyArray = isArray;
function maybeObj(x) {
  if (typeof x !== "object") {
    return {};
  }
  return x ?? {};
}
function isEmptyObj(obj) {
  if (!obj)
    return true;
  for (const _k in obj)
    return false;
  return true;
}
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
var validatePositiveInteger = (name, n) => {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new AnthropicError(`${name} must be an integer`);
  }
  if (n < 0) {
    throw new AnthropicError(`${name} must be a positive integer`);
  }
  return n;
};
var safeJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return void 0;
  }
};

// node_modules/@anthropic-ai/sdk/internal/utils/sleep.mjs
var sleep = (ms, signal) => new Promise((resolve5) => {
  if (signal?.aborted)
    return resolve5();
  const onAbort = () => {
    clearTimeout(timer);
    resolve5();
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve5();
  }, ms);
  signal?.addEventListener("abort", onAbort, { once: true });
});

// node_modules/@anthropic-ai/sdk/client.mjs
init_errors();

// node_modules/@anthropic-ai/sdk/version.mjs
var VERSION = "0.110.0";

// node_modules/@anthropic-ai/sdk/internal/detect-platform.mjs
var isRunningInBrowser = () => {
  return (
    // @ts-ignore
    typeof window !== "undefined" && // @ts-ignore
    typeof window.document !== "undefined" && // @ts-ignore
    typeof navigator !== "undefined"
  );
};
function getDetectedPlatform() {
  if (typeof Deno !== "undefined" && Deno.build != null) {
    return "deno";
  }
  if (typeof EdgeRuntime !== "undefined") {
    return "edge";
  }
  if (Object.prototype.toString.call(typeof globalThis.process !== "undefined" ? globalThis.process : 0) === "[object process]") {
    return "node";
  }
  return "unknown";
}
var getPlatformProperties = () => {
  const detectedPlatform = getDetectedPlatform();
  if (detectedPlatform === "deno") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(Deno.build.os),
      "X-Stainless-Arch": normalizeArch(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version === "string" ? Deno.version : Deno.version?.deno ?? "unknown"
    };
  }
  if (typeof EdgeRuntime !== "undefined") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  }
  if (detectedPlatform === "node") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(globalThis.process.platform ?? "unknown"),
      "X-Stainless-Arch": normalizeArch(globalThis.process.arch ?? "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown"
    };
  }
  const browserInfo = getBrowserInfo();
  if (browserInfo) {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": "unknown",
      "X-Stainless-Runtime": `browser:${browserInfo.browser}`,
      "X-Stainless-Runtime-Version": browserInfo.version
    };
  }
  return {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": VERSION,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
};
function getBrowserInfo() {
  if (typeof navigator === "undefined" || !navigator) {
    return null;
  }
  const browserPatterns = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key, pattern } of browserPatterns) {
    const match2 = pattern.exec(navigator.userAgent);
    if (match2) {
      const major = match2[1] || 0;
      const minor = match2[2] || 0;
      const patch = match2[3] || 0;
      return { browser: key, version: `${major}.${minor}.${patch}` };
    }
  }
  return null;
}
var normalizeArch = (arch) => {
  if (arch === "x32")
    return "x32";
  if (arch === "x86_64" || arch === "x64")
    return "x64";
  if (arch === "arm")
    return "arm";
  if (arch === "aarch64" || arch === "arm64")
    return "arm64";
  if (arch)
    return `other:${arch}`;
  return "unknown";
};
var normalizePlatform = (platform) => {
  platform = platform.toLowerCase();
  if (platform.includes("ios"))
    return "iOS";
  if (platform === "android")
    return "Android";
  if (platform === "darwin")
    return "MacOS";
  if (platform === "win32")
    return "Windows";
  if (platform === "freebsd")
    return "FreeBSD";
  if (platform === "openbsd")
    return "OpenBSD";
  if (platform === "linux")
    return "Linux";
  if (platform)
    return `Other:${platform}`;
  return "Unknown";
};
var _platformHeaders;
var getPlatformHeaders = () => {
  return _platformHeaders ?? (_platformHeaders = getPlatformProperties());
};

// node_modules/@anthropic-ai/sdk/internal/shims.mjs
function getDefaultFetch() {
  if (typeof fetch !== "undefined") {
    return fetch;
  }
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new Anthropic({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function makeReadableStream(...args) {
  const ReadableStream2 = globalThis.ReadableStream;
  if (typeof ReadableStream2 === "undefined") {
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  }
  return new ReadableStream2(...args);
}
function ReadableStreamFrom(iterable) {
  let iter = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
  return makeReadableStream({
    start() {
    },
    async pull(controller) {
      const { done, value } = await iter.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel() {
      await iter.return?.();
    }
  });
}
function ReadableStreamToAsyncIterable(stream) {
  if (stream[Symbol.asyncIterator])
    return stream;
  const reader = stream.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result?.done)
          reader.releaseLock();
        return result;
      } catch (e) {
        reader.releaseLock();
        throw e;
      }
    },
    async return() {
      const cancelPromise = reader.cancel();
      reader.releaseLock();
      await cancelPromise;
      return { done: true, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function CancelReadableStream(stream) {
  if (stream === null || typeof stream !== "object")
    return;
  if (stream[Symbol.asyncIterator]) {
    await stream[Symbol.asyncIterator]().return?.();
    return;
  }
  const reader = stream.getReader();
  const cancelPromise = reader.cancel();
  reader.releaseLock();
  await cancelPromise;
}

// node_modules/@anthropic-ai/sdk/internal/request-options.mjs
var FallbackEncoder = ({ headers, body }) => {
  return {
    bodyHeaders: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
};

// node_modules/@anthropic-ai/sdk/internal/qs/formats.mjs
var default_format = "RFC3986";
var default_formatter = (v) => String(v);
var formatters = {
  RFC1738: (v) => String(v).replace(/%20/g, "+"),
  RFC3986: default_formatter
};
var RFC1738 = "RFC1738";

// node_modules/@anthropic-ai/sdk/internal/qs/utils.mjs
var has = (obj, key) => (has = Object.hasOwn ?? Function.prototype.call.bind(Object.prototype.hasOwnProperty), has(obj, key));
var hex_table = /* @__PURE__ */ (() => {
  const array = [];
  for (let i = 0; i < 256; ++i) {
    array.push("%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase());
  }
  return array;
})();
var limit = 1024;
var encode = (str, _defaultEncoder, charset, _kind, format) => {
  if (str.length === 0) {
    return str;
  }
  let string = str;
  if (typeof str === "symbol") {
    string = Symbol.prototype.toString.call(str);
  } else if (typeof str !== "string") {
    string = String(str);
  }
  if (charset === "iso-8859-1") {
    return escape(string).replace(/%u[0-9a-f]{4}/gi, function($0) {
      return "%26%23" + parseInt($0.slice(2), 16) + "%3B";
    });
  }
  let out = "";
  for (let j = 0; j < string.length; j += limit) {
    const segment = string.length >= limit ? string.slice(j, j + limit) : string;
    const arr = [];
    for (let i = 0; i < segment.length; ++i) {
      let c = segment.charCodeAt(i);
      if (c === 45 || // -
      c === 46 || // .
      c === 95 || // _
      c === 126 || // ~
      c >= 48 && c <= 57 || // 0-9
      c >= 65 && c <= 90 || // a-z
      c >= 97 && c <= 122 || // A-Z
      format === RFC1738 && (c === 40 || c === 41)) {
        arr[arr.length] = segment.charAt(i);
        continue;
      }
      if (c < 128) {
        arr[arr.length] = hex_table[c];
        continue;
      }
      if (c < 2048) {
        arr[arr.length] = hex_table[192 | c >> 6] + hex_table[128 | c & 63];
        continue;
      }
      if (c < 55296 || c >= 57344) {
        arr[arr.length] = hex_table[224 | c >> 12] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
        continue;
      }
      i += 1;
      c = 65536 + ((c & 1023) << 10 | segment.charCodeAt(i) & 1023);
      arr[arr.length] = hex_table[240 | c >> 18] + hex_table[128 | c >> 12 & 63] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
    }
    out += arr.join("");
  }
  return out;
};
function is_buffer(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
}
function maybe_map(val, fn) {
  if (isArray(val)) {
    const mapped = [];
    for (let i = 0; i < val.length; i += 1) {
      mapped.push(fn(val[i]));
    }
    return mapped;
  }
  return fn(val);
}

// node_modules/@anthropic-ai/sdk/internal/qs/stringify.mjs
var array_prefix_generators = {
  brackets(prefix) {
    return String(prefix) + "[]";
  },
  comma: "comma",
  indices(prefix, key) {
    return String(prefix) + "[" + key + "]";
  },
  repeat(prefix) {
    return String(prefix);
  }
};
var push_to_array = function(arr, value_or_array) {
  Array.prototype.push.apply(arr, isArray(value_or_array) ? value_or_array : [value_or_array]);
};
var toISOString;
var defaults = {
  addQueryPrefix: false,
  allowDots: false,
  allowEmptyArrays: false,
  arrayFormat: "indices",
  charset: "utf-8",
  charsetSentinel: false,
  delimiter: "&",
  encode: true,
  encodeDotInKeys: false,
  encoder: encode,
  encodeValuesOnly: false,
  format: default_format,
  formatter: default_formatter,
  /** @deprecated */
  indices: false,
  serializeDate(date) {
    return (toISOString ?? (toISOString = Function.prototype.call.bind(Date.prototype.toISOString)))(date);
  },
  skipNulls: false,
  strictNullHandling: false
};
function is_non_nullish_primitive(v) {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "symbol" || typeof v === "bigint";
}
var sentinel = {};
function inner_stringify(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder2, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, sideChannel) {
  let obj = object;
  let tmp_sc = sideChannel;
  let step = 0;
  let find_flag = false;
  while ((tmp_sc = tmp_sc.get(sentinel)) !== void 0 && !find_flag) {
    const pos = tmp_sc.get(object);
    step += 1;
    if (typeof pos !== "undefined") {
      if (pos === step) {
        throw new RangeError("Cyclic object value");
      } else {
        find_flag = true;
      }
    }
    if (typeof tmp_sc.get(sentinel) === "undefined") {
      step = 0;
    }
  }
  if (typeof filter === "function") {
    obj = filter(prefix, obj);
  } else if (obj instanceof Date) {
    obj = serializeDate?.(obj);
  } else if (generateArrayPrefix === "comma" && isArray(obj)) {
    obj = maybe_map(obj, function(value) {
      if (value instanceof Date) {
        return serializeDate?.(value);
      }
      return value;
    });
  }
  if (obj === null) {
    if (strictNullHandling) {
      return encoder2 && !encodeValuesOnly ? (
        // @ts-expect-error
        encoder2(prefix, defaults.encoder, charset, "key", format)
      ) : prefix;
    }
    obj = "";
  }
  if (is_non_nullish_primitive(obj) || is_buffer(obj)) {
    if (encoder2) {
      const key_value = encodeValuesOnly ? prefix : encoder2(prefix, defaults.encoder, charset, "key", format);
      return [
        formatter?.(key_value) + "=" + // @ts-expect-error
        formatter?.(encoder2(obj, defaults.encoder, charset, "value", format))
      ];
    }
    return [formatter?.(prefix) + "=" + formatter?.(String(obj))];
  }
  const values = [];
  if (typeof obj === "undefined") {
    return values;
  }
  let obj_keys;
  if (generateArrayPrefix === "comma" && isArray(obj)) {
    if (encodeValuesOnly && encoder2) {
      obj = maybe_map(obj, encoder2);
    }
    obj_keys = [{ value: obj.length > 0 ? obj.join(",") || null : void 0 }];
  } else if (isArray(filter)) {
    obj_keys = filter;
  } else {
    const keys = Object.keys(obj);
    obj_keys = sort ? keys.sort(sort) : keys;
  }
  const encoded_prefix = encodeDotInKeys ? String(prefix).replace(/\./g, "%2E") : String(prefix);
  const adjusted_prefix = commaRoundTrip && isArray(obj) && obj.length === 1 ? encoded_prefix + "[]" : encoded_prefix;
  if (allowEmptyArrays && isArray(obj) && obj.length === 0) {
    return adjusted_prefix + "[]";
  }
  for (let j = 0; j < obj_keys.length; ++j) {
    const key = obj_keys[j];
    const value = (
      // @ts-ignore
      typeof key === "object" && typeof key.value !== "undefined" ? key.value : obj[key]
    );
    if (skipNulls && value === null) {
      continue;
    }
    const encoded_key = allowDots && encodeDotInKeys ? key.replace(/\./g, "%2E") : key;
    const key_prefix = isArray(obj) ? typeof generateArrayPrefix === "function" ? generateArrayPrefix(adjusted_prefix, encoded_key) : adjusted_prefix : adjusted_prefix + (allowDots ? "." + encoded_key : "[" + encoded_key + "]");
    sideChannel.set(object, step);
    const valueSideChannel = /* @__PURE__ */ new WeakMap();
    valueSideChannel.set(sentinel, sideChannel);
    push_to_array(values, inner_stringify(
      value,
      key_prefix,
      generateArrayPrefix,
      commaRoundTrip,
      allowEmptyArrays,
      strictNullHandling,
      skipNulls,
      encodeDotInKeys,
      // @ts-ignore
      generateArrayPrefix === "comma" && encodeValuesOnly && isArray(obj) ? null : encoder2,
      filter,
      sort,
      allowDots,
      serializeDate,
      format,
      formatter,
      encodeValuesOnly,
      charset,
      valueSideChannel
    ));
  }
  return values;
}
function normalize_stringify_options(opts = defaults) {
  if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
    throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
  }
  if (typeof opts.encodeDotInKeys !== "undefined" && typeof opts.encodeDotInKeys !== "boolean") {
    throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
  }
  if (opts.encoder !== null && typeof opts.encoder !== "undefined" && typeof opts.encoder !== "function") {
    throw new TypeError("Encoder has to be a function.");
  }
  const charset = opts.charset || defaults.charset;
  if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
    throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
  }
  let format = default_format;
  if (typeof opts.format !== "undefined") {
    if (!has(formatters, opts.format)) {
      throw new TypeError("Unknown format option provided.");
    }
    format = opts.format;
  }
  const formatter = formatters[format];
  let filter = defaults.filter;
  if (typeof opts.filter === "function" || isArray(opts.filter)) {
    filter = opts.filter;
  }
  let arrayFormat;
  if (opts.arrayFormat && opts.arrayFormat in array_prefix_generators) {
    arrayFormat = opts.arrayFormat;
  } else if ("indices" in opts) {
    arrayFormat = opts.indices ? "indices" : "repeat";
  } else {
    arrayFormat = defaults.arrayFormat;
  }
  if ("commaRoundTrip" in opts && typeof opts.commaRoundTrip !== "boolean") {
    throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
  }
  const allowDots = typeof opts.allowDots === "undefined" ? !!opts.encodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
  return {
    addQueryPrefix: typeof opts.addQueryPrefix === "boolean" ? opts.addQueryPrefix : defaults.addQueryPrefix,
    // @ts-ignore
    allowDots,
    allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
    arrayFormat,
    charset,
    charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
    commaRoundTrip: !!opts.commaRoundTrip,
    delimiter: typeof opts.delimiter === "undefined" ? defaults.delimiter : opts.delimiter,
    encode: typeof opts.encode === "boolean" ? opts.encode : defaults.encode,
    encodeDotInKeys: typeof opts.encodeDotInKeys === "boolean" ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
    encoder: typeof opts.encoder === "function" ? opts.encoder : defaults.encoder,
    encodeValuesOnly: typeof opts.encodeValuesOnly === "boolean" ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
    filter,
    format,
    formatter,
    serializeDate: typeof opts.serializeDate === "function" ? opts.serializeDate : defaults.serializeDate,
    skipNulls: typeof opts.skipNulls === "boolean" ? opts.skipNulls : defaults.skipNulls,
    // @ts-ignore
    sort: typeof opts.sort === "function" ? opts.sort : null,
    strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling
  };
}
function stringify(object, opts = {}) {
  let obj = object;
  const options = normalize_stringify_options(opts);
  let obj_keys;
  let filter;
  if (typeof options.filter === "function") {
    filter = options.filter;
    obj = filter("", obj);
  } else if (isArray(options.filter)) {
    filter = options.filter;
    obj_keys = filter;
  }
  const keys = [];
  if (typeof obj !== "object" || obj === null) {
    return "";
  }
  const generateArrayPrefix = array_prefix_generators[options.arrayFormat];
  const commaRoundTrip = generateArrayPrefix === "comma" && options.commaRoundTrip;
  if (!obj_keys) {
    obj_keys = Object.keys(obj);
  }
  if (options.sort) {
    obj_keys.sort(options.sort);
  }
  const sideChannel = /* @__PURE__ */ new WeakMap();
  for (let i = 0; i < obj_keys.length; ++i) {
    const key = obj_keys[i];
    if (options.skipNulls && obj[key] === null) {
      continue;
    }
    push_to_array(keys, inner_stringify(
      obj[key],
      key,
      // @ts-expect-error
      generateArrayPrefix,
      commaRoundTrip,
      options.allowEmptyArrays,
      options.strictNullHandling,
      options.skipNulls,
      options.encodeDotInKeys,
      options.encode ? options.encoder : null,
      options.filter,
      options.sort,
      options.allowDots,
      options.serializeDate,
      options.format,
      options.formatter,
      options.encodeValuesOnly,
      options.charset,
      sideChannel
    ));
  }
  const joined = keys.join(options.delimiter);
  let prefix = options.addQueryPrefix === true ? "?" : "";
  if (options.charsetSentinel) {
    if (options.charset === "iso-8859-1") {
      prefix += "utf8=%26%2310003%3B&";
    } else {
      prefix += "utf8=%E2%9C%93&";
    }
  }
  return joined.length > 0 ? prefix + joined : "";
}

// node_modules/@anthropic-ai/sdk/internal/utils/query.mjs
function stringifyQuery(query) {
  return stringify(query, { arrayFormat: "brackets" });
}

// node_modules/@anthropic-ai/sdk/client.mjs
init_error();

// node_modules/@anthropic-ai/sdk/lib/credentials/types.mjs
init_error();
var GRANT_TYPE_JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer";
var GRANT_TYPE_REFRESH_TOKEN = "refresh_token";
var TOKEN_ENDPOINT = "/v1/oauth/token";
var OAUTH_API_BETA_HEADER = "oauth-2025-04-20";
var FEDERATION_BETA_HEADER = "oidc-federation-2026-04-01";
var ADVISORY_REFRESH_THRESHOLD_IN_SECONDS = 120;
var MANDATORY_REFRESH_THRESHOLD_IN_SECONDS = 30;
var ADVISORY_REFRESH_BACKOFF_IN_SECONDS = 5;
var MAX_TOKEN_RESPONSE_BYTES = 1 << 20;
function requireSecureTokenEndpoint(baseURL) {
  if (!baseURL)
    return;
  let u;
  try {
    u = new URL(baseURL);
  } catch (err) {
    throw new WorkloadIdentityError(`Invalid token endpoint base URL "${baseURL}": ${err}`);
  }
  if (u.protocol === "https:")
    return;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (u.protocol === "http:" && (host === "localhost" || host === "127.0.0.1" || host === "::1")) {
    return;
  }
  throw new WorkloadIdentityError(`Refusing to send credential over non-https token endpoint "${baseURL}"`);
}
async function parseTokenResponse(resp, requestId) {
  const text = await readLimitedText(resp);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new WorkloadIdentityError(`Token endpoint returned non-JSON response (status ${resp.status})`, resp.status, redactSensitive(text), requestId);
  }
  if (!data.access_token) {
    throw new WorkloadIdentityError(`Token endpoint response missing access_token: ${JSON.stringify(redactSensitive(data))}`, resp.status, redactSensitive(data), requestId);
  }
  if (data.token_type && data.token_type.toLowerCase() !== "bearer") {
    throw new WorkloadIdentityError(`Token endpoint response: unsupported token_type "${data.token_type}" (want Bearer)`, resp.status, redactSensitive(data), requestId);
  }
  return data;
}
var MAX_ERROR_BODY_CHARS = 2e3;
var SAFE_ERROR_KEYS = /* @__PURE__ */ new Set(["error", "error_description", "error_uri"]);
function redactSensitive(body) {
  if (body == null)
    return body;
  if (typeof body === "string") {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      if (body.length <= MAX_ERROR_BODY_CHARS)
        return body;
      return body.slice(0, MAX_ERROR_BODY_CHARS) + `... <${body.length - MAX_ERROR_BODY_CHARS} more chars>`;
    }
    return JSON.stringify(redactSensitive(parsed));
  }
  if (typeof body === "object" && !Array.isArray(body)) {
    const out = {};
    for (const [k, v] of Object.entries(body)) {
      if (SAFE_ERROR_KEYS.has(k))
        out[k] = v;
    }
    return out;
  }
  return null;
}
async function checkCredentialsFileSafety(path2, onWarn = (m) => console.warn(`anthropic-sdk: ${m}`)) {
  if (typeof process === "undefined" || process.platform === "win32")
    return;
  const fs = await import("node:fs");
  let resolved = path2;
  let st;
  try {
    resolved = await fs.promises.realpath(path2);
    st = await fs.promises.stat(resolved);
  } catch {
    return;
  }
  const mode = st.mode & 511;
  if (mode & 18) {
    throw new WorkloadIdentityError(`Credentials file at ${resolved} is group/world-writable (mode 0o${mode.toString(8)}); this allows other local users to plant tokens. Run \`chmod 600 ${resolved}\`.`);
  }
  if (mode & 36) {
    throw new WorkloadIdentityError(`Credentials file at ${resolved} is group/world-readable (mode 0o${mode.toString(8)}); run \`chmod 600 ${resolved}\` before retrying.`);
  }
  if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
    onWarn(`credentials file at ${resolved} is owned by uid ${st.uid} (current process uid ${process.getuid()}); verify this is intentional.`);
  }
}
async function writeCredentialsFileAtomic(targetPath, data) {
  const fs = await import("node:fs");
  const path2 = await import("node:path");
  const dir = path2.dirname(targetPath);
  await fs.promises.mkdir(dir, { recursive: true, mode: 448 });
  const tmpPath = `${targetPath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    const fh = await fs.promises.open(tmpPath, "w", 384);
    try {
      await fh.writeFile(JSON.stringify(data, null, 2));
      await fh.sync();
    } finally {
      await fh.close();
    }
    await fs.promises.rename(tmpPath, targetPath);
  } catch (err) {
    await fs.promises.unlink(tmpPath).catch(() => {
    });
    throw err;
  }
  try {
    const dirFh = await fs.promises.open(dir, "r");
    try {
      await dirFh.sync();
    } finally {
      await dirFh.close();
    }
  } catch {
  }
}
async function readLimitedText(resp) {
  if (!resp.body) {
    return "";
  }
  const reader = resp.body.getReader();
  const chunks = [];
  let received = 0;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done)
      break;
    if (received + value.length > MAX_TOKEN_RESPONSE_BYTES) {
      const remaining = MAX_TOKEN_RESPONSE_BYTES - received;
      if (remaining > 0)
        chunks.push(value.subarray(0, remaining));
      await reader.cancel();
      break;
    }
    chunks.push(value);
    received += value.length;
  }
  let merged;
  if (chunks.length === 1) {
    merged = chunks[0];
  } else {
    merged = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
  }
  return new TextDecoder("utf-8").decode(merged);
}
var WorkloadIdentityError = class extends AnthropicError {
  constructor(message, statusCode = null, body = null, requestId = null) {
    super(message);
    this.statusCode = statusCode;
    this.body = body;
    this.requestId = requestId;
  }
};

// node_modules/@anthropic-ai/sdk/internal/utils/time.mjs
function nowAsSeconds() {
  return Math.floor(Date.now() / 1e3);
}

// node_modules/@anthropic-ai/sdk/lib/credentials/token-cache.mjs
var TokenCache = class {
  constructor(provider, onAdvisoryRefreshError) {
    this.cached = null;
    this.pendingRefresh = null;
    this.nextForce = false;
    this.lastAdvisoryError = 0;
    this.provider = provider;
    this.onAdvisoryRefreshError = onAdvisoryRefreshError;
  }
  async getToken() {
    const force = this.nextForce;
    this.nextForce = false;
    const cached = this.cached;
    if (force || cached == null) {
      const token2 = await this.refresh(force);
      return token2.token;
    }
    if (cached.expiresAt == null) {
      return cached.token;
    }
    const remaining = cached.expiresAt - nowAsSeconds();
    if (remaining > ADVISORY_REFRESH_THRESHOLD_IN_SECONDS) {
      return cached.token;
    }
    if (remaining > MANDATORY_REFRESH_THRESHOLD_IN_SECONDS) {
      this.backgroundRefresh();
      return cached.token;
    }
    const token = await this.refresh();
    return token.token;
  }
  /**
   * Clears the cached token and marks the next {@link getToken} as a forced
   * refresh, so the underlying provider bypasses any on-disk freshness check.
   * Called after a 401 — the server has just told us the token is bad even
   * if its `expires_at` still looks fresh.
   */
  invalidate() {
    this.cached = null;
    this.nextForce = true;
  }
  /**
   * Mandatory refresh. Joins any in-flight refresh unless forced — a forced
   * refresh must not coalesce into a non-forced one that may re-serve the
   * same stale disk token.
   */
  refresh(force = false) {
    if (this.pendingRefresh && !force) {
      return this.pendingRefresh;
    }
    return this.doRefresh(force);
  }
  /**
   * Advisory background refresh. Shares the same in-flight promise as
   * mandatory refreshes for deduplication, but swallows errors so the
   * stale cached token keeps being served. Backs off for
   * {@link ADVISORY_REFRESH_BACKOFF_IN_SECONDS} after a failure so an
   * outage during the advisory window doesn't hammer the token endpoint.
   */
  backgroundRefresh() {
    if (this.pendingRefresh) {
      return;
    }
    if (nowAsSeconds() - this.lastAdvisoryError < ADVISORY_REFRESH_BACKOFF_IN_SECONDS) {
      return;
    }
    this.doRefresh().catch((err) => {
      this.lastAdvisoryError = nowAsSeconds();
      this.onAdvisoryRefreshError?.(err);
    });
  }
  /**
   * Core refresh. Sets {@link pendingRefresh} so concurrent callers
   * (both advisory and mandatory) coalesce into a single provider call.
   */
  doRefresh(force = false) {
    this.pendingRefresh = this.provider(force ? { forceRefresh: true } : void 0).then((token) => {
      this.cached = token;
      this.pendingRefresh = null;
      return token;
    }, (err) => {
      this.pendingRefresh = null;
      throw err;
    });
    return this.pendingRefresh;
  }
};

// node_modules/@anthropic-ai/sdk/internal/utils/env.mjs
var readEnv = (env) => {
  if (typeof globalThis.process !== "undefined") {
    return globalThis.process.env?.[env]?.trim() || void 0;
  }
  if (typeof globalThis.Deno !== "undefined") {
    return globalThis.Deno.env?.get?.(env)?.trim() || void 0;
  }
  return void 0;
};

// node_modules/@anthropic-ai/sdk/internal/utils/base64.mjs
init_error();

// node_modules/@anthropic-ai/sdk/internal/utils/bytes.mjs
function concatBytes(buffers) {
  let length = 0;
  for (const buffer of buffers) {
    length += buffer.length;
  }
  const output = new Uint8Array(length);
  let index = 0;
  for (const buffer of buffers) {
    output.set(buffer, index);
    index += buffer.length;
  }
  return output;
}
var encodeUTF8_;
function encodeUTF8(str) {
  let encoder2;
  return (encodeUTF8_ ?? (encoder2 = new globalThis.TextEncoder(), encodeUTF8_ = encoder2.encode.bind(encoder2)))(str);
}
var decodeUTF8_;
function decodeUTF8(bytes) {
  let decoder;
  return (decodeUTF8_ ?? (decoder = new globalThis.TextDecoder(), decodeUTF8_ = decoder.decode.bind(decoder)))(bytes);
}

// node_modules/@anthropic-ai/sdk/internal/utils/log.mjs
var defaultLogLevel = "warn";
var levelNumbers = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
};
var parseLogLevel = (maybeLevel, sourceName, logger) => {
  if (!maybeLevel) {
    return void 0;
  }
  if (hasOwn(levelNumbers, maybeLevel)) {
    return maybeLevel;
  }
  logger.warn(`${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(Object.keys(levelNumbers))}`);
  return void 0;
};
function noop() {
}
function makeLogFn(fnLevel, logger, logLevel) {
  if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
    return noop;
  } else {
    return logger[fnLevel].bind(logger);
  }
}
var noopLogger = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop
};
var cachedLoggers = /* @__PURE__ */ new WeakMap();
function filterLogger(logger, logLevel) {
  const cachedLogger = cachedLoggers.get(logger);
  if (cachedLogger && cachedLogger[0] === logLevel) {
    return cachedLogger[1];
  }
  const levelLogger = {
    error: makeLogFn("error", logger, logLevel),
    warn: makeLogFn("warn", logger, logLevel),
    info: makeLogFn("info", logger, logLevel),
    debug: makeLogFn("debug", logger, logLevel)
  };
  cachedLoggers.set(logger, [logLevel, levelLogger]);
  return levelLogger;
}
function loggerFor(client) {
  const logger = client.logger;
  const logLevel = client.logLevel ?? "off";
  if (!logger) {
    return noopLogger;
  }
  return filterLogger(logger, logLevel);
}
var lastEnvLevel;
var cachedDefaultLogger;
function defaultLogger() {
  const envLevel = readEnv("ANTHROPIC_LOG");
  if (!cachedDefaultLogger || envLevel !== lastEnvLevel) {
    lastEnvLevel = envLevel;
    cachedDefaultLogger = filterLogger(console, parseLogLevel(envLevel, "process.env['ANTHROPIC_LOG']", filterLogger(console, defaultLogLevel)) ?? defaultLogLevel);
  }
  return cachedDefaultLogger;
}
var formatRequestDetails = (details) => {
  if (details.options) {
    details.options = { ...details.options };
    delete details.options["headers"];
  }
  if (details.headers) {
    details.headers = Object.fromEntries((details.headers instanceof Headers ? [...details.headers] : Object.entries(details.headers)).map(([name, value]) => [
      name,
      name.toLowerCase() === "authorization" || name.toLowerCase() === "api-key" || name.toLowerCase() === "x-api-key" || name.toLowerCase() === "cookie" || name.toLowerCase() === "set-cookie" ? "***" : value
    ]));
  }
  if ("retryOfRequestLogID" in details) {
    if (details.retryOfRequestLogID) {
      details.retryOf = details.retryOfRequestLogID;
    }
    delete details.retryOfRequestLogID;
  }
  return details;
};

// node_modules/@anthropic-ai/sdk/core/credentials.mjs
var CREDENTIALS_FILE_VERSION = "1.0";
var PROFILE_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
function validateProfileName(name) {
  if (!name) {
    throw new Error("profile name is empty");
  }
  if (name === "." || name === "..") {
    throw new Error(`profile name "${name}" is not allowed`);
  }
  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`profile name "${name}" must not contain path separators`);
  }
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new Error(`profile name "${name}" contains disallowed characters (allowed: letters, digits, '_', '.', '-')`);
  }
}
var loadConfigWithSource = async (profile) => {
  var _a2, _b;
  const rootConfigPath = await getRootConfigPath();
  if (rootConfigPath === null) {
    return null;
  }
  const profileName = profile ?? await getActiveProfileName();
  if (profileName === null) {
    return null;
  }
  validateProfileName(profileName);
  const fs = await import("node:fs");
  const path2 = await import("node:path");
  const configPath = path2.join(rootConfigPath, "configs", `${profileName}.json`);
  let configRaw;
  try {
    configRaw = await fs.promises.readFile(configPath, "utf-8");
  } catch (err) {
    if (err?.code !== "ENOENT") {
      throw new Error(`failed to read config file ${configPath}: ${err}`);
    }
    configRaw = null;
  }
  if (configRaw === null) {
    const organizationId = readEnv("ANTHROPIC_ORGANIZATION_ID");
    const identityTokenFile = readEnv("ANTHROPIC_IDENTITY_TOKEN_FILE");
    const federationRuleId = readEnv("ANTHROPIC_FEDERATION_RULE_ID");
    if (federationRuleId && organizationId) {
      return {
        fromFile: false,
        config: {
          organization_id: organizationId,
          // A defaulted-but-empty CI variable (`ANTHROPIC_WORKSPACE_ID=""`) is
          // treated as unset — readEnv coerces empty to undefined, and the body
          // builder's truthy check skips it — so `"workspace_id": ""` never goes
          // on the wire.
          workspace_id: readEnv("ANTHROPIC_WORKSPACE_ID"),
          base_url: readEnv("ANTHROPIC_BASE_URL"),
          authentication: {
            type: "oidc_federation",
            federation_rule_id: federationRuleId,
            service_account_id: readEnv("ANTHROPIC_SERVICE_ACCOUNT_ID"),
            identity_token: identityTokenFile ? { source: "file", path: identityTokenFile } : void 0,
            scope: readEnv("ANTHROPIC_SCOPE")
          }
        }
      };
    }
    return null;
  }
  let config;
  try {
    config = JSON.parse(configRaw);
  } catch (err) {
    throw new Error(`failed to parse config file ${configPath}: ${err}`);
  }
  if (!config.authentication) {
    throw new Error(`config file ${configPath} is missing "authentication"`);
  }
  const authType = config.authentication.type;
  if (authType !== "oidc_federation" && authType !== "user_oauth") {
    throw new Error(`authentication.type "${authType}" is not a known authentication type`);
  }
  config.organization_id ?? (config.organization_id = readEnv("ANTHROPIC_ORGANIZATION_ID"));
  config.workspace_id ?? (config.workspace_id = readEnv("ANTHROPIC_WORKSPACE_ID"));
  config.base_url ?? (config.base_url = readEnv("ANTHROPIC_BASE_URL"));
  (_a2 = config.authentication).scope ?? (_a2.scope = readEnv("ANTHROPIC_SCOPE"));
  if (config.authentication.type === "oidc_federation") {
    if (!config.authentication.identity_token) {
      const identityTokenFile = readEnv("ANTHROPIC_IDENTITY_TOKEN_FILE");
      if (identityTokenFile) {
        config.authentication.identity_token = {
          source: "file",
          path: identityTokenFile
        };
      }
    }
    if (!config.authentication.federation_rule_id) {
      config.authentication.federation_rule_id = readEnv("ANTHROPIC_FEDERATION_RULE_ID") ?? "";
    }
    (_b = config.authentication).service_account_id ?? (_b.service_account_id = readEnv("ANTHROPIC_SERVICE_ACCOUNT_ID"));
  }
  return { config, fromFile: true };
};
var getCredentialsPath = async (config, profile) => {
  if (config?.authentication.credentials_path) {
    return config.authentication.credentials_path;
  }
  const rootConfigPath = await getRootConfigPath();
  if (!rootConfigPath) {
    return null;
  }
  const profileName = profile ?? await getActiveProfileName();
  if (!profileName) {
    return null;
  }
  validateProfileName(profileName);
  const path2 = await import("node:path");
  return path2.join(rootConfigPath, "credentials", `${profileName}.json`);
};
var getRootConfigPath = async () => {
  if (!supportsLocalConfigFiles()) {
    return null;
  }
  const path2 = await import("node:path");
  const configDir = readEnv("ANTHROPIC_CONFIG_DIR");
  if (configDir) {
    return configDir;
  }
  const os = getPlatformHeaders()["X-Stainless-OS"];
  if (os === "Windows") {
    const appData = readEnv("APPDATA");
    if (appData) {
      return path2.join(appData, "Anthropic");
    }
    const userProfile = readEnv("USERPROFILE");
    if (userProfile) {
      return path2.join(userProfile, "AppData", "Roaming", "Anthropic");
    }
    return null;
  }
  const xdgConfigHome = readEnv("XDG_CONFIG_HOME");
  if (xdgConfigHome) {
    return path2.join(xdgConfigHome, "anthropic");
  }
  const home = readEnv("HOME");
  if (home) {
    return path2.join(home, ".config", "anthropic");
  }
  return null;
};
var supportsLocalConfigFiles = () => {
  const runtime = getPlatformHeaders()["X-Stainless-Runtime"];
  return runtime === "node" || runtime === "deno";
};
var getActiveProfileName = async () => {
  const rootConfigPath = await getRootConfigPath();
  if (!rootConfigPath) {
    return null;
  }
  const profileName = readEnv("ANTHROPIC_PROFILE");
  if (profileName) {
    return profileName;
  }
  const fs = await import("node:fs");
  const path2 = await import("node:path");
  const filePath = path2.join(rootConfigPath, "active_config");
  try {
    return (await fs.promises.readFile(filePath, "utf-8")).trim() || "default";
  } catch (err) {
    if (err?.code !== "ENOENT") {
      throw new Error(`failed to read ${filePath}: ${err}`);
    }
    return "default";
  }
};

// node_modules/@anthropic-ai/sdk/lib/credentials/identity-token.mjs
init_error();
function identityTokenFromFile(path2) {
  if (!path2) {
    throw new AnthropicError("Identity token file path is empty");
  }
  return async () => {
    const fs = await import("node:fs");
    let content;
    try {
      content = await fs.promises.readFile(path2, "utf-8");
    } catch (err) {
      throw new AnthropicError(`Failed to read identity token file at ${path2}: ${err}`);
    }
    const token = content.trim();
    if (!token) {
      throw new AnthropicError(`Identity token file at ${path2} is empty`);
    }
    return token;
  };
}
function identityTokenFromValue(token) {
  if (!token) {
    throw new AnthropicError("Identity token value is empty");
  }
  return () => token;
}

// node_modules/@anthropic-ai/sdk/lib/credentials/oidc-federation.mjs
function oidcFederationProvider(config) {
  return async () => {
    requireSecureTokenEndpoint(config.baseURL);
    const jwt = await config.identityTokenProvider();
    if (jwt.length > 16 * 1024) {
      throw new WorkloadIdentityError(`Identity token is ${Math.ceil(jwt.length / 1024)} KiB, exceeds the 16 KiB assertion limit`);
    }
    const body = {
      grant_type: GRANT_TYPE_JWT_BEARER,
      assertion: jwt,
      federation_rule_id: config.federationRuleId,
      organization_id: config.organizationId
    };
    if (config.serviceAccountId) {
      body["service_account_id"] = config.serviceAccountId;
    }
    if (config.workspaceId) {
      body["workspace_id"] = config.workspaceId;
    }
    const url = `${config.baseURL}${TOKEN_ENDPOINT}`;
    let resp;
    try {
      resp = await config.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-beta": `${OAUTH_API_BETA_HEADER},${FEDERATION_BETA_HEADER}`,
          "User-Agent": config.userAgent || `anthropic-sdk-typescript/${VERSION} oidcFederationProvider`
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new WorkloadIdentityError(`Failed to reach token endpoint ${url}: ${err}`);
    }
    const requestId = resp.headers.get("Request-Id");
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const redacted = redactSensitive(text);
      let hint = "";
      if (resp.status === 401) {
        const hintMiddle = config.workspaceId ? "" : "If your federation rule is scoped to multiple workspaces, set the ANTHROPIC_WORKSPACE_ID environment variable, the 'workspace_id' config key, or the `workspaceId` option. ";
        hint = ` Ensure your federation rule matches your identity token. ${hintMiddle}View your authentication events in the Workload identity page of Claude Console for more details.`;
      }
      throw new WorkloadIdentityError(`Token exchange failed with status ${resp.status}${requestId ? ` (request-id ${requestId})` : ""}: ${redacted}${hint}`, resp.status, redacted, requestId);
    }
    const data = await parseTokenResponse(resp, requestId);
    const expiresIn = Number(data.expires_in);
    if (!Number.isFinite(expiresIn)) {
      throw new WorkloadIdentityError(`Token endpoint response missing required fields: ${JSON.stringify(redactSensitive(data))}`, resp.status, redactSensitive(data), requestId);
    }
    return {
      token: data.access_token,
      expiresAt: nowAsSeconds() + expiresIn
    };
  };
}

// node_modules/@anthropic-ai/sdk/lib/credentials/user-oauth.mjs
function userOAuthProvider(config) {
  return async (opts) => {
    const fs = await import("node:fs");
    await checkCredentialsFileSafety(config.credentialsPath, config.onSafetyWarning);
    let raw;
    try {
      raw = await fs.promises.readFile(config.credentialsPath, "utf-8");
    } catch (err) {
      throw new WorkloadIdentityError(`Credentials file not found at ${config.credentialsPath}: ${err}`);
    }
    let creds;
    try {
      creds = JSON.parse(raw);
    } catch (err) {
      throw new WorkloadIdentityError(`Credentials file at ${config.credentialsPath} is not valid JSON: ${err}`);
    }
    const accessToken = creds.access_token;
    if (!accessToken) {
      throw new WorkloadIdentityError(`Credentials file at ${config.credentialsPath} must include 'access_token'`);
    }
    const expiresAt = creds.expires_at;
    if (!opts?.forceRefresh && (expiresAt == null || nowAsSeconds() < expiresAt - MANDATORY_REFRESH_THRESHOLD_IN_SECONDS)) {
      return { token: accessToken, expiresAt: expiresAt ?? null };
    }
    const refreshToken = creds.refresh_token;
    if (!config.clientId || !refreshToken) {
      throw new WorkloadIdentityError(`Access token at ${config.credentialsPath} has expired and no refresh is available (client_id ${config.clientId ? "set" : "empty"}, refresh_token ${refreshToken ? "set" : "empty"})`);
    }
    requireSecureTokenEndpoint(config.baseURL);
    const body = {
      grant_type: GRANT_TYPE_REFRESH_TOKEN,
      refresh_token: refreshToken,
      client_id: config.clientId
    };
    const url = `${config.baseURL}${TOKEN_ENDPOINT}`;
    let resp;
    try {
      resp = await config.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-beta": OAUTH_API_BETA_HEADER,
          "User-Agent": config.userAgent || `anthropic-sdk-typescript/${VERSION} userOAuthProvider`
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new WorkloadIdentityError(`User OAuth refresh failed to reach token endpoint: ${err}`);
    }
    const requestId = resp.headers.get("Request-Id");
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new WorkloadIdentityError(`User OAuth refresh failed (HTTP ${resp.status}): ${redactSensitive(text)}`, resp.status, redactSensitive(text), requestId);
    }
    const data = await parseTokenResponse(resp, requestId);
    const expiresIn = Number(data.expires_in);
    if (!Number.isFinite(expiresIn)) {
      throw new WorkloadIdentityError(`User OAuth refresh response missing or invalid expires_in: ${JSON.stringify(redactSensitive(data))}`, resp.status, redactSensitive(data), requestId);
    }
    const newExpiresAt = nowAsSeconds() + expiresIn;
    const newRefreshToken = data.refresh_token || refreshToken;
    await writeCredentialsFileAtomic(config.credentialsPath, {
      ...creds,
      version: CREDENTIALS_FILE_VERSION,
      type: "oauth_token",
      access_token: data.access_token,
      expires_at: newExpiresAt,
      refresh_token: newRefreshToken
    });
    return { token: data.access_token, expiresAt: newExpiresAt };
  };
}

// node_modules/@anthropic-ai/sdk/lib/credentials/credential-chain.mjs
function resolveCredentialsFromConfig(config, options) {
  const credentialsPath = config.authentication.credentials_path ?? null;
  const effectiveBaseURL = (config.base_url || options.baseURL).replace(/\/+$/, "");
  const provider = buildProvider(config, credentialsPath, effectiveBaseURL, options);
  const extraHeaders = {};
  if (config.workspace_id && config.authentication.type === "user_oauth") {
    extraHeaders["anthropic-workspace-id"] = config.workspace_id;
  }
  return { provider, extraHeaders, baseURL: config.base_url || void 0 };
}
async function defaultCredentials(options, profile) {
  const loaded = await loadConfigWithSource(profile);
  if (!loaded) {
    return null;
  }
  const { config, fromFile } = loaded;
  const withPath = config.authentication.credentials_path || !fromFile ? config : {
    ...config,
    authentication: {
      ...config.authentication,
      credentials_path: await getCredentialsPath(config, profile) ?? void 0
    }
  };
  return resolveCredentialsFromConfig(withPath, options);
}
function buildProvider(config, credentialsPath, baseURL, options) {
  switch (config.authentication.type) {
    case "oidc_federation": {
      const auth = config.authentication;
      const identityProvider = resolveIdentityTokenProvider(auth);
      if (!identityProvider) {
        throw new WorkloadIdentityError("oidc_federation config requires an identity token (set authentication.identity_token, ANTHROPIC_IDENTITY_TOKEN_FILE, or ANTHROPIC_IDENTITY_TOKEN)");
      }
      if (!auth.federation_rule_id) {
        throw new WorkloadIdentityError("oidc_federation config requires 'federation_rule_id'. Set it in authentication.federation_rule_id in your profile, or via ANTHROPIC_FEDERATION_RULE_ID (profile takes precedence).");
      }
      if (!config.organization_id) {
        throw new WorkloadIdentityError("oidc_federation config requires organization_id (set ANTHROPIC_ORGANIZATION_ID or config.organization_id)");
      }
      const exchange = oidcFederationProvider({
        identityTokenProvider: identityProvider,
        federationRuleId: auth.federation_rule_id,
        organizationId: config.organization_id,
        serviceAccountId: auth.service_account_id,
        workspaceId: config.workspace_id,
        baseURL,
        fetch: options.fetch,
        userAgent: options.userAgent
      });
      if (credentialsPath) {
        return cachedExchangeProvider(exchange, credentialsPath, options.onCacheWriteError, options.onSafetyWarning);
      }
      return exchange;
    }
    case "user_oauth": {
      if (!credentialsPath) {
        throw new WorkloadIdentityError("user_oauth config requires authentication.credentials_path (or load via a profile so it defaults to <config_dir>/credentials/<profile>.json)");
      }
      return userOAuthProvider({
        credentialsPath,
        clientId: config.authentication.client_id,
        baseURL,
        fetch: options.fetch,
        userAgent: options.userAgent,
        onSafetyWarning: options.onSafetyWarning
      });
    }
    default: {
      const t = config.authentication.type;
      throw new WorkloadIdentityError(`authentication.type "${t}" is not a known authentication type`);
    }
  }
}
function resolveIdentityTokenProvider(auth) {
  if (auth.identity_token) {
    const source = auth.identity_token.source;
    if (source !== "file") {
      throw new WorkloadIdentityError(`identity_token.source "${source}" is not supported by this SDK version (only "file")`);
    }
    if (!auth.identity_token.path) {
      throw new WorkloadIdentityError(`identity_token.source "file" requires a non-empty path`);
    }
    return identityTokenFromFile(auth.identity_token.path);
  }
  const tokenFile = readEnv("ANTHROPIC_IDENTITY_TOKEN_FILE");
  if (tokenFile) {
    return identityTokenFromFile(tokenFile);
  }
  const tokenValue = readEnv("ANTHROPIC_IDENTITY_TOKEN");
  if (tokenValue) {
    return identityTokenFromValue(tokenValue);
  }
  return null;
}
function cachedExchangeProvider(exchange, credentialsPath, onCacheWriteError, onSafetyWarning) {
  return async (opts) => {
    const fs = await import("node:fs");
    await checkCredentialsFileSafety(credentialsPath, onSafetyWarning);
    let existing;
    try {
      const raw = await fs.promises.readFile(credentialsPath, "utf-8");
      existing = JSON.parse(raw);
      const token = existing?.["access_token"];
      if (token && !opts?.forceRefresh) {
        const expiresAt = existing?.["expires_at"];
        if (expiresAt == null || nowAsSeconds() < expiresAt - MANDATORY_REFRESH_THRESHOLD_IN_SECONDS) {
          return { token, expiresAt: expiresAt ?? null };
        }
      }
    } catch (err) {
      const code = err?.code;
      if (code !== "ENOENT" && !(err instanceof SyntaxError)) {
        onCacheWriteError?.(err);
      }
    }
    const result = await exchange(opts);
    try {
      await writeCredentialsFileAtomic(credentialsPath, {
        ...existing ?? {},
        version: CREDENTIALS_FILE_VERSION,
        type: "oauth_token",
        access_token: result.token,
        expires_at: result.expiresAt
      });
    } catch (err) {
      onCacheWriteError?.(err);
    }
    return result;
  };
}

// node_modules/@anthropic-ai/sdk/core/middleware.mjs
init_errors();

// node_modules/@anthropic-ai/sdk/core/streaming.mjs
init_error();

// node_modules/@anthropic-ai/sdk/internal/decoders/line.mjs
var _LineDecoder_buffer;
var _LineDecoder_carriageReturnIndex;
var LineDecoder = class {
  constructor() {
    _LineDecoder_buffer.set(this, void 0);
    _LineDecoder_carriageReturnIndex.set(this, void 0);
    __classPrivateFieldSet(this, _LineDecoder_buffer, new Uint8Array(), "f");
    __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
  }
  decode(chunk) {
    if (chunk == null) {
      return [];
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? encodeUTF8(chunk) : chunk;
    __classPrivateFieldSet(this, _LineDecoder_buffer, concatBytes([__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), binaryChunk]), "f");
    const lines = [];
    let patternIndex;
    while ((patternIndex = findNewlineIndex(__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f"))) != null) {
      if (patternIndex.carriage && __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") == null) {
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, patternIndex.index, "f");
        continue;
      }
      if (__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") != null && (patternIndex.index !== __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") + 1 || patternIndex.carriage)) {
        lines.push(decodeUTF8(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") - 1)));
        __classPrivateFieldSet(this, _LineDecoder_buffer, __classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f")), "f");
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
        continue;
      }
      const endIndex = __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") !== null ? patternIndex.preceding - 1 : patternIndex.preceding;
      const line = decodeUTF8(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, endIndex));
      lines.push(line);
      __classPrivateFieldSet(this, _LineDecoder_buffer, __classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(patternIndex.index), "f");
      __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
    }
    return lines;
  }
  flush() {
    if (!__classPrivateFieldGet(this, _LineDecoder_buffer, "f").length) {
      return [];
    }
    return this.decode("\n");
  }
};
_LineDecoder_buffer = /* @__PURE__ */ new WeakMap(), _LineDecoder_carriageReturnIndex = /* @__PURE__ */ new WeakMap();
LineDecoder.NEWLINE_CHARS = /* @__PURE__ */ new Set(["\n", "\r"]);
LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function findNewlineIndex(buffer, startIndex) {
  const newline = 10;
  const carriage = 13;
  for (let i = startIndex ?? 0; i < buffer.length; i++) {
    if (buffer[i] === newline) {
      return { preceding: i, index: i + 1, carriage: false };
    }
    if (buffer[i] === carriage) {
      return { preceding: i, index: i + 1, carriage: true };
    }
  }
  return null;
}
function findDoubleNewlineIndex(buffer) {
  const newline = 10;
  const carriage = 13;
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i] === newline && buffer[i + 1] === newline) {
      return i + 2;
    }
    if (buffer[i] === carriage && buffer[i + 1] === carriage) {
      return i + 2;
    }
    if (buffer[i] === carriage && buffer[i + 1] === newline && i + 3 < buffer.length && buffer[i + 2] === carriage && buffer[i + 3] === newline) {
      return i + 4;
    }
  }
  return -1;
}

// node_modules/@anthropic-ai/sdk/core/streaming.mjs
init_errors();
init_error();
var _Stream_client;
var Stream = class _Stream {
  constructor(iterator, controller, client) {
    this.iterator = iterator;
    _Stream_client.set(this, void 0);
    this.controller = controller;
    __classPrivateFieldSet(this, _Stream_client, client, "f");
  }
  /**
   * Iterate the raw Server-Sent Events from `response` — `{event, data, raw}`
   * objects, before any JSON parsing or event-name filtering.
   *
   * This reads `response.body` directly (not a clone), so the response is
   * consumed. Use this in middleware that fully replaces the stream body; for
   * read-only observation of parsed events, use `ctx.parse()` instead.
   */
  static rawEvents(response, controller = new AbortController()) {
    return _iterSSEMessages(response, controller);
  }
  static fromSSEResponse(response, controller, client) {
    let consumed = false;
    const logger = client ? loggerFor(client) : console;
    async function* iterator() {
      if (consumed) {
        throw new AnthropicError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      }
      consumed = true;
      let done = false;
      try {
        for await (const sse of _iterSSEMessages(response, controller)) {
          if (sse.event === "completion") {
            try {
              yield JSON.parse(sse.data);
            } catch (e) {
              logger.error(`Could not parse message into JSON:`, sse.data);
              logger.error(`From chunk:`, sse.raw);
              throw e;
            }
          }
          if (sse.event === "message_start" || sse.event === "message_delta" || sse.event === "message_stop" || sse.event === "content_block_start" || sse.event === "content_block_delta" || sse.event === "content_block_stop" || sse.event === "message" || sse.event === "user.message" || sse.event === "user.interrupt" || sse.event === "user.tool_confirmation" || sse.event === "user.custom_tool_result" || sse.event === "user.tool_result" || sse.event === "agent.message" || sse.event === "agent.thinking" || sse.event === "agent.tool_use" || sse.event === "agent.tool_result" || sse.event === "agent.mcp_tool_use" || sse.event === "agent.mcp_tool_result" || sse.event === "agent.custom_tool_use" || sse.event === "agent.thread_context_compacted" || sse.event === "session.status_running" || sse.event === "session.status_idle" || sse.event === "session.status_rescheduled" || sse.event === "session.status_terminated" || sse.event === "session.error" || sse.event === "session.deleted" || sse.event === "session.updated" || sse.event === "span.model_request_start" || sse.event === "span.model_request_end" || sse.event === "span.outcome_evaluation_start" || sse.event === "span.outcome_evaluation_ongoing" || sse.event === "span.outcome_evaluation_end" || sse.event === "user.define_outcome" || sse.event === "agent.thread_message_received" || sse.event === "agent.thread_message_sent" || sse.event === "agent.session_thread_message_received" || sse.event === "agent.session_thread_message_sent" || sse.event === "session.thread_created" || sse.event === "session.thread_status_created" || sse.event === "session.thread_status_running" || sse.event === "session.thread_status_idle" || sse.event === "session.thread_status_rescheduled" || sse.event === "session.thread_status_terminated" || sse.event === "event_start" || sse.event === "event_delta" || sse.event === "system.message") {
            try {
              yield JSON.parse(sse.data);
            } catch (e) {
              logger.error(`Could not parse message into JSON:`, sse.data);
              logger.error(`From chunk:`, sse.raw);
              throw e;
            }
          }
          if (sse.event === "ping") {
            continue;
          }
          if (sse.event === "error") {
            const body = safeJSON(sse.data) ?? sse.data;
            const type = body?.error?.type;
            throw new APIError(void 0, body, void 0, response.headers, type);
          }
        }
        done = true;
      } catch (e) {
        if (isAbortError(e))
          return;
        throw e;
      } finally {
        if (!done)
          controller.abort();
      }
    }
    return new _Stream(iterator, controller, client);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(readableStream, controller, client) {
    let consumed = false;
    async function* iterLines() {
      const lineDecoder = new LineDecoder();
      const iter = ReadableStreamToAsyncIterable(readableStream);
      for await (const chunk of iter) {
        for (const line of lineDecoder.decode(chunk)) {
          yield line;
        }
      }
      for (const line of lineDecoder.flush()) {
        yield line;
      }
    }
    async function* iterator() {
      if (consumed) {
        throw new AnthropicError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      }
      consumed = true;
      let done = false;
      try {
        for await (const line of iterLines()) {
          if (done)
            continue;
          if (line)
            yield JSON.parse(line);
        }
        done = true;
      } catch (e) {
        if (isAbortError(e))
          return;
        throw e;
      } finally {
        if (!done)
          controller.abort();
      }
    }
    return new _Stream(iterator, controller, client);
  }
  [(_Stream_client = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const left = [];
    const right = [];
    const iterator = this.iterator();
    const teeIterator = (queue) => {
      return {
        next: () => {
          if (queue.length === 0) {
            const result = iterator.next();
            left.push(result);
            right.push(result);
          }
          return queue.shift();
        }
      };
    };
    return [
      new _Stream(() => teeIterator(left), this.controller, __classPrivateFieldGet(this, _Stream_client, "f")),
      new _Stream(() => teeIterator(right), this.controller, __classPrivateFieldGet(this, _Stream_client, "f"))
    ];
  }
  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream() {
    const self = this;
    let iter;
    return makeReadableStream({
      async start() {
        iter = self[Symbol.asyncIterator]();
      },
      async pull(ctrl) {
        try {
          const { value, done } = await iter.next();
          if (done)
            return ctrl.close();
          const bytes = encodeUTF8(JSON.stringify(value) + "\n");
          ctrl.enqueue(bytes);
        } catch (err) {
          ctrl.error(err);
        }
      },
      async cancel() {
        await iter.return?.();
      }
    });
  }
};
async function* _iterSSEMessages(response, controller) {
  if (!response.body) {
    controller.abort();
    if (typeof globalThis.navigator !== "undefined" && globalThis.navigator.product === "ReactNative") {
      throw new AnthropicError(`The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`);
    }
    throw new AnthropicError(`Attempted to iterate over a response with no body`);
  }
  const sseDecoder = new SSEDecoder();
  const lineDecoder = new LineDecoder();
  const iter = ReadableStreamToAsyncIterable(response.body);
  for await (const sseChunk of iterSSEChunks(iter)) {
    for (const line of lineDecoder.decode(sseChunk)) {
      const sse = sseDecoder.decode(line);
      if (sse)
        yield sse;
    }
  }
  for (const line of lineDecoder.flush()) {
    const sse = sseDecoder.decode(line);
    if (sse)
      yield sse;
  }
}
async function* iterSSEChunks(iterator) {
  let data = new Uint8Array();
  for await (const chunk of iterator) {
    if (chunk == null) {
      continue;
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? encodeUTF8(chunk) : chunk;
    let newData = new Uint8Array(data.length + binaryChunk.length);
    newData.set(data);
    newData.set(binaryChunk, data.length);
    data = newData;
    let patternIndex;
    while ((patternIndex = findDoubleNewlineIndex(data)) !== -1) {
      yield data.slice(0, patternIndex);
      data = data.slice(patternIndex);
    }
  }
  if (data.length > 0) {
    yield data;
  }
}
var SSEDecoder = class {
  constructor() {
    this.event = null;
    this.data = [];
    this.chunks = [];
  }
  decode(line) {
    if (line.endsWith("\r")) {
      line = line.substring(0, line.length - 1);
    }
    if (!line) {
      if (!this.event && !this.data.length)
        return null;
      const sse = {
        event: this.event,
        data: this.data.join("\n"),
        raw: this.chunks
      };
      this.event = null;
      this.data = [];
      this.chunks = [];
      return sse;
    }
    this.chunks.push(line);
    if (line.startsWith(":")) {
      return null;
    }
    let [fieldname, _, value] = partition(line, ":");
    if (value.startsWith(" ")) {
      value = value.substring(1);
    }
    if (fieldname === "event") {
      this.event = value;
    } else if (fieldname === "data") {
      this.data.push(value);
    }
    return null;
  }
};
function partition(str, delimiter) {
  const index = str.indexOf(delimiter);
  if (index !== -1) {
    return [str.substring(0, index), delimiter, str.substring(index + delimiter.length)];
  }
  return [str, "", ""];
}

// node_modules/@anthropic-ai/sdk/internal/parse.mjs
async function defaultParseResponse(client, props) {
  const { response, requestLogID, retryOfRequestLogID, startTime } = props;
  const body = await (async () => {
    if (props.options.stream) {
      loggerFor(client).debug("response", response.status, response.url, response.headers, response.body);
      return Stream.fromSSEResponse(response, props.controller);
    }
    if (response.status === 204) {
      return null;
    }
    if (props.options.__binaryResponse) {
      return response;
    }
    const contentType = response.headers.get("content-type");
    const mediaType = contentType?.split(";")[0]?.trim();
    const isJSON = mediaType?.includes("application/json") || mediaType?.endsWith("+json");
    if (isJSON) {
      const contentLength = response.headers.get("content-length");
      if (contentLength === "0") {
        return void 0;
      }
      const json = await response.json();
      return addRequestID(json, response);
    }
    const text = await response.text();
    return text;
  })();
  loggerFor(client).debug(`[${requestLogID}] response parsed`, formatRequestDetails({
    retryOfRequestLogID,
    url: response.url,
    status: response.status,
    body,
    durationMs: Date.now() - startTime
  }));
  return body;
}
function addRequestID(value, response) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.defineProperty(value, "_request_id", {
    value: response.headers.get("request-id"),
    enumerable: false
  });
}

// node_modules/@anthropic-ai/sdk/core/middleware.mjs
init_error();
var fetchOriginErrors = /* @__PURE__ */ new WeakSet();
function isFetchOriginError(err) {
  return typeof err === "object" && err !== null && fetchOriginErrors.has(err);
}
function isRetryableError(err) {
  const seen = /* @__PURE__ */ new Set();
  while (typeof err === "object" && err !== null && !seen.has(err)) {
    seen.add(err);
    if (isFetchOriginError(err) || isAbortError(err) || err instanceof APIConnectionError || err instanceof RetryableError) {
      return true;
    }
    err = err.cause;
  }
  return false;
}
function wrapFetchWithMiddleware(fetchFn, middleware, options, client) {
  return async (url, init = {}) => {
    if (middleware.length === 0) {
      return fetchFn.call(void 0, url, init);
    }
    const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers);
    const response = await applyMiddleware(fetchFn, middleware, options, client)({
      ...init,
      headers,
      url: typeof url === "string" ? url : url instanceof URL ? url.href : url.url
    });
    if (response.bodyUsed || response.body?.locked) {
      throw new AnthropicError("middleware consumed the response body; use response.clone() to inspect it, or return new Response(body, response) to consume and replace it");
    }
    return response;
  };
}
function createMiddlewareContext(options, client) {
  const cache6 = /* @__PURE__ */ new WeakMap();
  return {
    options,
    // Resolved per chain, so changes to the client's `logLevel`/`logger`
    // apply to subsequent requests.
    logger: client ? loggerFor(client) : defaultLogger(),
    parse(response) {
      if (options?.stream && response.ok) {
        return parseMiddlewareResponse(response, options);
      }
      let parsed = cache6.get(response);
      if (!parsed) {
        parsed = parseMiddlewareResponse(response, options);
        cache6.set(response, parsed);
      }
      return parsed;
    }
  };
}
async function parseMiddlewareResponse(response, options) {
  if (response.bodyUsed || response.body?.locked) {
    throw new AnthropicError("cannot ctx.parse() a response whose body was already consumed; call ctx.parse() instead of reading the body, or read via response.clone()");
  }
  if (options?.stream && response.ok) {
    return Stream.fromSSEResponse(response.clone(), new AbortController());
  }
  if (response.status === 204) {
    return null;
  }
  if (options?.__binaryResponse) {
    return response;
  }
  const contentType = response.headers.get("content-type");
  const mediaType = contentType?.split(";")[0]?.trim();
  const isJSON = mediaType?.includes("application/json") || mediaType?.endsWith("+json");
  if (isJSON) {
    if (response.headers.get("content-length") === "0") {
      return void 0;
    }
    return addRequestID(await response.clone().json(), response);
  }
  return await response.clone().text();
}
function applyMiddleware(fetchFn, middleware, options, client) {
  let next = async ({ url, ...init }) => {
    try {
      return await fetchFn.call(void 0, url, init);
    } catch (err) {
      const error = castToError(err);
      fetchOriginErrors.add(error);
      throw error;
    }
  };
  const ctx = createMiddlewareContext(options, client);
  for (let i = middleware.length - 1; i >= 0; i--) {
    const mw = middleware[i];
    const nextInner = next;
    next = async (request) => mw(request, nextInner, ctx);
  }
  return next;
}

// node_modules/@anthropic-ai/sdk/core/pagination.mjs
init_error();

// node_modules/@anthropic-ai/sdk/core/api-promise.mjs
var _APIPromise_client;
var APIPromise = class _APIPromise extends Promise {
  constructor(client, responsePromise, parseResponse = defaultParseResponse) {
    super((resolve5) => {
      resolve5(null);
    });
    this.responsePromise = responsePromise;
    this.parseResponse = parseResponse;
    _APIPromise_client.set(this, void 0);
    __classPrivateFieldSet(this, _APIPromise_client, client, "f");
  }
  _thenUnwrap(transform) {
    return new _APIPromise(__classPrivateFieldGet(this, _APIPromise_client, "f"), this.responsePromise, async (client, props) => addRequestID(transform(await this.parseResponse(client, props), props), props.response));
  }
  /**
   * Gets the raw `Response` instance instead of parsing the response
   * data.
   *
   * If you want to parse the response body but still get the `Response`
   * instance, you can use {@link withResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  asResponse() {
    return this.responsePromise.then((p) => p.response);
  }
  /**
   * Gets the parsed response data, the raw `Response` instance and the ID of the request,
   * returned via the `request-id` header which is useful for debugging requests and resporting
   * issues to Anthropic.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  async withResponse() {
    const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
    return { data, response, request_id: response.headers.get("request-id") };
  }
  parse() {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then((data) => this.parseResponse(__classPrivateFieldGet(this, _APIPromise_client, "f"), data));
    }
    return this.parsedPromise;
  }
  then(onfulfilled, onrejected) {
    return this.parse().then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.parse().catch(onrejected);
  }
  finally(onfinally) {
    return this.parse().finally(onfinally);
  }
};
_APIPromise_client = /* @__PURE__ */ new WeakMap();

// node_modules/@anthropic-ai/sdk/core/pagination.mjs
var _AbstractPage_client;
var AbstractPage = class {
  constructor(client, response, body, options) {
    _AbstractPage_client.set(this, void 0);
    __classPrivateFieldSet(this, _AbstractPage_client, client, "f");
    this.options = options;
    this.response = response;
    this.body = body;
  }
  hasNextPage() {
    const items = this.getPaginatedItems();
    if (!items.length)
      return false;
    return this.nextPageRequestOptions() != null;
  }
  async getNextPage() {
    const nextOptions = this.nextPageRequestOptions();
    if (!nextOptions) {
      throw new AnthropicError("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");
    }
    return await __classPrivateFieldGet(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
  }
  async *iterPages() {
    let page = this;
    yield page;
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      yield page;
    }
  }
  async *[(_AbstractPage_client = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    for await (const page of this.iterPages()) {
      for (const item2 of page.getPaginatedItems()) {
        yield item2;
      }
    }
  }
};
var PagePromise = class extends APIPromise {
  constructor(client, request, Page2) {
    super(client, request, async (client2, props) => new Page2(client2, props.response, await defaultParseResponse(client2, props), props.options));
  }
  /**
   * Allow auto-paginating iteration on an unawaited list call, eg:
   *
   *    for await (const item of client.items.list()) {
   *      console.log(item)
   *    }
   */
  async *[Symbol.asyncIterator]() {
    const page = await this;
    for await (const item2 of page) {
      yield item2;
    }
  }
};
var Page = class extends AbstractPage {
  constructor(client, response, body, options) {
    super(client, response, body, options);
    this.data = body.data || [];
    this.has_more = body.has_more || false;
    this.first_id = body.first_id || null;
    this.last_id = body.last_id || null;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    if (this.has_more === false) {
      return false;
    }
    return super.hasNextPage();
  }
  nextPageRequestOptions() {
    if (this.options.query?.["before_id"]) {
      const first_id = this.first_id;
      if (!first_id) {
        return null;
      }
      return {
        ...this.options,
        query: {
          ...maybeObj(this.options.query),
          before_id: first_id
        }
      };
    }
    const cursor = this.last_id;
    if (!cursor) {
      return null;
    }
    return {
      ...this.options,
      query: {
        ...maybeObj(this.options.query),
        after_id: cursor
      }
    };
  }
};
var PageCursor = class extends AbstractPage {
  constructor(client, response, body, options) {
    super(client, response, body, options);
    this.data = body.data || [];
    this.next_page = body.next_page || null;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  nextPageRequestOptions() {
    const cursor = this.next_page;
    if (!cursor) {
      return null;
    }
    return {
      ...this.options,
      query: {
        ...maybeObj(this.options.query),
        page: cursor
      }
    };
  }
};
var BidirectionalPageCursor = class extends AbstractPage {
  constructor(client, response, body, options) {
    super(client, response, body, options);
    this.data = body.data || [];
    this.next_page = body.next_page || null;
    this.prev_page = body.prev_page || null;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  nextPageRequestOptions() {
    const cursor = this.next_page;
    if (!cursor) {
      return null;
    }
    return {
      ...this.options,
      query: {
        ...maybeObj(this.options.query),
        page: cursor
      }
    };
  }
};

// node_modules/@anthropic-ai/sdk/internal/uploads.mjs
var checkFileSupport = () => {
  if (typeof File === "undefined") {
    const { process: process2 } = globalThis;
    const isOldNode = typeof process2?.versions?.node === "string" && parseInt(process2.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (isOldNode ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function makeFile(fileBits, fileName, options) {
  checkFileSupport();
  return new File(fileBits, fileName ?? "unknown_file", options);
}
function getName(value, stripPath) {
  const val = typeof value === "object" && value !== null && ("name" in value && value.name && String(value.name) || "url" in value && value.url && String(value.url) || "filename" in value && value.filename && String(value.filename) || "path" in value && value.path && String(value.path)) || "";
  return stripPath ? val.split(/[\\/]/).pop() || void 0 : val;
}
var isAsyncIterable = (value) => value != null && typeof value === "object" && typeof value[Symbol.asyncIterator] === "function";
var multipartFormRequestOptions = async (opts, fetch2, stripFilenames = true) => {
  return { ...opts, body: await createForm(opts.body, fetch2, stripFilenames) };
};
var supportsFormDataMap = /* @__PURE__ */ new WeakMap();
function supportsFormData(fetchObject) {
  const fetch2 = typeof fetchObject === "function" ? fetchObject : fetchObject.fetch;
  const cached = supportsFormDataMap.get(fetch2);
  if (cached)
    return cached;
  const promise = (async () => {
    try {
      const FetchResponse = "Response" in fetch2 ? fetch2.Response : (await fetch2("data:,")).constructor;
      const data = new FormData();
      if (data.toString() === await new FetchResponse(data).text()) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  })();
  supportsFormDataMap.set(fetch2, promise);
  return promise;
}
var createForm = async (body, fetch2, stripFilenames = true) => {
  if (!await supportsFormData(fetch2)) {
    throw new TypeError("The provided fetch function does not support file uploads with the current global FormData class.");
  }
  const form = new FormData();
  await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value, stripFilenames)));
  return form;
};
var isNamedBlob = (value) => value instanceof Blob && "name" in value;
var addFormValue = async (form, key, value, stripFilenames) => {
  if (value === void 0)
    return;
  if (value == null) {
    throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    form.append(key, String(value));
  } else if (value instanceof Response) {
    let options = {};
    const contentType = value.headers.get("Content-Type");
    if (contentType) {
      options = { type: contentType };
    }
    form.append(key, makeFile([await value.blob()], getName(value, stripFilenames), options));
  } else if (isAsyncIterable(value)) {
    form.append(key, makeFile([await new Response(ReadableStreamFrom(value)).blob()], getName(value, stripFilenames)));
  } else if (isNamedBlob(value)) {
    form.append(key, makeFile([value], getName(value, stripFilenames), { type: value.type }));
  } else if (Array.isArray(value)) {
    await Promise.all(value.map((entry) => addFormValue(form, key + "[]", entry, stripFilenames)));
  } else if (typeof value === "object") {
    await Promise.all(Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop, stripFilenames)));
  } else {
    throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
  }
};

// node_modules/@anthropic-ai/sdk/internal/to-file.mjs
var isBlobLike = (value) => value != null && typeof value === "object" && typeof value.size === "number" && typeof value.type === "string" && typeof value.text === "function" && typeof value.slice === "function" && typeof value.arrayBuffer === "function";
var isFileLike = (value) => value != null && typeof value === "object" && typeof value.name === "string" && typeof value.lastModified === "number" && isBlobLike(value);
var isResponseLike = (value) => value != null && typeof value === "object" && typeof value.url === "string" && typeof value.blob === "function";
async function toFile(value, name, options) {
  checkFileSupport();
  value = await value;
  name || (name = getName(value, true));
  if (isFileLike(value)) {
    if (value instanceof File && name == null && options == null) {
      return value;
    }
    return makeFile([await value.arrayBuffer()], name ?? value.name, {
      type: value.type,
      lastModified: value.lastModified,
      ...options
    });
  }
  if (isResponseLike(value)) {
    const blob = await value.blob();
    name || (name = new URL(value.url).pathname.split(/[\\/]/).pop());
    return makeFile(await getBytes(blob), name, options);
  }
  const parts = await getBytes(value);
  if (!options?.type) {
    const type = parts.find((part) => typeof part === "object" && "type" in part && part.type);
    if (typeof type === "string") {
      options = { ...options, type };
    }
  }
  return makeFile(parts, name, options);
}
async function getBytes(value) {
  let parts = [];
  if (typeof value === "string" || ArrayBuffer.isView(value) || // includes Uint8Array, Buffer, etc.
  value instanceof ArrayBuffer) {
    parts.push(value);
  } else if (isBlobLike(value)) {
    parts.push(value instanceof Blob ? value : await value.arrayBuffer());
  } else if (isAsyncIterable(value)) {
    for await (const chunk of value) {
      parts.push(...await getBytes(chunk));
    }
  } else {
    const constructor = value?.constructor?.name;
    throw new Error(`Unexpected data type: ${typeof value}${constructor ? `; constructor: ${constructor}` : ""}${propsForError(value)}`);
  }
  return parts;
}
function propsForError(value) {
  if (typeof value !== "object" || value === null)
    return "";
  const props = Object.getOwnPropertyNames(value);
  return `; props: [${props.map((p) => `"${p}"`).join(", ")}]`;
}

// node_modules/@anthropic-ai/sdk/core/resource.mjs
var APIResource = class {
  constructor(client) {
    this._client = client;
  }
};

// node_modules/@anthropic-ai/sdk/internal/headers.mjs
var brand_privateNullableHeaders = /* @__PURE__ */ Symbol.for("brand.privateNullableHeaders");
function* iterateHeaders(headers) {
  if (!headers)
    return;
  if (brand_privateNullableHeaders in headers) {
    const { values, nulls } = headers;
    yield* values.entries();
    for (const name of nulls) {
      yield [name, null];
    }
    return;
  }
  let shouldClear = false;
  let iter;
  if (headers instanceof Headers) {
    iter = headers.entries();
  } else if (isReadonlyArray(headers)) {
    iter = headers;
  } else {
    shouldClear = true;
    iter = Object.entries(headers ?? {});
  }
  for (let row of iter) {
    const name = row[0];
    if (typeof name !== "string")
      throw new TypeError("expected header name to be a string");
    const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
    let didClear = false;
    for (const value of values) {
      if (value === void 0)
        continue;
      if (shouldClear && !didClear) {
        didClear = true;
        yield [name, clearSentinel];
      }
      yield [name, value];
    }
  }
}
var clearSentinel = /* @__PURE__ */ Symbol("clear");
var APPEND_HEADERS = /* @__PURE__ */ new Set(["x-stainless-helper"]);
var appendHeaderValue = (existing, addition) => {
  const tokens = existing ? existing.split(",").map((t) => t.trim()).filter(Boolean) : [];
  for (const tok of addition.split(",").map((t) => t.trim())) {
    if (tok && !tokens.includes(tok))
      tokens.push(tok);
  }
  return tokens.join(", ");
};
var buildHeaders = (newHeaders) => {
  const targetHeaders = new Headers();
  const nullHeaders = /* @__PURE__ */ new Set();
  for (const headers of newHeaders) {
    const seenHeaders = /* @__PURE__ */ new Set();
    for (const [name, value] of iterateHeaders(headers)) {
      const lowerName = name.toLowerCase();
      if (APPEND_HEADERS.has(lowerName)) {
        if (value === clearSentinel)
          continue;
        if (value === null) {
          targetHeaders.delete(name);
          nullHeaders.add(lowerName);
        } else {
          targetHeaders.set(name, appendHeaderValue(targetHeaders.get(name), value));
          nullHeaders.delete(lowerName);
        }
        continue;
      }
      if (value === clearSentinel || !seenHeaders.has(lowerName)) {
        targetHeaders.delete(name);
        seenHeaders.add(lowerName);
        if (value === clearSentinel)
          continue;
      }
      if (value === null) {
        targetHeaders.delete(name);
        nullHeaders.add(lowerName);
      } else {
        targetHeaders.append(name, value);
        nullHeaders.delete(lowerName);
      }
    }
  }
  return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};

// node_modules/@anthropic-ai/sdk/internal/utils/path.mjs
init_error();
function encodeURIPath(str) {
  return str.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
var EMPTY = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null));
var createPathTagFunction = (pathEncoder = encodeURIPath) => function path2(statics, ...params) {
  if (statics.length === 1)
    return statics[0];
  let postPath = false;
  const invalidSegments = [];
  const path3 = statics.reduce((previousValue, currentValue, index) => {
    if (/[?#]/.test(currentValue)) {
      postPath = true;
    }
    const value = params[index];
    let encoded = (postPath ? encodeURIComponent : pathEncoder)("" + value);
    if (index !== params.length && (value == null || typeof value === "object" && // handle values from other realms
    value.toString === Object.getPrototypeOf(Object.getPrototypeOf(value.hasOwnProperty ?? EMPTY) ?? EMPTY)?.toString)) {
      encoded = value + "";
      invalidSegments.push({
        start: previousValue.length + currentValue.length,
        length: encoded.length,
        error: `Value of type ${Object.prototype.toString.call(value).slice(8, -1)} is not a valid path parameter`
      });
    }
    return previousValue + currentValue + (index === params.length ? "" : encoded);
  }, "");
  const pathOnly = path3.split(/[?#]/, 1)[0];
  const invalidSegmentPattern = /(?<=^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
  let match2;
  while ((match2 = invalidSegmentPattern.exec(pathOnly)) !== null) {
    invalidSegments.push({
      start: match2.index,
      length: match2[0].length,
      error: `Value "${match2[0]}" can't be safely passed as a path parameter`
    });
  }
  invalidSegments.sort((a, b) => a.start - b.start);
  if (invalidSegments.length > 0) {
    let lastEnd = 0;
    const underline = invalidSegments.reduce((acc, segment) => {
      const spaces = " ".repeat(segment.start - lastEnd);
      const arrows = "^".repeat(segment.length);
      lastEnd = segment.start + segment.length;
      return acc + spaces + arrows;
    }, "");
    throw new AnthropicError(`Path parameters result in path with invalid segments:
${invalidSegments.map((e) => e.error).join("\n")}
${path3}
${underline}`);
  }
  return path3;
};
var path = /* @__PURE__ */ createPathTagFunction(encodeURIPath);

// node_modules/@anthropic-ai/sdk/resources/beta/deployment-runs.mjs
var DeploymentRuns = class extends APIResource {
  /**
   * Get Deployment Run
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeploymentRun =
   *   await client.beta.deploymentRuns.retrieve(
   *     'deployment_run_id',
   *   );
   * ```
   */
  retrieve(deploymentRunID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/deployment_runs/${deploymentRunID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Deployment Runs
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsDeploymentRun of client.beta.deploymentRuns.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/deployment_runs?beta=true", PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/deployments.mjs
var Deployments = class extends APIResource {
  /**
   * Create Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.create({
   *     agent: 'string',
   *     environment_id: 'x',
   *     initial_events: [
   *       {
   *         content: [
   *           {
   *             text: 'Where is my order #1234?',
   *             type: 'text',
   *           },
   *         ],
   *         type: 'user.message',
   *       },
   *     ],
   *     name: 'x',
   *   });
   * ```
   */
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/deployments?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Get Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.retrieve(
   *     'depl_011CZkZcDH3vPqd7xnEfwTai',
   *   );
   * ```
   */
  retrieve(deploymentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/deployments/${deploymentID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.update(
   *     'depl_011CZkZcDH3vPqd7xnEfwTai',
   *   );
   * ```
   */
  update(deploymentID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/deployments/${deploymentID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Deployments
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsDeployment of client.beta.deployments.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/deployments?beta=true", PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Archive Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.archive(
   *     'depl_011CZkZcDH3vPqd7xnEfwTai',
   *   );
   * ```
   */
  archive(deploymentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/deployments/${deploymentID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Pause Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.pause(
   *     'depl_011CZkZcDH3vPqd7xnEfwTai',
   *   );
   * ```
   */
  pause(deploymentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/deployments/${deploymentID}/pause?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Run Deployment Now
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeploymentRun =
   *   await client.beta.deployments.run(
   *     'depl_011CZkZcDH3vPqd7xnEfwTai',
   *   );
   * ```
   */
  run(deploymentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/deployments/${deploymentID}/run?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Unpause Deployment
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeployment =
   *   await client.beta.deployments.unpause(
   *     'depl_011CZkZcDH3vPqd7xnEfwTai',
   *   );
   * ```
   */
  unpause(deploymentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/deployments/${deploymentID}/unpause?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/internal/stainless-helper-header.mjs
var STAINLESS_HELPER_HEADER = "x-stainless-helper";
var STAINLESS_HELPER_METHOD_HEADER = "x-stainless-helper-method";
function helperHeader(value) {
  return { [STAINLESS_HELPER_HEADER]: value };
}
var SDK_HELPER_SYMBOL = /* @__PURE__ */ Symbol("anthropic.sdk.stainlessHelper");
function wasCreatedByStainlessHelper(value) {
  return typeof value === "object" && value !== null && SDK_HELPER_SYMBOL in value;
}
function collectStainlessHelpers(tools, messages) {
  const helpers = /* @__PURE__ */ new Set();
  if (tools) {
    for (const tool of tools) {
      if (wasCreatedByStainlessHelper(tool)) {
        helpers.add(tool[SDK_HELPER_SYMBOL]);
      }
    }
  }
  if (messages) {
    for (const message of messages) {
      if (wasCreatedByStainlessHelper(message)) {
        helpers.add(message[SDK_HELPER_SYMBOL]);
      }
      const content = message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (wasCreatedByStainlessHelper(block)) {
            helpers.add(block[SDK_HELPER_SYMBOL]);
          }
        }
      }
    }
  }
  return Array.from(helpers);
}
function stainlessHelperHeader(tools, messages) {
  const helpers = collectStainlessHelpers(tools, messages);
  if (helpers.length === 0)
    return {};
  return { [STAINLESS_HELPER_HEADER]: helpers.join(", ") };
}
function stainlessHelperHeaderFromFile(file) {
  if (wasCreatedByStainlessHelper(file)) {
    return { [STAINLESS_HELPER_HEADER]: file[SDK_HELPER_SYMBOL] };
  }
  return {};
}

// node_modules/@anthropic-ai/sdk/resources/beta/files.mjs
var Files = class extends APIResource {
  /**
   * List Files
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fileMetadata of client.beta.files.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/files?beta=true", Page, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete File
   *
   * @example
   * ```ts
   * const deletedFile = await client.beta.files.delete(
   *   'file_id',
   * );
   * ```
   */
  delete(fileID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/files/${fileID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Download File
   *
   * @example
   * ```ts
   * const response = await client.beta.files.download(
   *   'file_id',
   * );
   *
   * const content = await response.blob();
   * console.log(content);
   * ```
   */
  download(fileID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/files/${fileID}/content?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString(),
          Accept: "application/binary"
        },
        options?.headers
      ]),
      __binaryResponse: true
    });
  }
  /**
   * Get File Metadata
   *
   * @example
   * ```ts
   * const fileMetadata =
   *   await client.beta.files.retrieveMetadata('file_id');
   * ```
   */
  retrieveMetadata(fileID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/files/${fileID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Upload File
   *
   * @example
   * ```ts
   * const fileMetadata = await client.beta.files.upload({
   *   file: fs.createReadStream('path/to/file'),
   * });
   * ```
   */
  upload(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/files?beta=true", multipartFormRequestOptions({
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "files-api-2025-04-14"].toString() },
        stainlessHelperHeaderFromFile(body.file),
        options?.headers
      ])
    }, this._client));
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/models.mjs
var Models = class extends APIResource {
  /**
   * Get a specific model.
   *
   * The Models API response can be used to determine information about a specific
   * model or resolve a model alias to a model ID.
   *
   * @example
   * ```ts
   * const betaModelInfo = await client.beta.models.retrieve(
   *   'model_id',
   * );
   * ```
   */
  retrieve(modelID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/models/${modelID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : void 0 },
        options?.headers
      ])
    });
  }
  /**
   * List available models.
   *
   * The Models API response can be used to determine which models are available for
   * use in the API. More recently released models are listed first.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaModelInfo of client.beta.models.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/models?beta=true", Page, {
      query,
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : void 0 },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/user-profiles.mjs
var UserProfiles = class extends APIResource {
  /**
   * Create User Profile
   *
   * @example
   * ```ts
   * const betaUserProfile =
   *   await client.beta.userProfiles.create();
   * ```
   */
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/user_profiles?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Get User Profile
   *
   * @example
   * ```ts
   * const betaUserProfile =
   *   await client.beta.userProfiles.retrieve(
   *     'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   *   );
   * ```
   */
  retrieve(userProfileID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/user_profiles/${userProfileID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update User Profile
   *
   * @example
   * ```ts
   * const betaUserProfile =
   *   await client.beta.userProfiles.update(
   *     'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   *   );
   * ```
   */
  update(userProfileID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/user_profiles/${userProfileID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List User Profiles
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaUserProfile of client.beta.userProfiles.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/user_profiles?beta=true", PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Create Enrollment URL
   *
   * @example
   * ```ts
   * const betaUserProfileEnrollmentURL =
   *   await client.beta.userProfiles.createEnrollmentURL(
   *     'uprof_011CZkZCu8hGbp5mYRQgUmz9',
   *   );
   * ```
   */
  createEnrollmentURL(userProfileID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/user_profiles/${userProfileID}/enrollment_url?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "user-profiles-2026-03-24"].toString() },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/webhooks.mjs
var import_standardwebhooks = __toESM(require_dist(), 1);
var Webhooks = class extends APIResource {
  unwrap(body, { headers, key }) {
    if (headers !== void 0) {
      const keyStr = key === void 0 ? this._client.webhookKey : key;
      if (keyStr === null)
        throw new Error("Webhook key must not be null in order to unwrap");
      const wh = new import_standardwebhooks.Webhook(keyStr);
      wh.verify(body, headers);
    }
    return JSON.parse(body);
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/agents/versions.mjs
var Versions = class extends APIResource {
  /**
   * List Agent Versions
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsAgent of client.beta.agents.versions.list(
   *   'agent_011CZkYpogX7uDKUyvBTophP',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(agentID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/v1/agents/${agentID}/versions?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/agents/agents.mjs
var Agents = class extends APIResource {
  constructor() {
    super(...arguments);
    this.versions = new Versions(this._client);
  }
  /**
   * Create Agent
   *
   * @example
   * ```ts
   * const betaManagedAgentsAgent =
   *   await client.beta.agents.create({
   *     model: 'claude-sonnet-4-6',
   *     name: 'My First Agent',
   *   });
   * ```
   */
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/agents?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Get Agent
   *
   * @example
   * ```ts
   * const betaManagedAgentsAgent =
   *   await client.beta.agents.retrieve(
   *     'agent_011CZkYpogX7uDKUyvBTophP',
   *   );
   * ```
   */
  retrieve(agentID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.get(path`/v1/agents/${agentID}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update Agent
   *
   * @example
   * ```ts
   * const betaManagedAgentsAgent =
   *   await client.beta.agents.update(
   *     'agent_011CZkYpogX7uDKUyvBTophP',
   *     { version: 1 },
   *   );
   * ```
   */
  update(agentID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/agents/${agentID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Agents
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsAgent of client.beta.agents.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/agents?beta=true", PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Archive Agent
   *
   * @example
   * ```ts
   * const betaManagedAgentsAgent =
   *   await client.beta.agents.archive(
   *     'agent_011CZkYpogX7uDKUyvBTophP',
   *   );
   * ```
   */
  archive(agentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/agents/${agentID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};
Agents.Versions = Versions;

// node_modules/@anthropic-ai/sdk/lib/environments/poller.mjs
init_error();

// node_modules/@anthropic-ai/sdk/internal/utils/abort.mjs
function linkAbort(external, controller) {
  if (!external)
    return () => {
    };
  if (external.aborted) {
    controller.abort();
    return () => {
    };
  }
  const onAbort = () => controller.abort();
  external.addEventListener("abort", onAbort);
  return () => external.removeEventListener("abort", onAbort);
}

// node_modules/@anthropic-ai/sdk/internal/utils/backoff.mjs
init_error();
function isStatus(e, code) {
  return e instanceof APIError && e.status === code;
}
function is4xx(e) {
  return e instanceof APIError && typeof e.status === "number" && e.status >= 400 && e.status < 500;
}
function isFatal4xx(e) {
  return is4xx(e) && !isStatus(e, 408) && !isStatus(e, 409) && !isStatus(e, 429);
}
function backoff(attempt, baseMs, capMs) {
  return Math.min(baseMs * 2 ** attempt, capMs);
}
function jitter(lowMs, highMs) {
  return lowMs + Math.random() * (highMs - lowMs);
}
function applyJitter(ms) {
  return ms * (1 - Math.random() * 0.25);
}

// node_modules/@anthropic-ai/sdk/lib/helper-client.mjs
init_error();
function copyClientForHelper(client, { authToken, helper }) {
  if (!authToken) {
    throw new AnthropicError(`copyClientForHelper: expected a non-empty authToken but received ${JSON.stringify(authToken)}`);
  }
  const internal = client;
  const parentDefaults = internal._options.defaultHeaders;
  const parentAuthExtraHeaders = internal._authState?.extraHeaders;
  const inheritedAuthExtraHeaders = parentAuthExtraHeaders ? Object.fromEntries(Object.entries(parentAuthExtraHeaders).filter(([name]) => {
    const lower = name.toLowerCase();
    return lower !== "authorization" && lower !== "x-api-key";
  })) : void 0;
  const defaultHeaders = buildHeaders([
    inheritedAuthExtraHeaders,
    parentDefaults,
    { [STAINLESS_HELPER_HEADER]: helper }
  ]);
  return client.withOptions({
    apiKey: null,
    authToken,
    baseURL: client.baseURL,
    credentials: void 0,
    defaultHeaders
  });
}

// node_modules/@anthropic-ai/sdk/lib/environments/poller.mjs
var _WorkPoller_runnerClient;
var _WorkPoller_consumed;
var _WorkPoller_controller;
var _WorkPoller_detachExternal;
var _WorkPoller_autoStop;
var _WorkPoller_drain;
var _WorkPoller_blockMs;
var _WorkPoller_reclaimOlderThanMs;
var _WorkPoller_requestOpts;
var POLL_BLOCK_MS = 999;
var POLL_BACKOFF_BASE_MS = 1e3;
var POLL_BACKOFF_CAP_MS = 6e4;
var WorkPoller = class {
  constructor(opts) {
    _WorkPoller_runnerClient.set(this, void 0);
    _WorkPoller_consumed.set(this, false);
    _WorkPoller_controller.set(this, void 0);
    _WorkPoller_detachExternal.set(this, void 0);
    _WorkPoller_autoStop.set(this, void 0);
    _WorkPoller_drain.set(this, void 0);
    _WorkPoller_blockMs.set(this, void 0);
    _WorkPoller_reclaimOlderThanMs.set(this, void 0);
    _WorkPoller_requestOpts.set(this, void 0);
    this.client = opts.client;
    this.environmentId = opts.environmentId;
    this.environmentKey = opts.environmentKey;
    this.workerId = opts.workerId ?? defaultWorkerId();
    __classPrivateFieldSet(this, _WorkPoller_runnerClient, copyClientForHelper(opts.client, {
      authToken: opts.environmentKey,
      helper: "environments-work-poller"
    }), "f");
    __classPrivateFieldSet(this, _WorkPoller_autoStop, opts.autoStop ?? true, "f");
    __classPrivateFieldSet(this, _WorkPoller_drain, opts.drain ?? false, "f");
    __classPrivateFieldSet(this, _WorkPoller_blockMs, opts.blockMs === void 0 ? POLL_BLOCK_MS : opts.blockMs, "f");
    __classPrivateFieldSet(this, _WorkPoller_reclaimOlderThanMs, opts.reclaimOlderThanMs ?? null, "f");
    __classPrivateFieldSet(this, _WorkPoller_requestOpts, opts.requestOptions, "f");
    __classPrivateFieldSet(this, _WorkPoller_controller, new AbortController(), "f");
    __classPrivateFieldSet(this, _WorkPoller_detachExternal, linkAbort(opts.signal, __classPrivateFieldGet(this, _WorkPoller_controller, "f")), "f");
  }
  /** Read-only view of this iterator's abort signal. */
  get signal() {
    return __classPrivateFieldGet(this, _WorkPoller_controller, "f").signal;
  }
  /** Abort the iterator. The current `for await` will exit cleanly. */
  abort() {
    __classPrivateFieldGet(this, _WorkPoller_controller, "f").abort();
  }
  async *[(_WorkPoller_runnerClient = /* @__PURE__ */ new WeakMap(), _WorkPoller_consumed = /* @__PURE__ */ new WeakMap(), _WorkPoller_controller = /* @__PURE__ */ new WeakMap(), _WorkPoller_detachExternal = /* @__PURE__ */ new WeakMap(), _WorkPoller_autoStop = /* @__PURE__ */ new WeakMap(), _WorkPoller_drain = /* @__PURE__ */ new WeakMap(), _WorkPoller_blockMs = /* @__PURE__ */ new WeakMap(), _WorkPoller_reclaimOlderThanMs = /* @__PURE__ */ new WeakMap(), _WorkPoller_requestOpts = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    if (__classPrivateFieldGet(this, _WorkPoller_consumed, "f")) {
      throw new AnthropicError("Cannot iterate over a consumed WorkPoller");
    }
    __classPrivateFieldSet(this, _WorkPoller_consumed, true, "f");
    const log = loggerFor(this.client);
    log.info("poller starting", {
      component: "work-poller",
      environment_id: this.environmentId
    });
    try {
      let attempt = 0;
      while (!__classPrivateFieldGet(this, _WorkPoller_controller, "f").signal.aborted) {
        let work;
        try {
          work = await __classPrivateFieldGet(this, _WorkPoller_runnerClient, "f").beta.environments.work.poll(this.environmentId, {
            "Anthropic-Worker-ID": this.workerId,
            ...__classPrivateFieldGet(this, _WorkPoller_blockMs, "f") !== null ? { block_ms: __classPrivateFieldGet(this, _WorkPoller_blockMs, "f") } : {},
            ...__classPrivateFieldGet(this, _WorkPoller_reclaimOlderThanMs, "f") !== null ? { reclaim_older_than_ms: __classPrivateFieldGet(this, _WorkPoller_reclaimOlderThanMs, "f") } : {}
          }, { headers: buildHeaders([__classPrivateFieldGet(this, _WorkPoller_requestOpts, "f")?.headers]), signal: __classPrivateFieldGet(this, _WorkPoller_controller, "f").signal });
        } catch (e) {
          if (__classPrivateFieldGet(this, _WorkPoller_controller, "f").signal.aborted)
            return;
          if (isFatal4xx(e)) {
            log.error("poll failed permanently, stopping poller", { error: String(e) });
            throw e;
          }
          const wait = applyJitter(backoff2(attempt));
          log.warn("poll failed, backing off", { error: String(e), backoff_ms: wait });
          attempt++;
          await sleep(wait, __classPrivateFieldGet(this, _WorkPoller_controller, "f").signal);
          continue;
        }
        attempt = 0;
        if (work == null) {
          if (__classPrivateFieldGet(this, _WorkPoller_drain, "f"))
            return;
          await sleep(jitter(1e3, 3e3), __classPrivateFieldGet(this, _WorkPoller_controller, "f").signal);
          continue;
        }
        log.info("claimed work", {
          component: "work-poller",
          environment_id: this.environmentId,
          work_id: work.id,
          work_type: work.data.type
        });
        try {
          await __classPrivateFieldGet(this, _WorkPoller_runnerClient, "f").beta.environments.work.ack(work.id, { environment_id: work.environment_id }, { headers: buildHeaders([__classPrivateFieldGet(this, _WorkPoller_requestOpts, "f")?.headers]), signal: __classPrivateFieldGet(this, _WorkPoller_controller, "f").signal });
        } catch (e) {
          log.error("ack failed", { work_id: work.id, error: String(e) });
          continue;
        }
        try {
          yield work;
        } finally {
          if (__classPrivateFieldGet(this, _WorkPoller_autoStop, "f")) {
            try {
              await __classPrivateFieldGet(this, _WorkPoller_runnerClient, "f").beta.environments.work.stop(work.id, { environment_id: work.environment_id }, { headers: buildHeaders([__classPrivateFieldGet(this, _WorkPoller_requestOpts, "f")?.headers]) });
            } catch (e) {
              if (!isStatus(e, 409))
                log.warn("stop failed", { work_id: work.id, error: String(e) });
            }
          }
        }
      }
    } finally {
      __classPrivateFieldGet(this, _WorkPoller_detachExternal, "f").call(this);
    }
  }
};
function backoff2(attempt) {
  return backoff(attempt, POLL_BACKOFF_BASE_MS, POLL_BACKOFF_CAP_MS);
}
function defaultWorkerId() {
  const env = globalThis.process?.env;
  const host = env?.["HOSTNAME"];
  return host ? `${host}-${uuid4()}` : uuid4();
}

// node_modules/@anthropic-ai/sdk/lib/environments/worker.mjs
init_error();

// node_modules/@anthropic-ai/sdk/lib/tools/SessionToolRunner.mjs
init_error();

// node_modules/@anthropic-ai/sdk/internal/utils/async-queue.mjs
var _AsyncQueue_items;
var _AsyncQueue_waiters;
var _AsyncQueue_closed;
var AsyncQueue = class {
  constructor() {
    _AsyncQueue_items.set(this, []);
    _AsyncQueue_waiters.set(this, []);
    _AsyncQueue_closed.set(this, false);
  }
  /** Enqueue an item, or hand it directly to a waiting reader. Returns `false` once closed. */
  push(item2) {
    if (__classPrivateFieldGet(this, _AsyncQueue_closed, "f"))
      return false;
    const w2 = __classPrivateFieldGet(this, _AsyncQueue_waiters, "f").shift();
    if (w2)
      w2({ done: false, value: item2 });
    else
      __classPrivateFieldGet(this, _AsyncQueue_items, "f").push(item2);
    return true;
  }
  /** Mark the queue done. Idempotent; wakes every pending reader with `done: true`. */
  close() {
    if (__classPrivateFieldGet(this, _AsyncQueue_closed, "f"))
      return;
    __classPrivateFieldSet(this, _AsyncQueue_closed, true, "f");
    while (__classPrivateFieldGet(this, _AsyncQueue_waiters, "f").length > 0) {
      const w2 = __classPrivateFieldGet(this, _AsyncQueue_waiters, "f").shift();
      w2({ done: true, value: void 0 });
    }
  }
  /**
   * Resolve with the next item, or `done: true` once the queue is closed and
   * drained. When `signal` is supplied, aborting it resolves a pending read
   * with `done: true` (cancellation is pushed down here rather than handled by
   * an outer `Promise.race`).
   */
  next(signal) {
    if (__classPrivateFieldGet(this, _AsyncQueue_items, "f").length > 0) {
      return Promise.resolve({ done: false, value: __classPrivateFieldGet(this, _AsyncQueue_items, "f").shift() });
    }
    if (__classPrivateFieldGet(this, _AsyncQueue_closed, "f") || signal?.aborted) {
      return Promise.resolve({ done: true, value: void 0 });
    }
    return new Promise((resolve5) => {
      const waiter = (r) => {
        signal?.removeEventListener("abort", onAbort);
        resolve5(r);
      };
      const onAbort = () => {
        const idx = __classPrivateFieldGet(this, _AsyncQueue_waiters, "f").indexOf(waiter);
        if (idx >= 0)
          __classPrivateFieldGet(this, _AsyncQueue_waiters, "f").splice(idx, 1);
        resolve5({ done: true, value: void 0 });
      };
      __classPrivateFieldGet(this, _AsyncQueue_waiters, "f").push(waiter);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
  /** Synchronously remove and return the next buffered item, or `undefined` if empty. */
  tryShift() {
    return __classPrivateFieldGet(this, _AsyncQueue_items, "f").shift();
  }
};
_AsyncQueue_items = /* @__PURE__ */ new WeakMap(), _AsyncQueue_waiters = /* @__PURE__ */ new WeakMap(), _AsyncQueue_closed = /* @__PURE__ */ new WeakMap();

// node_modules/@anthropic-ai/sdk/lib/tools/ToolError.mjs
var ToolError = class extends Error {
  constructor(content) {
    const message = typeof content === "string" ? content : content.map((block) => {
      if (block.type === "text")
        return block.text;
      return `[${block.type}]`;
    }).join(" ");
    super(message);
    this.name = "ToolError";
    this.content = content;
  }
};

// node_modules/@anthropic-ai/sdk/lib/tools/BetaRunnableTool.mjs
function toolName(tool) {
  return "name" in tool ? tool.name : tool.mcp_server_name;
}
function toolErrorContent(e) {
  return e instanceof ToolError ? e.content : `Error: ${e instanceof Error ? e.message : String(e)}`;
}
async function runRunnableTool(tool, rawInput, context) {
  try {
    const input = tool.parse ? tool.parse(rawInput) : rawInput;
    const content = await tool.run(input, context);
    return { content, isError: false };
  } catch (e) {
    return { content: toolErrorContent(e), isError: true };
  }
}

// node_modules/@anthropic-ai/sdk/lib/tools/SessionToolRunner.mjs
var _SessionToolRunner_instances;
var _SessionToolRunner_consumed;
var _SessionToolRunner_controller;
var _SessionToolRunner_detachExternal;
var _SessionToolRunner_requestOpts;
var _SessionToolRunner_toolByName;
var _SessionToolRunner_logger;
var _SessionToolRunner_seen;
var _SessionToolRunner_answered;
var _SessionToolRunner_results;
var _SessionToolRunner_inFlightCount;
var _SessionToolRunner_onIdle;
var _SessionToolRunner_idleTimer;
var _SessionToolRunner_requestOptions;
var _SessionToolRunner_streamLoop;
var _SessionToolRunner_reconcile;
var _SessionToolRunner_ingestHistory;
var _SessionToolRunner_handleStreamEvent;
var _SessionToolRunner_armIdleTimer;
var _SessionToolRunner_disarmIdleTimer;
var _SessionToolRunner_execute;
var _SessionToolRunner_sendResult;
var _SessionToolRunner_drain;
var STREAM_BACKOFF_START_MS = 500;
var STREAM_BACKOFF_CAP_MS = 1e4;
var TOOL_TIMEOUT_MS = 12e4;
var DRAIN_TIMEOUT_MS = 3e4;
var SEND_RETRIES = 3;
var DEFAULT_MAX_IDLE_MS = 6e4;
function isEndTurnIdle(ev) {
  return ev.type === "session.status_idle" && ev.stop_reason?.type === "end_turn";
}
var SessionToolRunner = class {
  constructor(sessionId, opts) {
    _SessionToolRunner_instances.add(this);
    _SessionToolRunner_consumed.set(this, false);
    _SessionToolRunner_controller.set(this, void 0);
    _SessionToolRunner_detachExternal.set(this, void 0);
    _SessionToolRunner_requestOpts.set(this, void 0);
    _SessionToolRunner_toolByName.set(this, void 0);
    _SessionToolRunner_logger.set(this, void 0);
    _SessionToolRunner_seen.set(this, /* @__PURE__ */ new Set());
    _SessionToolRunner_answered.set(this, /* @__PURE__ */ new Set());
    _SessionToolRunner_results.set(this, new AsyncQueue());
    _SessionToolRunner_inFlightCount.set(this, 0);
    _SessionToolRunner_onIdle.set(this, null);
    _SessionToolRunner_idleTimer.set(this, void 0);
    this.client = opts.client;
    this.sessionId = sessionId;
    this.tools = opts.tools;
    this.maxIdleMs = opts.maxIdleMs ?? DEFAULT_MAX_IDLE_MS;
    __classPrivateFieldSet(this, _SessionToolRunner_logger, loggerFor(opts.client), "f");
    __classPrivateFieldSet(this, _SessionToolRunner_toolByName, new Map(opts.tools.map((t) => [toolName(t), t])), "f");
    __classPrivateFieldSet(this, _SessionToolRunner_controller, new AbortController(), "f");
    __classPrivateFieldSet(this, _SessionToolRunner_detachExternal, linkAbort(opts.signal, __classPrivateFieldGet(this, _SessionToolRunner_controller, "f")), "f");
    __classPrivateFieldSet(this, _SessionToolRunner_requestOpts, opts.requestOptions, "f");
  }
  /** Read-only view of this runner's abort signal. */
  get signal() {
    return __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal;
  }
  /** Abort the runner. Background tasks will wind down and `for await` will exit cleanly. */
  abort() {
    __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
  }
  async *[(_SessionToolRunner_consumed = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_controller = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_detachExternal = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_requestOpts = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_toolByName = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_logger = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_seen = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_answered = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_results = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_inFlightCount = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_onIdle = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_idleTimer = /* @__PURE__ */ new WeakMap(), _SessionToolRunner_instances = /* @__PURE__ */ new WeakSet(), Symbol.asyncIterator)]() {
    if (__classPrivateFieldGet(this, _SessionToolRunner_consumed, "f")) {
      throw new AnthropicError("Cannot iterate over a consumed SessionToolRunner");
    }
    __classPrivateFieldSet(this, _SessionToolRunner_consumed, true, "f");
    __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info("session tool runner starting", {
      component: "session-tool-runner",
      session_id: this.sessionId
    });
    const streamPromise = __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_streamLoop).call(this).catch((e) => {
      if (!__classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal.aborted) {
        __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").error("stream loop failed", { error: String(e) });
      }
      __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
    });
    try {
      while (true) {
        const next = await __classPrivateFieldGet(this, _SessionToolRunner_results, "f").next(__classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal);
        if (next.done)
          break;
        yield next.value;
      }
      await streamPromise;
      let pending;
      while ((pending = __classPrivateFieldGet(this, _SessionToolRunner_results, "f").tryShift()) !== void 0) {
        yield pending;
      }
    } finally {
      __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
      __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_disarmIdleTimer).call(this);
      await streamPromise;
      try {
        await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_drain).call(this);
      } catch (e) {
        __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn("drain failed", { error: String(e) });
      }
      __classPrivateFieldGet(this, _SessionToolRunner_results, "f").close();
      for (const t of this.tools) {
        try {
          await t.close?.();
        } catch (e) {
          __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn("tool.close failed", { tool: toolName(t), error: String(e) });
        }
      }
      __classPrivateFieldGet(this, _SessionToolRunner_detachExternal, "f").call(this);
    }
  }
};
_SessionToolRunner_requestOptions = function _SessionToolRunner_requestOptions2() {
  return {
    ...__classPrivateFieldGet(this, _SessionToolRunner_requestOpts, "f"),
    headers: buildHeaders([helperHeader("session-tool-runner"), __classPrivateFieldGet(this, _SessionToolRunner_requestOpts, "f")?.headers]),
    signal: __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal
  };
}, _SessionToolRunner_streamLoop = // ===== event stream =====
async function _SessionToolRunner_streamLoop2() {
  const ctrl = __classPrivateFieldGet(this, _SessionToolRunner_controller, "f");
  let backoff3 = STREAM_BACKOFF_START_MS;
  while (!ctrl.signal.aborted) {
    try {
      const stream = await this.client.beta.sessions.events.stream(this.sessionId, {}, __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_requestOptions).call(this));
      await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_reconcile).call(this);
      for await (const ev of stream) {
        backoff3 = STREAM_BACKOFF_START_MS;
        if (await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_handleStreamEvent).call(this, ev))
          return;
      }
    } catch (e) {
      ctrl.signal.throwIfAborted();
      if (isFatal4xx(e)) {
        __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").error("permanent stream failure, shutting down", { error: String(e) });
        ctrl.abort();
        throw e;
      }
      __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn("stream disconnected, reconnecting", {
        error: String(e),
        backoff_ms: backoff3
      });
    }
    ctrl.signal.throwIfAborted();
    await sleep(backoff3, ctrl.signal);
    backoff3 = Math.min(backoff3 * 2, STREAM_BACKOFF_CAP_MS);
  }
}, _SessionToolRunner_reconcile = /**
 * Read full history before dispatching so a `tool_use` whose result appears
 * later in the same history is not re-executed. Runs after the live stream is
 * already attached (see {@link SessionToolRunner.#streamLoop}).
 */
async function _SessionToolRunner_reconcile2() {
  const ctrl = __classPrivateFieldGet(this, _SessionToolRunner_controller, "f");
  const pending = [];
  let lastWasEndTurn = false;
  try {
    for await (const ev of this.client.beta.sessions.events.list(this.sessionId, { limit: 1e3 }, __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_requestOptions).call(this))) {
      __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_ingestHistory).call(this, ev, pending);
      lastWasEndTurn = isEndTurnIdle(ev);
    }
  } catch (e) {
    ctrl.signal.throwIfAborted();
    __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn("reconcile list failed", { error: String(e) });
    for (const ev of pending)
      __classPrivateFieldGet(this, _SessionToolRunner_seen, "f").delete(ev.id);
    return;
  }
  const unanswered = pending.filter((ev) => !__classPrivateFieldGet(this, _SessionToolRunner_answered, "f").has(ev.id));
  if (lastWasEndTurn && unanswered.length === 0)
    __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_armIdleTimer).call(this);
  else
    __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_disarmIdleTimer).call(this);
  for (const ev of unanswered)
    await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_execute).call(this, ev);
}, _SessionToolRunner_ingestHistory = function _SessionToolRunner_ingestHistory2(ev, pending) {
  if (ev.type === "agent.tool_use" || ev.type === "agent.custom_tool_use") {
    __classPrivateFieldGet(this, _SessionToolRunner_seen, "f").add(ev.id);
    if (!__classPrivateFieldGet(this, _SessionToolRunner_answered, "f").has(ev.id))
      pending.push(ev);
  } else if (ev.type === "user.tool_result") {
    __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(ev.tool_use_id);
  } else if (ev.type === "user.custom_tool_result") {
    __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(ev.custom_tool_use_id);
  }
}, _SessionToolRunner_handleStreamEvent = /** Returns true when the runner should exit. */
async function _SessionToolRunner_handleStreamEvent2(ev) {
  if (isEndTurnIdle(ev))
    __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_armIdleTimer).call(this);
  else
    __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_disarmIdleTimer).call(this);
  switch (ev.type) {
    case "agent.tool_use":
    case "agent.custom_tool_use":
      if (!__classPrivateFieldGet(this, _SessionToolRunner_seen, "f").has(ev.id)) {
        __classPrivateFieldGet(this, _SessionToolRunner_seen, "f").add(ev.id);
        await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_execute).call(this, ev);
      }
      return false;
    case "user.tool_result":
      __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(ev.tool_use_id);
      return false;
    case "user.custom_tool_result":
      __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(ev.custom_tool_use_id);
      return false;
    case "session.status_terminated":
    case "session.deleted":
      __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info("session terminated", {
        component: "session-tool-runner",
        session_id: this.sessionId
      });
      __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
      return true;
    default:
      return false;
  }
}, _SessionToolRunner_armIdleTimer = function _SessionToolRunner_armIdleTimer2() {
  __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_disarmIdleTimer).call(this);
  if (this.maxIdleMs <= 0)
    return;
  __classPrivateFieldSet(this, _SessionToolRunner_idleTimer, setTimeout(() => {
    __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info("session idle after end_turn; stopping", {
      component: "session-tool-runner",
      session_id: this.sessionId,
      max_idle_ms: this.maxIdleMs
    });
    __classPrivateFieldGet(this, _SessionToolRunner_controller, "f").abort();
  }, this.maxIdleMs), "f");
}, _SessionToolRunner_disarmIdleTimer = function _SessionToolRunner_disarmIdleTimer2() {
  if (__classPrivateFieldGet(this, _SessionToolRunner_idleTimer, "f") !== void 0) {
    clearTimeout(__classPrivateFieldGet(this, _SessionToolRunner_idleTimer, "f"));
    __classPrivateFieldSet(this, _SessionToolRunner_idleTimer, void 0, "f");
  }
}, _SessionToolRunner_execute = // ===== tool execution =====
async function _SessionToolRunner_execute2(ev) {
  var _a2, _b;
  if (__classPrivateFieldGet(this, _SessionToolRunner_answered, "f").has(ev.id))
    return;
  __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info("executing tool", {
    component: "session-tool-runner",
    session_id: this.sessionId,
    tool: ev.name,
    tool_use_id: ev.id
  });
  __classPrivateFieldSet(this, _SessionToolRunner_inFlightCount, (_a2 = __classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f"), _a2++, _a2), "f");
  try {
    const tool = __classPrivateFieldGet(this, _SessionToolRunner_toolByName, "f").get(ev.name);
    if (!tool) {
      __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").info("tool not owned by this runner; leaving the tool_use_id pending for its owner", {
        component: "session-tool-runner",
        session_id: this.sessionId,
        tool: ev.name,
        tool_use_id: ev.id
      });
      __classPrivateFieldGet(this, _SessionToolRunner_results, "f").push({ event: ev, toolUseId: ev.id, name: ev.name, isError: false, posted: false });
      return;
    }
    let content;
    let isError;
    const toolCtrl = new AbortController();
    const detachTool = linkAbort(__classPrivateFieldGet(this, _SessionToolRunner_controller, "f").signal, toolCtrl);
    const timer = setTimeout(() => toolCtrl.abort(), TOOL_TIMEOUT_MS);
    try {
      const outcome = await runRunnableTool(tool, ev.input, {
        toolUse: ev,
        toolUseBlock: ev,
        signal: toolCtrl.signal
      });
      content = outcome.content;
      isError = outcome.isError;
    } finally {
      clearTimeout(timer);
      detachTool();
    }
    const result = buildResultEvent(ev, isError, toSessionContent(content));
    const posted = await __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_sendResult).call(this, result, ev.id);
    __classPrivateFieldGet(this, _SessionToolRunner_results, "f").push({
      event: ev,
      result,
      toolUseId: ev.id,
      name: ev.name,
      isError,
      posted
    });
  } finally {
    __classPrivateFieldSet(this, _SessionToolRunner_inFlightCount, (_b = __classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f"), _b--, _b), "f");
    if (__classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f") === 0)
      __classPrivateFieldGet(this, _SessionToolRunner_onIdle, "f")?.call(this);
  }
}, _SessionToolRunner_sendResult = async function _SessionToolRunner_sendResult2(result, toolUseId) {
  const ctrl = __classPrivateFieldGet(this, _SessionToolRunner_controller, "f");
  let lastErr;
  for (let i = 0; i < SEND_RETRIES; i++) {
    ctrl.signal.throwIfAborted();
    try {
      await this.client.beta.sessions.events.send(this.sessionId, { events: [result] }, __classPrivateFieldGet(this, _SessionToolRunner_instances, "m", _SessionToolRunner_requestOptions).call(this));
      __classPrivateFieldGet(this, _SessionToolRunner_answered, "f").add(toolUseId);
      return true;
    } catch (e) {
      lastErr = e;
      if (isFatal4xx(e))
        break;
      if (i < SEND_RETRIES - 1)
        await sleep((i + 1) * 1e3, ctrl.signal);
    }
  }
  __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").error("failed to send tool result", {
    tool_use_id: toolUseId,
    error: String(lastErr)
  });
  return false;
}, _SessionToolRunner_drain = /** Wait (bounded) for in-flight tool executions to finish during teardown. */
async function _SessionToolRunner_drain2() {
  if (__classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f") === 0)
    return;
  await Promise.race([new Promise((r) => __classPrivateFieldSet(this, _SessionToolRunner_onIdle, r, "f")), sleep(DRAIN_TIMEOUT_MS)]);
  __classPrivateFieldSet(this, _SessionToolRunner_onIdle, null, "f");
  if (__classPrivateFieldGet(this, _SessionToolRunner_inFlightCount, "f") > 0) {
    __classPrivateFieldGet(this, _SessionToolRunner_logger, "f").warn("drain timeout exceeded");
  }
};
function buildResultEvent(ev, isError, content) {
  if (ev.type === "agent.custom_tool_use") {
    return { type: "user.custom_tool_result", custom_tool_use_id: ev.id, is_error: isError, content };
  }
  return { type: "user.tool_result", tool_use_id: ev.id, is_error: isError, content };
}
function toSessionContent(content) {
  if (typeof content === "string")
    return [{ type: "text", text: content || "(no output)" }];
  const out = content.map((b) => {
    if (b.type === "text")
      return { type: "text", text: b.text || "(no output)" };
    if (b.type === "image" || b.type === "document")
      return b;
    if (b.type === "search_result") {
      return {
        type: "search_result",
        source: b.source,
        title: b.title,
        content: b.content.map((c) => ({ type: "text", text: c.text })),
        citations: { enabled: b.citations?.enabled ?? false }
      };
    }
    return { type: "text", text: JSON.stringify(b) };
  });
  return out.length > 0 ? out : [{ type: "text", text: "(no output)" }];
}

// node_modules/@anthropic-ai/sdk/lib/environments/worker.mjs
var _EnvironmentWorker_instances;
var _EnvironmentWorker_signal;
var _EnvironmentWorker_handleItem;
var HEARTBEAT_DEFAULT_MS = 3e4;
var NO_HEARTBEAT_SENTINEL = "NO_HEARTBEAT";
var EnvironmentWorker = class {
  constructor(opts) {
    _EnvironmentWorker_instances.add(this);
    _EnvironmentWorker_signal.set(this, void 0);
    this.client = opts.client;
    this.environmentId = opts.environmentId;
    this.environmentKey = opts.environmentKey;
    this.tools = opts.tools;
    this.workdir = opts.workdir ?? process.cwd();
    this.unrestrictedPaths = opts.unrestrictedPaths;
    this.maxFileBytes = opts.maxFileBytes;
    this.maxIdleMs = opts.maxIdleMs;
    this.workerId = opts.workerId;
    this.requestOptions = opts.requestOptions;
    __classPrivateFieldSet(this, _EnvironmentWorker_signal, opts.signal, "f");
  }
  /**
   * Poll the environment and service each claimed session until the supplied
   * signal (or the one passed to the constructor) aborts. Throws if
   * `environmentId` / `environmentKey` were not provided to the constructor.
   */
  async run(signal) {
    const { environmentId, environmentKey } = this;
    if (environmentId === void 0 || environmentKey === void 0) {
      throw new AnthropicError("EnvironmentWorker.run: environmentId and environmentKey are required to poll for work");
    }
    const externalSignal = signal ?? __classPrivateFieldGet(this, _EnvironmentWorker_signal, "f");
    const poller = new WorkPoller({
      client: this.client,
      environmentId,
      environmentKey,
      ...this.workerId !== void 0 ? { workerId: this.workerId } : {},
      ...externalSignal ? { signal: externalSignal } : {},
      ...this.requestOptions !== void 0 ? { requestOptions: this.requestOptions } : {},
      // The per-item handler force-stops every work item on exit; let it be the
      // single owner of `work.stop` rather than double-posting from the poller.
      autoStop: false
    });
    for await (const work of poller) {
      await __classPrivateFieldGet(this, _EnvironmentWorker_instances, "m", _EnvironmentWorker_handleItem).call(this, work, environmentKey, poller.signal);
    }
  }
  /**
   * Service a single, already-claimed work item without the poll loop: build the
   * per-session {@link AgentToolContext} (workdir from this worker's options),
   * download the session agent's skills (`setupSkills`), run a
   * {@link SessionToolRunner} for the session while heartbeating the work-item
   * lease in parallel, and force-stop the work item on exit (whether the runner
   * finishes normally, throws, or the heartbeat loop signals shutdown).
   *
   * Use this when something else does the claiming — e.g. a `worker poll
   * --on-work` script that hands an already-claimed item to a fresh process. The
   * work id / environment id / session id each fall back to `ANTHROPIC_WORK_ID` /
   * `ANTHROPIC_ENVIRONMENT_ID` / `ANTHROPIC_SESSION_ID` (the env vars that
   * command sets) when not passed; the environment key resolves from this
   * option, then the worker's own `environmentKey`, then
   * `ANTHROPIC_ENVIRONMENT_KEY`. With no arguments inside that command it just
   * works. Throws a clear error naming the first of the four required values
   * still missing after resolution.
   */
  async handleItem(opts) {
    const workId = opts?.workId ?? readEnv("ANTHROPIC_WORK_ID");
    const environmentId = opts?.environmentId ?? readEnv("ANTHROPIC_ENVIRONMENT_ID");
    const sessionId = opts?.sessionId ?? readEnv("ANTHROPIC_SESSION_ID");
    const environmentKey = opts?.environmentKey ?? this.environmentKey ?? readEnv("ANTHROPIC_ENVIRONMENT_KEY");
    if (!workId) {
      throw new AnthropicError("handleItem: workId is required \u2014 pass it or set ANTHROPIC_WORK_ID");
    }
    if (!environmentId) {
      throw new AnthropicError("handleItem: environmentId is required \u2014 pass it or set ANTHROPIC_ENVIRONMENT_ID");
    }
    if (!sessionId) {
      throw new AnthropicError("handleItem: sessionId is required \u2014 pass it or set ANTHROPIC_SESSION_ID");
    }
    if (!environmentKey) {
      throw new AnthropicError("handleItem: environmentKey is required \u2014 pass it, construct the worker with it, or set ANTHROPIC_ENVIRONMENT_KEY");
    }
    const work = {
      id: workId,
      environment_id: environmentId,
      data: { type: "session", id: sessionId }
    };
    await __classPrivateFieldGet(this, _EnvironmentWorker_instances, "m", _EnvironmentWorker_handleItem).call(this, work, environmentKey, opts?.signal ?? __classPrivateFieldGet(this, _EnvironmentWorker_signal, "f"));
  }
};
_EnvironmentWorker_signal = /* @__PURE__ */ new WeakMap(), _EnvironmentWorker_instances = /* @__PURE__ */ new WeakSet(), _EnvironmentWorker_handleItem = /**
 * The per-item body shared by {@link EnvironmentWorker.run}'s poll loop and
 * {@link EnvironmentWorker.handleItem}: run a {@link SessionToolRunner} for the
 * work item's session while heartbeating its lease, force-stopping on exit.
 * Non-session work items are ignored.
 */
async function _EnvironmentWorker_handleItem2(work, environmentKey, externalSignal) {
  const log = loggerFor(this.client);
  const sessionClient = copyClientForHelper(this.client, {
    authToken: environmentKey,
    helper: "environments-worker"
  });
  const sessionId = work.data.id;
  const ctx = {
    workdir: this.workdir,
    client: this.client,
    sessionId,
    ...this.unrestrictedPaths !== void 0 ? { unrestrictedPaths: this.unrestrictedPaths } : {},
    ...this.maxFileBytes !== void 0 ? { maxFileBytes: this.maxFileBytes } : {}
  };
  const agentToolset = await Promise.resolve().then(() => (init_node_browser(), node_browser_exports));
  let cleanupSkills = async () => {
  };
  try {
    cleanupSkills = await agentToolset.setupSkills(ctx);
  } catch (e) {
    log.warn("skill setup failed", { session_id: sessionId, work_id: work.id, error: String(e) });
  }
  const tools = typeof this.tools === "function" ? this.tools(ctx) : this.tools ?? agentToolset.betaAgentToolset20260401(ctx);
  const ctrl = new AbortController();
  const detachExternal = linkAbort(externalSignal, ctrl);
  const heartbeatPromise = heartbeatLoop(sessionClient, work, ctrl, log, this.requestOptions).catch((e) => {
    if (!ctrl.signal.aborted)
      log.error("heartbeat loop failed", { work_id: work.id, error: String(e) });
    ctrl.abort();
  });
  try {
    const runner = new SessionToolRunner(sessionId, {
      client: sessionClient,
      tools,
      ...this.maxIdleMs !== void 0 ? { maxIdleMs: this.maxIdleMs } : {},
      ...this.requestOptions !== void 0 ? { requestOptions: this.requestOptions } : {},
      signal: ctrl.signal
    });
    for await (const _ of runner) {
    }
  } finally {
    ctrl.abort();
    detachExternal();
    await heartbeatPromise;
    await cleanupSkills().catch((e) => {
      log.warn("skill cleanup failed", { session_id: sessionId, work_id: work.id, error: String(e) });
    });
    await forceStop(sessionClient, work, log, this.requestOptions);
  }
};
async function forceStop(client, work, log, requestOptions) {
  try {
    await client.beta.environments.work.stop(
      work.id,
      { environment_id: work.environment_id, force: true },
      // Caller's headers pass through; the helper-tag header is on the scoped
      // sub-client's default_headers via copyClientForHelper, so no per-call
      // re-stamping needed.
      { ...requestOptions, headers: buildHeaders([requestOptions?.headers]) }
    );
  } catch (e) {
    if (!isStatus(e, 409)) {
      log.error("force-stop on exit failed", { work_id: work.id, error: String(e) });
    }
  }
}
async function heartbeatLoop(client, work, ctrl, logger, requestOptions) {
  let intervalMs = HEARTBEAT_DEFAULT_MS;
  let last = NO_HEARTBEAT_SENTINEL;
  const beat = async () => {
    try {
      const resp = await client.beta.environments.work.heartbeat(work.id, { environment_id: work.environment_id, expected_last_heartbeat: last }, { ...requestOptions, headers: buildHeaders([requestOptions?.headers]), signal: ctrl.signal });
      last = resp.last_heartbeat;
      if (resp.ttl_seconds > 0) {
        intervalMs = Math.max(1e3, Math.min(resp.ttl_seconds * 1e3 / 2, HEARTBEAT_DEFAULT_MS));
      }
      if (resp.state === "stopping" || resp.state === "stopped") {
        logger.info("heartbeat signals shutdown", { work_id: work.id, state: resp.state });
        ctrl.abort();
      }
      if (!resp.lease_extended) {
        logger.warn("lease not extended, shutting down", { work_id: work.id });
        ctrl.abort();
      }
    } catch (e) {
      ctrl.signal.throwIfAborted();
      if (isFatal4xx(e)) {
        logger.error("permanent heartbeat failure", { work_id: work.id, error: String(e) });
        ctrl.abort();
        throw e;
      }
      logger.warn("transient heartbeat failure", { work_id: work.id, error: String(e) });
    }
  };
  await beat();
  while (!ctrl.signal.aborted) {
    await sleep(intervalMs, ctrl.signal);
    ctrl.signal.throwIfAborted();
    await beat();
  }
}

// node_modules/@anthropic-ai/sdk/resources/beta/environments/work.mjs
var Work = class extends APIResource {
  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Retrieve detailed information about a specific work item.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.retrieve('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  retrieve(workID, params, options) {
    const { environment_id, betas } = params;
    return this._client.get(path`/v1/environments/${environment_id}/work/${workID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Update work item metadata with merge semantics.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.update('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *     metadata: { foo: 'string' },
   *   });
   * ```
   */
  update(workID, params, options) {
    const { environment_id, betas, ...body } = params;
    return this._client.post(path`/v1/environments/${environment_id}/work/${workID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * List work items in an environment.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaSelfHostedWork of client.beta.environments.work.list(
   *   'env_011CZkZ9X2dpNyB7HsEFoRfW',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(environmentID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/v1/environments/${environmentID}/work?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Acknowledge receipt of a work item, transitioning it from 'queued' to 'starting'
   * and removing it from the queue.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.ack('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  ack(workID, params, options) {
    const { environment_id, betas } = params;
    return this._client.post(path`/v1/environments/${environment_id}/work/${workID}/ack?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Record a heartbeat for a work item to maintain the lease.
   *
   * @example
   * ```ts
   * const betaSelfHostedWorkHeartbeatResponse =
   *   await client.beta.environments.work.heartbeat('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  heartbeat(workID, params, options) {
    const { environment_id, desired_ttl_seconds, expected_last_heartbeat, betas } = params;
    return this._client.post(path`/v1/environments/${environment_id}/work/${workID}/heartbeat?beta=true`, {
      query: { desired_ttl_seconds, expected_last_heartbeat },
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Long poll for work items in the queue.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.poll(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  poll(environmentID, params = {}, options) {
    const { betas, "Anthropic-Worker-ID": anthropicWorkerID, ...query } = params ?? {};
    return this._client.get(path`/v1/environments/${environmentID}/work/poll?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        {
          "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString(),
          ...anthropicWorkerID != null ? { "Anthropic-Worker-ID": anthropicWorkerID } : void 0
        },
        options?.headers
      ])
    });
  }
  /**
   * Get statistics about the work queue for an environment.
   *
   * @example
   * ```ts
   * const betaSelfHostedWorkQueueStats =
   *   await client.beta.environments.work.stats(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  stats(environmentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/environments/${environmentID}/work/stats?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Note: these endpoints are called automatically by the pre-built environment
   * worker provided in the SDKs and CLI, for orchestrating sessions with self-hosted
   * sandbox environments. They are included here as a reference; you do not need to
   * invoke them directly.
   *
   * Stop a work item, initiating graceful or forced shutdown.
   *
   * @example
   * ```ts
   * const betaSelfHostedWork =
   *   await client.beta.environments.work.stop('work_id', {
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  stop(workID, params, options) {
    const { environment_id, betas, ...body } = params;
    return this._client.post(path`/v1/environments/${environment_id}/work/${workID}/stop?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Continuously claim work from a self-hosted environment, ack each item,
   * and yield it. Posts `stop` automatically when the consumer's loop body
   * returns or when iteration ends.
   *
   * @example
   * ```ts
   * for await (const work of client.beta.environments.work.poller({
   *   environmentId,
   *   environmentKey,
   * })) {
   *   if (work.data.type !== 'session') continue;
   *   // ...service the work...
   * }
   * ```
   */
  poller(opts) {
    return new WorkPoller({ ...opts, client: this._client });
  }
  /**
   * The self-hosted environment runner: poll for work, and for each claimed
   * session set up the workdir, download the agent's skills, run the tools while
   * heartbeating the lease, and force-stop on exit.
   *
   * @example
   * ```ts
   * // Long-running daemon — poll, serve each session, loop:
   * await client.beta.environments.work
   *   .worker({ environmentId, environmentKey, workdir: '/workspace' })
   *   .run();
   *
   * // Or service one already-claimed work item (e.g. inside a sandbox spawned
   * // by `ant worker poll --on-work`) — handleItem() reads the ANTHROPIC_* env vars:
   * await client.beta.environments.work.worker({ workdir: '/workspace' }).handleItem();
   * ```
   */
  worker(opts) {
    return new EnvironmentWorker({ ...opts, client: this._client });
  }
};
Work.WorkPoller = WorkPoller;
Work.EnvironmentWorker = EnvironmentWorker;

// node_modules/@anthropic-ai/sdk/resources/beta/environments/environments.mjs
var Environments = class extends APIResource {
  constructor() {
    super(...arguments);
    this.work = new Work(this._client);
  }
  /**
   * Create a new environment with the specified configuration.
   *
   * @example
   * ```ts
   * const betaEnvironment =
   *   await client.beta.environments.create({
   *     name: 'python-data-analysis',
   *   });
   * ```
   */
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/environments?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Retrieve a specific environment by ID.
   *
   * @example
   * ```ts
   * const betaEnvironment =
   *   await client.beta.environments.retrieve(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  retrieve(environmentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/environments/${environmentID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update an existing environment's configuration.
   *
   * @example
   * ```ts
   * const betaEnvironment =
   *   await client.beta.environments.update(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  update(environmentID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/environments/${environmentID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List environments with pagination support.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaEnvironment of client.beta.environments.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/environments?beta=true", PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete an environment by ID. Returns a confirmation of the deletion.
   *
   * @example
   * ```ts
   * const betaEnvironmentDeleteResponse =
   *   await client.beta.environments.delete(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  delete(environmentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/environments/${environmentID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Archive an environment by ID. Archived environments cannot be used to create new
   * sessions.
   *
   * @example
   * ```ts
   * const betaEnvironment =
   *   await client.beta.environments.archive(
   *     'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   );
   * ```
   */
  archive(environmentID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/environments/${environmentID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};
Environments.Work = Work;

// node_modules/@anthropic-ai/sdk/resources/beta/memory-stores/memories.mjs
var Memories = class extends APIResource {
  /**
   * Create a memory
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemory =
   *   await client.beta.memoryStores.memories.create(
   *     'memory_store_id',
   *     { content: 'content', path: 'xx' },
   *   );
   * ```
   */
  create(memoryStoreID, params, options) {
    const { view, betas, ...body } = params;
    return this._client.post(path`/v1/memory_stores/${memoryStoreID}/memories?beta=true`, {
      query: { view },
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Retrieve a memory
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemory =
   *   await client.beta.memoryStores.memories.retrieve(
   *     'memory_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  retrieve(memoryID, params, options) {
    const { memory_store_id, betas, ...query } = params;
    return this._client.get(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update a memory
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemory =
   *   await client.beta.memoryStores.memories.update(
   *     'memory_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  update(memoryID, params, options) {
    const { memory_store_id, view, betas, ...body } = params;
    return this._client.post(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
      query: { view },
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List memories
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsMemoryListItem of client.beta.memoryStores.memories.list(
   *   'memory_store_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(memoryStoreID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/v1/memory_stores/${memoryStoreID}/memories?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete a memory
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedMemory =
   *   await client.beta.memoryStores.memories.delete(
   *     'memory_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  delete(memoryID, params, options) {
    const { memory_store_id, expected_content_sha256, betas } = params;
    return this._client.delete(path`/v1/memory_stores/${memory_store_id}/memories/${memoryID}?beta=true`, {
      query: { expected_content_sha256 },
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/memory-stores/memory-versions.mjs
var MemoryVersions = class extends APIResource {
  /**
   * Retrieve a memory version
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryVersion =
   *   await client.beta.memoryStores.memoryVersions.retrieve(
   *     'memory_version_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  retrieve(memoryVersionID, params, options) {
    const { memory_store_id, betas, ...query } = params;
    return this._client.get(path`/v1/memory_stores/${memory_store_id}/memory_versions/${memoryVersionID}?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List memory versions
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsMemoryVersion of client.beta.memoryStores.memoryVersions.list(
   *   'memory_store_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(memoryStoreID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/v1/memory_stores/${memoryStoreID}/memory_versions?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Redact a memory version
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryVersion =
   *   await client.beta.memoryStores.memoryVersions.redact(
   *     'memory_version_id',
   *     { memory_store_id: 'memory_store_id' },
   *   );
   * ```
   */
  redact(memoryVersionID, params, options) {
    const { memory_store_id, betas } = params;
    return this._client.post(path`/v1/memory_stores/${memory_store_id}/memory_versions/${memoryVersionID}/redact?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/memory-stores/memory-stores.mjs
var MemoryStores = class extends APIResource {
  constructor() {
    super(...arguments);
    this.memories = new Memories(this._client);
    this.memoryVersions = new MemoryVersions(this._client);
  }
  /**
   * Create a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryStore =
   *   await client.beta.memoryStores.create({ name: 'x' });
   * ```
   */
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/memory_stores?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Retrieve a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryStore =
   *   await client.beta.memoryStores.retrieve(
   *     'memory_store_id',
   *   );
   * ```
   */
  retrieve(memoryStoreID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryStore =
   *   await client.beta.memoryStores.update('memory_store_id');
   * ```
   */
  update(memoryStoreID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List memory stores
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsMemoryStore of client.beta.memoryStores.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/memory_stores?beta=true", PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedMemoryStore =
   *   await client.beta.memoryStores.delete('memory_store_id');
   * ```
   */
  delete(memoryStoreID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/memory_stores/${memoryStoreID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Archive a memory store
   *
   * @example
   * ```ts
   * const betaManagedAgentsMemoryStore =
   *   await client.beta.memoryStores.archive('memory_store_id');
   * ```
   */
  archive(memoryStoreID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/memory_stores/${memoryStoreID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "agent-memory-2026-07-22"].toString() },
        options?.headers
      ])
    });
  }
};
MemoryStores.Memories = Memories;
MemoryStores.MemoryVersions = MemoryVersions;

// node_modules/@anthropic-ai/sdk/error.mjs
init_error();

// node_modules/@anthropic-ai/sdk/internal/decoders/jsonl.mjs
init_error();
var JSONLDecoder = class _JSONLDecoder {
  constructor(iterator, controller) {
    this.iterator = iterator;
    this.controller = controller;
  }
  async *decoder() {
    const lineDecoder = new LineDecoder();
    for await (const chunk of this.iterator) {
      for (const line of lineDecoder.decode(chunk)) {
        yield JSON.parse(line);
      }
    }
    for (const line of lineDecoder.flush()) {
      yield JSON.parse(line);
    }
  }
  [Symbol.asyncIterator]() {
    return this.decoder();
  }
  static fromResponse(response, controller) {
    if (!response.body) {
      controller.abort();
      if (typeof globalThis.navigator !== "undefined" && globalThis.navigator.product === "ReactNative") {
        throw new AnthropicError(`The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`);
      }
      throw new AnthropicError(`Attempted to iterate over a response with no body`);
    }
    return new _JSONLDecoder(ReadableStreamToAsyncIterable(response.body), controller);
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/messages/batches.mjs
var Batches = class extends APIResource {
  /**
   * Send a batch of Message creation requests.
   *
   * The Message Batches API can be used to process multiple Messages API requests at
   * once. Once a Message Batch is created, it begins processing immediately. Batches
   * can take up to 24 hours to complete.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaMessageBatch =
   *   await client.beta.messages.batches.create({
   *     requests: [
   *       {
   *         custom_id: 'my-custom-id-1',
   *         params: {
   *           max_tokens: 1024,
   *           messages: [
   *             { content: 'Hello, world', role: 'user' },
   *           ],
   *           model: 'claude-opus-4-6',
   *         },
   *       },
   *     ],
   *   });
   * ```
   */
  create(params, options) {
    const { betas, user_profile_id, ...body } = params;
    return this._client.post("/v1/messages/batches?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        {
          "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString(),
          ...user_profile_id != null ? { "anthropic-user-profile-id": user_profile_id } : void 0
        },
        options?.headers
      ])
    });
  }
  /**
   * This endpoint is idempotent and can be used to poll for Message Batch
   * completion. To access the results of a Message Batch, make a request to the
   * `results_url` field in the response.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaMessageBatch =
   *   await client.beta.messages.batches.retrieve(
   *     'message_batch_id',
   *   );
   * ```
   */
  retrieve(messageBatchID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/messages/batches/${messageBatchID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List all Message Batches within a Workspace. Most recently created batches are
   * returned first.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaMessageBatch of client.beta.messages.batches.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/messages/batches?beta=true", Page, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete a Message Batch.
   *
   * Message Batches can only be deleted once they've finished processing. If you'd
   * like to delete an in-progress batch, you must first cancel it.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaDeletedMessageBatch =
   *   await client.beta.messages.batches.delete(
   *     'message_batch_id',
   *   );
   * ```
   */
  delete(messageBatchID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/messages/batches/${messageBatchID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Batches may be canceled any time before processing ends. Once cancellation is
   * initiated, the batch enters a `canceling` state, at which time the system may
   * complete any in-progress, non-interruptible requests before finalizing
   * cancellation.
   *
   * The number of canceled requests is specified in `request_counts`. To determine
   * which requests were canceled, check the individual results within the batch.
   * Note that cancellation may not result in any canceled requests if they were
   * non-interruptible.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaMessageBatch =
   *   await client.beta.messages.batches.cancel(
   *     'message_batch_id',
   *   );
   * ```
   */
  cancel(messageBatchID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/messages/batches/${messageBatchID}/cancel?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Streams the results of a Message Batch as a `.jsonl` file.
   *
   * Each line in the file is a JSON object containing the result of a single request
   * in the Message Batch. Results are not guaranteed to be in the same order as
   * requests. Use the `custom_id` field to match results to requests.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaMessageBatchIndividualResponse =
   *   await client.beta.messages.batches.results(
   *     'message_batch_id',
   *   );
   * ```
   */
  async results(messageBatchID, params = {}, options) {
    const batch = await this.retrieve(messageBatchID);
    if (!batch.results_url) {
      throw new AnthropicError(`No batch \`results_url\`; Has it finished processing? ${batch.processing_status} - ${batch.id}`);
    }
    const { betas } = params ?? {};
    return this._client.get(batch.results_url, {
      ...options,
      headers: buildHeaders([
        {
          "anthropic-beta": [...betas ?? [], "message-batches-2024-09-24"].toString(),
          Accept: "application/binary"
        },
        options?.headers
      ]),
      stream: true,
      __binaryResponse: true
    })._thenUnwrap((_, props) => JSONLDecoder.fromResponse(props.response, props.controller));
  }
};

// node_modules/@anthropic-ai/sdk/internal/constants.mjs
var MODEL_NONSTREAMING_TOKENS = {
  "claude-opus-4-20250514": 8192,
  "claude-opus-4-0": 8192,
  "claude-4-opus-20250514": 8192,
  "anthropic.claude-opus-4-20250514-v1:0": 8192,
  "claude-opus-4@20250514": 8192,
  "claude-opus-4-1-20250805": 8192,
  "anthropic.claude-opus-4-1-20250805-v1:0": 8192,
  "claude-opus-4-1@20250805": 8192
};

// node_modules/@anthropic-ai/sdk/lib/beta-parser.mjs
init_error();
function getOutputFormat(params) {
  return params?.output_format ?? params?.output_config?.format;
}
function maybeParseBetaMessage(message, params, opts) {
  const outputFormat = getOutputFormat(params);
  if (!params || !("parse" in (outputFormat ?? {}))) {
    return {
      ...message,
      content: message.content.map((block) => {
        if (block.type === "text") {
          const parsedBlock = Object.defineProperty({ ...block }, "parsed_output", {
            value: null,
            enumerable: false
          });
          return Object.defineProperty(parsedBlock, "parsed", {
            get() {
              opts.logger.warn("The `parsed` property on `text` blocks is deprecated, please use `parsed_output` instead.");
              return null;
            },
            enumerable: false
          });
        }
        return block;
      }),
      parsed_output: null
    };
  }
  return parseBetaMessage(message, params, opts);
}
function parseBetaMessage(message, params, opts) {
  let firstParsedOutput = null;
  const content = message.content.map((block) => {
    if (block.type === "text") {
      const parsedOutput = parseBetaOutputFormat(params, block.text);
      if (firstParsedOutput === null) {
        firstParsedOutput = parsedOutput;
      }
      const parsedBlock = Object.defineProperty({ ...block }, "parsed_output", {
        value: parsedOutput,
        enumerable: false
      });
      return Object.defineProperty(parsedBlock, "parsed", {
        get() {
          opts.logger.warn("The `parsed` property on `text` blocks is deprecated, please use `parsed_output` instead.");
          return parsedOutput;
        },
        enumerable: false
      });
    }
    return block;
  });
  return {
    ...message,
    content,
    parsed_output: firstParsedOutput
  };
}
function parseBetaOutputFormat(params, content) {
  const outputFormat = getOutputFormat(params);
  if (outputFormat?.type !== "json_schema") {
    return null;
  }
  try {
    if ("parse" in outputFormat) {
      return outputFormat.parse(content);
    }
    return JSON.parse(content);
  } catch (error) {
    throw new AnthropicError(`Failed to parse structured output: ${error}`);
  }
}

// node_modules/@anthropic-ai/sdk/lib/BetaMessageStream.mjs
init_errors();

// node_modules/@anthropic-ai/sdk/_vendor/partial-json-parser/parser.mjs
var tokenize = (input) => {
  let current = 0;
  let tokens = [];
  while (current < input.length) {
    let char = input[current];
    if (char === "\\") {
      current++;
      continue;
    }
    if (char === "{") {
      tokens.push({
        type: "brace",
        value: "{"
      });
      current++;
      continue;
    }
    if (char === "}") {
      tokens.push({
        type: "brace",
        value: "}"
      });
      current++;
      continue;
    }
    if (char === "[") {
      tokens.push({
        type: "paren",
        value: "["
      });
      current++;
      continue;
    }
    if (char === "]") {
      tokens.push({
        type: "paren",
        value: "]"
      });
      current++;
      continue;
    }
    if (char === ":") {
      tokens.push({
        type: "separator",
        value: ":"
      });
      current++;
      continue;
    }
    if (char === ",") {
      tokens.push({
        type: "delimiter",
        value: ","
      });
      current++;
      continue;
    }
    if (char === '"') {
      let value = "";
      let danglingQuote = false;
      char = input[++current];
      while (char !== '"') {
        if (current === input.length) {
          danglingQuote = true;
          break;
        }
        if (char === "\\") {
          current++;
          if (current === input.length) {
            danglingQuote = true;
            break;
          }
          value += char + input[current];
          char = input[++current];
        } else {
          value += char;
          char = input[++current];
        }
      }
      char = input[++current];
      if (!danglingQuote) {
        tokens.push({
          type: "string",
          value
        });
      }
      continue;
    }
    let WHITESPACE = /\s/;
    if (char && WHITESPACE.test(char)) {
      current++;
      continue;
    }
    let NUMBERS = /[0-9]/;
    if (char && NUMBERS.test(char) || char === "-" || char === ".") {
      let value = "";
      if (char === "-") {
        value += char;
        char = input[++current];
      }
      while (char && (NUMBERS.test(char) || char === "." || // exponent marker, e.g. `1e10` or `1.5E-9`
      char === "e" || char === "E" || // exponent sign, only valid immediately after the exponent marker
      (char === "-" || char === "+") && (value[value.length - 1] === "e" || value[value.length - 1] === "E"))) {
        value += char;
        char = input[++current];
      }
      tokens.push({
        type: "number",
        value
      });
      continue;
    }
    let LETTERS = /[a-z]/i;
    if (char && LETTERS.test(char)) {
      let value = "";
      while (char && LETTERS.test(char)) {
        if (current === input.length) {
          break;
        }
        value += char;
        char = input[++current];
      }
      if (value == "true" || value == "false" || value === "null") {
        tokens.push({
          type: "name",
          value
        });
      } else {
        current++;
        continue;
      }
      continue;
    }
    current++;
  }
  return tokens;
};
var strip = (tokens) => {
  if (tokens.length === 0) {
    return tokens;
  }
  let lastToken = tokens[tokens.length - 1];
  switch (lastToken.type) {
    case "separator":
      tokens = tokens.slice(0, tokens.length - 1);
      return strip(tokens);
      break;
    case "number":
      let lastCharacterOfLastToken = lastToken.value[lastToken.value.length - 1];
      if (lastCharacterOfLastToken === "." || lastCharacterOfLastToken === "-" || lastCharacterOfLastToken === "+" || lastCharacterOfLastToken === "e" || lastCharacterOfLastToken === "E") {
        tokens = tokens.slice(0, tokens.length - 1);
        return strip(tokens);
      }
    case "string":
      let tokenBeforeTheLastToken = tokens[tokens.length - 2];
      if (tokenBeforeTheLastToken?.type === "delimiter") {
        tokens = tokens.slice(0, tokens.length - 1);
        return strip(tokens);
      } else if (tokenBeforeTheLastToken?.type === "brace" && tokenBeforeTheLastToken.value === "{") {
        tokens = tokens.slice(0, tokens.length - 1);
        return strip(tokens);
      }
      break;
    case "delimiter":
      tokens = tokens.slice(0, tokens.length - 1);
      return strip(tokens);
      break;
  }
  return tokens;
};
var unstrip = (tokens) => {
  let tail = [];
  tokens.map((token) => {
    if (token.type === "brace") {
      if (token.value === "{") {
        tail.push("}");
      } else {
        tail.splice(tail.lastIndexOf("}"), 1);
      }
    }
    if (token.type === "paren") {
      if (token.value === "[") {
        tail.push("]");
      } else {
        tail.splice(tail.lastIndexOf("]"), 1);
      }
    }
  });
  if (tail.length > 0) {
    tail.reverse().map((item2) => {
      if (item2 === "}") {
        tokens.push({
          type: "brace",
          value: "}"
        });
      } else if (item2 === "]") {
        tokens.push({
          type: "paren",
          value: "]"
        });
      }
    });
  }
  return tokens;
};
var generate = (tokens) => {
  let output = "";
  tokens.map((token) => {
    switch (token.type) {
      case "string":
        output += '"' + token.value + '"';
        break;
      default:
        output += token.value;
        break;
    }
  });
  return output;
};
var partialParse = (input) => JSON.parse(generate(unstrip(strip(tokenize(input)))));

// node_modules/@anthropic-ai/sdk/internal/message-stream-utils.mjs
var JSON_BUF_PROPERTY = "__json_buf";
function withLazyInput(prev, jsonBuf) {
  const next = {};
  for (const key of Object.keys(prev)) {
    if (key !== "input")
      next[key] = prev[key];
  }
  Object.defineProperty(next, JSON_BUF_PROPERTY, { value: jsonBuf, enumerable: false, writable: true });
  let input;
  let parsed = false;
  Object.defineProperty(next, "input", {
    enumerable: true,
    configurable: true,
    get() {
      if (!parsed) {
        input = jsonBuf ? partialParse(jsonBuf) : {};
        parsed = true;
      }
      return input;
    }
  });
  return next;
}

// node_modules/@anthropic-ai/sdk/lib/BetaMessageStream.mjs
var _BetaMessageStream_instances;
var _BetaMessageStream_currentMessageSnapshot;
var _BetaMessageStream_params;
var _BetaMessageStream_connectedPromise;
var _BetaMessageStream_resolveConnectedPromise;
var _BetaMessageStream_rejectConnectedPromise;
var _BetaMessageStream_endPromise;
var _BetaMessageStream_resolveEndPromise;
var _BetaMessageStream_rejectEndPromise;
var _BetaMessageStream_listeners;
var _BetaMessageStream_ended;
var _BetaMessageStream_errored;
var _BetaMessageStream_aborted;
var _BetaMessageStream_catchingPromiseCreated;
var _BetaMessageStream_response;
var _BetaMessageStream_request_id;
var _BetaMessageStream_logger;
var _BetaMessageStream_getFinalMessage;
var _BetaMessageStream_getFinalText;
var _BetaMessageStream_handleError;
var _BetaMessageStream_beginRequest;
var _BetaMessageStream_addStreamEvent;
var _BetaMessageStream_endRequest;
var _BetaMessageStream_accumulateMessage;
var _BetaMessageStream_toolInputParseError;
function tracksToolInput(content) {
  return content.type === "tool_use" || content.type === "server_tool_use" || content.type === "mcp_tool_use";
}
var BetaMessageStream = class _BetaMessageStream {
  constructor(params, opts) {
    _BetaMessageStream_instances.add(this);
    this.messages = [];
    this.receivedMessages = [];
    _BetaMessageStream_currentMessageSnapshot.set(this, void 0);
    _BetaMessageStream_params.set(this, null);
    this.controller = new AbortController();
    _BetaMessageStream_connectedPromise.set(this, void 0);
    _BetaMessageStream_resolveConnectedPromise.set(this, () => {
    });
    _BetaMessageStream_rejectConnectedPromise.set(this, () => {
    });
    _BetaMessageStream_endPromise.set(this, void 0);
    _BetaMessageStream_resolveEndPromise.set(this, () => {
    });
    _BetaMessageStream_rejectEndPromise.set(this, () => {
    });
    _BetaMessageStream_listeners.set(this, {});
    _BetaMessageStream_ended.set(this, false);
    _BetaMessageStream_errored.set(this, false);
    _BetaMessageStream_aborted.set(this, false);
    _BetaMessageStream_catchingPromiseCreated.set(this, false);
    _BetaMessageStream_response.set(this, void 0);
    _BetaMessageStream_request_id.set(this, void 0);
    _BetaMessageStream_logger.set(this, void 0);
    _BetaMessageStream_handleError.set(this, (error) => {
      __classPrivateFieldSet(this, _BetaMessageStream_errored, true, "f");
      if (isAbortError(error)) {
        error = new APIUserAbortError();
      }
      if (error instanceof APIUserAbortError) {
        __classPrivateFieldSet(this, _BetaMessageStream_aborted, true, "f");
        return this._emit("abort", error);
      }
      if (error instanceof AnthropicError) {
        return this._emit("error", error);
      }
      if (error instanceof Error) {
        const anthropicError = new AnthropicError(error.message);
        anthropicError.cause = error;
        return this._emit("error", anthropicError);
      }
      return this._emit("error", new AnthropicError(String(error)));
    });
    __classPrivateFieldSet(this, _BetaMessageStream_connectedPromise, new Promise((resolve5, reject) => {
      __classPrivateFieldSet(this, _BetaMessageStream_resolveConnectedPromise, resolve5, "f");
      __classPrivateFieldSet(this, _BetaMessageStream_rejectConnectedPromise, reject, "f");
    }), "f");
    __classPrivateFieldSet(this, _BetaMessageStream_endPromise, new Promise((resolve5, reject) => {
      __classPrivateFieldSet(this, _BetaMessageStream_resolveEndPromise, resolve5, "f");
      __classPrivateFieldSet(this, _BetaMessageStream_rejectEndPromise, reject, "f");
    }), "f");
    __classPrivateFieldGet(this, _BetaMessageStream_connectedPromise, "f").catch(() => {
    });
    __classPrivateFieldGet(this, _BetaMessageStream_endPromise, "f").catch(() => {
    });
    __classPrivateFieldSet(this, _BetaMessageStream_params, params, "f");
    __classPrivateFieldSet(this, _BetaMessageStream_logger, opts?.logger ?? console, "f");
  }
  get response() {
    return __classPrivateFieldGet(this, _BetaMessageStream_response, "f");
  }
  get request_id() {
    return __classPrivateFieldGet(this, _BetaMessageStream_request_id, "f");
  }
  /**
   * Returns the `MessageStream` data, the raw `Response` instance and the ID of the request,
   * returned vie the `request-id` header which is useful for debugging requests and resporting
   * issues to Anthropic.
   *
   * This is the same as the `APIPromise.withResponse()` method.
   *
   * This method will raise an error if you created the stream using `MessageStream.fromReadableStream`
   * as no `Response` is available.
   */
  async withResponse() {
    __classPrivateFieldSet(this, _BetaMessageStream_catchingPromiseCreated, true, "f");
    const response = await __classPrivateFieldGet(this, _BetaMessageStream_connectedPromise, "f");
    if (!response) {
      throw new Error("Could not resolve a `Response` object");
    }
    return {
      data: this,
      response,
      request_id: response.headers.get("request-id")
    };
  }
  /**
   * Intended for use on the frontend, consuming a stream produced with
   * `.toReadableStream()` on the backend.
   *
   * Note that messages sent to the model do not appear in `.on('message')`
   * in this context.
   */
  static fromReadableStream(stream) {
    const runner = new _BetaMessageStream(null);
    runner._run(() => runner._fromReadableStream(stream));
    return runner;
  }
  static createMessage(messages, params, options, { logger } = {}) {
    const runner = new _BetaMessageStream(params, { logger });
    for (const message of params.messages) {
      runner._addMessageParam(message);
    }
    __classPrivateFieldSet(runner, _BetaMessageStream_params, { ...params, stream: true }, "f");
    runner._run(() => runner._createMessage(messages, { ...params, stream: true }, { ...options, headers: { ...options?.headers, [STAINLESS_HELPER_METHOD_HEADER]: "stream" } }));
    return runner;
  }
  _run(executor) {
    executor().then(() => {
      this._emitFinal();
      this._emit("end");
    }, __classPrivateFieldGet(this, _BetaMessageStream_handleError, "f"));
  }
  _addMessageParam(message) {
    this.messages.push(message);
  }
  _addMessage(message, emit = true) {
    this.receivedMessages.push(message);
    if (emit) {
      this._emit("message", message);
    }
  }
  async _createMessage(messages, params, options) {
    const signal = options?.signal;
    let abortHandler;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      abortHandler = this.controller.abort.bind(this.controller);
      signal.addEventListener("abort", abortHandler);
    }
    try {
      __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_beginRequest).call(this);
      const { response, data: stream } = await messages.create({ ...params, stream: true }, { ...options, signal: this.controller.signal }).withResponse();
      this._connected(response);
      for await (const event of stream) {
        __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_addStreamEvent).call(this, event);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError();
      }
      __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_endRequest).call(this);
    } finally {
      if (signal && abortHandler) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  }
  _connected(response) {
    if (this.ended)
      return;
    __classPrivateFieldSet(this, _BetaMessageStream_response, response, "f");
    __classPrivateFieldSet(this, _BetaMessageStream_request_id, response?.headers.get("request-id"), "f");
    __classPrivateFieldGet(this, _BetaMessageStream_resolveConnectedPromise, "f").call(this, response);
    this._emit("connect");
  }
  get ended() {
    return __classPrivateFieldGet(this, _BetaMessageStream_ended, "f");
  }
  get errored() {
    return __classPrivateFieldGet(this, _BetaMessageStream_errored, "f");
  }
  get aborted() {
    return __classPrivateFieldGet(this, _BetaMessageStream_aborted, "f");
  }
  abort() {
    this.controller.abort();
  }
  /**
   * Adds the listener function to the end of the listeners array for the event.
   * No checks are made to see if the listener has already been added. Multiple calls passing
   * the same combination of event and listener will result in the listener being added, and
   * called, multiple times.
   * @returns this MessageStream, so that calls can be chained
   */
  on(event, listener) {
    const listeners = __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] = []);
    listeners.push({ listener });
    return this;
  }
  /**
   * Removes the specified listener from the listener array for the event.
   * off() will remove, at most, one instance of a listener from the listener array. If any single
   * listener has been added multiple times to the listener array for the specified event, then
   * off() must be called multiple times to remove each instance.
   * @returns this MessageStream, so that calls can be chained
   */
  off(event, listener) {
    const listeners = __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event];
    if (!listeners)
      return this;
    const index = listeners.findIndex((l) => l.listener === listener);
    if (index >= 0)
      listeners.splice(index, 1);
    return this;
  }
  /**
   * Adds a one-time listener function for the event. The next time the event is triggered,
   * this listener is removed and then invoked.
   * @returns this MessageStream, so that calls can be chained
   */
  once(event, listener) {
    const listeners = __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] = []);
    listeners.push({ listener, once: true });
    return this;
  }
  /**
   * This is similar to `.once()`, but returns a Promise that resolves the next time
   * the event is triggered, instead of calling a listener callback.
   * @returns a Promise that resolves the next time given event is triggered,
   * or rejects if an error is emitted.  (If you request the 'error' event,
   * returns a promise that resolves with the error).
   *
   * Example:
   *
   *   const message = await stream.emitted('message') // rejects if the stream errors
   */
  emitted(event) {
    return new Promise((resolve5, reject) => {
      __classPrivateFieldSet(this, _BetaMessageStream_catchingPromiseCreated, true, "f");
      if (event !== "error")
        this.once("error", reject);
      this.once(event, resolve5);
    });
  }
  async done() {
    __classPrivateFieldSet(this, _BetaMessageStream_catchingPromiseCreated, true, "f");
    await __classPrivateFieldGet(this, _BetaMessageStream_endPromise, "f");
  }
  get currentMessage() {
    return __classPrivateFieldGet(this, _BetaMessageStream_currentMessageSnapshot, "f");
  }
  /**
   * @returns a promise that resolves with the the final assistant Message response,
   * or rejects if an error occurred or the stream ended prematurely without producing a Message.
   * If structured outputs were used, this will be a ParsedMessage with a `parsed` field.
   */
  async finalMessage() {
    await this.done();
    return __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_getFinalMessage).call(this);
  }
  /**
   * @returns a promise that resolves with the the final assistant Message's text response, concatenated
   * together if there are more than one text blocks.
   * Rejects if an error occurred or the stream ended prematurely without producing a Message.
   */
  async finalText() {
    await this.done();
    return __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_getFinalText).call(this);
  }
  _emit(event, ...args) {
    if (__classPrivateFieldGet(this, _BetaMessageStream_ended, "f"))
      return;
    if (event === "end") {
      __classPrivateFieldSet(this, _BetaMessageStream_ended, true, "f");
      __classPrivateFieldGet(this, _BetaMessageStream_resolveEndPromise, "f").call(this);
    }
    const listeners = __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event];
    if (listeners) {
      __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f")[event] = listeners.filter((l) => !l.once);
      listeners.forEach(({ listener }) => listener(...args));
    }
    if (event === "abort") {
      const error = args[0];
      if (!__classPrivateFieldGet(this, _BetaMessageStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error);
      }
      __classPrivateFieldGet(this, _BetaMessageStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet(this, _BetaMessageStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
      return;
    }
    if (event === "error") {
      const error = args[0];
      if (!__classPrivateFieldGet(this, _BetaMessageStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error);
      }
      __classPrivateFieldGet(this, _BetaMessageStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet(this, _BetaMessageStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
    }
  }
  _emitFinal() {
    const finalMessage = this.receivedMessages.at(-1);
    if (finalMessage) {
      this._emit("finalMessage", __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_getFinalMessage).call(this));
    }
  }
  async _fromReadableStream(readableStream, options) {
    const signal = options?.signal;
    let abortHandler;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      abortHandler = this.controller.abort.bind(this.controller);
      signal.addEventListener("abort", abortHandler);
    }
    try {
      __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_beginRequest).call(this);
      this._connected(null);
      const stream = Stream.fromReadableStream(readableStream, this.controller);
      for await (const event of stream) {
        __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_addStreamEvent).call(this, event);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError();
      }
      __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_endRequest).call(this);
    } finally {
      if (signal && abortHandler) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  }
  [(_BetaMessageStream_currentMessageSnapshot = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_params = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_connectedPromise = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_resolveConnectedPromise = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_rejectConnectedPromise = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_endPromise = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_resolveEndPromise = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_rejectEndPromise = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_listeners = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_ended = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_errored = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_aborted = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_catchingPromiseCreated = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_response = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_request_id = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_logger = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_handleError = /* @__PURE__ */ new WeakMap(), _BetaMessageStream_instances = /* @__PURE__ */ new WeakSet(), _BetaMessageStream_getFinalMessage = function _BetaMessageStream_getFinalMessage2() {
    if (this.receivedMessages.length === 0) {
      throw new AnthropicError("stream ended without producing a Message with role=assistant");
    }
    return this.receivedMessages.at(-1);
  }, _BetaMessageStream_getFinalText = function _BetaMessageStream_getFinalText2() {
    if (this.receivedMessages.length === 0) {
      throw new AnthropicError("stream ended without producing a Message with role=assistant");
    }
    const textBlocks = this.receivedMessages.at(-1).content.filter((block) => block.type === "text").map((block) => block.text);
    if (textBlocks.length === 0) {
      throw new AnthropicError("stream ended without producing a content block with type=text");
    }
    return textBlocks.join(" ");
  }, _BetaMessageStream_beginRequest = function _BetaMessageStream_beginRequest2() {
    if (this.ended)
      return;
    __classPrivateFieldSet(this, _BetaMessageStream_currentMessageSnapshot, void 0, "f");
  }, _BetaMessageStream_addStreamEvent = function _BetaMessageStream_addStreamEvent2(event) {
    if (this.ended)
      return;
    const messageSnapshot = __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_accumulateMessage).call(this, event);
    this._emit("streamEvent", event, messageSnapshot);
    switch (event.type) {
      case "content_block_delta": {
        const content = messageSnapshot.content.at(-1);
        switch (event.delta.type) {
          case "text_delta": {
            if (content.type === "text") {
              this._emit("text", event.delta.text, content.text || "");
            }
            break;
          }
          case "citations_delta": {
            if (content.type === "text") {
              this._emit("citation", event.delta.citation, content.citations ?? []);
            }
            break;
          }
          case "input_json_delta": {
            if (tracksToolInput(content) && __classPrivateFieldGet(this, _BetaMessageStream_listeners, "f").inputJson?.length) {
              let jsonSnapshot;
              try {
                jsonSnapshot = content.input;
              } catch (err) {
                __classPrivateFieldGet(this, _BetaMessageStream_handleError, "f").call(this, __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_toolInputParseError).call(this, content, err));
                break;
              }
              this._emit("inputJson", event.delta.partial_json, jsonSnapshot);
            }
            break;
          }
          case "thinking_delta": {
            if (content.type === "thinking") {
              this._emit("thinking", event.delta.thinking, content.thinking);
            }
            break;
          }
          case "signature_delta": {
            if (content.type === "thinking") {
              this._emit("signature", content.signature);
            }
            break;
          }
          case "compaction_delta": {
            if (content.type === "compaction" && content.content) {
              this._emit("compaction", content.content);
            }
            break;
          }
          default:
            checkNever(event.delta);
        }
        break;
      }
      case "message_stop": {
        this._addMessageParam(messageSnapshot);
        this._addMessage(maybeParseBetaMessage(messageSnapshot, __classPrivateFieldGet(this, _BetaMessageStream_params, "f"), { logger: __classPrivateFieldGet(this, _BetaMessageStream_logger, "f") }), true);
        break;
      }
      case "content_block_stop": {
        this._emit("contentBlock", messageSnapshot.content.at(-1));
        break;
      }
      case "message_start": {
        __classPrivateFieldSet(this, _BetaMessageStream_currentMessageSnapshot, messageSnapshot, "f");
        break;
      }
      case "content_block_start":
      case "message_delta":
        break;
    }
  }, _BetaMessageStream_endRequest = function _BetaMessageStream_endRequest2() {
    if (this.ended) {
      throw new AnthropicError(`stream has ended, this shouldn't happen`);
    }
    const snapshot = __classPrivateFieldGet(this, _BetaMessageStream_currentMessageSnapshot, "f");
    if (!snapshot) {
      throw new AnthropicError(`request ended without sending any chunks`);
    }
    __classPrivateFieldSet(this, _BetaMessageStream_currentMessageSnapshot, void 0, "f");
    return maybeParseBetaMessage(snapshot, __classPrivateFieldGet(this, _BetaMessageStream_params, "f"), { logger: __classPrivateFieldGet(this, _BetaMessageStream_logger, "f") });
  }, _BetaMessageStream_accumulateMessage = function _BetaMessageStream_accumulateMessage2(event) {
    let snapshot = __classPrivateFieldGet(this, _BetaMessageStream_currentMessageSnapshot, "f");
    if (event.type === "message_start") {
      if (snapshot) {
        throw new AnthropicError(`Unexpected event order, got ${event.type} before receiving "message_stop"`);
      }
      return event.message;
    }
    if (!snapshot) {
      throw new AnthropicError(`Unexpected event order, got ${event.type} before "message_start"`);
    }
    switch (event.type) {
      case "message_stop":
        return snapshot;
      case "message_delta":
        snapshot.container = event.delta.container;
        snapshot.stop_reason = event.delta.stop_reason;
        snapshot.stop_sequence = event.delta.stop_sequence;
        if (event.delta.stop_details != null) {
          snapshot.stop_details = event.delta.stop_details;
        }
        snapshot.usage.output_tokens = event.usage.output_tokens;
        snapshot.context_management = event.context_management;
        if (event.usage.input_tokens != null) {
          snapshot.usage.input_tokens = event.usage.input_tokens;
        }
        if (event.usage.cache_creation_input_tokens != null) {
          snapshot.usage.cache_creation_input_tokens = event.usage.cache_creation_input_tokens;
        }
        if (event.usage.cache_read_input_tokens != null) {
          snapshot.usage.cache_read_input_tokens = event.usage.cache_read_input_tokens;
        }
        if (event.usage.server_tool_use != null) {
          snapshot.usage.server_tool_use = event.usage.server_tool_use;
        }
        if (event.usage.iterations != null) {
          snapshot.usage.iterations = event.usage.iterations;
        }
        return snapshot;
      case "content_block_start":
        snapshot.content.push(event.content_block);
        if (event.content_block.type === "fallback") {
          snapshot.model = event.content_block.to.model;
        }
        return snapshot;
      case "content_block_delta": {
        const snapshotContent = snapshot.content.at(event.index);
        switch (event.delta.type) {
          case "text_delta": {
            if (snapshotContent?.type === "text") {
              snapshot.content[event.index] = {
                ...snapshotContent,
                text: (snapshotContent.text || "") + event.delta.text
              };
            }
            break;
          }
          case "citations_delta": {
            if (snapshotContent?.type === "text") {
              snapshot.content[event.index] = {
                ...snapshotContent,
                citations: [...snapshotContent.citations ?? [], event.delta.citation]
              };
            }
            break;
          }
          case "input_json_delta": {
            if (snapshotContent && tracksToolInput(snapshotContent)) {
              const jsonBuf = (snapshotContent[JSON_BUF_PROPERTY] || "") + event.delta.partial_json;
              snapshot.content[event.index] = withLazyInput(snapshotContent, jsonBuf);
            }
            break;
          }
          case "thinking_delta": {
            if (snapshotContent?.type === "thinking") {
              snapshot.content[event.index] = {
                ...snapshotContent,
                thinking: snapshotContent.thinking + event.delta.thinking
              };
            }
            break;
          }
          case "signature_delta": {
            if (snapshotContent?.type === "thinking") {
              snapshot.content[event.index] = {
                ...snapshotContent,
                signature: event.delta.signature
              };
            }
            break;
          }
          case "compaction_delta": {
            if (snapshotContent?.type === "compaction") {
              snapshot.content[event.index] = {
                ...snapshotContent,
                content: (snapshotContent.content || "") + event.delta.content,
                encrypted_content: event.delta.encrypted_content
              };
            }
            break;
          }
          default:
            checkNever(event.delta);
        }
        return snapshot;
      }
      case "content_block_stop": {
        const snapshotContent = snapshot.content.at(event.index);
        if (snapshotContent && tracksToolInput(snapshotContent) && JSON_BUF_PROPERTY in snapshotContent) {
          let input;
          try {
            input = snapshotContent.input;
          } catch (err) {
            input = {};
            __classPrivateFieldGet(this, _BetaMessageStream_handleError, "f").call(this, __classPrivateFieldGet(this, _BetaMessageStream_instances, "m", _BetaMessageStream_toolInputParseError).call(this, snapshotContent, err));
          }
          Object.defineProperty(snapshotContent, "input", {
            value: input,
            enumerable: true,
            configurable: true,
            writable: true
          });
        }
        return snapshot;
      }
    }
  }, _BetaMessageStream_toolInputParseError = function _BetaMessageStream_toolInputParseError2(block, err) {
    const jsonBuf = block[JSON_BUF_PROPERTY];
    return new AnthropicError(`Unable to parse tool parameter JSON from model. Please retry your request or adjust your prompt. Error: ${err}. JSON: ${jsonBuf}`);
  }, Symbol.asyncIterator)]() {
    const pushQueue = [];
    const readQueue = [];
    let done = false;
    this.on("streamEvent", (event) => {
      const reader = readQueue.shift();
      if (reader) {
        reader.resolve(event);
      } else {
        pushQueue.push(event);
      }
    });
    this.on("end", () => {
      done = true;
      for (const reader of readQueue) {
        reader.resolve(void 0);
      }
      readQueue.length = 0;
    });
    this.on("abort", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    this.on("error", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    return {
      next: async () => {
        if (!pushQueue.length) {
          if (done) {
            return { value: void 0, done: true };
          }
          return new Promise((resolve5, reject) => readQueue.push({ resolve: resolve5, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: void 0, done: true });
        }
        const chunk = pushQueue.shift();
        return { value: chunk, done: false };
      },
      return: async () => {
        this.abort();
        return { value: void 0, done: true };
      }
    };
  }
  toReadableStream() {
    const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
    return stream.toReadableStream();
  }
};
function checkNever(x) {
}

// node_modules/@anthropic-ai/sdk/lib/tools/BetaToolRunner.mjs
init_error();

// node_modules/@anthropic-ai/sdk/internal/utils/promise.mjs
function promiseWithResolvers() {
  let resolve5;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve5 = res;
    reject = rej;
  });
  return { promise, resolve: resolve5, reject };
}

// node_modules/@anthropic-ai/sdk/lib/tools/CompactionControl.mjs
var DEFAULT_TOKEN_THRESHOLD = 1e5;
var DEFAULT_SUMMARY_PROMPT = `You have been working on the task described above but have not yet completed it. Write a continuation summary that will allow you (or another instance of yourself) to resume work efficiently in a future context window where the conversation history will be replaced with this summary. Your summary should be structured, concise, and actionable. Include:
1. Task Overview
The user's core request and success criteria
Any clarifications or constraints they specified
2. Current State
What has been completed so far
Files created, modified, or analyzed (with paths if relevant)
Key outputs or artifacts produced
3. Important Discoveries
Technical constraints or requirements uncovered
Decisions made and their rationale
Errors encountered and how they were resolved
What approaches were tried that didn't work (and why)
4. Next Steps
Specific actions needed to complete the task
Any blockers or open questions to resolve
Priority order if multiple steps remain
5. Context to Preserve
User preferences or style requirements
Domain-specific details that aren't obvious
Any promises made to the user
Be concise but complete\u2014err on the side of including information that would prevent duplicate work or repeated mistakes. Write in a way that enables immediate resumption of the task.
Wrap your summary in <summary></summary> tags.`;

// node_modules/@anthropic-ai/sdk/lib/tools/BetaToolRunner.mjs
var _BetaToolRunner_instances;
var _BetaToolRunner_consumed;
var _BetaToolRunner_mutated;
var _BetaToolRunner_state;
var _BetaToolRunner_options;
var _BetaToolRunner_message;
var _BetaToolRunner_toolResponse;
var _BetaToolRunner_completion;
var _BetaToolRunner_iterationCount;
var _BetaToolRunner_checkAndCompact;
var _BetaToolRunner_generateToolResponse;
var BetaToolRunner = class {
  constructor(client, params, options) {
    _BetaToolRunner_instances.add(this);
    this.client = client;
    _BetaToolRunner_consumed.set(this, false);
    _BetaToolRunner_mutated.set(this, false);
    _BetaToolRunner_state.set(this, void 0);
    _BetaToolRunner_options.set(this, void 0);
    _BetaToolRunner_message.set(this, void 0);
    _BetaToolRunner_toolResponse.set(this, void 0);
    _BetaToolRunner_completion.set(this, void 0);
    _BetaToolRunner_iterationCount.set(this, 0);
    __classPrivateFieldSet(this, _BetaToolRunner_state, {
      params: {
        // You can't clone the entire params since there are functions as handlers.
        // You also don't really need to clone params.messages, but it probably will prevent a foot gun
        // somewhere.
        ...params,
        messages: structuredClone(params.messages)
      }
    }, "f");
    const collected = collectStainlessHelpers(params.tools, params.messages);
    __classPrivateFieldSet(this, _BetaToolRunner_options, {
      ...options,
      headers: buildHeaders([
        helperHeader("BetaToolRunner"),
        collected.length ? { [STAINLESS_HELPER_HEADER]: collected.join(", ") } : void 0,
        options?.headers
      ])
    }, "f");
    __classPrivateFieldSet(this, _BetaToolRunner_completion, promiseWithResolvers(), "f");
    if (params.compactionControl?.enabled) {
      console.warn('Anthropic: The `compactionControl` parameter is deprecated and will be removed in a future version. Use server-side compaction instead by passing `edits: [{ type: "compact_20260112" }]` in the params passed to `toolRunner()`. See https://platform.claude.com/docs/en/build-with-claude/compaction');
    }
  }
  async *[(_BetaToolRunner_consumed = /* @__PURE__ */ new WeakMap(), _BetaToolRunner_mutated = /* @__PURE__ */ new WeakMap(), _BetaToolRunner_state = /* @__PURE__ */ new WeakMap(), _BetaToolRunner_options = /* @__PURE__ */ new WeakMap(), _BetaToolRunner_message = /* @__PURE__ */ new WeakMap(), _BetaToolRunner_toolResponse = /* @__PURE__ */ new WeakMap(), _BetaToolRunner_completion = /* @__PURE__ */ new WeakMap(), _BetaToolRunner_iterationCount = /* @__PURE__ */ new WeakMap(), _BetaToolRunner_instances = /* @__PURE__ */ new WeakSet(), _BetaToolRunner_checkAndCompact = async function _BetaToolRunner_checkAndCompact2() {
    const compactionControl = __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.compactionControl;
    if (!compactionControl || !compactionControl.enabled) {
      return false;
    }
    let tokensUsed = 0;
    if (__classPrivateFieldGet(this, _BetaToolRunner_message, "f") !== void 0) {
      try {
        const message = await __classPrivateFieldGet(this, _BetaToolRunner_message, "f");
        const totalInputTokens = message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0);
        tokensUsed = totalInputTokens + message.usage.output_tokens;
      } catch {
        return false;
      }
    }
    const threshold = compactionControl.contextTokenThreshold ?? DEFAULT_TOKEN_THRESHOLD;
    if (tokensUsed < threshold) {
      return false;
    }
    const model = compactionControl.model ?? __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.model;
    const summaryPrompt = compactionControl.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT;
    const messages = __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages;
    if (messages[messages.length - 1].role === "assistant") {
      const lastMessage = messages[messages.length - 1];
      if (Array.isArray(lastMessage.content)) {
        const nonToolBlocks = lastMessage.content.filter((block) => block.type !== "tool_use");
        if (nonToolBlocks.length === 0) {
          messages.pop();
        } else {
          lastMessage.content = nonToolBlocks;
        }
      }
    }
    const response = await this.client.beta.messages.create({
      model,
      messages: [
        ...messages,
        {
          role: "user",
          content: [
            {
              type: "text",
              text: summaryPrompt
            }
          ]
        }
      ],
      max_tokens: __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.max_tokens
    }, {
      signal: __classPrivateFieldGet(this, _BetaToolRunner_options, "f").signal,
      headers: buildHeaders([__classPrivateFieldGet(this, _BetaToolRunner_options, "f").headers, helperHeader("compaction")])
    });
    if (response.content[0]?.type !== "text") {
      throw new AnthropicError("Expected text response for compaction");
    }
    __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages = [
      {
        role: "user",
        content: response.content
      }
    ];
    return true;
  }, Symbol.asyncIterator)]() {
    var _a2;
    if (__classPrivateFieldGet(this, _BetaToolRunner_consumed, "f")) {
      throw new AnthropicError("Cannot iterate over a consumed stream");
    }
    __classPrivateFieldSet(this, _BetaToolRunner_consumed, true, "f");
    __classPrivateFieldSet(this, _BetaToolRunner_mutated, true, "f");
    __classPrivateFieldSet(this, _BetaToolRunner_toolResponse, void 0, "f");
    try {
      while (true) {
        let stream;
        try {
          if (__classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.max_iterations && __classPrivateFieldGet(this, _BetaToolRunner_iterationCount, "f") >= __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.max_iterations) {
            break;
          }
          __classPrivateFieldSet(this, _BetaToolRunner_mutated, false, "f");
          __classPrivateFieldSet(this, _BetaToolRunner_toolResponse, void 0, "f");
          __classPrivateFieldSet(this, _BetaToolRunner_iterationCount, (_a2 = __classPrivateFieldGet(this, _BetaToolRunner_iterationCount, "f"), _a2++, _a2), "f");
          __classPrivateFieldSet(this, _BetaToolRunner_message, void 0, "f");
          const { max_iterations, compactionControl, ...params } = __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params;
          if (params.stream) {
            stream = this.client.beta.messages.stream({ ...params }, __classPrivateFieldGet(this, _BetaToolRunner_options, "f"));
            __classPrivateFieldSet(this, _BetaToolRunner_message, stream.finalMessage(), "f");
            __classPrivateFieldGet(this, _BetaToolRunner_message, "f").catch(() => {
            });
            yield stream;
          } else {
            __classPrivateFieldSet(this, _BetaToolRunner_message, this.client.beta.messages.create({ ...params, stream: false }, __classPrivateFieldGet(this, _BetaToolRunner_options, "f")), "f");
            yield __classPrivateFieldGet(this, _BetaToolRunner_message, "f");
          }
          const isCompacted = await __classPrivateFieldGet(this, _BetaToolRunner_instances, "m", _BetaToolRunner_checkAndCompact).call(this);
          if (!isCompacted) {
            if (!__classPrivateFieldGet(this, _BetaToolRunner_mutated, "f")) {
              const message = await __classPrivateFieldGet(this, _BetaToolRunner_message, "f");
              __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages.push({ role: message.role, content: message.content });
              if (message.stop_reason === "refusal") {
                break;
              }
            }
            const toolMessage = await __classPrivateFieldGet(this, _BetaToolRunner_instances, "m", _BetaToolRunner_generateToolResponse).call(this, __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages.at(-1));
            if (toolMessage) {
              __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params.messages.push(toolMessage);
            } else if (!__classPrivateFieldGet(this, _BetaToolRunner_mutated, "f")) {
              break;
            }
          }
        } finally {
          if (stream) {
            stream.abort();
          }
        }
      }
      if (!__classPrivateFieldGet(this, _BetaToolRunner_message, "f")) {
        throw new AnthropicError("ToolRunner concluded without a message from the server");
      }
      __classPrivateFieldGet(this, _BetaToolRunner_completion, "f").resolve(await __classPrivateFieldGet(this, _BetaToolRunner_message, "f"));
    } catch (error) {
      __classPrivateFieldSet(this, _BetaToolRunner_consumed, false, "f");
      __classPrivateFieldGet(this, _BetaToolRunner_completion, "f").promise.catch(() => {
      });
      __classPrivateFieldGet(this, _BetaToolRunner_completion, "f").reject(error);
      __classPrivateFieldSet(this, _BetaToolRunner_completion, promiseWithResolvers(), "f");
      throw error;
    }
  }
  setMessagesParams(paramsOrMutator) {
    if (typeof paramsOrMutator === "function") {
      __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params = paramsOrMutator(__classPrivateFieldGet(this, _BetaToolRunner_state, "f").params);
    } else {
      __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params = paramsOrMutator;
    }
    __classPrivateFieldSet(this, _BetaToolRunner_mutated, true, "f");
    __classPrivateFieldSet(this, _BetaToolRunner_toolResponse, void 0, "f");
  }
  setRequestOptions(optionsOrMutator) {
    if (typeof optionsOrMutator === "function") {
      __classPrivateFieldSet(this, _BetaToolRunner_options, optionsOrMutator(__classPrivateFieldGet(this, _BetaToolRunner_options, "f")), "f");
    } else {
      __classPrivateFieldSet(this, _BetaToolRunner_options, { ...__classPrivateFieldGet(this, _BetaToolRunner_options, "f"), ...optionsOrMutator }, "f");
    }
  }
  /**
   * Get the tool response for the last message from the assistant.
   * Avoids redundant tool executions by caching results.
   *
   * @returns A promise that resolves to a BetaMessageParam containing tool results, or null if no tools need to be executed
   *
   * @example
   * const toolResponse = await runner.generateToolResponse();
   * if (toolResponse) {
   *   console.log('Tool results:', toolResponse.content);
   * }
   */
  async generateToolResponse(signal = __classPrivateFieldGet(this, _BetaToolRunner_options, "f").signal) {
    const message = await __classPrivateFieldGet(this, _BetaToolRunner_message, "f") ?? this.params.messages.at(-1);
    if (!message) {
      return null;
    }
    return __classPrivateFieldGet(this, _BetaToolRunner_instances, "m", _BetaToolRunner_generateToolResponse).call(this, message, signal);
  }
  /**
   * Wait for the async iterator to complete. This works even if the async iterator hasn't yet started, and
   * will wait for an instance to start and go to completion.
   *
   * @returns A promise that resolves to the final BetaMessage when the iterator completes
   *
   * @example
   * // Start consuming the iterator
   * for await (const message of runner) {
   *   console.log('Message:', message.content);
   * }
   *
   * // Meanwhile, wait for completion from another part of the code
   * const finalMessage = await runner.done();
   * console.log('Final response:', finalMessage.content);
   */
  done() {
    return __classPrivateFieldGet(this, _BetaToolRunner_completion, "f").promise;
  }
  /**
   * Returns a promise indicating that the stream is done. Unlike .done(), this will eagerly read the stream:
   * * If the iterator has not been consumed, consume the entire iterator and return the final message from the
   * assistant.
   * * If the iterator has been consumed, waits for it to complete and returns the final message.
   *
   * @returns A promise that resolves to the final BetaMessage from the conversation
   * @throws {AnthropicError} If no messages were processed during the conversation
   *
   * @example
   * const finalMessage = await runner.runUntilDone();
   * console.log('Final response:', finalMessage.content);
   */
  async runUntilDone() {
    if (!__classPrivateFieldGet(this, _BetaToolRunner_consumed, "f")) {
      for await (const _ of this) {
      }
    }
    return this.done();
  }
  /**
   * Get the current parameters being used by the ToolRunner.
   *
   * @returns A readonly view of the current ToolRunnerParams
   *
   * @example
   * const currentParams = runner.params;
   * console.log('Current model:', currentParams.model);
   * console.log('Message count:', currentParams.messages.length);
   */
  get params() {
    return __classPrivateFieldGet(this, _BetaToolRunner_state, "f").params;
  }
  /**
   * Add one or more messages to the conversation history.
   *
   * @param messages - One or more BetaMessageParam objects to add to the conversation
   *
   * @example
   * runner.pushMessages(
   *   { role: 'user', content: 'Also, what about the weather in NYC?' }
   * );
   *
   * @example
   * // Adding multiple messages
   * runner.pushMessages(
   *   { role: 'user', content: 'What about NYC?' },
   *   { role: 'user', content: 'And Boston?' }
   * );
   */
  pushMessages(...messages) {
    this.setMessagesParams((params) => ({
      ...params,
      messages: [...params.messages, ...messages]
    }));
  }
  /**
   * Makes the ToolRunner directly awaitable, equivalent to calling .runUntilDone()
   * This allows using `await runner` instead of `await runner.runUntilDone()`
   */
  then(onfulfilled, onrejected) {
    return this.runUntilDone().then(onfulfilled, onrejected);
  }
};
_BetaToolRunner_generateToolResponse = async function _BetaToolRunner_generateToolResponse2(lastMessage, signal = __classPrivateFieldGet(this, _BetaToolRunner_options, "f").signal) {
  if (__classPrivateFieldGet(this, _BetaToolRunner_toolResponse, "f") !== void 0) {
    return __classPrivateFieldGet(this, _BetaToolRunner_toolResponse, "f");
  }
  __classPrivateFieldSet(this, _BetaToolRunner_toolResponse, generateToolResponse(__classPrivateFieldGet(this, _BetaToolRunner_state, "f").params, lastMessage, {
    ...__classPrivateFieldGet(this, _BetaToolRunner_options, "f"),
    signal
  }), "f");
  return __classPrivateFieldGet(this, _BetaToolRunner_toolResponse, "f");
};
async function generateToolResponse(params, lastMessage = params.messages.at(-1), requestOptions) {
  if (!lastMessage || lastMessage.role !== "assistant" || !lastMessage.content || typeof lastMessage.content === "string") {
    return null;
  }
  const toolUseBlocks = lastMessage.content.filter((content) => content.type === "tool_use");
  if (toolUseBlocks.length === 0) {
    return null;
  }
  const toolResults = await Promise.all(toolUseBlocks.map(async (toolUse) => {
    const tool = params.tools.find((t) => ("name" in t ? t.name : t.mcp_server_name) === toolUse.name);
    if (!tool || !("run" in tool)) {
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error: Tool '${toolUse.name}' not found`,
        is_error: true
      };
    }
    try {
      let input = toolUse.input;
      if ("parse" in tool && tool.parse) {
        input = tool.parse(input);
      }
      const result = await tool.run(input, {
        toolUse,
        toolUseBlock: toolUse,
        signal: requestOptions?.signal
      });
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result
      };
    } catch (error) {
      return {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: error instanceof ToolError ? error.content : `Error: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true
      };
    }
  }));
  return {
    role: "user",
    content: toolResults
  };
}

// node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.mjs
var DEPRECATED_MODELS = {
  "claude-1.3": "November 6th, 2024",
  "claude-1.3-100k": "November 6th, 2024",
  "claude-instant-1.1": "November 6th, 2024",
  "claude-instant-1.1-100k": "November 6th, 2024",
  "claude-instant-1.2": "November 6th, 2024",
  "claude-3-sonnet-20240229": "July 21st, 2025",
  "claude-3-opus-20240229": "January 5th, 2026",
  "claude-2.1": "July 21st, 2025",
  "claude-2.0": "July 21st, 2025",
  "claude-3-7-sonnet-latest": "February 19th, 2026",
  "claude-3-7-sonnet-20250219": "February 19th, 2026",
  "claude-3-5-haiku-latest": "February 19th, 2026",
  "claude-3-5-haiku-20241022": "February 19th, 2026",
  "claude-opus-4-0": "June 15th, 2026",
  "claude-opus-4-20250514": "June 15th, 2026",
  "claude-sonnet-4-0": "June 15th, 2026",
  "claude-sonnet-4-20250514": "June 15th, 2026",
  "claude-opus-4-1": "August 5th, 2026",
  "claude-opus-4-1-20250805": "August 5th, 2026",
  "claude-mythos-preview": "June 30th, 2026"
};
var MODELS_TO_WARN_WITH_THINKING_ENABLED = ["claude-mythos-preview", "claude-opus-4-6"];
var Messages = class extends APIResource {
  constructor() {
    super(...arguments);
    this.batches = new Batches(this._client);
  }
  create(params, options) {
    const modifiedParams = transformOutputFormat(params);
    const { betas, user_profile_id, ...body } = modifiedParams;
    if (body.model in DEPRECATED_MODELS) {
      console.warn(`The model '${body.model}' is deprecated and will reach end-of-life on ${DEPRECATED_MODELS[body.model]}
Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`);
    }
    if (MODELS_TO_WARN_WITH_THINKING_ENABLED.includes(body.model) && body.thinking && body.thinking.type === "enabled") {
      console.warn(`Using Claude with ${body.model} and 'thinking.type=enabled' is deprecated. Use 'thinking.type=adaptive' instead which results in better model performance in our testing: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`);
    }
    let timeout = this._client._options.timeout;
    if (!body.stream && timeout == null) {
      const maxNonstreamingTokens = MODEL_NONSTREAMING_TOKENS[body.model] ?? void 0;
      timeout = this._client.calculateNonstreamingTimeout(body.max_tokens, maxNonstreamingTokens);
    }
    const helperHeader2 = stainlessHelperHeader(body.tools, body.messages);
    return this._client.post("/v1/messages?beta=true", {
      body,
      timeout: timeout ?? 6e5,
      ...options,
      headers: buildHeaders([
        {
          ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : void 0,
          ...user_profile_id != null ? { "anthropic-user-profile-id": user_profile_id } : void 0
        },
        helperHeader2,
        options?.headers
      ]),
      stream: modifiedParams.stream ?? false
    });
  }
  /**
   * Send a structured list of input messages with text and/or image content, along with an expected `output_format` and
   * the response will be automatically parsed and available in the `parsed_output` property of the message.
   *
   * @example
   * ```ts
   * const message = await client.beta.messages.parse({
   *   model: 'claude-3-5-sonnet-20241022',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'What is 2+2?' }],
   *   output_format: zodOutputFormat(z.object({ answer: z.number() }), 'math'),
   * });
   *
   * console.log(message.parsed_output?.answer); // 4
   * ```
   */
  parse(params, options) {
    options = {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...params.betas ?? [], "structured-outputs-2025-12-15"].toString() },
        options?.headers
      ])
    };
    return this.create(params, options).then((message) => parseBetaMessage(message, params, { logger: this._client.logger ?? console }));
  }
  /**
   * Create a Message stream
   */
  stream(body, options) {
    return BetaMessageStream.createMessage(this, body, options);
  }
  /**
   * Count the number of tokens in a Message.
   *
   * The Token Count API can be used to count the number of tokens in a Message,
   * including tools, images, and documents, without creating it.
   *
   * Learn more about token counting in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/token-counting)
   *
   * @example
   * ```ts
   * const betaMessageTokensCount =
   *   await client.beta.messages.countTokens({
   *     messages: [{ content: 'Hello, world', role: 'user' }],
   *     model: 'claude-opus-4-6',
   *   });
   * ```
   */
  countTokens(params, options) {
    const modifiedParams = transformOutputFormat(params);
    const { betas, user_profile_id, ...body } = modifiedParams;
    return this._client.post("/v1/messages/count_tokens?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        {
          "anthropic-beta": [...betas ?? [], "token-counting-2024-11-01"].toString(),
          ...user_profile_id != null ? { "anthropic-user-profile-id": user_profile_id } : void 0
        },
        options?.headers
      ])
    });
  }
  toolRunner(body, options) {
    return new BetaToolRunner(this._client, body, options);
  }
};
function transformOutputFormat(params) {
  if (!params.output_format) {
    return params;
  }
  if (params.output_config?.format) {
    throw new AnthropicError("Both output_format and output_config.format were provided. Please use only output_config.format (output_format is deprecated).");
  }
  const { output_format, ...rest } = params;
  return {
    ...rest,
    output_config: {
      ...params.output_config,
      format: output_format
    }
  };
}
Messages.Batches = Batches;
Messages.BetaToolRunner = BetaToolRunner;
Messages.ToolError = ToolError;

// node_modules/@anthropic-ai/sdk/resources/beta/sessions/events.mjs
var Events = class extends APIResource {
  /**
   * List Events
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSessionEvent of client.beta.sessions.events.list(
   *   'sesn_011CZkZAtmR3yMPDzynEDxu7',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(sessionID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/v1/sessions/${sessionID}/events?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Send Events
   *
   * @example
   * ```ts
   * const betaManagedAgentsSendSessionEvents =
   *   await client.beta.sessions.events.send(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *     {
   *       events: [
   *         {
   *           content: [
   *             {
   *               text: 'Where is my order #1234?',
   *               type: 'text',
   *             },
   *           ],
   *           type: 'user.message',
   *         },
   *       ],
   *     },
   *   );
   * ```
   */
  send(sessionID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/sessions/${sessionID}/events?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Stream Events
   *
   * @example
   * ```ts
   * const betaManagedAgentsStreamSessionEvents =
   *   await client.beta.sessions.events.stream(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  stream(sessionID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.get(path`/v1/sessions/${sessionID}/events/stream?beta=true`, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ]),
      stream: true
    });
  }
  /**
   * Attach to a session and dispatch every incoming `agent.tool_use` and
   * `agent.custom_tool_use` event to a local tool registry, sending the matching
   * result back (`user.tool_result` / `user.custom_tool_result`). The
   * sessions-side counterpart to `client.beta.messages.toolRunner`: yields one
   * entry per completed tool call so callers can observe each dispatch (and
   * `break` to abort cleanly).
   *
   * @example
   * ```ts
   * import { betaAgentToolset20260401 } from '@anthropic-ai/sdk/tools/agent-toolset/node';
   *
   * for await (const call of client.beta.sessions.events.toolRunner(work.data.id, {
   *   tools: [...betaAgentToolset20260401({ workdir }), myTool],
   * })) {
   *   console.log(`${call.name} -> ${call.isError ? 'error' : 'ok'}`);
   * }
   * ```
   */
  toolRunner(sessionID, opts) {
    return new SessionToolRunner(sessionID, { ...opts, client: this._client });
  }
};
Events.SessionToolRunner = SessionToolRunner;

// node_modules/@anthropic-ai/sdk/resources/beta/sessions/resources.mjs
var Resources = class extends APIResource {
  /**
   * Get Session Resource
   *
   * @example
   * ```ts
   * const resource =
   *   await client.beta.sessions.resources.retrieve(
   *     'sesrsc_011CZkZBJq5dWxk9fVLNcPht',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  retrieve(resourceID, params, options) {
    const { session_id, betas } = params;
    return this._client.get(path`/v1/sessions/${session_id}/resources/${resourceID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update Session Resource
   *
   * @example
   * ```ts
   * const resource =
   *   await client.beta.sessions.resources.update(
   *     'sesrsc_011CZkZBJq5dWxk9fVLNcPht',
   *     {
   *       session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *       authorization_token: 'ghp_exampletoken',
   *     },
   *   );
   * ```
   */
  update(resourceID, params, options) {
    const { session_id, betas, ...body } = params;
    return this._client.post(path`/v1/sessions/${session_id}/resources/${resourceID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Session Resources
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSessionResource of client.beta.sessions.resources.list(
   *   'sesn_011CZkZAtmR3yMPDzynEDxu7',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(sessionID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/v1/sessions/${sessionID}/resources?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete Session Resource
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeleteSessionResource =
   *   await client.beta.sessions.resources.delete(
   *     'sesrsc_011CZkZBJq5dWxk9fVLNcPht',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  delete(resourceID, params, options) {
    const { session_id, betas } = params;
    return this._client.delete(path`/v1/sessions/${session_id}/resources/${resourceID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Add Session Resource
   *
   * @example
   * ```ts
   * const betaManagedAgentsFileResource =
   *   await client.beta.sessions.resources.add(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *     {
   *       file_id: 'file_011CNha8iCJcU1wXNR6q4V8w',
   *       type: 'file',
   *     },
   *   );
   * ```
   */
  add(sessionID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/sessions/${sessionID}/resources?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/sessions/threads/events.mjs
var Events2 = class extends APIResource {
  /**
   * List Session Thread Events
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSessionEvent of client.beta.sessions.threads.events.list(
   *   'sthr_011CZkZVWa6oIjw0rgXZpnBt',
   *   { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(threadID, params, options) {
    const { session_id, betas, ...query } = params;
    return this._client.getAPIList(path`/v1/sessions/${session_id}/threads/${threadID}/events?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Stream Session Thread Events
   *
   * @example
   * ```ts
   * const betaManagedAgentsStreamSessionThreadEvents =
   *   await client.beta.sessions.threads.events.stream(
   *     'sthr_011CZkZVWa6oIjw0rgXZpnBt',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  stream(threadID, params, options) {
    const { session_id, betas } = params;
    return this._client.get(path`/v1/sessions/${session_id}/threads/${threadID}/stream?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ]),
      stream: true
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/sessions/threads/threads.mjs
var Threads = class extends APIResource {
  constructor() {
    super(...arguments);
    this.events = new Events2(this._client);
  }
  /**
   * Get Session Thread
   *
   * @example
   * ```ts
   * const betaManagedAgentsSessionThread =
   *   await client.beta.sessions.threads.retrieve(
   *     'sthr_011CZkZVWa6oIjw0rgXZpnBt',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  retrieve(threadID, params, options) {
    const { session_id, betas } = params;
    return this._client.get(path`/v1/sessions/${session_id}/threads/${threadID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Session Threads
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSessionThread of client.beta.sessions.threads.list(
   *   'sesn_011CZkZAtmR3yMPDzynEDxu7',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(sessionID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/v1/sessions/${sessionID}/threads?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Archive Session Thread
   *
   * @example
   * ```ts
   * const betaManagedAgentsSessionThread =
   *   await client.beta.sessions.threads.archive(
   *     'sthr_011CZkZVWa6oIjw0rgXZpnBt',
   *     { session_id: 'sesn_011CZkZAtmR3yMPDzynEDxu7' },
   *   );
   * ```
   */
  archive(threadID, params, options) {
    const { session_id, betas } = params;
    return this._client.post(path`/v1/sessions/${session_id}/threads/${threadID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};
Threads.Events = Events2;

// node_modules/@anthropic-ai/sdk/resources/beta/sessions/sessions.mjs
var Sessions = class extends APIResource {
  constructor() {
    super(...arguments);
    this.events = new Events(this._client);
    this.resources = new Resources(this._client);
    this.threads = new Threads(this._client);
  }
  /**
   * Create Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsSession =
   *   await client.beta.sessions.create({
   *     agent: 'agent_011CZkYpogX7uDKUyvBTophP',
   *     environment_id: 'env_011CZkZ9X2dpNyB7HsEFoRfW',
   *   });
   * ```
   */
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/sessions?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Get Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsSession =
   *   await client.beta.sessions.retrieve(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  retrieve(sessionID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/sessions/${sessionID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsSession =
   *   await client.beta.sessions.update(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  update(sessionID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/sessions/${sessionID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Sessions
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsSession of client.beta.sessions.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/sessions?beta=true", BidirectionalPageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedSession =
   *   await client.beta.sessions.delete(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  delete(sessionID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/sessions/${sessionID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Archive Session
   *
   * @example
   * ```ts
   * const betaManagedAgentsSession =
   *   await client.beta.sessions.archive(
   *     'sesn_011CZkZAtmR3yMPDzynEDxu7',
   *   );
   * ```
   */
  archive(sessionID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/sessions/${sessionID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};
Sessions.Events = Events;
Sessions.Resources = Resources;
Sessions.Threads = Threads;

// node_modules/@anthropic-ai/sdk/resources/beta/skills/versions.mjs
var Versions2 = class extends APIResource {
  /**
   * Create Skill Version
   *
   * @example
   * ```ts
   * const version = await client.beta.skills.versions.create(
   *   'skill_id',
   *   { files: [fs.createReadStream('path/to/file')] },
   * );
   * ```
   */
  create(skillID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/skills/${skillID}/versions?beta=true`, multipartFormRequestOptions({
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
        options?.headers
      ])
    }, this._client, false));
  }
  /**
   * Get Skill Version
   *
   * @example
   * ```ts
   * const version = await client.beta.skills.versions.retrieve(
   *   'version',
   *   { skill_id: 'skill_id' },
   * );
   * ```
   */
  retrieve(version, params, options) {
    const { skill_id, betas } = params;
    return this._client.get(path`/v1/skills/${skill_id}/versions/${version}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Skill Versions
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const versionListResponse of client.beta.skills.versions.list(
   *   'skill_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(skillID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/v1/skills/${skillID}/versions?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete Skill Version
   *
   * @example
   * ```ts
   * const version = await client.beta.skills.versions.delete(
   *   'version',
   *   { skill_id: 'skill_id' },
   * );
   * ```
   */
  delete(version, params, options) {
    const { skill_id, betas } = params;
    return this._client.delete(path`/v1/skills/${skill_id}/versions/${version}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Download a skill version's content as a zip archive.
   *
   * @example
   * ```ts
   * const response = await client.beta.skills.versions.download(
   *   'version',
   *   { skill_id: 'skill_id' },
   * );
   *
   * const content = await response.blob();
   * console.log(content);
   * ```
   */
  download(version, params, options) {
    const { skill_id, betas } = params;
    return this._client.get(path`/v1/skills/${skill_id}/versions/${version}/content?beta=true`, {
      ...options,
      headers: buildHeaders([
        {
          "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString(),
          Accept: "application/binary"
        },
        options?.headers
      ]),
      __binaryResponse: true
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/skills/skills.mjs
var Skills = class extends APIResource {
  constructor() {
    super(...arguments);
    this.versions = new Versions2(this._client);
  }
  /**
   * Create Skill
   *
   * @example
   * ```ts
   * const skill = await client.beta.skills.create({
   *   files: [fs.createReadStream('path/to/file')],
   * });
   * ```
   */
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/skills?beta=true", multipartFormRequestOptions({
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
        options?.headers
      ])
    }, this._client, false));
  }
  /**
   * Get Skill
   *
   * @example
   * ```ts
   * const skill = await client.beta.skills.retrieve('skill_id');
   * ```
   */
  retrieve(skillID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/skills/${skillID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Skills
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const skillListResponse of client.beta.skills.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/skills?beta=true", PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete Skill
   *
   * @example
   * ```ts
   * const skill = await client.beta.skills.delete('skill_id');
   * ```
   */
  delete(skillID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/skills/${skillID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "skills-2025-10-02"].toString() },
        options?.headers
      ])
    });
  }
};
Skills.Versions = Versions2;

// node_modules/@anthropic-ai/sdk/resources/beta/vaults/credentials.mjs
var Credentials = class extends APIResource {
  /**
   * Create Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.create(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *     {
   *       auth: {
   *         token: 'bearer_exampletoken',
   *         mcp_server_url:
   *           'https://example-server.modelcontextprotocol.io/sse',
   *         type: 'static_bearer',
   *       },
   *     },
   *   );
   * ```
   */
  create(vaultID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/vaults/${vaultID}/credentials?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Get Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.retrieve(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  retrieve(credentialID, params, options) {
    const { vault_id, betas } = params;
    return this._client.get(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.update(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  update(credentialID, params, options) {
    const { vault_id, betas, ...body } = params;
    return this._client.post(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Credentials
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsCredential of client.beta.vaults.credentials.list(
   *   'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(vaultID, params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList(path`/v1/vaults/${vaultID}/credentials?beta=true`, PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedCredential =
   *   await client.beta.vaults.credentials.delete(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  delete(credentialID, params, options) {
    const { vault_id, betas } = params;
    return this._client.delete(path`/v1/vaults/${vault_id}/credentials/${credentialID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Archive Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredential =
   *   await client.beta.vaults.credentials.archive(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  archive(credentialID, params, options) {
    const { vault_id, betas } = params;
    return this._client.post(path`/v1/vaults/${vault_id}/credentials/${credentialID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Validate Credential
   *
   * @example
   * ```ts
   * const betaManagedAgentsCredentialValidation =
   *   await client.beta.vaults.credentials.mcpOAuthValidate(
   *     'vcrd_011CZkZEMt8gZan2iYOQfSkw',
   *     { vault_id: 'vlt_011CZkZDLs7fYzm1hXNPeRjv' },
   *   );
   * ```
   */
  mcpOAuthValidate(credentialID, params, options) {
    const { vault_id, betas } = params;
    return this._client.post(path`/v1/vaults/${vault_id}/credentials/${credentialID}/mcp_oauth_validate?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/resources/beta/vaults/vaults.mjs
var Vaults = class extends APIResource {
  constructor() {
    super(...arguments);
    this.credentials = new Credentials(this._client);
  }
  /**
   * Create Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsVault =
   *   await client.beta.vaults.create({
   *     display_name: 'Example vault',
   *   });
   * ```
   */
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/vaults?beta=true", {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Get Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsVault =
   *   await client.beta.vaults.retrieve(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *   );
   * ```
   */
  retrieve(vaultID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/vaults/${vaultID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Update Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsVault =
   *   await client.beta.vaults.update(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *   );
   * ```
   */
  update(vaultID, params, options) {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/vaults/${vaultID}?beta=true`, {
      body,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * List Vaults
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaManagedAgentsVault of client.beta.vaults.list()) {
   *   // ...
   * }
   * ```
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/vaults?beta=true", PageCursor, {
      query,
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Delete Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsDeletedVault =
   *   await client.beta.vaults.delete(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *   );
   * ```
   */
  delete(vaultID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/vaults/${vaultID}?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
  /**
   * Archive Vault
   *
   * @example
   * ```ts
   * const betaManagedAgentsVault =
   *   await client.beta.vaults.archive(
   *     'vlt_011CZkZDLs7fYzm1hXNPeRjv',
   *   );
   * ```
   */
  archive(vaultID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.post(path`/v1/vaults/${vaultID}/archive?beta=true`, {
      ...options,
      headers: buildHeaders([
        { "anthropic-beta": [...betas ?? [], "managed-agents-2026-04-01"].toString() },
        options?.headers
      ])
    });
  }
};
Vaults.Credentials = Credentials;

// node_modules/@anthropic-ai/sdk/resources/beta/beta.mjs
var Beta = class extends APIResource {
  constructor() {
    super(...arguments);
    this.models = new Models(this._client);
    this.messages = new Messages(this._client);
    this.agents = new Agents(this._client);
    this.environments = new Environments(this._client);
    this.sessions = new Sessions(this._client);
    this.deployments = new Deployments(this._client);
    this.deploymentRuns = new DeploymentRuns(this._client);
    this.vaults = new Vaults(this._client);
    this.memoryStores = new MemoryStores(this._client);
    this.files = new Files(this._client);
    this.skills = new Skills(this._client);
    this.webhooks = new Webhooks(this._client);
    this.userProfiles = new UserProfiles(this._client);
  }
};
Beta.Models = Models;
Beta.Messages = Messages;
Beta.Agents = Agents;
Beta.Environments = Environments;
Beta.Sessions = Sessions;
Beta.Deployments = Deployments;
Beta.DeploymentRuns = DeploymentRuns;
Beta.Vaults = Vaults;
Beta.MemoryStores = MemoryStores;
Beta.Files = Files;
Beta.Skills = Skills;
Beta.Webhooks = Webhooks;
Beta.UserProfiles = UserProfiles;

// node_modules/@anthropic-ai/sdk/resources/completions.mjs
var Completions = class extends APIResource {
  create(params, options) {
    const { betas, ...body } = params;
    return this._client.post("/v1/complete", {
      body,
      timeout: this._client._options.timeout ?? 6e5,
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : void 0 },
        options?.headers
      ]),
      stream: params.stream ?? false
    });
  }
};

// node_modules/@anthropic-ai/sdk/lib/MessageStream.mjs
init_errors();

// node_modules/@anthropic-ai/sdk/lib/parser.mjs
init_error();
function getOutputFormat2(params) {
  return params?.output_config?.format;
}
function maybeParseMessage(message, params, opts) {
  const outputFormat = getOutputFormat2(params);
  if (!params || !("parse" in (outputFormat ?? {}))) {
    return {
      ...message,
      content: message.content.map((block) => {
        if (block.type === "text") {
          const parsedBlock = Object.defineProperty({ ...block }, "parsed_output", {
            value: null,
            enumerable: false
          });
          return parsedBlock;
        }
        return block;
      }),
      parsed_output: null
    };
  }
  return parseMessage(message, params, opts);
}
function parseMessage(message, params, opts) {
  let firstParsedOutput = null;
  const content = message.content.map((block) => {
    if (block.type === "text") {
      const parsedOutput = parseOutputFormat(params, block.text);
      if (firstParsedOutput === null) {
        firstParsedOutput = parsedOutput;
      }
      const parsedBlock = Object.defineProperty({ ...block }, "parsed_output", {
        value: parsedOutput,
        enumerable: false
      });
      return parsedBlock;
    }
    return block;
  });
  return {
    ...message,
    content,
    parsed_output: firstParsedOutput
  };
}
function parseOutputFormat(params, content) {
  const outputFormat = getOutputFormat2(params);
  if (outputFormat?.type !== "json_schema") {
    return null;
  }
  try {
    if ("parse" in outputFormat) {
      return outputFormat.parse(content);
    }
    return JSON.parse(content);
  } catch (error) {
    throw new AnthropicError(`Failed to parse structured output: ${error}`);
  }
}

// node_modules/@anthropic-ai/sdk/lib/MessageStream.mjs
var _MessageStream_instances;
var _MessageStream_currentMessageSnapshot;
var _MessageStream_params;
var _MessageStream_connectedPromise;
var _MessageStream_resolveConnectedPromise;
var _MessageStream_rejectConnectedPromise;
var _MessageStream_endPromise;
var _MessageStream_resolveEndPromise;
var _MessageStream_rejectEndPromise;
var _MessageStream_listeners;
var _MessageStream_ended;
var _MessageStream_errored;
var _MessageStream_aborted;
var _MessageStream_catchingPromiseCreated;
var _MessageStream_response;
var _MessageStream_request_id;
var _MessageStream_logger;
var _MessageStream_getFinalMessage;
var _MessageStream_getFinalText;
var _MessageStream_handleError;
var _MessageStream_beginRequest;
var _MessageStream_addStreamEvent;
var _MessageStream_endRequest;
var _MessageStream_accumulateMessage;
function tracksToolInput2(content) {
  return content.type === "tool_use" || content.type === "server_tool_use";
}
var MessageStream = class _MessageStream {
  constructor(params, opts) {
    _MessageStream_instances.add(this);
    this.messages = [];
    this.receivedMessages = [];
    _MessageStream_currentMessageSnapshot.set(this, void 0);
    _MessageStream_params.set(this, null);
    this.controller = new AbortController();
    _MessageStream_connectedPromise.set(this, void 0);
    _MessageStream_resolveConnectedPromise.set(this, () => {
    });
    _MessageStream_rejectConnectedPromise.set(this, () => {
    });
    _MessageStream_endPromise.set(this, void 0);
    _MessageStream_resolveEndPromise.set(this, () => {
    });
    _MessageStream_rejectEndPromise.set(this, () => {
    });
    _MessageStream_listeners.set(this, {});
    _MessageStream_ended.set(this, false);
    _MessageStream_errored.set(this, false);
    _MessageStream_aborted.set(this, false);
    _MessageStream_catchingPromiseCreated.set(this, false);
    _MessageStream_response.set(this, void 0);
    _MessageStream_request_id.set(this, void 0);
    _MessageStream_logger.set(this, void 0);
    _MessageStream_handleError.set(this, (error) => {
      __classPrivateFieldSet(this, _MessageStream_errored, true, "f");
      if (isAbortError(error)) {
        error = new APIUserAbortError();
      }
      if (error instanceof APIUserAbortError) {
        __classPrivateFieldSet(this, _MessageStream_aborted, true, "f");
        return this._emit("abort", error);
      }
      if (error instanceof AnthropicError) {
        return this._emit("error", error);
      }
      if (error instanceof Error) {
        const anthropicError = new AnthropicError(error.message);
        anthropicError.cause = error;
        return this._emit("error", anthropicError);
      }
      return this._emit("error", new AnthropicError(String(error)));
    });
    __classPrivateFieldSet(this, _MessageStream_connectedPromise, new Promise((resolve5, reject) => {
      __classPrivateFieldSet(this, _MessageStream_resolveConnectedPromise, resolve5, "f");
      __classPrivateFieldSet(this, _MessageStream_rejectConnectedPromise, reject, "f");
    }), "f");
    __classPrivateFieldSet(this, _MessageStream_endPromise, new Promise((resolve5, reject) => {
      __classPrivateFieldSet(this, _MessageStream_resolveEndPromise, resolve5, "f");
      __classPrivateFieldSet(this, _MessageStream_rejectEndPromise, reject, "f");
    }), "f");
    __classPrivateFieldGet(this, _MessageStream_connectedPromise, "f").catch(() => {
    });
    __classPrivateFieldGet(this, _MessageStream_endPromise, "f").catch(() => {
    });
    __classPrivateFieldSet(this, _MessageStream_params, params, "f");
    __classPrivateFieldSet(this, _MessageStream_logger, opts?.logger ?? console, "f");
  }
  get response() {
    return __classPrivateFieldGet(this, _MessageStream_response, "f");
  }
  get request_id() {
    return __classPrivateFieldGet(this, _MessageStream_request_id, "f");
  }
  /**
   * Returns the `MessageStream` data, the raw `Response` instance and the ID of the request,
   * returned vie the `request-id` header which is useful for debugging requests and resporting
   * issues to Anthropic.
   *
   * This is the same as the `APIPromise.withResponse()` method.
   *
   * This method will raise an error if you created the stream using `MessageStream.fromReadableStream`
   * as no `Response` is available.
   */
  async withResponse() {
    __classPrivateFieldSet(this, _MessageStream_catchingPromiseCreated, true, "f");
    const response = await __classPrivateFieldGet(this, _MessageStream_connectedPromise, "f");
    if (!response) {
      throw new Error("Could not resolve a `Response` object");
    }
    return {
      data: this,
      response,
      request_id: response.headers.get("request-id")
    };
  }
  /**
   * Intended for use on the frontend, consuming a stream produced with
   * `.toReadableStream()` on the backend.
   *
   * Note that messages sent to the model do not appear in `.on('message')`
   * in this context.
   */
  static fromReadableStream(stream) {
    const runner = new _MessageStream(null);
    runner._run(() => runner._fromReadableStream(stream));
    return runner;
  }
  static createMessage(messages, params, options, { logger } = {}) {
    const runner = new _MessageStream(params, { logger });
    for (const message of params.messages) {
      runner._addMessageParam(message);
    }
    __classPrivateFieldSet(runner, _MessageStream_params, { ...params, stream: true }, "f");
    runner._run(() => runner._createMessage(messages, { ...params, stream: true }, { ...options, headers: { ...options?.headers, [STAINLESS_HELPER_METHOD_HEADER]: "stream" } }));
    return runner;
  }
  _run(executor) {
    executor().then(() => {
      this._emitFinal();
      this._emit("end");
    }, __classPrivateFieldGet(this, _MessageStream_handleError, "f"));
  }
  _addMessageParam(message) {
    this.messages.push(message);
  }
  _addMessage(message, emit = true) {
    this.receivedMessages.push(message);
    if (emit) {
      this._emit("message", message);
    }
  }
  async _createMessage(messages, params, options) {
    const signal = options?.signal;
    let abortHandler;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      abortHandler = this.controller.abort.bind(this.controller);
      signal.addEventListener("abort", abortHandler);
    }
    try {
      __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_beginRequest).call(this);
      const { response, data: stream } = await messages.create({ ...params, stream: true }, { ...options, signal: this.controller.signal }).withResponse();
      this._connected(response);
      for await (const event of stream) {
        __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_addStreamEvent).call(this, event);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError();
      }
      __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_endRequest).call(this);
    } finally {
      if (signal && abortHandler) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  }
  _connected(response) {
    if (this.ended)
      return;
    __classPrivateFieldSet(this, _MessageStream_response, response, "f");
    __classPrivateFieldSet(this, _MessageStream_request_id, response?.headers.get("request-id"), "f");
    __classPrivateFieldGet(this, _MessageStream_resolveConnectedPromise, "f").call(this, response);
    this._emit("connect");
  }
  get ended() {
    return __classPrivateFieldGet(this, _MessageStream_ended, "f");
  }
  get errored() {
    return __classPrivateFieldGet(this, _MessageStream_errored, "f");
  }
  get aborted() {
    return __classPrivateFieldGet(this, _MessageStream_aborted, "f");
  }
  abort() {
    this.controller.abort();
  }
  /**
   * Adds the listener function to the end of the listeners array for the event.
   * No checks are made to see if the listener has already been added. Multiple calls passing
   * the same combination of event and listener will result in the listener being added, and
   * called, multiple times.
   * @returns this MessageStream, so that calls can be chained
   */
  on(event, listener) {
    const listeners = __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] = []);
    listeners.push({ listener });
    return this;
  }
  /**
   * Removes the specified listener from the listener array for the event.
   * off() will remove, at most, one instance of a listener from the listener array. If any single
   * listener has been added multiple times to the listener array for the specified event, then
   * off() must be called multiple times to remove each instance.
   * @returns this MessageStream, so that calls can be chained
   */
  off(event, listener) {
    const listeners = __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event];
    if (!listeners)
      return this;
    const index = listeners.findIndex((l) => l.listener === listener);
    if (index >= 0)
      listeners.splice(index, 1);
    return this;
  }
  /**
   * Adds a one-time listener function for the event. The next time the event is triggered,
   * this listener is removed and then invoked.
   * @returns this MessageStream, so that calls can be chained
   */
  once(event, listener) {
    const listeners = __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] = []);
    listeners.push({ listener, once: true });
    return this;
  }
  /**
   * This is similar to `.once()`, but returns a Promise that resolves the next time
   * the event is triggered, instead of calling a listener callback.
   * @returns a Promise that resolves the next time given event is triggered,
   * or rejects if an error is emitted.  (If you request the 'error' event,
   * returns a promise that resolves with the error).
   *
   * Example:
   *
   *   const message = await stream.emitted('message') // rejects if the stream errors
   */
  emitted(event) {
    return new Promise((resolve5, reject) => {
      __classPrivateFieldSet(this, _MessageStream_catchingPromiseCreated, true, "f");
      if (event !== "error")
        this.once("error", reject);
      this.once(event, resolve5);
    });
  }
  async done() {
    __classPrivateFieldSet(this, _MessageStream_catchingPromiseCreated, true, "f");
    await __classPrivateFieldGet(this, _MessageStream_endPromise, "f");
  }
  get currentMessage() {
    return __classPrivateFieldGet(this, _MessageStream_currentMessageSnapshot, "f");
  }
  /**
   * @returns a promise that resolves with the the final assistant Message response,
   * or rejects if an error occurred or the stream ended prematurely without producing a Message.
   * If structured outputs were used, this will be a ParsedMessage with a `parsed_output` field.
   */
  async finalMessage() {
    await this.done();
    return __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_getFinalMessage).call(this);
  }
  /**
   * @returns a promise that resolves with the the final assistant Message's text response, concatenated
   * together if there are more than one text blocks.
   * Rejects if an error occurred or the stream ended prematurely without producing a Message.
   */
  async finalText() {
    await this.done();
    return __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_getFinalText).call(this);
  }
  _emit(event, ...args) {
    if (__classPrivateFieldGet(this, _MessageStream_ended, "f"))
      return;
    if (event === "end") {
      __classPrivateFieldSet(this, _MessageStream_ended, true, "f");
      __classPrivateFieldGet(this, _MessageStream_resolveEndPromise, "f").call(this);
    }
    const listeners = __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event];
    if (listeners) {
      __classPrivateFieldGet(this, _MessageStream_listeners, "f")[event] = listeners.filter((l) => !l.once);
      listeners.forEach(({ listener }) => listener(...args));
    }
    if (event === "abort") {
      const error = args[0];
      if (!__classPrivateFieldGet(this, _MessageStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error);
      }
      __classPrivateFieldGet(this, _MessageStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet(this, _MessageStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
      return;
    }
    if (event === "error") {
      const error = args[0];
      if (!__classPrivateFieldGet(this, _MessageStream_catchingPromiseCreated, "f") && !listeners?.length) {
        Promise.reject(error);
      }
      __classPrivateFieldGet(this, _MessageStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet(this, _MessageStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
    }
  }
  _emitFinal() {
    const finalMessage = this.receivedMessages.at(-1);
    if (finalMessage) {
      this._emit("finalMessage", __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_getFinalMessage).call(this));
    }
  }
  async _fromReadableStream(readableStream, options) {
    const signal = options?.signal;
    let abortHandler;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      abortHandler = this.controller.abort.bind(this.controller);
      signal.addEventListener("abort", abortHandler);
    }
    try {
      __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_beginRequest).call(this);
      this._connected(null);
      const stream = Stream.fromReadableStream(readableStream, this.controller);
      for await (const event of stream) {
        __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_addStreamEvent).call(this, event);
      }
      if (stream.controller.signal?.aborted) {
        throw new APIUserAbortError();
      }
      __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_endRequest).call(this);
    } finally {
      if (signal && abortHandler) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  }
  [(_MessageStream_currentMessageSnapshot = /* @__PURE__ */ new WeakMap(), _MessageStream_params = /* @__PURE__ */ new WeakMap(), _MessageStream_connectedPromise = /* @__PURE__ */ new WeakMap(), _MessageStream_resolveConnectedPromise = /* @__PURE__ */ new WeakMap(), _MessageStream_rejectConnectedPromise = /* @__PURE__ */ new WeakMap(), _MessageStream_endPromise = /* @__PURE__ */ new WeakMap(), _MessageStream_resolveEndPromise = /* @__PURE__ */ new WeakMap(), _MessageStream_rejectEndPromise = /* @__PURE__ */ new WeakMap(), _MessageStream_listeners = /* @__PURE__ */ new WeakMap(), _MessageStream_ended = /* @__PURE__ */ new WeakMap(), _MessageStream_errored = /* @__PURE__ */ new WeakMap(), _MessageStream_aborted = /* @__PURE__ */ new WeakMap(), _MessageStream_catchingPromiseCreated = /* @__PURE__ */ new WeakMap(), _MessageStream_response = /* @__PURE__ */ new WeakMap(), _MessageStream_request_id = /* @__PURE__ */ new WeakMap(), _MessageStream_logger = /* @__PURE__ */ new WeakMap(), _MessageStream_handleError = /* @__PURE__ */ new WeakMap(), _MessageStream_instances = /* @__PURE__ */ new WeakSet(), _MessageStream_getFinalMessage = function _MessageStream_getFinalMessage2() {
    if (this.receivedMessages.length === 0) {
      throw new AnthropicError("stream ended without producing a Message with role=assistant");
    }
    return this.receivedMessages.at(-1);
  }, _MessageStream_getFinalText = function _MessageStream_getFinalText2() {
    if (this.receivedMessages.length === 0) {
      throw new AnthropicError("stream ended without producing a Message with role=assistant");
    }
    const textBlocks = this.receivedMessages.at(-1).content.filter((block) => block.type === "text").map((block) => block.text);
    if (textBlocks.length === 0) {
      throw new AnthropicError("stream ended without producing a content block with type=text");
    }
    return textBlocks.join(" ");
  }, _MessageStream_beginRequest = function _MessageStream_beginRequest2() {
    if (this.ended)
      return;
    __classPrivateFieldSet(this, _MessageStream_currentMessageSnapshot, void 0, "f");
  }, _MessageStream_addStreamEvent = function _MessageStream_addStreamEvent2(event) {
    if (this.ended)
      return;
    const messageSnapshot = __classPrivateFieldGet(this, _MessageStream_instances, "m", _MessageStream_accumulateMessage).call(this, event);
    this._emit("streamEvent", event, messageSnapshot);
    switch (event.type) {
      case "content_block_delta": {
        const content = messageSnapshot.content.at(-1);
        switch (event.delta.type) {
          case "text_delta": {
            if (content.type === "text") {
              this._emit("text", event.delta.text, content.text || "");
            }
            break;
          }
          case "citations_delta": {
            if (content.type === "text") {
              this._emit("citation", event.delta.citation, content.citations ?? []);
            }
            break;
          }
          case "input_json_delta": {
            if (tracksToolInput2(content) && __classPrivateFieldGet(this, _MessageStream_listeners, "f").inputJson?.length) {
              this._emit("inputJson", event.delta.partial_json, content.input);
            }
            break;
          }
          case "thinking_delta": {
            if (content.type === "thinking") {
              this._emit("thinking", event.delta.thinking, content.thinking);
            }
            break;
          }
          case "signature_delta": {
            if (content.type === "thinking") {
              this._emit("signature", content.signature);
            }
            break;
          }
          default:
            checkNever2(event.delta);
        }
        break;
      }
      case "message_stop": {
        this._addMessageParam(messageSnapshot);
        this._addMessage(maybeParseMessage(messageSnapshot, __classPrivateFieldGet(this, _MessageStream_params, "f"), { logger: __classPrivateFieldGet(this, _MessageStream_logger, "f") }), true);
        break;
      }
      case "content_block_stop": {
        this._emit("contentBlock", messageSnapshot.content.at(-1));
        break;
      }
      case "message_start": {
        __classPrivateFieldSet(this, _MessageStream_currentMessageSnapshot, messageSnapshot, "f");
        break;
      }
      case "content_block_start":
      case "message_delta":
        break;
    }
  }, _MessageStream_endRequest = function _MessageStream_endRequest2() {
    if (this.ended) {
      throw new AnthropicError(`stream has ended, this shouldn't happen`);
    }
    const snapshot = __classPrivateFieldGet(this, _MessageStream_currentMessageSnapshot, "f");
    if (!snapshot) {
      throw new AnthropicError(`request ended without sending any chunks`);
    }
    __classPrivateFieldSet(this, _MessageStream_currentMessageSnapshot, void 0, "f");
    return maybeParseMessage(snapshot, __classPrivateFieldGet(this, _MessageStream_params, "f"), { logger: __classPrivateFieldGet(this, _MessageStream_logger, "f") });
  }, _MessageStream_accumulateMessage = function _MessageStream_accumulateMessage2(event) {
    let snapshot = __classPrivateFieldGet(this, _MessageStream_currentMessageSnapshot, "f");
    if (event.type === "message_start") {
      if (snapshot) {
        throw new AnthropicError(`Unexpected event order, got ${event.type} before receiving "message_stop"`);
      }
      return event.message;
    }
    if (!snapshot) {
      throw new AnthropicError(`Unexpected event order, got ${event.type} before "message_start"`);
    }
    switch (event.type) {
      case "message_stop":
        return snapshot;
      case "message_delta":
        snapshot.stop_reason = event.delta.stop_reason;
        snapshot.stop_sequence = event.delta.stop_sequence;
        if (event.delta.stop_details != null) {
          snapshot.stop_details = event.delta.stop_details;
        }
        snapshot.usage.output_tokens = event.usage.output_tokens;
        if (event.usage.input_tokens != null) {
          snapshot.usage.input_tokens = event.usage.input_tokens;
        }
        if (event.usage.cache_creation_input_tokens != null) {
          snapshot.usage.cache_creation_input_tokens = event.usage.cache_creation_input_tokens;
        }
        if (event.usage.cache_read_input_tokens != null) {
          snapshot.usage.cache_read_input_tokens = event.usage.cache_read_input_tokens;
        }
        if (event.usage.server_tool_use != null) {
          snapshot.usage.server_tool_use = event.usage.server_tool_use;
        }
        return snapshot;
      case "content_block_start":
        snapshot.content.push({ ...event.content_block });
        return snapshot;
      case "content_block_delta": {
        const snapshotContent = snapshot.content.at(event.index);
        switch (event.delta.type) {
          case "text_delta": {
            if (snapshotContent?.type === "text") {
              snapshot.content[event.index] = {
                ...snapshotContent,
                text: (snapshotContent.text || "") + event.delta.text
              };
            }
            break;
          }
          case "citations_delta": {
            if (snapshotContent?.type === "text") {
              snapshot.content[event.index] = {
                ...snapshotContent,
                citations: [...snapshotContent.citations ?? [], event.delta.citation]
              };
            }
            break;
          }
          case "input_json_delta": {
            if (snapshotContent && tracksToolInput2(snapshotContent)) {
              const jsonBuf = (snapshotContent[JSON_BUF_PROPERTY] || "") + event.delta.partial_json;
              snapshot.content[event.index] = withLazyInput(snapshotContent, jsonBuf);
            }
            break;
          }
          case "thinking_delta": {
            if (snapshotContent?.type === "thinking") {
              snapshot.content[event.index] = {
                ...snapshotContent,
                thinking: snapshotContent.thinking + event.delta.thinking
              };
            }
            break;
          }
          case "signature_delta": {
            if (snapshotContent?.type === "thinking") {
              snapshot.content[event.index] = {
                ...snapshotContent,
                signature: event.delta.signature
              };
            }
            break;
          }
          default:
            checkNever2(event.delta);
        }
        return snapshot;
      }
      case "content_block_stop": {
        const snapshotContent = snapshot.content.at(event.index);
        if (snapshotContent && tracksToolInput2(snapshotContent) && JSON_BUF_PROPERTY in snapshotContent) {
          Object.defineProperty(snapshotContent, "input", {
            value: snapshotContent.input,
            enumerable: true,
            configurable: true,
            writable: true
          });
        }
        return snapshot;
      }
    }
  }, Symbol.asyncIterator)]() {
    const pushQueue = [];
    const readQueue = [];
    let done = false;
    this.on("streamEvent", (event) => {
      const reader = readQueue.shift();
      if (reader) {
        reader.resolve(event);
      } else {
        pushQueue.push(event);
      }
    });
    this.on("end", () => {
      done = true;
      for (const reader of readQueue) {
        reader.resolve(void 0);
      }
      readQueue.length = 0;
    });
    this.on("abort", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    this.on("error", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    return {
      next: async () => {
        if (!pushQueue.length) {
          if (done) {
            return { value: void 0, done: true };
          }
          return new Promise((resolve5, reject) => readQueue.push({ resolve: resolve5, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: void 0, done: true });
        }
        const chunk = pushQueue.shift();
        return { value: chunk, done: false };
      },
      return: async () => {
        this.abort();
        return { value: void 0, done: true };
      }
    };
  }
  toReadableStream() {
    const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
    return stream.toReadableStream();
  }
};
function checkNever2(x) {
}

// node_modules/@anthropic-ai/sdk/resources/messages/batches.mjs
var Batches2 = class extends APIResource {
  /**
   * Send a batch of Message creation requests.
   *
   * The Message Batches API can be used to process multiple Messages API requests at
   * once. Once a Message Batch is created, it begins processing immediately. Batches
   * can take up to 24 hours to complete.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const messageBatch = await client.messages.batches.create({
   *   requests: [
   *     {
   *       custom_id: 'my-custom-id-1',
   *       params: {
   *         max_tokens: 1024,
   *         messages: [
   *           { content: 'Hello, world', role: 'user' },
   *         ],
   *         model: 'claude-opus-4-6',
   *       },
   *     },
   *   ],
   * });
   * ```
   */
  create(params, options) {
    const { user_profile_id, ...body } = params;
    return this._client.post("/v1/messages/batches", {
      body,
      ...options,
      headers: buildHeaders([
        { ...user_profile_id != null ? { "anthropic-user-profile-id": user_profile_id } : void 0 },
        options?.headers
      ])
    });
  }
  /**
   * This endpoint is idempotent and can be used to poll for Message Batch
   * completion. To access the results of a Message Batch, make a request to the
   * `results_url` field in the response.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const messageBatch = await client.messages.batches.retrieve(
   *   'message_batch_id',
   * );
   * ```
   */
  retrieve(messageBatchID, options) {
    return this._client.get(path`/v1/messages/batches/${messageBatchID}`, options);
  }
  /**
   * List all Message Batches within a Workspace. Most recently created batches are
   * returned first.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const messageBatch of client.messages.batches.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/v1/messages/batches", Page, { query, ...options });
  }
  /**
   * Delete a Message Batch.
   *
   * Message Batches can only be deleted once they've finished processing. If you'd
   * like to delete an in-progress batch, you must first cancel it.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const deletedMessageBatch =
   *   await client.messages.batches.delete('message_batch_id');
   * ```
   */
  delete(messageBatchID, options) {
    return this._client.delete(path`/v1/messages/batches/${messageBatchID}`, options);
  }
  /**
   * Batches may be canceled any time before processing ends. Once cancellation is
   * initiated, the batch enters a `canceling` state, at which time the system may
   * complete any in-progress, non-interruptible requests before finalizing
   * cancellation.
   *
   * The number of canceled requests is specified in `request_counts`. To determine
   * which requests were canceled, check the individual results within the batch.
   * Note that cancellation may not result in any canceled requests if they were
   * non-interruptible.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const messageBatch = await client.messages.batches.cancel(
   *   'message_batch_id',
   * );
   * ```
   */
  cancel(messageBatchID, options) {
    return this._client.post(path`/v1/messages/batches/${messageBatchID}/cancel`, options);
  }
  /**
   * Streams the results of a Message Batch as a `.jsonl` file.
   *
   * Each line in the file is a JSON object containing the result of a single request
   * in the Message Batch. Results are not guaranteed to be in the same order as
   * requests. Use the `custom_id` field to match results to requests.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const messageBatchIndividualResponse =
   *   await client.messages.batches.results('message_batch_id');
   * ```
   */
  async results(messageBatchID, options) {
    const batch = await this.retrieve(messageBatchID);
    if (!batch.results_url) {
      throw new AnthropicError(`No batch \`results_url\`; Has it finished processing? ${batch.processing_status} - ${batch.id}`);
    }
    return this._client.get(batch.results_url, {
      ...options,
      headers: buildHeaders([{ Accept: "application/binary" }, options?.headers]),
      stream: true,
      __binaryResponse: true
    })._thenUnwrap((_, props) => JSONLDecoder.fromResponse(props.response, props.controller));
  }
};

// node_modules/@anthropic-ai/sdk/resources/messages/messages.mjs
var Messages2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.batches = new Batches2(this._client);
  }
  create(params, options) {
    const { user_profile_id, ...body } = params;
    if (body.model in DEPRECATED_MODELS2) {
      console.warn(`The model '${body.model}' is deprecated and will reach end-of-life on ${DEPRECATED_MODELS2[body.model]}
Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`);
    }
    if (MODELS_TO_WARN_WITH_THINKING_ENABLED2.includes(body.model) && body.thinking && body.thinking.type === "enabled") {
      console.warn(`Using Claude with ${body.model} and 'thinking.type=enabled' is deprecated. Use 'thinking.type=adaptive' instead which results in better model performance in our testing: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`);
    }
    let timeout = this._client._options.timeout;
    if (!body.stream && timeout == null) {
      const maxNonstreamingTokens = MODEL_NONSTREAMING_TOKENS[body.model] ?? void 0;
      timeout = this._client.calculateNonstreamingTimeout(body.max_tokens, maxNonstreamingTokens);
    }
    const helperHeader2 = stainlessHelperHeader(body.tools, body.messages);
    return this._client.post("/v1/messages", {
      body,
      timeout: timeout ?? 6e5,
      ...options,
      headers: buildHeaders([
        { ...user_profile_id != null ? { "anthropic-user-profile-id": user_profile_id } : void 0 },
        helperHeader2,
        options?.headers
      ]),
      stream: params.stream ?? false
    });
  }
  /**
   * Send a structured list of input messages with text and/or image content, along with an expected `output_config.format` and
   * the response will be automatically parsed and available in the `parsed_output` property of the message.
   *
   * @example
   * ```ts
   * const message = await client.messages.parse({
   *   model: 'claude-sonnet-4-5-20250929',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'What is 2+2?' }],
   *   output_config: {
   *     format: zodOutputFormat(z.object({ answer: z.number() })),
   *   },
   * });
   *
   * console.log(message.parsed_output?.answer); // 4
   * ```
   */
  parse(params, options) {
    return this.create(params, options).then((message) => parseMessage(message, params, { logger: this._client.logger ?? console }));
  }
  /**
   * Create a Message stream.
   *
   * If `output_config.format` is provided with a parseable format (like `zodOutputFormat()`),
   * the final message will include a `parsed_output` property with the parsed content.
   *
   * @example
   * ```ts
   * const stream = client.messages.stream({
   *   model: 'claude-sonnet-4-5-20250929',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'What is 2+2?' }],
   *   output_config: {
   *     format: zodOutputFormat(z.object({ answer: z.number() })),
   *   },
   * });
   *
   * const message = await stream.finalMessage();
   * console.log(message.parsed_output?.answer); // 4
   * ```
   */
  stream(body, options) {
    return MessageStream.createMessage(this, body, options, { logger: this._client.logger ?? console });
  }
  /**
   * Count the number of tokens in a Message.
   *
   * The Token Count API can be used to count the number of tokens in a Message,
   * including tools, images, and documents, without creating it.
   *
   * Learn more about token counting in our
   * [user guide](https://platform.claude.com/docs/en/build-with-claude/token-counting)
   *
   * @example
   * ```ts
   * const messageTokensCount =
   *   await client.messages.countTokens({
   *     messages: [{ content: 'Hello, world', role: 'user' }],
   *     model: 'claude-opus-4-6',
   *   });
   * ```
   */
  countTokens(params, options) {
    const { user_profile_id, ...body } = params;
    return this._client.post("/v1/messages/count_tokens", {
      body,
      ...options,
      headers: buildHeaders([
        { ...user_profile_id != null ? { "anthropic-user-profile-id": user_profile_id } : void 0 },
        options?.headers
      ])
    });
  }
};
var DEPRECATED_MODELS2 = {
  "claude-1.3": "November 6th, 2024",
  "claude-1.3-100k": "November 6th, 2024",
  "claude-instant-1.1": "November 6th, 2024",
  "claude-instant-1.1-100k": "November 6th, 2024",
  "claude-instant-1.2": "November 6th, 2024",
  "claude-3-sonnet-20240229": "July 21st, 2025",
  "claude-3-opus-20240229": "January 5th, 2026",
  "claude-2.1": "July 21st, 2025",
  "claude-2.0": "July 21st, 2025",
  "claude-3-7-sonnet-latest": "February 19th, 2026",
  "claude-3-7-sonnet-20250219": "February 19th, 2026",
  "claude-3-5-haiku-latest": "February 19th, 2026",
  "claude-3-5-haiku-20241022": "February 19th, 2026",
  "claude-opus-4-0": "June 15th, 2026",
  "claude-opus-4-20250514": "June 15th, 2026",
  "claude-sonnet-4-0": "June 15th, 2026",
  "claude-sonnet-4-20250514": "June 15th, 2026",
  "claude-opus-4-1": "August 5th, 2026",
  "claude-opus-4-1-20250805": "August 5th, 2026",
  "claude-mythos-preview": "June 30th, 2026"
};
var MODELS_TO_WARN_WITH_THINKING_ENABLED2 = ["claude-mythos-preview", "claude-opus-4-6"];
Messages2.Batches = Batches2;

// node_modules/@anthropic-ai/sdk/resources/models.mjs
var Models2 = class extends APIResource {
  /**
   * Get a specific model.
   *
   * The Models API response can be used to determine information about a specific
   * model or resolve a model alias to a model ID.
   */
  retrieve(modelID, params = {}, options) {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/models/${modelID}`, {
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : void 0 },
        options?.headers
      ])
    });
  }
  /**
   * List available models.
   *
   * The Models API response can be used to determine which models are available for
   * use in the API. More recently released models are listed first.
   */
  list(params = {}, options) {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList("/v1/models", Page, {
      query,
      ...options,
      headers: buildHeaders([
        { ...betas?.toString() != null ? { "anthropic-beta": betas?.toString() } : void 0 },
        options?.headers
      ])
    });
  }
};

// node_modules/@anthropic-ai/sdk/client.mjs
var _BaseAnthropic_instances;
var _a;
var _BaseAnthropic_encoder;
var _BaseAnthropic_baseURLOverridden;
var HUMAN_PROMPT = "\\n\\nHuman:";
var AI_PROMPT = "\\n\\nAssistant:";
var BaseAnthropic = class {
  /**
   * The active credential provider. Default credential resolution runs once
   * at construction time. If it fails, the error is surfaced on every
   * request and the client must be reconstructed — there is no retry path.
   *
   * Clones returned by {@link withOptions} share the parent's auth state
   * (provider, token cache, pending resolution, and any resolution error)
   * unless the caller passes an explicit `apiKey`, `authToken`,
   * `credentials`, `config`, or `profile` override.
   */
  get credentials() {
    return this._authState.provider;
  }
  /**
   * API Client for interfacing with the Anthropic API.
   *
   * @param {string | null | undefined} [opts.apiKey=process.env['ANTHROPIC_API_KEY'] ?? null]
   * @param {string | null | undefined} [opts.authToken=process.env['ANTHROPIC_AUTH_TOKEN'] ?? null]
   * @param {string | null | undefined} [opts.webhookKey=process.env['ANTHROPIC_WEBHOOK_SIGNING_KEY'] ?? null]
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_BASE_URL'] ?? https://api.anthropic.com] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({ baseURL = readEnv("ANTHROPIC_BASE_URL"), apiKey, authToken, webhookKey = readEnv("ANTHROPIC_WEBHOOK_SIGNING_KEY") ?? null, ...opts } = {}) {
    _BaseAnthropic_instances.add(this);
    this._requestAuthFlags = /* @__PURE__ */ new WeakMap();
    _BaseAnthropic_encoder.set(this, void 0);
    if (apiKey === void 0) {
      apiKey = opts.profile != null ? null : readEnv("ANTHROPIC_API_KEY") ?? null;
    }
    if (authToken === void 0) {
      authToken = opts.profile != null ? null : readEnv("ANTHROPIC_AUTH_TOKEN") ?? null;
    }
    if (opts.profile != null && (opts.credentials != null || opts.config != null)) {
      throw new TypeError("Pass at most one of `profile`, `credentials`, or `config`.");
    }
    const options = {
      apiKey,
      authToken,
      webhookKey,
      ...opts,
      baseURL: baseURL || `https://api.anthropic.com`
    };
    if (!options.dangerouslyAllowBrowser && isRunningInBrowser()) {
      throw new AnthropicError("It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew Anthropic({ apiKey, dangerouslyAllowBrowser: true });\n");
    }
    this.baseURL = options.baseURL;
    this._baseURLIsExplicit = opts.__baseURLIsExplicit ?? !!baseURL;
    this.timeout = options.timeout ?? _a.DEFAULT_TIMEOUT;
    this.logger = options.logger ?? console;
    this.logLevel = defaultLogLevel;
    this.logLevel = parseLogLevel(options.logLevel, "ClientOptions.logLevel", loggerFor(this)) ?? parseLogLevel(readEnv("ANTHROPIC_LOG"), "process.env['ANTHROPIC_LOG']", loggerFor(this)) ?? defaultLogLevel;
    this.fetchOptions = options.fetchOptions;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetch = options.fetch ?? getDefaultFetch();
    __classPrivateFieldSet(this, _BaseAnthropic_encoder, FallbackEncoder, "f");
    this.middleware = [...options.middleware ?? []];
    const customHeadersEnv = readEnv("ANTHROPIC_CUSTOM_HEADERS");
    if (customHeadersEnv) {
      const parsed = {};
      for (const line of customHeadersEnv.split("\n")) {
        const colon = line.indexOf(":");
        if (colon >= 0) {
          parsed[line.substring(0, colon).trim()] = line.substring(colon + 1).trim();
        }
      }
      options.defaultHeaders = { ...parsed, ...options.defaultHeaders };
    }
    const inherited = opts.__auth;
    delete options.__auth;
    delete options.__baseURLIsExplicit;
    this._options = options;
    this.apiKey = typeof apiKey === "string" ? apiKey : null;
    this.authToken = authToken;
    this.webhookKey = webhookKey;
    if (inherited) {
      this._authState = inherited;
      if (!this._baseURLIsExplicit && inherited.baseURL) {
        this.baseURL = inherited.baseURL;
      }
    } else {
      this._authState = { provider: null, tokenCache: null, resolution: null, error: null, extraHeaders: {} };
      if (this.apiKey == null && this.authToken == null) {
        const credentials = options.credentials ?? null;
        if (credentials) {
          this._authState.provider = credentials;
          this._authState.tokenCache = this._makeTokenCache(credentials);
        } else if (options.config != null) {
          const result = resolveCredentialsFromConfig(options.config, this._credentialResolverOptions());
          this._authState.provider = result.provider;
          this._authState.tokenCache = this._makeTokenCache(result.provider);
          this._authState.extraHeaders = result.extraHeaders;
          this._applyCredentialBaseURL(result.baseURL);
        } else if (options.profile != null) {
          this._authState.resolution = this._resolveDefaultCredentials(options.profile);
        } else {
          this._authState.resolution = this._resolveDefaultCredentials();
        }
      }
    }
  }
  /**
   * Stores a profile/config-supplied base URL on the shared auth state and, if
   * the caller did not pin `baseURL` via constructor option or env, adopts it
   * as this client's outbound API host. Precedence: ctor opt > env > profile >
   * hardcoded default.
   */
  _applyCredentialBaseURL(baseURL) {
    if (!baseURL)
      return;
    const normalized = baseURL.replace(/\/+$/, "");
    this._authState.baseURL = normalized;
    if (!this._baseURLIsExplicit) {
      this.baseURL = normalized;
    }
  }
  /**
   * Options bag passed into the credential chain. `baseURL` here is only the
   * fallback host for the token-exchange POST when the config itself omits
   * `base_url`; the chain returns the config's own `base_url` (if any) on
   * {@link CredentialResult.baseURL}, which {@link _applyCredentialBaseURL}
   * then adopts for outbound API requests. The two are deliberately decoupled
   * so this fallback never round-trips into precedence.
   */
  _credentialResolverOptions() {
    return {
      baseURL: this.baseURL,
      fetch: this._credentialsFetch(),
      userAgent: this.getUserAgent(),
      onCacheWriteError: (err) => {
        loggerFor(this).debug("credential cache write failed (best-effort)", err);
      },
      onSafetyWarning: (msg) => {
        loggerFor(this).warn(msg);
      }
    };
  }
  /**
   * A `Fetch` for first-party credential token-exchange requests (OIDC
   * federation jwt-bearer grants, user-OAuth refresh grants) that routes
   * through this client's middleware chain, so middleware observes token
   * traffic like any other request. Only client-level middleware applies:
   * a minted token is shared across requests, so attributing the exchange
   * to any one request's per-request middleware would be arbitrary. For the
   * same reason, `ctx.options` is undefined for these requests.
   */
  _credentialsFetch() {
    return wrapFetchWithMiddleware(this.fetch, this.middleware, void 0, this);
  }
  _makeTokenCache(provider) {
    return new TokenCache(provider, (err) => {
      loggerFor(this).debug("advisory token refresh failed; serving cached token", err);
    });
  }
  /**
   * Create a new client instance re-using the same options given to the current client with optional overriding.
   */
  withOptions(options) {
    const overridesStructuredAuth = "credentials" in options || "config" in options || "profile" in options;
    const overridesAuth = "apiKey" in options || "authToken" in options || overridesStructuredAuth;
    const internal = {
      ...this._options,
      // Only forward baseURL when the caller (or env) explicitly chose it.
      // For a non-explicit parent, this.baseURL may have been mutated to the
      // profile-resolved host; pinning that as the clone's options.baseURL
      // would make _options on the clone misreport caller intent and would
      // leave the clone stuck on the parent's host across an auth override.
      // The clone instead receives the construction-time value via
      // ...this._options above and re-adopts the profile host through the
      // shared _authState.baseURL + __baseURLIsExplicit=false path.
      ...this._baseURLIsExplicit ? { baseURL: this.baseURL } : {},
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      logger: this.logger,
      logLevel: this.logLevel,
      fetch: this.fetch,
      fetchOptions: this.fetchOptions,
      middleware: this.middleware,
      apiKey: this.apiKey,
      authToken: this.authToken,
      webhookKey: this.webhookKey,
      // credentials: this.credentials is a no-op when __auth is shared (the
      // ctor takes the inherited path and ignores options.credentials); when
      // overridesAuth is true via apiKey/authToken only, it lets the clone
      // build a fresh TokenCache around the parent's provider.
      credentials: this.credentials,
      // When the caller passes a structured-credential override, drop inherited
      // structured-credential options so only `...options` supplies them —
      // otherwise an inherited `credentials`/`config`/`profile` would trip the
      // mutual-exclusion check or precedence over the override.
      ...overridesStructuredAuth ? { credentials: void 0, config: void 0, profile: void 0 } : {},
      ...options,
      // Always set __auth so any stale value from ...this._options is
      // overwritten. undefined means "build fresh auth from these options".
      __auth: overridesAuth ? void 0 : this._authState,
      __baseURLIsExplicit: "baseURL" in options ? true : this._baseURLIsExplicit
    };
    return new this.constructor(internal);
  }
  /**
   * Lazily resolves credentials from config files or environment variables.
   * Called once from the constructor when no explicit auth is provided, or
   * when an explicit `profile` was passed (in which case a missing/unresolved
   * profile is surfaced as an error instead of falling through to "no auth").
   * The returned promise is stored and awaited on the first request.
   */
  async _resolveDefaultCredentials(profile) {
    try {
      const result = await defaultCredentials(this._credentialResolverOptions(), profile);
      if (result) {
        this._authState.provider = result.provider;
        this._authState.tokenCache = this._makeTokenCache(result.provider);
        this._authState.extraHeaders = result.extraHeaders;
        this._applyCredentialBaseURL(result.baseURL);
      } else if (profile != null) {
        throw new AnthropicError(`Profile "${profile}" could not be resolved (no <config_dir>/configs/${profile}.json found).`);
      }
    } catch (err) {
      this._authState.error = err;
    } finally {
      this._authState.resolution = null;
    }
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values, nulls }) {
    if (values.get("x-api-key") || values.get("authorization")) {
      return;
    }
    if (this._authState.error) {
      throw this._authState.error;
    }
    if (this._authState.tokenCache || this._authState.resolution) {
      return;
    }
    if (this.apiKey && values.get("x-api-key")) {
      return;
    }
    if (nulls.has("x-api-key")) {
      return;
    }
    if (this.authToken && values.get("authorization")) {
      return;
    }
    if (nulls.has("authorization")) {
      return;
    }
    throw new Error('Could not resolve authentication method. Expected one of apiKey, authToken, credentials, config, or profile to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted');
  }
  _authFlags(opts) {
    let flags = this._requestAuthFlags.get(opts);
    if (!flags) {
      flags = { usedTokenCache: false, didRefreshFor401: false };
      this._requestAuthFlags.set(opts, flags);
    }
    return flags;
  }
  async authHeaders(opts) {
    if (this._authState.resolution) {
      await this._authState.resolution;
    }
    if (this._authState.error) {
      return void 0;
    }
    if (this._authState.tokenCache && this.apiKey == null) {
      const token = await this._authState.tokenCache.getToken();
      this._authFlags(opts).usedTokenCache = true;
      return buildHeaders([{ Authorization: `Bearer ${token}` }]);
    }
    return buildHeaders([await this.apiKeyAuth(opts), await this.bearerAuth(opts)]);
  }
  async apiKeyAuth(opts) {
    if (this.apiKey == null) {
      return void 0;
    }
    return buildHeaders([{ "X-Api-Key": this.apiKey }]);
  }
  async bearerAuth(opts) {
    if (this.authToken == null) {
      return void 0;
    }
    return buildHeaders([{ Authorization: `Bearer ${this.authToken}` }]);
  }
  stringifyQuery(query) {
    return stringifyQuery(query);
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${VERSION}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${uuid4()}`;
  }
  makeStatusError(status, error, message, headers) {
    return APIError.generate(status, error, message, headers);
  }
  buildURL(path2, query, defaultBaseURL) {
    const baseURL = !__classPrivateFieldGet(this, _BaseAnthropic_instances, "m", _BaseAnthropic_baseURLOverridden).call(this) && defaultBaseURL || this.baseURL;
    const url = isAbsoluteURL(path2) ? new URL(path2) : new URL(baseURL + (baseURL.endsWith("/") && path2.startsWith("/") ? path2.slice(1) : path2));
    const defaultQuery = this.defaultQuery();
    const pathQuery = Object.fromEntries(url.searchParams);
    if (!isEmptyObj(defaultQuery) || !isEmptyObj(pathQuery)) {
      query = { ...pathQuery, ...defaultQuery, ...query };
    }
    if (typeof query === "object" && query && !Array.isArray(query)) {
      url.search = this.stringifyQuery(query);
    }
    return url.toString();
  }
  _calculateNonstreamingTimeout(maxTokens) {
    const defaultTimeout = 10 * 60;
    const expectedTimeout = 60 * 60 * maxTokens / 128e3;
    if (expectedTimeout > defaultTimeout) {
      throw new AnthropicError("Streaming is required for operations that may take longer than 10 minutes. See https://github.com/anthropics/anthropic-sdk-typescript#streaming-responses for more details");
    }
    return defaultTimeout * 1e3;
  }
  /**
   * Used as a callback for mutating the given `FinalRequestOptions` object.
   */
  async prepareOptions(options) {
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   *
   * Runs after all middleware (including {@link backendMiddleware}),
   * immediately before each underlying fetch call, so it sees exactly what
   * goes over the wire. Middleware may replay a request by calling `next()`
   * more than once, so this hook can run multiple times per attempt:
   * overrides must be idempotent and overwrite headers from a previous
   * invocation rather than append to them.
   */
  async prepareRequest(request, { url, options }) {
    if (this._authState.tokenCache && this.apiKey == null) {
      const headers = request.headers instanceof Headers ? request.headers : new Headers(request.headers);
      for (const [k, v] of Object.entries(this._authState.extraHeaders)) {
        if (!headers.has(k))
          headers.set(k, v);
      }
      const existing = headers.get("anthropic-beta")?.split(",").map((s) => s.trim());
      if (!existing?.includes(OAUTH_API_BETA_HEADER)) {
        headers.append("anthropic-beta", OAUTH_API_BETA_HEADER);
      }
      request.headers = headers;
    }
  }
  /**
   * Internal {@link Middleware} composed innermost in the chain — inside both
   * client-level and per-request middleware, immediately around the underlying
   * `fetch`. Subclasses for third-party backends override this to adapt the
   * canonical Anthropic-shaped request to the backend's wire shape (URL/body
   * rewriting, request signing) and to normalize the wire response back to the
   * canonical shape (e.g. AWS EventStream to SSE).
   *
   * Running inside the user's middleware means user middleware always observes
   * canonical Anthropic-shaped traffic, and the adaptation re-runs (e.g.
   * re-signs) on every `next()` invocation, covering whatever the middleware
   * mutated.
   *
   * Errors thrown here follow the middleware error policy: they propagate to
   * the caller as-is — no retries, no `APIConnectionError` wrapping — unless
   * retryable (see {@link Middleware}); throw a `RetryableError` to opt into
   * the retry path.
   */
  backendMiddleware() {
    return [];
  }
  get(path2, opts) {
    return this.methodRequest("get", path2, opts);
  }
  post(path2, opts) {
    return this.methodRequest("post", path2, opts);
  }
  patch(path2, opts) {
    return this.methodRequest("patch", path2, opts);
  }
  put(path2, opts) {
    return this.methodRequest("put", path2, opts);
  }
  delete(path2, opts) {
    return this.methodRequest("delete", path2, opts);
  }
  methodRequest(method, path2, opts) {
    return this.request(Promise.resolve(opts).then((opts2) => {
      return { method, path: path2, ...opts2 };
    }));
  }
  request(options, remainingRetries = null) {
    return new APIPromise(this, this.makeRequest(options, remainingRetries, void 0));
  }
  async makeRequest(optionsInput, retriesRemaining, retryOfRequestLogID) {
    const options = await optionsInput;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) {
      retriesRemaining = maxRetries;
      this._requestAuthFlags.delete(options);
    }
    await this.prepareOptions(options);
    const { req, url, timeout } = await this.buildRequest(options, {
      retryCount: maxRetries - retriesRemaining
    });
    const requestLogID = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0");
    const retryLogStr = retryOfRequestLogID === void 0 ? "" : `, retryOf: ${retryOfRequestLogID}`;
    const startTime = Date.now();
    if (options.signal?.aborted) {
      throw new APIUserAbortError();
    }
    const controller = new AbortController();
    const response = await this.fetchWithTimeout(url, req, timeout, controller, options, {
      requestLogID,
      retryOfRequestLogID
    }).catch(castToError);
    const headersTime = Date.now();
    if (response instanceof globalThis.Error) {
      const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
      if (options.signal?.aborted) {
        throw new APIUserAbortError();
      }
      const isTimeout = isAbortError(response) || /timed? ?out/i.test(String(response) + ("cause" in response ? String(response.cause) : ""));
      const hasMiddleware = this.middleware.length > 0 || !!options.middleware?.length || this.backendMiddleware().length > 0;
      if (hasMiddleware && !isTimeout && !isRetryableError(response)) {
        loggerFor(this).info(`[${requestLogID}] middleware error (not retryable)`);
        loggerFor(this).debug(`[${requestLogID}] middleware error (not retryable)`, formatRequestDetails({
          retryOfRequestLogID,
          url,
          durationMs: headersTime - startTime,
          message: response.message
        }));
        throw response;
      }
      if (retriesRemaining) {
        loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - ${retryMessage}`);
        loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (${retryMessage})`, formatRequestDetails({
          retryOfRequestLogID,
          url,
          durationMs: headersTime - startTime,
          message: response.message
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - error; no more retries left`);
      loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (error; no more retries left)`, formatRequestDetails({
        retryOfRequestLogID,
        url,
        durationMs: headersTime - startTime,
        message: response.message
      }));
      if (isTimeout) {
        throw new APIConnectionTimeoutError();
      }
      if (hasMiddleware && !isFetchOriginError(response)) {
        throw response;
      }
      throw new APIConnectionError({ cause: response });
    }
    const specialHeaders = [...response.headers.entries()].filter(([name]) => name === "request-id").map(([name, value]) => ", " + name + ": " + JSON.stringify(value)).join("");
    const responseInfo = `[${requestLogID}${retryLogStr}${specialHeaders}] ${req.method} ${url} ${response.ok ? "succeeded" : "failed"} with status ${response.status} in ${headersTime - startTime}ms`;
    if (!response.ok) {
      const shouldRetry = await this.shouldRetry(response, options);
      if (retriesRemaining && shouldRetry) {
        const retryMessage2 = `retrying, ${retriesRemaining} attempts remaining`;
        await CancelReadableStream(response.body);
        loggerFor(this).info(`${responseInfo} - ${retryMessage2}`);
        loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage2})`, formatRequestDetails({
          retryOfRequestLogID,
          url: response.url,
          status: response.status,
          headers: response.headers,
          durationMs: headersTime - startTime
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID, response.headers);
      }
      const retryMessage = shouldRetry ? `error; no more retries left` : `error; not retryable`;
      loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
      const errText = await response.text().catch((err2) => castToError(err2).message);
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? void 0 : errText;
      loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage})`, formatRequestDetails({
        retryOfRequestLogID,
        url: response.url,
        status: response.status,
        headers: response.headers,
        message: errMessage,
        durationMs: Date.now() - startTime
      }));
      const err = this.makeStatusError(response.status, errJSON, errMessage, response.headers);
      throw err;
    }
    loggerFor(this).info(responseInfo);
    loggerFor(this).debug(`[${requestLogID}] response start`, formatRequestDetails({
      retryOfRequestLogID,
      url: response.url,
      status: response.status,
      headers: response.headers,
      durationMs: headersTime - startTime
    }));
    return { response, options, controller, requestLogID, retryOfRequestLogID, startTime };
  }
  getAPIList(path2, Page2, opts) {
    return this.requestAPIList(Page2, opts && "then" in opts ? opts.then((opts2) => ({ method: "get", path: path2, ...opts2 })) : { method: "get", path: path2, ...opts });
  }
  requestAPIList(Page2, options) {
    const request = this.makeRequest(options, null, void 0);
    return new PagePromise(this, request, Page2);
  }
  async fetchWithTimeout(url, init, ms, controller, requestOptions, logCtx) {
    const { signal, method, ...options } = init || {};
    const abort = this._makeAbort(controller);
    if (signal)
      signal.addEventListener("abort", abort, { once: true });
    const isReadableBody = globalThis.ReadableStream && options.body instanceof globalThis.ReadableStream || typeof options.body === "object" && options.body !== null && Symbol.asyncIterator in options.body;
    const fetchOptions = {
      signal: controller.signal,
      ...isReadableBody ? { duplex: "half" } : {},
      method: "GET",
      ...options
    };
    if (method) {
      fetchOptions.method = method.toUpperCase();
    }
    const baseFetch = this.fetch;
    const timedFetch = async (innerUrl, innerInit) => {
      const timeout = setTimeout(abort, ms);
      try {
        return await baseFetch.call(void 0, innerUrl, innerInit);
      } finally {
        clearTimeout(timeout);
      }
    };
    const innerFetch = requestOptions === void 0 ? timedFetch : (async (innerUrl, innerInit = {}) => {
      const innerUrlStr = typeof innerUrl === "string" ? innerUrl : innerUrl instanceof URL ? innerUrl.href : innerUrl.url;
      innerInit.headers = innerInit.headers instanceof Headers ? innerInit.headers : new Headers(innerInit.headers);
      await this.prepareRequest(innerInit, { url: innerUrlStr, options: requestOptions });
      if (logCtx) {
        loggerFor(this).debug(`[${logCtx.requestLogID}] sending request`, formatRequestDetails({
          retryOfRequestLogID: logCtx.retryOfRequestLogID,
          method: innerInit.method,
          url: innerUrlStr,
          options: requestOptions,
          headers: innerInit.headers
        }));
      }
      return timedFetch(innerUrl, innerInit);
    });
    const requestMiddleware = requestOptions?.middleware;
    const backendMiddleware = this.backendMiddleware();
    const allMiddleware = requestMiddleware?.length || backendMiddleware.length ? [...this.middleware, ...requestMiddleware ?? [], ...backendMiddleware] : this.middleware;
    return await wrapFetchWithMiddleware(innerFetch, allMiddleware, requestOptions, this)(url, fetchOptions);
  }
  async shouldRetry(response, options) {
    const flags = this._authFlags(options);
    if (response.status === 401 && this._authState.tokenCache && flags.usedTokenCache && !flags.didRefreshFor401) {
      flags.didRefreshFor401 = true;
      this._authState.tokenCache.invalidate();
      return true;
    }
    const shouldRetryHeader = response.headers.get("x-should-retry");
    if (shouldRetryHeader === "true")
      return true;
    if (shouldRetryHeader === "false")
      return false;
    if (response.status === 408)
      return true;
    if (response.status === 409)
      return true;
    if (response.status === 429)
      return true;
    if (response.status >= 500)
      return true;
    return false;
  }
  async retryRequest(options, retriesRemaining, requestLogID, responseHeaders) {
    let timeoutMillis;
    const retryAfterMillisHeader = responseHeaders?.get("retry-after-ms");
    if (retryAfterMillisHeader) {
      const timeoutMs = parseFloat(retryAfterMillisHeader);
      if (!Number.isNaN(timeoutMs)) {
        timeoutMillis = timeoutMs;
      }
    }
    const retryAfterHeader = responseHeaders?.get("retry-after");
    if (retryAfterHeader && !timeoutMillis) {
      const timeoutSeconds = parseFloat(retryAfterHeader);
      if (!Number.isNaN(timeoutSeconds)) {
        timeoutMillis = timeoutSeconds * 1e3;
      } else {
        timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
      }
    }
    if (timeoutMillis === void 0) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);
    return this.makeRequest(options, retriesRemaining - 1, requestLogID);
  }
  calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 8;
    const numRetries = maxRetries - retriesRemaining;
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
    const jitter2 = 1 - Math.random() * 0.25;
    return sleepSeconds * jitter2 * 1e3;
  }
  calculateNonstreamingTimeout(maxTokens, maxNonstreamingTokens) {
    const maxTime = 60 * 60 * 1e3;
    const defaultTime = 60 * 10 * 1e3;
    const expectedTime = maxTime * maxTokens / 128e3;
    if (expectedTime > defaultTime || maxNonstreamingTokens != null && maxTokens > maxNonstreamingTokens) {
      throw new AnthropicError("Streaming is required for operations that may take longer than 10 minutes. See https://github.com/anthropics/anthropic-sdk-typescript#long-requests for more details");
    }
    return defaultTime;
  }
  async buildRequest(inputOptions, { retryCount = 0 } = {}) {
    const options = { ...inputOptions };
    const { method, path: path2, query, defaultBaseURL } = options;
    if (this._authState.resolution) {
      await this._authState.resolution;
    }
    if (!this._baseURLIsExplicit && this._authState.baseURL && this.baseURL !== this._authState.baseURL) {
      this.baseURL = this._authState.baseURL;
    }
    const url = this.buildURL(path2, query, defaultBaseURL);
    if ("timeout" in options)
      validatePositiveInteger("timeout", options.timeout);
    options.timeout = options.timeout ?? this.timeout;
    const { bodyHeaders, body } = this.buildBody({ options });
    const reqHeaders = await this.buildHeaders({ options: inputOptions, method, bodyHeaders, retryCount });
    const req = {
      method,
      headers: reqHeaders,
      ...options.signal && { signal: options.signal },
      ...globalThis.ReadableStream && body instanceof globalThis.ReadableStream && { duplex: "half" },
      ...body && { body },
      ...this.fetchOptions ?? {},
      ...options.fetchOptions ?? {}
    };
    return { req, url, timeout: options.timeout };
  }
  async buildHeaders({ options, method, bodyHeaders, retryCount }) {
    let idempotencyHeaders = {};
    if (this.idempotencyHeader && method !== "get") {
      if (!options.idempotencyKey)
        options.idempotencyKey = this.defaultIdempotencyKey();
      idempotencyHeaders[this.idempotencyHeader] = options.idempotencyKey;
    }
    const headers = buildHeaders([
      idempotencyHeaders,
      {
        Accept: "application/json",
        "User-Agent": this.getUserAgent(),
        "X-Stainless-Retry-Count": String(retryCount),
        ...options.timeout ? { "X-Stainless-Timeout": String(Math.trunc(options.timeout / 1e3)) } : {},
        ...getPlatformHeaders(),
        ...this._options.dangerouslyAllowBrowser ? { "anthropic-dangerous-direct-browser-access": "true" } : void 0,
        "anthropic-version": "2023-06-01"
      },
      await this.authHeaders(options),
      this._options.defaultHeaders,
      bodyHeaders,
      options.headers
    ]);
    this.validateHeaders(headers);
    return headers.values;
  }
  _makeAbort(controller) {
    return () => controller.abort();
  }
  buildBody({ options: { body, headers: rawHeaders } }) {
    if (!body) {
      return { bodyHeaders: void 0, body: void 0 };
    }
    const headers = buildHeaders([rawHeaders]);
    if (
      // Pass raw type verbatim
      ArrayBuffer.isView(body) || body instanceof ArrayBuffer || body instanceof DataView || typeof body === "string" && // Preserve legacy string encoding behavior for now
      headers.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && body instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      body instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      body instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && body instanceof globalThis.ReadableStream
    ) {
      return { bodyHeaders: void 0, body };
    } else if (typeof body === "object" && (Symbol.asyncIterator in body || Symbol.iterator in body && "next" in body && typeof body.next === "function")) {
      return { bodyHeaders: void 0, body: ReadableStreamFrom(body) };
    } else if (typeof body === "object" && headers.values.get("content-type") === "application/x-www-form-urlencoded") {
      return {
        bodyHeaders: { "content-type": "application/x-www-form-urlencoded" },
        body: this.stringifyQuery(body)
      };
    } else {
      return __classPrivateFieldGet(this, _BaseAnthropic_encoder, "f").call(this, { body, headers });
    }
  }
};
_a = BaseAnthropic, _BaseAnthropic_encoder = /* @__PURE__ */ new WeakMap(), _BaseAnthropic_instances = /* @__PURE__ */ new WeakSet(), _BaseAnthropic_baseURLOverridden = function _BaseAnthropic_baseURLOverridden2() {
  return this.baseURL !== "https://api.anthropic.com";
};
BaseAnthropic.Anthropic = _a;
BaseAnthropic.HUMAN_PROMPT = HUMAN_PROMPT;
BaseAnthropic.AI_PROMPT = AI_PROMPT;
BaseAnthropic.DEFAULT_TIMEOUT = 6e5;
BaseAnthropic.AnthropicError = AnthropicError;
BaseAnthropic.APIError = APIError;
BaseAnthropic.APIConnectionError = APIConnectionError;
BaseAnthropic.APIConnectionTimeoutError = APIConnectionTimeoutError;
BaseAnthropic.APIUserAbortError = APIUserAbortError;
BaseAnthropic.NotFoundError = NotFoundError;
BaseAnthropic.ConflictError = ConflictError;
BaseAnthropic.RateLimitError = RateLimitError;
BaseAnthropic.BadRequestError = BadRequestError;
BaseAnthropic.AuthenticationError = AuthenticationError;
BaseAnthropic.InternalServerError = InternalServerError;
BaseAnthropic.PermissionDeniedError = PermissionDeniedError;
BaseAnthropic.UnprocessableEntityError = UnprocessableEntityError;
BaseAnthropic.toFile = toFile;
var Anthropic = class extends BaseAnthropic {
  constructor() {
    super(...arguments);
    this.completions = new Completions(this);
    this.messages = new Messages2(this);
    this.models = new Models2(this);
    this.beta = new Beta(this);
  }
};
Anthropic.Completions = Completions;
Anthropic.Messages = Messages2;
Anthropic.Models = Models2;
Anthropic.Beta = Beta;

// node_modules/@anthropic-ai/sdk/lib/middleware.mjs
init_error();
init_errors();
var encoder = new TextEncoder();

// node_modules/@anthropic-ai/sdk/index.mjs
init_error();

// server/coach.ts
import { appendFileSync, mkdirSync as mkdirSync2, existsSync as existsSync2 } from "node:fs";
import { dirname as dirname2, resolve as resolve2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var DEATH_CAUSE_LABELS = {
  laning_mistake: "laning mistakes",
  greedy_recall: "greedy recalls",
  facecheck: "facechecks",
  objective_setup: "objective setups",
  overextension: "overextension",
  shutdown_donation: "donated shutdowns",
  teamfight_execution: "teamfight execution",
  sidelane_greed: "side-lane greed",
  mechanical_misplay: "mechanical misplays",
  unavoidable_team_collapse: "team collapses"
};
function hasAnthropic() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function queuePredicate(queue) {
  const map = {
    all: () => true,
    ranked_solo: (q) => q.includes("RANKED_SOLO"),
    ranked_flex: (q) => q.includes("RANKED_FLEX"),
    swiftplay: (q) => q.includes("SWIFTPLAY") || q.includes("QUICKPLAY"),
    draft: (q) => q.includes("DRAFT") || q.includes("BLIND"),
    aram: (q) => q.includes("ARAM")
  };
  return map[queue] ?? map.all;
}
function compile(queue = "all") {
  const pool = store.activePool();
  const mainRole = store.profile().mainRole;
  const seasons = store.seasons();
  const pred = queuePredicate(queue);
  const career = enrichAll(store.matches(), seasons, pool).filter((m) => pred((m.objective.queue ?? "").toUpperCase()));
  const recent = career.slice(-20);
  const statBoard = buildStatBoard(career);
  const weakStats = statBoard.filter((s) => s.better === false && s.delta != null && s.value !== s.baseline).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);
  const strongStats = statBoard.filter((s) => s.better === true).slice(0, 3);
  const insights = buildInsights(career).slice(0, 3);
  const rec = recommend(career, pool, mainRole);
  const champRec = rec.plan.roster.find((r) => r.champion) ?? rec.plan.roster[0];
  const season = store.activeSeason();
  const seasonEnriched = season ? career.filter((m) => matchInBlock(m, season)) : [];
  const goals = season ? store.goalsForSeason(season.id).map((g) => evaluateGoal(g, seasonEnriched)) : [];
  const focusGoal = [...goals].filter((g) => !g.met).sort((a, b) => a.pct - b.pct)[0] ?? null;
  const sessions = groupSessions(career, store.settings().sessionGapMinutes);
  const last = sessions[sessions.length - 1];
  const session = last ? {
    games: last.games,
    wins: last.wins,
    losses: last.losses,
    netLp: last.netLp,
    avgProcess: last.avgProcess,
    peakTilt: last.peakTilt,
    lossStreak: last.currentLossStreak,
    healthScore: last.healthScore,
    guardrail: last.guardrails.find((g) => g.severity === "stop")?.message ?? last.guardrails[0]?.message ?? null
  } : null;
  const borrowed = detectBorrowedLp(career);
  const causeCounts = /* @__PURE__ */ new Map();
  for (const m of recent) {
    const c = m.scorecard.firstDeathCause;
    if (c) causeCounts.set(c, (causeCounts.get(c) ?? 0) + 1);
  }
  const topCause = [...causeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const latestRank = [...career].reverse().find((m) => m.objective.tier)?.objective;
  const wins = career.filter((m) => m.objective.win).length;
  const losses = career.filter((m) => m.objective.win === false).length;
  const signals = {
    games: career.length,
    rank: latestRank?.tier ? `${cap2(latestRank.tier)} ${latestRank.division ?? ""} ${latestRank.leaguePoints ?? 0} LP`.trim() : "Unranked",
    record: {
      wins,
      losses,
      winRate: wins + losses ? Math.round(wins / (wins + losses) * 100) : 0,
      netLp: career.reduce((a, m) => a + (m.objective.lpDelta ?? 0), 0)
    },
    weakStats,
    strongStats,
    focusGoal,
    insights,
    champion: {
      champion: champRec?.champion ?? null,
      role: mainRole,
      rationale: champRec?.rationale ?? "your most reliable pick"
    },
    session,
    borrowedLp: borrowed.borrowed ? borrowed.message : null,
    topDeathCause: topCause ? DEATH_CAUSE_LABELS[topCause] ?? topCause : null,
    identity: rec.identityName
  };
  return { signals, brief: renderBrief(signals) };
}
function renderBrief(s) {
  const lines = [];
  lines.push(`Rank: ${s.rank}. Career record: ${s.record.wins}W ${s.record.losses}L (${s.record.winRate}% WR, ${s.record.netLp >= 0 ? "+" : ""}${s.record.netLp} LP) over ${s.games} logged games. Playing as "${s.identity}".`);
  if (s.weakStats.length)
    lines.push(`Declining vs my recent baseline: ${s.weakStats.map((w2) => `${w2.label} ${w2.valueFmt} (was ${w2.baseline})`).join("; ")}.`);
  if (s.strongStats.length)
    lines.push(`Holding up or improving: ${s.strongStats.map((w2) => `${w2.label} ${w2.valueFmt}`).join("; ")}.`);
  if (s.focusGoal)
    lines.push(`Active block goal furthest behind: "${s.focusGoal.goal.title}" \u2014 currently ${s.focusGoal.current ?? "?"} vs target ${s.focusGoal.goal.direction === "lower" ? "\u2264" : "\u2265"}${s.focusGoal.goal.target} ${s.focusGoal.goal.unit}.`);
  for (const ins of s.insights) lines.push(`Insight: ${ins.title}. ${ins.detail}`);
  if (s.topDeathCause) lines.push(`Most common first-death cause lately: ${s.topDeathCause}.`);
  if (s.session)
    lines.push(`Current session: ${s.session.wins}W ${s.session.losses}L, ${s.session.netLp >= 0 ? "+" : ""}${s.session.netLp} LP, avg process ${s.session.avgProcess}, peak tilt ${s.session.peakTilt}/5, loss streak ${s.session.lossStreak}, session-health ${s.session.healthScore}/100.${s.session.guardrail ? " Guardrail: " + s.session.guardrail : ""}`);
  if (s.borrowedLp) lines.push(`Warning: ${s.borrowedLp}`);
  lines.push(`Recommended champion/role: ${s.champion.champion ?? "a comfort pick"} ${s.champion.role ?? ""} \u2014 ${s.champion.rationale}.`);
  return lines.join("\n");
}
var DirectiveSchema = external_exports.object({
  title: external_exports.string().describe("A short imperative goal, e.g. 'Farm to 70 CS by 10 minutes'"),
  why: external_exports.string().describe("One sentence of rationale that cites the player's data"),
  metricLabel: external_exports.string().describe("The stat this maps to, e.g. 'CS@10', 'Deaths<15', 'KP'"),
  target: external_exports.string().describe("The concrete target, e.g. '70+', '\u22642', '55%'"),
  tone: external_exports.enum(["good", "bad", "neutral"])
});
var PlanSchema = external_exports.object({
  headline: external_exports.string().describe("One encouraging line telling the player what this next game is about"),
  directives: external_exports.array(DirectiveSchema).describe("1 to 3 concrete, measurable goals for the NEXT game"),
  championCall: external_exports.object({
    champion: external_exports.string().nullable(),
    role: external_exports.string().nullable(),
    line: external_exports.string().describe("One line on why to play this")
  }),
  mentalNote: external_exports.string().describe("Queue-discipline / tilt / stop-or-keep-playing guidance")
});
var SYSTEM = `You are a sharp, encouraging League of Legends improvement coach \u2014 like a manager in a task tracker who hands the player exactly what to focus on next. You are given a compiled brief of their recent stats, trends, goals, and session state.

Your job: produce a plan for their NEXT game. Rules:
- 1 to 3 directives, each a concrete, MEASURABLE goal tied to a real stat from the brief (CS@10, deaths before 15, kill participation, vision, gold@15, etc.). Never vague ("play better").
- Lead with the single biggest leak from the data. Cite the numbers in the rationale.
- Set tone: "bad" for a leak to fix, "good" for a strength to lean into, "neutral" otherwise.
- The mental note reads the session: if they're on a loss streak or tilt is high, tell them to stop or reset; if they're calm and winning, encourage another. Be direct but supportive.
- Recommend the champion/role from the brief. If none, say to pick a comfort main.
- Keep it tight and action-oriented. The point is to make them WANT to go play with a clear focus. No preamble.`;
var PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    directives: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          why: { type: "string" },
          metricLabel: { type: "string" },
          target: { type: "string" },
          tone: { type: "string", enum: ["good", "bad", "neutral"] }
        },
        required: ["title", "why", "metricLabel", "target", "tone"]
      }
    },
    championCall: {
      type: "object",
      additionalProperties: false,
      properties: {
        champion: { type: ["string", "null"] },
        role: { type: ["string", "null"] },
        line: { type: "string" }
      },
      required: ["champion", "role", "line"]
    },
    mentalNote: { type: "string" }
  },
  required: ["headline", "directives", "championCall", "mentalNote"]
};
async function llmPlan(brief) {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2500,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: PLAN_JSON_SCHEMA }
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Here is my compiled brief. Give me my plan for the next game.

${brief}`
      }
    ]
  });
  const text = res.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("no text output");
  const parsed = PlanSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("plan failed validation");
  const p = parsed.data;
  return {
    headline: p.headline,
    directives: p.directives.slice(0, 3),
    championCall: p.championCall,
    mentalNote: p.mentalNote
  };
}
function heuristicPlan(s) {
  const directives = [];
  if (s.focusGoal) {
    const g = s.focusGoal.goal;
    directives.push({
      title: g.title,
      why: `Your block goal that's furthest behind \u2014 ${s.focusGoal.current ?? "?"} vs a ${g.direction === "lower" ? "\u2264" : "\u2265"}${g.target} target.`,
      metricLabel: g.title,
      target: `${g.direction === "lower" ? "\u2264" : "\u2265"}${g.target} ${g.unit}`.trim(),
      tone: "bad"
    });
  }
  for (const w2 of s.weakStats) {
    if (directives.length >= 3) break;
    if (s.focusGoal && w2.label.toLowerCase().includes(s.focusGoal.goal.title.toLowerCase().slice(0, 4))) continue;
    directives.push({
      title: `Bring ${w2.label} back up`,
      why: `It slipped from ${w2.baseline} to ${w2.valueFmt} over your last 10 games.`,
      metricLabel: w2.label,
      target: `back above ${w2.baseline}${w2.unit === "%" ? "%" : ""}`,
      tone: "bad"
    });
  }
  if (directives.length === 0 && s.strongStats[0]) {
    const g = s.strongStats[0];
    directives.push({
      title: `Keep pressing ${g.label}`,
      why: `It's trending up (${g.valueFmt}). Lean into what's working.`,
      metricLabel: g.label,
      target: `hold ${g.valueFmt}`,
      tone: "good"
    });
  }
  if (directives.length === 0) {
    directives.push({
      title: "Play a clean, calm game",
      why: "Not enough data yet \u2014 log this one so the coach can start reading your patterns.",
      metricLabel: "Process",
      target: "grade it honestly",
      tone: "neutral"
    });
  }
  let mentalNote = "You're in a good spot \u2014 queue up with a clear focus.";
  if (s.session) {
    if (s.session.lossStreak >= 3 || s.session.peakTilt >= 4)
      mentalNote = `You're ${s.session.lossStreak} down and tilt hit ${s.session.peakTilt}/5. The winning move is to stop \u2014 your MMR is fine tomorrow, your judgment isn't fine right now.`;
    else if (s.session.lossStreak === 2)
      mentalNote = "Two losses in a row. One more, decided now to be the last \u2014 win or lose, then reassess.";
    else if (s.borrowedLp) mentalNote = s.borrowedLp;
  }
  const headline = s.session && (s.session.lossStreak >= 3 || s.session.peakTilt >= 4) ? "Before the next game \u2014 read this." : `Your next game: ${directives[0].title.toLowerCase()}.`;
  return {
    headline,
    directives,
    championCall: {
      champion: s.champion.champion,
      role: s.champion.role,
      line: s.champion.rationale
    },
    mentalNote
  };
}
async function buildCoachPlan(opts = {}) {
  const queue = opts.queue ?? "all";
  const mode = store.coachMode();
  const { signals, brief } = compile(queue);
  const cached = store.coachPlan();
  if (!opts.force && cached && cached.forGameCount === signals.games && (cached.forQueue ?? "all") === queue && (cached.forMode ?? "llm") === mode) {
    return cached.plan;
  }
  let core;
  let by = "heuristic";
  if (mode === "llm" && hasAnthropic() && signals.games > 0) {
    try {
      core = await llmPlan(brief);
      by = "llm";
    } catch (e) {
      console.warn("Coach LLM failed, using heuristic:", e.message);
      core = heuristicPlan(signals);
    }
  } else {
    core = heuristicPlan(signals);
  }
  const plan = {
    ...core,
    generatedBy: by,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    basedOnGames: signals.games
  };
  store.setCoachPlan(plan, signals.games, queue, mode);
  recordReasoning(brief, signals, plan);
  return plan;
}
var DATASET_FILE = resolve2(
  dirname2(fileURLToPath2("file:///worker.mjs")),
  "..",
  "data",
  "coach-dataset.jsonl"
);
function recordReasoning(brief, signals, plan) {
  try {
    const dir = dirname2(DATASET_FILE);
    if (!existsSync2(dir)) mkdirSync2(dir, { recursive: true });
    const record = {
      ts: plan.generatedAt,
      generatedBy: plan.generatedBy,
      games: signals.games,
      brief,
      signals: {
        record: signals.record,
        weak: signals.weakStats.map((s) => `${s.label} ${s.valueFmt}`),
        strong: signals.strongStats.map((s) => s.label),
        focusGoal: signals.focusGoal?.goal.title ?? null,
        session: signals.session
      },
      plan: {
        headline: plan.headline,
        directives: plan.directives,
        championCall: plan.championCall,
        mentalNote: plan.mentalNote
      }
    };
    appendFileSync(DATASET_FILE, JSON.stringify(record) + "\n", "utf8");
  } catch {
  }
}
function cap2(s) {
  return s ? s[0] + s.slice(1).toLowerCase() : s;
}

// server/ingest.ts
var uuid = () => globalThis.crypto.randomUUID();
var SYNC_QUEUES = [
  { name: "Ranked solo", queue: 420, ranked: true },
  { name: "Ranked flex", queue: 440, ranked: true },
  { name: "Swiftplay", queue: 480, ranked: false },
  { name: "Draft", queue: 400, ranked: false },
  { name: "ARAM", queue: 450, ranked: false },
  { name: "Arena", queue: 1700, ranked: false }
];
var NEUTRAL_SCORECARD = {
  grade: "C",
  tiltBefore: 0,
  tiltAfter: 0,
  biggestMistake: "",
  firstDeathCause: null,
  bestDecision: "",
  oneAdjustment: "",
  doomedCollapse: false,
  flamed: false,
  mutedAppropriately: true,
  reviewed: false
};
var MIN_INTERVAL_MS = 60 * 60 * 1e3;
async function syncRiot(opts = {}) {
  const lastSyncAt = store.lastSyncAt();
  const base = { added: 0, perQueue: {}, skipped: false, error: null, lastSyncAt };
  let upgraded = 0;
  if (store.isDemo())
    return { ...base, skipped: true, error: "Demo mode \u2014 sync is off. Flip to live in Settings." };
  const ap = activeProfile();
  const riot = ap.isSelf ? riotFromEnv() : riotForAccount(ap.gameName, ap.tagLine, ap.platform);
  if (!riot) return { ...base, skipped: true, error: "Riot API not configured." };
  if (!opts.force && lastSyncAt && Date.now() - new Date(lastSyncAt).getTime() < MIN_INTERVAL_MS && store.pullPending().length === 0) {
    return { ...base, skipped: true };
  }
  const maxNew = opts.maxNew ?? 25;
  const MAX_ENUM = 1500;
  const perQueue = {};
  let added = 0;
  let rateLimited = false;
  try {
    const puuid = await riot.getPuuid();
    let rank = {};
    try {
      rank = await riot.getRank(puuid);
    } catch {
    }
    const pending = [...store.pullPending()];
    const incremental = store.pullComplete() || store.allMatches().length >= 50;
    if (pending.length === 0) {
      const pendingSet = /* @__PURE__ */ new Set();
      const collect = async (queue) => {
        for (let start = 0; start < MAX_ENUM && pending.length < MAX_ENUM; start += 100) {
          const ids = await riot.getRecentMatchIds(puuid, 100, queue, void 0, start);
          let newInPage = 0;
          for (const id of ids) {
            if (store.hasRiotMatch(id) || pendingSet.has(id)) continue;
            pendingSet.add(id);
            pending.push(id);
            newInPage++;
          }
          if (ids.length < 100) break;
          if (incremental && newInPage === 0) break;
        }
      };
      for (const { queue } of SYNC_QUEUES) {
        try {
          await collect(queue);
        } catch (e) {
          if (e instanceof RiotError && e.status === 429) {
            rateLimited = true;
            break;
          }
        }
      }
      if (!rateLimited) {
        try {
          await collect(void 0);
        } catch (e) {
          if (e instanceof RiotError && e.status === 429) rateLimited = true;
        }
      }
      if (!rateLimited) store.setPullComplete(true);
    }
    const activeSeason = store.activeSeason();
    let processed = 0;
    const stillPending = [];
    for (const id of pending) {
      if (processed >= maxNew || rateLimited) {
        stillPending.push(id);
        continue;
      }
      try {
        const objective = await riot.getObjectiveData(id, puuid);
        const q = (objective.queue ?? "").toUpperCase();
        if (q.includes("RANKED")) {
          const r = q.includes("FLEX") ? rank.flex ?? null : rank.solo ?? (rank.tier ? { tier: rank.tier, division: rank.division ?? "", leaguePoints: rank.leaguePoints ?? 0 } : null);
          if (r) {
            objective.tier = r.tier;
            objective.division = r.division;
            objective.leaguePoints = r.leaguePoints;
          }
        }
        store.addMatch({
          id: uuid(),
          seasonId: activeSeason?.id ?? null,
          playedAt: objective.playedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
          loggedAt: (/* @__PURE__ */ new Date()).toISOString(),
          source: "riot",
          objective,
          scorecard: { ...NEUTRAL_SCORECARD }
        });
        added++;
        processed++;
        const name = q.includes("FLEX") ? "Ranked flex" : q.includes("SOLO") ? "Ranked solo" : q.includes("ARAM") ? "ARAM" : q.includes("ARENA") ? "Arena" : "Other";
        perQueue[name] = (perQueue[name] ?? 0) + 1;
      } catch (e) {
        if (e instanceof RiotError && e.status === 429) {
          rateLimited = true;
          stillPending.push(id);
          continue;
        }
      }
    }
    store.setPullPending(stillPending);
    if (!rateLimited && stillPending.length === 0) {
      const budget = Math.max(0, Math.min(20, maxNew - processed));
      const needsUpgrade = (m) => {
        if (m.source !== "riot" || !m.objective.riotMatchId) return false;
        if (!m.objective.build) return true;
        const a = m.objective.adv;
        if (!a) return true;
        const isArena = (m.objective.queue ?? "").includes("ARENA");
        return !isArena && a.duels === void 0;
      };
      const stale = store.allMatches().filter(needsUpgrade).sort((a, b) => (b.playedAt ?? "").localeCompare(a.playedAt ?? "")).slice(0, budget);
      for (const m of stale) {
        try {
          const fresh = await riot.getObjectiveData(m.objective.riotMatchId, puuid);
          store.updateMatch(m.id, { objective: { ...m.objective, ...fresh } });
          upgraded++;
        } catch (e) {
          if (e instanceof RiotError && e.status === 429) {
            rateLimited = true;
            break;
          }
        }
      }
    }
    if (rank.leaguePoints != null) {
      store.updateSettings({
        lastLp: rank.leaguePoints,
        lastTier: rank.tier ?? null,
        lastDivision: rank.division ?? null
      });
    }
    const iso = (/* @__PURE__ */ new Date()).toISOString();
    store.setLastSyncAt(iso);
    return { added, perQueue, skipped: false, error: null, lastSyncAt: iso, rateLimited, upgraded, remaining: stillPending.length };
  } catch (e) {
    const is429 = e instanceof RiotError && e.status === 429;
    return {
      added,
      perQueue,
      skipped: false,
      error: is429 ? null : String(e.message),
      lastSyncAt: store.lastSyncAt(),
      rateLimited: is429 || rateLimited,
      upgraded,
      remaining: store.pullPending().length
    };
  }
}

// server/championMeta.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, mkdirSync as mkdirSync3, existsSync as existsSync3 } from "node:fs";
import { dirname as dirname3, resolve as resolve3 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
var CACHE_FILE = resolve3(
  dirname3(fileURLToPath3("file:///worker.mjs")),
  "..",
  "data",
  "champion-meta.json"
);
var cache2 = null;
var inflight2 = /* @__PURE__ */ new Map();
function loadCache() {
  if (cache2) return cache2;
  try {
    if (existsSync3(CACHE_FILE)) {
      cache2 = JSON.parse(readFileSync2(CACHE_FILE, "utf8"));
      return cache2;
    }
  } catch {
  }
  cache2 = {};
  return cache2;
}
function saveCache() {
  try {
    const dir = dirname3(CACHE_FILE);
    if (!existsSync3(dir)) mkdirSync3(dir, { recursive: true });
    writeFileSync2(CACHE_FILE, JSON.stringify(cache2 ?? {}, null, 2), "utf8");
  } catch {
  }
}
function hasAnthropic2() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function sanitizeMeta(meta) {
  const synergies = (meta.synergies ?? []).map((s) => s.replace(/\s*\(duo\)/gi, "").replace(/\bduo\b/gi, "").replace(/\s{2,}/g, " ").trim()).filter((s) => s && !/dive\s*\/\s*tempo/i.test(s) && !/\btempo compositions?\b/i.test(s));
  return { ...meta, synergies };
}
var MetaSchema = external_exports.object({
  role: external_exports.string(),
  tier: external_exports.string(),
  difficulty: external_exports.string(),
  summary: external_exports.string(),
  strengths: external_exports.array(external_exports.string()),
  weaknesses: external_exports.array(external_exports.string()),
  powerSpikes: external_exports.array(external_exports.string()),
  goodInto: external_exports.array(external_exports.string()),
  strugglesInto: external_exports.array(external_exports.string()),
  synergies: external_exports.array(external_exports.string()),
  winConditions: external_exports.array(external_exports.string()),
  combos: external_exports.array(external_exports.string()),
  positioning: external_exports.string(),
  playRatings: external_exports.array(external_exports.object({ aspect: external_exports.string(), rating: external_exports.number() }))
});
var strArr = { type: "array", items: { type: "string" } };
var META_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    role: { type: "string" },
    tier: { type: "string" },
    difficulty: { type: "string" },
    summary: { type: "string" },
    strengths: strArr,
    weaknesses: strArr,
    powerSpikes: strArr,
    goodInto: strArr,
    strugglesInto: strArr,
    synergies: strArr,
    winConditions: strArr,
    combos: strArr,
    positioning: { type: "string" },
    playRatings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { aspect: { type: "string" }, rating: { type: "number" } },
        required: ["aspect", "rating"]
      }
    }
  },
  required: [
    "role",
    "tier",
    "difficulty",
    "summary",
    "strengths",
    "weaknesses",
    "powerSpikes",
    "goodInto",
    "strugglesInto",
    "synergies",
    "winConditions",
    "combos",
    "positioning",
    "playRatings"
  ]
};
var SYSTEM2 = `You are a Challenger-level League of Legends analyst. Given a champion, their primary role, and the current patch, produce a concise scouting brief for a player who mains them. Be specific and current-meta accurate.
Rules:
- role: the champion's primary competitive role in one word (Top, Jungle, Mid, Bot, Support).
- tier: a single letter meta tier for that role this patch (S, A, B, C, or D).
- difficulty: Low, Medium, or High.
- summary: one sentence on how the champion wins games.
- strengths / weaknesses: 3-4 short phrases each (not sentences).
- powerSpikes: 2-3 key spikes (levels/items), short phrases.
- goodInto / strugglesInto: 3-4 specific enemy champion names each (favorable / unfavorable matchups for this champion's role).
- synergies: 3-4 short items \u2014 name specific champions that pair well with this pick (for bot/support, name lane partners by champion name). Avoid vague phrases like "dive comps" or "tempo compositions".
- winConditions: 2-3 short imperative phrases the player should execute to win on this champion.
- combos: 2-3 concrete ability combos using ability letters (Q/W/E/R) and key items, short (e.g. "E in \u2192 Q \u2192 auto-reset \u2192 W").
- positioning: one short sentence on where to stand and what to do in a teamfight on this champion.
- playRatings: exactly these four aspects with a 1-5 integer rating of how strong the champion is at each \u2014 {"aspect":"Tower pushing","rating":N}, {"aspect":"Teamfighting","rating":N}, {"aspect":"Objectives","rating":N}, {"aspect":"Picks / roams","rating":N}.
Keep every item tight. No preamble.`;
async function generateMeta(champion, role, patch) {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1600,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: META_JSON_SCHEMA }
    },
    system: SYSTEM2,
    messages: [
      {
        role: "user",
        content: `Champion: ${champion}
Likely role: ${role}
Patch: ${patch}

Give me the scouting brief.`
      }
    ]
  });
  const text = res.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("no text output");
  const parsed = MetaSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("meta failed validation");
  return {
    champion,
    ...parsed.data,
    patch,
    generatedBy: "llm",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function fallbackMeta(champion, role, patch) {
  let tags = [];
  let title = "";
  try {
    const { champions } = await getChampions();
    const c = champions.find(
      (x) => x.name.toLowerCase() === champion.toLowerCase() || x.id.toLowerCase() === champion.toLowerCase()
    );
    tags = c?.tags ?? [];
    title = c?.title ?? "";
  } catch {
  }
  const primary = tags[0] ?? "Fighter";
  const kit = {
    Fighter: { s: ["Strong dueling", "Sustained damage", "Sticky to targets"], w: ["Kited by ranged", "Weak early", "Needs items"] },
    Tank: { s: ["Frontline + engage", "Peels for carries", "Objective control"], w: ["Low solo damage", "Needs a lead team", "Ignored in poke comps"] },
    Mage: { s: ["Wave control", "Burst / DPS", "Long range poke"], w: ["Squishy", "Cooldown reliant", "Dove easily"] },
    Assassin: { s: ["Snowball threat", "Picks side lanes", "High burst"], w: ["Falls off vs armor", "Team-reliant when behind", "Punished if caught"] },
    Marksman: { s: ["Scaling DPS", "Objective damage", "Range advantage"], w: ["Fragile", "Needs peel", "Weak pre-items"] },
    Support: { s: ["Vision + utility", "Enables carries", "Map control"], w: ["Low personal carry", "Gold-starved", "Punished off-position"] },
    Slayer: { s: ["Duel pressure", "Snowballs picks", "Mobile"], w: ["Squishier", "Needs a lead", "Kited"] }
  };
  const k = kit[primary] ?? kit.Fighter;
  return {
    champion,
    role,
    tier: "\u2014",
    difficulty: "Medium",
    summary: title ? `${champion}, ${title}.` : `${champion} plays as a ${primary.toLowerCase()}.`,
    strengths: k.s,
    weaknesses: k.w,
    powerSpikes: ["Level 6 (ultimate)", "First completed item", "Two-item spike"],
    goodInto: [],
    strugglesInto: [],
    synergies: [],
    winConditions: ["Play to your champion's strengths", "Snowball your advantage into objectives"],
    patch,
    generatedBy: "fallback",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function getChampionMeta(champion, role = "", opts = {}) {
  let patch = "current";
  try {
    patch = (await getChampions()).version;
  } catch {
  }
  const key = `${champion.toLowerCase()}|${patch}|v2`;
  const store2 = loadCache();
  if (!opts.refresh && store2[key]) return sanitizeMeta(store2[key]);
  if (inflight2.has(key)) return inflight2.get(key);
  const job = (async () => {
    let meta;
    if (hasAnthropic2()) {
      try {
        meta = await generateMeta(champion, role || "unknown", patch);
      } catch (e) {
        console.warn("Champion meta LLM failed, using fallback:", e.message);
        meta = await fallbackMeta(champion, role, patch);
      }
    } else {
      meta = await fallbackMeta(champion, role, patch);
    }
    if (meta.generatedBy === "llm") {
      store2[key] = meta;
      cache2 = store2;
      saveCache();
    }
    return sanitizeMeta(meta);
  })().finally(() => inflight2.delete(key));
  inflight2.set(key, job);
  return job;
}

// server/blockReview.ts
function avg5(xs) {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}
var GAIN_STATS = [
  { key: "process", label: "Performance", unit: "", dir: "higher", pick: (m) => m.process.score },
  { key: "kda", label: "KDA", unit: "", dir: "higher", pick: (m) => {
    const o = m.objective;
    return o.deaths != null ? Math.round((o.kills + o.assists) / Math.max(1, o.deaths) * 100) / 100 : null;
  } },
  { key: "kp", label: "Kill participation", unit: "%", dir: "higher", pick: (m) => m.objective.killParticipation != null ? Math.round(m.objective.killParticipation * 100) : null },
  { key: "cs10", label: "CS @ 10", unit: "", dir: "higher", pick: (m) => m.objective.csAt10 ?? null },
  { key: "deaths", label: "Deaths / game", unit: "", dir: "lower", pick: (m) => m.objective.deaths ?? null },
  { key: "deaths15", label: "Deaths before 15", unit: "", dir: "lower", pick: (m) => m.objective.deathsBefore15 ?? null },
  { key: "gold15", label: "Gold @ 15", unit: "", dir: "higher", pick: (m) => m.objective.goldDiffAt15 ?? null },
  { key: "dmgshare", label: "Damage share", unit: "%", dir: "higher", pick: (m) => m.objective.teamDamageShare != null ? Math.round(m.objective.teamDamageShare * 100) : null }
];
function computeStatGains(blockGames, priorGames) {
  const mean = (ms, pick) => {
    const v = ms.map(pick).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const r1 = (n) => Math.round(n * 10) / 10;
  const gains = [];
  for (const s of GAIN_STATS) {
    const after = mean(blockGames, s.pick);
    if (after == null) continue;
    const before = mean(priorGames, s.pick);
    const delta = before == null ? 0 : r1(after - before);
    const better = before == null ? true : s.dir === "higher" ? after >= before : after <= before;
    const rel = before == null ? 0 : Math.abs(delta) / Math.max(1, Math.abs(before));
    gains.push({ key: s.key, label: s.label, unit: s.unit, before: before == null ? null : r1(before), after: r1(after), delta, better, rel });
  }
  return gains.sort((a, b) => Number(b.better) - Number(a.better) || b.rel - a.rel).slice(0, 5).map(({ rel, ...g }) => g);
}
function buildBlockReview(seasonId) {
  const season = store.getSeason(seasonId);
  if (!season) return null;
  const pool = store.activePool();
  const career = enrichAll(store.matches(), store.seasons(), pool);
  const games = career.filter((m) => matchInBlock(m, season));
  const goals = store.goalsForSeason(season.id).map((g) => evaluateGoal(g, games));
  const wins = games.filter((m) => m.objective.win).length;
  const losses = games.filter((m) => m.objective.win === false).length;
  const WINDOW2 = 5;
  const progression = games.map((m, i) => {
    const from = Math.max(0, i - WINDOW2 + 1);
    const slice = games.slice(from, i + 1);
    return {
      index: i + 1,
      playedAt: m.playedAt,
      process: m.process.score,
      processAvg: Math.round(slice.reduce((a, x) => a + x.process.score, 0) / slice.length),
      win: m.objective.win ?? null,
      champion: m.objective.champion ?? null
    };
  });
  const third = Math.max(1, Math.floor(games.length / 3));
  const startProcess = avg5(games.slice(0, third).map((m) => m.process.score));
  const recentProcess = avg5(games.slice(-third).map((m) => m.process.score));
  const startedAt = +new Date(season.startedAt);
  const priorGames = career.filter((m) => +new Date(m.playedAt) < startedAt);
  const statGains = computeStatGains(games, priorGames);
  return {
    season,
    isActive: store.settings().activeSeasonId === season.id,
    games: games.length,
    target: season.targetGames,
    wins,
    losses,
    winRate: wins + losses ? Math.round(wins / (wins + losses) * 100) : 0,
    netLp: games.reduce((a, m) => a + (m.objective.lpDelta ?? 0), 0),
    avgProcess: avg5(games.map((m) => m.process.score)) ?? 0,
    startProcess,
    recentProcess,
    goals,
    progression,
    champions: buildChampionStats(games, pool),
    matches: [...games].reverse(),
    statGains
  };
}
function buildBlockSummaries() {
  const pool = store.activePool();
  const career = enrichAll(store.matches(), store.seasons(), pool);
  const activeId = store.settings().activeSeasonId;
  return store.seasons().map((season) => {
    const games = career.filter((m) => matchInBlock(m, season));
    const rawGoals = store.goalsForSeason(season.id);
    const goals = rawGoals.map((g) => evaluateGoal(g, games));
    const wins = games.filter((m) => m.objective.win).length;
    const losses = games.filter((m) => m.objective.win === false).length;
    let kind = "general";
    const champ = season.focusChampion ?? null;
    if (champ) kind = "champion";
    else {
      const cats = new Set(rawGoals.map((g) => g.category));
      if (cats.has("objectives")) kind = "objectives";
      else if (cats.has("vision")) kind = "vision";
      else if (cats.has("survival")) kind = "survival";
      else if (cats.has("farm")) kind = "farm";
      else if (cats.has("aggression")) kind = "carry";
    }
    return {
      season,
      isActive: season.id === activeId,
      games: games.length,
      target: season.targetGames,
      wins,
      losses,
      winRate: wins + losses ? Math.round(wins / (wins + losses) * 100) : 0,
      avgProcess: avg5(games.map((m) => m.process.score)) ?? 0,
      goalsMet: goals.filter((g) => g.met).length,
      goalsTotal: goals.length,
      goals: goals.map((g) => ({
        title: g.goal.title,
        current: g.current,
        target: g.goal.target,
        direction: g.goal.direction,
        unit: g.goal.unit,
        pct: g.pct,
        met: g.met
      })).sort((a, b) => Number(a.met) - Number(b.met) || b.pct - a.pct),
      imagery: { kind, champion: champ }
    };
  });
}

// server/blockPlan.ts
var idFor = (want) => IDENTITIES.find((i) => i.id === want)?.id ?? IDENTITIES[0].id;
var CANDIDATES = {
  champion: ["champion_focus", "positive_games", "carry_games", "clean_lane_games", "disciplined_games", "cs10", "kill_participation", "champion_winrate"],
  carry: ["carry_games", "positive_games", "kill_participation", "solo_kills", "gold_diff_15", "disciplined_games"],
  survival: ["clean_lane_games", "disciplined_games", "deaths_before_15", "deaths_per_game", "deathless_openings", "positive_games"],
  farm: ["cs10", "cs_per_min", "clean_lane_games", "gold_diff_15", "positive_games", "disciplined_games"],
  objectives: ["objective_games", "objectives", "vision_per_min", "kill_participation", "positive_games", "disciplined_games"],
  vision: ["vision_per_min", "objective_games", "disciplined_games", "clean_lane_games", "positive_games", "kill_participation"],
  general: ["positive_games", "disciplined_games", "win_count", "clean_lane_games", "avg_process", "carry_games"]
};
var ACHIEVEMENTS2 = /* @__PURE__ */ new Set([
  "positive_games",
  "carry_games",
  "clean_lane_games",
  "deathless_openings",
  "disciplined_games",
  "comeback_wins",
  "objective_games",
  "win_count"
]);
var ARAM_CANDIDATES = {
  champion: ["champion_focus", "positive_games", "carry_games", "damage_share", "kill_participation", "champion_winrate"],
  carry: ["carry_games", "positive_games", "damage_share", "kill_participation", "disciplined_games"],
  survival: ["disciplined_games", "deaths_per_game", "positive_games", "carry_games"],
  farm: ["cs_per_min", "positive_games", "disciplined_games", "carry_games"],
  objectives: ["kill_participation", "carry_games", "positive_games", "damage_share"],
  vision: ["disciplined_games", "positive_games", "kill_participation", "carry_games"],
  general: ["positive_games", "disciplined_games", "win_count", "carry_games", "avg_process", "damage_share"]
};
var REF = {
  cs10: 75,
  cs_per_min: 7,
  deaths: 4,
  deaths_before_15: 1.5,
  kill_participation: 60,
  solo_kills: 1.5,
  gold_diff_15: 300,
  objectives: 5,
  vision_per_min: 1.2,
  avg_process: 65,
  damage_share: 25
};
function needScore(templateId, baselines) {
  const key = baselineKeyFor(templateId);
  if (!key) return ACHIEVEMENTS2.has(templateId) ? 0.6 : 0.55;
  const b = baselines[key];
  if (b == null) return 0.5;
  const ref = REF[key];
  if (ref == null) return 0.5;
  const tpl = getTemplate(templateId);
  const gap = tpl.direction === "higher" ? (ref - b) / ref : (b - ref) / Math.max(1, ref);
  return Math.max(0.05, Math.min(1, gap + 0.15));
}
function buildProposed(templateId, champ, baselines) {
  const tpl = getTemplate(templateId);
  if (!tpl) return null;
  const key = baselineKeyFor(templateId);
  const baseline = key ? baselines[key] ?? null : null;
  let target = tpl.defaultTarget;
  if (key && baseline != null) target = personalizedTarget(key, baseline);
  const champion = tpl.needsChampion ? champ : null;
  return {
    templateId,
    title: tpl.title(champion),
    description: tpl.describe(target, champion),
    whatCounts: WHAT_COUNTS[templateId] ?? null,
    category: tpl.category,
    unit: tpl.unit,
    direction: tpl.direction,
    target,
    baseline,
    champion
  };
}
var META = {
  champion: { name: (c) => `${c ?? "Champion"} mastery block`, theme: "Stack reps and turn them into clean, winning games.", goal: "Get consistent and dangerous on this pick.", identity: "lane_bully", games: 20 },
  carry: { name: () => "Carry harder block", theme: "Stop hoping the team carries \u2014 take games over yourself.", goal: "Turn good games into carried games.", identity: "lane_bully", games: 24 },
  survival: { name: () => "Stop dying block", theme: "Respect the map. Stay alive long enough to matter.", goal: "Cut the throws \u2014 fewer deaths, cleaner starts.", identity: "stonewall", games: 24 },
  farm: { name: () => "Farm floor block", theme: "Gold you can manufacture yourself, every game.", goal: "Build a repeatable farming floor.", identity: "lane_bully", games: 24 },
  objectives: { name: () => "Objective control block", theme: "Win the map, not just the lane.", goal: "Play around drakes, heralds, and barons on purpose.", identity: "shotcaller_monk", games: 24 },
  vision: { name: () => "Light up the map block", theme: "You can't make good calls in the dark.", goal: "Pay the vision tax and make cleaner decisions.", identity: "shotcaller_monk", games: 24 },
  general: { name: () => "Consistency block", theme: "String together clean, disciplined games.", goal: "Raise your floor \u2014 fewer throws, more positive games.", identity: "stonewall", games: 25 }
};
var fmtBaseline = (key, b) => key === "kill_participation" ? `${Math.round(b)}%` : `${b}`;
function generateBlockPlan(pitch) {
  const champ = pitch.champion?.trim() || null;
  const blockType = pitch.blockType ?? "ranked";
  const aram = blockType === "aram";
  const area = pitch.focus || (champ ? "champion" : "general");
  const pool = store.activePool();
  const career = enrichAll(store.matches(), store.seasons(), pool);
  const champCareer = champ ? career.filter((m) => m.objective.champion?.toLowerCase() === champ.toLowerCase()) : career;
  const baselines = computeBaselines(champ && champCareer.length >= 4 ? champCareer : career);
  const pool_ = aram ? ARAM_CANDIDATES : CANDIDATES;
  let candidates = [...pool_[area] ?? pool_.general];
  if (champ && area !== "champion") candidates = ["champion_focus", ...candidates];
  candidates = [...new Set(candidates)];
  const pinnedSet = /* @__PURE__ */ new Set();
  if (candidates.includes("champion_focus")) pinnedSet.add("champion_focus");
  const baselineLead = candidates.find((id) => baselineKeyFor(id));
  if (baselineLead) pinnedSet.add(baselineLead);
  const ranked = candidates.filter((id) => !pinnedSet.has(id)).map((id) => ({ id, n: needScore(id, baselines) })).sort((a, b) => b.n - a.n).map((r) => r.id);
  let picks = [...pinnedSet, ...ranked].slice(0, 4);
  if (!picks.some((id) => ACHIEVEMENTS2.has(id))) picks = [...picks.slice(0, 3), "positive_games"];
  const goals = picks.map((id) => buildProposed(id, champ, baselines)).filter((g) => g !== null);
  const meta = META[area] ?? META.general;
  let name = meta.name(champ);
  if (champ && area !== "champion") name = `${champ}: ${meta.name(champ).toLowerCase()}`;
  if (aram && !/aram/i.test(name)) name = `ARAM ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  const cited = goals.map((g) => {
    const key = baselineKeyFor(g.templateId);
    if (key && g.baseline != null) return `${g.title.toLowerCase()} (you're at ${fmtBaseline(key, g.baseline)}, aiming ${g.target})`;
    return null;
  }).filter(Boolean).slice(0, 2);
  const rationale = champ && champCareer.length >= 4 ? `Read off your last ${champCareer.length} games on ${champ}. ${cited.length ? "Biggest gaps: " + cited.join("; ") + "." : "Focused on turning reps into wins."}` : cited.length ? `Aimed at your current leaks: ${cited.join("; ")}.` : "Built to raise your floor with mostly achievement goals you can't grind out.";
  return {
    name,
    theme: meta.theme,
    goal: meta.goal,
    rationale,
    blockType,
    targetGames: meta.games,
    focusChampion: champ,
    identityId: idFor(meta.identity),
    focus: area,
    goals
  };
}

// server/summoner.ts
var NEUTRAL = {
  grade: "C",
  tiltBefore: 0,
  tiltAfter: 0,
  biggestMistake: "",
  firstDeathCause: null,
  bestDecision: "",
  oneAdjustment: "",
  doomedCollapse: false,
  flamed: false,
  mutedAppropriately: true,
  reviewed: false
};
var CACHE_TTL_MS = 5 * 60 * 1e3;
var cache3 = /* @__PURE__ */ new Map();
var uuid2 = () => globalThis.crypto.randomUUID();
async function lookupSummoner(gameName, tagLine, platform) {
  const key = `${gameName}#${tagLine}|${platform}`.toLowerCase();
  const hit = cache3.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.profile;
  const apiKey = process.env.RIOT_API_KEY;
  const base = {
    gameName,
    tagLine,
    platform,
    found: false,
    level: null,
    profileIconId: null,
    tier: null,
    division: null,
    leaguePoints: null,
    games: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    aramMode: false,
    statBoard: [],
    champions: [],
    recentMatches: [],
    rateLimited: false,
    error: null
  };
  if (!apiKey) return { ...base, error: "Riot API key not configured on the server." };
  const client = new RiotClient(apiKey, gameName, tagLine, platform);
  let rateLimited = false;
  try {
    const puuid = await client.getPuuid();
    let rank = {};
    try {
      rank = await client.getRank(puuid);
    } catch {
    }
    let info = { level: null, profileIconId: null };
    try {
      info = await client.getSummonerInfo(puuid);
    } catch {
    }
    const ids = [];
    try {
      ids.push(...await client.getRecentMatchIds(puuid, 6, 420));
    } catch (e) {
      if (e instanceof RiotError && e.status === 429) rateLimited = true;
    }
    if (!rateLimited) {
      try {
        ids.push(...await client.getRecentMatchIds(puuid, 4, 450));
      } catch (e) {
        if (e instanceof RiotError && e.status === 429) rateLimited = true;
      }
    }
    const enriched = [];
    for (const id of ids.slice(0, 12)) {
      if (rateLimited) break;
      try {
        const objective = await client.getObjectiveData(id, puuid);
        if (rank.tier && (objective.queue?.includes("RANKED") ?? false)) {
          objective.tier = rank.tier;
          objective.division = rank.division;
          objective.leaguePoints = rank.leaguePoints;
        }
        const match2 = {
          id: uuid2(),
          seasonId: null,
          playedAt: objective.playedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
          loggedAt: (/* @__PURE__ */ new Date()).toISOString(),
          source: "riot",
          objective,
          scorecard: { ...NEUTRAL }
        };
        enriched.push(enrichMatch(match2, null, []));
      } catch (e) {
        if (e instanceof RiotError && e.status === 429) {
          rateLimited = true;
          break;
        }
      }
    }
    enriched.sort((a, b) => +new Date(a.playedAt) - +new Date(b.playedAt));
    const wins = enriched.filter((m) => m.objective.win).length;
    const losses = enriched.filter((m) => m.objective.win === false).length;
    const aramCount = enriched.filter((m) => (m.objective.queue ?? "").toUpperCase().includes("ARAM")).length;
    const aramMode = enriched.length > 0 && aramCount > enriched.length / 2;
    const profile = {
      ...base,
      found: true,
      level: info.level,
      profileIconId: info.profileIconId,
      aramMode,
      statBoard: buildStatBoard(enriched, aramMode ? "aram" : "sr"),
      tier: rank.tier ?? null,
      division: rank.division ?? null,
      leaguePoints: rank.leaguePoints ?? null,
      games: enriched.length,
      wins,
      losses,
      winRate: wins + losses ? Math.round(wins / (wins + losses) * 100) : 0,
      champions: buildChampionStats(enriched, []),
      recentMatches: [...enriched].reverse(),
      rateLimited,
      error: rateLimited && enriched.length === 0 ? "Riot rate limit hit \u2014 try again in a moment." : null
    };
    cache3.set(key, { at: Date.now(), profile });
    return profile;
  } catch (e) {
    if (e instanceof RiotError && e.status === 404) {
      return { ...base, error: `No Riot account found for ${gameName}#${tagLine} on ${platform.toUpperCase()}.` };
    }
    return { ...base, error: String(e.message), rateLimited };
  }
}

// server/matchAnalysis.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3, mkdirSync as mkdirSync4, existsSync as existsSync4 } from "node:fs";
import { dirname as dirname4, resolve as resolve4 } from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";
var CACHE_FILE2 = resolve4(
  dirname4(fileURLToPath4("file:///worker.mjs")),
  "..",
  "data",
  "match-analysis.json"
);
var cache4 = null;
var inflight3 = /* @__PURE__ */ new Map();
function loadCache2() {
  if (cache4) return cache4;
  try {
    if (existsSync4(CACHE_FILE2)) {
      cache4 = JSON.parse(readFileSync3(CACHE_FILE2, "utf8"));
      return cache4;
    }
  } catch {
  }
  cache4 = {};
  return cache4;
}
function saveCache2() {
  try {
    const dir = dirname4(CACHE_FILE2);
    if (!existsSync4(dir)) mkdirSync4(dir, { recursive: true });
    writeFileSync3(CACHE_FILE2, JSON.stringify(cache4 ?? {}, null, 2), "utf8");
  } catch {
  }
}
function hasAnthropic3() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
var DraftSchema = external_exports.object({
  score: external_exports.number(),
  label: external_exports.string(),
  notes: external_exports.array(external_exports.string())
});
var AnalysisSchema = external_exports.object({
  buildScore: external_exports.number(),
  buildVerdict: external_exports.string(),
  buildNotes: external_exports.array(external_exports.string()),
  myTeam: DraftSchema,
  enemyTeam: DraftSchema,
  matchup: external_exports.string()
});
var strArr2 = { type: "array", items: { type: "string" } };
var draftJson = {
  type: "object",
  additionalProperties: false,
  properties: { score: { type: "number" }, label: { type: "string" }, notes: strArr2 },
  required: ["score", "label", "notes"]
};
var ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    buildScore: { type: "number" },
    buildVerdict: { type: "string" },
    buildNotes: strArr2,
    myTeam: draftJson,
    enemyTeam: draftJson,
    matchup: { type: "string" }
  },
  required: ["buildScore", "buildVerdict", "buildNotes", "myTeam", "enemyTeam", "matchup"]
};
var SYSTEM3 = `You are a Challenger-level League of Legends coach grading one game's item build and both teams' drafts. Be specific, current-meta accurate, and honest.

Grade the player's BUILD (0-100):
- Compare to the standard high-winrate build for that champion/role this patch.
- Reward situational adaptation to the ENEMY comp: armor vs AD-heavy, magic resist vs AP-heavy, anti-heal (Executioner's/Mortal Reminder/Chempunk/Morellonomicon) vs sustain, tenacity/Mercs vs heavy CC, Maw/hexdrinker vs burst.
- buildVerdict: 2-4 words, e.g. "Standard & adapted", "Missing anti-heal", "Off-meta path".
- buildNotes: 2-4 short bullets \u2014 what was right, what was missing given the enemy comp. No preamble.

Grade each TEAM's DRAFT (0-100) on: frontline/backline balance, engage + disengage, peel, damage-type mix (AD/AP), crowd control, and scaling. label: 1-3 words. notes: 2-3 short bullets naming the key strengths/holes (reference champions).

matchup: one sentence \u2014 which draft is favored and the main reason.

For ARAM: there's no role, no lane; judge the build for a single-lane teamfight brawl and the draft on poke/engage/sustain/teamfight. Keep every string tight.`;
async function generate2(input) {
  const client = new Anthropic();
  const isAram2 = input.queue.toUpperCase().includes("ARAM");
  const comp = (t) => t.map((p) => isAram2 ? p.champion : `${p.champion} (${p.role})`).join(", ");
  const prompt = [
    `Patch: ${input.patch}`,
    `Queue: ${isAram2 ? "ARAM (Howling Abyss)" : input.queue}`,
    `Result: ${input.win ? "Win" : "Loss"}`,
    ``,
    `YOU: ${input.me.champion}${isAram2 ? "" : ` (${input.me.role})`}`,
    `Your build (in order): ${input.me.items.join(", ") || "no items"}`,
    input.me.keystone ? `Keystone: ${input.me.keystone}` : ``,
    input.me.spells.length ? `Summoners: ${input.me.spells.join(" + ")}` : ``,
    ``,
    `Your team: ${comp(input.myTeam)}`,
    `Enemy team: ${comp(input.enemyTeam)}`,
    ``,
    `Grade the build and both drafts.`
  ].filter(Boolean).join("\n");
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1800,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: ANALYSIS_JSON_SCHEMA }
    },
    system: SYSTEM3,
    messages: [{ role: "user", content: prompt }]
  });
  const text = res.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("no text output");
  const parsed = AnalysisSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("analysis failed validation");
  const clamp2 = (n) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    found: true,
    champion: input.me.champion,
    buildScore: clamp2(parsed.data.buildScore),
    buildVerdict: parsed.data.buildVerdict,
    buildNotes: parsed.data.buildNotes,
    myTeam: { ...parsed.data.myTeam, score: clamp2(parsed.data.myTeam.score) },
    enemyTeam: { ...parsed.data.enemyTeam, score: clamp2(parsed.data.enemyTeam.score) },
    matchup: parsed.data.matchup,
    generatedBy: "llm",
    error: null
  };
}
function fallback(input) {
  const items = input.me.items.length;
  return {
    found: true,
    champion: input.me.champion,
    buildScore: Math.min(100, 40 + items * 9),
    buildVerdict: items >= 5 ? "Full build" : "Build in progress",
    buildNotes: [
      `Completed ${items} item${items === 1 ? "" : "s"} this game.`,
      "Add an Anthropic API key for a build graded against the enemy comp."
    ],
    myTeam: { score: 50, label: "Not graded", notes: ["Draft grading needs an Anthropic API key."] },
    enemyTeam: { score: 50, label: "Not graded", notes: [] },
    matchup: "Draft comparison needs an Anthropic API key.",
    generatedBy: "fallback",
    error: null
  };
}
async function getMatchAnalysis(input, opts = {}) {
  const key = `${input.matchId}|${input.patch}`;
  const store2 = loadCache2();
  if (!opts.refresh && store2[key]) return store2[key];
  if (inflight3.has(key)) return inflight3.get(key);
  const job = (async () => {
    let out;
    if (hasAnthropic3()) {
      try {
        out = await generate2(input);
      } catch (e) {
        console.warn("Match analysis LLM failed, using fallback:", e.message);
        out = fallback(input);
      }
    } else {
      out = fallback(input);
    }
    if (out.generatedBy === "llm") {
      store2[key] = out;
      cache4 = store2;
      saveCache2();
    }
    return out;
  })().finally(() => inflight3.delete(key));
  inflight3.set(key, job);
  return job;
}

// server/stats.ts
var def6 = (x) => x !== null && x !== void 0;
var mins2 = (m) => m.objective.durationSec ? m.objective.durationSec / 60 : null;
var round2 = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
var kdaOf3 = (m) => {
  const { kills, deaths, assists } = m.objective;
  return kills != null && deaths != null && assists != null ? (kills + assists) / Math.max(1, deaths) : null;
};
var objsOf2 = (m) => {
  const o = m.objective;
  if (o.dragons == null && o.heralds == null && o.barons == null) return null;
  return (o.dragons ?? 0) + (o.heralds ?? 0) + (o.barons ?? 0);
};
var adv = (m) => m.objective.adv;
var advNum = (m, k) => {
  const v = adv(m)?.[k];
  return v == null ? null : v;
};
var multikillsOf = (m) => {
  const a = adv(m);
  if (!a || a.doubleKills == null && a.tripleKills == null && a.quadraKills == null && a.pentaKills == null) return null;
  return (a.doubleKills ?? 0) + (a.tripleKills ?? 0) + (a.quadraKills ?? 0) + (a.pentaKills ?? 0);
};
var phaseTotal = (m) => {
  const a = adv(m);
  if (!a || a.dmgEarly == null) return null;
  return (a.dmgEarly ?? 0) + (a.dmgMid ?? 0) + (a.dmgLate ?? 0);
};
var STATS = {
  kda: { key: "kda", label: "KDA", unit: "", direction: "higher", benchKey: "kda", pick: kdaOf3, hint: "(Kills + Assists) \xF7 Deaths, averaged." },
  kp: { key: "kp", label: "Kill participation", unit: "%", direction: "higher", benchKey: "kp", pick: (m) => m.objective.killParticipation != null ? m.objective.killParticipation * 100 : null, hint: "Your share of the team's kills (K+A \xF7 team kills)." },
  solo: { key: "solo", label: "Solo kills", unit: "", direction: "higher", benchKey: "solo", pick: (m) => m.objective.soloKills ?? null, hint: "Kills you get with no ally assisting." },
  dmgMin: { key: "dmgMin", label: "Damage / min", unit: "", direction: "higher", ref: 620, pick: (m) => {
    const mm = mins2(m);
    return m.objective.damageToChampions != null && mm ? m.objective.damageToChampions / mm : null;
  }, hint: "Champion damage per minute." },
  dmgShare: { key: "dmgShare", label: "Damage share", unit: "%", direction: "higher", ref: 22, pick: (m) => m.objective.teamDamageShare != null ? m.objective.teamDamageShare * 100 : null, hint: "Your champion damage as a share of your team's." },
  cs10: { key: "cs10", label: "CS @ 10", unit: "", direction: "higher", benchKey: "cs10", pick: (m) => m.objective.csAt10 ?? null, hint: "Creep score at the 10-minute mark." },
  csMin: { key: "csMin", label: "CS / min", unit: "", direction: "higher", ref: 6.5, pick: (m) => {
    const mm = mins2(m);
    return m.objective.totalCs != null && mm ? m.objective.totalCs / mm : null;
  }, hint: "Total CS \xF7 minutes played." },
  gold15: { key: "gold15", label: "Gold @ 15", unit: "g", direction: "higher", benchKey: "gold15", pick: (m) => m.objective.goldDiffAt15 ?? null, hint: "Your gold minus your lane opponent's at 15." },
  vision: { key: "vision", label: "Vision / min", unit: "", direction: "higher", benchKey: "vision", pick: (m) => {
    const mm = mins2(m);
    return m.objective.visionScore != null && mm ? m.objective.visionScore / mm : null;
  }, hint: "Vision score \xF7 minutes played." },
  deaths15: { key: "deaths15", label: "Deaths before 15", unit: "", direction: "lower", benchKey: "deaths15", pick: (m) => m.objective.deathsBefore15 ?? null, hint: "Deaths you take before 15 minutes." },
  deathsGame: { key: "deathsGame", label: "Deaths / game", unit: "", direction: "lower", ref: 5, pick: (m) => m.objective.deaths ?? null, hint: "Total deaths per game." },
  firstDeath: { key: "firstDeath", label: "First death", unit: "s", direction: "higher", ref: 480, pick: (m) => m.objective.firstDeathSec ?? null, hint: "When your first death lands \u2014 later is better." },
  obj: { key: "obj", label: "Team objectives", unit: "", direction: "higher", benchKey: "obj", pick: objsOf2, hint: "Dragons + heralds + barons your team secures." },
  // --- Deep tree (from the match `challenges` block + timeline) ---
  multi: { key: "multi", label: "Multi-kills", unit: "", direction: "higher", ref: 0.7, pick: multikillsOf, hint: "Double-kills and up, per game." },
  duelWR: { key: "duelWR", label: "Duel win rate", unit: "%", direction: "higher", ref: 50, pick: () => null, rate: { num: (m) => advNum(m, "duelWins"), den: (m) => advNum(m, "duels") }, hint: "1v1 fights your team came out ahead in." },
  skirmishWR: { key: "skirmishWR", label: "Skirmish win rate", unit: "%", direction: "higher", ref: 50, pick: () => null, rate: { num: (m) => advNum(m, "skirmishWins"), den: (m) => advNum(m, "skirmishes") }, hint: "Small fights (3\u20135 champs) your team won." },
  teamfightWR: { key: "teamfightWR", label: "Teamfight win rate", unit: "%", direction: "higher", ref: 50, pick: () => null, rate: { num: (m) => advNum(m, "teamfightWins"), den: (m) => advNum(m, "teamfights") }, hint: "Big fights (6+ champs) your team won." },
  plates: { key: "plates", label: "Turret plates", unit: "", direction: "higher", ref: 1.5, pick: (m) => advNum(m, "turretPlates"), hint: "Turret plating gold you take, per game." },
  ctrlWards: { key: "ctrlWards", label: "Control wards", unit: "", direction: "higher", ref: 3, pick: (m) => advNum(m, "controlWards"), hint: "Control/pink wards placed, per game." },
  wardsKilled: { key: "wardsKilled", label: "Wards cleared", unit: "", direction: "higher", ref: 3, pick: (m) => advNum(m, "wardsKilled"), hint: "Enemy wards you destroy, per game." },
  dragonTD: { key: "dragonTD", label: "Dragon takedowns", unit: "", direction: "higher", ref: 1.6, pick: (m) => advNum(m, "dragonTakedowns"), hint: "Dragons you help secure, per game." },
  baronTD: { key: "baronTD", label: "Baron takedowns", unit: "", direction: "higher", ref: 0.7, pick: (m) => advNum(m, "baronTakedowns"), hint: "Barons you help secure, per game." },
  grubTD: { key: "grubTD", label: "Void grub takedowns", unit: "", direction: "higher", ref: 3, pick: (m) => advNum(m, "grubTakedowns"), hint: "Void grubs you help secure, per game." },
  skillDodged: { key: "skillDodged", label: "Skillshots dodged", unit: "", direction: "higher", ref: 12, pick: (m) => advNum(m, "skillshotsDodged"), hint: "Enemy skillshots you sidestep, per game." },
  immob: { key: "immob", label: "Enemies CC'd", unit: "", direction: "higher", ref: 22, pick: (m) => advNum(m, "immobilizations"), hint: "Enemies you root/stun/knock, per game." },
  placement: { key: "placement", label: "Avg placement", unit: "", direction: "lower", ref: 4.5, pick: (m) => m.objective.placement ?? null, hint: "Where you finish (1 = won the lobby)." },
  dmgEarlyShare: { key: "dmgEarlyShare", label: "Early damage", unit: "%", direction: "higher", ref: 33, pick: () => null, rate: { num: (m) => advNum(m, "dmgEarly"), den: phaseTotal }, hint: "Share of your champ damage dealt before 14 min." },
  dmgMidShare: { key: "dmgMidShare", label: "Mid damage", unit: "%", direction: "higher", ref: 34, pick: () => null, rate: { num: (m) => advNum(m, "dmgMid"), den: phaseTotal }, hint: "Share of your champ damage dealt from 14\u201325 min." },
  dmgLateShare: { key: "dmgLateShare", label: "Late damage", unit: "%", direction: "higher", ref: 33, pick: () => null, rate: { num: (m) => advNum(m, "dmgLate"), den: phaseTotal }, hint: "Share of your champ damage dealt after 25 min." }
};
var DOMAINS = [
  { key: "fighting", label: "Fighting", icon: "ti-swords", stats: ["kda", "kp", "solo", "dmgMin", "multi"] },
  { key: "teamfights", label: "Teamfighting", icon: "ti-users-group", stats: ["duelWR", "skirmishWR", "teamfightWR"] },
  { key: "laning", label: "Laning", icon: "ti-map-pin", stats: ["cs10", "csMin", "gold15", "plates"] },
  { key: "vision", label: "Vision", icon: "ti-eye", stats: ["vision", "ctrlWards", "wardsKilled"] },
  { key: "survival", label: "Survivability", icon: "ti-shield-half", stats: ["deaths15", "deathsGame", "firstDeath"] },
  { key: "mechanics", label: "Mechanics", icon: "ti-target-arrow", stats: ["skillDodged", "immob"] },
  { key: "objectives", label: "Objectives", icon: "ti-topology-star-3", stats: ["obj", "dragonTD", "baronTD", "grubTD"] },
  { key: "teamImpact", label: "Team Impact", icon: "ti-users", stats: ["kp", "dmgShare"] },
  { key: "arena", label: "Arena", icon: "ti-trophy", stats: ["placement"] },
  // Descriptive: a profile of *when* your damage lands, not a grade — excluded
  // from the composite and never flagged as your weakest area.
  { key: "timing", label: "Damage timing", icon: "ti-clock-hour-4", stats: ["dmgEarlyShare", "dmgMidShare", "dmgLateShare"], scored: false }
];
var ARAM_STATS = /* @__PURE__ */ new Set([
  "kda",
  "kp",
  "dmgMin",
  "dmgShare",
  "csMin",
  "deathsGame",
  "multi",
  "duelWR",
  "skirmishWR",
  "teamfightWR",
  "skillDodged",
  "immob",
  "dmgEarlyShare",
  "dmgMidShare",
  "dmgLateShare"
]);
var ARENA_STATS = /* @__PURE__ */ new Set(["placement", "kda", "dmgMin", "multi", "deathsGame", "skillDodged", "immob"]);
function avg6(ms, pick) {
  const v = ms.map(pick).filter(def6);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function pctVs(value, benchmark, direction) {
  const mag = Math.max(1, Math.abs(benchmark));
  const imp = direction === "higher" ? value - benchmark : benchmark - value;
  return Math.max(4, Math.min(100, Math.round(50 + imp / mag * 50)));
}
function ladderFor(benchKey, value, direction) {
  const pts = RANK_KEYS.map((rk) => ({ rank: rankLabel(rk), value: round2(RANK_BENCH[rk][benchKey]) }));
  if (value != null) {
    let idx = pts.length;
    for (let i = 0; i < pts.length; i++) {
      const beats = direction === "higher" ? value < pts[i].value : value > pts[i].value;
      if (beats) {
        idx = i;
        break;
      }
    }
    pts.splice(idx, 0, { rank: "You", value: round2(value), isYou: true });
  }
  return pts;
}
var NON_SR = ["ARAM", "ARENA", "URF", "MAYHEM", "NEXUS", "ONE_FOR_ALL"];
var QUEUE_MATCH = {
  ranked_solo: (q) => q.includes("RANKED_SOLO"),
  ranked_flex: (q) => q.includes("RANKED_FLEX"),
  swiftplay: (q) => q.includes("SWIFTPLAY") || q.includes("QUICKPLAY"),
  draft: (q) => q.includes("DRAFT") || q.includes("BLIND"),
  aram: (q) => q.includes("ARAM") && !q.includes("MAYHEM"),
  arena: (q) => q.includes("ARENA"),
  sr: (q) => !NON_SR.some((t) => q.includes(t))
};
function buildStats(queue, role) {
  const ap = activeProfile();
  const pool = store.activePool();
  const career = enrichAll(store.matches(), store.seasons(), pool);
  const isAram2 = queue === "aram";
  const isArena = queue === "arena";
  const laddered = !isAram2 && !isArena;
  const match2 = QUEUE_MATCH[queue] ?? QUEUE_MATCH.sr;
  const inQueue = (m) => match2((m.objective.queue ?? "").toUpperCase());
  let games = career.filter(inQueue);
  const roles = [...new Set(games.map((m) => m.objective.role).filter((r) => !!r && r !== "UNKNOWN"))];
  if (role) games = games.filter((m) => m.objective.role === role);
  const empty = { found: false, composite: 0, rank: "", games: 0, queue, role, roles, domains: [] };
  if (games.length === 0) return empty;
  const { rank, bench } = benchFor(ap.isSelf ? store.profile().preferredRank : null, games.slice(-1)[0]?.objective.tier);
  const rankName = isArena ? "Arena avg" : isAram2 ? "ARAM avg" : rankLabel(rank);
  const buildTile = (statKey) => {
    const s = STATS[statKey];
    if (!s) return null;
    if (isAram2 && !ARAM_STATS.has(statKey)) return null;
    if (isArena && !ARENA_STATS.has(statKey)) return null;
    if (!isArena && statKey === "placement") return null;
    let value;
    if (s.rate) {
      let num = 0, den = 0;
      for (const m of games) {
        const n = s.rate.num(m), d = s.rate.den(m);
        if (n != null && d != null && d > 0) {
          num += n;
          den += d;
        }
      }
      value = den > 0 ? num / den * 100 : null;
    } else {
      value = avg6(games, s.pick);
    }
    const useLadder = laddered && !!s.benchKey;
    const benchmark = useLadder ? bench[s.benchKey] : s.ref ?? (s.benchKey ? bench[s.benchKey] : 50);
    const better = value != null && (s.direction === "higher" ? value >= benchmark : value <= benchmark);
    const pct2 = value != null ? pctVs(value, benchmark, s.direction) : 50;
    const ladder = useLadder ? ladderFor(s.benchKey, value != null ? round2(value) : null, s.direction) : null;
    return {
      key: s.key,
      label: s.label,
      value: value != null ? round2(value) : null,
      unit: s.unit,
      benchmark: round2(benchmark),
      direction: s.direction,
      better,
      pct: pct2,
      ladder,
      hint: s.hint
    };
  };
  const descriptive = new Set(DOMAINS.filter((d) => d.scored === false).map((d) => d.key));
  const domains = DOMAINS.map((d) => {
    const tiles = d.stats.map(buildTile).filter((t) => t !== null);
    const scored = tiles.filter((t) => t.value != null);
    if (scored.length === 0) return null;
    const score = Math.round(scored.reduce((a, t) => a + t.pct, 0) / scored.length);
    return { key: d.key, label: d.label, icon: d.icon, score, weakest: false, tiles };
  }).filter((d) => d !== null);
  const scoredDomains = domains.filter((d) => !descriptive.has(d.key) && d.tiles.some((t) => t.value != null));
  if (scoredDomains.length) {
    scoredDomains.reduce((a, b) => b.score < a.score ? b : a).weakest = true;
  }
  const composite = scoredDomains.length ? Math.round(scoredDomains.reduce((a, d) => a + d.score, 0) / scoredDomains.length) : 0;
  return { found: true, composite, rank: rankName, games: games.length, queue, role, roles, domains };
}

// server/achievements.ts
var TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
var ramp = (base, round3 = true) => {
  const raw = [base, base * 5, base * 15, base * 40, base * 100];
  return round3 ? raw.map((n) => n >= 1e3 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n)) : raw;
};
var kda = (m) => {
  const { kills, deaths, assists } = m.objective;
  return kills != null && deaths != null && assists != null ? (kills + assists) / Math.max(1, deaths) : 0;
};
var sum2 = (ms, pick) => ms.reduce((a, m) => a + (pick(m) ?? 0), 0);
var count2 = (ms, pred) => ms.filter(pred).length;
var max = (ms, pick) => ms.reduce((a, m) => Math.max(a, pick(m)), 0);
function longestWinStreak(ms) {
  let best2 = 0, cur = 0;
  for (const m of ms) {
    if (m.objective.win === true) {
      cur++;
      best2 = Math.max(best2, cur);
    } else if (m.objective.win === false) cur = 0;
  }
  return best2;
}
var DEFS3 = [
  // --- Consistency / volume ---
  { id: "games_played", name: "The Grind", description: "Play ranked and normal games \u2014 they all count.", category: "Dedication", icon: "ti-swords", unit: "games", tiers: ramp(10), value: (ms) => ms.length },
  { id: "wins", name: "Winner", description: "Win games. Simple as that.", category: "Dedication", icon: "ti-trophy", unit: "wins", tiers: ramp(8), value: (ms) => count2(ms, (m) => m.objective.win === true) },
  { id: "win_streak", name: "On Fire", description: "Win multiple games in a row.", category: "Dedication", icon: "ti-flame", unit: "in a row", tiers: [3, 5, 8, 12, 20], value: longestWinStreak },
  { id: "positive_games", name: "In the Green", description: "Finish games with more takedowns than deaths.", category: "Dedication", icon: "ti-arrow-up-right", unit: "games", tiers: ramp(10), value: (ms) => count2(ms, (m) => {
    const o = m.objective;
    return o.kills != null && o.deaths != null && o.assists != null && o.kills + o.assists > o.deaths;
  }) },
  // --- Combat ---
  { id: "total_kills", name: "Bloodthirsty", description: "Rack up champion kills across your career.", category: "Combat", icon: "ti-sword", unit: "kills", tiers: ramp(100), value: (ms) => sum2(ms, (m) => m.objective.kills) },
  { id: "total_assists", name: "Team Player", description: "Get in on your team's kills.", category: "Combat", icon: "ti-users-group", unit: "assists", tiers: ramp(120), value: (ms) => sum2(ms, (m) => m.objective.assists) },
  { id: "carry_games", name: "Hard Carry", description: "Take games over \u2014 60%+ KP and a 3+ KDA.", category: "Combat", icon: "ti-hand-finger", unit: "games", tiers: ramp(3), value: (ms) => count2(ms, (m) => (m.objective.killParticipation ?? 0) >= 0.6 && kda(m) >= 3) },
  { id: "high_kda_games", name: "Untouchable", description: "Finish games with a 5.0+ KDA.", category: "Combat", icon: "ti-shield-check", unit: "games", tiers: ramp(2), value: (ms) => count2(ms, (m) => kda(m) >= 5) },
  { id: "most_kills_game", name: "Killing Spree", description: "Most kills in a single game.", category: "Combat", icon: "ti-target", unit: "kills", tiers: [10, 16, 22, 28, 40], value: (ms) => max(ms, (m) => m.objective.kills ?? 0) },
  { id: "total_damage", name: "Damage Dealer", description: "Pile up damage to champions.", category: "Combat", icon: "ti-bolt", unit: "dmg", tiers: ramp(15e4), value: (ms) => sum2(ms, (m) => m.objective.damageToChampions) },
  // --- Farming ---
  { id: "total_cs", name: "Minion Slayer", description: "Last-hit minions and monsters.", category: "Farming", icon: "ti-coins", unit: "CS", tiers: ramp(1500), value: (ms) => sum2(ms, (m) => m.objective.totalCs) },
  { id: "cs10_games", name: "Wave Manager", description: "Hit 80+ CS by 10 minutes.", category: "Farming", icon: "ti-plant-2", unit: "games", tiers: ramp(2), value: (ms) => count2(ms, (m) => (m.objective.csAt10 ?? 0) >= 80) },
  // --- Objectives ---
  { id: "total_dragons", name: "Dragon Tamer", description: "Help your team stack dragons.", category: "Objectives", icon: "ti-flame", unit: "dragons", tiers: ramp(10), value: (ms) => sum2(ms, (m) => m.objective.dragons) },
  { id: "total_barons", name: "Baron Nasher", description: "Help your team take barons.", category: "Objectives", icon: "ti-skull", unit: "barons", tiers: ramp(5), value: (ms) => sum2(ms, (m) => m.objective.barons) },
  { id: "total_towers", name: "Siege Engine", description: "Bring down enemy turrets.", category: "Objectives", icon: "ti-tower", unit: "towers", tiers: ramp(10), value: (ms) => sum2(ms, (m) => m.objective.towers) },
  // --- Vision & survival ---
  { id: "total_vision", name: "All-Seeing", description: "Rack up vision score across games.", category: "Vision", icon: "ti-eye", unit: "vision", tiers: ramp(500), value: (ms) => Math.round(sum2(ms, (m) => m.objective.visionScore)) },
  { id: "deathless_openings", name: "Flawless Start", description: "Take zero deaths before 15 minutes.", category: "Survival", icon: "ti-shield-half", unit: "games", tiers: ramp(2), value: (ms) => count2(ms, (m) => m.objective.deathsBefore15 === 0) },
  { id: "comeback_wins", name: "Never Say Die", description: "Win games you were losing at 15 (down 1000+ gold).", category: "Survival", icon: "ti-heart-bolt", unit: "wins", tiers: ramp(1), value: (ms) => count2(ms, (m) => m.objective.win === true && (m.objective.goldDiffAt15 ?? 0) <= -1e3) },
  // --- Process / variety ---
  { id: "clean_games", name: "Textbook", description: "Post a 90+ performance score in a game.", category: "Mastery", icon: "ti-sparkles", unit: "games", tiers: ramp(1), value: (ms) => count2(ms, (m) => m.process.score >= 90) },
  { id: "best_process", name: "Perfect Game", description: "Your single best performance score.", category: "Mastery", icon: "ti-award", unit: "score", tiers: [70, 80, 90, 95, 100], value: (ms) => max(ms, (m) => m.process.score) },
  { id: "unique_champs", name: "Jack of All Champs", description: "Play different champions.", category: "Mastery", icon: "ti-layout-grid", unit: "champs", tiers: [5, 15, 30, 60, 100], value: (ms) => new Set(ms.map((m) => m.objective.champion).filter(Boolean)).size },
  { id: "roles_played", name: "Fill Diff", description: "Play every position on the map.", category: "Mastery", icon: "ti-map-pin", unit: "roles", tiers: [2, 3, 4, 5], value: (ms) => new Set(ms.map((m) => m.objective.role).filter((r) => r && r !== "UNKNOWN")).size }
];
function evaluate(def8, value) {
  let tier = 0;
  for (const t of def8.tiers) if (value >= t) tier++;
  const nextTarget = tier < def8.tiers.length ? def8.tiers[tier] : null;
  const prev = tier > 0 ? def8.tiers[tier - 1] : 0;
  const pct2 = nextTarget == null ? 100 : Math.max(0, Math.min(100, Math.round((value - prev) / (nextTarget - prev) * 100)));
  let xp = 0;
  for (let i = 1; i <= tier; i++) xp += i * 100;
  const nextTierXp = nextTarget == null ? 0 : (tier + 1) * 100;
  return {
    id: def8.id,
    name: def8.name,
    description: def8.description,
    category: def8.category,
    icon: def8.icon,
    unit: def8.unit,
    value: Math.round(value),
    tiers: def8.tiers,
    tierNames: def8.tiers.map((_, i) => TIER_NAMES[i] ?? `Tier ${i + 1}`),
    tier,
    nextTarget,
    pct: pct2,
    started: value > 0,
    xp,
    nextTierXp
  };
}
function buildAchievements(matches) {
  const pool = store.activePool();
  const career = enrichAll(matches ?? store.matches(), store.seasons(), pool);
  const achievements = DEFS3.map((d) => evaluate(d, d.value(career))).sort((a, b) => {
    const ap = a.tier + (a.nextTarget == null ? 1 : a.pct / 100);
    const bp = b.tier + (b.nextTarget == null ? 1 : b.pct / 100);
    if (Number(b.started) !== Number(a.started)) return Number(b.started) - Number(a.started);
    return bp - ap;
  });
  const xp = achievements.reduce((acc, a) => acc + a.xp, 0);
  const cumForLevel = (L) => 1500 * (L * (L + 1)) / 2;
  let level = 0;
  while (cumForLevel(level + 1) <= xp) level++;
  const base = cumForLevel(level);
  const next = cumForLevel(level + 1);
  const xpIntoLevel = xp - base;
  const xpForNext = next - base;
  return {
    found: career.length > 0,
    total: achievements.length,
    unlocked: achievements.filter((a) => a.tier >= 1).length,
    maxed: achievements.filter((a) => a.nextTarget == null).length,
    categories: [...new Set(DEFS3.map((d) => d.category))],
    achievements,
    level,
    xp,
    xpIntoLevel,
    xpForNext,
    levelPct: xpForNext ? Math.round(xpIntoLevel / xpForNext * 100) : 0
  };
}

// server/notifications.ts
var TIER_COLOR = ["#a9713f", "#9aa0a6", "#d6a24e", "#6f93a3", "#9b8bd0"];
var uuid3 = () => globalThis.crypto.randomUUID();
var now = () => (/* @__PURE__ */ new Date()).toISOString();
function make(type, title, body, icon, accent, link) {
  return { id: uuid3(), type, title, body, icon, accent, link, createdAt: now(), read: false };
}
function refreshNotifications() {
  const allMatches = store.allMatches();
  const ach = buildAchievements(allMatches);
  if (!ach.found) return [];
  const tiers = {};
  for (const a of ach.achievements) tiers[a.id] = a.tier;
  const level = ach.level;
  const pool = store.activePool();
  const career = enrichAll(allMatches, store.seasons(), pool);
  const metGoals = store.goals().filter((g) => g.status !== "archived").map((g) => ({ g, met: evaluateGoal(g, career).met })).filter((x) => x.met).map((x) => x.g.id);
  const seen = store.notifSeen();
  if (!seen) {
    store.setNotifSeen({ tiers, goals: metGoals, level });
    return [];
  }
  const fresh = [];
  for (const a of ach.achievements) {
    const prev = seen.tiers[a.id] ?? 0;
    if (a.tier > prev) {
      const tierName = a.tierNames[a.tier - 1] ?? `Tier ${a.tier}`;
      const first = prev === 0;
      fresh.push(
        make(
          "achievement",
          first ? "Achievement unlocked" : "Achievement leveled up",
          `${a.name} \u2014 ${tierName}`,
          a.icon,
          TIER_COLOR[Math.min(a.tier - 1, TIER_COLOR.length - 1)],
          `/achievements?focus=${a.id}`
        )
      );
    }
  }
  if (level > seen.level) {
    fresh.push(make("level", "Level up", `You reached Profile Level ${level}`, "ti-arrow-big-up-lines", "var(--gold)", "/achievements?focus=level"));
  }
  const seenGoals = new Set(seen.goals);
  const goalById = new Map(store.goals().map((g) => [g.id, g]));
  for (const id of metGoals) {
    if (!seenGoals.has(id)) {
      const g = goalById.get(id);
      if (g) {
        const link = g.champion ? `/champions/${encodeURIComponent(g.champion)}?focus=goals` : `/?focus=block`;
        fresh.push(make("goal", "Goal complete", g.title, "ti-target-arrow", "var(--green)", link));
      }
    }
  }
  store.setNotifSeen({ tiers, goals: metGoals, level });
  if (fresh.length) store.pushNotifications(fresh);
  return fresh;
}
function getNotifications() {
  refreshNotifications();
  const items = store.notifications();
  return { items, unread: items.filter((n) => !n.read).length };
}

// server/lcu.worker-stub.ts
async function readLiveState() {
  return {
    clientDetected: false,
    phase: "None",
    queueId: null,
    gameMode: null,
    source: null,
    mineKey: null,
    myRole: null,
    allies: [],
    enemies: []
  };
}

// server/liveCompanion.ts
var QUEUE_MODE = {
  420: { name: "Ranked Solo/Duo", hasLanes: true },
  440: { name: "Ranked Flex", hasLanes: true },
  400: { name: "Normal Draft", hasLanes: true },
  430: { name: "Normal Blind", hasLanes: true },
  480: { name: "Swiftplay", hasLanes: true },
  490: { name: "Quickplay", hasLanes: true },
  700: { name: "Clash", hasLanes: true },
  450: { name: "ARAM", hasLanes: false },
  1700: { name: "Arena", hasLanes: false },
  1710: { name: "Arena", hasLanes: false },
  900: { name: "ARURF", hasLanes: false },
  1900: { name: "URF", hasLanes: false },
  1300: { name: "Nexus Blitz", hasLanes: false }
};
var GAMEMODE_MODE = {
  CLASSIC: { name: "Summoner's Rift", hasLanes: true },
  ARAM: { name: "ARAM", hasLanes: false },
  CHERRY: { name: "Arena", hasLanes: false },
  URF: { name: "URF", hasLanes: false },
  ARURF: { name: "ARURF", hasLanes: false },
  NEXUSBLITZ: { name: "Nexus Blitz", hasLanes: false },
  ONEFORALL: { name: "One for All", hasLanes: true },
  ULTBOOK: { name: "Ultimate Spellbook", hasLanes: true },
  PRACTICETOOL: { name: "Practice Tool", hasLanes: true },
  TUTORIAL: { name: "Tutorial", hasLanes: true }
};
var AP_OVERRIDE = /* @__PURE__ */ new Set(["Akali", "Ekko", "Fizz", "Katarina", "Diana", "Evelynn", "Kassadin", "Kayle", "Mordekaiser", "Gwen", "Rumble", "Vladimir", "Teemo", "Singed", "Swain", "Cassiopeia", "Elise", "Gragas", "Lillia", "Sylas", "Vex", "Kennen", "Heimerdinger", "Zyra", "Brand", "Velkoz", "Xerath", "Karma", "Nidalee", "Zoe", "Neeko", "Ryze", "Aurora"]);
var HEALERS = /* @__PURE__ */ new Set(["Soraka", "Yuumi", "Nami", "Sona", "Vladimir", "Aatrox", "DrMundo", "Swain", "Sylas", "Warwick", "Nasus", "FiddleSticks", "Ivern", "Taric", "Senna", "Renekton", "Fiora", "Sett", "Briar", "Ambessa"]);
var HARD_CC = /* @__PURE__ */ new Set(["Leona", "Nautilus", "Morgana", "Thresh", "Blitzcrank", "Amumu", "Malphite", "Sejuani", "Ashe", "Rell", "Braum", "Alistar", "Maokai", "Lissandra", "Skarner", "Ornn", "JarvanIV", "Zac", "Vi", "Nunu", "Sett", "Sion", "Neeko", "Rakan", "Pyke", "Warwick", "Elise", "Jhin", "Varus", "Poppy", "Bard", "Syndra", "Ahri", "Lux", "Veigar", "TwistedFate", "Galio", "Gnar", "Camille", "KSante", "Renata", "Gragas", "Cassiopeia"]);
var ASSASSINS = /* @__PURE__ */ new Set(["Zed", "Talon", "Katarina", "Akali", "Fizz", "Diana", "Kassadin", "Qiyana", "Nocturne", "Rengar", "Khazix", "Kayn", "Naafiri", "Shaco", "Evelynn", "Pyke", "Yone"]);
var DIVERS = /* @__PURE__ */ new Set(["MasterYi", "Tryndamere", "Jax", "Belveth", "XinZhao", "Kled", "Warwick", "Udyr", "Yasuo", "Camille", "Vi", "MonkeyKing", "Olaf", "Skarner", "Kindred", "Viego", "Briar", "Ambessa"]);
function classify2(c) {
  if (!c) return { ad: false, ap: false, tank: false };
  const tags = c.tags ?? [];
  const tank = tags.includes("Tank");
  const ap = AP_OVERRIDE.has(c.id) || tags.includes("Mage") && !tags.includes("Marksman");
  let ad = tags.includes("Marksman") || (tags.includes("Fighter") || tags.includes("Assassin")) && !ap;
  if (!ad && !ap && !tank) ad = tags.includes("Fighter") || tags.includes("Assassin");
  return { ad, ap, tank };
}
function archetype(c) {
  if (!c) return "unknown";
  const t = c.tags ?? [];
  if (t.includes("Marksman")) return "marksman";
  if (t.includes("Assassin")) return "assassin";
  if (t.includes("Mage")) return t.includes("Support") ? "support" : "mage";
  if (t.includes("Tank")) return "tank";
  if (t.includes("Fighter")) return "fighter";
  if (t.includes("Support")) return "support";
  return "unknown";
}
var round14 = (n) => Math.round(n * 10) / 10;
var avg7 = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
var def7 = (x) => x != null;
var isLanelessQueue = (q) => /ARAM|ARENA|CHERRY|URF|NEXUS|ONEFORALL/i.test(q ?? "");
function buildMatchup(myChamp, enemyChamp, career, hasLanes, nameOf) {
  if (!myChamp) return null;
  const allOnChamp = career.filter((m) => m.objective.champion?.toLowerCase() === myChamp.toLowerCase());
  const family = allOnChamp.filter((m) => isLanelessQueue(m.objective.queue) === !hasLanes);
  const onChamp = family.length >= 2 ? family : allOnChamp;
  const champGames = onChamp.length;
  const vs = enemyChamp ? onChamp.filter((m) => (m.objective.opponentChampion ?? "").toLowerCase() === enemyChamp.toLowerCase()) : [];
  const useVs = vs.length >= 2;
  const sample = useVs ? vs : onChamp;
  const wr2 = (ms) => ms.length ? Math.round(ms.filter((m) => m.objective.win).length / ms.length * 100) : null;
  const kda2 = avg7(sample.filter((m) => m.objective.deaths != null).map((m) => (m.objective.kills + m.objective.assists) / Math.max(1, m.objective.deaths)));
  const proc = avg7(sample.map((m) => m.process.score));
  const stats = [];
  const strengths = [];
  const focus = [];
  const kdaStat = () => {
    if (kda2 != null) stats.push({ label: "KDA", value: `${round14(kda2)}`, tone: kda2 >= 3 ? "good" : kda2 < 1.8 ? "bad" : "neutral" });
  };
  if (hasLanes) {
    const gold15 = avg7(sample.map((m) => m.objective.goldDiffAt15).filter(def7));
    const cs10 = avg7(sample.map((m) => m.objective.csAt10).filter(def7));
    const d15 = avg7(sample.map((m) => m.objective.deathsBefore15).filter(def7));
    if (gold15 != null) stats.push({ label: "Gold @ 15", value: `${gold15 >= 0 ? "+" : ""}${Math.round(gold15)}`, tone: gold15 >= 150 ? "good" : gold15 <= -200 ? "bad" : "neutral" });
    if (cs10 != null) stats.push({ label: "CS @ 10", value: `${round14(cs10)}`, tone: cs10 >= 70 ? "good" : cs10 < 58 ? "bad" : "neutral" });
    if (d15 != null) stats.push({ label: "Deaths < 15", value: `${round14(d15)}`, tone: d15 <= 1.5 ? "good" : d15 >= 3 ? "bad" : "neutral" });
    kdaStat();
    if (gold15 != null) {
      if (gold15 >= 150) strengths.push(`You win the early gold race (+${Math.round(gold15)}@15).`);
      else if (gold15 <= -200) focus.push(`You fall behind early (${Math.round(gold15)} gold@15) \u2014 respect their trades.`);
    }
    if (cs10 != null) {
      if (cs10 >= 72) strengths.push(`Clean farm (${round14(cs10)} CS@10) \u2014 keep it up.`);
      else if (cs10 < 58) focus.push(`Farm slips here (${round14(cs10)} CS@10) \u2014 prioritize last-hits over trades.`);
    }
    if (d15 != null) {
      if (d15 <= 1.5) strengths.push(`Disciplined early (${round14(d15)} deaths<15).`);
      else if (d15 >= 3) focus.push(`You die early a lot (${round14(d15)}<15) \u2014 play safer to your first item.`);
    }
  } else {
    const kp = avg7(sample.map((m) => m.objective.killParticipation).filter(def7));
    const share = avg7(sample.map((m) => m.objective.teamDamageShare).filter(def7));
    const deaths = avg7(sample.map((m) => m.objective.deaths).filter(def7));
    kdaStat();
    if (kp != null) stats.push({ label: "Kill part.", value: `${Math.round(kp * 100)}%`, tone: kp >= 0.6 ? "good" : kp < 0.45 ? "bad" : "neutral" });
    if (share != null) stats.push({ label: "Damage share", value: `${Math.round(share * 100)}%`, tone: share >= 0.28 ? "good" : "neutral" });
    if (deaths != null) stats.push({ label: "Deaths / game", value: `${round14(deaths)}`, tone: deaths <= 5 ? "good" : deaths >= 9 ? "bad" : "neutral" });
    if (kp != null) {
      if (kp >= 0.65) strengths.push(`You're in nearly every fight (${Math.round(kp * 100)}% KP).`);
      else if (kp < 0.45) focus.push(`You miss fights (${Math.round(kp * 100)}% KP) \u2014 stick with the group and poke.`);
    }
    if (share != null && share >= 0.3) strengths.push(`You carry the damage (${Math.round(share * 100)}% team share).`);
    if (deaths != null) {
      if (deaths <= 5) strengths.push(`Disciplined positioning (${round14(deaths)} deaths/game).`);
      else if (deaths >= 9) focus.push(`You die a lot (${round14(deaths)}/game) \u2014 respect their poke; don't face-check.`);
    }
  }
  if (proc != null && proc >= 65) strengths.push(`High performance floor (${Math.round(proc)} avg).`);
  if (proc != null && proc < 50) focus.push(`Raise the floor (${Math.round(proc)} avg performance).`);
  if (strengths.length === 0) strengths.push("Play to your champion's core pattern.");
  if (focus.length === 0) focus.push(hasLanes ? "Nothing glaring \u2014 take the trades you know you win." : "Nothing glaring \u2014 play your angles and don't over-commit.");
  const meName = nameOf(myChamp);
  const oppName = enemyChamp ? nameOf(enemyChamp) : null;
  const note = oppName ? useVs ? `${vs.length} game${vs.length === 1 ? "" : "s"} into ${oppName} \u2014 ${wr2(vs)}% WR.` : vs.length === 1 ? `Only 1 game into ${oppName}; showing your overall ${meName} form (${champGames} games).` : `No games into ${oppName} yet; showing your overall ${meName} form (${champGames} games).` : `Your overall ${meName} form across ${champGames} game${champGames === 1 ? "" : "s"}.`;
  return {
    champion: myChamp,
    opponent: enemyChamp,
    vsGames: vs.length,
    champGames,
    vsWinRate: vs.length ? wr2(vs) : null,
    champWinRate: wr2(onChamp),
    stats,
    strengths: strengths.slice(0, 3),
    focus: focus.slice(0, 3),
    note
  };
}
var ONHIT_ADC = /* @__PURE__ */ new Set(["KogMaw", "Kaisa", "Varus", "Vayne", "Twitch", "Belveth", "Kindred", "Teemo", "Rengar"]);
var CASTER_ADC = /* @__PURE__ */ new Set(["Jhin", "Ezreal", "MissFortune", "Corki", "Senna", "Ashe", "Aphelios", "Smolder"]);
var BATTLEMAGE = /* @__PURE__ */ new Set(["Cassiopeia", "Swain", "Rumble", "Singed", "Ryze", "Vladimir", "Malzahar", "Karthus", "Anivia", "Morgana", "AurelionSol", "Taliyah"]);
var ENCHANTER = /* @__PURE__ */ new Set(["Nami", "Lulu", "Soraka", "Milio", "Yuumi", "Sona", "Karma", "Renata", "Janna", "Seraphine", "Ivern"]);
var FLEX = {
  Kayle: ["onhit_adc", "burst_mage"],
  Kaisa: ["onhit_adc", "ap_assassin"],
  Varus: ["onhit_adc", "burst_mage"],
  Ezreal: ["caster_adc", "burst_mage"],
  Teemo: ["onhit_adc", "burst_mage"],
  TwistedFate: ["burst_mage", "ad_assassin"],
  Gnar: ["bruiser", "tank"],
  Jax: ["bruiser", "onhit_adc"],
  Nidalee: ["burst_mage", "ad_assassin"],
  Yasuo: ["crit_adc", "bruiser"],
  Yone: ["crit_adc", "bruiser"],
  Akshan: ["crit_adc", "ad_assassin"],
  Lillia: ["battlemage", "ap_assassin"],
  Diana: ["ap_assassin", "ap_bruiser"],
  Ekko: ["ap_assassin", "ap_bruiser"]
};
var item = (name, itemId, reason) => ({ name, itemId, reason });
var ARAM_SUB = {
  3026: { name: "Sterak's Gage / Death's Dance", itemId: 3053 },
  // Guardian Angel isn't in ARAM
  3865: { name: "Doran's Ring / Blade", itemId: 1056 }
  // no support quest item in ARAM
};
var aramSwap = (it) => {
  const s = it.itemId != null ? ARAM_SUB[it.itemId] : void 0;
  return s ? { name: s.name, itemId: s.itemId, reason: it.reason } : it;
};
var STYLES = {
  crit_adc: {
    label: "Crit DPS",
    blurb: "Steady auto-attack damage that scales",
    dmg: "ad",
    carry: true,
    boots: "attack",
    start: [item("Doran's Blade", 1055, "Start + Health Potion")],
    core: [item("Kraken Slayer / The Collector", 6672, "First-item damage spike"), item("Infinity Edge", 3031, "Crit spike at ~40% crit"), item("Phantom Dancer / Rapid Firecannon", 3046, "AS + crit; Lord Dominik's vs HP")]
  },
  onhit_adc: {
    label: "On-hit DPS",
    blurb: "Attack-speed shred, great vs tanks",
    dmg: "ad",
    carry: true,
    boots: "attack",
    start: [item("Doran's Blade", 1055, "Start + Health Potion")],
    core: [item("Blade of the Ruined King / Kraken", 3153, "On-hit + %max-HP shred"), item("Guinsoo's Rageblade", 3124, "Doubles on-hit effects"), item("Runaan's Hurricane", 3085, "Spread on-hit across their team")]
  },
  caster_adc: {
    label: "Caster / lethality",
    blurb: "Ability-weighted burst and pick",
    dmg: "ad",
    carry: true,
    boots: "attack",
    start: [item("Doran's Blade", 1055, "Start + Health Potion")],
    core: [item("First item (Eclipse / Manamune / Kraken)", 6692, "Your kit's first spike"), item("The Collector / Infinity Edge", 6676, "Damage + execute"), item("Serylda's / Lord Dominik's", 6694, "Pen vs their frontline")]
  },
  burst_mage: {
    label: "AP burst",
    blurb: "Delete a target in one combo",
    dmg: "ap",
    carry: true,
    boots: "sorc",
    start: [item("Doran's Ring", 1056, "Start + 2 Health Potions")],
    core: [item("Luden's Companion / Malignance", 6655, "Waveclear + first burst"), item("Shadowflame", 4645, "Burst vs low-HP targets"), item("Rabadon's Deathcap", 3089, "AP multiplier")]
  },
  battlemage: {
    label: "AP sustained",
    blurb: "%HP burn and durability in long fights",
    dmg: "ap",
    carry: true,
    boots: "sorc",
    start: [item("Corrupting Potion", 2033, "Sustained mana + poke")],
    core: [item("Liandry's Torment", 6653, "%HP burn"), item("Rylai's / Riftmaker", 3116, "Slow + durability"), item("Rabadon's Deathcap", 3089, "Scale your damage")]
  },
  ad_assassin: {
    label: "AD assassin",
    blurb: "Lethality burst on the backline",
    dmg: "ad",
    carry: true,
    boots: "ionian",
    start: [item("Long Sword", 1036, "Start + Refillable Potion")],
    core: [item("Youmuu's / Profane Hydra", 3142, "Lethality + roam speed"), item("The Collector / Opportunity", 6676, "Execute threshold"), item("Edge of Night / Serylda's", 3814, "Spell shield / pen")]
  },
  ap_assassin: {
    label: "AP assassin",
    blurb: "Magic burst on squishies",
    dmg: "ap",
    carry: true,
    boots: "sorc",
    start: [item("Doran's Ring", 1056, "Start + 2 Health Potions")],
    core: [item("Hextech Rocketbelt / Lich Bane", 3152, "Gap-close / proc burst"), item("Shadowflame", 4645, "Burst vs squishies"), item("Zhonya's Hourglass", 3157, "Survive your own dive")]
  },
  bruiser: {
    label: "Bruiser",
    blurb: "Durable frontline damage",
    dmg: "ad",
    carry: false,
    boots: "comp",
    start: [item("Doran's Blade", 1055, "Start + Health Potion")],
    core: [item("Eclipse / Trinity / Stridebreaker", 6692, "First fighting item"), item("Black Cleaver", 3071, "Armor shred + durability"), item("Sterak's / Death's Dance", 3053, "Survive what you dive into")]
  },
  ap_bruiser: {
    label: "AP bruiser",
    blurb: "Durable magic damage",
    dmg: "ap",
    carry: false,
    boots: "comp",
    start: [item("Doran's Ring", 1056, "Start + 2 Health Potions")],
    core: [item("Riftmaker", 4633, "Omnivamp + durability"), item("Liandry's Torment", 6653, "%HP burn"), item("Zhonya's / Cosmic Drive", 3157, "Survivability / haste")]
  },
  tank: {
    label: "Tank",
    blurb: "Frontline that soaks and engages",
    dmg: "none",
    carry: false,
    boots: "comp",
    start: [item("Doran's Shield", 1054, "Start + Health Potion")],
    core: [item("Sunfire Aegis / Jak'Sho", 3068, "First resist + damage"), item("Second resist by their damage", 6665, "Armor vs AD, MR vs AP"), item("Warmog's / Kaenic Rookern", 3083, "Bulk to hold the front")]
  },
  enchanter: {
    label: "Enchanter",
    blurb: "Shields, heals, buffs for carries",
    dmg: "ap",
    carry: false,
    boots: "comp",
    start: [item("World Atlas", 3865, "Support item \u2014 upgrade by ~14 min")],
    core: [item("Moonstone / Imperial Mandate", 6617, "First support spike"), item("Mikael's / Redemption", 3222, "Cleanse / AoE heal"), item("Ardent Censer / Staff of Flowing Water", 3504, "Buff your carries")]
  },
  engage_support: {
    label: "Engage support",
    blurb: "Frontline CC and peel",
    dmg: "none",
    carry: false,
    boots: "comp",
    start: [item("World Atlas", 3865, "Support item \u2014 upgrade by ~14 min")],
    core: [item("Locket of the Iron Solari", 3190, "Team shield on engage"), item("Knight's Vow / Zeke's", 3109, "Tether your carry"), item("Second resist by their damage", 3075, "Armor vs AD, MR vs AP")]
  },
  generic: {
    label: "Standard",
    blurb: "Your champion's usual path",
    dmg: "ad",
    carry: true,
    boots: "comp",
    start: [item("Doran's item + Potion", 1055, "Your champion's usual start")],
    core: [item("Your 2\u20133 core items", 0, "Build your champion's standard core first")]
  }
};
function styleKey(mine, arch, meAp) {
  const id = mine?.id ?? "";
  switch (arch) {
    case "marksman":
      return ONHIT_ADC.has(id) ? "onhit_adc" : CASTER_ADC.has(id) ? "caster_adc" : "crit_adc";
    case "mage":
      return BATTLEMAGE.has(id) ? "battlemage" : "burst_mage";
    case "assassin":
      return meAp ? "ap_assassin" : "ad_assassin";
    case "fighter":
      return meAp ? "ap_bruiser" : "bruiser";
    case "tank":
      return "tank";
    case "support":
      return ENCHANTER.has(id) ? "enchanter" : "engage_support";
    default:
      return "generic";
  }
}
function carryDamage(c) {
  const t = c.tags ?? [];
  if (t.includes("Tank")) return "none";
  if (t.includes("Support") && !t.includes("Marksman")) return "none";
  const cl = classify2(c);
  if (cl.ap && !cl.ad) return "ap";
  if (cl.ad) return "ad";
  return "none";
}
function bootsFor(s, comp) {
  if (s.boots === "attack") return item("Berserker's Greaves", 3006, "Attack speed for your DPS");
  if (s.boots === "sorc") return comp.cc >= 2 ? item("Mercury's Treads", 3111, `${comp.cc} hard-CC \u2014 tenacity`) : item("Sorcerer's Shoes", 3020, "Magic penetration");
  if (s.boots === "ionian") return item("Ionian Boots of Lucidity", 3158, "Ability haste");
  if (comp.ap >= 2 && comp.ap >= comp.ad || comp.cc >= 2) return item("Mercury's Treads", 3111, comp.cc >= 2 ? `${comp.cc} hard-CC \u2014 tenacity + MR` : `${comp.ap} AP threats \u2014 magic resist`);
  if (comp.ad >= 2) return item("Plated Steelcaps", 3047, `${comp.ad} AD threats \u2014 cut their physical damage`);
  return item("Boots by matchup", 3047, "Defensive boots vs their main damage");
}
function situationalFor(s, comp) {
  const { ad, ap, tank, cc, healing, divers, enemies } = comp;
  const meAp = s.dmg === "ap";
  const out = [];
  const push = (n, id, r) => out.push(item(n, id, r));
  if (healing >= 1) {
    const h = `their ${healing} healing threat${healing === 1 ? "" : "s"}`;
    if (meAp) push("Morellonomicon", 3165, `Cut ${h} \u2014 Grievous Wounds`);
    else if (!s.carry) push("Thornmail", 3075, `Armor + Grievous Wounds vs ${h}`);
    else push("Executioner's \u2192 Mortal Reminder", 3123, `Cut ${h} \u2014 Grievous Wounds`);
  }
  if (s.carry) {
    if (ap >= 2) {
      if (s.dmg === "ad") push("Wit's End", 3091, `${ap} AP threats \u2014 on-hit MR that shreds back`);
      else if (meAp) push("Banshee's Veil", 3102, `${ap} AP threats \u2014 a spell shield`);
      else push("Maw of Malmortius", 3156, `${ap} AP threats \u2014 a magic lifeline`);
    } else if (ad >= 2) push(meAp ? "Zhonya's Hourglass" : "Guardian Angel", meAp ? 3157 : 3026, `${ad} AD threats \u2014 stasis/revive`);
    if (divers >= 1) push(meAp ? "Zhonya's Hourglass" : "Guardian Angel", meAp ? 3157 : 3026, `${divers} diver${divers === 1 ? "" : "s"} (${enemies.find((c) => ASSASSINS.has(c.id) || DIVERS.has(c.id))?.name ?? "assassins"}) hunting you`);
    if (cc >= 2) push("Mercurial Scimitar (QSS)", 3139, `Heavy CC (${cc}) \u2014 cleanse the pick`);
  } else {
    if (ad >= 3) push("Randuin's Omen / Thornmail", 3143, `Heavy AD (${ad}) \u2014 armor swings fights`);
    else if (ad >= 2 && tank === 0) push("Frozen Heart / Randuin's", 3110, `Multiple AD (${ad}) \u2014 armor`);
    if (ap >= 3) push("Spirit Visage / Force of Nature", 3065, `Heavy AP (${ap}) \u2014 magic resist`);
    else if (ap >= 2) push("Kaenic Rookern / Spirit Visage", 3065, `Multiple AP (${ap}) \u2014 magic resist`);
    if (divers >= 1) push("Guardian Angel", 3026, `${divers} diver${divers === 1 ? "" : "s"} \u2014 a second life`);
    if (cc >= 2) push("Mercurial Scimitar / Silvermere", 3139, `Heavy CC (${cc}) \u2014 a cleanse`);
  }
  const seen = /* @__PURE__ */ new Set();
  return out.filter((i) => seen.has(i.name) ? false : (seen.add(i.name), true)).slice(0, 3);
}
function optionPhases(s, comp) {
  const phases = [
    { phase: "Opening", when: "Start", items: s.start },
    { phase: "Boots", when: "First or second back", items: [bootsFor(s, comp)] },
    { phase: "Core", when: "First 2\u20133 items", items: s.core }
  ];
  const sit = situationalFor(s, comp);
  if (sit.length) phases.push({ phase: "Situational", when: "Slot in vs their comp", items: sit });
  return phases;
}
function buildBuild(mine, allies, enemies, laneless) {
  const cls = enemies.map(classify2);
  const comp = {
    ad: cls.filter((c) => c.ad).length,
    ap: cls.filter((c) => c.ap).length,
    tank: cls.filter((c) => c.tank).length,
    cc: enemies.filter((c) => HARD_CC.has(c.id)).length,
    healing: enemies.filter((c) => HEALERS.has(c.id)).length,
    divers: enemies.filter((c) => ASSASSINS.has(c.id) || DIVERS.has(c.id)).length,
    enemies
  };
  const arch = archetype(mine);
  const meAp = (() => {
    const c = classify2(mine);
    return c.ap && !c.ad;
  })();
  const primary = styleKey(mine, arch, meAp);
  const keys = Array.from(/* @__PURE__ */ new Set([primary, ...mine ? FLEX[mine.id] ?? [] : []]));
  const teamMembers = [mine, ...allies].filter((c) => !!c);
  const teamDmg = teamMembers.map(carryDamage);
  const teamAd = teamDmg.filter((t) => t === "ad").length;
  const teamAp = teamDmg.filter((t) => t === "ap").length;
  const teamFront = teamMembers.filter((c) => {
    const t = c.tags ?? [];
    return t.includes("Tank") || t.includes("Fighter");
  }).length;
  const sized = teamMembers.length >= 3;
  const noAp = sized && teamAp === 0, noAd = sized && teamAd === 0;
  const noFront = teamMembers.length >= 4 && teamFront === 0;
  const built = keys.map((k) => ({ key: k, style: STYLES[k] ?? STYLES.generic }));
  const canGoAp = built.some((b) => b.style.dmg === "ap");
  const canGoAd = built.some((b) => b.style.dmg === "ad");
  const teamNeeds = [];
  if (noAp) teamNeeds.push(canGoAp ? "Your team has no AP \u2014 the AP option below rounds out your damage." : "Your team's damage is all physical \u2014 expect them to stack armor.");
  if (noAd) teamNeeds.push(canGoAd ? "Your team has no AD \u2014 the AD option below rounds out your damage." : "Your team's damage is all magic \u2014 expect them to stack magic resist.");
  if (noFront) teamNeeds.push("Your team lacks a frontline \u2014 a durable build helps you hold space.");
  const score = (s) => {
    let n = 0;
    if (noAp && s.dmg === "ap") n += 3;
    if (noAd && s.dmg === "ad") n += 3;
    if (noFront && !s.carry) n += 2;
    if (comp.tank >= 2 && s.dmg === "ad" && s.boots === "attack") n += 1;
    return n;
  };
  let bestScore = -1, bestIdx = 0;
  built.forEach((b, i) => {
    const sc = score(b.style);
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = i;
    }
  });
  const options = built.map((b, i) => {
    const rec = i === bestIdx;
    const fits = [];
    if (noAp && b.style.dmg === "ap") fits.push("adds the AP your team is missing");
    if (noAd && b.style.dmg === "ad") fits.push("adds the AD your team is missing");
    if (noFront && !b.style.carry) fits.push("gives your team a frontline");
    if (comp.tank >= 2 && b.style.dmg === "ad" && b.style.boots === "attack") fits.push("shreds their tanks");
    const fit = fits.length ? `Best fit \u2014 ${fits.join(", ")}.` : rec ? "Your standard, comp-adapted path." : `Alternative \u2014 ${b.style.blurb.toLowerCase()}.`;
    const phases = optionPhases(b.style, comp).map((ph) => laneless ? { ...ph, items: ph.items.map(aramSwap) } : ph);
    return { id: b.key, label: b.style.label, blurb: b.style.blurb, recommended: rec, fit, phases };
  }).sort((a, b) => a.recommended === b.recommended ? 0 : a.recommended ? -1 : 1);
  const compStr = comp.ad + comp.ap + comp.tank === 0 ? null : `${comp.ad} AD \xB7 ${comp.ap} AP \xB7 ${comp.tank} tank${comp.cc ? ` \xB7 ${comp.cc} hard-CC` : ""}${comp.healing ? ` \xB7 ${comp.healing} healing` : ""}`;
  const summary = compStr ? `Enemy comp: ${compStr}.` : "Not enough enemy picks to read the comp.";
  return { profile: { ad: comp.ad, ap: comp.ap, tank: comp.tank, cc: comp.cc, healing: comp.healing }, teamNeeds, summary, options };
}
function draftReadout(team, enemies) {
  const dmg = (cs) => {
    const t = cs.map(carryDamage);
    const ad = t.filter((x) => x === "ad").length;
    const ap = t.filter((x) => x === "ap").length;
    return ad === 0 && ap === 0 ? "Unknown" : ad >= ap * 2 ? "AD-leaning" : ap >= ad * 2 ? "AP-leaning" : "Mixed";
  };
  const yourDamage = dmg(team);
  const enemyDamage = dmg(enemies);
  const yourNotes = [];
  const enemyNotes = [];
  if (enemyDamage === "AD-leaning") yourNotes.push("Enemy is AD-heavy \u2014 armor is a free power spike for you.");
  if (enemyDamage === "AP-leaning") yourNotes.push("Enemy is AP-heavy \u2014 magic resist scales all game.");
  if (yourDamage !== "Mixed" && yourDamage !== "Unknown") enemyNotes.push(`Your team is ${yourDamage} \u2014 they can itemize one resist against you.`);
  const cc = enemies.filter((c) => HARD_CC.has(c.id)).length;
  if (cc >= 2) yourNotes.push(`Enemy has ${cc} hard-CC \u2014 respect their engage windows; tenacity matters.`);
  const heal = enemies.filter((c) => HEALERS.has(c.id)).length;
  if (heal >= 1) yourNotes.push(`Enemy healing (${heal}) \u2014 rush Grievous Wounds.`);
  const favored = enemyDamage !== "Mixed" && enemyDamage !== "Unknown" && yourDamage === "Mixed" ? "you" : yourDamage !== "Mixed" && yourDamage !== "Unknown" && enemyDamage === "Mixed" ? "enemy" : "even";
  const readout = favored === "you" ? "You can itemize cleanly against a one-sided enemy comp." : favored === "enemy" ? "Your damage is one-sided \u2014 expect them to build the counter resist." : "Balanced draft \u2014 the lane and mid-game execution decide it.";
  return { yourDamage, enemyDamage, favored, readout, yourNotes: yourNotes.slice(0, 4), enemyNotes: enemyNotes.slice(0, 3) };
}
async function liveStatus() {
  const raw = await readLiveState();
  return { clientDetected: raw.clientDetected, phase: raw.phase, inGame: raw.source != null };
}
async function buildLiveCompanion(mock, opponentId) {
  const { champions } = await getChampions().catch(() => ({ champions: [] }));
  const byKey = /* @__PURE__ */ new Map();
  const byId = /* @__PURE__ */ new Map();
  const byName = /* @__PURE__ */ new Map();
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const c of champions) {
    const rec = { id: c.id, name: c.name, tags: c.tags ?? [] };
    byKey.set(Number(c.key), rec);
    byId.set(norm(c.id), rec);
    byName.set(norm(c.name), rec);
  }
  const resolve5 = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return byKey.get(v) ?? null;
    return byId.get(norm(v)) ?? byName.get(norm(v)) ?? null;
  };
  const raw = mock ? mockRawState() : await readLiveState();
  const modeInfo = raw.queueId != null && QUEUE_MODE[raw.queueId] ? QUEUE_MODE[raw.queueId] : raw.gameMode && GAMEMODE_MODE[raw.gameMode.toUpperCase()] ? GAMEMODE_MODE[raw.gameMode.toUpperCase()] : raw.queueId != null || raw.gameMode ? { name: "Other", hasLanes: false } : { name: "\u2014", hasLanes: false };
  const base = {
    phase: raw.phase,
    clientDetected: raw.clientDetected,
    inGame: raw.source != null,
    source: mock ? "mock" : "live",
    mode: modeInfo.name,
    hasLanes: modeInfo.hasLanes,
    mine: null,
    allies: [],
    enemies: [],
    enemyLaner: null,
    matchup: null,
    build: null,
    draft: null
  };
  if (!raw.source) return base;
  let mine;
  let myRole;
  let allyRecs;
  let enemyRecs;
  if (raw.ingame) {
    mine = resolve5(raw.ingame.mine?.champion ?? null);
    myRole = raw.ingame.mine?.role ?? null;
    allyRecs = raw.ingame.allies.map((a) => ({ rec: resolve5(a.champion), role: a.role }));
    enemyRecs = raw.ingame.enemies.map((e) => ({ rec: resolve5(e.champion), role: e.role }));
  } else {
    mine = resolve5(raw.mineKey);
    myRole = raw.myRole;
    allyRecs = raw.allies.map((a) => ({ rec: resolve5(a.key), role: a.role }));
    enemyRecs = raw.enemies.map((e) => ({ rec: resolve5(e.key), role: e.role }));
  }
  const enemies = enemyRecs.map((e) => e.rec).filter(def7);
  const team = [mine, ...allyRecs.map((a) => a.rec)].filter(def7);
  const toP = (r, role) => r ? { champion: r.id, role } : null;
  const career = enrichAll(store.matches(), store.seasons(), store.activePool());
  let enemyLaner = null;
  const chosen = opponentId ? enemyRecs.find((e) => e.rec && e.rec.id.toLowerCase() === opponentId.toLowerCase()) : null;
  if (chosen) {
    enemyLaner = chosen;
  } else {
    if (modeInfo.hasLanes && myRole) enemyLaner = enemyRecs.find((e) => e.role && e.role === myRole && e.rec) ?? null;
    if (!enemyLaner && mine) {
      const onChamp = career.filter((m) => m.objective.champion?.toLowerCase() === mine.id.toLowerCase());
      let best2 = null;
      let bestN = 0;
      for (const e of enemyRecs) {
        if (!e.rec) continue;
        const n = onChamp.filter((m) => (m.objective.opponentChampion ?? "").toLowerCase() === e.rec.id.toLowerCase()).length;
        if (n > bestN) {
          bestN = n;
          best2 = e;
        }
      }
      enemyLaner = best2;
    }
    if (!enemyLaner && mine) {
      const myArch = archetype(mine);
      enemyLaner = enemyRecs.find((e) => e.rec && archetype(e.rec) === myArch) ?? null;
    }
    if (!enemyLaner) enemyLaner = enemyRecs.find((e) => e.rec) ?? null;
  }
  const nameOf = (id) => byId.get(norm(id))?.name ?? id;
  const alliesOnly = allyRecs.map((a) => a.rec).filter(def7);
  const matchup = buildMatchup(mine?.id ?? null, enemyLaner?.rec?.id ?? null, career, modeInfo.hasLanes, nameOf);
  const build = buildBuild(mine, alliesOnly, enemies, !modeInfo.hasLanes);
  const draft = draftReadout(team, enemies);
  return {
    ...base,
    mine: toP(mine, myRole),
    allies: allyRecs.map((a) => toP(a.rec, a.role)).filter(def7),
    enemies: enemyRecs.map((e) => toP(e.rec, e.role)).filter(def7),
    enemyLaner: enemyLaner?.rec ? toP(enemyLaner.rec, enemyLaner.role) : null,
    matchup,
    build,
    draft
  };
}
function mockRawState() {
  return {
    clientDetected: true,
    phase: "ChampSelect",
    queueId: 420,
    gameMode: null,
    source: "champselect",
    mineKey: null,
    myRole: "BOT",
    allies: [],
    enemies: [],
    ingame: {
      mine: { champion: "Kaisa", role: "BOT" },
      allies: [
        { champion: "Thresh", role: "SUPPORT" },
        { champion: "LeeSin", role: "JUNGLE" },
        { champion: "Yasuo", role: "MID" },
        { champion: "Malphite", role: "TOP" }
      ],
      enemies: [
        { champion: "Caitlyn", role: "BOT" },
        { champion: "Bard", role: "SUPPORT" },
        { champion: "MasterYi", role: "JUNGLE" },
        { champion: "Syndra", role: "MID" },
        { champion: "Poppy", role: "TOP" }
      ]
    }
  };
}

// server/liveDeep.ts
function hasAnthropic4() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function signature(c) {
  const team = [c.mine?.champion, ...c.allies.map((a) => a.champion)].filter(Boolean).sort().join(",");
  const enemies = c.enemies.map((e) => e.champion).sort().join(",");
  return `${c.source}|${c.mode}|${c.mine?.champion ?? "?"}|${c.mine?.role ?? "?"}|${c.enemyLaner?.champion ?? "?"}|T:${team}|E:${enemies}`;
}
var cache5 = /* @__PURE__ */ new Map();
function renderBrief2(c, nameOf) {
  const L = [];
  const name = (ch) => nameOf(ch);
  const team = c.mine ? [c.mine, ...c.allies] : c.allies;
  L.push(`Mode: ${c.mode}${c.hasLanes ? " (lane-based)" : " (no fixed lanes)"}.`);
  if (c.mine) L.push(`You are playing ${name(c.mine.champion)}${c.mine.role ? ` (${c.mine.role})` : ""}.`);
  L.push(`Your team: ${team.map((p) => `${name(p.champion)}${p.role ? ` ${p.role}` : ""}`).join(", ") || "\u2014"}.`);
  L.push(`Enemy team: ${c.enemies.map((p) => `${name(p.champion)}${p.role ? ` ${p.role}` : ""}`).join(", ") || "\u2014"}.`);
  if (c.enemyLaner) L.push(`Your direct opponent: ${name(c.enemyLaner.champion)}.`);
  const m = c.matchup;
  if (m) {
    L.push("");
    L.push(`YOUR HISTORY (from this player's logged games \u2014 use it, don't invent numbers):`);
    if (m.opponent && m.vsGames >= 2) {
      L.push(`- Into ${name(m.opponent)} specifically: ${m.vsGames} games, ${m.vsWinRate}% win rate.`);
    } else {
      L.push(`- Overall on ${name(m.champion)}: ${m.champGames} games, ${m.champWinRate ?? "?"}% win rate. ${m.note}`);
    }
    if (m.stats.length) L.push(`- Key stats (sampled from those games): ${m.stats.map((s) => `${s.label} ${s.value} (${s.tone})`).join("; ")}.`);
    if (m.strengths.length) L.push(`- What this player does WELL here: ${m.strengths.join(" ")}`);
    if (m.focus.length) L.push(`- What this player should FOCUS on: ${m.focus.join(" ")}`);
  }
  const b = c.build;
  if (b) {
    L.push("");
    L.push(`BUILD: ${b.summary}`);
    if (b.teamNeeds.length) L.push(`Your team's gaps: ${b.teamNeeds.join(" ")}`);
    const rec = b.options.find((o) => o.recommended) ?? b.options[0];
    if (rec) {
      L.push(`Recommended build \u2014 ${rec.label} (${rec.fit}):`);
      for (const ph of rec.phases) L.push(`- ${ph.phase} (${ph.when}): ${ph.items.map((i) => `${i.name} \u2014 ${i.reason}`).join(" | ")}`);
      const alts = b.options.filter((o) => !o.recommended).map((o) => o.label);
      if (alts.length) L.push(`Alternative builds available: ${alts.join(", ")}.`);
    }
  }
  const d = c.draft;
  if (d) {
    L.push("");
    L.push(`DRAFT: your damage ${d.yourDamage}, enemy damage ${d.enemyDamage}. Rules verdict: ${d.readout}`);
    if (d.yourNotes.length) L.push(`Advantages: ${d.yourNotes.join(" ")}`);
    if (d.enemyNotes.length) L.push(`Watch for: ${d.enemyNotes.join(" ")}`);
  }
  return L.join("\n");
}
var PhaseSchema = external_exports.object({ phase: external_exports.string(), advice: external_exports.string() });
var DeepSchema = external_exports.object({
  headline: external_exports.string(),
  winCondition: external_exports.string(),
  gamePlan: external_exports.array(PhaseSchema),
  matchupPlan: external_exports.string(),
  keyThreats: external_exports.array(external_exports.string()),
  buildNote: external_exports.string()
});
var DEEP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    winCondition: { type: "string" },
    gamePlan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { phase: { type: "string" }, advice: { type: "string" } },
        required: ["phase", "advice"]
      }
    },
    matchupPlan: { type: "string" },
    keyThreats: { type: "array", items: { type: "string" } },
    buildNote: { type: "string" }
  },
  required: ["headline", "winCondition", "gamePlan", "matchupPlan", "keyThreats", "buildNote"]
};
var SYSTEM4 = `You are an elite League of Legends draft-and-game-plan analyst embedded in a personal coaching app. You are handed a data brief about a game the player is ABOUT to play: both team comps, the mode, and \u2014 crucially \u2014 the player's OWN logged history on their champion and in this exact matchup.

Turn it into a tight, actionable pre-game read. Rules:
- Ground everything in the brief. When you reference the player's tendencies, use the real numbers and the "does well / should focus" notes provided \u2014 never invent stats.
- headline: one sentence naming what this game is really about for the player.
- winCondition: your TEAM's single clearest path to winning, given both comps.
- gamePlan: phase-by-phase. For lane modes use "Early game", "Mid game", "Late game"; for ARAM/Arena use phases that fit (e.g. "Opening", "Mid", "Late"). Each advice line concrete and specific to these champions.
- matchupPlan: a deep read of the player's lane (or their role in the fight, for laneless modes) vs the enemy, explicitly tying advice to what THIS player does well and needs to focus on. This is the most valuable section \u2014 make it personal.
- keyThreats: the enemy champions or patterns to respect most, most dangerous first, each with the specific threat (ability, spike, engage).
- buildNote: nuanced itemization reasoning that goes beyond the rules-based item list \u2014 timing, what to rush vs delay, and why, given the comp.
- Be specific and confident. No hedging, no preamble, no restating the brief.`;
async function callClaude(brief) {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3e3,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: DEEP_JSON_SCHEMA } },
    system: SYSTEM4,
    messages: [{ role: "user", content: `Here is the pre-game brief. Give me the deep read.

${brief}` }]
  });
  const text = res.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("no text output");
  const parsed = DeepSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("deep read failed validation");
  return parsed.data;
}
async function buildDeepRead(companion) {
  if (!companion.inGame || !companion.mine) {
    return { available: false, reason: "Waiting for a champ select or game." };
  }
  if (!hasAnthropic4()) {
    return { available: false, reason: "Add an ANTHROPIC_API_KEY to the server .env to enable the deep read." };
  }
  const key = signature(companion);
  const hit = cache5.get(key);
  if (hit) return hit;
  const byId = /* @__PURE__ */ new Map();
  try {
    const { champions } = await getChampions();
    for (const ch of champions) byId.set(ch.id.toLowerCase(), ch.name);
  } catch {
  }
  const nameOf = (id) => byId.get(id.toLowerCase()) ?? id;
  try {
    const core = await callClaude(renderBrief2(companion, nameOf));
    const read = { available: true, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), ...core };
    cache5.set(key, read);
    return read;
  } catch (e) {
    console.warn("Live deep read failed:", e.message);
    return { available: false, reason: "The deep read couldn't be generated right now \u2014 try again." };
  }
}

// server/liveRecap.ts
function modeLabel(q) {
  const s = (q ?? "").toUpperCase();
  if (s.includes("RANKED_SOLO")) return "Ranked Solo/Duo";
  if (s.includes("RANKED_FLEX")) return "Ranked Flex";
  if (s.includes("SWIFTPLAY")) return "Swiftplay";
  if (s.includes("QUICKPLAY")) return "Quickplay";
  if (s.includes("DRAFT")) return "Normal Draft";
  if (s.includes("BLIND")) return "Normal Blind";
  if (s.includes("ARAM")) return "ARAM";
  if (s.includes("ARENA")) return "Arena";
  if (s.includes("URF")) return "URF";
  if (s.includes("NEXUS")) return "Nexus Blitz";
  if (s.includes("CLASH")) return "Clash";
  return q ? q.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Game";
}
function movement(before, after, dir) {
  if (before == null || after == null) return "flat";
  const d = after - before;
  if (Math.abs(d) < 1e-6) return "flat";
  const better = dir === "higher" ? d > 0 : d < 0;
  return better ? "up" : "down";
}
function recapGoals(game) {
  const season = store.activeSeason();
  if (!season) return [];
  const seasons = store.seasons();
  const pool = store.activePool();
  const seasonAll = enrichAll(store.matchesForSeason(season.id), seasons, pool);
  const inSeason = seasonAll.some((m) => m.id === game.id);
  const priorSeason = seasonAll.filter((m) => m.id !== game.id);
  const out = [];
  for (const g of store.goalsForSeason(season.id)) {
    const kind = /games|wins/i.test(g.unit) ? "count" : "avg";
    const gv = inSeason ? evaluateGoal(g, [game]).current : null;
    const before = evaluateGoal(g, priorSeason).current;
    const after = evaluateGoal(g, seasonAll).current;
    const metThisGame = kind === "count" ? (gv ?? 0) >= 1 : gv != null && (g.direction === "higher" ? gv >= g.target : gv <= g.target);
    out.push({
      title: g.title,
      unit: g.unit,
      direction: g.direction,
      kind,
      target: g.target,
      gameValue: gv,
      metThisGame,
      runningBefore: before,
      runningAfter: after,
      moved: movement(before, after, g.direction)
    });
  }
  return out;
}
var SUBMETRIC = {
  earlyStability: { label: "Early game", good: "Laned steady \u2014 you didn't fall behind before your items.", bad: "Rough starts \u2014 prioritize safe farming and don't give up early gold/deaths." },
  deathDiscipline: { label: "Death discipline", good: "Disciplined \u2014 you didn't feed the map.", bad: "Too many deaths \u2014 respect the map and play to your power spikes, not coin-flips." },
  objectiveMacro: { label: "Objectives", good: "Good objective play \u2014 you were there for the map's currency.", bad: "Objectives slipped \u2014 group and set up drakes/grubs/baron with vision first." },
  teamfight: { label: "Teamfights", good: "You showed up in fights and did real work.", bad: "Teamfighting was rough \u2014 fix positioning and pick the fights you can win." },
  mental: { label: "Mental", good: "Calm and focused throughout.", bad: "Tilt crept in \u2014 reset between games and mute early if it helps." },
  review: { label: "Self-review", good: "Honest, useful self-review.", bad: "Reflect harder on the one decision that cost you most." }
};
function coachingPoints(game) {
  const subs = Object.entries(game.process.subMetrics).filter(([k]) => SUBMETRIC[k]).map(([k, v]) => ({ k, v }));
  const didWell = [];
  const workOn = [];
  for (const { k, v } of [...subs].sort((a, b) => b.v - a.v)) {
    if (v >= 0.62) didWell.push({ label: SUBMETRIC[k].label, detail: SUBMETRIC[k].good, value: `${Math.round(v * 100)}` });
  }
  for (const { k, v } of [...subs].sort((a, b) => a.v - b.v)) {
    if (v <= 0.48) workOn.push({ label: SUBMETRIC[k].label, detail: SUBMETRIC[k].bad, value: `${Math.round(v * 100)}` });
  }
  for (const t of game.tags ?? []) {
    if (t.tone === "good" && didWell.length < 4) didWell.push({ label: t.label, detail: t.hint });
    else if (t.tone === "bad" && workOn.length < 4) workOn.push({ label: t.label, detail: t.hint });
  }
  return { didWell: didWell.slice(0, 4), workOn: workOn.slice(0, 4) };
}
function buildRecap() {
  const seasons = store.seasons();
  const pool = store.activePool();
  const all = enrichAll(store.allMatches(), seasons, pool);
  const game = [...all].reverse().find((m) => m.source === "riot") ?? all[all.length - 1];
  if (!game) return { available: false, reason: "No games logged yet." };
  const o = game.objective;
  const k = o.kills ?? 0, d = o.deaths ?? 0, a = o.assists ?? 0;
  const mins3 = o.durationSec ? o.durationSec / 60 : null;
  const { didWell, workOn } = coachingPoints(game);
  return {
    available: true,
    matchId: game.id,
    champion: o.champion ?? void 0,
    role: o.role,
    mode: modeLabel(o.queue),
    win: o.win ?? null,
    placement: o.placement ?? null,
    durationSec: o.durationSec ?? null,
    kills: k,
    deaths: d,
    assists: a,
    kda: Math.round((k + a) / Math.max(1, d) * 10) / 10,
    cs: o.totalCs ?? null,
    csPerMin: o.totalCs != null && mins3 ? Math.round(o.totalCs / mins3 * 10) / 10 : null,
    damage: o.damageToChampions ?? null,
    damageShare: o.teamDamageShare ?? null,
    kp: o.killParticipation ?? null,
    vision: o.visionScore ?? null,
    processScore: Math.round(game.process.score),
    verdict: game.verdict,
    xp: game.xpAwarded.reduce((acc, x) => acc + x.amount, 0),
    highlights: game.tags ?? [],
    didWell,
    workOn,
    goals: recapGoals(game),
    playedAt: o.playedAt ?? game.playedAt
  };
}

// server/routes.ts
var uuid5 = () => globalThis.crypto.randomUUID();
function riotForActive() {
  const ap = activeProfile();
  return ap.isSelf ? riotFromEnv() : riotForAccount(ap.gameName, ap.tagLine, ap.platform);
}
var SPELL_NAME = {
  1: "Cleanse",
  3: "Exhaust",
  4: "Flash",
  6: "Ghost",
  7: "Heal",
  11: "Smite",
  12: "Teleport",
  13: "Clarity",
  14: "Ignite",
  21: "Barrier",
  32: "Mark/Dash",
  39: "Mark/Dash"
};
var TAG_PLATFORM = {
  KR: "kr",
  KR1: "kr",
  NA: "na1",
  NA1: "na1",
  EUW: "euw1",
  EUW1: "euw1",
  EUNE: "eun1",
  EUN1: "eun1",
  BR: "br1",
  BR1: "br1",
  JP: "jp1",
  JP1: "jp1",
  OCE: "oc1",
  OC1: "oc1",
  LAN: "la1",
  LAS: "la2",
  TR: "tr1",
  TR1: "tr1",
  RU: "ru"
};
var goalInputSchema = external_exports.array(
  external_exports.object({
    templateId: external_exports.string(),
    target: external_exports.number().optional(),
    champion: external_exports.string().nullish(),
    baseline: external_exports.number().nullish()
  })
);
var seasonSchema = external_exports.object({
  name: external_exports.string().min(1),
  theme: external_exports.string().default(""),
  goal: external_exports.string().default(""),
  identityId: external_exports.string(),
  targetGames: external_exports.number().int().min(5).max(200).default(30),
  blockType: external_exports.enum(["ranked", "normal", "aram", "any"]).default("any"),
  focusChampion: external_exports.string().nullish(),
  goals: goalInputSchema.default([])
});
var retroSchema = external_exports.object({
  whatWorked: external_exports.string().default(""),
  whatBroke: external_exports.string().default(""),
  keepDoing: external_exports.string().default(""),
  stopDoing: external_exports.string().default(""),
  nextBlockFocus: external_exports.string().default("")
});
var scorecardSchema = external_exports.object({
  grade: external_exports.enum(["A", "B", "C", "D", "F"]),
  tiltBefore: external_exports.number().min(0).max(5),
  tiltAfter: external_exports.number().min(0).max(5),
  biggestMistake: external_exports.string().default(""),
  firstDeathCause: external_exports.enum([
    "laning_mistake",
    "greedy_recall",
    "facecheck",
    "objective_setup",
    "overextension",
    "shutdown_donation",
    "teamfight_execution",
    "sidelane_greed",
    "mechanical_misplay",
    "unavoidable_team_collapse"
  ]).nullable().default(null),
  bestDecision: external_exports.string().default(""),
  oneAdjustment: external_exports.string().default(""),
  doomedCollapse: external_exports.boolean().default(false),
  flamed: external_exports.boolean().default(false),
  mutedAppropriately: external_exports.boolean().default(true),
  reviewed: external_exports.boolean().default(false)
});
var matchSchema = external_exports.object({
  seasonId: external_exports.string().optional(),
  riotMatchId: external_exports.string().optional(),
  // specific id, or "latest"
  playedAt: external_exports.string().optional(),
  objective: external_exports.record(external_exports.any()).optional(),
  // manual fields / overrides
  scorecard: scorecardSchema
});
var ROLES = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT", "UNKNOWN"];
var ROLE_PREFS = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT", "UNKNOWN", "ANY"];
var profileSchema = external_exports.object({
  mainRole: external_exports.enum(ROLES).nullable().optional(),
  primaryRole: external_exports.enum(ROLE_PREFS).nullable().optional(),
  secondaryRole: external_exports.enum(ROLE_PREFS).nullable().optional(),
  preferredRank: external_exports.string().nullable().optional(),
  championPool: external_exports.array(
    external_exports.object({
      champion: external_exports.string().min(1),
      tier: external_exports.enum(["main", "secondary", "lab"]),
      roles: external_exports.array(external_exports.enum(ROLES)).optional()
    })
  ).optional()
});
var addGoalSchema = external_exports.object({
  templateId: external_exports.string(),
  seasonId: external_exports.string().optional(),
  target: external_exports.number().optional(),
  champion: external_exports.string().nullish(),
  baseline: external_exports.number().nullish()
});
function registerRoutes(app2) {
  app2.get("/api/config", (_req, res) => {
    const riot = riotFromEnv();
    const id = selfIdentity();
    const cfg = {
      riotConfigured: !!riot,
      gameName: id.gameName,
      tagLine: id.tagLine,
      platform: id.platform,
      activeSeasonId: store.settings().activeSeasonId,
      demoMode: store.demoState().enabled,
      sessionGapMinutes: store.settings().sessionGapMinutes
    };
    res.json(cfg);
  });
  app2.get("/api/identities", (_req, res) => res.json(IDENTITIES));
  app2.get("/api/me", async (_req, res) => {
    const pool = store.activePool();
    const career = enrichAll(store.matches(), store.seasons(), pool);
    const champs = buildChampionStats(career, pool);
    const top = [...champs].sort((a, b) => b.masteryLevel - a.masteryLevel || b.games - a.games)[0] ?? null;
    const masteryLevel = champs.reduce((a, c) => a + c.masteryLevel, 0);
    const latest = [...career].reverse().find((m) => m.objective.tier)?.objective;
    let level = null;
    let profileIconId = null;
    const riot = riotFromEnv();
    if (riot) {
      try {
        const puuid = await riot.getPuuid();
        const info = await riot.getSummonerInfo(puuid);
        level = info.level;
        profileIconId = info.profileIconId;
      } catch {
      }
    }
    const id = selfIdentity();
    const header = {
      gameName: id.gameName,
      tagLine: id.tagLine,
      platform: id.platform,
      level,
      profileIconId,
      tier: latest?.tier ?? null,
      division: latest?.division ?? null,
      leaguePoints: latest?.leaguePoints ?? null,
      topChampion: top?.champion ?? null,
      masteryLevel,
      isSelf: true
    };
    res.json(header);
  });
  app2.get("/api/favorites", (_req, res) => res.json(store.favorites()));
  app2.post("/api/favorites", (req, res) => {
    const b = external_exports.object({ gameName: external_exports.string().min(1), tagLine: external_exports.string().min(1), platform: external_exports.string().optional() }).safeParse(req.body);
    if (!b.success) return res.status(400).json({ error: b.error.flatten() });
    store.addFavorite({ gameName: b.data.gameName, tagLine: b.data.tagLine, platform: b.data.platform || selfIdentity().platform });
    res.json(store.favorites());
  });
  app2.delete("/api/favorites", (req, res) => {
    const game = typeof req.query.game === "string" ? req.query.game : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag : "";
    store.removeFavorite(game, tag);
    res.json(store.favorites());
  });
  app2.get("/api/seasons", (_req, res) => res.json(store.seasons()));
  app2.post("/api/blocks/plan", (req, res) => {
    const parsed = external_exports.object({
      champion: external_exports.string().nullish(),
      focus: external_exports.string().nullish(),
      blockType: external_exports.enum(["ranked", "normal", "aram", "any"]).optional()
    }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(generateBlockPlan(parsed.data));
  });
  app2.post("/api/seasons", (req, res) => {
    const parsed = seasonSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const { goals, ...seasonFields } = parsed.data;
    const season = {
      id: uuid5(),
      ...seasonFields,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      endedAt: null,
      status: "active",
      retro: null
    };
    store.addSeason(season);
    for (const g of goals) {
      const goal = goalFromTemplate(g.templateId, {
        seasonId: season.id,
        target: g.target,
        champion: g.champion ?? null,
        baseline: g.baseline ?? null
      });
      if (goal) store.addGoal(goal);
    }
    res.status(201).json(season);
  });
  app2.post("/api/seasons/:id/activate", (req, res) => {
    const season = store.getSeason(req.params.id);
    if (!season) return res.status(404).json({ error: "Season not found" });
    store.setActiveSeason(season.id);
    res.json({ ok: true });
  });
  app2.post("/api/seasons/:id/complete", (req, res) => {
    const season = store.getSeason(req.params.id);
    if (!season) return res.status(404).json({ error: "Season not found" });
    const parsed = retroSchema.safeParse(req.body ?? {});
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const pool = store.activePool();
    const enriched = enrichAll(store.matchesForSeason(season.id), store.seasons(), pool);
    const unmet = store.goalsForSeason(season.id).map((g) => evaluateGoal(g, enriched)).filter((g) => !g.met);
    if (unmet.length > 0) {
      return res.status(409).json({
        error: `Block objectives still open: ${unmet.map((g) => g.goal.title).join(", ")}`
      });
    }
    store.updateSeason(season.id, {
      status: "complete",
      endedAt: (/* @__PURE__ */ new Date()).toISOString(),
      retro: { writtenAt: (/* @__PURE__ */ new Date()).toISOString(), ...parsed.data }
    });
    res.json({ ok: true });
  });
  app2.get("/api/riot/recent", async (_req, res) => {
    const riot = riotFromEnv();
    if (!riot) return res.status(400).json({ error: "Riot API not configured" });
    try {
      const puuid = await riot.getPuuid();
      const ids = await riot.getRecentMatchIds(puuid, 10, 420);
      const withStatus = ids.map((id) => ({
        matchId: id,
        alreadyLogged: store.hasRiotMatch(id)
      }));
      res.json({ matches: withStatus });
    } catch (e) {
      res.status(e instanceof RiotError ? 502 : 500).json({ error: String(e.message) });
    }
  });
  app2.get("/api/matches", (_req, res) => {
    const season = store.activeSeason();
    if (!season) return res.json([]);
    const pool = store.activePool();
    const raw = store.matchesForSeason(season.id);
    res.json(raw.map((m) => enrichMatch(m, season, pool)));
  });
  app2.post("/api/matches", async (req, res) => {
    const parsed = matchSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const season = parsed.data.seasonId ? store.getSeason(parsed.data.seasonId) : store.activeSeason();
    if (!season)
      return res.status(400).json({ error: "No active season. Start a ranked block first." });
    let objective = {};
    let source = "manual";
    const warnings = [];
    const riot = riotFromEnv();
    const wantRiot = !!parsed.data.riotMatchId;
    if (wantRiot && riot) {
      try {
        const puuid = await riot.getPuuid();
        let matchId = parsed.data.riotMatchId;
        if (matchId === "latest") {
          const ids = await riot.getRecentMatchIds(puuid, 10, 420);
          const next = ids.find((id) => !store.hasRiotMatch(id));
          if (!next)
            return res.status(409).json({ error: "No new ranked games found \u2014 your latest is already logged." });
          matchId = next;
        }
        if (store.hasRiotMatch(matchId))
          return res.status(409).json({ error: "That match is already logged." });
        objective = await riot.getObjectiveData(matchId, puuid);
        source = "riot";
        const rank = await riot.getRank(puuid);
        objective.tier = rank.tier;
        objective.division = rank.division;
        objective.leaguePoints = rank.leaguePoints;
        const s = store.settings();
        if (rank.leaguePoints != null && s.lastLp != null && s.lastTier === rank.tier && s.lastDivision === rank.division) {
          objective.lpDelta = rank.leaguePoints - s.lastLp;
        } else {
          objective.lpDelta = null;
          if (s.lastLp != null) warnings.push("LP delta unknown across a promotion/demotion \u2014 set it manually if you want it in the trend.");
        }
        store.updateSettings({
          lastLp: rank.leaguePoints ?? s.lastLp,
          lastTier: rank.tier ?? s.lastTier,
          lastDivision: rank.division ?? s.lastDivision
        });
      } catch (e) {
        warnings.push(
          `Riot fetch failed (${e.message}). Saved as a manual entry \u2014 fill objective fields by hand if you like.`
        );
        source = "manual";
      }
    }
    if (parsed.data.objective) {
      objective = { ...objective, ...parsed.data.objective };
      if (source === "riot" && Object.keys(parsed.data.objective).length) source = "hybrid";
    }
    const match2 = {
      id: uuid5(),
      seasonId: season.id,
      playedAt: parsed.data.playedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
      loggedAt: (/* @__PURE__ */ new Date()).toISOString(),
      source,
      objective,
      scorecard: parsed.data.scorecard
    };
    store.addMatch(match2);
    const enriched = enrichMatch(match2, season, store.activePool());
    res.status(201).json({ match: enriched, warnings });
  });
  app2.get("/api/matches/:id", (req, res) => {
    const m = store.matches().find((x) => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: "Match not found." });
    const season = m.seasonId ? store.getSeason(m.seasonId) ?? null : null;
    const enriched = enrichMatch(m, season, store.activePool());
    const isAram2 = (m.objective.queue ?? "").toUpperCase().includes("ARAM");
    const { rank, bench } = benchFor(
      activeProfile().isSelf ? store.profile().preferredRank : null,
      m.objective.tier
    );
    enriched.comparison = matchComparison(m.objective, bench, isAram2);
    enriched.comparisonRank = isAram2 ? "ARAM avg" : rankLabel(rank);
    res.json(enriched);
  });
  app2.get("/api/matches/:id/scoreboard", async (req, res) => {
    const m = store.matches().find((x) => x.id === req.params.id);
    const empty = { found: false, players: [], durationSec: 0, version: "", platform: "", error: null };
    if (!m) return res.status(404).json({ error: "Match not found." });
    const rid = m.objective.riotMatchId;
    const riot = riotForActive();
    if (!rid || !riot) return res.json({ ...empty, error: "This game isn't linked to Riot match data." });
    try {
      const puuid = await riot.getPuuid();
      const [sb, version] = await Promise.all([riot.getMatchScoreboard(rid, puuid), getVersion()]);
      const players = await Promise.all(
        sb.players.map(async (p) => {
          const { _keystone, _secondaryStyle, ...rest } = p;
          return {
            ...rest,
            keystoneIcon: await getRuneIcon(_keystone),
            secondaryStyleIcon: await getRuneIcon(_secondaryStyle)
          };
        })
      );
      res.json({ found: true, players, durationSec: sb.durationSec, version, platform: riot.platformHost, error: null });
    } catch (e) {
      res.json({ ...empty, error: String(e.message) });
    }
  });
  app2.get("/api/matches/:id/timeline", async (req, res) => {
    const m = store.matches().find((x) => x.id === req.params.id);
    const empty = { found: false, participants: [], frames: [], version: "", error: null };
    if (!m) return res.status(404).json({ error: "Match not found." });
    const rid = m.objective.riotMatchId;
    const riot = riotForActive();
    if (!rid || !riot) return res.json({ ...empty, error: "This game isn't linked to Riot match data." });
    try {
      const puuid = await riot.getPuuid();
      const [tl, version] = await Promise.all([riot.getMatchTimeline(rid, puuid), getVersion()]);
      res.json({ found: true, participants: tl.participants, frames: tl.frames, version, error: null });
    } catch (e) {
      res.json({ ...empty, error: String(e.message) });
    }
  });
  app2.get("/api/matches/:id/analysis", async (req, res) => {
    const m = store.matches().find((x) => x.id === req.params.id);
    const empty = {
      found: false,
      champion: null,
      buildScore: 0,
      buildVerdict: "",
      buildNotes: [],
      myTeam: { score: 0, label: "", notes: [] },
      enemyTeam: { score: 0, label: "", notes: [] },
      matchup: "",
      generatedBy: "fallback",
      error: null
    };
    if (!m) return res.status(404).json({ error: "Match not found." });
    const rid = m.objective.riotMatchId;
    const riot = riotForActive();
    if (!rid || !riot) return res.json({ ...empty, error: "This game isn't linked to Riot match data." });
    try {
      const puuid = await riot.getPuuid();
      const [sb, version] = await Promise.all([riot.getMatchScoreboard(rid, puuid), getVersion()]);
      const me = sb.players.find((p) => p.isMe);
      if (!me) return res.json({ ...empty, error: "You weren't found in this game." });
      const itemIds = [...me.items, me.trinket].filter((i) => i > 0);
      const items = await Promise.all(itemIds.map((i) => getItemName(i)));
      const keystone = await getRuneName(me._keystone);
      const spells = me.spells.map((s) => SPELL_NAME[s]).filter(Boolean);
      const compFor = (mine) => sb.players.filter((p) => p.team === me.team === mine).map((p) => ({ champion: p.champion, role: p.role }));
      const analysis = await getMatchAnalysis({
        matchId: rid,
        patch: version,
        queue: m.objective.queue ?? "",
        win: !!me.win,
        me: { champion: me.champion, role: me.role, items, keystone, spells },
        myTeam: compFor(true),
        enemyTeam: compFor(false)
      });
      res.json(analysis);
    } catch (e) {
      res.json({ ...empty, error: String(e.message) });
    }
  });
  app2.delete("/api/matches/:id", (req, res) => {
    store.deleteMatch(req.params.id);
    res.json({ ok: true });
  });
  app2.get("/api/achievements", (_req, res) => {
    res.json(buildAchievements());
  });
  app2.get("/api/notifications", (_req, res) => {
    res.json(getNotifications());
  });
  app2.post("/api/notifications/read", (_req, res) => {
    store.markNotificationsRead();
    res.json({ ok: true });
  });
  app2.delete("/api/notifications", (_req, res) => {
    store.clearNotifications();
    res.json({ ok: true });
  });
  app2.get("/api/stats", (req, res) => {
    const queue = typeof req.query.queue === "string" ? req.query.queue : "sr";
    const role = typeof req.query.role === "string" && req.query.role ? req.query.role : null;
    res.json(buildStats(queue, role));
  });
  app2.get("/api/champions", async (_req, res) => {
    try {
      const data = await getChampions();
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: `Couldn't load champion data: ${e.message}` });
    }
  });
  app2.get("/api/profile", (_req, res) => res.json(store.profile()));
  app2.put("/api/profile", (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const data = { ...parsed.data };
    if (parsed.data.primaryRole !== void 0) {
      const pr = parsed.data.primaryRole;
      data.mainRole = pr && pr !== "ANY" && pr !== "UNKNOWN" ? pr : null;
    }
    store.updateProfile(data);
    res.json(store.profile());
  });
  app2.get("/api/goal-templates", (_req, res) => {
    res.json(
      TEMPLATES.map((t) => ({
        id: t.id,
        category: t.category,
        unit: t.unit,
        direction: t.direction,
        defaultTarget: t.defaultTarget,
        needsChampion: !!t.needsChampion,
        title: t.title(),
        description: t.describe(t.defaultTarget)
      }))
    );
  });
  app2.post("/api/goals", (req, res) => {
    const parsed = addGoalSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    let seasonId = parsed.data.seasonId ?? store.activeSeason()?.id ?? null;
    let createdBlock = null;
    if (!seasonId) {
      const champion = parsed.data.champion ?? null;
      const plan = generateBlockPlan({ champion, blockType: "any" });
      const season = {
        id: uuid5(),
        name: champion ? `${champion} focus` : plan.name,
        theme: plan.theme,
        goal: plan.goal,
        identityId: plan.identityId,
        targetGames: plan.targetGames,
        blockType: plan.blockType,
        focusChampion: champion,
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        endedAt: null,
        status: "active",
        retro: null
      };
      store.addSeason(season);
      seasonId = season.id;
      createdBlock = season;
      for (const g of plan.goals.filter((x) => x.templateId !== parsed.data.templateId).slice(0, 2)) {
        const rec = goalFromTemplate(g.templateId, { seasonId, target: g.target, champion: g.champion ?? null, baseline: g.baseline ?? null });
        if (rec) store.addGoal(rec);
      }
    }
    const goal = goalFromTemplate(parsed.data.templateId, {
      seasonId,
      target: parsed.data.target,
      champion: parsed.data.champion ?? null,
      baseline: parsed.data.baseline ?? null
    });
    if (!goal) return res.status(400).json({ error: "Unknown goal template" });
    store.addGoal(goal);
    res.status(201).json({ ...goal, createdBlock });
  });
  app2.patch("/api/goals/:id", (req, res) => {
    const patch = external_exports.object({
      target: external_exports.number().optional(),
      status: external_exports.enum(["active", "achieved", "archived"]).optional()
    }).safeParse(req.body);
    if (!patch.success) return res.status(400).json({ error: patch.error.flatten() });
    store.updateGoal(req.params.id, patch.data);
    res.json({ ok: true });
  });
  app2.delete("/api/goals/:id", (req, res) => {
    store.deleteGoal(req.params.id);
    res.json({ ok: true });
  });
  app2.post("/api/rolling-quests/:familyKey/claim", (req, res) => {
    store.claimRollingQuest(decodeURIComponent(req.params.familyKey));
    res.json({ ok: true });
  });
  app2.get("/api/recommendations", (_req, res) => {
    const pool = store.activePool();
    const careerEnriched = enrichAll(store.matches(), store.seasons(), pool);
    res.json(recommend(careerEnriched, pool, store.profile().mainRole));
  });
  app2.get("/api/dashboard", async (req, res) => {
    const queue = typeof req.query.queue === "string" ? req.query.queue : void 0;
    const role = typeof req.query.role === "string" && req.query.role ? req.query.role : null;
    res.json(await buildDashboard(queue, role));
  });
  app2.get("/api/progress", (_req, res) => {
    res.json(buildProgress());
  });
  app2.get("/api/objectives", (_req, res) => {
    const ach = buildAchievements();
    const level = { level: ach.level, levelPct: ach.levelPct, xpIntoLevel: ach.xpIntoLevel, xpForNext: ach.xpForNext };
    const season = store.activeSeason();
    if (!season) return res.json({ block: null, gamesLogged: 0, goals: [], level });
    const enriched = enrichAll(store.matchesForSeason(season.id), store.seasons(), store.activePool());
    const goals = store.goalsForSeason(season.id).map((g) => evaluateGoal(g, enriched));
    res.json({
      block: { id: season.id, name: season.name, focusChampion: season.focusChampion ?? null, targetGames: season.targetGames, theme: season.theme },
      gamesLogged: enriched.length,
      goals,
      level
    });
  });
  app2.get("/api/match-history", (_req, res) => {
    const career = enrichAll(store.matches(), store.seasons(), store.activePool());
    res.json({ matches: [...career].reverse() });
  });
  app2.get("/api/live", async (req, res) => {
    try {
      const mock = req.query.mock === "1" || req.query.mock === "true";
      const opponent = typeof req.query.opponent === "string" ? req.query.opponent : null;
      res.json(await runWithProfile(SELF_PROFILE, () => buildLiveCompanion(mock, opponent)));
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  });
  app2.get("/api/live/deep", async (req, res) => {
    try {
      const mock = req.query.mock === "1" || req.query.mock === "true";
      const opponent = typeof req.query.opponent === "string" ? req.query.opponent : null;
      const result = await runWithProfile(SELF_PROFILE, async () => {
        const companion = await buildLiveCompanion(mock, opponent);
        return buildDeepRead(companion);
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  });
  app2.get("/api/live/status", async (_req, res) => {
    try {
      res.json(await liveStatus());
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  });
  app2.get("/api/live/recap", (_req, res) => {
    try {
      res.json(runWithProfile(SELF_PROFILE, () => buildRecap()));
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  });
  app2.get("/api/coach/plan", async (req, res) => {
    try {
      const queue = typeof req.query.queue === "string" ? req.query.queue : "all";
      const plan = await buildCoachPlan({ queue });
      res.json({ plan, mode: store.coachMode() });
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  });
  app2.post("/api/coach/mode", (req, res) => {
    const mode = req.body?.mode === "engine" ? "engine" : "llm";
    store.setCoachMode(mode);
    res.json({ mode });
  });
  app2.post("/api/coach/plan/refresh", async (req, res) => {
    try {
      const queue = typeof req.query.queue === "string" ? req.query.queue : "all";
      const plan = await buildCoachPlan({ force: true, queue });
      res.json({ plan });
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  });
  app2.post("/api/sync", async (req, res) => {
    const force = req.query.force === "1" || req.body && req.body.force === true;
    try {
      res.json(await syncRiot({ force }));
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  });
  app2.get("/api/demo", (_req, res) => {
    res.json(store.demoState());
  });
  app2.post("/api/demo/enable", (_req, res) => {
    store.setDemoMode(true);
    res.json(store.demoState());
  });
  app2.post("/api/demo/disable", (_req, res) => {
    store.setDemoMode(false);
    res.json(store.demoState());
  });
  app2.post("/api/demo/reset", (_req, res) => {
    store.resetDemo();
    res.json(store.demoState());
  });
  app2.get("/api/champions/:champion", (req, res) => {
    const role = typeof req.query.role === "string" && req.query.role ? req.query.role : null;
    const detail = buildChampionDetail(req.params.champion, role);
    if (!detail) return res.status(404).json({ error: "Champion not found in your match history yet." });
    res.json(detail);
  });
  app2.get("/api/champion-meta/:champion", async (req, res) => {
    try {
      const role = typeof req.query.role === "string" ? req.query.role : "";
      const refresh = req.query.refresh === "1";
      res.json(await getChampionMeta(req.params.champion, role, { refresh }));
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  });
  app2.get("/api/blocks/summaries", (_req, res) => {
    res.json(buildBlockSummaries());
  });
  app2.get("/api/seasons/:id/review", (req, res) => {
    const review2 = buildBlockReview(req.params.id);
    if (!review2) return res.status(404).json({ error: "Block not found." });
    res.json(review2);
  });
  app2.get("/api/summoner", async (req, res) => {
    const game = typeof req.query.game === "string" ? req.query.game.trim() : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
    const platform = typeof req.query.platform === "string" && req.query.platform || TAG_PLATFORM[tag.toUpperCase()] || selfIdentity().platform;
    if (!game || !tag)
      return res.status(400).json({ error: "Provide a Riot ID as game name and tag (e.g. Dhole#NA1)." });
    try {
      res.json(await lookupSummoner(game, tag, platform));
    } catch (e) {
      res.status(500).json({ error: String(e.message) });
    }
  });
}

// server/workerRouter.ts
function parsePath(path2) {
  return splitPath(path2).map(
    (s) => s.startsWith(":") ? { param: s.slice(1) } : { literal: s }
  );
}
function splitPath(path2) {
  const clean = path2.split("?")[0].replace(/^\/+|\/+$/g, "");
  return clean === "" ? [] : clean.split("/");
}
function match(segments, parts) {
  if (segments.length !== parts.length) return null;
  const params = {};
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if ("literal" in seg) {
      if (seg.literal !== parts[i]) return null;
    } else {
      try {
        params[seg.param] = decodeURIComponent(parts[i]);
      } catch {
        params[seg.param] = parts[i];
      }
    }
  }
  return params;
}
function createRouter() {
  const routes = [];
  const add = (method, path2, handler) => routes.push({ method, segments: parsePath(path2), handler });
  const app2 = {
    get: (p, h) => add("GET", p, h),
    post: (p, h) => add("POST", p, h),
    put: (p, h) => add("PUT", p, h),
    patch: (p, h) => add("PATCH", p, h),
    delete: (p, h) => add("DELETE", p, h)
  };
  async function dispatch2(method, path2, query, body, getHeader) {
    const parts = splitPath(path2);
    for (const route of routes) {
      if (route.method !== method) continue;
      const params = match(route.segments, parts);
      if (!params) continue;
      let status = 200;
      let jsonBody = null;
      const res = {
        status(code) {
          status = code;
          return res;
        },
        json(value) {
          jsonBody = value;
          return res;
        }
      };
      const req = {
        params,
        query,
        body,
        path: path2,
        header: (name) => getHeader(name.toLowerCase())
      };
      await route.handler(req, res);
      return { status, body: jsonBody };
    }
    return { status: 404, body: { error: "Not found" } };
  }
  return { app: app2, dispatch: dispatch2 };
}

// server/http.ts
var SELF_ONLY = [
  "/api/me",
  "/api/favorites",
  "/api/config",
  "/api/demo",
  "/api/profile",
  "/api/identities",
  "/api/goal-templates"
];
function profileContextFor(path2, getHeader) {
  const selfOnly = SELF_ONLY.some((p) => path2 === p || path2.startsWith(p + "/"));
  const base = selfOnly ? SELF_PROFILE : parseProfileHeader(getHeader("x-profile") || void 0);
  const span = getHeader("x-span");
  return { ...base, spanCutoff: span === "all" ? null : seasonCutoffMs() };
}

// server/auth.ts
var PBKDF2_PREFIX = "pbkdf2-sha256";
var PBKDF2_HASH = "SHA-256";
var PBKDF2_ITERATIONS = 1e5;
var SALT_BYTES = 16;
var KEY_BYTES = 32;
var MIN_PASSWORD_LENGTH = 8;
var SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
var SECURE_COOKIE = "__Host-lu_session";
var DEV_COOKIE = "lu_session";
function utf8(s) {
  return new TextEncoder().encode(s);
}
function toB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromB64(str) {
  if (typeof str !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(str)) return null;
  try {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
function toB64url(bytes) {
  return toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function toHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}
function safeEqual(a, b) {
  let diff = a.length ^ b.length;
  const span = Math.max(a.length, b.length, 1);
  const an = a.length || 1;
  const bn = b.length || 1;
  for (let i = 0; i < span; i++) diff |= (a[i % an] ?? 0) ^ (b[i % bn] ?? 0);
  return diff === 0;
}
async function deriveBits(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", utf8(password.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: PBKDF2_HASH }, key, KEY_BYTES * 8);
  return new Uint8Array(bits);
}
async function hashPassword(password) {
  if (typeof password !== "string" || password.normalize("NFC").length < MIN_PASSWORD_LENGTH) {
    throw new TypeError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}
async function verifyPassword(password, stored) {
  try {
    if (typeof password !== "string" || typeof stored !== "string") return false;
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const [prefix, iterationsRaw, saltB64, hashB64] = parts;
    if (prefix !== PBKDF2_PREFIX) return false;
    const iterations = Number(iterationsRaw);
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
    const salt = fromB64(saltB64);
    if (!salt || salt.length !== SALT_BYTES) return false;
    const expected = fromB64(hashB64);
    if (!expected || expected.length !== KEY_BYTES) return false;
    const actual = await deriveBits(password, salt, iterations);
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}
function newSessionId() {
  return toB64url(crypto.getRandomValues(new Uint8Array(32)));
}
async function hashUserAgent(ua) {
  if (!ua) return "";
  const digest = await crypto.subtle.digest("SHA-256", utf8(ua));
  return toHex(new Uint8Array(digest)).slice(0, 16);
}
function sessionCookie(id, secure, maxAge = SESSION_TTL_SECONDS) {
  const name = secure ? SECURE_COOKIE : DEV_COOKIE;
  const sec = secure ? "; Secure" : "";
  return `${name}=${id}; HttpOnly${sec}; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
function clearSessionCookie(secure) {
  const name = secure ? SECURE_COOKIE : DEV_COOKIE;
  const sec = secure ? "; Secure" : "";
  return `${name}=; HttpOnly${sec}; SameSite=Lax; Path=/; Max-Age=0`;
}
function readSessionCookie(request) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const found = {};
  for (const part of header.split(";")) {
    const raw = part.trim();
    const eq = raw.indexOf("=");
    if (eq < 1) continue;
    found[raw.slice(0, eq)] = raw.slice(eq + 1);
  }
  return found[SECURE_COOKIE] ?? found[DEV_COOKIE] ?? null;
}
function requestIsSecure(request) {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

// server/authRoutes.ts
var now2 = () => Math.floor(Date.now() / 1e3);
var MAX_FAILED = 8;
var LOCK_SECONDS = 15 * 60;
var LOGIN_MIN_MS = 250;
var PLATFORMS = /* @__PURE__ */ new Set([
  "na1",
  "euw1",
  "eun1",
  "kr",
  "br1",
  "la1",
  "la2",
  "oc1",
  "tr1",
  "ru",
  "jp1",
  "ph2",
  "sg2",
  "th2",
  "tw2",
  "vn2"
]);
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanEmail(v) {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length >= 3 && e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
function cleanRiot(body) {
  const gameName = typeof body?.riotGameName === "string" ? body.riotGameName.trim() : "";
  const tagLine = typeof body?.riotTagLine === "string" ? body.riotTagLine.trim().replace(/^#/, "") : "";
  const platform = typeof body?.platform === "string" ? body.platform.trim().toLowerCase() : "";
  if (gameName.length < 1 || gameName.length > 32) return null;
  if (tagLine.length < 2 || tagLine.length > 8) return null;
  if (!PLATFORMS.has(platform)) return null;
  return { gameName, tagLine, platform };
}
function userView(row) {
  return {
    userId: row.id,
    email: row.email,
    displayName: row.display_name,
    gameName: row.riot_game_name,
    tagLine: row.riot_tag_line,
    platform: row.riot_platform
  };
}
async function createSession(db, userId, ua) {
  const id = newSessionId();
  const t = now2();
  await db.prepare(
    `INSERT INTO lu_sessions (id, user_id, created_at, expires_at, last_seen_at, ua_hash)
       VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, t, t + SESSION_TTL_SECONDS, t, await hashUserAgent(ua)).run();
  return id;
}
async function signup(db, body, opts) {
  const email = cleanEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const riot = cleanRiot(body);
  if (!email) return { status: 400, body: { error: "A valid email is required." } };
  if (password.normalize("NFC").length < MIN_PASSWORD_LENGTH)
    return { status: 400, body: { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` } };
  if (!riot)
    return { status: 400, body: { error: "A valid Riot ID (game name, tag, and region) is required." } };
  const existing = await db.prepare("SELECT id FROM lu_users WHERE email = ?").bind(email).first();
  if (existing) return { status: 409, body: { error: "An account with that email already exists." } };
  const hash = await hashPassword(password);
  const t = now2();
  const row = await db.prepare(
    `INSERT INTO lu_users
         (email, password_hash, display_name, riot_game_name, riot_tag_line, riot_platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, email, display_name, riot_game_name, riot_tag_line, riot_platform`
  ).bind(email, hash, riot.gameName, riot.gameName, riot.tagLine, riot.platform, t, t).first();
  if (!row) return { status: 500, body: { error: "Could not create the account." } };
  const sessionId = await createSession(db, row.id, opts.ua);
  return {
    status: 201,
    body: { user: userView(row) },
    setCookie: sessionCookie(sessionId, opts.secure)
  };
}
async function login(db, body, opts) {
  const started = Date.now();
  const pad = async (r) => {
    const remaining = LOGIN_MIN_MS - (Date.now() - started);
    if (remaining > 0) await new Promise((res) => setTimeout(res, remaining));
    return r;
  };
  const email = cleanEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const row = email ? await db.prepare(
    `SELECT id, email, password_hash, display_name, active, failed_attempts, locked_until,
                  riot_game_name, riot_tag_line, riot_platform
           FROM lu_users WHERE email = ?`
  ).bind(email).first() : null;
  const stored = row?.password_hash ?? "pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const passOk = await verifyPassword(password || " ", stored);
  const t = now2();
  if (!row || row.active !== 1) return pad({ status: 401, body: { error: "Incorrect email or password." } });
  if (row.locked_until > t) return pad({ status: 429, body: { error: "Too many attempts. Try again later." } });
  if (!passOk) {
    const failed = row.failed_attempts + 1;
    const lockedUntil = failed >= MAX_FAILED ? t + LOCK_SECONDS : 0;
    await db.prepare("UPDATE lu_users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?").bind(failed >= MAX_FAILED ? 0 : failed, lockedUntil, t, row.id).run();
    return pad({ status: 401, body: { error: "Incorrect email or password." } });
  }
  await db.prepare("UPDATE lu_users SET failed_attempts = 0, locked_until = 0, last_login_at = ?, updated_at = ? WHERE id = ?").bind(t, t, row.id).run();
  const sessionId = await createSession(db, row.id, opts.ua);
  return pad({
    status: 200,
    body: { user: userView(row) },
    setCookie: sessionCookie(sessionId, opts.secure)
  });
}
async function logout(db, sessionId, opts) {
  if (sessionId) {
    await db.prepare("UPDATE lu_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").bind(now2(), sessionId).run();
  }
  return { status: 200, body: { ok: true }, setCookie: clearSessionCookie(opts.secure) };
}
async function resolveSession(db, sessionId) {
  if (!sessionId) return null;
  const row = await db.prepare(
    `SELECT u.id, u.email, u.display_name, u.riot_game_name, u.riot_tag_line, u.riot_platform
       FROM lu_sessions s JOIN lu_users u ON u.id = s.user_id
       WHERE s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.active = 1`
  ).bind(sessionId, now2()).first();
  return row ? userView(row) : null;
}

// server/worker.ts
var { app, dispatch } = createRouter();
registerRoutes(app);
var CONFIG_KEYS = ["RIOT_API_KEY", "RIOT_PLATFORM", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"];
function apiHeaders() {
  return new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
}
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body ?? null), { status, headers: apiHeaders() });
}
function authResponse(result) {
  const headers = apiHeaders();
  if (result.setCookie) headers.append("Set-Cookie", result.setCookie);
  return new Response(JSON.stringify(result.body ?? null), { status: result.status, headers });
}
var onRequest = async (context) => {
  const { request, env, params } = context;
  for (const k of CONFIG_KEYS) {
    const v = env[k];
    if (v != null) process.env[k] = v;
  }
  const rest = Array.isArray(params.path) ? params.path.join("/") : params.path ?? "";
  const logicalPath = "/api/" + rest;
  const url = new URL(request.url);
  const query = {};
  url.searchParams.forEach((value, key) => {
    if (!(key in query)) query[key] = value;
  });
  const method = request.method.toUpperCase();
  let body = void 0;
  if (method !== "GET" && method !== "HEAD") {
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : void 0;
    } catch {
      body = void 0;
    }
  }
  const getHeader = (name) => request.headers.get(name) ?? void 0;
  const secure = requestIsSecure(request);
  const ua = request.headers.get("user-agent");
  const sessionId = readSessionCookie(request);
  try {
    if (logicalPath === "/api/auth/signup" && method === "POST") {
      return authResponse(await signup(env.DB, body, { ua, secure }));
    }
    if (logicalPath === "/api/auth/login" && method === "POST") {
      return authResponse(await login(env.DB, body, { ua, secure }));
    }
    if (logicalPath === "/api/auth/logout" && method === "POST") {
      return authResponse(await logout(env.DB, sessionId, { ua, secure }));
    }
    if (logicalPath === "/api/auth/me" && method === "GET") {
      const user2 = await resolveSession(env.DB, sessionId);
      return jsonResponse({ user: user2 }, 200);
    }
    const user = await resolveSession(env.DB, sessionId);
    if (!user) return jsonResponse({ error: "Not signed in." }, 401);
    const store2 = createD1Store(env.DB, `u/${user.userId}`);
    const ctx = profileContextFor(logicalPath, getHeader);
    const keys = ["meta", "profile", "live", "demo"];
    if (!ctx.isSelf && ctx.key) keys.push(profileDocKey(ctx.key));
    await store2.hydrate(keys);
    const result = await runWithDocumentStore(
      store2,
      () => runWithUser(
        user,
        () => runWithProfile(ctx, () => dispatch(method, logicalPath, query, body, getHeader))
      )
    );
    await store2.flush();
    return jsonResponse(result.body, result.status);
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
};
export {
  onRequest
};
