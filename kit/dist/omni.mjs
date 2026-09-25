#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// <define:__OMNI_BUNDLE__>
var define_OMNI_BUNDLE_default;
var init_define_OMNI_BUNDLE = __esm({
  "<define:__OMNI_BUNDLE__>"() {
    define_OMNI_BUNDLE_default = { home: "vertuoza/vertuo-omni-loop" };
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var ALIAS = Symbol.for("yaml.alias");
    var DOC = Symbol.for("yaml.document");
    var MAP = Symbol.for("yaml.map");
    var PAIR = Symbol.for("yaml.pair");
    var SCALAR = Symbol.for("yaml.scalar");
    var SEQ = Symbol.for("yaml.seq");
    var NODE_TYPE = Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid2 = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid2);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item2 of node.items) {
          const c = getAliasCount(doc, item2, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment2, indent) {
      if (/^\n+$/.test(comment2))
        return comment2.substring(1);
      return indent ? comment2.replace(/^(?! *$)/gm, indent) : comment2;
    }
    var lineComment = (str, indent, comment2) => str.endsWith("\n") ? indentComment(comment2, indent) : comment2.includes("\n") ? "\n" + indentComment(comment2, indent) : (str.endsWith(" ") ? "" : " ") + comment2;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text2, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text2;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text2.length <= endStep)
        return text2;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text2, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text2[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text2[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text2, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text2[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text2[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text2;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text2;
      if (onFold)
        onFold();
      let res = text2.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text2.length;
        if (fold === 0)
          res = `
${indent}${text2.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text2[fold]}\\`;
          res += `
${indent}${text2.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text2, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text2[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text2[++i];
        } else {
          do {
            ch = text2[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text2[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment: comment2, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment2) {
        header += " " + commentString(comment2.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item2, ctx, onComment, onChompKeep) {
      const { type, value } = item2;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item2, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item2, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item2, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item2, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item2.value === "string" ? item2 : Object.assign({}, item2, { value: String(item2.value) });
      let { type } = item2;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt2 = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt2.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt2.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt2.indent === "number" ? " ".repeat(opt2.indent) : "  ",
        inFlow,
        options: opt2
      };
    }
    function getTagObject(tags, item2) {
      if (item2.tag) {
        const match = tags.filter((t) => t.tag === item2.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item2.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item2)) {
        obj = item2.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item2.format) ?? match.find((t) => !t.format);
      } else {
        obj = item2;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify3(item2, ctx, onComment, onChompKeep) {
      if (identity.isPair(item2))
        return item2.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item2)) {
        if (ctx.doc.directives)
          return item2.toString(ctx);
        if (ctx.resolvedAliases?.has(item2)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item2);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item2]);
          item2 = item2.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item2) ? item2 : ctx.doc.createNode(item2, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify3;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify3 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify3.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify3.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var log = require_log();
    var merge = require_merge();
    var stringify3 = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify3.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var stringify3 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify4 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify4(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment: comment2, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item2 = items[i];
        let comment3 = null;
        if (identity.isNode(item2)) {
          if (!chompKeep && item2.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item2.commentBefore, chompKeep);
          if (item2.comment)
            comment3 = item2.comment;
        } else if (identity.isPair(item2)) {
          const ik = identity.isNode(item2.key) ? item2.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify3.stringify(item2, itemCtx, () => comment3 = null, () => chompKeep = true);
        if (comment3)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment3));
        if (chompKeep && comment3)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment2) {
        str += "\n" + stringifyComment.indentComment(commentString(comment2), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item2 = items[i];
        let comment2 = null;
        if (identity.isNode(item2)) {
          if (item2.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item2.commentBefore, false);
          if (item2.comment)
            comment2 = item2.comment;
        } else if (identity.isPair(item2)) {
          const ik = identity.isNode(item2.key) ? item2.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item2.value) ? item2.value : null;
          if (iv) {
            if (iv.comment)
              comment2 = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item2.value == null && ik?.comment) {
            comment2 = ik.comment;
          }
        }
        if (comment2)
          reqNewline = true;
        let str = stringify3.stringify(item2, itemCtx, () => comment2 = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment2)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment2));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment2, chompKeep) {
      if (comment2 && chompKeep)
        comment2 = comment2.replace(/^\n+/, "");
      if (comment2) {
        const ic = stringifyComment.indentComment(commentString(comment2), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item2) => sortEntries(_pair, item2) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item2 of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item2);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item2 of this.items) {
          if (!identity.isPair(item2))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item2)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item2 of this.items)
          seq.push(toJS.toJS(item2, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item2, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item2, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 2, 8, opt2),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 0, 10, opt2),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 2, 16, opt2),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment: comment2, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment: comment2, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item2 = seq.items[i];
          if (identity.isPair(item2))
            continue;
          else if (identity.isMap(item2)) {
            if (item2.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item2.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item2.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item2.commentBefore}
${pair.key.commentBefore}` : item2.commentBefore;
            if (item2.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item2.comment}
${cn.comment}` : item2.comment;
            }
            item2 = pair;
          }
          seq.items[i] = identity.isPair(item2) ? item2 : new Pair.Pair(item2);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 2, 2, opt2),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 1, 8, opt2),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt2) => intResolve(str, 0, 10, opt2),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 2, 16, opt2),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var stringify3 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify3.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify3.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify3.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt2 = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt2;
        let { version } = opt2;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt2;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt2 = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt2 = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt2 = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt2)
          this.schema = new Schema.Schema(Object.assign(opt2, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment2 = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment2)
              comment2 = cb;
            else
              comment2 += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment2)
                comment2 += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment: comment2,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment2 = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment2)
                comment2 = cb;
              else
                comment2 += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment2)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment: comment2, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment2 = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment2 = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment: comment2, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + lm;
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment: comment2, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment2)
        scalar.comment = comment2;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment: comment2, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment2) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment2;
        else
          node.commentBefore = comment2;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment: comment2, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment2) {
        node.comment = comment2;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment2 = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment2 += (comment2 === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment: comment2, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment: comment2, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment2) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment2}` : comment2;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment2;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment2}
${cb}` : comment2;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment2}
${cb}` : comment2;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var stringify3 = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item2 of token.items)
            res += stringifyItem(item2);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item2 of token.items)
            res += stringifyItem(item2);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify3;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item2 = cst;
      for (const [field, index] of path) {
        const tok = item2?.[field];
        if (tok && "items" in tok) {
          item2 = tok.items[index];
        } else
          return void 0;
      }
      return item2;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item2, visitor) {
      let ctrl = visitor(item2, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item2[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item2, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item2, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list2, type) {
      for (let i = 0; i < list2.length; ++i)
        if (list2[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list2) {
      for (let i = 0; i < list2.length; ++i) {
        switch (list2[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse3(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify3(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse3;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify3;
  }
});

// node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    init_define_OMNI_BUNDLE();
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// kit/build.mjs
init_define_OMNI_BUNDLE();

// kit/bin/omni.mjs
init_define_OMNI_BUNDLE();
import { execFileSync as execFileSync6 } from "node:child_process";
import { realpathSync as realpathSync3 } from "node:fs";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// kit/lib/config.mjs
init_define_OMNI_BUNDLE();
var import_yaml = __toESM(require_dist(), 1);
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js
init_define_OMNI_BUNDLE();

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
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
init_define_OMNI_BUNDLE();

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
init_define_OMNI_BUNDLE();

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
init_define_OMNI_BUNDLE();

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
init_define_OMNI_BUNDLE();

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
init_define_OMNI_BUNDLE();
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

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
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

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
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

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
init_define_OMNI_BUNDLE();
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
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
  static mergeArray(status3, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status3.dirty();
      arrayValue.push(s.value);
    }
    return { status: status3.value, value: arrayValue };
  }
  static async mergeObjectAsync(status3, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status3, syncPairs);
  }
  static mergeObjectSync(status3, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status3.dirty();
      if (value.status === "dirty")
        status3.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status3.value, value: finalObject };
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

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
init_define_OMNI_BUNDLE();

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
init_define_OMNI_BUNDLE();
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
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
  refine(check2, message) {
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
      const result = check2(val);
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
  refinement(check2, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check2(val)) {
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
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
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
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
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
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
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
    const status3 = new ParseStatus();
    let ctx = void 0;
    for (const check2 of this._def.checks) {
      if (check2.kind === "min") {
        if (input.data.length < check2.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check2.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "max") {
        if (input.data.length > check2.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check2.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "length") {
        const tooBig = input.data.length > check2.value;
        const tooSmall = input.data.length < check2.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check2.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check2.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check2.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check2.message
            });
          }
          status3.dirty();
        }
      } else if (check2.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "regex") {
        check2.regex.lastIndex = 0;
        const testResult = check2.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "trim") {
        input.data = input.data.trim();
      } else if (check2.kind === "includes") {
        if (!input.data.includes(check2.value, check2.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check2.value, position: check2.position },
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check2.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check2.kind === "startsWith") {
        if (!input.data.startsWith(check2.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check2.value },
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "endsWith") {
        if (!input.data.endsWith(check2.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check2.value },
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "datetime") {
        const regex = datetimeRegex(check2);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "time") {
        const regex = timeRegex(check2);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "ip") {
        if (!isValidIP(input.data, check2.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "jwt") {
        if (!isValidJWT(input.data, check2.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "cidr") {
        if (!isValidCidr(input.data, check2.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check2.message
          });
          status3.dirty();
        }
      } else {
        util.assertNever(check2);
      }
    }
    return { status: status3.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check2) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check2]
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
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
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
    const status3 = new ParseStatus();
    for (const check2 of this._def.checks) {
      if (check2.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "min") {
        const tooSmall = check2.inclusive ? input.data < check2.value : input.data <= check2.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check2.value,
            type: "number",
            inclusive: check2.inclusive,
            exact: false,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "max") {
        const tooBig = check2.inclusive ? input.data > check2.value : input.data >= check2.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check2.value,
            type: "number",
            inclusive: check2.inclusive,
            exact: false,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check2.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check2.value,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check2.message
          });
          status3.dirty();
        }
      } else {
        util.assertNever(check2);
      }
    }
    return { status: status3.value, value: input.data };
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
  _addCheck(check2) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check2]
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
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
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
    const status3 = new ParseStatus();
    for (const check2 of this._def.checks) {
      if (check2.kind === "min") {
        const tooSmall = check2.inclusive ? input.data < check2.value : input.data <= check2.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check2.value,
            inclusive: check2.inclusive,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "max") {
        const tooBig = check2.inclusive ? input.data > check2.value : input.data >= check2.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check2.value,
            inclusive: check2.inclusive,
            message: check2.message
          });
          status3.dirty();
        }
      } else if (check2.kind === "multipleOf") {
        if (input.data % check2.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check2.value,
            message: check2.message
          });
          status3.dirty();
        }
      } else {
        util.assertNever(check2);
      }
    }
    return { status: status3.value, value: input.data };
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
  _addCheck(check2) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check2]
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
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
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
    const status3 = new ParseStatus();
    let ctx = void 0;
    for (const check2 of this._def.checks) {
      if (check2.kind === "min") {
        if (input.data.getTime() < check2.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check2.message,
            inclusive: true,
            exact: false,
            minimum: check2.value,
            type: "date"
          });
          status3.dirty();
        }
      } else if (check2.kind === "max") {
        if (input.data.getTime() > check2.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check2.message,
            inclusive: true,
            exact: false,
            maximum: check2.value,
            type: "date"
          });
          status3.dirty();
        }
      } else {
        util.assertNever(check2);
      }
    }
    return {
      status: status3.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check2) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check2]
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
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
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
    const { ctx, status: status3 } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status3.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status3.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status3.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item2, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item2, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status3, result2);
      });
    }
    const result = [...ctx.data].map((item2, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item2, ctx.path, i));
    });
    return ParseStatus.mergeArray(status3, result);
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
    const { status: status3, ctx } = this._processInputParams(input);
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
          status3.dirty();
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
        return ParseStatus.mergeObjectSync(status3, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status3, pairs);
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
    const { status: status3, ctx } = this._processInputParams(input);
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
        status3.dirty();
      }
      return { status: status3.value, value: merged.data };
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
    const { status: status3, ctx } = this._processInputParams(input);
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
      status3.dirty();
    }
    const items = [...ctx.data].map((item2, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item2, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status3, results);
      });
    } else {
      return ParseStatus.mergeArray(status3, items);
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
    const { status: status3, ctx } = this._processInputParams(input);
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
      return ParseStatus.mergeObjectAsync(status3, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status3, pairs);
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
    const { status: status3, ctx } = this._processInputParams(input);
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
            status3.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status3.value, value: finalMap };
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
          status3.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status3.value, value: finalMap };
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
    const { status: status3, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status3.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status3.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status3.dirty();
        parsedSet.add(element.value);
      }
      return { status: status3.value, value: parsedSet };
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
    return _ZodEnum.create(this.options.filter((opt2) => !values.includes(opt2)), {
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
    const { status: status3, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status3.abort();
        } else {
          status3.dirty();
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
          if (status3.value === "aborted")
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
          if (status3.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status3.value === "aborted")
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
        if (status3.value === "dirty")
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
          status3.dirty();
        executeRefinement(inner.value);
        return { status: status3.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status3.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status3.value, value: inner.value };
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
        return { status: status3.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status3.value,
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
var BRAND = Symbol("zod_brand");
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
    const { status: status3, ctx } = this._processInputParams(input);
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
          status3.dirty();
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
        status3.dirty();
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
function custom(check2, _params = {}, fatal) {
  if (check2)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check2(data);
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
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;

// kit/lib/config.mjs
var CONFIG_FILE = ".omni-loop/config.yml";
var CONFIG_VERSION = 1;
var ConfigError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
};
var text = external_exports.string().min(1);
var nullableText = text.nullable();
var regexSource = external_exports.string().refine((source) => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}, "not a valid regular expression");
var section = (shape) => external_exports.object(shape).strict().default({});
var askUrl = external_exports.string().refine((value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" || url.protocol === "http:" && url.hostname === "127.0.0.1";
}, "an https URL, or http on 127.0.0.1");
var ConfigSchema = external_exports.object({
  kit: external_exports.literal(CONFIG_VERSION),
  repo: section({
    slug: external_exports.string().regex(/^[\w.-]+\/[\w.-]+$/, "owner/name").nullable().default(null),
    remote: text.default("origin"),
    defaultBranch: text.default("main")
  }),
  github: section({ user: nullableText.default(null) }),
  branches: section({
    feature: text.default("feat/{topic}"),
    fix: text.default("fix/{topic}"),
    phase0: text.default("docs/phase-0-{topic}"),
    slice: text.default("feat/{topic}--{slice}"),
    rework: text.default("fix-{item}"),
    terraform: text.default("docs/omni-terraform")
  }),
  worktrees: text.default(".claude/worktrees"),
  paths: section({
    delivery: text.default(".omni-loop/delivery"),
    knowledge: text.default(".omni-loop/knowledge"),
    adr: text.default(".omni-loop/knowledge/adr"),
    playbook: text.default(".omni-loop/knowledge/playbook"),
    glossary: nullableText.default(null),
    context: external_exports.array(text).default(["CLAUDE.md"])
  }),
  labels: section({
    prd: text.default("omni:prd"),
    phase0: text.default("omni:phase-0"),
    feature: text.default("omni:feature"),
    sub: text.default("omni:sub"),
    inProgress: text.default("omni:in-progress"),
    needsFix: text.default("omni:needs-fix"),
    outboxGo: text.default("omni:outbox-go"),
    autoCreate: external_exports.boolean().default(false)
  }),
  prLinks: section({
    feature: text.default("Closes #{prd}"),
    sub: text.default("Part of #{prd}"),
    phase0: text.default("Refs #{prd}")
  }),
  board: section({ matchBy: external_exports.enum(["base", "label"]).default("base") }),
  ci: section({
    outboxContext: text.default("outbox"),
    aggregateCheck: nullableText.default(null),
    branchProtection: external_exports.boolean().default(false),
    runner: text.default("ubuntu-latest")
  }),
  commands: section({
    preflight: nullableText.default(null),
    preflightFull: nullableText.default(null),
    checks: external_exports.array(text).default([]),
    test: nullableText.default(null)
  }),
  acceptance: external_exports.object({
    enabled: external_exports.boolean().default(false),
    dir: nullableText.default(null),
    pendingSuffix: nullableText.default(null),
    run: nullableText.default(null)
  }).strict().refine((a) => !a.enabled || a.dir !== null, {
    message: "acceptance.dir is required when acceptance.enabled is true",
    path: ["dir"]
  }).default({}),
  laws: section({
    source: external_exports.enum(["knowledge", "claudeMdInvariants", "none"]).default("none"),
    claudeMdHeading: text.default("## Invariants")
  }),
  risk: section({
    storedShape: external_exports.array(regexSource).default([]),
    sharedContract: external_exports.array(text).default([])
  }),
  notify: section({
    slack: external_exports.object({ channelVar: text.default("OMNI_SLACK_CHANNEL"), tokenSecret: text.default("SLACK_BOT_TOKEN") }).strict().nullable().default(null)
  }),
  limits: section({
    stallDays: external_exports.number().int().positive().default(5),
    attempts: external_exports.number().int().positive().default(3),
    claimStaleMinutes: external_exports.number().int().positive().default(60),
    beforeAfterMaxBytes: external_exports.number().int().positive().default(512e3)
  }),
  ask: section({ url: askUrl.nullable().default(null) }),
  markers: section({ prefix: external_exports.string().regex(/^[a-z][a-z0-9-]*$/, "lowercase letters, digits and hyphens").default("omni-outbox") })
}).strict();
function describeIssue(issue) {
  const path = issue.path.join(".") || "(top level)";
  const keys = issue.code === "unrecognized_keys" ? ` (unrecognized: ${issue.keys.join(", ")})` : "";
  return `${path}: ${issue.message}${keys}`;
}
function parseConfig(source, file = CONFIG_FILE) {
  let raw;
  try {
    raw = (0, import_yaml.parse)(source) ?? {};
  } catch (error) {
    throw new ConfigError(`${file}: not valid YAML \u2014 ${error.message.split("\n")[0]}`);
  }
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const [first, ...others] = result.error.issues.map(describeIssue);
    const more = others.length ? `
${others.map((line) => `  - ${line}`).join("\n")}` : "";
    throw new ConfigError(`${file} is not a valid Omni Loop config: ${first}${more}`);
  }
  return result.data;
}
function loadConfig(root) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) {
    throw new ConfigError(`This repository is not terraformed: ${CONFIG_FILE} is missing. Run \`omni-loop init\`.`);
  }
  return parseConfig(readFileSync(file, "utf8"), CONFIG_FILE);
}

// kit/lib/context.mjs
init_define_OMNI_BUNDLE();
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

// kit/lib/layout.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync3, readdirSync } from "node:fs";
import { join as join3, posix } from "node:path";

// kit/lib/playbook/forms.mjs
init_define_OMNI_BUNDLE();
var import_yaml2 = __toESM(require_dist(), 1);
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
var req = (id) => Object.freeze({ id, required: true });
var opt = (id) => Object.freeze({ id, required: false });
var form = (id, kind, slots, { pointerOnly = false } = {}) => Object.freeze({ id, kind, pointerOnly, slots: Object.freeze(slots) });
var FORMS = Object.freeze([
  form("briefing", "core", [req("never"), opt("hooks"), opt("next")]),
  form("setup", "core", [req("prerequisites"), req("install"), opt("run"), opt("env")]),
  form("architecture", "core", [req("layout"), req("boundaries"), opt("patterns")]),
  form("testing", "core", [req("commands"), req("layout"), opt("levels"), req("never"), opt("data")]),
  form("verification", "core", [req("preflight"), opt("before-push"), opt("checks")]),
  form("ci", "core", [req("workflows"), req("gating"), opt("known-reds"), opt("rerun")]),
  form("pull-requests", "core", [req("body"), opt("title"), opt("labels"), opt("reviewers")]),
  form("decisions", "core", [req("where"), req("format"), opt("numbering")]),
  form("definition-of-done", "extended", [req("done"), opt("docs"), opt("commits")]),
  form("conventions", "extended", [opt("naming"), opt("formatting"), opt("commits")]),
  form("releasing", "extended", [req("publishes"), opt("how"), opt("rollback")]),
  form("bug-fixing", "extended", [req("steps"), opt("guard")]),
  form("glossary", "extended", [req("where")], { pointerOnly: true })
]);
var FORM_IDS = Object.freeze(FORMS.map((entry) => entry.id));
var DECISIONS_FORM = "decisions";
var FORM_STATES = ["blank", "filled", "pointer"];
var DATE = /^\d{4}-\d{2}-\d{2}$/;
var EVIDENCE = /^(.+)@([0-9a-f]{7,40})$/;
var FrontMatterSchema = external_exports.object({
  form: external_exports.enum(FORM_IDS),
  "form-version": external_exports.number().int().positive(),
  state: external_exports.enum(FORM_STATES),
  "points-to": external_exports.string().min(1).nullable(),
  evidence: external_exports.array(external_exports.string().regex(EVIDENCE, "each entry is <path>@<hex>, the file at its git hash-object")).nullable(),
  terraformed: external_exports.string().regex(DATE, "a YYYY-MM-DD date").nullable(),
  index: external_exports.string().min(1).optional()
}).strict().superRefine((fm, context) => {
  const pointer = fm.state === "pointer";
  if (pointer && fm["points-to"] === null) {
    context.addIssue({ code: "custom", path: ["points-to"], message: "a pointer form names the path it points to" });
  }
  if (!pointer && fm["points-to"] !== null) {
    context.addIssue({ code: "custom", path: ["points-to"], message: "only a pointer form points to a path; null otherwise" });
  }
  if (!pointer && fm.index !== void 0) {
    context.addIssue({ code: "custom", path: ["index"], message: "only a pointer form carries an index" });
  }
});
var FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
var TITLE = /^#\s+(.+?)\s*$/;
var HEADING = /^##\s+(.+?)\s*$/;
var FENCE = /^\s*(?:```|~~~)/;
var MARKER_START = /^<!--\s*slot:/;
var MARKER = /^<!--\s*slot:\s*([a-z][a-z0-9-]*)\s*·\s*(required|optional)(?:\s*·\s*by:\s*(terraform|human))?(?:\s*·\s*verified:\s*(\d{4}-\d{2}-\d{2}))?\s*-->$/;
var COMMENT = /<!--[\s\S]*?-->/g;
var SEE = /^See:\s+([^\s#]+)(?:#(\S+))?$/;
var HOLE = /^(?:[-*]\s+)?TODO\(human\):\s*(.*\S)\s*$/;
function withFile(file, message) {
  return file ? `${file}: ${message}` : message;
}
function readFrontMatter(raw) {
  let data;
  try {
    data = (0, import_yaml2.parse)(raw);
  } catch (error) {
    return { errors: [`front matter is not YAML \u2014 ${error.message.split("\n")[0]}`] };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { errors: ["front matter is not a set of keys"] };
  }
  const result = FrontMatterSchema.safeParse(data);
  if (result.success) return { data: result.data };
  return {
    errors: result.error.issues.map((issue) => {
      const keys = issue.code === "unrecognized_keys" ? ` (${issue.keys.join(", ")})` : "";
      const field = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `front matter ${field}${issue.message}${keys}`;
    })
  };
}
function splitSections(lines) {
  const head = [];
  const sections = [];
  let current = null;
  let fenced = false;
  for (const line of lines) {
    const heading = fenced ? null : line.match(HEADING);
    if (FENCE.test(line)) fenced = !fenced;
    if (heading) {
      current = { heading: heading[1], lines: [] };
      sections.push(current);
    } else {
      (current ? current.lines : head).push(line);
    }
  }
  return { head, sections };
}
function readHead(head) {
  const at = head.findIndex((line) => TITLE.test(line));
  if (at === -1) return { title: null, opener: null };
  const opener = head.slice(at + 1).map((line) => line.trim()).find((line) => line !== "" && !line.startsWith("<!--"));
  return { title: head[at].match(TITLE)[1], opener: opener ?? null };
}
function readBody(raw) {
  const text2 = raw.replace(COMMENT, "").trim();
  const lines = text2.split("\n").map((line) => line.trim()).filter(Boolean);
  const questions = lines.map((line) => line.match(HOLE)?.[1]).filter(Boolean);
  if (lines.length === 0) return { kind: "empty", text: "", see: null, questions: [] };
  if (questions.length === lines.length) return { kind: "holes", text: text2, see: null, questions };
  const see = lines.length === 1 ? lines[0].match(SEE) : null;
  if (see) return { kind: "pointer", text: text2, see: { path: see[1], anchor: see[2] ?? null }, questions: [] };
  return { kind: "text", text: text2, see: null, questions };
}
function parseForm(text2, { file = null } = {}) {
  const block = text2.match(FRONT_MATTER_BLOCK);
  if (!block) return { ok: false, errors: [withFile(file, 'missing its front matter (a "---" fenced header)')] };
  const [, rawFrontMatter, body] = block;
  const errors = [];
  const { data, errors: frontMatterErrors = [] } = readFrontMatter(rawFrontMatter);
  errors.push(...frontMatterErrors.map((message) => withFile(file, message)));
  const { head, sections } = splitSections(body.split(/\r?\n/));
  const slots = [];
  const unmarked = [];
  for (const { heading, lines } of sections) {
    const at = lines.findIndex((line) => line.trim() !== "");
    const first = at === -1 ? "" : lines[at].trim();
    if (!MARKER_START.test(first)) {
      unmarked.push(heading);
      continue;
    }
    const marker = first.match(MARKER);
    if (!marker) {
      errors.push(withFile(file, `"## ${heading}": malformed slot marker ${first} \u2014 want <!-- slot: <id> \xB7 required|optional[ \xB7 by: terraform|human][ \xB7 verified: YYYY-MM-DD] -->`));
      continue;
    }
    const [, id, need, by, verified] = marker;
    if (slots.some((slot) => slot.id === id)) {
      errors.push(withFile(file, `slot "${id}" appears twice`));
      continue;
    }
    slots.push({
      id,
      heading,
      required: need === "required",
      by: by ?? null,
      verified: verified ?? null,
      body: readBody(lines.slice(at + 1).join("\n"))
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    form: {
      id: data.form,
      formVersion: data["form-version"],
      state: data.state,
      pointsTo: data["points-to"],
      index: data.index ?? null,
      evidence: (data.evidence ?? []).map((entry) => {
        const [, path, hash] = entry.match(EVIDENCE);
        return { path, hash };
      }),
      terraformed: data.terraformed,
      ...readHead(head),
      slots,
      unmarked,
      file
    }
  };
}
function readForm(id, { ctx }) {
  const file = ctx.layout.formPath(id);
  if (file === null) throw new Error(`the kit has no form "${id}"`);
  if (!existsSync2(join2(ctx.root, file))) return { file, exists: false };
  return { file, exists: true, ...parseForm(readFileSync2(join2(ctx.root, file), "utf8"), { file }) };
}
var PLAYBOOK_ID = /^playbook\/([^#\s]+)#([^#\s]+)$/;
function isPlaybookId(id) {
  return id.startsWith("playbook/");
}
function resolvePlaybookId(id, { ctx }) {
  const match = id.match(PLAYBOOK_ID);
  if (!match) return { ok: false, reason: `${id}: not playbook/<form>#<slot>` };
  const [, formId, slotId] = match;
  if (!FORM_IDS.includes(formId)) return { ok: false, reason: `the kit has no form "${formId}"` };
  const read = readForm(formId, { ctx });
  if (!read.exists) return { ok: false, reason: `no form file at ${read.file}` };
  if (!read.ok) return { ok: false, reason: read.errors.join("; ") };
  const slot = read.form.slots.find((entry) => entry.id === slotId);
  if (!slot) return { ok: false, reason: `${read.file} has no slot "${slotId}"` };
  if (slot.body.kind === "empty") return { ok: false, reason: `${read.file}: slot "${slotId}" is blank` };
  return { ok: true };
}

