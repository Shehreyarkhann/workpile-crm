var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
function getDefaultExportFromCjs(x2) {
  return x2 && x2.__esModule && Object.prototype.hasOwnProperty.call(x2, "default") ? x2["default"] : x2;
}
var jsxRuntime = { exports: {} };
var reactJsxRuntime_production_min = {};
var react = { exports: {} };
var react_production_min = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var l$1 = Symbol.for("react.element"), n$1 = Symbol.for("react.portal"), p$2 = Symbol.for("react.fragment"), q$1 = Symbol.for("react.strict_mode"), r = Symbol.for("react.profiler"), t = Symbol.for("react.provider"), u = Symbol.for("react.context"), v$1 = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), y = Symbol.for("react.lazy"), z$1 = Symbol.iterator;
function A$1(a) {
  if (null === a || "object" !== typeof a) return null;
  a = z$1 && a[z$1] || a["@@iterator"];
  return "function" === typeof a ? a : null;
}
var B$1 = { isMounted: function() {
  return false;
}, enqueueForceUpdate: function() {
}, enqueueReplaceState: function() {
}, enqueueSetState: function() {
} }, C$1 = Object.assign, D$1 = {};
function E$1(a, b, e) {
  this.props = a;
  this.context = b;
  this.refs = D$1;
  this.updater = e || B$1;
}
E$1.prototype.isReactComponent = {};
E$1.prototype.setState = function(a, b) {
  if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
  this.updater.enqueueSetState(this, a, b, "setState");
};
E$1.prototype.forceUpdate = function(a) {
  this.updater.enqueueForceUpdate(this, a, "forceUpdate");
};
function F() {
}
F.prototype = E$1.prototype;
function G$1(a, b, e) {
  this.props = a;
  this.context = b;
  this.refs = D$1;
  this.updater = e || B$1;
}
var H$1 = G$1.prototype = new F();
H$1.constructor = G$1;
C$1(H$1, E$1.prototype);
H$1.isPureReactComponent = true;
var I$1 = Array.isArray, J = Object.prototype.hasOwnProperty, K$1 = { current: null }, L$1 = { key: true, ref: true, __self: true, __source: true };
function M$1(a, b, e) {
  var d, c = {}, k2 = null, h = null;
  if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k2 = "" + b.key), b) J.call(b, d) && !L$1.hasOwnProperty(d) && (c[d] = b[d]);
  var g = arguments.length - 2;
  if (1 === g) c.children = e;
  else if (1 < g) {
    for (var f2 = Array(g), m2 = 0; m2 < g; m2++) f2[m2] = arguments[m2 + 2];
    c.children = f2;
  }
  if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
  return { $$typeof: l$1, type: a, key: k2, ref: h, props: c, _owner: K$1.current };
}
function N$1(a, b) {
  return { $$typeof: l$1, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
}
function O$1(a) {
  return "object" === typeof a && null !== a && a.$$typeof === l$1;
}
function escape(a) {
  var b = { "=": "=0", ":": "=2" };
  return "$" + a.replace(/[=:]/g, function(a2) {
    return b[a2];
  });
}
var P$1 = /\/+/g;
function Q$1(a, b) {
  return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
}
function R$1(a, b, e, d, c) {
  var k2 = typeof a;
  if ("undefined" === k2 || "boolean" === k2) a = null;
  var h = false;
  if (null === a) h = true;
  else switch (k2) {
    case "string":
    case "number":
      h = true;
      break;
    case "object":
      switch (a.$$typeof) {
        case l$1:
        case n$1:
          h = true;
      }
  }
  if (h) return h = a, c = c(h), a = "" === d ? "." + Q$1(h, 0) : d, I$1(c) ? (e = "", null != a && (e = a.replace(P$1, "$&/") + "/"), R$1(c, b, e, "", function(a2) {
    return a2;
  })) : null != c && (O$1(c) && (c = N$1(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P$1, "$&/") + "/") + a)), b.push(c)), 1;
  h = 0;
  d = "" === d ? "." : d + ":";
  if (I$1(a)) for (var g = 0; g < a.length; g++) {
    k2 = a[g];
    var f2 = d + Q$1(k2, g);
    h += R$1(k2, b, e, f2, c);
  }
  else if (f2 = A$1(a), "function" === typeof f2) for (a = f2.call(a), g = 0; !(k2 = a.next()).done; ) k2 = k2.value, f2 = d + Q$1(k2, g++), h += R$1(k2, b, e, f2, c);
  else if ("object" === k2) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
  return h;
}
function S$1(a, b, e) {
  if (null == a) return a;
  var d = [], c = 0;
  R$1(a, d, "", "", function(a2) {
    return b.call(e, a2, c++);
  });
  return d;
}
function T$1(a) {
  if (-1 === a._status) {
    var b = a._result;
    b = b();
    b.then(function(b2) {
      if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
    }, function(b2) {
      if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
    });
    -1 === a._status && (a._status = 0, a._result = b);
  }
  if (1 === a._status) return a._result.default;
  throw a._result;
}
var U$1 = { current: null }, V$1 = { transition: null }, W$1 = { ReactCurrentDispatcher: U$1, ReactCurrentBatchConfig: V$1, ReactCurrentOwner: K$1 };
function X$1() {
  throw Error("act(...) is not supported in production builds of React.");
}
react_production_min.Children = { map: S$1, forEach: function(a, b, e) {
  S$1(a, function() {
    b.apply(this, arguments);
  }, e);
}, count: function(a) {
  var b = 0;
  S$1(a, function() {
    b++;
  });
  return b;
}, toArray: function(a) {
  return S$1(a, function(a2) {
    return a2;
  }) || [];
}, only: function(a) {
  if (!O$1(a)) throw Error("React.Children.only expected to receive a single React element child.");
  return a;
} };
react_production_min.Component = E$1;
react_production_min.Fragment = p$2;
react_production_min.Profiler = r;
react_production_min.PureComponent = G$1;
react_production_min.StrictMode = q$1;
react_production_min.Suspense = w;
react_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W$1;
react_production_min.act = X$1;
react_production_min.cloneElement = function(a, b, e) {
  if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
  var d = C$1({}, a.props), c = a.key, k2 = a.ref, h = a._owner;
  if (null != b) {
    void 0 !== b.ref && (k2 = b.ref, h = K$1.current);
    void 0 !== b.key && (c = "" + b.key);
    if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
    for (f2 in b) J.call(b, f2) && !L$1.hasOwnProperty(f2) && (d[f2] = void 0 === b[f2] && void 0 !== g ? g[f2] : b[f2]);
  }
  var f2 = arguments.length - 2;
  if (1 === f2) d.children = e;
  else if (1 < f2) {
    g = Array(f2);
    for (var m2 = 0; m2 < f2; m2++) g[m2] = arguments[m2 + 2];
    d.children = g;
  }
  return { $$typeof: l$1, type: a.type, key: c, ref: k2, props: d, _owner: h };
};
react_production_min.createContext = function(a) {
  a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
  a.Provider = { $$typeof: t, _context: a };
  return a.Consumer = a;
};
react_production_min.createElement = M$1;
react_production_min.createFactory = function(a) {
  var b = M$1.bind(null, a);
  b.type = a;
  return b;
};
react_production_min.createRef = function() {
  return { current: null };
};
react_production_min.forwardRef = function(a) {
  return { $$typeof: v$1, render: a };
};
react_production_min.isValidElement = O$1;
react_production_min.lazy = function(a) {
  return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T$1 };
};
react_production_min.memo = function(a, b) {
  return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
};
react_production_min.startTransition = function(a) {
  var b = V$1.transition;
  V$1.transition = {};
  try {
    a();
  } finally {
    V$1.transition = b;
  }
};
react_production_min.unstable_act = X$1;
react_production_min.useCallback = function(a, b) {
  return U$1.current.useCallback(a, b);
};
react_production_min.useContext = function(a) {
  return U$1.current.useContext(a);
};
react_production_min.useDebugValue = function() {
};
react_production_min.useDeferredValue = function(a) {
  return U$1.current.useDeferredValue(a);
};
react_production_min.useEffect = function(a, b) {
  return U$1.current.useEffect(a, b);
};
react_production_min.useId = function() {
  return U$1.current.useId();
};
react_production_min.useImperativeHandle = function(a, b, e) {
  return U$1.current.useImperativeHandle(a, b, e);
};
react_production_min.useInsertionEffect = function(a, b) {
  return U$1.current.useInsertionEffect(a, b);
};
react_production_min.useLayoutEffect = function(a, b) {
  return U$1.current.useLayoutEffect(a, b);
};
react_production_min.useMemo = function(a, b) {
  return U$1.current.useMemo(a, b);
};
react_production_min.useReducer = function(a, b, e) {
  return U$1.current.useReducer(a, b, e);
};
react_production_min.useRef = function(a) {
  return U$1.current.useRef(a);
};
react_production_min.useState = function(a) {
  return U$1.current.useState(a);
};
react_production_min.useSyncExternalStore = function(a, b, e) {
  return U$1.current.useSyncExternalStore(a, b, e);
};
react_production_min.useTransition = function() {
  return U$1.current.useTransition();
};
react_production_min.version = "18.3.1";
{
  react.exports = react_production_min;
}
var reactExports = react.exports;
const React = /* @__PURE__ */ getDefaultExportFromCjs(reactExports);
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var f = reactExports, k = Symbol.for("react.element"), l = Symbol.for("react.fragment"), m$1 = Object.prototype.hasOwnProperty, n = f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, p$1 = { key: true, ref: true, __self: true, __source: true };
function q(c, a, g) {
  var b, d = {}, e = null, h = null;
  void 0 !== g && (e = "" + g);
  void 0 !== a.key && (e = "" + a.key);
  void 0 !== a.ref && (h = a.ref);
  for (b in a) m$1.call(a, b) && !p$1.hasOwnProperty(b) && (d[b] = a[b]);
  if (c && c.defaultProps) for (b in a = c.defaultProps, a) void 0 === d[b] && (d[b] = a[b]);
  return { $$typeof: k, type: c, key: e, ref: h, props: d, _owner: n.current };
}
reactJsxRuntime_production_min.Fragment = l;
reactJsxRuntime_production_min.jsx = q;
reactJsxRuntime_production_min.jsxs = q;
{
  jsxRuntime.exports = reactJsxRuntime_production_min;
}
var jsxRuntimeExports = jsxRuntime.exports;
var reactDom = { exports: {} };
var reactDom_production_min = {};
var scheduler = { exports: {} };
var scheduler_production_min = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function(exports) {
  function f2(a, b) {
    var c = a.length;
    a.push(b);
    a: for (; 0 < c; ) {
      var d = c - 1 >>> 1, e = a[d];
      if (0 < g(e, b)) a[d] = b, a[c] = e, c = d;
      else break a;
    }
  }
  function h(a) {
    return 0 === a.length ? null : a[0];
  }
  function k2(a) {
    if (0 === a.length) return null;
    var b = a[0], c = a.pop();
    if (c !== b) {
      a[0] = c;
      a: for (var d = 0, e = a.length, w2 = e >>> 1; d < w2; ) {
        var m2 = 2 * (d + 1) - 1, C2 = a[m2], n2 = m2 + 1, x2 = a[n2];
        if (0 > g(C2, c)) n2 < e && 0 > g(x2, C2) ? (a[d] = x2, a[n2] = c, d = n2) : (a[d] = C2, a[m2] = c, d = m2);
        else if (n2 < e && 0 > g(x2, c)) a[d] = x2, a[n2] = c, d = n2;
        else break a;
      }
    }
    return b;
  }
  function g(a, b) {
    var c = a.sortIndex - b.sortIndex;
    return 0 !== c ? c : a.id - b.id;
  }
  if ("object" === typeof performance && "function" === typeof performance.now) {
    var l2 = performance;
    exports.unstable_now = function() {
      return l2.now();
    };
  } else {
    var p2 = Date, q2 = p2.now();
    exports.unstable_now = function() {
      return p2.now() - q2;
    };
  }
  var r2 = [], t2 = [], u2 = 1, v2 = null, y2 = 3, z2 = false, A2 = false, B2 = false, D2 = "function" === typeof setTimeout ? setTimeout : null, E2 = "function" === typeof clearTimeout ? clearTimeout : null, F2 = "undefined" !== typeof setImmediate ? setImmediate : null;
  "undefined" !== typeof navigator && void 0 !== navigator.scheduling && void 0 !== navigator.scheduling.isInputPending && navigator.scheduling.isInputPending.bind(navigator.scheduling);
  function G2(a) {
    for (var b = h(t2); null !== b; ) {
      if (null === b.callback) k2(t2);
      else if (b.startTime <= a) k2(t2), b.sortIndex = b.expirationTime, f2(r2, b);
      else break;
      b = h(t2);
    }
  }
  function H2(a) {
    B2 = false;
    G2(a);
    if (!A2) if (null !== h(r2)) A2 = true, I2(J2);
    else {
      var b = h(t2);
      null !== b && K2(H2, b.startTime - a);
    }
  }
  function J2(a, b) {
    A2 = false;
    B2 && (B2 = false, E2(L2), L2 = -1);
    z2 = true;
    var c = y2;
    try {
      G2(b);
      for (v2 = h(r2); null !== v2 && (!(v2.expirationTime > b) || a && !M2()); ) {
        var d = v2.callback;
        if ("function" === typeof d) {
          v2.callback = null;
          y2 = v2.priorityLevel;
          var e = d(v2.expirationTime <= b);
          b = exports.unstable_now();
          "function" === typeof e ? v2.callback = e : v2 === h(r2) && k2(r2);
          G2(b);
        } else k2(r2);
        v2 = h(r2);
      }
      if (null !== v2) var w2 = true;
      else {
        var m2 = h(t2);
        null !== m2 && K2(H2, m2.startTime - b);
        w2 = false;
      }
      return w2;
    } finally {
      v2 = null, y2 = c, z2 = false;
    }
  }
  var N2 = false, O2 = null, L2 = -1, P2 = 5, Q2 = -1;
  function M2() {
    return exports.unstable_now() - Q2 < P2 ? false : true;
  }
  function R2() {
    if (null !== O2) {
      var a = exports.unstable_now();
      Q2 = a;
      var b = true;
      try {
        b = O2(true, a);
      } finally {
        b ? S2() : (N2 = false, O2 = null);
      }
    } else N2 = false;
  }
  var S2;
  if ("function" === typeof F2) S2 = function() {
    F2(R2);
  };
  else if ("undefined" !== typeof MessageChannel) {
    var T2 = new MessageChannel(), U2 = T2.port2;
    T2.port1.onmessage = R2;
    S2 = function() {
      U2.postMessage(null);
    };
  } else S2 = function() {
    D2(R2, 0);
  };
  function I2(a) {
    O2 = a;
    N2 || (N2 = true, S2());
  }
  function K2(a, b) {
    L2 = D2(function() {
      a(exports.unstable_now());
    }, b);
  }
  exports.unstable_IdlePriority = 5;
  exports.unstable_ImmediatePriority = 1;
  exports.unstable_LowPriority = 4;
  exports.unstable_NormalPriority = 3;
  exports.unstable_Profiling = null;
  exports.unstable_UserBlockingPriority = 2;
  exports.unstable_cancelCallback = function(a) {
    a.callback = null;
  };
  exports.unstable_continueExecution = function() {
    A2 || z2 || (A2 = true, I2(J2));
  };
  exports.unstable_forceFrameRate = function(a) {
    0 > a || 125 < a ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : P2 = 0 < a ? Math.floor(1e3 / a) : 5;
  };
  exports.unstable_getCurrentPriorityLevel = function() {
    return y2;
  };
  exports.unstable_getFirstCallbackNode = function() {
    return h(r2);
  };
  exports.unstable_next = function(a) {
    switch (y2) {
      case 1:
      case 2:
      case 3:
        var b = 3;
        break;
      default:
        b = y2;
    }
    var c = y2;
    y2 = b;
    try {
      return a();
    } finally {
      y2 = c;
    }
  };
  exports.unstable_pauseExecution = function() {
  };
  exports.unstable_requestPaint = function() {
  };
  exports.unstable_runWithPriority = function(a, b) {
    switch (a) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        break;
      default:
        a = 3;
    }
    var c = y2;
    y2 = a;
    try {
      return b();
    } finally {
      y2 = c;
    }
  };
  exports.unstable_scheduleCallback = function(a, b, c) {
    var d = exports.unstable_now();
    "object" === typeof c && null !== c ? (c = c.delay, c = "number" === typeof c && 0 < c ? d + c : d) : c = d;
    switch (a) {
      case 1:
        var e = -1;
        break;
      case 2:
        e = 250;
        break;
      case 5:
        e = 1073741823;
        break;
      case 4:
        e = 1e4;
        break;
      default:
        e = 5e3;
    }
    e = c + e;
    a = { id: u2++, callback: b, priorityLevel: a, startTime: c, expirationTime: e, sortIndex: -1 };
    c > d ? (a.sortIndex = c, f2(t2, a), null === h(r2) && a === h(t2) && (B2 ? (E2(L2), L2 = -1) : B2 = true, K2(H2, c - d))) : (a.sortIndex = e, f2(r2, a), A2 || z2 || (A2 = true, I2(J2)));
    return a;
  };
  exports.unstable_shouldYield = M2;
  exports.unstable_wrapCallback = function(a) {
    var b = y2;
    return function() {
      var c = y2;
      y2 = b;
      try {
        return a.apply(this, arguments);
      } finally {
        y2 = c;
      }
    };
  };
})(scheduler_production_min);
{
  scheduler.exports = scheduler_production_min;
}
var schedulerExports = scheduler.exports;
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var aa = reactExports, ca = schedulerExports;
function p(a) {
  for (var b = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c = 1; c < arguments.length; c++) b += "&args[]=" + encodeURIComponent(arguments[c]);
  return "Minified React error #" + a + "; visit " + b + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
}
var da = /* @__PURE__ */ new Set(), ea = {};
function fa(a, b) {
  ha(a, b);
  ha(a + "Capture", b);
}
function ha(a, b) {
  ea[a] = b;
  for (a = 0; a < b.length; a++) da.add(b[a]);
}
var ia = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement), ja = Object.prototype.hasOwnProperty, ka = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, la = {}, ma = {};
function oa(a) {
  if (ja.call(ma, a)) return true;
  if (ja.call(la, a)) return false;
  if (ka.test(a)) return ma[a] = true;
  la[a] = true;
  return false;
}
function pa(a, b, c, d) {
  if (null !== c && 0 === c.type) return false;
  switch (typeof b) {
    case "function":
    case "symbol":
      return true;
    case "boolean":
      if (d) return false;
      if (null !== c) return !c.acceptsBooleans;
      a = a.toLowerCase().slice(0, 5);
      return "data-" !== a && "aria-" !== a;
    default:
      return false;
  }
}
function qa(a, b, c, d) {
  if (null === b || "undefined" === typeof b || pa(a, b, c, d)) return true;
  if (d) return false;
  if (null !== c) switch (c.type) {
    case 3:
      return !b;
    case 4:
      return false === b;
    case 5:
      return isNaN(b);
    case 6:
      return isNaN(b) || 1 > b;
  }
  return false;
}
function v(a, b, c, d, e, f2, g) {
  this.acceptsBooleans = 2 === b || 3 === b || 4 === b;
  this.attributeName = d;
  this.attributeNamespace = e;
  this.mustUseProperty = c;
  this.propertyName = a;
  this.type = b;
  this.sanitizeURL = f2;
  this.removeEmptyString = g;
}
var z = {};
"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(a) {
  z[a] = new v(a, 0, false, a, null, false, false);
});
[["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(a) {
  var b = a[0];
  z[b] = new v(b, 1, false, a[1], null, false, false);
});
["contentEditable", "draggable", "spellCheck", "value"].forEach(function(a) {
  z[a] = new v(a, 2, false, a.toLowerCase(), null, false, false);
});
["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(a) {
  z[a] = new v(a, 2, false, a, null, false, false);
});
"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(a) {
  z[a] = new v(a, 3, false, a.toLowerCase(), null, false, false);
});
["checked", "multiple", "muted", "selected"].forEach(function(a) {
  z[a] = new v(a, 3, true, a, null, false, false);
});
["capture", "download"].forEach(function(a) {
  z[a] = new v(a, 4, false, a, null, false, false);
});
["cols", "rows", "size", "span"].forEach(function(a) {
  z[a] = new v(a, 6, false, a, null, false, false);
});
["rowSpan", "start"].forEach(function(a) {
  z[a] = new v(a, 5, false, a.toLowerCase(), null, false, false);
});
var ra = /[\-:]([a-z])/g;
function sa(a) {
  return a[1].toUpperCase();
}
"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(a) {
  var b = a.replace(
    ra,
    sa
  );
  z[b] = new v(b, 1, false, a, null, false, false);
});
"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(a) {
  var b = a.replace(ra, sa);
  z[b] = new v(b, 1, false, a, "http://www.w3.org/1999/xlink", false, false);
});
["xml:base", "xml:lang", "xml:space"].forEach(function(a) {
  var b = a.replace(ra, sa);
  z[b] = new v(b, 1, false, a, "http://www.w3.org/XML/1998/namespace", false, false);
});
["tabIndex", "crossOrigin"].forEach(function(a) {
  z[a] = new v(a, 1, false, a.toLowerCase(), null, false, false);
});
z.xlinkHref = new v("xlinkHref", 1, false, "xlink:href", "http://www.w3.org/1999/xlink", true, false);
["src", "href", "action", "formAction"].forEach(function(a) {
  z[a] = new v(a, 1, false, a.toLowerCase(), null, true, true);
});
function ta(a, b, c, d) {
  var e = z.hasOwnProperty(b) ? z[b] : null;
  if (null !== e ? 0 !== e.type : d || !(2 < b.length) || "o" !== b[0] && "O" !== b[0] || "n" !== b[1] && "N" !== b[1]) qa(b, c, e, d) && (c = null), d || null === e ? oa(b) && (null === c ? a.removeAttribute(b) : a.setAttribute(b, "" + c)) : e.mustUseProperty ? a[e.propertyName] = null === c ? 3 === e.type ? false : "" : c : (b = e.attributeName, d = e.attributeNamespace, null === c ? a.removeAttribute(b) : (e = e.type, c = 3 === e || 4 === e && true === c ? "" : "" + c, d ? a.setAttributeNS(d, b, c) : a.setAttribute(b, c)));
}
var ua = aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, va = Symbol.for("react.element"), wa = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), za = Symbol.for("react.strict_mode"), Aa = Symbol.for("react.profiler"), Ba = Symbol.for("react.provider"), Ca = Symbol.for("react.context"), Da = Symbol.for("react.forward_ref"), Ea = Symbol.for("react.suspense"), Fa = Symbol.for("react.suspense_list"), Ga = Symbol.for("react.memo"), Ha = Symbol.for("react.lazy");
var Ia = Symbol.for("react.offscreen");
var Ja = Symbol.iterator;
function Ka(a) {
  if (null === a || "object" !== typeof a) return null;
  a = Ja && a[Ja] || a["@@iterator"];
  return "function" === typeof a ? a : null;
}
var A = Object.assign, La;
function Ma(a) {
  if (void 0 === La) try {
    throw Error();
  } catch (c) {
    var b = c.stack.trim().match(/\n( *(at )?)/);
    La = b && b[1] || "";
  }
  return "\n" + La + a;
}
var Na = false;
function Oa(a, b) {
  if (!a || Na) return "";
  Na = true;
  var c = Error.prepareStackTrace;
  Error.prepareStackTrace = void 0;
  try {
    if (b) if (b = function() {
      throw Error();
    }, Object.defineProperty(b.prototype, "props", { set: function() {
      throw Error();
    } }), "object" === typeof Reflect && Reflect.construct) {
      try {
        Reflect.construct(b, []);
      } catch (l2) {
        var d = l2;
      }
      Reflect.construct(a, [], b);
    } else {
      try {
        b.call();
      } catch (l2) {
        d = l2;
      }
      a.call(b.prototype);
    }
    else {
      try {
        throw Error();
      } catch (l2) {
        d = l2;
      }
      a();
    }
  } catch (l2) {
    if (l2 && d && "string" === typeof l2.stack) {
      for (var e = l2.stack.split("\n"), f2 = d.stack.split("\n"), g = e.length - 1, h = f2.length - 1; 1 <= g && 0 <= h && e[g] !== f2[h]; ) h--;
      for (; 1 <= g && 0 <= h; g--, h--) if (e[g] !== f2[h]) {
        if (1 !== g || 1 !== h) {
          do
            if (g--, h--, 0 > h || e[g] !== f2[h]) {
              var k2 = "\n" + e[g].replace(" at new ", " at ");
              a.displayName && k2.includes("<anonymous>") && (k2 = k2.replace("<anonymous>", a.displayName));
              return k2;
            }
          while (1 <= g && 0 <= h);
        }
        break;
      }
    }
  } finally {
    Na = false, Error.prepareStackTrace = c;
  }
  return (a = a ? a.displayName || a.name : "") ? Ma(a) : "";
}
function Pa(a) {
  switch (a.tag) {
    case 5:
      return Ma(a.type);
    case 16:
      return Ma("Lazy");
    case 13:
      return Ma("Suspense");
    case 19:
      return Ma("SuspenseList");
    case 0:
    case 2:
    case 15:
      return a = Oa(a.type, false), a;
    case 11:
      return a = Oa(a.type.render, false), a;
    case 1:
      return a = Oa(a.type, true), a;
    default:
      return "";
  }
}
function Qa(a) {
  if (null == a) return null;
  if ("function" === typeof a) return a.displayName || a.name || null;
  if ("string" === typeof a) return a;
  switch (a) {
    case ya:
      return "Fragment";
    case wa:
      return "Portal";
    case Aa:
      return "Profiler";
    case za:
      return "StrictMode";
    case Ea:
      return "Suspense";
    case Fa:
      return "SuspenseList";
  }
  if ("object" === typeof a) switch (a.$$typeof) {
    case Ca:
      return (a.displayName || "Context") + ".Consumer";
    case Ba:
      return (a._context.displayName || "Context") + ".Provider";
    case Da:
      var b = a.render;
      a = a.displayName;
      a || (a = b.displayName || b.name || "", a = "" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
      return a;
    case Ga:
      return b = a.displayName || null, null !== b ? b : Qa(a.type) || "Memo";
    case Ha:
      b = a._payload;
      a = a._init;
      try {
        return Qa(a(b));
      } catch (c) {
      }
  }
  return null;
}
function Ra(a) {
  var b = a.type;
  switch (a.tag) {
    case 24:
      return "Cache";
    case 9:
      return (b.displayName || "Context") + ".Consumer";
    case 10:
      return (b._context.displayName || "Context") + ".Provider";
    case 18:
      return "DehydratedFragment";
    case 11:
      return a = b.render, a = a.displayName || a.name || "", b.displayName || ("" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
    case 7:
      return "Fragment";
    case 5:
      return b;
    case 4:
      return "Portal";
    case 3:
      return "Root";
    case 6:
      return "Text";
    case 16:
      return Qa(b);
    case 8:
      return b === za ? "StrictMode" : "Mode";
    case 22:
      return "Offscreen";
    case 12:
      return "Profiler";
    case 21:
      return "Scope";
    case 13:
      return "Suspense";
    case 19:
      return "SuspenseList";
    case 25:
      return "TracingMarker";
    case 1:
    case 0:
    case 17:
    case 2:
    case 14:
    case 15:
      if ("function" === typeof b) return b.displayName || b.name || null;
      if ("string" === typeof b) return b;
  }
  return null;
}
function Sa(a) {
  switch (typeof a) {
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return a;
    case "object":
      return a;
    default:
      return "";
  }
}
function Ta(a) {
  var b = a.type;
  return (a = a.nodeName) && "input" === a.toLowerCase() && ("checkbox" === b || "radio" === b);
}
function Ua(a) {
  var b = Ta(a) ? "checked" : "value", c = Object.getOwnPropertyDescriptor(a.constructor.prototype, b), d = "" + a[b];
  if (!a.hasOwnProperty(b) && "undefined" !== typeof c && "function" === typeof c.get && "function" === typeof c.set) {
    var e = c.get, f2 = c.set;
    Object.defineProperty(a, b, { configurable: true, get: function() {
      return e.call(this);
    }, set: function(a2) {
      d = "" + a2;
      f2.call(this, a2);
    } });
    Object.defineProperty(a, b, { enumerable: c.enumerable });
    return { getValue: function() {
      return d;
    }, setValue: function(a2) {
      d = "" + a2;
    }, stopTracking: function() {
      a._valueTracker = null;
      delete a[b];
    } };
  }
}
function Va(a) {
  a._valueTracker || (a._valueTracker = Ua(a));
}
function Wa(a) {
  if (!a) return false;
  var b = a._valueTracker;
  if (!b) return true;
  var c = b.getValue();
  var d = "";
  a && (d = Ta(a) ? a.checked ? "true" : "false" : a.value);
  a = d;
  return a !== c ? (b.setValue(a), true) : false;
}
function Xa(a) {
  a = a || ("undefined" !== typeof document ? document : void 0);
  if ("undefined" === typeof a) return null;
  try {
    return a.activeElement || a.body;
  } catch (b) {
    return a.body;
  }
}
function Ya(a, b) {
  var c = b.checked;
  return A({}, b, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: null != c ? c : a._wrapperState.initialChecked });
}
function Za(a, b) {
  var c = null == b.defaultValue ? "" : b.defaultValue, d = null != b.checked ? b.checked : b.defaultChecked;
  c = Sa(null != b.value ? b.value : c);
  a._wrapperState = { initialChecked: d, initialValue: c, controlled: "checkbox" === b.type || "radio" === b.type ? null != b.checked : null != b.value };
}
function ab(a, b) {
  b = b.checked;
  null != b && ta(a, "checked", b, false);
}
function bb(a, b) {
  ab(a, b);
  var c = Sa(b.value), d = b.type;
  if (null != c) if ("number" === d) {
    if (0 === c && "" === a.value || a.value != c) a.value = "" + c;
  } else a.value !== "" + c && (a.value = "" + c);
  else if ("submit" === d || "reset" === d) {
    a.removeAttribute("value");
    return;
  }
  b.hasOwnProperty("value") ? cb(a, b.type, c) : b.hasOwnProperty("defaultValue") && cb(a, b.type, Sa(b.defaultValue));
  null == b.checked && null != b.defaultChecked && (a.defaultChecked = !!b.defaultChecked);
}
function db(a, b, c) {
  if (b.hasOwnProperty("value") || b.hasOwnProperty("defaultValue")) {
    var d = b.type;
    if (!("submit" !== d && "reset" !== d || void 0 !== b.value && null !== b.value)) return;
    b = "" + a._wrapperState.initialValue;
    c || b === a.value || (a.value = b);
    a.defaultValue = b;
  }
  c = a.name;
  "" !== c && (a.name = "");
  a.defaultChecked = !!a._wrapperState.initialChecked;
  "" !== c && (a.name = c);
}
function cb(a, b, c) {
  if ("number" !== b || Xa(a.ownerDocument) !== a) null == c ? a.defaultValue = "" + a._wrapperState.initialValue : a.defaultValue !== "" + c && (a.defaultValue = "" + c);
}
var eb = Array.isArray;
function fb(a, b, c, d) {
  a = a.options;
  if (b) {
    b = {};
    for (var e = 0; e < c.length; e++) b["$" + c[e]] = true;
    for (c = 0; c < a.length; c++) e = b.hasOwnProperty("$" + a[c].value), a[c].selected !== e && (a[c].selected = e), e && d && (a[c].defaultSelected = true);
  } else {
    c = "" + Sa(c);
    b = null;
    for (e = 0; e < a.length; e++) {
      if (a[e].value === c) {
        a[e].selected = true;
        d && (a[e].defaultSelected = true);
        return;
      }
      null !== b || a[e].disabled || (b = a[e]);
    }
    null !== b && (b.selected = true);
  }
}
function gb(a, b) {
  if (null != b.dangerouslySetInnerHTML) throw Error(p(91));
  return A({}, b, { value: void 0, defaultValue: void 0, children: "" + a._wrapperState.initialValue });
}
function hb(a, b) {
  var c = b.value;
  if (null == c) {
    c = b.children;
    b = b.defaultValue;
    if (null != c) {
      if (null != b) throw Error(p(92));
      if (eb(c)) {
        if (1 < c.length) throw Error(p(93));
        c = c[0];
      }
      b = c;
    }
    null == b && (b = "");
    c = b;
  }
  a._wrapperState = { initialValue: Sa(c) };
}
function ib(a, b) {
  var c = Sa(b.value), d = Sa(b.defaultValue);
  null != c && (c = "" + c, c !== a.value && (a.value = c), null == b.defaultValue && a.defaultValue !== c && (a.defaultValue = c));
  null != d && (a.defaultValue = "" + d);
}
function jb(a) {
  var b = a.textContent;
  b === a._wrapperState.initialValue && "" !== b && null !== b && (a.value = b);
}
function kb(a) {
  switch (a) {
    case "svg":
      return "http://www.w3.org/2000/svg";
    case "math":
      return "http://www.w3.org/1998/Math/MathML";
    default:
      return "http://www.w3.org/1999/xhtml";
  }
}
function lb(a, b) {
  return null == a || "http://www.w3.org/1999/xhtml" === a ? kb(b) : "http://www.w3.org/2000/svg" === a && "foreignObject" === b ? "http://www.w3.org/1999/xhtml" : a;
}
var mb, nb = function(a) {
  return "undefined" !== typeof MSApp && MSApp.execUnsafeLocalFunction ? function(b, c, d, e) {
    MSApp.execUnsafeLocalFunction(function() {
      return a(b, c, d, e);
    });
  } : a;
}(function(a, b) {
  if ("http://www.w3.org/2000/svg" !== a.namespaceURI || "innerHTML" in a) a.innerHTML = b;
  else {
    mb = mb || document.createElement("div");
    mb.innerHTML = "<svg>" + b.valueOf().toString() + "</svg>";
    for (b = mb.firstChild; a.firstChild; ) a.removeChild(a.firstChild);
    for (; b.firstChild; ) a.appendChild(b.firstChild);
  }
});
function ob(a, b) {
  if (b) {
    var c = a.firstChild;
    if (c && c === a.lastChild && 3 === c.nodeType) {
      c.nodeValue = b;
      return;
    }
  }
  a.textContent = b;
}
var pb = {
  animationIterationCount: true,
  aspectRatio: true,
  borderImageOutset: true,
  borderImageSlice: true,
  borderImageWidth: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  columns: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  flexOrder: true,
  gridArea: true,
  gridRow: true,
  gridRowEnd: true,
  gridRowSpan: true,
  gridRowStart: true,
  gridColumn: true,
  gridColumnEnd: true,
  gridColumnSpan: true,
  gridColumnStart: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,
  fillOpacity: true,
  floodOpacity: true,
  stopOpacity: true,
  strokeDasharray: true,
  strokeDashoffset: true,
  strokeMiterlimit: true,
  strokeOpacity: true,
  strokeWidth: true
}, qb = ["Webkit", "ms", "Moz", "O"];
Object.keys(pb).forEach(function(a) {
  qb.forEach(function(b) {
    b = b + a.charAt(0).toUpperCase() + a.substring(1);
    pb[b] = pb[a];
  });
});
function rb(a, b, c) {
  return null == b || "boolean" === typeof b || "" === b ? "" : c || "number" !== typeof b || 0 === b || pb.hasOwnProperty(a) && pb[a] ? ("" + b).trim() : b + "px";
}
function sb(a, b) {
  a = a.style;
  for (var c in b) if (b.hasOwnProperty(c)) {
    var d = 0 === c.indexOf("--"), e = rb(c, b[c], d);
    "float" === c && (c = "cssFloat");
    d ? a.setProperty(c, e) : a[c] = e;
  }
}
var tb = A({ menuitem: true }, { area: true, base: true, br: true, col: true, embed: true, hr: true, img: true, input: true, keygen: true, link: true, meta: true, param: true, source: true, track: true, wbr: true });
function ub(a, b) {
  if (b) {
    if (tb[a] && (null != b.children || null != b.dangerouslySetInnerHTML)) throw Error(p(137, a));
    if (null != b.dangerouslySetInnerHTML) {
      if (null != b.children) throw Error(p(60));
      if ("object" !== typeof b.dangerouslySetInnerHTML || !("__html" in b.dangerouslySetInnerHTML)) throw Error(p(61));
    }
    if (null != b.style && "object" !== typeof b.style) throw Error(p(62));
  }
}
function vb(a, b) {
  if (-1 === a.indexOf("-")) return "string" === typeof b.is;
  switch (a) {
    case "annotation-xml":
    case "color-profile":
    case "font-face":
    case "font-face-src":
    case "font-face-uri":
    case "font-face-format":
    case "font-face-name":
    case "missing-glyph":
      return false;
    default:
      return true;
  }
}
var wb = null;
function xb(a) {
  a = a.target || a.srcElement || window;
  a.correspondingUseElement && (a = a.correspondingUseElement);
  return 3 === a.nodeType ? a.parentNode : a;
}
var yb = null, zb = null, Ab = null;
function Bb(a) {
  if (a = Cb(a)) {
    if ("function" !== typeof yb) throw Error(p(280));
    var b = a.stateNode;
    b && (b = Db(b), yb(a.stateNode, a.type, b));
  }
}
function Eb(a) {
  zb ? Ab ? Ab.push(a) : Ab = [a] : zb = a;
}
function Fb() {
  if (zb) {
    var a = zb, b = Ab;
    Ab = zb = null;
    Bb(a);
    if (b) for (a = 0; a < b.length; a++) Bb(b[a]);
  }
}
function Gb(a, b) {
  return a(b);
}
function Hb() {
}
var Ib = false;
function Jb(a, b, c) {
  if (Ib) return a(b, c);
  Ib = true;
  try {
    return Gb(a, b, c);
  } finally {
    if (Ib = false, null !== zb || null !== Ab) Hb(), Fb();
  }
}
function Kb(a, b) {
  var c = a.stateNode;
  if (null === c) return null;
  var d = Db(c);
  if (null === d) return null;
  c = d[b];
  a: switch (b) {
    case "onClick":
    case "onClickCapture":
    case "onDoubleClick":
    case "onDoubleClickCapture":
    case "onMouseDown":
    case "onMouseDownCapture":
    case "onMouseMove":
    case "onMouseMoveCapture":
    case "onMouseUp":
    case "onMouseUpCapture":
    case "onMouseEnter":
      (d = !d.disabled) || (a = a.type, d = !("button" === a || "input" === a || "select" === a || "textarea" === a));
      a = !d;
      break a;
    default:
      a = false;
  }
  if (a) return null;
  if (c && "function" !== typeof c) throw Error(p(231, b, typeof c));
  return c;
}
var Lb = false;
if (ia) try {
  var Mb = {};
  Object.defineProperty(Mb, "passive", { get: function() {
    Lb = true;
  } });
  window.addEventListener("test", Mb, Mb);
  window.removeEventListener("test", Mb, Mb);
} catch (a) {
  Lb = false;
}
function Nb(a, b, c, d, e, f2, g, h, k2) {
  var l2 = Array.prototype.slice.call(arguments, 3);
  try {
    b.apply(c, l2);
  } catch (m2) {
    this.onError(m2);
  }
}
var Ob = false, Pb = null, Qb = false, Rb = null, Sb = { onError: function(a) {
  Ob = true;
  Pb = a;
} };
function Tb(a, b, c, d, e, f2, g, h, k2) {
  Ob = false;
  Pb = null;
  Nb.apply(Sb, arguments);
}
function Ub(a, b, c, d, e, f2, g, h, k2) {
  Tb.apply(this, arguments);
  if (Ob) {
    if (Ob) {
      var l2 = Pb;
      Ob = false;
      Pb = null;
    } else throw Error(p(198));
    Qb || (Qb = true, Rb = l2);
  }
}
function Vb(a) {
  var b = a, c = a;
  if (a.alternate) for (; b.return; ) b = b.return;
  else {
    a = b;
    do
      b = a, 0 !== (b.flags & 4098) && (c = b.return), a = b.return;
    while (a);
  }
  return 3 === b.tag ? c : null;
}
function Wb(a) {
  if (13 === a.tag) {
    var b = a.memoizedState;
    null === b && (a = a.alternate, null !== a && (b = a.memoizedState));
    if (null !== b) return b.dehydrated;
  }
  return null;
}
function Xb(a) {
  if (Vb(a) !== a) throw Error(p(188));
}
function Yb(a) {
  var b = a.alternate;
  if (!b) {
    b = Vb(a);
    if (null === b) throw Error(p(188));
    return b !== a ? null : a;
  }
  for (var c = a, d = b; ; ) {
    var e = c.return;
    if (null === e) break;
    var f2 = e.alternate;
    if (null === f2) {
      d = e.return;
      if (null !== d) {
        c = d;
        continue;
      }
      break;
    }
    if (e.child === f2.child) {
      for (f2 = e.child; f2; ) {
        if (f2 === c) return Xb(e), a;
        if (f2 === d) return Xb(e), b;
        f2 = f2.sibling;
      }
      throw Error(p(188));
    }
    if (c.return !== d.return) c = e, d = f2;
    else {
      for (var g = false, h = e.child; h; ) {
        if (h === c) {
          g = true;
          c = e;
          d = f2;
          break;
        }
        if (h === d) {
          g = true;
          d = e;
          c = f2;
          break;
        }
        h = h.sibling;
      }
      if (!g) {
        for (h = f2.child; h; ) {
          if (h === c) {
            g = true;
            c = f2;
            d = e;
            break;
          }
          if (h === d) {
            g = true;
            d = f2;
            c = e;
            break;
          }
          h = h.sibling;
        }
        if (!g) throw Error(p(189));
      }
    }
    if (c.alternate !== d) throw Error(p(190));
  }
  if (3 !== c.tag) throw Error(p(188));
  return c.stateNode.current === c ? a : b;
}
function Zb(a) {
  a = Yb(a);
  return null !== a ? $b(a) : null;
}
function $b(a) {
  if (5 === a.tag || 6 === a.tag) return a;
  for (a = a.child; null !== a; ) {
    var b = $b(a);
    if (null !== b) return b;
    a = a.sibling;
  }
  return null;
}
var ac = ca.unstable_scheduleCallback, bc = ca.unstable_cancelCallback, cc = ca.unstable_shouldYield, dc = ca.unstable_requestPaint, B = ca.unstable_now, ec = ca.unstable_getCurrentPriorityLevel, fc = ca.unstable_ImmediatePriority, gc = ca.unstable_UserBlockingPriority, hc = ca.unstable_NormalPriority, ic = ca.unstable_LowPriority, jc = ca.unstable_IdlePriority, kc = null, lc = null;
function mc(a) {
  if (lc && "function" === typeof lc.onCommitFiberRoot) try {
    lc.onCommitFiberRoot(kc, a, void 0, 128 === (a.current.flags & 128));
  } catch (b) {
  }
}
var oc = Math.clz32 ? Math.clz32 : nc, pc = Math.log, qc = Math.LN2;
function nc(a) {
  a >>>= 0;
  return 0 === a ? 32 : 31 - (pc(a) / qc | 0) | 0;
}
var rc = 64, sc = 4194304;
function tc(a) {
  switch (a & -a) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 4:
      return 4;
    case 8:
      return 8;
    case 16:
      return 16;
    case 32:
      return 32;
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return a & 4194240;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return a & 130023424;
    case 134217728:
      return 134217728;
    case 268435456:
      return 268435456;
    case 536870912:
      return 536870912;
    case 1073741824:
      return 1073741824;
    default:
      return a;
  }
}
function uc(a, b) {
  var c = a.pendingLanes;
  if (0 === c) return 0;
  var d = 0, e = a.suspendedLanes, f2 = a.pingedLanes, g = c & 268435455;
  if (0 !== g) {
    var h = g & ~e;
    0 !== h ? d = tc(h) : (f2 &= g, 0 !== f2 && (d = tc(f2)));
  } else g = c & ~e, 0 !== g ? d = tc(g) : 0 !== f2 && (d = tc(f2));
  if (0 === d) return 0;
  if (0 !== b && b !== d && 0 === (b & e) && (e = d & -d, f2 = b & -b, e >= f2 || 16 === e && 0 !== (f2 & 4194240))) return b;
  0 !== (d & 4) && (d |= c & 16);
  b = a.entangledLanes;
  if (0 !== b) for (a = a.entanglements, b &= d; 0 < b; ) c = 31 - oc(b), e = 1 << c, d |= a[c], b &= ~e;
  return d;
}
function vc(a, b) {
  switch (a) {
    case 1:
    case 2:
    case 4:
      return b + 250;
    case 8:
    case 16:
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return b + 5e3;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return -1;
    case 134217728:
    case 268435456:
    case 536870912:
    case 1073741824:
      return -1;
    default:
      return -1;
  }
}
function wc(a, b) {
  for (var c = a.suspendedLanes, d = a.pingedLanes, e = a.expirationTimes, f2 = a.pendingLanes; 0 < f2; ) {
    var g = 31 - oc(f2), h = 1 << g, k2 = e[g];
    if (-1 === k2) {
      if (0 === (h & c) || 0 !== (h & d)) e[g] = vc(h, b);
    } else k2 <= b && (a.expiredLanes |= h);
    f2 &= ~h;
  }
}
function xc(a) {
  a = a.pendingLanes & -1073741825;
  return 0 !== a ? a : a & 1073741824 ? 1073741824 : 0;
}
function yc() {
  var a = rc;
  rc <<= 1;
  0 === (rc & 4194240) && (rc = 64);
  return a;
}
function zc(a) {
  for (var b = [], c = 0; 31 > c; c++) b.push(a);
  return b;
}
function Ac(a, b, c) {
  a.pendingLanes |= b;
  536870912 !== b && (a.suspendedLanes = 0, a.pingedLanes = 0);
  a = a.eventTimes;
  b = 31 - oc(b);
  a[b] = c;
}
function Bc(a, b) {
  var c = a.pendingLanes & ~b;
  a.pendingLanes = b;
  a.suspendedLanes = 0;
  a.pingedLanes = 0;
  a.expiredLanes &= b;
  a.mutableReadLanes &= b;
  a.entangledLanes &= b;
  b = a.entanglements;
  var d = a.eventTimes;
  for (a = a.expirationTimes; 0 < c; ) {
    var e = 31 - oc(c), f2 = 1 << e;
    b[e] = 0;
    d[e] = -1;
    a[e] = -1;
    c &= ~f2;
  }
}
function Cc(a, b) {
  var c = a.entangledLanes |= b;
  for (a = a.entanglements; c; ) {
    var d = 31 - oc(c), e = 1 << d;
    e & b | a[d] & b && (a[d] |= b);
    c &= ~e;
  }
}
var C = 0;
function Dc(a) {
  a &= -a;
  return 1 < a ? 4 < a ? 0 !== (a & 268435455) ? 16 : 536870912 : 4 : 1;
}
var Ec, Fc, Gc, Hc, Ic, Jc = false, Kc = [], Lc = null, Mc = null, Nc = null, Oc = /* @__PURE__ */ new Map(), Pc = /* @__PURE__ */ new Map(), Qc = [], Rc = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
function Sc(a, b) {
  switch (a) {
    case "focusin":
    case "focusout":
      Lc = null;
      break;
    case "dragenter":
    case "dragleave":
      Mc = null;
      break;
    case "mouseover":
    case "mouseout":
      Nc = null;
      break;
    case "pointerover":
    case "pointerout":
      Oc.delete(b.pointerId);
      break;
    case "gotpointercapture":
    case "lostpointercapture":
      Pc.delete(b.pointerId);
  }
}
function Tc(a, b, c, d, e, f2) {
  if (null === a || a.nativeEvent !== f2) return a = { blockedOn: b, domEventName: c, eventSystemFlags: d, nativeEvent: f2, targetContainers: [e] }, null !== b && (b = Cb(b), null !== b && Fc(b)), a;
  a.eventSystemFlags |= d;
  b = a.targetContainers;
  null !== e && -1 === b.indexOf(e) && b.push(e);
  return a;
}
function Uc(a, b, c, d, e) {
  switch (b) {
    case "focusin":
      return Lc = Tc(Lc, a, b, c, d, e), true;
    case "dragenter":
      return Mc = Tc(Mc, a, b, c, d, e), true;
    case "mouseover":
      return Nc = Tc(Nc, a, b, c, d, e), true;
    case "pointerover":
      var f2 = e.pointerId;
      Oc.set(f2, Tc(Oc.get(f2) || null, a, b, c, d, e));
      return true;
    case "gotpointercapture":
      return f2 = e.pointerId, Pc.set(f2, Tc(Pc.get(f2) || null, a, b, c, d, e)), true;
  }
  return false;
}
function Vc(a) {
  var b = Wc(a.target);
  if (null !== b) {
    var c = Vb(b);
    if (null !== c) {
      if (b = c.tag, 13 === b) {
        if (b = Wb(c), null !== b) {
          a.blockedOn = b;
          Ic(a.priority, function() {
            Gc(c);
          });
          return;
        }
      } else if (3 === b && c.stateNode.current.memoizedState.isDehydrated) {
        a.blockedOn = 3 === c.tag ? c.stateNode.containerInfo : null;
        return;
      }
    }
  }
  a.blockedOn = null;
}
function Xc(a) {
  if (null !== a.blockedOn) return false;
  for (var b = a.targetContainers; 0 < b.length; ) {
    var c = Yc(a.domEventName, a.eventSystemFlags, b[0], a.nativeEvent);
    if (null === c) {
      c = a.nativeEvent;
      var d = new c.constructor(c.type, c);
      wb = d;
      c.target.dispatchEvent(d);
      wb = null;
    } else return b = Cb(c), null !== b && Fc(b), a.blockedOn = c, false;
    b.shift();
  }
  return true;
}
function Zc(a, b, c) {
  Xc(a) && c.delete(b);
}
function $c() {
  Jc = false;
  null !== Lc && Xc(Lc) && (Lc = null);
  null !== Mc && Xc(Mc) && (Mc = null);
  null !== Nc && Xc(Nc) && (Nc = null);
  Oc.forEach(Zc);
  Pc.forEach(Zc);
}
function ad(a, b) {
  a.blockedOn === b && (a.blockedOn = null, Jc || (Jc = true, ca.unstable_scheduleCallback(ca.unstable_NormalPriority, $c)));
}
function bd(a) {
  function b(b2) {
    return ad(b2, a);
  }
  if (0 < Kc.length) {
    ad(Kc[0], a);
    for (var c = 1; c < Kc.length; c++) {
      var d = Kc[c];
      d.blockedOn === a && (d.blockedOn = null);
    }
  }
  null !== Lc && ad(Lc, a);
  null !== Mc && ad(Mc, a);
  null !== Nc && ad(Nc, a);
  Oc.forEach(b);
  Pc.forEach(b);
  for (c = 0; c < Qc.length; c++) d = Qc[c], d.blockedOn === a && (d.blockedOn = null);
  for (; 0 < Qc.length && (c = Qc[0], null === c.blockedOn); ) Vc(c), null === c.blockedOn && Qc.shift();
}
var cd = ua.ReactCurrentBatchConfig, dd = true;
function ed(a, b, c, d) {
  var e = C, f2 = cd.transition;
  cd.transition = null;
  try {
    C = 1, fd(a, b, c, d);
  } finally {
    C = e, cd.transition = f2;
  }
}
function gd(a, b, c, d) {
  var e = C, f2 = cd.transition;
  cd.transition = null;
  try {
    C = 4, fd(a, b, c, d);
  } finally {
    C = e, cd.transition = f2;
  }
}
function fd(a, b, c, d) {
  if (dd) {
    var e = Yc(a, b, c, d);
    if (null === e) hd(a, b, d, id, c), Sc(a, d);
    else if (Uc(e, a, b, c, d)) d.stopPropagation();
    else if (Sc(a, d), b & 4 && -1 < Rc.indexOf(a)) {
      for (; null !== e; ) {
        var f2 = Cb(e);
        null !== f2 && Ec(f2);
        f2 = Yc(a, b, c, d);
        null === f2 && hd(a, b, d, id, c);
        if (f2 === e) break;
        e = f2;
      }
      null !== e && d.stopPropagation();
    } else hd(a, b, d, null, c);
  }
}
var id = null;
function Yc(a, b, c, d) {
  id = null;
  a = xb(d);
  a = Wc(a);
  if (null !== a) if (b = Vb(a), null === b) a = null;
  else if (c = b.tag, 13 === c) {
    a = Wb(b);
    if (null !== a) return a;
    a = null;
  } else if (3 === c) {
    if (b.stateNode.current.memoizedState.isDehydrated) return 3 === b.tag ? b.stateNode.containerInfo : null;
    a = null;
  } else b !== a && (a = null);
  id = a;
  return null;
}
function jd(a) {
  switch (a) {
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    case "beforeblur":
    case "afterblur":
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
      return 1;
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "toggle":
    case "touchmove":
    case "wheel":
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
      return 4;
    case "message":
      switch (ec()) {
        case fc:
          return 1;
        case gc:
          return 4;
        case hc:
        case ic:
          return 16;
        case jc:
          return 536870912;
        default:
          return 16;
      }
    default:
      return 16;
  }
}
var kd = null, ld = null, md = null;
function nd() {
  if (md) return md;
  var a, b = ld, c = b.length, d, e = "value" in kd ? kd.value : kd.textContent, f2 = e.length;
  for (a = 0; a < c && b[a] === e[a]; a++) ;
  var g = c - a;
  for (d = 1; d <= g && b[c - d] === e[f2 - d]; d++) ;
  return md = e.slice(a, 1 < d ? 1 - d : void 0);
}
function od(a) {
  var b = a.keyCode;
  "charCode" in a ? (a = a.charCode, 0 === a && 13 === b && (a = 13)) : a = b;
  10 === a && (a = 13);
  return 32 <= a || 13 === a ? a : 0;
}
function pd() {
  return true;
}
function qd() {
  return false;
}
function rd(a) {
  function b(b2, d, e, f2, g) {
    this._reactName = b2;
    this._targetInst = e;
    this.type = d;
    this.nativeEvent = f2;
    this.target = g;
    this.currentTarget = null;
    for (var c in a) a.hasOwnProperty(c) && (b2 = a[c], this[c] = b2 ? b2(f2) : f2[c]);
    this.isDefaultPrevented = (null != f2.defaultPrevented ? f2.defaultPrevented : false === f2.returnValue) ? pd : qd;
    this.isPropagationStopped = qd;
    return this;
  }
  A(b.prototype, { preventDefault: function() {
    this.defaultPrevented = true;
    var a2 = this.nativeEvent;
    a2 && (a2.preventDefault ? a2.preventDefault() : "unknown" !== typeof a2.returnValue && (a2.returnValue = false), this.isDefaultPrevented = pd);
  }, stopPropagation: function() {
    var a2 = this.nativeEvent;
    a2 && (a2.stopPropagation ? a2.stopPropagation() : "unknown" !== typeof a2.cancelBubble && (a2.cancelBubble = true), this.isPropagationStopped = pd);
  }, persist: function() {
  }, isPersistent: pd });
  return b;
}
var sd = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(a) {
  return a.timeStamp || Date.now();
}, defaultPrevented: 0, isTrusted: 0 }, td = rd(sd), ud = A({}, sd, { view: 0, detail: 0 }), vd = rd(ud), wd, xd, yd, Ad = A({}, ud, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: zd, button: 0, buttons: 0, relatedTarget: function(a) {
  return void 0 === a.relatedTarget ? a.fromElement === a.srcElement ? a.toElement : a.fromElement : a.relatedTarget;
}, movementX: function(a) {
  if ("movementX" in a) return a.movementX;
  a !== yd && (yd && "mousemove" === a.type ? (wd = a.screenX - yd.screenX, xd = a.screenY - yd.screenY) : xd = wd = 0, yd = a);
  return wd;
}, movementY: function(a) {
  return "movementY" in a ? a.movementY : xd;
} }), Bd = rd(Ad), Cd = A({}, Ad, { dataTransfer: 0 }), Dd = rd(Cd), Ed = A({}, ud, { relatedTarget: 0 }), Fd = rd(Ed), Gd = A({}, sd, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), Hd = rd(Gd), Id = A({}, sd, { clipboardData: function(a) {
  return "clipboardData" in a ? a.clipboardData : window.clipboardData;
} }), Jd = rd(Id), Kd = A({}, sd, { data: 0 }), Ld = rd(Kd), Md = {
  Esc: "Escape",
  Spacebar: " ",
  Left: "ArrowLeft",
  Up: "ArrowUp",
  Right: "ArrowRight",
  Down: "ArrowDown",
  Del: "Delete",
  Win: "OS",
  Menu: "ContextMenu",
  Apps: "ContextMenu",
  Scroll: "ScrollLock",
  MozPrintableKey: "Unidentified"
}, Nd = {
  8: "Backspace",
  9: "Tab",
  12: "Clear",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  19: "Pause",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  45: "Insert",
  46: "Delete",
  112: "F1",
  113: "F2",
  114: "F3",
  115: "F4",
  116: "F5",
  117: "F6",
  118: "F7",
  119: "F8",
  120: "F9",
  121: "F10",
  122: "F11",
  123: "F12",
  144: "NumLock",
  145: "ScrollLock",
  224: "Meta"
}, Od = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
function Pd(a) {
  var b = this.nativeEvent;
  return b.getModifierState ? b.getModifierState(a) : (a = Od[a]) ? !!b[a] : false;
}
function zd() {
  return Pd;
}
var Qd = A({}, ud, { key: function(a) {
  if (a.key) {
    var b = Md[a.key] || a.key;
    if ("Unidentified" !== b) return b;
  }
  return "keypress" === a.type ? (a = od(a), 13 === a ? "Enter" : String.fromCharCode(a)) : "keydown" === a.type || "keyup" === a.type ? Nd[a.keyCode] || "Unidentified" : "";
}, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: zd, charCode: function(a) {
  return "keypress" === a.type ? od(a) : 0;
}, keyCode: function(a) {
  return "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
}, which: function(a) {
  return "keypress" === a.type ? od(a) : "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
} }), Rd = rd(Qd), Sd = A({}, Ad, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), Td = rd(Sd), Ud = A({}, ud, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: zd }), Vd = rd(Ud), Wd = A({}, sd, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), Xd = rd(Wd), Yd = A({}, Ad, {
  deltaX: function(a) {
    return "deltaX" in a ? a.deltaX : "wheelDeltaX" in a ? -a.wheelDeltaX : 0;
  },
  deltaY: function(a) {
    return "deltaY" in a ? a.deltaY : "wheelDeltaY" in a ? -a.wheelDeltaY : "wheelDelta" in a ? -a.wheelDelta : 0;
  },
  deltaZ: 0,
  deltaMode: 0
}), Zd = rd(Yd), $d = [9, 13, 27, 32], ae = ia && "CompositionEvent" in window, be = null;
ia && "documentMode" in document && (be = document.documentMode);
var ce = ia && "TextEvent" in window && !be, de = ia && (!ae || be && 8 < be && 11 >= be), ee = String.fromCharCode(32), fe = false;
function ge(a, b) {
  switch (a) {
    case "keyup":
      return -1 !== $d.indexOf(b.keyCode);
    case "keydown":
      return 229 !== b.keyCode;
    case "keypress":
    case "mousedown":
    case "focusout":
      return true;
    default:
      return false;
  }
}
function he(a) {
  a = a.detail;
  return "object" === typeof a && "data" in a ? a.data : null;
}
var ie = false;
function je(a, b) {
  switch (a) {
    case "compositionend":
      return he(b);
    case "keypress":
      if (32 !== b.which) return null;
      fe = true;
      return ee;
    case "textInput":
      return a = b.data, a === ee && fe ? null : a;
    default:
      return null;
  }
}
function ke(a, b) {
  if (ie) return "compositionend" === a || !ae && ge(a, b) ? (a = nd(), md = ld = kd = null, ie = false, a) : null;
  switch (a) {
    case "paste":
      return null;
    case "keypress":
      if (!(b.ctrlKey || b.altKey || b.metaKey) || b.ctrlKey && b.altKey) {
        if (b.char && 1 < b.char.length) return b.char;
        if (b.which) return String.fromCharCode(b.which);
      }
      return null;
    case "compositionend":
      return de && "ko" !== b.locale ? null : b.data;
    default:
      return null;
  }
}
var le = { color: true, date: true, datetime: true, "datetime-local": true, email: true, month: true, number: true, password: true, range: true, search: true, tel: true, text: true, time: true, url: true, week: true };
function me(a) {
  var b = a && a.nodeName && a.nodeName.toLowerCase();
  return "input" === b ? !!le[a.type] : "textarea" === b ? true : false;
}
function ne(a, b, c, d) {
  Eb(d);
  b = oe(b, "onChange");
  0 < b.length && (c = new td("onChange", "change", null, c, d), a.push({ event: c, listeners: b }));
}
var pe = null, qe = null;
function re(a) {
  se(a, 0);
}
function te(a) {
  var b = ue(a);
  if (Wa(b)) return a;
}
function ve(a, b) {
  if ("change" === a) return b;
}
var we = false;
if (ia) {
  var xe;
  if (ia) {
    var ye = "oninput" in document;
    if (!ye) {
      var ze = document.createElement("div");
      ze.setAttribute("oninput", "return;");
      ye = "function" === typeof ze.oninput;
    }
    xe = ye;
  } else xe = false;
  we = xe && (!document.documentMode || 9 < document.documentMode);
}
function Ae() {
  pe && (pe.detachEvent("onpropertychange", Be), qe = pe = null);
}
function Be(a) {
  if ("value" === a.propertyName && te(qe)) {
    var b = [];
    ne(b, qe, a, xb(a));
    Jb(re, b);
  }
}
function Ce(a, b, c) {
  "focusin" === a ? (Ae(), pe = b, qe = c, pe.attachEvent("onpropertychange", Be)) : "focusout" === a && Ae();
}
function De(a) {
  if ("selectionchange" === a || "keyup" === a || "keydown" === a) return te(qe);
}
function Ee(a, b) {
  if ("click" === a) return te(b);
}
function Fe(a, b) {
  if ("input" === a || "change" === a) return te(b);
}
function Ge(a, b) {
  return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
}
var He = "function" === typeof Object.is ? Object.is : Ge;
function Ie(a, b) {
  if (He(a, b)) return true;
  if ("object" !== typeof a || null === a || "object" !== typeof b || null === b) return false;
  var c = Object.keys(a), d = Object.keys(b);
  if (c.length !== d.length) return false;
  for (d = 0; d < c.length; d++) {
    var e = c[d];
    if (!ja.call(b, e) || !He(a[e], b[e])) return false;
  }
  return true;
}
function Je(a) {
  for (; a && a.firstChild; ) a = a.firstChild;
  return a;
}
function Ke(a, b) {
  var c = Je(a);
  a = 0;
  for (var d; c; ) {
    if (3 === c.nodeType) {
      d = a + c.textContent.length;
      if (a <= b && d >= b) return { node: c, offset: b - a };
      a = d;
    }
    a: {
      for (; c; ) {
        if (c.nextSibling) {
          c = c.nextSibling;
          break a;
        }
        c = c.parentNode;
      }
      c = void 0;
    }
    c = Je(c);
  }
}
function Le(a, b) {
  return a && b ? a === b ? true : a && 3 === a.nodeType ? false : b && 3 === b.nodeType ? Le(a, b.parentNode) : "contains" in a ? a.contains(b) : a.compareDocumentPosition ? !!(a.compareDocumentPosition(b) & 16) : false : false;
}
function Me() {
  for (var a = window, b = Xa(); b instanceof a.HTMLIFrameElement; ) {
    try {
      var c = "string" === typeof b.contentWindow.location.href;
    } catch (d) {
      c = false;
    }
    if (c) a = b.contentWindow;
    else break;
    b = Xa(a.document);
  }
  return b;
}
function Ne(a) {
  var b = a && a.nodeName && a.nodeName.toLowerCase();
  return b && ("input" === b && ("text" === a.type || "search" === a.type || "tel" === a.type || "url" === a.type || "password" === a.type) || "textarea" === b || "true" === a.contentEditable);
}
function Oe(a) {
  var b = Me(), c = a.focusedElem, d = a.selectionRange;
  if (b !== c && c && c.ownerDocument && Le(c.ownerDocument.documentElement, c)) {
    if (null !== d && Ne(c)) {
      if (b = d.start, a = d.end, void 0 === a && (a = b), "selectionStart" in c) c.selectionStart = b, c.selectionEnd = Math.min(a, c.value.length);
      else if (a = (b = c.ownerDocument || document) && b.defaultView || window, a.getSelection) {
        a = a.getSelection();
        var e = c.textContent.length, f2 = Math.min(d.start, e);
        d = void 0 === d.end ? f2 : Math.min(d.end, e);
        !a.extend && f2 > d && (e = d, d = f2, f2 = e);
        e = Ke(c, f2);
        var g = Ke(
          c,
          d
        );
        e && g && (1 !== a.rangeCount || a.anchorNode !== e.node || a.anchorOffset !== e.offset || a.focusNode !== g.node || a.focusOffset !== g.offset) && (b = b.createRange(), b.setStart(e.node, e.offset), a.removeAllRanges(), f2 > d ? (a.addRange(b), a.extend(g.node, g.offset)) : (b.setEnd(g.node, g.offset), a.addRange(b)));
      }
    }
    b = [];
    for (a = c; a = a.parentNode; ) 1 === a.nodeType && b.push({ element: a, left: a.scrollLeft, top: a.scrollTop });
    "function" === typeof c.focus && c.focus();
    for (c = 0; c < b.length; c++) a = b[c], a.element.scrollLeft = a.left, a.element.scrollTop = a.top;
  }
}
var Pe = ia && "documentMode" in document && 11 >= document.documentMode, Qe = null, Re = null, Se = null, Te = false;
function Ue(a, b, c) {
  var d = c.window === c ? c.document : 9 === c.nodeType ? c : c.ownerDocument;
  Te || null == Qe || Qe !== Xa(d) || (d = Qe, "selectionStart" in d && Ne(d) ? d = { start: d.selectionStart, end: d.selectionEnd } : (d = (d.ownerDocument && d.ownerDocument.defaultView || window).getSelection(), d = { anchorNode: d.anchorNode, anchorOffset: d.anchorOffset, focusNode: d.focusNode, focusOffset: d.focusOffset }), Se && Ie(Se, d) || (Se = d, d = oe(Re, "onSelect"), 0 < d.length && (b = new td("onSelect", "select", null, b, c), a.push({ event: b, listeners: d }), b.target = Qe)));
}
function Ve(a, b) {
  var c = {};
  c[a.toLowerCase()] = b.toLowerCase();
  c["Webkit" + a] = "webkit" + b;
  c["Moz" + a] = "moz" + b;
  return c;
}
var We = { animationend: Ve("Animation", "AnimationEnd"), animationiteration: Ve("Animation", "AnimationIteration"), animationstart: Ve("Animation", "AnimationStart"), transitionend: Ve("Transition", "TransitionEnd") }, Xe = {}, Ye = {};
ia && (Ye = document.createElement("div").style, "AnimationEvent" in window || (delete We.animationend.animation, delete We.animationiteration.animation, delete We.animationstart.animation), "TransitionEvent" in window || delete We.transitionend.transition);
function Ze(a) {
  if (Xe[a]) return Xe[a];
  if (!We[a]) return a;
  var b = We[a], c;
  for (c in b) if (b.hasOwnProperty(c) && c in Ye) return Xe[a] = b[c];
  return a;
}
var $e = Ze("animationend"), af = Ze("animationiteration"), bf = Ze("animationstart"), cf = Ze("transitionend"), df = /* @__PURE__ */ new Map(), ef = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
function ff(a, b) {
  df.set(a, b);
  fa(b, [a]);
}
for (var gf = 0; gf < ef.length; gf++) {
  var hf = ef[gf], jf = hf.toLowerCase(), kf = hf[0].toUpperCase() + hf.slice(1);
  ff(jf, "on" + kf);
}
ff($e, "onAnimationEnd");
ff(af, "onAnimationIteration");
ff(bf, "onAnimationStart");
ff("dblclick", "onDoubleClick");
ff("focusin", "onFocus");
ff("focusout", "onBlur");
ff(cf, "onTransitionEnd");
ha("onMouseEnter", ["mouseout", "mouseover"]);
ha("onMouseLeave", ["mouseout", "mouseover"]);
ha("onPointerEnter", ["pointerout", "pointerover"]);
ha("onPointerLeave", ["pointerout", "pointerover"]);
fa("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
fa("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
fa("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
fa("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
fa("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
fa("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
var lf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), mf = new Set("cancel close invalid load scroll toggle".split(" ").concat(lf));
function nf(a, b, c) {
  var d = a.type || "unknown-event";
  a.currentTarget = c;
  Ub(d, b, void 0, a);
  a.currentTarget = null;
}
function se(a, b) {
  b = 0 !== (b & 4);
  for (var c = 0; c < a.length; c++) {
    var d = a[c], e = d.event;
    d = d.listeners;
    a: {
      var f2 = void 0;
      if (b) for (var g = d.length - 1; 0 <= g; g--) {
        var h = d[g], k2 = h.instance, l2 = h.currentTarget;
        h = h.listener;
        if (k2 !== f2 && e.isPropagationStopped()) break a;
        nf(e, h, l2);
        f2 = k2;
      }
      else for (g = 0; g < d.length; g++) {
        h = d[g];
        k2 = h.instance;
        l2 = h.currentTarget;
        h = h.listener;
        if (k2 !== f2 && e.isPropagationStopped()) break a;
        nf(e, h, l2);
        f2 = k2;
      }
    }
  }
  if (Qb) throw a = Rb, Qb = false, Rb = null, a;
}
function D(a, b) {
  var c = b[of];
  void 0 === c && (c = b[of] = /* @__PURE__ */ new Set());
  var d = a + "__bubble";
  c.has(d) || (pf(b, a, 2, false), c.add(d));
}
function qf(a, b, c) {
  var d = 0;
  b && (d |= 4);
  pf(c, a, d, b);
}
var rf = "_reactListening" + Math.random().toString(36).slice(2);
function sf(a) {
  if (!a[rf]) {
    a[rf] = true;
    da.forEach(function(b2) {
      "selectionchange" !== b2 && (mf.has(b2) || qf(b2, false, a), qf(b2, true, a));
    });
    var b = 9 === a.nodeType ? a : a.ownerDocument;
    null === b || b[rf] || (b[rf] = true, qf("selectionchange", false, b));
  }
}
function pf(a, b, c, d) {
  switch (jd(b)) {
    case 1:
      var e = ed;
      break;
    case 4:
      e = gd;
      break;
    default:
      e = fd;
  }
  c = e.bind(null, b, c, a);
  e = void 0;
  !Lb || "touchstart" !== b && "touchmove" !== b && "wheel" !== b || (e = true);
  d ? void 0 !== e ? a.addEventListener(b, c, { capture: true, passive: e }) : a.addEventListener(b, c, true) : void 0 !== e ? a.addEventListener(b, c, { passive: e }) : a.addEventListener(b, c, false);
}
function hd(a, b, c, d, e) {
  var f2 = d;
  if (0 === (b & 1) && 0 === (b & 2) && null !== d) a: for (; ; ) {
    if (null === d) return;
    var g = d.tag;
    if (3 === g || 4 === g) {
      var h = d.stateNode.containerInfo;
      if (h === e || 8 === h.nodeType && h.parentNode === e) break;
      if (4 === g) for (g = d.return; null !== g; ) {
        var k2 = g.tag;
        if (3 === k2 || 4 === k2) {
          if (k2 = g.stateNode.containerInfo, k2 === e || 8 === k2.nodeType && k2.parentNode === e) return;
        }
        g = g.return;
      }
      for (; null !== h; ) {
        g = Wc(h);
        if (null === g) return;
        k2 = g.tag;
        if (5 === k2 || 6 === k2) {
          d = f2 = g;
          continue a;
        }
        h = h.parentNode;
      }
    }
    d = d.return;
  }
  Jb(function() {
    var d2 = f2, e2 = xb(c), g2 = [];
    a: {
      var h2 = df.get(a);
      if (void 0 !== h2) {
        var k3 = td, n2 = a;
        switch (a) {
          case "keypress":
            if (0 === od(c)) break a;
          case "keydown":
          case "keyup":
            k3 = Rd;
            break;
          case "focusin":
            n2 = "focus";
            k3 = Fd;
            break;
          case "focusout":
            n2 = "blur";
            k3 = Fd;
            break;
          case "beforeblur":
          case "afterblur":
            k3 = Fd;
            break;
          case "click":
            if (2 === c.button) break a;
          case "auxclick":
          case "dblclick":
          case "mousedown":
          case "mousemove":
          case "mouseup":
          case "mouseout":
          case "mouseover":
          case "contextmenu":
            k3 = Bd;
            break;
          case "drag":
          case "dragend":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "dragstart":
          case "drop":
            k3 = Dd;
            break;
          case "touchcancel":
          case "touchend":
          case "touchmove":
          case "touchstart":
            k3 = Vd;
            break;
          case $e:
          case af:
          case bf:
            k3 = Hd;
            break;
          case cf:
            k3 = Xd;
            break;
          case "scroll":
            k3 = vd;
            break;
          case "wheel":
            k3 = Zd;
            break;
          case "copy":
          case "cut":
          case "paste":
            k3 = Jd;
            break;
          case "gotpointercapture":
          case "lostpointercapture":
          case "pointercancel":
          case "pointerdown":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "pointerup":
            k3 = Td;
        }
        var t2 = 0 !== (b & 4), J2 = !t2 && "scroll" === a, x2 = t2 ? null !== h2 ? h2 + "Capture" : null : h2;
        t2 = [];
        for (var w2 = d2, u2; null !== w2; ) {
          u2 = w2;
          var F2 = u2.stateNode;
          5 === u2.tag && null !== F2 && (u2 = F2, null !== x2 && (F2 = Kb(w2, x2), null != F2 && t2.push(tf(w2, F2, u2))));
          if (J2) break;
          w2 = w2.return;
        }
        0 < t2.length && (h2 = new k3(h2, n2, null, c, e2), g2.push({ event: h2, listeners: t2 }));
      }
    }
    if (0 === (b & 7)) {
      a: {
        h2 = "mouseover" === a || "pointerover" === a;
        k3 = "mouseout" === a || "pointerout" === a;
        if (h2 && c !== wb && (n2 = c.relatedTarget || c.fromElement) && (Wc(n2) || n2[uf])) break a;
        if (k3 || h2) {
          h2 = e2.window === e2 ? e2 : (h2 = e2.ownerDocument) ? h2.defaultView || h2.parentWindow : window;
          if (k3) {
            if (n2 = c.relatedTarget || c.toElement, k3 = d2, n2 = n2 ? Wc(n2) : null, null !== n2 && (J2 = Vb(n2), n2 !== J2 || 5 !== n2.tag && 6 !== n2.tag)) n2 = null;
          } else k3 = null, n2 = d2;
          if (k3 !== n2) {
            t2 = Bd;
            F2 = "onMouseLeave";
            x2 = "onMouseEnter";
            w2 = "mouse";
            if ("pointerout" === a || "pointerover" === a) t2 = Td, F2 = "onPointerLeave", x2 = "onPointerEnter", w2 = "pointer";
            J2 = null == k3 ? h2 : ue(k3);
            u2 = null == n2 ? h2 : ue(n2);
            h2 = new t2(F2, w2 + "leave", k3, c, e2);
            h2.target = J2;
            h2.relatedTarget = u2;
            F2 = null;
            Wc(e2) === d2 && (t2 = new t2(x2, w2 + "enter", n2, c, e2), t2.target = u2, t2.relatedTarget = J2, F2 = t2);
            J2 = F2;
            if (k3 && n2) b: {
              t2 = k3;
              x2 = n2;
              w2 = 0;
              for (u2 = t2; u2; u2 = vf(u2)) w2++;
              u2 = 0;
              for (F2 = x2; F2; F2 = vf(F2)) u2++;
              for (; 0 < w2 - u2; ) t2 = vf(t2), w2--;
              for (; 0 < u2 - w2; ) x2 = vf(x2), u2--;
              for (; w2--; ) {
                if (t2 === x2 || null !== x2 && t2 === x2.alternate) break b;
                t2 = vf(t2);
                x2 = vf(x2);
              }
              t2 = null;
            }
            else t2 = null;
            null !== k3 && wf(g2, h2, k3, t2, false);
            null !== n2 && null !== J2 && wf(g2, J2, n2, t2, true);
          }
        }
      }
      a: {
        h2 = d2 ? ue(d2) : window;
        k3 = h2.nodeName && h2.nodeName.toLowerCase();
        if ("select" === k3 || "input" === k3 && "file" === h2.type) var na = ve;
        else if (me(h2)) if (we) na = Fe;
        else {
          na = De;
          var xa = Ce;
        }
        else (k3 = h2.nodeName) && "input" === k3.toLowerCase() && ("checkbox" === h2.type || "radio" === h2.type) && (na = Ee);
        if (na && (na = na(a, d2))) {
          ne(g2, na, c, e2);
          break a;
        }
        xa && xa(a, h2, d2);
        "focusout" === a && (xa = h2._wrapperState) && xa.controlled && "number" === h2.type && cb(h2, "number", h2.value);
      }
      xa = d2 ? ue(d2) : window;
      switch (a) {
        case "focusin":
          if (me(xa) || "true" === xa.contentEditable) Qe = xa, Re = d2, Se = null;
          break;
        case "focusout":
          Se = Re = Qe = null;
          break;
        case "mousedown":
          Te = true;
          break;
        case "contextmenu":
        case "mouseup":
        case "dragend":
          Te = false;
          Ue(g2, c, e2);
          break;
        case "selectionchange":
          if (Pe) break;
        case "keydown":
        case "keyup":
          Ue(g2, c, e2);
      }
      var $a;
      if (ae) b: {
        switch (a) {
          case "compositionstart":
            var ba = "onCompositionStart";
            break b;
          case "compositionend":
            ba = "onCompositionEnd";
            break b;
          case "compositionupdate":
            ba = "onCompositionUpdate";
            break b;
        }
        ba = void 0;
      }
      else ie ? ge(a, c) && (ba = "onCompositionEnd") : "keydown" === a && 229 === c.keyCode && (ba = "onCompositionStart");
      ba && (de && "ko" !== c.locale && (ie || "onCompositionStart" !== ba ? "onCompositionEnd" === ba && ie && ($a = nd()) : (kd = e2, ld = "value" in kd ? kd.value : kd.textContent, ie = true)), xa = oe(d2, ba), 0 < xa.length && (ba = new Ld(ba, a, null, c, e2), g2.push({ event: ba, listeners: xa }), $a ? ba.data = $a : ($a = he(c), null !== $a && (ba.data = $a))));
      if ($a = ce ? je(a, c) : ke(a, c)) d2 = oe(d2, "onBeforeInput"), 0 < d2.length && (e2 = new Ld("onBeforeInput", "beforeinput", null, c, e2), g2.push({ event: e2, listeners: d2 }), e2.data = $a);
    }
    se(g2, b);
  });
}
function tf(a, b, c) {
  return { instance: a, listener: b, currentTarget: c };
}
function oe(a, b) {
  for (var c = b + "Capture", d = []; null !== a; ) {
    var e = a, f2 = e.stateNode;
    5 === e.tag && null !== f2 && (e = f2, f2 = Kb(a, c), null != f2 && d.unshift(tf(a, f2, e)), f2 = Kb(a, b), null != f2 && d.push(tf(a, f2, e)));
    a = a.return;
  }
  return d;
}
function vf(a) {
  if (null === a) return null;
  do
    a = a.return;
  while (a && 5 !== a.tag);
  return a ? a : null;
}
function wf(a, b, c, d, e) {
  for (var f2 = b._reactName, g = []; null !== c && c !== d; ) {
    var h = c, k2 = h.alternate, l2 = h.stateNode;
    if (null !== k2 && k2 === d) break;
    5 === h.tag && null !== l2 && (h = l2, e ? (k2 = Kb(c, f2), null != k2 && g.unshift(tf(c, k2, h))) : e || (k2 = Kb(c, f2), null != k2 && g.push(tf(c, k2, h))));
    c = c.return;
  }
  0 !== g.length && a.push({ event: b, listeners: g });
}
var xf = /\r\n?/g, yf = /\u0000|\uFFFD/g;
function zf(a) {
  return ("string" === typeof a ? a : "" + a).replace(xf, "\n").replace(yf, "");
}
function Af(a, b, c) {
  b = zf(b);
  if (zf(a) !== b && c) throw Error(p(425));
}
function Bf() {
}
var Cf = null, Df = null;
function Ef(a, b) {
  return "textarea" === a || "noscript" === a || "string" === typeof b.children || "number" === typeof b.children || "object" === typeof b.dangerouslySetInnerHTML && null !== b.dangerouslySetInnerHTML && null != b.dangerouslySetInnerHTML.__html;
}
var Ff = "function" === typeof setTimeout ? setTimeout : void 0, Gf = "function" === typeof clearTimeout ? clearTimeout : void 0, Hf = "function" === typeof Promise ? Promise : void 0, Jf = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof Hf ? function(a) {
  return Hf.resolve(null).then(a).catch(If);
} : Ff;
function If(a) {
  setTimeout(function() {
    throw a;
  });
}
function Kf(a, b) {
  var c = b, d = 0;
  do {
    var e = c.nextSibling;
    a.removeChild(c);
    if (e && 8 === e.nodeType) if (c = e.data, "/$" === c) {
      if (0 === d) {
        a.removeChild(e);
        bd(b);
        return;
      }
      d--;
    } else "$" !== c && "$?" !== c && "$!" !== c || d++;
    c = e;
  } while (c);
  bd(b);
}
function Lf(a) {
  for (; null != a; a = a.nextSibling) {
    var b = a.nodeType;
    if (1 === b || 3 === b) break;
    if (8 === b) {
      b = a.data;
      if ("$" === b || "$!" === b || "$?" === b) break;
      if ("/$" === b) return null;
    }
  }
  return a;
}
function Mf(a) {
  a = a.previousSibling;
  for (var b = 0; a; ) {
    if (8 === a.nodeType) {
      var c = a.data;
      if ("$" === c || "$!" === c || "$?" === c) {
        if (0 === b) return a;
        b--;
      } else "/$" === c && b++;
    }
    a = a.previousSibling;
  }
  return null;
}
var Nf = Math.random().toString(36).slice(2), Of = "__reactFiber$" + Nf, Pf = "__reactProps$" + Nf, uf = "__reactContainer$" + Nf, of = "__reactEvents$" + Nf, Qf = "__reactListeners$" + Nf, Rf = "__reactHandles$" + Nf;
function Wc(a) {
  var b = a[Of];
  if (b) return b;
  for (var c = a.parentNode; c; ) {
    if (b = c[uf] || c[Of]) {
      c = b.alternate;
      if (null !== b.child || null !== c && null !== c.child) for (a = Mf(a); null !== a; ) {
        if (c = a[Of]) return c;
        a = Mf(a);
      }
      return b;
    }
    a = c;
    c = a.parentNode;
  }
  return null;
}
function Cb(a) {
  a = a[Of] || a[uf];
  return !a || 5 !== a.tag && 6 !== a.tag && 13 !== a.tag && 3 !== a.tag ? null : a;
}
function ue(a) {
  if (5 === a.tag || 6 === a.tag) return a.stateNode;
  throw Error(p(33));
}
function Db(a) {
  return a[Pf] || null;
}
var Sf = [], Tf = -1;
function Uf(a) {
  return { current: a };
}
function E(a) {
  0 > Tf || (a.current = Sf[Tf], Sf[Tf] = null, Tf--);
}
function G(a, b) {
  Tf++;
  Sf[Tf] = a.current;
  a.current = b;
}
var Vf = {}, H = Uf(Vf), Wf = Uf(false), Xf = Vf;
function Yf(a, b) {
  var c = a.type.contextTypes;
  if (!c) return Vf;
  var d = a.stateNode;
  if (d && d.__reactInternalMemoizedUnmaskedChildContext === b) return d.__reactInternalMemoizedMaskedChildContext;
  var e = {}, f2;
  for (f2 in c) e[f2] = b[f2];
  d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = b, a.__reactInternalMemoizedMaskedChildContext = e);
  return e;
}
function Zf(a) {
  a = a.childContextTypes;
  return null !== a && void 0 !== a;
}
function $f() {
  E(Wf);
  E(H);
}
function ag(a, b, c) {
  if (H.current !== Vf) throw Error(p(168));
  G(H, b);
  G(Wf, c);
}
function bg(a, b, c) {
  var d = a.stateNode;
  b = b.childContextTypes;
  if ("function" !== typeof d.getChildContext) return c;
  d = d.getChildContext();
  for (var e in d) if (!(e in b)) throw Error(p(108, Ra(a) || "Unknown", e));
  return A({}, c, d);
}
function cg(a) {
  a = (a = a.stateNode) && a.__reactInternalMemoizedMergedChildContext || Vf;
  Xf = H.current;
  G(H, a);
  G(Wf, Wf.current);
  return true;
}
function dg(a, b, c) {
  var d = a.stateNode;
  if (!d) throw Error(p(169));
  c ? (a = bg(a, b, Xf), d.__reactInternalMemoizedMergedChildContext = a, E(Wf), E(H), G(H, a)) : E(Wf);
  G(Wf, c);
}
var eg = null, fg = false, gg = false;
function hg(a) {
  null === eg ? eg = [a] : eg.push(a);
}
function ig(a) {
  fg = true;
  hg(a);
}
function jg() {
  if (!gg && null !== eg) {
    gg = true;
    var a = 0, b = C;
    try {
      var c = eg;
      for (C = 1; a < c.length; a++) {
        var d = c[a];
        do
          d = d(true);
        while (null !== d);
      }
      eg = null;
      fg = false;
    } catch (e) {
      throw null !== eg && (eg = eg.slice(a + 1)), ac(fc, jg), e;
    } finally {
      C = b, gg = false;
    }
  }
  return null;
}
var kg = [], lg = 0, mg = null, ng = 0, og = [], pg = 0, qg = null, rg = 1, sg = "";
function tg(a, b) {
  kg[lg++] = ng;
  kg[lg++] = mg;
  mg = a;
  ng = b;
}
function ug(a, b, c) {
  og[pg++] = rg;
  og[pg++] = sg;
  og[pg++] = qg;
  qg = a;
  var d = rg;
  a = sg;
  var e = 32 - oc(d) - 1;
  d &= ~(1 << e);
  c += 1;
  var f2 = 32 - oc(b) + e;
  if (30 < f2) {
    var g = e - e % 5;
    f2 = (d & (1 << g) - 1).toString(32);
    d >>= g;
    e -= g;
    rg = 1 << 32 - oc(b) + e | c << e | d;
    sg = f2 + a;
  } else rg = 1 << f2 | c << e | d, sg = a;
}
function vg(a) {
  null !== a.return && (tg(a, 1), ug(a, 1, 0));
}
function wg(a) {
  for (; a === mg; ) mg = kg[--lg], kg[lg] = null, ng = kg[--lg], kg[lg] = null;
  for (; a === qg; ) qg = og[--pg], og[pg] = null, sg = og[--pg], og[pg] = null, rg = og[--pg], og[pg] = null;
}
var xg = null, yg = null, I = false, zg = null;
function Ag(a, b) {
  var c = Bg(5, null, null, 0);
  c.elementType = "DELETED";
  c.stateNode = b;
  c.return = a;
  b = a.deletions;
  null === b ? (a.deletions = [c], a.flags |= 16) : b.push(c);
}
function Cg(a, b) {
  switch (a.tag) {
    case 5:
      var c = a.type;
      b = 1 !== b.nodeType || c.toLowerCase() !== b.nodeName.toLowerCase() ? null : b;
      return null !== b ? (a.stateNode = b, xg = a, yg = Lf(b.firstChild), true) : false;
    case 6:
      return b = "" === a.pendingProps || 3 !== b.nodeType ? null : b, null !== b ? (a.stateNode = b, xg = a, yg = null, true) : false;
    case 13:
      return b = 8 !== b.nodeType ? null : b, null !== b ? (c = null !== qg ? { id: rg, overflow: sg } : null, a.memoizedState = { dehydrated: b, treeContext: c, retryLane: 1073741824 }, c = Bg(18, null, null, 0), c.stateNode = b, c.return = a, a.child = c, xg = a, yg = null, true) : false;
    default:
      return false;
  }
}
function Dg(a) {
  return 0 !== (a.mode & 1) && 0 === (a.flags & 128);
}
function Eg(a) {
  if (I) {
    var b = yg;
    if (b) {
      var c = b;
      if (!Cg(a, b)) {
        if (Dg(a)) throw Error(p(418));
        b = Lf(c.nextSibling);
        var d = xg;
        b && Cg(a, b) ? Ag(d, c) : (a.flags = a.flags & -4097 | 2, I = false, xg = a);
      }
    } else {
      if (Dg(a)) throw Error(p(418));
      a.flags = a.flags & -4097 | 2;
      I = false;
      xg = a;
    }
  }
}
function Fg(a) {
  for (a = a.return; null !== a && 5 !== a.tag && 3 !== a.tag && 13 !== a.tag; ) a = a.return;
  xg = a;
}
function Gg(a) {
  if (a !== xg) return false;
  if (!I) return Fg(a), I = true, false;
  var b;
  (b = 3 !== a.tag) && !(b = 5 !== a.tag) && (b = a.type, b = "head" !== b && "body" !== b && !Ef(a.type, a.memoizedProps));
  if (b && (b = yg)) {
    if (Dg(a)) throw Hg(), Error(p(418));
    for (; b; ) Ag(a, b), b = Lf(b.nextSibling);
  }
  Fg(a);
  if (13 === a.tag) {
    a = a.memoizedState;
    a = null !== a ? a.dehydrated : null;
    if (!a) throw Error(p(317));
    a: {
      a = a.nextSibling;
      for (b = 0; a; ) {
        if (8 === a.nodeType) {
          var c = a.data;
          if ("/$" === c) {
            if (0 === b) {
              yg = Lf(a.nextSibling);
              break a;
            }
            b--;
          } else "$" !== c && "$!" !== c && "$?" !== c || b++;
        }
        a = a.nextSibling;
      }
      yg = null;
    }
  } else yg = xg ? Lf(a.stateNode.nextSibling) : null;
  return true;
}
function Hg() {
  for (var a = yg; a; ) a = Lf(a.nextSibling);
}
function Ig() {
  yg = xg = null;
  I = false;
}
function Jg(a) {
  null === zg ? zg = [a] : zg.push(a);
}
var Kg = ua.ReactCurrentBatchConfig;
function Lg(a, b, c) {
  a = c.ref;
  if (null !== a && "function" !== typeof a && "object" !== typeof a) {
    if (c._owner) {
      c = c._owner;
      if (c) {
        if (1 !== c.tag) throw Error(p(309));
        var d = c.stateNode;
      }
      if (!d) throw Error(p(147, a));
      var e = d, f2 = "" + a;
      if (null !== b && null !== b.ref && "function" === typeof b.ref && b.ref._stringRef === f2) return b.ref;
      b = function(a2) {
        var b2 = e.refs;
        null === a2 ? delete b2[f2] : b2[f2] = a2;
      };
      b._stringRef = f2;
      return b;
    }
    if ("string" !== typeof a) throw Error(p(284));
    if (!c._owner) throw Error(p(290, a));
  }
  return a;
}
function Mg(a, b) {
  a = Object.prototype.toString.call(b);
  throw Error(p(31, "[object Object]" === a ? "object with keys {" + Object.keys(b).join(", ") + "}" : a));
}
function Ng(a) {
  var b = a._init;
  return b(a._payload);
}
function Og(a) {
  function b(b2, c2) {
    if (a) {
      var d2 = b2.deletions;
      null === d2 ? (b2.deletions = [c2], b2.flags |= 16) : d2.push(c2);
    }
  }
  function c(c2, d2) {
    if (!a) return null;
    for (; null !== d2; ) b(c2, d2), d2 = d2.sibling;
    return null;
  }
  function d(a2, b2) {
    for (a2 = /* @__PURE__ */ new Map(); null !== b2; ) null !== b2.key ? a2.set(b2.key, b2) : a2.set(b2.index, b2), b2 = b2.sibling;
    return a2;
  }
  function e(a2, b2) {
    a2 = Pg(a2, b2);
    a2.index = 0;
    a2.sibling = null;
    return a2;
  }
  function f2(b2, c2, d2) {
    b2.index = d2;
    if (!a) return b2.flags |= 1048576, c2;
    d2 = b2.alternate;
    if (null !== d2) return d2 = d2.index, d2 < c2 ? (b2.flags |= 2, c2) : d2;
    b2.flags |= 2;
    return c2;
  }
  function g(b2) {
    a && null === b2.alternate && (b2.flags |= 2);
    return b2;
  }
  function h(a2, b2, c2, d2) {
    if (null === b2 || 6 !== b2.tag) return b2 = Qg(c2, a2.mode, d2), b2.return = a2, b2;
    b2 = e(b2, c2);
    b2.return = a2;
    return b2;
  }
  function k2(a2, b2, c2, d2) {
    var f3 = c2.type;
    if (f3 === ya) return m2(a2, b2, c2.props.children, d2, c2.key);
    if (null !== b2 && (b2.elementType === f3 || "object" === typeof f3 && null !== f3 && f3.$$typeof === Ha && Ng(f3) === b2.type)) return d2 = e(b2, c2.props), d2.ref = Lg(a2, b2, c2), d2.return = a2, d2;
    d2 = Rg(c2.type, c2.key, c2.props, null, a2.mode, d2);
    d2.ref = Lg(a2, b2, c2);
    d2.return = a2;
    return d2;
  }
  function l2(a2, b2, c2, d2) {
    if (null === b2 || 4 !== b2.tag || b2.stateNode.containerInfo !== c2.containerInfo || b2.stateNode.implementation !== c2.implementation) return b2 = Sg(c2, a2.mode, d2), b2.return = a2, b2;
    b2 = e(b2, c2.children || []);
    b2.return = a2;
    return b2;
  }
  function m2(a2, b2, c2, d2, f3) {
    if (null === b2 || 7 !== b2.tag) return b2 = Tg(c2, a2.mode, d2, f3), b2.return = a2, b2;
    b2 = e(b2, c2);
    b2.return = a2;
    return b2;
  }
  function q2(a2, b2, c2) {
    if ("string" === typeof b2 && "" !== b2 || "number" === typeof b2) return b2 = Qg("" + b2, a2.mode, c2), b2.return = a2, b2;
    if ("object" === typeof b2 && null !== b2) {
      switch (b2.$$typeof) {
        case va:
          return c2 = Rg(b2.type, b2.key, b2.props, null, a2.mode, c2), c2.ref = Lg(a2, null, b2), c2.return = a2, c2;
        case wa:
          return b2 = Sg(b2, a2.mode, c2), b2.return = a2, b2;
        case Ha:
          var d2 = b2._init;
          return q2(a2, d2(b2._payload), c2);
      }
      if (eb(b2) || Ka(b2)) return b2 = Tg(b2, a2.mode, c2, null), b2.return = a2, b2;
      Mg(a2, b2);
    }
    return null;
  }
  function r2(a2, b2, c2, d2) {
    var e2 = null !== b2 ? b2.key : null;
    if ("string" === typeof c2 && "" !== c2 || "number" === typeof c2) return null !== e2 ? null : h(a2, b2, "" + c2, d2);
    if ("object" === typeof c2 && null !== c2) {
      switch (c2.$$typeof) {
        case va:
          return c2.key === e2 ? k2(a2, b2, c2, d2) : null;
        case wa:
          return c2.key === e2 ? l2(a2, b2, c2, d2) : null;
        case Ha:
          return e2 = c2._init, r2(
            a2,
            b2,
            e2(c2._payload),
            d2
          );
      }
      if (eb(c2) || Ka(c2)) return null !== e2 ? null : m2(a2, b2, c2, d2, null);
      Mg(a2, c2);
    }
    return null;
  }
  function y2(a2, b2, c2, d2, e2) {
    if ("string" === typeof d2 && "" !== d2 || "number" === typeof d2) return a2 = a2.get(c2) || null, h(b2, a2, "" + d2, e2);
    if ("object" === typeof d2 && null !== d2) {
      switch (d2.$$typeof) {
        case va:
          return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, k2(b2, a2, d2, e2);
        case wa:
          return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, l2(b2, a2, d2, e2);
        case Ha:
          var f3 = d2._init;
          return y2(a2, b2, c2, f3(d2._payload), e2);
      }
      if (eb(d2) || Ka(d2)) return a2 = a2.get(c2) || null, m2(b2, a2, d2, e2, null);
      Mg(b2, d2);
    }
    return null;
  }
  function n2(e2, g2, h2, k3) {
    for (var l3 = null, m3 = null, u2 = g2, w2 = g2 = 0, x2 = null; null !== u2 && w2 < h2.length; w2++) {
      u2.index > w2 ? (x2 = u2, u2 = null) : x2 = u2.sibling;
      var n3 = r2(e2, u2, h2[w2], k3);
      if (null === n3) {
        null === u2 && (u2 = x2);
        break;
      }
      a && u2 && null === n3.alternate && b(e2, u2);
      g2 = f2(n3, g2, w2);
      null === m3 ? l3 = n3 : m3.sibling = n3;
      m3 = n3;
      u2 = x2;
    }
    if (w2 === h2.length) return c(e2, u2), I && tg(e2, w2), l3;
    if (null === u2) {
      for (; w2 < h2.length; w2++) u2 = q2(e2, h2[w2], k3), null !== u2 && (g2 = f2(u2, g2, w2), null === m3 ? l3 = u2 : m3.sibling = u2, m3 = u2);
      I && tg(e2, w2);
      return l3;
    }
    for (u2 = d(e2, u2); w2 < h2.length; w2++) x2 = y2(u2, e2, w2, h2[w2], k3), null !== x2 && (a && null !== x2.alternate && u2.delete(null === x2.key ? w2 : x2.key), g2 = f2(x2, g2, w2), null === m3 ? l3 = x2 : m3.sibling = x2, m3 = x2);
    a && u2.forEach(function(a2) {
      return b(e2, a2);
    });
    I && tg(e2, w2);
    return l3;
  }
  function t2(e2, g2, h2, k3) {
    var l3 = Ka(h2);
    if ("function" !== typeof l3) throw Error(p(150));
    h2 = l3.call(h2);
    if (null == h2) throw Error(p(151));
    for (var u2 = l3 = null, m3 = g2, w2 = g2 = 0, x2 = null, n3 = h2.next(); null !== m3 && !n3.done; w2++, n3 = h2.next()) {
      m3.index > w2 ? (x2 = m3, m3 = null) : x2 = m3.sibling;
      var t3 = r2(e2, m3, n3.value, k3);
      if (null === t3) {
        null === m3 && (m3 = x2);
        break;
      }
      a && m3 && null === t3.alternate && b(e2, m3);
      g2 = f2(t3, g2, w2);
      null === u2 ? l3 = t3 : u2.sibling = t3;
      u2 = t3;
      m3 = x2;
    }
    if (n3.done) return c(
      e2,
      m3
    ), I && tg(e2, w2), l3;
    if (null === m3) {
      for (; !n3.done; w2++, n3 = h2.next()) n3 = q2(e2, n3.value, k3), null !== n3 && (g2 = f2(n3, g2, w2), null === u2 ? l3 = n3 : u2.sibling = n3, u2 = n3);
      I && tg(e2, w2);
      return l3;
    }
    for (m3 = d(e2, m3); !n3.done; w2++, n3 = h2.next()) n3 = y2(m3, e2, w2, n3.value, k3), null !== n3 && (a && null !== n3.alternate && m3.delete(null === n3.key ? w2 : n3.key), g2 = f2(n3, g2, w2), null === u2 ? l3 = n3 : u2.sibling = n3, u2 = n3);
    a && m3.forEach(function(a2) {
      return b(e2, a2);
    });
    I && tg(e2, w2);
    return l3;
  }
  function J2(a2, d2, f3, h2) {
    "object" === typeof f3 && null !== f3 && f3.type === ya && null === f3.key && (f3 = f3.props.children);
    if ("object" === typeof f3 && null !== f3) {
      switch (f3.$$typeof) {
        case va:
          a: {
            for (var k3 = f3.key, l3 = d2; null !== l3; ) {
              if (l3.key === k3) {
                k3 = f3.type;
                if (k3 === ya) {
                  if (7 === l3.tag) {
                    c(a2, l3.sibling);
                    d2 = e(l3, f3.props.children);
                    d2.return = a2;
                    a2 = d2;
                    break a;
                  }
                } else if (l3.elementType === k3 || "object" === typeof k3 && null !== k3 && k3.$$typeof === Ha && Ng(k3) === l3.type) {
                  c(a2, l3.sibling);
                  d2 = e(l3, f3.props);
                  d2.ref = Lg(a2, l3, f3);
                  d2.return = a2;
                  a2 = d2;
                  break a;
                }
                c(a2, l3);
                break;
              } else b(a2, l3);
              l3 = l3.sibling;
            }
            f3.type === ya ? (d2 = Tg(f3.props.children, a2.mode, h2, f3.key), d2.return = a2, a2 = d2) : (h2 = Rg(f3.type, f3.key, f3.props, null, a2.mode, h2), h2.ref = Lg(a2, d2, f3), h2.return = a2, a2 = h2);
          }
          return g(a2);
        case wa:
          a: {
            for (l3 = f3.key; null !== d2; ) {
              if (d2.key === l3) if (4 === d2.tag && d2.stateNode.containerInfo === f3.containerInfo && d2.stateNode.implementation === f3.implementation) {
                c(a2, d2.sibling);
                d2 = e(d2, f3.children || []);
                d2.return = a2;
                a2 = d2;
                break a;
              } else {
                c(a2, d2);
                break;
              }
              else b(a2, d2);
              d2 = d2.sibling;
            }
            d2 = Sg(f3, a2.mode, h2);
            d2.return = a2;
            a2 = d2;
          }
          return g(a2);
        case Ha:
          return l3 = f3._init, J2(a2, d2, l3(f3._payload), h2);
      }
      if (eb(f3)) return n2(a2, d2, f3, h2);
      if (Ka(f3)) return t2(a2, d2, f3, h2);
      Mg(a2, f3);
    }
    return "string" === typeof f3 && "" !== f3 || "number" === typeof f3 ? (f3 = "" + f3, null !== d2 && 6 === d2.tag ? (c(a2, d2.sibling), d2 = e(d2, f3), d2.return = a2, a2 = d2) : (c(a2, d2), d2 = Qg(f3, a2.mode, h2), d2.return = a2, a2 = d2), g(a2)) : c(a2, d2);
  }
  return J2;
}
var Ug = Og(true), Vg = Og(false), Wg = Uf(null), Xg = null, Yg = null, Zg = null;
function $g() {
  Zg = Yg = Xg = null;
}
function ah(a) {
  var b = Wg.current;
  E(Wg);
  a._currentValue = b;
}
function bh(a, b, c) {
  for (; null !== a; ) {
    var d = a.alternate;
    (a.childLanes & b) !== b ? (a.childLanes |= b, null !== d && (d.childLanes |= b)) : null !== d && (d.childLanes & b) !== b && (d.childLanes |= b);
    if (a === c) break;
    a = a.return;
  }
}
function ch(a, b) {
  Xg = a;
  Zg = Yg = null;
  a = a.dependencies;
  null !== a && null !== a.firstContext && (0 !== (a.lanes & b) && (dh = true), a.firstContext = null);
}
function eh(a) {
  var b = a._currentValue;
  if (Zg !== a) if (a = { context: a, memoizedValue: b, next: null }, null === Yg) {
    if (null === Xg) throw Error(p(308));
    Yg = a;
    Xg.dependencies = { lanes: 0, firstContext: a };
  } else Yg = Yg.next = a;
  return b;
}
var fh = null;
function gh(a) {
  null === fh ? fh = [a] : fh.push(a);
}
function hh(a, b, c, d) {
  var e = b.interleaved;
  null === e ? (c.next = c, gh(b)) : (c.next = e.next, e.next = c);
  b.interleaved = c;
  return ih(a, d);
}
function ih(a, b) {
  a.lanes |= b;
  var c = a.alternate;
  null !== c && (c.lanes |= b);
  c = a;
  for (a = a.return; null !== a; ) a.childLanes |= b, c = a.alternate, null !== c && (c.childLanes |= b), c = a, a = a.return;
  return 3 === c.tag ? c.stateNode : null;
}
var jh = false;
function kh(a) {
  a.updateQueue = { baseState: a.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
}
function lh(a, b) {
  a = a.updateQueue;
  b.updateQueue === a && (b.updateQueue = { baseState: a.baseState, firstBaseUpdate: a.firstBaseUpdate, lastBaseUpdate: a.lastBaseUpdate, shared: a.shared, effects: a.effects });
}
function mh(a, b) {
  return { eventTime: a, lane: b, tag: 0, payload: null, callback: null, next: null };
}
function nh(a, b, c) {
  var d = a.updateQueue;
  if (null === d) return null;
  d = d.shared;
  if (0 !== (K & 2)) {
    var e = d.pending;
    null === e ? b.next = b : (b.next = e.next, e.next = b);
    d.pending = b;
    return ih(a, c);
  }
  e = d.interleaved;
  null === e ? (b.next = b, gh(d)) : (b.next = e.next, e.next = b);
  d.interleaved = b;
  return ih(a, c);
}
function oh(a, b, c) {
  b = b.updateQueue;
  if (null !== b && (b = b.shared, 0 !== (c & 4194240))) {
    var d = b.lanes;
    d &= a.pendingLanes;
    c |= d;
    b.lanes = c;
    Cc(a, c);
  }
}
function ph(a, b) {
  var c = a.updateQueue, d = a.alternate;
  if (null !== d && (d = d.updateQueue, c === d)) {
    var e = null, f2 = null;
    c = c.firstBaseUpdate;
    if (null !== c) {
      do {
        var g = { eventTime: c.eventTime, lane: c.lane, tag: c.tag, payload: c.payload, callback: c.callback, next: null };
        null === f2 ? e = f2 = g : f2 = f2.next = g;
        c = c.next;
      } while (null !== c);
      null === f2 ? e = f2 = b : f2 = f2.next = b;
    } else e = f2 = b;
    c = { baseState: d.baseState, firstBaseUpdate: e, lastBaseUpdate: f2, shared: d.shared, effects: d.effects };
    a.updateQueue = c;
    return;
  }
  a = c.lastBaseUpdate;
  null === a ? c.firstBaseUpdate = b : a.next = b;
  c.lastBaseUpdate = b;
}
function qh(a, b, c, d) {
  var e = a.updateQueue;
  jh = false;
  var f2 = e.firstBaseUpdate, g = e.lastBaseUpdate, h = e.shared.pending;
  if (null !== h) {
    e.shared.pending = null;
    var k2 = h, l2 = k2.next;
    k2.next = null;
    null === g ? f2 = l2 : g.next = l2;
    g = k2;
    var m2 = a.alternate;
    null !== m2 && (m2 = m2.updateQueue, h = m2.lastBaseUpdate, h !== g && (null === h ? m2.firstBaseUpdate = l2 : h.next = l2, m2.lastBaseUpdate = k2));
  }
  if (null !== f2) {
    var q2 = e.baseState;
    g = 0;
    m2 = l2 = k2 = null;
    h = f2;
    do {
      var r2 = h.lane, y2 = h.eventTime;
      if ((d & r2) === r2) {
        null !== m2 && (m2 = m2.next = {
          eventTime: y2,
          lane: 0,
          tag: h.tag,
          payload: h.payload,
          callback: h.callback,
          next: null
        });
        a: {
          var n2 = a, t2 = h;
          r2 = b;
          y2 = c;
          switch (t2.tag) {
            case 1:
              n2 = t2.payload;
              if ("function" === typeof n2) {
                q2 = n2.call(y2, q2, r2);
                break a;
              }
              q2 = n2;
              break a;
            case 3:
              n2.flags = n2.flags & -65537 | 128;
            case 0:
              n2 = t2.payload;
              r2 = "function" === typeof n2 ? n2.call(y2, q2, r2) : n2;
              if (null === r2 || void 0 === r2) break a;
              q2 = A({}, q2, r2);
              break a;
            case 2:
              jh = true;
          }
        }
        null !== h.callback && 0 !== h.lane && (a.flags |= 64, r2 = e.effects, null === r2 ? e.effects = [h] : r2.push(h));
      } else y2 = { eventTime: y2, lane: r2, tag: h.tag, payload: h.payload, callback: h.callback, next: null }, null === m2 ? (l2 = m2 = y2, k2 = q2) : m2 = m2.next = y2, g |= r2;
      h = h.next;
      if (null === h) if (h = e.shared.pending, null === h) break;
      else r2 = h, h = r2.next, r2.next = null, e.lastBaseUpdate = r2, e.shared.pending = null;
    } while (1);
    null === m2 && (k2 = q2);
    e.baseState = k2;
    e.firstBaseUpdate = l2;
    e.lastBaseUpdate = m2;
    b = e.shared.interleaved;
    if (null !== b) {
      e = b;
      do
        g |= e.lane, e = e.next;
      while (e !== b);
    } else null === f2 && (e.shared.lanes = 0);
    rh |= g;
    a.lanes = g;
    a.memoizedState = q2;
  }
}
function sh(a, b, c) {
  a = b.effects;
  b.effects = null;
  if (null !== a) for (b = 0; b < a.length; b++) {
    var d = a[b], e = d.callback;
    if (null !== e) {
      d.callback = null;
      d = c;
      if ("function" !== typeof e) throw Error(p(191, e));
      e.call(d);
    }
  }
}
var th = {}, uh = Uf(th), vh = Uf(th), wh = Uf(th);
function xh(a) {
  if (a === th) throw Error(p(174));
  return a;
}
function yh(a, b) {
  G(wh, b);
  G(vh, a);
  G(uh, th);
  a = b.nodeType;
  switch (a) {
    case 9:
    case 11:
      b = (b = b.documentElement) ? b.namespaceURI : lb(null, "");
      break;
    default:
      a = 8 === a ? b.parentNode : b, b = a.namespaceURI || null, a = a.tagName, b = lb(b, a);
  }
  E(uh);
  G(uh, b);
}
function zh() {
  E(uh);
  E(vh);
  E(wh);
}
function Ah(a) {
  xh(wh.current);
  var b = xh(uh.current);
  var c = lb(b, a.type);
  b !== c && (G(vh, a), G(uh, c));
}
function Bh(a) {
  vh.current === a && (E(uh), E(vh));
}
var L = Uf(0);
function Ch(a) {
  for (var b = a; null !== b; ) {
    if (13 === b.tag) {
      var c = b.memoizedState;
      if (null !== c && (c = c.dehydrated, null === c || "$?" === c.data || "$!" === c.data)) return b;
    } else if (19 === b.tag && void 0 !== b.memoizedProps.revealOrder) {
      if (0 !== (b.flags & 128)) return b;
    } else if (null !== b.child) {
      b.child.return = b;
      b = b.child;
      continue;
    }
    if (b === a) break;
    for (; null === b.sibling; ) {
      if (null === b.return || b.return === a) return null;
      b = b.return;
    }
    b.sibling.return = b.return;
    b = b.sibling;
  }
  return null;
}
var Dh = [];
function Eh() {
  for (var a = 0; a < Dh.length; a++) Dh[a]._workInProgressVersionPrimary = null;
  Dh.length = 0;
}
var Fh = ua.ReactCurrentDispatcher, Gh = ua.ReactCurrentBatchConfig, Hh = 0, M = null, N = null, O = null, Ih = false, Jh = false, Kh = 0, Lh = 0;
function P() {
  throw Error(p(321));
}
function Mh(a, b) {
  if (null === b) return false;
  for (var c = 0; c < b.length && c < a.length; c++) if (!He(a[c], b[c])) return false;
  return true;
}
function Nh(a, b, c, d, e, f2) {
  Hh = f2;
  M = b;
  b.memoizedState = null;
  b.updateQueue = null;
  b.lanes = 0;
  Fh.current = null === a || null === a.memoizedState ? Oh : Ph;
  a = c(d, e);
  if (Jh) {
    f2 = 0;
    do {
      Jh = false;
      Kh = 0;
      if (25 <= f2) throw Error(p(301));
      f2 += 1;
      O = N = null;
      b.updateQueue = null;
      Fh.current = Qh;
      a = c(d, e);
    } while (Jh);
  }
  Fh.current = Rh;
  b = null !== N && null !== N.next;
  Hh = 0;
  O = N = M = null;
  Ih = false;
  if (b) throw Error(p(300));
  return a;
}
function Sh() {
  var a = 0 !== Kh;
  Kh = 0;
  return a;
}
function Th() {
  var a = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
  null === O ? M.memoizedState = O = a : O = O.next = a;
  return O;
}
function Uh() {
  if (null === N) {
    var a = M.alternate;
    a = null !== a ? a.memoizedState : null;
  } else a = N.next;
  var b = null === O ? M.memoizedState : O.next;
  if (null !== b) O = b, N = a;
  else {
    if (null === a) throw Error(p(310));
    N = a;
    a = { memoizedState: N.memoizedState, baseState: N.baseState, baseQueue: N.baseQueue, queue: N.queue, next: null };
    null === O ? M.memoizedState = O = a : O = O.next = a;
  }
  return O;
}
function Vh(a, b) {
  return "function" === typeof b ? b(a) : b;
}
function Wh(a) {
  var b = Uh(), c = b.queue;
  if (null === c) throw Error(p(311));
  c.lastRenderedReducer = a;
  var d = N, e = d.baseQueue, f2 = c.pending;
  if (null !== f2) {
    if (null !== e) {
      var g = e.next;
      e.next = f2.next;
      f2.next = g;
    }
    d.baseQueue = e = f2;
    c.pending = null;
  }
  if (null !== e) {
    f2 = e.next;
    d = d.baseState;
    var h = g = null, k2 = null, l2 = f2;
    do {
      var m2 = l2.lane;
      if ((Hh & m2) === m2) null !== k2 && (k2 = k2.next = { lane: 0, action: l2.action, hasEagerState: l2.hasEagerState, eagerState: l2.eagerState, next: null }), d = l2.hasEagerState ? l2.eagerState : a(d, l2.action);
      else {
        var q2 = {
          lane: m2,
          action: l2.action,
          hasEagerState: l2.hasEagerState,
          eagerState: l2.eagerState,
          next: null
        };
        null === k2 ? (h = k2 = q2, g = d) : k2 = k2.next = q2;
        M.lanes |= m2;
        rh |= m2;
      }
      l2 = l2.next;
    } while (null !== l2 && l2 !== f2);
    null === k2 ? g = d : k2.next = h;
    He(d, b.memoizedState) || (dh = true);
    b.memoizedState = d;
    b.baseState = g;
    b.baseQueue = k2;
    c.lastRenderedState = d;
  }
  a = c.interleaved;
  if (null !== a) {
    e = a;
    do
      f2 = e.lane, M.lanes |= f2, rh |= f2, e = e.next;
    while (e !== a);
  } else null === e && (c.lanes = 0);
  return [b.memoizedState, c.dispatch];
}
function Xh(a) {
  var b = Uh(), c = b.queue;
  if (null === c) throw Error(p(311));
  c.lastRenderedReducer = a;
  var d = c.dispatch, e = c.pending, f2 = b.memoizedState;
  if (null !== e) {
    c.pending = null;
    var g = e = e.next;
    do
      f2 = a(f2, g.action), g = g.next;
    while (g !== e);
    He(f2, b.memoizedState) || (dh = true);
    b.memoizedState = f2;
    null === b.baseQueue && (b.baseState = f2);
    c.lastRenderedState = f2;
  }
  return [f2, d];
}
function Yh() {
}
function Zh(a, b) {
  var c = M, d = Uh(), e = b(), f2 = !He(d.memoizedState, e);
  f2 && (d.memoizedState = e, dh = true);
  d = d.queue;
  $h(ai.bind(null, c, d, a), [a]);
  if (d.getSnapshot !== b || f2 || null !== O && O.memoizedState.tag & 1) {
    c.flags |= 2048;
    bi(9, ci.bind(null, c, d, e, b), void 0, null);
    if (null === Q) throw Error(p(349));
    0 !== (Hh & 30) || di(c, b, e);
  }
  return e;
}
function di(a, b, c) {
  a.flags |= 16384;
  a = { getSnapshot: b, value: c };
  b = M.updateQueue;
  null === b ? (b = { lastEffect: null, stores: null }, M.updateQueue = b, b.stores = [a]) : (c = b.stores, null === c ? b.stores = [a] : c.push(a));
}
function ci(a, b, c, d) {
  b.value = c;
  b.getSnapshot = d;
  ei(b) && fi(a);
}
function ai(a, b, c) {
  return c(function() {
    ei(b) && fi(a);
  });
}
function ei(a) {
  var b = a.getSnapshot;
  a = a.value;
  try {
    var c = b();
    return !He(a, c);
  } catch (d) {
    return true;
  }
}
function fi(a) {
  var b = ih(a, 1);
  null !== b && gi(b, a, 1, -1);
}
function hi(a) {
  var b = Th();
  "function" === typeof a && (a = a());
  b.memoizedState = b.baseState = a;
  a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: Vh, lastRenderedState: a };
  b.queue = a;
  a = a.dispatch = ii.bind(null, M, a);
  return [b.memoizedState, a];
}
function bi(a, b, c, d) {
  a = { tag: a, create: b, destroy: c, deps: d, next: null };
  b = M.updateQueue;
  null === b ? (b = { lastEffect: null, stores: null }, M.updateQueue = b, b.lastEffect = a.next = a) : (c = b.lastEffect, null === c ? b.lastEffect = a.next = a : (d = c.next, c.next = a, a.next = d, b.lastEffect = a));
  return a;
}
function ji() {
  return Uh().memoizedState;
}
function ki(a, b, c, d) {
  var e = Th();
  M.flags |= a;
  e.memoizedState = bi(1 | b, c, void 0, void 0 === d ? null : d);
}
function li(a, b, c, d) {
  var e = Uh();
  d = void 0 === d ? null : d;
  var f2 = void 0;
  if (null !== N) {
    var g = N.memoizedState;
    f2 = g.destroy;
    if (null !== d && Mh(d, g.deps)) {
      e.memoizedState = bi(b, c, f2, d);
      return;
    }
  }
  M.flags |= a;
  e.memoizedState = bi(1 | b, c, f2, d);
}
function mi(a, b) {
  return ki(8390656, 8, a, b);
}
function $h(a, b) {
  return li(2048, 8, a, b);
}
function ni(a, b) {
  return li(4, 2, a, b);
}
function oi(a, b) {
  return li(4, 4, a, b);
}
function pi(a, b) {
  if ("function" === typeof b) return a = a(), b(a), function() {
    b(null);
  };
  if (null !== b && void 0 !== b) return a = a(), b.current = a, function() {
    b.current = null;
  };
}
function qi(a, b, c) {
  c = null !== c && void 0 !== c ? c.concat([a]) : null;
  return li(4, 4, pi.bind(null, b, a), c);
}
function ri() {
}
function si(a, b) {
  var c = Uh();
  b = void 0 === b ? null : b;
  var d = c.memoizedState;
  if (null !== d && null !== b && Mh(b, d[1])) return d[0];
  c.memoizedState = [a, b];
  return a;
}
function ti(a, b) {
  var c = Uh();
  b = void 0 === b ? null : b;
  var d = c.memoizedState;
  if (null !== d && null !== b && Mh(b, d[1])) return d[0];
  a = a();
  c.memoizedState = [a, b];
  return a;
}
function ui(a, b, c) {
  if (0 === (Hh & 21)) return a.baseState && (a.baseState = false, dh = true), a.memoizedState = c;
  He(c, b) || (c = yc(), M.lanes |= c, rh |= c, a.baseState = true);
  return b;
}
function vi(a, b) {
  var c = C;
  C = 0 !== c && 4 > c ? c : 4;
  a(true);
  var d = Gh.transition;
  Gh.transition = {};
  try {
    a(false), b();
  } finally {
    C = c, Gh.transition = d;
  }
}
function wi() {
  return Uh().memoizedState;
}
function xi(a, b, c) {
  var d = yi(a);
  c = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
  if (zi(a)) Ai(b, c);
  else if (c = hh(a, b, c, d), null !== c) {
    var e = R();
    gi(c, a, d, e);
    Bi(c, b, d);
  }
}
function ii(a, b, c) {
  var d = yi(a), e = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
  if (zi(a)) Ai(b, e);
  else {
    var f2 = a.alternate;
    if (0 === a.lanes && (null === f2 || 0 === f2.lanes) && (f2 = b.lastRenderedReducer, null !== f2)) try {
      var g = b.lastRenderedState, h = f2(g, c);
      e.hasEagerState = true;
      e.eagerState = h;
      if (He(h, g)) {
        var k2 = b.interleaved;
        null === k2 ? (e.next = e, gh(b)) : (e.next = k2.next, k2.next = e);
        b.interleaved = e;
        return;
      }
    } catch (l2) {
    } finally {
    }
    c = hh(a, b, e, d);
    null !== c && (e = R(), gi(c, a, d, e), Bi(c, b, d));
  }
}
function zi(a) {
  var b = a.alternate;
  return a === M || null !== b && b === M;
}
function Ai(a, b) {
  Jh = Ih = true;
  var c = a.pending;
  null === c ? b.next = b : (b.next = c.next, c.next = b);
  a.pending = b;
}
function Bi(a, b, c) {
  if (0 !== (c & 4194240)) {
    var d = b.lanes;
    d &= a.pendingLanes;
    c |= d;
    b.lanes = c;
    Cc(a, c);
  }
}
var Rh = { readContext: eh, useCallback: P, useContext: P, useEffect: P, useImperativeHandle: P, useInsertionEffect: P, useLayoutEffect: P, useMemo: P, useReducer: P, useRef: P, useState: P, useDebugValue: P, useDeferredValue: P, useTransition: P, useMutableSource: P, useSyncExternalStore: P, useId: P, unstable_isNewReconciler: false }, Oh = { readContext: eh, useCallback: function(a, b) {
  Th().memoizedState = [a, void 0 === b ? null : b];
  return a;
}, useContext: eh, useEffect: mi, useImperativeHandle: function(a, b, c) {
  c = null !== c && void 0 !== c ? c.concat([a]) : null;
  return ki(
    4194308,
    4,
    pi.bind(null, b, a),
    c
  );
}, useLayoutEffect: function(a, b) {
  return ki(4194308, 4, a, b);
}, useInsertionEffect: function(a, b) {
  return ki(4, 2, a, b);
}, useMemo: function(a, b) {
  var c = Th();
  b = void 0 === b ? null : b;
  a = a();
  c.memoizedState = [a, b];
  return a;
}, useReducer: function(a, b, c) {
  var d = Th();
  b = void 0 !== c ? c(b) : b;
  d.memoizedState = d.baseState = b;
  a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: a, lastRenderedState: b };
  d.queue = a;
  a = a.dispatch = xi.bind(null, M, a);
  return [d.memoizedState, a];
}, useRef: function(a) {
  var b = Th();
  a = { current: a };
  return b.memoizedState = a;
}, useState: hi, useDebugValue: ri, useDeferredValue: function(a) {
  return Th().memoizedState = a;
}, useTransition: function() {
  var a = hi(false), b = a[0];
  a = vi.bind(null, a[1]);
  Th().memoizedState = a;
  return [b, a];
}, useMutableSource: function() {
}, useSyncExternalStore: function(a, b, c) {
  var d = M, e = Th();
  if (I) {
    if (void 0 === c) throw Error(p(407));
    c = c();
  } else {
    c = b();
    if (null === Q) throw Error(p(349));
    0 !== (Hh & 30) || di(d, b, c);
  }
  e.memoizedState = c;
  var f2 = { value: c, getSnapshot: b };
  e.queue = f2;
  mi(ai.bind(
    null,
    d,
    f2,
    a
  ), [a]);
  d.flags |= 2048;
  bi(9, ci.bind(null, d, f2, c, b), void 0, null);
  return c;
}, useId: function() {
  var a = Th(), b = Q.identifierPrefix;
  if (I) {
    var c = sg;
    var d = rg;
    c = (d & ~(1 << 32 - oc(d) - 1)).toString(32) + c;
    b = ":" + b + "R" + c;
    c = Kh++;
    0 < c && (b += "H" + c.toString(32));
    b += ":";
  } else c = Lh++, b = ":" + b + "r" + c.toString(32) + ":";
  return a.memoizedState = b;
}, unstable_isNewReconciler: false }, Ph = {
  readContext: eh,
  useCallback: si,
  useContext: eh,
  useEffect: $h,
  useImperativeHandle: qi,
  useInsertionEffect: ni,
  useLayoutEffect: oi,
  useMemo: ti,
  useReducer: Wh,
  useRef: ji,
  useState: function() {
    return Wh(Vh);
  },
  useDebugValue: ri,
  useDeferredValue: function(a) {
    var b = Uh();
    return ui(b, N.memoizedState, a);
  },
  useTransition: function() {
    var a = Wh(Vh)[0], b = Uh().memoizedState;
    return [a, b];
  },
  useMutableSource: Yh,
  useSyncExternalStore: Zh,
  useId: wi,
  unstable_isNewReconciler: false
}, Qh = { readContext: eh, useCallback: si, useContext: eh, useEffect: $h, useImperativeHandle: qi, useInsertionEffect: ni, useLayoutEffect: oi, useMemo: ti, useReducer: Xh, useRef: ji, useState: function() {
  return Xh(Vh);
}, useDebugValue: ri, useDeferredValue: function(a) {
  var b = Uh();
  return null === N ? b.memoizedState = a : ui(b, N.memoizedState, a);
}, useTransition: function() {
  var a = Xh(Vh)[0], b = Uh().memoizedState;
  return [a, b];
}, useMutableSource: Yh, useSyncExternalStore: Zh, useId: wi, unstable_isNewReconciler: false };
function Ci(a, b) {
  if (a && a.defaultProps) {
    b = A({}, b);
    a = a.defaultProps;
    for (var c in a) void 0 === b[c] && (b[c] = a[c]);
    return b;
  }
  return b;
}
function Di(a, b, c, d) {
  b = a.memoizedState;
  c = c(d, b);
  c = null === c || void 0 === c ? b : A({}, b, c);
  a.memoizedState = c;
  0 === a.lanes && (a.updateQueue.baseState = c);
}
var Ei = { isMounted: function(a) {
  return (a = a._reactInternals) ? Vb(a) === a : false;
}, enqueueSetState: function(a, b, c) {
  a = a._reactInternals;
  var d = R(), e = yi(a), f2 = mh(d, e);
  f2.payload = b;
  void 0 !== c && null !== c && (f2.callback = c);
  b = nh(a, f2, e);
  null !== b && (gi(b, a, e, d), oh(b, a, e));
}, enqueueReplaceState: function(a, b, c) {
  a = a._reactInternals;
  var d = R(), e = yi(a), f2 = mh(d, e);
  f2.tag = 1;
  f2.payload = b;
  void 0 !== c && null !== c && (f2.callback = c);
  b = nh(a, f2, e);
  null !== b && (gi(b, a, e, d), oh(b, a, e));
}, enqueueForceUpdate: function(a, b) {
  a = a._reactInternals;
  var c = R(), d = yi(a), e = mh(c, d);
  e.tag = 2;
  void 0 !== b && null !== b && (e.callback = b);
  b = nh(a, e, d);
  null !== b && (gi(b, a, d, c), oh(b, a, d));
} };
function Fi(a, b, c, d, e, f2, g) {
  a = a.stateNode;
  return "function" === typeof a.shouldComponentUpdate ? a.shouldComponentUpdate(d, f2, g) : b.prototype && b.prototype.isPureReactComponent ? !Ie(c, d) || !Ie(e, f2) : true;
}
function Gi(a, b, c) {
  var d = false, e = Vf;
  var f2 = b.contextType;
  "object" === typeof f2 && null !== f2 ? f2 = eh(f2) : (e = Zf(b) ? Xf : H.current, d = b.contextTypes, f2 = (d = null !== d && void 0 !== d) ? Yf(a, e) : Vf);
  b = new b(c, f2);
  a.memoizedState = null !== b.state && void 0 !== b.state ? b.state : null;
  b.updater = Ei;
  a.stateNode = b;
  b._reactInternals = a;
  d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = e, a.__reactInternalMemoizedMaskedChildContext = f2);
  return b;
}
function Hi(a, b, c, d) {
  a = b.state;
  "function" === typeof b.componentWillReceiveProps && b.componentWillReceiveProps(c, d);
  "function" === typeof b.UNSAFE_componentWillReceiveProps && b.UNSAFE_componentWillReceiveProps(c, d);
  b.state !== a && Ei.enqueueReplaceState(b, b.state, null);
}
function Ii(a, b, c, d) {
  var e = a.stateNode;
  e.props = c;
  e.state = a.memoizedState;
  e.refs = {};
  kh(a);
  var f2 = b.contextType;
  "object" === typeof f2 && null !== f2 ? e.context = eh(f2) : (f2 = Zf(b) ? Xf : H.current, e.context = Yf(a, f2));
  e.state = a.memoizedState;
  f2 = b.getDerivedStateFromProps;
  "function" === typeof f2 && (Di(a, b, f2, c), e.state = a.memoizedState);
  "function" === typeof b.getDerivedStateFromProps || "function" === typeof e.getSnapshotBeforeUpdate || "function" !== typeof e.UNSAFE_componentWillMount && "function" !== typeof e.componentWillMount || (b = e.state, "function" === typeof e.componentWillMount && e.componentWillMount(), "function" === typeof e.UNSAFE_componentWillMount && e.UNSAFE_componentWillMount(), b !== e.state && Ei.enqueueReplaceState(e, e.state, null), qh(a, c, e, d), e.state = a.memoizedState);
  "function" === typeof e.componentDidMount && (a.flags |= 4194308);
}
function Ji(a, b) {
  try {
    var c = "", d = b;
    do
      c += Pa(d), d = d.return;
    while (d);
    var e = c;
  } catch (f2) {
    e = "\nError generating stack: " + f2.message + "\n" + f2.stack;
  }
  return { value: a, source: b, stack: e, digest: null };
}
function Ki(a, b, c) {
  return { value: a, source: null, stack: null != c ? c : null, digest: null != b ? b : null };
}
function Li(a, b) {
  try {
    console.error(b.value);
  } catch (c) {
    setTimeout(function() {
      throw c;
    });
  }
}
var Mi = "function" === typeof WeakMap ? WeakMap : Map;
function Ni(a, b, c) {
  c = mh(-1, c);
  c.tag = 3;
  c.payload = { element: null };
  var d = b.value;
  c.callback = function() {
    Oi || (Oi = true, Pi = d);
    Li(a, b);
  };
  return c;
}
function Qi(a, b, c) {
  c = mh(-1, c);
  c.tag = 3;
  var d = a.type.getDerivedStateFromError;
  if ("function" === typeof d) {
    var e = b.value;
    c.payload = function() {
      return d(e);
    };
    c.callback = function() {
      Li(a, b);
    };
  }
  var f2 = a.stateNode;
  null !== f2 && "function" === typeof f2.componentDidCatch && (c.callback = function() {
    Li(a, b);
    "function" !== typeof d && (null === Ri ? Ri = /* @__PURE__ */ new Set([this]) : Ri.add(this));
    var c2 = b.stack;
    this.componentDidCatch(b.value, { componentStack: null !== c2 ? c2 : "" });
  });
  return c;
}
function Si(a, b, c) {
  var d = a.pingCache;
  if (null === d) {
    d = a.pingCache = new Mi();
    var e = /* @__PURE__ */ new Set();
    d.set(b, e);
  } else e = d.get(b), void 0 === e && (e = /* @__PURE__ */ new Set(), d.set(b, e));
  e.has(c) || (e.add(c), a = Ti.bind(null, a, b, c), b.then(a, a));
}
function Ui(a) {
  do {
    var b;
    if (b = 13 === a.tag) b = a.memoizedState, b = null !== b ? null !== b.dehydrated ? true : false : true;
    if (b) return a;
    a = a.return;
  } while (null !== a);
  return null;
}
function Vi(a, b, c, d, e) {
  if (0 === (a.mode & 1)) return a === b ? a.flags |= 65536 : (a.flags |= 128, c.flags |= 131072, c.flags &= -52805, 1 === c.tag && (null === c.alternate ? c.tag = 17 : (b = mh(-1, 1), b.tag = 2, nh(c, b, 1))), c.lanes |= 1), a;
  a.flags |= 65536;
  a.lanes = e;
  return a;
}
var Wi = ua.ReactCurrentOwner, dh = false;
function Xi(a, b, c, d) {
  b.child = null === a ? Vg(b, null, c, d) : Ug(b, a.child, c, d);
}
function Yi(a, b, c, d, e) {
  c = c.render;
  var f2 = b.ref;
  ch(b, e);
  d = Nh(a, b, c, d, f2, e);
  c = Sh();
  if (null !== a && !dh) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Zi(a, b, e);
  I && c && vg(b);
  b.flags |= 1;
  Xi(a, b, d, e);
  return b.child;
}
function $i(a, b, c, d, e) {
  if (null === a) {
    var f2 = c.type;
    if ("function" === typeof f2 && !aj(f2) && void 0 === f2.defaultProps && null === c.compare && void 0 === c.defaultProps) return b.tag = 15, b.type = f2, bj(a, b, f2, d, e);
    a = Rg(c.type, null, d, b, b.mode, e);
    a.ref = b.ref;
    a.return = b;
    return b.child = a;
  }
  f2 = a.child;
  if (0 === (a.lanes & e)) {
    var g = f2.memoizedProps;
    c = c.compare;
    c = null !== c ? c : Ie;
    if (c(g, d) && a.ref === b.ref) return Zi(a, b, e);
  }
  b.flags |= 1;
  a = Pg(f2, d);
  a.ref = b.ref;
  a.return = b;
  return b.child = a;
}
function bj(a, b, c, d, e) {
  if (null !== a) {
    var f2 = a.memoizedProps;
    if (Ie(f2, d) && a.ref === b.ref) if (dh = false, b.pendingProps = d = f2, 0 !== (a.lanes & e)) 0 !== (a.flags & 131072) && (dh = true);
    else return b.lanes = a.lanes, Zi(a, b, e);
  }
  return cj(a, b, c, d, e);
}
function dj(a, b, c) {
  var d = b.pendingProps, e = d.children, f2 = null !== a ? a.memoizedState : null;
  if ("hidden" === d.mode) if (0 === (b.mode & 1)) b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, G(ej, fj), fj |= c;
  else {
    if (0 === (c & 1073741824)) return a = null !== f2 ? f2.baseLanes | c : c, b.lanes = b.childLanes = 1073741824, b.memoizedState = { baseLanes: a, cachePool: null, transitions: null }, b.updateQueue = null, G(ej, fj), fj |= a, null;
    b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null };
    d = null !== f2 ? f2.baseLanes : c;
    G(ej, fj);
    fj |= d;
  }
  else null !== f2 ? (d = f2.baseLanes | c, b.memoizedState = null) : d = c, G(ej, fj), fj |= d;
  Xi(a, b, e, c);
  return b.child;
}
function gj(a, b) {
  var c = b.ref;
  if (null === a && null !== c || null !== a && a.ref !== c) b.flags |= 512, b.flags |= 2097152;
}
function cj(a, b, c, d, e) {
  var f2 = Zf(c) ? Xf : H.current;
  f2 = Yf(b, f2);
  ch(b, e);
  c = Nh(a, b, c, d, f2, e);
  d = Sh();
  if (null !== a && !dh) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Zi(a, b, e);
  I && d && vg(b);
  b.flags |= 1;
  Xi(a, b, c, e);
  return b.child;
}
function hj(a, b, c, d, e) {
  if (Zf(c)) {
    var f2 = true;
    cg(b);
  } else f2 = false;
  ch(b, e);
  if (null === b.stateNode) ij(a, b), Gi(b, c, d), Ii(b, c, d, e), d = true;
  else if (null === a) {
    var g = b.stateNode, h = b.memoizedProps;
    g.props = h;
    var k2 = g.context, l2 = c.contextType;
    "object" === typeof l2 && null !== l2 ? l2 = eh(l2) : (l2 = Zf(c) ? Xf : H.current, l2 = Yf(b, l2));
    var m2 = c.getDerivedStateFromProps, q2 = "function" === typeof m2 || "function" === typeof g.getSnapshotBeforeUpdate;
    q2 || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== d || k2 !== l2) && Hi(b, g, d, l2);
    jh = false;
    var r2 = b.memoizedState;
    g.state = r2;
    qh(b, d, g, e);
    k2 = b.memoizedState;
    h !== d || r2 !== k2 || Wf.current || jh ? ("function" === typeof m2 && (Di(b, c, m2, d), k2 = b.memoizedState), (h = jh || Fi(b, c, h, d, r2, k2, l2)) ? (q2 || "function" !== typeof g.UNSAFE_componentWillMount && "function" !== typeof g.componentWillMount || ("function" === typeof g.componentWillMount && g.componentWillMount(), "function" === typeof g.UNSAFE_componentWillMount && g.UNSAFE_componentWillMount()), "function" === typeof g.componentDidMount && (b.flags |= 4194308)) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), b.memoizedProps = d, b.memoizedState = k2), g.props = d, g.state = k2, g.context = l2, d = h) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), d = false);
  } else {
    g = b.stateNode;
    lh(a, b);
    h = b.memoizedProps;
    l2 = b.type === b.elementType ? h : Ci(b.type, h);
    g.props = l2;
    q2 = b.pendingProps;
    r2 = g.context;
    k2 = c.contextType;
    "object" === typeof k2 && null !== k2 ? k2 = eh(k2) : (k2 = Zf(c) ? Xf : H.current, k2 = Yf(b, k2));
    var y2 = c.getDerivedStateFromProps;
    (m2 = "function" === typeof y2 || "function" === typeof g.getSnapshotBeforeUpdate) || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== q2 || r2 !== k2) && Hi(b, g, d, k2);
    jh = false;
    r2 = b.memoizedState;
    g.state = r2;
    qh(b, d, g, e);
    var n2 = b.memoizedState;
    h !== q2 || r2 !== n2 || Wf.current || jh ? ("function" === typeof y2 && (Di(b, c, y2, d), n2 = b.memoizedState), (l2 = jh || Fi(b, c, l2, d, r2, n2, k2) || false) ? (m2 || "function" !== typeof g.UNSAFE_componentWillUpdate && "function" !== typeof g.componentWillUpdate || ("function" === typeof g.componentWillUpdate && g.componentWillUpdate(d, n2, k2), "function" === typeof g.UNSAFE_componentWillUpdate && g.UNSAFE_componentWillUpdate(d, n2, k2)), "function" === typeof g.componentDidUpdate && (b.flags |= 4), "function" === typeof g.getSnapshotBeforeUpdate && (b.flags |= 1024)) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && r2 === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && r2 === a.memoizedState || (b.flags |= 1024), b.memoizedProps = d, b.memoizedState = n2), g.props = d, g.state = n2, g.context = k2, d = l2) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && r2 === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && r2 === a.memoizedState || (b.flags |= 1024), d = false);
  }
  return jj(a, b, c, d, f2, e);
}
function jj(a, b, c, d, e, f2) {
  gj(a, b);
  var g = 0 !== (b.flags & 128);
  if (!d && !g) return e && dg(b, c, false), Zi(a, b, f2);
  d = b.stateNode;
  Wi.current = b;
  var h = g && "function" !== typeof c.getDerivedStateFromError ? null : d.render();
  b.flags |= 1;
  null !== a && g ? (b.child = Ug(b, a.child, null, f2), b.child = Ug(b, null, h, f2)) : Xi(a, b, h, f2);
  b.memoizedState = d.state;
  e && dg(b, c, true);
  return b.child;
}
function kj(a) {
  var b = a.stateNode;
  b.pendingContext ? ag(a, b.pendingContext, b.pendingContext !== b.context) : b.context && ag(a, b.context, false);
  yh(a, b.containerInfo);
}
function lj(a, b, c, d, e) {
  Ig();
  Jg(e);
  b.flags |= 256;
  Xi(a, b, c, d);
  return b.child;
}
var mj = { dehydrated: null, treeContext: null, retryLane: 0 };
function nj(a) {
  return { baseLanes: a, cachePool: null, transitions: null };
}
function oj(a, b, c) {
  var d = b.pendingProps, e = L.current, f2 = false, g = 0 !== (b.flags & 128), h;
  (h = g) || (h = null !== a && null === a.memoizedState ? false : 0 !== (e & 2));
  if (h) f2 = true, b.flags &= -129;
  else if (null === a || null !== a.memoizedState) e |= 1;
  G(L, e & 1);
  if (null === a) {
    Eg(b);
    a = b.memoizedState;
    if (null !== a && (a = a.dehydrated, null !== a)) return 0 === (b.mode & 1) ? b.lanes = 1 : "$!" === a.data ? b.lanes = 8 : b.lanes = 1073741824, null;
    g = d.children;
    a = d.fallback;
    return f2 ? (d = b.mode, f2 = b.child, g = { mode: "hidden", children: g }, 0 === (d & 1) && null !== f2 ? (f2.childLanes = 0, f2.pendingProps = g) : f2 = pj(g, d, 0, null), a = Tg(a, d, c, null), f2.return = b, a.return = b, f2.sibling = a, b.child = f2, b.child.memoizedState = nj(c), b.memoizedState = mj, a) : qj(b, g);
  }
  e = a.memoizedState;
  if (null !== e && (h = e.dehydrated, null !== h)) return rj(a, b, g, d, h, e, c);
  if (f2) {
    f2 = d.fallback;
    g = b.mode;
    e = a.child;
    h = e.sibling;
    var k2 = { mode: "hidden", children: d.children };
    0 === (g & 1) && b.child !== e ? (d = b.child, d.childLanes = 0, d.pendingProps = k2, b.deletions = null) : (d = Pg(e, k2), d.subtreeFlags = e.subtreeFlags & 14680064);
    null !== h ? f2 = Pg(h, f2) : (f2 = Tg(f2, g, c, null), f2.flags |= 2);
    f2.return = b;
    d.return = b;
    d.sibling = f2;
    b.child = d;
    d = f2;
    f2 = b.child;
    g = a.child.memoizedState;
    g = null === g ? nj(c) : { baseLanes: g.baseLanes | c, cachePool: null, transitions: g.transitions };
    f2.memoizedState = g;
    f2.childLanes = a.childLanes & ~c;
    b.memoizedState = mj;
    return d;
  }
  f2 = a.child;
  a = f2.sibling;
  d = Pg(f2, { mode: "visible", children: d.children });
  0 === (b.mode & 1) && (d.lanes = c);
  d.return = b;
  d.sibling = null;
  null !== a && (c = b.deletions, null === c ? (b.deletions = [a], b.flags |= 16) : c.push(a));
  b.child = d;
  b.memoizedState = null;
  return d;
}
function qj(a, b) {
  b = pj({ mode: "visible", children: b }, a.mode, 0, null);
  b.return = a;
  return a.child = b;
}
function sj(a, b, c, d) {
  null !== d && Jg(d);
  Ug(b, a.child, null, c);
  a = qj(b, b.pendingProps.children);
  a.flags |= 2;
  b.memoizedState = null;
  return a;
}
function rj(a, b, c, d, e, f2, g) {
  if (c) {
    if (b.flags & 256) return b.flags &= -257, d = Ki(Error(p(422))), sj(a, b, g, d);
    if (null !== b.memoizedState) return b.child = a.child, b.flags |= 128, null;
    f2 = d.fallback;
    e = b.mode;
    d = pj({ mode: "visible", children: d.children }, e, 0, null);
    f2 = Tg(f2, e, g, null);
    f2.flags |= 2;
    d.return = b;
    f2.return = b;
    d.sibling = f2;
    b.child = d;
    0 !== (b.mode & 1) && Ug(b, a.child, null, g);
    b.child.memoizedState = nj(g);
    b.memoizedState = mj;
    return f2;
  }
  if (0 === (b.mode & 1)) return sj(a, b, g, null);
  if ("$!" === e.data) {
    d = e.nextSibling && e.nextSibling.dataset;
    if (d) var h = d.dgst;
    d = h;
    f2 = Error(p(419));
    d = Ki(f2, d, void 0);
    return sj(a, b, g, d);
  }
  h = 0 !== (g & a.childLanes);
  if (dh || h) {
    d = Q;
    if (null !== d) {
      switch (g & -g) {
        case 4:
          e = 2;
          break;
        case 16:
          e = 8;
          break;
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
          e = 32;
          break;
        case 536870912:
          e = 268435456;
          break;
        default:
          e = 0;
      }
      e = 0 !== (e & (d.suspendedLanes | g)) ? 0 : e;
      0 !== e && e !== f2.retryLane && (f2.retryLane = e, ih(a, e), gi(d, a, e, -1));
    }
    tj();
    d = Ki(Error(p(421)));
    return sj(a, b, g, d);
  }
  if ("$?" === e.data) return b.flags |= 128, b.child = a.child, b = uj.bind(null, a), e._reactRetry = b, null;
  a = f2.treeContext;
  yg = Lf(e.nextSibling);
  xg = b;
  I = true;
  zg = null;
  null !== a && (og[pg++] = rg, og[pg++] = sg, og[pg++] = qg, rg = a.id, sg = a.overflow, qg = b);
  b = qj(b, d.children);
  b.flags |= 4096;
  return b;
}
function vj(a, b, c) {
  a.lanes |= b;
  var d = a.alternate;
  null !== d && (d.lanes |= b);
  bh(a.return, b, c);
}
function wj(a, b, c, d, e) {
  var f2 = a.memoizedState;
  null === f2 ? a.memoizedState = { isBackwards: b, rendering: null, renderingStartTime: 0, last: d, tail: c, tailMode: e } : (f2.isBackwards = b, f2.rendering = null, f2.renderingStartTime = 0, f2.last = d, f2.tail = c, f2.tailMode = e);
}
function xj(a, b, c) {
  var d = b.pendingProps, e = d.revealOrder, f2 = d.tail;
  Xi(a, b, d.children, c);
  d = L.current;
  if (0 !== (d & 2)) d = d & 1 | 2, b.flags |= 128;
  else {
    if (null !== a && 0 !== (a.flags & 128)) a: for (a = b.child; null !== a; ) {
      if (13 === a.tag) null !== a.memoizedState && vj(a, c, b);
      else if (19 === a.tag) vj(a, c, b);
      else if (null !== a.child) {
        a.child.return = a;
        a = a.child;
        continue;
      }
      if (a === b) break a;
      for (; null === a.sibling; ) {
        if (null === a.return || a.return === b) break a;
        a = a.return;
      }
      a.sibling.return = a.return;
      a = a.sibling;
    }
    d &= 1;
  }
  G(L, d);
  if (0 === (b.mode & 1)) b.memoizedState = null;
  else switch (e) {
    case "forwards":
      c = b.child;
      for (e = null; null !== c; ) a = c.alternate, null !== a && null === Ch(a) && (e = c), c = c.sibling;
      c = e;
      null === c ? (e = b.child, b.child = null) : (e = c.sibling, c.sibling = null);
      wj(b, false, e, c, f2);
      break;
    case "backwards":
      c = null;
      e = b.child;
      for (b.child = null; null !== e; ) {
        a = e.alternate;
        if (null !== a && null === Ch(a)) {
          b.child = e;
          break;
        }
        a = e.sibling;
        e.sibling = c;
        c = e;
        e = a;
      }
      wj(b, true, c, null, f2);
      break;
    case "together":
      wj(b, false, null, null, void 0);
      break;
    default:
      b.memoizedState = null;
  }
  return b.child;
}
function ij(a, b) {
  0 === (b.mode & 1) && null !== a && (a.alternate = null, b.alternate = null, b.flags |= 2);
}
function Zi(a, b, c) {
  null !== a && (b.dependencies = a.dependencies);
  rh |= b.lanes;
  if (0 === (c & b.childLanes)) return null;
  if (null !== a && b.child !== a.child) throw Error(p(153));
  if (null !== b.child) {
    a = b.child;
    c = Pg(a, a.pendingProps);
    b.child = c;
    for (c.return = b; null !== a.sibling; ) a = a.sibling, c = c.sibling = Pg(a, a.pendingProps), c.return = b;
    c.sibling = null;
  }
  return b.child;
}
function yj(a, b, c) {
  switch (b.tag) {
    case 3:
      kj(b);
      Ig();
      break;
    case 5:
      Ah(b);
      break;
    case 1:
      Zf(b.type) && cg(b);
      break;
    case 4:
      yh(b, b.stateNode.containerInfo);
      break;
    case 10:
      var d = b.type._context, e = b.memoizedProps.value;
      G(Wg, d._currentValue);
      d._currentValue = e;
      break;
    case 13:
      d = b.memoizedState;
      if (null !== d) {
        if (null !== d.dehydrated) return G(L, L.current & 1), b.flags |= 128, null;
        if (0 !== (c & b.child.childLanes)) return oj(a, b, c);
        G(L, L.current & 1);
        a = Zi(a, b, c);
        return null !== a ? a.sibling : null;
      }
      G(L, L.current & 1);
      break;
    case 19:
      d = 0 !== (c & b.childLanes);
      if (0 !== (a.flags & 128)) {
        if (d) return xj(a, b, c);
        b.flags |= 128;
      }
      e = b.memoizedState;
      null !== e && (e.rendering = null, e.tail = null, e.lastEffect = null);
      G(L, L.current);
      if (d) break;
      else return null;
    case 22:
    case 23:
      return b.lanes = 0, dj(a, b, c);
  }
  return Zi(a, b, c);
}
var zj, Aj, Bj, Cj;
zj = function(a, b) {
  for (var c = b.child; null !== c; ) {
    if (5 === c.tag || 6 === c.tag) a.appendChild(c.stateNode);
    else if (4 !== c.tag && null !== c.child) {
      c.child.return = c;
      c = c.child;
      continue;
    }
    if (c === b) break;
    for (; null === c.sibling; ) {
      if (null === c.return || c.return === b) return;
      c = c.return;
    }
    c.sibling.return = c.return;
    c = c.sibling;
  }
};
Aj = function() {
};
Bj = function(a, b, c, d) {
  var e = a.memoizedProps;
  if (e !== d) {
    a = b.stateNode;
    xh(uh.current);
    var f2 = null;
    switch (c) {
      case "input":
        e = Ya(a, e);
        d = Ya(a, d);
        f2 = [];
        break;
      case "select":
        e = A({}, e, { value: void 0 });
        d = A({}, d, { value: void 0 });
        f2 = [];
        break;
      case "textarea":
        e = gb(a, e);
        d = gb(a, d);
        f2 = [];
        break;
      default:
        "function" !== typeof e.onClick && "function" === typeof d.onClick && (a.onclick = Bf);
    }
    ub(c, d);
    var g;
    c = null;
    for (l2 in e) if (!d.hasOwnProperty(l2) && e.hasOwnProperty(l2) && null != e[l2]) if ("style" === l2) {
      var h = e[l2];
      for (g in h) h.hasOwnProperty(g) && (c || (c = {}), c[g] = "");
    } else "dangerouslySetInnerHTML" !== l2 && "children" !== l2 && "suppressContentEditableWarning" !== l2 && "suppressHydrationWarning" !== l2 && "autoFocus" !== l2 && (ea.hasOwnProperty(l2) ? f2 || (f2 = []) : (f2 = f2 || []).push(l2, null));
    for (l2 in d) {
      var k2 = d[l2];
      h = null != e ? e[l2] : void 0;
      if (d.hasOwnProperty(l2) && k2 !== h && (null != k2 || null != h)) if ("style" === l2) if (h) {
        for (g in h) !h.hasOwnProperty(g) || k2 && k2.hasOwnProperty(g) || (c || (c = {}), c[g] = "");
        for (g in k2) k2.hasOwnProperty(g) && h[g] !== k2[g] && (c || (c = {}), c[g] = k2[g]);
      } else c || (f2 || (f2 = []), f2.push(
        l2,
        c
      )), c = k2;
      else "dangerouslySetInnerHTML" === l2 ? (k2 = k2 ? k2.__html : void 0, h = h ? h.__html : void 0, null != k2 && h !== k2 && (f2 = f2 || []).push(l2, k2)) : "children" === l2 ? "string" !== typeof k2 && "number" !== typeof k2 || (f2 = f2 || []).push(l2, "" + k2) : "suppressContentEditableWarning" !== l2 && "suppressHydrationWarning" !== l2 && (ea.hasOwnProperty(l2) ? (null != k2 && "onScroll" === l2 && D("scroll", a), f2 || h === k2 || (f2 = [])) : (f2 = f2 || []).push(l2, k2));
    }
    c && (f2 = f2 || []).push("style", c);
    var l2 = f2;
    if (b.updateQueue = l2) b.flags |= 4;
  }
};
Cj = function(a, b, c, d) {
  c !== d && (b.flags |= 4);
};
function Dj(a, b) {
  if (!I) switch (a.tailMode) {
    case "hidden":
      b = a.tail;
      for (var c = null; null !== b; ) null !== b.alternate && (c = b), b = b.sibling;
      null === c ? a.tail = null : c.sibling = null;
      break;
    case "collapsed":
      c = a.tail;
      for (var d = null; null !== c; ) null !== c.alternate && (d = c), c = c.sibling;
      null === d ? b || null === a.tail ? a.tail = null : a.tail.sibling = null : d.sibling = null;
  }
}
function S(a) {
  var b = null !== a.alternate && a.alternate.child === a.child, c = 0, d = 0;
  if (b) for (var e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags & 14680064, d |= e.flags & 14680064, e.return = a, e = e.sibling;
  else for (e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags, d |= e.flags, e.return = a, e = e.sibling;
  a.subtreeFlags |= d;
  a.childLanes = c;
  return b;
}
function Ej(a, b, c) {
  var d = b.pendingProps;
  wg(b);
  switch (b.tag) {
    case 2:
    case 16:
    case 15:
    case 0:
    case 11:
    case 7:
    case 8:
    case 12:
    case 9:
    case 14:
      return S(b), null;
    case 1:
      return Zf(b.type) && $f(), S(b), null;
    case 3:
      d = b.stateNode;
      zh();
      E(Wf);
      E(H);
      Eh();
      d.pendingContext && (d.context = d.pendingContext, d.pendingContext = null);
      if (null === a || null === a.child) Gg(b) ? b.flags |= 4 : null === a || a.memoizedState.isDehydrated && 0 === (b.flags & 256) || (b.flags |= 1024, null !== zg && (Fj(zg), zg = null));
      Aj(a, b);
      S(b);
      return null;
    case 5:
      Bh(b);
      var e = xh(wh.current);
      c = b.type;
      if (null !== a && null != b.stateNode) Bj(a, b, c, d, e), a.ref !== b.ref && (b.flags |= 512, b.flags |= 2097152);
      else {
        if (!d) {
          if (null === b.stateNode) throw Error(p(166));
          S(b);
          return null;
        }
        a = xh(uh.current);
        if (Gg(b)) {
          d = b.stateNode;
          c = b.type;
          var f2 = b.memoizedProps;
          d[Of] = b;
          d[Pf] = f2;
          a = 0 !== (b.mode & 1);
          switch (c) {
            case "dialog":
              D("cancel", d);
              D("close", d);
              break;
            case "iframe":
            case "object":
            case "embed":
              D("load", d);
              break;
            case "video":
            case "audio":
              for (e = 0; e < lf.length; e++) D(lf[e], d);
              break;
            case "source":
              D("error", d);
              break;
            case "img":
            case "image":
            case "link":
              D(
                "error",
                d
              );
              D("load", d);
              break;
            case "details":
              D("toggle", d);
              break;
            case "input":
              Za(d, f2);
              D("invalid", d);
              break;
            case "select":
              d._wrapperState = { wasMultiple: !!f2.multiple };
              D("invalid", d);
              break;
            case "textarea":
              hb(d, f2), D("invalid", d);
          }
          ub(c, f2);
          e = null;
          for (var g in f2) if (f2.hasOwnProperty(g)) {
            var h = f2[g];
            "children" === g ? "string" === typeof h ? d.textContent !== h && (true !== f2.suppressHydrationWarning && Af(d.textContent, h, a), e = ["children", h]) : "number" === typeof h && d.textContent !== "" + h && (true !== f2.suppressHydrationWarning && Af(
              d.textContent,
              h,
              a
            ), e = ["children", "" + h]) : ea.hasOwnProperty(g) && null != h && "onScroll" === g && D("scroll", d);
          }
          switch (c) {
            case "input":
              Va(d);
              db(d, f2, true);
              break;
            case "textarea":
              Va(d);
              jb(d);
              break;
            case "select":
            case "option":
              break;
            default:
              "function" === typeof f2.onClick && (d.onclick = Bf);
          }
          d = e;
          b.updateQueue = d;
          null !== d && (b.flags |= 4);
        } else {
          g = 9 === e.nodeType ? e : e.ownerDocument;
          "http://www.w3.org/1999/xhtml" === a && (a = kb(c));
          "http://www.w3.org/1999/xhtml" === a ? "script" === c ? (a = g.createElement("div"), a.innerHTML = "<script><\/script>", a = a.removeChild(a.firstChild)) : "string" === typeof d.is ? a = g.createElement(c, { is: d.is }) : (a = g.createElement(c), "select" === c && (g = a, d.multiple ? g.multiple = true : d.size && (g.size = d.size))) : a = g.createElementNS(a, c);
          a[Of] = b;
          a[Pf] = d;
          zj(a, b, false, false);
          b.stateNode = a;
          a: {
            g = vb(c, d);
            switch (c) {
              case "dialog":
                D("cancel", a);
                D("close", a);
                e = d;
                break;
              case "iframe":
              case "object":
              case "embed":
                D("load", a);
                e = d;
                break;
              case "video":
              case "audio":
                for (e = 0; e < lf.length; e++) D(lf[e], a);
                e = d;
                break;
              case "source":
                D("error", a);
                e = d;
                break;
              case "img":
              case "image":
              case "link":
                D(
                  "error",
                  a
                );
                D("load", a);
                e = d;
                break;
              case "details":
                D("toggle", a);
                e = d;
                break;
              case "input":
                Za(a, d);
                e = Ya(a, d);
                D("invalid", a);
                break;
              case "option":
                e = d;
                break;
              case "select":
                a._wrapperState = { wasMultiple: !!d.multiple };
                e = A({}, d, { value: void 0 });
                D("invalid", a);
                break;
              case "textarea":
                hb(a, d);
                e = gb(a, d);
                D("invalid", a);
                break;
              default:
                e = d;
            }
            ub(c, e);
            h = e;
            for (f2 in h) if (h.hasOwnProperty(f2)) {
              var k2 = h[f2];
              "style" === f2 ? sb(a, k2) : "dangerouslySetInnerHTML" === f2 ? (k2 = k2 ? k2.__html : void 0, null != k2 && nb(a, k2)) : "children" === f2 ? "string" === typeof k2 ? ("textarea" !== c || "" !== k2) && ob(a, k2) : "number" === typeof k2 && ob(a, "" + k2) : "suppressContentEditableWarning" !== f2 && "suppressHydrationWarning" !== f2 && "autoFocus" !== f2 && (ea.hasOwnProperty(f2) ? null != k2 && "onScroll" === f2 && D("scroll", a) : null != k2 && ta(a, f2, k2, g));
            }
            switch (c) {
              case "input":
                Va(a);
                db(a, d, false);
                break;
              case "textarea":
                Va(a);
                jb(a);
                break;
              case "option":
                null != d.value && a.setAttribute("value", "" + Sa(d.value));
                break;
              case "select":
                a.multiple = !!d.multiple;
                f2 = d.value;
                null != f2 ? fb(a, !!d.multiple, f2, false) : null != d.defaultValue && fb(
                  a,
                  !!d.multiple,
                  d.defaultValue,
                  true
                );
                break;
              default:
                "function" === typeof e.onClick && (a.onclick = Bf);
            }
            switch (c) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                d = !!d.autoFocus;
                break a;
              case "img":
                d = true;
                break a;
              default:
                d = false;
            }
          }
          d && (b.flags |= 4);
        }
        null !== b.ref && (b.flags |= 512, b.flags |= 2097152);
      }
      S(b);
      return null;
    case 6:
      if (a && null != b.stateNode) Cj(a, b, a.memoizedProps, d);
      else {
        if ("string" !== typeof d && null === b.stateNode) throw Error(p(166));
        c = xh(wh.current);
        xh(uh.current);
        if (Gg(b)) {
          d = b.stateNode;
          c = b.memoizedProps;
          d[Of] = b;
          if (f2 = d.nodeValue !== c) {
            if (a = xg, null !== a) switch (a.tag) {
              case 3:
                Af(d.nodeValue, c, 0 !== (a.mode & 1));
                break;
              case 5:
                true !== a.memoizedProps.suppressHydrationWarning && Af(d.nodeValue, c, 0 !== (a.mode & 1));
            }
          }
          f2 && (b.flags |= 4);
        } else d = (9 === c.nodeType ? c : c.ownerDocument).createTextNode(d), d[Of] = b, b.stateNode = d;
      }
      S(b);
      return null;
    case 13:
      E(L);
      d = b.memoizedState;
      if (null === a || null !== a.memoizedState && null !== a.memoizedState.dehydrated) {
        if (I && null !== yg && 0 !== (b.mode & 1) && 0 === (b.flags & 128)) Hg(), Ig(), b.flags |= 98560, f2 = false;
        else if (f2 = Gg(b), null !== d && null !== d.dehydrated) {
          if (null === a) {
            if (!f2) throw Error(p(318));
            f2 = b.memoizedState;
            f2 = null !== f2 ? f2.dehydrated : null;
            if (!f2) throw Error(p(317));
            f2[Of] = b;
          } else Ig(), 0 === (b.flags & 128) && (b.memoizedState = null), b.flags |= 4;
          S(b);
          f2 = false;
        } else null !== zg && (Fj(zg), zg = null), f2 = true;
        if (!f2) return b.flags & 65536 ? b : null;
      }
      if (0 !== (b.flags & 128)) return b.lanes = c, b;
      d = null !== d;
      d !== (null !== a && null !== a.memoizedState) && d && (b.child.flags |= 8192, 0 !== (b.mode & 1) && (null === a || 0 !== (L.current & 1) ? 0 === T && (T = 3) : tj()));
      null !== b.updateQueue && (b.flags |= 4);
      S(b);
      return null;
    case 4:
      return zh(), Aj(a, b), null === a && sf(b.stateNode.containerInfo), S(b), null;
    case 10:
      return ah(b.type._context), S(b), null;
    case 17:
      return Zf(b.type) && $f(), S(b), null;
    case 19:
      E(L);
      f2 = b.memoizedState;
      if (null === f2) return S(b), null;
      d = 0 !== (b.flags & 128);
      g = f2.rendering;
      if (null === g) if (d) Dj(f2, false);
      else {
        if (0 !== T || null !== a && 0 !== (a.flags & 128)) for (a = b.child; null !== a; ) {
          g = Ch(a);
          if (null !== g) {
            b.flags |= 128;
            Dj(f2, false);
            d = g.updateQueue;
            null !== d && (b.updateQueue = d, b.flags |= 4);
            b.subtreeFlags = 0;
            d = c;
            for (c = b.child; null !== c; ) f2 = c, a = d, f2.flags &= 14680066, g = f2.alternate, null === g ? (f2.childLanes = 0, f2.lanes = a, f2.child = null, f2.subtreeFlags = 0, f2.memoizedProps = null, f2.memoizedState = null, f2.updateQueue = null, f2.dependencies = null, f2.stateNode = null) : (f2.childLanes = g.childLanes, f2.lanes = g.lanes, f2.child = g.child, f2.subtreeFlags = 0, f2.deletions = null, f2.memoizedProps = g.memoizedProps, f2.memoizedState = g.memoizedState, f2.updateQueue = g.updateQueue, f2.type = g.type, a = g.dependencies, f2.dependencies = null === a ? null : { lanes: a.lanes, firstContext: a.firstContext }), c = c.sibling;
            G(L, L.current & 1 | 2);
            return b.child;
          }
          a = a.sibling;
        }
        null !== f2.tail && B() > Gj && (b.flags |= 128, d = true, Dj(f2, false), b.lanes = 4194304);
      }
      else {
        if (!d) if (a = Ch(g), null !== a) {
          if (b.flags |= 128, d = true, c = a.updateQueue, null !== c && (b.updateQueue = c, b.flags |= 4), Dj(f2, true), null === f2.tail && "hidden" === f2.tailMode && !g.alternate && !I) return S(b), null;
        } else 2 * B() - f2.renderingStartTime > Gj && 1073741824 !== c && (b.flags |= 128, d = true, Dj(f2, false), b.lanes = 4194304);
        f2.isBackwards ? (g.sibling = b.child, b.child = g) : (c = f2.last, null !== c ? c.sibling = g : b.child = g, f2.last = g);
      }
      if (null !== f2.tail) return b = f2.tail, f2.rendering = b, f2.tail = b.sibling, f2.renderingStartTime = B(), b.sibling = null, c = L.current, G(L, d ? c & 1 | 2 : c & 1), b;
      S(b);
      return null;
    case 22:
    case 23:
      return Hj(), d = null !== b.memoizedState, null !== a && null !== a.memoizedState !== d && (b.flags |= 8192), d && 0 !== (b.mode & 1) ? 0 !== (fj & 1073741824) && (S(b), b.subtreeFlags & 6 && (b.flags |= 8192)) : S(b), null;
    case 24:
      return null;
    case 25:
      return null;
  }
  throw Error(p(156, b.tag));
}
function Ij(a, b) {
  wg(b);
  switch (b.tag) {
    case 1:
      return Zf(b.type) && $f(), a = b.flags, a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
    case 3:
      return zh(), E(Wf), E(H), Eh(), a = b.flags, 0 !== (a & 65536) && 0 === (a & 128) ? (b.flags = a & -65537 | 128, b) : null;
    case 5:
      return Bh(b), null;
    case 13:
      E(L);
      a = b.memoizedState;
      if (null !== a && null !== a.dehydrated) {
        if (null === b.alternate) throw Error(p(340));
        Ig();
      }
      a = b.flags;
      return a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
    case 19:
      return E(L), null;
    case 4:
      return zh(), null;
    case 10:
      return ah(b.type._context), null;
    case 22:
    case 23:
      return Hj(), null;
    case 24:
      return null;
    default:
      return null;
  }
}
var Jj = false, U = false, Kj = "function" === typeof WeakSet ? WeakSet : Set, V = null;
function Lj(a, b) {
  var c = a.ref;
  if (null !== c) if ("function" === typeof c) try {
    c(null);
  } catch (d) {
    W(a, b, d);
  }
  else c.current = null;
}
function Mj(a, b, c) {
  try {
    c();
  } catch (d) {
    W(a, b, d);
  }
}
var Nj = false;
function Oj(a, b) {
  Cf = dd;
  a = Me();
  if (Ne(a)) {
    if ("selectionStart" in a) var c = { start: a.selectionStart, end: a.selectionEnd };
    else a: {
      c = (c = a.ownerDocument) && c.defaultView || window;
      var d = c.getSelection && c.getSelection();
      if (d && 0 !== d.rangeCount) {
        c = d.anchorNode;
        var e = d.anchorOffset, f2 = d.focusNode;
        d = d.focusOffset;
        try {
          c.nodeType, f2.nodeType;
        } catch (F2) {
          c = null;
          break a;
        }
        var g = 0, h = -1, k2 = -1, l2 = 0, m2 = 0, q2 = a, r2 = null;
        b: for (; ; ) {
          for (var y2; ; ) {
            q2 !== c || 0 !== e && 3 !== q2.nodeType || (h = g + e);
            q2 !== f2 || 0 !== d && 3 !== q2.nodeType || (k2 = g + d);
            3 === q2.nodeType && (g += q2.nodeValue.length);
            if (null === (y2 = q2.firstChild)) break;
            r2 = q2;
            q2 = y2;
          }
          for (; ; ) {
            if (q2 === a) break b;
            r2 === c && ++l2 === e && (h = g);
            r2 === f2 && ++m2 === d && (k2 = g);
            if (null !== (y2 = q2.nextSibling)) break;
            q2 = r2;
            r2 = q2.parentNode;
          }
          q2 = y2;
        }
        c = -1 === h || -1 === k2 ? null : { start: h, end: k2 };
      } else c = null;
    }
    c = c || { start: 0, end: 0 };
  } else c = null;
  Df = { focusedElem: a, selectionRange: c };
  dd = false;
  for (V = b; null !== V; ) if (b = V, a = b.child, 0 !== (b.subtreeFlags & 1028) && null !== a) a.return = b, V = a;
  else for (; null !== V; ) {
    b = V;
    try {
      var n2 = b.alternate;
      if (0 !== (b.flags & 1024)) switch (b.tag) {
        case 0:
        case 11:
        case 15:
          break;
        case 1:
          if (null !== n2) {
            var t2 = n2.memoizedProps, J2 = n2.memoizedState, x2 = b.stateNode, w2 = x2.getSnapshotBeforeUpdate(b.elementType === b.type ? t2 : Ci(b.type, t2), J2);
            x2.__reactInternalSnapshotBeforeUpdate = w2;
          }
          break;
        case 3:
          var u2 = b.stateNode.containerInfo;
          1 === u2.nodeType ? u2.textContent = "" : 9 === u2.nodeType && u2.documentElement && u2.removeChild(u2.documentElement);
          break;
        case 5:
        case 6:
        case 4:
        case 17:
          break;
        default:
          throw Error(p(163));
      }
    } catch (F2) {
      W(b, b.return, F2);
    }
    a = b.sibling;
    if (null !== a) {
      a.return = b.return;
      V = a;
      break;
    }
    V = b.return;
  }
  n2 = Nj;
  Nj = false;
  return n2;
}
function Pj(a, b, c) {
  var d = b.updateQueue;
  d = null !== d ? d.lastEffect : null;
  if (null !== d) {
    var e = d = d.next;
    do {
      if ((e.tag & a) === a) {
        var f2 = e.destroy;
        e.destroy = void 0;
        void 0 !== f2 && Mj(b, c, f2);
      }
      e = e.next;
    } while (e !== d);
  }
}
function Qj(a, b) {
  b = b.updateQueue;
  b = null !== b ? b.lastEffect : null;
  if (null !== b) {
    var c = b = b.next;
    do {
      if ((c.tag & a) === a) {
        var d = c.create;
        c.destroy = d();
      }
      c = c.next;
    } while (c !== b);
  }
}
function Rj(a) {
  var b = a.ref;
  if (null !== b) {
    var c = a.stateNode;
    switch (a.tag) {
      case 5:
        a = c;
        break;
      default:
        a = c;
    }
    "function" === typeof b ? b(a) : b.current = a;
  }
}
function Sj(a) {
  var b = a.alternate;
  null !== b && (a.alternate = null, Sj(b));
  a.child = null;
  a.deletions = null;
  a.sibling = null;
  5 === a.tag && (b = a.stateNode, null !== b && (delete b[Of], delete b[Pf], delete b[of], delete b[Qf], delete b[Rf]));
  a.stateNode = null;
  a.return = null;
  a.dependencies = null;
  a.memoizedProps = null;
  a.memoizedState = null;
  a.pendingProps = null;
  a.stateNode = null;
  a.updateQueue = null;
}
function Tj(a) {
  return 5 === a.tag || 3 === a.tag || 4 === a.tag;
}
function Uj(a) {
  a: for (; ; ) {
    for (; null === a.sibling; ) {
      if (null === a.return || Tj(a.return)) return null;
      a = a.return;
    }
    a.sibling.return = a.return;
    for (a = a.sibling; 5 !== a.tag && 6 !== a.tag && 18 !== a.tag; ) {
      if (a.flags & 2) continue a;
      if (null === a.child || 4 === a.tag) continue a;
      else a.child.return = a, a = a.child;
    }
    if (!(a.flags & 2)) return a.stateNode;
  }
}
function Vj(a, b, c) {
  var d = a.tag;
  if (5 === d || 6 === d) a = a.stateNode, b ? 8 === c.nodeType ? c.parentNode.insertBefore(a, b) : c.insertBefore(a, b) : (8 === c.nodeType ? (b = c.parentNode, b.insertBefore(a, c)) : (b = c, b.appendChild(a)), c = c._reactRootContainer, null !== c && void 0 !== c || null !== b.onclick || (b.onclick = Bf));
  else if (4 !== d && (a = a.child, null !== a)) for (Vj(a, b, c), a = a.sibling; null !== a; ) Vj(a, b, c), a = a.sibling;
}
function Wj(a, b, c) {
  var d = a.tag;
  if (5 === d || 6 === d) a = a.stateNode, b ? c.insertBefore(a, b) : c.appendChild(a);
  else if (4 !== d && (a = a.child, null !== a)) for (Wj(a, b, c), a = a.sibling; null !== a; ) Wj(a, b, c), a = a.sibling;
}
var X = null, Xj = false;
function Yj(a, b, c) {
  for (c = c.child; null !== c; ) Zj(a, b, c), c = c.sibling;
}
function Zj(a, b, c) {
  if (lc && "function" === typeof lc.onCommitFiberUnmount) try {
    lc.onCommitFiberUnmount(kc, c);
  } catch (h) {
  }
  switch (c.tag) {
    case 5:
      U || Lj(c, b);
    case 6:
      var d = X, e = Xj;
      X = null;
      Yj(a, b, c);
      X = d;
      Xj = e;
      null !== X && (Xj ? (a = X, c = c.stateNode, 8 === a.nodeType ? a.parentNode.removeChild(c) : a.removeChild(c)) : X.removeChild(c.stateNode));
      break;
    case 18:
      null !== X && (Xj ? (a = X, c = c.stateNode, 8 === a.nodeType ? Kf(a.parentNode, c) : 1 === a.nodeType && Kf(a, c), bd(a)) : Kf(X, c.stateNode));
      break;
    case 4:
      d = X;
      e = Xj;
      X = c.stateNode.containerInfo;
      Xj = true;
      Yj(a, b, c);
      X = d;
      Xj = e;
      break;
    case 0:
    case 11:
    case 14:
    case 15:
      if (!U && (d = c.updateQueue, null !== d && (d = d.lastEffect, null !== d))) {
        e = d = d.next;
        do {
          var f2 = e, g = f2.destroy;
          f2 = f2.tag;
          void 0 !== g && (0 !== (f2 & 2) ? Mj(c, b, g) : 0 !== (f2 & 4) && Mj(c, b, g));
          e = e.next;
        } while (e !== d);
      }
      Yj(a, b, c);
      break;
    case 1:
      if (!U && (Lj(c, b), d = c.stateNode, "function" === typeof d.componentWillUnmount)) try {
        d.props = c.memoizedProps, d.state = c.memoizedState, d.componentWillUnmount();
      } catch (h) {
        W(c, b, h);
      }
      Yj(a, b, c);
      break;
    case 21:
      Yj(a, b, c);
      break;
    case 22:
      c.mode & 1 ? (U = (d = U) || null !== c.memoizedState, Yj(a, b, c), U = d) : Yj(a, b, c);
      break;
    default:
      Yj(a, b, c);
  }
}
function ak(a) {
  var b = a.updateQueue;
  if (null !== b) {
    a.updateQueue = null;
    var c = a.stateNode;
    null === c && (c = a.stateNode = new Kj());
    b.forEach(function(b2) {
      var d = bk.bind(null, a, b2);
      c.has(b2) || (c.add(b2), b2.then(d, d));
    });
  }
}
function ck(a, b) {
  var c = b.deletions;
  if (null !== c) for (var d = 0; d < c.length; d++) {
    var e = c[d];
    try {
      var f2 = a, g = b, h = g;
      a: for (; null !== h; ) {
        switch (h.tag) {
          case 5:
            X = h.stateNode;
            Xj = false;
            break a;
          case 3:
            X = h.stateNode.containerInfo;
            Xj = true;
            break a;
          case 4:
            X = h.stateNode.containerInfo;
            Xj = true;
            break a;
        }
        h = h.return;
      }
      if (null === X) throw Error(p(160));
      Zj(f2, g, e);
      X = null;
      Xj = false;
      var k2 = e.alternate;
      null !== k2 && (k2.return = null);
      e.return = null;
    } catch (l2) {
      W(e, b, l2);
    }
  }
  if (b.subtreeFlags & 12854) for (b = b.child; null !== b; ) dk(b, a), b = b.sibling;
}
function dk(a, b) {
  var c = a.alternate, d = a.flags;
  switch (a.tag) {
    case 0:
    case 11:
    case 14:
    case 15:
      ck(b, a);
      ek(a);
      if (d & 4) {
        try {
          Pj(3, a, a.return), Qj(3, a);
        } catch (t2) {
          W(a, a.return, t2);
        }
        try {
          Pj(5, a, a.return);
        } catch (t2) {
          W(a, a.return, t2);
        }
      }
      break;
    case 1:
      ck(b, a);
      ek(a);
      d & 512 && null !== c && Lj(c, c.return);
      break;
    case 5:
      ck(b, a);
      ek(a);
      d & 512 && null !== c && Lj(c, c.return);
      if (a.flags & 32) {
        var e = a.stateNode;
        try {
          ob(e, "");
        } catch (t2) {
          W(a, a.return, t2);
        }
      }
      if (d & 4 && (e = a.stateNode, null != e)) {
        var f2 = a.memoizedProps, g = null !== c ? c.memoizedProps : f2, h = a.type, k2 = a.updateQueue;
        a.updateQueue = null;
        if (null !== k2) try {
          "input" === h && "radio" === f2.type && null != f2.name && ab(e, f2);
          vb(h, g);
          var l2 = vb(h, f2);
          for (g = 0; g < k2.length; g += 2) {
            var m2 = k2[g], q2 = k2[g + 1];
            "style" === m2 ? sb(e, q2) : "dangerouslySetInnerHTML" === m2 ? nb(e, q2) : "children" === m2 ? ob(e, q2) : ta(e, m2, q2, l2);
          }
          switch (h) {
            case "input":
              bb(e, f2);
              break;
            case "textarea":
              ib(e, f2);
              break;
            case "select":
              var r2 = e._wrapperState.wasMultiple;
              e._wrapperState.wasMultiple = !!f2.multiple;
              var y2 = f2.value;
              null != y2 ? fb(e, !!f2.multiple, y2, false) : r2 !== !!f2.multiple && (null != f2.defaultValue ? fb(
                e,
                !!f2.multiple,
                f2.defaultValue,
                true
              ) : fb(e, !!f2.multiple, f2.multiple ? [] : "", false));
          }
          e[Pf] = f2;
        } catch (t2) {
          W(a, a.return, t2);
        }
      }
      break;
    case 6:
      ck(b, a);
      ek(a);
      if (d & 4) {
        if (null === a.stateNode) throw Error(p(162));
        e = a.stateNode;
        f2 = a.memoizedProps;
        try {
          e.nodeValue = f2;
        } catch (t2) {
          W(a, a.return, t2);
        }
      }
      break;
    case 3:
      ck(b, a);
      ek(a);
      if (d & 4 && null !== c && c.memoizedState.isDehydrated) try {
        bd(b.containerInfo);
      } catch (t2) {
        W(a, a.return, t2);
      }
      break;
    case 4:
      ck(b, a);
      ek(a);
      break;
    case 13:
      ck(b, a);
      ek(a);
      e = a.child;
      e.flags & 8192 && (f2 = null !== e.memoizedState, e.stateNode.isHidden = f2, !f2 || null !== e.alternate && null !== e.alternate.memoizedState || (fk = B()));
      d & 4 && ak(a);
      break;
    case 22:
      m2 = null !== c && null !== c.memoizedState;
      a.mode & 1 ? (U = (l2 = U) || m2, ck(b, a), U = l2) : ck(b, a);
      ek(a);
      if (d & 8192) {
        l2 = null !== a.memoizedState;
        if ((a.stateNode.isHidden = l2) && !m2 && 0 !== (a.mode & 1)) for (V = a, m2 = a.child; null !== m2; ) {
          for (q2 = V = m2; null !== V; ) {
            r2 = V;
            y2 = r2.child;
            switch (r2.tag) {
              case 0:
              case 11:
              case 14:
              case 15:
                Pj(4, r2, r2.return);
                break;
              case 1:
                Lj(r2, r2.return);
                var n2 = r2.stateNode;
                if ("function" === typeof n2.componentWillUnmount) {
                  d = r2;
                  c = r2.return;
                  try {
                    b = d, n2.props = b.memoizedProps, n2.state = b.memoizedState, n2.componentWillUnmount();
                  } catch (t2) {
                    W(d, c, t2);
                  }
                }
                break;
              case 5:
                Lj(r2, r2.return);
                break;
              case 22:
                if (null !== r2.memoizedState) {
                  gk(q2);
                  continue;
                }
            }
            null !== y2 ? (y2.return = r2, V = y2) : gk(q2);
          }
          m2 = m2.sibling;
        }
        a: for (m2 = null, q2 = a; ; ) {
          if (5 === q2.tag) {
            if (null === m2) {
              m2 = q2;
              try {
                e = q2.stateNode, l2 ? (f2 = e.style, "function" === typeof f2.setProperty ? f2.setProperty("display", "none", "important") : f2.display = "none") : (h = q2.stateNode, k2 = q2.memoizedProps.style, g = void 0 !== k2 && null !== k2 && k2.hasOwnProperty("display") ? k2.display : null, h.style.display = rb("display", g));
              } catch (t2) {
                W(a, a.return, t2);
              }
            }
          } else if (6 === q2.tag) {
            if (null === m2) try {
              q2.stateNode.nodeValue = l2 ? "" : q2.memoizedProps;
            } catch (t2) {
              W(a, a.return, t2);
            }
          } else if ((22 !== q2.tag && 23 !== q2.tag || null === q2.memoizedState || q2 === a) && null !== q2.child) {
            q2.child.return = q2;
            q2 = q2.child;
            continue;
          }
          if (q2 === a) break a;
          for (; null === q2.sibling; ) {
            if (null === q2.return || q2.return === a) break a;
            m2 === q2 && (m2 = null);
            q2 = q2.return;
          }
          m2 === q2 && (m2 = null);
          q2.sibling.return = q2.return;
          q2 = q2.sibling;
        }
      }
      break;
    case 19:
      ck(b, a);
      ek(a);
      d & 4 && ak(a);
      break;
    case 21:
      break;
    default:
      ck(
        b,
        a
      ), ek(a);
  }
}
function ek(a) {
  var b = a.flags;
  if (b & 2) {
    try {
      a: {
        for (var c = a.return; null !== c; ) {
          if (Tj(c)) {
            var d = c;
            break a;
          }
          c = c.return;
        }
        throw Error(p(160));
      }
      switch (d.tag) {
        case 5:
          var e = d.stateNode;
          d.flags & 32 && (ob(e, ""), d.flags &= -33);
          var f2 = Uj(a);
          Wj(a, f2, e);
          break;
        case 3:
        case 4:
          var g = d.stateNode.containerInfo, h = Uj(a);
          Vj(a, h, g);
          break;
        default:
          throw Error(p(161));
      }
    } catch (k2) {
      W(a, a.return, k2);
    }
    a.flags &= -3;
  }
  b & 4096 && (a.flags &= -4097);
}
function hk(a, b, c) {
  V = a;
  ik(a);
}
function ik(a, b, c) {
  for (var d = 0 !== (a.mode & 1); null !== V; ) {
    var e = V, f2 = e.child;
    if (22 === e.tag && d) {
      var g = null !== e.memoizedState || Jj;
      if (!g) {
        var h = e.alternate, k2 = null !== h && null !== h.memoizedState || U;
        h = Jj;
        var l2 = U;
        Jj = g;
        if ((U = k2) && !l2) for (V = e; null !== V; ) g = V, k2 = g.child, 22 === g.tag && null !== g.memoizedState ? jk(e) : null !== k2 ? (k2.return = g, V = k2) : jk(e);
        for (; null !== f2; ) V = f2, ik(f2), f2 = f2.sibling;
        V = e;
        Jj = h;
        U = l2;
      }
      kk(a);
    } else 0 !== (e.subtreeFlags & 8772) && null !== f2 ? (f2.return = e, V = f2) : kk(a);
  }
}
function kk(a) {
  for (; null !== V; ) {
    var b = V;
    if (0 !== (b.flags & 8772)) {
      var c = b.alternate;
      try {
        if (0 !== (b.flags & 8772)) switch (b.tag) {
          case 0:
          case 11:
          case 15:
            U || Qj(5, b);
            break;
          case 1:
            var d = b.stateNode;
            if (b.flags & 4 && !U) if (null === c) d.componentDidMount();
            else {
              var e = b.elementType === b.type ? c.memoizedProps : Ci(b.type, c.memoizedProps);
              d.componentDidUpdate(e, c.memoizedState, d.__reactInternalSnapshotBeforeUpdate);
            }
            var f2 = b.updateQueue;
            null !== f2 && sh(b, f2, d);
            break;
          case 3:
            var g = b.updateQueue;
            if (null !== g) {
              c = null;
              if (null !== b.child) switch (b.child.tag) {
                case 5:
                  c = b.child.stateNode;
                  break;
                case 1:
                  c = b.child.stateNode;
              }
              sh(b, g, c);
            }
            break;
          case 5:
            var h = b.stateNode;
            if (null === c && b.flags & 4) {
              c = h;
              var k2 = b.memoizedProps;
              switch (b.type) {
                case "button":
                case "input":
                case "select":
                case "textarea":
                  k2.autoFocus && c.focus();
                  break;
                case "img":
                  k2.src && (c.src = k2.src);
              }
            }
            break;
          case 6:
            break;
          case 4:
            break;
          case 12:
            break;
          case 13:
            if (null === b.memoizedState) {
              var l2 = b.alternate;
              if (null !== l2) {
                var m2 = l2.memoizedState;
                if (null !== m2) {
                  var q2 = m2.dehydrated;
                  null !== q2 && bd(q2);
                }
              }
            }
            break;
          case 19:
          case 17:
          case 21:
          case 22:
          case 23:
          case 25:
            break;
          default:
            throw Error(p(163));
        }
        U || b.flags & 512 && Rj(b);
      } catch (r2) {
        W(b, b.return, r2);
      }
    }
    if (b === a) {
      V = null;
      break;
    }
    c = b.sibling;
    if (null !== c) {
      c.return = b.return;
      V = c;
      break;
    }
    V = b.return;
  }
}
function gk(a) {
  for (; null !== V; ) {
    var b = V;
    if (b === a) {
      V = null;
      break;
    }
    var c = b.sibling;
    if (null !== c) {
      c.return = b.return;
      V = c;
      break;
    }
    V = b.return;
  }
}
function jk(a) {
  for (; null !== V; ) {
    var b = V;
    try {
      switch (b.tag) {
        case 0:
        case 11:
        case 15:
          var c = b.return;
          try {
            Qj(4, b);
          } catch (k2) {
            W(b, c, k2);
          }
          break;
        case 1:
          var d = b.stateNode;
          if ("function" === typeof d.componentDidMount) {
            var e = b.return;
            try {
              d.componentDidMount();
            } catch (k2) {
              W(b, e, k2);
            }
          }
          var f2 = b.return;
          try {
            Rj(b);
          } catch (k2) {
            W(b, f2, k2);
          }
          break;
        case 5:
          var g = b.return;
          try {
            Rj(b);
          } catch (k2) {
            W(b, g, k2);
          }
      }
    } catch (k2) {
      W(b, b.return, k2);
    }
    if (b === a) {
      V = null;
      break;
    }
    var h = b.sibling;
    if (null !== h) {
      h.return = b.return;
      V = h;
      break;
    }
    V = b.return;
  }
}
var lk = Math.ceil, mk = ua.ReactCurrentDispatcher, nk = ua.ReactCurrentOwner, ok = ua.ReactCurrentBatchConfig, K = 0, Q = null, Y = null, Z = 0, fj = 0, ej = Uf(0), T = 0, pk = null, rh = 0, qk = 0, rk = 0, sk = null, tk = null, fk = 0, Gj = Infinity, uk = null, Oi = false, Pi = null, Ri = null, vk = false, wk = null, xk = 0, yk = 0, zk = null, Ak = -1, Bk = 0;
function R() {
  return 0 !== (K & 6) ? B() : -1 !== Ak ? Ak : Ak = B();
}
function yi(a) {
  if (0 === (a.mode & 1)) return 1;
  if (0 !== (K & 2) && 0 !== Z) return Z & -Z;
  if (null !== Kg.transition) return 0 === Bk && (Bk = yc()), Bk;
  a = C;
  if (0 !== a) return a;
  a = window.event;
  a = void 0 === a ? 16 : jd(a.type);
  return a;
}
function gi(a, b, c, d) {
  if (50 < yk) throw yk = 0, zk = null, Error(p(185));
  Ac(a, c, d);
  if (0 === (K & 2) || a !== Q) a === Q && (0 === (K & 2) && (qk |= c), 4 === T && Ck(a, Z)), Dk(a, d), 1 === c && 0 === K && 0 === (b.mode & 1) && (Gj = B() + 500, fg && jg());
}
function Dk(a, b) {
  var c = a.callbackNode;
  wc(a, b);
  var d = uc(a, a === Q ? Z : 0);
  if (0 === d) null !== c && bc(c), a.callbackNode = null, a.callbackPriority = 0;
  else if (b = d & -d, a.callbackPriority !== b) {
    null != c && bc(c);
    if (1 === b) 0 === a.tag ? ig(Ek.bind(null, a)) : hg(Ek.bind(null, a)), Jf(function() {
      0 === (K & 6) && jg();
    }), c = null;
    else {
      switch (Dc(d)) {
        case 1:
          c = fc;
          break;
        case 4:
          c = gc;
          break;
        case 16:
          c = hc;
          break;
        case 536870912:
          c = jc;
          break;
        default:
          c = hc;
      }
      c = Fk(c, Gk.bind(null, a));
    }
    a.callbackPriority = b;
    a.callbackNode = c;
  }
}
function Gk(a, b) {
  Ak = -1;
  Bk = 0;
  if (0 !== (K & 6)) throw Error(p(327));
  var c = a.callbackNode;
  if (Hk() && a.callbackNode !== c) return null;
  var d = uc(a, a === Q ? Z : 0);
  if (0 === d) return null;
  if (0 !== (d & 30) || 0 !== (d & a.expiredLanes) || b) b = Ik(a, d);
  else {
    b = d;
    var e = K;
    K |= 2;
    var f2 = Jk();
    if (Q !== a || Z !== b) uk = null, Gj = B() + 500, Kk(a, b);
    do
      try {
        Lk();
        break;
      } catch (h) {
        Mk(a, h);
      }
    while (1);
    $g();
    mk.current = f2;
    K = e;
    null !== Y ? b = 0 : (Q = null, Z = 0, b = T);
  }
  if (0 !== b) {
    2 === b && (e = xc(a), 0 !== e && (d = e, b = Nk(a, e)));
    if (1 === b) throw c = pk, Kk(a, 0), Ck(a, d), Dk(a, B()), c;
    if (6 === b) Ck(a, d);
    else {
      e = a.current.alternate;
      if (0 === (d & 30) && !Ok(e) && (b = Ik(a, d), 2 === b && (f2 = xc(a), 0 !== f2 && (d = f2, b = Nk(a, f2))), 1 === b)) throw c = pk, Kk(a, 0), Ck(a, d), Dk(a, B()), c;
      a.finishedWork = e;
      a.finishedLanes = d;
      switch (b) {
        case 0:
        case 1:
          throw Error(p(345));
        case 2:
          Pk(a, tk, uk);
          break;
        case 3:
          Ck(a, d);
          if ((d & 130023424) === d && (b = fk + 500 - B(), 10 < b)) {
            if (0 !== uc(a, 0)) break;
            e = a.suspendedLanes;
            if ((e & d) !== d) {
              R();
              a.pingedLanes |= a.suspendedLanes & e;
              break;
            }
            a.timeoutHandle = Ff(Pk.bind(null, a, tk, uk), b);
            break;
          }
          Pk(a, tk, uk);
          break;
        case 4:
          Ck(a, d);
          if ((d & 4194240) === d) break;
          b = a.eventTimes;
          for (e = -1; 0 < d; ) {
            var g = 31 - oc(d);
            f2 = 1 << g;
            g = b[g];
            g > e && (e = g);
            d &= ~f2;
          }
          d = e;
          d = B() - d;
          d = (120 > d ? 120 : 480 > d ? 480 : 1080 > d ? 1080 : 1920 > d ? 1920 : 3e3 > d ? 3e3 : 4320 > d ? 4320 : 1960 * lk(d / 1960)) - d;
          if (10 < d) {
            a.timeoutHandle = Ff(Pk.bind(null, a, tk, uk), d);
            break;
          }
          Pk(a, tk, uk);
          break;
        case 5:
          Pk(a, tk, uk);
          break;
        default:
          throw Error(p(329));
      }
    }
  }
  Dk(a, B());
  return a.callbackNode === c ? Gk.bind(null, a) : null;
}
function Nk(a, b) {
  var c = sk;
  a.current.memoizedState.isDehydrated && (Kk(a, b).flags |= 256);
  a = Ik(a, b);
  2 !== a && (b = tk, tk = c, null !== b && Fj(b));
  return a;
}
function Fj(a) {
  null === tk ? tk = a : tk.push.apply(tk, a);
}
function Ok(a) {
  for (var b = a; ; ) {
    if (b.flags & 16384) {
      var c = b.updateQueue;
      if (null !== c && (c = c.stores, null !== c)) for (var d = 0; d < c.length; d++) {
        var e = c[d], f2 = e.getSnapshot;
        e = e.value;
        try {
          if (!He(f2(), e)) return false;
        } catch (g) {
          return false;
        }
      }
    }
    c = b.child;
    if (b.subtreeFlags & 16384 && null !== c) c.return = b, b = c;
    else {
      if (b === a) break;
      for (; null === b.sibling; ) {
        if (null === b.return || b.return === a) return true;
        b = b.return;
      }
      b.sibling.return = b.return;
      b = b.sibling;
    }
  }
  return true;
}
function Ck(a, b) {
  b &= ~rk;
  b &= ~qk;
  a.suspendedLanes |= b;
  a.pingedLanes &= ~b;
  for (a = a.expirationTimes; 0 < b; ) {
    var c = 31 - oc(b), d = 1 << c;
    a[c] = -1;
    b &= ~d;
  }
}
function Ek(a) {
  if (0 !== (K & 6)) throw Error(p(327));
  Hk();
  var b = uc(a, 0);
  if (0 === (b & 1)) return Dk(a, B()), null;
  var c = Ik(a, b);
  if (0 !== a.tag && 2 === c) {
    var d = xc(a);
    0 !== d && (b = d, c = Nk(a, d));
  }
  if (1 === c) throw c = pk, Kk(a, 0), Ck(a, b), Dk(a, B()), c;
  if (6 === c) throw Error(p(345));
  a.finishedWork = a.current.alternate;
  a.finishedLanes = b;
  Pk(a, tk, uk);
  Dk(a, B());
  return null;
}
function Qk(a, b) {
  var c = K;
  K |= 1;
  try {
    return a(b);
  } finally {
    K = c, 0 === K && (Gj = B() + 500, fg && jg());
  }
}
function Rk(a) {
  null !== wk && 0 === wk.tag && 0 === (K & 6) && Hk();
  var b = K;
  K |= 1;
  var c = ok.transition, d = C;
  try {
    if (ok.transition = null, C = 1, a) return a();
  } finally {
    C = d, ok.transition = c, K = b, 0 === (K & 6) && jg();
  }
}
function Hj() {
  fj = ej.current;
  E(ej);
}
function Kk(a, b) {
  a.finishedWork = null;
  a.finishedLanes = 0;
  var c = a.timeoutHandle;
  -1 !== c && (a.timeoutHandle = -1, Gf(c));
  if (null !== Y) for (c = Y.return; null !== c; ) {
    var d = c;
    wg(d);
    switch (d.tag) {
      case 1:
        d = d.type.childContextTypes;
        null !== d && void 0 !== d && $f();
        break;
      case 3:
        zh();
        E(Wf);
        E(H);
        Eh();
        break;
      case 5:
        Bh(d);
        break;
      case 4:
        zh();
        break;
      case 13:
        E(L);
        break;
      case 19:
        E(L);
        break;
      case 10:
        ah(d.type._context);
        break;
      case 22:
      case 23:
        Hj();
    }
    c = c.return;
  }
  Q = a;
  Y = a = Pg(a.current, null);
  Z = fj = b;
  T = 0;
  pk = null;
  rk = qk = rh = 0;
  tk = sk = null;
  if (null !== fh) {
    for (b = 0; b < fh.length; b++) if (c = fh[b], d = c.interleaved, null !== d) {
      c.interleaved = null;
      var e = d.next, f2 = c.pending;
      if (null !== f2) {
        var g = f2.next;
        f2.next = e;
        d.next = g;
      }
      c.pending = d;
    }
    fh = null;
  }
  return a;
}
function Mk(a, b) {
  do {
    var c = Y;
    try {
      $g();
      Fh.current = Rh;
      if (Ih) {
        for (var d = M.memoizedState; null !== d; ) {
          var e = d.queue;
          null !== e && (e.pending = null);
          d = d.next;
        }
        Ih = false;
      }
      Hh = 0;
      O = N = M = null;
      Jh = false;
      Kh = 0;
      nk.current = null;
      if (null === c || null === c.return) {
        T = 1;
        pk = b;
        Y = null;
        break;
      }
      a: {
        var f2 = a, g = c.return, h = c, k2 = b;
        b = Z;
        h.flags |= 32768;
        if (null !== k2 && "object" === typeof k2 && "function" === typeof k2.then) {
          var l2 = k2, m2 = h, q2 = m2.tag;
          if (0 === (m2.mode & 1) && (0 === q2 || 11 === q2 || 15 === q2)) {
            var r2 = m2.alternate;
            r2 ? (m2.updateQueue = r2.updateQueue, m2.memoizedState = r2.memoizedState, m2.lanes = r2.lanes) : (m2.updateQueue = null, m2.memoizedState = null);
          }
          var y2 = Ui(g);
          if (null !== y2) {
            y2.flags &= -257;
            Vi(y2, g, h, f2, b);
            y2.mode & 1 && Si(f2, l2, b);
            b = y2;
            k2 = l2;
            var n2 = b.updateQueue;
            if (null === n2) {
              var t2 = /* @__PURE__ */ new Set();
              t2.add(k2);
              b.updateQueue = t2;
            } else n2.add(k2);
            break a;
          } else {
            if (0 === (b & 1)) {
              Si(f2, l2, b);
              tj();
              break a;
            }
            k2 = Error(p(426));
          }
        } else if (I && h.mode & 1) {
          var J2 = Ui(g);
          if (null !== J2) {
            0 === (J2.flags & 65536) && (J2.flags |= 256);
            Vi(J2, g, h, f2, b);
            Jg(Ji(k2, h));
            break a;
          }
        }
        f2 = k2 = Ji(k2, h);
        4 !== T && (T = 2);
        null === sk ? sk = [f2] : sk.push(f2);
        f2 = g;
        do {
          switch (f2.tag) {
            case 3:
              f2.flags |= 65536;
              b &= -b;
              f2.lanes |= b;
              var x2 = Ni(f2, k2, b);
              ph(f2, x2);
              break a;
            case 1:
              h = k2;
              var w2 = f2.type, u2 = f2.stateNode;
              if (0 === (f2.flags & 128) && ("function" === typeof w2.getDerivedStateFromError || null !== u2 && "function" === typeof u2.componentDidCatch && (null === Ri || !Ri.has(u2)))) {
                f2.flags |= 65536;
                b &= -b;
                f2.lanes |= b;
                var F2 = Qi(f2, h, b);
                ph(f2, F2);
                break a;
              }
          }
          f2 = f2.return;
        } while (null !== f2);
      }
      Sk(c);
    } catch (na) {
      b = na;
      Y === c && null !== c && (Y = c = c.return);
      continue;
    }
    break;
  } while (1);
}
function Jk() {
  var a = mk.current;
  mk.current = Rh;
  return null === a ? Rh : a;
}
function tj() {
  if (0 === T || 3 === T || 2 === T) T = 4;
  null === Q || 0 === (rh & 268435455) && 0 === (qk & 268435455) || Ck(Q, Z);
}
function Ik(a, b) {
  var c = K;
  K |= 2;
  var d = Jk();
  if (Q !== a || Z !== b) uk = null, Kk(a, b);
  do
    try {
      Tk();
      break;
    } catch (e) {
      Mk(a, e);
    }
  while (1);
  $g();
  K = c;
  mk.current = d;
  if (null !== Y) throw Error(p(261));
  Q = null;
  Z = 0;
  return T;
}
function Tk() {
  for (; null !== Y; ) Uk(Y);
}
function Lk() {
  for (; null !== Y && !cc(); ) Uk(Y);
}
function Uk(a) {
  var b = Vk(a.alternate, a, fj);
  a.memoizedProps = a.pendingProps;
  null === b ? Sk(a) : Y = b;
  nk.current = null;
}
function Sk(a) {
  var b = a;
  do {
    var c = b.alternate;
    a = b.return;
    if (0 === (b.flags & 32768)) {
      if (c = Ej(c, b, fj), null !== c) {
        Y = c;
        return;
      }
    } else {
      c = Ij(c, b);
      if (null !== c) {
        c.flags &= 32767;
        Y = c;
        return;
      }
      if (null !== a) a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null;
      else {
        T = 6;
        Y = null;
        return;
      }
    }
    b = b.sibling;
    if (null !== b) {
      Y = b;
      return;
    }
    Y = b = a;
  } while (null !== b);
  0 === T && (T = 5);
}
function Pk(a, b, c) {
  var d = C, e = ok.transition;
  try {
    ok.transition = null, C = 1, Wk(a, b, c, d);
  } finally {
    ok.transition = e, C = d;
  }
  return null;
}
function Wk(a, b, c, d) {
  do
    Hk();
  while (null !== wk);
  if (0 !== (K & 6)) throw Error(p(327));
  c = a.finishedWork;
  var e = a.finishedLanes;
  if (null === c) return null;
  a.finishedWork = null;
  a.finishedLanes = 0;
  if (c === a.current) throw Error(p(177));
  a.callbackNode = null;
  a.callbackPriority = 0;
  var f2 = c.lanes | c.childLanes;
  Bc(a, f2);
  a === Q && (Y = Q = null, Z = 0);
  0 === (c.subtreeFlags & 2064) && 0 === (c.flags & 2064) || vk || (vk = true, Fk(hc, function() {
    Hk();
    return null;
  }));
  f2 = 0 !== (c.flags & 15990);
  if (0 !== (c.subtreeFlags & 15990) || f2) {
    f2 = ok.transition;
    ok.transition = null;
    var g = C;
    C = 1;
    var h = K;
    K |= 4;
    nk.current = null;
    Oj(a, c);
    dk(c, a);
    Oe(Df);
    dd = !!Cf;
    Df = Cf = null;
    a.current = c;
    hk(c);
    dc();
    K = h;
    C = g;
    ok.transition = f2;
  } else a.current = c;
  vk && (vk = false, wk = a, xk = e);
  f2 = a.pendingLanes;
  0 === f2 && (Ri = null);
  mc(c.stateNode);
  Dk(a, B());
  if (null !== b) for (d = a.onRecoverableError, c = 0; c < b.length; c++) e = b[c], d(e.value, { componentStack: e.stack, digest: e.digest });
  if (Oi) throw Oi = false, a = Pi, Pi = null, a;
  0 !== (xk & 1) && 0 !== a.tag && Hk();
  f2 = a.pendingLanes;
  0 !== (f2 & 1) ? a === zk ? yk++ : (yk = 0, zk = a) : yk = 0;
  jg();
  return null;
}
function Hk() {
  if (null !== wk) {
    var a = Dc(xk), b = ok.transition, c = C;
    try {
      ok.transition = null;
      C = 16 > a ? 16 : a;
      if (null === wk) var d = false;
      else {
        a = wk;
        wk = null;
        xk = 0;
        if (0 !== (K & 6)) throw Error(p(331));
        var e = K;
        K |= 4;
        for (V = a.current; null !== V; ) {
          var f2 = V, g = f2.child;
          if (0 !== (V.flags & 16)) {
            var h = f2.deletions;
            if (null !== h) {
              for (var k2 = 0; k2 < h.length; k2++) {
                var l2 = h[k2];
                for (V = l2; null !== V; ) {
                  var m2 = V;
                  switch (m2.tag) {
                    case 0:
                    case 11:
                    case 15:
                      Pj(8, m2, f2);
                  }
                  var q2 = m2.child;
                  if (null !== q2) q2.return = m2, V = q2;
                  else for (; null !== V; ) {
                    m2 = V;
                    var r2 = m2.sibling, y2 = m2.return;
                    Sj(m2);
                    if (m2 === l2) {
                      V = null;
                      break;
                    }
                    if (null !== r2) {
                      r2.return = y2;
                      V = r2;
                      break;
                    }
                    V = y2;
                  }
                }
              }
              var n2 = f2.alternate;
              if (null !== n2) {
                var t2 = n2.child;
                if (null !== t2) {
                  n2.child = null;
                  do {
                    var J2 = t2.sibling;
                    t2.sibling = null;
                    t2 = J2;
                  } while (null !== t2);
                }
              }
              V = f2;
            }
          }
          if (0 !== (f2.subtreeFlags & 2064) && null !== g) g.return = f2, V = g;
          else b: for (; null !== V; ) {
            f2 = V;
            if (0 !== (f2.flags & 2048)) switch (f2.tag) {
              case 0:
              case 11:
              case 15:
                Pj(9, f2, f2.return);
            }
            var x2 = f2.sibling;
            if (null !== x2) {
              x2.return = f2.return;
              V = x2;
              break b;
            }
            V = f2.return;
          }
        }
        var w2 = a.current;
        for (V = w2; null !== V; ) {
          g = V;
          var u2 = g.child;
          if (0 !== (g.subtreeFlags & 2064) && null !== u2) u2.return = g, V = u2;
          else b: for (g = w2; null !== V; ) {
            h = V;
            if (0 !== (h.flags & 2048)) try {
              switch (h.tag) {
                case 0:
                case 11:
                case 15:
                  Qj(9, h);
              }
            } catch (na) {
              W(h, h.return, na);
            }
            if (h === g) {
              V = null;
              break b;
            }
            var F2 = h.sibling;
            if (null !== F2) {
              F2.return = h.return;
              V = F2;
              break b;
            }
            V = h.return;
          }
        }
        K = e;
        jg();
        if (lc && "function" === typeof lc.onPostCommitFiberRoot) try {
          lc.onPostCommitFiberRoot(kc, a);
        } catch (na) {
        }
        d = true;
      }
      return d;
    } finally {
      C = c, ok.transition = b;
    }
  }
  return false;
}
function Xk(a, b, c) {
  b = Ji(c, b);
  b = Ni(a, b, 1);
  a = nh(a, b, 1);
  b = R();
  null !== a && (Ac(a, 1, b), Dk(a, b));
}
function W(a, b, c) {
  if (3 === a.tag) Xk(a, a, c);
  else for (; null !== b; ) {
    if (3 === b.tag) {
      Xk(b, a, c);
      break;
    } else if (1 === b.tag) {
      var d = b.stateNode;
      if ("function" === typeof b.type.getDerivedStateFromError || "function" === typeof d.componentDidCatch && (null === Ri || !Ri.has(d))) {
        a = Ji(c, a);
        a = Qi(b, a, 1);
        b = nh(b, a, 1);
        a = R();
        null !== b && (Ac(b, 1, a), Dk(b, a));
        break;
      }
    }
    b = b.return;
  }
}
function Ti(a, b, c) {
  var d = a.pingCache;
  null !== d && d.delete(b);
  b = R();
  a.pingedLanes |= a.suspendedLanes & c;
  Q === a && (Z & c) === c && (4 === T || 3 === T && (Z & 130023424) === Z && 500 > B() - fk ? Kk(a, 0) : rk |= c);
  Dk(a, b);
}
function Yk(a, b) {
  0 === b && (0 === (a.mode & 1) ? b = 1 : (b = sc, sc <<= 1, 0 === (sc & 130023424) && (sc = 4194304)));
  var c = R();
  a = ih(a, b);
  null !== a && (Ac(a, b, c), Dk(a, c));
}
function uj(a) {
  var b = a.memoizedState, c = 0;
  null !== b && (c = b.retryLane);
  Yk(a, c);
}
function bk(a, b) {
  var c = 0;
  switch (a.tag) {
    case 13:
      var d = a.stateNode;
      var e = a.memoizedState;
      null !== e && (c = e.retryLane);
      break;
    case 19:
      d = a.stateNode;
      break;
    default:
      throw Error(p(314));
  }
  null !== d && d.delete(b);
  Yk(a, c);
}
var Vk;
Vk = function(a, b, c) {
  if (null !== a) if (a.memoizedProps !== b.pendingProps || Wf.current) dh = true;
  else {
    if (0 === (a.lanes & c) && 0 === (b.flags & 128)) return dh = false, yj(a, b, c);
    dh = 0 !== (a.flags & 131072) ? true : false;
  }
  else dh = false, I && 0 !== (b.flags & 1048576) && ug(b, ng, b.index);
  b.lanes = 0;
  switch (b.tag) {
    case 2:
      var d = b.type;
      ij(a, b);
      a = b.pendingProps;
      var e = Yf(b, H.current);
      ch(b, c);
      e = Nh(null, b, d, a, e, c);
      var f2 = Sh();
      b.flags |= 1;
      "object" === typeof e && null !== e && "function" === typeof e.render && void 0 === e.$$typeof ? (b.tag = 1, b.memoizedState = null, b.updateQueue = null, Zf(d) ? (f2 = true, cg(b)) : f2 = false, b.memoizedState = null !== e.state && void 0 !== e.state ? e.state : null, kh(b), e.updater = Ei, b.stateNode = e, e._reactInternals = b, Ii(b, d, a, c), b = jj(null, b, d, true, f2, c)) : (b.tag = 0, I && f2 && vg(b), Xi(null, b, e, c), b = b.child);
      return b;
    case 16:
      d = b.elementType;
      a: {
        ij(a, b);
        a = b.pendingProps;
        e = d._init;
        d = e(d._payload);
        b.type = d;
        e = b.tag = Zk(d);
        a = Ci(d, a);
        switch (e) {
          case 0:
            b = cj(null, b, d, a, c);
            break a;
          case 1:
            b = hj(null, b, d, a, c);
            break a;
          case 11:
            b = Yi(null, b, d, a, c);
            break a;
          case 14:
            b = $i(null, b, d, Ci(d.type, a), c);
            break a;
        }
        throw Error(p(
          306,
          d,
          ""
        ));
      }
      return b;
    case 0:
      return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), cj(a, b, d, e, c);
    case 1:
      return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), hj(a, b, d, e, c);
    case 3:
      a: {
        kj(b);
        if (null === a) throw Error(p(387));
        d = b.pendingProps;
        f2 = b.memoizedState;
        e = f2.element;
        lh(a, b);
        qh(b, d, null, c);
        var g = b.memoizedState;
        d = g.element;
        if (f2.isDehydrated) if (f2 = { element: d, isDehydrated: false, cache: g.cache, pendingSuspenseBoundaries: g.pendingSuspenseBoundaries, transitions: g.transitions }, b.updateQueue.baseState = f2, b.memoizedState = f2, b.flags & 256) {
          e = Ji(Error(p(423)), b);
          b = lj(a, b, d, c, e);
          break a;
        } else if (d !== e) {
          e = Ji(Error(p(424)), b);
          b = lj(a, b, d, c, e);
          break a;
        } else for (yg = Lf(b.stateNode.containerInfo.firstChild), xg = b, I = true, zg = null, c = Vg(b, null, d, c), b.child = c; c; ) c.flags = c.flags & -3 | 4096, c = c.sibling;
        else {
          Ig();
          if (d === e) {
            b = Zi(a, b, c);
            break a;
          }
          Xi(a, b, d, c);
        }
        b = b.child;
      }
      return b;
    case 5:
      return Ah(b), null === a && Eg(b), d = b.type, e = b.pendingProps, f2 = null !== a ? a.memoizedProps : null, g = e.children, Ef(d, e) ? g = null : null !== f2 && Ef(d, f2) && (b.flags |= 32), gj(a, b), Xi(a, b, g, c), b.child;
    case 6:
      return null === a && Eg(b), null;
    case 13:
      return oj(a, b, c);
    case 4:
      return yh(b, b.stateNode.containerInfo), d = b.pendingProps, null === a ? b.child = Ug(b, null, d, c) : Xi(a, b, d, c), b.child;
    case 11:
      return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), Yi(a, b, d, e, c);
    case 7:
      return Xi(a, b, b.pendingProps, c), b.child;
    case 8:
      return Xi(a, b, b.pendingProps.children, c), b.child;
    case 12:
      return Xi(a, b, b.pendingProps.children, c), b.child;
    case 10:
      a: {
        d = b.type._context;
        e = b.pendingProps;
        f2 = b.memoizedProps;
        g = e.value;
        G(Wg, d._currentValue);
        d._currentValue = g;
        if (null !== f2) if (He(f2.value, g)) {
          if (f2.children === e.children && !Wf.current) {
            b = Zi(a, b, c);
            break a;
          }
        } else for (f2 = b.child, null !== f2 && (f2.return = b); null !== f2; ) {
          var h = f2.dependencies;
          if (null !== h) {
            g = f2.child;
            for (var k2 = h.firstContext; null !== k2; ) {
              if (k2.context === d) {
                if (1 === f2.tag) {
                  k2 = mh(-1, c & -c);
                  k2.tag = 2;
                  var l2 = f2.updateQueue;
                  if (null !== l2) {
                    l2 = l2.shared;
                    var m2 = l2.pending;
                    null === m2 ? k2.next = k2 : (k2.next = m2.next, m2.next = k2);
                    l2.pending = k2;
                  }
                }
                f2.lanes |= c;
                k2 = f2.alternate;
                null !== k2 && (k2.lanes |= c);
                bh(
                  f2.return,
                  c,
                  b
                );
                h.lanes |= c;
                break;
              }
              k2 = k2.next;
            }
          } else if (10 === f2.tag) g = f2.type === b.type ? null : f2.child;
          else if (18 === f2.tag) {
            g = f2.return;
            if (null === g) throw Error(p(341));
            g.lanes |= c;
            h = g.alternate;
            null !== h && (h.lanes |= c);
            bh(g, c, b);
            g = f2.sibling;
          } else g = f2.child;
          if (null !== g) g.return = f2;
          else for (g = f2; null !== g; ) {
            if (g === b) {
              g = null;
              break;
            }
            f2 = g.sibling;
            if (null !== f2) {
              f2.return = g.return;
              g = f2;
              break;
            }
            g = g.return;
          }
          f2 = g;
        }
        Xi(a, b, e.children, c);
        b = b.child;
      }
      return b;
    case 9:
      return e = b.type, d = b.pendingProps.children, ch(b, c), e = eh(e), d = d(e), b.flags |= 1, Xi(a, b, d, c), b.child;
    case 14:
      return d = b.type, e = Ci(d, b.pendingProps), e = Ci(d.type, e), $i(a, b, d, e, c);
    case 15:
      return bj(a, b, b.type, b.pendingProps, c);
    case 17:
      return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), ij(a, b), b.tag = 1, Zf(d) ? (a = true, cg(b)) : a = false, ch(b, c), Gi(b, d, e), Ii(b, d, e, c), jj(null, b, d, true, a, c);
    case 19:
      return xj(a, b, c);
    case 22:
      return dj(a, b, c);
  }
  throw Error(p(156, b.tag));
};
function Fk(a, b) {
  return ac(a, b);
}
function $k(a, b, c, d) {
  this.tag = a;
  this.key = c;
  this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
  this.index = 0;
  this.ref = null;
  this.pendingProps = b;
  this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
  this.mode = d;
  this.subtreeFlags = this.flags = 0;
  this.deletions = null;
  this.childLanes = this.lanes = 0;
  this.alternate = null;
}
function Bg(a, b, c, d) {
  return new $k(a, b, c, d);
}
function aj(a) {
  a = a.prototype;
  return !(!a || !a.isReactComponent);
}
function Zk(a) {
  if ("function" === typeof a) return aj(a) ? 1 : 0;
  if (void 0 !== a && null !== a) {
    a = a.$$typeof;
    if (a === Da) return 11;
    if (a === Ga) return 14;
  }
  return 2;
}
function Pg(a, b) {
  var c = a.alternate;
  null === c ? (c = Bg(a.tag, b, a.key, a.mode), c.elementType = a.elementType, c.type = a.type, c.stateNode = a.stateNode, c.alternate = a, a.alternate = c) : (c.pendingProps = b, c.type = a.type, c.flags = 0, c.subtreeFlags = 0, c.deletions = null);
  c.flags = a.flags & 14680064;
  c.childLanes = a.childLanes;
  c.lanes = a.lanes;
  c.child = a.child;
  c.memoizedProps = a.memoizedProps;
  c.memoizedState = a.memoizedState;
  c.updateQueue = a.updateQueue;
  b = a.dependencies;
  c.dependencies = null === b ? null : { lanes: b.lanes, firstContext: b.firstContext };
  c.sibling = a.sibling;
  c.index = a.index;
  c.ref = a.ref;
  return c;
}
function Rg(a, b, c, d, e, f2) {
  var g = 2;
  d = a;
  if ("function" === typeof a) aj(a) && (g = 1);
  else if ("string" === typeof a) g = 5;
  else a: switch (a) {
    case ya:
      return Tg(c.children, e, f2, b);
    case za:
      g = 8;
      e |= 8;
      break;
    case Aa:
      return a = Bg(12, c, b, e | 2), a.elementType = Aa, a.lanes = f2, a;
    case Ea:
      return a = Bg(13, c, b, e), a.elementType = Ea, a.lanes = f2, a;
    case Fa:
      return a = Bg(19, c, b, e), a.elementType = Fa, a.lanes = f2, a;
    case Ia:
      return pj(c, e, f2, b);
    default:
      if ("object" === typeof a && null !== a) switch (a.$$typeof) {
        case Ba:
          g = 10;
          break a;
        case Ca:
          g = 9;
          break a;
        case Da:
          g = 11;
          break a;
        case Ga:
          g = 14;
          break a;
        case Ha:
          g = 16;
          d = null;
          break a;
      }
      throw Error(p(130, null == a ? a : typeof a, ""));
  }
  b = Bg(g, c, b, e);
  b.elementType = a;
  b.type = d;
  b.lanes = f2;
  return b;
}
function Tg(a, b, c, d) {
  a = Bg(7, a, d, b);
  a.lanes = c;
  return a;
}
function pj(a, b, c, d) {
  a = Bg(22, a, d, b);
  a.elementType = Ia;
  a.lanes = c;
  a.stateNode = { isHidden: false };
  return a;
}
function Qg(a, b, c) {
  a = Bg(6, a, null, b);
  a.lanes = c;
  return a;
}
function Sg(a, b, c) {
  b = Bg(4, null !== a.children ? a.children : [], a.key, b);
  b.lanes = c;
  b.stateNode = { containerInfo: a.containerInfo, pendingChildren: null, implementation: a.implementation };
  return b;
}
function al(a, b, c, d, e) {
  this.tag = b;
  this.containerInfo = a;
  this.finishedWork = this.pingCache = this.current = this.pendingChildren = null;
  this.timeoutHandle = -1;
  this.callbackNode = this.pendingContext = this.context = null;
  this.callbackPriority = 0;
  this.eventTimes = zc(0);
  this.expirationTimes = zc(-1);
  this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
  this.entanglements = zc(0);
  this.identifierPrefix = d;
  this.onRecoverableError = e;
  this.mutableSourceEagerHydrationData = null;
}
function bl(a, b, c, d, e, f2, g, h, k2) {
  a = new al(a, b, c, h, k2);
  1 === b ? (b = 1, true === f2 && (b |= 8)) : b = 0;
  f2 = Bg(3, null, null, b);
  a.current = f2;
  f2.stateNode = a;
  f2.memoizedState = { element: d, isDehydrated: c, cache: null, transitions: null, pendingSuspenseBoundaries: null };
  kh(f2);
  return a;
}
function cl(a, b, c) {
  var d = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
  return { $$typeof: wa, key: null == d ? null : "" + d, children: a, containerInfo: b, implementation: c };
}
function dl(a) {
  if (!a) return Vf;
  a = a._reactInternals;
  a: {
    if (Vb(a) !== a || 1 !== a.tag) throw Error(p(170));
    var b = a;
    do {
      switch (b.tag) {
        case 3:
          b = b.stateNode.context;
          break a;
        case 1:
          if (Zf(b.type)) {
            b = b.stateNode.__reactInternalMemoizedMergedChildContext;
            break a;
          }
      }
      b = b.return;
    } while (null !== b);
    throw Error(p(171));
  }
  if (1 === a.tag) {
    var c = a.type;
    if (Zf(c)) return bg(a, c, b);
  }
  return b;
}
function el(a, b, c, d, e, f2, g, h, k2) {
  a = bl(c, d, true, a, e, f2, g, h, k2);
  a.context = dl(null);
  c = a.current;
  d = R();
  e = yi(c);
  f2 = mh(d, e);
  f2.callback = void 0 !== b && null !== b ? b : null;
  nh(c, f2, e);
  a.current.lanes = e;
  Ac(a, e, d);
  Dk(a, d);
  return a;
}
function fl(a, b, c, d) {
  var e = b.current, f2 = R(), g = yi(e);
  c = dl(c);
  null === b.context ? b.context = c : b.pendingContext = c;
  b = mh(f2, g);
  b.payload = { element: a };
  d = void 0 === d ? null : d;
  null !== d && (b.callback = d);
  a = nh(e, b, g);
  null !== a && (gi(a, e, g, f2), oh(a, e, g));
  return g;
}
function gl(a) {
  a = a.current;
  if (!a.child) return null;
  switch (a.child.tag) {
    case 5:
      return a.child.stateNode;
    default:
      return a.child.stateNode;
  }
}
function hl(a, b) {
  a = a.memoizedState;
  if (null !== a && null !== a.dehydrated) {
    var c = a.retryLane;
    a.retryLane = 0 !== c && c < b ? c : b;
  }
}
function il(a, b) {
  hl(a, b);
  (a = a.alternate) && hl(a, b);
}
function jl() {
  return null;
}
var kl = "function" === typeof reportError ? reportError : function(a) {
  console.error(a);
};
function ll(a) {
  this._internalRoot = a;
}
ml.prototype.render = ll.prototype.render = function(a) {
  var b = this._internalRoot;
  if (null === b) throw Error(p(409));
  fl(a, b, null, null);
};
ml.prototype.unmount = ll.prototype.unmount = function() {
  var a = this._internalRoot;
  if (null !== a) {
    this._internalRoot = null;
    var b = a.containerInfo;
    Rk(function() {
      fl(null, a, null, null);
    });
    b[uf] = null;
  }
};
function ml(a) {
  this._internalRoot = a;
}
ml.prototype.unstable_scheduleHydration = function(a) {
  if (a) {
    var b = Hc();
    a = { blockedOn: null, target: a, priority: b };
    for (var c = 0; c < Qc.length && 0 !== b && b < Qc[c].priority; c++) ;
    Qc.splice(c, 0, a);
    0 === c && Vc(a);
  }
};
function nl(a) {
  return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType);
}
function ol(a) {
  return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType && (8 !== a.nodeType || " react-mount-point-unstable " !== a.nodeValue));
}
function pl() {
}
function ql(a, b, c, d, e) {
  if (e) {
    if ("function" === typeof d) {
      var f2 = d;
      d = function() {
        var a2 = gl(g);
        f2.call(a2);
      };
    }
    var g = el(b, d, a, 0, null, false, false, "", pl);
    a._reactRootContainer = g;
    a[uf] = g.current;
    sf(8 === a.nodeType ? a.parentNode : a);
    Rk();
    return g;
  }
  for (; e = a.lastChild; ) a.removeChild(e);
  if ("function" === typeof d) {
    var h = d;
    d = function() {
      var a2 = gl(k2);
      h.call(a2);
    };
  }
  var k2 = bl(a, 0, false, null, null, false, false, "", pl);
  a._reactRootContainer = k2;
  a[uf] = k2.current;
  sf(8 === a.nodeType ? a.parentNode : a);
  Rk(function() {
    fl(b, k2, c, d);
  });
  return k2;
}
function rl(a, b, c, d, e) {
  var f2 = c._reactRootContainer;
  if (f2) {
    var g = f2;
    if ("function" === typeof e) {
      var h = e;
      e = function() {
        var a2 = gl(g);
        h.call(a2);
      };
    }
    fl(b, g, a, e);
  } else g = ql(c, b, a, e, d);
  return gl(g);
}
Ec = function(a) {
  switch (a.tag) {
    case 3:
      var b = a.stateNode;
      if (b.current.memoizedState.isDehydrated) {
        var c = tc(b.pendingLanes);
        0 !== c && (Cc(b, c | 1), Dk(b, B()), 0 === (K & 6) && (Gj = B() + 500, jg()));
      }
      break;
    case 13:
      Rk(function() {
        var b2 = ih(a, 1);
        if (null !== b2) {
          var c2 = R();
          gi(b2, a, 1, c2);
        }
      }), il(a, 1);
  }
};
Fc = function(a) {
  if (13 === a.tag) {
    var b = ih(a, 134217728);
    if (null !== b) {
      var c = R();
      gi(b, a, 134217728, c);
    }
    il(a, 134217728);
  }
};
Gc = function(a) {
  if (13 === a.tag) {
    var b = yi(a), c = ih(a, b);
    if (null !== c) {
      var d = R();
      gi(c, a, b, d);
    }
    il(a, b);
  }
};
Hc = function() {
  return C;
};
Ic = function(a, b) {
  var c = C;
  try {
    return C = a, b();
  } finally {
    C = c;
  }
};
yb = function(a, b, c) {
  switch (b) {
    case "input":
      bb(a, c);
      b = c.name;
      if ("radio" === c.type && null != b) {
        for (c = a; c.parentNode; ) c = c.parentNode;
        c = c.querySelectorAll("input[name=" + JSON.stringify("" + b) + '][type="radio"]');
        for (b = 0; b < c.length; b++) {
          var d = c[b];
          if (d !== a && d.form === a.form) {
            var e = Db(d);
            if (!e) throw Error(p(90));
            Wa(d);
            bb(d, e);
          }
        }
      }
      break;
    case "textarea":
      ib(a, c);
      break;
    case "select":
      b = c.value, null != b && fb(a, !!c.multiple, b, false);
  }
};
Gb = Qk;
Hb = Rk;
var sl = { usingClientEntryPoint: false, Events: [Cb, ue, Db, Eb, Fb, Qk] }, tl = { findFiberByHostInstance: Wc, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" };
var ul = { bundleType: tl.bundleType, version: tl.version, rendererPackageName: tl.rendererPackageName, rendererConfig: tl.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: ua.ReactCurrentDispatcher, findHostInstanceByFiber: function(a) {
  a = Zb(a);
  return null === a ? null : a.stateNode;
}, findFiberByHostInstance: tl.findFiberByHostInstance || jl, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
  var vl = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!vl.isDisabled && vl.supportsFiber) try {
    kc = vl.inject(ul), lc = vl;
  } catch (a) {
  }
}
reactDom_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = sl;
reactDom_production_min.createPortal = function(a, b) {
  var c = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
  if (!nl(b)) throw Error(p(200));
  return cl(a, b, null, c);
};
reactDom_production_min.createRoot = function(a, b) {
  if (!nl(a)) throw Error(p(299));
  var c = false, d = "", e = kl;
  null !== b && void 0 !== b && (true === b.unstable_strictMode && (c = true), void 0 !== b.identifierPrefix && (d = b.identifierPrefix), void 0 !== b.onRecoverableError && (e = b.onRecoverableError));
  b = bl(a, 1, false, null, null, c, false, d, e);
  a[uf] = b.current;
  sf(8 === a.nodeType ? a.parentNode : a);
  return new ll(b);
};
reactDom_production_min.findDOMNode = function(a) {
  if (null == a) return null;
  if (1 === a.nodeType) return a;
  var b = a._reactInternals;
  if (void 0 === b) {
    if ("function" === typeof a.render) throw Error(p(188));
    a = Object.keys(a).join(",");
    throw Error(p(268, a));
  }
  a = Zb(b);
  a = null === a ? null : a.stateNode;
  return a;
};
reactDom_production_min.flushSync = function(a) {
  return Rk(a);
};
reactDom_production_min.hydrate = function(a, b, c) {
  if (!ol(b)) throw Error(p(200));
  return rl(null, a, b, true, c);
};
reactDom_production_min.hydrateRoot = function(a, b, c) {
  if (!nl(a)) throw Error(p(405));
  var d = null != c && c.hydratedSources || null, e = false, f2 = "", g = kl;
  null !== c && void 0 !== c && (true === c.unstable_strictMode && (e = true), void 0 !== c.identifierPrefix && (f2 = c.identifierPrefix), void 0 !== c.onRecoverableError && (g = c.onRecoverableError));
  b = el(b, null, a, 1, null != c ? c : null, e, false, f2, g);
  a[uf] = b.current;
  sf(a);
  if (d) for (a = 0; a < d.length; a++) c = d[a], e = c._getVersion, e = e(c._source), null == b.mutableSourceEagerHydrationData ? b.mutableSourceEagerHydrationData = [c, e] : b.mutableSourceEagerHydrationData.push(
    c,
    e
  );
  return new ml(b);
};
reactDom_production_min.render = function(a, b, c) {
  if (!ol(b)) throw Error(p(200));
  return rl(null, a, b, false, c);
};
reactDom_production_min.unmountComponentAtNode = function(a) {
  if (!ol(a)) throw Error(p(40));
  return a._reactRootContainer ? (Rk(function() {
    rl(null, null, a, false, function() {
      a._reactRootContainer = null;
      a[uf] = null;
    });
  }), true) : false;
};
reactDom_production_min.unstable_batchedUpdates = Qk;
reactDom_production_min.unstable_renderSubtreeIntoContainer = function(a, b, c, d) {
  if (!ol(c)) throw Error(p(200));
  if (null == a || void 0 === a._reactInternals) throw Error(p(38));
  return rl(a, b, c, false, d);
};
reactDom_production_min.version = "18.3.1-next-f1338f8080-20240426";
function checkDCE() {
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
    return;
  }
  try {
    __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
  } catch (err) {
    console.error(err);
  }
}
{
  checkDCE();
  reactDom.exports = reactDom_production_min;
}
var reactDomExports = reactDom.exports;
var createRoot;
var m = reactDomExports;
{
  createRoot = m.createRoot;
  m.hydrateRoot;
}
const api = async (path, opts = {}) => {
  var _a, _b;
  const r2 = await fetch(path, { method: opts.method || "GET", headers: { "Content-Type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : void 0 });
  const j = await r2.json().catch(() => ({}));
  if (!r2.ok) throw new Error(((_a = j.error) == null ? void 0 : _a.code) || ((_b = j.error) == null ? void 0 : _b.message) || `HTTP ${r2.status}`);
  return j;
};
const offlineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem("wp_offline_posts") || "[]");
  } catch {
    return [];
  }
};
const offlinePost = async (url, body, label) => {
  try {
    return await api(url, { method: "POST", body });
  } catch (e) {
    if (!navigator.onLine || /failed to fetch|networkerror|load failed/i.test(String((e == null ? void 0 : e.message) || e))) {
      const q2 = offlineQueue();
      q2.push({ url, body, label, at: (/* @__PURE__ */ new Date()).toISOString() });
      localStorage.setItem("wp_offline_posts", JSON.stringify(q2));
      return { __offline: true };
    }
    throw e;
  }
};
const syncOffline = async () => {
  const q2 = offlineQueue();
  if (!q2.length) return;
  const left = [];
  for (const item of q2) {
    try {
      await api(item.url, { method: "POST", body: item.body });
    } catch {
      left.push(item);
    }
  }
  localStorage.setItem("wp_offline_posts", JSON.stringify(left));
  if (left.length < q2.length) location.reload();
};
const money = (n2) => "$" + Number(n2 || 0).toLocaleString(void 0, { maximumFractionDigits: 0 });
const num = (n2) => Number(n2 || 0).toLocaleString();
const dt = (s) => s ? new Date(s).toLocaleString(void 0, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const dOnly = (s) => s ? new Date(s).toLocaleDateString() : "—";
const Badge = ({ s }) => /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `badge b-${s}`, children: String(s || "").replaceAll("_", " ") });
const STATES = ["NEW", "WORKING", "QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP", "WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];
const FINALS = ["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];
const JOB_STAGES = ["AWAITING_SCHEDULING", "SCHEDULED", "IN_PROGRESS", "ON_HOLD", "WORK_COMPLETED", "DOCUMENTATION_PENDING", "READY_TO_INVOICE", "INVOICED", "CLOSED", "CANCELLED"];
const BUCKETS = [["new", "New"], ["working", "Working"], ["proposal", "Proposal"], ["won", "Won"], ["closed", "Closed"]];
const BOARD_STAGES = [["NEW", "New"], ["WORKING", "Working"], ["QUALIFIED", "Qualified"], ["PROPOSAL", "Proposal"], ["SENT", "Sent"], ["FOLLOWUP", "Follow-up"], ["WON", "Won"], ["CLOSED", "Closed"]];
function GoalGauge({ pct, target }) {
  const p2 = Math.max(0, Math.min(100, pct || 0));
  const R2 = 74, C2 = Math.PI * R2;
  const ticks = [0, 25, 50, 75, 100];
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "gaugeWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "190", height: "112", viewBox: "0 0 190 112", children: [
    ticks.map((t2) => {
      const a = Math.PI * (1 - t2 / 100);
      const x1 = 95 + (R2 + 7) * Math.cos(a), y1 = 100 - (R2 + 7) * Math.sin(a), x2 = 95 + (R2 - 9) * Math.cos(a), y2 = 100 - (R2 - 9) * Math.sin(a);
      return /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1, y1, x2, y2, stroke: t2 <= p2 ? "#16a34a" : "#e2e8f0", strokeWidth: "5", strokeLinecap: "round" }, t2);
    }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: `M ${95 - R2} 100 A ${R2} ${R2} 0 0 1 ${95 + R2} 100`, fill: "none", stroke: "#eef2f7", strokeWidth: "13", strokeLinecap: "round" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: `M ${95 - R2} 100 A ${R2} ${R2} 0 0 1 ${95 + R2} 100`, fill: "none", stroke: "#16a34a", strokeWidth: "13", strokeLinecap: "round", strokeDasharray: `${C2 * p2 / 100} ${C2}`, style: { transition: "stroke-dasharray 1s cubic-bezier(.22,.9,.3,1)" } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: "95", y: "82", textAnchor: "middle", fontSize: "30", fontWeight: "800", fill: "#1b1b1a", children: pct === null || pct === void 0 ? "—" : pct + "%" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("text", { x: "95", y: "100", textAnchor: "middle", fontSize: "11.5", fill: "#94a3b8", children: [
      "of ",
      target,
      "% target"
    ] })
  ] }) });
}
function useCountUp(target, dur = 750) {
  const [v2, setV] = reactExports.useState(0);
  reactExports.useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t2) => {
      const p2 = Math.min(1, (t2 - t0) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - p2, 3))));
      if (p2 < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v2;
}
function FinancesStrip({ f: f2 }) {
  if (!f2) return null;
  const cell = (label, x2, accent) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: "1 1 150px", minWidth: 140 }, title: (x2 == null ? void 0 : x2.definition) || "", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "tiny muted", style: { fontWeight: 700, letterSpacing: 0.3 }, children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 21, fontWeight: 800, color: accent || "var(--ink)" }, children: money((x2 == null ? void 0 : x2.value) || 0) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "tiny muted", style: { lineHeight: 1.35 }, children: (x2 == null ? void 0 : x2.definition) || "" })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card wpRise", style: { marginTop: 12 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "💰 Money — kept separate, on purpose" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tiny muted", children: "Estimates are not revenue. Each figure has one definition." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }, children: [
      cell("ESTIMATED PIPELINE", f2.estimated_pipeline),
      cell("PROPOSALS OUT", f2.proposal_value_outstanding),
      cell("APPROVED", f2.approved_proposal_value),
      cell("SIGNED CONTRACTS", f2.signed_contract_value, "#157347"),
      cell("INVOICED", f2.invoiced_value),
      cell("COLLECTED CASH", f2.collected_cash, "#157347"),
      cell("RECEIVABLES OPEN", f2.outstanding_receivables, "#b45309")
    ] })
  ] });
}
function OnboardingCard({ go }) {
  const [ob2, setOb] = reactExports.useState(null);
  const [hide, setHide] = reactExports.useState(localStorage.getItem("wp_ob_hide") === "1");
  reactExports.useEffect(() => {
    api("/api/onboarding").then(setOb).catch(() => {
    });
  }, []);
  if (!ob2 || ob2.complete || hide) return null;
  const next = ob2.steps.find((x2) => !x2.done);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { borderLeft: "4px solid #0b6e3f", marginBottom: 12 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        "🚀 Get set up — ",
        ob2.done_count,
        " of ",
        ob2.total,
        " done"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => {
        localStorage.setItem("wp_ob_hide", "1");
        setHide(true);
      }, children: "Dismiss" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: 8, background: "#e2e8f0", borderRadius: 6, margin: "8px 0" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: 8, width: Math.round(ob2.done_count / ob2.total * 100) + "%", background: "#0b6e3f", borderRadius: 6 } }) }),
    ob2.steps.map((x2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { padding: "5px 0", opacity: x2.done ? 0.65 : 1 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: x2.done ? "✅" : "⬜" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 13.5 }, children: x2.label }),
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", style: { fontSize: 12 }, children: [
          "— ",
          x2.hint
        ] })
      ] }),
      !x2.done && next && x2.key === next.key && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: () => go({ view: x2.view }), children: "Do it →" })
    ] }, x2.key)),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12, margin: "6px 0 0" }, children: "Built around one thing: your first sent proposal. Everything else can wait." })
  ] });
}
function HomeDash({ go, openLead, m: m2, d }) {
  var _a, _b, _c;
  const [home, setHome] = reactExports.useState(null);
  const [ins, setIns] = reactExports.useState([]);
  const [runOpen, setRunOpen] = reactExports.useState(false);
  const [toasts, setToasts] = reactExports.useState([]);
  const [actRange, setActRange] = reactExports.useState(30);
  const [calDay, setCalDay] = reactExports.useState((/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  const [calDone, setCalDone] = reactExports.useState(/* @__PURE__ */ new Set());
  reactExports.useEffect(() => {
    api("/api/home").then(setHome).catch(() => {
    });
    api("/api/ai/insights").then(setIns).catch(() => {
    });
  }, []);
  const toast2 = (text) => {
    const id2 = Date.now() + Math.random();
    setToasts((t2) => [...t2, { id: id2, text }]);
    setTimeout(() => setToasts((t2) => t2.filter((x2) => x2.id !== id2)), 5200);
  };
  const pipe = useCountUp(Math.round(m2.pipeline_open_value || 0));
  const wonM = useCountUp(Math.round(d.won_value || 0));
  if (!home) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card animIn", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Assembling your command center…" }) });
  Math.max(1, ...home.activity_series.map((s) => s.count));
  const auto = home.agent.automations || {};
  const autoNames = [["auto_score", "Scoring"], ["auto_assign", "Assignment"], ["auto_dedupe", "De-dupe"], ["auto_reactivate", "Reactivation"]];
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const KINDC = { callback: ["#fef9c3", "📞"], visit: ["#fce7f3", "📍"], schedule: ["#dbeafe", "👷"], task: ["#dcfce7", "✅"], followup: ["#ede9fe", "🔁"], invoice: ["#ffedd5", "🧾"], doc: ["#fee2e2", "📄"], expiry: ["#fef3c7", "⏳"], job: ["#e0e7ff", "🛠"] };
  [...Array(7)].map((_, i) => {
    const dt2 = new Date(Date.now() + i * 864e5);
    return { key: dt2.toISOString().slice(0, 10), dow: dt2.toLocaleDateString(void 0, { weekday: "narrow" }), num: dt2.getDate(), has: home.upcoming.some((u2) => u2.date === dt2.toISOString().slice(0, 10)) };
  });
  const byDay = /* @__PURE__ */ new Map();
  for (const u2 of home.upcoming) {
    if (!byDay.has(u2.date)) byDay.set(u2.date, []);
    byDay.get(u2.date).push(u2);
  }
  const STC = { NEW: "info", WORKING: "warn", QUALIFIED: "info", PROPOSAL: "warn", SENT: "info", FOLLOWUP: "warn", WON: "pass", LOST: "fail", NO_RESPONSE: "warn", CLOSED: "info", JUNK: "fail" };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(OnboardingCard, { go }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "homeGrid", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "statRow", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "statCard animIn", style: { animationDelay: "0ms", ["--glow"]: "#22c55e" }, onClick: () => go({ view: "leads", leads: { bucket: "proposal" } }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ic", style: { background: "#dcfce7" }, children: "💵" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "v", children: [
              "$",
              num(pipe)
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "l", children: "Open pipeline — qualified → sent" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "statCard animIn", style: { animationDelay: "60ms", ["--glow"]: "#f59e0b" }, onClick: () => go({ view: "leads", leads: { bucket: "proposal" } }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ic", style: { background: "#fef9c3" }, children: "📨" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "v", children: [
              home.proposals_sent_week,
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: 14, color: "#94a3b8" }, children: [
                " / ",
                home.proposals_built_week,
                " built"
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "l", children: [
              "Proposals sent this week ★ North Star",
              home.proposals_test_week > 0 ? ` — ${home.proposals_test_week} in test mode (not delivered)` : ""
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "statCard animIn", style: { animationDelay: "120ms", ["--glow"]: "#38bdf8" }, onClick: () => go({ view: "approvals" }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ic", style: { background: "#dbeafe" }, children: "✅" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "v", children: m2.first_pass_approval_rate !== null && m2.first_pass_approval_rate !== void 0 ? m2.first_pass_approval_rate + "%" : "—" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "l", children: "First-pass approval · target 90%" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "statCard animIn", style: { animationDelay: "180ms", ["--glow"]: "#e879f9" }, onClick: () => go({ view: "leads", leads: { bucket: "won" } }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ic", style: { background: "#fce7f3" }, children: "🏆" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "v", children: [
              "$",
              num(wonM)
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "l", children: [
              "Won value — ",
              num(m2.won),
              " deals all time"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(FinancesStrip, { f: home.finances }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(PeriodsStrip, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "agentCard animIn", style: { animationDelay: "120ms" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 16 }, children: "🤖 Workpile Agent" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 12.5, display: "flex", gap: 7, alignItems: "center" }, children: home.agent.active_count > 0 ? `🟢 Armed — ${home.agent.active_count} of 4 automations on${((_a = home.agent.runs) == null ? void 0 : _a[0]) ? ` · last ran ${(() => {
              const h = Math.max(0, Math.round((Date.now() - new Date(home.agent.runs[0].created_at).getTime()) / 36e5));
              return h < 1 ? "under an hour ago" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
            })()}` : ""}` : "⏸ Paused — all automations off" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { opacity: 0.85, fontSize: 13, margin: "6px 0 10px" }, children: [
            "The agent works the backlog between your logins — scoring, assigning, de-duping, reactivating — inside your guardrails: nothing customer-facing sends without approval, prices only ever come from the price book. ",
            auto.last_automation_at ? `Last run ${dt(auto.last_automation_at)}.` : "It hasn't run yet."
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 10 }, children: [
            autoNames.map(([k2, l2]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "tinyBadge", style: { background: auto[k2] ? "#22c55e" : "rgba(255,255,255,.18)", color: "#fff", border: 0 }, children: [
              auto[k2] ? "✓" : "○",
              " ",
              l2
            ] }, k2)),
            (home.untouched_count || 0) > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn small", style: { background: "#fde047", color: "#713f12", position: "relative", zIndex: 1, fontWeight: 700 }, onClick: async () => {
              const r2 = await api("/api/agent/triage-untouched", { method: "POST", body: {} }).catch(() => null);
              if (r2) window.dispatchEvent(new CustomEvent("wp-agent", { detail: { executionId: r2.id } }));
            }, children: [
              "⚡ Handle ",
              home.untouched_count,
              " untouched — AI does the work, you approve the sends"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { background: "#fff", color: "#14532d", position: "relative", zIndex: 1 }, onClick: () => setRunOpen(true), children: "▶ Run agent now" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { color: "#fff", borderColor: "rgba(255,255,255,.45)", background: "transparent", position: "relative", zIndex: 1 }, onClick: () => go({ view: "ai" }), children: "Open AI Assistant" })
          ] }),
          home.agent.runs.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: 1 }, children: home.agent.runs.slice(0, 3).map((r2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "agentRun", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: r2.agent }),
            " — ",
            r2.summary,
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { opacity: 0.7 }, children: [
              "· ",
              dt(r2.created_at)
            ] })
          ] }, i)) }),
          ins.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: 10, position: "relative", zIndex: 1 }, children: ins.slice(0, 2).map((i, k2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: 13, padding: "5px 0", borderTop: "1px solid rgba(255,255,255,.15)" }, children: [
            i.icon,
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: i.title }),
            " — ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { opacity: 0.85 }, children: i.detail })
          ] }, k2)) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card animIn", style: { animationDelay: "200ms" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { marginTop: 0 }, children: [
            "Activity ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { fontWeight: 400, fontSize: 12.5 }, children: "every action the team + agent took, per day" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { float: "right" }, className: "segPills", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: actRange === 14 ? "on" : "", onClick: () => setActRange(14), children: "14 days" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: actRange === 30 ? "on" : "", onClick: () => setActRange(30), children: "30 days" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "actBars", children: home.activity_series.slice(30 - actRange).map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `ab ${s.day === todayStr ? "today" : ""}`, title: `${s.label}: ${s.count} actions`, style: { height: `${Math.max(3, 100 * s.count / Math.max(1, ...home.activity_series.slice(30 - actRange).map((x2) => x2.count)))}%`, transitionDelay: `${i * 18}ms` } }, i)) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { fontSize: 11.5 }, children: (_b = home.activity_series[30 - actRange]) == null ? void 0 : _b.label }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", style: { fontSize: 11.5 }, children: [
              (_c = home.activity_series[29]) == null ? void 0 : _c.label,
              " · today ●"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card animIn", style: { animationDelay: "260ms" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { marginTop: 0 }, children: [
            "Recently assigned ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "more", onClick: () => go({ view: "leads" }), children: "View all →" })
          ] }),
          home.recently_assigned.map((l2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "recentRow animIn", style: { animationDelay: `${i * 55}ms` }, onClick: () => openLead(l2.id), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "avatar", children: (l2.contact_name || "?").split(" ").map((x2) => x2[0]).slice(0, 2).join("") }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: l2.contact_name || "—" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "muted", style: { fontSize: 12.5 }, children: [
                l2.service_requested,
                " · ",
                money(l2.est_value),
                l2.ai_score ? ` · AI score ${l2.ai_score}` : ""
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", style: { fontSize: 12.5 }, children: [
              relTime(l2.created_at),
              /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
              l2.owner_name || "Unassigned"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${STC[l2.state] || "info"}`, children: l2.state.replaceAll("_", " ") })
          ] }, l2.id)),
          home.recently_assigned.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No leads yet — import a CSV or connect a source and the agent starts working." })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card animIn", style: { animationDelay: "200ms" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { marginTop: 0 }, children: [
            "Goal — first-pass approval ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "seeAll", onClick: () => go({ view: "approvals" }), children: "Approvals ↗" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(GoalGauge, { pct: m2.first_pass_approval_rate, target: 90 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { textAlign: "center", fontSize: 12.5, margin: "2px 0 4px" }, children: m2.first_pass_approval_rate >= 90 ? "🎉 Target beaten — the agent's drafts are landing first try." : "Proposals approved without changes ÷ decided. The agent's drafting quality drives this." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card animIn", style: { animationDelay: "150ms" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { marginTop: 0 }, children: [
            "📅 Calendar ",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { float: "right", display: "flex", gap: 4 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => {
                const d2 = /* @__PURE__ */ new Date(calDay + "T12:00:00");
                d2.setDate(d2.getDate() - 7);
                setCalDay(d2.toISOString().slice(0, 10));
              }, children: "‹ Week" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setCalDay(todayStr), children: "Today" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => {
                const d2 = /* @__PURE__ */ new Date(calDay + "T12:00:00");
                d2.setDate(d2.getDate() + 7);
                setCalDay(d2.toISOString().slice(0, 10));
              }, children: "Week ›" })
            ] })
          ] }),
          (() => {
            const monday = /* @__PURE__ */ new Date(calDay + "T12:00:00");
            monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
            const days = [...Array(7)].map((_, i) => {
              const d2 = new Date(monday);
              d2.setDate(d2.getDate() + i);
              const key = d2.toISOString().slice(0, 10);
              return { key, dow: d2.toLocaleDateString(void 0, { weekday: "narrow" }), num: d2.getDate(), n: home.upcoming.filter((u2) => u2.date === key).length };
            });
            const dayItems = home.upcoming.filter((u2) => u2.date === calDay);
            const overdue = calDay === todayStr ? home.upcoming.filter((u2) => u2.date < todayStr && !calDone.has(u2.task_id || "")) : [];
            const row = (u2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "upCard", style: { background: (KINDC[u2.kind] || ["#f1f5f9"])[0], animationDelay: `${i * 40}ms`, opacity: calDone.has(u2.task_id || "") ? 0.45 : 1 }, onClick: () => u2.lead_id && openLead(u2.lead_id), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "upIc", children: (KINDC[u2.kind] || ["", "•"])[1] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "upMain", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: u2.title }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "upSub", children: [
                  u2.sub,
                  u2.time && u2.time !== "00:00" ? ` · ${u2.time}` : ""
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "upAct", children: u2.kind === "task" && u2.task_id && !calDone.has(u2.task_id) ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small upDone", onClick: async (e) => {
                e.stopPropagation();
                await api(`/api/tasks/${u2.task_id}/complete`, { method: "POST", body: {} }).catch(() => {
                });
                setCalDone((prev) => new Set(prev).add(u2.task_id));
                toast2("Task done ✓");
              }, children: "✓ Done" }) : u2.time && u2.time !== "00:00" ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "upTime", children: u2.time }) : null })
            ] }, (u2.task_id || u2.kind + u2.date + u2.title) + i);
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "weekStrip", children: days.map((wd2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { onClick: () => setCalDay(wd2.key), style: { cursor: "pointer" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "wd", children: wd2.dow }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `wn ${wd2.key === todayStr ? "today" : ""} ${wd2.n ? "has" : ""}`, style: wd2.key === calDay ? { outline: "2.5px solid #166534", outlineOffset: 1 } : void 0, children: wd2.num }),
                wd2.n > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: 10, textAlign: "center", color: "#64748b" }, children: [
                  wd2.n,
                  " item",
                  wd2.n === 1 ? "" : "s"
                ] })
              ] }, wd2.key)) }),
              overdue.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 6 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "muted", style: { fontSize: 12, fontWeight: 700, color: "#b3261e" }, children: [
                  "⚠ Overdue (",
                  overdue.length,
                  ")"
                ] }),
                overdue.slice(0, 5).map(row),
                overdue.length > 5 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { fontSize: 12 }, children: [
                  "+",
                  overdue.length - 5,
                  " more overdue — work them in the Queue."
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "muted", style: { fontSize: 12, fontWeight: 700, margin: "10px 0 6px" }, children: calDay === todayStr ? "Today" : (/* @__PURE__ */ new Date(calDay + "T12:00:00")).toLocaleDateString(void 0, { weekday: "long", month: "short", day: "numeric" }) }),
              dayItems.map(row),
              dayItems.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Nothing scheduled this day — visits, crew days, tasks, follow-ups, callbacks, invoice due dates and expiries all land here." })
            ] });
          })(),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { marginTop: 4 }, onClick: () => {
            var _a2;
            return (_a2 = window.wpGoTab) == null ? void 0 : _a2.call(window, "planner", "calendar");
          }, children: "Open full calendar →" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card animIn", style: { animationDelay: "220ms" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Quick links" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "qlRow", onClick: () => go({ view: "myday" }), children: [
            "🌅 Today's plan ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { marginLeft: "auto" }, children: "›" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "qlRow", onClick: () => {
            var _a2;
            return (_a2 = window.wpGoTab) == null ? void 0 : _a2.call(window, "planner", "tasks");
          }, children: [
            "🔁 Follow-ups & tasks ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { marginLeft: "auto" }, children: "›" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "qlRow", onClick: () => go({ view: "queue" }), children: [
            "⚡ Work the backlog ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { marginLeft: "auto" }, children: "›" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "qlRow", onClick: () => go({ view: "approvals" }), children: [
            "✅ Approvals inbox ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { marginLeft: "auto" }, children: "›" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "qlRow", onClick: () => go({ view: "reports" }), children: [
            "📊 Monthly target & reports ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { marginLeft: "auto" }, children: "›" })
          ] })
        ] })
      ] })
    ] }),
    runOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(AgentRunModal, { close: () => setRunOpen(false), done: (msg) => {
      setRunOpen(false);
      toast2(msg);
      api("/api/home").then(setHome).catch(() => {
      });
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "toastBox", children: toasts.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "toast", children: [
      "✅ ",
      t2.text
    ] }, t2.id)) })
  ] });
}
function AgentRunModal({ close, done }) {
  const [phase, setPhase] = reactExports.useState(0);
  const [result, setResult] = reactExports.useState(null);
  const [err, setErr] = reactExports.useState("");
  const stepsRef = reactExports.useRef([]);
  reactExports.useEffect(() => {
    (async () => {
      const auto = await api("/api/ai/automations").catch(() => ({}));
      const plan2 = [];
      if (auto.auto_score) plan2.push(["score", "🎯", "Scoring every lead", "scored", "leads scored"]);
      if (auto.auto_assign) plan2.push(["assign", "👤", "Assigning unowned leads", "assigned", "leads assigned"]);
      if (auto.auto_dedupe) plan2.push(["dedupe", "🧹", "Merging duplicates", "archived_duplicates", "duplicates archived"]);
      if (auto.auto_reactivate) plan2.push(["reactivate", "🔁", "Reactivating stale leads", "reactivation_tasks", "follow-up tasks created"]);
      stepsRef.current = plan2;
      if (!plan2.length) {
        setErr("All four automations are off — the agent has nothing it's allowed to do. Turn them on in AI Assistant → Auto-pilot, or below.");
        return;
      }
      const r2 = await api("/api/ai/automations/run", { method: "POST", body: {} }).catch((e) => ({ error: e.message }));
      if (r2.error) {
        setErr(r2.error);
        return;
      }
      setResult(r2.result || {});
      for (let i = 0; i <= plan2.length; i++) {
        setPhase(i);
        await new Promise((res) => setTimeout(res, 650));
      }
    })();
  }, []);
  const plan = stepsRef.current;
  const summary = result ? [["scored", "scored"], ["assigned", "assigned"], ["archived_duplicates", "duplicates archived"], ["reactivation_tasks", "reactivation tasks"]].filter(([k2]) => result[k2] > 0).map(([k2, l2]) => `${result[k2]} ${l2}`).join(" · ") : "";
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", onClick: close, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", style: { maxWidth: 520 }, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "🤖 Agent run" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { marginTop: 0 }, children: "Controlled autonomy: the agent executes the steps you've switched on, logs every action, and stops at your approval gates." }),
    err && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: err }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
          await api("/api/ai/automations", { method: "POST", body: { auto_score: true, auto_assign: true, auto_dedupe: true, auto_reactivate: true } });
          done("All automations switched on — run the agent again any time");
        }, children: "Switch all four on" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: close, children: "Close" })
      ] })
    ] }),
    !err && plan.map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stepRow", children: [
      phase > i ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 17 }, children: "✅" }) : phase === i ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stepSpin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { opacity: 0.35, fontSize: 17 }, children: s[1] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1, opacity: phase >= i ? 1 : 0.45 }, children: s[2] }),
      phase > i && result && /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        result[s[3]] ?? 0,
        " ",
        s[4]
      ] })
    ] }, s[0])),
    !err && result && phase > plan.length - 1 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ok", children: [
        "Run complete — ",
        summary || "everything was already clean; no changes needed",
        "."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { marginTop: 10 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => done(`Agent run complete — ${summary || "no changes needed"}`), children: "Done" }) })
    ] }),
    !err && !result && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Starting…" })
  ] }) });
}
function Dashboard({ go, openLead }) {
  const [d, setD] = reactExports.useState(null);
  const [ins, setIns] = reactExports.useState([]);
  const [brief, setBrief] = reactExports.useState(null);
  reactExports.useEffect(() => {
    api("/api/dashboard").then(setD).catch(() => {
    });
    api("/api/ai/insights").then(setIns).catch(() => {
    });
    api("/api/brief").then(setBrief).catch(() => {
    });
  }, []);
  if (!d) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading dashboard…" });
  const m2 = d.metrics;
  const maxF = Math.max(1, ...d.funnel.map((f2) => f2.count));
  const maxS = Math.max(1, ...d.series.map((s) => s.created + s.won));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Dashboard" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Every number is live and clickable — drill straight into the records behind it." }),
    brief && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "briefCard", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "briefTag", children: [
          "☀️ MORNING BRIEF — ",
          dOnly(brief.generated_at)
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "briefHead", children: brief.headline }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chipRow", style: { marginTop: 10 }, children: [
          brief.pending_approvals > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "chip on", onClick: () => go({ view: "approvals" }), children: [
            brief.pending_approvals,
            " approvals waiting →"
          ] }),
          brief.undelivered_finals > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "chip", onClick: () => go({ view: "handoffs" }), children: [
            brief.undelivered_finals,
            " finals not yet picked up →"
          ] }),
          brief.backlog_remaining > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "chip", onClick: () => go({ view: "leads", leads: { bucket: "new" } }), children: [
            brief.backlog_remaining,
            " in backlog →"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", onClick: () => go({ view: "ai" }), children: "🤖 AI insights →" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "briefSide", children: (brief.stuck || []).slice(0, 3).map((t2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        "⏰ ",
        t2.service_requested,
        " — ",
        t2.state.replaceAll("_", " ").toLowerCase(),
        ", overdue"
      ] }, i)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(HomeDash, { go, openLead, m: m2, d }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardPins, {}),
    ins.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
        "🤖 AI insights ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "more", onClick: () => go({ view: "ai" }), children: "Open AI Assistant →" })
      ] }),
      ins.slice(0, 3).map((i, k2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "insight", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ic", children: i.icon }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: i.title }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: i.detail })
        ] })
      ] }, k2))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card funnel", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
          "Pipeline funnel ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "more", onClick: () => go({ view: "leads" }), children: "Open leads →" })
        ] }),
        d.funnel.map((f2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "row", onClick: () => go({ view: "leads", leads: { state: f2.state } }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fl", children: f2.state.replaceAll("_", " ") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bar", style: { width: `${Math.max(2, 100 * f2.count / maxF)}%` } }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "fv", children: [
            num(f2.count),
            " · ",
            money(f2.value)
          ] })
        ] }, f2.state))
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
          "Approvals waiting ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "more", onClick: () => go({ view: "approvals" }), children: "Inbox →" })
        ] }),
        d.approvals_pending.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Inbox zero. Nothing waiting on you." }),
        d.approvals_pending.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "feed", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ev", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: a.service_requested }),
          " · ",
          money(a.est_value),
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            a.tier,
            " tier · submitted ",
            dt(a.submitted_at)
          ] })
        ] }) }, a.id))
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Last 14 days — new vs won" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bars", children: d.series.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stk", style: { height: `${Math.max(3, 100 * (s.created + s.won) / maxS)}px` }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "c2", style: { height: `${100 * s.created / Math.max(1, s.created + s.won)}%` } }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "c1", style: { height: `${100 * s.won / Math.max(1, s.created + s.won)}%` } })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "dl", children: s.day })
        ] }, s.day)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { fontSize: 12 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#0ea5e9" }, children: "■" }),
          " new leads · ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#22c55e" }, children: "■" }),
          " won"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
          "By service ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "more", onClick: () => go({ view: "demand" }), children: "Demand gap →" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Service" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Leads" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Won" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Value" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: d.by_service.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "clickable", onClick: () => go({ view: "leads", leads: { service: s.service } }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: s.service }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(s.leads) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(s.won) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: money(s.value) })
          ] }, s.service)) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Team leaderboard" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Owner" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Active" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Won" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Lost" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: m2.by_owner.map((o, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: o.name || "Unassigned" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(o.active) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(o.won) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(o.lost) })
          ] }, i)) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { fontSize: 12.5 }, children: [
          "Field-report compliance: ",
          m2.field_report_compliance_pct ?? "—",
          "%"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Recent activity" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "feed", children: d.recent_events.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ev", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: e.contact_name || e.service_requested || "Lead" }),
          " — ",
          e.type.replaceAll("_", " "),
          e.to_state ? ` → ${e.to_state}` : "",
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: dt(e.created_at) })
        ] }, e.id)) })
      ] })
    ] })
  ] });
}
function Leads({ initial, openLead, users, me: me2 }) {
  const [sel, setSel] = reactExports.useState(/* @__PURE__ */ new Set());
  const [bulkMsg, setBulkMsg] = reactExports.useState("");
  const bulk = async (action, extra = {}) => {
    var _a;
    const r2 = await api("/api/leads/bulk", { method: "POST", body: { ids: [...sel], action, ...extra } }).catch((e) => ({ error: e.message }));
    if (r2.error) {
      setBulkMsg("Error: " + r2.error);
      return;
    }
    setBulkMsg(`Done: ${r2.ok} updated, ${r2.skipped} skipped${((_a = r2.details) == null ? void 0 : _a.length) ? " — " + r2.details.slice(0, 2).map((d) => d.reason).join("; ") : ""}`);
    setSel(/* @__PURE__ */ new Set());
    setTickFix((t2) => t2 + 1);
  };
  const [syncOpen, setSyncOpen] = reactExports.useState(false);
  const [mode, setMode] = reactExports.useState((initial == null ? void 0 : initial.mode) === "dupes" ? "dupes" : "table");
  reactExports.useEffect(() => {
    if ((initial == null ? void 0 : initial.mode) === "dupes") setMode("dupes");
  }, [initial]);
  const [f2, setF] = reactExports.useState(initial || {});
  const [data, setData] = reactExports.useState({ items: [], total: 0, page: 1, pages: 1 });
  const [board, setBoard] = reactExports.useState({});
  const [tickFix, setTickFix] = reactExports.useState(0);
  const load = () => {
    const qs = new URLSearchParams({ paged: "1", page: String(f2.page || 1), page_size: "50", sort: f2.sort || "recent" });
    for (const k2 of ["state", "bucket", "q", "service", "owner_id", "overdue", "min_value", "unassigned"]) if (f2[k2]) qs.set(k2, f2[k2]);
    api("/api/leads?" + qs).then(setData).catch(() => {
    });
  };
  reactExports.useEffect(load, [JSON.stringify(f2), tickFix]);
  const [bstats, setBstats] = reactExports.useState(null);
  const [dragId, setDragId] = reactExports.useState("");
  const loadBoard = () => {
    const o = {};
    Promise.all(BOARD_STAGES.map(([st]) => api(st === "CLOSED" ? `/api/leads?paged=1&bucket=closed&page=1&page_size=25` : `/api/leads?paged=1&state=${st}&page=1&page_size=25`).then((r2) => {
      o[st] = r2;
    }))).then(() => setBoard({ ...o }));
    api("/api/board-stats").then(setBstats).catch(() => {
    });
  };
  reactExports.useEffect(() => {
    if (mode === "board") loadBoard();
  }, [mode, tickFix]);
  const dropStage = async (st) => {
    if (!dragId || st === "CLOSED") return;
    try {
      await api(`/api/leads/${dragId}/stage`, { method: "POST", body: { to: st } });
    } catch (e) {
      if (e.message === "won_needs_confirmation" && confirm("No signed proposal on this lead. Mark WON as a verbal/legacy win and create the job?")) {
        await api(`/api/leads/${dragId}/stage`, { method: "POST", body: { to: st, confirm_no_proposal: true } }).catch(() => {
        });
      } else if (e.message === "reason_required") {
        const r2 = prompt("Reason for closing (price, timing, competitor, unresponsive…):");
        if (r2) await api(`/api/leads/${dragId}/stage`, { method: "POST", body: { to: "LOST", lost_reason: r2 } }).catch(() => {
        });
      }
    }
    setDragId("");
    loadBoard();
    setTickFix((t2) => t2 + 1);
  };
  const Pager = () => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pager", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
      num(data.total),
      " leads · page ",
      data.page,
      " of ",
      num(data.pages)
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", disabled: data.page <= 1, onClick: () => setF({ ...f2, page: data.page - 1 }), children: "← Prev" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", disabled: data.page >= data.pages, onClick: () => setF({ ...f2, page: data.page + 1 }), children: "Next →" })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "pt", children: [
      "Leads ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { float: "right" }, onClick: () => setSyncOpen(true), children: "⇅ Sync leads" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Search, filter, sort — built for thousands of records. Click any row to open the full record." }),
    syncOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(SyncModal, { close: () => setSyncOpen(false), done: () => setTickFix((t2) => t2 + 1) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { flex: 1, minWidth: 220 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "search", placeholder: "Search name, phone, email, service, notes…", value: f2.q || "", onChange: (e) => setF({ ...f2, q: e.target.value, page: 1 }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 180 }, value: f2.sort || "recent", onChange: (e) => setF({ ...f2, sort: e.target.value }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "recent", children: "Newest first" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "value", children: "Highest value" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 190 }, value: f2.owner_id || "", onChange: (e) => setF({ ...f2, owner_id: e.target.value, page: 1 }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "All owners" }),
        users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: u2.id, children: u2.name }, u2.id))
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", style: { border: 0, margin: 0 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: mode === "table" ? "on" : "", onClick: () => setMode("table"), children: "Table" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: mode === "board" ? "on" : "", onClick: () => setMode("board"), children: "Board" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: mode === "dupes" ? "on" : "", onClick: () => setMode("dupes"), children: "Duplicates" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chips", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { alignSelf: "center", fontWeight: 700, fontSize: 12 }, children: "SAVED VIEWS:" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", onClick: () => setF({ page: 1 }), children: "All leads" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", onClick: () => setF({ page: 1, owner_id: me2 == null ? void 0 : me2.id }), children: "My leads" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", onClick: () => setF({ page: 1, overdue: "1" }), children: "⏰ Overdue next steps" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", onClick: () => setF({ page: 1, min_value: "10000", sort: "value" }), children: "💰 High value $10k+" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", onClick: () => setF({ page: 1, unassigned: "1" }), children: "Unassigned" })
    ] }),
    sel.size > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ok", style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        sel.size,
        " selected"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "bulkOwner", style: { width: 170 }, defaultValue: "", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Assign to…" }),
        users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: u2.id, children: u2.name }, u2.id))
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: () => {
        const v2 = document.getElementById("bulkOwner").value;
        if (v2) bulk("assign", { owner_id: v2 });
      }, children: "Assign" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: () => bulk("advance"), children: "Advance stage →" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small ghost", onClick: () => bulk("snooze", { days: 7 }), children: "Snooze 7 days" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small danger", onClick: () => bulk("archive_junk"), children: "Archive as junk" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small ghost", onClick: () => setSel(/* @__PURE__ */ new Set()), children: "Clear" }),
      bulkMsg && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: bulkMsg })
    ] }),
    bulkMsg && sel.size === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: bulkMsg }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chips", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: `chip ${!f2.bucket && !f2.state ? "on" : ""}`, onClick: () => setF({ ...f2, bucket: "", state: "", page: 1 }), children: "All" }),
      BUCKETS.map(([b, lab]) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: `chip ${f2.bucket === b ? "on" : ""}`, onClick: () => setF({ ...f2, bucket: b, state: "", page: 1 }), children: lab }, b)),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 200 }, value: f2.state || "", onChange: (e) => setF({ ...f2, state: e.target.value, bucket: "", page: 1 }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Any exact state…" }),
        STATES.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: s, children: s.replaceAll("_", " ") }, s))
      ] }),
      f2.service && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "chip on", onClick: () => setF({ ...f2, service: "" }), children: [
        "Service: ",
        f2.service,
        " ✕"
      ] })
    ] }),
    mode === "dupes" ? /* @__PURE__ */ jsxRuntimeExports.jsx(DuplicatesView, { embedded: true }) : mode === "table" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: 6 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { style: { width: 30 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto" }, checked: data.items.length > 0 && data.items.every((l2) => sel.has(l2.id)), onChange: (e) => setSel(e.target.checked ? new Set(data.items.map((l2) => l2.id)) : /* @__PURE__ */ new Set()) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Contact" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Service" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "AI Score" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "State" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Value" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Owner" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Next step" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Created" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
          data.items.map((l2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "clickable", onClick: () => openLead(l2.id), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto" }, checked: sel.has(l2.id), onChange: () => {
              const n2 = new Set(sel);
              n2.has(l2.id) ? n2.delete(l2.id) : n2.add(l2.id);
              setSel(n2);
            } }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: l2.contact_name }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: l2.contact_phone || l2.contact_email || "" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: l2.service_requested }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: l2.ai_score !== null && l2.ai_score !== void 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `score ${JSON.parse(l2.ai_flags || "{}").temperature || "cold"}`, children: l2.ai_score }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "—" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value: l2.state, style: { width: 118, padding: "3px 5px", fontSize: 12.5 }, onChange: async (e) => {
              const to = e.target.value;
              try {
                await api(`/api/leads/${l2.id}/stage`, { method: "POST", body: { to } });
                setData({ ...data, items: data.items.map((x2) => x2.id === l2.id ? { ...x2, state: to } : x2) });
              } catch (err) {
                alert(err.message === "won_needs_confirmation" || err.message === "reason_required" ? "That close needs the record — click the row to finish it with a reason/confirmation." : err.message);
              }
            }, children: STATES.map((st) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: st, children: st.replaceAll("_", " ") }, st)) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: money(l2.est_value) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: l2.owner_id || "", style: { width: 130, padding: "3px 5px", fontSize: 12.5 }, onChange: async (e) => {
              await api(`/api/leads/${l2.id}`, { method: "PATCH", body: { owner_id: e.target.value || null } });
              setData({ ...data, items: data.items.map((x2) => {
                var _a;
                return x2.id === l2.id ? { ...x2, owner_id: e.target.value, owner_name: (_a = users.find((u2) => u2.id === e.target.value)) == null ? void 0 : _a.name } : x2;
              }) });
            }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Unassigned" }),
              users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: u2.id, children: u2.name }, u2.id))
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              l2.next_action || "—",
              /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: dOnly(l2.next_action_due_at) })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: dOnly(l2.created_at) })
          ] }, l2.id)),
          data.items.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 7, className: "muted", children: "No leads match these filters." }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Pager, {})
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "kanban", children: BOARD_STAGES.map(([st, lab]) => {
      var _a, _b, _c, _d;
      const bs = (_a = bstats == null ? void 0 : bstats.stages) == null ? void 0 : _a[st];
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kcol", onDragOver: (e) => e.preventDefault(), onDrop: () => dropStage(st), style: st === "CLOSED" ? { opacity: 0.85 } : {}, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
          lab,
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: num(((_b = board[st]) == null ? void 0 : _b.total) ?? 0) })
        ] }),
        bs && st !== "CLOSED" && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { fontSize: 11.5, margin: "0 0 6px" }, children: [
          money(bs.value),
          " · median ",
          bs.median_age_days,
          "d",
          bs.rotting ? ` · ⚠ ${bs.rotting} rotting` : ""
        ] }),
        (((_c = board[st]) == null ? void 0 : _c.items) || []).map((l2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kcard", draggable: true, onDragStart: () => setDragId(l2.id), onClick: () => openLead(l2.id), style: l2.hold_flag ? { borderLeft: "4px solid #b45309" } : {}, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: l2.service_requested }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "m", children: [
            l2.contact_name,
            " · ",
            money(l2.est_value),
            /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
            l2.hold_flag ? "⏸ on hold · " : "",
            "next ",
            dOnly(l2.next_action_due_at),
            !l2.next_action_due_at ? " · ⚠ no next step" : ""
          ] })
        ] }, l2.id)),
        (((_d = board[st]) == null ? void 0 : _d.total) || 0) > 25 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { fontSize: 12 }, children: [
          "+ ",
          num(board[st].total - 25),
          " more — use Table view to page through all"
        ] })
      ] }, st);
    }) }),
    mode === "board" && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12.5 }, children: "Drag cards between stages — backward, forward, skip: all allowed. Dropping on Won asks for confirmation when there's no signed proposal; Closed is display-only (close from the record, with a reason)." })
  ] });
}
function MessagesPanel({ lead }) {
  const [msgs, setMsgs] = reactExports.useState([]);
  const [ch2, setCh] = reactExports.useState("email");
  const [subject, setSubject] = reactExports.useState("");
  const [body, setBody] = reactExports.useState("");
  const [note, setNote] = reactExports.useState("");
  const [fups, setFups] = reactExports.useState([]);
  const loadF = () => {
    api(`/api/leads/${lead.id}/followups`).then(setFups).catch(() => {
    });
  };
  reactExports.useEffect(loadF, []);
  const load = () => {
    api(`/api/leads/${lead.id}/messages`).then(setMsgs).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const send = async () => {
    const r2 = await api(`/api/leads/${lead.id}/message`, { method: "POST", body: { channel: ch2, subject, body } }).catch((e) => ({ error: e.message }));
    if (r2.error) {
      setNote("Not sent: " + r2.error);
      return;
    }
    setNote(`Queued via ${ch2} → status: ${r2.status}${r2.status === "test_mode" ? " (test mode — recorded in the outbox, not actually sent until provider keys are set)" : ""}`);
    setBody("");
    setSubject("");
    load();
  };
  const activeFup = fups.find((f2) => f2.status === "active");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { marginTop: 0 }, children: [
      "Messages to ",
      lead.contact_name || "customer"
    ] }),
    activeFup && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ok", style: { marginBottom: 10 }, children: [
      "🔁 Automatic follow-ups running — step ",
      (activeFup.step_idx || 0) + 1,
      ", next nudge ",
      dt(activeFup.next_due_at),
      ". Stops on signature or final outcome. ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        await api(`/api/leads/${lead.id}/followups/stop`, { method: "POST", body: {} });
        loadF();
      }, children: "Stop sequence" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chipRow", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: `chip ${ch2 === "email" ? "on" : ""}`, onClick: () => setCh("email"), children: [
        "✉ Email ",
        lead.contact_email || "(none on file)"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: `chip ${ch2 === "sms" ? "on" : ""}`, onClick: () => setCh("sms"), children: [
        "💬 SMS ",
        lead.contact_phone || "(none)",
        lead.consent_contact_ok ? "" : " · no consent"
      ] })
    ] }),
    ch2 === "email" && /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Subject", value: subject, onChange: (e) => setSubject(e.target.value), style: { marginBottom: 8 } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { placeholder: ch2 === "sms" ? "Text message…" : "Message…", value: body, onChange: (e) => setBody(e.target.value), rows: 4, style: { width: "100%" } }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn", disabled: !body.trim(), onClick: send, children: [
        "Send ",
        ch2 === "sms" ? "text" : "email"
      ] }),
      note && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: note })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { marginBottom: 6 }, children: "History" }),
    msgs.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Nothing sent yet." }),
    msgs.map((m2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "6px 0", borderBottom: "1px solid #eef2f7", paddingBottom: 6, ...m2.direction === "in" ? { background: "#f0f9ff", borderRadius: 8, padding: 8 } : {} }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        m2.direction === "in" ? "↩ Customer reply" : m2.channel === "sms" ? "💬" : "✉",
        " ",
        m2.direction === "in" ? "" : m2.to_addr
      ] }),
      " · ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: m2.status }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: dt(m2.created_at) }),
      m2.subject ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: m2.subject })
      ] }) : "",
      /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: m2.body.slice(0, 220) })
    ] }, m2.id))
  ] });
}
function CrewTime({ lead, users, reloadLead }) {
  const [lab, setLab] = reactExports.useState(null);
  const [msg, setMsg] = reactExports.useState("");
  const [form, setForm] = reactExports.useState({ worker_name: "", entry_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), hours: "", note: "" });
  const [addUser, setAddUser] = reactExports.useState("");
  const [roster, setRoster] = reactExports.useState([]);
  reactExports.useEffect(() => {
    api("/api/workers").then(setRoster).catch(() => {
    });
  }, []);
  const load = () => {
    api("/api/leads/" + lead.id + "/labor").then(setLab).catch(() => {
    });
  };
  reactExports.useEffect(load, [lead.id]);
  if (!lab) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading crew & time…" });
  const sector = lead.sector || "private";
  const setLeadField = async (patch, ok2) => {
    await api("/api/leads/" + lead.id, { method: "PATCH", body: patch });
    setMsg(ok2);
    reloadLead && reloadLead();
  };
  const logTime = async () => {
    if (!form.worker_name.trim() || !(Number(form.hours) > 0)) return setMsg("Type a worker name and hours first — a name is all a worker needs, no account required.");
    const r2 = await offlinePost(`/api/leads/${lead.id}/time`, { worker_name: form.worker_name.trim(), entry_date: form.entry_date, hours: Number(form.hours), note: form.note }, "time entry");
    if (r2.__offline) {
      setMsg("📴 No signal — time saved on this device and queued to sync when you are back.");
      setForm({ ...form, hours: "", note: "" });
      return;
    }
    setMsg(r2.rated ? `Logged ${r2.entry.hours}h for ${r2.worker.name} at ${money(r2.entry.rate)}/hr (${r2.entry.class_name}, ${sector} rate) ✓` : `Logged for ${r2.worker.name} — but they have NO rate class, so it costed $0. Set their class in Settings → Workers.`);
    setForm({ ...form, hours: "", note: "" });
    load();
  };
  new Set(lab.crew.map((c) => c.worker_id || c.user_id));
  const margin = lead.est_value > 0 ? Math.round(lab.cost / lead.est_value * 100) : null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { margin: 0 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { marginTop: 0 }, children: "Project setup" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Sector — decides which rate column applies" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: sector, onChange: (e) => setLeadField({ sector: e.target.value }, "Sector saved ✓"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "private", children: "Private — standard rates" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "government", children: "Government — prevailing-wage rates" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Project manager" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: lead.pm_id || "", onChange: (e) => setLeadField({ pm_id: e.target.value || null }, "Project manager saved ✓"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "— Unassigned —" }),
          users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: u2.id, children: [
            u2.name,
            " (",
            u2.role,
            ")"
          ] }, u2.id))
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "The PM owns this job day-to-day; the crew below is who actually works (and gets costed) on it." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { margin: 0 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { marginTop: 0 }, children: "Labor on this job" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpis", style: { gridTemplateColumns: "1fr 1fr 1fr" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Hours" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: lab.hours }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: "logged to date" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Labor cost" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: money(lab.cost) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: margin !== null ? `${margin}% of ${money(lead.est_value)} job value` : "costed at logged rates" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Crew" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: lab.crew.length }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: "assigned workers" })
          ] })
        ] }),
        lab.unrated_hours > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "st fail", style: { display: "inline-block" }, children: [
          "⚠ ",
          lab.unrated_hours,
          "h logged with no rate class — costed $0. Fix in Settings → Labor & Rates."
        ] })
      ] })
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", style: { marginTop: 10 }, children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "Crew" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chipRow", children: [
      lab.crew.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "chip on", children: [
        c.name,
        " · ",
        c.class_name || "no class",
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { marginLeft: 6, padding: "0 6px" }, onClick: async () => {
          const r2 = await api(`/api/leads/${lead.id}/crew/${c.worker_id || c.user_id}`, { method: "DELETE" });
          setLab(r2);
        }, children: "✕" })
      ] }, c.id)),
      lab.crew.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "No crew yet — type a name below, or just log time and they're added automatically." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { list: "rosterNames", placeholder: "Add a worker by name…", value: addUser, onChange: (e) => setAddUser(e.target.value), style: { minWidth: 220 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", disabled: !addUser.trim(), onClick: async () => {
        const r2 = await api(`/api/leads/${lead.id}/crew`, { method: "POST", body: { worker_name: addUser.trim() } });
        setLab(r2);
        setAddUser("");
      }, children: "Add to crew" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "Workers are a roster — names only, no logins, no seats used." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "Log time against this job" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { list: "rosterNames", placeholder: "Worker name — type a new one to add them", value: form.worker_name, onChange: (e) => setForm({ ...form, worker_name: e.target.value }), style: { minWidth: 240 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("datalist", { id: "rosterNames", children: roster.filter((w2) => w2.active).map((w2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: w2.name, children: [
        w2.class_name || "no class",
        w2.linked_user_id ? " · team" : ""
      ] }, w2.id)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", value: form.entry_date, onChange: (e) => setForm({ ...form, entry_date: e.target.value }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", step: "0.25", placeholder: "Hours", style: { width: 90 }, value: form.hours, onChange: (e) => setForm({ ...form, hours: e.target.value }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Note (phase, task…)", value: form.note, onChange: (e) => setForm({ ...form, note: e.target.value }), style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: logTime, children: "Log time" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { style: { marginTop: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Date" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Worker" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Class" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Hours" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Rate" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Cost" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Note" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", {})
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
        lab.entries.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: e.entry_date }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: e.worker }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: e.class_name || /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st fail", children: "unrated" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: e.hours }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: e.rate > 0 ? money(e.rate) : "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: money(e.amount) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "muted", children: e.note }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            const r2 = await api("/api/time-entries/" + e.id, { method: "DELETE" });
            setLab(r2);
          }, children: "✕" }) })
        ] }, e.id)),
        lab.entries.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { colSpan: 8, className: "muted", children: [
          "No time logged yet. Every entry snapshots the worker's ",
          sector,
          " rate, so the job's true labor cost is always known — and later rate changes never rewrite history."
        ] }) })
      ] })
    ] })
  ] });
}
function LeadDetail({ id: id2, users, priceBook, close, refresh, openJob, openApprovals }) {
  var _a, _b;
  const [d, setD] = reactExports.useState(null);
  const [edit, setEdit] = reactExports.useState(null);
  const [msg, setMsg] = reactExports.useState("");
  const [act, setAct] = reactExports.useState({ type: "call", body: "", outcome: "" });
  const [sug, setSug] = reactExports.useState(null);
  reactExports.useEffect(() => {
    api("/api/ai/suggest/" + id2).then(setSug).catch(() => {
    });
  }, [id2, (_a = d == null ? void 0 : d.lead) == null ? void 0 : _a.state]);
  const [items, setItems] = reactExports.useState([]);
  const [check, setCheck] = reactExports.useState(null);
  const [tab, setTab] = reactExports.useState("details");
  const [overrideReason, setOverrideReason] = reactExports.useState("");
  const [finalPick, setFinalPick] = reactExports.useState(null);
  const [validDays, setValidDays] = reactExports.useState(30);
  const [useOpts, setUseOpts] = reactExports.useState(false);
  const [optB, setOptB] = reactExports.useState([]);
  const [optC, setOptC] = reactExports.useState([]);
  const [docTpls, setDocTpls] = reactExports.useState([]);
  const [docTpl, setDocTpl] = reactExports.useState("");
  reactExports.useEffect(() => {
    api("/api/doc-templates").then((l22) => {
      setDocTpls(l22);
      const d2 = l22.find((t2) => t2.is_default) || l22[0];
      if (d2) setDocTpl(d2.id);
    }).catch(() => {
    });
  }, []);
  const load = () => {
    api("/api/leads/" + id2).then((r2) => {
      setD(r2);
      setEdit({ ...r2.lead });
    }).catch((e) => setMsg(e.message));
  };
  reactExports.useEffect(load, [id2]);
  reactExports.useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  if (!d) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", children: [
    "Loading… ",
    msg
  ] }) });
  const l2 = d.lead;
  const PATH = ["NEW", "WORKING", "QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP", "WON"];
  const pathIdx = PATH.indexOf(l2.state);
  const save = async () => {
    try {
      await api("/api/leads/" + id2, { method: "PATCH", body: { service_requested: edit.service_requested, est_value: Number(edit.est_value) || 0, urgency: edit.urgency, owner_id: edit.owner_id, pm_id: edit.pm_id || null, approver_id: edit.approver_id || null, next_action: edit.next_action, notes: edit.notes, location: edit.location, contact: { name: edit.contact_name, phone: edit.contact_phone, email: edit.contact_email } } });
      setMsg("Saved ✓");
      load();
      refresh && refresh();
    } catch (e) {
      setMsg(e.message);
    }
  };
  const stageTo = async (to, extra = {}) => {
    try {
      await api(`/api/leads/${id2}/stage`, { method: "POST", body: { to, ...extra } });
      setMsg(`Moved to ${to.replaceAll("_", " ")} ✓`);
      toast(`Moved to ${to.replaceAll("_", " ")} ✓`);
      setFinalPick(null);
      load();
      refresh && refresh();
    } catch (e) {
      if (e.message === "reason_required") {
        setFinalPick({ to, reason: "", confirm: false });
        setMsg(`${to.replaceAll("_", " ")} needs a reason — pick one below.`);
      } else if (e.message === "won_needs_confirmation") {
        setFinalPick({ to: "WON", reason: "", confirm: false });
        setMsg("No signed proposal on this lead — confirm below if this is a verbal/legacy win.");
      } else setMsg(e.message);
    }
  };
  const applyFinal = async () => {
    if (!finalPick) return;
    const extra = {};
    if (finalPick.reason) extra.lost_reason = finalPick.reason;
    if (finalPick.to === "WON" && finalPick.confirm) extra.confirm_no_proposal = true;
    await stageTo(finalPick.to, extra);
  };
  const buildProposal = async () => {
    try {
      const clean = items.filter((i) => i.price_book_item_id);
      if (!clean.length) return setMsg("Add at least one price-book line item");
      const body = { line_items: clean.map((i) => ({ price_book_item_id: i.price_book_item_id, qty: Number(i.qty) || 1, unit_price: i.unit_price !== void 0 && i.unit_price !== "" ? Number(i.unit_price) : void 0, override_reason: overrideReason || void 0 })), valid_days: validDays || void 0, template_id: docTpl || void 0, override_reason: overrideReason || void 0 };
      if (useOpts) {
        const mk2 = (arr) => arr.filter((i) => i.price_book_item_id).map((i) => ({ price_book_item_id: i.price_book_item_id, qty: Number(i.qty) || 1 }));
        const b2 = mk2(optB), c2 = mk2(optC);
        if (!b2.length && !c2.length) return setMsg("Options need at least one priced option with line items");
        body.options = [{ name: "Essential", line_items: body.line_items }, ...b2.length ? [{ name: "Recommended", line_items: b2 }] : [], ...c2.length ? [{ name: "Complete", line_items: c2 }] : []];
      }
      await api(`/api/leads/${id2}/proposals`, { method: "POST", body });
      setMsg(useOpts ? "Proposal drafted with options ✓ — the customer picks one on the sign page" : "Proposal drafted from price book ✓");
      setItems([]);
      setOptB([]);
      setOptC([]);
      load();
    } catch (e) {
      setMsg(e.message);
    }
  };
  const optEditor = (arr, setArr, label) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { border: "1px dashed #cbd5e1", borderRadius: 8, padding: 8, marginTop: 6 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 13 }, children: label }),
    arr.map((it, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 4 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { flex: 2 }, value: it.price_book_item_id || "", onChange: (e) => {
        const n2 = [...arr];
        n2[i] = { ...n2[i], price_book_item_id: e.target.value };
        setArr(n2);
      }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Choose item…" }),
        priceBook.map((pb2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: pb2.id, children: [
          pb2.name,
          " — ",
          money(pb2.standard_price)
        ] }, pb2.id))
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { width: 60 }, type: "number", value: it.qty || 1, onChange: (e) => {
        const n2 = [...arr];
        n2[i] = { ...n2[i], qty: e.target.value };
        setArr(n2);
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setArr(arr.filter((_, x2) => x2 !== i)), children: "✕" })
    ] }, i)),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { marginTop: 4 }, onClick: () => setArr([...arr, { qty: 1 }]), children: "+ Line" })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { margin: 0 }, children: [
        l2.service_requested,
        " — ",
        l2.contact_name
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: close, children: "✕ Close" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "6px 0" }, children: [
      l2.contact_phone || "",
      " ",
      l2.contact_email ? "· " + l2.contact_email : "",
      " · ",
      l2.location || "",
      " · created ",
      dt(l2.created_at)
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { s: l2.state }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: money(l2.est_value) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        "Owner: ",
        l2.owner_name || "—",
        " · PM: ",
        l2.pm_id ? "assigned" : "none",
        " · Next: ",
        l2.next_action || "—",
        " (",
        dOnly(l2.next_action_due_at),
        ")"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", title: "Favorite", onClick: async () => {
        await api("/api/favorites", { method: "POST", body: { entity_type: "lead", entity_id: id2 } });
        setMsg("Favorite toggled ⭐");
      }, children: "⭐" }),
      !l2.converted_at && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        var _a2;
        const r2 = await api(`/api/leads/${id2}/convert`, { method: "POST", body: {} });
        setMsg(`Converted ✓ — customer: ${((_a2 = r2.account) == null ? void 0 : _a2.name) || ""}`);
        load();
      }, children: "⇄ Convert to customer" }),
      l2.converted_at && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", style: { background: "#dcfce7", color: "#166534" }, children: "✓ Converted customer" })
    ] }),
    pathIdx >= 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "path", children: PATH.map((st, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `stage ${i < pathIdx ? "done" : i === pathIdx ? "cur" : ""}`, title: st, onClick: () => {
      if (st === l2.state) return;
      if (st === "WON") setFinalPick({ to: "WON", reason: "", confirm: false });
      else stageTo(st);
    }, children: st.replaceAll("_", " ") }, st)) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pathFinal", style: { background: "#fee2e2", color: "#991b1b" }, children: [
      "Closed: ",
      l2.state.replaceAll("_", " "),
      l2.lost_reason ? " · " + l2.lost_reason : "",
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { marginLeft: 10 }, onClick: async () => {
        await api(`/api/leads/${id2}/reopen`, { method: "POST", body: {} });
        setMsg("Reopened ✓ — the outcome record was superseded, not deleted");
        load();
        refresh && refresh();
      }, children: "↩ Reopen this lead" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { fontSize: 12, margin: "2px 0 6px" }, children: [
      "Stages move freely — forward, back, skip. Nothing here is a dead end; every move is on the timeline. ",
      l2.hold_flag ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "st fail", children: [
        "⏸ On hold: ",
        l2.hold_reason || "",
        l2.hold_until ? " until " + dOnly(l2.hold_until) : "",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api(`/api/leads/${id2}/hold`, { method: "POST", body: { clear: true } });
          load();
        }, children: "Clear hold" })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        const reason = prompt("Hold reason (e.g. waiting on site access)");
        if (reason === null) return;
        const until = prompt("Wake date (YYYY-MM-DD, blank = none)") || void 0;
        await api(`/api/leads/${id2}/hold`, { method: "POST", body: { reason, until } });
        load();
      }, children: "⏸ Put on hold" })
    ] }),
    finalPick && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { margin: "8px 0", borderLeft: "4px solid #b45309" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        "Close as ",
        finalPick.to.replaceAll("_", " ")
      ] }),
      (finalPick.to === "LOST" || finalPick.to === "NO_RESPONSE") && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Reason — this is what the loss data learns from" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: finalPick.reason, onChange: (e) => setFinalPick({ ...finalPick, reason: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Pick a reason…" }),
          ["price", "timing", "competitor", "no_budget", "unresponsive", "went_diy", "not_a_fit", "other"].map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: r2, children: r2.replaceAll("_", " ") }, r2))
        ] })
      ] }),
      finalPick.to === "WON" && /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", style: { marginTop: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto" }, checked: finalPick.confirm, onChange: (e) => setFinalPick({ ...finalPick, confirm: e.target.checked }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "No signed proposal — this is a verbal / legacy win, create the job anyway" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn small", disabled: (finalPick.to === "LOST" || finalPick.to === "NO_RESPONSE") && !finalPick.reason, onClick: applyFinal, children: [
          "Confirm — close as ",
          finalPick.to.replaceAll("_", " ")
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setFinalPick(null), children: "Cancel" })
      ] })
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: msg.includes("✓") ? "ok" : "err", children: msg }),
    sug && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { margin: "10px 0", padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", background: "linear-gradient(90deg,#f0fdf4,#ffffff)" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 20 }, children: sug.temperature === "hot" ? "🔥" : sug.temperature === "warm" ? "🌤️" : "❄️" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
          "AI · ",
          sug.score,
          "/100 (",
          sug.temperature,
          ") — ",
          sug.suggestion.label
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: sug.suggestion.detail }),
        (sug.flags || []).length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
          " · flags: ",
          sug.flags.join(", ").replaceAll("_", " ")
        ] })
      ] }),
      sug.suggestion.kind === "nudge" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
        const r2 = await api("/api/ai/nudge", { method: "POST", body: { lead_id: id2 } });
        setMsg(`Nudge sent by ${r2.channel} (${String(r2.status).replaceAll("_", " ")}) ✓`);
      }, children: "Nudge now" }),
      sug.suggestion.kind === "fix_step" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
        await api("/api/leads/" + id2, { method: "PATCH", body: { next_action: "Follow up", next_action_due_at: new Date(Date.now() + 864e5).toISOString() } });
        setMsg("Next step set for tomorrow ✓");
        load();
      }, children: "Set for tomorrow" })
    ] }),
    d.next_step && d.next_step.kind !== "closed" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "nextbar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
          "▶ Next step: ",
          d.next_step.label
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { opacity: 0.85, fontSize: 12.5 }, children: d.next_step.detail })
      ] }),
      (() => {
        const k2 = d.next_step.kind;
        const goTab = (t2, label) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { background: "#fff", color: "#14532d" }, onClick: () => setTab(t2), children: label });
        const act2 = async (fn, ok2) => {
          try {
            await fn();
            toast(ok2);
            load();
          } catch (e) {
            setMsg(e.message);
          }
        };
        if (k2 === "call") return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { display: "inline-flex", gap: 6 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { background: "#fff", color: "#14532d" }, onClick: () => act2(() => api(`/api/leads/${id2}/contact`, { method: "POST", body: { type: "call", body: "First contact call — logged from Next step", outcome: "contacted" } }), "Call logged — first contact recorded ✓"), children: "📞 Log the call" }),
          goTab("messages", "Message instead →")
        ] });
        if (k2 === "nudge") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { background: "#fff", color: "#14532d" }, onClick: () => act2(async () => {
          const r2 = await api("/api/ai/nudge", { method: "POST", body: { lead_id: id2 } });
          if (r2.status === "suppressed") throw new Error("Suppressed — on the do-not-contact list");
        }, "Nudge sent ✓"), children: "Send the nudge" });
        if (k2 === "reactivate") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { background: "#fff", color: "#14532d" }, onClick: () => act2(() => api("/api/tasks", { method: "POST", body: { lead_id: id2, type: "follow_up", title: "Reactivation: call today — decide if this is pipeline or history" } }), "Follow-up task created ✓"), children: "Create follow-up task" });
        if (k2 === "approve") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { background: "#fff", color: "#14532d" }, onClick: () => {
          if (openApprovals) openApprovals();
          else setTab("proposals");
        }, children: "Open the approval →" });
        if (k2 === "fix_step") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { background: "#fff", color: "#14532d" }, onClick: () => act2(() => api("/api/leads/" + id2, { method: "PATCH", body: { next_action: "Follow up", next_action_due_at: new Date(Date.now() + 864e5).toISOString() } }), "Next step set for tomorrow ✓"), children: "Set next step: tomorrow" });
        if (k2 === "assign") return /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { defaultValue: "", style: { width: 190, background: "#fff", color: "#14532d", fontWeight: 600 }, onChange: (e) => {
          const v2 = e.target.value;
          if (v2) act2(() => api("/api/leads/" + id2, { method: "PATCH", body: { owner_id: v2 } }), "Owner assigned ✓");
        }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Assign owner…" }),
          users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: u2.id, children: [
            u2.name,
            " (",
            u2.role,
            ")"
          ] }, u2.id))
        ] });
        if (k2 === "job") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { background: "#fff", color: "#14532d" }, onClick: async () => {
          if (d.job_id && openJob) {
            openJob(d.job_id);
          } else {
            const r2 = await api("/api/jobs", { method: "POST", body: { lead_id: id2 } }).catch((e) => ({ error: e.message }));
            if (r2.error) setMsg(r2.error);
            else {
              toast("Job created ✓");
              if (r2.id && openJob) openJob(r2.id);
              else load();
            }
          }
        }, children: d.job_id ? "Open the job →" : "Create the job →" });
        if (["call", "nudge", "reactivate", "work"].includes(k2)) return goTab("messages", "Open messages →");
        return null;
      })()
    ] }),
    d.next_step && d.next_step.kind === "closed" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { margin: "10px 0", padding: "10px 14px", background: "#f8fafc" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        "🔒 ",
        d.next_step.label
      ] }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: d.next_step.detail })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "details" ? "on" : "", onClick: () => setTab("details"), children: "Details" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "activity" ? "on" : "", onClick: () => setTab("activity"), children: "Activity & Tasks" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: tab === "proposals" ? "on" : "", onClick: () => setTab("proposals"), children: [
        "Proposals & Files (",
        d.proposals.length,
        ")"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "messages" ? "on" : "", onClick: () => setTab("messages"), children: "Messages" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "crew" ? "on" : "", onClick: () => setTab("crew"), children: "Crew & Time" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "feed" ? "on" : "", onClick: () => setTab("feed"), children: "Feed & Notes" })
    ] }),
    tab === "feed" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(FeedPanel, { type: "lead", id: id2 }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: 16 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(NotesPanel, { type: "lead", id: id2 }) })
    ] }),
    tab === "details" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Contact name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: edit.contact_name || "", onChange: (e) => setEdit({ ...edit, contact_name: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Phone" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: edit.contact_phone || "", onChange: (e) => setEdit({ ...edit, contact_phone: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Email" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: edit.contact_email || "", onChange: (e) => setEdit({ ...edit, contact_email: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Service" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: edit.service_requested || "", onChange: (e) => setEdit({ ...edit, service_requested: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Estimated value ($)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", value: edit.est_value ?? 0, onChange: (e) => setEdit({ ...edit, est_value: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Urgency" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: edit.urgency || "", onChange: (e) => setEdit({ ...edit, urgency: e.target.value }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "emergency", children: "Emergency" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "this_week", children: "This week" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "flexible", children: "Flexible" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Owner" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: edit.owner_id || "", onChange: (e) => setEdit({ ...edit, owner_id: e.target.value }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "— unassigned —" }),
            users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: u2.id, children: [
              u2.name,
              " (",
              u2.role,
              ")"
            ] }, u2.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Project manager" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: edit.pm_id || "", onChange: (e) => setEdit({ ...edit, pm_id: e.target.value }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "— none —" }),
            users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: u2.id, children: u2.name }, u2.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "full", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Next action" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: edit.next_action || "", onChange: (e) => setEdit({ ...edit, next_action: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "full", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Notes / job details" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 3, value: edit.notes || "", onChange: (e) => setEdit({ ...edit, notes: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 12 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: save, children: "Save changes" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 220 }, defaultValue: "", onChange: (e) => {
          const v2 = e.target.value;
          e.target.value = "";
          if (!v2) return;
          if (FINALS.includes(v2)) setFinalPick({ to: v2, reason: "", confirm: false });
          else stageTo(v2);
        }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Move to any stage…" }),
          STATES.filter((s) => s !== l2.state).map((s) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: s, children: s.replaceAll("_", " ") }, s))
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: async () => setCheck(await api(`/api/leads/${id2}/packet-check`, { method: "POST", body: {} })), children: "Run readiness check" })
      ] }),
      check && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginTop: 12 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
          "Readiness — ",
          check.complete ? "✅ Everything in place" : "⚠ Gaps below (warnings, not walls — you can still move and send)",
          " · score ",
          check.score,
          "/100"
        ] }),
        ["contact name", "contact phone or email", "service requested", "service location", "scope notes", "project manager", "proposal", "proposal line items from price book"].map((label) => {
          const okc = !(check.missing || []).includes(label);
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${okc ? "pass" : "fail"}`, children: okc ? "✓" : "✗" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              label,
              okc ? "" : " — missing"
            ] })
          ] }, label);
        }),
        (check.flags || []).map((fl2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
          "⚑ ",
          fl2
        ] }, i))
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CustomFieldsSection, { objectType: "lead", entityId: id2, custom: (() => {
        try {
          return JSON.parse(l2.custom || "{}");
        } catch {
          return {};
        }
      })(), reload: load })
    ] }),
    tab === "activity" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Log contact (20 seconds)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 110 }, value: act.type, onChange: (e) => setAct({ ...act, type: e.target.value }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "call" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "text" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "email" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "visit" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "What happened?", value: act.body, onChange: (e) => setAct({ ...act, body: e.target.value }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
            await api(`/api/leads/${id2}/contact`, { method: "POST", body: act });
            setAct({ type: "call", body: "", outcome: "" });
            load();
          }, children: "Log" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feed", style: { marginTop: 10 }, children: [
          d.activities.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ev", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: a.type }),
            " — ",
            a.body,
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "· ",
              a.user_name || "",
              " · ",
              dt(a.created_at)
            ] })
          ] }, a.id)),
          d.activities.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No activity logged yet." })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Schedule a callback" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(CallbackForm, { leadId: id2, done: load })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
          "Tasks (",
          d.tasks.filter((t2) => t2.status === "open").length,
          " open)"
        ] }),
        d.tasks.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${t2.status === "done" ? "pass" : ""}`, children: t2.status === "done" ? "✓" : "○" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
            t2.title,
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
              "due ",
              dOnly(t2.due_at)
            ] })
          ] }),
          t2.status === "open" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            await api(`/api/tasks/${t2.id}/complete`, { method: "POST", body: {} });
            load();
          }, children: "Done" })
        ] }, t2.id)),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feed", style: { marginTop: 12 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Timeline" }),
          d.events.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ev", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "chip", style: { marginRight: 6 }, children: e.actor === "ai-automation" ? "🤖 agent" : e.actor === "system" ? "⚙️ system" : "👤 human" }),
            e.type.replaceAll("_", " "),
            e.to_state ? ` → ${e.to_state}` : "",
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "· ",
              dt(e.created_at)
            ] })
          ] }, e.id))
        ] })
      ] })
    ] }),
    tab === "messages" && /* @__PURE__ */ jsxRuntimeExports.jsx(MessagesPanel, { lead: d.lead }),
    tab === "crew" && /* @__PURE__ */ jsxRuntimeExports.jsx(CrewTime, { lead: l2, users, reloadLead: load }),
    tab === "proposals" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AttachmentsPanel, { entityType: "lead", entityId: id2 }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Proposals" }),
        d.proposals.map((p2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { borderBottom: "1px solid #eef2f7", padding: "8px 0" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
            "v",
            p2.version,
            " · ",
            money(p2.total)
          ] }),
          " · ",
          p2.status,
          p2.signed_at ? " · ✅ signed" : "",
          " · payment ",
          p2.payment_status || "—",
          p2.view_count ? ` · 👁 viewed ${p2.view_count}× (first ${dt(p2.first_viewed_at)})` : " · not viewed yet",
          p2.expires_at ? new Date(p2.expires_at) < /* @__PURE__ */ new Date() && !p2.signed_at ? ` · ⏰ expired ${dOnly(p2.expires_at)}` : ` · valid until ${dOnly(p2.expires_at)}` : "",
          p2.options ? (() => {
            try {
              const o = JSON.parse(p2.options);
              return ` · options: ${o.map((x2) => `${x2.name} ${money(x2.total)}`).join(" / ")}${p2.selected_option ? " → picked: " + p2.selected_option : ""}`;
            } catch {
              return "";
            }
          })() : "",
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rowflex", style: { marginTop: 5 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
              const r2 = await api(`/api/proposals/${p2.id}/sign-link`, { method: "POST", body: {} });
              navigator.clipboard && navigator.clipboard.writeText(location.origin + "/sign/" + r2.token);
              setMsg("Sign link copied: /sign/" + r2.token);
            }, children: "Copy sign link" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
              const r2 = await api(`/api/proposals/${p2.id}/deposit`, { method: "POST", body: {} });
              setMsg(`Deposit link (${r2.mode}): ${r2.link}`);
            }, children: "Deposit link" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn ghost small", style: { textDecoration: "none" }, href: `/api/proposals/${p2.id}/docx`, children: "DOCX" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn ghost small", style: { textDecoration: "none" }, href: `/print/proposal/${p2.id}`, target: "_blank", rel: "noreferrer", children: "🖨 Print / PDF" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
              const r2 = await api(`/api/proposals/${p2.id}/clone`, { method: "POST", body: {} });
              setMsg(`Cloned as v${r2.version} (draft) ✓`);
              load();
            }, children: "⧉ Clone" }),
            p2.status !== "signed" && p2.status !== "withdrawn" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
              if (!confirm("Withdraw this proposal? Its sign link stops working immediately.")) return;
              await api(`/api/proposals/${p2.id}/withdraw`, { method: "POST", body: {} });
              setMsg("Proposal withdrawn — its sign link no longer accepts a signature.");
              load();
            }, children: "Withdraw" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => stageTo("SENT"), children: "Mark sent" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
              const r2 = await api(`/api/proposals/${p2.id}/send`, { method: "POST", body: { channel: "email" } }).catch((e) => ({ error: e.message }));
              setMsg(r2.error ? "Send failed: " + r2.error : `Proposal emailed to customer — delivery status: ${r2.status}${r2.status === "test_mode" ? " (test mode: recorded, not sent — add RESEND_API_KEY to go live)" : ""}`);
              load();
            }, children: "✉ Send to customer" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
              const r2 = await api(`/api/proposals/${p2.id}/send`, { method: "POST", body: { channel: "sms" } }).catch((e) => ({ error: e.message }));
              setMsg(r2.error ? "SMS failed: " + r2.error : `Proposal texted — status: ${r2.status}`);
              load();
            }, children: "💬 Text it" })
          ] })
        ] }, p2.id)),
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Build proposal — price book only" }),
        items.map((it, i) => {
          const pb2 = priceBook.find((p2) => p2.id === it.price_book_item_id);
          const overridden = pb2 && it.unit_price !== void 0 && it.unit_price !== "" && Number(it.unit_price) !== Number(pb2.standard_price);
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { flex: 2 }, value: it.price_book_item_id || "", onChange: (e) => {
              const n2 = [...items];
              n2[i] = { ...n2[i], price_book_item_id: e.target.value };
              setItems(n2);
            }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Choose item…" }),
              priceBook.map((pb22) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: pb22.id, children: [
                pb22.name,
                " — ",
                money(pb22.standard_price)
              ] }, pb22.id))
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { width: 70 }, type: "number", value: it.qty || 1, onChange: (e) => {
              const n2 = [...items];
              n2[i] = { ...n2[i], qty: e.target.value };
              setItems(n2);
            }, title: "Qty" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { width: 95, borderColor: overridden ? "#d97706" : void 0, background: overridden ? "#fffbeb" : void 0 }, type: "number", placeholder: pb2 ? "Book " + money(pb2.standard_price) : "Price", value: it.unit_price ?? "", onChange: (e) => {
              const n2 = [...items];
              n2[i] = { ...n2[i], unit_price: e.target.value };
              setItems(n2);
            }, title: "Unit price — change only with a reason (override is audited)" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setItems(items.filter((_, x2) => x2 !== i)), children: "✕" })
          ] }, i);
        }),
        items.some((it) => {
          const pb2 = priceBook.find((p2) => p2.id === it.price_book_item_id);
          return pb2 && it.unit_price !== void 0 && it.unit_price !== "" && Number(it.unit_price) !== Number(pb2.standard_price);
        }) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 6 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "chip", style: { background: "#fffbeb", color: "#92400e", fontWeight: 700 }, children: "⚠ Price override" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "Reason for changing a price-book price (required — recorded in the audit trail)", value: overrideReason, onChange: (e) => setOverrideReason(e.target.value) })
        ] }),
        useOpts && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          optEditor(optB, setOptB, "Option B — Recommended"),
          optEditor(optC, setOptC, "Option C — Complete"),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12 }, children: "Option A “Essential” = the lines above. The customer picks one option when signing; the job is priced from their pick." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setItems([...items, { qty: 1 }]), children: "+ Line item" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "muted", style: { fontSize: 12.5 }, children: [
            "Valid ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", style: { width: 60 }, value: validDays, onChange: (e) => setValidDays(Number(e.target.value) || 0) }),
            " days"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "muted", style: { fontSize: 12.5 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto" }, checked: useOpts, onChange: (e) => setUseOpts(e.target.checked) }),
            " Offer options (Good / Better / Best)"
          ] }),
          docTpls.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "muted", style: { fontSize: 12.5 }, children: [
            "Template ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("select", { style: { width: 190 }, value: docTpl, onChange: (e) => setDocTpl(e.target.value), children: docTpls.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: t2.id, children: [
              t2.name,
              t2.is_default ? " ⭐" : ""
            ] }, t2.id)) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: buildProposal, children: "Draft proposal" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Documents & visits" }),
        d.documents.map((doc) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${doc.status === "received" ? "pass" : "fail"}`, children: doc.status === "received" ? "✓" : "✗" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
            doc.name,
            doc.expires_at && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "chip", style: { marginLeft: 8, background: new Date(doc.expires_at).getTime() - Date.now() < 14 * 864e5 ? "#fde8e8" : "#eef2f7", color: new Date(doc.expires_at).getTime() - Date.now() < 0 ? "#b3261e" : "#5b6b62" }, children: [
              new Date(doc.expires_at).getTime() - Date.now() < 0 ? "expired " : "expires ",
              dOnly(doc.expires_at)
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "tiny muted", children: [
            "expires ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", style: { width: 128, padding: 2 }, defaultValue: doc.expires_at ? String(doc.expires_at).slice(0, 10) : "", onChange: async (e) => {
              await api(`/api/documents/${doc.id}`, { method: "PATCH", body: { expires_at: e.target.value || null } });
              load();
            } })
          ] }),
          doc.status !== "received" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            await api(`/api/documents/${doc.id}`, { method: "PATCH", body: { status: "received" } });
            load();
          }, children: "Mark received" })
        ] }, doc.id)),
        d.site_visits.map((v2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "4px 0" }, children: [
          "📍 Visit ",
          dt(v2.scheduled_at),
          " — ",
          v2.status
        ] }, v2.id)),
        ((_b = d.approvals) == null ? void 0 : _b.length) > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 10 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Approval history" }),
          d.approvals.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "4px 0" }, children: [
            a.tier,
            " · ",
            a.decision || "pending",
            a.reason_code ? " · " + a.reason_code : "",
            " · ",
            dt(a.submitted_at)
          ] }, a.id))
        ] })
      ] })
    ] })
  ] }) });
}
function Approvals({ openLead }) {
  const [rows, setRows] = reactExports.useState([]);
  const [reason, setReason] = reactExports.useState({});
  const load = () => {
    api("/api/approvals").then(setRows).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const decide = async (a, decision) => {
    try {
      await api(`/api/approvals/${a.id}/decide`, { method: "POST", body: { decision, reason_code: reason[a.id] || void 0 } });
      load();
    } catch (e) {
      alert(e.message === "reason_required" ? "Rejections need a reason — pick one first." : e.message);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Approval Inbox" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Complete packets only — the Gate already verified contact, scope, visit, PM and price-book pricing. Target: approve in under 10 seconds." }),
    rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { textAlign: "center", padding: 34 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 34 }, children: "🎉" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Inbox zero." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Nothing is waiting on an approver. Every packet that needed a decision got one — this is what a cleared pile looks like. New submissions land here the second they pass the Completeness Gate." })
    ] }),
    rows.map((a) => {
      var _a;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 16 }, children: a.service_requested }),
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
              "for ",
              a.contact_name
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
              money(a.est_value),
              " · ",
              a.tier,
              " tier · submitted ",
              dt(a.submitted_at),
              " · age ",
              a.age_hours,
              "h"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => openLead(a.lead_id), children: "Open full record →" })
        ] }),
        ((_a = a.proposal) == null ? void 0 : _a.line_items) && /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { style: { marginTop: 10 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Line item" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Qty" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Unit" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Amount" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
            a.proposal.line_items.map((li2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: li2.name }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: li2.qty }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: money(li2.unit_price) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: money(li2.qty * li2.unit_price) })
            ] }, i)),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 3, children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Total" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: money(a.proposal.total) }) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: 10 }, children: (a.checks || []).map((c, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${c.ok ? "pass" : "fail"}`, children: c.ok ? "✓" : "✗" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: c.label || c.name })
        ] }, i)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 12 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => decide(a, "approved"), children: "✓ Approve" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 210 }, value: reason[a.id] || "", onChange: (e) => setReason({ ...reason, [a.id]: e.target.value }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Rejection reason…" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "PRICE_TOO_HIGH", children: "Price too high" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "PRICE_TOO_LOW", children: "Price too low" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "INCOMPLETE_SCOPE", children: "Incomplete scope" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "MISSING_INFO", children: "Missing info" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "TIMING", children: "Timing" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "OTHER", children: "Other" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn danger", onClick: () => decide(a, "rejected"), children: "Reject" })
        ] })
      ] }, a.id);
    })
  ] });
}
function Imports() {
  const [csv, setCsv] = reactExports.useState("name,phone,email,service,value,location\nPat Lee,+15165550199,pat@example.com,Roofing quote,3200,Bay Shore NY");
  const [format, setFormat] = reactExports.useState("generic");
  const [res, setRes] = reactExports.useState(null);
  const [hist, setHist] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const load = () => {
    api("/api/imports").then(setHist).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const run = async () => {
    try {
      const r2 = await api("/api/imports/csv", { method: "POST", body: { csv, filename: "web-import.csv", format } });
      setRes(r2);
      load();
    } catch (e) {
      setMsg(e.message);
    }
  };
  const onFile = (f2) => f2.text().then((t2) => setCsv(t2));
  const [eFmt, setEFmt] = reactExports.useState("mbox");
  const [eContent, setEContent] = reactExports.useState("");
  const [eRes, setERes] = reactExports.useState(null);
  const [eBusy, setEBusy] = reactExports.useState(false);
  const runEmail = async () => {
    setEBusy(true);
    try {
      const r2 = await api("/api/imports/email", { method: "POST", body: { format: eFmt, content: eContent, filename: "email-backlog." + eFmt } });
      setERes(r2);
      load();
    } catch (e) {
      setMsg(e.message);
    }
    setEBusy(false);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Import Leads" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Bring the backlog in — CSV from any source. Columns are auto-mapped (name, phone, email, service, value, location); duplicates are detected by phone/email and skipped, never double-created." }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "1 · Choose file or paste CSV" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", style: { margin: 0 }, children: "This export came from" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 230 }, value: format, onChange: (e) => setFormat(e.target.value), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "generic", children: "Generic CSV" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "jobber", children: "Jobber" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "housecallpro", children: "Housecall Pro" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "servicetitan", children: "ServiceTitan" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "salesforce", children: "Salesforce" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "Vendor exports import as-is — no column surgery in Excel first." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "file", accept: ".csv", onChange: (e) => e.target.files && onFile(e.target.files[0]) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 9, style: { marginTop: 10 }, value: csv, onChange: (e) => setCsv(e.target.value) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn", onClick: run, children: [
          "Import ",
          csv.split("\n").filter(Boolean).length - 1 > 0 ? `(${csv.split("\n").filter(Boolean).length - 1} rows)` : ""
        ] }),
        res && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ok", style: { margin: 0 }, children: [
          "Created ",
          res.created,
          " · duplicates skipped ",
          res.duplicates
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Every imported lead lands owned, with a first-contact task and a 4-hour SLA — nothing enters unowned." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "2 · Email backlog — import the whole inbox, auto-triaged" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
        "Export the pile once and drop it here: a ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Gmail Takeout .mbox" }),
        ", an email CSV, or JSON. Every message is triaged on arrival — quote requests become leads (deduped by phone/email), and proposals, field reports, active-job mail, vendor, finance, and admin each land as owned inbox items with a next step. Nothing needs reading one-by-one first."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", style: { margin: 0 }, children: "Format" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 230 }, value: eFmt, onChange: (e) => setEFmt(e.target.value), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "mbox", children: "Gmail Takeout (.mbox)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "csv", children: "Email CSV" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "json", children: "JSON" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "file", accept: ".mbox,.csv,.txt,.json", onChange: (e) => e.target.files && e.target.files[0].text().then((t2) => setEContent(t2)) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 5, placeholder: eFmt === "mbox" ? "…or paste the .mbox contents here" : eFmt === "csv" ? "from_email,from_name,subject,body,date\n…" : '[{"from_email": "…", "subject": "…", "body": "…"}]', value: eContent, onChange: (e) => setEContent(e.target.value) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", disabled: eBusy || !eContent.trim(), onClick: runEmail, children: eBusy ? "Triaging…" : "Import & triage email backlog" }),
        eRes && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ok", style: { margin: 0 }, children: [
          eRes.received,
          " messages → ",
          eRes.leads_created,
          " new leads · ",
          eRes.duplicates,
          " duplicates skipped"
        ] })
      ] }),
      eRes && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { marginTop: 8 }, children: Object.entries(eRes.by_category).map(([k2, v2]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "st info", children: [
        k2.replaceAll("_", " "),
        ": ",
        v2
      ] }, k2)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Import history" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "File" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "When" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Created" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Duplicates" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Status" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
          hist.map((h) => {
            let t2 = {};
            try {
              t2 = JSON.parse(h.totals || "{}");
            } catch {
              t2 = {};
            }
            return /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: h.filename }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: dt(h.created_at) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: t2.created ?? "—" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: t2.dupes ?? "—" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: h.status })
            ] }, h.id);
          }),
          hist.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 5, className: "muted", children: "No imports yet." }) })
        ] })
      ] })
    ] })
  ] });
}
function Demand({ openLead }) {
  const [rows, setRows] = reactExports.useState([]);
  const [sel, setSel] = reactExports.useState(null);
  const [leads, setLeads] = reactExports.useState([]);
  const [q2, setQ] = reactExports.useState("");
  const [stF, setStF] = reactExports.useState("");
  const [sort, setSort] = reactExports.useState("new");
  reactExports.useEffect(() => {
    api("/api/demand-gap").then(setRows).catch(() => {
    });
  }, []);
  reactExports.useEffect(() => {
    if (sel) api("/api/demand-gap/leads?service=" + encodeURIComponent(sel.service)).then(setLeads).catch(() => setLeads([]));
  }, [sel == null ? void 0 : sel.service]);
  const recColor = (r2) => r2 === "Launch" ? { background: "#dcfce7", color: "#166534" } : r2 === "Partner" ? { background: "#fef9c3", color: "#854d0e" } : {};
  if (sel) {
    let view = leads.filter((l2) => (!stF || l2.state === stF) && (!q2 || JSON.stringify(l2).toLowerCase().includes(q2.toLowerCase())));
    view = [...view].sort((a, b) => sort === "value" ? (b.est_value || 0) - (a.est_value || 0) : String(b.created_at).localeCompare(String(a.created_at)));
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setSel(null), children: "← All clusters" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", style: { marginTop: 10 }, children: sel.service }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "sub", children: [
        num(sel.lead_count),
        " customers asked for this and were turned away · est. ",
        money(sel.est_revenue),
        " (estimate · ",
        sel.est_basis,
        ") · ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", style: recColor(sel.recommendation), children: sel.recommendation }),
        " · Opportunity score ",
        sel.opportunity_score
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "search", style: { flex: 1, minWidth: 200 }, placeholder: "Filter by name, phone, email, location…", value: q2, onChange: (e) => setQ(e.target.value) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 180 }, value: stF, onChange: (e) => setStF(e.target.value), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "All closure types" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "UNSERVICEABLE", children: "Unserviceable" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "LOST", children: "Lost" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 170 }, value: sort, onChange: (e) => setSort(e.target.value), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "new", children: "Newest first" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "value", children: "Highest value" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
          view.length,
          " of ",
          leads.length,
          " shown"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", style: { padding: "4px 14px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Contact" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Phone" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Email" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Location" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Asked" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Value" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Closed as" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Reason" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
          view.map((l2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "clickable", onClick: () => openLead(l2.id), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: l2.contact_name }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: l2.contact_phone || "—" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: l2.contact_email || "—" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: l2.location || "—" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: dOnly(l2.created_at) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: money(l2.est_value) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { s: l2.state }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: (l2.lost_reason || "—").replaceAll("_", " ") })
          ] }, l2.id)),
          view.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 8, className: "muted", children: "No leads match these filters." }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Click any row to open the full lead record." })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Demand Gap" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "sub", children: [
      "Services customers keep asking for that you don't sell yet — clustered from leads turned away because the service isn't offered. Price losses, no-responses, out-of-area and competitor losses are ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "not" }),
      " counted here. Estimates are labeled estimates, never presented as booked revenue."
    ] }),
    rows.map((r2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card clickable", onClick: () => setSel(r2), style: { cursor: "pointer" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 16 }, children: r2.service }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { display: "inline-flex", gap: 6 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", style: recColor(r2.recommendation), children: r2.recommendation }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "badge b-READY_FOR_APPROVAL", children: [
            "Opportunity score ",
            r2.opportunity_score
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "8px 0 4px" }, children: [
        num(r2.lead_count),
        " leads asked · est. ",
        money(r2.est_revenue),
        " turned away (estimate) · basis: ",
        r2.est_basis
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { margin: "4px 0" }, children: r2.recommendation === "Launch" ? "Enough repeated demand to price it, staff it, and add it to the catalog." : r2.recommendation === "Partner" ? "Real demand, thin volume — refer it to a partner for a cut instead of staffing it." : "Watch it — demand exists but is too thin to act on yet." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { margin: "4px 0" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        "Click to see all ",
        num(r2.lead_count),
        " leads →"
      ] }) })
    ] }, i)),
    rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", children: "No unmet-demand clusters yet — when customers ask for services you don't offer, they'll surface here." })
  ] });
}
function Handoffs() {
  const [rows, setRows] = reactExports.useState([]);
  const [outbox, setOutbox] = reactExports.useState([]);
  const [flt, setFlt] = reactExports.useState("");
  const load = () => {
    api("/api/handoffs").then(setRows).catch(() => {
    });
    api("/api/outbox").then(setOutbox).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const shown = rows.filter((r2) => !flt || r2.last_status === flt || r2.outcome === flt);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Handoff Monitor" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: `Every final outcome — won, lost, no-response, N/A — delivered into the customer's own system. A delivery only reads "delivered" after a real 2xx from their endpoint; "acknowledged" means their system confirmed the ID.` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "chips", children: ["", "acknowledged", "delivered", "pending", "dead_letter", "won", "lost", "na_unserviceable"].map((s) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: `chip ${flt === s ? "on" : ""}`, onClick: () => setFlt(s), children: [
      s || "All",
      " "
    ] }, s || "all")) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: 6 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Outcome" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Status" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Attempts" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Their ID" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Delivered" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: shown.slice(0, 100).map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: r2.outcome }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.last_status }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.attempts }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.external_id || "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: dt(r2.delivered_at) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: ["pending", "failed", "dead_letter"].includes(r2.last_status) && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            await api(`/api/handoffs/${r2.id}/replay`, { method: "POST", body: {} });
            load();
          }, children: "Replay" }) })
        ] }, r2.id)) })
      ] }),
      shown.length > 100 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { padding: 10 }, children: [
        "Showing first 100 of ",
        num(shown.length),
        "."
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Outbox (last 100)" }),
      outbox.slice(0, 12).map((o) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "4px 0" }, children: [
        o.kind,
        " · ",
        o.status,
        " · attempts ",
        o.attempts,
        " · ",
        dt(o.created_at),
        o.last_error ? " · " + o.last_error : ""
      ] }, o.id))
    ] })
  ] });
}
function InboxQueue({ inbox, reload }) {
  const [cat, setCat] = reactExports.useState("all");
  const [openId, setOpenId] = reactExports.useState("");
  const [sug, setSug] = reactExports.useState(null);
  const [draft, setDraft] = reactExports.useState("");
  const [msg, setMsg] = reactExports.useState("");
  const cats = ["all", "client_active_job", "proposal", "field", "vendor", "finance", "admin"];
  const counts = {};
  for (const i of inbox) if ((i.status || "open") === "open") counts[i.category] = (counts[i.category] || 0) + 1;
  const openCount = inbox.filter((i) => (i.status || "open") === "open").length;
  const shown = inbox.filter((i) => cat === "all" || i.category === cat);
  const [comments, setComments] = reactExports.useState([]);
  const [canned, setCanned] = reactExports.useState([]);
  const [cText, setCText] = reactExports.useState("");
  reactExports.useEffect(() => {
    api("/api/canned-replies").then(setCanned).catch(() => {
    });
  }, []);
  const expand = async (i) => {
    if (openId === i.id) {
      setOpenId("");
      return;
    }
    setOpenId(i.id);
    setSug(null);
    const r2 = await api("/api/inbox/" + i.id + "/suggestion").catch(() => null);
    setSug(r2);
    if (r2) setDraft(r2.draft_body);
    api("/api/inbox/" + i.id + "/claim", { method: "POST", body: {} }).catch(() => {
    });
    api("/api/inbox/" + i.id + "/comments").then(setComments).catch(() => {
    });
  };
  const act = async (fn, okMsg) => {
    const r2 = await fn().catch((e) => ({ error: e.message }));
    setMsg((r2 == null ? void 0 : r2.error) ? "Failed: " + r2.error : okMsg);
    reload();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Inbox queue — everything that isn't a lead, worked like a queue" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "Triaged on arrival, each with an owner, a due date, and an AI-suggested next action with a ready-to-send reply. ",
      openCount,
      " open."
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { marginBottom: 10 }, children: cats.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small " + (cat === c ? "" : "ghost"), onClick: () => setCat(c), children: c === "all" ? `All (${openCount} open)` : `${c.replaceAll("_", " ")}${counts[c] ? ` (${counts[c]})` : ""}` }, c)) }),
    shown.map((i) => {
      const doneIt = (i.status || "open") === "done";
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { borderBottom: "1px solid #eef2f7", padding: "9px 0", opacity: doneIt ? 0.55 : 1 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { cursor: "pointer" }, onClick: () => expand(i), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "badge b-TRIAGED", children: i.category.replaceAll("_", " ") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: i.from_name || i.from_email }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 }, children: i.subject }),
          i.overdue && !doneIt && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st fail", children: "overdue" }),
          doneIt ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st pass", children: "done" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
            "due ",
            dOnly(i.next_action_due_at),
            " · ",
            i.owner_name || "unassigned"
          ] })
        ] }),
        openId === i.id && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { margin: "10px 0 4px", padding: 12, background: "#f8fafc", borderRadius: 10 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "origMail", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "origHead", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "📧 Original email" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
                "From ",
                i.from_name || "",
                " <",
                i.from_email || "",
                "> · ",
                dt(i.received_at || i.created_at)
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "origBody", children: String(i.body || "(no body captured)") })
          ] }),
          sug ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "0 0 4px" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
                "🤖 Suggested: ",
                sug.action
              ] }),
              " ",
              sug.source === "ai" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "tinyBadge", style: { background: "#e7f6ec", color: "#14532d" }, children: [
                "✨ AI draft — written from this email",
                sug.model ? " · " + sug.model : ""
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", style: { background: "#fef9c3", color: "#854d0e" }, children: "📄 Template draft — add an AI key in Automations for drafts written from the actual email" }),
              sug.source === "ai" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { marginLeft: 8 }, onClick: async () => {
                const r2 = await api("/api/inbox/" + i.id + "/suggestion/regenerate", { method: "POST", body: {} }).catch(() => null);
                if (r2) {
                  setSug(r2);
                  setDraft(r2.draft_body);
                }
              }, children: "↻ Regenerate" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { margin: "0 0 8px" }, children: sug.why }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Reply — edit freely, sends from your workspace" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 7, value: draft, onChange: (e) => setDraft(e.target.value) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 230 }, defaultValue: "", onChange: (e) => {
                const c = canned.find((x2) => x2.id === e.target.value);
                if (c) setDraft(c.body);
                e.target.value = "";
              }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Insert a canned reply…" }),
                canned.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: c.id, children: c.title }, c.id))
              ] }),
              i.claimed_by && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: "👀 being handled" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: () => act(async () => {
                const r2 = await api("/api/inbox/" + i.id + "/reply", { method: "POST", body: { body: draft } });
                return r2;
              }, "Reply queued/sent ✓ — item closed"), children: "✉ Send reply & close" }),
              !doneIt ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => act(() => api("/api/inbox/" + i.id, { method: "PATCH", body: { status: "done" } }), "Marked done ✓"), children: "✓ Mark done" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => act(() => api("/api/inbox/" + i.id, { method: "PATCH", body: { status: "open" } }), "Reopened ✓"), children: "Reopen" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => act(() => api("/api/inbox/" + i.id, { method: "PATCH", body: { snooze_days: 1 } }), "Snoozed to tomorrow ✓"), children: "💤 Snooze 1d" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => act(() => api("/api/inbox/" + i.id + "/convert-task", { method: "POST", body: {} }), "Task created for the owner ✓"), children: "Make task" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => act(() => api("/api/inbox/" + i.id + "/convert-lead", { method: "POST", body: {} }), "Converted to a lead ✓"), children: "Convert to lead" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 8 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 13 }, children: "Team discussion — on this email, not in a hallway" }),
              comments.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "5px 0", fontSize: 13 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: c.user_name || "Teammate" }),
                " ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: dt(c.created_at) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
                c.body
              ] }, c.id)),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Add a comment for the team…", value: cText, onChange: (e) => setCText(e.target.value), style: { flex: 1 } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", disabled: !cText.trim(), onClick: async () => {
                  await api("/api/inbox/" + i.id + "/comments", { method: "POST", body: { body: cText.trim() } });
                  setCText("");
                  api("/api/inbox/" + i.id + "/comments").then(setComments).catch(() => {
                  });
                }, children: "Comment" })
              ] })
            ] })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading suggestion…" })
        ] })
      ] }, i.id);
    }),
    shown.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Nothing here — this category is clear." })
  ] });
}
function Ops() {
  function FieldReportsCard() {
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA");
    const [date, setDate] = reactExports.useState(today);
    const [data, setData] = reactExports.useState(null);
    const [subId, setSubId] = reactExports.useState("");
    const [notes, setNotes] = reactExports.useState("");
    const [jobId, setJobId] = reactExports.useState("");
    const [jobs, setJobs] = reactExports.useState([]);
    const [msg, setMsg] = reactExports.useState("");
    const load2 = () => {
      api("/api/field-reports?date=" + date).then(setData).catch(() => {
      });
    };
    reactExports.useEffect(load2, [date]);
    reactExports.useEffect(() => {
      api("/api/schedule/jobs").then(setJobs).catch(() => {
      });
    }, []);
    const shift = (n2) => {
      const d2 = /* @__PURE__ */ new Date(date + "T12:00:00");
      d2.setDate(d2.getDate() + n2);
      setDate(d2.toLocaleDateString("en-CA"));
    };
    const submit = async (r2) => {
      const res = await offlinePost(`/api/field-reports/${r2.id}/submit`, { notes, lead_id: jobId || void 0 }, "field report");
      setSubId("");
      setNotes("");
      setJobId("");
      if (res == null ? void 0 : res.__offline) {
        setMsg("📴 No signal — report saved on this device and queued to sync.");
        return;
      }
      setMsg(`Report filed for ${r2.manager} ✓`);
      load2();
    };
    const chase2 = async (r2) => {
      await api(`/api/field-reports/${r2.id}/chase`, { method: "POST", body: {} });
      setMsg(`Chase sent to ${r2.manager} ✓`);
      load2();
    };
    const chaseAll = async () => {
      if (!data) return;
      for (const r2 of data.rows.filter((x2) => x2.status === "missing")) await api(`/api/field-reports/${r2.id}/chase`, { method: "POST", body: {} });
      setMsg("All missing reports chased ✓");
      load2();
    };
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Field reports — daily, expected, chased" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => shift(-1), children: "← Prev day" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: date }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => shift(1), children: "Next day →" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setDate(today), children: "Today" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: chaseAll, children: "📣 Chase all missing" })
      ] }),
      msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
      !data && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading…" }),
      data && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { marginTop: 0 }, children: [
          data.summary.submitted,
          " of ",
          data.rows.length,
          " filed · ",
          data.summary.missing,
          " missing. A report is expected from every field manager, every day — missing ones past their day are chased automatically, once."
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Manager" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Status" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Job" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Notes" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", {})
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
            data.rows.map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.manager }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
                r2.status === "submitted" ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st pass", children: "filed" }) : r2.overdue ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st fail", children: "missing · overdue" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st warn", children: "missing" }),
                r2.chased_at ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
                  " · chased ",
                  dOnly(r2.chased_at)
                ] }) : ""
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.job_service ? `${r2.job_service} — ${r2.job_customer || ""}` : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "—" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "muted", children: r2.notes ? String(r2.notes).slice(0, 60) : "" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rowflex", children: [
                  r2.status === "missing" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => chase2(r2), children: "Chase" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => {
                    setSubId(subId === r2.id ? "" : r2.id);
                    setNotes(r2.notes || "");
                  }, children: r2.status === "submitted" ? "Edit" : "File report" })
                ] }),
                subId === r2.id && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 8 }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 3, placeholder: "What got done, what's blocked, what's needed tomorrow…", value: notes, onChange: (e) => setNotes(e.target.value) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: jobId, onChange: (e) => setJobId(e.target.value), style: { marginTop: 6 }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Attach to a job (optional)…" }),
                    jobs.map((j) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: j.id, children: [
                      j.service_requested,
                      " — ",
                      j.contact_name
                    ] }, j.id))
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 6 }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: () => submit(r2), children: "Submit report" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setSubId(""), children: "Cancel" })
                  ] })
                ] })
              ] })
            ] }, r2.id)),
            data.rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 5, className: "muted", children: "No field managers (PM / Lead Owner roles) in this workspace yet." }) })
          ] })
        ] })
      ] })
    ] });
  }
  function ScheduleCard() {
    var _a;
    const [users, setUsers] = reactExports.useState([]);
    reactExports.useEffect(() => {
      api("/api/users").then(setUsers).catch(() => {
      });
    }, []);
    const mondayOf = (d2) => {
      const x2 = new Date(d2);
      const day = (x2.getDay() + 6) % 7;
      x2.setDate(x2.getDate() - day);
      x2.setHours(0, 0, 0, 0);
      return x2.toISOString().slice(0, 10);
    };
    const [week, setWeek] = reactExports.useState(mondayOf(/* @__PURE__ */ new Date()));
    const [data, setData] = reactExports.useState(null);
    const [jobs, setJobs] = reactExports.useState([]);
    const [sel, setSel] = reactExports.useState(null);
    const [jobId, setJobId] = reactExports.useState("");
    const [note, setNote] = reactExports.useState("");
    const [msg, setMsg] = reactExports.useState("");
    const load2 = () => {
      api("/api/schedule?week=" + week).then(setData).catch(() => {
      });
    };
    reactExports.useEffect(load2, [week]);
    reactExports.useEffect(() => {
      api("/api/schedule/jobs").then(setJobs).catch(() => {
      });
    }, []);
    const shift = (n2) => {
      const d2 = /* @__PURE__ */ new Date(week + "T12:00:00");
      d2.setDate(d2.getDate() + n2 * 7);
      setWeek(mondayOf(d2));
    };
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d2 = /* @__PURE__ */ new Date(week + "T12:00:00");
      d2.setDate(d2.getDate() + i);
      return { iso: d2.toISOString().slice(0, 10), lab: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i] + " " + (d2.getMonth() + 1) + "/" + d2.getDate() };
    });
    const crew = users.filter((u2) => ["PM", "LEAD_OWNER", "OPS_ADMIN"].includes(u2.role) || ((data == null ? void 0 : data.rows) || []).some((r2) => r2.user_id === u2.id));
    const cell = (uid2, iso) => ((data == null ? void 0 : data.rows) || []).filter((r2) => r2.user_id === uid2 && r2.work_date === iso);
    const assign = async () => {
      if (!sel || !jobId) return;
      const r2 = await api("/api/schedule", { method: "POST", body: { user_id: sel.user_id, lead_id: jobId, work_date: sel.date, note } }).catch((e) => ({ error: e.message }));
      if (r2.error) setMsg("Couldn't assign: " + r2.error);
      else {
        setMsg("Scheduled ✓ — they've been notified");
        setSel(null);
        setJobId("");
        setNote("");
        load2();
        window.dispatchEvent(new Event("wp-ops"));
      }
    };
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Crew schedule — who's on which job, this week" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => shift(-1), children: "← Prev week" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
          "Week of ",
          week
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => shift(1), children: "Next week →" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setWeek(mondayOf(/* @__PURE__ */ new Date())), children: "This week" })
      ] }),
      ((data == null ? void 0 : data.jobs) || []).length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 13 }, children: "🛠 Jobs starting this week" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { marginTop: 4 }, children: ((data == null ? void 0 : data.jobs) || []).map((jb2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "schedChip", style: { cursor: "pointer" }, onClick: () => {
          var _a2;
          return (_a2 = window.wpOpenJob) == null ? void 0 : _a2.call(window, jb2.id);
        }, children: [
          "🛠 ",
          String(jb2.scheduled_start).slice(5, 10),
          " · ",
          String(jb2.scheduled_start).slice(11, 16),
          " — ",
          jb2.service_requested,
          " · ",
          jb2.contact_name
        ] }, jb2.id)) })
      ] }),
      msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Worker" }),
          days.map((d2) => /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: d2.lab }, d2.iso))
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
          crew.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: u2.name }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: u2.role })
            ] }),
            days.map((d2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { style: { minWidth: 118, verticalAlign: "top" }, children: [
              cell(u2.id, d2.iso).map((e) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "schedChip" + (e.conflict ? " warn" : ""), children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
                  e.conflict ? "⚠ " : "",
                  e.service_requested,
                  " — ",
                  e.contact_name
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { padding: "0 4px" }, onClick: async () => {
                  await api("/api/schedule/" + e.id, { method: "DELETE" });
                  load2();
                  window.dispatchEvent(new Event("wp-ops"));
                }, children: "✕" })
              ] }, e.id)),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setSel({ user_id: u2.id, date: d2.iso }), children: "+ Assign" })
            ] }, d2.iso))
          ] }, u2.id)),
          crew.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 8, className: "muted", children: "No crew members yet." }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "⚠ marks a double-booking — same person, two jobs, one day. Assigning notifies the worker." }),
      sel && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginTop: 10, background: "#f8fafc" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
          "Assign ",
          (_a = users.find((u2) => u2.id === sel.user_id)) == null ? void 0 : _a.name,
          " — ",
          sel.date
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: jobId, onChange: (e) => setJobId(e.target.value), style: { flex: 1 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Pick a job (approved / sent / won)…" }),
            jobs.map((j) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: j.id, children: [
              j.service_requested,
              " — ",
              j.contact_name,
              " (",
              j.state,
              ")"
            ] }, j.id))
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Note (arrival time, phase…)", value: note, onChange: (e) => setNote(e.target.value), style: { flex: 1 } }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", disabled: !jobId, onClick: assign, children: "Assign" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setSel(null), children: "Cancel" })
        ] })
      ] })
    ] });
  }
  function TimesheetsCard() {
    const mondayOf = (d2) => {
      const x2 = new Date(d2);
      const day = (x2.getDay() + 6) % 7;
      x2.setDate(x2.getDate() - day);
      x2.setHours(0, 0, 0, 0);
      return x2.toISOString().slice(0, 10);
    };
    const [week, setWeek] = reactExports.useState(mondayOf(/* @__PURE__ */ new Date()));
    const [data, setData] = reactExports.useState(null);
    const [editId, setEditId] = reactExports.useState("");
    const [days, setDays] = reactExports.useState({});
    const [notes, setNotes] = reactExports.useState("");
    const [msg, setMsg] = reactExports.useState("");
    const load2 = () => {
      api("/api/timesheets?week=" + week).then(setData).catch(() => {
      });
    };
    reactExports.useEffect(load2, [week]);
    reactExports.useEffect(() => {
      const h = () => load2();
      window.addEventListener("wp-ops", h);
      return () => window.removeEventListener("wp-ops", h);
    });
    const shift = (n2) => {
      const d2 = /* @__PURE__ */ new Date(week + "T12:00:00");
      d2.setDate(d2.getDate() + n2 * 7);
      setWeek(mondayOf(d2));
    };
    const startEdit = (r2) => {
      setEditId(r2.id);
      setDays(r2.days || {});
      setNotes(r2.notes || "");
    };
    const save = async (r2) => {
      await api("/api/timesheets", { method: "POST", body: { manager_id: r2.manager_id, week_of: week, days, notes } });
      setEditId("");
      setMsg(`Timesheet saved for ${r2.manager} ✓`);
      load2();
    };
    const chase2 = async (r2) => {
      await api(`/api/timesheets/${r2.id}/chase`, { method: "POST", body: {} });
      setMsg(`Chase sent to ${r2.manager} ✓`);
      load2();
    };
    const chaseAll = async () => {
      if (!data) return;
      for (const r2 of data.rows.filter((x2) => x2.status === "missing")) await api(`/api/timesheets/${r2.id}/chase`, { method: "POST", body: {} });
      setMsg("All missing timesheets chased ✓");
      load2();
    };
    const dayNames = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Timesheets — logged, chased, payroll-ready" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => shift(-1), children: "← Prev week" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
          "Week of ",
          week
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => shift(1), children: "Next week →" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setWeek(mondayOf(/* @__PURE__ */ new Date())), children: "This week" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: chaseAll, children: "📣 Chase all missing" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn ghost small", style: { textDecoration: "none" }, href: `/api/timesheets/export?week=${week}`, children: "⬇ Payroll CSV" })
      ] }),
      msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
      !data && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading…" }),
      data && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { marginTop: 0 }, children: [
          data.summary.submitted,
          " of ",
          data.rows.length,
          " submitted · ",
          data.summary.total_hours,
          " grid hours · ",
          data.summary.job_hours || 0,
          " job hours (",
          money(data.summary.job_cost || 0),
          " labor) · ",
          data.summary.missing,
          " missing. Expected sheets are created automatically for every field manager; missing ones past their week get chased automatically (and you can chase any time)."
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Manager" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Status" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Grid hrs" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Job hrs" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Labor $" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", {})
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
            data.rows.map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.manager }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
                r2.status === "submitted" ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st warn", children: "submitted" }) : r2.status === "reviewed" ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st warn", children: "reviewed" }) : r2.status === "approved" ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st pass", children: "approved ✓" }) : r2.status === "rejected" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "st fail", children: [
                  "rejected",
                  r2.rejection_reason ? " — " + r2.rejection_reason : ""
                ] }) : r2.status === "exported" ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st pass", children: "exported" }) : r2.overdue ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st fail", children: "missing · overdue" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st warn", children: "missing" }),
                r2.chased_at ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
                  " · chased ",
                  dOnly(r2.chased_at)
                ] }) : ""
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.hours ?? "—" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.job_hours || "—" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.job_cost ? money(r2.job_cost) : "—" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rowflex", children: [
                  r2.status === "missing" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => chase2(r2), children: "Chase" }),
                  r2.status === "submitted" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
                      await api(`/api/timesheets/${r2.id}/review`, { method: "POST", body: {} });
                      load2();
                    }, children: "Review" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
                      await api(`/api/timesheets/${r2.id}/approve`, { method: "POST", body: {} });
                      setMsg(`Timesheet approved for ${r2.manager} ✓ — it can now be exported to payroll`);
                      load2();
                    }, children: "Approve" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
                      const reason = prompt("Reject this timesheet — reason (goes back to the submitter):");
                      if (!reason) return;
                      await api(`/api/timesheets/${r2.id}/reject`, { method: "POST", body: { reason } });
                      load2();
                    }, children: "Reject" })
                  ] }),
                  r2.status === "reviewed" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
                      await api(`/api/timesheets/${r2.id}/approve`, { method: "POST", body: {} });
                      setMsg(`Timesheet approved for ${r2.manager} ✓`);
                      load2();
                    }, children: "Approve" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
                      const reason = prompt("Reject this timesheet — reason:");
                      if (!reason) return;
                      await api(`/api/timesheets/${r2.id}/reject`, { method: "POST", body: { reason } });
                      load2();
                    }, children: "Reject" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => startEdit(r2), children: ["submitted", "reviewed"].includes(r2.status) ? "Edit" : "Log hours" })
                ] }),
                editId === r2.id && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 8 }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
                    dayNames.map(([k2, lab]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { fontSize: 12 }, children: [
                      lab,
                      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", max: "24", style: { width: 58, display: "block" }, value: days[k2] ?? "", onChange: (e) => setDays({ ...days, [k2]: e.target.value === "" ? "" : Number(e.target.value) }) })
                    ] }, k2)),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { style: { alignSelf: "end", paddingBottom: 8 }, children: [
                      "Σ ",
                      dayNames.reduce((a, [k2]) => a + (Number(days[k2]) || 0), 0),
                      "h"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Notes (jobs covered, PTO, etc.)", value: notes, onChange: (e) => setNotes(e.target.value), style: { marginTop: 6 } }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 6 }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: () => save(r2), children: "Save timesheet" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setEditId(""), children: "Cancel" })
                  ] })
                ] })
              ] })
            ] }, r2.id)),
            data.rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 6, className: "muted", children: "No field managers (PM / Lead Owner roles) in this workspace yet." }) })
          ] })
        ] })
      ] })
    ] });
  }
  const [d, setD] = reactExports.useState(null);
  const [inbox, setInbox] = reactExports.useState([]);
  const load = () => {
    api("/api/ops").then(setD).catch(() => {
    });
    api("/api/inbox").then(setInbox).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  if (!d) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading ops…" });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Ops Console" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "The daily chase, in one place: field reports, timesheets, site visits, paperwork, and the full inbox (not just leads)." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid2" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Site visits" }),
        d.site_visits.map((v2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "6px 0" }, children: [
          "📍 ",
          v2.service_requested,
          " — ",
          dt(v2.scheduled_at),
          " · ",
          v2.status
        ] }, v2.id)),
        d.site_visits.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "None scheduled." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Documents tracker" }),
        d.documents.map((doc) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${doc.status === "received" ? "pass" : "fail"}`, children: doc.status === "received" ? "✓" : "✗" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            doc.name,
            " — ",
            doc.status,
            doc.required ? " (required)" : ""
          ] })
        ] }, doc.id))
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(FieldReportsCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ScheduleCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TimesheetsCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TimeGridCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(InboxQueue, { inbox, reload: load })
  ] });
}
function AccessModal({ member, close, done }) {
  const [p2, setP] = reactExports.useState({ ...member.permissions });
  const [limit, setLimit] = reactExports.useState(member.approval_limit || 0);
  const [err, setErr] = reactExports.useState("");
  const T2 = ({ k: k2, label, hint }) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", style: { display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #eef2f7" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto", marginTop: 2 }, checked: !!p2[k2], onChange: (e) => setP({ ...p2, [k2]: e.target.checked }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: label }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: hint })
    ] })
  ] });
  const save = async () => {
    try {
      await api(`/api/team/${member.id}`, { method: "PATCH", body: { permissions: p2, approval_limit: Number(limit) || 0 } });
      done();
    } catch (e) {
      setErr(e.message);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", style: { maxWidth: 520 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { margin: 0 }, children: [
        "Access — ",
        member.name
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: close, children: "✕ Close" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "Role: ",
      member.role,
      ". These restrictions apply on top of the role and are enforced by the server — not just hidden in the interface."
    ] }),
    err && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: err }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Which leads can they see?" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: p2.leads_scope || "own", onChange: (e) => setP({ ...p2, leads_scope: e.target.value }), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "All leads in the business" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "own", children: "Only leads they own or PM" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { k: "can_approve", label: "Can approve proposals", hint: "Decide approval packets (still bounded by their approval limit below)." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { k: "can_billing", label: "Can see billing", hint: "Subscription, plan and invoices. Money screens stay owner-only unless this is on." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { k: "can_settings", label: "Can change settings", hint: "Workspace settings, price book, templates, services and integrations." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { k: "can_export", label: "Can export reports", hint: "Download CSV exports from Reports." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { k: "can_manage_team", label: "Can manage team access", hint: "Change other members' roles and restrictions. Powerful — grant sparingly." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", style: { marginTop: 12 }, children: "Approval limit ($) — proposals above this need a higher approver" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", value: limit, onChange: (e) => setLimit(e.target.value) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: save, children: "Save access" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: async () => {
        try {
          await api(`/api/team/${member.id}`, { method: "PATCH", body: { permissions: {} } });
          done();
        } catch (e) {
          setErr(e.message);
        }
      }, children: "Reset to role defaults" })
    ] })
  ] }) });
}
function RatesTab({ users, refreshUsers }) {
  const [classes, setClasses] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const [nc2, setNc] = reactExports.useState({ name: "", private_rate: "", govt_rate: "" });
  const load = () => {
    api("/api/labor-classes").then(setClasses).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const saveRow = async (c) => {
    await api("/api/labor-classes/" + c.id, { method: "PATCH", body: { name: c.name, private_rate: Number(c.private_rate) || 0, govt_rate: Number(c.govt_rate) || 0 } });
    setMsg(`Saved ${c.name} ✓`);
    load();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Labor rates — private vs government (prevailing wage)" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "Each worker belongs to a class. When time is logged on a job, the rate comes from the class — the ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "private" }),
      " column for private jobs, the ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "government" }),
      " column for government/prevailing-wage jobs (set per job on its Crew & Time tab). Rates snapshot onto each entry, so raising rates later never changes old jobs' costs."
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    classes.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => {
      const r2 = await api("/api/labor-classes/seed-defaults", { method: "POST", body: {} });
      setClasses(r2);
      setMsg("Standard classes loaded — adjust the numbers to your payroll ✓");
    }, children: "Load standard classes (Laborer / Technician / Foreman / PM)" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Class" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Private $/hr" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Government $/hr" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", {})
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: classes.map((c, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: c.name, onChange: (e) => {
          const n2 = [...classes];
          n2[i] = { ...c, name: e.target.value };
          setClasses(n2);
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", step: "0.5", style: { width: 100 }, value: c.private_rate, onChange: (e) => {
          const n2 = [...classes];
          n2[i] = { ...c, private_rate: e.target.value };
          setClasses(n2);
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", step: "0.5", style: { width: 100 }, value: c.govt_rate, onChange: (e) => {
          const n2 = [...classes];
          n2[i] = { ...c, govt_rate: e.target.value };
          setClasses(n2);
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rowflex", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => saveRow(c), children: "Save" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            await api("/api/labor-classes/" + c.id, { method: "DELETE" });
            load();
            refreshUsers();
          }, children: "Delete" })
        ] }) })
      ] }, c.id)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "New class name", value: nc2.name, onChange: (e) => setNc({ ...nc2, name: e.target.value }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", placeholder: "Private $/hr", style: { width: 110 }, value: nc2.private_rate, onChange: (e) => setNc({ ...nc2, private_rate: e.target.value }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", placeholder: "Govt $/hr", style: { width: 110 }, value: nc2.govt_rate, onChange: (e) => setNc({ ...nc2, govt_rate: e.target.value }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        if (!nc2.name) return;
        await api("/api/labor-classes", { method: "POST", body: { name: nc2.name, private_rate: Number(nc2.private_rate) || 0, govt_rate: Number(nc2.govt_rate) || 0 } });
        setNc({ name: "", private_rate: "", govt_rate: "" });
        load();
      }, children: "Add class" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { marginTop: 18 }, children: "Who belongs to which class" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Team member" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Role" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Labor class" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: u2.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: u2.role }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: u2.labor_class_id || "", onChange: async (e) => {
          await api("/api/team/" + u2.id, { method: "PATCH", body: { labor_class_id: e.target.value || null } });
          setMsg(`Class updated for ${u2.name} ✓`);
          refreshUsers();
        }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "— No class (time costs $0) —" }),
          classes.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: c.id, children: [
            c.name,
            " (",
            money(c.private_rate),
            " priv · ",
            money(c.govt_rate),
            " govt)"
          ] }, c.id))
        ] }) })
      ] }, u2.id)) })
    ] })
  ] });
}
function Settings({ users, setUsers, priceBook, setPriceBook, onJump, me: me2 }) {
  var _a, _b, _c;
  const myPerms = me2 == null ? void 0 : me2.permissions;
  const canSettings = !myPerms || myPerms.can_settings;
  const canTeam = !myPerms || myPerms.can_manage_team;
  const [accessFor, setAccessFor] = reactExports.useState(null);
  const [tab, setTab] = reactExports.useState("workspace");
  const [s, setS] = reactExports.useState(null);
  const [msg, setMsg] = reactExports.useState("");
  const [tpls, setTpls] = reactExports.useState([]);
  const [svcs, setSvcs] = reactExports.useState([]);
  const [keys, setKeys] = reactExports.useState([]);
  const [newKey, setNewKey] = reactExports.useState("");
  const [hooks, setHooks] = reactExports.useState([]);
  const [flags, setFlags] = reactExports.useState({});
  const [oauth, setOauth] = reactExports.useState(null);
  const [catalog, setCatalog] = reactExports.useState([]);
  const [cfg, setCfg] = reactExports.useState(null);
  const [cfgMsg, setCfgMsg] = reactExports.useState("");
  const [syncRange, setSyncRange] = reactExports.useState("30");
  reactExports.useEffect(() => {
    api("/api/integrations").then((r2) => setCatalog(r2.integrations)).catch(() => {
    });
  }, []);
  const [nb2, setNb] = reactExports.useState({ name: "", unit: "job", standard_price: "", floor_price: "" });
  const [pb2, setPb] = reactExports.useState([]);
  reactExports.useEffect(() => {
    setPb(priceBook);
  }, [priceBook]);
  const [tplEdit, setTplEdit] = reactExports.useState(null);
  const [nt, setNt] = reactExports.useState({ name: "", body: "" });
  const [nu, setNu] = reactExports.useState({ name: "", email: "", role: "LEAD_OWNER", password: "" });
  const [nh2, setNh] = reactExports.useState("");
  const loadAll = () => {
    api("/api/settings").then(setS).catch(() => {
    });
    api("/api/templates").then(setTpls).catch(() => {
    });
    api("/api/services").then(setSvcs).catch(() => {
    });
    api("/api/api-keys").then(setKeys).catch(() => {
    });
    api("/api/webhooks").then(setHooks).catch(() => {
    });
    api("/api/flags").then(setFlags).catch(() => {
    });
    api("/api/oauth/status").then(setOauth).catch(() => {
    });
    api("/api/users").then(setUsers).catch(() => {
    });
    api("/api/price-book").then(setPriceBook).catch(() => {
    });
  };
  reactExports.useEffect(loadAll, []);
  const T2 = ({ id: id2, children }) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === id2 ? "on" : "", onClick: () => setTab(id2), children });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Settings" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Everything configurable, in the product — no engineer required." }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", children: [
      canSettings && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "workspace", children: "Workspace" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "pricebook", children: "Price Book" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "templates", children: "Templates" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "services", children: "Services" })
      ] }),
      canTeam && /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "team", children: "Team" }),
      canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "workers", children: "Workers" }),
      canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "rates", children: "Labor & Rates" }),
      canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "rules", children: "Inbox Rules" }),
      canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "cfields", children: "Custom Fields" }),
      canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "assign", children: "Assignment" }),
      canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "integrations", children: "Integrations" }),
      ((_a = me2 == null ? void 0 : me2.permissions) == null ? void 0 : _a.can_billing) && /* @__PURE__ */ jsxRuntimeExports.jsx(T2, { id: "billing", children: "Billing" })
    ] }),
    tab === "billing" && /* @__PURE__ */ jsxRuntimeExports.jsx(Billing, {}),
    !canSettings && !canTeam && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", children: "Your access doesn't include settings or team management. Ask an owner or admin if you need something changed." }),
    tab === "workspace" && canSettings && s && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Business name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: s.workspace.name || "", onChange: (e) => setS({ ...s, workspace: { ...s.workspace, name: e.target.value } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Vertical" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: s.workspace.vertical || "", onChange: (e) => setS({ ...s, workspace: { ...s.workspace, vertical: e.target.value } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Timezone" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: s.workspace.timezone || "", onChange: (e) => setS({ ...s, workspace: { ...s.workspace, timezone: e.target.value } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Deposit % on signed proposals" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", value: s.workspace.deposit_pct ?? 25, onChange: (e) => setS({ ...s, workspace: { ...s.workspace, deposit_pct: Number(e.target.value) } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Autonomy level (1 draft-only · 2 bulk-approve · 3 scoped auto)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: s.workspace.autonomy_level ?? 1, onChange: (e) => setS({ ...s, workspace: { ...s.workspace, autonomy_level: Number(e.target.value) } }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: 1, children: "1 — draft only" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: 2, children: "2 — bulk approve" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: 3, children: "3 — scoped auto-approval" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Proposal approval policy" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: s.workspace.approval_policy || "amount", onChange: (e) => setS({ ...s, workspace: { ...s.workspace, approval_policy: e.target.value } }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "off", children: "Off — send freely, no approvals" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "amount", children: "By amount — approve only above the threshold" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "always", children: "Always — every proposal needs approval before sending" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Approval threshold ($)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", value: s.workspace.approval_threshold ?? 25e3, onChange: (e) => setS({ ...s, workspace: { ...s.workspace, approval_threshold: Number(e.target.value) } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Counts" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
            num(s.counts.leads),
            " leads · ",
            num(s.counts.users),
            " users · ",
            num(s.counts.price_items),
            " price items"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Lead source API URL (for Sync)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: s.workspace.source_api_url || "", placeholder: "Leave blank to use the built-in demo source", onChange: (e) => setS({ ...s, workspace: { ...s.workspace, source_api_url: e.target.value } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Sender name (outgoing email)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: s.workspace.from_name || "", placeholder: "Your business name", onChange: (e) => setS({ ...s, workspace: { ...s.workspace, from_name: e.target.value } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Sender email (outgoing email)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: s.workspace.from_email || "", placeholder: "you@yourbusiness.com", onChange: (e) => setS({ ...s, workspace: { ...s.workspace, from_email: e.target.value } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Slack webhook URL (new-lead + approval alerts)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: s.workspace.slack_webhook_url || "", placeholder: "https://hooks.slack.com/services/…", onChange: (e) => setS({ ...s, workspace: { ...s.workspace, slack_webhook_url: e.target.value } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Lead source API key (if required)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: s.workspace.source_api_key || "", placeholder: "Bearer key for your source system", onChange: (e) => setS({ ...s, workspace: { ...s.workspace, source_api_key: e.target.value } }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { marginTop: 14 }, onClick: async () => {
        await api("/api/settings", { method: "PATCH", body: s.workspace });
        setMsg("Workspace settings saved ✓");
      }, children: "Save workspace" })
    ] }),
    tab === "workspace" && canSettings && s && /* @__PURE__ */ jsxRuntimeExports.jsx(FollowupSettings, { ws: s.workspace }, s.workspace.id),
    tab === "workspace" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Help & shortcuts" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "4px 0" }, children: [
        "⌘K — jump anywhere · J/K — move in the Work Queue · Enter — open · The free Backlog Audit lives at ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/audit", target: "_blank", rel: "noreferrer", children: "/audit" }),
        " (share it with prospects). Support: reply to any Workpile email or write to the workspace owner. Every number in this app traces to a record — click through instead of screenshotting."
      ] })
    ] }),
    tab === "workspace" && canSettings && s && /* @__PURE__ */ jsxRuntimeExports.jsx(BookingSettings, { ws: s.workspace }, "bk" + s.workspace.id),
    tab === "pricebook" && canSettings && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Item" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Unit" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Standard" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Floor" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: pb2.map((p2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: p2.name }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: p2.unit }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", step: "0.5", style: { width: 110 }, value: p2.standard_price, onChange: (e) => {
            const n2 = [...pb2];
            n2[i] = { ...p2, standard_price: e.target.value };
            setPb(n2);
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", step: "0.5", style: { width: 110 }, value: p2.floor_price, onChange: (e) => {
            const n2 = [...pb2];
            n2[i] = { ...p2, floor_price: e.target.value };
            setPb(n2);
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
              await api(`/api/price-book/${p2.id}`, { method: "PATCH", body: { standard_price: Number(p2.standard_price) || 0, floor_price: Number(p2.floor_price) || 0 } });
              setMsg("Price saved ✓");
              loadAll();
            }, children: "Save" }),
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
              await api(`/api/price-book/${p2.id}`, { method: "DELETE" });
              loadAll();
            }, children: "Delete" })
          ] })
        ] }, p2.id)) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 12 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 2 }, placeholder: "New item name", value: nb2.name, onChange: (e) => setNb({ ...nb2, name: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { width: 90 }, placeholder: "unit", value: nb2.unit, onChange: (e) => setNb({ ...nb2, unit: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { width: 120 }, type: "number", placeholder: "standard $", value: nb2.standard_price, onChange: (e) => setNb({ ...nb2, standard_price: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { width: 120 }, type: "number", placeholder: "floor $", value: nb2.floor_price, onChange: (e) => setNb({ ...nb2, floor_price: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => {
          await api("/api/price-book", { method: "POST", body: { ...nb2, standard_price: Number(nb2.standard_price) || 0, floor_price: Number(nb2.floor_price) || 0 } });
          setNb({ name: "", unit: "job", standard_price: "", floor_price: "" });
          loadAll();
        }, children: "Add item" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Proposals can only price from this book — the floor is the margin guardrail the Approval Gate enforces." })
    ] }),
    tab === "templates" && canSettings && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(VerticalPacksCard, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DocTemplatesEditor, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Message templates" }),
      tpls.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { borderBottom: "1px solid #eef2f7", padding: "10px 0" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: t2.name }),
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
          "· ",
          t2.kind,
          " · v",
          t2.version,
          " · ",
          t2.active ? "active" : "inactive"
        ] }),
        (tplEdit == null ? void 0 : tplEdit.id) === t2.id ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 5, value: tplEdit.body, onChange: (e) => setTplEdit({ ...tplEdit, body: e.target.value }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rowflex", style: { marginTop: 6 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
              await api(`/api/templates/${t2.id}`, { method: "PATCH", body: { body: tplEdit.body } });
              setTplEdit(null);
              loadAll();
            }, children: "Save" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setTplEdit(null), children: "Cancel" })
          ] })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { whiteSpace: "pre-wrap" }, children: t2.body }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setTplEdit({ id: t2.id, body: t2.body }), children: "Edit" })
        ] }),
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api(`/api/templates/${t2.id}`, { method: "DELETE" });
          loadAll();
        }, children: "Delete" })
      ] }, t2.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", style: { marginTop: 12 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "New template name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: nt.name, onChange: (e) => setNt({ ...nt, name: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "full", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "f", children: [
            "Body (merge fields: ",
            "{{contact_name}} {{service}} {{total}}",
            ")"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 4, value: nt.body, onChange: (e) => setNt({ ...nt, body: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { marginTop: 10 }, onClick: async () => {
        await api("/api/templates", { method: "POST", body: nt });
        setNt({ name: "", body: "" });
        loadAll();
      }, children: "Add template" })
    ] }),
    tab === "services" && canSettings && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      svcs.map((sv) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${sv.active ? "pass" : "fail"}`, children: sv.active ? "✓" : "✗" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
          sv.name,
          " ",
          sv.is_catalog ? "" : "(not in catalog — Demand Gap territory)"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api(`/api/services/${sv.id}`, { method: "PATCH", body: { active: !sv.active } });
          loadAll();
        }, children: sv.active ? "Deactivate" : "Activate" })
      ] }, sv.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "New service name", id: "nsvc" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => {
          const el2 = document.getElementById("nsvc");
          await api("/api/services", { method: "POST", body: { name: el2.value } });
          el2.value = "";
          loadAll();
        }, children: "Add service" })
      ] })
    ] }),
    tab === "team" && canTeam && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Email" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Role" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Approval limit" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
            u2.name,
            u2.has_overrides ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", style: { marginLeft: 6, background: "#fef9c3", color: "#854d0e" }, children: "custom access" }) : null
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: u2.email }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: u2.role, onChange: async (e) => {
            await api(`/api/team/${u2.id}`, { method: "PATCH", body: { role: e.target.value } });
            loadAll();
          }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "OWNER" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "APPROVER" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "OPS_ADMIN" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "LEAD_OWNER" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "PM" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "ADMIN" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: u2.role === "OWNER" ? /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { color: "#14532d" }, children: "Unlimited" }) : money(u2.approval_limit) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: u2.role === "OWNER" ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "Full access" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setAccessFor(u2), children: "Access…" }) })
        ] }, u2.id)) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 12 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "Name", value: nu.name, onChange: (e) => setNu({ ...nu, name: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "Email", value: nu.email, onChange: (e) => setNu({ ...nu, email: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "Temp password", value: nu.password, onChange: (e) => setNu({ ...nu, password: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 150 }, value: nu.role, onChange: (e) => setNu({ ...nu, role: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "LEAD_OWNER" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "PM" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "APPROVER" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "OPS_ADMIN" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => {
          await api("/api/users", { method: "POST", body: nu });
          setNu({ name: "", email: "", role: "LEAD_OWNER", password: "" });
          loadAll();
          setMsg("Team member added ✓");
        }, children: "Add member" })
      ] }),
      accessFor && /* @__PURE__ */ jsxRuntimeExports.jsx(AccessModal, { member: accessFor, close: () => setAccessFor(null), done: () => {
        setAccessFor(null);
        loadAll();
        setMsg("Access updated ✓");
      } })
    ] }),
    tab === "rates" && canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(RatesTab, { users, refreshUsers: loadAll }),
    tab === "workers" && canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(WorkersTab, {}),
    tab === "rules" && canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(InboxRulesTab, { users }),
    tab === "cfields" && canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(CustomFieldsTab, {}),
    tab === "assign" && canSettings && /* @__PURE__ */ jsxRuntimeExports.jsx(AssignmentRulesTab, { users }),
    tab === "integrations" && canSettings && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Integration catalog — every way data moves in and out" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "featGrid", children: catalog.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feat clickable", onClick: () => {
          setCfg(c.id);
          setCfgMsg("");
        }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: c.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", style: c.status === "connected" ? { background: "#dcfce7", color: "#166534" } : c.status === "test_mode" || c.status === "demo_source" ? { background: "#fef9c3", color: "#854d0e" } : {}, children: c.status.replaceAll("_", " ") })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: c.detail }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "cfgHint", children: "Configure →" })
        ] }, c.id)) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "API keys" }),
        keys.map((k2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "6px 0" }, children: [
          k2.label,
          " · scopes ",
          k2.scopes,
          " · ",
          k2.revoked_at ? "revoked" : "active",
          " ",
          k2.revoked_at ? "" : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            await api(`/api/api-keys/${k2.id}`, { method: "DELETE" });
            loadAll();
          }, children: "Revoke" })
        ] }, k2.id)),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => {
          const r2 = await api("/api/api-keys", { method: "POST", body: { label: "Integration key" } });
          setNewKey(r2.key);
          loadAll();
        }, children: "Generate new key" }),
        newKey && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mono ok", children: [
          "New key (shown once): ",
          newKey
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
          "Your system pulls finals from ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mono", children: "GET /v1/outcomes" }),
          " and acknowledges with ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mono", children: "POST /v1/outcomes/:id/ack" }),
          ". Push alternative: webhooks below."
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Webhook endpoints (signed, HMAC)" }),
        hooks.map((h) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "6px 0" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mono", children: h.url }),
          " · ",
          h.events,
          " · ",
          h.active ? "active" : "off",
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            await api(`/api/webhooks/${h.id}`, { method: "DELETE" });
            loadAll();
          }, children: "Disable" })
        ] }, h.id)),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "https://your-system.example/webhooks/workpile", value: nh2, onChange: (e) => setNh(e.target.value) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "Events (comma list or *)", id: "nhev", defaultValue: "lead.created,lead.state_changed,approval.decided,proposal.signed,deposit.paid,outcome.final" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => {
            await api("/api/webhooks", { method: "POST", body: { url: nh2, events: document.getElementById("nhev").value } });
            setNh("");
            loadAll();
          }, children: "Add endpoint" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "API quick reference — https://workpile.io" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "tableWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Method" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Endpoint" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "What it does" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Scope" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: [["POST", "/v1/leads", "Create a lead — idempotent, deduped by phone/email", "leads:write"], ["GET", "/v1/leads", "List leads (filter by state)", "leads:read"], ["GET", "/v1/leads/:id", "Read one lead", "leads:read"], ["POST", "/v1/leads/:id/outcome", "Push a final outcome BACK into Workpile", "outcomes:write"], ["POST", "/v1/inbox", "Send an email/message for AI triage", "leads:write"], ["GET", "/v1/outcomes", "Pull final outcomes for your system", "outcomes:read"], ["POST", "/v1/outcomes/:id/ack", "Acknowledge with your system's ID", "outcomes:read"], ["GET", "/v1/projects/:leadId", "Won lead's full project package", "projects:read"]].map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: r2[0] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: r2[1] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2[2] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2[3] })
          ] }, r2[1] + r2[0])) })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
          "Full machine-readable spec: ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/openapi.json", target: "_blank", children: "workpile.io/openapi.json" }),
          " · Webhooks are HMAC-signed (",
          /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "X-Workpile-Signature" }),
          ") and only marked delivered on a real 2xx from your endpoint. Zapier, Make, and n8n connect through this same API + webhooks today."
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Inbox connections" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
          "Gmail: ",
          ((_b = oauth == null ? void 0 : oauth.google) == null ? void 0 : _b.configured) ? "app configured" : "not configured on this deployment",
          " · Outlook: ",
          ((_c = oauth == null ? void 0 : oauth.microsoft) == null ? void 0 : _c.configured) ? "app configured" : "not configured",
          ". Manual/API/CSV ingestion works regardless."
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 16 }, children: "Feature flags (canary)" }),
        Object.entries(flags).map(([k2, v2]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${v2 ? "pass" : "fail"}`, children: v2 ? "✓" : "✗" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 }, children: k2.replaceAll("_", " ") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            await api("/api/flags", { method: "POST", body: { flag: k2, enabled: !v2 } });
            loadAll();
          }, children: v2 ? "Turn off" : "Turn on" })
        ] }, k2)),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 16 }, children: "Website form embed (captures TCPA consent automatically)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mono", children: [
          '<script src="',
          location.origin,
          '/embed/v1.js" data-workspace="YOUR_WORKSPACE" data-form="#lead-form"><\/script>'
        ] })
      ] })
    ] }),
    cfg && s && /* @__PURE__ */ jsxRuntimeExports.jsx(IntegrationConfig, { id: cfg, s, setS, keys, hooks, oauth, loadAll, onJump, msg: cfgMsg, setMsg: setCfgMsg, syncRange, setSyncRange, close: () => setCfg(null) })
  ] });
}
function IntegrationConfig({ id: id2, s, setS, keys, hooks, oauth, loadAll, onJump, msg, setMsg, syncRange, setSyncRange, close }) {
  var _a, _b, _c, _d;
  if (!id2) return null;
  const ws = (s == null ? void 0 : s.workspace) || {};
  const saveSettings = async (patch) => {
    await api("/api/settings", { method: "PATCH", body: patch });
    setMsg("Saved.");
    loadAll();
  };
  const runSync = async (days) => {
    const to = /* @__PURE__ */ new Date();
    const from = new Date(Date.now() - days * 864e5);
    setMsg("Syncing…");
    const r2 = await api("/api/sync/run", { method: "POST", body: { from: from.toISOString(), to: to.toISOString() } });
    setMsg(`Sync done: ${r2.fetched} fetched · ${r2.created} created · ${r2.duplicates} duplicates skipped.`);
  };
  const T2 = { rest_api: "REST API (two-way)", webhooks: "Event Webhooks", sync: "Lead Sync (pull)", csv: "CSV Import / Export", embed: "Website Form Embed", email_in: "Email-In API", gmail_outlook: "Gmail + Outlook", slack: "Slack Notifications", stripe: "Stripe", zapier_make: "Zapier / Make / n8n", handoff: "Final Outcome Handoff" };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalOverlay", onClick: close, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modalHead", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { margin: 0 }, children: [
        "Configure — ",
        T2[id2] || id2
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: close, children: "✕" })
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "ok", children: msg }),
    id2 === "rest_api" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
        "API keys authenticate your systems. Scopes: leads:write, leads:read, outcomes:read, outcomes:write, projects:read. Full spec: ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/openapi.json", target: "_blank", children: "/openapi.json" })
      ] }),
      keys.map((k2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "6px 0" }, children: [
        k2.label,
        " · ",
        k2.scopes,
        " · ",
        k2.revoked_at ? "revoked" : "active",
        " ",
        k2.revoked_at ? "" : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api(`/api/api-keys/${k2.id}`, { method: "DELETE" });
          loadAll();
        }, children: "Revoke" })
      ] }, k2.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => {
        const r2 = await api("/api/api-keys", { method: "POST", body: { label: "integration", scopes: "leads:write,leads:read,outcomes:read,outcomes:write,projects:read" } });
        setMsg("New key (shown once): " + (r2.key || r2.raw_key || JSON.stringify(r2)));
        loadAll();
      }, children: "Generate new key" })
    ] }),
    id2 === "webhooks" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
        "Endpoints receive HMAC-signed events (header ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mono", children: "X-Workpile-Signature" }),
        "). A delivery counts only on a real 2xx from your server."
      ] }),
      hooks.map((h) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "6px 0" }, children: [
        h.url,
        " · events: ",
        h.events || "outcome.final",
        " · ",
        h.active ? "active" : "paused",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api(`/api/webhooks/${h.id}`, { method: "DELETE" });
          loadAll();
        }, children: "Remove" })
      ] }, h.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "cfgHookUrl", style: { flex: 1 }, placeholder: "https://your-system.example/webhooks/workpile" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "cfgHookEvents", style: { flex: 1 }, defaultValue: "lead.created,lead.state_changed,approval.decided,proposal.signed,deposit.paid,outcome.final" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { marginTop: 8 }, onClick: async () => {
        await api("/api/webhooks", { method: "POST", body: { url: document.getElementById("cfgHookUrl").value, events: document.getElementById("cfgHookEvents").value } });
        setMsg("Endpoint added.");
        loadAll();
      }, children: "Add endpoint" })
    ] }),
    id2 === "sync" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Workpile pulls leads from your lead system's API by date range. Leave the URL empty to use the built-in demo source." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Source API URL" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: ws.source_api_url || "", placeholder: "https://your-crm.example/api/leads", onChange: (e) => setS({ ...s, workspace: { ...ws, source_api_url: e.target.value } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Source API key (Bearer, if required)" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: ws.source_api_key || "", onChange: (e) => setS({ ...s, workspace: { ...ws, source_api_key: e.target.value } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "flex", gap: 8, alignItems: "center", margin: "10px 0" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: !!ws.sync_enabled, onChange: (e) => setS({ ...s, workspace: { ...ws, sync_enabled: e.target.checked ? 1 : 0 } }) }),
        " Daily auto-sync"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { marginTop: 8 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => saveSettings({ source_api_url: ws.source_api_url || "", source_api_key: ws.source_api_key || "", sync_enabled: !!ws.sync_enabled }), children: "Save sync settings" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Run a sync now" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
        [["Today", 1], ["7 days", 7], ["30 days", 30], ["90 days", 90]].map(([label, d]) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => runSync(d), children: label }, label)),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: ws.last_sync_at ? "Last sync: " + ws.last_sync_at : "Never synced" })
      ] })
    ] }),
    id2 === "csv" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Import a backlog CSV (name, phone, email, service, message, created date) — deduped by phone/email on the way in. Exports live in Reports." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => onJump && onJump("imports"), children: "Open CSV Import →" })
    ] }),
    id2 === "embed" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Paste this on any website with a lead form. Consent (TCPA) is captured automatically with each submission." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mono", style: { wordBreak: "break-all" }, children: `<script src="${location.origin}/embed/v1.js" data-workspace="${ws.id || "YOUR_WORKSPACE"}" data-form="#lead-form"><\/script>` }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => {
        var _a2;
        (_a2 = navigator.clipboard) == null ? void 0 : _a2.writeText(`<script src="${location.origin}/embed/v1.js" data-workspace="${ws.id || ""}" data-form="#lead-form"><\/script>`);
        setMsg("Snippet copied.");
      }, children: "Copy snippet" })
    ] }),
    id2 === "email_in" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Send any email-shaped payload and the triage agent files it as a lead (with phone extraction) or an owned inbox item." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mono", children: [
        "POST /v1/inbox · scope leads:write",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        "{ from_name, from_email, subject, body, received_at }"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Mailbox forwarding and Gmail/Outlook polling feed this same endpoint." })
    ] }),
    id2 === "gmail_outlook" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
        "Gmail: ",
        ((_a = oauth == null ? void 0 : oauth.google) == null ? void 0 : _a.configured) ? "app configured" : "platform app credentials not set on this deployment",
        " · Outlook: ",
        ((_b = oauth == null ? void 0 : oauth.microsoft) == null ? void 0 : _b.configured) ? "app configured" : "not configured"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "When the platform OAuth apps are configured, each workspace connects its mailbox here and polling feeds the Email-In triage pipeline. Until then, API/CSV/manual ingestion works fully." }),
      ((_c = oauth == null ? void 0 : oauth.google) == null ? void 0 : _c.configured) && /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn", href: "/api/oauth/google/start", children: "Connect Gmail" }),
      " ",
      ((_d = oauth == null ? void 0 : oauth.microsoft) == null ? void 0 : _d.configured) && /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn", href: "/api/oauth/microsoft/start", children: "Connect Outlook" })
    ] }),
    id2 === "slack" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Slack incoming webhook URL" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: ws.slack_webhook_url || "", placeholder: "https://hooks.slack.com/services/…", onChange: (e) => setS({ ...s, workspace: { ...ws, slack_webhook_url: e.target.value } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Fires on new leads and approval decisions." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => saveSettings({ slack_webhook_url: ws.slack_webhook_url || "" }), children: "Save" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: async () => {
          const r2 = await api("/api/integrations/slack/test", { method: "POST", body: {} }).catch((e) => ({ error: e.message }));
          setMsg(r2.ok ? "Test message sent to Slack ✓" : "Test failed — save the URL first, then check it.");
        }, children: "Send test message" })
      ] })
    ] }),
    id2 === "stripe" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
        "Status: ",
        typeof window !== "undefined" ? "" : "",
        "keys are a deployment-level secret (STRIPE_SECRET_KEY) — until set, deposits run in explicit test mode."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Deposit % required on signature" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", value: ws.deposit_pct ?? 25, onChange: (e) => setS({ ...s, workspace: { ...ws, deposit_pct: Number(e.target.value) } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => saveSettings({ deposit_pct: ws.deposit_pct ?? 25 }), children: "Save deposit %" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Workpile's own subscriptions are managed in Billing." })
    ] }),
    id2 === "zapier_make" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No separate app needed — both platforms speak REST + webhooks:" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
        "1. Generate an API key (REST API card).",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        "2. In Zapier/Make, use ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Webhooks by Zapier / HTTP" }),
        " actions against https://workpile.io/v1/… with that key as a Bearer header.",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        "3. For triggers, register a webhook endpoint above and point your Zap/Scenario at the same events."
      ] })
    ] }),
    id2 === "handoff" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Every final — won, lost, no response, N/A, junk, duplicate — is delivered to the customer's own platform two ways:" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
        "· ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Pull:" }),
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mono", children: "GET /v1/outcomes" }),
        ", then ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mono", children: "POST /v1/outcomes/:id/ack" }),
        " with their system ID. Won leads include the full project package (",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mono", children: "GET /v1/projects/:leadId" }),
        ").",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        "· ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Push:" }),
        " the ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mono", children: "outcome.final" }),
        " webhook event (configure under Event Webhooks)."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => onJump && onJump("handoffs"), children: "Open Handoff Monitor →" })
    ] })
  ] }) });
}
const PLANS_FALLBACK = [
  { key: "starter", name: "Starter", users: 2, active_requests: 150, list_price: 49, annual_price: 39, save_pct: 20, blurb: "For the small office getting its pile under control.", highlights: ["Price book, proposals, e-sign + deposits", "Email follow-ups + cadences", "Work Queue + AI agent (rules mode)", "Field crew always free"] },
  { key: "pro", name: "Pro", users: 5, active_requests: 750, list_price: 149, annual_price: 119, save_pct: 20, blurb: "The full execution system for a working office.", highlights: ["Everything in Starter", "SMS follow-ups", "API, webhooks + QuickBooks", "Your own sending domain", "Approval policies in full"] },
  { key: "business", name: "Business", users: 15, active_requests: 3e3, list_price: 349, annual_price: 299, save_pct: 14, blurb: "For multi-crew operations that run on the numbers.", highlights: ["Everything in Pro", "Audit-log export", "Advanced permissions", "Priority support + onboarding call"] },
  { key: "enterprise", name: "Enterprise", users: 0, active_requests: 1e6, list_price: 0, annual_price: 0, save_pct: 0, custom: true, blurb: "Priced to your operation.", highlights: ["SSO/SAML + SCIM", "DPA + SLA", "Multiple locations", "Custom integrations"] }
];
function PlanCards({ onAction, currentKey }) {
  const [period, setPeriod] = reactExports.useState("annual");
  const [plans, setPlans] = reactExports.useState(PLANS_FALLBACK);
  reactExports.useEffect(() => {
    api("/api/plans").then((r2) => {
      var _a;
      if ((_a = r2.plans) == null ? void 0 : _a.length) setPlans(r2.plans);
    }).catch(() => {
    });
  }, []);
  const maxSave = Math.max(...plans.filter((p2) => !p2.custom).map((p2) => p2.save_pct || 0));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { justifyContent: "center", margin: "4px 0 2px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "billtoggle", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: period === "monthly" ? "on" : "", onClick: () => setPeriod("monthly"), children: "Monthly" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: period === "annual" ? "on" : "", onClick: () => setPeriod("annual"), children: [
        "Yearly",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "saveTag", children: [
          "Save up to ",
          maxSave,
          "%"
        ] })
      ] })
    ] }) }),
    period === "annual" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "salebar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag", children: "SALE" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        "Yearly billing is on sale — up to ",
        maxSave,
        "% off the regular monthly price, locked in when you subscribe."
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "planGrid", children: plans.map((p2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "planCard" + (p2.key === "pro" ? " pop" : ""), style: currentKey === p2.key ? { outline: "2px solid #22c55e", outlineOffset: 2 } : {}, children: [
      p2.key === "pro" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "popTag", children: "★ MOST POPULAR" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pcHead", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pcName", children: p2.name }),
        p2.users ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "pcUsers", children: [
          p2.users,
          " office users included"
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pcUsers", children: "Custom terms" })
      ] }),
      p2.custom ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pcPriceRow", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pcPrice", children: "Custom" }) }) : period === "annual" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pcPriceRow", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pcPrice", children: px(p2.annual_price) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pcPer", children: "/mo" })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pcPriceRow", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pcPrice", children: px(p2.list_price) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pcPer", children: "/mo" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pcBill", children: p2.custom ? "Scoped to your operation" : period === "annual" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("s", { className: "pcWas", children: px(p2.list_price) }),
        " Billed annually · ",
        px(p2.annual_price * 12),
        "/yr ",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "savePill", children: [
          "SAVE ",
          p2.save_pct,
          "%"
        ] })
      ] }) : `Billed monthly · or ${px(p2.annual_price)}/mo yearly` }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "pcBlurb", children: p2.blurb }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "pcFeat", children: (p2.highlights || []).map((h) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pcTick", children: "✓" }),
        h
      ] }, h)) }),
      !p2.custom && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pcMeter", children: [
        "Up to ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: num(p2.active_requests) }),
        " active requests · overage never blocks intake"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn pcBtn" + (p2.key === "pro" ? " popBtn" : ""), disabled: currentKey === p2.key, onClick: () => onAction && onAction(p2.key, period), children: currentKey === p2.key ? "Current plan" : p2.custom ? "Talk to us" : currentKey ? `Switch to ${p2.name}` : "Start free" })
    ] }, p2.key)) })
  ] });
}
const px = (n2) => "$" + Number(n2).toFixed(2);
function Billing() {
  const [b, setB] = reactExports.useState(null);
  reactExports.useEffect(() => {
    api("/api/billing").then(setB).catch(() => {
    });
  }, []);
  if (!b) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading billing…" });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Billing" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Your Workpile subscription — plan, trial, and live usage against your caps." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpis", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Plan" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: b.plan.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: b.plan.custom ? "Custom pricing" : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("s", { className: "muted", children: px(b.plan.list_price) }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
            px(b.plan.annual_price),
            "/mo"
          ] }),
          " billed annually"
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Office users" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "val", children: [
          b.usage.users_used ?? b.usage.seats_used,
          b.usage.users_limit ?? b.usage.seats_limit ? ` / ${b.usage.users_limit ?? b.usage.seats_limit}` : ""
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: b.usage.users_limit ?? b.usage.seats_limit ? "logins included in this plan — roster crew never count" : "unlimited" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Status" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", style: { fontSize: 20 }, children: b.subscription.status }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: b.trial_days_left !== null ? `${b.trial_days_left} trial days left` : "—" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Active requests" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: num(b.usage.active_requests || 0) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          "of ",
          num(b.usage.active_allowance || 0),
          " included (",
          b.usage.active_pct || 0,
          "%) — overage never blocks intake"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "AI actions" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: num(b.usage.ai_actions_this_month) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          "of ",
          num(b.usage.ai_limit)
        ] })
      ] })
    ] }),
    b.usage.leads_pct >= 80 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "err", children: [
      "You're at ",
      b.usage.leads_pct,
      "% of your monthly lead cap — ingestion pauses at 100%, approvals never do."
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Plans — per workspace; yearly is on sale" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(PlanCards, { currentKey: b.plan.key, onAction: async (k2, period) => {
        const r2 = await api("/api/billing/checkout", { method: "POST", body: { plan: k2, period } });
        if (r2.url) location.href = r2.url;
        else alert(r2.message || "Recorded — checkout opens when Stripe is configured.");
      } })
    ] })
  ] });
}
function Admin() {
  const [ws, setWs] = reactExports.useState([]);
  const [syn, setSyn] = reactExports.useState(null);
  const [dlq, setDlq] = reactExports.useState([]);
  reactExports.useEffect(() => {
    api("/api/admin/workspaces").then(setWs).catch(() => {
    });
    api("/api/admin/dlq").then(setDlq).catch(() => {
    });
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Platform Admin" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Operator view across every workspace on this deployment." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ActivationCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", style: { padding: 6 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Workspace" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Leads" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Users" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Pending approvals" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Dead letters" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: ws.map((w2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: w2.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(w2.leads) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(w2.users) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(w2.pending_approvals) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(w2.dead_letters) })
      ] }, w2.id)) })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
        "Dead-letter queue (",
        dlq.length,
        ")"
      ] }),
      dlq.map((d) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
        d.outcome,
        " · lead ",
        String(d.lead_id).slice(0, 14),
        "… · ",
        d.last_error || ""
      ] }, d.id)),
      dlq.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Empty — every delivery either landed or is still retrying." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => setSyn(await api("/api/admin/synthetics")), children: "Run SLO synthetics" }),
      syn && /* @__PURE__ */ jsxRuntimeExports.jsx("pre", { className: "mono", style: { marginTop: 10 }, children: JSON.stringify(syn, null, 1).slice(0, 900) })
    ] })
  ] });
}
function CreateLead({ users, done }) {
  const [f2, setF] = reactExports.useState({ contact: { name: "", phone: "", email: "" }, service_requested: "", est_value: "", message: "", location: "" });
  const [msg, setMsg] = reactExports.useState("");
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", style: { maxWidth: 560 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "New lead" }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Contact name *" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.contact.name, onChange: (e) => setF({ ...f2, contact: { ...f2.contact, name: e.target.value } }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Phone *" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.contact.phone, onChange: (e) => setF({ ...f2, contact: { ...f2.contact, phone: e.target.value } }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Email" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.contact.email, onChange: (e) => setF({ ...f2, contact: { ...f2.contact, email: e.target.value } }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Service requested" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.service_requested, onChange: (e) => setF({ ...f2, service_requested: e.target.value }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Estimated value ($)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", value: f2.est_value, onChange: (e) => setF({ ...f2, est_value: e.target.value }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Location" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.location, onChange: (e) => setF({ ...f2, location: e.target.value }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "full", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "What happened / notes" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 3, value: f2.message, onChange: (e) => setF({ ...f2, message: e.target.value }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => {
        var _a;
        try {
          const r2 = await api("/api/leads", { method: "POST", body: { ...f2, est_value: Number(f2.est_value) || 0, source: "manual" } });
          done((_a = r2.lead) == null ? void 0 : _a.id);
        } catch (e) {
          setMsg(e.message);
        }
      }, children: "Create lead" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: () => done(null), children: "Cancel" })
    ] })
  ] }) });
}
function WeeklyReportCard() {
  var _a;
  const mondayOf = (d) => {
    const x2 = new Date(d);
    const day = (x2.getDay() + 6) % 7;
    x2.setDate(x2.getDate() - day);
    x2.setHours(0, 0, 0, 0);
    return x2.toISOString().slice(0, 10);
  };
  const [week, setWeek] = reactExports.useState(mondayOf(/* @__PURE__ */ new Date()));
  const [r2, setR] = reactExports.useState(null);
  const [copied, setCopied] = reactExports.useState(false);
  reactExports.useEffect(() => {
    api("/api/status-report?week=" + week).then(setR).catch(() => {
    });
  }, [week]);
  const shift = (n2) => {
    const d = /* @__PURE__ */ new Date(week + "T12:00:00");
    d.setDate(d.getDate() + n2 * 7);
    setWeek(mondayOf(d));
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { borderLeft: "4px solid #166534" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: 0 }, children: "📋 Weekly Status Report — the owner's one-pager" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rowflex", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => shift(-1), children: "← Prev" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
          "Week of ",
          week
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => shift(1), children: "Next →" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn ghost small", style: { textDecoration: "none" }, href: `/print/status-report?week=${week}`, target: "_blank", rel: "noreferrer", children: "🖨 Print / PDF" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
          if (r2 == null ? void 0 : r2.text) {
            await navigator.clipboard.writeText(r2.text).catch(() => {
            });
            setCopied(true);
            setTimeout(() => setCopied(false), 2e3);
          }
        }, children: copied ? "Copied ✓" : "Copy summary" })
      ] })
    ] }),
    !r2 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Building your week…" }),
    r2 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpis", style: { marginTop: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "New leads" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: r2.new_leads }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          "Backlog open: ",
          r2.backlog.open,
          " (",
          money(r2.backlog.pipeline_value),
          ")"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Won" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: r2.won.count }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          money(r2.won.value),
          " · Lost ",
          r2.lost.count,
          " · No response ",
          r2.no_response
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Proposals" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: r2.proposals.count }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          money(r2.proposals.value),
          " created this week"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Approvals" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "val", children: [
          r2.approvals.rate ?? "—",
          r2.approvals.rate !== null && r2.approvals.rate !== void 0 ? "%" : ""
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          r2.approvals.decided,
          " decided · ",
          r2.approvals.pending,
          " waiting"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Field reports" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "val", children: [
          r2.field_reports.pct ?? "—",
          r2.field_reports.pct !== null && r2.field_reports.pct !== void 0 ? "%" : ""
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          r2.field_reports.filed,
          "/",
          r2.field_reports.expected,
          " filed"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Timesheets" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "val", children: [
          r2.timesheets.pct ?? "—",
          r2.timesheets.pct !== null && r2.timesheets.pct !== void 0 ? "%" : ""
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          r2.timesheets.submitted,
          "/",
          r2.timesheets.expected,
          " submitted"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Labor" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "val", children: [
          r2.labor.hours,
          "h"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          money(r2.labor.cost),
          " across ",
          r2.labor.jobs,
          " jobs"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "Inbox" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: r2.inbox.cleared }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
          "cleared · ",
          r2.inbox.open_now,
          " still open"
        ] })
      ] })
    ] }),
    r2 && ((_a = r2.top_jobs) == null ? void 0 : _a.length) > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { marginBottom: 0 }, children: [
      "Top jobs by labor: ",
      r2.top_jobs.map((j) => `${j.service_requested} (${j.customer || "—"}) — ${j.h}h / ${money(j.a)}`).join(" · ")
    ] })
  ] });
}
function InvoicesCard() {
  const [invs, setInvs] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const load = () => {
    api("/api/invoices").then(setInvs).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const open = invs.filter((i) => ["sent", "partially_paid"].includes(i.status));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginBottom: 14 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "🧾 Invoices & receivables" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "sub", style: { marginTop: 0 }, children: [
      money(open.reduce((a, i) => a + (i.balance || 0), 0)),
      " outstanding across ",
      open.length,
      " open invoice",
      open.length === 1 ? "" : "s",
      open.some((i) => i.overdue) ? ` · ${money(open.filter((i) => i.overdue).reduce((a, i) => a + i.balance, 0))} overdue` : "",
      ". Create invoices from any job; record payments against them here or on the job."
    ] }),
    invs.slice(0, 12).map((i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { padding: "5px 0", borderTop: "1px solid #eef2f7" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: i.number }),
        " · ",
        i.service_requested || "Job",
        " · ",
        money(i.total),
        " · ",
        i.status,
        i.overdue ? " · ⚠ overdue" : ""
      ] }),
      i.balance > 0 && i.status !== "void" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "pay-" + i.id, type: "number", placeholder: "Amount", style: { width: 100 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          const v2 = Number(document.getElementById("pay-" + i.id).value);
          if (!(v2 > 0)) return;
          try {
            await api(`/api/invoices/${i.id}/payments`, { method: "POST", body: { amount: v2 } });
            toast("Payment recorded ✓");
            load();
          } catch (e) {
            setMsg(e.message);
          }
        }, children: "Record payment" })
      ] })
    ] }, i.id)),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { marginTop: 8 }, onClick: async () => {
      const r2 = await api("/api/invoices/backfill", { method: "POST", body: {} });
      setMsg(`Backfill created ${r2.made} invoice records from previously flagged jobs.`);
      load();
    }, children: "Backfill invoices for already-flagged jobs" })
  ] });
}
function Reports() {
  var _a, _b, _c;
  const [fc2, setFc] = reactExports.useState(null);
  reactExports.useEffect(() => {
    api("/api/forecast").then(setFc).catch(() => {
    });
  }, []);
  const [ds, setDs] = reactExports.useState("by_owner");
  const [rows, setRows] = reactExports.useState([]);
  reactExports.useEffect(() => {
    api("/api/reports?dataset=" + ds).then((r2) => setRows(r2.rows)).catch(() => {
    });
  }, [ds]);
  const tot = rows.reduce((a, r2) => ({ leads: a.leads + (r2.leads || 0), won: a.won + (r2.won || 0), lost: a.lost + (r2.lost || 0), value: a.value + (r2.value || 0), won_value: a.won_value + (r2.won_value || 0) }), { leads: 0, won: 0, lost: 0, value: 0, won_value: 0 });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Reports" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(InvoicesCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Tabular reports over your live data — the Salesforce Reports equivalent, without the report-builder maze. Export anything to CSV." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ReportBuilder, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(WeeklyReportCard, {}),
    fc2 && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpis", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "🔮 Weighted forecast" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: money(fc2.weighted_pipeline) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
            "of ",
            money(fc2.raw_pipeline),
            " raw pipeline, probability-weighted by stage"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "🎯 Win rate (30d)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: fc2.intel.win_rate_30d === null ? "—" : fc2.intel.win_rate_30d + "%" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hint", children: [
            num(fc2.intel.decided_30d),
            " decided in the last 30 days"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "🥇 Best source" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", style: { fontSize: 20 }, children: ((_a = fc2.intel.best_source) == null ? void 0 : _a.name) || "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: fc2.intel.best_source ? money(fc2.intel.best_source.won_value) + " won all-time" : "No wins yet" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "🛑 Top loss reason" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", style: { fontSize: 20 }, children: ((_c = (_b = fc2.intel.top_lost_reason) == null ? void 0 : _b.reason) == null ? void 0 : _c.replaceAll("_", " ")) || "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: fc2.intel.top_lost_reason ? num(fc2.intel.top_lost_reason.count) + " losses in 30 days" : "No losses logged" })
        ] })
      ] }),
      fc2.at_risk.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginBottom: 12 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "⚠️ Proposals going cold" }),
        fc2.at_risk.map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "6px 0" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: r2.contact_name }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
            "· ",
            r2.service_requested,
            " · ",
            money(r2.total),
            " · waiting ",
            r2.days_waiting,
            " days"
          ] })
        ] }, r2.lead_id)),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Sent 4+ days ago, still unsigned. The follow-up cadence is nudging; a human call beats a third email." })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chips", children: [
      [["by_owner", "By owner"], ["by_service", "By service"], ["by_stage", "By stage"], ["by_source", "By source"], ["lost_reasons", "Lost reasons"]].map(([k2, lab]) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: `chip ${ds === k2 ? "on" : ""}`, onClick: () => setDs(k2), children: lab }, k2)),
      /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn small", style: { textDecoration: "none" }, href: `/api/reports/export?dataset=${ds}`, children: "⬇ Export CSV" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", style: { padding: 6 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: ds.replaceAll("_", " ") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Leads" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Won" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Lost" }),
        ds === "by_source" && /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Win rate" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Pipeline value" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Won value" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
        rows.map((r2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: r2.label }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(r2.leads) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(r2.won || 0) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: num(r2.lost || 0) }),
          ds === "by_source" && /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: r2.leads ? Math.round(100 * (r2.won || 0) / r2.leads) + "%" : "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: money(r2.value) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: money(r2.won_value || 0) })
        ] }, i)),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { style: { background: "#f8fafc" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Total" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: num(tot.leads) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: num(tot.won) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: num(tot.lost) }) }),
          ds === "by_source" && /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: tot.leads ? Math.round(100 * tot.won / tot.leads) + "%" : "—" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: money(tot.value) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: money(tot.won_value) }) })
        ] })
      ] })
    ] }) })
  ] });
}
class EB extends React.Component {
  constructor() {
    super(...arguments);
    __publicField(this, "state", { err: "" });
  }
  static getDerivedStateFromError(e) {
    return { err: String(e && e.message || e) };
  }
  componentDidCatch(e, info) {
    console.error("EB-CATCH:", e.message, (info.componentStack || "").slice(0, 900));
  }
  render() {
    return this.state.err ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { maxWidth: 560, margin: "40px auto", textAlign: "center", padding: 28 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 30 }, children: "🧯" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: "8px 0" }, children: "This screen hit a snag" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "The rest of Workpile is fine — your other tabs still work. This view failed to render:" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "err", style: { textAlign: "left" }, children: this.state.err }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => this.setState({ err: "" }), children: "Try this view again" })
    ] }) : this.props.children;
  }
}
function LogoMark({ size = 30 }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: size, height: size, viewBox: "0 0 64 64", "aria-label": "Workpile", style: { flex: "none", display: "block" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { width: "64", height: "64", rx: "14", fill: "#0e5c3a" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "12", y: "41", width: "40", height: "9", rx: "4.5", fill: "#ffffff" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "17", y: "29.5", width: "30", height: "9", rx: "4.5", fill: "#ffffff", opacity: "0.92" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "22", y: "18", width: "20", height: "9", rx: "4.5", fill: "#4ade80" })
  ] });
}
function Logo({ light }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "logo", style: light ? { color: "#fff" } : {}, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LogoMark, { size: 30 }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ltxt", children: "Workpile" })
  ] });
}
function AttachmentsPanel({ entityType, entityId }) {
  const [files, setFiles] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const load = () => {
    api(`/api/attachments?entity_type=${entityType}&entity_id=${entityId}`).then(setFiles).catch(() => {
    });
  };
  reactExports.useEffect(load, [entityId]);
  const upload = (f2) => {
    const r2 = new FileReader();
    r2.onload = async () => {
      try {
        const b64 = String(r2.result || "").split(",")[1] || "";
        await api("/api/attachments", { method: "POST", body: { entity_type: entityType, entity_id: entityId, name: f2.name, mime: f2.type || "application/octet-stream", data_base64: b64 } });
        setMsg("Uploaded ✓");
        load();
      } catch (e) {
        setMsg(e.message);
      }
    };
    r2.readAsDataURL(f2);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginTop: 12 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "📎 Attachments" }),
    files.map((f2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { padding: "4px 0" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: `/api/attachments/${f2.id}/download`, children: f2.name }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        Math.max(1, Math.round(f2.size / 1024)),
        " KB · ",
        dt(f2.created_at)
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        await api(`/api/attachments/${f2.id}`, { method: "DELETE" });
        load();
      }, children: "Delete" })
    ] }, f2.id)),
    files.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { margin: "4px 0" }, children: "No files yet — permits, manifests, photos from the field live here (object storage, not email threads)." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "btn ghost small", style: { cursor: "pointer" }, children: [
        "+ Upload file",
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "file", style: { display: "none" }, onChange: (e) => {
          var _a;
          const f2 = (_a = e.target.files) == null ? void 0 : _a[0];
          if (f2) upload(f2);
          e.target.value = "";
        } })
      ] }),
      msg && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ok", children: msg })
    ] })
  ] });
}
function ProposalsView({ openLead }) {
  const [rows, setRows] = reactExports.useState([]);
  const [tab, setTab] = reactExports.useState("list");
  reactExports.useEffect(() => {
    api("/api/proposals").then(setRows).catch(() => {
    });
  }, []);
  const counts = (st) => rows.filter((r2) => r2.status === st).length;
  const outValue = rows.filter((r2) => r2.status === "sent").reduce((a, r2) => a + (r2.total || 0), 0);
  const signedValue = rows.filter((r2) => r2.status === "signed").reduce((a, r2) => a + (r2.total || 0), 0);
  if (tab === "approvals") return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Proposals" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setTab("list"), children: "All proposals" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "on", children: "Approvals" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Approvals, { openLead, embedded: true })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Proposals" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Every proposal in the business — priced from the book, gated by policy, tracked to signature. Approvals live here and in the Work Queue." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "on", children: "All proposals" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setTab("approvals"), children: "Approvals" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "chip", children: [
        rows.length,
        " total"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "chip", children: [
        counts("draft"),
        " drafts"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "chip", children: [
        counts("sent"),
        " out · ",
        money(outValue)
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "chip", children: [
        counts("signed"),
        " signed · ",
        money(signedValue)
      ] })
    ] }),
    rows.map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: "10px 14px", marginBottom: 7, display: "flex", gap: 10, alignItems: "center" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: r2.contact_name || "Customer" }),
        " — ",
        r2.service_requested || "",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
          "· v",
          r2.version,
          " · ",
          dt(r2.created_at),
          r2.sent_at ? " · sent " + dt(r2.sent_at) : "",
          r2.signed_at ? " · signed " + dt(r2.signed_at) : ""
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: money(r2.total) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${r2.status === "signed" ? "pass" : r2.status === "sent" ? "warn" : "fail"}`, children: r2.status }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => openLead(r2.lead_id), children: "Open lead →" })
    ] }, r2.id)),
    rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", style: { textAlign: "center", padding: 26 }, children: "No proposals yet — build the first one from any lead." })
  ] });
}
function InboxPage() {
  const [inbox, setInbox] = reactExports.useState([]);
  const load = () => {
    api("/api/inbox").then(setInbox).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Inbox" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Every inbound message, triaged into seven categories with a suggested action — convert, reply, file, or ignore. Nothing sits unread and unowned." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(InboxQueue, { inbox, reload: load })
  ] });
}
function VerticalPacksCard() {
  const [packs, setPacks] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  reactExports.useEffect(() => {
    api("/api/templates/verticals").then(setPacks).catch(() => {
    });
  }, []);
  if (!packs.length) return null;
  const apply = async (id2) => {
    try {
      const r2 = await api(`/api/templates/verticals/${id2}/apply`, { method: "POST", body: {} });
      setMsg(`${r2.pack}: +${r2.added.services} services, +${r2.added.price_book_items} price-book items, +${r2.added.custom_fields} fields. ${r2.note}`);
    } catch (e) {
      setMsg(e.message);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: 16 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Vertical starter packs" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { marginTop: 0 }, children: "Start from your trade's shape: services, a price-book skeleton (prices at $0 — yours to set), and lead fields. Applying twice adds nothing twice." }),
    packs.map((p2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { padding: "6px 0", borderBottom: "1px solid #eef2f7" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: p2.name }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        p2.services,
        " services · ",
        p2.fields,
        " fields"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => apply(p2.id), children: "Apply pack" })
    ] }, p2.id)),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", style: { marginTop: 8 }, children: msg })
  ] });
}
function ActivationCard() {
  const [a, setA] = reactExports.useState(null);
  reactExports.useEffect(() => {
    api("/api/admin/activation").then(setA).catch(() => {
    });
  }, []);
  if (!a) return null;
  const labels = { has_leads: "Has leads", has_proposals: "Has proposals", has_decided_approval: "Approval decided", has_jobs: "Has jobs", has_won: "Has won work", has_team: "Team of 2+" };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Activation funnel — % of workspaces reaching each milestone" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { gap: 18, flexWrap: "wrap" }, children: Object.entries(a.milestone_pct).map(([k2, v2]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { style: { fontSize: 20 }, children: [
        v2,
        "%"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: labels[k2] || k2 })
    ] }, k2)) })
  ] });
}
function SuppressionsCard() {
  const [list, setList] = reactExports.useState([]);
  const [kind, setKind] = reactExports.useState("email");
  const [value, setValue] = reactExports.useState("");
  const [reason, setReason] = reactExports.useState("");
  const [msg, setMsg] = reactExports.useState("");
  const load = () => {
    api("/api/suppressions").then(setList).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const add = async () => {
    try {
      await api("/api/suppressions", { method: "POST", body: { kind, value, reason } });
      setValue("");
      setReason("");
      setMsg("Added — sends to this address stop everywhere, cadences included.");
      load();
    } catch (e) {
      setMsg(e.message);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "🚫 Suppression list" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { marginTop: 0 }, children: [
      "Unsubscribes and do-not-contacts. Every send — manual, cadence, first touch — checks this list at the door; suppressed sends are recorded as ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "suppressed" }),
      ", never as sent, and an active cadence stops with reason ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("i", { children: "suppressed" }),
      "."
    ] }),
    list.map((x2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { padding: "5px 0", borderBottom: "1px solid #eef2f7" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "chip", children: x2.kind }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: x2.value }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        x2.reason || x2.source,
        " · ",
        dt(x2.created_at)
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        await api(`/api/suppressions/${x2.id}`, { method: "DELETE" });
        load();
      }, children: "Remove" })
    ] }, x2.id)),
    list.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Nobody is suppressed yet." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: kind, onChange: (e) => setKind(e.target.value), style: { width: 100 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "email", children: "Email" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "phone", children: "Phone" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: kind === "email" ? "person@company.com" : "(631) 555-0100", value, onChange: (e) => setValue(e.target.value), style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Reason (unsubscribed, wrong number…)", value: reason, onChange: (e) => setReason(e.target.value), style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", disabled: !value.trim(), onClick: add, children: "Suppress" })
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", style: { marginTop: 8 }, children: msg })
  ] });
}
function PeriodsStrip() {
  const [p2, setP] = reactExports.useState(null);
  reactExports.useEffect(() => {
    api("/api/metrics/periods").then(setP).catch(() => {
    });
  }, []);
  if (!p2) return null;
  const cell = (label, k2, fmt) => {
    const a = p2.this_week[k2] || 0, b = p2.last_week[k2] || 0;
    const d = a - b;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 17 }, children: fmt(a) }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: label }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: d > 0 ? "#157347" : d < 0 ? "#b3261e" : "#5b6b62" }, children: [
        d > 0 ? `▲ ${fmt(d)}` : d < 0 ? `▼ ${fmt(-d)}` : "—",
        " vs last wk"
      ] })
    ] }, k2);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginTop: 12 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "📅 This week vs last week" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { gap: 22, flexWrap: "wrap", marginTop: 8 }, children: [
      cell("new leads", "leads_created", (n2) => String(n2)),
      cell("proposals sent", "proposals_sent", (n2) => String(n2)),
      cell("won", "won", (n2) => String(n2)),
      cell("jobs created", "jobs_created", (n2) => String(n2)),
      cell("signed value", "signed_value", (n2) => money(n2))
    ] })
  ] });
}
function PlaybookCard() {
  const [cfg, setCfg] = reactExports.useState(null);
  const [rules, setRules] = reactExports.useState("");
  const [note, setNote] = reactExports.useState("");
  const [open, setOpen] = reactExports.useState(false);
  reactExports.useEffect(() => {
    api("/api/agent/config").then((r2) => {
      setCfg(r2);
      setRules(r2.custom_instructions || "");
    }).catch(() => {
    });
  }, []);
  if (!cfg) return null;
  const CB2 = { read: "#e0f2fe", draft: "#fef9c3", execute: "#dcfce7", approval: "#fee2e2" };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginTop: 14 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { marginTop: 0 }, children: [
      "📖 Agent playbook ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { fontWeight: 400, fontSize: 13 }, children: "— exactly what the agent is told, and the full locked tool list. Nothing hidden." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn ghost small", onClick: () => setOpen(!open), children: [
      open ? "Hide" : "Show",
      " system prompt + ",
      cfg.tools.length,
      " tools"
    ] }),
    open && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("pre", { style: { whiteSpace: "pre-wrap", background: "#f8fafc", borderRadius: 8, padding: 10, fontSize: 12.5, margin: 0 }, children: cfg.system_prompt }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { style: { marginTop: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Tool" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Control" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "What it does" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: cfg.tools.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: t2.name }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", style: { background: CB2[t2.control] || "#e2e8f0" }, children: t2.control }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "muted", style: { fontSize: 12.5 }, children: t2.description })
        ] }, t2.name)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { style: { margin: "14px 0 4px" }, children: [
      "House rules ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { fontWeight: 400, fontSize: 12.5 }, children: "— your standing instructions; appended to the agent's prompt when a provider is connected" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 3, style: { width: "100%" }, value: rules, onChange: (e) => setRules(e.target.value), placeholder: "e.g. Always offer a site visit before quoting tank work. Never schedule on Sundays. Escalate anything over $25k to Gregory." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 6 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
        await api("/api/agent/config", { method: "PATCH", body: { custom_instructions: rules } });
        setNote("Saved ✓ — applies to the next agent run.");
      }, children: "Save house rules" }),
      note && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ok", children: note })
    ] })
  ] });
}
function ProviderCard() {
  const [st, setSt] = reactExports.useState(null);
  const [kind, setKind] = reactExports.useState("anthropic");
  const [model, setModel] = reactExports.useState("");
  const [key, setKey] = reactExports.useState("");
  const [msg, setMsg] = reactExports.useState("");
  const load = () => {
    api("/api/ai/provider").then((r2) => {
      setSt(r2);
      if (r2.model) setModel(r2.model);
      if (r2.kind && r2.kind !== "rules") setKind(r2.kind);
    }).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const save = async () => {
    const r2 = await api("/api/ai/provider", { method: "PATCH", body: { provider: kind, model: model || void 0, api_key: key === "" ? void 0 : key } });
    setSt(r2);
    setKey("");
    setMsg("Provider settings saved ✓");
  };
  const test = async () => {
    setMsg("Testing…");
    const r2 = await api("/api/ai/provider/test", { method: "POST", body: {} }).catch((e) => ({ ok: false, error: e.message }));
    setMsg(r2.ok ? r2.mode === "rules" ? r2.message : `Connected ✓ ${r2.model} responded in ${r2.latency_ms}ms` : "Failed: " + (r2.error || "unknown"));
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginBottom: 14 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "🧠 AI provider" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", style: { marginTop: 0 }, children: st ? st.configured ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      "Connected: ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: st.label }),
      ". The agent plans with the model; Workpile's policy engine still decides what may execute."
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: "No provider connected — the agent runs on the deterministic rules planner and labels its output as such. Add a key to enable generative planning and drafting." }) : "…" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
        "Provider",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: kind, onChange: (e) => setKind(e.target.value), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "anthropic", children: "Anthropic (Claude)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "openai", children: "OpenAI" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
        "Model",
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: model, onChange: (e) => setModel(e.target.value), placeholder: kind === "anthropic" ? "claude-sonnet-4-5" : "gpt-5" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
        "API key",
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "password", value: key, onChange: (e) => setKey(e.target.value), placeholder: (st == null ? void 0 : st.source) === "workspace" ? "•••••••• (saved — leave blank to keep)" : "sk-…" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: save, children: "Save provider" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: test, children: "Test connection" }),
      (st == null ? void 0 : st.source) === "workspace" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        await api("/api/ai/provider", { method: "PATCH", body: { api_key: "" } });
        load();
        setMsg("Workspace key removed.");
      }, children: "Remove workspace key" }),
      msg && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: msg })
    ] })
  ] });
}
function AutonomyCard() {
  const [a, setA] = reactExports.useState(null);
  const [msg, setMsg] = reactExports.useState("");
  const load = () => {
    api("/api/ai/autonomy").then(setA).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  if (!a) return null;
  const pick = async (lvl) => {
    try {
      const r2 = await api("/api/ai/autonomy", { method: "PATCH", body: { level: lvl } });
      setMsg(`Level set — L${r2.level} ${r2.level_name}`);
      load();
    } catch (e) {
      setMsg(e.message);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
      "🎚 Agent autonomy — L",
      a.level,
      " · ",
      a.level_name
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { marginTop: 0 }, children: [
      "How far the agent may go on its own in this workspace",
      a.explicit ? "" : " (default level — set one to make it explicit)",
      ". The armed automations decide ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("i", { children: "what" }),
      " it works on; this decides ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("i", { children: "how far" }),
      " it goes. Every run is logged either way."
    ] }),
    a.levels.map((l2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", style: { display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #eef2f7", cursor: "pointer" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "radio", style: { width: "auto", marginTop: 2 }, name: "autonomy", checked: a.level === l2.level, onChange: () => pick(l2.level) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
          "L",
          l2.level,
          " — ",
          l2.name
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: l2.summary })
      ] })
    ] }, l2.level)),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", style: { marginTop: 8 }, children: msg })
  ] });
}
function AgentMetricsCard() {
  const [m2, setM] = reactExports.useState(null);
  reactExports.useEffect(() => {
    api("/api/ai/metrics").then(setM).catch(() => {
    });
  }, []);
  if (!m2) return null;
  const runs = Object.values(m2.runs_30d || {}).reduce((a, b) => a + Number(b || 0), 0);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "📈 Agent acceptance — last 30 days" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { gap: 18, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 20 }, children: runs }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "agent runs" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 20 }, children: m2.actions_applied_30d }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "actions applied" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 20 }, children: m2.fpar === null ? "—" : m2.fpar + "%" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
          "first-pass approval (",
          m2.approvals_decided,
          " decided)"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 20 }, children: m2.merges_30d }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "duplicate merges" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { style: { fontSize: 20 }, children: [
          "~",
          m2.est_minutes_saved_30d,
          " min"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "time saved" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { marginBottom: 0, fontSize: 12 }, children: m2.time_saved_basis })
  ] });
}
function QuietHoursCard() {
  const [q2, setQ] = reactExports.useState(null);
  const [msg, setMsg] = reactExports.useState("");
  reactExports.useEffect(() => {
    api("/api/settings/cadence").then(setQ).catch(() => {
    });
  }, []);
  if (!q2) return null;
  const save = async () => {
    await api("/api/settings/cadence", { method: "PATCH", body: { quiet_start: q2.quiet_start === "" ? null : q2.quiet_start, quiet_end: q2.quiet_end === "" ? null : q2.quiet_end, tz: q2.tz } });
    setMsg("Saved ✓ — follow-ups will pause inside the window");
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "🌙 Follow-up quiet hours" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { marginTop: 0 }, children: "Automated follow-ups never send inside this window (workspace time). Sends defer — they are never dropped. Leave blank to disable." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
        "From hour ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: 0, max: 23, style: { width: 70 }, value: q2.quiet_start ?? "", onChange: (e) => setQ({ ...q2, quiet_start: e.target.value === "" ? null : Number(e.target.value) }), placeholder: "21" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
        "To hour ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: 0, max: 23, style: { width: 70 }, value: q2.quiet_end ?? "", onChange: (e) => setQ({ ...q2, quiet_end: e.target.value === "" ? null : Number(e.target.value) }), placeholder: "7" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
        "Timezone ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { width: 180 }, value: q2.tz || "", onChange: (e) => setQ({ ...q2, tz: e.target.value }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: save, children: "Save" }),
      msg && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ok", children: msg })
    ] })
  ] });
}
function Landing({ onAuth }) {
  const qs = new URLSearchParams(location.search);
  const [mode, setMode] = reactExports.useState(qs.get("reset") ? "reset" : "home");
  const [resetToken] = reactExports.useState(qs.get("reset") || "");
  const [authNote, setAuthNote] = reactExports.useState("");
  reactExports.useEffect(() => {
    const v2 = qs.get("verify");
    if (v2) {
      api("/api/auth/verify", { method: "POST", body: { token: v2 } }).then(() => {
        setAuthNote("Email verified ✓ — sign in to continue.");
        setMode("login");
      }).catch(() => {
        setAuthNote("That verification link is invalid or expired.");
        setMode("login");
      });
    }
  }, []);
  const [f2, setF] = reactExports.useState({ name: "", email: "", password: "", business_name: "" });
  const [err, setErr] = reactExports.useState("");
  const submit = async () => {
    try {
      setErr("");
      const r2 = mode === "register" ? await api("/api/auth/register", { method: "POST", body: f2 }) : await api("/api/auth/login", { method: "POST", body: { email: f2.email, password: f2.password } });
      onAuth(r2.user);
    } catch (e) {
      setErr(e.message);
    }
  };
  if (mode !== "home") return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "authWrap", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "authBrand", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Logo, { light: true }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "The backlog ends here." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Every lead owned, every packet complete before it reaches you, every proposal priced from your own book — and every final outcome delivered into the system you already run." }),
      [["Completeness Gate", "Nothing reaches approval half-empty — that's how owners hit 90%+ first-pass approvals."], ["AI that does the chasing", "Lead scoring, duplicate cleanup, auto-assignment, stale-lead reactivation — you approve, it executes."], ["Your system stays the boss", "Won becomes a project in YOUR platform, acknowledged with your ID. Lost and N/A delivered too."]].map(([t2, d]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pt", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "✓" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { color: "#fff" }, children: t2 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          d
        ] })
      ] }, t2))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "authForm", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "authCard", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setMode("home"), children: "← Back" }),
      mode === "forgot" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 16 }, children: "Reset your password" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "We'll email you a one-hour reset link." }),
        authNote && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", style: { marginBottom: 8 }, children: authNote }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Work email" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.email, onChange: (e) => setF({ ...f2, email: e.target.value }), placeholder: "you@company.com" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { width: "100%", marginTop: 12, padding: 12 }, onClick: async () => {
          const r2 = await api("/api/auth/forgot", { method: "POST", body: { email: f2.email } }).catch((e) => ({ error: e.message }));
          if (r2.reset_url) setAuthNote("Test mode (no email provider configured): use this link — " + r2.reset_url);
          else setAuthNote(r2.error ? r2.error : "If that email has an account, a reset link is on its way.");
        }, children: "Send reset link \\u2192" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 13, marginTop: 12 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#", onClick: (e) => {
          e.preventDefault();
          setMode("login");
        }, children: "Back to sign in" }) })
      ] }),
      mode === "reset" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 16 }, children: "Choose a new password" }),
        authNote && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", style: { marginBottom: 8 }, children: authNote }),
        err && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: err }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "New password" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "password", value: f2.password, onChange: (e) => setF({ ...f2, password: e.target.value }), placeholder: "8+ characters" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { width: "100%", marginTop: 12, padding: 12 }, onClick: async () => {
          try {
            await api("/api/auth/reset", { method: "POST", body: { token: resetToken, password: f2.password } });
            setAuthNote("Password updated — sign in with it now.");
            setMode("login");
            history.replaceState({}, "", "/app");
          } catch (e) {
            setErr(e.message);
          }
        }, children: "Update password" })
      ] }),
      mode !== "forgot" && mode !== "reset" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 16 }, children: mode === "register" ? "Start your 30-day free trial" : "Welcome back" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: mode === "register" ? "No card required. Your workspace, price book, and templates are created for you." : "Sign in to your workspace." }),
        authNote && mode === "login" && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", style: { marginBottom: 8 }, children: authNote }),
        err && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: err }),
        mode === "register" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Your name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.name, onChange: (e) => setF({ ...f2, name: e.target.value }), placeholder: "Jordan Ellis" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Business name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.business_name, onChange: (e) => setF({ ...f2, business_name: e.target.value }), placeholder: "Ellis Restoration Group" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Work email" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.email, onChange: (e) => setF({ ...f2, email: e.target.value }), placeholder: "you@company.com" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Password" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "password", value: f2.password, onChange: (e) => setF({ ...f2, password: e.target.value }), placeholder: mode === "register" ? "8+ characters" : "Your password" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { width: "100%", marginTop: 12, padding: 12 }, onClick: submit, children: mode === "register" ? "Create my workspace →" : "Sign in →" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 13, marginTop: 12 }, children: mode === "register" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          "Already have an account? ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#", onClick: (e) => {
            e.preventDefault();
            setMode("login");
          }, children: "Sign in" })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          "New to Workpile? ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#", onClick: (e) => {
            e.preventDefault();
            setMode("register");
          }, children: "Start free trial" }),
          " · ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#", onClick: (e) => {
            e.preventDefault();
            setMode("forgot");
          }, children: "Forgot password?" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12.5 }, children: "Demo workspace: owner@demo.test / demo1234" })
      ] })
    ] }) })
  ] });
  const FEATS = [
    ["🧹", "Backlog Clear", "Import or sync years of piled-up leads. AI triages, dedupes, scores, and buckets them hot / warm / stale with a projected clear date."],
    ["✅", "One-Tap Approvals", "Only complete packets reach you — contact, scope, site visit, PM, price-book pricing verified by the Completeness Gate. Approve in 10 seconds."],
    ["📄", "Generative Proposals", "Proposals drafted from your templates and your price book. Never an invented number; below-floor pricing flags itself."],
    ["🤖", "AI Operations", "Lead scoring, duplicate archiving, spam filtering, round-robin auto-assignment, stale-lead reactivation, and a 6 AM Morning Brief."],
    ["🔁", "Final Outcome Handoff", "Won becomes a project in your own platform — pull API, signed webhooks, acknowledgment tracking. Lost, no-response, and N/A delivered too."],
    ["📈", "Demand Gap", "See the services customers keep asking for that you don't sell yet, clustered and valued from your own lost leads."],
    ["✍️", "E-Sign + Deposits", "Signed proposal links with ESIGN evidence certificates, and deposit collection via Stripe the moment they sign."],
    ["🏢", "Multi-Business Ready", "Multiple workspaces under one login, per-business price books, teams, and roles. Owners see everything; staff see their work."]
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lp", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("nav", { className: "lpNav", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Logo, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpLinks", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#product", children: "Product" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#agent", children: "AI Agent" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#ops", children: "Ops" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#pricing", children: "Pricing" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "#faq", children: "FAQ" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpNavCtas", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: () => setMode("login"), children: "Sign in" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => setMode("register"), children: "Start free" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "lpHero", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpEyebrow", children: "The Revenue Execution OS for field-service businesses" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { children: [
        "Turn every opportunity into ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: "accountable work" }),
        "."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpLede", children: "Leads pile up in inboxes, spreadsheets, and somebody's memory. Workpile ends the pile: every lead owned, every proposal priced from your own book, every job scheduled with its crew — and an AI agent that does the chasing while a human approves anything that matters." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpCtas", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn lpBig", onClick: () => setMode("register"), children: "Start 30-day free trial" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn ghost lpBig", href: "/audit", children: "Run the free backlog audit →" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpMicro", children: "No card required · Set up in minutes · Your data stays yours" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpShot", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: "/shots/hero.png", alt: "Workpile Work Queue with the AI agent panel", loading: "eager" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lpChip lpChipA", children: "✦ Agent — every send approved by a human" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lpChip lpChipB", children: "Five money figures. Never blended." })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpFacts", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "L0–L4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "agent autonomy — you set the level" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "13" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "governed agent tools, each with a control class" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "5" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "money figures, tracked separately — always" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "10s" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "to approve a complete packet" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpSec", id: "product", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpKick", children: "The Work Queue" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "One queue. Everything that needs a human, worst-first." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpSplit", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpBody", children: "Untouched leads, overdue follow-ups, approvals waiting, jobs that need crew, expiring paperwork — the Work Queue is the operational center of the business, not another dashboard you check on Fridays. Work it to zero, every day." }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("ul", { className: "lpList", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Untouched-lead triage in one click" }),
              " — the agent qualifies, assigns, and drafts first touches in bulk; you approve the sends."
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "The Completeness Gate" }),
              " — nothing reaches your approval half-empty: contact, scope, site visit, owner, and price-book pricing verified first."
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Bulk actions" }),
              " — assign, snooze, or task dozens of items at once. Approvals always stay individual."
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lpShotSm", children: /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: "/shots/home.png", alt: "Workpile Home with the working calendar", loading: "lazy" }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpSec lpDark", id: "agent", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpKick light", children: "The AI Agent" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "An operator, not a chatbot. Accountable by design." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpSplit", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lpShotSm", children: /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: "/shots/agent.png", alt: "The Agent playbook — system prompt and locked tool list", loading: "lazy" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpBody light", children: 'Tell it what to do — "handle all untouched leads", "recover customers who went quiet" — and it plans governed steps, runs what your autonomy level allows, and stops at your approval gates. Sends always need a human. Prices only ever come from your price book.' }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("ul", { className: "lpList light", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "The playbook is public" }),
              " — the exact system prompt and all 18 tools, visible in your workspace. Nothing hidden."
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "House rules" }),
              ' — your standing instructions ("never schedule Sundays", "escalate over $25k") ride along with every plan.'
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Attribution" }),
              " — every run records who asked, who decided, and what each step did. First-pass approval rate is measured, not vibes."
            ] })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpSec", id: "money", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpKick", children: "Money, honestly" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Five figures. Five meanings. Never blended." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpBody", style: { maxWidth: 720 }, children: 'Most CRMs show one pipeline number and call it revenue. Workpile keeps the five money concepts separate — with real invoices and true accounts receivable underneath, so "outstanding" always means money actually owed to you.' }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lpMoney", children: [["Estimated pipeline", "What open leads might be worth"], ["Proposal value", "What you've actually quoted"], ["Signed contracts", "What customers agreed to"], ["Invoiced", "What you've billed — real invoices"], ["Collected cash", "What's in the bank"]].map(([t2, d]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpMoneyCard", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: t2 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: d })
      ] }, t2)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpSec", id: "ops", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpKick", children: "Jobs & Ops" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Signed means scheduled. Scheduled means staffed." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpSplit", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpBody", children: "A won proposal becomes a real job with a lifecycle — awaiting scheduling, scheduled, in progress, documentation, ready to invoice, closed. Move a job to Scheduled and you pick the day and time right there: the crew lands on the Ops Console for that day and the week's timesheets open underneath. No separate scheduling ritual, no spreadsheet." }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("ul", { className: "lpList", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Conflicts warn, never block" }),
              " — double-booked crew is flagged; you decide."
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Payroll-ready timesheets" }),
              " — submitted → reviewed → approved → exported; only approved hours reach the payroll CSV."
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Paperwork queue" }),
              " — required documents tracked per job, with expiring documents surfacing before they lapse."
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lpShotSm", children: /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: "/shots/ops.png", alt: "Ops Console — crew schedule and jobs starting this week", loading: "lazy" }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpSec", id: "how", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpKick", children: "How it works" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Live in an afternoon" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "steps", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "step", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "1" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "Bring the pile" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Sync from your current system, upload the CSV, connect your inbox and website form. The agent dedupes, scores, and assigns everything it finds." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "step", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "Approve & propose" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Work the queue, approve complete packets, send proposals generated from your price book. Customers e-sign and pay the deposit by card." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "step", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "3" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "Run the work" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Jobs get scheduled with crew and timesheets; invoices go out; every final outcome — won, lost, no-response — is delivered back into your platform." })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "featGrid", style: { marginTop: 18 }, children: FEATS.map(([ic2, t2, d]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feat", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ic", children: ic2 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t2 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: d })
      ] }, t2)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpSec", id: "compare", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpKick", children: "Straight talk" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Why teams switch from Salesforce" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpBody", style: { maxWidth: 720 }, children: "Salesforce is a database you configure for six months. Workpile is the workflow, finished — at a tenth of the seat cost." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "tableWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "cmp", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Workpile" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Salesforce" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: [["Backlog clearing & AI triage built in", 1, 0], ["Completeness Gate before approvals", 1, 0], ["Proposals generated from your price book", 1, 0], ["Final outcomes delivered into your other systems", 1, 0], ["Pipeline, Path, reports & dashboards", 1, 1], ["Live in an afternoon, no admin required", 1, 0], ["Per-seat pricing from $19.99/mo (annual)", 1, 0]].map(([t2, a, b]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: t2 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: a ? "yes" : "no", children: a ? "✓ Included" : "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: b ? "yes" : "no", children: b ? "✓" : "Add-on / custom build" })
        ] }, t2)) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpSec", id: "verticals", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpKick", children: "Built for your trade" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Starts with your services, your paperwork, your words" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpBody", style: { maxWidth: 720 }, children: "Vertical packs load a workspace with the trade's services, document requirements, and proposal language — environmental contracting is the flagship, with more trades on the same rails." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpVerts", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "🌎 Environmental" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "🔧 Plumbing & HVAC" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "🏠 Roofing" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "💧 Restoration" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "+ your trade, configured" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpSec", id: "pricing", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpKick", children: "Pricing" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Per workspace. 30 days free. No card." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpBody", style: { maxWidth: 720 }, children: "Trials start on the Pro plan so you see everything. Prices are per workspace, billed annually — and field crew on the roster are always free." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(PlanCards, { onAction: () => setMode("register") })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpBand", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Not sure yet? Bring us your worst spreadsheet." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "The free backlog audit takes two minutes: drop in your lead list and see what the pile is worth, what's stale, and what to work first. Your rows are never stored — you get aggregates, we keep nothing." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn lpBig lpBandBtn", href: "/audit", children: "Run the free backlog audit →" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "lpSec", id: "faq", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lpKick", children: "Questions" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Asked by owners like you" }),
      [["Do I have to replace my current system?", "No — Workpile is the front door, not the house. Won jobs become projects in YOUR platform via API or webhooks; every final outcome is delivered and acknowledged there."], ["How do leads get in?", "Four ways: sync from your lead system's API by date range (daily auto-sync available), CSV upload, website form embed with TCPA consent, and inbox/API ingestion."], ["Is the AI allowed to send things on its own?", "Never. The agent drafts, scores, and organizes; every customer-facing send needs a human approval, and pricing only ever comes from your price book. That's a product invariant, not a setting."], ["Can the agent text customers without consent?", "No. Consent is enforced at the single send boundary — a text to a lead without recorded consent is blocked before it queues, whoever or whatever requested it."], ["What happens to duplicates?", "Ingestion dedupes by phone/email automatically. The agent's cleanup finds the rest — same name + service — and merges are recorded and reversible."], ["What does pricing meter?", "Your workspace and its active requests — leads that aren't closed yet. Office users are included per tier; field crew on the roster (timesheets, schedules) never cost anything. And hitting your request allowance never blocks a new lead from coming in — it just starts an upgrade conversation."]].map(([q2, a]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "faq", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: q2 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: a })
      ] }, q2))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("footer", { className: "lpFoot", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpFootIn", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Logo, { light: true }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Turn every opportunity into accountable work." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        "© 2026 Workpile · ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/terms", children: "Terms" }),
        " · ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/privacy", children: "Privacy" }),
        " · ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/dpa", children: "DPA" }),
        " · ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/audit", children: "Free backlog audit" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Built for the businesses that answer the phone." })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lpSticky", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => setMode("register"), children: "Start free — 30 days" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("a", { className: "btn ghost", href: "/audit", children: "Free audit" })
    ] })
  ] });
}
function RichText({ value, onChange, minH }) {
  const ref = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, []);
  const cmd = (c, v2) => {
    var _a;
    document.execCommand(c, false, v2);
    (_a = ref.current) == null ? void 0 : _a.focus();
  };
  const insert = (t2) => {
    var _a;
    document.execCommand("insertText", false, t2);
    (_a = ref.current) == null ? void 0 : _a.focus();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { gap: 4, marginBottom: 4 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn ghost small", onClick: () => cmd("bold"), children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "B" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn ghost small", onClick: () => cmd("italic"), children: /* @__PURE__ */ jsxRuntimeExports.jsx("i", { children: "I" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn ghost small", onClick: () => cmd("underline"), children: /* @__PURE__ */ jsxRuntimeExports.jsx("u", { children: "U" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn ghost small", onClick: () => cmd("formatBlock", "h3"), children: "Heading" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn ghost small", onClick: () => cmd("insertUnorderedList"), children: "• List" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn ghost small", onClick: () => {
        var _a;
        const u2 = prompt("Image URL (https://…)");
        if (u2) {
          cmd("insertHTML", `<img src="${u2.replaceAll('"', "")}" style="max-width:100%">`);
          onChange(((_a = ref.current) == null ? void 0 : _a.innerHTML) || "");
        }
      }, children: "🖼 URL" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn ghost small", onClick: () => {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "image/*";
        inp.onchange = () => {
          var _a;
          const f2 = (_a = inp.files) == null ? void 0 : _a[0];
          if (!f2) return;
          const img = new Image();
          img.onload = () => {
            var _a2, _b;
            const c = document.createElement("canvas");
            const sc2 = Math.min(1, 900 / img.width);
            c.width = Math.round(img.width * sc2);
            c.height = Math.round(img.height * sc2);
            (_a2 = c.getContext("2d")) == null ? void 0 : _a2.drawImage(img, 0, 0, c.width, c.height);
            cmd("insertHTML", `<img src="${c.toDataURL("image/jpeg", 0.82)}" style="max-width:100%">`);
            onChange(((_b = ref.current) == null ? void 0 : _b.innerHTML) || "");
          };
          img.src = URL.createObjectURL(f2);
        };
        inp.click();
      }, children: "🖼 Upload" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { marginLeft: 6 }, children: "Insert:" }),
      ["{customer}", "{service}", "{total}", "{date}", "{ref}", "{business}", "{location}"].map((f2) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn ghost small", onClick: () => insert(f2), children: f2 }, f2))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref, contentEditable: true, suppressContentEditableWarning: true, className: "richtext", style: { minHeight: minH || 110 }, onBlur: () => {
      var _a;
      return onChange(((_a = ref.current) == null ? void 0 : _a.innerHTML) || "");
    } })
  ] });
}
function DocTemplatesEditor() {
  const [list, setList] = reactExports.useState([]);
  const [selId, setSelId] = reactExports.useState("");
  const [form, setForm] = reactExports.useState(null);
  const [head, setHead] = reactExports.useState(null);
  const [msg, setMsg] = reactExports.useState("");
  const [showPrev, setShowPrev] = reactExports.useState(false);
  const load = async (keep) => {
    const l2 = await api("/api/doc-templates").catch(() => []);
    setList(l2);
    const pick = l2.find((t2) => t2.id === (keep || selId)) || l2.find((t2) => t2.is_default) || l2[0];
    if (pick) {
      setSelId(pick.id);
      setForm({ name: pick.name, intro_html: pick.intro_html, terms_html: pick.terms_html, footer: pick.footer, include_logo: !!pick.include_logo });
    }
  };
  reactExports.useEffect(() => {
    load();
    api("/api/proposal-template").then(setHead).catch(() => {
    });
  }, []);
  const sel = list.find((t2) => t2.id === selId);
  const sample = (h) => String(h || "").replaceAll("{customer}", "Angela Ruiz").replaceAll("{service}", "Mold remediation").replaceAll("{total}", "$4,800.00").replaceAll("{date}", "Nov 10, 2026").replaceAll("{ref}", "PROP-7K2QX9").replaceAll("{business}", (head == null ? void 0 : head.company) || "Your Company").replaceAll("{location}", "Bay Shore, NY");
  const pickFile = (cb2, maxW = 480) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = () => {
      var _a;
      const f2 = (_a = inp.files) == null ? void 0 : _a[0];
      if (!f2) return;
      const img = new Image();
      img.onload = () => {
        var _a2;
        const c = document.createElement("canvas");
        const sc2 = Math.min(1, maxW / img.width);
        c.width = Math.round(img.width * sc2);
        c.height = Math.round(img.height * sc2);
        (_a2 = c.getContext("2d")) == null ? void 0 : _a2.drawImage(img, 0, 0, c.width, c.height);
        cb2(c.toDataURL("image/png"));
      };
      img.src = URL.createObjectURL(f2);
    };
    inp.click();
  };
  if (!form || !head) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading templates…" });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Proposal templates — a variety, not just one" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Every proposal picks a template when it's built — different words for a homeowner, a school district, or a government bid. The header (company, logo) is shared; intro, terms, and footer live on each template. Printouts, DOCX, and the customer's sign page all render the chosen template." }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { background: "#f8fafc" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Company header & logo (shared by all templates)" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", style: { marginTop: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Company name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: head.company || "", onChange: (e) => setHead({ ...head, company: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Tagline" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: head.tagline || "", onChange: (e) => setHead({ ...head, tagline: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Contact line" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: head.contact_line || "", onChange: (e) => setHead({ ...head, contact_line: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Address line" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: head.address || "", onChange: (e) => setHead({ ...head, address: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
        head.logo ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: head.logo, alt: "logo", style: { maxHeight: 54, maxWidth: 200, border: "1px solid #e5e7eb", borderRadius: 6, padding: 4, background: "#fff" } }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "No logo yet" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => pickFile((d) => setHead({ ...head, logo: d })), children: head.logo ? "Replace logo" : "Upload logo" }),
        head.logo && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setHead({ ...head, logo: null }), children: "Remove" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
          const r2 = await api("/api/proposal-template", { method: "PUT", body: { company: head.company, tagline: head.tagline, contact_line: head.contact_line, address: head.address, intro_html: head.intro_html || "", terms_html: head.terms_html || "", footer: head.footer || "", logo_data: head.logo ?? null } });
          setHead(r2);
          setMsg("Header & logo saved ✓");
        }, children: "Save header & logo" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { margin: "14px 0 8px" }, children: [
      list.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: `chip ${selId === t2.id ? "on" : ""}`, onClick: () => {
        setSelId(t2.id);
        setForm({ name: t2.name, intro_html: t2.intro_html, terms_html: t2.terms_html, footer: t2.footer, include_logo: !!t2.include_logo });
      }, children: [
        t2.name,
        t2.is_default ? " ⭐ default" : ""
      ] }, t2.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        const t2 = await api("/api/doc-templates", { method: "POST", body: { name: "New template" } });
        await load(t2.id);
        setMsg("Template added — make it yours and save");
      }, children: "+ New" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        const t2 = await api("/api/doc-templates", { method: "POST", body: { from_id: selId } });
        await load(t2.id);
        setMsg("Duplicated ✓");
      }, children: "Duplicate" }),
      list.length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        if (!confirm(`Delete "${sel == null ? void 0 : sel.name}"? Proposals already built keep the template they were built with in their history.`)) return;
        await api("/api/doc-templates/" + selId, { method: "DELETE" });
        setSelId("");
        await load("");
        setMsg("Deleted ✓");
      }, children: "Delete" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Template name" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Logo on this template" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", style: { display: "flex", gap: 8, alignItems: "center", marginTop: 8 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto" }, checked: !!form.include_logo, onChange: (e) => setForm({ ...form, include_logo: e.target.checked }) }),
          " Print the company logo at the top"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "full", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Intro — above the line items" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(RichText, { value: form.intro_html, onChange: (v2) => setForm({ ...form, intro_html: v2 }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "full", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Terms & conditions — below the total" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(RichText, { value: form.terms_html, onChange: (v2) => setForm({ ...form, terms_html: v2 }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "full", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Footer" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: form.footer, onChange: (e) => setForm({ ...form, footer: e.target.value }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: async () => {
        const t2 = await api("/api/doc-templates/" + selId, { method: "PATCH", body: form });
        await load(t2.id);
        setMsg("Template saved ✓ — pick it when building a proposal");
      }, children: "Save template" }),
      !(sel == null ? void 0 : sel.is_default) && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: async () => {
        await api("/api/doc-templates/" + selId, { method: "PATCH", body: { is_default: true } });
        await load(selId);
        setMsg("Set as the default ✓ — new proposals preselect it");
      }, children: "⭐ Make default" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: () => setShowPrev(!showPrev), children: showPrev ? "Hide preview" : "Preview with sample data" })
    ] }),
    showPrev && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "printdoc", style: { marginTop: 14, border: "1px solid #dbe4ee" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pd-head", children: [
        form.include_logo && head.logo && /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: head.logo, alt: "", style: { maxHeight: 60, maxWidth: 220, marginBottom: 6 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-company", children: head.company }),
        head.tagline && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-tag", children: head.tagline }),
        head.contact_line && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-meta", children: head.contact_line }),
        head.address && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-meta", children: head.address })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Proposal — Mold remediation · PROP-7K2QX9" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "pd-meta", children: [
        "Prepared for: Angela Ruiz · Bay Shore, NY · Nov 10, 2026 · Template: ",
        form.name
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { dangerouslySetInnerHTML: { __html: sample(form.intro_html) } }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "pd-table", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Item" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Qty" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Unit price" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Amount" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: "Mold remediation — primary bath" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: "1" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: "$3,900.00" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: "$3,900.00" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: "HEPA air scrubber (per day)" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: "3" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: "$300.00" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: "$900.00" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "pd-total", children: "Total: $4,800.00" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Terms & Conditions" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { dangerouslySetInnerHTML: { __html: sample(form.terms_html) } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "pd-sign", children: "Signature: ______________________________  Name (print): ______________________________  Date: ______________" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-foot", children: sample(form.footer) })
    ] })
  ] });
}
function PrintStatusReport() {
  const [r2, setR] = reactExports.useState(null);
  const [ws, setWs] = reactExports.useState(null);
  reactExports.useEffect(() => {
    const wk2 = new URLSearchParams(location.search).get("week") || "";
    api("/api/status-report" + (wk2 ? "?week=" + wk2 : "")).then(setR).catch(() => {
    });
    api("/api/settings").then((x2) => setWs(x2.workspace)).catch(() => {
    });
  }, []);
  reactExports.useEffect(() => {
    if (r2) {
      const t2 = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t2);
    }
  }, [r2]);
  if (!r2) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "printdoc", children: "Loading report…" });
  const Row = ({ k: k2, v: v2 }) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pd-row", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: k2 }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: v2 })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "printdoc", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-head", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: (ws == null ? void 0 : ws.name) || "Weekly Status Report" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
        "Weekly Status Report — week of ",
        r2.week_of,
        " to ",
        r2.week_to
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Pipeline" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "New leads in", v: r2.new_leads }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Backlog still open", v: `${r2.backlog.open} (${money(r2.backlog.pipeline_value)} in pipeline)` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Proposals created", v: `${r2.proposals.count} (${money(r2.proposals.value)})` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Won", v: `${r2.won.count} (${money(r2.won.value)})` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Lost / No response", v: `${r2.lost.count} / ${r2.no_response}` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Approvals", v: `${r2.approvals.decided} decided · ${r2.approvals.rate ?? "—"}% approved · ${r2.approvals.pending} waiting` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Field & Labor" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Field reports filed", v: `${r2.field_reports.filed}/${r2.field_reports.expected} (${r2.field_reports.pct ?? "—"}%)` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Timesheets submitted", v: `${r2.timesheets.submitted}/${r2.timesheets.expected} (${r2.timesheets.pct ?? "—"}%)` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Labor", v: `${r2.labor.hours} hours · ${money(r2.labor.cost)} across ${r2.labor.jobs} jobs` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Crew assignments", v: r2.scheduled.assignments }),
    (r2.top_jobs || []).map((j, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: `· ${j.service_requested} — ${j.customer || ""}`, v: `${j.h}h / ${money(j.a)}` }, i)),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Office" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Inbox received / cleared", v: `${r2.inbox.received} / ${r2.inbox.cleared} (${r2.inbox.open_now} still open)` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { k: "Final outcomes undelivered", v: r2.handoffs_undelivered }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "pd-foot", children: "Generated by Workpile from live data — no hand-kept spreadsheet." })
  ] });
}
function PrintProposal({ id: id2 }) {
  const [d, setD] = reactExports.useState(null);
  const [err, setErr] = reactExports.useState("");
  reactExports.useEffect(() => {
    api("/api/proposals/" + id2 + "/document").then((r2) => {
      setD(r2);
      setTimeout(() => window.print(), 600);
    }).catch((e) => setErr(e.message || "Could not load — sign in first, then reopen this page."));
  }, [id2]);
  if (err) return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: 40 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Proposal" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: err }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "/app", children: "Go to Workpile" }) })
  ] });
  if (!d) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: 40 }, children: "Loading proposal…" });
  const t2 = d.template;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "printdoc", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "noprint", style: { marginBottom: 16 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => window.print(), children: "🖨 Print / Save as PDF" }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: () => window.close(), children: "Close" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pd-head", children: [
      t2.logo && /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: t2.logo, alt: "", style: { maxHeight: 64, maxWidth: 240, marginBottom: 6 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-company", children: t2.company }),
      t2.tagline && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-tag", children: t2.tagline }),
      t2.contact_line && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-meta", children: t2.contact_line }),
      t2.address && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-meta", children: t2.address })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { children: [
      "Proposal — ",
      d.lead.service_requested,
      " · ",
      d.ref
    ] }),
    t2.name && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "pd-meta", children: [
      "Template: ",
      t2.name
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "pd-meta", children: [
      "Prepared for: ",
      d.contact.name,
      " (",
      d.contact.email || "",
      " ",
      d.contact.phone || "",
      ") · Location: ",
      d.lead.location || "",
      " · Date: ",
      new Date(d.proposal.created_at).toLocaleDateString(),
      " · Version ",
      d.proposal.version
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { dangerouslySetInnerHTML: { __html: t2.intro_html } }),
    d.lead.notes && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Scope" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { whiteSpace: "pre-wrap" }, children: d.lead.notes })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "pd-table", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Item" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Qty" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Unit price" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Amount" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: d.items.map((i, k2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: i.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: i.qty || 1 }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
          "$",
          Number(i.unit_price).toFixed(2)
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
          "$",
          (i.unit_price * (i.qty || 1)).toFixed(2)
        ] })
      ] }, k2)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "pd-total", children: [
      "Total: $",
      Number(d.proposal.total).toFixed(2)
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Terms & Conditions" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { dangerouslySetInnerHTML: { __html: t2.terms_html } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "pd-sign", children: "Signature: ______________________________  Name (print): ______________________________  Date: ______________" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pd-foot", children: t2.footer })
  ] });
}
function AgentCommand({ openLead, openJob }) {
  const [text, setText] = reactExports.useState("");
  const [busy, setBusy] = reactExports.useState(false);
  const [report, setReport] = reactExports.useState(null);
  const [runs, setRuns] = reactExports.useState([]);
  const [err, setErr] = reactExports.useState("");
  const loadRuns = () => {
    api("/api/agent/runs").then(setRuns).catch(() => {
    });
  };
  reactExports.useEffect(loadRuns, []);
  const run = async (t2) => {
    const cmd = (t2 ?? text).trim();
    if (!cmd || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r2 = await api("/api/agent/command", { method: "POST", body: { text: cmd } });
      setReport(r2);
      setText("");
      loadRuns();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  const examples = ["Get my business organized", "Prepare proposals for all qualified leads missing one", "Review all active jobs — missing documents, scheduling, invoicing", "Find customers and proposals going cold and recover them", "How did we do this week?"];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { borderLeft: "4px solid #14532d", marginBottom: 14 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "🤖 Agent — tell it what to do" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", style: { marginTop: 0 }, children: "It plans, uses the product's tools, respects your autonomy level and approval rules, and reports back with evidence. It never sends customer messages or changes prices on its own." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "e.g. Prepare proposals for all qualified leads missing one", value: text, onChange: (e) => setText(e.target.value), onKeyDown: (e) => {
        if (e.key === "Enter") run();
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", disabled: busy, onClick: () => run(), children: busy ? "Working…" : "Run" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "chipRow", style: { marginTop: 8 }, children: examples.map((x2) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", onClick: () => run(x2), children: x2 }, x2)) }),
    err && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: err }),
    report && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: 12 }, children: report.results.map((r2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "8px 0", borderTop: "1px solid #e2e8f0" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: r2.tool.replaceAll("_", " ") }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: r2.mode }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: r2.summary }),
      r2.items.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { style: { margin: "6px 0 0", paddingLeft: 18 }, children: r2.items.slice(0, 8).map((it, j) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: it.lead_id ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "clickable", onClick: () => openLead && openLead(it.lead_id), children: [
        it.label,
        " →"
      ] }) : it.label }, j)) })
    ] }, i)) }),
    runs.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("details", { style: { marginTop: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("summary", { className: "muted", style: { cursor: "pointer" }, children: [
        "Previous runs (",
        runs.length,
        ")"
      ] }),
      runs.slice(0, 6).map((r2) => {
        var _a;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "4px 0", fontSize: 12.5 }, children: [
          "“",
          r2.command,
          "” · ",
          new Date(r2.created_at).toLocaleString(),
          " · ",
          (_a = r2.results) == null ? void 0 : _a.map((x2) => x2.tool).join(", ")
        ] }, r2.id);
      })
    ] })
  ] });
}
function AIAssistant({ go, openLead, openJob }) {
  const [ins, setIns] = reactExports.useState([]);
  const [prev, setPrev] = reactExports.useState(null);
  const [acts, setActs] = reactExports.useState({ dedupe: true, spam: true, score: true, assign: false });
  const [result, setResult] = reactExports.useState(null);
  const [msg, setMsg] = reactExports.useState("");
  const [auto, setAuto] = reactExports.useState(null);
  const [runs, setRuns] = reactExports.useState([]);
  const loadIns = () => {
    api("/api/ai/insights").then(setIns).catch(() => {
    });
    api("/api/ai/runs").then(setRuns).catch(() => {
    });
  };
  reactExports.useEffect(() => {
    loadIns();
    api("/api/ai/automations").then(setAuto).catch(() => {
    });
  }, []);
  const scan = async () => {
    setPrev(await api("/api/ai/cleanup/preview", { method: "POST", body: {} }));
    setResult(null);
  };
  const apply = async () => {
    const chosen = Object.entries(acts).filter(([, v2]) => v2).map(([k2]) => k2);
    const r2 = await api("/api/ai/cleanup/apply", { method: "POST", body: { actions: chosen } });
    setResult(r2);
    setPrev(null);
    loadIns();
  };
  const actFor = (i) => {
    if (i.kind === "cleanup") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: scan, children: "Run cleanup scan" });
    if (i.kind === "assign") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
      const r2 = await api("/api/ai/cleanup/apply", { method: "POST", body: { actions: ["assign"] } });
      setMsg(`Auto-assigned ${r2.assigned} leads round-robin ✓`);
      loadIns();
    }, children: "Auto-assign now" });
    if (i.kind === "stale") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
      const r2 = await api("/api/ai/reactivate", { method: "POST", body: {} });
      setMsg(`Reactivation tasks created: ${r2.tasks_created} ✓`);
    }, children: "Create tasks" });
    if (i.kind === "hot") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => go({ view: "leads", leads: { sort: "value" } }), children: "View leads" });
    if (i.kind === "nextstep") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
      const r2 = await api("/api/ai/autofix-next-steps", { method: "POST", body: {} });
      setMsg(`Next steps auto-scheduled on ${r2.fixed} leads ✓`);
      loadIns();
    }, children: "Auto-schedule next steps" });
    if (i.kind === "approvals") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => go({ view: "approvals" }), children: "Review approvals" });
    if (i.kind === "cold") return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
      const r2 = await api("/api/ai/nudge", { method: "POST", body: { lead_id: i.lead_id } });
      setMsg(`Nudge sent by ${r2.channel} (${String(r2.status).replaceAll("_", " ")}) ✓`);
    }, children: "Nudge the oldest now" });
    return null;
  };
  const setAutoKey = async (k2, v2) => {
    const r2 = await api("/api/ai/automations", { method: "POST", body: { [k2]: v2 } });
    setAuto(r2);
  };
  const agentLabel = { triage: "🔍 Triage", automation: "🤖 Auto-pilot", nudge: "📨 Nudge", packet_check: "🛂 Packet check" };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(AgentCommand, { openLead, openJob }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "AI Assistant" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Agents do the chasing, sorting, and scoring — nothing customer-facing ever sends without your approval. Every action here is preview first, apply second; auto-pilot actions are logged below." }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Insights — what needs you today" }),
      ins.map((i, k2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "insight", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ic", children: i.icon }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: i.title }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: i.detail })
        ] }),
        actFor(i)
      ] }, k2)),
      ins.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "All clear — no duplicates, no unassigned leads, nothing stale, nothing going cold. The AI is watching." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Auto-pilot — runs every few hours, even while you sleep" }),
      !auto && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading…" }),
      auto && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        [["auto_score", "Keep every lead scored", "Hot / warm / cold stays current as leads age and change."], ["auto_assign", "Auto-assign unassigned leads", "Round-robin to lead owners the moment a lead sits unowned."], ["auto_dedupe", "Auto-archive duplicates", "Exact phone/email matches and same-week name+service repeats — original kept, merge recorded."], ["auto_reactivate", "Auto-create reactivation tasks", "Any open lead untouched for 14+ days gets a call task for its owner."]].map(([k2, lab, hint]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", style: { display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid #eef2f7" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto", marginTop: 2 }, checked: !!auto[k2], onChange: (e) => setAutoKey(k2, e.target.checked) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: lab }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: hint })
          ] })
        ] }, k2)),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            const r2 = await api("/api/ai/automations/run", { method: "POST", body: {} });
            setMsg("Auto-pilot ran ✓ — " + JSON.stringify(r2.result));
            loadIns();
            api("/api/ai/automations").then(setAuto).catch(() => {
            });
          }, children: "Run auto-pilot now" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: auto.last_automation_at ? "Last ran " + dt(auto.last_automation_at) : "Has not run yet" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AutonomyCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ProviderCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(PlaybookCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AgentMetricsCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(QuietHoursCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SuppressionsCard, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "AI Cleanup — duplicates, spam, scoring, assignment" }),
      !prev && !result && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: scan, children: "Run cleanup scan" }),
      prev && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: prev.duplicate_count }),
          " duplicates · ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: prev.spam_count }),
          " spam/invalid · ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: prev.unassigned_count }),
          " unassigned · ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: prev.unscored_count }),
          " unscored — of ",
          num(prev.total_leads),
          " leads"
        ] }),
        prev.duplicates.slice(0, 6).map((d) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "3px 0" }, children: [
          "Duplicate: ",
          d.name,
          " — ",
          d.service,
          " (original kept)"
        ] }, d.id)),
        prev.spam.slice(0, 4).map((d) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "3px 0" }, children: [
          "Spam/invalid: ",
          d.name || "—",
          " — ",
          d.service
        ] }, d.id)),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { margin: "12px 0" }, children: [["dedupe", "Archive duplicates (original kept, merge recorded)"], ["spam", "Mark spam/invalid as Junk"], ["score", "Score every lead (hot / warm / cold)"], ["assign", "Auto-assign unassigned leads round-robin"]].map(([k2, lab]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto" }, checked: acts[k2], onChange: (e) => setActs({ ...acts, [k2]: e.target.checked }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: lab })
        ] }, k2)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: apply, children: "Apply cleanup" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: () => setPrev(null), children: "Cancel" })
        ] })
      ] }),
      result && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ok", children: [
        "Cleanup applied ✓ — ",
        result.archived_duplicates,
        " duplicates archived · ",
        result.marked_spam,
        " spam marked · ",
        result.scored,
        " leads scored · ",
        result.assigned,
        " auto-assigned. ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: scan, children: "Scan again" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Recent agent activity" }),
      runs.map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "6px 0", borderBottom: "1px solid #eef2f7", paddingBottom: 6 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: agentLabel[r2.agent] || r2.agent }),
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
          "· ",
          dt(r2.created_at)
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: String(r2.output || "").slice(0, 220) })
      ] }, r2.id)),
      runs.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No agent runs logged yet — triage, nudges, and auto-pilot runs will appear here." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "How the agents work" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { lineHeight: 1.6 }, children: "Triage classifies every incoming lead (service, urgency, value band, spam) the second it lands. Scoring ranks the pile so humans call hot leads first, and every lead record carries a plain-English next-best-action from the same engine. Cleanup keeps the data honest. Auto-pilot repeats the safe chores on a timer. The Completeness Gate is the bouncer: no packet reaches an approver missing contact, scope, visit, PM, or price-book pricing. Agents never invent prices and never send anything customer-facing on their own — that line is enforced in code, not policy." })
    ] })
  ] });
}
function SyncModal({ close, done }) {
  const [preset, setPreset] = reactExports.useState("30");
  const [from, setFrom] = reactExports.useState("");
  const [to, setTo] = reactExports.useState("");
  const [cfg, setCfg] = reactExports.useState(null);
  const [res, setRes] = reactExports.useState(null);
  const [busy, setBusy] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState("");
  reactExports.useEffect(() => {
    api("/api/settings").then((r2) => setCfg(r2.workspace)).catch(() => {
    });
  }, []);
  const range = () => {
    const days = Number(preset);
    if (preset === "custom") return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
    const end = /* @__PURE__ */ new Date();
    const start = new Date(Date.now() - (days - 1) * 864e5);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: end.toISOString() };
  };
  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      const r2 = await api("/api/sync/run", { method: "POST", body: range() });
      setRes(r2);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", style: { maxWidth: 560 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Sync leads from your source system" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "Pulls leads created in the selected window and imports them — duplicates are detected by phone/email and skipped, never double-created. Source: ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: (cfg == null ? void 0 : cfg.source_api_url) ? cfg.source_api_url : "Demo source (built-in sample system)" }),
      (cfg == null ? void 0 : cfg.last_sync_at) ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        " · last sync ",
        dt(cfg.last_sync_at)
      ] }) : ""
    ] }),
    err && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: err }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "How far back?" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "chipRow", children: [["1", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["custom", "Custom range"]].map(([k2, lab]) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: `chip ${preset === k2 ? "on" : ""}`, onClick: () => setPreset(k2), children: lab }, k2)) }),
    preset === "custom" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "From" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", value: from, onChange: (e) => setFrom(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "To" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", value: to, onChange: (e) => setTo(e.target.value) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", style: { marginTop: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto" }, checked: !!(cfg == null ? void 0 : cfg.sync_enabled), onChange: async (e) => {
        await api("/api/settings", { method: "PATCH", body: { sync_enabled: e.target.checked } });
        setCfg({ ...cfg, sync_enabled: e.target.checked ? 1 : 0 });
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Daily auto-sync" }),
        " — pull yesterday's leads every morning automatically"
      ] })
    ] }),
    res && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ok", children: [
      "Sync complete ✓ — fetched ",
      res.fetched,
      " · created ",
      res.created,
      " · duplicates skipped ",
      res.duplicates,
      " · errors ",
      res.errors
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", disabled: busy, onClick: run, children: busy ? "Syncing…" : "⇅ Run sync" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: () => {
        close();
        if (res) done();
      }, children: "Close" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12.5 }, children: "Prefer a file? Use Import CSV — same dedupe, same ownership rules. Point the source at your real system in Settings → Workspace (Source API URL)." })
  ] }) });
}
const relTime = (s) => {
  if (!s) return "";
  const m2 = Math.max(1, Math.round((Date.now() - new Date(s).getTime()) / 6e4));
  if (m2 < 60) return m2 + "m ago";
  const h = Math.round(m2 / 60);
  if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
};
const EV_ICON = { created: "🆕", state_changed: "➡️", proposal_created: "📄", proposal_sent: "📨", message_email: "✉️", message_sms: "💬", task: "✅", note: "📝", approval_requested: "🙋", approval_decided: "⚖️", signed: "✍️" };
function MyDay({ user, openLead, go }) {
  const [d, setD] = reactExports.useState(null);
  const [tickL, setTickL] = reactExports.useState(0);
  reactExports.useEffect(() => {
    api("/api/myday").then(setD).catch(() => {
    });
  }, [tickL]);
  const hour = (/* @__PURE__ */ new Date()).getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = ((user == null ? void 0 : user.name) || "").split(" ")[0];
  if (!d) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading your day…" });
  const done = async (tid) => {
    await api(`/api/tasks/${tid}/complete`, { method: "POST", body: {} });
    setTickL((t2) => t2 + 1);
  };
  const TaskRow = ({ t: t2, late }) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pulseRow", style: { cursor: "default" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pulseIco", children: late ? "⏰" : "✅" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, onClick: () => openLead(t2.lead_id), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: t2.title }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        "· ",
        t2.contact_name || "",
        " — ",
        t2.service_requested || ""
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: late ? "" : "muted", style: late ? { color: "#b91c1c", fontWeight: 600 } : {}, children: [
        late ? "Overdue — " : "Due ",
        dOnly(t2.due_at)
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => done(t2.id), children: "✓ Done" })
  ] });
  const nothing = d.overdue_tasks.length + d.today_tasks.length + d.my_leads_due.length + d.approvals_waiting.length === 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "pt", children: [
      greet,
      ", ",
      first,
      "."
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "sub", children: [
      (/* @__PURE__ */ new Date()).toLocaleDateString(void 0, { weekday: "long", month: "long", day: "numeric" }),
      " — your personal queue. The business dashboard is one click over; this page is just yours."
    ] }),
    d.timesheet_alert && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginBottom: 14, borderLeft: "4px solid #b45309" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        "⏱ Your timesheet for the week of ",
        d.timesheet_alert.week_of,
        " is missing."
      ] }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "Log the total here, or open Ops Console → Timesheets for the per-day grid." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rowflex", style: { marginLeft: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", placeholder: "Total hours", style: { width: 110 }, id: "tsquick" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
          const v2 = document.getElementById("tsquick").value;
          await api("/api/timesheets", { method: "POST", body: { week_of: d.timesheet_alert.week_of, hours: Number(v2) || 0 } });
          setTickL((t2) => t2 + 1);
        }, children: "Log it" })
      ] })
    ] }),
    d.field_alert && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginBottom: 14, borderLeft: "4px solid #b45309" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        "📋 Your field report for ",
        d.field_alert.report_date,
        " is missing."
      ] }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "File the short version here, or open Ops Console → Field reports to attach it to a job." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rowflex", style: { marginLeft: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "What got done yesterday…", style: { width: 260 }, id: "frquick" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
          const v2 = document.getElementById("frquick").value;
          await api(`/api/field-reports/${d.field_alert.id}/submit`, { method: "POST", body: { notes: v2 } });
          setTickL((t2) => t2 + 1);
        }, children: "File report" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpis", style: { marginBottom: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "⏰ Overdue tasks" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", style: { color: d.overdue_tasks.length ? "#b91c1c" : void 0 }, children: num(d.overdue_tasks.length) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: "Assigned to you, past due" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", onClick: () => {
        var _a;
        return (_a = window.wpLogTime) == null ? void 0 : _a.call(window);
      }, style: { cursor: "pointer" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "⏱ Log time" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: "10-sec" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: "Any worker, any job — a name is enough" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", onClick: () => go({ view: "ops" }), style: { cursor: "pointer" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "📥 Inbox waiting" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", style: { color: d.inbox_count ? "#b45309" : void 0 }, children: num(d.inbox_count || 0) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: "Client mail & more — not leads" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "📋 Due today" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: num(d.today_tasks.length + d.my_leads_due.length) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: "Tasks + lead next steps" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", onClick: () => go({ view: "approvals" }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "⚖️ Approvals waiting" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "val", children: num(d.approvals_count) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: "Packets needing a decision" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kpi", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lab", children: "🏆 Wins this week" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "val", children: [
          num(d.wins_week.count),
          " · ",
          money(d.wins_week.value)
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hint", children: "Closed across the business" })
      ] })
    ] }),
    nothing && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { textAlign: "center", padding: 30 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 32 }, children: "🌤️" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Your queue is clear." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No overdue tasks, nothing due today, no approvals waiting on you. Check Pulse for what the team is moving." })
    ] }),
    (d.overdue_tasks.length > 0 || d.today_tasks.length > 0) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: "6px 14px", marginBottom: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: "10px 0 4px" }, children: "Your tasks" }),
      d.overdue_tasks.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsx(TaskRow, { t: t2, late: true }, t2.id)),
      d.today_tasks.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsx(TaskRow, { t: t2 }, t2.id))
    ] }),
    d.my_leads_due.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: "6px 14px", marginBottom: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: "10px 0 4px" }, children: "Your leads need a next step" }),
      d.my_leads_due.map((l2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pulseRow", onClick: () => openLead(l2.id), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pulseIco", children: "🎯" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: l2.contact_name }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
            "· ",
            l2.service_requested
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            l2.next_action || "Follow up",
            " — due ",
            dOnly(l2.next_action_due_at)
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { s: l2.state })
      ] }, l2.id))
    ] }),
    d.approvals_waiting.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: "6px 14px", marginBottom: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: "10px 0 4px" }, children: "Waiting on your approval" }),
      d.approvals_waiting.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pulseRow", onClick: () => go({ view: "approvals" }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pulseIco", children: "⚖️" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: a.contact_name }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
            "· ",
            a.service_requested
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            money(a.est_value),
            " · ",
            a.tier,
            " tier · submitted ",
            dt(a.submitted_at)
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "Decide →" })
      ] }, a.id))
    ] }),
    d.followups_due.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: "6px 14px" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: "10px 0 4px" }, children: "🔁 Follow-ups firing by tomorrow" }),
      d.followups_due.map((f2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pulseRow", onClick: () => openLead(f2.lead_id), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pulseIco", children: "📨" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: f2.contact_name }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
            "· ",
            f2.service_requested
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            "Step ",
            (f2.step_idx || 0) + 1,
            " nudge — ",
            dt(f2.next_due_at)
          ] })
        ] })
      ] }, f2.id))
    ] })
  ] });
}
function Pulse({ openLead }) {
  const [evs, setEvs] = reactExports.useState([]);
  reactExports.useEffect(() => {
    api("/api/activity").then((r2) => setEvs(r2.events)).catch(() => {
    });
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Pulse" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Everything happening in the business, as it happens — every lead, proposal, signature and decision in one stream." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: "6px 14px" }, children: [
      evs.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No activity yet." }),
      evs.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pulseRow", onClick: () => openLead(e.lead_id), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "pulseIco", children: EV_ICON[e.event_type] || "•" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: e.contact_name || "Lead" }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
            "· ",
            e.service_requested || ""
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            e.event_type.replaceAll("_", " "),
            e.from_state ? ` ${e.from_state.replaceAll("_", " ")} → ${e.to_state.replaceAll("_", " ")}` : ""
          ] }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
            "— ",
            e.actor_name || "system"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { fontSize: 12, whiteSpace: "nowrap" }, children: relTime(e.created_at) })
      ] }, e.id))
    ] })
  ] });
}
function CommandPalette({ close, go, openLead, newLead }) {
  const [q2, setQ] = reactExports.useState("");
  const [leads, setLeads] = reactExports.useState([]);
  const [recents, setRecents] = reactExports.useState([]);
  const [idx, setIdx] = reactExports.useState(0);
  const ACTIONS = [
    { label: "Work Queue", hint: "G then Q", run: () => go({ view: "queue" }) },
    { label: "Jobs", hint: "G then J", run: () => go({ view: "jobs" }) },
    { label: "Log time", hint: "T", run: () => {
      var _a;
      return (_a = window.wpLogTime) == null ? void 0 : _a.call(window);
    } },
    { label: "Customers", hint: "", run: () => go({ view: "customers" }) },
    { label: "People", hint: "", run: () => {
      var _a;
      return (_a = window.wpGoTab) == null ? void 0 : _a.call(window, "customers", "people");
    } },
    { label: "Campaigns", hint: "", run: () => go({ view: "campaigns" }) },
    { label: "Tasks", hint: "", run: () => {
      var _a;
      return (_a = window.wpGoTab) == null ? void 0 : _a.call(window, "planner", "tasks");
    } },
    { label: "Calendar", hint: "", run: () => {
      var _a;
      return (_a = window.wpGoTab) == null ? void 0 : _a.call(window, "planner", "calendar");
    } },
    { label: "Notes", hint: "", run: () => {
      var _a;
      return (_a = window.wpGoTab) == null ? void 0 : _a.call(window, "library", "notes");
    } },
    { label: "Files & Documents", hint: "", run: () => {
      var _a;
      return (_a = window.wpGoTab) == null ? void 0 : _a.call(window, "library", "files");
    } },
    { label: "Duplicates", hint: "", run: () => go({ view: "leads", leads: { mode: "dupes" } }) },
    { label: "My Day", hint: "G then M", run: () => go({ view: "myday" }) },
    { label: "Dashboard", hint: "G then D", run: () => go({ view: "dashboard" }) },
    { label: "Pulse — activity stream", hint: "G then P", run: () => go({ view: "pulse" }) },
    { label: "Leads", hint: "G then L", run: () => go({ view: "leads" }) },
    { label: "Approvals", hint: "G then A", run: () => go({ view: "approvals" }) },
    { label: "Reports", hint: "G then R", run: () => go({ view: "reports" }) },
    { label: "AI Assistant", hint: "", run: () => go({ view: "ai" }) },
    { label: "Import CSV", hint: "", run: () => go({ view: "imports" }) },
    { label: "Demand Gap", hint: "", run: () => go({ view: "demand" }) },
    { label: "Handoffs", hint: "", run: () => go({ view: "handoffs" }) },
    { label: "Ops Console", hint: "", run: () => go({ view: "ops" }) },
    { label: "Settings", hint: "G then S", run: () => go({ view: "settings" }) },
    { label: "Billing", hint: "", run: () => go({ view: "billing" }) },
    { label: "＋ New lead", hint: "N", run: () => newLead() }
  ];
  reactExports.useEffect(() => {
    const ids = JSON.parse(localStorage.getItem("wp_recent") || "[]");
    Promise.all(ids.slice(0, 5).map((id2) => api(`/api/leads/${id2}`).then((r2) => r2.lead || r2).catch(() => null))).then((rs) => setRecents(rs.filter(Boolean)));
  }, []);
  const [gs, setGs] = reactExports.useState(null);
  reactExports.useEffect(() => {
    if (!q2.trim()) {
      setLeads([]);
      return;
    }
    const t2 = setTimeout(() => {
      api(`/api/leads?paged=1&page=1&page_size=6&q=${encodeURIComponent(q2)}`).then((r2) => setLeads(r2.items || [])).catch(() => {
      });
      api(`/api/search?q=${encodeURIComponent(q2)}`).then(setGs).catch(() => {
      });
    }, 160);
    return () => clearTimeout(t2);
  }, [q2]);
  const acts = ACTIONS.filter((a) => a.label.toLowerCase().includes(q2.toLowerCase()));
  const items = [
    ...q2 ? [] : recents.map((l2) => ({ label: `${l2.contact_name || "Lead"} — ${l2.service_requested || ""}`, sub: "Recent", run: () => openLead(l2.id) })),
    ...acts.map((a) => ({ ...a, sub: "Go / do" })),
    ...leads.map((l2) => ({ label: `${l2.contact_name || "Lead"} — ${l2.service_requested || ""}`, sub: "Lead · " + l2.state, run: () => openLead(l2.id) })),
    ...((gs == null ? void 0 : gs.jobs) || []).map((j) => ({ label: `${j.contact_name || "Job"} — ${j.title}`, sub: "Job · " + j.sub, run: () => {
      var _a;
      return (_a = window.wpOpenJob) == null ? void 0 : _a.call(window, j.id);
    } })),
    ...((gs == null ? void 0 : gs.accounts) || []).map((a) => ({ label: a.title, sub: "Customer", run: () => {
      var _a;
      return (_a = window.wpOpenAccount) == null ? void 0 : _a.call(window, a.id);
    } })),
    ...((gs == null ? void 0 : gs.people) || []).map((p2) => ({ label: p2.title, sub: "Person", run: () => {
      var _a;
      return (_a = window.wpGoTab) == null ? void 0 : _a.call(window, "customers", "people");
    } })),
    ...((gs == null ? void 0 : gs.campaigns) || []).map((c) => ({ label: c.title, sub: "Campaign", run: () => go({ view: "campaigns" }) })),
    ...((gs == null ? void 0 : gs.invoices) || []).map((iv) => ({ label: `${iv.title} — $${Math.round(iv.total || 0).toLocaleString()}`, sub: "Invoice · " + iv.sub, run: () => {
      var _a;
      return iv.job_id ? (_a = window.wpOpenJob) == null ? void 0 : _a.call(window, iv.job_id) : openLead(iv.lead_id);
    } })),
    ...((gs == null ? void 0 : gs.proposals) || []).map((p2) => ({ label: p2.title, sub: "Proposal · " + p2.sub, run: () => openLead(p2.lead_id) }))
  ];
  reactExports.useEffect(() => {
    setIdx(0);
  }, [q2]);
  const pick = (it) => {
    if (it) {
      close();
      it.run();
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", onClick: close, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "palette", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { autoFocus: true, placeholder: "Search leads, jump to a view, run an action…", value: q2, onChange: (e) => setQ(e.target.value), onKeyDown: (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(items.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter") pick(items[idx]);
      if (e.key === "Escape") close();
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "palList", children: [
      items.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { padding: "10px 12px" }, children: "No matches." }),
      items.map((it, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `palItem ${i === idx ? "on" : ""}`, onMouseEnter: () => setIdx(i), onClick: () => pick(it), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 }, children: it.label }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", style: { fontSize: 12 }, children: [
          it.sub,
          it.hint ? ` · ${it.hint}` : ""
        ] })
      ] }, i))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "palFoot", children: "↑↓ navigate · Enter open · Esc close" })
  ] }) });
}
const DEF_STEPS = [
  { day: 2, channel: "email", template: "Hi {name}, just floating your proposal from {business} back to the top of your inbox — total {total}. Review & sign here: {link}" },
  { day: 5, channel: "sms", template: "{business}: your proposal ({total}) is waiting — review & sign: {link}" },
  { day: 10, channel: "email", template: "Hi {name}, last nudge from {business} — your proposal ({total}) is still open here: {link}" }
];
function BookingSettings({ ws }) {
  const [on, setOn] = reactExports.useState(!!ws.booking_enabled);
  const [note, setNote] = reactExports.useState("");
  const url = `${location.origin}/book/${ws.booking_slug || ""}`;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginTop: 14 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "📅 Online booking page" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: on, onChange: async (e) => {
        setOn(e.target.checked);
        await api("/api/settings", { method: "PATCH", body: { booking_enabled: e.target.checked } });
        setNote(e.target.checked ? "Live ✓" : "Off");
      }, style: { width: "auto" } }),
      " Let customers book site visits from a public page"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "Your page: ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: url, target: "_blank", rel: "noreferrer", children: url }),
      " — every booking lands as an owned lead with the visit already scheduled, and owners get notified. Put it on your website, Google profile, and email signature.",
      note && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        " · ",
        note
      ] })
    ] })
  ] });
}
function FollowupSettings({ ws }) {
  const initSteps = (() => {
    try {
      const p2 = JSON.parse(ws.followup_steps || "null");
      if (Array.isArray(p2) && p2.length) return p2;
    } catch {
    }
    return DEF_STEPS;
  })();
  const [on, setOn] = reactExports.useState(!!ws.followup_enabled);
  const [steps, setSteps] = reactExports.useState(initSteps);
  const [revOn, setRevOn] = reactExports.useState(!!ws.review_on_won);
  const [revUrl, setRevUrl] = reactExports.useState(ws.review_url || "");
  const [note, setNote] = reactExports.useState("");
  const save = async () => {
    await api("/api/settings", { method: "PATCH", body: { followup_enabled: on, followup_steps: steps, review_on_won: revOn, review_url: revUrl } });
    setNote("Saved ✓");
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginTop: 14 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { marginTop: 0 }, children: [
      "🔁 Follow-up cadence ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { fontWeight: 400, fontSize: 13 }, children: "— automatic nudges while a proposal waits (the follow-up machine every field-service CRM runs)" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: on, onChange: (e) => setOn(e.target.checked), style: { width: "auto" } }),
      " Turn on automatic follow-ups for sent proposals"
    ] }),
    steps.map((st, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "Day" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", style: { width: 70 }, value: st.day, onChange: (e) => {
        const c = [...steps];
        c[i] = { ...c[i], day: Number(e.target.value) };
        setSteps(c);
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 110 }, value: st.channel, onChange: (e) => {
        const c = [...steps];
        c[i] = { ...c[i], channel: e.target.value };
        setSteps(c);
      }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "email", children: "Email" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "sms", children: "SMS" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, value: st.template, onChange: (e) => {
        const c = [...steps];
        c[i] = { ...c[i], template: e.target.value };
        setSteps(c);
      } })
    ] }, i)),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "Merge fields: ",
      "{name} {business} {total} {link}",
      ". Stops automatically on signature, final outcome, or a manual stop on the lead. SMS steps need the lead's texting consent (TCPA)."
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "⭐ Reviews & referrals" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "check", style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: revOn, onChange: (e) => setRevOn(e.target.checked), style: { width: "auto" } }),
      " When a lead is Won, email the customer a review request"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 8 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Google review link" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: revUrl, placeholder: "https://g.page/r/…", onChange: (e) => setRevUrl(e.target.value) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: save, children: "Save follow-ups & reviews" }),
      note && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: note })
    ] })
  ] });
}
function CallbackForm({ leadId, done }) {
  const [when, setWhen] = reactExports.useState("");
  const [note, setNote] = reactExports.useState("");
  const [msg, setMsg] = reactExports.useState("");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "datetime-local", value: when, onChange: (e) => setWhen(e.target.value) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Note — e.g. 'call me Thursday, gate code 4417'", value: note, onChange: (e) => setNote(e.target.value), style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", disabled: !when, onClick: async () => {
        await api(`/api/leads/${leadId}/callback`, { method: "POST", body: { due_at: new Date(when).toISOString(), note } });
        setMsg("Callback set ✓ — it resurfaces in the Work Queue at that time");
        setNote("");
        done && done();
      }, children: "Set callback" })
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { marginTop: 6 }, children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12.5 }, children: `"Call me Thursday" is a promise — it lands in the queue when it's due, with your note attached.` })
  ] });
}
function WorkQueue({ openLead, openJob, go }) {
  const [q2, setQ] = reactExports.useState(null);
  const [typeF, setTypeF] = reactExports.useState("all");
  const [focus, setFocus] = reactExports.useState(0);
  const [sel, setSel] = reactExports.useState(/* @__PURE__ */ new Set());
  const [team, setTeam] = reactExports.useState([]);
  const [bulkMsg, setBulkMsg] = reactExports.useState("");
  reactExports.useEffect(() => {
    api("/api/users").then(setTeam).catch(() => {
    });
  }, []);
  const [keysOn, setKeysOn] = reactExports.useState(() => {
    try {
      return localStorage.getItem("wp_keys") !== "off";
    } catch {
      return true;
    }
  });
  const toggleSel = (id2) => setSel((prev) => {
    const n2 = new Set(prev);
    if (n2.has(id2)) n2.delete(id2);
    else n2.add(id2);
    return n2;
  });
  const selItems = ((q2 == null ? void 0 : q2.items) || []).filter((i) => sel.has(i.id) && i.lead_id);
  const bulk = async (action, extra = {}) => {
    if (!selItems.length) return;
    const r2 = await api("/api/queue/bulk", { method: "POST", body: { lead_ids: selItems.map((i) => i.lead_id), action, ...extra } }).catch((e) => ({ error: e.message }));
    if (r2.error) {
      setBulkMsg(r2.error);
      return;
    }
    setBulkMsg(`${action === "assign" ? "Assigned" : action === "snooze" ? "Snoozed" : "Tasks created for"} ${r2.affected} lead${r2.affected === 1 ? "" : "s"} ✓`);
    toast(`Bulk ${action}: ${r2.affected} leads ✓`);
    setSel(/* @__PURE__ */ new Set());
    load();
  };
  const load = () => {
    api("/api/queue").then(setQ).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const items = ((q2 == null ? void 0 : q2.items) || []).filter((i) => typeF === "all" || i.type === typeF);
  reactExports.useEffect(() => {
    const h = (e) => {
      if (!keysOn) return;
      const t2 = e.target;
      if (t2 && (t2.tagName === "INPUT" || t2.tagName === "TEXTAREA" || t2.tagName === "SELECT")) return;
      if (e.key.toLowerCase() === "j") setFocus((f2) => Math.min(items.length - 1, f2 + 1));
      if (e.key.toLowerCase() === "k") setFocus((f2) => Math.max(0, f2 - 1));
      if (e.key === "Enter" && items[focus]) act(items[focus]);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [items, focus, keysOn]);
  const act = (i) => {
    if (i.type === "approval") go({ view: "approvals" });
    else if (i.job_id && i.type !== "followup_overdue" && i.type !== "lead_untouched" && i.type !== "proposal_cold" && i.type !== "proposal_viewed") openJob(i.job_id);
    else if (i.type === "inbox") go({ view: "ops" });
    else if (i.type === "field_report" || i.type === "timesheet") go({ view: "ops" });
    else if (i.lead_id) openLead(i.lead_id);
  };
  const doneQuick = async (i) => {
    if (i.type === "callback") await api(`/api/callbacks/${i.callback_id}/done`, { method: "POST", body: {} });
    load();
  };
  if (!q2) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading your pile…" });
  const LBL = { handoff_failed: "⚠ Handoff failed", approval: "✋ Approval", callback: "📞 Callback", followup_overdue: "⏰ Overdue", lead_untouched: "🆕 Untouched", proposal_viewed: "👁 Viewed, unsigned", inbox: "✉ Inbox", proposal_cold: "🧊 Going cold", job_crew: "👷 Needs crew", paperwork: "📄 Paperwork", field_report: "📋 Field report", timesheet: "⏱ Timesheet" };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Work Queue" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "sub", children: [
      "Everything that needs a human, worst-first — leads, email, approvals, jobs, paperwork. Work it to zero. ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "Keys: J/K move · Enter open" })
    ] }),
    selItems.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: "10px 14px", marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "#f0fdf4" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        selItems.length,
        " selected"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "bulkAssign", style: { width: 180 }, defaultValue: "", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Assign to…" }),
        team.filter((u2) => {
          var _a;
          return ((_a = u2.permissions) == null ? void 0 : _a.leads_scope) !== "none";
        }).map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: u2.id, children: u2.name }, u2.id))
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: () => {
        const v2 = document.getElementById("bulkAssign").value;
        if (v2) bulk("assign", { assignee_id: v2 });
        else setBulkMsg("Pick a person to assign to first.");
      }, children: "Assign" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => bulk("snooze", { days: 1 }), children: "Snooze 1d" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => bulk("snooze", { days: 3 }), children: "Snooze 3d" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => bulk("task", { title: "Follow up (bulk from queue)" }), children: "+ Follow-up task" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setSel(/* @__PURE__ */ new Set()), children: "Clear" }),
      bulkMsg && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: bulkMsg })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: `chip ${typeF === "all" ? "on" : ""}`, onClick: () => setTypeF("all"), children: [
        "All (",
        q2.total,
        ")"
      ] }),
      Object.entries(q2.by_type || {}).map(([t2, c]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: `chip ${typeF === t2 ? "on" : ""}`, onClick: () => setTypeF(t2), children: [
        LBL[t2] || t2,
        " (",
        c,
        ")"
      ] }, t2)),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: load, children: "↻ Refresh" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "chip", title: "Single-key shortcuts in the queue (WCAG 2.1.4 — turn them off any time)", onClick: () => {
        const v2 = !keysOn;
        setKeysOn(v2);
        try {
          localStorage.setItem("wp_keys", v2 ? "on" : "off");
        } catch {
        }
      }, children: [
        "⌨ J/K shortcuts: ",
        keysOn ? "on" : "off"
      ] })
    ] }),
    items.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { textAlign: "center", padding: 34 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: 34 }, children: "🎉" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: "8px 0 4px" }, children: "Zero. The pile is clear." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Nothing is waiting on anyone. New leads, mail, and due follow-ups land here the moment they exist." })
    ] }),
    items.map((i, ix) => {
      var _a;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card qRow", style: { ...ix === focus ? { outline: "2px solid #166534" } : {} }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "qCheck", children: i.lead_id && i.type !== "approval" ? /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: sel.has(i.id), onChange: () => toggleSel(i.id), onClick: (e) => e.stopPropagation(), style: { width: 17, height: 17 } }) : null }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge qBadge", children: LBL[i.type] || i.type }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "qTitle", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: i.title }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: i.subtitle })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "qQuick", children: i.type === "callback" ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small qDoneBtn", onClick: () => doneQuick(i), children: "✓ Done" }) : null }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small qBtn", onClick: () => act(i), children: ((_a = i.primary) == null ? void 0 : _a.label) || "Open" })
      ] }, i.id);
    })
  ] });
}
function JobsBoard({ openJob }) {
  const [jobs, setJobs] = reactExports.useState([]);
  const [dragId, setDragId] = reactExports.useState("");
  const load = () => {
    api("/api/jobs").then(setJobs).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const drop = async (st) => {
    if (!dragId) return;
    await api(`/api/jobs/${dragId}/stage`, { method: "POST", body: { to: st } }).catch(() => {
    });
    setDragId("");
    load();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Jobs" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Won work, run as operations: schedule it, crew it, work it, paper it, invoice it. Drag cards to move — both directions, always." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "kanban", children: JOB_STAGES.map((st) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kcol", onDragOver: (e) => e.preventDefault(), onDrop: () => drop(st), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
        st.replaceAll("_", " "),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: num(jobs.filter((j) => j.stage === st).length) })
      ] }),
      jobs.filter((j) => j.stage === st).map((j) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "kcard", draggable: true, onDragStart: () => setDragId(j.id), onClick: () => openJob(j.id), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: j.service_requested }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "m", children: [
          j.contact_name,
          " · ",
          money(j.value),
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          j.labor_hours ? `⏱ ${j.labor_hours}h · ${money(j.labor_cost)} labor (${j.labor_pct ?? 0}%)` : "no time logged",
          " · 📄 ",
          j.docs_received,
          "/",
          j.docs_total,
          " docs"
        ] })
      ] }, j.id))
    ] }, st)) }),
    jobs.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { textAlign: "center", padding: 30 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: "4px 0" }, children: "No jobs yet" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Jobs are born the moment a proposal is signed (or a lead is marked Won). Win something and it lands here, ready to schedule." })
    ] })
  ] });
}
function Avatar({ u: u2, size = 30 }) {
  if (u2 == null ? void 0 : u2.avatar_url) return /* @__PURE__ */ jsxRuntimeExports.jsx("img", { className: "avatar", style: { width: size, height: size }, src: u2.avatar_url, alt: (u2 == null ? void 0 : u2.name) || "" });
  const ini = String((u2 == null ? void 0 : u2.name) || "?").trim().split(/\s+/).map((w2) => w2[0]).slice(0, 2).join("").toUpperCase();
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "avatar avatarIni", style: { width: size, height: size, fontSize: Math.max(10, size * 0.4) }, children: ini });
}
function JobChat({ jobId, me: me2, users }) {
  const [msgs, setMsgs] = reactExports.useState([]);
  const [draft, setDraft] = reactExports.useState("");
  const [mids, setMids] = reactExports.useState([]);
  const [query, setQuery] = reactExports.useState(null);
  const boxRef = reactExports.useRef(null);
  const load = () => api("/api/jobs/" + jobId + "/messages").then((r2) => setMsgs(r2.messages || [])).catch(() => {
  });
  reactExports.useEffect(load, [jobId]);
  reactExports.useEffect(() => {
    const el2 = boxRef.current;
    if (el2) el2.scrollTop = el2.scrollHeight;
  }, [msgs.length]);
  const team = (users || []).filter((u2) => u2.active !== 0);
  const candidates = query === null ? [] : team.filter((u2) => u2.id !== (me2 == null ? void 0 : me2.id) && u2.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  const onType = (v2) => {
    setDraft(v2);
    const mm = v2.match(/@([\w ]*)$/);
    setQuery(mm ? mm[1] : null);
  };
  const pick = (u2) => {
    setDraft((d) => d.replace(/@([\w ]*)$/, "@" + u2.name + " "));
    setMids((x2) => [.../* @__PURE__ */ new Set([...x2, u2.id])]);
    setQuery(null);
  };
  const send = async () => {
    if (!draft.trim()) return;
    const r2 = await api("/api/jobs/" + jobId + "/messages", { method: "POST", body: { body: draft, mention_ids: mids } });
    setMsgs((x2) => [...x2, r2.message]);
    setDraft("");
    setMids([]);
    setQuery(null);
  };
  const renderBody = (msg) => {
    let parts = [msg.body];
    let mentions = [];
    try {
      mentions = JSON.parse(msg.mentions || "[]");
    } catch {
    }
    for (const mid of mentions) {
      const u2 = team.find((t2) => t2.id === mid);
      if (!u2) continue;
      const tag = "@" + u2.name;
      const next = [];
      for (const p2 of parts) {
        if (typeof p2 !== "string") {
          next.push(p2);
          continue;
        }
        const segs = p2.split(tag);
        segs.forEach((s, i) => {
          if (i > 0) next.push(/* @__PURE__ */ jsxRuntimeExports.jsxs("b", { className: "mention", children: [
            "@",
            u2.name
          ] }, mid + i));
          if (s) next.push(s);
        });
      }
      parts = next;
    }
    return parts;
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chatBox", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chatMsgs", ref: boxRef, children: [
      msgs.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { margin: 4 }, children: "No team messages yet. Coordinate the crew here — type @ to tag someone; they'll get a bell notification." }),
      msgs.map((msg) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chatMsg", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { u: { name: msg.user_name, avatar_url: msg.user_avatar }, size: 28 }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chatMain", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chatHead", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: msg.user_name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: dt(msg.created_at) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "chatBody", children: renderBody(msg) })
        ] })
      ] }, msg.id))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chatComposer", children: [
      query !== null && candidates.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mentionPicker", children: candidates.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: () => pick(u2), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { u: u2, size: 22 }),
        " ",
        u2.name,
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: u2.role })
      ] }, u2.id)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: draft, onChange: (e) => onType(e.target.value), onKeyDown: (e) => {
        if (e.key === "Enter") send();
      }, placeholder: "Message the team on this job… type @ to tag" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: send, children: "Send" })
    ] })
  ] });
}
function ProfileModal({ user, close, onSaved }) {
  const [name, setName] = reactExports.useState(user.name || "");
  const [avatar, setAvatar] = reactExports.useState(user.avatar_url || null);
  const [cur, setCur] = reactExports.useState("");
  const [next, setNext] = reactExports.useState("");
  const [msg, setMsg] = reactExports.useState("");
  const [err, setErr] = reactExports.useState("");
  const onPhoto = (f2) => {
    const rd2 = new FileReader();
    rd2.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = 160;
        const x2 = c.getContext("2d");
        const s = Math.min(img.width, img.height);
        x2.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
        setAvatar(c.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(rd2.result);
    };
    rd2.readAsDataURL(f2);
  };
  const save = async () => {
    setErr("");
    try {
      const r2 = await api("/api/users/me", { method: "PATCH", body: { name, avatar_url: avatar } });
      onSaved(r2.user);
      setMsg("Profile saved ✓");
    } catch (e) {
      setErr(e.message);
    }
  };
  const savePw = async () => {
    setErr("");
    try {
      await api("/api/users/me/password", { method: "POST", body: { current: cur, next } });
      setCur("");
      setNext("");
      setMsg("Password changed ✓");
    } catch (e) {
      setErr(e.message);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", style: { maxWidth: 460 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: 0 }, children: "Your profile" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: close, children: "✕ Close" })
    ] }),
    err && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: err }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "okbox", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { gap: 14, marginTop: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { u: { name, avatar_url: avatar }, size: 64 }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "btn ghost small", style: { cursor: "pointer" }, children: [
          "📷 Change photo",
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "file", accept: "image/*", hidden: true, onChange: (e) => {
            var _a;
            return ((_a = e.target.files) == null ? void 0 : _a[0]) && onPhoto(e.target.files[0]);
          } })
        ] }),
        avatar && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setAvatar(null), children: "Remove" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { margin: "6px 0 0", fontSize: 12 }, children: "Square-cropped automatically. Shows next to your name everywhere — chat, approvals, activity." })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Your name" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: name, onChange: (e) => setName(e.target.value) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Email" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: user.email, disabled: true }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { gap: 10, marginTop: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", style: { background: "#e7f6ec", color: "#14532d" }, children: user.role }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: user.workspace_name }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        "Approval limit: ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: user.role === "OWNER" ? "Unlimited (owner)" : user.approval_limit > 0 ? money(user.approval_limit) : "Set by role policy" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: save, children: "Save profile" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {
        });
        location.reload();
      }, children: "⏻ Sign out" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { marginTop: 20 }, children: "Change password" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Current password" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "password", value: cur, onChange: (e) => setCur(e.target.value) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "New password (8+ characters)" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "password", value: next, onChange: (e) => setNext(e.target.value) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", style: { marginTop: 10 }, onClick: savePw, children: "Change password" })
  ] }) });
}
function JobDetail({ id: id2, users, me: me2, priceBook, close, refresh, openLead }) {
  const [d, setD] = reactExports.useState(null);
  const [tab, setTab] = reactExports.useState("overview");
  const [msg, setMsg] = reactExports.useState("");
  const [co, setCo] = reactExports.useState({ delta_scope: "", delta_total: "" });
  const [sched, setSched] = reactExports.useState({ worker_name: "", work_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), note: "" });
  const [schedPick, setSchedPick] = reactExports.useState(null);
  const load = () => {
    api("/api/jobs/" + id2).then(setD).catch((e) => setMsg(e.message));
  };
  reactExports.useEffect(load, [id2]);
  reactExports.useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  if (!d) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", children: [
    "Loading job… ",
    msg
  ] }) });
  const j = d.job;
  const stageTo = async (st) => {
    if (st === "SCHEDULED") {
      const tmr = new Date(Date.now() + 864e5);
      setSchedPick({ date: j.scheduled_start ? String(j.scheduled_start).slice(0, 10) : tmr.toISOString().slice(0, 10), time: j.scheduled_start ? String(j.scheduled_start).slice(11, 16) : "09:00" });
      return;
    }
    await api(`/api/jobs/${id2}/stage`, { method: "POST", body: { to: st } });
    toast(`Job moved to ${st.replaceAll("_", " ")} ✓`);
    load();
    refresh && refresh();
  };
  const doSchedule = async () => {
    var _a;
    if (!schedPick) return;
    const r2 = await api(`/api/jobs/${id2}/stage`, { method: "POST", body: { to: "SCHEDULED", scheduled_start: `${schedPick.date}T${schedPick.time}:00` } });
    setSchedPick(null);
    toast(`🗓 Scheduled for ${schedPick.date} at ${schedPick.time} — crew synced to the Ops schedule${((_a = r2.scheduling) == null ? void 0 : _a.crew_scheduled) ? ` (${r2.scheduling.crew_scheduled} crew)` : ""}, timesheets ready for that week`);
    load();
    refresh && refresh();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { margin: 0 }, children: [
        j.service_requested,
        " — ",
        j.contact_name
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: close, children: "✕ Close" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "6px 0" }, children: [
      j.contact_phone || "",
      " ",
      j.contact_email ? "· " + j.contact_email : "",
      " · ",
      j.location || "",
      " · job value ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { color: "#14532d" }, children: money(j.value) }),
      " · labor ",
      money(j.labor_cost),
      " (",
      j.labor_pct ?? 0,
      "% of value)"
    ] }),
    d.origin && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "crumbs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "clickable", onClick: () => openLead && openLead(d.origin.lead_id), children: [
        "🎯 Lead: ",
        d.origin.service_requested || "originating lead"
      ] }),
      d.origin.proposal_id ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "clickable", onClick: () => openLead && openLead(d.origin.lead_id), children: [
        "→ 📄 Proposal ",
        money(d.origin.proposal_total),
        " · ",
        d.origin.proposal_status
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "→ no signed proposal (manual / legacy win)" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "→ 🔧 This job" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "path", children: JOB_STAGES.filter((st) => st !== "ON_HOLD" && st !== "CANCELLED").map((st) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `stage ${st === j.stage ? "cur" : ""}`, onClick: () => stageTo(st), children: st.replaceAll("_", " ") }, st)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { fontSize: 12 }, children: [
      "Click any stage — jobs move both ways. Current: ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: j.stage.replaceAll("_", " ") })
    ] }),
    j.scheduled_start && ["SCHEDULED", "IN_PROGRESS"].includes(j.stage) && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { fontSize: 13, margin: "2px 0 6px" }, children: [
      "🗓 ",
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        "Scheduled: ",
        String(j.scheduled_start).slice(0, 10),
        " · ",
        String(j.scheduled_start).slice(11, 16)
      ] }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "— on the Ops Console crew schedule that day, with timesheets for the week." })
    ] }),
    schedPick && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { background: "#f0fdf4", margin: "6px 0 10px" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "🗓 Schedule this job" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", value: schedPick.date, onChange: (e) => setSchedPick({ ...schedPick, date: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "time", value: schedPick.time, onChange: (e) => setSchedPick({ ...schedPick, time: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: doSchedule, children: "Schedule it →" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setSchedPick(null), children: "Cancel" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12, margin: "6px 0 0" }, children: "The job's crew lands on the Ops crew schedule for that day and the week's timesheets are created — one move, whole workflow." })
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "overview" ? "on" : "", onClick: () => setTab("overview"), children: "Overview & Paperwork" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "crew" ? "on" : "", onClick: () => setTab("crew"), children: "Crew & Time" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: tab === "schedule" ? "on" : "", onClick: () => setTab("schedule"), children: [
        "Schedule (",
        d.schedule.length,
        ")"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "feed" ? "on" : "", onClick: () => setTab("feed"), children: "Feed & Notes" })
    ] }),
    tab === "overview" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
          const r2 = await api(`/api/jobs/${id2}/packet`, { method: "POST", body: {} }).catch((e) => ({ error: e.message }));
          setMsg(r2.error ? "Packet failed: " + r2.error : `Job packet sent — status: ${r2.status}${r2.status === "test_mode" ? " (test mode: recorded, not delivered — add provider keys to go live)" : ""}`);
          load();
        }, children: "📦 Send job packet to customer" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: j.invoice_status, onChange: async (e) => {
          await api(`/api/jobs/${id2}`, { method: "PATCH", body: { invoice_status: e.target.value } });
          load();
        }, style: { width: 200 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "not_ready", children: "Invoice: not ready" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "ready", children: "Invoice: ready to send" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "sent", children: "Invoice: sent" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "paid", children: "Invoice: paid" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "Packet carries scope, schedule, and the paperwork list — “send it over” in one click." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "Paperwork checklist" }),
      d.documents.map((doc) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${doc.status === "received" ? "pass" : "fail"}`, children: doc.status === "received" ? "✓" : "✗" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
          doc.name,
          doc.required ? " (required)" : ""
        ] }),
        doc.status !== "received" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            const r2 = await api(`/api/documents/${doc.id}/chase`, { method: "POST", body: {} }).catch((e) => ({ error: e.message }));
            setMsg(r2.error ? "Chase failed: " + r2.error : `Chase email queued — status: ${r2.status}`);
          }, children: "Chase it" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            await api(`/api/documents/${doc.id}`, { method: "PATCH", body: { status: "received" } });
            load();
          }, children: "Mark received" })
        ] })
      ] }, doc.id)),
      d.documents.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No documents tracked for this job yet." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { style: { marginTop: 16 }, children: [
        "💬 Team chat ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { fontWeight: 400, fontSize: 12 }, children: "internal — customers never see this · @ tags notify" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(JobChat, { jobId: id2, me: me2, users }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { marginTop: 16 }, children: "Invoices" }),
      (d.invoices || []).map((inv) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: inv.number }),
          " · ",
          money(inv.total),
          " · ",
          inv.status,
          " · balance ",
          money(inv.balance),
          inv.due_at ? ` · due ${new Date(inv.due_at).toLocaleDateString()}` : ""
        ] }),
        inv.balance > 0 && inv.status !== "void" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "jpay-" + inv.id, type: "number", placeholder: "$", style: { width: 90 } }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            const v2 = Number(document.getElementById("jpay-" + inv.id).value);
            if (!(v2 > 0)) return;
            try {
              await api(`/api/invoices/${inv.id}/payments`, { method: "POST", body: { amount: v2 } });
              toast("Payment recorded ✓");
              load();
            } catch (e) {
              setMsg(e.message);
            }
          }, children: "Record payment" })
        ] })
      ] }, inv.id)),
      !(d.invoices || []).some((x2) => ["sent", "partially_paid"].includes(x2.status)) && j.stage !== "CANCELLED" && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn ghost small", onClick: async () => {
        try {
          await api(`/api/jobs/${j.id}/invoice`, { method: "POST", body: {} });
          toast("Invoice created ✓");
          load();
        } catch (e) {
          setMsg(e.message);
        }
      }, children: [
        "🧾 Create invoice (",
        money(j.value),
        ")"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "Change orders" }),
      d.change_orders.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "5px 0" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: money(c.delta_total) }),
        " — ",
        c.delta_scope,
        " · ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: c.status }),
        " ",
        c.status === "draft" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api(`/api/change-orders/${c.id}/status`, { method: "POST", body: { status: "approved" } });
          setMsg("Change order approved — added to the job value ✓");
          load();
        }, children: "Approve (adds to job value)" })
      ] }, c.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Scope change — e.g. extra boring location", value: co.delta_scope, onChange: (e) => setCo({ ...co, delta_scope: e.target.value }), style: { flex: 1 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", placeholder: "$ delta", style: { width: 110 }, value: co.delta_total, onChange: (e) => setCo({ ...co, delta_total: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", disabled: !co.delta_scope, onClick: async () => {
          await api(`/api/jobs/${id2}/change-orders`, { method: "POST", body: { delta_scope: co.delta_scope, delta_total: Number(co.delta_total) || 0 } });
          setCo({ delta_scope: "", delta_total: "" });
          load();
        }, children: "Add change order" })
      ] }),
      d.field_reports.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "Recent field reports" }),
        d.field_reports.slice(0, 5).map((f2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "4px 0" }, children: [
          "📋 ",
          f2.report_date,
          " — ",
          f2.manager || "worker",
          " · ",
          f2.status
        ] }, f2.id))
      ] })
    ] }),
    tab === "feed" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(FeedPanel, { type: "job", id: id2 }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: 16 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(NotesPanel, { type: "job", id: id2 }) })
    ] }),
    tab === "crew" && /* @__PURE__ */ jsxRuntimeExports.jsx(CrewTime, { lead: { id: j.lead_id, sector: j.sector, est_value: j.value, pm_id: j.pm_id }, users, reloadLead: load }),
    tab === "schedule" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      d.schedule.map((s2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "5px 0" }, children: [
        "🗓 ",
        s2.work_date,
        " — ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: s2.worker }),
        s2.note ? " · " + s2.note : ""
      ] }, s2.id)),
      d.schedule.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Nothing scheduled yet." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { list: "rosterNames2", placeholder: "Worker name (roster — no account needed)", value: sched.worker_name, onChange: (e) => setSched({ ...sched, worker_name: e.target.value }), style: { minWidth: 240 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", value: sched.work_date, onChange: (e) => setSched({ ...sched, work_date: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Note", value: sched.note, onChange: (e) => setSched({ ...sched, note: e.target.value }), style: { flex: 1 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", disabled: !sched.worker_name.trim(), onClick: async () => {
          const r2 = await api("/api/schedule", { method: "POST", body: { lead_id: j.lead_id, worker_name: sched.worker_name.trim(), work_date: sched.work_date, note: sched.note } }).catch((e) => ({ error: e.message }));
          if (r2.error) setMsg("Schedule failed: " + r2.error);
          else {
            setSched({ ...sched, worker_name: "", note: "" });
            load();
          }
        }, children: "Schedule" })
      ] })
    ] })
  ] }) });
}
function LogTimeModal({ close, done }) {
  const [leads, setLeads] = reactExports.useState([]);
  const [roster, setRoster] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const [f2, setF] = reactExports.useState({ lead_id: "", worker_name: "", entry_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), hours: "", note: "" });
  reactExports.useEffect(() => {
    api("/api/leads?paged=1&page=1&page_size=100&sort=recent").then((r2) => setLeads(r2.items || [])).catch(() => {
    });
    api("/api/workers").then(setRoster).catch(() => {
    });
  }, []);
  const save = async () => {
    if (!f2.lead_id || !f2.worker_name.trim() || !(Number(f2.hours) > 0)) return setMsg("Pick the job, type the worker's name, enter hours.");
    const r2 = await api("/api/time", { method: "POST", body: { lead_id: f2.lead_id, worker_name: f2.worker_name.trim(), entry_date: f2.entry_date, hours: Number(f2.hours), note: f2.note } }).catch((e) => ({ error: e.message }));
    if (r2.error) return setMsg("Failed: " + r2.error);
    setMsg(`Logged ${r2.entry.hours}h for ${r2.worker.name} — ${money(r2.entry.amount)}${r2.rated ? "" : " (no rate class — costed $0)"} ✓`);
    setF({ ...f2, hours: "", note: "" });
    done && done();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", style: { maxWidth: 520 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: 0 }, children: "⏱ Log time — 10 seconds" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: close, children: "✕ Close" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Worker = a name. If they're new, they're added to the roster as you type — no account, no seat." }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: msg.includes("✓") ? "ok" : "err", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Job / lead" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: f2.lead_id, onChange: (e) => setF({ ...f2, lead_id: e.target.value }), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Choose the job…" }),
      leads.map((l2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: l2.id, children: [
        l2.service_requested,
        " — ",
        l2.contact_name,
        " (",
        l2.state.replaceAll("_", " "),
        ")"
      ] }, l2.id))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Worker" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { list: "rosterNamesG", placeholder: "Type a name — new names join the roster", value: f2.worker_name, onChange: (e) => setF({ ...f2, worker_name: e.target.value }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("datalist", { id: "rosterNamesG", children: roster.filter((w2) => w2.active).map((w2) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: w2.name, children: w2.class_name || "" }, w2.id)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Date" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", value: f2.entry_date, onChange: (e) => setF({ ...f2, entry_date: e.target.value }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Hours" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", step: "0.25", value: f2.hours, onChange: (e) => setF({ ...f2, hours: e.target.value }), style: { width: 100 } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Note" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.note, onChange: (e) => setF({ ...f2, note: e.target.value }), placeholder: "Phase, task…" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 12 }, children: [
      [2, 4, 8].map((h) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn ghost small", onClick: () => setF({ ...f2, hours: String(h) }), children: [
        h,
        "h"
      ] }, h)),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: save, children: "Log time" })
    ] })
  ] }) });
}
function WorkersTab() {
  const [workers, setWorkers] = reactExports.useState([]);
  const [classes, setClasses] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const [nw, setNw] = reactExports.useState({ name: "", phone: "", labor_class_id: "" });
  const [bulk, setBulk] = reactExports.useState("");
  const load = () => {
    api("/api/workers").then(setWorkers).catch(() => {
    });
    api("/api/labor-classes").then(setClasses).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Workers — the roster" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "Everyone who works jobs, by name. Roster workers ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "never need logins and never use seats" }),
      " — seats are only for people who sign in. Team members appear here automatically (linked). Give each worker a labor class so their hours cost correctly."
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Name" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Phone" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Labor class" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Type" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Active" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", {})
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: workers.map((w2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: w2.name }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: w2.phone || /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "—" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: w2.labor_class_id || "", onChange: async (e) => {
          await api("/api/workers/" + w2.id, { method: "PATCH", body: { labor_class_id: e.target.value || null } });
          setMsg(`Class set for ${w2.name} ✓`);
          load();
        }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "— No class (hours cost $0) —" }),
          classes.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: c.id, children: [
            c.name,
            " (",
            money(c.private_rate),
            " priv · ",
            money(c.govt_rate),
            " govt)"
          ] }, c.id))
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: w2.linked_user_id ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: "team login" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", style: { background: "#fef9c3", color: "#854d0e" }, children: "roster only" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: w2.active ? "✓" : "—" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api("/api/workers/" + w2.id, { method: "PATCH", body: { active: !w2.active } });
          load();
        }, children: w2.active ? "Deactivate" : "Reactivate" }) })
      ] }, w2.id)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Worker name — e.g. Mike Torres", value: nw.name, onChange: (e) => setNw({ ...nw, name: e.target.value }), style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Phone (optional)", value: nw.phone, onChange: (e) => setNw({ ...nw, phone: e.target.value }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: nw.labor_class_id, onChange: (e) => setNw({ ...nw, labor_class_id: e.target.value }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Class…" }),
        classes.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: c.id, children: c.name }, c.id))
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", disabled: !nw.name.trim(), onClick: async () => {
        await api("/api/workers", { method: "POST", body: { name: nw.name.trim(), phone: nw.phone, labor_class_id: nw.labor_class_id || void 0 } });
        setNw({ name: "", phone: "", labor_class_id: "" });
        setMsg("Worker added ✓");
        load();
      }, children: "Add worker" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", style: { marginTop: 14 }, children: "Bulk add — paste names, one per line" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 3, value: bulk, onChange: (e) => setBulk(e.target.value), placeholder: "Carlos M.\nDerek W.\nSam R." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { marginTop: 6 }, disabled: !bulk.trim(), onClick: async () => {
      const r2 = await api("/api/workers/bulk", { method: "POST", body: { text: bulk } });
      setBulk("");
      setMsg(`${r2.created_or_found} workers on the roster ✓`);
      load();
    }, children: "Add all names" })
  ] });
}
function InboxRulesTab({ users }) {
  const [rules, setRules] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const [nr, setNr] = reactExports.useState({ name: "", match_field: "sender", match_value: "", action: "assign", action_value: "" });
  const load = () => {
    api("/api/inbox-rules").then(setRules).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Inbox rules — route the pile before it piles up" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "When mail matches, the rule applies immediately — including to the backlog already sitting there. Example: sender contains ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mono", children: "dec.ny.gov" }),
      " → assign to you, because regulatory mail can't wait."
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    rules.map((r2) => {
      var _a;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st pass", children: "✓" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: r2.name }),
          " — when ",
          r2.match_field,
          " contains “",
          r2.match_value,
          "” → ",
          r2.action.replaceAll("_", " "),
          r2.action === "assign" ? " to " + (((_a = users.find((u2) => u2.id === r2.action_value)) == null ? void 0 : _a.name) || "—") : r2.action === "snooze_days" ? " " + r2.action_value + "d" : ""
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api("/api/inbox-rules/" + r2.id, { method: "DELETE" });
          load();
        }, children: "Delete" })
      ] }, r2.id);
    }),
    rules.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No rules yet." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", style: { marginTop: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Rule name" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: nr.name, onChange: (e) => setNr({ ...nr, name: e.target.value }), placeholder: "DEC mail to me" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Match field" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: nr.match_field, onChange: (e) => setNr({ ...nr, match_field: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "sender", children: "Sender (name or email)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "subject", children: "Subject" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "body", children: "Subject or body" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "category", children: "Category" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Contains" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: nr.match_value, onChange: (e) => setNr({ ...nr, match_value: e.target.value }), placeholder: "dec.ny.gov" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Then" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: nr.action, onChange: (e) => setNr({ ...nr, action: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "assign", children: "Assign to…" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "mark_done", children: "Mark done (noise)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "snooze_days", children: "Snooze (days)" })
        ] })
      ] }),
      nr.action === "assign" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Assign to" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: nr.action_value, onChange: (e) => setNr({ ...nr, action_value: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Pick a person…" }),
          users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: u2.id, children: u2.name }, u2.id))
        ] })
      ] }),
      nr.action === "snooze_days" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Days" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", value: nr.action_value, onChange: (e) => setNr({ ...nr, action_value: e.target.value }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { marginTop: 10 }, disabled: !nr.match_value || nr.action === "assign" && !nr.action_value, onClick: async () => {
      const r2 = await api("/api/inbox-rules", { method: "POST", body: nr });
      setMsg(`Rule saved ✓ — applied to ${r2.applied_now} open item(s) right away`);
      setNr({ name: "", match_field: "sender", match_value: "", action: "assign", action_value: "" });
      load();
    }, children: "Save rule" })
  ] });
}
function TimeGridCard() {
  const [g, setG] = reactExports.useState(null);
  const [week, setWeek] = reactExports.useState("");
  const [edits, setEdits] = reactExports.useState({});
  const [msg, setMsg] = reactExports.useState("");
  const load = (w2) => {
    api("/api/time/grid" + (w2 ? "?week=" + w2 : "")).then((r2) => {
      setG(r2);
      setWeek(r2.week_of);
    }).catch(() => {
    });
  };
  reactExports.useEffect(() => {
    load();
  }, []);
  reactExports.useEffect(() => {
    const h = () => load();
    window.addEventListener("wp-ops", h);
    return () => window.removeEventListener("wp-ops", h);
  });
  if (!g) return null;
  const days = [...Array(7)].map((_, i) => new Date((/* @__PURE__ */ new Date(g.week_of + "T12:00:00")).getTime() + i * 864e5).toISOString().slice(0, 10));
  const cellVal = (workerId, leadId, date) => {
    const key = `${workerId}|${leadId}|${date}`;
    if (edits[key] !== void 0) return edits[key];
    const es = g.entries.filter((e) => e.worker_id === workerId && e.lead_id === leadId && e.entry_date === date);
    return es.length ? String(es.reduce((a, e) => a + e.hours, 0)) : "";
  };
  const jobIds = [...new Set(g.entries.map((e) => e.lead_id))];
  const save = async () => {
    const rows = [];
    for (const [key, v2] of Object.entries(edits)) {
      const [worker_id, lead_id, entry_date] = key.split("|");
      const hrs = Number(v2);
      const existing = g.entries.filter((e) => e.worker_id === worker_id && e.lead_id === lead_id && e.entry_date === entry_date).reduce((a, e) => a + e.hours, 0);
      if (hrs > existing) rows.push({ lead_id, worker_id, entry_date, hours: hrs - existing });
    }
    if (!rows.length) return setMsg("No new hours to save (the grid only adds — delete entries from the job to correct).");
    const r2 = await api("/api/time/grid", { method: "POST", body: { rows } });
    setMsg(`Saved ${r2.saved} entries ✓`);
    setEdits({});
    load(week);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Weekly time grid — office entry for the whole crew" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "Week of ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", value: week, onChange: (e) => load(e.target.value), style: { width: 160 } }),
      " · Rows = workers with hours this week, per job. Type hours into a cell and save — Friday entry for everyone in one pass."
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    jobIds.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No time logged this week yet — log from a job, the Queue, or the ⏱ Log time button, and the grid fills in." }),
    jobIds.map((jid) => {
      const job = g.jobs.find((x2) => x2.lead_id === jid);
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: 14 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
          (job == null ? void 0 : job.service_requested) || "Job",
          " — ",
          (job == null ? void 0 : job.contact_name) || ""
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Worker" }),
            days.map((d) => /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: d.slice(5) }, d)),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Total" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: g.workers.filter((w2) => g.entries.some((e) => e.lead_id === jid && e.worker_id === w2.id)).map((w2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: w2.name }),
            days.map((d) => /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", step: "0.25", style: { width: 62 }, value: cellVal(w2.id, jid, d), onChange: (e) => setEdits({ ...edits, [`${w2.id}|${jid}|${d}`]: e.target.value }) }) }, d)),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: days.reduce((a, d) => a + (Number(cellVal(w2.id, jid, d)) || 0), 0) }) })
          ] }, w2.id)) })
        ] })
      ] }, jid);
    }),
    jobIds.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: save, children: "Save grid additions" })
  ] });
}
function FeedPanel({ type, id: id2 }) {
  const [d, setD] = reactExports.useState(null);
  const [text, setText] = reactExports.useState("");
  const load = () => {
    api(`/api/feed/${type}/${id2}`).then(setD).catch(() => {
    });
  };
  reactExports.useEffect(load, [type, id2]);
  if (!d) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Loading feed…" });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Team feed — talk about this record, on the record" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        const r2 = await api(`/api/follow/${type}/${id2}`, { method: "POST", body: {} });
        setD({ ...d, following: r2.following });
      }, children: d.following ? "★ Following" : "☆ Follow" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12.5 }, children: "Followers and anyone you @mention (type @FirstName) get notified. This replaces the hallway conversation — it's on the record forever." }),
    (d.posts || []).map((p2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { borderBottom: "1px solid #eef2f7", padding: "8px 0" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: p2.user_name || "Teammate" }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { fontSize: 12 }, children: dt(p2.created_at) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { margin: "3px 0", whiteSpace: "pre-wrap" }, children: p2.body })
    ] }, p2.id)),
    (!d.posts || d.posts.length === 0) && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No posts yet." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 8 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Post an update… @mention to pull someone in", value: text, onChange: (e) => setText(e.target.value), style: { flex: 1 }, onKeyDown: (e) => {
        if (e.key === "Enter" && text.trim()) (async () => {
          const r2 = await api(`/api/feed/${type}/${id2}`, { method: "POST", body: { body: text.trim() } });
          setText("");
          setD({ ...d, posts: r2.posts });
        })();
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", disabled: !text.trim(), onClick: async () => {
        const r2 = await api(`/api/feed/${type}/${id2}`, { method: "POST", body: { body: text.trim() } });
        setText("");
        setD({ ...d, posts: r2.posts });
      }, children: "Post" })
    ] })
  ] });
}
function NotesPanel({ type, id: id2 }) {
  const [notes, setNotes] = reactExports.useState([]);
  const [body, setBody] = reactExports.useState("");
  const load = () => {
    api(`/api/notes?entity_type=${type}&entity_id=${id2}`).then(setNotes).catch(() => {
    });
  };
  reactExports.useEffect(load, [type, id2]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Notes" }),
    notes.map((n2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { borderBottom: "1px solid #eef2f7", padding: "7px 0" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: n2.title || "Note" }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", style: { fontSize: 12 }, children: [
        "· ",
        n2.user_name || "",
        " · ",
        dt(n2.created_at)
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { margin: "3px 0", whiteSpace: "pre-wrap" }, children: n2.body })
    ] }, n2.id)),
    notes.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No notes yet — gate codes, access quirks, who to ask for. Future-you says thanks." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Add a note…", value: body, onChange: (e) => setBody(e.target.value), style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", disabled: !body.trim(), onClick: async () => {
        await api("/api/notes", { method: "POST", body: { entity_type: type, entity_id: id2, body: body.trim() } });
        setBody("");
        load();
      }, children: "Add note" })
    ] })
  ] });
}
function CustomFieldsSection({ objectType, entityId, custom, reload }) {
  const [defs, setDefs] = reactExports.useState([]);
  const [vals, setVals] = reactExports.useState({});
  const [msg, setMsg] = reactExports.useState("");
  reactExports.useEffect(() => {
    api(`/api/custom-fields?object=${objectType}`).then((d) => {
      setDefs(d);
      setVals(Object.fromEntries(d.map((f2) => [f2.key, (custom || {})[f2.key] ?? ""])));
    }).catch(() => {
    });
  }, [objectType, entityId]);
  if (!defs.length) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Custom fields" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "formgrid", style: { marginTop: 8 }, children: defs.map((f2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: f2.label }),
      f2.field_type === "select" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: vals[f2.key] ?? "", onChange: (e) => setVals({ ...vals, [f2.key]: e.target.value }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "—" }),
        JSON.parse(f2.options || "[]").map((o) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: o, children: o }, o))
      ] }) : f2.field_type === "date" ? /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", value: vals[f2.key] ?? "", onChange: (e) => setVals({ ...vals, [f2.key]: e.target.value }) }) : f2.field_type === "number" ? /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", value: vals[f2.key] ?? "", onChange: (e) => setVals({ ...vals, [f2.key]: e.target.value }) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: vals[f2.key] ?? "", onChange: (e) => setVals({ ...vals, [f2.key]: e.target.value }) })
    ] }, f2.id)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { marginTop: 8 }, onClick: async () => {
      await api("/api/custom-values", { method: "POST", body: { object_type: objectType, entity_id: entityId, values: vals } });
      setMsg("Custom fields saved ✓");
      reload && reload();
    }, children: "Save custom fields" }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", style: { marginLeft: 8 }, children: msg })
  ] });
}
function Planner({ openLead, tabSignal }) {
  const [tab, setTab] = reactExports.useState("tasks");
  reactExports.useEffect(() => {
    if ((tabSignal == null ? void 0 : tabSignal.view) === "planner" && tabSignal.tab) setTab(tabSignal.tab);
  }, [tabSignal]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Planner" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Tasks and calendar together — what needs doing, and when. Click a day in the calendar to see its full agenda." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "tasks" ? "on" : "", onClick: () => setTab("tasks"), children: "Tasks" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "calendar" ? "on" : "", onClick: () => setTab("calendar"), children: "Calendar" })
    ] }),
    tab === "tasks" ? /* @__PURE__ */ jsxRuntimeExports.jsx(TasksApp, { openLead, embedded: true }) : /* @__PURE__ */ jsxRuntimeExports.jsx(CalendarView, { openLead, embedded: true })
  ] });
}
function Library({ openLead, openJob, openCustomer, tabSignal }) {
  const [tab, setTab] = reactExports.useState("notes");
  reactExports.useEffect(() => {
    if ((tabSignal == null ? void 0 : tabSignal.view) === "library" && tabSignal.tab) setTab(tabSignal.tab);
  }, [tabSignal]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Library" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Notes and files from every record, in one place." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "notes" ? "on" : "", onClick: () => setTab("notes"), children: "Notes" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: tab === "files" ? "on" : "", onClick: () => setTab("files"), children: "Files & Documents" })
    ] }),
    tab === "notes" ? /* @__PURE__ */ jsxRuntimeExports.jsx(NotesApp, { openLead, openJob, openCustomer, embedded: true }) : /* @__PURE__ */ jsxRuntimeExports.jsx(FilesApp, { openLead, openJob, embedded: true })
  ] });
}
function Customers({ openCustomer, tabSignal }) {
  const [ctab, setCtab] = reactExports.useState("customers");
  reactExports.useEffect(() => {
    if ((tabSignal == null ? void 0 : tabSignal.view) === "customers" && tabSignal.tab) setCtab(tabSignal.tab);
  }, [tabSignal]);
  const [rows, setRows] = reactExports.useState([]);
  const [q2, setQ] = reactExports.useState("");
  const [form, setForm] = reactExports.useState({ name: "", phone: "", email: "" });
  const load = () => {
    api("/api/accounts").then(setRows).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const list = rows.filter((a) => !q2 || (a.name + a.email).toLowerCase().includes(q2.toLowerCase()));
  if (ctab === "people") return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Customers & People" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "", onClick: () => setCtab("customers"), children: "Customers" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "on", onClick: () => setCtab("people"), children: "People" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(People, { embedded: true })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Customers & People" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "tabs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "on", onClick: () => setCtab("customers"), children: "Customers" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "", onClick: () => setCtab("people"), children: "People" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Every company you've won (or are building a relationship with) — leads convert into customers automatically when they sign. Lifetime value is real job value, not estimates." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Search customers…", value: q2, onChange: (e) => setQ(e.target.value), style: { maxWidth: 300 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        list.length,
        " customers · ",
        money(list.reduce((a, x2) => a + (x2.lifetime_value || 0), 0)),
        " lifetime value"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", style: { padding: 6 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Customer" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "People" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Leads" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Jobs" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Lifetime value" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Since" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
        list.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "clickable", onClick: () => openCustomer(a.id), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: a.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: a.email || a.phone || "" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: a.people_count }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: a.leads_count }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: a.jobs_count }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: money(a.lifetime_value) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: dOnly(a.created_at) })
        ] }, a.id)),
        list.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 6, className: "muted", children: "No customers yet — win a lead and it converts here automatically, or add one below." }) })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Add a customer manually" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Company / customer name", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), style: { flex: 1 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Phone", value: form.phone, onChange: (e) => setForm({ ...form, phone: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", disabled: !form.name.trim(), onClick: async () => {
          await api("/api/accounts", { method: "POST", body: form });
          setForm({ name: "", phone: "", email: "" });
          load();
        }, children: "Add customer" })
      ] })
    ] })
  ] });
}
function CustomerDetail({ id: id2, close, openLead, openJob }) {
  const [d, setD] = reactExports.useState(null);
  const load = () => {
    api("/api/accounts/" + id2).then(setD).catch(() => {
    });
  };
  reactExports.useEffect(load, [id2]);
  reactExports.useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  if (!d) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal", children: "Loading customer…" }) });
  const a = d.account;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: 0 }, children: a.name }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: close, children: "✕ Close" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "6px 0" }, children: [
      a.phone || "",
      " ",
      a.email ? "· " + a.email : "",
      " ",
      a.address ? "· " + a.address : "",
      " · customer since ",
      dOnly(a.created_at),
      " · ",
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { style: { color: "#14532d" }, children: [
        "lifetime value ",
        money(d.lifetime_value)
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Phone" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { defaultValue: a.phone || "", id: "ca_phone" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Email" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { defaultValue: a.email || "", id: "ca_email" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Industry / type" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { defaultValue: a.industry || "", id: "ca_ind" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Website" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { defaultValue: a.website || "", id: "ca_web" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { marginTop: 8 }, onClick: async () => {
      await api("/api/accounts/" + id2, { method: "PATCH", body: { phone: document.getElementById("ca_phone").value, email: document.getElementById("ca_email").value, industry: document.getElementById("ca_ind").value, website: document.getElementById("ca_web").value } });
      load();
    }, children: "Save customer details" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
      "People at this customer (",
      d.contacts.length,
      ")"
    ] }),
    d.contacts.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "4px 0" }, children: [
      "👤 ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: c.name }),
      " ",
      c.title ? "· " + c.title : "",
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        c.phone || "",
        " ",
        c.email || ""
      ] })
    ] }, c.id)),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
      "Jobs (",
      d.jobs.length,
      ")"
    ] }),
    d.jobs.map((j) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "4px 0" }, className: "clickable", onClick: () => openJob(j.id), children: [
      "🔧 ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: j.service_requested }),
      " — ",
      money(j.value),
      " · ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: j.stage.replaceAll("_", " ") })
    ] }, j.id)),
    d.jobs.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No jobs yet." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
      "Lead history (",
      d.leads.length,
      ")"
    ] }),
    d.leads.map((l2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "4px 0" }, className: "clickable", onClick: () => openLead(l2.id), children: [
      "🎯 ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: l2.service_requested }),
      " — ",
      money(l2.est_value),
      " · ",
      /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { s: l2.state })
    ] }, l2.id)),
    (d.timeline || []).length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "History — the whole relationship" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { maxHeight: 300, overflowY: "auto" }, children: (d.timeline || []).map((t2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "4px 0", fontSize: 13 }, className: t2.lead_id ? "clickable" : "", onClick: () => {
        if (t2.job_id && openJob) openJob(t2.job_id);
        else if (t2.lead_id) openLead(t2.lead_id);
      }, children: [
        t2.icon,
        " ",
        t2.text,
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
          "· ",
          new Date(t2.at).toLocaleDateString()
        ] })
      ] }, i)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
      "Proposals (",
      (d.proposals || []).length,
      ") · ",
      money((d.money360 || {}).proposals_value || 0),
      " proposed (current versions) · ",
      money((d.money360 || {}).signed_value || 0),
      " signed · ",
      money((d.money360 || {}).outstanding || 0),
      " uncollected contract value"
    ] }),
    (d.proposals || []).map((p2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "4px 0" }, className: "clickable", onClick: () => openLead(p2.lead_id), children: [
      "📄 ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: p2.service_requested }),
      " — ",
      money(p2.total),
      " · ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: p2.status }),
      p2.sent_at ? " · sent " + dOnly(p2.sent_at) : "",
      p2.signed_at ? " · ✍️ signed " + dOnly(p2.signed_at) : "",
      " →"
    ] }, p2.id)),
    (d.proposals || []).length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No proposals yet." }),
    (d.invoices || []).length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
        "Invoices (",
        (d.invoices || []).length,
        ") · ",
        money((d.money360 || {}).invoiced || 0),
        " invoiced · ",
        money((d.money360 || {}).ar_outstanding || 0),
        " receivable",
        (d.money360 || {}).ar_overdue > 0 ? ` · ${money(d.money360.ar_overdue)} OVERDUE` : ""
      ] }),
      (d.invoices || []).map((i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "4px 0", fontSize: 13 }, children: [
        i.number,
        " · ",
        money(i.total),
        " · ",
        i.status,
        i.paid_amount > 0 ? ` · ${money(i.paid_amount)} paid` : "",
        i.due_at ? ` · due ${new Date(i.due_at).toLocaleDateString()}` : ""
      ] }, i.id))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
      "Payments · ",
      money((d.money360 || {}).collected || 0),
      " collected",
      (d.money360 || {}).refunded ? " · " + money(d.money360.refunded) + " refunded" : "",
      " · net ",
      money((d.money360 || {}).net_collected || 0)
    ] }),
    (d.payments || []).map((p2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "4px 0" }, className: "clickable", onClick: () => p2.lead_id && openLead(p2.lead_id), children: [
      p2.kind === "refund" ? "↩️" : "💳",
      " ",
      money(p2.amount),
      " · ",
      p2.kind,
      " · ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: p2.status }),
      " · ",
      dOnly(p2.created_at),
      " →"
    ] }, p2.id)),
    (d.payments || []).length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No payments recorded." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
      "Documents (",
      (d.documents || []).length,
      ")"
    ] }),
    (d.documents || []).map((doc) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { style: { margin: "4px 0" }, className: "clickable", onClick: () => {
      if (doc.job_id && openJob) openJob(doc.job_id);
      else if (doc.lead_id) openLead(doc.lead_id);
    }, children: [
      "📎 ",
      doc.name,
      " · ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: doc.status }),
      doc.expires_at ? " · expires " + dOnly(doc.expires_at) : "",
      " →"
    ] }, doc.id)),
    (d.documents || []).length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No documents on file." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: 14 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(FeedPanel, { type: "account", id: id2 }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(CustomFieldsSection, { objectType: "account", entityId: id2, custom: a.custom, reload: load })
  ] }) });
}
function People({ embedded }) {
  const [rows, setRows] = reactExports.useState([]);
  const [accounts, setAccounts] = reactExports.useState([]);
  const [q2, setQ] = reactExports.useState("");
  const [form, setForm] = reactExports.useState({ name: "", phone: "", email: "", title: "", account_id: "" });
  const load = () => {
    api("/api/people").then(setRows).catch(() => {
    });
    api("/api/accounts").then(setAccounts).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const list = rows.filter((p2) => !q2 || (p2.name + p2.email + (p2.account_name || "")).toLowerCase().includes(q2.toLowerCase()));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    !embedded && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "People" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Every contact across customers and leads — the person behind the company." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Search people…", value: q2, onChange: (e) => setQ(e.target.value), style: { maxWidth: 300, marginBottom: 10 } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", style: { padding: 6 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Name" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Title" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Customer" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Phone" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Email" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Leads" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
        list.map((p2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: p2.name }),
            p2.is_customer ? " ⭐" : ""
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: p2.title || "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: p2.account_name || /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: "—" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: p2.phone || "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: p2.email || "—" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: p2.leads_count })
        ] }, p2.id)),
        list.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 6, className: "muted", children: "No people match." }) })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Add a person" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Name", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Title (Facilities Director…)", value: form.title, onChange: (e) => setForm({ ...form, title: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Phone", value: form.phone, onChange: (e) => setForm({ ...form, phone: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: form.account_id, onChange: (e) => setForm({ ...form, account_id: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Customer…" }),
          accounts.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: a.id, children: a.name }, a.id))
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", disabled: !form.name.trim(), onClick: async () => {
          await api("/api/people", { method: "POST", body: { ...form, account_id: form.account_id || void 0 } });
          setForm({ name: "", phone: "", email: "", title: "", account_id: "" });
          load();
        }, children: "Add" })
      ] })
    ] })
  ] });
}
function Campaigns({ openLead }) {
  const [rows, setRows] = reactExports.useState([]);
  const [openId, setOpenId] = reactExports.useState("");
  const [detail, setDetail] = reactExports.useState(null);
  const [leads, setLeads] = reactExports.useState([]);
  const [pick, setPick] = reactExports.useState([]);
  const [form, setForm] = reactExports.useState({ name: "", type: "outreach", cost: "" });
  const load = () => {
    api("/api/campaigns").then(setRows).catch(() => {
    });
  };
  reactExports.useEffect(() => {
    load();
    api("/api/leads?paged=1&page=1&page_size=100&sort=recent").then((r2) => setLeads(r2.items || [])).catch(() => {
    });
  }, []);
  const expand = async (c) => {
    if (openId === c.id) {
      setOpenId("");
      return;
    }
    setOpenId(c.id);
    setDetail(await api("/api/campaigns/" + c.id).catch(() => null));
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Campaigns" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Where leads come from, what they cost, and what they returned. ROI = (won revenue − cost) ÷ cost, from real won values." }),
    rows.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginBottom: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 16 }, children: c.name }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: c.type }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: c.status }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
            c.stats.members,
            " members · ",
            c.stats.leads,
            " leads · ",
            c.stats.won,
            " won · pipeline ",
            money(c.stats.pipeline),
            " · revenue ",
            money(c.stats.revenue),
            " · cost ",
            money(c.cost),
            c.stats.roi_pct !== null ? ` · ROI ${c.stats.roi_pct}%` : ""
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => expand(c), children: openId === c.id ? "Hide" : "Members" })
      ] }),
      openId === c.id && detail && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 10 }, children: [
        detail.members.map((m2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #eef2f7" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1, minWidth: 0 }, className: "clickable", onClick: () => openLead(m2.lead_id), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: m2.contact_name }),
            " — ",
            m2.service_requested,
            " · ",
            money(m2.est_value),
            " · ",
            /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { s: m2.state })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { style: { width: 148 }, value: m2.status, onChange: async (e) => {
            await api("/api/campaign-members/" + m2.id, { method: "PATCH", body: { status: e.target.value } });
            setDetail(await api("/api/campaigns/" + c.id));
          }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "member", children: "member" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "responded", children: "responded" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "engaged", children: "engaged" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "converted", children: "converted" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            await api("/api/campaign-members/" + m2.id, { method: "DELETE" });
            setDetail(await api("/api/campaigns/" + c.id));
            load();
          }, children: "Remove" })
        ] }, m2.id)),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("select", { multiple: true, size: 4, style: { flex: 1 }, value: pick, onChange: (e) => setPick([...e.target.selectedOptions].map((o) => o.value)), children: leads.filter((l2) => !detail.members.some((m2) => m2.lead_id === l2.id)).map((l2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: l2.id, children: [
            l2.contact_name,
            " — ",
            l2.service_requested,
            " (",
            l2.state,
            ")"
          ] }, l2.id)) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn small", disabled: !pick.length, onClick: async () => {
            await api(`/api/campaigns/${c.id}/members`, { method: "POST", body: { lead_ids: pick } });
            setPick([]);
            setDetail(await api("/api/campaigns/" + c.id));
            load();
          }, children: [
            "Add ",
            pick.length || "",
            " leads"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12 }, children: "Tip: leads created through the API with a campaign_id join automatically." })
      ] })
    ] }, c.id)),
    rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", children: "No campaigns yet — create the first one below (e.g. “Lapsed clients — fall reactivation”, “Google Ads — tank removals”)." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "New campaign" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Campaign name", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), style: { flex: 1 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: form.type, onChange: (e) => setForm({ ...form, type: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "outreach" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "ads" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "referral" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "event" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "email" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "reactivation" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", placeholder: "Cost $", value: form.cost, onChange: (e) => setForm({ ...form, cost: e.target.value }), style: { width: 120 } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", disabled: !form.name.trim(), onClick: async () => {
          await api("/api/campaigns", { method: "POST", body: { ...form, cost: Number(form.cost) || 0 } });
          setForm({ name: "", type: "outreach", cost: "" });
          load();
        }, children: "Create campaign" })
      ] })
    ] })
  ] });
}
function TasksApp({ openLead, embedded }) {
  const [f2, setF] = reactExports.useState("open");
  const [rows, setRows] = reactExports.useState([]);
  const load = () => {
    api(`/api/tasks-all?filter=${f2}`).then(setRows).catch(() => {
    });
  };
  reactExports.useEffect(load, [f2]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    !embedded && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Tasks" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Every open promise across every record — not buried inside leads." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { marginBottom: 10 }, children: [["mine", "Mine"], ["open", "All open"], ["overdue", "Overdue"], ["done", "Done"]].map(([k2, l2]) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: `chip ${f2 === k2 ? "on" : ""}`, onClick: () => setF(k2), children: l2 }, k2)) }),
    rows.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: "9px 14px", marginBottom: 7, display: "flex", gap: 10, alignItems: "center" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, className: "clickable", onClick: () => t2.lead_id && openLead(t2.lead_id), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: t2.title }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
          t2.contact_name || "",
          " — ",
          t2.service_requested || "",
          " · ",
          t2.assignee_name || "unassigned",
          " · due ",
          dOnly(t2.due_at),
          t2.due_at && t2.due_at < (/* @__PURE__ */ new Date()).toISOString() && t2.status === "open" ? " · ⚠ overdue" : ""
        ] })
      ] }),
      t2.status === "open" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          const r2 = prompt("Snooze until tomorrow — why? (recorded on the task)");
          if (r2 === null) return;
          await api(`/api/tasks/${t2.id}/snooze`, { method: "POST", body: { reason: r2 } });
          load();
        }, children: "💤 Snooze" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api(`/api/tasks/${t2.id}/complete`, { method: "POST", body: {} });
          load();
        }, children: "✓ Done" })
      ] }),
      t2.status === "done" && t2.completion_reason ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "tiny muted", children: [
        "reason: ",
        t2.completion_reason
      ] }) : null
    ] }, t2.id)),
    rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", style: { textAlign: "center", padding: 26 }, children: "Nothing here. 🎉" })
  ] });
}
function CalendarView({ openLead, embedded }) {
  const [cur, setCur] = reactExports.useState(() => {
    const d = /* @__PURE__ */ new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [evs, setEvs] = reactExports.useState([]);
  const [sel, setSel] = reactExports.useState(() => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  const [kindF, setKindF] = reactExports.useState("all");
  const [showDone, setShowDone] = reactExports.useState(true);
  reactExports.useEffect(() => {
    const from = new Date(cur.getFullYear(), cur.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).toISOString().slice(0, 10);
    api(`/api/calendar?from=${from}&to=${to}&done=1`).then(setEvs).catch(() => {
    });
  }, [cur]);
  const y2 = cur.getFullYear(), m2 = cur.getMonth();
  const first = new Date(y2, m2, 1).getDay();
  const days = new Date(y2, m2 + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...[...Array(days)].map((_, i) => i + 1)];
  const dstr = (d) => `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const KINDS = { task: ["✅", "Task"], task_done: ["☑️", "Task done"], callback: ["📞", "Callback"], schedule: ["👷", "Crew on site"], followup: ["🔁", "Follow-up"], visit: ["📍", "Site visit"], job: ["🛠", "Job starts"] };
  const visible = evs.filter((e) => (showDone || e.kind !== "task_done") && (kindF === "all" || e.kind === kindF || kindF === "task" && e.kind === "task_done"));
  const byDay = (d) => visible.filter((e) => e.date === dstr(d));
  const dayList = visible.filter((e) => e.date === sel).sort((a, b) => {
    var _a, _b;
    return (((_a = KINDS[a.kind]) == null ? void 0 : _a[1]) || "").localeCompare(((_b = KINDS[b.kind]) == null ? void 0 : _b[1]) || "");
  });
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const counts = (k2) => evs.filter((e) => k2 === "all" || e.kind === k2 || k2 === "task" && e.kind === "task_done").length;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    !embedded && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Calendar" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "sub", children: [
        "Everything dated in the business — tasks, callbacks, crew schedule, follow-ups, site visits. ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Click a day to see its full agenda" }),
        "; open records from the agenda, never by accident."
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setCur(new Date(y2, m2 - 1, 1)), children: "← Prev" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 16 }, children: cur.toLocaleDateString(void 0, { month: "long", year: "numeric" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setCur(new Date(y2, m2 + 1, 1)), children: "Next →" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => {
        const t2 = /* @__PURE__ */ new Date();
        setCur(new Date(t2.getFullYear(), t2.getMonth(), 1));
        setSel(todayStr);
      }, children: "Today" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
        visible.length,
        " items shown"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "muted", style: { fontSize: 12.5 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", style: { width: "auto" }, checked: showDone, onChange: (e) => setShowDone(e.target.checked) }),
        " Show completed"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { marginBottom: 10 }, children: [["all", "All"], ["task", "Tasks"], ["callback", "Callbacks"], ["schedule", "Crew"], ["followup", "Follow-ups"], ["visit", "Visits"]].map(([k2, l2]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: `chip ${kindF === k2 ? "on" : ""}`, onClick: () => setKindF(k2), children: [
      l2,
      " (",
      counts(k2),
      ")"
    ] }, k2)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }, children: [
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "muted", style: { fontSize: 12, textAlign: "center" }, children: d }, d)),
      cells.map((d, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { onClick: () => d && setSel(dstr(d)), style: { minHeight: 92, background: d ? sel === dstr(d) ? "#f0fdf4" : "#fff" : "transparent", border: d ? "1px solid #e5e7eb" : "none", borderRadius: 8, padding: 5, cursor: d ? "pointer" : "default", outline: d && sel === dstr(d) ? "2px solid #166534" : d && dstr(d) === todayStr ? "2px solid #94a3b8" : "none" }, children: d && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { style: { fontSize: 12 }, children: [
          d,
          dstr(d) === todayStr ? " · today" : ""
        ] }),
        byDay(d).slice(0, 3).map((e) => {
          var _a;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: 11, background: e.kind === "task_done" ? "#f1f5f9" : "#f0fdf4", color: e.kind === "task_done" ? "#64748b" : "inherit", textDecoration: e.kind === "task_done" ? "line-through" : "none", borderRadius: 5, padding: "2px 4px", marginTop: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }, title: e.title + " — " + e.sub, children: [
            ((_a = KINDS[e.kind]) == null ? void 0 : _a[0]) || "•",
            " ",
            e.title
          ] }, e.id);
        }),
        byDay(d).length > 3 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "muted", style: { fontSize: 11 }, children: [
          "+",
          byDay(d).length - 3,
          " more — click the day"
        ] })
      ] }) }, i))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { style: { marginTop: 0 }, children: [
        "📋 Agenda — ",
        (/* @__PURE__ */ new Date(sel + "T12:00:00")).toLocaleDateString(void 0, { weekday: "long", month: "long", day: "numeric" }),
        " (",
        dayList.length,
        ")"
      ] }),
      dayList.map((e) => {
        var _a, _b;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eef2f7" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "calIc", children: ((_a = KINDS[e.kind]) == null ? void 0 : _a[0]) || "•" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { textDecoration: e.kind === "task_done" ? "line-through" : "none" }, children: e.title }),
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tinyBadge", children: ((_b = KINDS[e.kind]) == null ? void 0 : _b[1]) || e.kind }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: e.sub })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "calAct", children: [
            e.kind === "task" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
              await api(`/api/tasks/${e.id.slice(4)}/complete`, { method: "POST", body: {} });
              const from = new Date(cur.getFullYear(), cur.getMonth(), 1).toISOString().slice(0, 10);
              const to = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).toISOString().slice(0, 10);
              api(`/api/calendar?from=${from}&to=${to}&done=1`).then(setEvs).catch(() => {
              });
            }, children: "✓ Done" }),
            e.lead_id && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: () => openLead(e.lead_id), children: "Open record →" })
          ] })
        ] }, e.id);
      }),
      dayList.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
        "Nothing scheduled this day",
        kindF !== "all" ? " for this filter" : "",
        ". Click any other day to see its agenda."
      ] })
    ] })
  ] });
}
function NotesApp({ openLead, openJob, openCustomer, embedded }) {
  const [rows, setRows] = reactExports.useState([]);
  const load = () => {
    api("/api/notes").then(setRows).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  const open = (n2) => {
    if (!n2.entity_id) return;
    if (n2.entity_type === "lead") openLead(n2.entity_id);
    else if (n2.entity_type === "job") openJob(n2.entity_id);
    else if (n2.entity_type === "account") openCustomer(n2.entity_id);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    !embedded && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Notes" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Every note on every record, in one place." })
    ] }),
    rows.map((n2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { padding: "10px 14px", marginBottom: 8 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: n2.title || "Note" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", style: { fontSize: 12 }, children: [
          n2.user_name || "",
          " · ",
          dt(n2.created_at)
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { margin: "4px 0", whiteSpace: "pre-wrap" }, children: n2.body }),
      n2.entity_id && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn ghost small", onClick: () => open(n2), children: [
        "Open: ",
        n2.entity_label
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        await api("/api/notes/" + n2.id, { method: "DELETE" });
        load();
      }, children: "Delete" })
    ] }, n2.id)),
    rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", children: "No notes yet — add them from any record's Feed tab." })
  ] });
}
function FilesApp({ openLead, openJob, embedded }) {
  const [rows, setRows] = reactExports.useState([]);
  const [f2, setF] = reactExports.useState("all");
  reactExports.useEffect(() => {
    api("/api/files").then(setRows).catch(() => {
    });
  }, []);
  const list = rows.filter((x2) => f2 === "all" || x2.status === f2);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    !embedded && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Files & Documents" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Paperwork across every lead and job — what's in, what's missing, in one list." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", style: { marginBottom: 10 }, children: [["all", "All"], ["missing", "Missing"], ["received", "Received"]].map(([k2, l2]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: `chip ${f2 === k2 ? "on" : ""}`, onClick: () => setF(k2), children: [
      l2,
      " (",
      k2 === "all" ? rows.length : rows.filter((x2) => x2.status === k2).length,
      ")"
    ] }, k2)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", style: { padding: 6 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Document" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "For" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Kind" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Status" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", {})
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
        list.map((x2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: x2.name }),
            x2.required ? " (required)" : ""
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
            x2.contact_name || "",
            " — ",
            x2.service_requested || ""
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: x2.kind }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${x2.status === "received" ? "pass" : "fail"}`, children: x2.status }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: x2.job_id ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => openJob(x2.job_id), children: "Open job" }) : x2.lead_id ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => openLead(x2.lead_id), children: "Open lead" }) : null })
        ] }, x2.id + x2.kind)),
        list.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 5, className: "muted", children: "Nothing here." }) })
      ] })
    ] }) })
  ] });
}
function MergesHistory({ load }) {
  const [merges, setMerges] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const loadM = () => {
    api("/api/duplicates/merges").then(setMerges).catch(() => {
    });
  };
  reactExports.useEffect(loadM, []);
  if (!merges.length) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Recent merges — reversible" }),
    merges.map((m2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { padding: "5px 0", borderBottom: "1px solid #eef2f7" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        "Merged into ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: m2.survivor_name || "survivor" }),
        " · ",
        dt(m2.created_at)
      ] }),
      m2.reversed_at ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "chip", children: [
        "reversed ",
        dt(m2.reversed_at)
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        if (!confirm("Reverse this merge? The duplicate lead comes back in its pre-merge state; anything moved after the merge stays with the survivor.")) return;
        const r2 = await api(`/api/duplicates/merges/${m2.id}/reverse`, { method: "POST", body: {} });
        setMsg(r2.note);
        loadM();
        load();
      }, children: "Reverse merge" })
    ] }, m2.id)),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", style: { marginTop: 8 }, children: msg })
  ] });
}
function DuplicatesView({ embedded }) {
  const [groups, setGroups] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const load = () => {
    api("/api/duplicates").then(setGroups).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    !embedded && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "pt", children: "Duplicates" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "sub", children: "Same phone or email on more than one lead. Merge keeps the oldest record as the survivor and moves everything — tasks, proposals, documents, time, history — onto it. The duplicate closes as DUPLICATE and disappears from lists (Salesforce-style)." })
    ] }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    groups.map((g) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginBottom: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
        g.count,
        " leads"
      ] }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "chip", style: { background: g.match_type === "exact" ? "#e7f6ec" : "#fdf3e0", color: g.match_type === "exact" ? "#157347" : "#9a6a00", fontWeight: 700 }, children: [
        g.match_type === "exact" ? "Exact identity" : "Candidate",
        " · ",
        Math.round((g.confidence ?? 0.99) * 100),
        "% match"
      ] }),
      " ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tiny muted", children: (g.signals || ["shared key"]).join(", ") }),
      g.leads.map((l2, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { padding: "6px 0", borderBottom: "1px solid #eef2f7" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: l2.contact_name }),
          " — ",
          l2.service_requested,
          " · ",
          money(l2.est_value),
          " · ",
          /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { s: l2.state }),
          " · since ",
          dOnly(l2.created_at),
          i === 0 ? " · ⭐ survivor (oldest)" : "",
          /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "tiny muted", children: [
            "📞 ",
            l2.contact_phone || "—",
            " · ✉️ ",
            l2.contact_email || "—",
            l2.location ? ` · 📍 ${l2.location}` : ""
          ] })
        ] }),
        i > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: async () => {
          if (!confirm(`Merge this lead into "${g.leads[0].contact_name} — ${g.leads[0].service_requested}"? Everything moves; this copy closes as a duplicate.`)) return;
          await api(`/api/leads/${l2.id}/merge`, { method: "POST", body: { into_id: g.leads[0].id } });
          setMsg("Merged ✓ — history consolidated on the survivor");
          load();
        }, children: "Merge into survivor" })
      ] }, l2.id))
    ] }, g.key)),
    /* @__PURE__ */ jsxRuntimeExports.jsx(MergesHistory, { load }),
    groups.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "card", style: { textAlign: "center", padding: 26 }, children: "No duplicate groups. The database is clean. 🎉" })
  ] });
}
function ReportBuilder() {
  const [cfg, setCfg] = reactExports.useState({ object_type: "leads", group_by: "state", metric: "count" });
  const [rows, setRows] = reactExports.useState([]);
  const [ran, setRan] = reactExports.useState(false);
  const run = async (c = cfg) => {
    const r2 = await api("/api/reports/build", { method: "POST", body: c });
    setRows(r2.rows || []);
    setRan(true);
  };
  reactExports.useEffect(() => {
    run();
  }, []);
  const max = Math.max(1, ...rows.map((r2) => cfg.metric === "value" ? r2.value : r2.count));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Report builder — group anything, pin it to the Dashboard" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: cfg.object_type, onChange: (e) => {
        const c = { ...cfg, object_type: e.target.value };
        setCfg(c);
        run(c);
      }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "leads", children: "Leads" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "jobs", children: "Jobs" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: cfg.group_by, onChange: (e) => {
        const c = { ...cfg, group_by: e.target.value };
        setCfg(c);
        run(c);
      }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "state", children: "Group: stage" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "source", children: "Group: source" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "owner", children: "Group: owner" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "service", children: "Group: service" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "month", children: "Group: month created" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "job_stage", children: "Group: job stage" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "sector", children: "Group: sector" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: cfg.metric, onChange: (e) => setCfg({ ...cfg, metric: e.target.value }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "count", children: "Metric: count" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "value", children: "Metric: $ value" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", onClick: () => run(), children: "Run" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        const t2 = prompt("Name this dashboard widget", `${cfg.object_type} by ${cfg.group_by}`);
        if (!t2) return;
        await api("/api/dashboard-pins", { method: "POST", body: { title: t2, ...cfg } });
        alert("Pinned to the Dashboard ✓");
      }, children: "📌 Pin to Dashboard" })
    ] }),
    ran && rows.map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 7 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 190, fontSize: 13 }, children: r2.key.replaceAll("_", " ") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { flex: 1, background: "#eef2f7", borderRadius: 6, height: 18 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: `${Math.max(3, (cfg.metric === "value" ? r2.value : r2.count) / max * 100)}%`, background: "#166534", height: 18, borderRadius: 6 } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { width: 130, textAlign: "right", fontSize: 13 }, children: cfg.metric === "value" ? money(r2.value) : `${num(r2.count)} · ${money(r2.value)}` })
    ] }, r2.key)),
    ran && rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No data for that grouping yet." })
  ] });
}
function DashboardPins() {
  const [pins, setPins] = reactExports.useState([]);
  const [data, setData] = reactExports.useState({});
  reactExports.useEffect(() => {
    api("/api/dashboard-pins").then(async (ps) => {
      setPins(ps);
      const d = {};
      for (const p2 of ps) {
        const r2 = await api("/api/reports/build", { method: "POST", body: { object_type: p2.object_type, group_by: p2.group_by, metric: p2.metric } }).catch(() => ({ rows: [] }));
        d[p2.id] = r2.rows || [];
      }
      setData(d);
    }).catch(() => {
    });
  }, []);
  if (!pins.length) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginBottom: 14 }, children: pins.map((p2) => {
    const rows = (data[p2.id] || []).slice(0, 6);
    const max = Math.max(1, ...rows.map((r2) => p2.metric === "value" ? r2.value : r2.count));
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { margin: 0 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: p2.title }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api("/api/dashboard-pins/" + p2.id, { method: "DELETE" });
          setPins(pins.filter((x2) => x2.id !== p2.id));
        }, children: "✕" })
      ] }),
      rows.map((r2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 5 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 110, fontSize: 12 }, children: String(r2.key).replaceAll("_", " ") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { flex: 1, background: "#eef2f7", borderRadius: 5, height: 13 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: `${Math.max(3, (p2.metric === "value" ? r2.value : r2.count) / max * 100)}%`, background: "#166534", height: 13, borderRadius: 5 } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 12 }, children: p2.metric === "value" ? money(r2.value) : num(r2.count) })
      ] }, r2.key)),
      rows.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12 }, children: "No data yet." })
    ] }, p2.id);
  }) });
}
function CustomFieldsTab() {
  const [obj, setObj] = reactExports.useState("lead");
  const [defs, setDefs] = reactExports.useState([]);
  const [form, setForm] = reactExports.useState({ label: "", field_type: "text", options: "" });
  const [msg, setMsg] = reactExports.useState("");
  const load = () => {
    api(`/api/custom-fields?object=${obj}`).then(setDefs).catch(() => {
    });
  };
  reactExports.useEffect(load, [obj]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Custom fields — your fields, on your records" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Add the fields your business actually runs on (DEC case numbers, permit IDs, tank sizes…). They appear on the record form immediately and save as real data." }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", children: [["lead", "Leads"], ["job", "Jobs"], ["account", "Customers"]].map(([k2, l2]) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: `chip ${obj === k2 ? "on" : ""}`, onClick: () => setObj(k2), children: l2 }, k2)) }),
    defs.map((f2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "st pass", children: "✓" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: f2.label }),
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
          "· ",
          f2.field_type,
          " · key ",
          f2.key
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
        await api("/api/custom-fields/" + f2.id, { method: "DELETE" });
        load();
      }, children: "Remove" })
    ] }, f2.id)),
    defs.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      "No custom fields on ",
      obj,
      "s yet."
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Field label — e.g. DEC Case Number", value: form.label, onChange: (e) => setForm({ ...form, label: e.target.value }), style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: form.field_type, onChange: (e) => setForm({ ...form, field_type: e.target.value }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "text", children: "Text" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "number", children: "Number" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "date", children: "Date" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "select", children: "Picklist" })
      ] }),
      form.field_type === "select" && /* @__PURE__ */ jsxRuntimeExports.jsx("input", { placeholder: "Options, comma separated", value: form.options, onChange: (e) => setForm({ ...form, options: e.target.value }), style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", disabled: !form.label.trim(), onClick: async () => {
        await api("/api/custom-fields", { method: "POST", body: { object_type: obj, label: form.label, field_type: form.field_type, options: form.options ? form.options.split(",").map((x2) => x2.trim()).filter(Boolean) : [] } });
        setForm({ label: "", field_type: "text", options: "" });
        setMsg("Field added ✓ — it's live on the record form");
        load();
      }, children: "Add field" })
    ] })
  ] });
}
function AssignmentRulesTab({ users }) {
  const [rules, setRules] = reactExports.useState([]);
  const [msg, setMsg] = reactExports.useState("");
  const [form, setForm] = reactExports.useState({ name: "", field: "service", op: "contains", value: "", assign_mode: "user", assign_user_id: "", pool: [] });
  const load = () => {
    api("/api/assignment-rules").then(setRules).catch(() => {
    });
  };
  reactExports.useEffect(load, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Lead assignment rules — route new leads automatically" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Rules run top-to-bottom on every new lead (form, import, API). First match wins. Round-robin hands the lead to the pool member with the fewest open leads. With no rule matched, the default owner applies." }),
    msg && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ok", children: msg }),
    rules.map((r2) => {
      var _a;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "check", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `st ${r2.active ? "pass" : "fail"}`, children: r2.active ? "✓" : "✗" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: r2.name }),
          " — when ",
          r2.field,
          " ",
          r2.op,
          " “",
          r2.value,
          "” → ",
          r2.assign_mode === "round_robin" ? "round-robin pool (" + JSON.parse(r2.pool || "[]").length + " people)" : "assign to " + (((_a = users.find((u2) => u2.id === r2.assign_user_id)) == null ? void 0 : _a.name) || "—")
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api("/api/assignment-rules/" + r2.id, { method: "PATCH", body: { active: !r2.active } });
          load();
        }, children: r2.active ? "Pause" : "Activate" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
          await api("/api/assignment-rules/" + r2.id, { method: "DELETE" });
          load();
        }, children: "Delete" })
      ] }, r2.id);
    }),
    rules.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "No rules yet." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "formgrid", style: { marginTop: 12 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Rule name" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "Tank work to the tank team" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "When field" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: form.field, onChange: (e) => setForm({ ...form, field: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "service", children: "Service requested" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "source", children: "Source" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "urgency", children: "Urgency" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "value", children: "Est. value ($)" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Condition" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value: form.op, onChange: (e) => setForm({ ...form, op: e.target.value }), children: form.field === "value" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "gte", children: "is at least" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "lte", children: "is at most" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "equals", children: "equals" })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "contains", children: "contains" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "equals", children: "equals" })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Value" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: form.value, onChange: (e) => setForm({ ...form, value: e.target.value }), placeholder: form.field === "service" ? "tank" : form.field === "value" ? "25000" : "" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Assign" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: form.assign_mode, onChange: (e) => setForm({ ...form, assign_mode: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "user", children: "To one person" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "round_robin", children: "Round-robin pool" })
        ] })
      ] }),
      form.assign_mode === "user" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Person" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: form.assign_user_id, onChange: (e) => setForm({ ...form, assign_user_id: e.target.value }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Pick…" }),
          users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: u2.id, children: u2.name }, u2.id))
        ] })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Pool (click to toggle)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rowflex", children: users.map((u2) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: `chip ${form.pool.includes(u2.id) ? "on" : ""}`, onClick: () => setForm({ ...form, pool: form.pool.includes(u2.id) ? form.pool.filter((x2) => x2 !== u2.id) : [...form.pool, u2.id] }), children: u2.name }, u2.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { marginTop: 10 }, disabled: !form.value || (form.assign_mode === "user" ? !form.assign_user_id : !form.pool.length), onClick: async () => {
      await api("/api/assignment-rules", { method: "POST", body: { ...form, name: form.name || "Rule" } });
      setForm({ name: "", field: "service", op: "contains", value: "", assign_mode: "user", assign_user_id: "", pool: [] });
      setMsg("Rule live ✓ — it applies to the next lead created");
      load();
    }, children: "Add rule" })
  ] });
}
function toast(msg) {
  window.dispatchEvent(new CustomEvent("wp-toast", { detail: msg }));
}
function ToastHost() {
  const [items, setItems] = reactExports.useState([]);
  reactExports.useEffect(() => {
    const h = (e) => {
      const id2 = Math.random().toString(36).slice(2);
      setItems((x2) => [...x2, { id: id2, msg: e.detail }]);
      setTimeout(() => setItems((x2) => x2.filter((t2) => t2.id !== id2)), 4200);
    };
    window.addEventListener("wp-toast", h);
    return () => window.removeEventListener("wp-toast", h);
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "toastHost", children: items.map((t2) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "toast", children: t2.msg }, t2.id)) });
}
function OnlinePill() {
  const [on, setOn] = reactExports.useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queued, setQueued] = reactExports.useState(0);
  reactExports.useEffect(() => {
    const read = () => {
      setOn(navigator.onLine);
      try {
        setQueued(JSON.parse(localStorage.getItem("wp_offline_posts") || "[]").length);
      } catch {
        setQueued(0);
      }
    };
    read();
    const iv = setInterval(read, 4e3);
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      clearInterval(iv);
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "tinyBadge", title: on ? "Connected — changes save to the server" : "You're offline — work keeps queuing on this device and sends when you're back", style: { background: on ? "#dcfce7" : "#fee2e2", fontSize: 12, padding: "5px 9px" }, children: [
    on ? "🟢 Online" : "🔴 Offline",
    queued > 0 ? ` · ${queued} queued` : ""
  ] });
}
function AgentPanel({ close, focusId }) {
  const [prov, setProv] = reactExports.useState(null);
  const [text, setText] = reactExports.useState("");
  const [ex, setEx] = reactExports.useState(null);
  const [hist, setHist] = reactExports.useState([]);
  const [sel, setSel] = reactExports.useState(/* @__PURE__ */ new Set());
  const [busy, setBusy] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState("");
  const loadHist = () => {
    api("/api/agent/executions").then(setHist).catch(() => {
    });
  };
  reactExports.useEffect(() => {
    api("/api/ai/provider").then(setProv).catch(() => {
    });
    loadHist();
  }, []);
  reactExports.useEffect(() => {
    if (focusId) api(`/api/agent/executions/${focusId}`).then((r2) => {
      setEx(r2);
      setSel(/* @__PURE__ */ new Set());
    }).catch(() => {
    });
  }, [focusId]);
  const triage = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r2 = await api("/api/agent/triage-untouched", { method: "POST", body: {} });
      setEx(r2);
      setSel(/* @__PURE__ */ new Set());
      loadHist();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  const run = async (instruction, parent) => {
    if (!instruction.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r2 = await api("/api/agent/execute", { method: "POST", body: { instruction, parent_id: parent || void 0 } });
      setEx(r2);
      setSel(/* @__PURE__ */ new Set());
      setText("");
      loadHist();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  const decide = async (mode) => {
    if (!ex || !sel.size) return;
    setBusy(true);
    try {
      const r2 = await api(`/api/agent/executions/${ex.id}/decide`, { method: "POST", body: mode === "approve" ? { approve: [...sel] } : { reject: [...sel] } });
      setEx(r2);
      setSel(/* @__PURE__ */ new Set());
      loadHist();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  const cancel = async () => {
    if (!ex) return;
    const r2 = await api(`/api/agent/executions/${ex.id}/cancel`, { method: "POST", body: {} });
    setEx(r2);
    loadHist();
  };
  const CB = { read: "#e0f2fe", draft: "#fef9c3", execute: "#dcfce7", approval: "#fee2e2" };
  const followParent = ex && ex.status !== "awaiting_approval" ? ex.id : void 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { position: "fixed", top: 0, right: 0, bottom: 0, width: 430, maxWidth: "94vw", background: "#fff", boxShadow: "-8px 0 30px rgba(15,40,25,.18)", zIndex: 60, display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "14px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: 0, flex: 1 }, children: "✦ Workpile Agent" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: close, children: "✕ Close" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: "10px 16px", borderBottom: "1px solid #eef2f7", fontSize: 12.5 }, className: "muted", children: prov ? prov.configured ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      "Connected: ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: prov.label }),
      prov.model ? ` · ${prov.model}` : ""
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      "Deterministic mode — ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "no AI provider connected" }),
      ". The agent plans with rules; connect a provider in Automations for generative planning."
    ] }) : "…" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: 16, overflowY: "auto", flex: 1 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { style: { flex: 1 }, placeholder: "Tell the agent what to do…", value: text, onChange: (e) => setText(e.target.value), onKeyDown: (e) => {
          if (e.key === "Enter") run(text, followParent);
        } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", disabled: busy, onClick: () => run(text, followParent), children: busy ? "Working…" : followParent ? "Follow up" : "Run" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "chipRow", style: { marginTop: 8 }, children: [
        ["Review my new leads, qualify and assign the best ones", "Prepare proposals for qualified leads", "Recover customers who haven't responded", "Find jobs with missing documents", "How is the business doing?"].map((x2) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", onClick: () => run(x2), children: x2 }, x2)),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", style: { background: "#dcfce7", fontWeight: 700 }, onClick: triage, children: "⚡ Handle all untouched leads" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "chip", style: { background: "#dcfce7", fontWeight: 700 }, onClick: () => run("Work my inbox"), children: "📥 Work my inbox" })
      ] }),
      err && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "err", children: err }),
      ex && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { margin: "0 0 4px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { children: [
          "“",
          ex.instruction,
          "”"
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "0 0 4px", fontSize: 12 }, children: [
          "Run by ",
          ex.creator_name || "a teammate",
          " · ",
          new Date(ex.created_at).toLocaleString(),
          ex.decided_by_name ? ` · decided by ${ex.decided_by_name}` : ""
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", style: { margin: "0 0 10px", fontSize: 12.5 }, children: [
          "Status: ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: String(ex.status).replaceAll("_", " ") }),
          " · planner: ",
          ex.planner || "—",
          ex.tokens_in || ex.tokens_out ? ` · tokens ${ex.tokens_in}/${ex.tokens_out}` : ""
        ] }),
        (ex.plan || []).map((s) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", borderTop: "1px solid #eef2f7" }, children: [
          s.status === "pending" ? /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: sel.has(s.id), onChange: () => setSel((prev) => {
            const n2 = new Set(prev);
            if (n2.has(s.id)) n2.delete(s.id);
            else n2.add(s.id);
            return n2;
          }), style: { width: 16, height: 16, marginTop: 2 } }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 16, textAlign: "center" }, children: s.status === "done" ? "✓" : s.status === "failed" ? "✗" : s.status === "rejected" ? "—" : "•" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "tinyBadge", style: { background: CB[s.control] || "#e2e8f0" }, children: [
              s.control,
              s.needs_approval ? " · approval" : ""
            ] }),
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { style: { fontSize: 13.5 }, children: s.label }),
            s.result && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "muted", style: { fontSize: 12.5, marginTop: 2 }, children: s.result })
          ] })
        ] }, s.id)),
        ex.status === "awaiting_approval" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { marginTop: 10 }, children: [
          (() => {
            const pend = (ex.plan || []).filter((s) => s.status === "pending");
            const allSel = pend.length > 0 && pend.every((s) => sel.has(s.id));
            return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: () => setSel(allSel ? /* @__PURE__ */ new Set() : new Set(pend.map((s) => s.id))), children: allSel ? "Clear selection" : `Select all ${pend.length} pending` });
          })(),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn small", disabled: !sel.size || busy, onClick: () => decide("approve"), children: [
            "Approve selected (",
            sel.size,
            ")"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", disabled: !sel.size || busy, onClick: () => decide("reject"), children: "Reject selected" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: cancel, children: "Cancel run" })
        ] }),
        ex.summary && !["awaiting_approval", "executing", "planning"].includes(ex.status) && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { background: "#f0fdf4", borderRadius: 8, padding: 10, marginTop: 10, whiteSpace: "pre-wrap", fontSize: 13 }, children: ex.summary })
      ] }),
      hist.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 18 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { style: { margin: "0 0 6px" }, children: "Previous runs" }),
        hist.slice(0, 8).map((h) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "clickable", style: { margin: "5px 0", fontSize: 13 }, onClick: () => {
          setEx(h);
          setSel(/* @__PURE__ */ new Set());
        }, children: [
          "“",
          h.instruction,
          "” ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", children: [
            "· ",
            String(h.status).replaceAll("_", " "),
            " · ",
            new Date(h.created_at).toLocaleString()
          ] })
        ] }, h.id))
      ] })
    ] })
  ] });
}
function App() {
  reactExports.useEffect(() => {
    const h = (e) => {
      if (e.key !== "Escape") return;
      const wraps = document.querySelectorAll(".modalWrap");
      const last = wraps[wraps.length - 1];
      if (!last) return;
      const btns = Array.from(last.querySelectorAll("button"));
      const closer = btns.find((b) => (b.textContent || "").includes("✕"));
      if (closer) closer.click();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const [user, setUser] = reactExports.useState(null);
  const [login, setLogin] = reactExports.useState({ email: "", password: "" });
  const [err, setErr] = reactExports.useState("");
  const [nav, setNav] = reactExports.useState({ view: "queue" });
  const [agentOpen, setAgentOpen] = reactExports.useState(false);
  const [agentFocus, setAgentFocus] = reactExports.useState("");
  reactExports.useEffect(() => {
    const h = (e) => {
      var _a;
      setAgentFocus(((_a = e.detail) == null ? void 0 : _a.executionId) || "");
      setAgentOpen(true);
    };
    window.addEventListener("wp-agent", h);
    return () => window.removeEventListener("wp-agent", h);
  }, []);
  const [users, setUsers] = reactExports.useState([]);
  const [priceBook, setPriceBook] = reactExports.useState([]);
  const [sb2, setSb] = reactExports.useState(() => localStorage.getItem("wp_sb") || "open");
  const [mOpen, setMOpen] = reactExports.useState(false);
  const [notifs, setNotifs] = reactExports.useState([]);
  const [unread, setUnread] = reactExports.useState(0);
  const [bellOpen, setBellOpen] = reactExports.useState(false);
  const [verifyMsg, setVerifyMsg] = reactExports.useState("");
  const [profOpen, setProfOpen] = reactExports.useState(false);
  const [navOpen, setNavOpen] = reactExports.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("wp_nav_groups") || "{}");
    } catch {
      return {};
    }
  });
  const toggleGroup = (g) => {
    const n2 = { ...navOpen, [g]: navOpen[g] === false ? true : false };
    setNavOpen(n2);
    try {
      localStorage.setItem("wp_nav_groups", JSON.stringify(n2));
    } catch {
    }
  };
  const [pending, setPending] = reactExports.useState(0);
  const [creating, setCreating] = reactExports.useState(false);
  const [leadId, setLeadId] = reactExports.useState(null);
  const [tick, setTick] = reactExports.useState(0);
  const [palOpen, setPalOpen] = reactExports.useState(false);
  const [helpOpen, setHelpOpen] = reactExports.useState(false);
  const [jobOpen, setJobOpen] = reactExports.useState(null);
  const [ltOpen, setLtOpen] = reactExports.useState(false);
  const [custOpen, setCustOpen] = reactExports.useState(null);
  const [appMode, setAppMode] = reactExports.useState(() => localStorage.getItem("wp_app") || "all");
  const [favs, setFavs] = reactExports.useState([]);
  const [tabSignal, setTabSignal] = reactExports.useState(null);
  const [theme, setTheme] = reactExports.useState(() => localStorage.getItem("wp_theme") || "light");
  reactExports.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("wp_theme", theme);
  }, [theme]);
  reactExports.useEffect(() => {
    if (user && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {
    });
  }, [user == null ? void 0 : user.id]);
  reactExports.useEffect(() => {
    window.wpLogTime = () => setLtOpen(true);
    window.wpOpenJob = (id2) => setJobOpen(id2);
    window.wpOpenAccount = (id2) => setCustOpen(id2);
    window.wpGoTab = (view, tab) => {
      setTabSignal({ view, tab, n: Date.now() });
      go({ view });
    };
  }, []);
  reactExports.useEffect(() => {
    localStorage.setItem("wp_app", appMode);
  }, [appMode]);
  reactExports.useEffect(() => {
    if (user) api("/api/favorites").then(setFavs).catch(() => {
    });
  }, [user, tick]);
  const openLead = (id2) => {
    setLeadId(id2);
    try {
      const r2 = JSON.parse(localStorage.getItem("wp_recent") || "[]").filter((x2) => x2 !== id2);
      r2.unshift(id2);
      localStorage.setItem("wp_recent", JSON.stringify(r2.slice(0, 6)));
    } catch {
    }
  };
  reactExports.useEffect(() => {
    if (!user) return;
    let gAt = 0;
    const h = (e) => {
      const t2 = e.target;
      const typing = t2 && (t2.tagName === "INPUT" || t2.tagName === "TEXTAREA" || t2.tagName === "SELECT" || t2.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalOpen((o) => !o);
        return;
      }
      if (typing || palOpen) return;
      if (e.key === "Escape") {
        setHelpOpen(false);
        return;
      }
      if (e.key === "?" || e.key === "/" && e.shiftKey) {
        setHelpOpen((o) => !o);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setPalOpen(true);
        return;
      }
      if (e.key.toLowerCase() === "t") {
        setLtOpen(true);
        return;
      }
      if (e.key.toLowerCase() === "n") {
        setCreating(true);
        return;
      }
      if (e.key.toLowerCase() === "g") {
        gAt = Date.now();
        return;
      }
      if (gAt && Date.now() - gAt < 900) {
        const m2 = { m: "myday", d: "dashboard", p: "pulse", l: "leads", a: "approvals", r: "reports", s: "settings", b: "billing", q: "queue", j: "jobs" };
        const v2 = m2[e.key.toLowerCase()];
        if (v2) {
          setNav({ view: v2 });
          gAt = 0;
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [user, palOpen]);
  const [workspaces, setWorkspaces] = reactExports.useState([]);
  const [newWs, setNewWs] = reactExports.useState("");
  reactExports.useEffect(() => {
    if (user) api("/api/workspaces").then((r2) => setWorkspaces(r2.workspaces || [])).catch(() => {
    });
  }, [user == null ? void 0 : user.id]);
  reactExports.useEffect(() => {
    api("/api/auth/me").then((r2) => {
      setUser(r2.user);
      setWorkspaces(r2.workspaces || []);
    }).catch(() => {
    });
  }, []);
  reactExports.useEffect(() => {
    syncOffline();
    const on = () => syncOffline();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
  reactExports.useEffect(() => {
    if (user) api("/api/notifications").then((r2) => {
      setNotifs(r2.notifications);
      setUnread(r2.unread);
    }).catch(() => {
    });
  }, [user, tick]);
  reactExports.useEffect(() => {
    if (user) {
      api("/api/users").then(setUsers).catch(() => {
      });
      api("/api/price-book").then(setPriceBook).catch(() => {
      });
      api("/api/approvals").then((r2) => setPending(r2.length)).catch(() => {
      });
    }
  }, [user, tick]);
  if (!user) return /* @__PURE__ */ jsxRuntimeExports.jsx(Landing, { onAuth: (u2) => {
    setUser(u2);
  } });
  const go = (n2) => setNav(n2);
  const APPS = { sales: ["queue", "myday", "dashboard", "pulse", "leads", "proposals", "jobs", "customers", "campaigns", "planner", "library", "reports", "approvals", "ai", "inbox"], ops: ["queue", "jobs", "ops", "planner", "leads", "proposals", "inbox", "library", "handoffs", "imports", "demand"], marketing: ["dashboard", "campaigns", "leads", "customers", "proposals", "imports", "demand", "reports", "library"] };
  const inApp = (v2) => appMode === "all" || (APPS[appMode] || []).includes(v2) || ["settings", "billing", "admin"].includes(v2);
  const NavB = ({ v: v2, children, cnt, short, onGo }) => !inApp(v2) ? null : /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: nav.view === v2 ? "on" : "", title: children, onClick: () => {
    if (onGo) onGo();
    else go({ view: v2 });
    setMOpen(false);
  }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "nshort", children: short }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "nlab", children }),
    cnt ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "cnt", children: cnt }) : null
  ] });
  const toggleSb = () => {
    const next = sb2 === "rail" ? "open" : "rail";
    setSb(next);
    localStorage.setItem("wp_sb", next);
  };
  const NavGroup = ({ id: id2, label, children }) => sb2 === "rail" ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "navGroupRail", children }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "navSection", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "navGroupBtn", onClick: () => toggleGroup(id2), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: label }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "navChev", children: navOpen[id2] === false ? "▸" : "▾" })
    ] }),
    navOpen[id2] !== false && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "navItems", children })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    user.impersonation && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#991b1b", color: "#fff", padding: "8px 16px", display: "flex", gap: 12, alignItems: "center", fontSize: 13.5 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        "🕵 ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Impersonation" }),
        " — viewing as ",
        user.name,
        " (",
        user.workspace_name,
        "). Started by ",
        user.impersonation.by_name,
        "; ends ",
        dt(user.impersonation.expires_at),
        ". Everything done in this window is audited."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn small", style: { background: "#fff", color: "#991b1b", fontWeight: 700 }, onClick: async () => {
        await api("/api/auth/impersonation/exit", { method: "POST", body: {} });
        location.reload();
      }, children: "Exit impersonation" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "layout", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ToastHost, {}),
      mOpen && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "scrim", onClick: () => setMOpen(false) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: `side ${sb2 === "rail" ? "rail" : ""} ${mOpen ? "mOpen" : ""}`, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "sideHead", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Logo, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "collapseBtn", title: sb2 === "rail" ? "Expand sidebar" : "Collapse sidebar", onClick: toggleSb, children: sb2 === "rail" ? "»" : "«" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "profileCard", onClick: () => setProfOpen(true), title: "Your profile — photo, name, password", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { u: user, size: 34 }),
          sb2 !== "rail" && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "pcMeta", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: user.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: user.role })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { className: "wsSwitch", value: user.workspace_id, onChange: async (e) => {
          if (e.target.value === "__new") {
            const name = prompt("New business / workspace name");
            if (name) {
              await api("/api/workspaces", { method: "POST", body: { name } });
              location.reload();
            }
            return;
          }
          await api("/api/workspaces/switch", { method: "POST", body: { workspace_id: e.target.value } });
          location.reload();
        }, children: [
          workspaces.map((w2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: w2.workspace_id, children: [
            w2.name,
            " (",
            w2.role,
            ")"
          ] }, w2.workspace_id)),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "__new", children: "+ New workspace…" })
        ] }),
        sb2 !== "rail" && favs.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "4px 2px" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "muted", style: { fontSize: 11, letterSpacing: 0.4 }, children: "⭐ FAVORITES" }),
          favs.slice(0, 6).map((f2) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "favItem", style: { display: "block", width: "100%", textAlign: "left", background: "none", border: 0, padding: "4px 6px", cursor: "pointer", fontSize: 13 }, onClick: () => {
            if (f2.entity_type === "lead") openLead(f2.entity_id);
            else if (f2.entity_type === "job") setJobOpen(f2.entity_id);
            else if (f2.entity_type === "account") setCustOpen(f2.entity_id);
          }, children: f2.label }, f2.id))
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(NavGroup, { id: "work", label: "WORK", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "dashboard", short: "🏠", children: "Home" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "queue", short: "🗂", children: "Work Queue" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "myday", short: "☀️", children: "My Day" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "inbox", short: "💬", children: "Inbox" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "planner", short: "✅", onGo: () => {
            var _a;
            go({ view: "planner" });
            (_a = window.wpGoTab) == null ? void 0 : _a.call(window, "planner", "tasks");
          }, children: "Tasks" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(NavGroup, { id: "pipe", label: "PIPELINE", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "leads", short: "🎯", children: "Leads" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "customers", short: "👥", children: "Customers" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "proposals", short: "📄", children: "Proposals" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "approvals", short: "🖊", cnt: pending || void 0, children: "Approvals" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(NavGroup, { id: "ops", label: "OPERATIONS", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "jobs", short: "🛠", children: "Jobs" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "planner", short: "🗓", onGo: () => {
            var _a;
            go({ view: "planner" });
            (_a = window.wpGoTab) == null ? void 0 : _a.call(window, "planner", "calendar");
          }, children: "Schedule" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "ops", short: "🖥", children: "Ops Console" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(NavGroup, { id: "growth", label: "GROWTH", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "campaigns", short: "📣", children: "Campaigns" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "demand", short: "🔍", children: "Demand Gap" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "pulse", short: "📊", children: "Pulse" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "handoffs", short: "🤝", children: "Handoffs" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "library", short: "📚", children: "Library" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "imports", short: "📥", children: "Import CSV" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(NavGroup, { id: "insights", label: "INSIGHTS", children: /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "reports", short: "📈", children: "Reports" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(NavGroup, { id: "system", label: "SYSTEM", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "ai", short: "🤖", children: "Automations" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "settings", short: "⚙️", children: "Settings" }),
          user.is_platform_admin ? /* @__PURE__ */ jsxRuntimeExports.jsx(NavB, { v: "admin", short: "🛡", children: "Platform Admin" }) : null,
          sb2 !== "rail" && /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "appModeRow", children: [
            "App view",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: appMode, onChange: (e) => setAppMode(e.target.value), title: "Salesforce-style tab sets", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "All modules" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "sales", children: "Sales" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "ops", children: "Operations" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "marketing", children: "Marketing" })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "topbar", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost burger", onClick: () => setMOpen((o) => !o), children: "☰" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "search", children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "search", readOnly: true, placeholder: "Search leads, jump anywhere…  ( ⌘K )", onFocus: () => setPalOpen(true) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { position: "relative" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn ghost", onClick: () => setBellOpen((o) => !o), children: [
              "🔔",
              unread ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "cnt", style: { background: "#dc2626", color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 7px", fontWeight: 700, marginLeft: 4 }, children: unread }) : null
            ] }),
            bellOpen && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bellPanel", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rowflex", style: { justifyContent: "space-between" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Notifications" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
                  await api("/api/notifications/read-all", { method: "POST", body: {} });
                  setUnread(0);
                  setNotifs(notifs.map((n2) => ({ ...n2, read_at: n2.read_at || "now" })));
                }, children: "Mark all read" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", style: { margin: "6px 0" }, onClick: async () => {
                const k2 = await api("/api/push/key").catch(() => null);
                if (!(k2 == null ? void 0 : k2.configured)) {
                  alert("Phone push activates when the server has VAPID keys configured — the in-app bell works today.");
                  return;
                }
                const perm = await Notification.requestPermission();
                if (perm !== "granted") return;
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(k2.public_key.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0)) });
                await api("/api/push/subscribe", { method: "POST", body: { subscription: sub } });
                alert("Phone alerts on for this device ✓");
              }, children: "📱 Enable phone alerts" }),
              notifs.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Nothing yet \\u2014 approvals, signatures, deposits, and new leads land here." }),
              notifs.map((n2) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bellItem", style: n2.read_at ? {} : { background: "#f0f9f1" }, onClick: async () => {
                await api(`/api/notifications/${n2.id}/read`, { method: "POST", body: {} }).catch(() => {
                });
                setUnread((u2) => Math.max(0, u2 - (n2.read_at ? 0 : 1)));
                setNotifs((ns) => ns.map((x2) => x2.id === n2.id ? { ...x2, read_at: x2.read_at || "now" } : x2));
                const et = n2.entity_type || (n2.lead_id ? "lead" : null);
                const eid = n2.entity_id || n2.lead_id;
                setBellOpen(false);
                if (et === "lead" && eid) openLead(eid);
                else if (et === "job" && eid) setJobOpen(eid);
                else if (et === "account" && eid) setCustOpen(eid);
                else if (n2.lead_id) openLead(n2.lead_id);
              }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: n2.title }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "muted", children: n2.body }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "muted", style: { fontSize: 11.5 }, children: [
                  dt(n2.created_at),
                  " · ",
                  n2.entity_type || (n2.lead_id ? "lead" : "") ? "tap to open →" : ""
                ] })
              ] }, n2.id))
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", title: "Toggle dark mode", onClick: () => setTheme((t2) => t2 === "dark" ? "light" : "dark"), children: theme === "dark" ? "☀️" : "🌙" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(OnlinePill, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", onClick: () => setAgentOpen(true), children: "✦ Agent" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost", title: "Log time (T)", onClick: () => setLtOpen(true), children: "⏱ Log time" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", onClick: () => setCreating(true), children: "+ New Lead" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "avatarBtn", onClick: () => setProfOpen(true), title: "Your profile — " + user.name, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { u: user, size: 32 }) })
        ] }),
        user && user.email_verified === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "verifyBar", children: [
          "✉️ Verify your email to secure your account and enable password recovery. ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn ghost small", onClick: async () => {
            const r2 = await api("/api/auth/resend-verify", { method: "POST", body: {} }).catch((e) => ({ error: e.message }));
            setVerifyMsg(r2.verify_url ? "Test mode — verify here: " + r2.verify_url : r2.error ? r2.error : "Verification email sent — check your inbox.");
          }, children: "Resend verification" }),
          verifyMsg && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { marginLeft: 8 }, children: verifyMsg })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(EB, { children: [
          nav.view === "queue" && /* @__PURE__ */ jsxRuntimeExports.jsx(WorkQueue, { openLead, openJob: (id2) => setJobOpen(id2), go }),
          nav.view === "jobs" && /* @__PURE__ */ jsxRuntimeExports.jsx(JobsBoard, { openJob: (id2) => setJobOpen(id2) }),
          nav.view === "customers" && /* @__PURE__ */ jsxRuntimeExports.jsx(Customers, { openCustomer: (id2) => setCustOpen(id2), tabSignal }),
          nav.view === "people" && /* @__PURE__ */ jsxRuntimeExports.jsx(Customers, { openCustomer: (id2) => setCustOpen(id2), tabSignal: { view: "customers", tab: "people", n: 1 } }),
          nav.view === "campaigns" && /* @__PURE__ */ jsxRuntimeExports.jsx(Campaigns, { openLead }),
          nav.view === "planner" && /* @__PURE__ */ jsxRuntimeExports.jsx(Planner, { openLead, tabSignal }),
          (nav.view === "tasks" || nav.view === "calendar") && /* @__PURE__ */ jsxRuntimeExports.jsx(Planner, { openLead, tabSignal: { view: "planner", tab: nav.view === "tasks" ? "tasks" : "calendar", n: 1 } }),
          nav.view === "library" && /* @__PURE__ */ jsxRuntimeExports.jsx(Library, { openLead, openJob: (id2) => setJobOpen(id2), openCustomer: (id2) => setCustOpen(id2), tabSignal }),
          (nav.view === "notes" || nav.view === "files") && /* @__PURE__ */ jsxRuntimeExports.jsx(Library, { openLead, openJob: (id2) => setJobOpen(id2), openCustomer: (id2) => setCustOpen(id2), tabSignal: { view: "library", tab: nav.view, n: 1 } }),
          nav.view === "duplicates" && /* @__PURE__ */ jsxRuntimeExports.jsx(DuplicatesView, {}),
          nav.view === "myday" && /* @__PURE__ */ jsxRuntimeExports.jsx(MyDay, { user, openLead, go }),
          nav.view === "dashboard" && /* @__PURE__ */ jsxRuntimeExports.jsx(Dashboard, { go, openLead }),
          nav.view === "pulse" && /* @__PURE__ */ jsxRuntimeExports.jsx(Pulse, { openLead }),
          nav.view === "leads" && /* @__PURE__ */ jsxRuntimeExports.jsx(Leads, { initial: nav.leads, openLead, users, me: user }, JSON.stringify(nav.leads || {}) + tick),
          nav.view === "reports" && /* @__PURE__ */ jsxRuntimeExports.jsx(Reports, {}),
          nav.view === "approvals" && /* @__PURE__ */ jsxRuntimeExports.jsx(Approvals, { openLead }),
          nav.view === "proposals" && /* @__PURE__ */ jsxRuntimeExports.jsx(ProposalsView, { openLead }),
          nav.view === "inbox" && /* @__PURE__ */ jsxRuntimeExports.jsx(InboxPage, {}),
          nav.view === "ai" && /* @__PURE__ */ jsxRuntimeExports.jsx(AIAssistant, { go, openLead: (id2) => setLeadId(id2), openJob: (id2) => setJobOpen(id2) }),
          nav.view === "imports" && /* @__PURE__ */ jsxRuntimeExports.jsx(Imports, {}),
          nav.view === "demand" && /* @__PURE__ */ jsxRuntimeExports.jsx(Demand, { openLead }),
          nav.view === "handoffs" && /* @__PURE__ */ jsxRuntimeExports.jsx(Handoffs, {}),
          nav.view === "ops" && /* @__PURE__ */ jsxRuntimeExports.jsx(Ops, {}),
          nav.view === "settings" && /* @__PURE__ */ jsxRuntimeExports.jsx(Settings, { users, setUsers, priceBook, setPriceBook, onJump: (v2) => go({ view: v2 }), me: user }),
          nav.view === "billing" && /* @__PURE__ */ jsxRuntimeExports.jsx(Billing, {}),
          nav.view === "admin" && /* @__PURE__ */ jsxRuntimeExports.jsx(Admin, {})
        ] }, nav.view),
        jobOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(JobDetail, { id: jobOpen, users, me: user, priceBook, close: () => setJobOpen(null), refresh: () => setTick((t2) => t2 + 1), openLead: (lid) => {
          setJobOpen(null);
          setLeadId(lid);
        } }),
        custOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(CustomerDetail, { id: custOpen, close: () => setCustOpen(null), openLead, openJob: (id2) => setJobOpen(id2) }),
        agentOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(AgentPanel, { close: () => setAgentOpen(false), focusId: agentFocus }),
        profOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(ProfileModal, { user, close: () => setProfOpen(false), onSaved: (u2) => setUser({ ...user, ...u2 }) }),
        ltOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(LogTimeModal, { close: () => setLtOpen(false), done: () => setTick((t2) => t2 + 1) }),
        creating && /* @__PURE__ */ jsxRuntimeExports.jsx(CreateLead, { users, done: (id2) => {
          setCreating(false);
          setTick((t2) => t2 + 1);
          if (id2) openLead(id2);
        } }),
        palOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(CommandPalette, { close: () => setPalOpen(false), go, openLead, newLead: () => setCreating(true) }),
        helpOpen && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modalWrap", onClick: () => setHelpOpen(false), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { maxWidth: 430, margin: "10vh auto" }, onClick: (e) => e.stopPropagation(), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginTop: 0 }, children: "Keyboard shortcuts" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("table", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: [["⌘K or /", "Command palette — search + jump"], ["N", "New lead"], ["G then M / D / P / L / A / R / S / B", "Go to My Day / Dashboard / Pulse / Leads / Approvals / Reports / Settings / Billing"], ["?", "This help"], ["Esc", "Close dialogs"]].map(([k2, v2]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { style: { whiteSpace: "nowrap" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "kbd", children: k2 }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: v2 })
          ] }, k2)) }) })
        ] }) }),
        leadId && /* @__PURE__ */ jsxRuntimeExports.jsx(LeadDetail, { id: leadId, users, priceBook, close: () => setLeadId(null), refresh: () => setTick((t2) => t2 + 1), openJob: (jid) => {
          setLeadId(null);
          setJobOpen(jid);
        }, openApprovals: () => {
          setLeadId(null);
          go({ view: "approvals" });
        } })
      ] })
    ] })
  ] });
}
function BookingPage({ slug }) {
  const [info, setInfo] = reactExports.useState(null);
  const [err, setErr] = reactExports.useState("");
  const [done, setDone] = reactExports.useState(false);
  const [f2, setF] = reactExports.useState({ name: "", phone: "", email: "", service: "", when: "", notes: "", location: "" });
  reactExports.useEffect(() => {
    fetch(`/api/public/book/${slug}`).then((r2) => r2.ok ? r2.json() : Promise.reject(new Error("nf"))).then(setInfo).catch(() => setErr("This booking page is not available."));
  }, []);
  const submit = async () => {
    var _a;
    const r2 = await fetch("/api/public/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...f2 }) });
    const j = await r2.json().catch(() => ({}));
    if (!r2.ok) {
      setErr(((_a = j.error) == null ? void 0 : _a.code) === "name_and_contact_required" ? "Please add your name and a phone or email." : "Something went wrong — please call us instead.");
      return;
    }
    setDone(true);
  };
  if (err) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "landWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "authCard", style: { margin: "10vh auto" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Logo, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: err })
  ] }) });
  if (!info) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "landWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { textAlign: "center", marginTop: "12vh" }, children: "Loading…" }) });
  if (done) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "landWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "authCard", style: { margin: "10vh auto" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Logo, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "You're booked ✓" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "muted", children: [
      info.business,
      " has your request",
      f2.when ? ` for ${new Date(f2.when).toLocaleString()}` : "",
      ". We'll confirm shortly — and if anything changes, we'll reach out first."
    ] })
  ] }) });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "landWrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "authCard", style: { margin: "6vh auto" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Logo, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { style: { marginBottom: 2 }, children: [
      "Book a visit — ",
      info.business
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", children: "Pick a time; we'll confirm by text or email." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Your name" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.name, onChange: (e) => setF({ ...f2, name: e.target.value }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Phone" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.phone, onChange: (e) => setF({ ...f2, phone: e.target.value }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Email" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.email, onChange: (e) => setF({ ...f2, email: e.target.value }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Service" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: f2.service, onChange: (e) => setF({ ...f2, service: e.target.value }), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Choose…" }),
      (info.services || []).map((sv) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: sv.name, children: sv.name }, sv.name))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Preferred date & time" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "datetime-local", value: f2.when, onChange: (e) => setF({ ...f2, when: e.target.value }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Address / location" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: f2.location, onChange: (e) => setF({ ...f2, location: e.target.value }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "f", children: "Anything we should know?" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { rows: 3, value: f2.notes, onChange: (e) => setF({ ...f2, notes: e.target.value }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { width: "100%", marginTop: 12 }, disabled: !f2.name || !(f2.phone || f2.email), onClick: submit, children: "Request this visit" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "muted", style: { fontSize: 12 }, children: "By booking you agree we may call/text about this request. No spam, ever." })
  ] }) });
}
const __path = window.location.pathname;
createRoot(document.getElementById("root")).render(__path.startsWith("/book/") ? /* @__PURE__ */ jsxRuntimeExports.jsx(BookingPage, { slug: __path.split("/")[2] }) : __path.startsWith("/print/proposal/") ? /* @__PURE__ */ jsxRuntimeExports.jsx(PrintProposal, { id: __path.split("/")[3] }) : __path.startsWith("/print/status-report") ? /* @__PURE__ */ jsxRuntimeExports.jsx(PrintStatusReport, {}) : /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}));
