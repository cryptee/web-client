(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.WebStreamsAdapter = {}));
}(this, (function (exports) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    function assert(test) {
        if (!test) {
            throw new TypeError('Assertion failed');
        }
    }

    function noop() {
        return;
    }
    function typeIsObject(x) {
        return (typeof x === 'object' && x !== null) || typeof x === 'function';
    }

    function isStreamConstructor(ctor) {
        if (typeof ctor !== 'function') {
            return false;
        }
        var startCalled = false;
        try {
            new ctor({
                start: function () {
                    startCalled = true;
                }
            });
        }
        catch (e) {
            // ignore
        }
        return startCalled;
    }
    function isReadableStream(readable) {
        if (!typeIsObject(readable)) {
            return false;
        }
        if (typeof readable.getReader !== 'function') {
            return false;
        }
        return true;
    }
    function isReadableStreamConstructor(ctor) {
        if (!isStreamConstructor(ctor)) {
            return false;
        }
        if (!isReadableStream(new ctor())) {
            return false;
        }
        return true;
    }
    function isWritableStream(writable) {
        if (!typeIsObject(writable)) {
            return false;
        }
        if (typeof writable.getWriter !== 'function') {
            return false;
        }
        return true;
    }
    function isWritableStreamConstructor(ctor) {
        if (!isStreamConstructor(ctor)) {
            return false;
        }
        if (!isWritableStream(new ctor())) {
            return false;
        }
        return true;
    }
    function isTransformStream(transform) {
        if (!typeIsObject(transform)) {
            return false;
        }
        if (!isReadableStream(transform.readable)) {
            return false;
        }
        if (!isWritableStream(transform.writable)) {
            return false;
        }
        return true;
    }
    function isTransformStreamConstructor(ctor) {
        if (!isStreamConstructor(ctor)) {
            return false;
        }
        if (!isTransformStream(new ctor())) {
            return false;
        }
        return true;
    }
    function supportsByobReader(readable) {
        try {
            var reader = readable.getReader({ mode: 'byob' });
            reader.releaseLock();
            return true;
        }
        catch (_a) {
            return false;
        }
    }
    function supportsByteSource(ctor) {
        try {
            new ctor({ type: 'bytes' });
            return true;
        }
        catch (_a) {
            return false;
        }
    }

    function createReadableStreamWrapper(ctor) {
        assert(isReadableStreamConstructor(ctor));
        var byteSourceSupported = supportsByteSource(ctor);
        return function (readable, _a) {
            var _b = _a === void 0 ? {} : _a, type = _b.type;
            type = parseReadableType(type);
            if (type === 'bytes' && !byteSourceSupported) {
                type = undefined;
            }
            if (readable.constructor === ctor) {
                if (type !== 'bytes' || supportsByobReader(readable)) {
                    return readable;
                }
            }
            if (type === 'bytes') {
                var source = createWrappingReadableSource(readable, { type: type });
                return new ctor(source);
            }
            else {
                var source = createWrappingReadableSource(readable);
                return new ctor(source);
            }
        };
    }
    function createWrappingReadableSource(readable, _a) {
        var _b = _a === void 0 ? {} : _a, type = _b.type;
        assert(isReadableStream(readable));
        assert(readable.locked === false);
        type = parseReadableType(type);
        var source;
        if (type === 'bytes') {
            source = new WrappingReadableByteStreamSource(readable);
        }
        else {
            source = new WrappingReadableStreamDefaultSource(readable);
        }
        return source;
    }
    function parseReadableType(type) {
        var typeString = String(type);
        if (typeString === 'bytes') {
            return typeString;
        }
        else if (type === undefined) {
            return type;
        }
        else {
            throw new RangeError('Invalid type is specified');
        }
    }
    var AbstractWrappingReadableStreamSource = /** @class */ (function () {
        function AbstractWrappingReadableStreamSource(underlyingStream) {
            this._underlyingReader = undefined;
            this._readerMode = undefined;
            this._readableStreamController = undefined;
            this._pendingRead = undefined;
            this._underlyingStream = underlyingStream;
            // always keep a reader attached to detect close/error
            this._attachDefaultReader();
        }
        AbstractWrappingReadableStreamSource.prototype.start = function (controller) {
            this._readableStreamController = controller;
        };
        AbstractWrappingReadableStreamSource.prototype.cancel = function (reason) {
            assert(this._underlyingReader !== undefined);
            return this._underlyingReader.cancel(reason);
        };
        AbstractWrappingReadableStreamSource.prototype._attachDefaultReader = function () {
            if (this._readerMode === "default" /* DEFAULT */) {
                return;
            }
            this._detachReader();
            var reader = this._underlyingStream.getReader();
            this._readerMode = "default" /* DEFAULT */;
            this._attachReader(reader);
        };
        AbstractWrappingReadableStreamSource.prototype._attachReader = function (reader) {
            var _this = this;
            assert(this._underlyingReader === undefined);
            this._underlyingReader = reader;
            var closed = this._underlyingReader.closed;
            if (!closed) {
                return;
            }
            closed
                .then(function () { return _this._finishPendingRead(); })
                .then(function () {
                if (reader === _this._underlyingReader) {
                    _this._readableStreamController.close();
                }
            }, function (reason) {
                if (reader === _this._underlyingReader) {
                    _this._readableStreamController.error(reason);
                }
            })
                .catch(noop);
        };
        AbstractWrappingReadableStreamSource.prototype._detachReader = function () {
            if (this._underlyingReader === undefined) {
                return;
            }
            this._underlyingReader.releaseLock();
            this._underlyingReader = undefined;
            this._readerMode = undefined;
        };
        AbstractWrappingReadableStreamSource.prototype._pullWithDefaultReader = function () {
            var _this = this;
            this._attachDefaultReader();
            // TODO Backpressure?
            var read = this._underlyingReader.read()
                .then(function (result) {
                var controller = _this._readableStreamController;
                if (result.done) {
                    _this._tryClose();
                }
                else {
                    controller.enqueue(result.value);
                }
            });
            this._setPendingRead(read);
            return read;
        };
        AbstractWrappingReadableStreamSource.prototype._tryClose = function () {
            try {
                this._readableStreamController.close();
            }
            catch (_a) {
                // already errored or closed
            }
        };
        AbstractWrappingReadableStreamSource.prototype._setPendingRead = function (readPromise) {
            var _this = this;
            var pendingRead;
            var finishRead = function () {
                if (_this._pendingRead === pendingRead) {
                    _this._pendingRead = undefined;
                }
            };
            this._pendingRead = pendingRead = readPromise.then(finishRead, finishRead);
        };
        AbstractWrappingReadableStreamSource.prototype._finishPendingRead = function () {
            var _this = this;
            if (!this._pendingRead) {
                return undefined;
            }
            var afterRead = function () { return _this._finishPendingRead(); };
            return this._pendingRead.then(afterRead, afterRead);
        };
        return AbstractWrappingReadableStreamSource;
    }());
    var WrappingReadableStreamDefaultSource = /** @class */ (function (_super) {
        __extends(WrappingReadableStreamDefaultSource, _super);
        function WrappingReadableStreamDefaultSource() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        WrappingReadableStreamDefaultSource.prototype.pull = function () {
            return this._pullWithDefaultReader();
        };
        return WrappingReadableStreamDefaultSource;
    }(AbstractWrappingReadableStreamSource));
    function toUint8Array(view) {
        return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    function copyArrayBufferView(from, to) {
        var fromArray = toUint8Array(from);
        var toArray = toUint8Array(to);
        toArray.set(fromArray, 0);
    }
    var WrappingReadableByteStreamSource = /** @class */ (function (_super) {
        __extends(WrappingReadableByteStreamSource, _super);
        function WrappingReadableByteStreamSource(underlyingStream) {
            var _this = this;
            var supportsByob = supportsByobReader(underlyingStream);
            _this = _super.call(this, underlyingStream) || this;
            _this._supportsByob = supportsByob;
            return _this;
        }
        Object.defineProperty(WrappingReadableByteStreamSource.prototype, "type", {
            get: function () {
                return 'bytes';
            },
            enumerable: false,
            configurable: true
        });
        WrappingReadableByteStreamSource.prototype._attachByobReader = function () {
            if (this._readerMode === "byob" /* BYOB */) {
                return;
            }
            assert(this._supportsByob);
            this._detachReader();
            var reader = this._underlyingStream.getReader({ mode: 'byob' });
            this._readerMode = "byob" /* BYOB */;
            this._attachReader(reader);
        };
        WrappingReadableByteStreamSource.prototype.pull = function () {
            if (this._supportsByob) {
                var byobRequest = this._readableStreamController.byobRequest;
                if (byobRequest) {
                    return this._pullWithByobRequest(byobRequest);
                }
            }
            return this._pullWithDefaultReader();
        };
        WrappingReadableByteStreamSource.prototype._pullWithByobRequest = function (byobRequest) {
            var _this = this;
            this._attachByobReader();
            // reader.read(view) detaches the input view, therefore we cannot pass byobRequest.view directly
            // create a separate buffer to read into, then copy that to byobRequest.view
            var buffer = new Uint8Array(byobRequest.view.byteLength);
            // TODO Backpressure?
            var read = this._underlyingReader.read(buffer)
                .then(function (result) {
                _this._readableStreamController;
                if (result.done) {
                    _this._tryClose();
                    byobRequest.respond(0);
                }
                else {
                    copyArrayBufferView(result.value, byobRequest.view);
                    byobRequest.respond(result.value.byteLength);
                }
            });
            this._setPendingRead(read);
            return read;
        };
        return WrappingReadableByteStreamSource;
    }(AbstractWrappingReadableStreamSource));

    function createWritableStreamWrapper(ctor) {
        assert(isWritableStreamConstructor(ctor));
        return function (writable) {
            if (writable.constructor === ctor) {
                return writable;
            }
            var sink = createWrappingWritableSink(writable);
            return new ctor(sink);
        };
    }
    function createWrappingWritableSink(writable) {
        assert(isWritableStream(writable));
        assert(writable.locked === false);
        var writer = writable.getWriter();
        return new WrappingWritableStreamSink(writer);
    }
    var WrappingWritableStreamSink = /** @class */ (function () {
        function WrappingWritableStreamSink(underlyingWriter) {
            var _this = this;
            this._writableStreamController = undefined;
            this._pendingWrite = undefined;
            this._state = "writable" /* WRITABLE */;
            this._storedError = undefined;
            this._underlyingWriter = underlyingWriter;
            this._errorPromise = new Promise(function (resolve, reject) {
                _this._errorPromiseReject = reject;
            });
            this._errorPromise.catch(noop);
        }
        WrappingWritableStreamSink.prototype.start = function (controller) {
            var _this = this;
            this._writableStreamController = controller;
            this._underlyingWriter.closed
                .then(function () {
                _this._state = "closed" /* CLOSED */;
            })
                .catch(function (reason) { return _this._finishErroring(reason); });
        };
        WrappingWritableStreamSink.prototype.write = function (chunk) {
            var _this = this;
            var writer = this._underlyingWriter;
            // Detect past errors
            if (writer.desiredSize === null) {
                return writer.ready;
            }
            var writeRequest = writer.write(chunk);
            // Detect future errors
            writeRequest.catch(function (reason) { return _this._finishErroring(reason); });
            writer.ready.catch(function (reason) { return _this._startErroring(reason); });
            // Reject write when errored
            var write = Promise.race([writeRequest, this._errorPromise]);
            this._setPendingWrite(write);
            return write;
        };
        WrappingWritableStreamSink.prototype.close = function () {
            var _this = this;
            if (this._pendingWrite === undefined) {
                return this._underlyingWriter.close();
            }
            return this._finishPendingWrite().then(function () { return _this.close(); });
        };
        WrappingWritableStreamSink.prototype.abort = function (reason) {
            if (this._state === "errored" /* ERRORED */) {
                return undefined;
            }
            var writer = this._underlyingWriter;
            return writer.abort(reason);
        };
        WrappingWritableStreamSink.prototype._setPendingWrite = function (writePromise) {
            var _this = this;
            var pendingWrite;
            var finishWrite = function () {
                if (_this._pendingWrite === pendingWrite) {
                    _this._pendingWrite = undefined;
                }
            };
            this._pendingWrite = pendingWrite = writePromise.then(finishWrite, finishWrite);
        };
        WrappingWritableStreamSink.prototype._finishPendingWrite = function () {
            var _this = this;
            if (this._pendingWrite === undefined) {
                return Promise.resolve();
            }
            var afterWrite = function () { return _this._finishPendingWrite(); };
            return this._pendingWrite.then(afterWrite, afterWrite);
        };
        WrappingWritableStreamSink.prototype._startErroring = function (reason) {
            var _this = this;
            if (this._state === "writable" /* WRITABLE */) {
                this._state = "erroring" /* ERRORING */;
                this._storedError = reason;
                var afterWrite = function () { return _this._finishErroring(reason); };
                if (this._pendingWrite === undefined) {
                    afterWrite();
                }
                else {
                    this._finishPendingWrite().then(afterWrite, afterWrite);
                }
                this._writableStreamController.error(reason);
            }
        };
        WrappingWritableStreamSink.prototype._finishErroring = function (reason) {
            if (this._state === "writable" /* WRITABLE */) {
                this._startErroring(reason);
            }
            if (this._state === "erroring" /* ERRORING */) {
                this._state = "errored" /* ERRORED */;
                this._errorPromiseReject(this._storedError);
            }
        };
        return WrappingWritableStreamSink;
    }());

    function createTransformStreamWrapper(ctor) {
        assert(isTransformStreamConstructor(ctor));
        return function (transform) {
            if (transform.constructor === ctor) {
                return transform;
            }
            var transformer = createWrappingTransformer(transform);
            return new ctor(transformer);
        };
    }
    function createWrappingTransformer(transform) {
        assert(isTransformStream(transform));
        var readable = transform.readable, writable = transform.writable;
        assert(readable.locked === false);
        assert(writable.locked === false);
        var reader = readable.getReader();
        var writer;
        try {
            writer = writable.getWriter();
        }
        catch (e) {
            reader.releaseLock(); // do not leak reader
            throw e;
        }
        return new WrappingTransformStreamTransformer(reader, writer);
    }
    var WrappingTransformStreamTransformer = /** @class */ (function () {
        function WrappingTransformStreamTransformer(reader, writer) {
            var _this = this;
            this._transformStreamController = undefined;
            this._onRead = function (result) {
                if (result.done) {
                    return;
                }
                _this._transformStreamController.enqueue(result.value);
                return _this._reader.read().then(_this._onRead);
            };
            this._onError = function (reason) {
                _this._flushReject(reason);
                _this._transformStreamController.error(reason);
                _this._reader.cancel(reason).catch(noop);
                _this._writer.abort(reason).catch(noop);
            };
            this._onTerminate = function () {
                _this._flushResolve();
                _this._transformStreamController.terminate();
                var error = new TypeError('TransformStream terminated');
                _this._writer.abort(error).catch(noop);
            };
            this._reader = reader;
            this._writer = writer;
            this._flushPromise = new Promise(function (resolve, reject) {
                _this._flushResolve = resolve;
                _this._flushReject = reject;
            });
        }
        WrappingTransformStreamTransformer.prototype.start = function (controller) {
            this._transformStreamController = controller;
            this._reader.read()
                .then(this._onRead)
                .then(this._onTerminate, this._onError);
            var readerClosed = this._reader.closed;
            if (readerClosed) {
                readerClosed
                    .then(this._onTerminate, this._onError);
            }
        };
        WrappingTransformStreamTransformer.prototype.transform = function (chunk) {
            return this._writer.write(chunk);
        };
        WrappingTransformStreamTransformer.prototype.flush = function () {
            var _this = this;
            return this._writer.close()
                .then(function () { return _this._flushPromise; });
        };
        return WrappingTransformStreamTransformer;
    }());

    exports.createReadableStreamWrapper = createReadableStreamWrapper;
    exports.createTransformStreamWrapper = createTransformStreamWrapper;
    exports.createWrappingReadableSource = createWrappingReadableSource;
    exports.createWrappingTransformer = createWrappingTransformer;
    exports.createWrappingWritableSink = createWrappingWritableSink;
    exports.createWritableStreamWrapper = createWritableStreamWrapper;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=web-streams-adapter.js.map