// kit/lib/layout.mjs
var FOLDER = /^(\d{4,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
function parseFolderName(name) {
  const match = FOLDER.exec(name);
  return match ? { prd: Number(match[1]), topic: match[2] } : null;
}
function foldersLayout(root, paths) {
  const base = paths.delivery;
  const dirs = {
    inbox: `${base}/inbox`,
    outbox: `${base}/outbox`,
    shipped: `${base}/shipped`,
    archive: `${base}/archive`
  };
  function folders(dir) {
    const absolute = join3(root, dir);
    if (!existsSync3(absolute)) return [];
    return readdirSync(absolute, { withFileTypes: true }).filter((entry) => entry.isDirectory() && parseFolderName(entry.name)).map((entry) => entry.name).sort();
  }
  function find(dir, prd2) {
    const wanted = Number(prd2);
    return folders(dir).find((name) => parseFolderName(name).prd === wanted) ?? null;
  }
  function whereIs2(prd2) {
    const inbox = find(dirs.inbox, prd2);
    if (inbox) return { name: inbox, state: "inbox", dir: `${dirs.inbox}/${inbox}` };
    const shipped = find(dirs.shipped, prd2);
    if (shipped) return { name: shipped, state: "shipped", dir: `${dirs.shipped}/${shipped}` };
    return null;
  }
  const frontDoor = posix.dirname(paths.playbook);
  const inFolder = (file) => (prd2) => {
    const where = whereIs2(prd2);
    return where ? `${where.dir}/${file}` : null;
  };
  return Object.freeze({
    kind: "folders",
    dirs,
    adrDir: paths.adr,
    knowledgeRoot: paths.knowledge,
    frontDoor,
    playbookDir: paths.playbook,
    /** A form's file: the decisions form beside the decision records under the front door, every
     * other form in the playbook folder; `null` for a form the kit does not have. */
    formPath(form2) {
      if (!FORM_IDS.includes(form2)) return null;
      return form2 === DECISIONS_FORM ? `${frontDoor}/adr/README.md` : `${paths.playbook}/${form2}.md`;
    },
    whereIs: whereIs2,
    specPath: inFolder("spec.md"),
    planPath: inFolder("plan.md"),
    beforeAfterPath: inFolder("before-after.html"),
    outboxDir(prd2) {
      const where = whereIs2(prd2);
      if (where?.state === "shipped") return `${where.dir}/outbox`;
      if (where) return `${dirs.outbox}/${where.name}`;
      const orphan = find(dirs.outbox, prd2);
      return orphan ? `${dirs.outbox}/${orphan}` : null;
    },
    outboxDirs() {
      const out = folders(dirs.outbox).map((name) => ({ prd: parseFolderName(name).prd, dir: `${dirs.outbox}/${name}`, shipped: false }));
      for (const name of folders(dirs.shipped)) {
        const dir = `${dirs.shipped}/${name}/outbox`;
        if (existsSync3(join3(root, dir))) out.push({ prd: parseFolderName(name).prd, dir, shipped: true });
      }
      return out;
    },
    specFiles() {
      return folders(dirs.inbox).map((name) => `${dirs.inbox}/${name}/spec.md`);
    }
  });
}

// kit/lib/markers.mjs
init_define_OMNI_BUNDLE();
var escape = (text2) => text2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function makeMarkers(prefix) {
  const p = escape(prefix);
  return Object.freeze({
    prefix,
    any: `<!-- ${prefix}`,
    comment: `<!-- ${prefix} -->`,
    prComment: `<!-- ${prefix}-pr -->`,
    settledOpen: (id) => `<!-- ${prefix}-settled: ${id} -->`,
    settledClose: (id) => `<!-- /${prefix}-settled: ${id} -->`,
    settledOpenRe: new RegExp(`^<!-- ${p}-settled: (.+?) -->$`),
    announcedPrefix: `<!-- ${prefix}-announced: `,
    announcedSuffix: " -->",
    announcedRe: new RegExp(`<!-- ${p}-announced: (.*?) -->`),
    numbersPrefix: `<!-- ${prefix}-numbers: `,
    numbersSuffix: " -->",
    numbersRe: new RegExp(`<!-- ${p}-numbers: (.*?) -->`),
    round: (n, numbers) => `<!-- ${prefix}-round: ${n} ${numbers.join(",")} -->`,
    roundRe: new RegExp(`<!-- ${p}-round: (\\d+) ([\\d,]*) -->`)
  });
}

// kit/lib/context.mjs
function createContext(root, config2) {
  return Object.freeze({
    root,
    config: config2,
    layout: foldersLayout(root, config2.paths),
    markers: makeMarkers(config2.markers.prefix)
  });
}
function slugFromRemote(url) {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : null;
}
function loadContext(cwd = process.cwd(), { exec = execFileSync } = {}) {
  let root;
  try {
    root = exec("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    throw new ConfigError(`${cwd} is not inside a git repository.`);
  }
  root = realpathSync(root);
  let config2 = loadConfig(root);
  if (config2.repo.slug === null) {
    let url = "";
    try {
      url = exec("git", ["remote", "get-url", config2.repo.remote], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      url = "";
    }
    config2 = { ...config2, repo: { ...config2.repo, slug: slugFromRemote(url) } };
  }
  return createContext(root, config2);
}

// kit/bin/commands/index.mjs
init_define_OMNI_BUNDLE();

// kit/bin/commands/adopt.mjs
init_define_OMNI_BUNDLE();
import { rmSync as rmSync2 } from "node:fs";
import { isAbsolute as isAbsolute3, relative as relative2 } from "node:path";

// kit/lib/outbox/outbox.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync4, readdirSync as readdirSync2 } from "node:fs";
import { join as join4 } from "node:path";
var SETTLED_FILE = "settled.md";
var RANK_VALUES = (
  /** @type {const} */
  ["human-action", "high", "medium"]
);
var RANK_ORDER = { medium: 0, high: 1, "human-action": 2 };
var REQUIRED_SECTIONS = [
  "What I had to decide",
  "What I did meanwhile",
  "What it costs to change later",
  "What I could not know"
];
var PLAIN_SECTIONS = ["The question, in plain words", "The decision, in plain words"];
var FUN_SECTIONS = ["The intro, for fun", "The punchline, for fun"];
var FUN_LINE_MAX_LENGTH = 120;
var OPTIONS_HEADING = "The options, in plain words";
var PERSON_STEPS_HEADING = "What a person must do";
var OPTION_LETTERS = ["A", "B", "C", "D"];
var SECTION_FIELD = {
  "The question, in plain words": "questionPlain",
  "The decision, in plain words": "decisionPlain",
  "The intro, for fun": "introFun",
  "The punchline, for fun": "punchlineFun",
  [PERSON_STEPS_HEADING]: "personSteps",
  "What I had to decide": "whatIHadToDecide",
  "What I did meanwhile": "whatIDidMeanwhile",
  "What it costs to change later": "whatItCostsToChangeLater",
  "What I could not know": "whatICouldNotKnow"
};
var FrontMatterSchema2 = external_exports.object({
  id: external_exports.string().trim().min(1, "id is required"),
  prd: external_exports.coerce.number({ message: "prd must be a number" }).int().positive(),
  slice: external_exports.string().trim().min(1, "slice is required"),
  rank: external_exports.enum(RANK_VALUES, {
    message: `rank must be one of: ${RANK_VALUES.join(", ")}`
  }),
  "bears-on": external_exports.string().trim().min(1, "bears-on is required"),
  raised: external_exports.string().regex(/^\d{4}-\d{2}-\d{2}$/, "raised must be a YYYY-MM-DD date"),
  wave: external_exports.coerce.number({ message: "wave must be a number" }).int().positive()
}).strict();
var FRONT_MATTER_BLOCK2 = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
var FRONT_MATTER_LINE = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;
var HEADING_LINE = /^##\s+(.+?)\s*$/;
function withFile2(file, message) {
  return file ? `${file}: ${message}` : message;
}
function stripQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if (first === '"' && last === '"' || first === "'" && last === "'") {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}
function parseFrontMatterLines(rawFrontMatter) {
  const data = {};
  const errors = [];
  for (const rawLine of rawFrontMatter.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(FRONT_MATTER_LINE);
    if (!match) {
      errors.push(`front matter line is not "key: value": "${rawLine}"`);
      continue;
    }
    const [, key, rawValue] = match;
    data[key] = stripQuotes(rawValue);
  }
  return { data, errors };
}
function parseHeadingSections(body) {
  const sections = [];
  let current = null;
  for (const line of body.split("\n")) {
    const match = line.match(HEADING_LINE);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections.map((section3) => ({
    heading: section3.heading,
    content: section3.lines.join("\n").trim()
  }));
}
function validateSections(body) {
  const found = parseHeadingSections(body);
  const foundHeadings = found.map((section3) => section3.heading);
  const errors = [];
  const presentPlain = PLAIN_SECTIONS.filter((heading) => foundHeadings.includes(heading));
  if (presentPlain.length === 1) {
    const [present] = presentPlain;
    const other = PLAIN_SECTIONS.find((heading) => heading !== present);
    errors.push(
      `carries "## ${present}" without "## ${other}" \u2014 the two plain-words sections come together, or neither does`
    );
  }
  const presentFun = FUN_SECTIONS.filter((heading) => foundHeadings.includes(heading));
  if (presentFun.length === 1) {
    const [present] = presentFun;
    const other = FUN_SECTIONS.find((heading) => heading !== present);
    errors.push(
      `carries "## ${present}" without "## ${other}" \u2014 the intro and the punchline come together, or neither does`
    );
  }
  if (presentFun.length === 2 && presentPlain.length === 0) {
    errors.push(
      `carries "## ${FUN_SECTIONS[0]}" and "## ${FUN_SECTIONS[1]}" with no plain-words sections \u2014 the intro and the punchline sit right after the two plain-words sections`
    );
  }
  const presentOptionsHeadings = [OPTIONS_HEADING, PERSON_STEPS_HEADING].filter(
    (heading) => foundHeadings.includes(heading)
  );
  if (presentOptionsHeadings.length > 1) {
    errors.push(
      `carries both "## ${OPTIONS_HEADING}" and "## ${PERSON_STEPS_HEADING}" \u2014 an item carries at most one, never both`
    );
  }
  const chosenOptionsHeading = presentOptionsHeadings.length === 1 ? presentOptionsHeadings[0] : null;
  const expectedSections = [
    ...presentPlain.length === 2 ? PLAIN_SECTIONS : [],
    ...presentFun.length === 2 ? FUN_SECTIONS : [],
    ...chosenOptionsHeading ? [chosenOptionsHeading] : [],
    ...REQUIRED_SECTIONS
  ];
  const knownHeadings = [
    ...PLAIN_SECTIONS,
    ...FUN_SECTIONS,
    OPTIONS_HEADING,
    PERSON_STEPS_HEADING,
    ...REQUIRED_SECTIONS
  ];
  const missing = expectedSections.filter((heading) => !foundHeadings.includes(heading));
  if (missing.length > 0) {
    errors.push(`missing section(s): ${missing.map((heading) => `"## ${heading}"`).join(", ")}`);
  }
  const unexpected = foundHeadings.filter((heading) => !knownHeadings.includes(heading));
  if (unexpected.length > 0) {
    errors.push(
      `unexpected heading(s): ${unexpected.map((heading) => `"## ${heading}"`).join(", ")}`
    );
  }
  if (missing.length === 0 && unexpected.length === 0 && presentPlain.length !== 1 && presentFun.length !== 1) {
    const seen = foundHeadings;
    const inOrder = seen.every((heading, index) => heading === expectedSections[index]);
    if (!inOrder) {
      errors.push(
        `sections are out of order: found [${seen.join(", ")}], expected [${expectedSections.join(", ")}]`
      );
    }
  }
  for (const section3 of found) {
    if (expectedSections.includes(section3.heading) && section3.content.length === 0) {
      errors.push(`section "## ${section3.heading}" has no content`);
    }
  }
  const sections = Object.fromEntries(found.map((section3) => [section3.heading, section3.content]));
  return { errors, sections };
}
function parseOutboxItem(text2, { file = null } = {}) {
  const blockMatch = text2.match(FRONT_MATTER_BLOCK2);
  if (!blockMatch) {
    return {
      ok: false,
      errors: [withFile2(file, 'missing a front-matter block (a "---" fenced header)')]
    };
  }
  const [, rawFrontMatter, body] = blockMatch;
  const errors = [];
  const { data, errors: lineErrors } = parseFrontMatterLines(rawFrontMatter);
  errors.push(...lineErrors.map((message) => withFile2(file, message)));
  const parsedFrontMatter = FrontMatterSchema2.safeParse(data);
  if (!parsedFrontMatter.success) {
    for (const issue of parsedFrontMatter.error.issues) {
      const field = issue.path.length > 0 ? issue.path.join(".") : "(front matter)";
      errors.push(withFile2(file, `${field}: ${issue.message}`));
    }
  }
  const { errors: sectionErrors, sections } = validateSections(body);
  errors.push(...sectionErrors.map((message) => withFile2(file, message)));
  let parsedOptions;
  if (OPTIONS_HEADING in sections) {
    const { options, errors: optionErrors } = parseOutboxOptions(sections[OPTIONS_HEADING]);
    parsedOptions = options;
    errors.push(...optionErrors.map((message) => withFile2(file, message)));
  }
  if (errors.length > 0) return { ok: false, errors };
  const fm = parsedFrontMatter.data;
  const item2 = {
    id: fm.id,
    prd: fm.prd,
    slice: fm.slice,
    rank: fm.rank,
    bearsOn: fm["bears-on"],
    raised: fm.raised,
    wave: fm.wave,
    sections: Object.fromEntries([
      ...Object.entries(SECTION_FIELD).filter(([heading]) => heading in sections).map(([heading, field]) => [field, sections[heading]]),
      ...parsedOptions !== void 0 ? [["options", parsedOptions]] : []
    ]),
    file
  };
  return { ok: true, item: item2 };
}
var OPTION_LINE = /^([A-Za-z])\.\s+(\S.*)$/;
function parseOutboxOptions(content) {
  const lines = (content ?? "").split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  const options = [];
  const errors = [];
  for (const line of lines) {
    const match = line.match(OPTION_LINE);
    if (!match) {
      errors.push(`option line is not "<letter>. <sentence>": "${line}"`);
      continue;
    }
    options.push({ letter: match[1].toUpperCase(), text: match[2].trim() });
  }
  return { options, errors };
}
function optionLettersInOrder(options) {
  return (options ?? []).every((option, index) => option.letter === OPTION_LETTERS[index]);
}
var SLASH_IDIOMS = /* @__PURE__ */ new Set([
  "and/or",
  "he/she",
  "his/her",
  "him/her",
  "she/he",
  "her/his",
  "yes/no",
  "on/off",
  "either/or",
  "i/o",
  "w/o"
]);
var FILE_EXTENSION = "(?:mjs|cjs|mts|cts|js|jsx|ts|tsx|json|ya?ml|md|mdx|py|rb|go|java|sh|html?|css)";
var FILE_PATH_PATTERN = new RegExp(
  String.raw`\b[\w.-]*\.${FILE_EXTENSION}\b|\b[\w.-]+(?:/[\w.-]+)+\b`,
  "gi"
);
var REGISTER_OR_ADR_ID = /\bN\d+\b|\bBR-[A-Z0-9]+-\d+\b|\bADR-\d{4}\b/g;
var CAMEL_CASE_WORD = /\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g;
var SCREAMING_CASE_WORD = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
var BACKTICK_SPAN = /`[^`\n]+`/g;
function countSentences(text2) {
  const trimmed = (text2 ?? "").trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [];
  return matches.filter((sentence) => sentence.trim().length > 0).length;
}
function uniqueMatches(text2, pattern) {
  return [...new Set(text2.match(pattern) ?? [])];
}
function plainWordsProblems(text2) {
  const value = text2 ?? "";
  const problems = [];
  const backticks = uniqueMatches(value, BACKTICK_SPAN);
  if (backticks.length > 0) {
    problems.push(
      `carries a code span (${backticks.join(", ")}) \u2014 say it in plain words, with no backticks`
    );
  }
  const paths = uniqueMatches(value, FILE_PATH_PATTERN).filter(
    (match) => !SLASH_IDIOMS.has(match.toLowerCase())
  );
  if (paths.length > 0) {
    problems.push(
      `names a file path (${paths.join(", ")}) \u2014 a business person cannot open a repo path`
    );
  }
  const ids = uniqueMatches(value, REGISTER_OR_ADR_ID);
  if (ids.length > 0) {
    problems.push(
      `names an id (${ids.join(", ")}) \u2014 spell out what it means instead of citing its register or ADR id`
    );
  }
  const codeWords = [
    ...uniqueMatches(value, CAMEL_CASE_WORD),
    ...uniqueMatches(value, SCREAMING_CASE_WORD)
  ];
  if (codeWords.length > 0) {
    problems.push(
      `carries a code identifier (${codeWords.join(", ")}) \u2014 write the plain word instead of the variable or constant name`
    );
  }
  const sentenceCount = countSentences(value);
  if (sentenceCount > 2) {
    problems.push(`is ${sentenceCount} sentences long \u2014 say it in one or two sentences`);
  }
  return problems;
}
function funLineProblems(text2) {
  const value = (text2 ?? "").trim();
  const problems = plainWordsProblems(value);
  const length = [...value].length;
  if (length > FUN_LINE_MAX_LENGTH) {
    problems.push(
      `is ${length} characters long \u2014 keep it to ${FUN_LINE_MAX_LENGTH} characters at most`
    );
  }
  return problems;
}
function bearsOnFloorsHigh(bearsOn, laws) {
  return laws.floorsHigh(bearsOn);
}
function floorRank(bearsOn, proposed, laws) {
  const floor = bearsOnFloorsHigh(bearsOn, laws) ? "high" : proposed;
  return RANK_ORDER[proposed] >= RANK_ORDER[floor] ? proposed : floor;
}
function isBelowFloor(bearsOn, rank, laws) {
  return floorRank(bearsOn, rank, laws) !== rank;
}
function resolveBearsOn(bearsOn, laws) {
  return laws.resolve(bearsOn);
}
function itemFilesUnder(root, dir) {
  const absolute = join4(root, dir);
  if (!existsSync4(absolute)) return [];
  const files = [];
  for (const entry of readdirSync2(absolute, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "accounts") continue;
      files.push(...itemFilesUnder(root, `${dir}/${entry.name}`));
      continue;
    }
    if (!entry.name.endsWith(".md") || entry.name === SETTLED_FILE) continue;
    files.push(`${dir}/${entry.name}`);
  }
  return files.sort();
}
function outboxItemFiles({ ctx }) {
  const files = [];
  for (const { dir } of ctx.layout.outboxDirs()) {
    files.push(...itemFilesUnder(ctx.root, dir));
  }
  return files;
}

// kit/lib/outbox/settle.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync5, mkdirSync, readFileSync as readFileSync3, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join as join5, relative } from "node:path";

// kit/lib/commands.mjs
init_define_OMNI_BUNDLE();
var COMMANDS = Object.freeze({
  brainstorm: "/omni:brainstorm",
  yolo: "/omni:yolo",
  yoloFix: "/omni:yolo-fix",
  deliver: "/omni:deliver"
});

// kit/lib/outbox/settle.mjs
var VERDICTS = (
  /** @type {const} */
  ["agreed", "drifted"]
);
var ADOPTED_VERDICT = "adopted";
var ADOPTED_ANSWER_TEXT = "Adopted the moment it was raised \u2014 nobody approved it, and it stands unless someone objects.";
var CHANNEL_KINDS = (
  /** @type {const} */
  ["prd-issue", "feature-pull-request"]
);
var CHANNEL_LABEL = {
  "prd-issue": "PRD issue",
  "feature-pull-request": "feature pull request"
};
var AnswerChannelSchema = external_exports.object({
  kind: external_exports.enum(CHANNEL_KINDS, {
    message: `channel.kind must be one of: ${CHANNEL_KINDS.join(", ")}`
  }),
  number: external_exports.coerce.number({ message: "channel.number must be a number" }).int().positive(),
  url: external_exports.string().trim().min(1).optional()
}).strict();
var AnswerSchema = external_exports.object({
  text: external_exports.string().trim().min(1, "the answer text is required"),
  approvedBy: external_exports.string().trim().min(1, "approvedBy is required \u2014 who approved it"),
  approvedAt: external_exports.string().regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?)?$/,
    "approvedAt must be an ISO date or date-time"
  ),
  channel: AnswerChannelSchema,
  statedVerdict: external_exports.enum(VERDICTS).optional()
}).strict();
function channelLabel(channel) {
  return `${CHANNEL_LABEL[channel.kind] ?? channel.kind} #${channel.number}`;
}
var CONTRADICTION_MARKERS = [
  "no",
  "not",
  "never",
  "cannot",
  "don't",
  "doesn't",
  "isn't",
  "shouldn't",
  "won't",
  "can't",
  "instead",
  "rather than",
  "should be",
  "should have",
  "must be",
  "change it",
  "change that",
  "change the",
  "wrong",
  "revert",
  "undo",
  "disagree"
];
var AFFIRMATIONS = /* @__PURE__ */ new Set([
  "yes",
  "ok",
  "okay",
  "agreed",
  "agree",
  "confirmed",
  "confirm",
  "correct",
  "right",
  "fine",
  "lgtm",
  "looks good",
  "good",
  "sounds good",
  "keep it",
  "keep it as is",
  "go ahead",
  "approved",
  "ship it",
  "that is right",
  "thats right"
]);
var STATED_VERDICT_LINE = /^[ \t]*verdict:[ \t]*(agreed|drifted)[ \t]*$/im;
function normalizeApostrophes(text2) {
  return text2.replace(/[‘’ʼ]/g, "'");
}
function normalizeWhole(text2) {
  return normalizeApostrophes(text2).toLowerCase().replace(/\s+/g, " ").trim();
}
function openingClause(text2) {
  const [first] = normalizeApostrophes(text2).split(/[,.;:!?\n]|—|–|--/);
  return (first ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function markerFound(haystack, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9'])${escaped}([^a-z0-9']|$)`).test(haystack);
}
function judgeAnswer({ choice, answer, statedVerdict = null }) {
  const stated = statedVerdict ?? answer.match(STATED_VERDICT_LINE)?.[1]?.toLowerCase() ?? null;
  if (stated) {
    return {
      verdict: stated,
      basis: "stated",
      reason: `the answer is settled as "${stated}" because a human said so, not because a comparison read it`
    };
  }
  if (choice && normalizeWhole(answer) === normalizeWhole(choice)) {
    return {
      verdict: "agreed",
      basis: "restates-the-choice",
      reason: "the answer repeats the recorded choice word for word"
    };
  }
  const haystack = normalizeWhole(answer);
  const found = CONTRADICTION_MARKERS.filter((marker) => markerFound(haystack, marker));
  if (found.length > 0) {
    return {
      verdict: "drifted",
      basis: "contradiction-marker",
      reason: `the answer says ${found.map((marker) => `"${marker}"`).join(", ")}, which reads as a change to the recorded choice`
    };
  }
  const opening = openingClause(answer);
  if (AFFIRMATIONS.has(opening)) {
    return {
      verdict: "agreed",
      basis: "affirmation",
      reason: `the answer opens with "${opening}" and carries no contradiction marker`
    };
  }
  return {
    verdict: null,
    basis: "undetermined",
    reason: "the comparison found neither a restatement, a contradiction marker, nor a plain affirmation \u2014 it does not read prose, so it refuses to guess"
  };
}
function fenceFor(content) {
  const longest = Math.max(0, ...[...content.matchAll(/`+/g)].map((match) => match[0].length));
  return "`".repeat(Math.max(3, longest + 1));
}
function verbatimBlock(content) {
  const fence = fenceFor(content);
  return `${fence}text
${content}
${fence}`;
}
function closedLine(verdict) {
  if (verdict === "agreed") {
    return "yes \u2014 the answer matches what was built, so there is nothing to rework";
  }
  if (verdict === ADOPTED_VERDICT) {
    return "yes \u2014 adopted when it was raised; nothing to rework unless someone objects";
  }
  return `no \u2014 the build and the decision disagree until a rework sub-PR brings them back in line (${COMMANDS.yoloFix})`;
}
function settledHeader(prd2, { ctx }) {
  return [
    `# Settled outbox items \u2014 PRD ${prd2}`,
    "",
    "Append-only. Each entry below is one outbox item a human answered: the question exactly as it",
    "was raised, the answer exactly as it was given, who approved it, when, through which channel,",
    `and the verdict. Nothing here is ever rewritten \u2014 see \`${ctx.config.paths.delivery}/README.md\`.`,
    ""
  ].join("\n");
}
function renderSettledEntry({ item: item2, itemText, answer, judgement, markers }) {
  const lines = [
    markers.settledOpen(item2.id),
    "",
    `## ${item2.id} \u2014 ${judgement.verdict}`,
    "",
    `- Verdict: ${judgement.verdict}`,
    `- Approved by: ${answer.approvedBy}`,
    `- Approved at: ${answer.approvedAt}`
  ];
  if (answer.channel) {
    lines.push(`- Channel: ${channelLabel(answer.channel)}`);
    if (answer.channel.url) lines.push(`- Channel URL: ${answer.channel.url}`);
  }
  lines.push(
    `- Basis: ${judgement.basis} \u2014 ${judgement.reason}`,
    `- Closed: ${closedLine(judgement.verdict)}`,
    `- Rank: ${item2.rank}`,
    `- Bears on: ${item2.bearsOn}`,
    `- Raised: ${item2.raised}`,
    `- Slice: ${item2.slice}`,
    `- Wave: ${item2.wave}`,
    "",
    "### The answer, as it was given",
    "",
    verbatimBlock(answer.text),
    "",
    "### The item, as it was raised",
    "",
    verbatimBlock(itemText),
    "",
    markers.settledClose(item2.id),
    ""
  );
  return lines.join("\n");
}
function parseSettledEntries(text2, markers) {
  return latestPerId(rawSettledEntries(text2, markers));
}
function latestPerId(entries) {
  const byId = /* @__PURE__ */ new Map();
  for (const entry of entries) byId.set(entry.id, entry);
  return [...byId.values()];
}
function rawSettledEntries(text2, markers) {
  const lines = text2.split("\n");
  const entries = [];
  let current = null;
  for (let index = 0; index < lines.length; index += 1) {
    const openMatch = lines[index].match(markers.settledOpenRe);
    if (openMatch) {
      current = { id: openMatch[1], fields: {}, blocks: [] };
      continue;
    }
    if (!current) continue;
    if (lines[index] === markers.settledClose(current.id)) {
      const [answerText = "", itemText = ""] = current.blocks;
      const closed = /^yes\b/.test(current.fields.Closed ?? "");
      const became = (current.fields.Became ?? "").split(",").map((id) => id.trim()).filter(Boolean);
      entries.push({
        id: current.id,
        verdict: current.fields.Verdict,
        closed,
        fields: current.fields,
        answerText,
        itemText,
        became
      });
      current = null;
      continue;
    }
    const fenceMatch = lines[index].match(/^(`{3,})text$/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const start = index + 1;
      let end = start;
      while (end < lines.length && lines[end] !== fence) end += 1;
      current.blocks.push(lines.slice(start, end).join("\n"));
      index = end;
      continue;
    }
    const fieldMatch = lines[index].match(/^- ([A-Za-z][A-Za-z ]*): (.*)$/);
    if (fieldMatch) current.fields[fieldMatch[1]] = fieldMatch[2];
  }
  return entries;
}
function locate(root, file) {
  const absoluteFile = isAbsolute(file) ? file : join5(root, file);
  return { absoluteFile, relativeFile: relative(root, absoluteFile) };
}
function settleItem({ ctx, file, answer }) {
  const { absoluteFile, relativeFile } = locate(ctx.root, file);
  const parsedAnswer = AnswerSchema.safeParse(answer);
  if (!parsedAnswer.success) {
    return {
      ok: false,
      errors: parsedAnswer.error.issues.map(
        (issue) => `${issue.path.join(".") || "(answer)"}: ${issue.message}`
      )
    };
  }
  if (!existsSync5(absoluteFile)) {
    return { ok: false, errors: [`${relativeFile}: no such open item.`] };
  }
  const itemText = readFileSync3(absoluteFile, "utf8");
  const parsedItem = parseOutboxItem(itemText, { file: relativeFile });
  if (!parsedItem.ok) return { ok: false, errors: parsedItem.errors };
  const { item: item2 } = parsedItem;
  const outboxDir = ctx.layout.outboxDir(item2.prd);
  if (outboxDir === null) throw new Error(`PRD ${item2.prd} has no inbox or shipped folder`);
  const judgement = judgeAnswer({
    choice: item2.sections.whatIDidMeanwhile,
    answer: parsedAnswer.data.text,
    statedVerdict: parsedAnswer.data.statedVerdict ?? null
  });
  if (judgement.verdict === null) {
    return {
      ok: false,
      errors: [
        `${relativeFile}: the verdict is undetermined \u2014 ${judgement.reason}. Say it outright: add a "Verdict: agreed" or "Verdict: drifted" line to the answer, or pass --verdict.`
      ]
    };
  }
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  const absoluteSettled = join5(ctx.root, settledFile);
  const existing = existsSync5(absoluteSettled) ? readFileSync3(absoluteSettled, "utf8") : settledHeader(item2.prd, { ctx });
  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  const entry = renderSettledEntry({
    item: item2,
    itemText,
    answer: parsedAnswer.data,
    judgement,
    markers: ctx.markers
  });
  writeFileSync(absoluteSettled, `${existing}${separator}${entry}`);
  rmSync(absoluteFile);
  return {
    ok: true,
    verdict: judgement.verdict,
    basis: judgement.basis,
    entry,
    settledFile,
    removedFile: relativeFile
  };
}
function adoptedJudgement() {
  return {
    verdict: ADOPTED_VERDICT,
    basis: "adopted-when-raised",
    reason: "a medium item is adopted the moment it is raised \u2014 nobody approves it, and it stands unless someone later objects"
  };
}
function renderAdoptedEntry({ item: item2, itemText, markers }) {
  return renderSettledEntry({
    item: item2,
    itemText,
    answer: {
      approvedBy: "nobody",
      approvedAt: item2.raised,
      channel: null,
      text: ADOPTED_ANSWER_TEXT
    },
    judgement: adoptedJudgement(),
    markers
  });
}
function adoptItem({ ctx, itemText }) {
  const parsedItem = parseOutboxItem(itemText, { file: null });
  if (!parsedItem.ok) return { ok: false, errors: parsedItem.errors };
  const { item: item2 } = parsedItem;
  if (item2.rank !== "medium") {
    return {
      ok: false,
      errors: [
        `${item2.id}: only a "medium" item is adopted at raise time \u2014 this one is ranked "${item2.rank}" and is written as an open item file instead.`
      ]
    };
  }
  const outboxDir = ctx.layout.outboxDir(item2.prd);
  if (outboxDir === null) throw new Error(`PRD ${item2.prd} has no inbox or shipped folder`);
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  const absoluteSettled = join5(ctx.root, settledFile);
  const existing = existsSync5(absoluteSettled) ? readFileSync3(absoluteSettled, "utf8") : settledHeader(item2.prd, { ctx });
  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  const entry = renderAdoptedEntry({ item: item2, itemText, markers: ctx.markers });
  mkdirSync(dirname(absoluteSettled), { recursive: true });
  writeFileSync(absoluteSettled, `${existing}${separator}${entry}`);
  return { ok: true, entry, settledFile, item: item2 };
}

// kit/bin/args.mjs
init_define_OMNI_BUNDLE();
import { readFileSync as readFileSync4 } from "node:fs";
import { isAbsolute as isAbsolute2, join as join6 } from "node:path";
function usageError(message) {
  return Object.assign(new Error(message), { name: "UsageError" });
}
function parseArgs(command, argv, { values = [], booleans = [] } = {}) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (booleans.includes(name)) {
      flags[name] = true;
    } else if (values.includes(name)) {
      const value = argv[index + 1];
      if (value === void 0 || value.startsWith("--")) throw usageError(`omni ${command}: ${arg} needs a value.`);
      flags[name] = value;
      index += 1;
    } else {
      throw usageError(`omni ${command}: unknown flag ${arg}.`);
    }
  }
  return { positional, flags };
}
function positiveInt(command, what, value) {
  const number = Number(value);
  if (value === void 0 || value === true || !Number.isInteger(number) || number <= 0) {
    throw usageError(`omni ${command}: ${what} must be a positive number${value === void 0 ? "" : `, got "${value}"`}.`);
  }
  return number;
}
function list(value) {
  return value ? String(value).split(",").map((item2) => item2.trim()).filter(Boolean) : [];
}
function inRoot(ctx, path) {
  return isAbsolute2(path) ? path : join6(ctx.root, path);
}
function println(stream, text2 = "") {
  stream.write(`${text2}
`);
}
function readUserFile(command, ctx, path) {
  try {
    return readFileSync4(inRoot(ctx, path), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EISDIR" || error?.code === "EACCES") {
      throw usageError(`omni ${command}: cannot read ${path} (${error.code}).`);
    }
    throw error;
  }
}
var SLUG = /^[\w.-]+\/[\w.-]+$/;
function repoSlug(command, ctx, flag) {
  const repo = flag ?? ctx.config.repo.slug;
  if (!repo) throw usageError(`omni ${command}: no repository slug \u2014 pass --repo <owner/name> or set repo.slug.`);
  if (!SLUG.test(repo)) throw usageError(`omni ${command}: --repo must be owner/name, got "${repo}".`);
  return repo;
}
var NO_FOLDER = /^PRD \d+ has no inbox or shipped folder$/;
function withPrdFolder(command, fn) {
  try {
    return fn();
  } catch (error) {
    if (NO_FOLDER.test(error?.message ?? "")) throw usageError(`omni ${command}: ${error.message}.`);
    throw error;
  }
}

// kit/bin/commands/adopt.mjs
function isUnder(dir, file) {
  const rel = relative2(dir, file);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute3(rel);
}
var adopt = {
  async run(args, { ctx, stdout, stderr }) {
    const { positional } = parseArgs("adopt", args);
    if (positional.length !== 1) throw usageError("usage: omni adopt <item-text-file>");
    const file = relative2(ctx.root, inRoot(ctx, positional[0]));
    const itemText = readUserFile("adopt", ctx, positional[0]);
    const parsedItem = parseOutboxItem(itemText, { file: null });
    if (parsedItem.ok) {
      const outboxDir = ctx.layout.outboxDir(parsedItem.item.prd);
      if (outboxDir !== null && !isUnder(inRoot(ctx, outboxDir), inRoot(ctx, positional[0]))) {
        throw usageError(`omni adopt: ${file} is not under ${outboxDir}, PRD ${parsedItem.item.prd}'s outbox directory.`);
      }
    }
    const result = withPrdFolder("adopt", () => adoptItem({ ctx, itemText }));
    if (!result.ok) {
      println(stderr, "omni adopt \u2014 nothing was written:");
      for (const error of result.errors) println(stderr, `  - ${error}`);
      return 1;
    }
    rmSync2(inRoot(ctx, positional[0]));
    println(
      stdout,
      `omni adopt \u2014 ${result.item.id} adopted; appended to ${result.settledFile}; removed ${file}. Commit the append and the deletion together.`
    );
    return 0;
  }
};

// kit/bin/commands/ask.mjs
init_define_OMNI_BUNDLE();

// kit/lib/ask/client.mjs
init_define_OMNI_BUNDLE();
var CALL_TIMEOUT_MS = 5e3;
var AskCallError = class extends Error {
  constructor(message, { status: status3 = null } = {}) {
    super(message);
    this.name = "AskCallError";
    this.status = status3;
  }
};
function askClient({ baseUrl, host, tokens, fetch = globalThis.fetch, callMs = CALL_TIMEOUT_MS }) {
  const root = baseUrl.replace(/\/+$/, "");
  const segment = (value) => encodeURIComponent(value);
  async function send(method, path, { body, token, timeoutMs }) {
    const headers = { accept: "application/json" };
    if (body !== void 0) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;
    try {
      return await fetch(`${root}${path}`, {
        method,
        headers,
        body: body === void 0 ? void 0 : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      throw new AskCallError(`${method} ${path}: ${error?.name === "TimeoutError" ? "timed out" : "unreachable"}`);
    }
  }
  async function bodyOf(response) {
    const text2 = await response.text().catch(() => "");
    if (!text2) return {};
    try {
      return JSON.parse(text2);
    } catch {
      return {};
    }
  }
  async function refresh(current) {
    if (!current.refresh_token) return null;
    let response;
    try {
      response = await send("POST", "/api/ask/token", { body: { refresh_token: current.refresh_token }, timeoutMs: callMs });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    const fresh = await bodyOf(response);
    if (typeof fresh.access_token !== "string" || !fresh.access_token) return null;
    const kept = { ...current, ...fresh };
    tokens.write(host, kept);
    return kept;
  }
  async function call(method, path, { body, timeoutMs = callMs } = {}) {
    const current = tokens.read(host);
    if (!current?.access_token) throw new AskCallError(`not signed in to ${host}`);
    let response = await send(method, path, { body, token: current.access_token, timeoutMs });
    if (response.status === 401) {
      const fresh = await refresh(current);
      if (!fresh) throw new AskCallError(`${method} ${path}: sign-in refused`, { status: 401 });
      response = await send(method, path, { body, token: fresh.access_token, timeoutMs });
    }
    if (!response.ok) throw new AskCallError(`${method} ${path}: ${response.status}`, { status: response.status });
    return bodyOf(response);
  }
  return {
    /** @returns {Promise<{ id: string, url: string }>} */
    openSession: (title) => call("POST", "/api/ask/sessions", { body: { title } }),
    closeSession: (sessionId) => call("POST", `/api/ask/sessions/${segment(sessionId)}/close`),
    /** `questions` is `AskUserQuestion`'s input as is. @returns {Promise<{ roundId: string }>} */
    openRound: (sessionId, questions) => call("POST", `/api/ask/sessions/${segment(sessionId)}/rounds`, { body: { questions } }),
    /** Held by the server up to 50 s. @returns {Promise<{ status: 'open'|'answered'|'abandoned'|'closed', answers?: Record<string, string> }>} */
    wait: (roundId, { timeoutMs = callMs } = {}) => call("GET", `/api/ask/rounds/${segment(roundId)}/wait`, { timeoutMs }),
    /** An answer given in the terminal. */
    answer: (roundId, answers) => call("POST", `/api/ask/rounds/${segment(roundId)}/answers`, { body: { answers, via: "terminal" } }),
    abandon: (roundId) => call("POST", `/api/ask/rounds/${segment(roundId)}/abandon`)
  };
}

// kit/lib/ask/client-tokens.mjs
init_define_OMNI_BUNDLE();
import { chmodSync, mkdirSync as mkdirSync2, readFileSync as readFileSync5, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir } from "node:os";
import { dirname as dirname2, join as join7 } from "node:path";
var FILE = [".config", "omni", "credentials.json"];
function readAll(file) {
  try {
    const value = JSON.parse(readFileSync5(file, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
function homeTokens({ home = homedir() } = {}) {
  const file = join7(home, ...FILE);
  return {
    read(host) {
      const entry = readAll(file)[host];
      return entry && typeof entry.access_token === "string" && entry.access_token ? entry : null;
    },
    write(host, tokens) {
      const all = { ...readAll(file), [host]: tokens };
      mkdirSync2(dirname2(file), { recursive: true, mode: 448 });
      writeFileSync2(file, `${JSON.stringify(all, null, 2)}
`, { mode: 384 });
      chmodSync(file, 384);
    }
  };
}

// kit/lib/ask/hook.mjs
init_define_OMNI_BUNDLE();

// kit/lib/ask/local-state.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync6, mkdirSync as mkdirSync3, readFileSync as readFileSync6, rmSync as rmSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { dirname as dirname3, join as join8 } from "node:path";
var LOCAL_DIR = join8(dirname3(CONFIG_FILE), "local");
var SESSION_FILE = "ask.json";
var ROUND_FILE = "ask-round.json";
var ROUND_STATUSES = ["open", "answered", "abandoned"];
var isText = (value) => typeof value === "string" && value.length > 0;
function localFile(root, file) {
  return join8(root, LOCAL_DIR, file);
}
function ensureLocalDir(root) {
  const dir = join8(root, LOCAL_DIR);
  mkdirSync3(dir, { recursive: true });
  const ignore = join8(dir, ".gitignore");
  if (!existsSync6(ignore)) writeFileSync3(ignore, "*\n");
}
function readJson(root, file) {
  try {
    const value = JSON.parse(readFileSync6(localFile(root, file), "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
function writeJson(root, file, value) {
  ensureLocalDir(root);
  writeFileSync3(localFile(root, file), `${JSON.stringify(value, null, 2)}
`);
}
function readSession(root) {
  const value = readJson(root, SESSION_FILE);
  if (!value || !isText(value.sessionId) || !isText(value.url) || !isText(value.host)) return null;
  return { sessionId: value.sessionId, url: value.url, host: value.host };
}
function writeSession(root, { sessionId, url, host }) {
  writeJson(root, SESSION_FILE, { sessionId, url, host });
}
function clearSession(root) {
  rmSync3(localFile(root, SESSION_FILE), { force: true });
}
function readRound(root) {
  const value = readJson(root, ROUND_FILE);
  if (!value || !isText(value.roundId)) return null;
  return {
    roundId: value.roundId,
    toolUseId: isText(value.toolUseId) ? value.toolUseId : null,
    status: ROUND_STATUSES.includes(value.status) ? value.status : "open"
  };
}
function writeRound(root, { roundId, toolUseId = null, status: status3 }) {
  writeJson(root, ROUND_FILE, { roundId, toolUseId, status: status3 });
}
function clearRound(root) {
  rmSync3(localFile(root, ROUND_FILE), { force: true });
}

// kit/lib/ask/hook.mjs
var TOOL = "AskUserQuestion";
var PROMPT_CONTEXT = "Ask mode is on: ask every question to the person through the AskUserQuestion tool, never as plain text.";
var WAIT_LIMITS = Object.freeze({ totalMs: 54e4, callMs: 6e4 });
function activeSession(root) {
  const session = readSession(root);
  if (!session) return null;
  let baseUrl;
  try {
    baseUrl = loadConfig(root).ask.url;
  } catch {
    return null;
  }
  if (!baseUrl || new URL(baseUrl).host !== session.host) return null;
  return { session, baseUrl };
}
function toolAnswers(questions, answers) {
  if (!Array.isArray(questions) || questions.length === 0) return null;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  const shaped = {};
  for (const { question } of questions) {
    const given = answers[question];
    const text2 = Array.isArray(given) && given.every((label) => typeof label === "string") ? given.join(", ") : given;
    if (typeof text2 !== "string" || text2 === "") return null;
    shaped[question] = text2;
  }
  return shaped;
}
function promptOutput() {
  return { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: PROMPT_CONTEXT } };
}
function preOutput(toolInput, answers) {
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { ...toolInput, answers } } };
}
async function preHook({ root, session, client, input, limits = WAIT_LIMITS, now = Date.now }) {
  if (input?.tool_name !== TOOL) return null;
  const toolInput = input.tool_input;
  const questions = toolInput?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return null;
  const toolUseId = typeof input.tool_use_id === "string" ? input.tool_use_id : null;
  const deadline = now() + limits.totalMs;
  let roundId;
  try {
    ({ roundId } = await client.openRound(session.sessionId, questions));
  } catch {
    return null;
  }
  if (typeof roundId !== "string" || roundId === "") return null;
  const keep = (status3) => writeRound(root, { roundId, toolUseId, status: status3 });
  keep("open");
  const giveUp = async () => {
    await client.abandon(roundId).catch(() => {
    });
    keep("abandoned");
    return null;
  };
  for (; ; ) {
    const left = deadline - now();
    if (left <= 0) return giveUp();
    let result;
    try {
      result = await client.wait(roundId, { timeoutMs: Math.min(limits.callMs, left) });
    } catch {
      return giveUp();
    }
    if (result?.status === "open") continue;
    if (result?.status === "closed") {
      clearRound(root);
      clearSession(root);
      return null;
    }
    if (result?.status === "abandoned") {
      keep("abandoned");
      return null;
    }
    const answers = result?.status === "answered" ? toolAnswers(questions, result.answers) : null;
    if (!answers) return giveUp();
    keep("answered");
    return preOutput(toolInput, answers);
  }
}
async function postHook({ root, client, input }) {
  const round = readRound(root);
  if (!round) return;
  try {
    const toolUseId = typeof input?.tool_use_id === "string" ? input.tool_use_id : null;
    if (round.toolUseId && toolUseId && round.toolUseId !== toolUseId) return;
    if (round.status === "answered") return;
    const questions = input?.tool_input?.questions ?? input?.tool_response?.questions;
    const answers = toolAnswers(questions, input?.tool_response?.answers ?? input?.tool_input?.answers);
    if (answers) await client.answer(round.roundId, answers);
  } catch {
  } finally {
    clearRound(root);
  }
}

// kit/lib/ask/mode.mjs
init_define_OMNI_BUNDLE();
import { basename } from "node:path";
var TITLE_MAX = 200;
var AskModeError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "AskModeError";
  }
};
var QUIET = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
function attempt(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}
function currentBranch(root, exec) {
  return attempt(() => exec("git", ["branch", "--show-current"], { cwd: root, ...QUIET }).trim()) || attempt(() => exec("git", ["rev-parse", "--short", "HEAD"], { cwd: root, ...QUIET }).trim()) || "HEAD";
}
function sessionTitle({ slug, branch, root }) {
  return `${slug || basename(root)} \xB7 ${branch}`.slice(0, TITLE_MAX);
}
var hostOf = (askUrl2) => new URL(askUrl2).host;
function refusal(host, error) {
  if (error?.status === 401) return `the sign-in to ${host} was refused \u2014 run \`omni signin\` again`;
  if (error?.status === 403) return `${host} does not let this account open a session`;
  return `could not open a session on ${host} (${error?.message ?? error})`;
}
async function turnOn({ root, askUrl: askUrl2, title, tokens, fetch }) {
  const host = hostOf(askUrl2);
  if (!tokens.read(host)) throw new AskModeError(`not signed in to ${host} \u2014 run \`omni signin\` first`);
  const client = askClient({ baseUrl: askUrl2, host, tokens, fetch });
  let opened;
  try {
    opened = await client.openSession(title);
  } catch (error) {
    throw new AskModeError(refusal(host, error));
  }
  const sessionId = typeof opened?.id === "string" ? opened.id : "";
  const url = typeof opened?.url === "string" ? attempt(() => new URL(opened.url, askUrl2).href) : null;
  if (!sessionId || !url) throw new AskModeError(`could not open a session on ${host} (it answered with no session link)`);
  const replaced = readSession(root);
  writeSession(root, { sessionId, url, host });
  clearRound(root);
  const leftOpen = replaced && replaced.sessionId !== sessionId ? await closeSession(client, replaced, host) : null;
  return { url, replaced: replaced && { sessionId: replaced.sessionId }, leftOpen };
}
async function closeSession(client, session, host) {
  if (!client || session.host !== host) return `ask.url no longer names ${session.host}`;
  try {
    await client.closeSession(session.sessionId);
    return null;
  } catch (error) {
    return error?.status === 404 ? null : error?.message ?? String(error);
  }
}
async function turnOff({ root, askUrl: askUrl2, tokens, fetch }) {
  const session = readSession(root);
  let leftOpen = null;
  if (session) {
    const host = askUrl2 ? hostOf(askUrl2) : null;
    const client = host === session.host ? askClient({ baseUrl: askUrl2, host, tokens, fetch }) : null;
    leftOpen = await closeSession(client, session, host);
  }
  clearSession(root);
  clearRound(root);
  return { session: session && { sessionId: session.sessionId, host: session.host }, leftOpen };
}
function modeStatus(root) {
  return activeSession(root)?.session.url ?? null;
}

// kit/lib/init/repo.mjs
init_define_OMNI_BUNDLE();
import { realpathSync as realpathSync2 } from "node:fs";
var QUIET2 = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
function attempt2(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}
function findRoot(cwd, exec) {
  const root = attempt2(() => exec("git", ["rev-parse", "--show-toplevel"], { cwd, ...QUIET2 }).trim());
  if (!root) throw new ConfigError(`${cwd} is not inside a git repository.`);
  return realpathSync2(root);
}
function readRepo(root, { exec, remote }) {
  const gh = attempt2(() => JSON.parse(exec("gh", ["repo", "view", "--json", "nameWithOwner,defaultBranchRef"], { cwd: root, ...QUIET2 })));
  const slug = gh?.nameWithOwner || attempt2(() => slugFromRemote(exec("git", ["remote", "get-url", remote], { cwd: root, ...QUIET2 })));
  const head = attempt2(() => exec("git", ["symbolic-ref", `refs/remotes/${remote}/HEAD`], { cwd: root, ...QUIET2 }).trim());
  const prefix = `refs/remotes/${remote}/`;
  const defaultBranch = gh?.defaultBranchRef?.name || (head?.startsWith(prefix) ? head.slice(prefix.length) : null);
  return { slug: slug || null, defaultBranch: defaultBranch || null };
}

// kit/bin/commands/signin.mjs
init_define_OMNI_BUNDLE();
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

// kit/lib/ask/credentials.mjs
init_define_OMNI_BUNDLE();
import { chmodSync as chmodSync2, readFileSync as readFileSync7, rmSync as rmSync4, writeFileSync as writeFileSync4 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join9 } from "node:path";
var FILE2 = [".config", "omni", "credentials.json"];
var EXCHANGE_TIMEOUT_MS = 1e4;
var SignInError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SignInError";
  }
};
var credentialsHost = (askUrl2) => new URL(askUrl2).host;
var askEndpoint = (askUrl2, path) => `${askUrl2.replace(/\/+$/, "")}${path}`;
var isText2 = (value) => typeof value === "string" && value.length > 0;
function tokenEntry(reply) {
  if (!reply || typeof reply !== "object" || Array.isArray(reply)) return null;
  const { access_token, refresh_token, expires_at, email } = reply;
  if (!isText2(access_token) || !isText2(refresh_token) || !isText2(email)) return null;
  return { access_token, refresh_token, expires_at: typeof expires_at === "number" ? expires_at : null, email };
}
function credentials({ home = homedir2() } = {}) {
  const file = join9(home, ...FILE2);
  const tokens = homeTokens({ home });
  return {
    file,
    /** The host's entry, or `null`. */
    read: (host) => tokens.read(host),
    /** Keeps the host's entry, and every other host's, at mode 0600. */
    write: (host, entry) => tokens.write(host, entry),
    /** Forgets the host; `true` when it had an entry. The file goes with its last host. */
    remove(host) {
      let all;
      try {
        all = JSON.parse(readFileSync7(file, "utf8"));
      } catch {
        return false;
      }
      if (!all || typeof all !== "object" || Array.isArray(all) || !Object.hasOwn(all, host)) return false;
      delete all[host];
      if (Object.keys(all).length === 0) {
        rmSync4(file, { force: true });
      } else {
        writeFileSync4(file, `${JSON.stringify(all, null, 2)}
`, { mode: 384 });
        chmodSync2(file, 384);
      }
      return true;
    }
  };
}
async function replyOf(response) {
  const text2 = await response.text().catch(() => "");
  try {
    return text2 ? JSON.parse(text2) : {};
  } catch {
    return {};
  }
}
async function exchangeCode({ askUrl: askUrl2, code, fetch = globalThis.fetch, timeoutMs = EXCHANGE_TIMEOUT_MS }) {
  const endpoint = askEndpoint(askUrl2, "/api/ask/token");
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const why = error?.name === "TimeoutError" ? "it did not answer in time" : "it is unreachable";
    throw new SignInError(`could not reach ${credentialsHost(askUrl2)} to finish the sign-in: ${why}.`);
  }
  const reply = await replyOf(response);
  if (!response.ok) {
    const reason = isText2(reply?.error) ? reply.error : `HTTP ${response.status}`;
    throw new SignInError(`the sign-in was refused: ${reason}`);
  }
  const entry = tokenEntry(reply);
  if (!entry) throw new SignInError("the sign-in server answered with no tokens.");
  return entry;
}

// kit/lib/ask/loopback.mjs
init_define_OMNI_BUNDLE();
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
var LOOPBACK_WAIT_MS = 5 * 6e4;
var HOST = "127.0.0.1";
var PATH = "/callback";
var LoopbackError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "LoopbackError";
  }
};
function page(title, text2) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="font:17px/1.6 system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1rem"><h1 style="font-size:1.3rem">${title}</h1><p>${text2}</p></body></html>`;
}
var SIGNED_IN = page("Back to the terminal", "The terminal is finishing the sign-in. You can close this tab.");
var NOT_OURS = page("Sign-in refused", "This sign-in was not started by this terminal. Run <code>omni signin</code> again.");
var NO_CODE = page("Sign-in incomplete", "The sign-in came back without its code. Run <code>omni signin</code> again.");
var sameText = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
async function startLoopback({ state, timeoutMs = LOOPBACK_WAIT_MS }) {
  if (typeof state !== "string" || state.length === 0) throw new LoopbackError("the listener needs a state to compare with.");
  let settle2;
  const code = new Promise((resolve, reject) => {
    settle2 = { resolve, reject };
  });
  code.catch(() => {
  });
  let done = false;
  const server = createServer((request, response) => {
    const answer = (status3, body, type = "text/html; charset=utf-8") => {
      response.writeHead(status3, { "content-type": type, "cache-control": "no-store", connection: "close" });
      response.end(body);
    };
    const url = new URL(request.url ?? "/", `http://${HOST}`);
    if (request.method !== "GET" || url.pathname !== PATH || done) return answer(404, "not found\n", "text/plain; charset=utf-8");
    if (!sameText(url.searchParams.get("state") ?? "", state)) return answer(400, NOT_OURS);
    const given = url.searchParams.get("code");
    if (!given) return answer(400, NO_CODE);
    done = true;
    response.on("finish", () => finish(() => settle2.resolve(given)));
    return answer(200, SIGNED_IN);
  });
  let closedResolve;
  const closed = new Promise((resolve) => {
    closedResolve = resolve;
  });
  let timer;
  function finish(outcome) {
    done = true;
    clearTimeout(timer);
    outcome();
    server.close(() => closedResolve());
    server.closeAllConnections();
  }
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const { port, address } = server.address();
  const minutes = Math.round(timeoutMs / 6e4);
  timer = setTimeout(
    () => finish(() => settle2.reject(new LoopbackError(`no sign-in came back within ${minutes >= 1 ? `${minutes} min` : `${timeoutMs} ms`}.`))),
    timeoutMs
  );
  return {
    port,
    address,
    redirectUri: `http://${HOST}:${port}${PATH}`,
    code,
    closed,
    async close() {
      if (server.listening) finish(() => settle2.reject(new LoopbackError("the listener was stopped before a sign-in came back.")));
      await closed;
    }
  };
}

