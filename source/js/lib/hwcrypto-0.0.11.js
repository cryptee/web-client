/*! This is hwcrypto.js 0.0.11 generated on 2017-01-25 */
/* DO NOT EDIT (use src/hwcrypto.js) */
var hwcrypto = function hwcrypto() {
    "use strict";
    var _debug = function(x) {};
    _debug("hwcrypto.js activated");
    window.addEventListener = window.addEventListener || window.attachEvent;
    function hasPluginFor(mime) {
        return navigator.mimeTypes && mime in navigator.mimeTypes;
    }
    function hasExtensionFor(cls) {
        return typeof window[cls] === "function";
    }
    function _hex2array(str) {
        if (typeof str == "string") {
            var len = Math.floor(str.length / 2);
            var ret = new Uint8Array(len);
            for (var i = 0; i < len; i++) {
                ret[i] = parseInt(str.substr(i * 2, 2), 16);
            }
            return ret;
        }
    }
    function _array2hex(args) {
        var ret = "";
        for (var i = 0; i < args.length; i++) ret += (args[i] < 16 ? "0" : "") + args[i].toString(16);
        return ret.toLowerCase();
    }
    function _mimeid(mime) {
        return "hwc" + mime.replace("/", "").replace("-", "");
    }
    function loadPluginFor(mime) {
        var element = _mimeid(mime);
        if (document.getElementById(element)) {
            _debug("Plugin element already loaded");
            return document.getElementById(element);
        }
        _debug("Loading plugin for " + mime + " into " + element);
        var objectTag = '<object id="' + element + '" type="' + mime + '" style="width: 1px; height: 1px; position: absolute; visibility: hidden;"></object>';
        var div = document.createElement("div");
        div.setAttribute("id", "pluginLocation" + element);
        document.body.appendChild(div);
        document.getElementById("pluginLocation" + element).innerHTML = objectTag;
        return document.getElementById(element);
    }
    var digidoc_mime = "application/x-digidoc";
    var digidoc_chrome = "TokenSigning";
    var USER_CANCEL = "user_cancel";
    var NO_CERTIFICATES = "no_certificates";
    var INVALID_ARGUMENT = "invalid_argument";
    var TECHNICAL_ERROR = "technical_error";
    var NO_IMPLEMENTATION = "no_implementation";
    var NOT_ALLOWED = "not_allowed";
    function probe() {
        var msg = "probe() detected ";
        if (hasExtensionFor(digidoc_chrome)) {
            _debug(msg + digidoc_chrome);
        }
        if (hasPluginFor(digidoc_mime)) {
            _debug(msg + digidoc_mime);
        }
    }
    window.addEventListener("load", function(event) {
        probe();
    });
    function DigiDocPlugin() {
        this._name = "NPAPI/BHO for application/x-digidoc";
        var p = loadPluginFor(digidoc_mime);
        var certificate_ids = {};
        function code2str(err) {
            _debug("Error: " + err + " with: " + p.errorMessage);
            switch (parseInt(err)) {
              case 1:
                return USER_CANCEL;

              case 2:
                return INVALID_ARGUMENT;

              case 17:
                return INVALID_ARGUMENT;

              case 19:
                return NOT_ALLOWED;

              default:
                _debug("Unknown error: " + err + " with: " + p.errorMessage);
                return TECHNICAL_ERROR;
            }
        }
        function code2err(err) {
            return new Error(code2str(err));
        }
        this.check = function() {
            return new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve(typeof p.version !== "undefined");
                }, 0);
            });
        };
        this.getVersion = function() {
            return new Promise(function(resolve, reject) {
                var v = p.version;
                resolve(v);
            });
        };
        this.getCertificate = function(options) {
            if (options && options.lang) {
                p.pluginLanguage = options.lang;
            }
            return new Promise(function(resolve, reject) {
                try {
                    var v = p.getCertificate();
                    if (parseInt(p.errorCode) !== 0) {
                        reject(code2err(p.errorCode));
                    } else {
                        certificate_ids[v.cert] = v.id;
                        resolve({
                            hex: v.cert
                        });
                    }
                } catch (ex) {
                    _debug(ex);
                    reject(code2err(p.errorCode));
                }
            });
        };
        this.sign = function(cert, hash, options) {
            return new Promise(function(resolve, reject) {
                var cid = certificate_ids[cert.hex];
                if (cid) {
                    try {
                        var language = options.lang || "en";
                        var v = p.sign(cid, hash.hex, language);
                        resolve({
                            hex: v
                        });
                    } catch (ex) {
                        _debug(JSON.stringify(ex));
                        reject(code2err(p.errorCode));
                    }
                } else {
                    _debug("invalid certificate: " + cert);
                    reject(new Error(INVALID_ARGUMENT));
                }
            });
        };
    }
    function DigiDocExtension() {
        this._name = "Chrome native messaging extension";
        var p = null;
        this.check = function() {
            return new Promise(function(resolve, reject) {
                if (!hasExtensionFor(digidoc_chrome)) {
                    return resolve(false);
                }
                p = new window[digidoc_chrome]();
                if (p) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        };
        this.getVersion = function() {
            return p.getVersion();
        };
        this.getCertificate = function(options) {
            return p.getCertificate(options);
        };
        this.sign = function(cert, hash, options) {
            return p.sign(cert, hash, options);
        };
    }
    function NoBackend() {
        this._name = "No implementation";
        this.check = function() {
            return new Promise(function(resolve, reject) {
                resolve(true);
            });
        };
        this.getVersion = function() {
            return Promise.reject(new Error(NO_IMPLEMENTATION));
        };
        this.getCertificate = function() {
            return Promise.reject(new Error(NO_IMPLEMENTATION));
        };
        this.sign = function() {
            return Promise.reject(new Error(NO_IMPLEMENTATION));
        };
    }
    var _backend = null;
    var fields = {};
    function _testAndUse(Backend) {
        return new Promise(function(resolve, reject) {
            var b = new Backend();
            b.check().then(function(isLoaded) {
                if (isLoaded) {
                    _debug("Using backend: " + b._name);
                    _backend = b;
                    resolve(true);
                } else {
                    _debug(b._name + " check() failed");
                    resolve(false);
                }
            });
        });
    }
    function _autodetect(force) {
        return new Promise(function(resolve, reject) {
            _debug("Autodetecting best backend");
            if (typeof force === "undefined") {
                force = false;
            }
            if (_backend !== null && !force) {
                return resolve(true);
            }
            function tryDigiDocPlugin() {
                _testAndUse(DigiDocPlugin).then(function(result) {
                    if (result) {
                        resolve(true);
                    } else {
                        resolve(_testAndUse(NoBackend));
                    }
                });
            }
            if (navigator.userAgent.indexOf("MSIE") != -1 || navigator.userAgent.indexOf("Trident") != -1) {
                _debug("Assuming IE BHO, testing");
                return tryDigiDocPlugin();
            }
            if (hasExtensionFor(digidoc_chrome)) {
                _testAndUse(DigiDocExtension).then(function(result) {
                    if (result) {
                        resolve(true);
                    } else {
                        tryDigiDocPlugin();
                    }
                });
                return;
            }
            if (hasPluginFor(digidoc_mime)) {
                return tryDigiDocPlugin();
            }
            resolve(_testAndUse(NoBackend));
        });
    }
    fields.use = function(backend) {
        return new Promise(function(resolve, reject) {
            if (typeof backend === "undefined" || backend === "auto") {
                _autodetect().then(function(result) {
                    resolve(result);
                });
            } else {
                if (backend === "chrome") {
                    resolve(_testAndUse(DigiDocExtension));
                } else if (backend === "npapi") {
                    resolve(_testAndUse(DigiDocPlugin));
                } else {
                    resolve(false);
                }
            }
        });
    };
    fields.debug = function() {
        return new Promise(function(resolve, reject) {
            var hwversion = "hwcrypto.js 0.0.11";
            _autodetect().then(function(result) {
                _backend.getVersion().then(function(version) {
                    resolve(hwversion + " with " + _backend._name + " " + version);
                }, function(error) {
                    resolve(hwversion + " with failing backend " + _backend._name);
                });
            });
        });
    };
    fields.getCertificate = function(options) {
        if (typeof options !== "object") {
            _debug("getCertificate options parameter must be an object");
            return Promise.reject(new Error(INVALID_ARGUMENT));
        }
        if (options && !options.lang) {
            options.lang = "en";
        }
        return _autodetect().then(function(result) {
            if (location.protocol !== "https:" && location.protocol !== "file:") {
                return Promise.reject(new Error(NOT_ALLOWED));
            }
            return _backend.getCertificate(options).then(function(certificate) {
                if (certificate.hex && !certificate.encoded) certificate.encoded = _hex2array(certificate.hex);
                return certificate;
            });
        });
    };
    fields.sign = function(cert, hash, options) {
        if (arguments.length < 2) return Promise.reject(new Error(INVALID_ARGUMENT));
        if (options && !options.lang) {
            options.lang = "en";
        }
        if (!hash.type || !hash.value && !hash.hex) return Promise.reject(new Error(INVALID_ARGUMENT));
        if (hash.hex && !hash.value) {
            _debug("DEPRECATED: hash.hex as argument to sign() is deprecated, use hash.value instead");
            hash.value = _hex2array(hash.hex);
        }
        if (hash.value && !hash.hex) hash.hex = _array2hex(hash.value);
        return _autodetect().then(function(result) {
            if (location.protocol !== "https:" && location.protocol !== "file:") {
                return Promise.reject(new Error(NOT_ALLOWED));
            }
            return _backend.sign(cert, hash, options).then(function(signature) {
                if (signature.hex && !signature.value) signature.value = _hex2array(signature.hex);
                return signature;
            });
        });
    };
    fields.NO_IMPLEMENTATION = NO_IMPLEMENTATION;
    fields.USER_CANCEL = USER_CANCEL;
    fields.NOT_ALLOWED = NOT_ALLOWED;
    fields.NO_CERTIFICATES = NO_CERTIFICATES;
    fields.TECHNICAL_ERROR = TECHNICAL_ERROR;
    fields.INVALID_ARGUMENT = INVALID_ARGUMENT;
    return fields;
}();