// kit/bin/commands/signin.mjs
var ASK_URL_UNSET = "ask mode is not set up for this repository (ask.url)";
function openInBrowser(url, { platform = process.platform } = {}) {
  const [command, args] = platform === "darwin" ? ["open", [url]] : platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : ["xdg-open", [url]];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {
  });
  child.unref();
}
function askUrlOf(cwd, exec) {
  return loadContext(cwd, { exec }).config.ask.url;
}
function noArguments(name, args) {
  const { positional } = parseArgs(name, args);
  if (positional.length > 0) throw usageError(`usage: omni ${name}`);
}
var signin = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, home, openBrowser = openInBrowser, fetch = globalThis.fetch, waitMs = LOOPBACK_WAIT_MS }) {
    noArguments("signin", args);
    const askUrl2 = askUrlOf(cwd, exec);
    if (!askUrl2) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const state = randomBytes(32).toString("base64url");
    const listener = await startLoopback({ state, timeoutMs: waitMs });
    try {
      const page2 = new URL(askEndpoint(askUrl2, "/ask/signin"));
      page2.searchParams.set("port", String(listener.port));
      page2.searchParams.set("state", state);
      println(stdout, `Sign in in your browser: ${page2}`);
      try {
        await openBrowser(page2.toString());
      } catch {
      }
      const code = await listener.code;
      const entry = await exchangeCode({ askUrl: askUrl2, code, fetch });
      credentials({ home }).write(credentialsHost(askUrl2), entry);
      println(stdout, `signed in as ${entry.email}`);
      return 0;
    } catch (error) {
      if (!(error instanceof LoopbackError) && !(error instanceof SignInError)) throw error;
      println(stderr, `omni signin: ${error.message}`);
      return 1;
    } finally {
      await listener.close();
    }
  }
};
var signout = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, home }) {
    noArguments("signout", args);
    const askUrl2 = askUrlOf(cwd, exec);
    if (!askUrl2) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const host = credentialsHost(askUrl2);
    println(stdout, credentials({ home }).remove(host) ? `signed out of ${host}` : "signed out");
    return 0;
  }
};
var whoami = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, home }) {
    noArguments("whoami", args);
    const askUrl2 = askUrlOf(cwd, exec);
    if (!askUrl2) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const entry = credentials({ home }).read(credentialsHost(askUrl2));
    println(stdout, entry ? entry.email ?? `signed in to ${credentialsHost(askUrl2)}` : "signed out");
    return 0;
  }
};

// kit/bin/commands/ask.mjs
var KINDS = ["pre", "post", "prompt"];
var MODES = ["on", "off", "status"];
var USAGE = "usage: omni ask hook <pre|post|prompt> | omni ask <on|off|status>";
async function readInput(stdin) {
  let text2 = "";
  if (typeof stdin === "string") {
    text2 = stdin;
  } else {
    if (!stdin || stdin.isTTY) return null;
    stdin.setEncoding?.("utf8");
    for await (const chunk of stdin) text2 += chunk;
  }
  try {
    const value = JSON.parse(text2);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
async function runHook(kind, { cwd, exec, stdin, tokens, fetch, limits }) {
  try {
    const root = findRoot(cwd, exec);
    const active = activeSession(root);
    if (!active) return null;
    if (kind === "prompt") return promptOutput();
    const input = await readInput(stdin);
    if (!input) return null;
    const { session, baseUrl } = active;
    const client = askClient({ baseUrl, host: session.host, tokens: tokens ?? homeTokens(), fetch });
    if (kind === "pre") return await preHook({ root, session, client, input, limits });
    await postHook({ root, client, input });
    return null;
  } catch {
    return null;
  }
}
async function runMode(mode, { cwd, stdout, stderr, exec, tokens, fetch }) {
  const ctx = loadContext(cwd, { exec });
  const { root } = ctx;
  const askUrl2 = ctx.config.ask.url;
  const store = tokens ?? homeTokens();
  if (mode === "status") {
    println(stdout, modeStatus(root) ?? "off");
    return 0;
  }
  if (mode === "off") {
    const { session, leftOpen } = await turnOff({ root, askUrl: askUrl2, tokens: store, fetch });
    if (session && leftOpen) {
      println(stderr, `omni ask off: could not close the session on ${session.host} (${leftOpen}); it closes by itself after 12 hours without a call.`);
    }
    println(stdout, "off");
    return 0;
  }
  if (!askUrl2) {
    println(stderr, ASK_URL_UNSET);
    return 1;
  }
  const title = sessionTitle({ slug: ctx.config.repo.slug, branch: currentBranch(root, exec), root });
  try {
    const { url, replaced, leftOpen } = await turnOn({ root, askUrl: askUrl2, title, tokens: store, fetch });
    if (replaced && leftOpen) {
      println(stderr, `omni ask on: the session this one replaces could not be closed (${leftOpen}); it closes by itself after 12 hours without a call.`);
    }
    println(stdout, url);
    return 0;
  } catch (error) {
    if (!(error instanceof AskModeError)) throw error;
    println(stderr, `omni ask on: ${error.message}`);
    return 1;
  }
}
var ask = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, stdin = process.stdin, tokens, fetch = globalThis.fetch, limits = WAIT_LIMITS }) {
    const { positional } = parseArgs("ask", args);
    const [sub, kind, ...rest] = positional;
    if (MODES.includes(sub) && positional.length === 1) return runMode(sub, { cwd, stdout, stderr, exec, tokens, fetch });
    if (sub !== "hook" || !KINDS.includes(kind) || rest.length > 0) throw usageError(USAGE);
    const output = await runHook(kind, { cwd, exec, stdin, tokens, fetch, limits });
    if (output) println(stdout, JSON.stringify(output));
    return 0;
  }
};

// kit/bin/commands/board.mjs
init_define_OMNI_BUNDLE();
import { readFileSync as readFileSync8 } from "node:fs";
import { join as join10 } from "node:path";

// kit/lib/board.mjs
init_define_OMNI_BUNDLE();

// kit/lib/inbox/territory.mjs
init_define_OMNI_BUNDLE();
var NOTHING = /^[—–-]?$/;
function blockedByCell(cell) {
  const text2 = (cell ?? "").trim();
  if (NOTHING.test(text2)) return [];
  return text2.split(/[\s,]+/).map((token) => token.replace(/`/g, "").trim()).filter(Boolean);
}
function territoryPrefixes(cell) {
  const text2 = (cell ?? "").trim();
  if (NOTHING.test(text2)) return [];
  return [...text2.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim()).filter(Boolean);
}
function prefixOf(declaration) {
  return declaration.replace(/\*+$/, "");
}
function cells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}
function isTableRow(line) {
  return line.trim().startsWith("|");
}
function isSeparatorRow(line) {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}
function parsePlanSlices(markdown) {
  const lines = markdown.split("\n");
  let headerIndex = -1;
  let foundAnyIdTable = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isTableRow(line) && /^\|\s*id\s*\|/i.test(line.trim())) {
      foundAnyIdTable = true;
      const header2 = cells(line).map((name) => name.toLowerCase());
      if (header2.indexOf("territory") !== -1) {
        headerIndex = i;
        break;
      }
    }
  }
  if (headerIndex === -1) {
    if (foundAnyIdTable) {
      throw new Error(
        "This plan's slice table has no `territory` column; it predates the territory discipline and cannot be graded."
      );
    }
    throw new Error("No slice table was found in this plan; its slices declare no territory.");
  }
  const header = cells(lines[headerIndex]).map((name) => name.toLowerCase());
  const column = (name) => header.indexOf(name);
  const slices = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isTableRow(line)) break;
    if (isSeparatorRow(line)) continue;
    const row = cells(line);
    const id = row[column("id")];
    if (!id) continue;
    slices.push({
      id,
      title: column("slice") === -1 ? "" : row[column("slice")] ?? "",
      territory: territoryPrefixes(row[column("territory")]),
      blockedBy: column("blocked by") === -1 ? [] : blockedByCell(row[column("blocked by")]),
      wave: column("wave") === -1 ? null : Number(row[column("wave")])
    });
  }
  if (slices.length === 0) {
    throw new Error("The slice table holds no slice; there is nothing to grade.");
  }
  return slices;
}
function sharedGround(left, right) {
  const shared = /* @__PURE__ */ new Set();
  for (const a of left.territory) {
    for (const b of right.territory) {
      const [x, y] = [prefixOf(a), prefixOf(b)];
      if (x.startsWith(y)) shared.add(x.length >= y.length ? y : x);
      else if (y.startsWith(x)) shared.add(x);
    }
  }
  return [...shared];
}
function collisions(slices) {
  const pairs = [];
  for (let i = 0; i < slices.length; i += 1) {
    for (let j = i + 1; j < slices.length; j += 1) {
      const shared = sharedGround(slices[i], slices[j]);
      if (shared.length > 0) pairs.push({ left: slices[i].id, right: slices[j].id, shared });
    }
  }
  return pairs;
}
function sameWaveCollisions(slices) {
  const waveOf = new Map(slices.map((slice) => [slice.id, slice.wave]));
  return collisions(slices).filter(({ left, right }) => waveOf.get(left) === waveOf.get(right)).map((pair) => ({ ...pair, wave: waveOf.get(pair.left) }));
}
function collisionRows(slices) {
  const waveOf = new Map(slices.map((slice) => [slice.id, slice.wave]));
  return collisions(slices).map(({ left, right, shared }) => ({
    pair: `${left} \xB7 ${right}`,
    shared: shared.map((ground) => `\`${ground}\``).join(", "),
    resolved: `${left} w${waveOf.get(left)} \xB7 ${right} w${waveOf.get(right)}`
  }));
}

// kit/lib/board.mjs
function fillBranch(template, values) {
  return template.replace(/\{(topic|slice)\}/g, (whole, key) => values[key] ?? whole);
}
function isMerged(pr) {
  return pr.state === "MERGED" || Boolean(pr.mergedAt);
}
function isLive(pr) {
  return isMerged(pr) || pr.state === "OPEN";
}
function hasLabel(pr, name) {
  return (pr.labels ?? []).some((label) => (typeof label === "string" ? label : label?.name) === name);
}
function matchesFeature(pr, { matchBy, featureBranch, subLabel }) {
  return matchBy === "label" ? hasLabel(pr, subLabel) : pr.baseRefName === featureBranch;
}
function pickPr(candidates) {
  if (candidates.length === 0) return null;
  const merged = candidates.filter(isMerged);
  const pool = merged.length > 0 ? merged : candidates;
  return pool.reduce((best, pr) => {
    if (!best) return pr;
    return new Date(pr.updatedAt).getTime() > new Date(best.updatedAt).getTime() ? pr : best;
  }, null);
}
function hasCommitBeyondClaim(pr) {
  if (!pr.headCommitDate || !pr.createdAt) return true;
  return new Date(pr.headCommitDate).getTime() > new Date(pr.createdAt).getTime();
}
function isClaimedStale(pr, now, staleMinutes) {
  if (!pr.isDraft) return false;
  if (hasCommitBeyondClaim(pr)) return false;
  const ageMs = now - new Date(pr.createdAt).getTime();
  return ageMs > staleMinutes * 60 * 1e3;
}
function stateFor({ pr, blockersMerged, now, limits, needsFixLabel }) {
  if (!pr) return blockersMerged ? "runnable" : "blocked";
  if (isMerged(pr)) return "merged";
  if (hasLabel(pr, needsFixLabel)) return "stuck";
  if (isClaimedStale(pr, now, limits.claimStaleMinutes)) return "claimed-stale";
  return "in-flight";
}
var TAKEABLE_STATES = /* @__PURE__ */ new Set(["runnable", "claimed-stale"]);
function runnableFrontier(rows) {
  const takeableRows = rows.filter((row) => TAKEABLE_STATES.has(row.state));
  if (takeableRows.length === 0) return { wave: null, runnable: [], takeable: [], excluded: [], collisions: [] };
  const wave = Math.min(...takeableRows.map((row) => row.wave));
  const inWave = takeableRows.filter((row) => row.wave === wave);
  const collisions2 = sameWaveCollisions(inWave);
  const collidesWith = /* @__PURE__ */ new Map();
  for (const { left, right } of collisions2) {
    if (!collidesWith.has(left)) collidesWith.set(left, /* @__PURE__ */ new Set());
    if (!collidesWith.has(right)) collidesWith.set(right, /* @__PURE__ */ new Set());
    collidesWith.get(left).add(right);
    collidesWith.get(right).add(left);
  }
  const kept = [];
  const excluded = [];
  for (const row of inWave) {
    const rivals = collidesWith.get(row.id);
    const alreadyKeptRival = rivals && kept.some((keptRow) => rivals.has(keptRow.id));
    if (alreadyKeptRival) excluded.push(row.id);
    else kept.push(row);
  }
  return {
    wave,
    takeable: kept.map((row) => row.id),
    runnable: kept.filter((row) => row.state === "runnable").map((row) => row.id),
    excluded,
    collisions: collisions2
  };
}
function boardFor({ slices, prs = [], now = Date.now(), limits, config: config2, prd: prd2 }) {
  const { topic } = prd2;
  const featureBranch = fillBranch(config2.branches.feature, { topic });
  const live = prs.filter(isLive);
  const matched = new Map(
    slices.map((slice) => {
      const sliceBranch = fillBranch(config2.branches.slice, { topic, slice: slice.id });
      const candidates = live.filter(
        (pr) => pr.headRefName === sliceBranch && matchesFeature(pr, { matchBy: config2.board.matchBy, featureBranch, subLabel: config2.labels.sub })
      );
      return [slice.id, pickPr(candidates)];
    })
  );
  const mergedById = new Map([...matched].map(([id, pr]) => [id, Boolean(pr && isMerged(pr))]));
  const rows = slices.map((slice) => {
    const pr = matched.get(slice.id) ?? null;
    const blockersMerged = (slice.blockedBy ?? []).every((blockerId) => mergedById.get(blockerId) === true);
    const state = stateFor({ pr, blockersMerged, now, limits, needsFixLabel: config2.labels.needsFix });
    return { ...slice, pr, state };
  });
  return { prd: { topic }, slices: rows, frontier: runnableFrontier(rows) };
}

// kit/bin/github.mjs
init_define_OMNI_BUNDLE();
import { execFileSync as execFileSync2 } from "node:child_process";
function ghClient({ owner, repo, issue, exec = execFileSync2, env }) {
  const repoSlug2 = `${owner}/${repo}`;
  const options = (extra = {}) => ({ encoding: "utf8", ...extra, ...env ? { env } : {} });
  return {
    listComments: () => JSON.parse(exec("gh", ["api", `repos/${repoSlug2}/issues/${issue}/comments`, "--paginate"], options())),
    createComment: (body) => JSON.parse(
      exec(
        "gh",
        ["api", `repos/${repoSlug2}/issues/${issue}/comments`, "--input", "-"],
        options({ input: JSON.stringify({ body }) })
      )
    ),
    updateComment: (id, body) => JSON.parse(
      exec(
        "gh",
        ["api", "-X", "PATCH", `repos/${repoSlug2}/issues/comments/${id}`, "--input", "-"],
        options({ input: JSON.stringify({ body }) })
      )
    )
  };
}
function githubEnv(ctx, { exec = execFileSync2, env = process.env } = {}) {
  const user = ctx.config.github.user;
  if (!user) return void 0;
  const token = String(
    exec("gh", ["auth", "token", "--user", user], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  ).trim();
  return { ...env, GH_TOKEN: token };
}
function githubClientFor(ctx, { repo = ctx.config.repo.slug, issue, exec = execFileSync2, env = process.env }) {
  const [owner, name] = String(repo ?? "").split("/");
  let resolved;
  let fetched = false;
  const lazyEnv = () => {
    if (!fetched) {
      resolved = githubEnv(ctx, { exec, env });
      fetched = true;
    }
    return resolved;
  };
  const client = () => ghClient({ owner, repo: name, issue, exec, env: lazyEnv() });
  return {
    listComments: () => client().listComments(),
    createComment: (body) => client().createComment(body),
    updateComment: (id, body) => client().updateComment(id, body)
  };
}

// kit/bin/commands/board.mjs
var USAGE2 = "usage: omni board <prd> [--json] [--repo <owner/name>]";
function readPlan(prd2, { ctx }) {
  const planPath = ctx.layout.planPath(prd2);
  if (planPath === null) throw usageError(`omni board: PRD ${prd2} has no inbox or shipped folder.`);
  try {
    return { planPath, markdown: readFileSync8(join10(ctx.root, planPath), "utf8") };
  } catch (error) {
    if (error?.code === "ENOENT") throw usageError(`omni board: no plan at ${planPath}.`);
    throw error;
  }
}
function topicFor(prd2, { ctx }) {
  const where = ctx.layout.whereIs(prd2);
  if (!where) throw usageError(`omni board: PRD ${prd2} has no inbox or shipped folder.`);
  const parsed = parseFolderName(where.name);
  if (!parsed) throw usageError(`omni board: cannot read a topic from folder "${where.name}".`);
  return parsed.topic;
}
var PR_FIELDS = ["number", "title", "headRefName", "baseRefName", "state", "isDraft", "mergedAt", "body", "labels", "updatedAt", "createdAt"];
function narrowingArgs({ matchBy, featureBranch, subLabel }) {
  return matchBy === "label" ? ["--label", subLabel] : ["--base", featureBranch];
}
function fetchPrList({ repo, exec, env, matchBy, featureBranch, subLabel }) {
  const options = { encoding: "utf8", ...env ? { env } : {} };
  const raw = exec(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      repo,
      "--json",
      PR_FIELDS.join(","),
      "--state",
      "all",
      "--limit",
      "200",
      ...narrowingArgs({ matchBy, featureBranch, subLabel })
    ],
    options
  );
  return JSON.parse(raw).map((pr) => ({ ...pr, headCommitDate: null }));
}
function couldBeStale(pr, now, staleMinutes) {
  if (!pr.isDraft || pr.state !== "OPEN" || !pr.createdAt) return false;
  return now - new Date(pr.createdAt).getTime() > staleMinutes * 60 * 1e3;
}
function fetchHeadCommitDate({ repo, number, exec, env }) {
  const options = { encoding: "utf8", ...env ? { env } : {} };
  const raw = exec("gh", ["pr", "view", String(number), "--repo", repo, "--json", "commits"], options);
  const commits = JSON.parse(raw).commits ?? [];
  const last = commits.at(-1);
  return last?.committedDate ?? last?.authoredDate ?? null;
}
function fetchHeadCommitDates(prs, { repo, exec, env, now, staleMinutes }) {
  return prs.map(
    (pr) => couldBeStale(pr, now, staleMinutes) ? { ...pr, headCommitDate: fetchHeadCommitDate({ repo, number: pr.number, exec, env }) } : pr
  );
}
var STATE_WIDTH = "claimed-stale".length;
function tableLine(row) {
  const prCol = row.pr ? `#${row.pr.number}` : "\u2014";
  return `  ${row.id.padEnd(6)} w${row.wave}  ${row.state.padEnd(STATE_WIDTH)}  ${prCol.padEnd(6)} ${row.title}`;
}
var board = {
  async run(args, { ctx, stdout, exec, env }) {
    const { positional, flags } = parseArgs("board", args, { values: ["repo"], booleans: ["json"] });
    if (positional.length !== 1) throw usageError(USAGE2);
    const prd2 = positiveInt("board", "<prd>", positional[0]);
    const { markdown } = readPlan(prd2, { ctx });
    let slices;
    try {
      slices = parsePlanSlices(markdown);
    } catch (error) {
      throw usageError(`omni board: ${error.message}`);
    }
    const topic = topicFor(prd2, { ctx });
    const featureBranch = fillBranch(ctx.config.branches.feature, { topic });
    const repo = repoSlug("board", ctx, flags.repo);
    const ghEnv = githubEnv(ctx, { exec, env });
    const now = Date.now();
    const matchBy = ctx.config.board.matchBy;
    const subLabel = ctx.config.labels.sub;
    const staleMinutes = ctx.config.limits.claimStaleMinutes;
    const listed = fetchPrList({ repo, exec, env: ghEnv, matchBy, featureBranch, subLabel });
    const prs = fetchHeadCommitDates(listed, { repo, exec, env: ghEnv, now, staleMinutes });
    const result = boardFor({ slices, prs, now, limits: ctx.config.limits, config: ctx.config, prd: { topic } });
    if (flags.json) {
      println(stdout, JSON.stringify(result, null, 2));
      return 0;
    }
    println(stdout, `omni board \u2014 PRD ${prd2}: ${slices.length} slice(s).`);
    for (const row of result.slices) println(stdout, tableLine(row));
    if (result.frontier.wave === null) {
      println(stdout, "omni board \u2014 runnable frontier: none \u2014 nothing is takeable right now.");
    } else {
      const takeable = result.frontier.takeable.join(", ") || "(none \u2014 every candidate collides with another)";
      println(stdout, `omni board \u2014 runnable frontier: wave ${result.frontier.wave} \u2014 takeable: ${takeable}`);
      println(stdout, `omni board \u2014 of which runnable (unclaimed): ${result.frontier.runnable.join(", ") || "(none)"}`);
      if (result.frontier.excluded.length > 0) {
        println(
          stdout,
          `omni board \u2014 deferred by a same-wave territory collision (kept the earlier slice in plan order): ${result.frontier.excluded.join(", ")}`
        );
      }
    }
    return 0;
  }
};

// kit/bin/commands/check.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync16 } from "node:fs";
import { join as join21 } from "node:path";

// kit/lib/check-report.mjs
init_define_OMNI_BUNDLE();
import { execFileSync as execFileSync3 } from "node:child_process";
import { readFileSync as readFileSync9 } from "node:fs";
import { join as join11 } from "node:path";
function trackedFiles(ctx) {
  return execFileSync3("git", ["ls-files"], { cwd: ctx.root, encoding: "utf8" }).split("\n").filter(Boolean).sort();
}
function readRepoFile(ctx, path) {
  return readFileSync9(join11(ctx.root, path), "utf8");
}
function formatFailure(title, violations) {
  if (violations.length === 0) return "";
  return [title, ...violations.map((line) => `  ${line}`)].join("\n");
}
function formatPass(message) {
  return message;
}

// kit/lib/git.mjs
init_define_OMNI_BUNDLE();
import { execFileSync as execFileSync4 } from "node:child_process";
function git(args, cwd, exec) {
  return exec("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function parseNameStatus(nameStatus) {
  return nameStatus.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [status3, ...paths] = line.split("	");
    return { status: status3[0], path: paths.at(-1) };
  });
}
function rangeChanges({ ctx, base, exec = execFileSync4 }) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`], ctx.root, exec);
  } catch (error) {
    throw new Error(
      `Cannot read ${base} \u2014 this guard cannot tell what this range changed. Fetch the base first (e.g. \`git fetch origin main\`).
${error.message}`
    );
  }
  return parseNameStatus(git(["diff", "--name-status", "--no-renames", `${base}...HEAD`], ctx.root, exec));
}

// kit/lib/inbox/check-inbox.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync8, readdirSync as readdirSync4, statSync } from "node:fs";
import { basename as basename3, dirname as dirname4, join as join13 } from "node:path";

// kit/lib/knowledge/registers.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync7, readFileSync as readFileSync10, readdirSync as readdirSync3 } from "node:fs";
import { basename as basename2, join as join12 } from "node:path";
var PRODUCT_CODE = "PRODUCT";
var LAYER_FILES = {
  "principles.md": "principle",
  "rules.md": "rule",
  "invariants.md": "invariant"
};
var ID_SOURCE = "X-[A-Z0-9]+-[A-Z0-9]+-\\d+|BR-[A-Z0-9]+-\\d+|P-[A-Z0-9]+-\\d+|N-[A-Z0-9]+-\\d+|N\\d+";
var ID_SHAPE = new RegExp(`^(?:${ID_SOURCE})$`);
var ID_TOKEN = new RegExp(`\\b(?:${ID_SOURCE})\\b`, "g");
var ENTRY_HEADING = new RegExp(`^##\\s+(${ID_SOURCE})\\s*$`);
var ANY_H2 = /^##\s/;
var FIELD_LINE = /^(Why|Decided|Source|Serves|Enforced by|Stated|Kind|Kept id|Glossary term):\s*(.*)$/;
var FIELD_KEY = {
  Why: "why",
  Decided: "decided",
  Source: "source",
  Serves: "serves",
  "Enforced by": "enforcedBy",
  Stated: "stated",
  Kind: "kindLine",
  "Kept id": "keptId",
  "Glossary term": "glossaryTerm"
};
function idsCitedIn(text2) {
  return [...new Set(text2.match(ID_TOKEN) ?? [])];
}
function codeOf(name) {
  return name.replace(/-/g, "").toUpperCase();
}
function idParts(id) {
  if (!ID_SHAPE.test(id)) return null;
  const core = id.match(/^N(\d+)$/);
  if (core) return { type: "CORE", codes: [], n: core[1] };
  const parts = id.split("-");
  return { type: parts[0], codes: parts.slice(1, -1), n: parts.at(-1) };
}
function readFields(lines) {
  const fields = {};
  const counts = {};
  let fieldAt = -1;
  let open = null;
  lines.forEach((line, index) => {
    const match = line.match(FIELD_LINE);
    if (match) {
      if (fieldAt === -1) fieldAt = index;
      const key = FIELD_KEY[match[1]];
      counts[key] = (counts[key] ?? 0) + 1;
      if (counts[key] === 1) {
        fields[key] = match[2].trim();
        open = key;
      } else {
        open = null;
      }
      return;
    }
    if (line.trim() === "") {
      open = null;
      return;
    }
    if (open) fields[open] = `${fields[open]} ${line.trim()}`.trim();
  });
  return { fields, counts, fieldAt };
}
function splitEntries(text2) {
  const entries = [];
  let current = null;
  for (const line of text2.split("\n")) {
    const match = line.match(ENTRY_HEADING);
    if (match) {
      if (current) entries.push(current);
      current = { id: match[1], lines: [] };
    } else if (ANY_H2.test(line)) {
      if (current) entries.push(current);
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) entries.push(current);
  return entries;
}
function parseEntryFile(file, text2, place) {
  return splitEntries(text2).map(({ id, lines }) => {
    const { fields, counts, fieldAt } = readFields(lines);
    const statement = (fieldAt === -1 ? lines : lines.slice(0, fieldAt)).filter((line) => line.trim().length > 0).join(" ").trim();
    const kind = place.kind ?? (fields.kindLine === "rule" || fields.kindLine === "invariant" ? fields.kindLine : null);
    const enforcedBy = fields.enforcedBy ?? null;
    return {
      id,
      kind,
      scope: place.scope,
      domain: place.domain,
      codes: place.codes,
      file,
      statement,
      why: fields.why ?? null,
      decided: fields.decided ?? null,
      source: fields.source ?? null,
      serves: fields.serves ?? null,
      enforcedBy,
      enforced: enforcedBy !== null && enforcedBy !== "unenforced",
      stated: fields.stated ?? null,
      kindLine: fields.kindLine ?? null,
      keptId: fields.keptId ?? null,
      fieldCounts: counts
    };
  });
}
function listDir(root, dir, predicate) {
  const abs = join12(root, dir);
  if (!existsSync7(abs)) return [];
  return readdirSync3(abs, { withFileTypes: true }).filter(predicate).map((entry) => entry.name).sort();
}
function glossaryTermOf(text2) {
  return readFields(text2.split("\n")).fields.glossaryTerm ?? null;
}
function productDir(ctx) {
  return `${ctx.layout.knowledgeRoot}/product`;
}
function domainsDir(ctx) {
  return `${ctx.layout.knowledgeRoot}/domains`;
}
function crossDomainDir(ctx) {
  return `${ctx.layout.knowledgeRoot}/cross-domain`;
}
function readKnowledge({ ctx }) {
  const entries = [];
  const PRODUCT_DIR = productDir(ctx);
  const DOMAINS_DIR = domainsDir(ctx);
  const CROSS_DOMAIN_DIR = crossDomainDir(ctx);
  const productFiles = listDir(ctx.root, PRODUCT_DIR, (entry) => entry.isFile());
  for (const [name, kind] of Object.entries(LAYER_FILES)) {
    if (!productFiles.includes(name)) continue;
    const file = `${PRODUCT_DIR}/${name}`;
    entries.push(
      ...parseEntryFile(file, readFileSync10(join12(ctx.root, file), "utf8"), {
        scope: "product",
        domain: "product",
        codes: [PRODUCT_CODE],
        kind
      })
    );
  }
  const domains = listDir(ctx.root, DOMAINS_DIR, (entry) => entry.isDirectory()).map((name) => {
    const dir = `${DOMAINS_DIR}/${name}`;
    const files = listDir(ctx.root, dir, (entry) => entry.isFile());
    const code = codeOf(name);
    for (const [layer, kind] of Object.entries(LAYER_FILES)) {
      if (!files.includes(layer)) continue;
      const file = `${dir}/${layer}`;
      entries.push(
        ...parseEntryFile(file, readFileSync10(join12(ctx.root, file), "utf8"), {
          scope: "domain",
          domain: name,
          codes: [code],
          kind
        })
      );
    }
    const glossaryTerm = files.includes("README.md") ? glossaryTermOf(readFileSync10(join12(ctx.root, dir, "README.md"), "utf8")) : null;
    return { name, code, files, glossaryTerm };
  });
  const crossDomainFiles = listDir(
    ctx.root,
    CROSS_DOMAIN_DIR,
    (entry) => entry.isFile() && entry.name.endsWith(".md")
  ).map((fileName) => {
    const name = basename2(fileName, ".md");
    const halves = name.split("--");
    const pair = halves.length === 2 && halves.every(Boolean) ? halves : null;
    const file = `${CROSS_DOMAIN_DIR}/${fileName}`;
    entries.push(
      ...parseEntryFile(file, readFileSync10(join12(ctx.root, file), "utf8"), {
        scope: "cross-domain",
        domain: name,
        codes: pair ? pair.map(codeOf) : [],
        kind: null
      })
    );
    return { file, name, pair };
  });
  return { entries, domains, crossDomainFiles, productFiles };
}
function readRegisters({ ctx }) {
  const { entries } = readKnowledge({ ctx });
  return {
    entries,
    principles: entries.filter((entry) => entry.kind === "principle"),
    rules: entries.filter((entry) => entry.kind === "rule"),
    invariants: entries.filter((entry) => entry.kind === "invariant")
  };
}
function resolveId(id, { ctx }) {
  return readKnowledge({ ctx }).entries.find((entry) => entry.id === id) ?? null;
}
function servedBy(entries, id) {
  return entries.filter((entry) => entry.serves === id);
}

// kit/lib/inbox/inbox.mjs
init_define_OMNI_BUNDLE();
var SPEC_VALUES = (
  /** @type {const} */
  ["file", "issue"]
);
var FRONT_MATTER_BLOCK3 = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
var FRONT_MATTER_LINE2 = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;
var BLOCKED_BY_LIST = /^\[\s*(\d+\s*(?:,\s*\d+\s*)*)?\]$/;
var BRACKET_LIST = /^\[([\s\S]*)\]$/;
var FORBIDDEN_STATUS_LIKE_FIELDS = ["status", "branch", "value", "priority"];
function withFile3(file, message) {
  return file ? `${file}: ${message}` : message;
}
function stripQuotes2(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if (first === '"' && last === '"' || first === "'" && last === "'") {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}
function parseFrontMatterLines2(rawFrontMatter) {
  const data = {};
  const errors = [];
  for (const rawLine of rawFrontMatter.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(FRONT_MATTER_LINE2);
    if (!match) {
      errors.push(`front matter line is not "key: value": "${rawLine}"`);
      continue;
    }
    const [, key, rawValue] = match;
    data[key] = stripQuotes2(rawValue);
  }
  return { data, errors };
}
var BlockedBySchema = external_exports.string().trim().min(1, "blocked-by is required").transform((raw, ctx) => {
  if (raw === "none") return "none";
  const match = raw.match(BLOCKED_BY_LIST);
  if (!match) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: 'blocked-by must be "none" or a bracketed list of PRD numbers, e.g. [966]'
    });
    return external_exports.NEVER;
  }
  const inner = (match[1] ?? "").trim();
  return inner.length === 0 ? [] : inner.split(",").map((token) => Number(token.trim()));
});
var AreasSchema = external_exports.string().trim().transform((raw, ctx) => {
  const match = raw.match(BRACKET_LIST);
  if (!match) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "areas must be a bracketed list of domain folder names, e.g. [credits]"
    });
    return external_exports.NEVER;
  }
  const inner = match[1].trim();
  return inner.length === 0 ? [] : inner.split(",").map((token) => token.trim());
}).optional();
var FrontMatterSchema3 = external_exports.object({
  prd: external_exports.coerce.number({ message: "prd must be a number" }).int().positive(),
  title: external_exports.string().trim().min(1, "title is required"),
  "blocked-by": BlockedBySchema,
  spec: external_exports.enum(SPEC_VALUES, { message: `spec must be one of: ${SPEC_VALUES.join(", ")}` }),
  areas: AreasSchema
}).strict();
function unrecognizedKeyMessage(key) {
  if (key === "plan") {
    return 'unexpected field "plan" \u2014 the plan is always the sibling plan.md, never a front-matter value';
  }
  const named = FORBIDDEN_STATUS_LIKE_FIELDS.includes(key) ? ` \u2014 an inbox spec names no ${key}` : "";
  return `unexpected field "${key}"${named}; an inbox spec's front matter holds only prd, title, blocked-by, spec, and an optional areas`;
}
function parseSpec(text2, { file = null } = {}) {
  const blockMatch = text2.match(FRONT_MATTER_BLOCK3);
  if (!blockMatch) {
    return {
      ok: false,
      errors: [withFile3(file, 'missing a front-matter block (a "---" fenced header)')]
    };
  }
  const [, rawFrontMatter] = blockMatch;
  const errors = [];
  const { data, errors: lineErrors } = parseFrontMatterLines2(rawFrontMatter);
  errors.push(...lineErrors.map((message) => withFile3(file, message)));
  const parsed = FrontMatterSchema3.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.code === "unrecognized_keys") {
        for (const key of issue.keys) {
          errors.push(withFile3(file, unrecognizedKeyMessage(key)));
        }
        continue;
      }
      const field = issue.path.length > 0 ? issue.path.join(".") : "(front matter)";
      errors.push(withFile3(file, `${field}: ${issue.message}`));
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  const fm = parsed.data;
  const record = {
    prd: fm.prd,
    title: fm.title,
    blockedBy: fm["blocked-by"],
    spec: fm.spec,
    ...fm.areas !== void 0 ? { areas: fm.areas } : {},
    file
  };
  return { ok: true, record };
}

// kit/lib/inbox/check-inbox.mjs
function knownAreas(ctx) {
  const dir = join13(ctx.root, domainsDir(ctx));
  if (!existsSync8(dir)) return /* @__PURE__ */ new Set();
  return new Set(
    readdirSync4(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  );
}
function violationsForFile(file, folder, text2, ctx) {
  const parsed = parseSpec(text2, { file });
  if (!parsed.ok) {
    return { record: null, violations: parsed.errors };
  }
  const { record } = parsed;
  const violations = [];
  const folderPrd = parseFolderName(folder)?.prd;
  if (folderPrd !== void 0 && record.prd !== folderPrd) {
    violations.push(
      `${file}: prd ${record.prd} does not agree with its folder's number, ${folderPrd} ("${folder}").`
    );
  }
  if (record.areas?.length && existsSync8(join13(ctx.root, ctx.layout.knowledgeRoot))) {
    const known = knownAreas(ctx);
    for (const area of record.areas) {
      if (!known.has(area)) {
        violations.push(`${file}: areas names "${area}", which is not a folder under ${domainsDir(ctx)}.`);
      }
    }
  }
  return { record, violations };
}
function blockedByViolations(records, ctx) {
  const violations = [];
  for (const record of records) {
    if (record.blockedBy === "none") continue;
    for (const prd2 of record.blockedBy) {
      if (!ctx.layout.whereIs(prd2)) {
        violations.push(
          `${record.file}: blocked-by names PRD #${prd2}, which no inbox or shipped folder carries.`
        );
      }
    }
  }
  return violations;
}
function beforeAfterViolation(file, ctx) {
  const absolute = join13(ctx.root, file);
  if (!existsSync8(absolute)) return null;
  const { size } = statSync(absolute);
  if (size <= ctx.config.limits.beforeAfterMaxBytes) return null;
  return `${file}: is ${size} bytes, over the ${ctx.config.limits.beforeAfterMaxBytes}-byte cap.`;
}
function findInboxViolations({ ctx }) {
  const violations = [];
  const records = [];
  for (const specFile of ctx.layout.specFiles()) {
    const folder = basename3(dirname4(specFile));
    if (!existsSync8(join13(ctx.root, specFile))) {
      violations.push(`${specFile}: spec.md is missing.`);
    } else {
      const text2 = readRepoFile(ctx, specFile);
      const { record, violations: fileViolations } = violationsForFile(specFile, folder, text2, ctx);
      violations.push(...fileViolations);
      if (record) records.push({ ...record, file: specFile, folder });
    }
    const beforeAfter = beforeAfterViolation(`${dirname4(specFile)}/before-after.html`, ctx);
    if (beforeAfter) violations.push(beforeAfter);
  }
  violations.push(...blockedByViolations(records, ctx));
  return violations;
}

// kit/lib/knowledge/check-knowledge.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync9, readFileSync as readFileSync11 } from "node:fs";
import { join as join14 } from "node:path";
function violation(file, id, detail) {
  return { file, id, detail };
}
function formatViolation({ file, id, detail }) {
  return `${file}: ${id} \u2014 ${detail}`;
}
var STATED_DATE = /^\d{4}-\d{2}-\d{2}$/;
var PATH_LIKE = /^[\w.@-]+(?:\/[\w.@-]+)+(?:#\S*)?$/;
var NUMBER_REFERENCE = /(^|\s)(PRD |issue |PR )?#\d+\b/i;
function partsOf(value) {
  return value.split(",").map((part) => part.replace(/`/g, "").trim()).filter(Boolean);
}
var PREFIX_OF_KIND = { principle: "P", rule: "BR", invariant: "N" };
function findOwningLibraryViolations(ctx, knowledge2) {
  const violations = [];
  for (const domain of knowledge2.domains) {
    const readme = `${domainsDir(ctx)}/${domain.name}/README.md`;
    if (!existsSync9(join14(ctx.root, readme))) continue;
    const section3 = readFileSync11(join14(ctx.root, readme), "utf8").split(/^## Owning libraries\s*$/m)[1];
    if (!section3) continue;
    const listed = section3.split(/^## /m)[0];
    for (const match of listed.matchAll(/`((?:libs|apps)\/[^`\s]+)`/g)) {
      const path = match[1].replace(/\/$/, "");
      if (!existsSync9(join14(ctx.root, path))) {
        violations.push(
          violation(readme, domain.name, `names owning library ${path}, which does not exist.`)
        );
      }
    }
  }
  return violations;
}
function findLayoutViolations(ctx, knowledge2, { glossaryText = "" } = {}) {
  const violations = [];
  for (const name of Object.keys(LAYER_FILES)) {
    if (!knowledge2.productFiles.includes(name)) {
      violations.push(violation(`${productDir(ctx)}/${name}`, "product", "is missing."));
    }
  }
  for (const domain of knowledge2.domains) {
    const dir = `${domainsDir(ctx)}/${domain.name}`;
    for (const name of ["README.md", ...Object.keys(LAYER_FILES)]) {
      if (!domain.files.includes(name)) {
        violations.push(violation(`${dir}/${name}`, domain.name, "is missing."));
      }
    }
    if (!domain.files.includes("README.md")) continue;
    if (!domain.glossaryTerm) {
      violations.push(
        violation(`${dir}/README.md`, domain.name, 'is missing a "Glossary term:" line.')
      );
    } else if (ctx.config.paths.glossary !== null && !glossaryHolds(glossaryText, domain.glossaryTerm)) {
      violations.push(
        violation(
          `${dir}/README.md`,
          domain.name,
          `glossary term "${domain.glossaryTerm}" is not a word ${ctx.config.paths.glossary} holds.`
        )
      );
    }
  }
  return violations;
}
function glossaryHolds(glossaryText, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w])${escaped}([^\\w]|$)`, "i").test(glossaryText);
}
function findCrossDomainFileViolations(knowledge2) {
  const known = new Set(knowledge2.domains.map((domain) => domain.name));
  const violations = [];
  for (const { file, name, pair } of knowledge2.crossDomainFiles) {
    if (!pair) {
      violations.push(violation(file, name, 'is not named "<a>--<b>", two domains.'));
      continue;
    }
    const [a, b] = pair;
    for (const half of pair) {
      if (!known.has(half)) {
        violations.push(violation(file, name, `names "${half}", which is not a domain folder.`));
      }
    }
    if (!(a < b)) {
      violations.push(
        violation(
          file,
          name,
          `is out of alphabetical order \u2014 a pair is written "${[a, b].sort().join("--")}".`
        )
      );
    }
  }
  return violations;
}
function findReusedIds(entries) {
  const firstSeenIn = /* @__PURE__ */ new Map();
  const violations = [];
  for (const { id, file } of entries) {
    const seenIn = firstSeenIn.get(id);
    if (seenIn) {
      violations.push(violation(file, id, `already used in ${seenIn} \u2014 an id is never reused.`));
    } else {
      firstSeenIn.set(id, file);
    }
  }
  return violations;
}
function idShapeViolations(entry) {
  const parts = idParts(entry.id);
  const where = entry.scope === "cross-domain" ? `the pair ${entry.domain}` : `the ${entry.domain} folder`;
  if (entry.scope === "cross-domain") {
    if (parts.type !== "X") {
      return [
        violation(entry.file, entry.id, "is not an X- id \u2014 a cross-domain entry is X-<A>-<B>-<n>.")
      ];
    }
    if (entry.keptId) return [];
    const matches = parts.codes.length === entry.codes.length && parts.codes.every((code, index) => code === entry.codes[index]);
    return matches ? [] : [
      violation(
        entry.file,
        entry.id,
        `names ${parts.codes.join("-")}, but it sits in ${where} (X-${entry.codes.join("-")}-<n>), and carries no "Kept id:" line.`
      )
    ];
  }
  if (parts.type === "CORE") {
    if (entry.scope === "product" && entry.kind === "invariant") return [];
    return [
      violation(
        entry.file,
        entry.id,
        "is a Core Invariant id \u2014 N1\u2026N8 live only in product/invariants.md."
      )
    ];
  }
  const expected = PREFIX_OF_KIND[entry.kind];
  if (parts.type !== expected) {
    return [
      violation(
        entry.file,
        entry.id,
        `is a ${parts.type}- id in a file of ${entry.kind}s, which carry ${expected}- ids.`
      )
    ];
  }
  if (entry.keptId || parts.codes[0] === entry.codes[0]) return [];
  return [
    violation(
      entry.file,
      entry.id,
      `names ${parts.codes[0]}, but it sits in ${where} (code ${entry.codes[0]}) and carries no "Kept id:" line.`
    )
  ];
}
function headingAnchors(text2) {
  const anchors = /* @__PURE__ */ new Set();
  const seen = /* @__PURE__ */ new Map();
  let fenced = false;
  for (const line of text2.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const match = !fenced && line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!match) continue;
    const base = match[1].replace(/`/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}
function missingPathViolations(ctx, entry, label, value, { onlyPathLike }) {
  const violations = [];
  for (const part of partsOf(value)) {
    if (onlyPathLike && !PATH_LIKE.test(part)) continue;
    const [path, anchor] = part.split("#");
    if (anchor && existsSync9(join14(ctx.root, path)) && path.endsWith(".md")) {
      if (!headingAnchors(readFileSync11(join14(ctx.root, path), "utf8")).has(anchor.toLowerCase())) {
        violations.push(
          violation(
            entry.file,
            entry.id,
            `links "${label}: ${path}#${anchor}", but ${path} has no heading with that anchor.`
          )
        );
      }
      continue;
    }
    if (!existsSync9(join14(ctx.root, path))) {
      violations.push(
        violation(
          entry.file,
          entry.id,
          `claims "${label}: ${path}" but that file does not exist \u2014 a wrong claim is worse than "unenforced".`
        )
      );
    }
  }
  return violations;
}
function servesViolations(entry, principles) {
  if ((entry.fieldCounts.serves ?? 0) > 1) {
    return [
      violation(
        entry.file,
        entry.id,
        'has more than one "Serves:" line \u2014 a rule serves exactly one principle.'
      )
    ];
  }
  const target = entry.serves.replace(/`/g, "").trim();
  if (!/^P-[A-Z0-9]+-\d+$/.test(target)) {
    return [
      violation(entry.file, entry.id, `serves "${entry.serves}", which is not one principle id.`)
    ];
  }
  const principle = principles.find((candidate) => candidate.id === target);
  if (!principle) {
    return [violation(entry.file, entry.id, `serves ${target}, which no principle claims.`)];
  }
  if (entry.scope === "domain" && principle.scope !== "product" && principle.domain !== entry.domain) {
    return [
      violation(
        entry.file,
        entry.id,
        `serves ${target}, a principle of "${principle.domain}" \u2014 an entry of one domain serves a product principle or its own; where two domains meet, it is a cross-domain entry.`
      )
    ];
  }
  if (entry.scope === "cross-domain") {
    const own = principle.scope === "product" || entry.domain.split("--").includes(principle.domain);
    if (!own) {
      return [
        violation(
          entry.file,
          entry.id,
          `serves ${target}, a principle of "${principle.domain}" \u2014 a cross-domain entry serves a product principle or one of its own pair's.`
        )
      ];
    }
  }
  return [];
}
function findEntryViolations(ctx, entries) {
  const principles = entries.filter((entry) => entry.kind === "principle");
  const violations = [];
  for (const entry of entries) {
    violations.push(...idShapeViolations(entry));
    if (entry.scope === "cross-domain" && !entry.kind) {
      violations.push(
        violation(entry.file, entry.id, 'is missing a "Kind: rule" or "Kind: invariant" line.')
      );
    }
    if (!entry.statement) violations.push(violation(entry.file, entry.id, "has no statement."));
    if (!entry.source) {
      violations.push(violation(entry.file, entry.id, 'is missing a "Source:" line.'));
    } else {
      violations.push(
        ...missingPathViolations(ctx, entry, "Source", entry.source, { onlyPathLike: true })
      );
      const leads = partsOf(entry.source).some(
        (part) => PATH_LIKE.test(part) || NUMBER_REFERENCE.test(part)
      );
      if (!leads) {
        violations.push(
          violation(
            entry.file,
            entry.id,
            `has "Source: ${entry.source}", which leads nowhere \u2014 name a file that exists, or a PRD or issue number.`
          )
        );
      }
    }
    if (entry.kind === "principle") {
      if (entry.enforcedBy !== null) {
        violations.push(
          violation(
            entry.file,
            entry.id,
            'carries an "Enforced by:" line \u2014 a principle is judged, not proven; a rule serving it carries the proof.'
          )
        );
      }
      if (!entry.why) violations.push(violation(entry.file, entry.id, 'is missing a "Why:" line.'));
      if (!entry.decided) {
        violations.push(violation(entry.file, entry.id, 'is missing a "Decided:" line.'));
      }
      continue;
    }
    if (entry.kind === "rule" && entry.serves === null) {
      violations.push(
        violation(
          entry.file,
          entry.id,
          'is missing a "Serves:" line \u2014 every rule serves one principle.'
        )
      );
    }
    if (entry.serves !== null) violations.push(...servesViolations(entry, principles));
    if (!entry.stated || !STATED_DATE.test(entry.stated)) {
      violations.push(violation(entry.file, entry.id, 'is missing a "Stated: YYYY-MM-DD" line.'));
    }
    if (entry.enforcedBy === null) {
      violations.push(violation(entry.file, entry.id, 'is missing an "Enforced by:" line.'));
    } else if (entry.enforcedBy !== "unenforced") {
      violations.push(
        ...missingPathViolations(ctx, entry, "Enforced by", entry.enforcedBy, {
          onlyPathLike: false
        })
      );
    }
  }
  return violations;
}
function findUnresolvedCitations(file, text2, resolve) {
  return idsCitedIn(text2).filter((id) => !resolve(id)).map((id) => violation(file, id, `is cited in ${file} but does not resolve to any entry.`));
}
function findWishes(entries) {
  return entries.filter((entry) => entry.kind === "principle" && servedBy(entries, entry.id).length === 0).map(
    (entry) => violation(entry.file, entry.id, "is a wish \u2014 no rule or invariant serves it yet.")
  );
}
function gradeKnowledge({ ctx, files = [], glossaryText } = {}) {
  const knowledge2 = readKnowledge({ ctx });
  const resolve = (id) => knowledge2.entries.find((entry) => entry.id === id);
  const text2 = glossaryText ?? (ctx.config.paths.glossary ? readRepoFile(ctx, ctx.config.paths.glossary) : "");
  const violations = [
    ...findLayoutViolations(ctx, knowledge2, { glossaryText: text2 }),
    ...findOwningLibraryViolations(ctx, knowledge2),
    ...findCrossDomainFileViolations(knowledge2),
    ...findReusedIds(knowledge2.entries),
    ...findEntryViolations(ctx, knowledge2.entries),
    ...files.flatMap((file) => findUnresolvedCitations(file, readRepoFile(ctx, file), resolve))
  ];
  return {
    violations: violations.map(formatViolation),
    wishes: findWishes(knowledge2.entries).map(formatViolation)
  };
}

// kit/lib/outbox/check-outbox.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync11 } from "node:fs";
import { join as join16 } from "node:path";

// kit/lib/laws.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync10, readdirSync as readdirSync5, readFileSync as readFileSync12 } from "node:fs";
import { join as join15 } from "node:path";
var ADR_ID = /^ADR-(\d{4})$/;
function invariantAdrs(text2, heading) {
  const lines = text2.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading.trim());
  if (start === -1) return /* @__PURE__ */ new Set();
  const level = heading.trim().match(/^#+/)[0].length;
  const ids = /* @__PURE__ */ new Set();
  for (const line of lines.slice(start + 1)) {
    const next = line.match(/^(#+)\s/);
    if (next && next[1].length <= level) break;
    for (const match of line.matchAll(/ADR-\d{4}/g)) ids.add(match[0]);
  }
  return ids;
}
function adrFiles(ctx, number) {
  const dir = join15(ctx.root, ctx.layout.adrDir);
  if (!existsSync10(dir)) return [];
  return readdirSync5(dir).filter((name) => name.startsWith(`${number}-`) && name.endsWith(".md")).sort();
}
function lawsFor(ctx) {
  const { source, claudeMdHeading } = ctx.config.laws;
  let invariants = null;
  const invariantSet = () => {
    if (invariants === null) {
      const file = join15(ctx.root, "CLAUDE.md");
      invariants = existsSync10(file) ? invariantAdrs(readFileSync12(file, "utf8"), claudeMdHeading) : /* @__PURE__ */ new Set();
    }
    return invariants;
  };
  function resolve(bearsOn) {
    if (bearsOn === "none") return { ok: true };
    const adr = ADR_ID.exec(bearsOn);
    if (adr) {
      const files = adrFiles(ctx, adr[1]);
      if (files.length === 1) return { ok: true };
      if (files.length === 0) return { ok: false, reason: `no decision record ${bearsOn} in ${ctx.layout.adrDir}` };
      return { ok: false, reason: `${bearsOn} is ambiguous: ${files.join(", ")}` };
    }
    if (ID_SHAPE.test(bearsOn)) {
      if (!existsSync10(join15(ctx.root, ctx.layout.knowledgeRoot))) {
        return { ok: false, reason: `${bearsOn}: no knowledge folder at ${ctx.layout.knowledgeRoot}` };
      }
      return resolveId(bearsOn, { ctx }) ? { ok: true } : { ok: false, reason: `${bearsOn} names no entry in ${ctx.layout.knowledgeRoot}` };
    }
    return { ok: false, reason: `${bearsOn}: not none, an ADR-NNNN or a knowledge id` };
  }
  function floorsHigh(bearsOn) {
    if (source === "knowledge") return ID_SHAPE.test(bearsOn);
    if (source === "claudeMdInvariants") return invariantSet().has(bearsOn);
    return false;
  }
  return Object.freeze({ source, resolve, floorsHigh });
}

// kit/lib/outbox/check-outbox.mjs
var RANKS_NEEDING_OPTIONS = ["high", "medium"];
var PLAIN_SECTION_FIELDS = [
  { heading: "The question, in plain words", field: "questionPlain" },
  { heading: "The decision, in plain words", field: "decisionPlain" }
];
var FUN_SECTION_FIELDS = [
  { heading: "The intro, for fun", field: "introFun" },
  { heading: "The punchline, for fun", field: "punchlineFun" }
];
function describe(file, detail) {
  return `${file}: ${detail}`;
}
function checkItemText(file, text2, { ctx, laws } = {}) {
  const parsed = parseOutboxItem(text2, { file });
  if (!parsed.ok) return parsed.errors;
  const { item: item2 } = parsed;
  const violations = [];
  const resolved = resolveBearsOn(item2.bearsOn, laws);
  if (!resolved.ok) {
    violations.push(
      describe(
        file,
        `bears-on "${item2.bearsOn}" does not resolve to any invariant, business rule, or ADR.`
      )
    );
  }
  if (isBelowFloor(item2.bearsOn, item2.rank, laws)) {
    violations.push(
      describe(
        file,
        `rank "${item2.rank}" is below the floor bears-on "${item2.bearsOn}" sets \u2014 a decision bearing on an invariant or a business rule floors at "high".`
      )
    );
  }
  if (item2.sections.questionPlain === void 0 && item2.sections.decisionPlain === void 0) {
    violations.push(
      describe(
        file,
        'missing "## The question, in plain words" and "## The decision, in plain words" \u2014 every open item needs both, first, before the existing four sections.'
      )
    );
  } else {
    for (const { heading, field } of PLAIN_SECTION_FIELDS) {
      for (const problem of plainWordsProblems(item2.sections[field])) {
        violations.push(describe(file, `"## ${heading}" ${problem}`));
      }
    }
  }
  for (const { heading, field } of FUN_SECTION_FIELDS) {
    if (item2.sections[field] === void 0) continue;
    for (const problem of funLineProblems(item2.sections[field])) {
      violations.push(describe(file, `"## ${heading}" ${problem}`));
    }
  }
  if (RANKS_NEEDING_OPTIONS.includes(item2.rank)) {
    violations.push(...optionsViolations(file, item2.sections.options));
  }
  return violations;
}
function optionsViolations(file, options) {
  const list2 = options ?? [];
  if (list2.length < 2 || list2.length > 4) {
    return [
      describe(
        file,
        `carries ${list2.length} option(s) under "## The options, in plain words" \u2014 a high or medium item needs two to four, "A." the option built.`
      )
    ];
  }
  if (!optionLettersInOrder(list2)) {
    return [
      describe(
        file,
        `options are lettered ${list2.map((option) => option.letter).join(", ")} \u2014 a high or medium item needs "A", "B", "C"\u2026 in order, with no gap and no repeat.`
      )
    ];
  }
  return list2.flatMap(
    (option) => plainWordsProblems(option.text).map(
      (problem) => describe(file, `option "${option.letter}" ${problem}`)
    )
  );
}
function findOutboxViolations({ ctx }) {
  const laws = lawsFor(ctx);
  const violations = [];
  const shippedDirs = ctx.layout.outboxDirs().filter(({ shipped }) => shipped).map(({ dir }) => dir);
  for (const file of outboxItemFiles({ ctx })) {
    if (shippedDirs.some((dir) => file.startsWith(`${dir}/`))) {
      violations.push(describe(file, "open item in a shipped PRD \u2014 settle it or reopen the PRD"));
      continue;
    }
    violations.push(...checkItemText(file, readRepoFile(ctx, file), { ctx, laws }));
  }
  for (const { dir } of ctx.layout.outboxDirs()) {
    const settledFile = `${dir}/${SETTLED_FILE}`;
    if (!existsSync11(join16(ctx.root, settledFile))) continue;
    for (const entry of parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers)) {
      for (const id of entry.became) {
        const resolved = isPlaybookId(id) ? resolvePlaybookId(id, { ctx }) : laws.resolve(id);
        if (!resolved.ok) {
          violations.push(
            describe(settledFile, `${entry.id} Became: ${id} \u2014 ${resolved.reason}`)
          );
        }
      }
    }
  }
  return violations;
}

// kit/lib/outbox/check-decision-coverage.mjs
init_define_OMNI_BUNDLE();

// kit/lib/outbox/account.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync12, readdirSync as readdirSync6 } from "node:fs";
import { basename as basename4 } from "node:path";
var ACCOUNTS_DIR = "accounts";
var RISKY_CHANGES_HEADING = "Risky changes";
var FrontMatterSchema4 = external_exports.object({
  prd: external_exports.coerce.number({ message: "prd must be a number" }).int().positive(),
  slice: external_exports.string().trim().min(1, "slice is required"),
  graded: external_exports.string().regex(/^\d{4}-\d{2}-\d{2}$/, "graded must be a YYYY-MM-DD date")
}).strict();
var FRONT_MATTER_BLOCK4 = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
var FRONT_MATTER_LINE3 = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;
var HEADING_LINE2 = /^##\s+(.+?)\s*$/;
var ENTRY_PATH_LINE = /^-\s+`([^`]+)`$/;
var ENTRY_RULE_LINE = /^([a-z][a-z0-9-]*)$/;
var ENTRY_ACCOUNT_LINE = /^(item|spec)\s+(.+)$/;
function withFile4(file, message) {
  return file ? `${file}: ${message}` : message;
}
function stripQuotes3(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if (first === '"' && last === '"' || first === "'" && last === "'") {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}
function parseFrontMatterLines3(rawFrontMatter) {
  const data = {};
  const errors = [];
  for (const rawLine of rawFrontMatter.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(FRONT_MATTER_LINE3);
    if (!match) {
      errors.push(`front matter line is not "key: value": "${rawLine}"`);
      continue;
    }
    const [, key, rawValue] = match;
    data[key] = stripQuotes3(rawValue);
  }
  return { data, errors };
}
function parseHeadingSections2(body) {
  const sections = [];
  let current = null;
  for (const line of body.split("\n")) {
    const match = line.match(HEADING_LINE2);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections.map((section3) => ({
    heading: section3.heading,
    content: section3.lines.join("\n").trim()
  }));
}
function parseEntries(content) {
  const lines = content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) return { errors: [], entries: [] };
  if (lines.length % 3 !== 0) {
    return {
      errors: [
        "risky change entries must come in groups of three lines: a backticked path, a rule id, and an account"
      ],
      entries: []
    };
  }
  const errors = [];
  const entries = [];
  for (let i = 0; i < lines.length; i += 3) {
    const [pathLine, ruleLine, accountLine] = lines.slice(i, i + 3);
    const pathMatch = pathLine.match(ENTRY_PATH_LINE);
    if (!pathMatch) {
      errors.push(`risky change entry must start with a backticked path: "${pathLine}"`);
      continue;
    }
    const ruleMatch = ruleLine.match(ENTRY_RULE_LINE);
    if (!ruleMatch) {
      errors.push(`risky change entry's second line must be a rule id: "${ruleLine}"`);
      continue;
    }
    const accountMatch = accountLine.match(ENTRY_ACCOUNT_LINE);
    if (!accountMatch) {
      errors.push(
        `account must be "item <id>" or "spec <where>", and no third form: "${accountLine}"`
      );
      continue;
    }
    const [, kind, rawValue] = accountMatch;
    const value = rawValue.trim();
    entries.push({
      path: pathMatch[1],
      rule: ruleMatch[1],
      account: kind === "item" ? { kind: "item", id: value } : { kind: "spec", where: value }
    });
  }
  return { errors, entries };
}
function validateBody(body) {
  const found = parseHeadingSections2(body);
  if (found.length === 0) {
    return { errors: [`missing section: "## ${RISKY_CHANGES_HEADING}"`], entries: [] };
  }
  const errors = [];
  const unexpected = found.filter((section3) => section3.heading !== RISKY_CHANGES_HEADING);
  if (unexpected.length > 0) {
    errors.push(
      `unexpected heading(s): ${unexpected.map((section3) => `"## ${section3.heading}"`).join(", ")}`
    );
  }
  const riskyChangesSection = found.find((section3) => section3.heading === RISKY_CHANGES_HEADING);
  if (!riskyChangesSection) {
    errors.push(`missing section: "## ${RISKY_CHANGES_HEADING}"`);
    return { errors, entries: [] };
  }
  const { errors: entryErrors, entries } = parseEntries(riskyChangesSection.content);
  errors.push(...entryErrors);
  return { errors, entries };
}
function parseAccount(text2, { file = null } = {}) {
  const blockMatch = text2.match(FRONT_MATTER_BLOCK4);
  if (!blockMatch) {
    return {
      ok: false,
      errors: [withFile4(file, 'missing a front-matter block (a "---" fenced header)')]
    };
  }
  const [, rawFrontMatter, body] = blockMatch;
  const errors = [];
  const { data, errors: lineErrors } = parseFrontMatterLines3(rawFrontMatter);
  errors.push(...lineErrors.map((message) => withFile4(file, message)));
  const parsedFrontMatter = FrontMatterSchema4.safeParse(data);
  if (!parsedFrontMatter.success) {
    for (const issue of parsedFrontMatter.error.issues) {
      const field = issue.path.length > 0 ? issue.path.join(".") : "(front matter)";
      errors.push(withFile4(file, `${field}: ${issue.message}`));
    }
  }
  const { errors: bodyErrors, entries } = validateBody(body);
  errors.push(...bodyErrors.map((message) => withFile4(file, message)));
  if (errors.length > 0) return { ok: false, errors };
  const fm = parsedFrontMatter.data;
  const account = {
    prd: fm.prd,
    slice: fm.slice,
    graded: fm.graded,
    entries,
    file
  };
  return { ok: true, account };
}
function readAccounts(prd2, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd2);
  if (outboxDir === null) return [];
  const dir = `${outboxDir}/${ACCOUNTS_DIR}`;
  if (!existsSync12(`${ctx.root}/${dir}`)) return [];
  const prdPrefix = `${outboxDir}/`;
  const itemIds = new Set(
    outboxItemFiles({ ctx }).filter((path) => path.startsWith(prdPrefix)).map((path) => basename4(path, ".md"))
  );
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  if (existsSync12(`${ctx.root}/${settledFile}`)) {
    for (const entry of parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers)) {
      itemIds.add(entry.id);
    }
  }
  const names = readdirSync6(`${ctx.root}/${dir}`).filter((name) => name.endsWith(".md")).sort();
  return names.map((name) => {
    const file = `${dir}/${name}`;
    const text2 = readRepoFile(ctx, file);
    const parsed = parseAccount(text2, { file });
    if (!parsed.ok) return parsed;
    const unresolved = parsed.account.entries.filter(
      (entry) => entry.account.kind === "item" && !itemIds.has(entry.account.id)
    );
    if (unresolved.length > 0) {
      return {
        ok: false,
        errors: unresolved.map(
          (entry) => withFile4(
            file,
            `item account names an id no outbox file carries: "${entry.account.id}"`
          )
        )
      };
    }
    return parsed;
  });
}
function entryKey(change) {
  return `${change.path}\0${change.rule}`;
}
function compare(risky, accounts) {
  const entries = accounts.flatMap(
    (account) => account.entries.map((entry) => ({ ...entry, slice: account.slice, file: account.file }))
  );
  const namedKeys = new Set(entries.map(entryKey));
  const riskyKeys = new Set(risky.map(entryKey));
  const accounted = risky.filter((change) => namedKeys.has(entryKey(change)));
  const unaccounted = risky.filter((change) => !namedKeys.has(entryKey(change)));
  const stale = entries.filter((entry) => !riskyKeys.has(entryKey(entry)));
  return { accounted, unaccounted, stale };
}

// kit/lib/outbox/check-decision-coverage.mjs
function discoveredPrds({ ctx }) {
  return ctx.layout.outboxDirs().map(({ prd: prd2 }) => prd2).sort((a, b) => a - b);
}
function findFormatViolations({ ctx }) {
  return discoveredPrds({ ctx }).flatMap(
    (prd2) => readAccounts(prd2, { ctx }).filter((result) => !result.ok).flatMap((result) => result.errors)
  );
}
function gradePrd(prd2, risky, { ctx }) {
  const results = readAccounts(prd2, { ctx });
  const malformed = results.filter((result) => !result.ok).flatMap((result) => result.errors);
  const accounts = results.filter((result) => result.ok).map((result) => result.account);
  const { accounted, unaccounted, stale } = compare(risky, accounts);
  return { prd: prd2, malformed, accounted, unaccounted, stale };
}
function describeUnaccounted(prd2, change) {
  return `PRD #${prd2}: \`${change.path}\` is risky (${change.rule}) and no account names it.`;
}

// kit/lib/outbox/decision-coverage.mjs
init_define_OMNI_BUNDLE();
var TEST_OR_FEATURE_PATH = /\.test\.[^/]+$|\.feature$/;
function escapeRegExp(source) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isStoredShape(change, { ctx }) {
  return ctx.config.risk.storedShape.some((source) => new RegExp(source).test(change.path));
}
function enforcedByPaths({ ctx }) {
  const { entries } = readRegisters({ ctx });
  const paths = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (!entry.enforcedBy || entry.enforcedBy === "unenforced") continue;
    for (const rawPath of entry.enforcedBy.split(",")) {
      const path = rawPath.replace(/`/g, "").trim();
      if (path) paths.add(path);
    }
  }
  return paths;
}
function isLawProof(change, { ctx }) {
  if (ctx.config.laws.source !== "knowledge") return false;
  return enforcedByPaths({ ctx }).has(change.path);
}
function isLawText(change, { ctx }) {
  const knowledgeRoot = escapeRegExp(ctx.layout.knowledgeRoot);
  const adrDir = escapeRegExp(ctx.layout.adrDir);
  const pattern = new RegExp(
    `^${knowledgeRoot}/(?:product|domains/[^/]+)/(?:principles|rules|invariants)\\.md$|^${knowledgeRoot}/cross-domain/[^/]+\\.md$|^${adrDir}/(?!README\\.md$)[^/]+\\.md$`
  );
  return pattern.test(change.path);
}
function isTestRemoved(change) {
  return change.status === "D" && TEST_OR_FEATURE_PATH.test(change.path);
}
function isSharedContract(change, { ctx }) {
  return ctx.config.risk.sharedContract.some((prefix) => change.path.startsWith(prefix));
}
var RULES = [
  { id: "stored-shape", matches: isStoredShape },
  { id: "law-proof", matches: isLawProof },
  { id: "law-text", matches: isLawText },
  { id: "test-removed", matches: isTestRemoved },
  { id: "shared-contract", matches: isSharedContract }
];
var RULE_IDS = RULES.map((rule) => rule.id);
function riskyChanges(changes, { ctx }) {
  const risky = [];
  for (const change of changes) {
    for (const rule of RULES) {
      if (rule.matches(change, { ctx })) {
        risky.push({ path: change.path, status: change.status, rule: rule.id });
      }
    }
  }
  return risky;
}

// kit/lib/playbook/check-playbook.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync15 } from "node:fs";
import { join as join20 } from "node:path";

// kit/lib/playbook/status.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync14 } from "node:fs";
import { join as join19 } from "node:path";

// kit/lib/playbook/resolve.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync13, readdirSync as readdirSync7, readFileSync as readFileSync13, statSync as statSync2 } from "node:fs";
import { join as join17 } from "node:path";
var CONFIG_PLACEHOLDER = /\{config:([^{}\s]+)\}/g;
function configValue(config2, key) {
  let value = config2;
  for (const part of key.split(".")) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, part)) {
      return { ok: false, reason: "names no config key" };
    }
    value = value[part];
  }
  if (["string", "number", "boolean"].includes(typeof value)) return { ok: true, text: String(value) };
  if (value === null) return { ok: false, reason: "is not set in the config" };
  return { ok: false, reason: "holds no single value" };
}
function fillConfig(text2, config2) {
  const unresolved = [];
  const filled = text2.replace(CONFIG_PLACEHOLDER, (placeholder, key) => {
    const value = configValue(config2, key);
    if (value.ok) return value.text;
    unresolved.push({ key, reason: value.reason });
    return placeholder;
  });
  return { text: filled, unresolved };
}
function readTarget(path, index, { ctx }) {
  const absolute = join17(ctx.root, path);
  if (!existsSync13(absolute)) return { text: "", missing: path };
  if (!statSync2(absolute).isDirectory()) return { text: readFileSync13(absolute, "utf8").trim(), missing: null };
  if (index) return readTarget(index, null, { ctx });
  const dir = path.replace(/\/+$/, "");
  const pages = readdirSync7(absolute, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => `${dir}/${entry.name}`).sort();
  return { text: pages.join("\n"), missing: null };
}
function repoLabel(slot) {
  const parts = ["repo"];
  if (slot.by === "human") parts.push("by human");
  if (slot.verified) parts.push(`verified ${slot.verified}`);
  return `[${parts.join(" \xB7 ")}]`;
}
function resolveSlot(kitSlot, repoSlot, { ctx, formId, file, problems }) {
  const base = { slot: kitSlot.id, heading: kitSlot.heading };
  const body = repoSlot?.body ?? null;
  if (body?.kind === "text") {
    return { ...base, source: "repo", label: repoLabel(repoSlot), text: body.text, questions: body.questions };
  }
  if (body?.kind === "pointer") {
    const { path, anchor } = body.see;
    const target = readTarget(path, null, { ctx });
    if (target.missing) problems.push(`${file}: "## ${repoSlot.heading}" See: ${path} does not exist`);
    const pointer = anchor ? `${path}#${anchor}` : path;
    return { ...base, source: "pointer", label: `[\u2192 ${pointer}]`, text: target.text, questions: [] };
  }
  const kit = fillConfig(kitSlot.body.text, ctx.config);
  for (const { key, reason } of kit.unresolved) {
    problems.push(`kit default ${formId}#${kitSlot.id}: {config:${key}} ${reason}`);
  }
  if (body?.kind === "holes") {
    return { ...base, source: "hole", label: "[hole]", text: kit.text, questions: body.questions };
  }
  return { ...base, source: "kit", label: "[kit default]", text: kit.text, questions: [] };
}
function resolveForm(formId, { ctx, template }) {
  const kit = parseForm(template, { file: `kit template ${formId}` });
  if (!kit.ok) throw new Error(`the kit's template for ${formId} does not parse:
${kit.errors.join("\n")}`);
  const read = readForm(formId, { ctx });
  const { file } = read;
  const problems = [];
  let repo = null;
  let state = "missing";
  if (read.exists && read.ok) {
    repo = read.form;
    state = repo.state;
  } else if (read.exists) {
    state = "invalid";
    problems.push(...read.errors);
  }
  const title = repo?.title ?? kit.form.title;
  if (repo?.state === "pointer") {
    const target = readTarget(repo.pointsTo, repo.index, { ctx });
    if (target.missing) problems.push(`${file}: ${target.missing === repo.pointsTo ? "points-to" : "index"} ${target.missing} does not exist`);
    const section3 = { slot: null, heading: title, source: "pointer", label: `[\u2192 ${repo.pointsTo}]`, text: target.text, questions: [] };
    return { form: formId, file, state, title, sections: [section3], problems };
  }
  const sections = kit.form.slots.map((kitSlot) => {
    const repoSlot = repo?.slots.find((slot) => slot.id === kitSlot.id) ?? null;
    return resolveSlot(kitSlot, repoSlot, { ctx, formId, file, problems });
  });
  return { form: formId, file, state, title, sections, problems };
}

// kit/lib/playbook/templates.mjs
init_define_OMNI_BUNDLE();
import { readdirSync as readdirSync8, readFileSync as readFileSync14 } from "node:fs";
import { join as join18, posix as posix2 } from "node:path";
import { fileURLToPath } from "node:url";
var BUNDLED = false ? null : JSON.parse('{"README.md":"<!-- Ported from vertuo-ai-domain@db67fd9da:docs/knowledge/README.md \u2014 changes in kit/porting/templates--front-door.md -->\\n\\n# Knowledge\\n\\nUse this page when you need to know what is true about the product, or how to work in this\\nrepository. Start here even when the knowledge lives elsewhere: anything kept somewhere else has a\\npointer here.\\n\\n## Two halves\\n\\n- **What is true.** The knowledge registers, in `{config:paths.knowledge}`: principles (a person\'s\\n  decision about what the product should be), business rules (what may or may not happen, each\\n  serving one principle) and invariants (what must always hold in the code). Decisions about how it\\n  is built are decision records, in `{config:paths.adr}`.\\n- **How we work here.** The playbook, in `{config:paths.playbook}`: one form per question an agent\\n  asks while delivering. How to set up, test, and verify; how CI works and which reds are known; what\\n  a pull request looks like; what a merge publishes; the rules that cost the most when broken.\\n\\n## How a form is read\\n\\nThe skills never read a form\'s file: they call `omni kb show <form>`, which resolves it section by\\nsection, and says where each section came from. Top wins:\\n\\n1. **A pointer.** The whole form points at a page the repository already has, or one section does,\\n   with a `See:` line. Nothing is copied.\\n2. **The repository\'s section.** What only this repository knows, written from evidence, or by a\\n   person.\\n3. **The kit default.** Doctrine every repository shares. It ships with the kit, so a section left\\n   blank here improves when the kit is upgraded.\\n\\nA question nobody could answer yet is a `TODO(human)` line: the kit default applies meanwhile.\\n`omni kb status` lists every form, its state, and its open questions.\\n","playbook/architecture.md":"---\\nform: architecture\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:AGENTS.md#boundaries and libs/LIBRARY_STYLE_RULES.md \u2014 changes in kit/porting/templates--architecture.md -->\\n\\n# Architecture\\n\\nUse this page when deciding where code goes, and what it may depend on.\\n\\n## Layout\\n<!-- slot: layout \xB7 required -->\\nA package\'s name says which layer it belongs to, so a boundary is legible from the tree alone.\\nScripts that orchestrate the whole repository live in one place at its root, never inside a package.\\n\\n## Boundaries\\n<!-- slot: boundaries \xB7 required -->\\n- Dependencies point down, from the apps through the layers to the infrastructure wrappers. A lower\\n  layer never imports a higher one.\\n- What two layers both need, and that knows nothing of either, moves down to the lowest layer, so\\n  each reaches it without an edge that points up.\\n- Separate product areas never import each other\'s domain code; they meet in exactly one place, the\\n  app\'s composition root.\\n- A boundary is enforced by a check wherever one can be. Name the check beside the rule; a rule only\\n  review enforces says so.\\n\\n## Patterns\\n<!-- slot: patterns \xB7 optional -->\\n- Every value that crosses a system boundary (config, external input, an API contract, a service\\n  interface) is validated there by a schema, and its type is derived from that schema.\\n- Storage is reached through one layer. Only that layer runs queries; the logic above it calls it\\n  and never touches the database; the transport above that calls the logic, never the storage.\\n- A file\'s name says its role.\\n","playbook/briefing.md":"---\\nform: briefing\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/briefing.md \u2014 changes in kit/porting/templates--briefing.md -->\\n\\n# Briefing\\n\\nUse this page when a session starts: the rules that cost the most when broken.\\n\\n## Never\\n<!-- slot: never \xB7 required -->\\n- Never merge into `{config:repo.defaultBranch}`. A person does.\\n- Before you decide anything the spec does not settle, read the knowledge the change touches. Take\\n  the most reversible option and record the decision as an outbox item; two principles pulling\\n  against each other stop that slice.\\n- Never lower a coverage floor or add a suppression to turn a check green.\\n- Never reformat files you did not change: format only what you touched.\\n- A red check on your pull request is yours to fix. Read the CI page first; after\\n  `{config:limits.attempts}` attempts, leave a comment saying what is stuck.\\n- A pull request you own carries `{config:labels.inProgress}` and a status comment you keep current,\\n  until it is green or stuck.\\n\\n## Hooks\\n<!-- slot: hooks \xB7 optional -->\\nA hook that refuses a commit or a push names what to fix: fix the cause, and never bypass the hook.\\nAn escape hatch that skips one exists for emergencies only, and the pull request says why it was\\nused.\\n\\n## Where to read next\\n<!-- slot: next \xB7 optional -->\\nThe rest of this playbook, one form per question, through `omni kb show <form>`; the knowledge\\nregisters in `{config:paths.knowledge}`, which say what is true about the product; and the decision\\nrecords in `{config:paths.adr}`, which say how it is built.\\n","playbook/bug-fixing.md":"---\\nform: bug-fixing\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/bug-fixing.md \u2014 changes in kit/porting/templates--bug-fixing.md -->\\n\\n# Bug fixing\\n\\nUse this page when a reported bug becomes a pull request.\\n\\n## Steps\\n<!-- slot: steps \xB7 required -->\\n1. **Read and classify.** A bug is something a user, a browser, or an API caller can observe. A\\n   flaky harness, a CI timeout, or a slow job is tooling: say so on the report and follow the CI page\\n   instead.\\n2. **Triage.** Name the domain that owns the behaviour, the risk, and whether it is a regression.\\n   `critical`: data loss, security, money, or a whole surface down for every user. `high`: a main\\n   flow broken with no workaround. `medium`: a flow broken with a workaround, or a secondary flow\\n   broken. `low`: cosmetic, or a minor inconvenience. A regression is a claim with evidence: the\\n   culprit change, a green run followed by a red one, or the report saying when it last worked.\\n   Without evidence it is a new bug.\\n3. **Words first.** Every term the reproduction needs is in the glossary. A term that cannot be\\n   defined without inventing product behaviour is a question for a person.\\n4. **Prove red.** Write the test or scenario that reproduces the bug, in the domain\'s own words, and\\n   run it before any fix: it must fail. If it passes, stop; it misses the bug, or the bug is gone.\\n5. **Fix.** Test-first, the smallest fix. Never edit the reproduction to make it pass.\\n6. **Guard.** See below.\\n7. **Open the pull request**, closing the report, and say what proved red and what proved green.\\n\\nNothing is reported as proven that was not run.\\n\\n## Guard\\n<!-- slot: guard \xB7 optional -->\\nAsk which cheap check would have caught this before it shipped. When one is guard-sized (a check\\nscript, a lint rule, a unit test), add it, with its own test. Otherwise the pull request says\\n`Guard: none \u2014 <reason>`. A regression test that lets small mutations of the fixed lines pass is not\\nguarding the fix.\\n","playbook/ci.md":"---\\nform: ci\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/ci-triage.md \u2014 changes in kit/porting/templates--ci.md -->\\n\\n# CI\\n\\nUse this page when a check on your pull request is red.\\n\\n## Workflows\\n<!-- slot: workflows \xB7 required -->\\nEvery job carries a timeout, so a stuck job still ends its run. A run whose jobs all sit queued,\\nnone ever starting, usually names a runner nothing answers to: check the runner settings before\\nassuming an outage.\\n\\n## What gates a merge\\n<!-- slot: gating \xB7 required -->\\n- No checks at all on a pull request, rather than a red one, usually means it conflicts with its\\n  base: no workflow runs when the merge commit cannot be built. Check that it merges first.\\n- A draft runs no CI, and a sub-pull request into a feature branch never does. Marking a draft\\n  ready is what grades it.\\n- An aggregate check counts a skipped job as a failure, and a red build skips the jobs after it:\\n  fix the build first.\\n- A green pull request whose merge turns `{config:repo.defaultBranch}` red missed a dependency its\\n  checks could not see. Fix it forward; revert only when the product is down.\\n\\n## Known reds\\n<!-- slot: known-reds \xB7 optional -->\\nA red that is not a finding is listed here: its signature, the one check that rules your branch\\nout, and what to do. Anything not listed is yours to fix. A known red that was fixed is a finding\\nagain on a branch that contains the fix.\\n\\nA flaky test not fixed in one focused attempt is quarantined: skipped with its issue in the reason,\\nand listed here so the count stays visible.\\n\\n## When to re-run\\n<!-- slot: rerun \xB7 optional -->\\nA re-run is allowed only when both hold: the failure matches a known red, and your branch changes\\nnothing the red names. One re-run at most, and it counts as one of the `{config:limits.attempts}`\\nrepair attempts; red again, it is a finding. A run a later push superseded is never re-run: read the\\nlatest run instead.\\n","playbook/conventions.md":"---\\nform: conventions\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/briefing.md, docs/agents/definition-of-done.md#commit-shape and docs/adr/0058-identifiers-are-english-interface-copy-is-french.md \u2014 changes in kit/porting/templates--conventions.md -->\\n\\n# Conventions\\n\\nUse this page when naming things, formatting files, or shaping commits.\\n\\n## Naming\\n<!-- slot: naming \xB7 optional -->\\nIdentifiers and the words a user reads are separate questions. Identifiers (types, functions,\\nfiles, packages, tables and columns, routes, message keys, stored values, config keys) use one\\nlanguage, the one the code already uses. Interface copy follows the product\'s own language rules.\\nConflating the two is what lets a label leak into a table name; keeping them apart lets either move\\nwithout touching the other.\\n\\n## Formatting\\n<!-- slot: formatting \xB7 optional -->\\nFormat only the files you touched. A formatter run across the whole tree makes a pull request\\nunreviewable; drift that predates you is fixed in a change of its own.\\n\\n## Commits\\n<!-- slot: commits \xB7 optional -->\\nConventional Commits, one coherent change each:\\n\\n- `feat:` a user-visible capability or workflow addition.\\n- `fix:` a behaviour correction.\\n- `docs:` a documentation-only change.\\n- `refactor:` a structure change with no behaviour change.\\n- `test:` a test-only change.\\n- `chore:` tooling, dependencies, or repository maintenance.\\n","playbook/decisions.md":"---\\nform: decisions\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/adr/index.md \u2014 changes in kit/porting/templates--decisions.md -->\\n\\n# Decision records\\n\\nUse this page when recording a decision about how this repository is built, or looking one up.\\n\\n## Where they live\\n<!-- slot: where \xB7 required -->\\nDecision records live in `{config:paths.adr}`. A decision about how we build (an architecture, a\\ntool, a trade-off) is a decision record; a decision about what the product should do is a principle,\\nin the knowledge registers.\\n\\n## Format\\n<!-- slot: format \xB7 required -->\\nA record says that a decision was made, and why: the hard-to-reverse choices a future reader would\\notherwise have to reverse-engineer. One file per record, named `NNNN-<slug>.md` with four digits,\\ntitled `# NNNN \u2014 <the decision>`. Under the title, a status line (accepted; supersedes, or superseded\\nby, another record), then the decision, the options considered with why each was rejected, and the\\nconsequences.\\n\\nA record is never deleted and never rewritten to say something new: a later record supersedes it,\\nand the old one\'s status line points to its successor. A record that states a product decision is\\ntrimmed to its mechanism, and links the principle instead.\\n\\n## Numbering\\n<!-- slot: numbering \xB7 optional -->\\nA new record takes the next free number. `omni kb show decisions` prints it, with every record\'s\\nnumber and title, read from the folder each time: nobody keeps that list by hand. A number belongs\\nto one record; two records sharing one is a mistake to fix, never a precedent.\\n","playbook/definition-of-done.md":"---\\nform: definition-of-done\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/definition-of-done.md \u2014 changes in kit/porting/templates--definition-of-done.md -->\\n\\n# Definition of done\\n\\nUse this page when handing off work or opening a pull request.\\n\\n## Done means\\n<!-- slot: done \xB7 required -->\\n- The changed behaviour is tested, or otherwise verified with the narrowest useful evidence.\\n- The nearest relevant docs are updated when behaviour, workflow, setup, or architecture intent\\n  changes.\\n- The pull request body explains impact, validation, risk, rollback, and reviewer focus.\\n- `{config:commands.preflightFull}` is green; the body names any step it skipped, and why.\\n- The hand-off names the checks that ran and any intentionally skipped.\\n- The pull request is green and mergeable, or carries `{config:labels.needsFix}` and a comment\\n  saying what is stuck after `{config:limits.attempts}` attempts.\\n- A feature pull request\'s outbox is settled, or waved through with `{config:labels.outboxGo}`,\\n  before it is treated as done.\\n- `{config:labels.inProgress}` is off the pull request, and its status comment says where it ended.\\n\\n## Documentation updates\\n<!-- slot: docs \xB7 optional -->\\n- A decision record, when the work changes a durable architectural decision, a dependency\\n  direction, a persistence model, a boundary, or a trade-off future agents must understand.\\n- The knowledge registers, when the work settles something true about the product.\\n- The glossary, when the work introduces, renames, or sharpens domain language.\\n- This playbook, when the lesson is about how future agents should work.\\n- The setup page, when commands, ports, environment variables, or bootstrap steps change.\\n\\n## Commits\\n<!-- slot: commits \xB7 optional -->\\nEach commit is one coherent change, in the Conventional Commit shape. Prefer a few meaningful\\ncommits over one mixed commit that hides unrelated work.\\n","playbook/glossary.md":"---\\nform: glossary\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:CONTEXT.md and docs/glossary.md \u2014 changes in kit/porting/templates--glossary.md -->\\n\\n# Glossary\\n\\nUse this page when you need the word this repository uses for a concept.\\n\\n## Where it lives\\n<!-- slot: where \xB7 required -->\\nWhen the repository keeps a glossary, this form points at it, and `paths.glossary` in the config\\nnames the same page. The glossary defines the words; the knowledge registers hold the rules. An entry says what a\\nterm is, not how it is implemented. When several words exist for one concept, the canonical one is\\ndefined and the others are listed under *Avoid*.\\n","playbook/pull-requests.md":"---\\nform: pull-requests\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/pull-request.md \u2014 changes in kit/porting/templates--pull-requests.md -->\\n\\n# Pull requests\\n\\nUse this page when opening or updating a pull request.\\n\\n## Body\\n<!-- slot: body \xB7 required -->\\n- Start from the repository\'s pull request template when it has one, and leave no placeholder:\\n  real content, `No impact`, or `Not applicable`.\\n- Keep the summary short. The reviewable detail goes in impact, validation, risk, rollback, and\\n  reviewer focus.\\n- Name the business area that owns the change, not the folder it touched, in the glossary\'s words;\\n  list the other areas it could affect. A rule or invariant cites its source of truth.\\n- Validation gives the exact commands that matter, manual steps a reviewer can run as written, and,\\n  for a skipped check, why and what evidence replaces it.\\n- Rollback is explicit, even when it is \\"revert this pull request\\". A change to stored data says how\\n  the data is recovered.\\n\\n## Title\\n<!-- slot: title \xB7 optional -->\\nThe title is a Conventional Commit, `<type>(<scope>): <summary>`, like the commits it carries.\\n\\n## Labels\\n<!-- slot: labels \xB7 optional -->\\nEach kind of pull request carries its label: `{config:labels.feature}` for a feature,\\n`{config:labels.sub}` for a slice, `{config:labels.phase0}` for a phase-0 review. A pull request an\\nagent owns also carries `{config:labels.inProgress}` and a status comment the agent keeps current,\\nuntil it is green or stuck.\\n\\n## Reviewers\\n<!-- slot: reviewers \xB7 optional -->\\nA person merges into `{config:repo.defaultBranch}`; an agent never does. Reviewer focus names the\\nparts of the change most worth scrutinizing.\\n","playbook/releasing.md":"---\\nform: releasing\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/releasing.md \u2014 changes in kit/porting/templates--releasing.md -->\\n\\n# Releasing\\n\\nUse this page when you need to know what a merge publishes.\\n\\n## What a merge publishes\\n<!-- slot: publishes \xB7 required -->\\nYou do not cut a release: merging does. Every merge is either a shipping change, something a\\ndeployed service or a published package actually contains, or one that ships nothing, such as docs,\\nspecs, or tooling. Know which one yours is before it merges.\\n\\n## How a release happens\\n<!-- slot: how \xB7 optional -->\\n- The rules that decide what ships and what the next version is live in code, with tests beside\\n  them, never only in workflow configuration.\\n- A release commits nothing back to `{config:repo.defaultBranch}`: the version lives on its tag.\\n- Asking for more than a patch is a label on the pull request before it merges; a label added after\\n  the merge does nothing.\\n- A running service can say which release it is. One that answers a development version was not\\n  built by the pipeline.\\n\\n## Rollback\\n<!-- slot: rollback \xB7 optional -->\\nWhen something is on fire, run the publishing workflow by hand for the release you mean; never\\npublish from a workstation. A release that went out with the wrong number stands, and the next\\nshipping change corrects it: never retag by hand.\\n","playbook/setup.md":"---\\nform: setup\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:README.md#getting-started \u2014 changes in kit/porting/templates--setup.md -->\\n\\n# Setup\\n\\nUse this page when getting a checkout ready to build, test, and run locally.\\n\\n## Prerequisites\\n<!-- slot: prerequisites \xB7 required -->\\nThe versions the repository pins (its engines field, a version file) win over any number written on\\na page. A single check that says whether a machine is ready beats a list of steps that drifts.\\n\\n## Install\\n<!-- slot: install \xB7 required -->\\nInstall exactly what the lockfile pins, with the package manager that wrote it. An install that\\nrewrites the lockfile is a change to review, never a side effect.\\n\\n## Run\\n<!-- slot: run \xB7 optional -->\\nEach app has a fixed local port of its own, listed in one table. Check that table before giving a\\nnew app its default, so two apps never collide on the next free number.\\n\\n## Environment\\n<!-- slot: env \xB7 optional -->\\nSettings come from the environment. The repository keeps an example file listing every variable,\\nwith a note on where its value comes from. A secret is never committed, and never printed.\\n","playbook/testing.md":"---\\nform: testing\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/testing.md \u2014 changes in kit/porting/templates--testing.md -->\\n\\n# Testing\\n\\nUse this page when adding, changing, or choosing tests.\\n\\n## Commands\\n<!-- slot: commands \xB7 required -->\\n`{config:commands.test}` runs the whole suite. While iterating, run the narrowest test that covers\\nthe change; run the whole suite before handing off.\\n\\n## Where tests live\\n<!-- slot: layout \xB7 required -->\\nName one existing test per kind that shows the house style: a new test starts from it rather than\\nfrom a blank file.\\n\\n## Choosing the level\\n<!-- slot: levels \xB7 optional -->\\n- Start from the behaviour, invariant, or integration risk the change creates.\\n- Prefer red-green-refactor when the expected behaviour is clear.\\n- Add characterization tests before a risky refactor, so existing behaviour is pinned before the\\n  code is reshaped.\\n- Choose the narrowest test that proves the risk. Broaden only when the risk is in the integration\\n  between layers.\\n\\n| Change | Useful test shape |\\n|---|---|\\n| A schema, config, normalizer, or parser | A unit test with valid and invalid inputs |\\n| A domain invariant or business rule | A test of the service or capability where the rule lives |\\n| Storage or migration behaviour | A persistence test with realistic rows |\\n| An API boundary | A test for validation, response shape, and failures |\\n| Behaviour across layers, at the edge | An acceptance scenario |\\n| A UI workflow | A component or page test for its states and actions; a manual browser path for visual risk |\\n\\nCover invalid inputs at a boundary, not only the happy path; error behaviour and the failure states\\na user sees, when they are part of the workflow; the invariants that must survive a refactor;\\ncontract compatibility when a shared schema changes; and the existing workflows the change could\\nplausibly affect.\\n\\n## Never\\n<!-- slot: never \xB7 required -->\\n- A test never proves implementation trivia: it proves behaviour or risk.\\n- Coverage measures execution, not correctness. Never write an assertion-free test to colour lines,\\n  and never lower a coverage floor or exclude logic to reach a number.\\n- A test never waits on wall-clock time it cannot name. Poll for the condition, or make the delay a\\n  parameter the test sets; raising a timeout is not a fix.\\n- A log assertion reads the emitted structured records, never a logger spy, and never expects\\n  sensitive content (prompts, tokens, keys, cookies, passwords) to appear in a log.\\n\\n## Test data\\n<!-- slot: data \xB7 optional -->\\n- Keep test data small, domain-named, and explicit.\\n- A test that creates shared state (a database, a schema, a folder) tears it down after itself.\\n- What a run writes to a shared environment, it keeps: every record a test creates there gets a\\n  name of its own.\\n","playbook/verification.md":"---\\nform: verification\\nform-version: 1\\nstate: blank\\npoints-to: null\\nevidence: []\\nterraformed: null\\n---\\n\\n<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/verification.md \u2014 changes in kit/porting/templates--verification.md -->\\n\\n# Verification\\n\\nUse this page when handing off changes: what must be green before a pull request, and before a push.\\n\\n## The preflight\\n<!-- slot: preflight \xB7 required -->\\n`{config:commands.preflight}` is the preflight: it is green before a pull request is opened. It\\nruns the half of the gate a laptop can run, stops at the first failure, and says what to fix. What\\nonly CI can run, it names and leaves to CI.\\n\\n## Before every push\\n<!-- slot: before-push \xB7 optional -->\\nRun `{config:commands.preflightFull}` before every push to an open pull request. A sub-pull request\\nruns no CI, so this is its only grade.\\n\\nA commit hook runs only the checks that need no build: a hook that costs minutes buys the habit of\\nskipping it, and then it protects nothing. So a green commit is not a green branch; run the rest\\nyourself when you delete an export or change a signature. Never skip a hook.\\n\\n## Checks\\n<!-- slot: checks \xB7 optional -->\\n- Run the narrowest relevant check while iterating. Broaden it when changing a shared contract,\\n  layering, runtime behaviour, or documentation links.\\n- Every CI job has a local command that runs the same check, so a red job is reproduced locally\\n  under its own name.\\n- A ratchet (a check graded against a recorded baseline: coverage floors, a suppression budget, a\\n  formatting baseline) may only hold or improve. Never relax one to turn a check green; raising a\\n  budget is its own reviewed change, and a gate never rewrites its own thresholds.\\n- The hand-off names the checks that ran, and each check skipped with a concrete reason.\\n"}');
var FRONT_DOOR_TEMPLATE = "README.md";
function templatesDir() {
  return fileURLToPath(new URL("../../templates/", import.meta.url));
}
function templateText(path) {
  if (BUNDLED) {
    if (!Object.hasOwn(BUNDLED, path)) throw new Error(`the bundle carries no template ${path}`);
    return BUNDLED[path];
  }
  return readFileSync14(join18(templatesDir(), path), "utf8");
}
function templatePath(id) {
  if (!FORM_IDS.includes(id)) throw new Error(`the kit has no form "${id}"`);
  return `playbook/${id}.md`;
}
function formTemplate(id) {
  return templateText(templatePath(id));
}
function frontDoorTemplate() {
  return templateText(FRONT_DOOR_TEMPLATE);
}

// kit/lib/playbook/status.mjs
function blobHash(path, { ctx, exec }) {
  try {
    return exec("git", ["hash-object", "--", path], { cwd: ctx.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
function staleEvidence(evidence, { ctx, exec }) {
  const out = [];
  for (const { path, hash } of evidence) {
    const exists = existsSync14(join19(ctx.root, path));
    const now = exists ? blobHash(path, { ctx, exec }) : null;
    if (now === null || !now.startsWith(hash)) out.push({ path, hash, now, exists });
  }
  return out;
}
function formSource(resolved) {
  if (resolved.state === "pointer") return "pointer";
  const sources = resolved.sections.map((section3) => section3.source);
  if (sources.includes("repo")) return "repo";
  if (sources.includes("pointer")) return "pointer";
  return "kit";
}
function playbookStatus({ ctx, exec }) {
  const forms = FORMS.map(({ id, kind }) => {
    const resolved = resolveForm(id, { ctx, template: formTemplate(id) });
    const read = readForm(id, { ctx });
    const form2 = read.exists && read.ok ? read.form : null;
    return {
      form: id,
      kind,
      file: resolved.file,
      state: resolved.state,
      source: formSource(resolved),
      sections: resolved.sections.map(({ slot, source }) => ({ slot, source })),
      questions: (form2?.slots ?? []).flatMap((slot) => slot.body.questions.map((question) => ({ slot: slot.id, question }))),
      stale: staleEvidence(form2?.evidence ?? [], { ctx, exec }).map(({ path, hash, now }) => ({ path, hash, now }))
    };
  });
  return { frontDoor: ctx.layout.frontDoor, forms };
}

// kit/lib/playbook/check-playbook.mjs
function gradeForm({ id, kind }, { ctx, exec }) {
  const read = readForm(id, { ctx });
  const { file } = read;
  if (!read.exists) return { state: "missing", violations: [], warnings: [`${file}: missing \u2014 the kit defaults apply; \`omni kb init\` writes it`] };
  if (!read.ok) return { state: "invalid", violations: read.errors, warnings: [] };
  const { form: form2 } = read;
  const kit = parseForm(formTemplate(id)).form;
  const gone = (path) => !existsSync15(join20(ctx.root, path));
  const violations = [];
  const warnings = [];
  if (form2.id !== id) violations.push(`${file}: front matter says form: ${form2.id}, but this is the ${id} form's file`);
  if (form2.formVersion > kit.formVersion) {
    violations.push(`${file}: form-version ${form2.formVersion} is newer than this kit's ${kit.formVersion} for the ${id} form \u2014 upgrade the kit`);
  }
  if (form2.pointsTo !== null && gone(form2.pointsTo)) violations.push(`${file}: points-to ${form2.pointsTo} does not exist`);
  if (form2.index !== null && gone(form2.index)) violations.push(`${file}: index ${form2.index} does not exist`);
  for (const { path, hash, now, exists } of staleEvidence(form2.evidence, { ctx, exec })) {
    if (!exists) violations.push(`${file}: evidence ${path} does not exist`);
    else if (now === null) warnings.push(`${file}: evidence ${path}@${hash} could not be hashed`);
    else warnings.push(`${file}: evidence ${path}@${hash} is stale \u2014 the file has changed since (now ${now.slice(0, 7)})`);
  }
  const pointer = form2.state === "pointer";
  for (const slot of form2.slots) {
    const kitSlot = kit.slots.find((entry) => entry.id === slot.id);
    if (!kitSlot) {
      violations.push(`${file}: slot "${slot.id}" is not a slot of the ${id} form \u2014 its slots are ${kit.slots.map((entry) => entry.id).join(", ")}`);
    }
    if (slot.body.kind === "pointer" && gone(slot.body.see.path)) violations.push(`${file}: "## ${slot.heading}" See: ${slot.body.see.path} does not exist`);
    if (kitSlot?.required && kind === "core" && !pointer && slot.body.kind === "empty") {
      warnings.push(`${file}: required slot "${slot.id}" is blank \u2014 the kit default applies`);
    }
    for (const question of slot.body.questions) warnings.push(`${file}: "## ${slot.heading}" TODO(human): ${question}`);
  }
  if (!pointer) {
    for (const kitSlot of kit.slots.filter((entry) => entry.required && !form2.slots.some((slot) => slot.id === entry.id))) {
      violations.push(`${file}: required slot "${kitSlot.id}" has no marker \u2014 want "## ${kitSlot.heading}", then <!-- slot: ${kitSlot.id} \xB7 required -->`);
    }
  }
  return { state: form2.state, violations, warnings };
}
function gradePlaybook({ ctx, exec }) {
  const violations = [];
  const warnings = [];
  const forms = FORMS.map((entry) => {
    const grade = gradeForm(entry, { ctx, exec });
    violations.push(...grade.violations);
    warnings.push(...grade.warnings);
    return { form: entry.id, state: grade.state };
  });
  return { violations, warnings, forms };
}

// kit/bin/commands/check.mjs
var USAGE3 = "usage: omni check [inbox|outbox|knowledge|kb|coverage|all] [--base <ref>] [--prd <n>]";
function report(stdout, title, violations, passLine) {
  if (violations.length > 0) {
    println(stdout, formatFailure(title, violations));
    return false;
  }
  println(stdout, formatPass(passLine));
  return true;
}
function checkInbox({ ctx, stdout }) {
  const violations = findInboxViolations({ ctx });
  const count = ctx.layout.specFiles().length;
  return report(
    stdout,
    "check inbox \u2014 an inbox file does not hold what it claims:",
    violations,
    `check inbox \u2014 ${count} inbox file(s), all well-formed.`
  );
}
function checkOutbox({ ctx, stdout }) {
  const violations = findOutboxViolations({ ctx });
  const count = outboxItemFiles({ ctx }).length;
  return report(
    stdout,
    "check outbox \u2014 an outbox item does not hold what it claims:",
    violations,
    `check outbox \u2014 ${count} open item(s), all well-formed.`
  );
}
function checkKnowledge({ ctx, stdout, stderr }) {
  const root = ctx.layout.knowledgeRoot;
  const title = "check knowledge \u2014 the knowledge folder does not hold what it claims:";
  if (!existsSync16(join21(ctx.root, root))) {
    if (ctx.config.laws.source === "knowledge") {
      return report(stdout, title, [`${root}: missing \u2014 laws.source is "knowledge", so the laws are read from here.`], "");
    }
    println(stdout, formatPass(`check knowledge \u2014 no knowledge folder at ${root}; nothing to grade (laws.source is "${ctx.config.laws.source}").`));
    return true;
  }
  const files = trackedFiles(ctx).filter((file) => file.startsWith(`${root}/`) && file.endsWith(".md"));
  const { violations, wishes } = gradeKnowledge({ ctx, files });
  for (const wish of wishes) println(stderr, `warning: ${wish}`);
  const knowledge2 = readKnowledge({ ctx });
  const count = (kind) => knowledge2.entries.filter((entry) => entry.kind === kind).length;
  return report(
    stdout,
    title,
    violations,
    `check knowledge \u2014 ${count("principle")} principle(s), ${count("rule")} rule(s), ${count("invariant")} invariant(s) across ${knowledge2.domains.length} domain(s) and ${knowledge2.crossDomainFiles.length} cross-domain file(s); ${wishes.length} wish(es).`
  );
}
var FORM_STATES2 = ["filled", "pointer", "blank", "missing"];
function checkKb({ ctx, stdout, stderr, exec }) {
  const { violations, warnings, forms } = gradePlaybook({ ctx, exec });
  for (const warning of warnings) println(stderr, `warning: ${warning}`);
  const counts = FORM_STATES2.map((state) => [state, forms.filter((form2) => form2.state === state).length]).filter(([, count]) => count > 0).map(([state, count]) => `${count} ${state}`);
  return report(
    stdout,
    "check kb \u2014 a form does not hold what it claims:",
    violations,
    `check kb \u2014 ${forms.length} form(s): ${counts.join(", ")}; ${warnings.length} warning(s).`
  );
}
function defaultBase(ctx) {
  return `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;
}
function refExists(ctx, ref, exec) {
  try {
    exec("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: ctx.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}
function checkCoverage({ ctx, stdout, exec }, { base, prd: prd2 }) {
  let ok = report(
    stdout,
    "check coverage \u2014 an account file does not hold what it claims:",
    findFormatViolations({ ctx }),
    `check coverage \u2014 ${discoveredPrds({ ctx }).length} PRD outbox dir(s) checked, every account well-formed.`
  );
  if (prd2 === null) return ok;
  const risky = riskyChanges(rangeChanges({ ctx, base, exec }), { ctx });
  const result = gradePrd(prd2, risky, { ctx });
  for (const entry of result.stale) {
    println(
      stdout,
      `check coverage \u2014 PRD #${prd2}: stale \u2014 ${entry.file}: \`${entry.path}\` (${entry.rule}) does not match this range; reported, not fatal.`
    );
  }
  const violations = [...result.malformed, ...result.unaccounted.map((change) => describeUnaccounted(prd2, change))];
  ok = report(
    stdout,
    `check coverage \u2014 PRD #${prd2}, range ${base}...HEAD:`,
    violations,
    `check coverage \u2014 PRD #${prd2}: ${risky.length} risky change(s) in range, ${result.accounted.length} accounted for.`
  ) && ok;
  return ok;
}
var GUARDS = ["inbox", "outbox", "knowledge", "kb", "coverage", "all"];
var check = {
  async run(args, io) {
    const { ctx, stdout, exec } = io;
    const { positional, flags } = parseArgs("check", args, { values: ["base", "prd"] });
    if (positional.length > 1 || positional[0] && !GUARDS.includes(positional[0])) throw usageError(USAGE3);
    const guard = positional[0] ?? "all";
    const prd2 = flags.prd === void 0 ? null : positiveInt("check", "--prd", flags.prd);
    const base = flags.base ?? defaultBase(ctx);
    const baseKnown = refExists(ctx, base, exec);
    if (flags.base !== void 0 && !baseKnown) {
      throw usageError(`omni check: no ${base} \u2014 fetch it or pass another --base <ref>.`);
    }
    const coverageRuns = guard === "coverage" || guard === "all" && baseKnown;
    if (prd2 !== null && !coverageRuns) println(io.stderr, `omni check: --prd ${prd2} ignored \u2014 the coverage guard did not run.`);
    if (guard === "inbox") return checkInbox(io) ? 0 : 1;
    if (guard === "outbox") return checkOutbox(io) ? 0 : 1;
    if (guard === "knowledge") return checkKnowledge(io) ? 0 : 1;
    if (guard === "kb") return checkKb(io) ? 0 : 1;
    if (guard === "coverage") {
      if (!baseKnown) throw usageError(`omni check coverage: no ${base} \u2014 fetch it or pass --base <ref>.`);
      return checkCoverage(io, { base, prd: prd2 }) ? 0 : 1;
    }
    const results = [checkInbox(io), checkOutbox(io), checkKnowledge(io), checkKb(io)];
    if (baseKnown) results.push(checkCoverage(io, { base, prd: prd2 }));
    else println(stdout, `coverage: skipped \u2014 no ${base}`);
    return results.every(Boolean) ? 0 : 1;
  }
};

// kit/bin/commands/comment.mjs
init_define_OMNI_BUNDLE();
import { writeFileSync as writeFileSync6 } from "node:fs";

// kit/lib/outbox/comment.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync18, readFileSync as readFileSync15, writeFileSync as writeFileSync5 } from "node:fs";

// kit/lib/outbox/banter.mjs
init_define_OMNI_BUNDLE();
var INTROS = Object.freeze([
  "Here is a small question with surprisingly strong opinions.",
  "This one looked simple right up until it did not.",
  "The spec went quiet here, which is rare and a little suspicious.",
  "A question walks into a pull request and politely asks for a minute.",
  "Two sensible ideas met in this change, and only one could stay.",
  "Not every decision is dramatic, but this one did try its best.",
  "This question has been rehearsing its big moment all week.",
  "The kind of question that sounds easy until it is asked out loud.",
  "Found in the margin of the spec, next to a very small question mark.",
  "The build kept going and left this question behind like a bookmark.",
  "Nothing is on fire; this is simply a question with good manners.",
  "One more choice, gift-wrapped and labelled with care.",
  "Fresh from the workshop, and still warm from the build.",
  "Some questions knock politely, and this is one of them.",
  "This decision was made in pencil, on purpose.",
  "Behind every tidy change sits a judgement call, and here it is.",
  "A crossroads so small it barely needed a sign, so here is the sign.",
  "Every plan has a gap somewhere, and this one found a very tidy gap.",
  "Plot twist: the easy part had a question hiding in it.",
  "Here is a question that deserves better than a shrug.",
  "A decision was made, and it would like to be introduced properly.",
  "Somewhere between two good ideas, a choice had to be made.",
  "Presenting a question that kept its promise to stay short.",
  "The agent paused here, picked a path, and left a note on the door.",
  "Every piece of work leaves one crumb of doubt, and this is the crumb.",
  "A fork in the road, freshly swept and ready for visitors.",
  "This question was found hiding behind a perfectly reasonable assumption.",
  "Today's small mystery comes with a clue and a best guess."
]);
var PUNCHLINES = Object.freeze([
  "Nothing here is carved in stone, only lightly pencilled.",
  "The good news is that every pencil comes with an eraser.",
  "No wrong answers here, only reversible ones.",
  "Changing course later costs a little, not a lot.",
  "The agent has a hunch, and hunches love a second opinion.",
  "Quick to read, and oddly satisfying to settle.",
  "It sounds bigger than it is, like most things before lunch.",
  "The work did not wait, but it did leave a light on.",
  "Every settled question makes the next build a little calmer.",
  "Settling it takes a minute, and the minute is well spent.",
  "It is easier to answer than it was to ask.",
  "Answers of every size are welcome here.",
  "Nothing breaks while it waits; it just waits a little hopefully.",
  "A calm answer now saves a long thread later.",
  "One small answer, many quieter tomorrows.",
  "Nothing dramatic, just a small signpost waiting for its arrow.",
  "Sometimes the sensible choice and the fun choice are the same one.",
  "It is only a question, but it has been very well behaved.",
  "The code carries on meanwhile; it just likes to be sure.",
  "Half the fun of a question is watching it turn into a decision.",
  "Best of all, the answer fits on one line.",
  "The worst case is a small rework, and small reworks are friendly.",
  "Clarity is cheap today and pricey next month.",
  "The question is short, and the peace of mind lasts much longer.",
  "Somewhere, a future bug just got a little nervous.",
  "Every question answered is one less surprise at release time.",
  "A good question ages like milk, so this one is served fresh.",
  "Small print, big relief once it is settled."
]);
var BANTER_POOL = Object.freeze({ intros: INTROS, punchlines: PUNCHLINES });
function stableHash(text2) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(text2)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function serveLines(ids, lines, salt) {
  const taken = /* @__PURE__ */ new Set();
  const served = /* @__PURE__ */ new Map();
  for (const id of ids) {
    if (taken.size === lines.length) taken.clear();
    let index = stableHash(`${salt}:${id}`) % lines.length;
    while (taken.has(index)) index = (index + 1) % lines.length;
    taken.add(index);
    served.set(id, lines[index]);
  }
  return served;
}
function assignBanter(ids, { pool = BANTER_POOL } = {}) {
  const intros = serveLines(ids, pool.intros, "intro");
  const punchlines = serveLines(ids, pool.punchlines, "punchline");
  return new Map(ids.map((id) => [id, { intro: intros.get(id), punchline: punchlines.get(id) }]));
}

// kit/lib/outbox/status.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync17 } from "node:fs";
function openItemFiles(prd2, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd2);
  if (outboxDir === null) return [];
  const prefix = `${outboxDir}/`;
  return outboxItemFiles({ ctx }).filter((file) => file.startsWith(prefix));
}
function describeItem(file, { ctx }) {
  const text2 = readRepoFile(ctx, file);
  const parsed = parseOutboxItem(text2, { file });
  return parsed.ok ? { file, id: parsed.item.id, rank: parsed.item.rank } : { file, id: null, rank: null };
}
function openItems(prd2, { ctx }) {
  return openItemFiles(prd2, { ctx }).map((file) => describeItem(file, { ctx }));
}
function unaccountedChanges(prd2, changes, { ctx }) {
  const risky = riskyChanges(changes, { ctx });
  const accounts = readAccounts(prd2, { ctx }).filter((result) => result.ok).map((result) => result.account);
  return compare(risky, accounts).unaccounted;
}
function unreworkedDrift(prd2, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd2);
  if (outboxDir === null) return [];
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  if (!existsSync17(`${ctx.root}/${settledFile}`)) return [];
  const entries = parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers);
  return entries.filter((entry) => entry.verdict === "drifted" && !entry.closed).map((entry) => ({ id: entry.id, closedLine: entry.fields.Closed }));
}
function gateResult(prd2, { ctx, labels = [], changes = null } = {}) {
  const items = openItems(prd2, { ctx });
  const unreworked = unreworkedDrift(prd2, { ctx });
  const overrideLabel = ctx.config.labels.outboxGo;
  const overridden = labels.includes(overrideLabel);
  if (changes === null) {
    const ok2 = overridden || items.length === 0 && unreworked.length === 0;
    return { ok: ok2, items, overridden, unreworked, overrideLabel };
  }
  const unaccounted = unaccountedChanges(prd2, changes, { ctx });
  const ok = overridden || items.length === 0 && unreworked.length === 0 && unaccounted.length === 0;
  return { ok, items, overridden, unreworked, unaccounted, overrideLabel };
}
function formatItem(item2) {
  return item2.rank ? `  - ${item2.file} (${item2.rank})` : `  - ${item2.file}`;
}
function formatUnaccounted(change) {
  return `  - ${change.path} (${change.rule})`;
}
function formatUnreworked(entry) {
  return `  - ${entry.id}`;
}
function formatReport(prd2, result) {
  const lines = [];
  if (result.items.length === 0) {
    lines.push(`outbox-status \u2014 PRD #${prd2}: no open item.`);
  } else {
    lines.push(`outbox-status \u2014 PRD #${prd2}: ${result.items.length} open item(s):`);
    lines.push(...result.items.map(formatItem));
  }
  if ((result.unreworked ?? []).length > 0) {
    const n = result.unreworked.length;
    lines.push(
      `${n} drifted decision${n === 1 ? "" : "s"} not yet reworked \u2014 run ${COMMANDS.yoloFix} #${prd2}`
    );
    lines.push(...result.unreworked.map(formatUnreworked));
  }
  if (result.unaccounted !== void 0) {
    if (result.unaccounted.length === 0) {
      lines.push("outbox-status \u2014 no unaccounted risky change.");
    } else {
      lines.push(`outbox-status \u2014 ${result.unaccounted.length} unaccounted risky change(s):`);
      lines.push(...result.unaccounted.map(formatUnaccounted));
    }
  }
  if (result.overridden) {
    lines.push(`${result.overrideLabel} \u2014 override in effect; waved through.`);
  }
  return lines.join("\n");
}

// kit/lib/outbox/comment.mjs
function openItemsForPrd(prd2, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd2);
  if (outboxDir === null) return [];
  const prefix = `${outboxDir}/`;
  const items = [];
  for (const file of outboxItemFiles({ ctx })) {
    if (!file.startsWith(prefix)) continue;
    const parsed = parseOutboxItem(readRepoFile(ctx, file), { file });
    if (parsed.ok) items.push(parsed.item);
  }
  return items;
}
function sortItems(items) {
  return [...items].sort((a, b) => {
    const byRank = RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
    return byRank !== 0 ? byRank : a.id.localeCompare(b.id);
  });
}
function fileUrl({ owner, repo, ref, file }) {
  return `https://github.com/${owner}/${repo}/blob/${ref}/${file}`;
}
function sortUnaccountedChanges(changes) {
  return [...changes].sort((a, b) => {
    const byPath = a.path.localeCompare(b.path);
    return byPath !== 0 ? byPath : a.rule.localeCompare(b.rule);
  });
}
function announcedKeys({ items, unaccounted }) {
  const keys = [
    ...items.map((item2) => item2.id),
    ...unaccounted.map((change) => `${change.rule}:${change.path}`)
  ];
  return [...new Set(keys)].sort();
}
function formatAnnouncedMarker(keys, markers) {
  return `${markers.announcedPrefix}${keys.join(",")}${markers.announcedSuffix}`;
}
function parseAnnouncedMarker(body, markers) {
  if (typeof body !== "string") return [];
  const match = body.match(markers.announcedRe);
  if (!match) return [];
  const value = match[1].trim();
  return value === "" ? [] : value.split(",");
}
function formatOutboxComment({
  prd: prd2,
  owner,
  repo,
  branch,
  ref = branch,
  items,
  unaccounted = [],
  unreworked = [],
  labels = [],
  ctx
}) {
  const sorted = sortItems(items);
  const lines = [ctx.markers.comment, "", `**Outbox \u2014 open items for PRD #${prd2}**`, ""];
  if (sorted.length === 0) {
    lines.push("No open items.");
  } else {
    for (const item2 of sorted) {
      const url = fileUrl({ owner, repo, ref, file: item2.file });
      lines.push(`- \`${item2.rank}\` \u2014 [${item2.id}](${url})`);
    }
  }
  lines.push("");
  if (sorted.length > 0) {
    lines.push(
      `_${sorted.length} open item(s) on \`${branch}\`. Settled items move to \`${ctx.layout.outboxDir(prd2)}/settled.md\`._`
    );
  } else if (unreworked.length > 0) {
    lines.push(
      `_No open item on \`${branch}\`, but drifted and not yet reworked: ${unreworked.map((entry) => entry.id).join(", ")} \u2014 run \`${COMMANDS.yoloFix}\`._`
    );
  } else {
    lines.push(`_Nothing open on \`${branch}\`._`);
  }
  if (sorted.length > 0 && labels.includes(ctx.config.labels.outboxGo)) {
    lines.push("");
    lines.push(
      `_These items were waved through with \`${ctx.config.labels.outboxGo}\` \u2014 waved through, not answered._`
    );
  }
  const sortedUnaccounted = sortUnaccountedChanges(unaccounted);
  if (sortedUnaccounted.length > 0) {
    lines.push("");
    lines.push(`**Unaccounted changes \u2014 PRD #${prd2}**`);
    lines.push("");
    for (const change of sortedUnaccounted) {
      lines.push(`- \`${change.rule}\` \u2014 \`${change.path}\``);
    }
  }
  lines.push("");
  lines.push(
    formatAnnouncedMarker(
      announcedKeys({ items: sorted, unaccounted: sortedUnaccounted }),
      ctx.markers
    )
  );
  return lines.join("\n");
}
function findCommentByMarker(comments, marker) {
  if (!Array.isArray(comments)) return null;
  return comments.find((comment2) => typeof comment2.body === "string" && comment2.body.includes(marker)) ?? null;
}
function findMarkerComment(comments, markers) {
  return findCommentByMarker(comments, markers.comment);
}
function findPrMarkerComment(comments, markers) {
  return findCommentByMarker(comments, markers.prComment);
}
function formatNumbersMarker(numbering, markers) {
  const body = [...numbering].sort((a, b) => a.number - b.number).map((entry) => `${entry.number}=${entry.id}@${entry.since}`).join(",");
  return `${markers.numbersPrefix}${body}${markers.numbersSuffix}`;
}
function parseNumbersMarker(body, markers) {
  if (typeof body !== "string") return [];
  const match = body.match(markers.numbersRe);
  if (!match) return [];
  const value = match[1].trim();
  if (value === "") return [];
  return value.split(",").map((entry) => {
    const [numberPart, rest] = entry.split(/=(.*)/s);
    const at = rest.lastIndexOf("@");
    return { number: Number(numberPart), id: rest.slice(0, at), since: rest.slice(at + 1) };
  });
}
function assignNumbers({ items, previous = [], now = () => (/* @__PURE__ */ new Date()).toISOString() }) {
  const known = new Set(previous.map((entry) => entry.id));
  const maxNumber = previous.reduce((max, entry) => Math.max(max, entry.number), 0);
  const fresh = sortItems(items.filter((item2) => !known.has(item2.id)));
  if (fresh.length === 0) return [...previous];
  const since = now();
  let next = maxNumber + 1;
  const additions = fresh.map((item2) => ({ number: next++, id: item2.id, since }));
  return [...previous, ...additions];
}
function parseRoundMarkers(comments, markers) {
  const rounds = /* @__PURE__ */ new Map();
  for (const comment2 of comments ?? []) {
    if (typeof comment2.body !== "string") continue;
    const match = comment2.body.match(markers.roundRe);
    if (!match) continue;
    const round = Number(match[1]);
    for (const numberText of match[2].split(",")) {
      if (!numberText) continue;
      const number = Number(numberText);
      const current = rounds.get(number);
      if (current === void 0 || round > current) rounds.set(number, round);
    }
  }
  return rounds;
}
function readSettledEntries(prd2, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd2);
  if (outboxDir === null) return [];
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  if (!existsSync18(`${ctx.root}/${settledFile}`)) return [];
  return parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers);
}
function adoptedEntriesForPrd(prd2, { ctx }) {
  return readSettledEntries(prd2, { ctx }).filter((entry) => entry.verdict === ADOPTED_VERDICT);
}
function firstSentence(text2) {
  const trimmed = (text2 ?? "").trim();
  const match = trimmed.match(/[^.!?]+(?:[.!?]+|$)/);
  return (match ? match[0] : trimmed).trim();
}
function answeredQuestionText(entry) {
  const parsed = parseOutboxItem(entry.itemText, { file: null });
  if (!parsed.ok) return "";
  const { sections } = parsed.item;
  return sections.questionPlain ?? firstSentence(sections.whatIHadToDecide);
}
var REWORKED_BY = /reworked by #(\d+)/;
function answeredOutcome(entry) {
  if (entry.verdict === "agreed") return "kept as built";
  const reworkedBy = entry.closed ? (entry.fields?.Closed ?? "").match(REWORKED_BY)?.[1] : null;
  return reworkedBy ? `reworked in #${reworkedBy}` : "to be reworked";
}
function quoteReply(text2) {
  const oneLine2 = (text2 ?? "").replace(/\s+/g, " ").trim();
  const truncated = oneLine2.length > 120 ? `${oneLine2.slice(0, 117)}\u2026` : oneLine2;
  return `"${truncated}"`;
}
var MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];
function formatApprovedAt(approvedAt) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(approvedAt ?? "");
  if (!match) return approvedAt ?? "";
  const [, , month, day] = match;
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]}`;
}
function tableCell(text2) {
  return String(text2 ?? "").replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|");
}
function quoted(text2) {
  return String(text2 ?? "").trim().split("\n").map((line) => line.trim() === "" ? ">" : `> ${line}`).join("\n");
}
function funLine(text2) {
  return `_${String(text2 ?? "").trim().replace(/\s*\n\s*/g, " ")}_`;
}
function formatOptionsTable(options, mark) {
  return [
    "|   | Option | |",
    "| --- | --- | --- |",
    ...options.map(
      (option) => `| ${option.letter} | ${tableCell(option.text)} | ${option.letter === "A" ? `\u2705 ${mark}` : ""} |`
    )
  ];
}
function otherLetter(options) {
  return options.find((option) => option.letter !== "A")?.letter ?? "B";
}
function hasOptions(item2) {
  return Array.isArray(item2.sections?.options) && item2.sections.options.length > 0;
}
function questionBanter({ items, adopted, numberById }) {
  const numberOf = (question) => numberById.get(question.id) ?? Infinity;
  const questions = [
    ...items.map((item2) => ({ id: item2.id, sections: item2.sections })),
    ...adopted.map((entry) => ({ id: entry.id, sections: adoptedItem(entry)?.sections }))
  ].sort((a, b) => numberOf(a) - numberOf(b) || a.id.localeCompare(b.id));
  const banter = /* @__PURE__ */ new Map();
  const fromPool = [];
  for (const { id, sections } of questions) {
    if (sections?.introFun && sections?.punchlineFun) {
      banter.set(id, { intro: sections.introFun, punchline: sections.punchlineFun });
    } else {
      fromPool.push(id);
    }
  }
  for (const [id, lines] of assignBanter(fromPool)) banter.set(id, lines);
  return banter;
}
function openQuestionLines(item2, number, round, banter) {
  const humanAction = item2.rank === "human-action";
  const lines = [
    "---",
    "",
    `### Question ${number} \xB7 ${item2.rank} \u2014 ${humanAction ? "needs a person" : "needs your decision"}`,
    "",
    funLine(banter.intro),
    "",
    quoted(item2.sections.questionPlain),
    "",
    funLine(banter.punchline),
    ""
  ];
  if (humanAction && item2.sections.personSteps) {
    lines.push(
      "**What a person must do:**",
      "",
      item2.sections.personSteps.trim(),
      "",
      `Reply \`${number}: ok\` once it is done, or \`${number}: no, because \u2026\``
    );
  } else if (hasOptions(item2)) {
    const { options } = item2.sections;
    lines.push(
      ...formatOptionsTable(options, "recommended \xB7 built"),
      "",
      `Reply \`${number}: A\`, \`${number}: ${otherLetter(options)} because \u2026\`, or \`go with recommendation\``
    );
  } else {
    lines.push(
      `**Decision taken:** ${item2.sections.decisionPlain}`,
      "",
      `Reply \`${number}: ok\` to keep it, or \`${number}: no, because \u2026\``
    );
  }
  if (round) lines.push("", `_Asked again in round ${round}._`);
  lines.push("");
  return lines;
}
function adoptedItem(entry) {
  const parsed = parseOutboxItem(entry.itemText, { file: null });
  return parsed.ok ? parsed.item : null;
}
function adoptedQuestionLines(entry, number, round, banter) {
  const item2 = adoptedItem(entry);
  const question = item2?.sections.questionPlain ?? answeredQuestionText(entry);
  const options = item2 && hasOptions(item2) ? item2.sections.options : [];
  const lines = [
    `### Question ${number} \xB7 medium \u2014 adopted`,
    "",
    funLine(banter.intro),
    "",
    quoted(question),
    "",
    funLine(banter.punchline),
    ""
  ];
  if (options.length > 0) {
    lines.push(
      ...formatOptionsTable(options, "adopted \xB7 built"),
      "",
      `To object, reply \`${number}: ${otherLetter(options)} because \u2026\``
    );
  } else {
    if (item2?.sections.decisionPlain) {
      lines.push(`**Decision taken:** ${item2.sections.decisionPlain}`, "");
    }
    lines.push(`To object, reply \`${number}: no, because \u2026\``);
  }
  if (round) lines.push("", `_Asked again in round ${round}._`);
  lines.push("");
  return lines;
}
function formatOutboxPrComment({
  items,
  adopted = [],
  answered = [],
  numbering,
  roundMarkers = /* @__PURE__ */ new Map(),
  ctx
}) {
  const sorted = sortItems(items);
  const numberById = new Map(numbering.map((entry) => [entry.id, entry.number]));
  const byNumber = (a, b) => (numberById.get(a.id) ?? 0) - (numberById.get(b.id) ?? 0);
  const banter = questionBanter({ items: sorted, adopted, numberById });
  const lines = [ctx.markers.prComment, ""];
  if (sorted.length > 0) {
    const count = sorted.length;
    const example = numberById.get(sorted.at(-1).id) ?? 1;
    lines.push(
      `**${count} question${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} your decision**`,
      "",
      `Reply to this comment, one line per question: \`${example}: A\` keeps what was built, \`${example}: B because \u2026\` chooses another option. Several answers can go in one reply. To keep every recommendation at once, reply \`go with recommendation\`.`,
      "",
      `_A reply settles nothing on its own \u2014 \`${COMMANDS.yoloFix}\` reads the replies and settles them._`,
      ""
    );
    for (const item2 of sorted) {
      const number = numberById.get(item2.id);
      lines.push(...openQuestionLines(item2, number, roundMarkers.get(number), banter.get(item2.id)));
    }
  } else if (adopted.length > 0) {
    lines.push("**Nothing needs your decision**", "");
  } else if (answered.length > 0) {
    lines.push("**Every question is answered**", "");
  } else {
    lines.push("No open items.", "");
  }
  if (adopted.length > 0) {
    lines.push(
      "---",
      "",
      `<details><summary>Adopted unless you object \xB7 ${adopted.length} medium</summary>`,
      ""
    );
    for (const entry of [...adopted].sort(byNumber)) {
      const number = numberById.get(entry.id);
      lines.push(
        ...adoptedQuestionLines(entry, number, roundMarkers.get(number), banter.get(entry.id))
      );
    }
    lines.push("</details>", "");
  }
  if (answered.length > 0) {
    lines.push("**Answered**", "");
    for (const entry of [...answered].sort(byNumber)) {
      const number = numberById.get(entry.id);
      const question = answeredQuestionText(entry);
      lines.push(`**Question ${number}**`, "");
      if (question) lines.push(question, "");
      lines.push(
        `Reply: ${quoteReply(entry.answerText)} \u2014 @${entry.fields?.["Approved by"] ?? ""}, ${formatApprovedAt(entry.fields?.["Approved at"])} \xB7 ${answeredOutcome(entry)}`,
        ""
      );
    }
  }
  lines.push(formatNumbersMarker(numbering, ctx.markers));
  return lines.join("\n");
}
function upsertOutboxPrComment({ prd: prd2, ctx, now = () => (/* @__PURE__ */ new Date()).toISOString() }, client) {
  const items = openItemsForPrd(prd2, { ctx });
  const settledEntries = readSettledEntries(prd2, { ctx });
  const comments = client.listComments();
  const existing = findPrMarkerComment(comments, ctx.markers);
  const adopted = settledEntries.filter((entry) => entry.verdict === ADOPTED_VERDICT);
  const previous = existing ? parseNumbersMarker(existing.body, ctx.markers) : [];
  const numbering = assignNumbers({
    items: [...items, ...adopted.map((entry) => ({ id: entry.id, rank: "medium" }))],
    previous,
    now
  });
  const numberedIds = new Set(numbering.map((entry) => entry.id));
  const answered = settledEntries.filter(
    (entry) => entry.verdict !== ADOPTED_VERDICT && numberedIds.has(entry.id)
  );
  const hasSomethingToList = items.length > 0 || adopted.length > 0 || answered.length > 0;
  if (!existing && !hasSomethingToList) {
    return {
      action: "skipped",
      id: null,
      htmlUrl: null,
      openCount: 0,
      answeredCount: 0,
      adoptedCount: 0,
      newAdoptedCount: 0,
      body: null
    };
  }
  const previouslyNumbered = new Set(previous.map((entry) => entry.id));
  const counted = {
    openCount: items.length,
    answeredCount: answered.length,
    adoptedCount: adopted.length,
    newAdoptedCount: adopted.filter((entry) => !previouslyNumbered.has(entry.id)).length
  };
  const roundMarkers = parseRoundMarkers(
    comments.filter((comment2) => comment2.id !== existing?.id),
    ctx.markers
  );
  const body = formatOutboxPrComment({ items, adopted, answered, numbering, roundMarkers, ctx });
  if (existing) {
    const updated = client.updateComment(existing.id, body);
    return {
      action: "updated",
      id: existing.id,
      htmlUrl: updated?.html_url ?? existing.html_url ?? null,
      ...counted,
      body
    };
  }
  const created = client.createComment(body);
  return {
    action: "created",
    id: created?.id ?? null,
    htmlUrl: created?.html_url ?? null,
    ...counted,
    body
  };
}
function countsByRank(items) {
  const counts = {};
  for (const item2 of items) {
    counts[item2.rank] = (counts[item2.rank] ?? 0) + 1;
  }
  return counts;
}
function slackEscape(text2) {
  return text2.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
var SLACK_USER_ID = /^[UW][A-Z0-9]{2,}$/;
function slackOwner({ slackId, login } = {}) {
  if (typeof slackId === "string" && SLACK_USER_ID.test(slackId)) return { slackId };
  if (typeof login === "string" && login.trim() !== "") return { login: login.trim() };
  return null;
}
function ownerText(owner) {
  if (owner?.slackId) return `<@${owner.slackId}>`;
  if (owner?.login) return `@${slackEscape(owner.login)}`;
  return null;
}
function linkLabel(url) {
  const pull = url.match(/\/pull\/(\d+)/);
  return pull ? `Answer on pull request #${pull[1]} \u2192` : "Answer on the PRD issue \u2192";
}
function slackLine({
  prd: prd2,
  title,
  owner,
  counts,
  adoptedCount = 0,
  unaccountedCount = 0,
  url
}) {
  const cleanTitle = (title ?? "").replace(/^\s*PRD:\s*/i, "").trim();
  const name = cleanTitle ? `PRD #${prd2} \xB7 ${slackEscape(cleanTitle)}` : `PRD #${prd2}`;
  const who = ownerText(owner);
  const head = who ? `*${name}* \u2014 owner ${who}` : `*${name}*`;
  const waiting = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const parts = [];
  if (waiting > 0) {
    parts.push(`${waiting} question${waiting === 1 ? " needs" : "s need"} a decision`);
  }
  if (adoptedCount > 0) parts.push(`${adoptedCount} adopted unless someone objects`);
  if (unaccountedCount > 0) parts.push(plural(unaccountedCount, "unaccounted change"));
  const tally = parts.length > 0 ? parts.join(" \xB7 ") : "Nothing needs a decision";
  const lines = [head, tally];
  if (url) lines.push(`<${url}|${linkLabel(url)}>`);
  return lines.join("\n");
}
function readPrCommentResult(path, { read = (file) => readFileSync15(file, "utf8") } = {}) {
  if (!path) return null;
  try {
    const parsed = JSON.parse(read(path));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function maybeWriteSlackNote({
  ctx,
  prd: prd2,
  title = null,
  owner = null,
  result,
  prComment = null,
  path,
  write = writeFileSync5
}) {
  if (!ctx.config.notify.slack) return;
  const news = (result.newCount ?? 0) + (prComment?.newAdoptedCount ?? 0);
  if (!path || !(news > 0)) return;
  const line = slackLine({
    prd: prd2,
    title,
    owner,
    counts: result.counts,
    adoptedCount: result.adoptedCount ?? 0,
    unaccountedCount: result.unaccountedCount,
    newCount: news,
    url: prComment?.htmlUrl ?? result.htmlUrl
  });
  write(path, `${line}
`);
}
function upsertOutboxComment({ prd: prd2, owner, repo, branch, ref = branch, ctx, changes = [], labels = [] }, client) {
  const items = openItemsForPrd(prd2, { ctx });
  const unaccounted = unaccountedChanges(prd2, changes, { ctx });
  const unreworked = unreworkedDrift(prd2, { ctx });
  const body = formatOutboxComment({ prd: prd2, owner, repo, branch, ref, items, unaccounted, unreworked, labels, ctx });
  const counts = countsByRank(items);
  const adoptedCount = adoptedEntriesForPrd(prd2, { ctx }).length;
  const existing = findMarkerComment(client.listComments(), ctx.markers);
  const hasSomethingToList = items.length > 0 || unaccounted.length > 0;
  if (!existing && !hasSomethingToList) {
    return {
      action: "skipped",
      id: null,
      htmlUrl: null,
      itemCount: 0,
      unaccountedCount: 0,
      newCount: 0,
      counts,
      adoptedCount,
      body
    };
  }
  const previousKeys = new Set(existing ? parseAnnouncedMarker(existing.body, ctx.markers) : []);
  const newKeys = announcedKeys({
    items: sortItems(items),
    unaccounted: sortUnaccountedChanges(unaccounted)
  });
  const newCount = newKeys.filter((key) => !previousKeys.has(key)).length;
  if (existing) {
    const updated = client.updateComment(existing.id, body);
    return {
      action: "updated",
      id: existing.id,
      htmlUrl: updated?.html_url ?? existing.html_url ?? null,
      itemCount: items.length,
      unaccountedCount: unaccounted.length,
      newCount,
      counts,
      adoptedCount,
      body
    };
  }
  const created = client.createComment(body);
  return {
    action: "created",
    id: created?.id ?? null,
    htmlUrl: created?.html_url ?? null,
    itemCount: items.length,
    unaccountedCount: unaccounted.length,
    newCount,
    counts,
    adoptedCount,
    body
  };
}

// kit/bin/commands/comment.mjs
var USAGE4 = "usage: omni comment --prd <n> --branch <feature-branch> [--repo <owner/name>] [--base <ref>] [--ref <sha>] [--labels <a,b>] [--slack-note <file>] [--title <t>] [--owner-slack-id <id>] [--owner-login <login>] [--pr-comment <file>] | omni comment --prd <n> --pr <n> [--repo <owner/name>] [--result <file>]";
var comment = {
  async run(args, { ctx, stdout, exec, env }) {
    const { positional, flags } = parseArgs("comment", args, {
      values: ["prd", "pr", "repo", "result", "branch", "ref", "base", "labels", "slack-note", "title", "owner-slack-id", "owner-login", "pr-comment"]
    });
    if (positional.length) throw usageError(USAGE4);
    const prd2 = positiveInt("comment", "--prd", flags.prd);
    const repo = repoSlug("comment", ctx, flags.repo);
    const [owner, name] = repo.split("/");
    if (flags.pr !== void 0) {
      const pr = positiveInt("comment", "--pr", flags.pr);
      const result2 = upsertOutboxPrComment({ prd: prd2, ctx }, githubClientFor(ctx, { repo, issue: pr, exec, env }));
      println(
        stdout,
        `omni comment: ${result2.action} pull request comment #${result2.id ?? "?"} on PR #${pr} \u2014 ${result2.openCount} open question(s), ${result2.answeredCount} answered, ${result2.adoptedCount} adopted (${result2.newAdoptedCount} new).`
      );
      if (flags.result) {
        const { htmlUrl, adoptedCount, newAdoptedCount } = result2;
        writeFileSync6(inRoot(ctx, flags.result), `${JSON.stringify({ htmlUrl, adoptedCount, newAdoptedCount })}
`);
      }
      return 0;
    }
    const branch = flags.branch;
    if (!branch) throw usageError(USAGE4);
    const ref = flags.ref ?? branch;
    let changes = [];
    if (flags.base) {
      try {
        changes = rangeChanges({ ctx, base: flags.base, exec });
      } catch (error) {
        throw usageError(error.message.split("\n")[0]);
      }
    }
    const result = upsertOutboxComment(
      { prd: prd2, owner, repo: name, branch, ref, ctx, changes, labels: list(flags.labels) },
      githubClientFor(ctx, { repo, issue: prd2, exec, env })
    );
    println(
      stdout,
      `omni comment: ${result.action} comment #${result.id ?? "?"} on issue #${prd2} \u2014 ${result.itemCount} open item(s), ${result.unaccountedCount} unaccounted change(s), ${result.newCount} new.`
    );
    maybeWriteSlackNote({
      ctx,
      prd: prd2,
      title: flags.title ?? null,
      owner: slackOwner({ slackId: flags["owner-slack-id"] ?? null, login: flags["owner-login"] ?? null }),
      result,
      prComment: readPrCommentResult(flags["pr-comment"] ? inRoot(ctx, flags["pr-comment"]) : null),
      path: flags["slack-note"] ? inRoot(ctx, flags["slack-note"]) : null
    });
    return 0;
  }
};

// kit/bin/commands/config.mjs
init_define_OMNI_BUNDLE();
var config = {
  async run(args, { ctx, stdout }) {
    const { positional } = parseArgs("config", args);
    if (positional.length > 1) throw usageError("usage: omni config [key.path]");
    const [key] = positional;
    let value = ctx.config;
    if (key) {
      for (const part of key.split(".")) {
        if (value === null || typeof value !== "object" || !Object.hasOwn(value, part)) {
          throw usageError(`omni config: no key ${key}.`);
        }
        value = value[part];
      }
    }
    println(stdout, typeof value === "string" ? value : JSON.stringify(value, null, 2));
    return 0;
  }
};

// kit/bin/commands/init.mjs
init_define_OMNI_BUNDLE();
import { chmodSync as chmodSync3, copyFileSync, existsSync as existsSync21, mkdirSync as mkdirSync5, readFileSync as readFileSync17, writeFileSync as writeFileSync8 } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname as dirname7, join as join24, posix as posix4 } from "node:path";

// kit/lib/init/bundle.mjs
init_define_OMNI_BUNDLE();
import { fileURLToPath as fileURLToPath2 } from "node:url";
var MARKER2 = typeof define_OMNI_BUNDLE_default === "undefined" ? null : define_OMNI_BUNDLE_default;
function runningBundle() {
  return MARKER2 ? fileURLToPath2(import.meta.url) : null;
}
function kitHome({ exec }) {
  if (MARKER2) return MARKER2.home ?? null;
  try {
    const kitDir = fileURLToPath2(new URL("../..", import.meta.url));
    return slugFromRemote(exec("git", ["remote", "get-url", "origin"], { cwd: kitDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return null;
  }
}
function installCommand(home) {
  return `npx ${home ? `github:${home}` : "github:<owner>/<kit repository>"} init`;
}

// kit/lib/init/config-text.mjs
init_define_OMNI_BUNDLE();
var import_yaml3 = __toESM(require_dist(), 1);
var section2 = (key, value) => (0, import_yaml3.stringify)({ [key]: value }).trimEnd();
function renderConfig({ slug, defaultBranch, commands, lawsSource }) {
  const repo = { slug };
  if (defaultBranch) repo.defaultBranch = defaultBranch;
  const text2 = [
    `# Omni Loop config, written by \`omni init\`. A key not written here keeps its schema default.`,
    `kit: ${CONFIG_VERSION}`,
    "",
    "# The repository the loop opens pull requests on.",
    section2("repo", repo),
    "",
    "# Whether a skill may create a missing loop label while it runs (omni init creates them regardless).",
    section2("labels", { autoCreate: false }),
    "",
    "# What the loop runs. null: not known yet; fill it in before the loop needs it.",
    section2("commands", { test: commands.test, preflight: commands.preflight, preflightFull: commands.preflightFull }),
    "",
    "# Where the laws a slice must not break are read from: knowledge, claudeMdInvariants or none.",
    section2("laws", { source: lawsSource }),
    ""
  ].join("\n");
  return { text: text2, config: parseConfig(text2, CONFIG_FILE) };
}

// kit/lib/init/detect.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync19, readFileSync as readFileSync16 } from "node:fs";
import { join as join22 } from "node:path";
var COMMAND_KEYS = Object.freeze(["test", "preflight", "preflightFull"]);
var NONE = Object.freeze({ test: null, preflight: null, preflightFull: null });
function readJson2(file) {
  try {
    return JSON.parse(readFileSync16(file, "utf8"));
  } catch {
    return {};
  }
}
function packageManager(root) {
  if (existsSync19(join22(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync19(join22(root, "yarn.lock"))) return "yarn";
  if (existsSync19(join22(root, "bun.lockb")) || existsSync19(join22(root, "bun.lock"))) return "bun";
  return "npm";
}
function fromPackageJson(root) {
  const scripts = readJson2(join22(root, "package.json")).scripts ?? {};
  const pm = packageManager(root);
  const has = (name) => Object.hasOwn(scripts, name);
  const test = has("test") ? `${pm} test` : null;
  const preflightScript = ["preflight", "quality:preflight"].find(has);
  const preflight = preflightScript ? `${pm} run ${preflightScript}` : test;
  const preflightFull = has("preflight:full") ? `${pm} run preflight:full` : preflight;
  return { test, preflight, preflightFull };
}
function fromComposer(root) {
  const scripts = readJson2(join22(root, "composer.json")).scripts ?? {};
  const test = Object.hasOwn(scripts, "test") ? "composer test" : null;
  const preflight = Object.hasOwn(scripts, "preflight") ? "composer preflight" : test;
  return { test, preflight, preflightFull: preflight };
}
function fromMakefile(root) {
  const text2 = readFileSync16(join22(root, "Makefile"), "utf8");
  const target = (name) => new RegExp(`^${name}\\s*:(?!=)`, "m").test(text2);
  const test = target("test") ? "make test" : null;
  const preflight = target("preflight") ? "make preflight" : test;
  return { test, preflight, preflightFull: preflight };
}
var SOURCES = [
  { file: "package.json", read: fromPackageJson },
  { file: "composer.json", read: fromComposer },
  { file: "Makefile", read: fromMakefile }
];
function detectCommands(root) {
  const source = SOURCES.find(({ file }) => existsSync19(join22(root, file)));
  return source ? source.read(root) : { ...NONE };
}
function detectLawsSource({ ctx }) {
  const { principles, rules, invariants } = readRegisters({ ctx });
  if (principles.length + rules.length + invariants.length > 0) return "knowledge";
  const claudeMd = join22(ctx.root, "CLAUDE.md");
  const heading = ctx.config.laws.claudeMdHeading;
  if (existsSync19(claudeMd) && readFileSync16(claudeMd, "utf8").split("\n").some((line) => line.trim() === heading)) {
    return "claudeMdInvariants";
  }
  return "none";
}

// kit/lib/init/labels.mjs
init_define_OMNI_BUNDLE();
var QUIET3 = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
var LIST_LIMIT = 1e3;
var LABEL_STYLES = {
  prd: { color: "5319e7", description: "A PRD the Omni Loop builds" },
  phase0: { color: "c5def5", description: "Omni Loop: the docs-only phase-0 pull request of a PRD" },
  feature: { color: "0e8a16", description: "Omni Loop: the feature pull request of a PRD" },
  sub: { color: "bfdadc", description: "Omni Loop: a slice pull request into a feature branch" },
  inProgress: { color: "fbca04", description: "Omni Loop: an agent is working on this pull request" },
  needsFix: { color: "d93f0b", description: "Omni Loop: this pull request needs a fix before it can move" },
  outboxGo: { color: "1d76db", description: "Omni Loop: a person lets the outbox gate pass" }
};
function loopLabels(labels) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const [key, style] of Object.entries(LABEL_STYLES)) {
    const name = labels[key];
    if (typeof name !== "string" || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, ...style });
  }
  return out;
}
function reconcileLabels(root, { exec, labels }) {
  const wanted = loopLabels(labels);
  let existing;
  try {
    const listed = JSON.parse(exec("gh", ["label", "list", "--json", "name", "--limit", String(LIST_LIMIT)], { cwd: root, ...QUIET3 }));
    existing = new Set(listed.map((label) => String(label.name).toLowerCase()));
  } catch {
    return { created: [], present: [], byHand: wanted.map((label) => label.name) };
  }
  const result = { created: [], present: [], byHand: [] };
  for (const { name, color, description } of wanted) {
    if (existing.has(name.toLowerCase())) {
      result.present.push(name);
      continue;
    }
    try {
      exec("gh", ["label", "create", name, "--color", color, "--description", description], { cwd: root, ...QUIET3 });
      result.created.push(name);
    } catch {
      result.byHand.push(name);
    }
  }
  return result;
}

// kit/lib/init/steps.mjs
init_define_OMNI_BUNDLE();
import { dirname as dirname5 } from "node:path";
var APP = { name: "omni-loop", slug: "omni-loop-invader" };
var MARKETPLACE = "omni-loop";
var PLUGIN = "omni";
var GITHUB = "https://github.com";
var PLACEHOLDER_SLUG = "<owner>/<repository>";
function closingSteps({ slug, defaultBranch, kitHome: kitHome2, outboxCheck, files, forms, labels, unfilled }) {
  const repo = slug ?? PLACEHOLDER_SLUG;
  const dir = dirname5(files[0].path);
  const lines = [`omni init \u2014 ${slug ?? "this repository"} is set up.`];
  const width = Math.max(...files.map((file) => file.path.length));
  for (const { path, wrote } of files) {
    lines.push(wrote ? `  wrote   ${path}` : `  kept    ${path.padEnd(width)}  (pass --force to overwrite)`);
  }
  for (const path of forms.wrote) lines.push(`  wrote   ${path}`);
  const steps = [
    [
      `Install the ${PLUGIN} plugin in Claude Code:`,
      `     /plugin marketplace add ${kitHome2 ?? "<owner>/<kit repository>"}`,
      `     /plugin install ${PLUGIN}@${MARKETPLACE}`
    ],
    [
      `Install the ${APP.name} GitHub App on ${slug ?? "this repository"}:`,
      `     ${GITHUB}/apps/${APP.slug}/installations/new`
    ]
  ];
  const labelsStep = labels.byHand.length ? steps.length + 1 : null;
  if (labelsStep) {
    steps.push([
      "Create the labels gh could not create:",
      `     ${GITHUB}/${repo}/labels`,
      `     ${labels.byHand.join(", ")}`
    ]);
  }
  steps.push([
    `(Optional) Require the \`${outboxCheck}\` check on ${defaultBranch}:`,
    `     ${GITHUB}/${repo}/settings/branches`,
    "   Warning: a required check that is never posted blocks every pull request in this repository.",
    "   If the app is uninstalled, its deploy is broken or Inngest is down, nothing can merge. The remedy",
    "   is to remove the requirement, never to fake a status."
  ]);
  const formsStep = steps.length + 1;
  steps.push([
    `Fill the forms in ${forms.dir}/ with what the repository can prove, in Claude Code:`,
    `     /${PLUGIN}:terraform`
  ]);
  if (forms.outside) lines.push(`  forms   not written: ${forms.dir}/ is outside ${dir}/ \u2014 see step ${formsStep} below`);
  const done = [];
  if (labels.created.length) done.push(`created ${labels.created.join(", ")}`);
  if (labels.present.length) {
    const present = `already there: ${labels.present.join(", ")}`;
    done.push(labels.created.length ? `   (${present})` : present);
  }
  if (done.length) lines.push(`  labels  ${done.join("")}`);
  if (labelsStep) lines.push(`  labels  gh could not create ${labels.byHand.join(", ")} \u2014 see step ${labelsStep} below`);
  lines.push("", `Commit ${dir}/ and merge it into ${defaultBranch}, then, by hand:`);
  steps.forEach(([first, ...rest], index) => {
    lines.push(`  ${index + 1}. ${first}`, ...rest.map((line) => `  ${line}`));
  });
  if (unfilled.length) {
    lines.push("", `Not filled \u2014 set them in ${files[0].path} or rerun with the flag:`);
    for (const { key, flag } of unfilled) lines.push(`  commands.${key} (--${flag} <cmd>)`);
  }
  lines.push("", `To remove the loop: delete ${dir}/ and commit. The labels and the App installation stay.`);
  return `${lines.join("\n")}
`;
}

// kit/lib/playbook/write-forms.mjs
init_define_OMNI_BUNDLE();
var import_yaml4 = __toESM(require_dist(), 1);
import { existsSync as existsSync20, mkdirSync as mkdirSync4, writeFileSync as writeFileSync7 } from "node:fs";
import { dirname as dirname6, join as join23, posix as posix3 } from "node:path";
var PROVENANCE = /^<!-- Ported from .*-->\n+/gm;
var REGISTER_TITLES = { "principles.md": "Product principles", "rules.md": "Product rules", "invariants.md": "Product invariants" };
function samePath(a, b) {
  const clean = (path) => posix3.normalize(path).replace(/\/+$/, "");
  return clean(a) === clean(b);
}
function pointerTarget(id, ctx) {
  if (id === DECISIONS_FORM && !samePath(ctx.config.paths.adr, `${ctx.layout.frontDoor}/adr`)) return ctx.config.paths.adr;
  if (id === "glossary" && ctx.config.paths.glossary !== null) return ctx.config.paths.glossary;
  return null;
}
function blankForm(id, { ctx }) {
  const kit = parseForm(formTemplate(id), { file: `kit template ${id}` });
  if (!kit.ok) throw new Error(`the kit's template for ${id} does not parse:
${kit.errors.join("\n")}`);
  const { formVersion, title, opener, slots } = kit.form;
  const target = pointerTarget(id, ctx);
  const frontMatter = { form: id, "form-version": formVersion, state: target ? "pointer" : "blank", "points-to": target, evidence: [], terraformed: null };
  const lines = ["---", (0, import_yaml4.stringify)(frontMatter).trimEnd(), "---", "", `# ${title}`, ""];
  if (opener) lines.push(opener, "");
  if (!target) {
    for (const slot of slots) lines.push(`## ${slot.heading}`, `<!-- slot: ${slot.id} \xB7 ${slot.required ? "required" : "optional"} -->`, "");
  }
  return lines.join("\n");
}
function frontDoorPage(ctx) {
  return fillConfig(frontDoorTemplate().replace(PROVENANCE, ""), ctx.config).text;
}
function writeForms({ ctx }) {
  const { frontDoor, knowledgeRoot } = ctx.layout;
  const byFolder = [...FORMS.filter(({ id }) => id !== DECISIONS_FORM), ...FORMS.filter(({ id }) => id === DECISIONS_FORM)];
  const planned = [
    { path: `${frontDoor}/README.md`, text: () => frontDoorPage(ctx) },
    ...byFolder.map(({ id }) => ({ path: ctx.layout.formPath(id), text: () => blankForm(id, { ctx }) }))
  ];
  if (samePath(frontDoor, knowledgeRoot)) {
    for (const name of Object.keys(LAYER_FILES)) {
      planned.push({ path: `${productDir(ctx)}/${name}`, text: () => `# ${REGISTER_TITLES[name]}

None yet.
` });
    }
  }
  return planned.map(({ path, text: text2 }) => {
    const absolute = join23(ctx.root, path);
    if (existsSync20(absolute)) return { path, wrote: false };
    mkdirSync4(dirname6(absolute), { recursive: true });
    writeFileSync7(absolute, text2());
    return { path, wrote: true };
  });
}

// kit/bin/commands/init.mjs
var LOOP_DIR = dirname7(CONFIG_FILE);
var BIN_FILE = join24(LOOP_DIR, "bin", "omni.mjs");
function insideLoop(path) {
  const clean = posix4.normalize(path).replace(/\/+$/, "");
  return clean === LOOP_DIR || clean.startsWith(`${LOOP_DIR}/`);
}
var FLAGS = { test: "test", preflight: "preflight", preflightFull: "preflight-full" };
var QUESTIONS = {
  test: "the command that runs the tests",
  preflight: "the command a slice must pass before its sub-PR is ready",
  preflightFull: "the full preflight, run before a feature PR is ready"
};
async function askTerminal(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}
async function resolveCommands(root, flags, { interactive, ask: ask2 }) {
  const commands = detectCommands(root);
  for (const key of COMMAND_KEYS) {
    if (typeof flags[FLAGS[key]] === "string") commands[key] = flags[FLAGS[key]];
  }
  if (interactive) {
    for (const key of COMMAND_KEYS) {
      if (commands[key] !== null) continue;
      const answer = String(await ask2(`commands.${key}: ${QUESTIONS[key]} (empty for none): `) ?? "").trim();
      commands[key] = answer || null;
    }
  }
  return commands;
}
var init = {
  withoutContext: true,
  async run(args, { cwd, stdout, exec, stdin = process.stdin, bundle = runningBundle(), ask: ask2 = askTerminal }) {
    const { positional, flags } = parseArgs("init", args, { values: Object.values(FLAGS), booleans: ["force"] });
    if (positional.length) throw usageError("usage: omni init [--force] [--test <cmd>] [--preflight <cmd>] [--preflight-full <cmd>]");
    const force = flags.force === true;
    const root = findRoot(cwd, exec);
    const defaults = ConfigSchema.parse({ kit: CONFIG_VERSION });
    const configPath = join24(root, CONFIG_FILE);
    const binPath = join24(root, BIN_FILE);
    const keepConfig = !force && existsSync21(configPath);
    let config2 = keepConfig ? parseConfig(readFileSync17(configPath, "utf8"), CONFIG_FILE) : null;
    const copyBin = force || !existsSync21(binPath);
    if (copyBin && !bundle) {
      throw usageError(
        `omni init: this omni runs from the kit source, which is never installed as ${BIN_FILE}; run \`${installCommand(kitHome({ exec }))}\` instead.`
      );
    }
    if (!keepConfig) {
      const interactive = Boolean(stdin?.isTTY && stdout?.isTTY);
      const commands = await resolveCommands(root, flags, { interactive, ask: ask2 });
      const repo = readRepo(root, { exec, remote: defaults.repo.remote });
      const lawsSource = detectLawsSource({ ctx: createContext(root, defaults) });
      const rendered = renderConfig({ ...repo, commands, lawsSource });
      config2 = rendered.config;
      const { text: text2 } = rendered;
      mkdirSync5(dirname7(configPath), { recursive: true });
      writeFileSync8(configPath, text2);
    }
    if (copyBin) {
      mkdirSync5(dirname7(binPath), { recursive: true });
      copyFileSync(bundle, binPath);
      chmodSync3(binPath, 493);
    }
    const ctx = createContext(root, config2);
    const outside = !insideLoop(ctx.layout.frontDoor);
    const forms = outside ? [] : writeForms({ ctx });
    const labels = reconcileLabels(root, { exec, labels: config2.labels });
    const slug = config2.repo.slug ?? readRepo(root, { exec, remote: config2.repo.remote }).slug;
    stdout.write(closingSteps({
      slug,
      defaultBranch: config2.repo.defaultBranch,
      kitHome: kitHome({ exec }),
      outboxCheck: config2.ci.outboxContext,
      files: [{ path: CONFIG_FILE, wrote: !keepConfig }, { path: BIN_FILE, wrote: copyBin }],
      forms: { dir: ctx.layout.frontDoor, wrote: forms.filter((file) => file.wrote).map((file) => file.path), outside },
      labels,
      unfilled: COMMAND_KEYS.filter((key) => config2.commands[key] === null).map((key) => ({ key, flag: FLAGS[key] }))
    }));
    return 0;
  }
};

// kit/bin/commands/item.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync22, mkdirSync as mkdirSync6, readFileSync as readFileSync18, writeFileSync as writeFileSync9 } from "node:fs";
import { basename as basename5, join as join25 } from "node:path";

// kit/lib/policy/outbox-policy.mjs
init_define_OMNI_BUNDLE();
var STATUS_FOR_OUTCOME = { record: "done", stop: "stopped", blocked: "blocked" };
var AUTHOR_MARK = "(author)";
var ADR_ID2 = /^ADR-\d{4}$/;
function proposeRank({ bearsOn = "none", hardToRevert = false, laws } = {}) {
  const proposed = ADR_ID2.test(bearsOn) || hardToRevert ? "high" : "medium";
  return floorRank(bearsOn, proposed, laws);
}
function decideRecording({
  bearsOn = "none",
  breaksNamedLaw = false,
  needsHumanAction = false,
  hardToRevert = false,
  principlesConflict = [],
  laws
} = {}) {
  const principles = conflictingPrinciples(principlesConflict, laws);
  if (needsHumanAction) {
    return recordingDecision({
      outcome: "blocked",
      rank: "human-action",
      writesItem: true,
      rule: null,
      reason: "only a person can do this \u2014 the item is written as `human-action` and the slice returns blocked"
    });
  }
  if (breaksNamedLaw && laws.floorsHigh(bearsOn)) {
    return recordingDecision({
      outcome: "stop",
      rank: null,
      writesItem: false,
      rule: bearsOn,
      reason: `the slice cannot proceed without breaking ${bearsOn}, a law it can name; it stops and says which`
    });
  }
  if (principles.length > 0) {
    return recordingDecision({
      outcome: "stop",
      rank: "high",
      writesItem: true,
      rule: null,
      principles,
      reason: `the decision is pulled apart by ${principles.join(", ")} \u2014 choosing between principles is a person's call, so the slice stops and writes a high item naming every one`
    });
  }
  const rank = proposeRank({ bearsOn, hardToRevert: hardToRevert || breaksNamedLaw, laws });
  return recordingDecision({
    outcome: "record",
    rank,
    writesItem: true,
    settleAsAdopted: rank === "medium",
    rule: null,
    reason: breaksNamedLaw ? "no invariant and no business rule it can name speaks to this, so it is a risk rather than a breach \u2014 recorded high, and the slice carries on" : rank === "medium" ? "nothing in the registers speaks to this and it could go the other way for a constant \u2014 adopted straight to the ledger, never written as an open item, and the slice carries on" : "nothing in the registers speaks to this \u2014 the most reversible option is taken, the item is written, and the slice carries on"
  });
}
function conflictingPrinciples(ids, laws) {
  const named = [...new Set((ids ?? []).map((id) => String(id).trim()).filter(Boolean))];
  if (named.length === 0 || laws.source !== "knowledge") return [];
  const notPrinciples = named.filter((id) => idParts(id)?.type !== "P");
  if (notPrinciples.length > 0) {
    throw new Error(
      `only principles can be in conflict \u2014 ${notPrinciples.join(", ")} is not a principle id (P-<CODE>-<n>); a rule or an invariant it would break is breaksNamedLaw`
    );
  }
  if (named.length < 2) {
    throw new Error(
      `a conflict needs two principles pulling against each other \u2014 only ${named[0]} was named`
    );
  }
  return named;
}
function recordingDecision({
  outcome,
  rank,
  writesItem,
  settleAsAdopted = false,
  rule,
  principles = [],
  reason
}) {
  return {
    outcome,
    sliceStatus: STATUS_FOR_OUTCOME[outcome],
    rank,
    writesItem,
    settleAsAdopted,
    rule,
    principles,
    stopsTheWave: false,
    reason
  };
}
var CONSULTATION_POLICIES = Object.freeze({
  [COMMANDS.deliver]: Object.freeze({
    command: COMMANDS.deliver,
    asksAbout: Object.freeze(["high", "human-action"]),
    why: "the human is at the keyboard; a risky call answered now is a settled item rather than a gate to clear later"
  }),
  [COMMANDS.yolo]: Object.freeze({
    command: COMMANDS.yolo,
    asksAbout: Object.freeze([]),
    why: "go ahead, I will review later \u2014 every decision waits in the outbox when the run ends"
  })
});
function unknowable(gaps) {
  const stated = (gaps ?? []).map((gap) => gap.trim()).filter((gap) => gap.length > 0);
  if (stated.length === 0) {
    throw new Error(
      "an item states what could not be known, and the agent may never invent a rationale in its place \u2014 name at least one thing the PRD, the registers and the glossary do not settle"
    );
  }
  return [
    `${AUTHOR_MARK} The PRD, the registers and the glossary do not settle this:`,
    "",
    ...stated.map((gap) => `- ${gap}`)
  ].join("\n");
}
function renderOutboxItem({
  id,
  prd: prd2,
  slice,
  wave,
  raised,
  bearsOn,
  rank,
  questionPlain,
  decisionPlain,
  introFun = null,
  punchlineFun = null,
  decide,
  meanwhile,
  cost,
  gaps,
  options = null,
  personSteps = null,
  laws
}) {
  const couldNotKnow = unknowable(gaps);
  const settledRank = floorRank(bearsOn, rank, laws);
  if (!RANK_VALUES.includes(settledRank)) {
    throw new Error(`rank must be one of: ${RANK_VALUES.join(", ")} \u2014 got "${rank}"`);
  }
  if (!(questionPlain ?? "").trim()) {
    throw new Error(
      'an item states its question in plain words too \u2014 "## The question, in plain words" \u2014 before it says what was decided'
    );
  }
  if (!(decisionPlain ?? "").trim()) {
    throw new Error(
      'an item states its decision in plain words too \u2014 "## The decision, in plain words" \u2014 before the four sections a developer reads'
    );
  }
  const funBlock = renderFun(introFun, punchlineFun);
  const optionsBlock = settledRank === "human-action" ? renderPersonSteps(personSteps) : renderOptions(options);
  return [
    "---",
    `id: ${id}`,
    `prd: ${prd2}`,
    `slice: ${slice}`,
    `rank: ${settledRank}`,
    `bears-on: ${bearsOn}`,
    `raised: ${raised}`,
    `wave: ${wave}`,
    "---",
    "",
    "## The question, in plain words",
    "",
    questionPlain,
    "",
    "## The decision, in plain words",
    "",
    decisionPlain,
    "",
    ...funBlock,
    ...optionsBlock,
    "",
    "## What I had to decide",
    "",
    decide,
    "",
    "## What I did meanwhile",
    "",
    meanwhile,
    "",
    "## What it costs to change later",
    "",
    cost,
    "",
    "## What I could not know",
    "",
    couldNotKnow,
    ""
  ].join("\n");
}
function renderFun(introFun, punchlineFun) {
  const intro = (introFun ?? "").trim();
  const punchline = (punchlineFun ?? "").trim();
  if (!intro && !punchline) return [];
  if (!intro || !punchline) {
    throw new Error(
      `an item carries its intro and its punchline together, or neither \u2014 "## ${FUN_SECTIONS[0]}" and "## ${FUN_SECTIONS[1]}"`
    );
  }
  return [`## ${FUN_SECTIONS[0]}`, "", intro, "", `## ${FUN_SECTIONS[1]}`, "", punchline, ""];
}
function renderOptions(options) {
  const list2 = (Array.isArray(options) ? options : []).map((text2) => (text2 ?? "").trim()).filter((text2) => text2.length > 0);
  if (list2.length < 2 || list2.length > 4) {
    throw new Error(
      `an item states two to four options too \u2014 "## The options, in plain words", "A" the one built \u2014 got ${list2.length}`
    );
  }
  return [
    "## The options, in plain words",
    "",
    ...list2.map((text2, index) => `${OPTION_LETTERS[index]}. ${text2}`)
  ];
}
function renderPersonSteps(personSteps) {
  const text2 = (personSteps ?? "").trim();
  if (!text2) {
    throw new Error(
      'a human-action item states what a person must do too \u2014 "## What a person must do" \u2014 since it carries no options'
    );
  }
  return ["## What a person must do", "", text2];
}
var SLICE_TIME_GUARD = Object.freeze({
  script: ".omni-loop/bin/omni.mjs check coverage",
  runsBefore: "the sub-pull-request is opened",
  range: "the slice branch against the feature branch it was cut from",
  /**
   * A bare run grades account *format* across every PRD directory and compares no range at all —
   * the slice knows both its base and its PRD, so it names them.
   */
  needsExplicitArguments: true,
  stopsTheSlice: false,
  exitCodeIsAdvisory: true,
  caughtBy: "the branch-level run \u2014 the outbox gate (`outbox/status.mjs`'s `gateResult`)",
  why: "only the slice knows why it made the change; only the branch-level run is independent of the slice"
});
var ACCOUNT_FORMS = Object.freeze({
  item: Object.freeze({
    kind: "item",
    field: "id",
    line: (value) => `item ${value}`,
    why: "an outbox item carries the decision; the id must resolve to a real file under the PRD's own outbox directory"
  }),
  spec: Object.freeze({
    kind: "spec",
    field: "where",
    line: (value) => `spec ${value}`,
    why: "the spec already asked for this change, and the account points at the place that says so"
  })
});

// kit/bin/commands/item.mjs
var USAGE5 = "usage: omni item new --prd <n> --slice <id> --file <file> [--adopt] [--json]";
var SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function funLine2(field) {
  return external_exports.string().trim().min(1, `${field} must not be empty`).superRefine((value, refinement) => {
    for (const problem of funLineProblems(value)) {
      refinement.addIssue({ code: external_exports.ZodIssueCode.custom, message: `${field} ${problem}` });
    }
  }).optional();
}
function funPair(input, refinement) {
  const [given, missing] = input.introFun === void 0 ? ["punchlineFun", "introFun"] : ["introFun", "punchlineFun"];
  if (input.introFun === void 0 === (input.punchlineFun === void 0)) return;
  refinement.addIssue({
    code: external_exports.ZodIssueCode.custom,
    path: [missing],
    message: `${missing} is required when ${given} is given \u2014 the intro and the punchline come together, or neither does`
  });
}
var ItemInputSchema = external_exports.object({
  slug: external_exports.string().trim().regex(SLUG_SHAPE, "slug must be kebab-case (lowercase letters, digits and single hyphens)"),
  wave: external_exports.coerce.number({ message: "wave must be a number" }).int().positive(),
  raised: external_exports.string().regex(/^\d{4}-\d{2}-\d{2}$/, "raised must be a YYYY-MM-DD date").optional(),
  bearsOn: external_exports.string().trim().min(1, "bearsOn must not be empty").optional(),
  breaksNamedLaw: external_exports.boolean().optional(),
  needsHumanAction: external_exports.boolean().optional(),
  hardToRevert: external_exports.boolean().optional(),
  principlesConflict: external_exports.array(external_exports.string().trim().min(1)).optional(),
  questionPlain: external_exports.string().trim().min(1, "questionPlain is required"),
  decisionPlain: external_exports.string().trim().min(1, "decisionPlain is required"),
  introFun: funLine2("introFun"),
  punchlineFun: funLine2("punchlineFun"),
  decide: external_exports.string().trim().min(1, "decide is required"),
  meanwhile: external_exports.string().trim().min(1, "meanwhile is required"),
  cost: external_exports.string().trim().min(1, "cost is required"),
  gaps: external_exports.array(external_exports.string().trim().min(1)).min(1, "gaps needs at least one entry"),
  options: external_exports.array(external_exports.string().trim().min(1)).min(2, "options needs two to four entries").max(4, "options needs two to four entries").optional(),
  personSteps: external_exports.string().trim().min(1, "personSteps must not be empty").optional()
}).strict().superRefine(funPair);
var NONZERO_OUTCOME_LABEL = { stop: "must stop", blocked: "is blocked" };
function todayUtc() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function readItemInput(ctx, path) {
  const text2 = readUserFile("item new", ctx, path);
  let parsed;
  try {
    parsed = JSON.parse(text2);
  } catch (error) {
    throw usageError(`omni item new: ${path} is not valid JSON (${error.message}).`);
  }
  const result = ItemInputSchema.safeParse(parsed);
  if (!result.success) {
    const [issue] = result.error.issues;
    const field = issue.path.length > 0 ? issue.path.join(".") : "(json)";
    throw usageError(`omni item new: ${path}: "${field}" \u2014 ${issue.message}.`);
  }
  return result.data;
}
function spentIds(prd2, { ctx }) {
  const outboxDir = ctx.layout.outboxDir(prd2);
  const prefix = `${outboxDir}/`;
  const ids = new Set(
    outboxItemFiles({ ctx }).filter((path) => path.startsWith(prefix)).map((path) => basename5(path, ".md"))
  );
  const settledFile = join25(ctx.root, outboxDir, SETTLED_FILE);
  if (existsSync22(settledFile)) {
    for (const entry of parseSettledEntries(readFileSync18(settledFile, "utf8"), ctx.markers)) {
      ids.add(entry.id);
    }
  }
  return ids;
}
function spentNumbers(prd2, slice, { ctx }) {
  const prefix = `${slice}-`;
  const shape = /^-(\d{2})-/;
  const numbers = /* @__PURE__ */ new Set();
  for (const id of spentIds(prd2, { ctx })) {
    if (!id.startsWith(prefix)) continue;
    const match = id.slice(prefix.length - 1).match(shape);
    if (match) numbers.add(match[1]);
  }
  return numbers;
}
function nextItemId(prd2, slice, slug, { ctx }) {
  const spent = spentNumbers(prd2, slice, { ctx });
  for (let n = 1; n <= 99; n += 1) {
    const nn = String(n).padStart(2, "0");
    if (!spent.has(nn)) return `${slice}-${nn}-${slug}`;
  }
  throw usageError(`omni item new: ${slice} under PRD ${prd2} has already spent every number 01-99.`);
}
function jsonOutcome({ outcome, rank = null, id = null, file = null, adopted = false, reason = null }) {
  return JSON.stringify({ outcome, rank, id, file, adopted, reason });
}
async function runNew(args, { ctx, stdout, stderr }) {
  const { positional, flags } = parseArgs("item new", args, {
    values: ["prd", "slice", "file"],
    booleans: ["adopt", "json"]
  });
  if (positional.length !== 0 || flags.prd === void 0 || flags.slice === void 0 || flags.file === void 0) {
    throw usageError(USAGE5);
  }
  const prd2 = positiveInt("item new", "--prd", flags.prd);
  const slice = flags.slice;
  const asJson = Boolean(flags.json);
  const outboxDir = ctx.layout.outboxDir(prd2);
  if (outboxDir === null) throw usageError(`omni item new: PRD ${prd2} has no inbox or shipped folder.`);
  const input = readItemInput(ctx, flags.file);
  const laws = lawsFor(ctx);
  const bearsOn = input.bearsOn ?? "none";
  let decision;
  try {
    decision = decideRecording({
      bearsOn,
      breaksNamedLaw: input.breaksNamedLaw ?? false,
      needsHumanAction: input.needsHumanAction ?? false,
      hardToRevert: input.hardToRevert ?? false,
      principlesConflict: input.principlesConflict ?? [],
      laws
    });
  } catch (error) {
    throw usageError(`omni item new: ${error.message}`);
  }
  if (!decision.writesItem) {
    if (asJson) {
      println(stdout, jsonOutcome({ outcome: decision.outcome, reason: decision.reason }));
    } else {
      println(stderr, `omni item new \u2014 nothing was written (${decision.outcome}): ${decision.reason}`);
    }
    return 1;
  }
  if (decision.rank === "human-action" && !input.personSteps) {
    throw usageError('omni item new: "personSteps" is required \u2014 the decision settled at rank "human-action", which carries no options.');
  }
  if (decision.rank !== "human-action" && !input.options) {
    throw usageError('omni item new: "options" is required unless the decision settles at rank "human-action".');
  }
  const id = nextItemId(prd2, slice, input.slug, { ctx });
  let text2;
  try {
    text2 = renderOutboxItem({
      id,
      prd: prd2,
      slice,
      wave: input.wave,
      raised: input.raised ?? todayUtc(),
      bearsOn,
      rank: decision.rank,
      questionPlain: input.questionPlain,
      decisionPlain: input.decisionPlain,
      introFun: input.introFun,
      punchlineFun: input.punchlineFun,
      decide: input.decide,
      meanwhile: input.meanwhile,
      cost: input.cost,
      gaps: input.gaps,
      options: decision.rank === "human-action" ? null : input.options,
      personSteps: decision.rank === "human-action" ? input.personSteps : null,
      laws
    });
  } catch (error) {
    throw usageError(`omni item new: ${error.message}`);
  }
  const renderedFile = `${outboxDir}/${id}.md`;
  const violations = checkItemText(renderedFile, text2, { ctx, laws });
  if (violations.length > 0) {
    if (asJson) {
      println(stdout, jsonOutcome({ outcome: null, reason: violations.join("; ") }));
    } else {
      println(stderr, 'omni item new: the rendered item fails "check outbox" \u2014 nothing was written:');
      for (const violation2 of violations) println(stderr, `  - ${violation2}`);
    }
    return 2;
  }
  if (decision.outcome !== "record") {
    const file2 = writeItemFile(ctx, outboxDir, id, text2);
    if (asJson) {
      println(stdout, jsonOutcome({ outcome: decision.outcome, rank: decision.rank, id, file: file2, reason: decision.reason }));
    } else {
      println(stdout, file2);
      println(stderr, `omni item new \u2014 the slice ${NONZERO_OUTCOME_LABEL[decision.outcome]}: ${decision.reason}`);
    }
    return 1;
  }
  if (decision.rank === "medium" && flags.adopt) {
    const result = adoptItem({ ctx, itemText: text2 });
    if (!result.ok) {
      if (asJson) {
        println(stdout, jsonOutcome({ outcome: null, reason: result.errors.join("; ") }));
      } else {
        println(stderr, "omni item new \u2014 nothing was written:");
        for (const error of result.errors) println(stderr, `  - ${error}`);
      }
      return 1;
    }
    if (asJson) {
      println(stdout, jsonOutcome({ outcome: decision.outcome, rank: decision.rank, id, adopted: true }));
    } else {
      println(
        stdout,
        `omni item new \u2014 ${id} adopted straight to ${result.settledFile}; no open item file was written.`
      );
    }
    return 0;
  }
  const file = writeItemFile(ctx, outboxDir, id, text2);
  if (asJson) {
    println(stdout, jsonOutcome({ outcome: decision.outcome, rank: decision.rank, id, file }));
  } else {
    println(stdout, file);
  }
  return 0;
}
function writeItemFile(ctx, outboxDir, id, text2) {
  const file = `${outboxDir}/${id}.md`;
  mkdirSync6(join25(ctx.root, outboxDir), { recursive: true });
  writeFileSync9(join25(ctx.root, file), text2);
  return file;
}
var item = {
  async run(args, io) {
    const [sub, ...rest] = args;
    if (sub !== "new") throw usageError(USAGE5);
    return runNew(rest, io);
  }
};

// kit/bin/commands/kb.mjs
init_define_OMNI_BUNDLE();

// kit/lib/playbook/decisions.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync23, readdirSync as readdirSync9, readFileSync as readFileSync19 } from "node:fs";
import { join as join26 } from "node:path";
var RECORD = /^(\d{4})-.+\.md$/;
var TITLE2 = /^#\s+(.+?)\s*$/m;
function readDecisions({ ctx }) {
  const dir = ctx.layout.adrDir.replace(/\/+$/, "");
  const absolute = join26(ctx.root, dir);
  const names = existsSync23(absolute) ? readdirSync9(absolute, { withFileTypes: true }).filter((entry) => entry.isFile() && RECORD.test(entry.name)).map((entry) => entry.name).sort() : [];
  const records = names.map((name) => {
    const file = `${dir}/${name}`;
    const title = readFileSync19(join26(ctx.root, file), "utf8").match(TITLE2)?.[1] ?? null;
    return { number: name.match(RECORD)[1], file, title };
  });
  const byNumber = /* @__PURE__ */ new Map();
  for (const record of records) byNumber.set(record.number, [...byNumber.get(record.number) ?? [], record.file]);
  const shared = [...byNumber].filter(([, files]) => files.length > 1).map(([number, files]) => ({ number, files }));
  const highest = records.reduce((max, record) => Math.max(max, Number(record.number)), 0);
  return { dir, records, shared, next: String(highest + 1).padStart(4, "0") };
}

// kit/bin/commands/kb.mjs
var USAGE6 = "usage: omni kb init | omni kb show <form> [--json] | omni kb status [--json]";
function init2(positional, flags, { ctx, stdout }) {
  if (positional.length > 0 || flags.json) throw usageError("usage: omni kb init");
  const files = writeForms({ ctx });
  const wrote = files.filter((file) => file.wrote);
  for (const { path } of wrote) println(stdout, `wrote ${path}`);
  println(stdout, `kb init \u2014 wrote ${wrote.length} file(s); ${files.length - wrote.length} already there, left as they were.`);
  return 0;
}
function recordLines({ dir, records, shared, next }) {
  const lines = [`## Records  [read live from ${dir}]`];
  if (records.length === 0) lines.push("No decision records yet.");
  lines.push(...records.map(({ number, file, title }) => `${number}  ${title ?? file}`));
  lines.push(...shared.map(({ number, files }) => `! ${number} is used by ${files.length} records: ${files.join(", ")}`));
  lines.push(`Next free number: ${next}`);
  return lines;
}
function showText(resolved, records) {
  const lines = [`# ${resolved.title}`, `${resolved.file} \xB7 ${resolved.state}`];
  for (const section3 of resolved.sections) {
    lines.push("", section3.slot === null ? section3.label : `## ${section3.heading}  ${section3.label}`);
    if (section3.text) lines.push(section3.text);
    if (section3.source === "hole") lines.push(...section3.questions.map((question) => `TODO(human): ${question}`));
  }
  if (records) lines.push("", ...recordLines(records));
  return lines.join("\n");
}
function show(positional, flags, { ctx, stdout, stderr }) {
  const [id] = positional;
  if (positional.length !== 1 || !FORM_IDS.includes(id)) {
    throw usageError(`usage: omni kb show <form> [--json] \u2014 the forms: ${FORM_IDS.join(", ")}`);
  }
  const resolved = resolveForm(id, { ctx, template: formTemplate(id) });
  const records = id === DECISIONS_FORM ? readDecisions({ ctx }) : null;
  for (const problem of resolved.problems) println(stderr, `warning: ${problem}`);
  println(stdout, flags.json ? JSON.stringify(records ? { ...resolved, records } : resolved, null, 2) : showText(resolved, records));
  return 0;
}
var SOURCE_LABEL = { repo: "repo", pointer: "pointer", kit: "kit default" };
function statusText({ frontDoor, forms }) {
  const width = Math.max(...forms.map(({ form: form2 }) => form2.length));
  const lines = [`kb status \u2014 ${forms.length} form(s) in ${frontDoor}`];
  for (const { form: form2, kind, state, source, questions: questions2, stale: stale2 } of forms) {
    const counts = [];
    if (questions2.length > 0) counts.push(`${questions2.length} open question(s)`);
    if (stale2.length > 0) counts.push(`${stale2.length} stale evidence`);
    const columns = [form2.padEnd(width), kind.padEnd(8), state.padEnd(7), SOURCE_LABEL[source].padEnd(11), counts.join(" \xB7 ")];
    lines.push(`  ${columns.join("  ").trimEnd()}`);
  }
  const questions = forms.flatMap(({ form: form2, file, questions: open }) => open.map(({ slot, question }) => `  ${form2}#${slot} (${file}): ${question}`));
  const stale = forms.flatMap(
    ({ form: form2, file, stale: entries }) => entries.map(({ path, hash, now }) => `  ${form2} (${file}): ${path}@${hash} \u2014 ${now === null ? "gone" : `now ${now.slice(0, 7)}`}`)
  );
  lines.push(questions.length > 0 ? `Open questions: ${questions.length}` : "Open questions: none.", ...questions);
  lines.push(stale.length > 0 ? `Stale evidence: ${stale.length}` : "Stale evidence: none.", ...stale);
  return lines.join("\n");
}
function status(positional, flags, { ctx, stdout, exec }) {
  if (positional.length > 0) throw usageError("usage: omni kb status [--json]");
  const map = playbookStatus({ ctx, exec });
  println(stdout, flags.json ? JSON.stringify(map, null, 2) : statusText(map));
  return 0;
}
var kb = {
  async run(args, io) {
    const { positional, flags } = parseArgs("kb", args, { booleans: ["json"] });
    const [sub, ...rest] = positional;
    if (sub === "init") return init2(rest, flags, io);
    if (sub === "show") return show(rest, flags, io);
    if (sub === "status") return status(rest, flags, io);
    throw usageError(USAGE6);
  }
};

// kit/bin/commands/knowledge.mjs
init_define_OMNI_BUNDLE();

// kit/lib/knowledge/describe.mjs
init_define_OMNI_BUNDLE();
var LINES = [
  ["why", "Why"],
  ["decided", "Decided"],
  ["kindLine", "Kind"],
  ["serves", "Serves"],
  ["source", "Source"],
  ["enforcedBy", "Enforced by"],
  ["stated", "Stated"],
  ["keptId", "Kept id"]
];
function oneLine(entry) {
  return `  ${entry.id} (${entry.kind ?? "unknown kind"}, ${entry.file}) \u2014 ${entry.statement}`;
}
function describeEntry(knowledge2, id) {
  const entry = knowledge2.entries.find((candidate) => candidate.id === id);
  if (!entry) return null;
  const out = [
    `${entry.id} \u2014 a ${entry.kind ?? "entry"} in ${entry.file}`,
    "",
    entry.statement,
    ""
  ];
  for (const [key, label] of LINES) {
    if (entry[key]) out.push(`${label}: ${entry[key]}`);
  }
  if (entry.serves) {
    const served = knowledge2.entries.find((candidate) => candidate.id === entry.serves);
    out.push("", "It serves:", served ? oneLine(served) : `  ${entry.serves} (claimed by nothing)`);
  }
  const serving = servedBy(knowledge2.entries, entry.id);
  if (entry.kind === "principle" || serving.length > 0) {
    out.push("", "Served by:");
    out.push(
      ...serving.length > 0 ? serving.map(oneLine) : ["  nothing yet \u2014 this principle is a wish"]
    );
  }
  return out.join("\n");
}

// kit/bin/commands/knowledge.mjs
var knowledge = {
  async run(args, { ctx, stdout, stderr }) {
    const { positional } = parseArgs("knowledge", args);
    if (positional.length !== 1) throw usageError("usage: omni knowledge <id>   e.g. omni knowledge P-PRODUCT-1");
    const [id] = positional;
    const text2 = describeEntry(readKnowledge({ ctx }), id);
    if (text2 === null) {
      println(stderr, `omni knowledge: nothing in ${ctx.layout.knowledgeRoot}/ claims ${id}.`);
      return 1;
    }
    println(stdout, text2);
    return 0;
  }
};

// kit/bin/commands/phase0.mjs
init_define_OMNI_BUNDLE();

// kit/lib/policy/phase-0.mjs
init_define_OMNI_BUNDLE();
var PHASE_0_REQUIRED_KINDS = (
  /** @type {const} */
  ["spec", "plan", "before-after"]
);
function normalize(path) {
  return String(path ?? "").trim().replace(/^\.\//, "").replace(/^\/+/, "");
}
function phase0Paths(prd2, { ctx }) {
  const { acceptance } = ctx.config;
  return {
    spec: ctx.layout.specPath(prd2),
    plan: ctx.layout.planPath(prd2),
    beforeAfter: ctx.layout.beforeAfterPath(prd2),
    acceptanceDir: acceptance.enabled ? acceptance.dir : null
  };
}
function acceptanceSuffix(ctx) {
  return ctx.config.acceptance.pendingSuffix ?? ".feature";
}
function isPendingAcceptance(file, ctx) {
  const { acceptance } = ctx.config;
  if (!acceptance.enabled || !acceptance.dir) return false;
  return file.startsWith(`${acceptance.dir}/`) && file.endsWith(acceptanceSuffix(ctx));
}
function isDocsPath(file, ctx) {
  const { paths } = ctx.config;
  const prefixes = [paths.delivery, ctx.layout.knowledgeRoot, ctx.layout.adrDir].filter(Boolean);
  if (prefixes.some((prefix) => file === prefix || file.startsWith(`${prefix}/`))) return true;
  if (paths.glossary && file === paths.glossary) return true;
  if ((paths.context ?? []).includes(file)) return true;
  return false;
}
function classifyPhase0Path(path, { ctx, prd: prd2 }) {
  const file = normalize(path);
  const paths = phase0Paths(prd2, { ctx });
  if (file === paths.spec) return "spec";
  if (file === paths.plan) return "plan";
  if (file === paths.beforeAfter) return "before-after";
  if (isPendingAcceptance(file, ctx)) return "pending-acceptance";
  if (isDocsPath(file, ctx)) return "docs";
  return "source";
}
function phase0Verdict(paths, { ctx, prd: prd2, needsBeforeAfter = true } = {}) {
  const files = (paths ?? []).map(normalize).filter(Boolean);
  const kinds = files.map((file) => classifyPhase0Path(file, { ctx, prd: prd2 }));
  const carries = {
    spec: files.filter((_, index) => kinds[index] === "spec"),
    plan: files.filter((_, index) => kinds[index] === "plan"),
    "before-after": files.filter((_, index) => kinds[index] === "before-after"),
    "pending-acceptance": files.filter((_, index) => kinds[index] === "pending-acceptance"),
    docs: files.filter((_, index) => kinds[index] === "docs"),
    source: files.filter((_, index) => kinds[index] === "source")
  };
  const offending = carries.source;
  const required = PHASE_0_REQUIRED_KINDS.filter(
    (kind) => kind !== "before-after" || needsBeforeAfter
  );
  const missing = required.filter((kind) => carries[kind].length === 0);
  const docsOnly = offending.length === 0;
  const ok = docsOnly && missing.length === 0;
  return {
    ok,
    docsOnly,
    label: ctx.config.labels.phase0,
    base: ctx.config.repo.defaultBranch,
    carries,
    sourceFiles: offending,
    missing,
    reason: phase0Reason({ ok, docsOnly, offending, missing })
  };
}
function phase0Reason({ ok, docsOnly, offending, missing }) {
  if (ok) {
    return "docs-only, and it carries the spec, the plan and the before/after a reviewer is being asked to approve";
  }
  const faults = [];
  if (!docsOnly) {
    faults.push(
      `a phase-0 pull request carries no source file \u2014 ${offending.join(", ")} ${offending.length === 1 ? "is" : "are"} not a document`
    );
  }
  if (missing.length > 0) {
    faults.push(`nothing in it is the ${missing.join(", the ")}`);
  }
  return faults.join("; ");
}

// kit/bin/commands/phase0.mjs
var USAGE7 = "usage: omni phase0 <prd> [--base <ref>]";
function defaultBase2(ctx) {
  return `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;
}
function git2(args, cwd, exec) {
  return exec("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function refExists2(ctx, ref, exec) {
  try {
    git2(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], ctx.root, exec);
    return true;
  } catch {
    return false;
  }
}
function changedPaths(ctx, base, exec) {
  return git2(["diff", "--name-only", "--no-renames", `${base}...HEAD`], ctx.root, exec).split("\n").map((line) => line.trim()).filter(Boolean);
}
function carriesLine(label, files) {
  return `  ${label}: ${files.length > 0 ? files.map((file) => `\`${file}\``).join(", ") : "(none)"}`;
}
function printVerdict(stdout, prd2, base, verdict) {
  println(stdout, `omni phase0 \u2014 PRD ${prd2}, range ${base}...HEAD:`);
  println(stdout, `${verdict.ok ? "ok" : "not ok"} \u2014 ${verdict.reason}`);
  println(stdout, `docs-only: ${verdict.docsOnly ? "yes" : "no"}`);
  println(stdout, "carries:");
  println(stdout, carriesLine("spec", verdict.carries.spec));
  println(stdout, carriesLine("plan", verdict.carries.plan));
  println(stdout, carriesLine("before-after", verdict.carries["before-after"]));
  println(stdout, carriesLine("pending-acceptance", verdict.carries["pending-acceptance"]));
  println(stdout, carriesLine("docs", verdict.carries.docs));
  if (verdict.missing.length > 0) {
    println(stdout, `missing: ${verdict.missing.join(", ")}`);
  }
  if (verdict.sourceFiles.length > 0) {
    println(stdout, `source file(s) \u2014 not allowed in a phase-0 pull request:`);
    for (const file of verdict.sourceFiles) println(stdout, `  - ${file}`);
  }
}
var phase0 = {
  async run(args, { ctx, stdout, exec }) {
    const { positional, flags } = parseArgs("phase0", args, { values: ["base"] });
    if (positional.length !== 1) throw usageError(USAGE7);
    const prd2 = positiveInt("phase0", "<prd>", positional[0]);
    const base = flags.base ?? defaultBase2(ctx);
    if (!refExists2(ctx, base, exec)) {
      const how = flags.base !== void 0 ? "pass another --base <ref>" : "fetch it, or pass --base <ref>";
      throw usageError(`omni phase0: no ${base} \u2014 ${how}.`);
    }
    const paths = changedPaths(ctx, base, exec);
    const verdict = phase0Verdict(paths, { ctx, prd: prd2 });
    printVerdict(stdout, prd2, base, verdict);
    return verdict.ok ? 0 : 1;
  }
};

// kit/bin/commands/plan.mjs
init_define_OMNI_BUNDLE();
import { readFileSync as readFileSync20 } from "node:fs";
import { join as join27 } from "node:path";
var USAGE8 = "usage: omni plan check <prd>";
function duplicateIds(slices) {
  const counts = /* @__PURE__ */ new Map();
  for (const slice of slices) counts.set(slice.id, (counts.get(slice.id) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}
function blockedByViolations2(slices) {
  const waveOf = new Map(slices.map((slice) => [slice.id, slice.wave]));
  const violations = [];
  for (const slice of slices) {
    for (const blocker of slice.blockedBy ?? []) {
      if (!waveOf.has(blocker)) {
        violations.push(`${slice.id} is blocked by "${blocker}", which names no slice in this plan.`);
        continue;
      }
      const blockerWave = waveOf.get(blocker);
      if (blockerWave >= slice.wave) {
        violations.push(
          `${slice.id} (wave ${slice.wave}) is blocked by ${blocker} (wave ${blockerWave}) \u2014 a blocker must sit in an earlier wave.`
        );
      }
    }
  }
  return violations;
}
function checkPlan(prd2, { ctx }) {
  const planPath = ctx.layout.planPath(prd2);
  if (planPath === null) throw usageError(`omni plan check: PRD ${prd2} has no inbox or shipped folder.`);
  let markdown;
  try {
    markdown = readFileSync20(join27(ctx.root, planPath), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") throw usageError(`omni plan check: no plan at ${planPath}.`);
    throw error;
  }
  let slices;
  try {
    slices = parsePlanSlices(markdown);
  } catch (error) {
    throw usageError(`omni plan check: ${planPath}: ${error.message}`);
  }
  const violations = [
    ...duplicateIds(slices).map((id) => `id "${id}" is used by more than one slice row.`),
    ...blockedByViolations2(slices),
    ...sameWaveCollisions(slices).map(
      (collision) => `${collision.left} and ${collision.right} share ${collision.shared.join(", ")} and both sit in wave ${collision.wave} \u2014 two slices in one wave may never share territory.`
    )
  ];
  const waves = [...new Set(slices.map((slice) => slice.wave))].sort((a, b) => a - b);
  return { planPath, slices, waves, rows: collisionRows(slices), violations };
}
var plan = {
  async run(args, { ctx, stdout }) {
    const [sub, ...rest] = args;
    if (sub !== "check") throw usageError(USAGE8);
    const { positional } = parseArgs("plan check", rest);
    if (positional.length !== 1) throw usageError(USAGE8);
    const prd2 = positiveInt("plan check", "<prd>", positional[0]);
    const { planPath, slices, waves, rows, violations } = checkPlan(prd2, { ctx });
    println(
      stdout,
      `omni plan check \u2014 PRD ${prd2}: ${slices.length} slice(s) across wave(s) ${waves.join(", ")} (${planPath}).`
    );
    if (rows.length > 0) {
      println(stdout, `omni plan check \u2014 collision matrix (${rows.length} pair(s) sharing ground):`);
      for (const row of rows) println(stdout, `  ${row.pair}: ${row.shared} \u2014 ${row.resolved}`);
    }
    if (violations.length > 0) {
      println(stdout, formatFailure(`omni plan check \u2014 PRD ${prd2}: violation(s):`, violations));
      return 1;
    }
    println(
      stdout,
      formatPass(`omni plan check \u2014 PRD ${prd2}: ${slices.length} slice(s), all territories and blocks well-formed.`)
    );
    return 0;
  }
};

// kit/bin/commands/prd.mjs
init_define_OMNI_BUNDLE();

// kit/lib/delivery/prd.mjs
init_define_OMNI_BUNDLE();
import { readdirSync as readdirSync10 } from "node:fs";
import { join as join28 } from "node:path";
function whereIs(ctx, prd2) {
  const where = ctx.layout.whereIs(prd2);
  if (!where) return null;
  const absolute = join28(ctx.root, where.dir);
  const files = readdirSync10(absolute, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => `${where.dir}/${entry.name}`).sort();
  const outboxDir = ctx.layout.outboxDir(prd2);
  return {
    prd: Number(prd2),
    name: where.name,
    state: where.state,
    dir: where.dir,
    files,
    outboxDir,
    openItems: openItemFiles(prd2, { ctx })
  };
}

// kit/bin/commands/prd.mjs
var prd = {
  async run(args, { ctx, stdout, stderr }) {
    const { positional } = parseArgs("prd", args);
    if (positional.length !== 1) throw usageError("usage: omni prd <n>");
    const number = positiveInt("prd", "<n>", positional[0]);
    const where = whereIs(ctx, number);
    if (!where) {
      println(stderr, `omni prd: PRD ${number} is in neither ${ctx.layout.dirs.inbox} nor ${ctx.layout.dirs.shipped}.`);
      return 1;
    }
    const lines = [
      `PRD ${where.prd} \u2014 ${where.name}`,
      `state: ${where.state}`,
      `dir: ${where.dir}`,
      "files:",
      ...where.files.map((file) => `  - ${file}`),
      `outbox: ${where.outboxDir ?? "none"}`,
      `open items: ${where.openItems.length === 0 ? "none" : ""}`.trimEnd(),
      ...where.openItems.map((file) => `  - ${file}`)
    ];
    println(stdout, lines.join("\n"));
    return 0;
  }
};

// kit/bin/commands/replies.mjs
init_define_OMNI_BUNDLE();

// kit/lib/outbox/replies.mjs
init_define_OMNI_BUNDLE();
import { existsSync as existsSync24, readFileSync as readFileSync21, writeFileSync as writeFileSync10 } from "node:fs";
import { join as join29 } from "node:path";
var WRITER_ASSOCIATIONS = /* @__PURE__ */ new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
var NUMBERED_LINE = /^\s*(\d+)\s*:\s*(.+)$/;
var APPROVE_ALL_LINE = /^\s*approve all\s*$/i;
var RECOMMENDATION_RE = /^\s*go with (?:the )?recommendation[\s.!]*$/i;
var APPROVE_ALL_TEXT = "approve all";
var RECOMMENDATION_TEXT = "go with recommendation";
var LETTER_ANSWER = /^([A-Za-z])(?:\s*[.,:;)\-—–]?\s*because\b\s*(.*?))?[\s.!]*$/is;
var RANK_PLAIN_LABEL = { "human-action": "needs a person", high: "high", medium: "medium" };
function parseReplyLines(body) {
  const lines = [];
  for (const line of String(body ?? "").split(/\r?\n/)) {
    if (APPROVE_ALL_LINE.test(line)) {
      lines.push({ kind: "approve-all", text: APPROVE_ALL_TEXT });
      continue;
    }
    if (RECOMMENDATION_RE.test(line)) {
      lines.push({ kind: "approve-all", text: RECOMMENDATION_TEXT });
      continue;
    }
    const match = line.match(NUMBERED_LINE);
    if (match) lines.push({ kind: "numbered", number: Number(match[1]), text: match[2].trim() });
  }
  return lines;
}
function interpretAnswer({ text: text2, options }) {
  const trimmed = String(text2 ?? "").trim();
  if (RECOMMENDATION_RE.test(trimmed)) {
    return { statedVerdict: "agreed", recorded: RECOMMENDATION_TEXT };
  }
  const match = trimmed.match(LETTER_ANSWER);
  if (!match) return { statedVerdict: null, recorded: trimmed };
  const letter = match[1].toUpperCase();
  const option = (options ?? []).find((candidate) => candidate.letter === letter);
  if (!option) return { undetermined: true, recorded: trimmed };
  const reason = (match[2] ?? "").trim();
  return {
    statedVerdict: letter === "A" ? "agreed" : "drifted",
    recorded: `${letter}. ${option.text}${reason ? ` \u2014 because ${reason}` : ""}`
  };
}
function isCountedReply(comment2, markers) {
  return typeof comment2?.body === "string" && !comment2.body.includes(markers.any) && WRITER_ASSOCIATIONS.has(comment2.author_association);
}
function time(iso) {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}
function chronological(comments) {
  return [...comments].sort((a, b) => time(a.created_at) - time(b.created_at) || a.id - b.id);
}
function lastReaskedAt(comments, markers) {
  const at = /* @__PURE__ */ new Map();
  let highestRound = 0;
  for (const comment2 of comments) {
    const rounds = parseRoundMarkers([comment2], markers);
    for (const [number, round] of rounds) {
      highestRound = Math.max(highestRound, round);
      const when = time(comment2.created_at);
      if (!at.has(number) || when > at.get(number)) at.set(number, when);
    }
  }
  return { at, highestRound };
}
function answerableQuestions(numbering, items, adopted) {
  const itemsById = new Map(items.map((item2) => [item2.id, item2]));
  const adoptedById = /* @__PURE__ */ new Map();
  for (const entry of adopted) {
    const parsed = parseOutboxItem(entry.itemText, { file: null });
    if (parsed.ok) adoptedById.set(entry.id, { entry, item: parsed.item });
  }
  const questions = [];
  for (const entry of numbering) {
    if (itemsById.has(entry.id)) {
      questions.push({ ...entry, item: itemsById.get(entry.id), adoptedEntry: null });
    } else if (adoptedById.has(entry.id)) {
      const { entry: adoptedEntry, item: item2 } = adoptedById.get(entry.id);
      questions.push({ ...entry, item: item2, adoptedEntry });
    }
  }
  return questions.sort((a, b) => a.number - b.number);
}
function planReplies({ comments, items, adopted = [], markers }) {
  const all = Array.isArray(comments) ? comments : [];
  const prComment = findPrMarkerComment(all, markers);
  const numbering = prComment ? parseNumbersMarker(prComment.body, markers) : [];
  const questions = answerableQuestions(numbering, items, adopted);
  const byNumber = new Map(questions.map((question) => [question.number, question]));
  const open = questions.filter((question) => question.adoptedEntry === null);
  const numbered = /* @__PURE__ */ new Map();
  const approved = /* @__PURE__ */ new Map();
  for (const comment2 of chronological(all.filter((comment3) => isCountedReply(comment3, markers)))) {
    const answeredAt = time(comment2.created_at);
    const source = {
      approvedBy: comment2.user?.login ?? "",
      approvedAt: comment2.created_at,
      url: comment2.html_url
    };
    for (const line of parseReplyLines(comment2.body)) {
      if (line.kind === "numbered") {
        if (byNumber.has(line.number)) numbered.set(line.number, { ...source, text: line.text });
        continue;
      }
      for (const question of open) {
        if (time(question.since) < answeredAt) {
          approved.set(question.number, { ...source, text: line.text, approveAll: true });
        }
      }
    }
  }
  const { at: reaskedAt, highestRound } = lastReaskedAt(all, markers);
  const settle2 = [];
  const held = [];
  for (const { number, item: item2, adoptedEntry } of questions) {
    const raw = numbered.get(number) ?? approved.get(number);
    if (!raw) continue;
    const reading = raw.approveAll ? { statedVerdict: "agreed", recorded: raw.text } : interpretAnswer({ text: raw.text, options: item2.sections?.options });
    const answer = {
      ...raw,
      recorded: reading.recorded,
      ...reading.statedVerdict ? { statedVerdict: reading.statedVerdict } : {}
    };
    const judgement = reading.undetermined ? {
      verdict: null,
      basis: "undetermined",
      reason: "the reply names an option the question does not offer"
    } : judgeAnswer({
      choice: item2.sections?.whatIDidMeanwhile,
      answer: answer.recorded,
      statedVerdict: reading.statedVerdict ?? null
    });
    if (judgement.verdict === null) {
      const lastRound = reaskedAt.get(number);
      const due = lastRound === void 0 || time(answer.approvedAt) > lastRound;
      held.push({ number, item: item2, answer, due });
      continue;
    }
    if (adoptedEntry && judgement.verdict !== "drifted") continue;
    settle2.push({ number, item: item2, answer, judgement, adoptedEntry });
  }
  const dueQuestions = held.filter((question) => question.due);
  const round = dueQuestions.length === 0 ? null : {
    number: Math.max(highestRound, 1) + 1,
    questions: dueQuestions.map(({ number, item: item2, answer }) => ({
      number,
      rank: item2.rank,
      questionPlain: item2.sections?.questionPlain ?? item2.sections?.whatIHadToDecide ?? "",
      answerText: answer.text
    }))
  };
  return { settle: settle2, held, round };
}
function formatRoundComment({ round, questions, markers }) {
  const ordered = [...questions].sort((a, b) => a.number - b.number);
  const lines = [
    markers.round(round, ordered.map((question) => question.number)),
    "",
    `**Outbox round ${round}**`,
    ""
  ];
  for (const question of ordered) {
    lines.push(
      `**Question ${question.number}** \xB7 ${RANK_PLAIN_LABEL[question.rank] ?? question.rank}`,
      "",
      question.questionPlain,
      "",
      `You answered: \u201C${question.answerText}\u201D`,
      "",
      "We could not tell whether that keeps the decision or changes it, so nothing was changed.",
      "",
      `**Are you okay? If not, why?** Reply \`${question.number}: ok\` to keep it, or \`${question.number}: no, because \u2026\``,
      ""
    );
  }
  return lines.join("\n");
}
function appendObjection({ ctx, prd: prd2, adoptedEntry, item: item2, answer, judgement }) {
  const parsedAnswer = AnswerSchema.safeParse(answer);
  if (!parsedAnswer.success) {
    return {
      ok: false,
      errors: parsedAnswer.error.issues.map(
        (issue) => `${issue.path.join(".") || "(answer)"}: ${issue.message}`
      )
    };
  }
  const settledFile = `${ctx.layout.outboxDir(prd2)}/${SETTLED_FILE}`;
  const absoluteSettled = join29(ctx.root, settledFile);
  if (!existsSync24(absoluteSettled)) {
    return { ok: false, errors: [`${settledFile}: no ledger holds the adopted item ${item2.id}.`] };
  }
  const existing = readFileSync21(absoluteSettled, "utf8");
  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  const entry = renderSettledEntry({
    item: item2,
    itemText: adoptedEntry.itemText,
    answer: parsedAnswer.data,
    judgement,
    markers: ctx.markers
  });
  writeFileSync10(absoluteSettled, `${existing}${separator}${entry}`);
  return { ok: true, settledFile };
}
function readReplies({ ctx, prd: prd2, pr, post = false }, client) {
  const comments = client.listComments();
  const items = openItemsForPrd(prd2, { ctx });
  const adopted = adoptedEntriesForPrd(prd2, { ctx });
  const plan2 = planReplies({ comments, items, adopted, markers: ctx.markers });
  const settled = [];
  const failed = [];
  for (const { number, item: item2, answer, judgement, adoptedEntry } of plan2.settle) {
    const given = {
      text: answer.recorded,
      approvedBy: answer.approvedBy,
      approvedAt: answer.approvedAt,
      channel: {
        kind: "feature-pull-request",
        number: pr,
        ...answer.url ? { url: answer.url } : {}
      },
      ...answer.statedVerdict ? { statedVerdict: answer.statedVerdict } : {}
    };
    const result = adoptedEntry ? appendObjection({ ctx, prd: prd2, adoptedEntry, item: item2, answer: given, judgement }) : settleItem({ ctx, file: item2.file, answer: given });
    if (result.ok) {
      settled.push({
        number,
        id: item2.id,
        verdict: result.verdict ?? judgement.verdict,
        answer: answer.recorded,
        settledFile: result.settledFile,
        removedFile: result.removedFile ?? null,
        objection: Boolean(adoptedEntry)
      });
    } else {
      failed.push({ number, id: item2.id, errors: result.errors });
    }
  }
  let round = null;
  if (plan2.round) {
    const body = formatRoundComment({
      round: plan2.round.number,
      questions: plan2.round.questions,
      markers: ctx.markers
    });
    const posted = post ? client.createComment(body) : null;
    round = { number: plan2.round.number, body, posted: posted ?? null };
  }
  return {
    settled,
    failed,
    held: plan2.held.map(({ number, item: item2, answer, due }) => ({
      number,
      id: item2.id,
      answer: answer.text,
      due
    })),
    round
  };
}
function summarize(result) {
  const agreed = result.settled.filter((entry) => entry.verdict === "agreed").length;
  const drifted = result.settled.filter((entry) => entry.verdict === "drifted").length;
  const lines = [
    `outbox-replies: settled ${agreed} agreed, ${drifted} drifted; ${result.held.length} held for a round.`
  ];
  for (const entry of result.settled) {
    lines.push(
      `  question ${entry.number} (${entry.id}): ${entry.verdict}${entry.objection ? " (an objection to an adopted item)" : ""} \u2014 \u201C${entry.answer}\u201D`
    );
  }
  for (const entry of result.held) {
    lines.push(
      `  question ${entry.number} (${entry.id}): unclear \u2014 \u201C${entry.answer}\u201D` + (entry.due ? " \u2014 asked again in this round" : " \u2014 already asked again, no new reply")
    );
  }
  for (const entry of result.failed) {
    lines.push(
      `  question ${entry.number} (${entry.id}): not settled \u2014 ${entry.errors.join("; ")}`
    );
  }
  if (result.settled.length > 0) {
    lines.push("Commit the settled.md append and the deleted item files together.");
  }
  return lines.join("\n");
}

// kit/bin/commands/replies.mjs
var replies = {
  async run(args, { ctx, stdout, exec, env }) {
    const { positional, flags } = parseArgs("replies", args, { values: ["prd", "pr", "repo"], booleans: ["post"] });
    if (positional.length) throw usageError("usage: omni replies --prd <n> --pr <n> [--repo <owner/name>] [--post]");
    const prd2 = positiveInt("replies", "--prd", flags.prd);
    const pr = positiveInt("replies", "--pr", flags.pr);
    const repo = repoSlug("replies", ctx, flags.repo);
    const post = flags.post === true;
    const result = readReplies({ ctx, prd: prd2, pr, post }, githubClientFor(ctx, { repo, issue: pr, exec, env }));
    println(stdout, summarize(result));
    if (result.round) {
      if (result.round.posted) {
        println(stdout, `Posted outbox round ${result.round.number}: ${result.round.posted.html_url ?? ""}`);
      } else {
        println(stdout, `
Outbox round ${result.round.number} (not posted \u2014 pass --post):
`);
        println(stdout, result.round.body);
      }
    }
    return result.failed.length > 0 ? 1 : 0;
  }
};

// kit/bin/commands/rework.mjs
init_define_OMNI_BUNDLE();
import { readFileSync as readFileSync22, writeFileSync as writeFileSync11 } from "node:fs";
import { join as join30 } from "node:path";

// kit/lib/policy/rework.mjs
init_define_OMNI_BUNDLE();
var REWORKED_BY2 = /reworked by (#\d+|https?:\/\/[^\s,]+)/;
function driftedEntries(settledText, markers) {
  return parseSettledEntries(settledText ?? "", markers).filter(
    (entry) => entry.verdict === "drifted" && !entry.closed
  );
}
function namedPaths(text2) {
  const tokens = [...(text2 ?? "").matchAll(/`([^`\n]+)`/g)].map((match) => match[1].trim());
  return tokens.filter(
    (token) => !/^[a-z]+:\/\//.test(token) && !/\s/.test(token) && (token.includes("/") || /\.[A-Za-z0-9]+$/.test(token))
  );
}
var CHOSEN_OPTION_ANSWER = /^([A-D])\. ([\s\S]*?)(?: — because ([\s\S]*))?$/;
function chosenOptionOf(answerText, options) {
  const match = (answerText ?? "").trim().match(CHOSEN_OPTION_ANSWER);
  const option = match && (options ?? []).find((candidate) => candidate.letter === match[1]);
  if (!option || option.text !== match[2].trim()) return { chosenOption: null, reason: null };
  return {
    chosenOption: { letter: option.letter, text: option.text },
    reason: match[3]?.trim() || null
  };
}
var DEFAULT_BRANCHES = Object.freeze(ConfigSchema.shape.branches.parse(void 0));
function fill(template, values) {
  return template.replace(/\{(topic|slice|item)\}/g, (whole, key) => values[key] ?? whole);
}
function topicOf(featureBranch, featureTemplate) {
  const [head, tail = ""] = featureTemplate.split("{topic}");
  if (!featureTemplate.includes("{topic}") || !featureBranch.startsWith(head) || !featureBranch.endsWith(tail)) return null;
  const topic = featureBranch.slice(head.length, featureBranch.length - tail.length);
  return topic || null;
}
function reworkSliceId(itemId, branches = DEFAULT_BRANCHES) {
  return fill(branches.rework, { item: itemId });
}
function reworkBranch(featureBranch, sliceId, branches = DEFAULT_BRANCHES) {
  const topic = topicOf(featureBranch, branches.feature);
  if (topic === null) {
    throw new Error(`feature branch "${featureBranch}" does not match branches.feature "${branches.feature}"`);
  }
  return fill(branches.slice, { topic, slice: sliceId });
}
function deriveRework(entry, { planSlices = [], featureBranch = null, branches = DEFAULT_BRANCHES } = {}) {
  const parsed = parseOutboxItem(entry.itemText, { file: `settled entry ${entry.id}` });
  if (!parsed.ok) {
    throw new Error(
      `the settled entry for ${entry.id} does not hold a well-formed item, so no rework can be derived from it:
  - ${parsed.errors.join("\n  - ")}`
    );
  }
  const { item: item2 } = parsed;
  const planSlice = planSlices.find((slice) => slice.id === item2.slice) ?? null;
  const bound = item2.sections.whatItCostsToChangeLater;
  const { chosenOption, reason } = chosenOptionOf(entry.answerText, item2.sections.options);
  const territory = [.../* @__PURE__ */ new Set([...planSlice?.territory ?? [], ...namedPaths(bound)])];
  const id = reworkSliceId(entry.id, branches);
  return {
    id,
    itemId: entry.id,
    slice: item2.slice,
    rank: item2.rank,
    bearsOn: item2.bearsOn,
    question: item2.sections.whatIHadToDecide,
    choice: item2.sections.whatIDidMeanwhile,
    answer: entry.answerText,
    chosenOption,
    reason,
    bound,
    approvedBy: entry.fields["Approved by"] ?? null,
    channel: entry.fields.Channel ?? null,
    territory,
    territoryKnown: territory.length > 0,
    unknownPlanSlice: planSlice === null,
    wave: 1,
    ...featureBranch ? { base: featureBranch, branch: reworkBranch(featureBranch, id, branches) } : {}
  };
}
function assignWaves(reworks) {
  const waves = [];
  return reworks.map((rework2) => {
    let index = waves.findIndex(
      (wave) => !wave.some((sibling) => sharedGround(sibling, rework2).length > 0)
    );
    if (index === -1) index = waves.push([]) - 1;
    waves[index].push(rework2);
    return { ...rework2, wave: index + 1 };
  });
}
function planRework({ settledText = "", planMarkdown = null, prd: prd2, featureBranch, markers, branches = DEFAULT_BRANCHES }) {
  const settledCount = parseSettledEntries(settledText, markers).length;
  const drifted = driftedEntries(settledText, markers);
  const planSlices = planMarkdown ? parsePlanSlices(planMarkdown) : [];
  const reworks = assignWaves(
    drifted.map((entry) => deriveRework(entry, { planSlices, featureBranch, branches }))
  );
  return {
    prd: prd2,
    featureBranch,
    settledCount,
    reworks,
    opensPullRequest: reworks.length > 0,
    mergesIntoMain: false,
    raisesItems: false,
    report: reportLines({ prd: prd2, featureBranch, settledCount, reworks })
  };
}
function reportLines({ prd: prd2, featureBranch, settledCount, reworks }) {
  const settled = `${settledCount} settled item${settledCount === 1 ? "" : "s"}`;
  if (reworks.length === 0) {
    return [
      `Nothing drifted \u2014 every one of the ${settled} of PRD #${prd2} agreed with what was built.`,
      "No rework slice was derived and no pull request was opened."
    ];
  }
  const lines = [
    `${reworks.length} drifted item${reworks.length === 1 ? "" : "s"} of ${settled} on PRD #${prd2}.`,
    `One rework slice each, as sub-PRs into \`${featureBranch}\`:`,
    ""
  ];
  for (const rework2 of reworks) {
    lines.push(
      `- \`${rework2.id}\` (wave ${rework2.wave}) \u2014 reworks \`${rework2.itemId}\`, raised by slice ${rework2.slice}.`,
      `  Territory: ${rework2.territory.map((path) => `\`${path}\``).join(", ") || "(the plan declares none, and none was invented)"}`
    );
  }
  return lines;
}
function closeDriftedEntry(settledText, { id, pullRequest, markers }) {
  const reference = (pullRequest ?? "").trim();
  if (!reference) {
    throw new Error(
      `${id}: name the rework sub-pull request that closed it \u2014 a closure nobody can follow is not a closure.`
    );
  }
  const entry = parseSettledEntries(settledText, markers).find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`${id}: this ledger holds no settled entry with that id.`);
  }
  if (entry.verdict !== "drifted") {
    throw new Error(
      `${id}: this entry settled as "${entry.verdict}" \u2014 only a drifted item is ever reworked, and ${COMMANDS.yoloFix} re-decides nothing.`
    );
  }
  if (entry.closed) {
    throw new Error(
      `${id}: already closed by ${reworkPullRequest(entry) ?? "a rework"} \u2014 the ledger records one closure, not a second opinion.`
    );
  }
  const open = markers.settledOpen(id);
  const close = markers.settledClose(id);
  const lines = settledText.split("\n");
  const start = lines.lastIndexOf(open);
  const end = lines.indexOf(close, start);
  const closedIndex = lines.findIndex(
    (line, index) => index > start && index < end && line.startsWith("- Closed: ")
  );
  if (closedIndex === -1) {
    throw new Error(`${id}: this entry carries no "Closed:" line to amend.`);
  }
  lines[closedIndex] = `- Closed: yes \u2014 reworked by ${reference}, the sub-pull request that brought the build back in line`;
  return lines.join("\n");
}
function reworkPullRequest(entry) {
  return (entry?.fields?.Closed ?? "").match(REWORKED_BY2)?.[1] ?? null;
}

// kit/bin/commands/rework.mjs
var USAGE9 = "usage: omni rework plan <prd> [--json] | omni rework close <id> --prd <n> --pr <n>";
var PLAN_USAGE = "usage: omni rework plan <prd> [--json]";
var CLOSE_USAGE = "usage: omni rework close <id> --prd <n> --pr <n>";
function readIfExists(ctx, path) {
  try {
    return readFileSync22(join30(ctx.root, path), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}
function topicFor2(prd2, { ctx }) {
  const where = ctx.layout.whereIs(prd2);
  const parsed = where ? parseFolderName(where.name) : null;
  return parsed ? parsed.topic : null;
}
function territoryOf(rework2) {
  return rework2.territory.map((path) => `\`${path}\``).join(", ") || "(none declared)";
}
function printPlan(stdout, result) {
  if (result.reworks.length === 0) {
    for (const line of result.report) println(stdout, line);
    return;
  }
  println(
    stdout,
    `omni rework plan \u2014 PRD ${result.prd}: ${result.reworks.length} drifted item(s) of ${result.settledCount} settled item(s).`
  );
  for (const rework2 of result.reworks) {
    println(stdout, `- ${rework2.id} (wave ${rework2.wave}) \u2014 reworks ${rework2.itemId}`);
    println(stdout, `  branch: ${rework2.branch ?? "(unknown \u2014 no feature branch resolved)"}`);
    println(stdout, `  territory: ${territoryOf(rework2)}`);
  }
}
async function runPlan(args, { ctx, stdout }) {
  const { positional, flags } = parseArgs("rework plan", args, { booleans: ["json"] });
  if (positional.length !== 1) throw usageError(PLAN_USAGE);
  const prd2 = positiveInt("rework plan", "<prd>", positional[0]);
  const planPath = ctx.layout.planPath(prd2);
  if (planPath === null) throw usageError(`omni rework plan: PRD ${prd2} has no inbox or shipped folder.`);
  const outboxDir = ctx.layout.outboxDir(prd2);
  const settledText = outboxDir ? readIfExists(ctx, `${outboxDir}/settled.md`) : "";
  const planMarkdown = readIfExists(ctx, planPath);
  const topic = topicFor2(prd2, { ctx });
  const featureBranch = topic ? fillBranch(ctx.config.branches.feature, { topic }) : null;
  const result = planRework({
    settledText,
    planMarkdown,
    prd: prd2,
    featureBranch,
    markers: ctx.markers,
    branches: ctx.config.branches
  });
  if (flags.json) {
    println(stdout, JSON.stringify(result, null, 2));
    return 0;
  }
  printPlan(stdout, result);
  return 0;
}
async function runClose(args, { ctx, stdout }) {
  const { positional, flags } = parseArgs("rework close", args, { values: ["pr", "prd"] });
  if (positional.length !== 1 || flags.pr === void 0 || flags.prd === void 0) {
    throw usageError(CLOSE_USAGE);
  }
  const id = positional[0];
  const prd2 = positiveInt("rework close", "--prd", flags.prd);
  const pr = positiveInt("rework close", "--pr", flags.pr);
  const pullRequest = `#${pr}`;
  const outboxDir = ctx.layout.outboxDir(prd2);
  if (outboxDir === null) throw usageError(`omni rework close: PRD ${prd2} has no inbox or shipped folder.`);
  const settledFile = `${outboxDir}/settled.md`;
  const text2 = readIfExists(ctx, settledFile);
  let closedText;
  try {
    closedText = closeDriftedEntry(text2, { id, pullRequest, markers: ctx.markers });
  } catch (error) {
    throw usageError(error.message.split("\n")[0]);
  }
  writeFileSync11(join30(ctx.root, settledFile), closedText);
  println(
    stdout,
    `omni rework close \u2014 PRD ${prd2}: ${id} closed by ${pullRequest}; ${settledFile} amended. Commit the amendment.`
  );
  return 0;
}
var rework = {
  async run(args, io) {
    const [sub, ...rest] = args;
    if (sub === "plan") return runPlan(rest, io);
    if (sub === "close") return runClose(rest, io);
    throw usageError(USAGE9);
  }
};

// kit/bin/commands/settle.mjs
init_define_OMNI_BUNDLE();
import { relative as relative3 } from "node:path";
var USAGE10 = 'usage: omni settle <item-file> --by <who> --at <iso> --channel prd-issue|feature-pull-request --number <n> (--answer "<text>" | --answer-file <path>) [--url <u>] [--verdict agreed|drifted]';
var settle = {
  async run(args, { ctx, stdout, stderr }) {
    const { positional, flags } = parseArgs("settle", args, {
      values: ["by", "at", "channel", "number", "answer", "answer-file", "url", "verdict"]
    });
    if (positional.length !== 1) throw usageError(USAGE10);
    if (flags.answer !== void 0 && flags["answer-file"] !== void 0) {
      throw usageError("omni settle: give --answer or --answer-file, not both.");
    }
    const file = relative3(ctx.root, inRoot(ctx, positional[0]));
    const text2 = flags["answer-file"] ? readUserFile("settle", ctx, flags["answer-file"]) : flags.answer;
    const result = withPrdFolder("settle", () => settleItem({
      ctx,
      file,
      answer: {
        text: text2 ?? "",
        approvedBy: flags.by ?? "",
        approvedAt: flags.at ?? "",
        channel: {
          kind: flags.channel ?? "",
          number: flags.number ?? 0,
          ...flags.url ? { url: flags.url } : {}
        },
        ...flags.verdict ? { statedVerdict: flags.verdict } : {}
      }
    }));
    if (!result.ok) {
      println(stderr, "omni settle \u2014 nothing was written:");
      for (const error of result.errors) println(stderr, `  - ${error}`);
      return 1;
    }
    println(
      stdout,
      `omni settle \u2014 ${result.removedFile} settled as "${result.verdict}" (${result.basis}); appended to ${result.settledFile}. Commit the append and the deletion together.`
    );
    return 0;
  }
};

// kit/bin/commands/ship.mjs
init_define_OMNI_BUNDLE();

// kit/lib/delivery/ship.mjs
init_define_OMNI_BUNDLE();
import { execFileSync as execFileSync5 } from "node:child_process";
import { existsSync as existsSync25, readFileSync as readFileSync23, writeFileSync as writeFileSync12, mkdirSync as mkdirSync7 } from "node:fs";
import { basename as basename6, join as join31, dirname as dirname8 } from "node:path";
var REWRITTEN = /\.(md|html|yml|yaml|json)$/;
function planShip(ctx, prd2, { files, read }) {
  const where = ctx.layout.whereIs(prd2);
  if (where?.state !== "inbox") {
    return { ok: false, reasons: [`PRD ${Number(prd2)} is not in the inbox (${where ? where.state : "nowhere"})`] };
  }
  const reasons = [
    ...openItemFiles(prd2, { ctx }).map((file) => `open outbox item: ${file}`),
    ...unreworkedDrift(prd2, { ctx }).map((entry) => `drifted, not reworked: ${entry.id}`)
  ];
  if (reasons.length) return { ok: false, reasons };
  const { dirs } = ctx.layout;
  const shipped = `${dirs.shipped}/${where.name}`;
  const outbox = `${dirs.outbox}/${where.name}`;
  const moves = [{ from: where.dir, to: shipped }];
  const hasOutbox = existsSync25(join31(ctx.root, outbox));
  if (hasOutbox) moves.push({ from: outbox, to: `${shipped}/outbox` });
  const rewrites = [];
  for (const file of files) {
    if (!REWRITTEN.test(file) || basename6(file) === SETTLED_FILE) continue;
    if (!existsSync25(join31(ctx.root, file))) continue;
    const before = read(file);
    let after = before.split(where.dir).join(shipped);
    if (hasOutbox) after = after.split(outbox).join(`${shipped}/outbox`);
    if (after !== before) rewrites.push({ file, text: after });
  }
  return { ok: true, moves, rewrites };
}
var DirtyDeliveryError = class extends Error {
  constructor(delivery) {
    super(`uncommitted changes under ${delivery} \u2014 commit the settle first`);
    this.name = "DirtyDeliveryError";
  }
};
function applyShip(ctx, prd2, { exec = execFileSync5 } = {}) {
  const delivery = ctx.config.paths.delivery;
  const dirty = exec("git", ["status", "--porcelain", "--", delivery], { cwd: ctx.root, encoding: "utf8" });
  if (String(dirty ?? "").trim()) throw new DirtyDeliveryError(delivery);
  const read = (file) => readFileSync23(join31(ctx.root, file), "utf8");
  const plan2 = planShip(ctx, prd2, { files: trackedFiles(ctx), read });
  if (!plan2.ok) throw new Error(`Cannot ship PRD ${Number(prd2)}:
${plan2.reasons.map((r) => `  - ${r}`).join("\n")}`);
  for (const { from, to } of plan2.moves) {
    mkdirSync7(dirname8(join31(ctx.root, to)), { recursive: true });
    exec("git", ["mv", from, to], { cwd: ctx.root, stdio: "ignore" });
  }
  for (const { file, text: text2 } of plan2.rewrites) {
    writeFileSync12(join31(ctx.root, movedPath(plan2.moves, file)), text2);
  }
  return plan2;
}
function movedPath(moves, file) {
  return moves.reduce((path, { from, to }) => path.startsWith(`${from}/`) ? to + path.slice(from.length) : path, file);
}

// kit/bin/commands/ship.mjs
var ship = {
  async run(args, { ctx, stdout, stderr, exec }) {
    const { positional } = parseArgs("ship", args);
    if (positional.length !== 1) throw usageError("usage: omni ship <prd>");
    const prd2 = positiveInt("ship", "<prd>", positional[0]);
    let plan2;
    try {
      plan2 = applyShip(ctx, prd2, { exec });
    } catch (error) {
      if (error instanceof DirtyDeliveryError) throw usageError(`omni ship: ${error.message}.`);
      println(stderr, error.message);
      return 1;
    }
    const lines = [`omni ship \u2014 PRD ${prd2}:`];
    for (const { from, to } of plan2.moves) lines.push(`  moved ${from} \u2192 ${to}`);
    for (const { file } of plan2.rewrites) lines.push(`  rewrote paths in ${movedPath(plan2.moves, file)}`);
    lines.push("Review the diff and commit it on the feature branch.");
    println(stdout, lines.join("\n"));
    return 0;
  }
};

// kit/bin/commands/status.mjs
init_define_OMNI_BUNDLE();
import { appendFileSync } from "node:fs";
var status2 = {
  async run(args, { ctx, stdout, exec, env }) {
    const { positional, flags } = parseArgs("status", args, { values: ["labels", "base"], booleans: ["changes"] });
    if (positional.length !== 1) throw usageError("usage: omni status <prd> [--labels a,b] [--base <ref> | --changes]");
    const prd2 = positiveInt("status", "<prd>", positional[0]);
    const labels = list(flags.labels);
    const base = flags.base ?? (flags.changes ? `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}` : null);
    let changes = null;
    if (base !== null) {
      try {
        changes = rangeChanges({ ctx, base, exec });
      } catch (error) {
        throw usageError(error.message.split("\n")[0]);
      }
    }
    const result = gateResult(prd2, { ctx, labels, changes });
    const report2 = formatReport(prd2, result);
    println(stdout, report2);
    if (env.GITHUB_OUTPUT) {
      const lines = [
        `open_items=${result.items.length > 0}`,
        `unreworked=${result.unreworked.length > 0}`,
        `unaccounted=${(result.unaccounted ?? []).length > 0}`
      ];
      appendFileSync(env.GITHUB_OUTPUT, `${lines.join("\n")}
`);
    }
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${report2}
`);
    return result.ok ? 0 : 1;
  }
};

// kit/bin/commands/index.mjs
var COMMAND_TABLE = Object.freeze({ config, prd, status: status2, settle, adopt, replies, comment, ship, check, knowledge, kb, item, plan, board, rework, phase0, init, ask, signin, signout, whoami });

// kit/bin/omni.mjs
var USAGE11 = `usage: omni <command> [args]
commands: ${Object.keys(COMMAND_TABLE).join(", ")}
`;
async function main(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr, exec = execFileSync6, env = process.env, ...more } = {}) {
  const [name, ...rest] = argv;
  const command = Object.hasOwn(COMMAND_TABLE, name ?? "") ? COMMAND_TABLE[name] : void 0;
  if (!command) {
    stderr.write(USAGE11);
    return 2;
  }
  try {
    if (command.withoutContext) return await command.run(rest, { cwd, stdout, stderr, exec, env, ...more });
    const ctx = loadContext(cwd, { exec });
    return await command.run(rest, { ctx, stdout, stderr, exec, env });
  } catch (error) {
    if (error instanceof ConfigError || error?.name === "ConfigError" || error?.name === "UsageError") {
      stderr.write(`${error.message.split("\n")[0]}
`);
      return 2;
    }
    throw error;
  }
}
var invoked = process.argv[1] && realpathSync3(process.argv[1]) === realpathSync3(fileURLToPath3(import.meta.url));
if (invoked) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
    process.stderr.write(`${error.stack ?? error}
`);
    process.exit(1);
  });
}
export {
  formTemplate,
  frontDoorTemplate,
  main
};
