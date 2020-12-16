/*
Copyright (c) 2019 Daybrush
name: preact-timeline
license: MIT
author: Daybrush
repository: git+https://github.com/daybrush/scenejs-timeline.git
version: 0.2.3
*/
(function (factory) {
	typeof define === 'function' && define.amd ? define(factory) :
	factory();
}(function () { 'use strict';

	var VNode = function VNode() {};

	var options = {};

	var stack = [];

	var EMPTY_CHILDREN = [];

	function h(nodeName, attributes) {
		var children = EMPTY_CHILDREN,
		    lastSimple,
		    child,
		    simple,
		    i;
		for (i = arguments.length; i-- > 2;) {
			stack.push(arguments[i]);
		}
		if (attributes && attributes.children != null) {
			if (!stack.length) stack.push(attributes.children);
			delete attributes.children;
		}
		while (stack.length) {
			if ((child = stack.pop()) && child.pop !== undefined) {
				for (i = child.length; i--;) {
					stack.push(child[i]);
				}
			} else {
				if (typeof child === 'boolean') child = null;

				if (simple = typeof nodeName !== 'function') {
					if (child == null) child = '';else if (typeof child === 'number') child = String(child);else if (typeof child !== 'string') simple = false;
				}

				if (simple && lastSimple) {
					children[children.length - 1] += child;
				} else if (children === EMPTY_CHILDREN) {
					children = [child];
				} else {
					children.push(child);
				}

				lastSimple = simple;
			}
		}

		var p = new VNode();
		p.nodeName = nodeName;
		p.children = children;
		p.attributes = attributes == null ? undefined : attributes;
		p.key = attributes == null ? undefined : attributes.key;

		if (options.vnode !== undefined) options.vnode(p);

		return p;
	}

	function extend(obj, props) {
	  for (var i in props) {
	    obj[i] = props[i];
	  }return obj;
	}

	function applyRef(ref, value) {
	  if (ref != null) {
	    if (typeof ref == 'function') ref(value);else ref.current = value;
	  }
	}

	var defer = typeof Promise == 'function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;

	function cloneElement(vnode, props) {
	  return h(vnode.nodeName, extend(extend({}, vnode.attributes), props), arguments.length > 2 ? [].slice.call(arguments, 2) : vnode.children);
	}

	var IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

	var items = [];

	function enqueueRender(component) {
		if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
			(defer)(rerender);
		}
	}

	function rerender() {
		var p;
		while (p = items.pop()) {
			if (p._dirty) renderComponent(p);
		}
	}

	function isSameNodeType(node, vnode, hydrating) {
		if (typeof vnode === 'string' || typeof vnode === 'number') {
			return node.splitText !== undefined;
		}
		if (typeof vnode.nodeName === 'string') {
			return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
		}
		return hydrating || node._componentConstructor === vnode.nodeName;
	}

	function isNamedNode(node, nodeName) {
		return node.normalizedNodeName === nodeName || node.nodeName.toLowerCase() === nodeName.toLowerCase();
	}

	function getNodeProps(vnode) {
		var props = extend({}, vnode.attributes);
		props.children = vnode.children;

		var defaultProps = vnode.nodeName.defaultProps;
		if (defaultProps !== undefined) {
			for (var i in defaultProps) {
				if (props[i] === undefined) {
					props[i] = defaultProps[i];
				}
			}
		}

		return props;
	}

	function createNode(nodeName, isSvg) {
		var node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
		node.normalizedNodeName = nodeName;
		return node;
	}

	function removeNode(node) {
		var parentNode = node.parentNode;
		if (parentNode) parentNode.removeChild(node);
	}

	function setAccessor(node, name, old, value, isSvg) {
		if (name === 'className') name = 'class';

		if (name === 'key') ; else if (name === 'ref') {
			applyRef(old, null);
			applyRef(value, node);
		} else if (name === 'class' && !isSvg) {
			node.className = value || '';
		} else if (name === 'style') {
			if (!value || typeof value === 'string' || typeof old === 'string') {
				node.style.cssText = value || '';
			}
			if (value && typeof value === 'object') {
				if (typeof old !== 'string') {
					for (var i in old) {
						if (!(i in value)) node.style[i] = '';
					}
				}
				for (var i in value) {
					node.style[i] = typeof value[i] === 'number' && IS_NON_DIMENSIONAL.test(i) === false ? value[i] + 'px' : value[i];
				}
			}
		} else if (name === 'dangerouslySetInnerHTML') {
			if (value) node.innerHTML = value.__html || '';
		} else if (name[0] == 'o' && name[1] == 'n') {
			var useCapture = name !== (name = name.replace(/Capture$/, ''));
			name = name.toLowerCase().substring(2);
			if (value) {
				if (!old) node.addEventListener(name, eventProxy, useCapture);
			} else {
				node.removeEventListener(name, eventProxy, useCapture);
			}
			(node._listeners || (node._listeners = {}))[name] = value;
		} else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
			try {
				node[name] = value == null ? '' : value;
			} catch (e) {}
			if ((value == null || value === false) && name != 'spellcheck') node.removeAttribute(name);
		} else {
			var ns = isSvg && name !== (name = name.replace(/^xlink:?/, ''));

			if (value == null || value === false) {
				if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());else node.removeAttribute(name);
			} else if (typeof value !== 'function') {
				if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);else node.setAttribute(name, value);
			}
		}
	}

	function eventProxy(e) {
		return this._listeners[e.type](options.event && options.event(e) || e);
	}

	var mounts = [];

	var diffLevel = 0;

	var isSvgMode = false;

	var hydrating = false;

	function flushMounts() {
		var c;
		while (c = mounts.shift()) {
			if (c.componentDidMount) c.componentDidMount();
		}
	}

	function diff(dom, vnode, context, mountAll, parent, componentRoot) {
		if (!diffLevel++) {
			isSvgMode = parent != null && parent.ownerSVGElement !== undefined;

			hydrating = dom != null && !('__preactattr_' in dom);
		}

		var ret = idiff(dom, vnode, context, mountAll, componentRoot);

		if (parent && ret.parentNode !== parent) parent.appendChild(ret);

		if (! --diffLevel) {
			hydrating = false;

			if (!componentRoot) flushMounts();
		}

		return ret;
	}

	function idiff(dom, vnode, context, mountAll, componentRoot) {
		var out = dom,
		    prevSvgMode = isSvgMode;

		if (vnode == null || typeof vnode === 'boolean') vnode = '';

		if (typeof vnode === 'string' || typeof vnode === 'number') {
			if (dom && dom.splitText !== undefined && dom.parentNode && (!dom._component || componentRoot)) {
				if (dom.nodeValue != vnode) {
					dom.nodeValue = vnode;
				}
			} else {
				out = document.createTextNode(vnode);
				if (dom) {
					if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
					recollectNodeTree(dom, true);
				}
			}

			out['__preactattr_'] = true;

			return out;
		}

		var vnodeName = vnode.nodeName;
		if (typeof vnodeName === 'function') {
			return buildComponentFromVNode(dom, vnode, context, mountAll);
		}

		isSvgMode = vnodeName === 'svg' ? true : vnodeName === 'foreignObject' ? false : isSvgMode;

		vnodeName = String(vnodeName);
		if (!dom || !isNamedNode(dom, vnodeName)) {
			out = createNode(vnodeName, isSvgMode);

			if (dom) {
				while (dom.firstChild) {
					out.appendChild(dom.firstChild);
				}
				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

				recollectNodeTree(dom, true);
			}
		}

		var fc = out.firstChild,
		    props = out['__preactattr_'],
		    vchildren = vnode.children;

		if (props == null) {
			props = out['__preactattr_'] = {};
			for (var a = out.attributes, i = a.length; i--;) {
				props[a[i].name] = a[i].value;
			}
		}

		if (!hydrating && vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && fc != null && fc.splitText !== undefined && fc.nextSibling == null) {
			if (fc.nodeValue != vchildren[0]) {
				fc.nodeValue = vchildren[0];
			}
		} else if (vchildren && vchildren.length || fc != null) {
				innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML != null);
			}

		diffAttributes(out, vnode.attributes, props);

		isSvgMode = prevSvgMode;

		return out;
	}

	function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
		var originalChildren = dom.childNodes,
		    children = [],
		    keyed = {},
		    keyedLen = 0,
		    min = 0,
		    len = originalChildren.length,
		    childrenLen = 0,
		    vlen = vchildren ? vchildren.length : 0,
		    j,
		    c,
		    f,
		    vchild,
		    child;

		if (len !== 0) {
			for (var i = 0; i < len; i++) {
				var _child = originalChildren[i],
				    props = _child['__preactattr_'],
				    key = vlen && props ? _child._component ? _child._component.__key : props.key : null;
				if (key != null) {
					keyedLen++;
					keyed[key] = _child;
				} else if (props || (_child.splitText !== undefined ? isHydrating ? _child.nodeValue.trim() : true : isHydrating)) {
					children[childrenLen++] = _child;
				}
			}
		}

		if (vlen !== 0) {
			for (var i = 0; i < vlen; i++) {
				vchild = vchildren[i];
				child = null;

				var key = vchild.key;
				if (key != null) {
					if (keyedLen && keyed[key] !== undefined) {
						child = keyed[key];
						keyed[key] = undefined;
						keyedLen--;
					}
				} else if (min < childrenLen) {
						for (j = min; j < childrenLen; j++) {
							if (children[j] !== undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
								child = c;
								children[j] = undefined;
								if (j === childrenLen - 1) childrenLen--;
								if (j === min) min++;
								break;
							}
						}
					}

				child = idiff(child, vchild, context, mountAll);

				f = originalChildren[i];
				if (child && child !== dom && child !== f) {
					if (f == null) {
						dom.appendChild(child);
					} else if (child === f.nextSibling) {
						removeNode(f);
					} else {
						dom.insertBefore(child, f);
					}
				}
			}
		}

		if (keyedLen) {
			for (var i in keyed) {
				if (keyed[i] !== undefined) recollectNodeTree(keyed[i], false);
			}
		}

		while (min <= childrenLen) {
			if ((child = children[childrenLen--]) !== undefined) recollectNodeTree(child, false);
		}
	}

	function recollectNodeTree(node, unmountOnly) {
		var component = node._component;
		if (component) {
			unmountComponent(component);
		} else {
			if (node['__preactattr_'] != null) applyRef(node['__preactattr_'].ref, null);

			if (unmountOnly === false || node['__preactattr_'] == null) {
				removeNode(node);
			}

			removeChildren(node);
		}
	}

	function removeChildren(node) {
		node = node.lastChild;
		while (node) {
			var next = node.previousSibling;
			recollectNodeTree(node, true);
			node = next;
		}
	}

	function diffAttributes(dom, attrs, old) {
		var name;

		for (name in old) {
			if (!(attrs && attrs[name] != null) && old[name] != null) {
				setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
			}
		}

		for (name in attrs) {
			if (name !== 'children' && name !== 'innerHTML' && (!(name in old) || attrs[name] !== (name === 'value' || name === 'checked' ? dom[name] : old[name]))) {
				setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
			}
		}
	}

	var recyclerComponents = [];

	function createComponent(Ctor, props, context) {
		var inst,
		    i = recyclerComponents.length;

		if (Ctor.prototype && Ctor.prototype.render) {
			inst = new Ctor(props, context);
			Component.call(inst, props, context);
		} else {
			inst = new Component(props, context);
			inst.constructor = Ctor;
			inst.render = doRender;
		}

		while (i--) {
			if (recyclerComponents[i].constructor === Ctor) {
				inst.nextBase = recyclerComponents[i].nextBase;
				recyclerComponents.splice(i, 1);
				return inst;
			}
		}

		return inst;
	}

	function doRender(props, state, context) {
		return this.constructor(props, context);
	}

	function setComponentProps(component, props, renderMode, context, mountAll) {
		if (component._disable) return;
		component._disable = true;

		component.__ref = props.ref;
		component.__key = props.key;
		delete props.ref;
		delete props.key;

		if (typeof component.constructor.getDerivedStateFromProps === 'undefined') {
			if (!component.base || mountAll) {
				if (component.componentWillMount) component.componentWillMount();
			} else if (component.componentWillReceiveProps) {
				component.componentWillReceiveProps(props, context);
			}
		}

		if (context && context !== component.context) {
			if (!component.prevContext) component.prevContext = component.context;
			component.context = context;
		}

		if (!component.prevProps) component.prevProps = component.props;
		component.props = props;

		component._disable = false;

		if (renderMode !== 0) {
			if (renderMode === 1 || options.syncComponentUpdates !== false || !component.base) {
				renderComponent(component, 1, mountAll);
			} else {
				enqueueRender(component);
			}
		}

		applyRef(component.__ref, component);
	}

	function renderComponent(component, renderMode, mountAll, isChild) {
		if (component._disable) return;

		var props = component.props,
		    state = component.state,
		    context = component.context,
		    previousProps = component.prevProps || props,
		    previousState = component.prevState || state,
		    previousContext = component.prevContext || context,
		    isUpdate = component.base,
		    nextBase = component.nextBase,
		    initialBase = isUpdate || nextBase,
		    initialChildComponent = component._component,
		    skip = false,
		    snapshot = previousContext,
		    rendered,
		    inst,
		    cbase;

		if (component.constructor.getDerivedStateFromProps) {
			state = extend(extend({}, state), component.constructor.getDerivedStateFromProps(props, state));
			component.state = state;
		}

		if (isUpdate) {
			component.props = previousProps;
			component.state = previousState;
			component.context = previousContext;
			if (renderMode !== 2 && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {
				skip = true;
			} else if (component.componentWillUpdate) {
				component.componentWillUpdate(props, state, context);
			}
			component.props = props;
			component.state = state;
			component.context = context;
		}

		component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
		component._dirty = false;

		if (!skip) {
			rendered = component.render(props, state, context);

			if (component.getChildContext) {
				context = extend(extend({}, context), component.getChildContext());
			}

			if (isUpdate && component.getSnapshotBeforeUpdate) {
				snapshot = component.getSnapshotBeforeUpdate(previousProps, previousState);
			}

			var childComponent = rendered && rendered.nodeName,
			    toUnmount,
			    base;

			if (typeof childComponent === 'function') {

				var childProps = getNodeProps(rendered);
				inst = initialChildComponent;

				if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
					setComponentProps(inst, childProps, 1, context, false);
				} else {
					toUnmount = inst;

					component._component = inst = createComponent(childComponent, childProps, context);
					inst.nextBase = inst.nextBase || nextBase;
					inst._parentComponent = component;
					setComponentProps(inst, childProps, 0, context, false);
					renderComponent(inst, 1, mountAll, true);
				}

				base = inst.base;
			} else {
				cbase = initialBase;

				toUnmount = initialChildComponent;
				if (toUnmount) {
					cbase = component._component = null;
				}

				if (initialBase || renderMode === 1) {
					if (cbase) cbase._component = null;
					base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
				}
			}

			if (initialBase && base !== initialBase && inst !== initialChildComponent) {
				var baseParent = initialBase.parentNode;
				if (baseParent && base !== baseParent) {
					baseParent.replaceChild(base, initialBase);

					if (!toUnmount) {
						initialBase._component = null;
						recollectNodeTree(initialBase, false);
					}
				}
			}

			if (toUnmount) {
				unmountComponent(toUnmount);
			}

			component.base = base;
			if (base && !isChild) {
				var componentRef = component,
				    t = component;
				while (t = t._parentComponent) {
					(componentRef = t).base = base;
				}
				base._component = componentRef;
				base._componentConstructor = componentRef.constructor;
			}
		}

		if (!isUpdate || mountAll) {
			mounts.push(component);
		} else if (!skip) {

			if (component.componentDidUpdate) {
				component.componentDidUpdate(previousProps, previousState, snapshot);
			}
		}

		while (component._renderCallbacks.length) {
			component._renderCallbacks.pop().call(component);
		}if (!diffLevel && !isChild) flushMounts();
	}

	function buildComponentFromVNode(dom, vnode, context, mountAll) {
		var c = dom && dom._component,
		    originalComponent = c,
		    oldDom = dom,
		    isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
		    isOwner = isDirectOwner,
		    props = getNodeProps(vnode);
		while (c && !isOwner && (c = c._parentComponent)) {
			isOwner = c.constructor === vnode.nodeName;
		}

		if (c && isOwner && (!mountAll || c._component)) {
			setComponentProps(c, props, 3, context, mountAll);
			dom = c.base;
		} else {
			if (originalComponent && !isDirectOwner) {
				unmountComponent(originalComponent);
				dom = oldDom = null;
			}

			c = createComponent(vnode.nodeName, props, context);
			if (dom && !c.nextBase) {
				c.nextBase = dom;

				oldDom = null;
			}
			setComponentProps(c, props, 1, context, mountAll);
			dom = c.base;

			if (oldDom && dom !== oldDom) {
				oldDom._component = null;
				recollectNodeTree(oldDom, false);
			}
		}

		return dom;
	}

	function unmountComponent(component) {

		var base = component.base;

		component._disable = true;

		if (component.componentWillUnmount) component.componentWillUnmount();

		component.base = null;

		var inner = component._component;
		if (inner) {
			unmountComponent(inner);
		} else if (base) {
			if (base['__preactattr_'] != null) applyRef(base['__preactattr_'].ref, null);

			component.nextBase = base;

			removeNode(base);
			recyclerComponents.push(component);

			removeChildren(base);
		}

		applyRef(component.__ref, null);
	}

	function Component(props, context) {
		this._dirty = true;

		this.context = context;

		this.props = props;

		this.state = this.state || {};

		this._renderCallbacks = [];
	}

	extend(Component.prototype, {
		setState: function setState(state, callback) {
			if (!this.prevState) this.prevState = this.state;
			this.state = extend(extend({}, this.state), typeof state === 'function' ? state(this.state, this.props) : state);
			if (callback) this._renderCallbacks.push(callback);
			enqueueRender(this);
		},
		forceUpdate: function forceUpdate(callback) {
			if (callback) this._renderCallbacks.push(callback);
			renderComponent(this, 2);
		},
		render: function render() {}
	});

	function render(vnode, parent, merge) {
	  return diff(merge, vnode, {}, false, parent, false);
	}

	function createRef() {
		return {};
	}
	//# sourceMappingURL=preact.mjs.map

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */
	/* global Reflect, Promise */

	var extendStatics = function(d, b) {
	    extendStatics = Object.setPrototypeOf ||
	        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
	        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
	    return extendStatics(d, b);
	};

	function __extends(d, b) {
	    extendStatics(d, b);
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}

	var __assign = function() {
	    __assign = Object.assign || function __assign(t) {
	        for (var s, i = 1, n = arguments.length; i < n; i++) {
	            s = arguments[i];
	            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
	        }
	        return t;
	    };
	    return __assign.apply(this, arguments);
	};

	var PropTypes = {
	  checkPropTypes: function () {}
	};

	function createEmitter(initialValue, bitmaskFactory) {
	    var registeredUpdaters = [];
	    var value = initialValue;
	    var diff = function (newValue) { return bitmaskFactory(value, newValue) | 0; };
	    return {
	        register: function (updater) {
	            registeredUpdaters.push(updater);
	            updater(value, diff(value));
	        },
	        unregister: function (updater) {
	            registeredUpdaters = registeredUpdaters.filter(function (i) { return i !== updater; });
	        },
	        val: function (newValue) {
	            if (newValue === undefined || newValue == value) {
	                return value;
	            }
	            var bitmask = diff(newValue);
	            value = newValue;
	            registeredUpdaters.forEach(function (up) { return up(newValue, bitmask); });
	            return value;
	        }
	    };
	}
	var noopEmitter = {
	    register: function (_) {
	        console.warn("Consumer used without a Provider");
	    },
	    unregister: function (_) {
	        // do nothing
	    },
	    val: function (_) {
	        //do nothing;
	    }
	};

	/*
	 * Extracts the children from the props and returns an object containing the
	 * only element of the given array (preact always passes children as an array)
	 * or null otherwise. The result contains always a reference to the original
	 * array of children
	 *
	 * @param {RenderableProps<*>} props - the component's properties
	 * @return {{ child: JSX.Element | null, children: JSX.Element[]}}
	 */
	function getOnlyChildAndChildren(props) {
	    var children = props.children;
	    var child = children.length === 1 ? children[0] : null;
	    return { child: child, children: children };
	}

	var __extends$1 = (undefined && undefined.__extends) || (function () {
	    var extendStatics = function (d, b) {
	        extendStatics = Object.setPrototypeOf ||
	            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
	            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
	        return extendStatics(d, b);
	    };
	    return function (d, b) {
	        extendStatics(d, b);
	        function __() { this.constructor = d; }
	        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	    };
	})();
	function getRenderer(props) {
	    var child = getOnlyChildAndChildren(props).child;
	    // TODO: "render" in props check is only done to make TS happy
	    return child || ("render" in props && props.render);
	}
	var MAX_SIGNED_31_BIT_INT = 1073741823;
	var defaultBitmaskFactory = function () { return MAX_SIGNED_31_BIT_INT; };
	var ids = 0;
	function _createContext(value, bitmaskFactory) {
	    var key = "_preactContextProvider-" + ids++;
	    var Provider = /*#__PURE__*/ (function (_super) {
	        __extends$1(Provider, _super);
	        function Provider(props) {
	            var _this = _super.call(this, props) || this;
	            _this._emitter = createEmitter(props.value, bitmaskFactory || defaultBitmaskFactory);
	            return _this;
	        }
	        Provider.prototype.getChildContext = function () {
	            var _a;
	            return _a = {}, _a[key] = this._emitter, _a;
	        };
	        Provider.prototype.componentDidUpdate = function () {
	            this._emitter.val(this.props.value);
	        };
	        Provider.prototype.render = function () {
	            var _a = getOnlyChildAndChildren(this.props), child = _a.child, children = _a.children;
	            if (child) {
	                return child;
	            }
	            // preact does not support fragments,
	            // therefore we wrap the children in a span
	            return h("span", null, children);
	        };
	        return Provider;
	    }(Component));
	    var Consumer = /*#__PURE__*/ (function (_super) {
	        __extends$1(Consumer, _super);
	        function Consumer(props, ctx) {
	            var _this = _super.call(this, props, ctx) || this;
	            _this._updateContext = function (value, bitmask) {
	                var unstable_observedBits = _this.props.unstable_observedBits;
	                var observed = unstable_observedBits === undefined || unstable_observedBits === null
	                    ? MAX_SIGNED_31_BIT_INT
	                    : unstable_observedBits;
	                observed = observed | 0;
	                if ((observed & bitmask) === 0) {
	                    return;
	                }
	                _this.setState({ value: value });
	            };
	            _this.state = { value: _this._getEmitter().val() || value };
	            return _this;
	        }
	        Consumer.prototype.componentDidMount = function () {
	            this._getEmitter().register(this._updateContext);
	        };
	        Consumer.prototype.shouldComponentUpdate = function (nextProps, nextState) {
	            return (this.state.value !== nextState.value ||
	                getRenderer(this.props) !== getRenderer(nextProps));
	        };
	        Consumer.prototype.componentWillUnmount = function () {
	            this._getEmitter().unregister(this._updateContext);
	        };
	        Consumer.prototype.componentDidUpdate = function (_, __, prevCtx) {
	            var previousProvider = prevCtx[key];
	            if (previousProvider === this.context[key]) {
	                return;
	            }
	            (previousProvider || noopEmitter).unregister(this._updateContext);
	            this.componentDidMount();
	        };
	        Consumer.prototype.render = function () {
	            // TODO: "render" in props check is only done to make TS happy
	            var render = "render" in this.props && this.props.render;
	            var r = getRenderer(this.props);
	            if (render && render !== r) {
	                console.warn("Both children and a render function are defined. Children will be used");
	            }
	            if (typeof r === "function") {
	                return r(this.state.value);
	            }
	            console.warn("Consumer is expecting a function as one and only child but didn't find any");
	        };
	        Consumer.prototype._getEmitter = function () {
	            return this.context[key] || noopEmitter;
	        };
	        return Consumer;
	    }(Component));
	    return {
	        Provider: Provider,
	        Consumer: Consumer
	    };
	}
	var createContext = _createContext;

	var version = '15.1.0'; // trick libraries to think we are react

	var ELEMENTS = 'a abbr address area article aside audio b base bdi bdo big blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd keygen label legend li link main map mark menu menuitem meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script section select small source span strong style sub summary sup table tbody td textarea tfoot th thead time title tr track u ul var video wbr circle clipPath defs ellipse g image line linearGradient mask path pattern polygon polyline radialGradient rect stop svg text tspan'.split(
		' '
	);

	var REACT_ELEMENT_TYPE = (typeof Symbol !== 'undefined' && Symbol.for && Symbol.for('react.element')) || 0xeac7;

	var COMPONENT_WRAPPER_KEY =
		typeof Symbol !== 'undefined' && Symbol.for ? Symbol.for('__preactCompatWrapper') : '__preactCompatWrapper';

	// don't autobind these methods since they already have guaranteed context.
	var AUTOBIND_BLACKLIST = {
		constructor: 1,
		render: 1,
		shouldComponentUpdate: 1,
		componentWillReceiveProps: 1,
		componentWillUpdate: 1,
		componentDidUpdate: 1,
		componentWillMount: 1,
		componentDidMount: 1,
		componentWillUnmount: 1,
		componentDidUnmount: 1
	};

	var CAMEL_PROPS = /^(?:accent|alignment|arabic|baseline|cap|clip|color|fill|flood|font|glyph|horiz|marker|overline|paint|stop|strikethrough|stroke|text|underline|unicode|units|v|vector|vert|word|writing|x)[A-Z]/;

	var BYPASS_HOOK = {};

	/*global process*/
	var DEV = false;
	try {
		DEV = process.env.NODE_ENV !== 'production';
	}
	catch (e) { }

	// a component that renders nothing. Used to replace components for unmountComponentAtNode.
	function EmptyComponent() {
		return null;
	}

	// make react think we're react.
	var VNode$1 = h('a', null).constructor;
	VNode$1.prototype.$$typeof = REACT_ELEMENT_TYPE;
	VNode$1.prototype.preactCompatUpgraded = false;
	VNode$1.prototype.preactCompatNormalized = false;

	Object.defineProperty(VNode$1.prototype, 'type', {
		get: function() {
			return this.nodeName;
		},
		set: function(v) {
			this.nodeName = v;
		},
		configurable: true
	});

	Object.defineProperty(VNode$1.prototype, 'props', {
		get: function() {
			return this.attributes;
		},
		set: function(v) {
			this.attributes = v;
		},
		configurable: true
	});

	var oldEventHook = options.event;
	options.event = function (e) {
		if (oldEventHook) { e = oldEventHook(e); }
		e.persist = Object;
		e.nativeEvent = e;
		return e;
	};

	var oldVnodeHook = options.vnode;
	options.vnode = function (vnode) {
		if (!vnode.preactCompatUpgraded) {
			vnode.preactCompatUpgraded = true;

			var tag = vnode.nodeName,
				attrs = (vnode.attributes = vnode.attributes == null ? {} : extend$1({}, vnode.attributes));

			if (typeof tag === 'function') {
				if (tag[COMPONENT_WRAPPER_KEY] === true || (tag.prototype && 'isReactComponent' in tag.prototype)) {
					if (vnode.children && String(vnode.children) === '') { vnode.children = undefined; }
					if (vnode.children) { attrs.children = vnode.children; }

					if (!vnode.preactCompatNormalized) {
						normalizeVNode(vnode);
					}
					handleComponentVNode(vnode);
				}
			}
			else {
				if (vnode.children && String(vnode.children) === '') { vnode.children = undefined; }
				if (vnode.children) { attrs.children = vnode.children; }

				if (attrs.defaultValue) {
					if (!attrs.value && attrs.value !== 0) {
						attrs.value = attrs.defaultValue;
					}
					delete attrs.defaultValue;
				}

				handleElementVNode(vnode, attrs);
			}
		}

		if (oldVnodeHook) { oldVnodeHook(vnode); }
	};

	function handleComponentVNode(vnode) {
		var tag = vnode.nodeName,
			a = vnode.attributes;

		vnode.attributes = {};
		if (tag.defaultProps) { extend$1(vnode.attributes, tag.defaultProps); }
		if (a) { extend$1(vnode.attributes, a); }
	}

	function handleElementVNode(vnode, a) {
		var shouldSanitize, attrs, i;
		if (a) {
			for (i in a) { if ((shouldSanitize = CAMEL_PROPS.test(i))) { break; } }
			if (shouldSanitize) {
				attrs = vnode.attributes = {};
				for (i in a) {
					if (a.hasOwnProperty(i)) {
						attrs[CAMEL_PROPS.test(i) ? i.replace(/([A-Z0-9])/, '-$1').toLowerCase() : i] = a[i];
					}
				}
			}
		}
	}

	// proxy render() since React returns a Component reference.
	function render$1(vnode, parent, callback) {
		var prev = parent && parent._preactCompatRendered && parent._preactCompatRendered.base;

		// ignore impossible previous renders
		if (prev && prev.parentNode !== parent) { prev = null; }

		// default to first Element child
		if (!prev && parent) { prev = parent.firstElementChild; }

		// remove unaffected siblings
		for (var i = parent.childNodes.length; i--;) {
			if (parent.childNodes[i] !== prev) {
				parent.removeChild(parent.childNodes[i]);
			}
		}

		var out = render(vnode, parent, prev);
		if (parent) { parent._preactCompatRendered = out && (out._component || { base: out }); }
		if (typeof callback === 'function') { callback(); }
		return (out && out._component) || out;
	}

	var ContextProvider = function () {};

	ContextProvider.prototype.getChildContext = function () {
		return this.props.context;
	};
	ContextProvider.prototype.render = function (props) {
		return props.children[0];
	};

	function renderSubtreeIntoContainer(parentComponent, vnode, container, callback) {
		var wrap = h(ContextProvider, { context: parentComponent.context }, vnode);
		var renderContainer = render$1(wrap, container);
		var component = renderContainer._component || renderContainer.base;
		if (callback) { callback.call(component, renderContainer); }
		return component;
	}

	function Portal(props) {
		renderSubtreeIntoContainer(this, props.vnode, props.container);
	}

	function createPortal(vnode, container) {
		return h(Portal, { vnode: vnode, container: container });
	}

	function unmountComponentAtNode(container) {
		var existing = container._preactCompatRendered && container._preactCompatRendered.base;
		if (existing && existing.parentNode === container) {
			render(h(EmptyComponent), container, existing);
			return true;
		}
		return false;
	}

	var ARR = [];

	// This API is completely unnecessary for Preact, so it's basically passthrough.
	var Children = {
		map: function(children, fn, ctx) {
			if (children == null) { return null; }
			children = Children.toArray(children);
			if (ctx && ctx !== children) { fn = fn.bind(ctx); }
			return children.map(fn);
		},
		forEach: function(children, fn, ctx) {
			if (children == null) { return null; }
			children = Children.toArray(children);
			if (ctx && ctx !== children) { fn = fn.bind(ctx); }
			children.forEach(fn);
		},
		count: function(children) {
			return (children && children.length) || 0;
		},
		only: function(children) {
			children = Children.toArray(children);
			if (children.length !== 1) { throw new Error('Children.only() expects only one child.'); }
			return children[0];
		},
		toArray: function(children) {
			if (children == null) { return []; }
			return ARR.concat(children);
		}
	};

	/** Track current render() component for ref assignment */
	var currentComponent;

	function createFactory(type) {
		return createElement.bind(null, type);
	}

	var DOM = {};
	for (var i = ELEMENTS.length; i--;) {
		DOM[ELEMENTS[i]] = createFactory(ELEMENTS[i]);
	}

	function upgradeToVNodes(arr, offset) {
		for (var i = offset || 0; i < arr.length; i++) {
			var obj = arr[i];
			if (Array.isArray(obj)) {
				upgradeToVNodes(obj);
			}
			else if (
				obj &&
				typeof obj === 'object' &&
				!isValidElement(obj) &&
				((obj.props && obj.type) || (obj.attributes && obj.nodeName) || obj.children)
			) {
				arr[i] = createElement(obj.type || obj.nodeName, obj.props || obj.attributes, obj.children);
			}
		}
	}

	function isStatelessComponent(c) {
		return typeof c === 'function' && !(c.prototype && c.prototype.render);
	}

	// wraps stateless functional components in a PropTypes validator
	function wrapStatelessComponent(WrappedComponent) {
		return createClass({
			displayName: WrappedComponent.displayName || WrappedComponent.name,
			render: function() {
				return WrappedComponent(this.props, this.context);
			}
		});
	}

	function statelessComponentHook(Ctor) {
		var Wrapped = Ctor[COMPONENT_WRAPPER_KEY];
		if (Wrapped) { return Wrapped === true ? Ctor : Wrapped; }

		Wrapped = wrapStatelessComponent(Ctor);

		Object.defineProperty(Wrapped, COMPONENT_WRAPPER_KEY, { configurable: true, value: true });
		Wrapped.displayName = Ctor.displayName;
		Wrapped.propTypes = Ctor.propTypes;
		Wrapped.defaultProps = Ctor.defaultProps;

		Object.defineProperty(Ctor, COMPONENT_WRAPPER_KEY, { configurable: true, value: Wrapped });

		return Wrapped;
	}

	function createElement() {
		var args = [], len = arguments.length;
		while ( len-- ) args[ len ] = arguments[ len ];

		upgradeToVNodes(args, 2);
		return normalizeVNode(h.apply(void 0, args));
	}

	function normalizeVNode(vnode) {
		vnode.preactCompatNormalized = true;

		applyClassName(vnode);

		if (isStatelessComponent(vnode.nodeName)) {
			vnode.nodeName = statelessComponentHook(vnode.nodeName);
		}

		var ref = vnode.attributes.ref,
			type = ref && typeof ref;
		if (currentComponent && (type === 'string' || type === 'number')) {
			vnode.attributes.ref = createStringRefProxy(ref, currentComponent);
		}

		applyEventNormalization(vnode);

		return vnode;
	}

	function cloneElement$1(element, props) {
		var children = [], len = arguments.length - 2;
		while ( len-- > 0 ) children[ len ] = arguments[ len + 2 ];

		if (!isValidElement(element)) { return element; }
		var elementProps = element.attributes || element.props;
		var node = h(
			element.nodeName || element.type,
			extend$1({}, elementProps),
			element.children || (elementProps && elementProps.children)
		);
		// Only provide the 3rd argument if needed.
		// Arguments 3+ overwrite element.children in preactCloneElement
		var cloneArgs = [node, props];
		if (children && children.length) {
			cloneArgs.push(children);
		}
		else if (props && props.children) {
			cloneArgs.push(props.children);
		}
		return normalizeVNode(cloneElement.apply(void 0, cloneArgs));
	}

	function isValidElement(element) {
		return element && (element instanceof VNode$1 || element.$$typeof === REACT_ELEMENT_TYPE);
	}

	function createStringRefProxy(name, component) {
		return (
			component._refProxies[name] ||
			(component._refProxies[name] = function (resolved) {
				if (component && component.refs) {
					component.refs[name] = resolved;
					if (resolved === null) {
						delete component._refProxies[name];
						component = null;
					}
				}
			})
		);
	}

	function applyEventNormalization(ref) {
		var nodeName = ref.nodeName;
		var attributes = ref.attributes;

		if (!attributes || typeof nodeName !== 'string') { return; }
		var props = {};
		for (var i in attributes) {
			props[i.toLowerCase()] = i;
		}
		if (props.ondoubleclick) {
			attributes.ondblclick = attributes[props.ondoubleclick];
			delete attributes[props.ondoubleclick];
		}
		// for *textual inputs* (incl textarea), normalize `onChange` -> `onInput`:
		if (
			props.onchange &&
			(nodeName === 'textarea' || (nodeName.toLowerCase() === 'input' && !/^fil|che|rad/i.test(attributes.type)))
		) {
			var normalized = props.oninput || 'oninput';
			if (!attributes[normalized]) {
				attributes[normalized] = multihook([attributes[normalized], attributes[props.onchange]]);
				delete attributes[props.onchange];
			}
		}
	}

	function applyClassName(vnode) {
		var a = vnode.attributes || (vnode.attributes = {});
		classNameDescriptor.enumerable = 'className' in a;
		if (a.className) { a.class = a.className; }
		Object.defineProperty(a, 'className', classNameDescriptor);
	}

	var classNameDescriptor = {
		configurable: true,
		get: function() {
			return this.class;
		},
		set: function(v) {
			this.class = v;
		}
	};

	function extend$1(base, props) {
		var arguments$1 = arguments;

		for (var i = 1, obj = (void 0); i < arguments.length; i++) {
			if ((obj = arguments$1[i])) {
				for (var key in obj) {
					if (obj.hasOwnProperty(key)) {
						base[key] = obj[key];
					}
				}
			}
		}
		return base;
	}

	function shallowDiffers(a, b) {
		for (var i in a) { if (!(i in b)) { return true; } }
		for (var i$1 in b) { if (a[i$1] !== b[i$1]) { return true; } }
		return false;
	}

	function findDOMNode(component) {
		return (component && (component.base || (component.nodeType === 1 && component))) || null;
	}

	function F() { }

	function createClass(obj) {
		function cl(props, context) {
			bindAll(this);
			Component$1.call(this, props, context, BYPASS_HOOK);
			newComponentHook.call(this, props, context);
		}

		obj = extend$1({ constructor: cl }, obj);

		// We need to apply mixins here so that getDefaultProps is correctly mixed
		if (obj.mixins) {
			applyMixins(obj, collateMixins(obj.mixins));
		}
		if (obj.statics) {
			extend$1(cl, obj.statics);
		}
		if (obj.propTypes) {
			cl.propTypes = obj.propTypes;
		}
		if (obj.defaultProps) {
			cl.defaultProps = obj.defaultProps;
		}
		if (obj.getDefaultProps) {
			cl.defaultProps = obj.getDefaultProps.call(cl);
		}

		F.prototype = Component$1.prototype;
		cl.prototype = extend$1(new F(), obj);

		cl.displayName = obj.displayName || 'Component';

		return cl;
	}

	// Flatten an Array of mixins to a map of method name to mixin implementations
	function collateMixins(mixins) {
		var keyed = {};
		for (var i = 0; i < mixins.length; i++) {
			var mixin = mixins[i];
			for (var key in mixin) {
				if (mixin.hasOwnProperty(key) && typeof mixin[key] === 'function') {
					(keyed[key] || (keyed[key] = [])).push(mixin[key]);
				}
			}
		}
		return keyed;
	}

	// apply a mapping of Arrays of mixin methods to a component prototype
	function applyMixins(proto, mixins) {
		for (var key in mixins)
			{ if (mixins.hasOwnProperty(key)) {
				proto[key] = multihook(
					mixins[key].concat(proto[key] || ARR),
					key === 'getDefaultProps' || key === 'getInitialState' || key === 'getChildContext'
				);
			} }
	}

	function bindAll(ctx) {
		for (var i in ctx) {
			var v = ctx[i];
			if (typeof v === 'function' && !v.__bound && !AUTOBIND_BLACKLIST.hasOwnProperty(i)) {
				(ctx[i] = v.bind(ctx)).__bound = true;
			}
		}
	}

	function callMethod(ctx, m, args) {
		if (typeof m === 'string') {
			m = ctx.constructor.prototype[m];
		}
		if (typeof m === 'function') {
			return m.apply(ctx, args);
		}
	}

	function multihook(hooks, skipDuplicates) {
		return function () {
			var arguments$1 = arguments;
			var this$1 = this;

			var ret;
			for (var i = 0; i < hooks.length; i++) {
				var r = callMethod(this$1, hooks[i], arguments$1);

				if (skipDuplicates && r != null) {
					if (!ret) { ret = {}; }
					for (var key in r)
						{ if (r.hasOwnProperty(key)) {
							ret[key] = r[key];
						} }
				}
				else if (typeof r !== 'undefined') { ret = r; }
			}
			return ret;
		};
	}

	function newComponentHook(props, context) {
		propsHook.call(this, props, context);
		this.componentWillReceiveProps = multihook([
			propsHook,
			this.componentWillReceiveProps || 'componentWillReceiveProps'
		]);
		this.render = multihook([propsHook, beforeRender, this.render || 'render', afterRender]);
	}

	function propsHook(props, context) {
		if (!props) { return; }

		// React annoyingly special-cases single children, and some react components are ridiculously strict about this.
		var c = props.children;
		if (
			c &&
			Array.isArray(c) &&
			c.length === 1 &&
			(typeof c[0] === 'string' || typeof c[0] === 'function' || c[0] instanceof VNode$1)
		) {
			props.children = c[0];

			// but its totally still going to be an Array.
			if (props.children && typeof props.children === 'object') {
				props.children.length = 1;
				props.children[0] = props.children;
			}
		}

		// add proptype checking
		if (DEV) {
			var ctor = typeof this === 'function' ? this : this.constructor,
				propTypes = this.propTypes || ctor.propTypes;
			var displayName = this.displayName || ctor.name;
		}
	}

	function beforeRender(props) {
		currentComponent = this;
	}

	function afterRender() {
		if (currentComponent === this) {
			currentComponent = null;
		}
	}

	function Component$1(props, context, opts) {
		Component.call(this, props, context);
		this.state = this.getInitialState ? this.getInitialState() : {};
		this.refs = {};
		this._refProxies = {};
		if (opts !== BYPASS_HOOK) {
			newComponentHook.call(this, props, context);
		}
	}
	extend$1((Component$1.prototype = new Component()), {
		constructor: Component$1,

		isReactComponent: {},

		replaceState: function(state, callback) {
			var this$1 = this;

			this.setState(state, callback);
			for (var i in this$1.state) {
				if (!(i in state)) {
					delete this$1.state[i];
				}
			}
		},

		getDOMNode: function() {
			return this.base;
		},

		isMounted: function() {
			return !!this.base;
		}
	});

	function PureComponent(props, context) {
		Component$1.call(this, props, context);
	}
	F.prototype = Component$1.prototype;
	PureComponent.prototype = new F();
	PureComponent.prototype.isPureReactComponent = true;
	PureComponent.prototype.shouldComponentUpdate = function (props, state) {
		return shallowDiffers(this.props, props) || shallowDiffers(this.state, state);
	};

	function unstable_batchedUpdates(callback) {
		callback();
	}

	var index = {
		version: version,
		DOM: DOM,
		PropTypes: PropTypes,
		Children: Children,
		render: render$1,
		hydrate: render$1,
		createClass: createClass,
		createContext: createContext,
		createPortal: createPortal,
		createFactory: createFactory,
		createElement: createElement,
		cloneElement: cloneElement$1,
		createRef: createRef,
		isValidElement: isValidElement,
		findDOMNode: findDOMNode,
		unmountComponentAtNode: unmountComponentAtNode,
		Component: Component$1,
		PureComponent: PureComponent,
		unstable_renderSubtreeIntoContainer: renderSubtreeIntoContainer,
		unstable_batchedUpdates: unstable_batchedUpdates,
		__spread: extend$1
	};
	//# sourceMappingURL=preact-compat.es.js.map

	/*
	Copyright (c) 2019 Daybrush
	name: framework-utils
	license: MIT
	author: Daybrush
	repository: git+https://github.com/daybrush/framework-utils.git
	version: 0.2.1
	*/
	function prefixNames(prefix) {
	  var classNames = [];

	  for (var _i = 1; _i < arguments.length; _i++) {
	    classNames[_i - 1] = arguments[_i];
	  }

	  return classNames.map(function (className) {
	    return className.split(" ").map(function (name) {
	      return name ? "" + prefix + name : "";
	    }).join(" ");
	  }).join(" ");
	}
	function prefixCSS(prefix, css) {
	  return css.replace(/\.([^{,\s\d.]+)/g, "." + prefix + "$1");
	}
	/* react */

	function ref(target, name) {
	  return function (e) {
	    e && (target[name] = e);
	  };
	}
	function refs(target, name, i) {
	  return function (e) {
	    e && (target[name][i] = e);
	  };
	}
	//# sourceMappingURL=utils.esm.js.map

	/*
	Copyright (c) 2018 Daybrush
	@name: @daybrush/utils
	license: MIT
	author: Daybrush
	repository: https://github.com/daybrush/utils
	@version 0.10.0
	*/
	/**
	* @namespace
	* @name Consts
	*/

	/**
	* get string "rgb"
	* @memberof Color
	* @example
	import {RGB} from "@daybrush/utils";

	console.log(RGB); // "rgb"
	*/
	var RGB = "rgb";
	/**
	* get string "rgba"
	* @memberof Color
	* @example
	import {RGBA} from "@daybrush/utils";

	console.log(RGBA); // "rgba"
	*/

	var RGBA = "rgba";
	/**
	* get string "hsl"
	* @memberof Color
	* @example
	import {HSL} from "@daybrush/utils";

	console.log(HSL); // "hsl"
	*/

	var HSL = "hsl";
	/**
	* get string "hsla"
	* @memberof Color
	* @example
	import {HSLA} from "@daybrush/utils";

	console.log(HSLA); // "hsla"
	*/

	var HSLA = "hsla";
	/**
	* gets an array of color models.
	* @memberof Color
	* @example
	import {COLOR_MODELS} from "@daybrush/utils";

	console.log(COLOR_MODELS); // ["rgb", "rgba", "hsl", "hsla"];
	*/

	var COLOR_MODELS = [RGB, RGBA, HSL, HSLA];
	/**
	* get string "function"
	* @memberof Consts
	* @example
	import {FUNCTION} from "@daybrush/utils";

	console.log(FUNCTION); // "function"
	*/

	var FUNCTION = "function";
	/**
	* get string "property"
	* @memberof Consts
	* @example
	import {PROPERTY} from "@daybrush/utils";

	console.log(PROPERTY); // "property"
	*/

	var PROPERTY = "property";
	/**
	* get string "array"
	* @memberof Consts
	* @example
	import {ARRAY} from "@daybrush/utils";

	console.log(ARRAY); // "array"
	*/

	var ARRAY = "array";
	/**
	* get string "object"
	* @memberof Consts
	* @example
	import {OBJECT} from "@daybrush/utils";

	console.log(OBJECT); // "object"
	*/

	var OBJECT = "object";
	/**
	* get string "string"
	* @memberof Consts
	* @example
	import {STRING} from "@daybrush/utils";

	console.log(STRING); // "string"
	*/

	var STRING = "string";
	/**
	* get string "number"
	* @memberof Consts
	* @example
	import {NUMBER} from "@daybrush/utils";

	console.log(NUMBER); // "number"
	*/

	var NUMBER = "number";
	/**
	* get string "undefined"
	* @memberof Consts
	* @example
	import {UNDEFINED} from "@daybrush/utils";

	console.log(UNDEFINED); // "undefined"
	*/

	var UNDEFINED = "undefined";
	/**
	* Check whether the environment is window or node.js.
	* @memberof Consts
	* @example
	import {IS_WINDOW} from "@daybrush/utils";

	console.log(IS_WINDOW); // false in node.js
	console.log(IS_WINDOW); // true in browser
	*/

	var IS_WINDOW = typeof window !== UNDEFINED;
	/**
	* Check whether the environment is window or node.js.
	* @memberof Consts
	* @name document
	* @example
	import {IS_WINDOW} from "@daybrush/utils";

	console.log(IS_WINDOW); // false in node.js
	console.log(IS_WINDOW); // true in browser
	*/

	var doc = typeof document !== UNDEFINED && document;
	var prefixes = ["webkit", "ms", "moz", "o"];
	/**
	 * @namespace CrossBrowser
	 */

	/**
	* Get a CSS property with a vendor prefix that supports cross browser.
	* @function
	* @param {string} property - A CSS property
	* @return {string} CSS property with cross-browser vendor prefix
	* @memberof CrossBrowser
	* @example
	import {getCrossBrowserProperty} from "@daybrush/utils";

	console.log(getCrossBrowserProperty("transform")); // "transform", "-ms-transform", "-webkit-transform"
	console.log(getCrossBrowserProperty("filter")); // "filter", "-webkit-filter"
	*/

	var getCrossBrowserProperty =
	/*#__PURE__*/
	function (property) {
	  if (!doc) {
	    return "";
	  }

	  var styles = (doc.body || doc.documentElement).style;
	  var length = prefixes.length;

	  if (typeof styles[property] !== UNDEFINED) {
	    return property;
	  }

	  for (var i = 0; i < length; ++i) {
	    var name = "-" + prefixes[i] + "-" + property;

	    if (typeof styles[name] !== UNDEFINED) {
	      return name;
	    }
	  }

	  return "";
	};
	/**
	* get string "transfrom" with the vendor prefix.
	* @memberof CrossBrowser
	* @example
	import {TRANSFORM} from "@daybrush/utils";

	console.log(TRANSFORM); // "transform", "-ms-transform", "-webkit-transform"
	*/

	var TRANSFORM =
	/*#__PURE__*/
	getCrossBrowserProperty("transform");
	/**
	* get string "filter" with the vendor prefix.
	* @memberof CrossBrowser
	* @example
	import {FILTER} from "@daybrush/utils";

	console.log(FILTER); // "filter", "-ms-filter", "-webkit-filter"
	*/

	var FILTER =
	/*#__PURE__*/
	getCrossBrowserProperty("filter");
	/**
	* get string "animation" with the vendor prefix.
	* @memberof CrossBrowser
	* @example
	import {ANIMATION} from "@daybrush/utils";

	console.log(ANIMATION); // "animation", "-ms-animation", "-webkit-animation"
	*/

	var ANIMATION =
	/*#__PURE__*/
	getCrossBrowserProperty("animation");
	/**
	* get string "keyframes" with the vendor prefix.
	* @memberof CrossBrowser
	* @example
	import {KEYFRAMES} from "@daybrush/utils";

	console.log(KEYFRAMES); // "keyframes", "-ms-keyframes", "-webkit-keyframes"
	*/

	var KEYFRAMES =
	/*#__PURE__*/
	ANIMATION.replace("animation", "keyframes");

	/**
	* @namespace
	* @name Utils
	*/

	/**
	 * Returns the inner product of two numbers(`a1`, `a2`) by two criteria(`b1`, `b2`).
	 * @memberof Utils
	 * @param - The first number
	 * @param - The second number
	 * @param - The first number to base on the inner product
	 * @param - The second number to base on the inner product
	 * @return - Returns the inner product
	import { dot } from "@daybrush/utils";

	console.log(dot(0, 15, 2, 3)); // 6
	console.log(dot(5, 15, 2, 3)); // 9
	console.log(dot(5, 15, 1, 1)); // 10
	 */

	function dot(a1, a2, b1, b2) {
	  return (a1 * b2 + a2 * b1) / (b1 + b2);
	}
	/**
	* Check the type that the value is undefined.
	* @memberof Utils
	* @param {string} value - Value to check the type
	* @return {boolean} true if the type is correct, false otherwise
	* @example
	import {isUndefined} from "@daybrush/utils";

	console.log(isUndefined(undefined)); // true
	console.log(isUndefined("")); // false
	console.log(isUndefined(1)); // false
	console.log(isUndefined(null)); // false
	*/

	function isUndefined(value) {
	  return typeof value === UNDEFINED;
	}
	/**
	* Check the type that the value is object.
	* @memberof Utils
	* @param {string} value - Value to check the type
	* @return {} true if the type is correct, false otherwise
	* @example
	import {isObject} from "@daybrush/utils";

	console.log(isObject({})); // true
	console.log(isObject(undefined)); // false
	console.log(isObject("")); // false
	console.log(isObject(null)); // false
	*/

	function isObject(value) {
	  return value && typeof value === OBJECT;
	}
	/**
	* Check the type that the value is isArray.
	* @memberof Utils
	* @param {string} value - Value to check the type
	* @return {} true if the type is correct, false otherwise
	* @example
	import {isArray} from "@daybrush/utils";

	console.log(isArray([])); // true
	console.log(isArray({})); // false
	console.log(isArray(undefined)); // false
	console.log(isArray(null)); // false
	*/

	function isArray(value) {
	  return Array.isArray(value);
	}
	/**
	* Check the type that the value is string.
	* @memberof Utils
	* @param {string} value - Value to check the type
	* @return {} true if the type is correct, false otherwise
	* @example
	import {isString} from "@daybrush/utils";

	console.log(isString("1234")); // true
	console.log(isString(undefined)); // false
	console.log(isString(1)); // false
	console.log(isString(null)); // false
	*/

	function isString(value) {
	  return typeof value === STRING;
	}
	/**
	* Check the type that the value is function.
	* @memberof Utils
	* @param {string} value - Value to check the type
	* @return {} true if the type is correct, false otherwise
	* @example
	import {isFunction} from "@daybrush/utils";

	console.log(isFunction(function a() {})); // true
	console.log(isFunction(() => {})); // true
	console.log(isFunction("1234")); // false
	console.log(isFunction(1)); // false
	console.log(isFunction(null)); // false
	*/

	function isFunction(value) {
	  return typeof value === FUNCTION;
	}
	/**
	* divide text by space.
	* @memberof Utils
	* @param {string} text - text to divide
	* @return {Array} divided texts
	* @example
	import {spliceSpace} from "@daybrush/utils";

	console.log(splitSpace("a b c d e f g"));
	// ["a", "b", "c", "d", "e", "f", "g"]
	console.log(splitSpace("'a,b' c 'd,e' f g"));
	// ["'a,b'", "c", "'d,e'", "f", "g"]
	*/

	function splitSpace(text) {
	  // divide comma(,)
	  var matches = text.match(/("[^"]*")|('[^']*')|([^\s()]*(?:\((?:[^()]*|\([^()]*\))*\))[^\s()]*)|\S+/g);
	  return matches || [];
	}
	/**
	* divide text by comma.
	* @memberof Utils
	* @param {string} text - text to divide
	* @return {Array} divided texts
	* @example
	import {splitComma} from "@daybrush/utils";

	console.log(splitComma("a,b,c,d,e,f,g"));
	// ["a", "b", "c", "d", "e", "f", "g"]
	console.log(splitComma("'a,b',c,'d,e',f,g"));
	// ["'a,b'", "c", "'d,e'", "f", "g"]
	*/

	function splitComma(text) {
	  // divide comma(,)
	  // "[^"]*"|'[^']*'
	  var matches = text.match(/("[^"]*"|'[^']*'|[^,\s()]*\((?:[^()]*|\([^()]*\))*\)[^,\s()]*|[^,])+/g);
	  return matches ? matches.map(function (str) {
	    return str.trim();
	  }) : [];
	}
	/**
	* divide text by bracket "(", ")".
	* @memberof Utils
	* @param {string} text - text to divide
	* @return {object} divided texts
	* @example
	import {splitBracket} from "@daybrush/utils";

	console.log(splitBracket("a(1, 2)"));
	// {prefix: "a", value: "1, 2", suffix: ""}
	console.log(splitBracket("a(1, 2)b"));
	// {prefix: "a", value: "1, 2", suffix: "b"}
	*/

	function splitBracket(text) {
	  var matches = /([^(]*)\(([\s\S]*)\)([\s\S]*)/g.exec(text);

	  if (!matches || matches.length < 4) {
	    return {};
	  } else {
	    return {
	      prefix: matches[1],
	      value: matches[2],
	      suffix: matches[3]
	    };
	  }
	}
	/**
	* divide text by number and unit.
	* @memberof Utils
	* @param {string} text - text to divide
	* @return {} divided texts
	* @example
	import {splitUnit} from "@daybrush/utils";

	console.log(splitUnit("10px"));
	// {prefix: "", value: 10, unit: "px"}
	console.log(splitUnit("-10px"));
	// {prefix: "", value: -10, unit: "px"}
	console.log(splitUnit("a10%"));
	// {prefix: "a", value: 10, unit: "%"}
	*/

	function splitUnit(text) {
	  var matches = /^([^\d|e|\-|\+]*)((?:\d|\.|-|e-|e\+)+)(\S*)$/g.exec(text);

	  if (!matches) {
	    return {
	      prefix: "",
	      unit: "",
	      value: NaN
	    };
	  }

	  var prefix = matches[1];
	  var value = matches[2];
	  var unit = matches[3];
	  return {
	    prefix: prefix,
	    unit: unit,
	    value: parseFloat(value)
	  };
	}
	/**
	* transform strings to camel-case
	* @memberof Utils
	* @param {String} text - string
	* @return {String} camel-case string
	* @example
	import {camelize} from "@daybrush/utils";

	console.log(camelize("transform-origin")); // transformOrigin
	console.log(camelize("abcd_efg")); // abcdEfg
	console.log(camelize("abcd efg")); // abcdEfg
	*/

	function camelize(str) {
	  return str.replace(/[\s-_]([a-z])/g, function (all, letter) {
	    return letter.toUpperCase();
	  });
	}
	/**
	* transform a camelized string into a lowercased string.
	* @memberof Utils
	* @param {string} text - a camel-cased string
	* @param {string} [separator="-"] - a separator
	* @return {string}  a lowercased string
	* @example
	import {decamelize} from "@daybrush/utils";

	console.log(decamelize("transformOrigin")); // transform-origin
	console.log(decamelize("abcdEfg", "_")); // abcd_efg
	*/

	function decamelize(str, separator) {
	  if (separator === void 0) {
	    separator = "-";
	  }

	  return str.replace(/([a-z])([A-Z])/g, function (all, letter, letter2) {
	    return "" + letter + separator + letter2.toLowerCase();
	  });
	}
	/**
	* transforms something in an array into an array.
	* @memberof Utils
	* @param - Array form
	* @return an array
	* @example
	import {toArray} from "@daybrush/utils";

	const arr1 = toArray(document.querySelectorAll(".a")); // Element[]
	const arr2 = toArray(document.querySelectorAll<HTMLElement>(".a")); // HTMLElement[]
	*/

	function toArray(value) {
	  return [].slice.call(value);
	}
	/**
	* Date.now() method
	* @memberof CrossBrowser
	* @return {number} milliseconds
	* @example
	import {now} from "@daybrush/utils";

	console.log(now()); // 12121324241(milliseconds)
	*/

	function now() {
	  return Date.now ? Date.now() : new Date().getTime();
	}
	/**
	* Returns the index of the first element in the array that satisfies the provided testing function.
	* @function
	* @memberof CrossBrowser
	* @param - The array `findIndex` was called upon.
	* @param - A function to execute on each value in the array until the function returns true, indicating that the satisfying element was found.
	* @param - Returns defaultIndex if not found by the function.
	* @example
	import { findIndex } from "@daybrush/utils";

	findIndex([{a: 1}, {a: 2}, {a: 3}, {a: 4}], ({ a }) => a === 2); // 1
	*/

	function findIndex(arr, callback, defaultIndex) {
	  if (defaultIndex === void 0) {
	    defaultIndex = -1;
	  }

	  var length = arr.length;

	  for (var i = 0; i < length; ++i) {
	    if (callback(arr[i], i, arr)) {
	      return i;
	    }
	  }

	  return defaultIndex;
	}
	/**
	* Returns the value of the first element in the array that satisfies the provided testing function.
	* @function
	* @memberof CrossBrowser
	* @param - The array `find` was called upon.
	* @param - A function to execute on each value in the array,
	* @param - Returns defalutValue if not found by the function.
	* @example
	import { find } from "@daybrush/utils";

	find([{a: 1}, {a: 2}, {a: 3}, {a: 4}], ({ a }) => a === 2); // {a: 2}
	*/

	function find(arr, callback, defalutValue) {
	  var index = findIndex(arr, callback);
	  return index > -1 ? arr[index] : defalutValue;
	}
	/**
	* window.requestAnimationFrame() method with cross browser.
	* @function
	* @memberof CrossBrowser
	* @param {FrameRequestCallback} callback - The function to call when it's time to update your animation for the next repaint.
	* @return {number} id
	* @example
	import {requestAnimationFrame} from "@daybrush/utils";

	requestAnimationFrame((timestamp) => {
	  console.log(timestamp);
	});
	*/

	var requestAnimationFrame =
	/*#__PURE__*/
	function () {
	  var firstTime = now();
	  var raf = IS_WINDOW && (window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame);
	  return raf ? raf.bind(window) : function (callback) {
	    var currTime = now();
	    var id = window.setTimeout(function () {
	      callback(currTime - firstTime);
	    }, 1000 / 60);
	    return id;
	  };
	}();
	/**
	* window.cancelAnimationFrame() method with cross browser.
	* @function
	* @memberof CrossBrowser
	* @param {number} handle - the id obtained through requestAnimationFrame method
	* @return {void}
	* @example
	import { requestAnimationFrame, cancelAnimationFrame } from "@daybrush/utils";

	const id = requestAnimationFrame((timestamp) => {
	  console.log(timestamp);
	});

	cancelAnimationFrame(id);
	*/

	var cancelAnimationFrame =
	/*#__PURE__*/
	function () {
	  var caf = IS_WINDOW && (window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.msCancelAnimationFrame);
	  return caf ? caf.bind(window) : function (handle) {
	    clearTimeout(handle);
	  };
	}();

	/**
	* @namespace
	* @name Color
	*/

	/**
	* Remove the # from the hex color.
	* @memberof Color
	* @param {} hex - hex color
	* @return {} hex color
	* @example
	import {cutHex} from "@daybrush/utils";

	console.log(cutHex("#000000")) // "000000"
	*/

	function cutHex(hex) {
	  return hex.replace("#", "");
	}
	/**
	* convert hex color to rgb color.
	* @memberof Color
	* @param {} hex - hex color
	* @return {} rgb color
	* @example
	import {hexToRGBA} from "@daybrush/utils";

	console.log(hexToRGBA("#00000005"));
	// [0, 0, 0, 1]
	console.log(hexToRGBA("#201045"));
	// [32, 16, 69, 1]
	*/

	function hexToRGBA(hex) {
	  var h = cutHex(hex);
	  var r = parseInt(h.substring(0, 2), 16);
	  var g = parseInt(h.substring(2, 4), 16);
	  var b = parseInt(h.substring(4, 6), 16);
	  var a = parseInt(h.substring(6, 8), 16) / 255;

	  if (isNaN(a)) {
	    a = 1;
	  }

	  return [r, g, b, a];
	}
	/**
	* convert 3(or 4)-digit hex color to 6(or 8)-digit hex color.
	* @memberof Color
	* @param {} hex - 3(or 4)-digit hex color
	* @return {} 6(or 8)-digit hex color
	* @example
	import {toFullHex} from "@daybrush/utils";

	console.log(toFullHex("#123")); // "#112233"
	console.log(toFullHex("#123a")); // "#112233aa"
	*/

	function toFullHex(h) {
	  var r = h.charAt(1);
	  var g = h.charAt(2);
	  var b = h.charAt(3);
	  var a = h.charAt(4);
	  var arr = ["#", r, r, g, g, b, b, a, a];
	  return arr.join("");
	}
	/**
	* convert hsl color to rgba color.
	* @memberof Color
	* @param {} hsl - hsl color(hue: 0 ~ 360, saturation: 0 ~ 1, lightness: 0 ~ 1, alpha: 0 ~ 1)
	* @return {} rgba color
	* @example
	import {hslToRGBA} from "@daybrush/utils";

	console.log(hslToRGBA([150, 0.5, 0.4]));
	// [51, 153, 102, 1]
	*/

	function hslToRGBA(hsl) {
	  var h = hsl[0];
	  var s = hsl[1];
	  var l = hsl[2];

	  if (h < 0) {
	    h += Math.floor((Math.abs(h) + 360) / 360) * 360;
	  }

	  h %= 360;
	  var c = (1 - Math.abs(2 * l - 1)) * s;
	  var x = c * (1 - Math.abs(h / 60 % 2 - 1));
	  var m = l - c / 2;
	  var rgb;

	  if (h < 60) {
	    rgb = [c, x, 0];
	  } else if (h < 120) {
	    rgb = [x, c, 0];
	  } else if (h < 180) {
	    rgb = [0, c, x];
	  } else if (h < 240) {
	    rgb = [0, x, c];
	  } else if (h < 300) {
	    rgb = [x, 0, c];
	  } else if (h < 360) {
	    rgb = [c, 0, x];
	  }

	  var result = [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255), hsl.length > 3 ? hsl[3] : 1];
	  return result;
	}
	/**
	* convert string to rgba color.
	* @memberof Color
	* @param {} - 3-hex(#000), 4-hex(#0000) 6-hex(#000000), 8-hex(#00000000) or RGB(A), or HSL(A)
	* @return {} rgba color
	* @example
	import {stringToRGBA} from "@daybrush/utils";

	console.log(stringToRGBA("#000000")); // [0, 0, 0, 1]
	console.log(stringToRGBA("rgb(100, 100, 100)")); // [100, 100, 100, 1]
	console.log(stringToRGBA("hsl(150, 0.5, 0.4)")); // [51, 153, 102, 1]
	*/

	function stringToRGBA(color) {
	  if (color.charAt(0) === "#") {
	    if (color.length === 4 || color.length === 5) {
	      return hexToRGBA(toFullHex(color));
	    } else {
	      return hexToRGBA(color);
	    }
	  } else if (color.indexOf("(") !== -1) {
	    // in bracket.
	    var _a = splitBracket(color),
	        prefix = _a.prefix,
	        value = _a.value;

	    if (!prefix || !value) {
	      return;
	    }

	    var arr = splitComma(value);
	    var colorArr = [];
	    var length = arr.length;

	    switch (prefix) {
	      case RGB:
	      case RGBA:
	        for (var i = 0; i < length; ++i) {
	          colorArr[i] = parseFloat(arr[i]);
	        }

	        return colorArr;

	      case HSL:
	      case HSLA:
	        for (var i = 0; i < length; ++i) {
	          if (arr[i].indexOf("%") !== -1) {
	            colorArr[i] = parseFloat(arr[i]) / 100;
	          } else {
	            colorArr[i] = parseFloat(arr[i]);
	          }
	        } // hsl, hsla to rgba


	        return hslToRGBA(colorArr);
	    }
	  }

	  return;
	}

	/**
	 * Returns all element descendants of node that
	 * match selectors.
	 */

	/**
	 * Checks if the specified class value exists in the element's class attribute.
	 * @memberof DOM
	 * @param - A DOMString containing one or more selectors to match
	 * @param - If multi is true, a DOMString containing one or more selectors to match against.
	 * @example
	import {$} from "@daybrush/utils";

	console.log($("div")); // div element
	console.log($("div", true)); // [div, div] elements
	*/

	function $(selectors, multi) {
	  return multi ? doc.querySelectorAll(selectors) : doc.querySelector(selectors);
	}
	/**
	* Checks if the specified class value exists in the element's class attribute.
	* @memberof DOM
	* @param element - target
	* @param className - the class name to search
	* @return {boolean} return false if the class is not found.
	* @example
	import {hasClass} from "@daybrush/utils";

	console.log(hasClass(element, "start")); // true or false
	*/

	function hasClass(element, className) {
	  if (element.classList) {
	    return element.classList.contains(className);
	  }

	  return !!element.className.match(new RegExp("(\\s|^)" + className + "(\\s|$)"));
	}
	/**
	* Add the specified class value. If these classe already exist in the element's class attribute they are ignored.
	* @memberof DOM
	* @param element - target
	* @param className - the class name to add
	* @example
	import {addClass} from "@daybrush/utils";

	addClass(element, "start");
	*/

	function addClass(element, className) {
	  if (element.classList) {
	    element.classList.add(className);
	  } else {
	    element.className += " " + className;
	  }
	}
	/**
	* Removes the specified class value.
	* @memberof DOM
	* @param element - target
	* @param className - the class name to remove
	* @example
	import {removeClass} from "@daybrush/utils";

	removeClass(element, "start");
	*/

	function removeClass(element, className) {
	  if (element.classList) {
	    element.classList.remove(className);
	  } else {
	    var reg = new RegExp("(\\s|^)" + className + "(\\s|$)");
	    element.className = element.className.replace(reg, " ");
	  }
	}
	/**
	* Gets the CSS properties from the element.
	* @memberof DOM
	* @param elements - elements
	* @param properites - the CSS properties
	* @return returns CSS properties and values.
	* @example
	import {fromCSS} from "@daybrush/utils";

	console.log(fromCSS(element, ["left", "opacity", "top"])); // {"left": "10px", "opacity": 1, "top": "10px"}
	*/

	function fromCSS(elements, properties) {
	  if (!elements || !properties || !properties.length) {
	    return {};
	  }

	  var element;

	  if (elements instanceof Element) {
	    element = elements;
	  } else if (elements.length) {
	    element = elements[0];
	  } else {
	    return {};
	  }

	  var cssObject = {};
	  var styles = window.getComputedStyle(element);
	  var length = properties.length;

	  for (var i = 0; i < length; ++i) {
	    cssObject[properties[i]] = styles[properties[i]];
	  }

	  return cssObject;
	}
	/**
	* Sets up a function that will be called whenever the specified event is delivered to the target
	* @memberof DOM
	* @param - event target
	* @param - A case-sensitive string representing the event type to listen for.
	* @param - The object which receives a notification (an object that implements the Event interface) when an event of the specified type occurs
	* @param - An options object that specifies characteristics about the event listener. The available options are:
	* @example
	import {addEvent} from "@daybrush/utils";

	addEvent(el, "click", e => {
	  console.log(e);
	});
	*/

	function addEvent(el, type, listener, options) {
	  el.addEventListener(type, listener, options);
	}
	/**
	* removes from the EventTarget an event listener previously registered with EventTarget.addEventListener()
	* @memberof DOM
	* @param - event target
	* @param - A case-sensitive string representing the event type to listen for.
	* @param - The EventListener function of the event handler to remove from the event target.
	* @example
	import {addEvent, removeEvent} from "@daybrush/utils";
	const listener = e => {
	  console.log(e);
	};
	addEvent(el, "click", listener);
	removeEvent(el, "click", listener);
	*/

	function removeEvent(el, type, listener) {
	  el.removeEventListener(type, listener);
	}
	//# sourceMappingURL=utils.esm.js.map

	/*
	Copyright (c) 2017 NAVER Corp.
	@egjs/component project is licensed under the MIT license

	@egjs/component JavaScript library
	https://naver.github.io/egjs-component

	@version 2.1.2
	*/
	/**
	 * Copyright (c) 2015 NAVER Corp.
	 * egjs projects are licensed under the MIT license
	 */
	function isUndefined$1(value) {
	  return typeof value === "undefined";
	}
	/**
	 * A class used to manage events in a component
	 * @ko 컴포넌트의 이벤트을 관리할 수 있게 하는 클래스
	 * @alias eg.Component
	 */


	var Component$2 =
	/*#__PURE__*/
	function () {
	  var Component =
	  /*#__PURE__*/
	  function () {
	    /**
	    * Version info string
	    * @ko 버전정보 문자열
	    * @name VERSION
	    * @static
	    * @type {String}
	    * @example
	    * eg.Component.VERSION;  // ex) 2.0.0
	    * @memberof eg.Component
	    */

	    /**
	     * @support {"ie": "7+", "ch" : "latest", "ff" : "latest",  "sf" : "latest", "edge" : "latest", "ios" : "7+", "an" : "2.1+ (except 3.x)"}
	     */
	    function Component() {
	      this._eventHandler = {};
	      this.options = {};
	    }
	    /**
	     * Triggers a custom event.
	     * @ko 커스텀 이벤트를 발생시킨다
	     * @param {String} eventName The name of the custom event to be triggered <ko>발생할 커스텀 이벤트의 이름</ko>
	     * @param {Object} customEvent Event data to be sent when triggering a custom event <ko>커스텀 이벤트가 발생할 때 전달할 데이터</ko>
	     * @return {Boolean} Indicates whether the event has occurred. If the stop() method is called by a custom event handler, it will return false and prevent the event from occurring. <a href="https://github.com/naver/egjs-component/wiki/How-to-make-Component-event-design%3F">Ref</a> <ko>이벤트 발생 여부. 커스텀 이벤트 핸들러에서 stop() 메서드를 호출하면 'false'를 반환하고 이벤트 발생을 중단한다. <a href="https://github.com/naver/egjs-component/wiki/How-to-make-Component-event-design%3F">참고</a></ko>
	     * @example
	    class Some extends eg.Component {
	     some(){
	     	if(this.trigger("beforeHi")){ // When event call to stop return false.
	    	this.trigger("hi");// fire hi event.
	     	}
	     }
	    }
	    const some = new Some();
	    some.on("beforeHi", (e) => {
	    if(condition){
	    	e.stop(); // When event call to stop, `hi` event not call.
	    }
	    });
	    some.on("hi", (e) => {
	    // `currentTarget` is component instance.
	    console.log(some === e.currentTarget); // true
	    });
	    // If you want to more know event design. You can see article.
	    // https://github.com/naver/egjs-component/wiki/How-to-make-Component-event-design%3F
	     */


	    var _proto = Component.prototype;

	    _proto.trigger = function trigger(eventName, customEvent) {
	      if (customEvent === void 0) {
	        customEvent = {};
	      }

	      var handlerList = this._eventHandler[eventName] || [];
	      var hasHandlerList = handlerList.length > 0;

	      if (!hasHandlerList) {
	        return true;
	      } // If detach method call in handler in first time then handler list calls.


	      handlerList = handlerList.concat();
	      customEvent.eventType = eventName;
	      var isCanceled = false;
	      var arg = [customEvent];
	      var i = 0;

	      customEvent.stop = function () {
	        isCanceled = true;
	      };

	      customEvent.currentTarget = this;

	      for (var _len = arguments.length, restParam = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
	        restParam[_key - 2] = arguments[_key];
	      }

	      if (restParam.length >= 1) {
	        arg = arg.concat(restParam);
	      }

	      for (i = 0; handlerList[i]; i++) {
	        handlerList[i].apply(this, arg);
	      }

	      return !isCanceled;
	    };
	    /**
	     * Executed event just one time.
	     * @ko 이벤트가 한번만 실행된다.
	     * @param {eventName} eventName The name of the event to be attached <ko>등록할 이벤트의 이름</ko>
	     * @param {Function} handlerToAttach The handler function of the event to be attached <ko>등록할 이벤트의 핸들러 함수</ko>
	     * @return {eg.Component} An instance of a component itself<ko>컴포넌트 자신의 인스턴스</ko>
	     * @example
	    class Some extends eg.Component {
	     hi() {
	       alert("hi");
	     }
	     thing() {
	       this.once("hi", this.hi);
	     }
	    }
	    var some = new Some();
	    some.thing();
	    some.trigger("hi");
	    // fire alert("hi");
	    some.trigger("hi");
	    // Nothing happens
	     */


	    _proto.once = function once(eventName, handlerToAttach) {
	      if (typeof eventName === "object" && isUndefined$1(handlerToAttach)) {
	        var eventHash = eventName;
	        var i;

	        for (i in eventHash) {
	          this.once(i, eventHash[i]);
	        }

	        return this;
	      } else if (typeof eventName === "string" && typeof handlerToAttach === "function") {
	        var self = this;
	        this.on(eventName, function listener() {
	          for (var _len2 = arguments.length, arg = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
	            arg[_key2] = arguments[_key2];
	          }

	          handlerToAttach.apply(self, arg);
	          self.off(eventName, listener);
	        });
	      }

	      return this;
	    };
	    /**
	     * Checks whether an event has been attached to a component.
	     * @ko 컴포넌트에 이벤트가 등록됐는지 확인한다.
	     * @param {String} eventName The name of the event to be attached <ko>등록 여부를 확인할 이벤트의 이름</ko>
	     * @return {Boolean} Indicates whether the event is attached. <ko>이벤트 등록 여부</ko>
	     * @example
	    class Some extends eg.Component {
	     some() {
	       this.hasOn("hi");// check hi event.
	     }
	    }
	     */


	    _proto.hasOn = function hasOn(eventName) {
	      return !!this._eventHandler[eventName];
	    };
	    /**
	     * Attaches an event to a component.
	     * @ko 컴포넌트에 이벤트를 등록한다.
	     * @param {eventName} eventName The name of the event to be attached <ko>등록할 이벤트의 이름</ko>
	     * @param {Function} handlerToAttach The handler function of the event to be attached <ko>등록할 이벤트의 핸들러 함수</ko>
	     * @return {eg.Component} An instance of a component itself<ko>컴포넌트 자신의 인스턴스</ko>
	     * @example
	    class Some extends eg.Component {
	     hi() {
	       console.log("hi");
	     }
	     some() {
	       this.on("hi",this.hi); //attach event
	     }
	    }
	    */


	    _proto.on = function on(eventName, handlerToAttach) {
	      if (typeof eventName === "object" && isUndefined$1(handlerToAttach)) {
	        var eventHash = eventName;
	        var name;

	        for (name in eventHash) {
	          this.on(name, eventHash[name]);
	        }

	        return this;
	      } else if (typeof eventName === "string" && typeof handlerToAttach === "function") {
	        var handlerList = this._eventHandler[eventName];

	        if (isUndefined$1(handlerList)) {
	          this._eventHandler[eventName] = [];
	          handlerList = this._eventHandler[eventName];
	        }

	        handlerList.push(handlerToAttach);
	      }

	      return this;
	    };
	    /**
	     * Detaches an event from the component.
	     * @ko 컴포넌트에 등록된 이벤트를 해제한다
	     * @param {eventName} eventName The name of the event to be detached <ko>해제할 이벤트의 이름</ko>
	     * @param {Function} handlerToDetach The handler function of the event to be detached <ko>해제할 이벤트의 핸들러 함수</ko>
	     * @return {eg.Component} An instance of a component itself <ko>컴포넌트 자신의 인스턴스</ko>
	     * @example
	    class Some extends eg.Component {
	     hi() {
	       console.log("hi");
	     }
	     some() {
	       this.off("hi",this.hi); //detach event
	     }
	    }
	     */


	    _proto.off = function off(eventName, handlerToDetach) {
	      // All event detach.
	      if (isUndefined$1(eventName)) {
	        this._eventHandler = {};
	        return this;
	      } // All handler of specific event detach.


	      if (isUndefined$1(handlerToDetach)) {
	        if (typeof eventName === "string") {
	          this._eventHandler[eventName] = undefined;
	          return this;
	        } else {
	          var eventHash = eventName;
	          var name;

	          for (name in eventHash) {
	            this.off(name, eventHash[name]);
	          }

	          return this;
	        }
	      } // The handler of specific event detach.


	      var handlerList = this._eventHandler[eventName];

	      if (handlerList) {
	        var k;
	        var handlerFunction;

	        for (k = 0; (handlerFunction = handlerList[k]) !== undefined; k++) {
	          if (handlerFunction === handlerToDetach) {
	            handlerList = handlerList.splice(k, 1);
	            break;
	          }
	        }
	      }

	      return this;
	    };

	    return Component;
	  }();

	  Component.VERSION = "2.1.2";
	  return Component;
	}();
	//# sourceMappingURL=component.esm.js.map

	/*
	Copyright (c) Daybrush
	name: keycon
	license: MIT
	author: Daybrush
	repository: git+https://github.com/daybrush/keycon.git
	version: 0.5.0
	*/

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */

	/* global Reflect, Promise */
	var extendStatics$1 = function (d, b) {
	  extendStatics$1 = Object.setPrototypeOf || {
	    __proto__: []
	  } instanceof Array && function (d, b) {
	    d.__proto__ = b;
	  } || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	  };

	  return extendStatics$1(d, b);
	};

	function __extends$2(d, b) {
	  extendStatics$1(d, b);

	  function __() {
	    this.constructor = d;
	  }

	  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}

	function createCommonjsModule(fn, module) {
	  return module = {
	    exports: {}
	  }, fn(module, module.exports), module.exports;
	}

	var keycode = createCommonjsModule(function (module, exports) {
	// Source: http://jsfiddle.net/vWx8V/
	// http://stackoverflow.com/questions/5603195/full-list-of-javascript-keycodes

	/**
	 * Conenience method returns corresponding value for given keyName or keyCode.
	 *
	 * @param {Mixed} keyCode {Number} or keyName {String}
	 * @return {Mixed}
	 * @api public
	 */

	function keyCode(searchInput) {
	  // Keyboard Events
	  if (searchInput && 'object' === typeof searchInput) {
	    var hasKeyCode = searchInput.which || searchInput.keyCode || searchInput.charCode;
	    if (hasKeyCode) searchInput = hasKeyCode;
	  }

	  // Numbers
	  if ('number' === typeof searchInput) return names[searchInput]

	  // Everything else (cast to string)
	  var search = String(searchInput);

	  // check codes
	  var foundNamedKey = codes[search.toLowerCase()];
	  if (foundNamedKey) return foundNamedKey

	  // check aliases
	  var foundNamedKey = aliases[search.toLowerCase()];
	  if (foundNamedKey) return foundNamedKey

	  // weird character?
	  if (search.length === 1) return search.charCodeAt(0)

	  return undefined
	}

	/**
	 * Compares a keyboard event with a given keyCode or keyName.
	 *
	 * @param {Event} event Keyboard event that should be tested
	 * @param {Mixed} keyCode {Number} or keyName {String}
	 * @return {Boolean}
	 * @api public
	 */
	keyCode.isEventKey = function isEventKey(event, nameOrCode) {
	  if (event && 'object' === typeof event) {
	    var keyCode = event.which || event.keyCode || event.charCode;
	    if (keyCode === null || keyCode === undefined) { return false; }
	    if (typeof nameOrCode === 'string') {
	      // check codes
	      var foundNamedKey = codes[nameOrCode.toLowerCase()];
	      if (foundNamedKey) { return foundNamedKey === keyCode; }

	      // check aliases
	      var foundNamedKey = aliases[nameOrCode.toLowerCase()];
	      if (foundNamedKey) { return foundNamedKey === keyCode; }
	    } else if (typeof nameOrCode === 'number') {
	      return nameOrCode === keyCode;
	    }
	    return false;
	  }
	};

	exports = module.exports = keyCode;

	/**
	 * Get by name
	 *
	 *   exports.code['enter'] // => 13
	 */

	var codes = exports.code = exports.codes = {
	  'backspace': 8,
	  'tab': 9,
	  'enter': 13,
	  'shift': 16,
	  'ctrl': 17,
	  'alt': 18,
	  'pause/break': 19,
	  'caps lock': 20,
	  'esc': 27,
	  'space': 32,
	  'page up': 33,
	  'page down': 34,
	  'end': 35,
	  'home': 36,
	  'left': 37,
	  'up': 38,
	  'right': 39,
	  'down': 40,
	  'insert': 45,
	  'delete': 46,
	  'command': 91,
	  'left command': 91,
	  'right command': 93,
	  'numpad *': 106,
	  'numpad +': 107,
	  'numpad -': 109,
	  'numpad .': 110,
	  'numpad /': 111,
	  'num lock': 144,
	  'scroll lock': 145,
	  'my computer': 182,
	  'my calculator': 183,
	  ';': 186,
	  '=': 187,
	  ',': 188,
	  '-': 189,
	  '.': 190,
	  '/': 191,
	  '`': 192,
	  '[': 219,
	  '\\': 220,
	  ']': 221,
	  "'": 222
	};

	// Helper aliases

	var aliases = exports.aliases = {
	  'windows': 91,
	  '⇧': 16,
	  '⌥': 18,
	  '⌃': 17,
	  '⌘': 91,
	  'ctl': 17,
	  'control': 17,
	  'option': 18,
	  'pause': 19,
	  'break': 19,
	  'caps': 20,
	  'return': 13,
	  'escape': 27,
	  'spc': 32,
	  'spacebar': 32,
	  'pgup': 33,
	  'pgdn': 34,
	  'ins': 45,
	  'del': 46,
	  'cmd': 91
	};

	/*!
	 * Programatically add the following
	 */

	// lower case chars
	for (i = 97; i < 123; i++) codes[String.fromCharCode(i)] = i - 32;

	// numbers
	for (var i = 48; i < 58; i++) codes[i - 48] = i;

	// function keys
	for (i = 1; i < 13; i++) codes['f'+i] = i + 111;

	// numpad keys
	for (i = 0; i < 10; i++) codes['numpad '+i] = i + 96;

	/**
	 * Get by code
	 *
	 *   exports.name[13] // => 'Enter'
	 */

	var names = exports.names = exports.title = {}; // title for backward compat

	// Create reverse mapping
	for (i in codes) names[codes[i]] = i;

	// Add aliases
	for (var alias in aliases) {
	  codes[alias] = aliases[alias];
	}
	});
	var keycode_1 = keycode.code;
	var keycode_2 = keycode.codes;
	var keycode_3 = keycode.aliases;
	var keycode_4 = keycode.names;
	var keycode_5 = keycode.title;

	/*
	Copyright (c) 2018 Daybrush
	@name: @daybrush/utils
	license: MIT
	author: Daybrush
	repository: https://github.com/daybrush/utils
	@version 0.10.0
	*/
	/**
	* get string "string"
	* @memberof Consts
	* @example
	import {STRING} from "@daybrush/utils";

	console.log(STRING); // "string"
	*/

	var STRING$1 = "string";
	/**
	* Check the type that the value is isArray.
	* @memberof Utils
	* @param {string} value - Value to check the type
	* @return {} true if the type is correct, false otherwise
	* @example
	import {isArray} from "@daybrush/utils";

	console.log(isArray([])); // true
	console.log(isArray({})); // false
	console.log(isArray(undefined)); // false
	console.log(isArray(null)); // false
	*/

	function isArray$1(value) {
	  return Array.isArray(value);
	}
	/**
	* Check the type that the value is string.
	* @memberof Utils
	* @param {string} value - Value to check the type
	* @return {} true if the type is correct, false otherwise
	* @example
	import {isString} from "@daybrush/utils";

	console.log(isString("1234")); // true
	console.log(isString(undefined)); // false
	console.log(isString(1)); // false
	console.log(isString(null)); // false
	*/

	function isString$1(value) {
	  return typeof value === STRING$1;
	}
	/**
	* Sets up a function that will be called whenever the specified event is delivered to the target
	* @memberof DOM
	* @param - event target
	* @param - A case-sensitive string representing the event type to listen for.
	* @param - The object which receives a notification (an object that implements the Event interface) when an event of the specified type occurs
	* @param - An options object that specifies characteristics about the event listener. The available options are:
	* @example
	import {addEvent} from "@daybrush/utils";

	addEvent(el, "click", e => {
	  console.log(e);
	});
	*/

	function addEvent$1(el, type, listener, options) {
	  el.addEventListener(type, listener, options);
	}

	var codeData = {
	  "+": "plus",
	  "left command": "meta",
	  "right command": "meta"
	};
	var keysSort = {
	  shift: 1,
	  ctrl: 2,
	  alt: 3,
	  meta: 4
	};
	/**
	 * @memberof KeyController
	 */

	function getKey(keyCode) {
	  var key = keycode_4[keyCode] || "";

	  for (var name in codeData) {
	    key = key.replace(name, codeData[name]);
	  }

	  return key.replace(/\s/g, "");
	}
	/**
	 * @memberof KeyController
	 */

	function getCombi(e, key) {
	  if (key === void 0) {
	    key = getKey(e.keyCode);
	  }

	  var keys = [e.shiftKey && "shift", e.ctrlKey && "ctrl", e.altKey && "alt", e.metaKey && "meta"];
	  keys.indexOf(key) === -1 && keys.push(key);
	  return keys.filter(Boolean);
	}

	function getArrangeCombi(keys) {
	  var arrangeKeys = keys.slice();
	  arrangeKeys.sort(function (prev, next) {
	    var prevScore = keysSort[prev] || 5;
	    var nextScore = keysSort[next] || 5;
	    return prevScore - nextScore;
	  });
	  return arrangeKeys;
	}

	var globalKeyController;
	/**
	 */

	var KeyController =
	/*#__PURE__*/
	function (_super) {
	  __extends$2(KeyController, _super);
	  /**
	   *
	   */


	  function KeyController(container) {
	    if (container === void 0) {
	      container = window;
	    }

	    var _this = _super.call(this) || this;
	    /**
	     */


	    _this.ctrlKey = false;
	    /**
	     */

	    _this.altKey = false;
	    /**
	     *
	     */

	    _this.shiftKey = false;
	    /**
	     *
	     */

	    _this.metaKey = false;

	    _this.clear = function () {
	      _this.ctrlKey = false;
	      _this.altKey = false;
	      _this.shiftKey = false;
	      _this.metaKey = false;
	      return _this;
	    };

	    _this.keydownEvent = function (e) {
	      _this.triggerEvent("keydown", e);
	    };

	    _this.keyupEvent = function (e) {
	      _this.triggerEvent("keyup", e);
	    };

	    addEvent$1(container, "blur", _this.clear);
	    addEvent$1(container, "keydown", _this.keydownEvent);
	    addEvent$1(container, "keyup", _this.keyupEvent);
	    return _this;
	  }

	  var __proto = KeyController.prototype;
	  Object.defineProperty(KeyController, "global", {
	    /**
	     */
	    get: function () {
	      return globalKeyController || (globalKeyController = new KeyController());
	    },
	    enumerable: true,
	    configurable: true
	  });
	  /**
	   *
	   */

	  __proto.keydown = function (comb, callback) {
	    return this.addEvent("keydown", comb, callback);
	  };
	  /**
	   *
	   */


	  __proto.offKeydown = function (comb, callback) {
	    return this.removeEvent("keydown", comb, callback);
	  };
	  /**
	   *
	   */


	  __proto.offKeyup = function (comb, callback) {
	    return this.removeEvent("keyup", comb, callback);
	  };
	  /**
	   *
	   */


	  __proto.keyup = function (comb, callback) {
	    return this.addEvent("keyup", comb, callback);
	  };

	  __proto.addEvent = function (type, comb, callback) {
	    if (isArray$1(comb)) {
	      this.on(type + "." + getArrangeCombi(comb).join("."), callback);
	    } else if (isString$1(comb)) {
	      this.on(type + "." + comb, callback);
	    } else {
	      this.on(type, comb);
	    }

	    return this;
	  };

	  __proto.removeEvent = function (type, comb, callback) {
	    if (isArray$1(comb)) {
	      this.off(type + "." + getArrangeCombi(comb).join("."), callback);
	    } else if (isString$1(comb)) {
	      this.off(type + "." + comb, callback);
	    } else {
	      this.off(type, comb);
	    }

	    return this;
	  };

	  __proto.triggerEvent = function (type, e) {
	    this.ctrlKey = e.ctrlKey;
	    this.shiftKey = e.shiftKey;
	    this.altKey = e.altKey;
	    this.metaKey = e.metaKey;
	    var key = getKey(e.keyCode);
	    var isToggle = key === "ctrl" || key === "shift" || key === "meta" || key === "alt";
	    var param = {
	      key: key,
	      isToggle: isToggle,
	      inputEvent: e,
	      keyCode: e.keyCode,
	      ctrlKey: e.ctrlKey,
	      altKey: e.altKey,
	      shiftKey: e.shiftKey,
	      metaKey: e.metaKey
	    };
	    this.trigger(type, param);
	    this.trigger(type + "." + key, param);
	    var combi = getCombi(e, key);
	    combi.length > 1 && this.trigger(type + "." + combi.join("."), param);
	  };

	  return KeyController;
	}(Component$2);
	//# sourceMappingURL=keycon.esm.js.map

	/*
	Copyright (c) 2019 Daybrush
	name: @daybrush/drag
	license: MIT
	author: Daybrush
	repository: git+https://github.com/daybrush/drag.git
	version: 0.9.1
	*/

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */
	var __assign$1 = function () {
	  __assign$1 = Object.assign || function __assign(t) {
	    for (var s, i = 1, n = arguments.length; i < n; i++) {
	      s = arguments[i];

	      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
	    }

	    return t;
	  };

	  return __assign$1.apply(this, arguments);
	};

	function getPinchDragPosition(clients, prevClients, startClients, startPinchClients) {
	  var nowCenter = getAverageClient(clients);
	  var prevCenter = getAverageClient(prevClients);
	  var startCenter = getAverageClient(startPinchClients);
	  var pinchClient = getAddClient(startPinchClients[0], getMinusClient(nowCenter, startCenter));
	  var pinchPrevClient = getAddClient(startPinchClients[0], getMinusClient(prevCenter, startCenter));
	  return getPosition(pinchClient, pinchPrevClient, startClients[0]);
	}
	function isMultiTouch(e) {
	  return e.touches && e.touches.length >= 2;
	}
	function getPositionEvent(e) {
	  if (e.touches) {
	    return getClients(e.touches);
	  } else {
	    return [getClient(e)];
	  }
	}
	function getPosition(client, prevClient, startClient) {
	  var clientX = client.clientX,
	      clientY = client.clientY;
	  var prevX = prevClient.clientX,
	      prevY = prevClient.clientY;
	  var startX = startClient.clientX,
	      startY = startClient.clientY;
	  var deltaX = clientX - prevX;
	  var deltaY = clientY - prevY;
	  var distX = clientX - startX;
	  var distY = clientY - startY;
	  return {
	    clientX: clientX,
	    clientY: clientY,
	    deltaX: deltaX,
	    deltaY: deltaY,
	    distX: distX,
	    distY: distY
	  };
	}
	function getDist(clients) {
	  return Math.sqrt(Math.pow(clients[0].clientX - clients[1].clientX, 2) + Math.pow(clients[0].clientY - clients[1].clientY, 2));
	}
	function getPositions(clients, prevClients, startClients) {
	  return clients.map(function (client, i) {
	    return getPosition(client, prevClients[i], startClients[i]);
	  });
	}
	function getClients(touches) {
	  var length = Math.min(touches.length, 2);
	  var clients = [];

	  for (var i = 0; i < length; ++i) {
	    clients.push(getClient(touches[i]));
	  }

	  return clients;
	}
	function getClient(e) {
	  return {
	    clientX: e.clientX,
	    clientY: e.clientY
	  };
	}
	function getAverageClient(clients) {
	  return {
	    clientX: (clients[0].clientX + clients[1].clientX) / 2,
	    clientY: (clients[0].clientY + clients[1].clientY) / 2
	  };
	}
	function getAddClient(client1, client2) {
	  return {
	    clientX: client1.clientX + client2.clientX,
	    clientY: client1.clientY + client2.clientY
	  };
	}
	function getMinusClient(client1, client2) {
	  return {
	    clientX: client1.clientX - client2.clientX,
	    clientY: client1.clientY - client2.clientY
	  };
	}

	var Dragger =
	/*#__PURE__*/
	function () {
	  function Dragger(el, options) {
	    var _this = this;

	    if (options === void 0) {
	      options = {};
	    }

	    this.el = el;
	    this.options = {};
	    this.flag = false;
	    this.pinchFlag = false;
	    this.datas = {};
	    this.isDrag = false;
	    this.isPinch = false;
	    this.isMouse = false;
	    this.isTouch = false;
	    this.prevClients = [];
	    this.startClients = [];
	    this.movement = 0;
	    this.startPinchClients = [];
	    this.startDistance = 0;

	    this.onDragStart = function (e) {
	      if (!_this.flag && e.cancelable === false) {
	        return;
	      }

	      if (isMultiTouch(e)) {
	        if (!_this.flag && e.touches.length !== e.changedTouches.length) {
	          return;
	        }

	        if (!_this.pinchFlag) {
	          _this.onPinchStart(e);
	        }
	      }

	      if (_this.flag) {
	        return;
	      }

	      var clients = _this.startClients[0] ? _this.startClients : getPositionEvent(e);
	      _this.flag = true;
	      _this.isDrag = false;
	      _this.startClients = clients;
	      _this.prevClients = clients;
	      _this.datas = {};
	      _this.movement = 0;
	      var position = getPosition(clients[0], _this.prevClients[0], _this.startClients[0]);
	      var _a = _this.options,
	          dragstart = _a.dragstart,
	          preventRightClick = _a.preventRightClick;

	      if (preventRightClick && e.which === 3 || (dragstart && dragstart(__assign$1({
	        datas: _this.datas,
	        inputEvent: e
	      }, position))) === false) {
	        _this.startClients = [];
	        _this.prevClients = [];
	        _this.flag = false;
	      }

	      _this.flag && e.preventDefault();
	    };

	    this.onDrag = function (e) {
	      if (!_this.flag) {
	        return;
	      }

	      var clients = getPositionEvent(e);

	      if (_this.pinchFlag) {
	        _this.onPinch(e, clients);
	      }

	      var prevClients = _this.prevClients;
	      var startClients = _this.startClients;
	      var position = _this.pinchFlag ? getPinchDragPosition(clients, prevClients, startClients, _this.startPinchClients) : getPosition(clients[0], prevClients[0], startClients[0]);
	      var deltaX = position.deltaX,
	          deltaY = position.deltaY;

	      if (!deltaX && !deltaY) {
	        return;
	      }

	      _this.movement += Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	      _this.isDrag = true;
	      var drag = _this.options.drag;
	      drag && drag(__assign$1({
	        datas: _this.datas
	      }, position, {
	        inputEvent: e
	      }));
	      _this.prevClients = clients;
	    };

	    this.onDragEnd = function (e) {
	      if (!_this.flag) {
	        return;
	      }

	      if (_this.pinchFlag) {
	        _this.onPinchEnd(e);
	      }

	      _this.flag = false;
	      var dragend = _this.options.dragend;
	      var prevClients = _this.prevClients;
	      var startClients = _this.startClients;
	      var position = _this.pinchFlag ? getPinchDragPosition(prevClients, prevClients, startClients, _this.startPinchClients) : getPosition(prevClients[0], prevClients[0], startClients[0]);
	      _this.startClients = [];
	      _this.prevClients = [];
	      dragend && dragend(__assign$1({
	        datas: _this.datas,
	        isDrag: _this.isDrag,
	        inputEvent: e
	      }, position));
	    };

	    this.options = __assign$1({
	      container: el,
	      preventRightClick: true,
	      pinchThreshold: 0,
	      events: ["touch", "mouse"]
	    }, options);
	    var _a = this.options,
	        container = _a.container,
	        events = _a.events;
	    this.isTouch = events.indexOf("touch") > -1;
	    this.isMouse = events.indexOf("mouse") > -1;

	    if (this.isMouse) {
	      addEvent(el, "mousedown", this.onDragStart);
	      addEvent(container, "mousemove", this.onDrag);
	      addEvent(container, "mouseup", this.onDragEnd);
	    }

	    if (this.isTouch) {
	      addEvent(el, "touchstart", this.onDragStart);
	      addEvent(container, "touchmove", this.onDrag);
	      addEvent(container, "touchend", this.onDragEnd);
	    }
	  }

	  var __proto = Dragger.prototype;

	  __proto.isDragging = function () {
	    return this.isDrag;
	  };

	  __proto.isPinching = function () {
	    return this.isPinch;
	  };

	  __proto.onPinchStart = function (e) {
	    var _a, _b;

	    var _c = this.options,
	        pinchstart = _c.pinchstart,
	        pinchThreshold = _c.pinchThreshold;

	    if (this.isDrag && this.movement > pinchThreshold) {
	      return;
	    }

	    var pinchClients = getClients(e.changedTouches);
	    this.pinchFlag = true;

	    (_a = this.startClients).push.apply(_a, pinchClients);

	    (_b = this.prevClients).push.apply(_b, pinchClients);

	    this.startDistance = getDist(this.prevClients);
	    this.startPinchClients = this.prevClients.slice();

	    if (!pinchstart) {
	      return;
	    }

	    var startClients = this.prevClients;
	    var startAverageClient = getAverageClient(startClients);
	    var centerPosition = getPosition(startAverageClient, startAverageClient, startAverageClient);
	    pinchstart(__assign$1({
	      datas: this.datas,
	      touches: getPositions(startClients, startClients, startClients)
	    }, centerPosition, {
	      inputEvent: e
	    }));
	  };

	  __proto.onPinch = function (e, clients) {
	    if (!this.flag || !this.pinchFlag) {
	      return;
	    }

	    this.isPinch = true;
	    var pinch = this.options.pinch;

	    if (!pinch) {
	      return;
	    }

	    var prevClients = this.prevClients;
	    var startClients = this.startClients;
	    var centerPosition = getPosition(getAverageClient(clients), getAverageClient(prevClients), getAverageClient(startClients));
	    var distance = getDist(clients);
	    pinch(__assign$1({
	      datas: this.datas,
	      touches: getPositions(clients, prevClients, startClients),
	      scale: distance / this.startDistance,
	      distance: distance
	    }, centerPosition, {
	      inputEvent: e
	    }));
	  };

	  __proto.onPinchEnd = function (e) {
	    if (!this.flag || !this.pinchFlag) {
	      return;
	    }

	    var isPinch = this.isPinch;
	    this.isPinch = false;
	    this.pinchFlag = false;
	    var pinchend = this.options.pinchend;

	    if (!pinchend) {
	      return;
	    }

	    var prevClients = this.prevClients;
	    var startClients = this.startClients;
	    var centerPosition = getPosition(getAverageClient(prevClients), getAverageClient(prevClients), getAverageClient(startClients));
	    pinchend(__assign$1({
	      datas: this.datas,
	      isPinch: isPinch,
	      touches: getPositions(prevClients, prevClients, startClients)
	    }, centerPosition, {
	      inputEvent: e
	    }));
	    this.isPinch = false;
	    this.pinchFlag = false;
	  };

	  __proto.unset = function () {
	    var el = this.el;
	    var container = this.options.container;

	    if (this.isMouse) {
	      removeEvent(el, "mousedown", this.onDragStart);
	      removeEvent(container, "mousemove", this.onDrag);
	      removeEvent(container, "mouseup", this.onDragEnd);
	    }

	    if (this.isTouch) {
	      removeEvent(el, "touchstart", this.onDragStart);
	      removeEvent(container, "touchmove", this.onDrag);
	      removeEvent(container, "touchend", this.onDragEnd);
	    }
	  };

	  return Dragger;
	}();
	//# sourceMappingURL=drag.esm.js.map

	/*
	Copyright (c) 2019 Daybrush
	name: list-map
	license: MIT
	author: Daybrush
	repository: git+https://github.com/daybrush/list-map.git
	version: 0.1.1
	*/

	/**
	 *
	 */

	var ListMap =
	/*#__PURE__*/
	function () {
	  function ListMap() {
	    this.obj = {};
	    this.objKeys = [];
	  }
	  /**
	   *
	   */


	  var __proto = ListMap.prototype;

	  __proto.has = function (key) {
	    return key in this.obj;
	  };
	  /**
	   *
	   */


	  __proto.get = function (key) {
	    return this.obj[key];
	  };
	  /**
	   *
	   */


	  __proto.set = function (key, value) {
	    if (!this.has(key)) {
	      this.objKeys.push(key);
	    }

	    this.setItem(key, value);
	    return this;
	  };
	  /**
	   *
	   */


	  __proto.size = function () {
	    return this.objKeys.length;
	  };
	  /**
	   *
	   */


	  __proto.keys = function () {
	    return this.objKeys.slice();
	  };
	  /**
	   *
	   */


	  __proto.values = function () {
	    var obj = this.obj;
	    var keys = this.objKeys;
	    return keys.map(function (key) {
	      return obj[key];
	    });
	  };
	  /**
	   *
	   */


	  __proto.getIndex = function (key) {
	    return this.objKeys.indexOf(key);
	  };
	  /**
	   *
	   */


	  __proto.findIndex = function (callback) {
	    var obj = this.obj;
	    return findIndex(this.objKeys, function (key, i) {
	      return callback(obj[key], key, i, obj);
	    });
	  };
	  /**
	   *
	   */


	  __proto.find = function (callback) {
	    var obj = this.obj;
	    var result = find(this.objKeys, function (key, i) {
	      return callback(obj[key], key, i, obj);
	    });
	    return obj[result];
	  };
	  /**
	   *
	   */


	  __proto.remove = function (key) {
	    if (this.has(key)) {
	      var index = this.getIndex(key);
	      this.removeItem(key);
	      this.spliceKeys(index, 1);
	    }

	    return this;
	  };
	  /**
	   *
	   */


	  __proto.splice = function (index, deleteCount) {
	    var _this = this;

	    var items = [];

	    for (var _i = 2; _i < arguments.length; _i++) {
	      items[_i - 2] = arguments[_i];
	    }

	    var added = items.filter(function (_a) {
	      var key = _a[0],
	          value = _a[1];

	      var hasItem = _this.has(key);

	      _this.setItem(key, value);

	      return !hasItem;
	    });
	    var deletedKeys = this.spliceKeys.apply(this, [index, deleteCount].concat(added.map(function (_a) {
	      var key = _a[0];
	      return key;
	    })));
	    deletedKeys.forEach(function (key) {
	      _this.removeItem(key);
	    });
	    var obj = this.objKeys;
	    return deletedKeys.map(function (key) {
	      return [key, obj[key]];
	    });
	  };
	  /**
	   *
	   */


	  __proto.forEach = function (callback) {
	    var obj = this.obj;
	    this.objKeys.forEach(function (key, i) {
	      return callback(obj[key], key, i, obj);
	    });
	    return this;
	  };

	  __proto.setItem = function (key, value) {
	    this.obj[key] = value;
	  };

	  __proto.removeItem = function (key) {
	    delete this.obj[key];
	  };

	  __proto.spliceKeys = function (index, deleteCount) {
	    var _a;

	    var items = [];

	    for (var _i = 2; _i < arguments.length; _i++) {
	      items[_i - 2] = arguments[_i];
	    }

	    return (_a = this.objKeys).splice.apply(_a, [index, deleteCount].concat(items));
	  };

	  return ListMap;
	}();
	//# sourceMappingURL=list-map.esm.js.map

	/*
	Copyright (c) 2016 Daybrush
	name: scenejs
	license: MIT
	author: Daybrush
	repository: https://github.com/daybrush/scenejs.git
	version: 1.0.4
	*/

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */

	/* global Reflect, Promise */
	var extendStatics$2 = function (d, b) {
	  extendStatics$2 = Object.setPrototypeOf || {
	    __proto__: []
	  } instanceof Array && function (d, b) {
	    d.__proto__ = b;
	  } || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	  };

	  return extendStatics$2(d, b);
	};

	function __extends$3(d, b) {
	  extendStatics$2(d, b);

	  function __() {
	    this.constructor = d;
	  }

	  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}
	function __decorate(decorators, target, key, desc) {
	  var c = arguments.length,
	      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
	      d;
	  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
	  return c > 3 && r && Object.defineProperty(target, key, r), r;
	}

	function cubic(y1, y2, t) {
	  var t2 = 1 - t; // Bezier Curve Formula

	  return t * t * t + 3 * t * t * t2 * y2 + 3 * t * t2 * t2 * y1;
	}

	function solveFromX(x1, x2, x) {
	  // x  0 ~ 1
	  // t 0 ~ 1
	  var t = x;
	  var solveX = x;
	  var dx = 1;

	  while (Math.abs(dx) > 1 / 1000) {
	    // 예상 t초에 의한 _x값
	    solveX = cubic(x1, x2, t);
	    dx = solveX - x; // 차이가 미세하면 그 값을 t로 지정

	    if (Math.abs(dx) < 1 / 1000) {
	      return t;
	    }

	    t -= dx / 2;
	  }

	  return t;
	}
	/**
	 * @namespace easing
	 */

	/**
	* Cubic Bezier curve.
	* @memberof easing
	* @func bezier
	* @param {number} [x1] - point1's x
	* @param {number} [y1] - point1's y
	* @param {number} [x2] - point2's x
	* @param {number} [y2] - point2's y
	* @return {function} the curve function
	* @example
	import {bezier} from "scenejs";
	Scene.bezier(0, 0, 1, 1) // LINEAR
	Scene.bezier(0.25, 0.1, 0.25, 1) // EASE
	*/


	function bezier(x1, y1, x2, y2) {
	  /*
	        x = f(t)
	        calculate inverse function by x
	        t = f-1(x)
	    */
	  var func = function (x) {
	    var t = solveFromX(x1, x2, Math.max(Math.min(1, x), 0));
	    return cubic(y1, y2, t);
	  };

	  func.easingName = "cubic-bezier(" + x1 + "," + y1 + "," + x2 + "," + y2 + ")";
	  return func;
	}
	/**
	* Specifies a stepping function
	* @see {@link https://www.w3schools.com/cssref/css3_pr_animation-timing-function.asp|CSS3 Timing Function}
	* @memberof easing
	* @func steps
	* @param {number} count - point1's x
	* @param {"start" | "end"} postion - point1's y
	* @return {function} the curve function
	* @example
	import {steps} from "scenejs";
	Scene.steps(1, "start") // Scene.STEP_START
	Scene.steps(1, "end") // Scene.STEP_END
	*/

	function steps(count, position) {
	  var func = function (time) {
	    var level = 1 / count;

	    if (time >= 1) {
	      return 1;
	    }

	    return (position === "start" ? level : 0) + Math.floor(time / level) * level;
	  };

	  func.easingName = "steps(" + count + ", " + position + ")";
	  return func;
	}
	/**
	* Equivalent to steps(1, start)
	* @memberof easing
	* @name STEP_START
	* @static
	* @type {function}
	* @example
	import {STEP_START} from "scenejs";
	Scene.STEP_START // steps(1, start)
	*/

	var STEP_START =
	/*#__PURE__#*/
	steps(1, "start");
	/**
	* Equivalent to steps(1, end)
	* @memberof easing
	* @name STEP_END
	* @static
	* @type {function}
	* @example
	import {STEP_END} from "scenejs";
	Scene.STEP_END // steps(1, end)
	*/

	var STEP_END =
	/*#__PURE__#*/
	steps(1, "end");
	/**
	* Linear Speed (0, 0, 1, 1)
	* @memberof easing
	* @name LINEAR
	* @static
	* @type {function}
	* @example
	import {LINEAR} from "scenejs";
	Scene.LINEAR
	*/

	var LINEAR =
	/*#__PURE__#*/
	bezier(0, 0, 1, 1);
	/**
	* Ease Speed (0.25, 0.1, 0.25, 1)
	* @memberof easing
	* @name EASE
	* @static
	* @type {function}
	* @example
	import {EASE} from "scenejs";
	Scene.EASE
	*/

	var EASE =
	/*#__PURE__#*/
	bezier(0.25, 0.1, 0.25, 1);
	/**
	* Ease In Speed (0.42, 0, 1, 1)
	* @memberof easing
	* @name EASE_IN
	* @static
	* @type {function}
	* @example
	import {EASE_IN} from "scenejs";
	Scene.EASE_IN
	*/

	var EASE_IN =
	/*#__PURE__#*/
	bezier(0.42, 0, 1, 1);
	/**
	* Ease Out Speed (0, 0, 0.58, 1)
	* @memberof easing
	* @name EASE_OUT
	* @static
	* @type {function}
	* @example
	import {EASE_OUT} from "scenejs";
	Scene.EASE_OUT
	*/

	var EASE_OUT =
	/*#__PURE__#*/
	bezier(0, 0, 0.58, 1);
	/**
	* Ease In Out Speed (0.42, 0, 0.58, 1)
	* @memberof easing
	* @name EASE_IN_OUT
	* @static
	* @type {function}
	* @example
	import {EASE_IN_OUT} from "scenejs";
	Scene.EASE_IN_OUT
	*/

	var EASE_IN_OUT =
	/*#__PURE__#*/
	bezier(0.42, 0, 0.58, 1);

	var _a;
	var PREFIX = "__SCENEJS_";
	var DATA_SCENE_ID = "data-scene-id";
	var TIMING_FUNCTION = "animation-timing-function";
	var ROLES = {
	  transform: {},
	  filter: {},
	  attribute: {}
	};
	var ALIAS = {
	  easing: [TIMING_FUNCTION]
	};
	var FIXED = (_a = {}, _a[TIMING_FUNCTION] = true, _a.contents = true, _a);
	var MAXIMUM = 1000000;
	var THRESHOLD = 0.000001;
	var DURATION = "duration";
	var FILL_MODE = "fillMode";
	var DIRECTION = "direction";
	var ITERATION_COUNT = "iterationCount";
	var DELAY = "delay";
	var EASING = "easing";
	var PLAY_SPEED = "playSpeed";
	var EASING_NAME = "easingName";
	var ITERATION_TIME = "iterationTime";
	var PAUSED = "paused";
	var ENDED = "ended";
	var TIMEUPDATE = "timeupdate";
	var PLAY = "play";
	var RUNNING = "running";
	var ITERATION = "iteration";
	var START_ANIMATION = "startAnimation";
	var PAUSE_ANIMATION = "pauseAnimation";
	var ALTERNATE = "alternate";
	var REVERSE = "reverse";
	var ALTERNATE_REVERSE = "alternate-reverse";
	var NORMAL = "normal";
	var INFINITE = "infinite";
	var PLAY_STATE = "playState";
	var PLAY_CSS = "playCSS";
	var PREV_TIME = "prevTime";
	var TICK_TIME = "tickTime";
	var CURRENT_TIME = "currentTime";
	var SELECTOR = "selector";
	var TRANSFORM_NAME = "transform";
	var EASINGS = {
	  "linear": LINEAR,
	  "ease": EASE,
	  "ease-in": EASE_IN,
	  "ease-out": EASE_OUT,
	  "ease-in-out": EASE_IN_OUT,
	  "step-start": STEP_START,
	  "step-end": STEP_END
	};
	/**
	* option name list
	* @name Scene.OPTIONS
	* @memberof Scene
	* @static
	* @type {$ts:OptionType}
	* @example
	* Scene.OPTIONS // ["duration", "fillMode", "direction", "iterationCount", "delay", "easing", "playSpeed"]
	*/

	var OPTIONS = [DURATION, FILL_MODE, DIRECTION, ITERATION_COUNT, DELAY, EASING, PLAY_SPEED];

	/**
	* attach and trigger event handlers.
	*/

	var EventTrigger =
	/*#__PURE__*/
	function () {
	  /**
	    * @example
	  const et = new Scene.EventTrigger();
	  const scene = new Scene();
	  scene.on("call", e => {
	    console.log(e.param);
	  });
	  et.on("call", e => {
	    console.log(e.param);
	  });
	  scene.trigger("call", {param: 1});
	  et.trigger("call", {param: 1});
	     */
	  function EventTrigger() {
	    this.events = {};
	  }

	  var __proto = EventTrigger.prototype;

	  __proto._on = function (name, callback, once) {
	    var _this = this;

	    var events = this.events;

	    if (isObject(name)) {
	      for (var n in name) {
	        this._on(n, name[n], once);
	      }

	      return;
	    }

	    if (!(name in events)) {
	      events[name] = [];
	    }

	    if (!callback) {
	      return;
	    }

	    if (isArray(callback)) {
	      callback.forEach(function (func) {
	        return _this._on(name, func, once);
	      });
	      return;
	    }

	    events[name].push(once ? function callback2() {
	      var args = [];

	      for (var _i = 0; _i < arguments.length; _i++) {
	        args[_i] = arguments[_i];
	      }

	      callback.apply(void 0, args);
	      this.off(name, callback2);
	    } : callback);
	  };
	  /**
	    * Attach an event handler function for one or more events to target
	    * @param - event's name
	    * @param - function to execute when the event is triggered.
	    * @return {EventTrigger} An Instance itself.
	    * @example
	  target.on("animate", function() {
	    console.log("animate");
	  });
	  target.trigger("animate");
	   */


	  __proto.on = function (name, callback) {
	    this._on(name, callback);

	    return this;
	  };
	  /**
	    * Dettach an event handler function for one or more events to target
	    * @param - event's name
	    * @param -  function to execute when the event is triggered.
	    * @return {EventTrigger} An Instance itself.
	    * @example
	  const callback = function() {
	    console.log("animate");
	  };
	  target.on("animate", callback);
	  target.off("animate", callback);
	  target.off("animate");
	     */


	  __proto.off = function (name, callback) {
	    if (!name) {
	      this.events = {};
	    } else if (!callback) {
	      this.events[name] = [];
	    } else {
	      var callbacks = this.events[name];

	      if (!callbacks) {
	        return this;
	      }

	      var index = callbacks.indexOf(callback);

	      if (index !== -1) {
	        callbacks.splice(index, 1);
	      }
	    }

	    return this;
	  };
	  /**
	    * execute event handler
	    * @param - event's name
	    * @param - event handler's additional parameter
	    * @return {EventTrigger} An Instance itself.
	    * @example
	  target.on("animate", function(a1, a2) {
	    console.log("animate", a1, a2);
	  });
	  target.trigger("animate", [1, 2]); // log => "animate", 1, 2
	     */


	  __proto.trigger = function (name) {
	    var _this = this;

	    var data = [];

	    for (var _i = 1; _i < arguments.length; _i++) {
	      data[_i - 1] = arguments[_i];
	    }

	    var events = this.events;

	    if (!(name in events)) {
	      return this;
	    }

	    var args = data || [];
	    !args[0] && (args[0] = {});
	    var event = events[name];
	    var target = args[0];
	    target.type = name;
	    target.currentTarget = this;
	    !target.target && (target.target = this);
	    toArray(events[name]).forEach(function (callback) {
	      callback.apply(_this, data);
	    });
	    return this;
	  };

	  __proto.once = function (name, callback) {
	    this._on(name, callback, true);

	    return this;
	  };

	  return EventTrigger;
	}();

	/**
	* Make string, array to PropertyObject for the dot product
	*/

	var PropertyObject =
	/*#__PURE__*/
	function () {
	  /**
	    * @param - This value is in the array format.
	    * @param - options
	    * @example
	  var obj = new PropertyObject([100,100,100,0.5], {
	    "separator" : ",",
	    "prefix" : "rgba(",
	    "suffix" : ")"
	  });
	     */
	  function PropertyObject(value, options) {
	    this.prefix = "";
	    this.suffix = "";
	    this.model = "";
	    this.type = "";
	    this.separator = ",";
	    options && this.setOptions(options);
	    this.value = isString(value) ? value.split(this.separator) : value;
	  }

	  var __proto = PropertyObject.prototype;

	  __proto.setOptions = function (newOptions) {
	    for (var name in newOptions) {
	      this[name] = newOptions[name];
	    }

	    return this;
	  };
	  /**
	    * the number of values.
	    * @example
	  const obj1 = new PropertyObject("1,2,3", ",");
	  console.log(obj1.length);
	  // 3
	     */


	  __proto.size = function () {
	    return this.value.length;
	  };
	  /**
	    * retrieve one of values at the index
	    * @param {Number} index - index
	    * @return {Object} one of values at the index
	    * @example
	  const obj1 = new PropertyObject("1,2,3", ",");
	  console.log(obj1.get(0));
	  // 1
	     */


	  __proto.get = function (index) {
	    return this.value[index];
	  };
	  /**
	    * Set the value at that index
	    * @param {Number} index - index
	    * @param {Object} value - text, a number, object to set
	    * @return {PropertyObject} An instance itself
	    * @example
	  const obj1 = new PropertyObject("1,2,3", ",");
	  obj1.set(0, 2);
	  console.log(obj1.toValue());
	  // 2,2,3
	     */


	  __proto.set = function (index, value) {
	    this.value[index] = value;
	    return this;
	  };
	  /**
	    * create a copy of an instance itself.
	    * @return {PropertyObject} clone
	    * @example
	  const obj1 = new PropertyObject("1,2,3", ",");
	  const obj2 = obj1.clone();
	     */


	  __proto.clone = function () {
	    var _a = this,
	        separator = _a.separator,
	        prefix = _a.prefix,
	        suffix = _a.suffix,
	        model = _a.model,
	        type = _a.type;

	    var arr = this.value.map(function (v) {
	      return v instanceof PropertyObject ? v.clone() : v;
	    });
	    return new PropertyObject(arr, {
	      separator: separator,
	      prefix: prefix,
	      suffix: suffix,
	      model: model,
	      type: type
	    });
	  };
	  /**
	    * Make Property Object to String
	    * @return {String} Make Property Object to String
	    * @example
	  //rgba(100, 100, 100, 0.5)
	  const obj4 = new PropertyObject([100,100,100,0.5], {
	    "separator" : ",",
	    "prefix" : "rgba(",
	    "suffix" : ")",
	  });
	  console.log(obj4.toValue());
	  // "rgba(100,100,100,0.5)"
	    */


	  __proto.toValue = function () {
	    return this.prefix + this.join() + this.suffix;
	  };
	  /**
	    * Make Property Object's array to String
	    * @return {String} Join the elements of an array into a string
	    * @example
	    //rgba(100, 100, 100, 0.5)
	    var obj4 = new PropertyObject([100,100,100,0.5], {
	        "separator" : ",",
	        "prefix" : "rgba(",
	        "suffix" : ")"
	    });
	    obj4.join();  // =>   "100,100,100,0.5"
	     */


	  __proto.join = function () {
	    return this.value.map(function (v) {
	      return v instanceof PropertyObject ? v.toValue() : v;
	    }).join(this.separator);
	  };
	  /**
	    * executes a provided function once per array element.
	    * @param {Function} callback - Function to execute for each element, taking three arguments
	    * @param {All} [callback.currentValue] The current element being processed in the array.
	    * @param {Number} [callback.index] The index of the current element being processed in the array.
	    * @param {Array} [callback.array] the array.
	    * @return {PropertyObject} An instance itself
	    * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach|MDN Array.forEach()} reference to MDN document.
	    * @example
	  //rgba(100, 100, 100, 0.5)
	  var obj4 = new PropertyObject([100,100,100,0.5], {
	    "separator" : ",",
	    "prefix" : "rgba(",
	    "suffix" : ")"
	  });
	  obj4.forEach(t => {
	    console.log(t);
	  });  // =>   "100,100,100,0.5"
	    */


	  __proto.forEach = function (func) {
	    this.value.forEach(func);
	    return this;
	  };

	  return PropertyObject;
	}();

	/**
	* @namespace
	* @name Property
	*/
	function splitStyle(str) {
	  var properties = str.split(";");
	  var obj = {};
	  var length = properties.length;

	  for (var i = 0; i < length; ++i) {
	    var matches = /([^:]*):([\S\s]*)/g.exec(properties[i]);

	    if (!matches || matches.length < 3 || !matches[1]) {
	      --length;
	      continue;
	    }

	    obj[matches[1].trim()] = toPropertyObject(matches[2].trim());
	  }

	  return {
	    styles: obj,
	    length: length
	  };
	}
	/**
	* convert array to PropertyObject[type=color].
	* default model "rgba"
	* @memberof Property
	* @function arrayToColorObject
	* @param {Array|PropertyObject} value ex) [0, 0, 0, 1]
	* @return {PropertyObject} PropertyObject[type=color]
	* @example
	arrayToColorObject([0, 0, 0])
	// => PropertyObject(type="color", model="rgba", value=[0, 0, 0, 1], separator=",")
	*/

	function arrayToColorObject(arr) {
	  var model = RGBA;

	  if (arr.length === 3) {
	    arr[3] = 1;
	  }

	  return new PropertyObject(arr, {
	    model: model,
	    separator: ",",
	    type: "color",
	    prefix: model + "(",
	    suffix: ")"
	  });
	}
	/**
	* convert text with parentheses to object.
	* @memberof Property
	* @function stringToBracketObject
	* @param {String} value ex) "rgba(0,0,0,1)"
	* @return {PropertyObject} PropertyObject
	* @example
	stringToBracketObject("abcde(0, 0, 0,1)")
	// => PropertyObject(model="abcde", value=[0, 0, 0,1], separator=",")
	*/

	function stringToBracketObject(text) {
	  // [prefix, value, other]
	  var _a = splitBracket(text),
	      model = _a.prefix,
	      value = _a.value,
	      afterModel = _a.suffix;

	  if (typeof value === "undefined") {
	    return text;
	  }

	  if (COLOR_MODELS.indexOf(model) !== -1) {
	    return arrayToColorObject(stringToRGBA(text));
	  } // divide comma(,)


	  var obj = toPropertyObject(value);
	  var arr = [value];
	  var separator = ",";
	  var prefix = model + "(";
	  var suffix = ")" + afterModel;

	  if (obj instanceof PropertyObject) {
	    separator = obj.separator;
	    arr = obj.value;
	    prefix += obj.prefix;
	    suffix = obj.suffix + suffix;
	  }

	  return new PropertyObject(arr, {
	    separator: separator,
	    model: model,
	    prefix: prefix,
	    suffix: suffix
	  });
	}
	function arrayToPropertyObject(arr, separator) {
	  return new PropertyObject(arr, {
	    type: "array",
	    separator: separator
	  });
	}
	/**
	* convert text with parentheses to PropertyObject[type=color].
	* If the values are not RGBA model, change them RGBA mdoel.
	* @memberof Property
	* @function stringToColorObject
	* @param {String|PropertyObject} value ex) "rgba(0,0,0,1)"
	* @return {PropertyObject} PropertyObject[type=color]
	* @example
	stringToColorObject("rgba(0, 0, 0,1)")
	// => PropertyObject(type="color", model="rgba", value=[0, 0, 0,1], separator=",")
	*/

	function stringToColorObject(value) {
	  var result = stringToRGBA(value);
	  return result ? arrayToColorObject(result) : value;
	}
	function toPropertyObject(value) {
	  if (!isString(value)) {
	    if (isArray(value)) {
	      return arrayToPropertyObject(value, ",");
	    }

	    return value;
	  }

	  var values = splitComma(value);

	  if (values.length > 1) {
	    return arrayToPropertyObject(values.map(function (v) {
	      return toPropertyObject(v);
	    }), ",");
	  }

	  values = splitSpace(value);

	  if (values.length > 1) {
	    return arrayToPropertyObject(values.map(function (v) {
	      return toPropertyObject(v);
	    }), " ");
	  }

	  values = /^(['"])([^'"]*)(['"])$/g.exec(value);

	  if (values && values[1] === values[3]) {
	    // Quotes
	    return new PropertyObject([toPropertyObject(values[2])], {
	      prefix: values[1],
	      suffix: values[1]
	    });
	  } else if (value.indexOf("(") !== -1) {
	    // color
	    return stringToBracketObject(value);
	  } else if (value.charAt(0) === "#") {
	    return stringToColorObject(value);
	  }

	  return value;
	}
	function toObject(object, result) {
	  if (result === void 0) {
	    result = {};
	  }

	  var model = object.model;

	  if (model) {
	    object.setOptions({
	      model: "",
	      suffix: "",
	      prefix: ""
	    });
	    var value = object.size() > 1 ? object : object.get(0);
	    result[model] = value;
	  } else {
	    object.forEach(function (obj) {
	      toObject(obj, result);
	    });
	  }

	  return result;
	}

	function isPropertyObject(value) {
	  return value instanceof PropertyObject;
	}
	function getType(value) {
	  var type = typeof value;

	  if (type === OBJECT) {
	    if (isArray(value)) {
	      return ARRAY;
	    } else if (isPropertyObject(value)) {
	      return PROPERTY;
	    }
	  } else if (type === STRING || type === NUMBER) {
	    return "value";
	  }

	  return type;
	}
	function isPureObject(obj) {
	  return isObject(obj) && obj.constructor === Object;
	}
	function getNames(names, stack) {
	  var arr = [];

	  if (isPureObject(names)) {
	    for (var name in names) {
	      stack.push(name);
	      arr = arr.concat(getNames(names[name], stack));
	      stack.pop();
	    }
	  } else {
	    arr.push(stack.slice());
	  }

	  return arr;
	}
	function updateFrame(names, properties) {
	  for (var name in properties) {
	    var value = properties[name];

	    if (!isPureObject(value)) {
	      names[name] = true;
	      continue;
	    }

	    if (!isObject(names[name])) {
	      names[name] = {};
	    }

	    updateFrame(names[name], properties[name]);
	  }

	  return names;
	}
	function toFixed(num) {
	  return Math.round(num * MAXIMUM) / MAXIMUM;
	}
	function getValueByNames(names, properties, length) {
	  if (length === void 0) {
	    length = names.length;
	  }

	  var value = properties;

	  for (var i = 0; i < length; ++i) {
	    if (!isObject(value)) {
	      return undefined;
	    }

	    value = value[names[i]];
	  }

	  return value;
	}
	function isInProperties(roles, args, isCheckTrue) {
	  var length = args.length;
	  var role = roles;

	  if (length === 0) {
	    return false;
	  }

	  for (var i = 0; i < length; ++i) {
	    if (role === true) {
	      return false;
	    }

	    role = role[args[i]];

	    if (!role || !isCheckTrue && role === true) {
	      return false;
	    }
	  }

	  return true;
	}
	function isRole(args, isCheckTrue) {
	  return isInProperties(ROLES, args, isCheckTrue);
	}
	function isFixed(args) {
	  return isInProperties(FIXED, args, true);
	}
	function setPlayCSS(item, isActivate) {
	  item.state[PLAY_CSS] = isActivate;
	}
	function isPausedCSS(item) {
	  return item.state[PLAY_CSS] && item.isPaused();
	}
	function isEndedCSS(item) {
	  return !item.isEnded() && item.state[PLAY_CSS];
	}
	function exportCSS(id, css) {
	  var styleId = PREFIX + "STYLE_" + toId(id);
	  var styleElement = $("#" + styleId);

	  if (styleElement) {
	    styleElement.innerText = css;
	  } else {
	    doc.body.insertAdjacentHTML("beforeend", "<style id=\"" + styleId + "\">" + css + "</style>");
	  }
	}
	function makeId(selector) {
	  for (;;) {
	    var id = "" + Math.floor(Math.random() * 10000000);

	    if (!IS_WINDOW || !selector) {
	      return id;
	    }

	    var checkElement = $("[data-scene-id=\"" + id + "\"]");

	    if (!checkElement) {
	      return id;
	    }
	  }
	}
	function getRealId(item) {
	  return item.getId() || item.setId(makeId(false)).getId();
	}
	function toId(text) {
	  return ("" + text).match(/[0-9a-zA-Z]+/g).join("");
	}
	function playCSS(item, isExportCSS, playClassName, properties) {
	  if (properties === void 0) {
	    properties = {};
	  }

	  if (!ANIMATION || item.getPlayState() === RUNNING) {
	    return;
	  }

	  var className = playClassName || START_ANIMATION;

	  if (isPausedCSS(item)) {
	    item.addPlayClass(true, className, properties);
	  } else {
	    if (item.isEnded()) {
	      item.setTime(0);
	    }

	    isExportCSS && item.exportCSS({
	      className: className
	    });
	    var el = item.addPlayClass(false, className, properties);

	    if (!el) {
	      return;
	    }

	    addAnimationEvent(item, el);
	    setPlayCSS(item, true);
	  }

	  item.setPlayState(RUNNING);
	}
	function addAnimationEvent(item, el) {
	  var state = item.state;
	  var duration = item.getDuration();
	  var isZeroDuration = !duration || !isFinite(duration);

	  var animationend = function () {
	    setPlayCSS(item, false);
	    item.finish();
	  };

	  var animationstart = function () {
	    item.trigger(PLAY);
	  };

	  item.once(ENDED, function () {
	    removeEvent(el, "animationcancel", animationend);
	    removeEvent(el, "animationend", animationend);
	    removeEvent(el, "animationiteration", animationiteration);
	    removeEvent(el, "animationstart", animationstart);
	  });

	  var animationiteration = function (_a) {
	    var elapsedTime = _a.elapsedTime;
	    var currentTime = elapsedTime;
	    var iterationCount = isZeroDuration ? 0 : currentTime / duration;
	    state[CURRENT_TIME] = currentTime;
	    item.setIteration(iterationCount);
	  };

	  addEvent(el, "animationcancel", animationend);
	  addEvent(el, "animationend", animationend);
	  addEvent(el, "animationiteration", animationiteration);
	  addEvent(el, "animationstart", animationstart);
	}
	function getEasing(curveArray) {
	  var easing;

	  if (isString(curveArray)) {
	    if (curveArray in EASINGS) {
	      easing = EASINGS[curveArray];
	    } else {
	      var obj = toPropertyObject(curveArray);

	      if (isString(obj)) {
	        return 0;
	      } else {
	        if (obj.model === "cubic-bezier") {
	          curveArray = obj.value.map(function (v) {
	            return parseFloat(v);
	          });
	          easing = bezier(curveArray[0], curveArray[1], curveArray[2], curveArray[3]);
	        } else if (obj.model === "steps") {
	          easing = steps(parseFloat(obj.value[0]), obj.value[1]);
	        } else {
	          return 0;
	        }
	      }
	    }
	  } else if (isArray(curveArray)) {
	    easing = bezier(curveArray[0], curveArray[1], curveArray[2], curveArray[3]);
	  } else {
	    easing = curveArray;
	  }

	  return easing;
	}

	function GetterSetter(getter, setter, parent) {
	  return function (constructor) {
	    var prototype = constructor.prototype;
	    getter.forEach(function (name) {
	      prototype[camelize("get " + name)] = function () {
	        return this[parent][name];
	      };
	    });
	    setter.forEach(function (name) {
	      prototype[camelize("set " + name)] = function (value) {
	        this[parent][name] = value;
	        return this;
	      };
	    });
	  };
	}

	function isDirectionReverse(iteration, iteraiontCount, direction) {
	  if (direction === REVERSE) {
	    return true;
	  } else if (iteraiontCount !== INFINITE && iteration === iteraiontCount && iteraiontCount % 1 === 0) {
	    return direction === (iteration % 2 >= 1 ? ALTERNATE_REVERSE : ALTERNATE);
	  }

	  return direction === (iteration % 2 >= 1 ? ALTERNATE : ALTERNATE_REVERSE);
	}
	/**
	* @typedef {Object} AnimatorState The Animator options. Properties used in css animation.
	* @property {number} [duration] The duration property defines how long an animation should take to complete one cycle.
	* @property {"none"|"forwards"|"backwards"|"both"} [fillMode] The fillMode property specifies a style for the element when the animation is not playing (before it starts, after it ends, or both).
	* @property {"infinite"|number} [iterationCount] The iterationCount property specifies the number of times an animation should be played.
	* @property {array|function} [easing] The easing(timing-function) specifies the speed curve of an animation.
	* @property {number} [delay] The delay property specifies a delay for the start of an animation.
	* @property {"normal"|"reverse"|"alternate"|"alternate-reverse"} [direction] The direction property defines whether an animation should be played forwards, backwards or in alternate cycles.
	*/

	var setters = ["id", ITERATION_COUNT, DELAY, FILL_MODE, DIRECTION, PLAY_SPEED, DURATION, PLAY_SPEED, ITERATION_TIME, PLAY_STATE];
	var getters = setters.concat([EASING, EASING_NAME]);
	/**
	* play video, animation, the others
	* @extends EventTrigger
	* @see {@link https://www.w3schools.com/css/css3_animations.asp|CSS3 Animation}
	*/

	var Animator =
	/*#__PURE__*/
	function (_super) {
	  __extends$3(Animator, _super);
	  /**
	   * @param - animator's options
	   * @example
	  const animator = new Animator({
	    delay: 2,
	    diretion: "alternate",
	    duration: 2,
	    fillMode: "forwards",
	    iterationCount: 3,
	    easing: Scene.easing.EASE,
	  });
	   */


	  function Animator(options) {
	    var _this = _super.call(this) || this;

	    _this.timerId = 0;
	    _this.state = {
	      id: "",
	      easing: 0,
	      easingName: "linear",
	      iterationCount: 1,
	      delay: 0,
	      fillMode: "forwards",
	      direction: NORMAL,
	      playSpeed: 1,
	      currentTime: 0,
	      iterationTime: -1,
	      iteration: 0,
	      tickTime: 0,
	      prevTime: 0,
	      playState: PAUSED,
	      duration: 0
	    };

	    _this.setOptions(options);

	    return _this;
	  }
	  /**
	    * set animator's easing.
	    * @param curverArray - The speed curve of an animation.
	    * @return {Animator} An instance itself.
	    * @example
	  animator.({
	    delay: 2,
	    diretion: "alternate",
	    duration: 2,
	    fillMode: "forwards",
	    iterationCount: 3,
	    easing: Scene.easing.EASE,
	  });
	    */


	  var __proto = Animator.prototype;

	  __proto.setEasing = function (curveArray) {
	    var easing = getEasing(curveArray);
	    var easingName = easing && easing[EASING_NAME] || "linear";
	    var state = this.state;
	    state[EASING] = easing;
	    state[EASING_NAME] = easingName;
	    return this;
	  };
	  /**
	    * set animator's options.
	    * @see {@link https://www.w3schools.com/css/css3_animations.asp|CSS3 Animation}
	    * @param - animator's options
	    * @return {Animator} An instance itself.
	    * @example
	  animator.({
	    delay: 2,
	    diretion: "alternate",
	    duration: 2,
	    fillMode: "forwards",
	    iterationCount: 3,
	    easing: Scene.eaasing.EASE,
	  });
	    */


	  __proto.setOptions = function (options) {
	    if (options === void 0) {
	      options = {};
	    }

	    for (var name in options) {
	      var value = options[name];

	      if (name === EASING) {
	        this.setEasing(value);
	        continue;
	      } else if (name === DURATION) {
	        value && this.setDuration(value);
	        continue;
	      }

	      if (OPTIONS.indexOf(name) > -1) {
	        this.state[name] = value;
	      }
	    }

	    return this;
	  };
	  /**
	    * Get the animator's total duration including delay
	    * @return {number} Total duration
	    * @example
	  animator.getTotalDuration();
	    */


	  __proto.getTotalDuration = function () {
	    return this.getActiveDuration(true);
	  };
	  /**
	    * Get the animator's total duration excluding delay
	    * @return {number} Total duration excluding delay
	    * @example
	  animator.getActiveDuration();
	    */


	  __proto.getActiveDuration = function (delay) {
	    var state = this.state;
	    var count = state[ITERATION_COUNT];

	    if (count === INFINITE) {
	      return Infinity;
	    }

	    return (delay ? state[DELAY] : 0) + this.getDuration() * count;
	  };
	  /**
	    * Check if the animator has reached the end.
	    * @return {boolean} ended
	    * @example
	  animator.isEnded(); // true or false
	    */


	  __proto.isEnded = function () {
	    if (this.state[TICK_TIME] === 0 && this.state[PLAY_STATE] === PAUSED) {
	      return true;
	    } else if (this.getTime() < this.getActiveDuration()) {
	      return false;
	    }

	    return true;
	  };
	  /**
	    *Check if the animator is paused:
	    * @return {boolean} paused
	    * @example
	  animator.isPaused(); // true or false
	    */


	  __proto.isPaused = function () {
	    return this.state[PLAY_STATE] === PAUSED;
	  };

	  __proto.start = function (delay) {
	    if (delay === void 0) {
	      delay = this.state[DELAY];
	    }

	    var state = this.state;
	    state[PLAY_STATE] = RUNNING;

	    if (state[TICK_TIME] >= delay) {
	      /**
	       * This event is fired when play animator.
	       * @event Animator#play
	       */
	      this.trigger(PLAY);
	      return true;
	    }

	    return false;
	  };
	  /**
	    * play animator
	    * @return {Animator} An instance itself.
	    */


	  __proto.play = function (toTime) {
	    var _this = this;

	    var state = this.state;
	    var delay = state[DELAY];
	    var currentTime = this.getTime();
	    state[PLAY_STATE] = RUNNING;

	    if (this.isEnded() && (currentTime === 0 || currentTime >= this.getActiveDuration())) {
	      this.setTime(-delay, true);
	    }

	    this.timerId = requestAnimationFrame(function (time) {
	      state[PREV_TIME] = time;

	      _this.tick(time, toTime);
	    });
	    this.start();
	    return this;
	  };
	  /**
	    * pause animator
	    * @return {Animator} An instance itself.
	    */


	  __proto.pause = function () {
	    var state = this.state;

	    if (state[PLAY_STATE] !== PAUSED) {
	      state[PLAY_STATE] = PAUSED;
	      /**
	       * This event is fired when animator is paused.
	       * @event Animator#paused
	       */

	      this.trigger(PAUSED);
	    }

	    cancelAnimationFrame(this.timerId);
	    return this;
	  };
	  /**
	     * end animator
	     * @return {Animator} An instance itself.
	    */


	  __proto.finish = function () {
	    this.setTime(0);
	    this.state[TICK_TIME] = 0;
	    this.end();
	    return this;
	  };
	  /**
	     * end animator
	     * @return {Animator} An instance itself.
	    */


	  __proto.end = function () {
	    this.pause();
	    /**
	         * This event is fired when animator is ended.
	         * @event Animator#ended
	         */

	    this.trigger(ENDED);
	    return this;
	  };
	  /**
	    * set currentTime
	    * @param {Number|String} time - currentTime
	    * @return {Animator} An instance itself.
	    * @example
	  animator.setTime("from"); // 0
	  animator.setTime("to"); // 100%
	  animator.setTime("50%");
	  animator.setTime(10);
	  animator.getTime() // 10
	    */


	  __proto.setTime = function (time, isTick, isParent) {
	    var activeDuration = this.getActiveDuration();
	    var state = this.state;
	    var prevTime = state[TICK_TIME];
	    var delay = state[DELAY];
	    var currentTime = isTick ? time : this.getUnitTime(time);
	    state[TICK_TIME] = delay + currentTime;

	    if (currentTime < 0) {
	      currentTime = 0;
	    } else if (currentTime > activeDuration) {
	      currentTime = activeDuration;
	    }

	    state[CURRENT_TIME] = currentTime;
	    this.calculate();

	    if (isTick && !isParent) {
	      var tickTime = state[TICK_TIME];

	      if (prevTime < delay && time >= 0) {
	        this.start(0);
	      }

	      if (tickTime < prevTime || this.isEnded()) {
	        this.end();
	        return;
	      }
	    }

	    if (this.isDelay()) {
	      return this;
	    }
	    /**
	         * This event is fired when the animator updates the time.
	         * @event Animator#timeupdate
	         * @param {Object} param The object of data to be sent to an event.
	         * @param {Number} param.currentTime The total time that the animator is running.
	         * @param {Number} param.time The iteration time during duration that the animator is running.
	         * @param {Number} param.iterationCount The iteration count that the animator is running.
	         */


	    this.trigger(TIMEUPDATE, {
	      currentTime: currentTime,
	      time: this.getIterationTime(),
	      iterationCount: state[ITERATION]
	    });
	    return this;
	  };
	  /**
	    * Get the animator's current time
	    * @return {number} current time
	    * @example
	  animator.getTime();
	    */


	  __proto.getTime = function () {
	    return this.state[CURRENT_TIME];
	  };

	  __proto.getUnitTime = function (time) {
	    if (isString(time)) {
	      var duration = this.getDuration() || 100;

	      if (time === "from") {
	        return 0;
	      } else if (time === "to") {
	        return duration;
	      }

	      var _a = splitUnit(time),
	          unit = _a.unit,
	          value = _a.value;

	      if (unit === "%") {
	        !this.getDuration() && this.setDuration(duration);
	        return toFixed(parseFloat(time) / 100 * duration);
	      } else if (unit === ">") {
	        return value + THRESHOLD;
	      } else {
	        return value;
	      }
	    } else {
	      return toFixed(time);
	    }
	  };
	  /**
	     * Check if the current state of animator is delayed.
	     * @return {boolean} check delay state
	     */


	  __proto.isDelay = function () {
	    var state = this.state;
	    var delay = state[DELAY];
	    var tickTime = state[TICK_TIME];
	    return delay > 0 && tickTime < delay;
	  };

	  __proto.setIteration = function (iterationCount) {
	    var state = this.state;
	    var passIterationCount = Math.floor(iterationCount);
	    var maxIterationCount = state[ITERATION_COUNT] === INFINITE ? Infinity : state[ITERATION_COUNT];

	    if (state[ITERATION] < passIterationCount && passIterationCount < maxIterationCount) {
	      /**
	            * The event is fired when an iteration of an animation ends.
	            * @event Animator#iteration
	            * @param {Object} param The object of data to be sent to an event.
	            * @param {Number} param.currentTime The total time that the animator is running.
	            * @param {Number} param.iterationCount The iteration count that the animator is running.
	            */
	      this.trigger("iteration", {
	        currentTime: state[CURRENT_TIME],
	        iterationCount: passIterationCount
	      });
	    }

	    state[ITERATION] = iterationCount;
	    return this;
	  };

	  __proto.calculate = function () {
	    var state = this.state;
	    var iterationCount = state[ITERATION_COUNT];
	    var fillMode = state[FILL_MODE];
	    var direction = state[DIRECTION];
	    var duration = this.getDuration();
	    var time = this.getTime();
	    var iteration = duration === 0 ? 0 : time / duration;
	    var currentIterationTime = duration ? time % duration : 0;

	    if (!duration) {
	      this.setIterationTime(0);
	      return this;
	    }

	    this.setIteration(iteration); // direction : normal, reverse, alternate, alternate-reverse
	    // fillMode : forwards, backwards, both, none

	    var isReverse = isDirectionReverse(iteration, iterationCount, direction);
	    var isFiniteDuration = isFinite(duration);

	    if (isFiniteDuration && isReverse) {
	      currentIterationTime = duration - currentIterationTime;
	    }

	    if (isFiniteDuration && iterationCount !== INFINITE) {
	      var isForwards = fillMode === "both" || fillMode === "forwards"; // fill forwards

	      if (iteration >= iterationCount) {
	        currentIterationTime = duration * (isForwards ? iterationCount % 1 || 1 : 0);
	        isReverse && (currentIterationTime = duration - currentIterationTime);
	      }
	    }

	    this.setIterationTime(currentIterationTime);
	    return this;
	  };

	  __proto.tick = function (now, to) {
	    var _this = this;

	    if (this.isPaused()) {
	      return;
	    }

	    var state = this.state;
	    var playSpeed = state[PLAY_SPEED];
	    var prevTime = state[PREV_TIME];
	    var delay = state[DELAY];
	    var tickTime = state[TICK_TIME];
	    var currentTime = tickTime + Math.min(1000, now - prevTime) / 1000 * playSpeed;
	    state[PREV_TIME] = now;
	    this.setTime(currentTime - delay, true);

	    if (to && to * 1000 < now) {
	      this.pause();
	    }

	    if (state[PLAY_STATE] === PAUSED) {
	      return;
	    }

	    this.timerId = requestAnimationFrame(function (time) {
	      _this.tick(time, to);
	    });
	  };

	  Animator = __decorate([GetterSetter(getters, setters, "state")], Animator);
	  return Animator;
	}(EventTrigger);

	function toInnerProperties(obj) {
	  if (!obj) {
	    return "";
	  }

	  var arrObj = [];

	  for (var name in obj) {
	    arrObj.push(name.replace(/\d$/g, "") + "(" + obj[name] + ")");
	  }

	  return arrObj.join(" ");
	}
	/* eslint-disable */


	function clone(target, toValue) {
	  if (toValue === void 0) {
	    toValue = false;
	  }

	  return merge({}, target, toValue);
	}

	function merge(to, from, toValue) {
	  if (toValue === void 0) {
	    toValue = false;
	  }

	  for (var name in from) {
	    var value = from[name];
	    var type = getType(value);

	    if (type === PROPERTY) {
	      to[name] = toValue ? value.toValue() : value.clone();
	    } else if (type === FUNCTION) {
	      to[name] = toValue ? getValue([name], value) : value;
	    } else if (type === ARRAY) {
	      to[name] = value.slice();
	    } else if (type === OBJECT) {
	      if (isObject(to[name]) && !isPropertyObject(to[name])) {
	        merge(to[name], value, toValue);
	      } else {
	        to[name] = clone(value, toValue);
	      }
	    } else {
	      to[name] = from[name];
	    }
	  }

	  return to;
	}
	/* eslint-enable */


	function getPropertyName(args) {
	  return args[0] in ALIAS ? ALIAS[args[0]] : args;
	}

	function getValue(names, value) {
	  var type = getType(value);

	  if (type === PROPERTY) {
	    return value.toValue();
	  } else if (type === FUNCTION) {
	    if (names[0] !== TIMING_FUNCTION) {
	      return getValue(names, value());
	    }
	  } else if (type === OBJECT) {
	    return clone(value, true);
	  }

	  return value;
	}
	/**
	* Animation's Frame
	*/


	var Frame =
	/*#__PURE__*/
	function () {
	  /**
	   * @param - properties
	   * @example
	  const frame = new Scene.Frame({
	    display: "none"
	    transform: {
	        translate: "50px",
	        scale: "5, 5",
	    }
	  });
	   */
	  function Frame(properties) {
	    if (properties === void 0) {
	      properties = {};
	    }

	    this.properties = {};
	    this.set(properties);
	  }
	  /**
	    * get property value
	    * @param {...Number|String|PropertyObject} args - property name or value
	    * @example
	    frame.get("display") // => "none", "block", ....
	    frame.get("transform", "translate") // => "10px,10px"
	    */


	  var __proto = Frame.prototype;

	  __proto.get = function () {
	    var args = [];

	    for (var _i = 0; _i < arguments.length; _i++) {
	      args[_i] = arguments[_i];
	    }

	    var value = this.raw.apply(this, args);
	    return getValue(getPropertyName(args), value);
	  };

	  __proto.raw = function () {
	    var args = [];

	    for (var _i = 0; _i < arguments.length; _i++) {
	      args[_i] = arguments[_i];
	    }

	    return getValueByNames(getPropertyName(args), this.properties);
	  };
	  /**
	    * remove property value
	    * @param {...String} args - property name
	    * @return {Frame} An instance itself
	    * @example
	    frame.remove("display")
	    */


	  __proto.remove = function () {
	    var args = [];

	    for (var _i = 0; _i < arguments.length; _i++) {
	      args[_i] = arguments[_i];
	    }

	    var params = getPropertyName(args);
	    var length = params.length;

	    if (!length) {
	      return this;
	    }

	    var value = getValueByNames(params, this.properties, length - 1);

	    if (isObject(value)) {
	      delete value[params[length - 1]];
	    }

	    return this;
	  };
	  /**
	    * set property
	    * @param {...Number|String|PropertyObject} args - property names or values
	    * @return {Frame} An instance itself
	    * @example
	  // one parameter
	  frame.set({
	    display: "none",
	    transform: {
	        translate: "10px, 10px",
	        scale: "1",
	    },
	    filter: {
	        brightness: "50%",
	        grayscale: "100%"
	    }
	  });
	  // two parameters
	  frame.set("transform", {
	    translate: "10px, 10px",
	    scale: "1",
	  });
	  // three parameters
	  frame.set("transform", "translate", "50px");
	  */


	  __proto.set = function () {
	    var args = [];

	    for (var _i = 0; _i < arguments.length; _i++) {
	      args[_i] = arguments[_i];
	    }

	    var self = this;
	    var length = args.length;
	    var params = args.slice(0, -1);
	    var value = args[length - 1];

	    if (params[0] in ALIAS) {
	      self._set(ALIAS[params[0]], value);
	    } else if (length === 2 && isArray(params[0])) {
	      self._set(params[0], value);
	    } else if (isArray(value)) {
	      self._set(params, value);
	    } else if (isPropertyObject(value)) {
	      if (isRole(params)) {
	        self.set.apply(self, params.concat([toObject(value)]));
	      } else {
	        self._set(params, value);
	      }
	    } else if (isObject(value)) {
	      if (!self.has.apply(self, params) && isRole(params)) {
	        self._set(params, {});
	      }

	      for (var name in value) {
	        self.set.apply(self, params.concat([name, value[name]]));
	      }
	    } else if (isString(value)) {
	      if (isRole(params, true)) {
	        if (isFixed(params) || !isRole(params)) {
	          this._set(params, value);
	        } else {
	          var obj = toPropertyObject(value);

	          if (isObject(obj)) {
	            self.set.apply(self, params.concat([obj]));
	          }
	        }

	        return this;
	      } else {
	        var _a = splitStyle(value),
	            styles = _a.styles,
	            stylesLength = _a.length;

	        for (var name in styles) {
	          self.set.apply(self, params.concat([name, styles[name]]));
	        }

	        if (stylesLength) {
	          return this;
	        }
	      }

	      self._set(params, value);
	    } else {
	      self._set(params, value);
	    }

	    return self;
	  };
	  /**
	    * Gets the names of properties.
	    * @return the names of properties.
	    * @example
	  // one parameter
	  frame.set({
	    display: "none",
	    transform: {
	        translate: "10px, 10px",
	        scale: "1",
	    },
	  });
	  // [["display"], ["transform", "translate"], ["transform", "scale"]]
	  console.log(frame.getNames());
	  */


	  __proto.getNames = function () {
	    return getNames(this.properties, []);
	  };
	  /**
	    * check that has property.
	    * @param {...String} args - property name
	    * @example
	    frame.has("property", "display") // => true or false
	    */


	  __proto.has = function () {
	    var args = [];

	    for (var _i = 0; _i < arguments.length; _i++) {
	      args[_i] = arguments[_i];
	    }

	    var params = getPropertyName(args);
	    var length = params.length;

	    if (!length) {
	      return false;
	    }

	    return !isUndefined(getValueByNames(params, this.properties, length));
	  };
	  /**
	    * clone frame.
	    * @return {Frame} An instance of clone
	    * @example
	    frame.clone();
	    */


	  __proto.clone = function () {
	    var frame = new Frame();
	    return frame.merge(this);
	  };
	  /**
	    * merge one frame to other frame.
	    * @param - target frame.
	    * @return {Frame} An instance itself
	    * @example
	    frame.merge(frame2);
	    */


	  __proto.merge = function (frame) {
	    var properties = this.properties;
	    var frameProperties = frame.properties;

	    if (!frameProperties) {
	      return this;
	    }

	    merge(properties, frameProperties);
	    return this;
	  };
	  /**
	    * Specifies an css object that coverted the frame.
	    * @return {object} cssObject
	    */


	  __proto.toCSSObject = function () {
	    var properties = this.get();
	    var cssObject = {};

	    for (var name in properties) {
	      if (isRole([name], true)) {
	        continue;
	      }

	      var value = properties[name];

	      if (name === TIMING_FUNCTION) {
	        cssObject[TIMING_FUNCTION.replace("animation", ANIMATION)] = (isString(value) ? value : value[EASING_NAME]) || "initial";
	        continue;
	      }

	      cssObject[name] = value;
	    }

	    var transform = toInnerProperties(properties[TRANSFORM_NAME]);
	    var filter = toInnerProperties(properties.filter);
	    TRANSFORM && transform && (cssObject[TRANSFORM] = transform);
	    FILTER && filter && (cssObject[FILTER] = filter);
	    return cssObject;
	  };
	  /**
	    * Specifies an css text that coverted the frame.
	    * @return {string} cssText
	    */


	  __proto.toCSS = function () {
	    var cssObject = this.toCSSObject();
	    var cssArray = [];

	    for (var name in cssObject) {
	      cssArray.push(name + ":" + cssObject[name] + ";");
	    }

	    return cssArray.join("");
	  };

	  __proto._set = function (args, value) {
	    var properties = this.properties;
	    var length = args.length;

	    for (var i = 0; i < length - 1; ++i) {
	      var name = args[i];
	      !(name in properties) && (properties[name] = {});
	      properties = properties[name];
	    }

	    if (!length) {
	      return;
	    }

	    if (args.length === 1 && args[0] === TIMING_FUNCTION) {
	      properties[TIMING_FUNCTION] = getEasing(value);
	    } else {
	      properties[args[length - 1]] = isString(value) ? toPropertyObject(value) : value;
	    }
	  };

	  return Frame;
	}();

	function dotArray(a1, a2, b1, b2) {
	  var length = a2.length;
	  return a1.map(function (v1, i) {
	    if (i >= length) {
	      return v1;
	    } else {
	      return dot$1(v1, a2[i], b1, b2);
	    }
	  });
	}

	function dotColor(color1, color2, b1, b2) {
	  // convert array to PropertyObject(type=color)
	  var value1 = color1.value;
	  var value2 = color2.value; // If the model name is not same, the inner product is impossible.

	  var model1 = color1.model;
	  var model2 = color2.model;

	  if (model1 !== model2) {
	    // It is recognized as a string.
	    return dot$1(color1.toValue(), color2.toValue(), b1, b2);
	  }

	  if (value1.length === 3) {
	    value1[3] = 1;
	  }

	  if (value2.length === 3) {
	    value2[3] = 1;
	  }

	  var v = dotArray(value1, value2, b1, b2);
	  var colorModel = model1;

	  for (var i = 0; i < 3; ++i) {
	    v[i] = parseInt(v[i], 10);
	  }

	  var object = new PropertyObject(v, {
	    type: "color",
	    model: colorModel,
	    prefix: colorModel + "(",
	    suffix: ")"
	  });
	  return object;
	}

	function dotObject(a1, a2, b1, b2) {
	  var a1Type = a1.type;

	  if (a1Type === "color") {
	    return dotColor(a1, a2, b1, b2);
	  }

	  var value1 = a1.value;
	  var value2 = a2.value;
	  var arr = dotArray(value1, value2, b1, b2);
	  return new PropertyObject(arr, {
	    type: a1Type,
	    separator: a1.separator || a2.separator,
	    prefix: a1.prefix || a2.prefix,
	    suffix: a1.suffix || a2.suffix,
	    model: a1.model || a2.model
	  });
	}
	/**
	* The dot product of a1 and a2 for the b1 and b2.
	* @memberof Dot
	* @function dot
	* @param {String|Number|PropertyObject} a1 value1
	* @param {String|Number|PropertyObject} a2 value2
	* @param {Number} b1 b1 ratio
	* @param {Number} b2 b2 ratio
	* @return {String} Not Array, Not Separator, Only Number & Unit
	* @return {PropertyObject} Array with Separator.
	* @example
	dot(1, 3, 0.3, 0.7);
	// => 1.6
	*/


	function dot$1(a1, a2, b1, b2) {
	  if (b2 === 0) {
	    return a2;
	  } else if (b1 === 0 || b1 + b2 === 0) {
	    // prevent division by zero.
	    return a1;
	  } // dot Object


	  var type1 = getType(a1);
	  var type2 = getType(a2);
	  var isFunction1 = type1 === FUNCTION;
	  var isFunction2 = type2 === FUNCTION;

	  if (isFunction1 || isFunction2) {
	    return function () {
	      return dot$1(isFunction1 ? toPropertyObject(a1()) : a1, isFunction2 ? toPropertyObject(a2()) : a2, b1, b2);
	    };
	  } else if (type1 === type2) {
	    if (type1 === PROPERTY) {
	      return dotObject(a1, a2, b1, b2);
	    } else if (type1 === ARRAY) {
	      return dotArray(a1, a2, b1, b2);
	    } else if (type1 !== "value") {
	      return a1;
	    }
	  } else {
	    return a1;
	  }

	  var v1 = splitUnit("" + a1);
	  var v2 = splitUnit("" + a2);
	  var v; // 숫자가 아닐경우 첫번째 값을 반환 b2가 0일경우 두번째 값을 반환

	  if (isNaN(v1.value) || isNaN(v2.value)) {
	    return a1;
	  } else {
	    v = dot(v1.value, v2.value, b1, b2);
	  }

	  var prefix = v1.prefix || v2.prefix;
	  var unit = v1.unit || v2.unit;

	  if (!prefix && !unit) {
	    return v;
	  }

	  return prefix + v + unit;
	}
	function dotValue(time, prevTime, nextTime, prevValue, nextValue, easing) {
	  if (time === prevTime) {
	    return prevValue;
	  } else if (time === nextTime) {
	    return nextValue;
	  } else if (!easing) {
	    return dot$1(prevValue, nextValue, time - prevTime, nextTime - time);
	  }

	  var ratio = easing((time - prevTime) / (nextTime - prevTime));
	  var value = dot$1(prevValue, nextValue, ratio, 1 - ratio);
	  return value;
	}

	function getNearTimeIndex(times, time) {
	  var length = times.length;

	  for (var i = 0; i < length; ++i) {
	    if (times[i] === time) {
	      return [i, i];
	    } else if (times[i] > time) {
	      return [i > 0 ? i - 1 : 0, i];
	    }
	  }

	  return [length - 1, length - 1];
	}

	function makeAnimationProperties(properties) {
	  var cssArray = [];

	  for (var name in properties) {
	    cssArray.push(ANIMATION + "-" + decamelize(name) + ":" + properties[name] + ";");
	  }

	  return cssArray.join("");
	}

	function addTime(times, time) {
	  var length = times.length;

	  for (var i = 0; i < length; ++i) {
	    if (time < times[i]) {
	      times.splice(i, 0, time);
	      return;
	    }
	  }

	  times[length] = time;
	}

	function addEntry(entries, time, keytime) {
	  var prevEntry = entries[entries.length - 1];
	  (!prevEntry || prevEntry[0] !== time || prevEntry[1] !== keytime) && entries.push([toFixed(time), toFixed(keytime)]);
	}

	function getEntries(times, states) {
	  var entries = times.map(function (time) {
	    return [time, time];
	  });
	  var nextEntries = [];
	  states.forEach(function (state) {
	    var iterationCount = state[ITERATION_COUNT];
	    var delay = state[DELAY];
	    var playSpeed = state[PLAY_SPEED];
	    var direction = state[DIRECTION];
	    var intCount = Math.ceil(iterationCount);
	    var currentDuration = entries[entries.length - 1][0];
	    var length = entries.length;
	    var lastTime = currentDuration * iterationCount;

	    for (var i = 0; i < intCount; ++i) {
	      var isReverse = direction === REVERSE || direction === ALTERNATE && i % 2 || direction === ALTERNATE_REVERSE && !(i % 2);

	      for (var j = 0; j < length; ++j) {
	        var entry = entries[isReverse ? length - j - 1 : j];
	        var time = entry[1];
	        var currentTime = currentDuration * i + (isReverse ? currentDuration - entry[0] : entry[0]);
	        var prevEntry = entries[isReverse ? length - j : j - 1];

	        if (currentTime > lastTime) {
	          if (j !== 0) {
	            var prevTime = currentDuration * i + (isReverse ? currentDuration - prevEntry[0] : prevEntry[0]);
	            var divideTime = dot(prevEntry[1], time, lastTime - prevTime, currentTime - lastTime);
	            addEntry(nextEntries, (delay + currentDuration * iterationCount) / playSpeed, divideTime);
	          }

	          break;
	        } else if (currentTime === lastTime && nextEntries.length && nextEntries[nextEntries.length - 1][0] === lastTime + delay) {
	          break;
	        }

	        addEntry(nextEntries, (delay + currentTime) / playSpeed, time);
	      }
	    } // delay time


	    delay && nextEntries.unshift([0, nextEntries[0][1]]);
	    entries = nextEntries;
	    nextEntries = [];
	  });
	  return entries;
	}
	/**
	* manage Frame Keyframes and play keyframes.
	* @extends Animator
	* @example
	const item = new SceneItem({
	    0: {
	        display: "none",
	    },
	    1: {
	        display: "block",
	        opacity: 0,
	    },
	    2: {
	        opacity: 1,
	    }
	});
	*/

	var SceneItem =
	/*#__PURE__*/
	function (_super) {
	  __extends$3(SceneItem, _super);
	  /**
	    * @param - properties
	    * @param - options
	    * @example
	    const item = new SceneItem({
	        0: {
	            display: "none",
	        },
	        1: {
	            display: "block",
	            opacity: 0,
	        },
	        2: {
	            opacity: 1,
	        }
	    });
	     */


	  function SceneItem(properties, options) {
	    var _this = _super.call(this) || this;

	    _this.times = [];
	    _this.items = {};
	    _this.names = {};
	    _this.elements = [];
	    _this.needUpdate = true;

	    _this.load(properties, options);

	    return _this;
	  }

	  var __proto = SceneItem.prototype;

	  __proto.getDuration = function () {
	    var times = this.times;
	    var length = times.length;
	    return (length === 0 ? 0 : times[length - 1]) || this.state[DURATION];
	  };
	  /**
	    * get size of list
	    * @return {Number} length of list
	    */


	  __proto.size = function () {
	    return this.times.length;
	  };

	  __proto.setDuration = function (duration) {
	    if (!duration) {
	      return this;
	    }

	    var originalDuration = this.getDuration();

	    if (originalDuration > 0) {
	      var ratio_1 = duration / originalDuration;

	      var _a = this,
	          times = _a.times,
	          items_1 = _a.items;

	      var obj_1 = {};
	      this.times = times.map(function (time) {
	        var time2 = toFixed(time * ratio_1);
	        obj_1[time2] = items_1[time];
	        return time2;
	      });
	      this.items = obj_1;
	    } else {
	      this.newFrame(duration);
	    }

	    return this;
	  };

	  __proto.setId = function (id) {
	    var state = this.state;
	    state.id = id || makeId(!!length);
	    var elements = this.elements;

	    if (elements.length && !state[SELECTOR]) {
	      var sceneId_1 = toId(this.getId());
	      state[SELECTOR] = "[" + DATA_SCENE_ID + "=\"" + sceneId_1 + "\"]";
	      elements.forEach(function (element) {
	        element.setAttribute(DATA_SCENE_ID, sceneId_1);
	      });
	    }

	    return this;
	  };
	  /**
	    * Set properties to the sceneItem at that time
	    * @param {Number} time - time
	    * @param {...String|Object} [properties] - property names or values
	    * @return {SceneItem} An instance itself
	    * @example
	  item.set(0, "a", "b") // item.getFrame(0).set("a", "b")
	  console.log(item.get(0, "a")); // "b"
	    */


	  __proto.set = function (time) {
	    var _this = this;

	    var args = [];

	    for (var _i = 1; _i < arguments.length; _i++) {
	      args[_i - 1] = arguments[_i];
	    }

	    if (isArray(time)) {
	      var length = time.length;

	      for (var i = 0; i < length; ++i) {
	        var t = length === 1 ? 0 : this.getUnitTime(i / (length - 1) * 100 + "%");
	        this.set(t, time[i]);
	      }
	    } else if (isObject(time)) {
	      var _loop_1 = function (t) {
	        var value = time[t];
	        var realTime = this_1.getUnitTime(t);

	        if (isNaN(realTime)) {
	          getNames(value, [t]).forEach(function (names) {
	            var innerValue = getValueByNames(names.slice(1), value);
	            var arr = isArray(innerValue) ? innerValue : [getValueByNames(names, _this.target), innerValue];
	            var length = arr.length;

	            for (var i = 0; i < length; ++i) {
	              _this.newFrame(i / (length - 1) * 100 + "%").set(names, arr[i]);
	            }
	          });
	        } else {
	          this_1.set(realTime, value);
	        }
	      };

	      var this_1 = this;

	      for (var t in time) {
	        _loop_1(t);
	      }
	    } else {
	      var value = args[0];

	      if (value instanceof Frame) {
	        this.setFrame(time, value);
	      } else if (value instanceof SceneItem) {
	        var delay = value.getDelay();
	        var realTime = this.getUnitTime(time);
	        var frames = value.toObject(!this.hasFrame(realTime + delay));
	        var duration = value.getDuration();
	        var direction = value.getDirection();
	        var isReverse = direction.indexOf("reverse") > -1;

	        for (var frameTime in frames) {
	          var nextTime = isReverse ? duration - parseFloat(frameTime) : parseFloat(frameTime);
	          this.set(realTime + nextTime, frames[frameTime]);
	        }
	      } else if (args.length === 1 && isArray(value)) {
	        value.forEach(function (item) {
	          _this.set(time, item);
	        });
	      } else {
	        var frame = this.newFrame(time);
	        frame.set.apply(frame, args);
	      }
	    }

	    this.needUpdate = true;
	    return this;
	  };
	  /**
	    * Get properties of the sceneItem at that time
	    * @param {Number} time - time
	    * @param {...String|Object} args property's name or properties
	    * @return {Number|String|PropertyObejct} property value
	    * @example
	  item.get(0, "a"); // item.getFrame(0).get("a");
	  item.get(0, "transform", "translate"); // item.getFrame(0).get("transform", "translate");
	    */


	  __proto.get = function (time) {
	    var args = [];

	    for (var _i = 1; _i < arguments.length; _i++) {
	      args[_i - 1] = arguments[_i];
	    }

	    var frame = this.getFrame(time);
	    return frame && frame.get.apply(frame, args);
	  };
	  /**
	    * remove properties to the sceneItem at that time
	    * @param {Number} time - time
	    * @param {...String|Object} [properties] - property names or values
	    * @return {SceneItem} An instance itself
	    * @example
	  item.remove(0, "a");
	    */


	  __proto.remove = function (time) {
	    var args = [];

	    for (var _i = 1; _i < arguments.length; _i++) {
	      args[_i - 1] = arguments[_i];
	    }

	    if (args.length) {
	      var frame = this.getFrame(time);
	      frame && frame.remove.apply(frame, args);
	    } else {
	      this.removeFrame(time);
	    }

	    this.needUpdate = true;
	    return this;
	  };
	  /**
	    * Append the item or object at the last time.
	    * @param - the scene item or item object
	    * @return An instance itself
	    * @example
	  item.append(new SceneItem({
	    0: {
	        opacity: 0,
	    },
	    1: {
	        opacity: 1,
	    }
	  }));
	  item.append({
	    0: {
	        opacity: 0,
	    },
	    1: {
	        opacity: 1,
	    }
	  });
	  item.set(item.getDuration(), {
	    0: {
	        opacity: 0,
	    },
	    1: {
	        opacity: 1,
	    }
	  });
	    */


	  __proto.append = function (item) {
	    if (item instanceof SceneItem) {
	      this.set(this.getDuration(), item);
	    } else {
	      this.append(new SceneItem(item));
	    }

	    return this;
	  };
	  /**
	    * Push the front frames for the time and prepend the scene item or item object.
	    * @param - the scene item or item object
	    * @return An instance itself
	    */


	  __proto.prepend = function (item) {
	    if (item instanceof SceneItem) {
	      var unshiftTime = item.getDuration() + item.getDelay();
	      var firstFrame = this.getFrame(0); // remove first frame

	      this.removeFrame(0);
	      this.unshift(unshiftTime);
	      this.set(0, item);
	      this.set(unshiftTime + THRESHOLD, firstFrame);
	    } else {
	      this.prepend(new SceneItem(item));
	    }

	    return this;
	  };
	  /**
	   * Push out the amount of time.
	   * @param - time to push
	   * @example
	  item.get(0); // frame 0
	  item.unshift(3);
	  item.get(3) // frame 0
	   */


	  __proto.unshift = function (time) {
	    var _a = this,
	        times = _a.times,
	        items = _a.items;

	    var obj = {};
	    this.times = times.map(function (t) {
	      var time2 = toFixed(time + t);
	      obj[time2] = items[t];
	      return time2;
	    });
	    this.items = obj;
	    return this;
	  };
	  /**
	   * Get the frames in the item in object form.
	   * @return {}
	   * @example
	  item.toObject();
	  // {0: {display: "none"}, 1: {display: "block"}}
	   */


	  __proto.toObject = function (isStartZero) {
	    if (isStartZero === void 0) {
	      isStartZero = true;
	    }

	    var obj = {};
	    var delay = this.getDelay();
	    this.forEach(function (frame, time) {
	      obj[(!time && !isStartZero ? THRESHOLD : 0) + delay + time] = frame.clone();
	    });
	    return obj;
	  };
	  /**
	   * Specifies an element to synchronize items' keyframes.
	   * @param {string} selectors - Selectors to find elements in items.
	   * @return {SceneItem} An instance itself
	   * @example
	  item.setSelector("#id.class");
	   */


	  __proto.setSelector = function (target) {
	    if (isFunction(target)) {
	      this.setElement(target(this.getId()));
	    } else {
	      this.setElement(target);
	    }

	    return this;
	  };
	  /**
	   * Get the elements connected to SceneItem.
	   */


	  __proto.getElements = function () {
	    return this.elements;
	  };
	  /**
	   * Specifies an element to synchronize item's keyframes.
	   * @param - elements to synchronize item's keyframes.
	   * @param - Make sure that you have peusdo.
	   * @return {SceneItem} An instance itself
	   * @example
	  item.setElement(document.querySelector("#id.class"));
	  item.setElement(document.querySelectorAll(".class"));
	   */


	  __proto.setElements = function (target) {
	    return this.setElement(target);
	  };
	  /**
	   * Specifies an element to synchronize item's keyframes.
	   * @param - elements to synchronize item's keyframes.
	   * @param - Make sure that you have peusdo.
	   * @return {SceneItem} An instance itself
	   * @example
	  item.setElement(document.querySelector("#id.class"));
	  item.setElement(document.querySelectorAll(".class"));
	   */


	  __proto.setElement = function (target) {
	    var state = this.state;
	    var elements = [];

	    if (!target) {
	      return this;
	    } else if (target === true || isString(target)) {
	      var selector = target === true ? "" + state.id : target;
	      var matches = /([\s\S]+)(:+[a-zA-Z]+)$/g.exec(selector);
	      elements = toArray($(matches ? matches[1] : selector, true));
	      state[SELECTOR] = selector;
	    } else {
	      elements = target instanceof Element ? [target] : toArray(target);
	    }

	    if (!elements.length) {
	      return this;
	    }

	    this.elements = elements;
	    this.setId(this.getId());
	    this.target = elements[0].style;

	    this.targetFunc = function (frame) {
	      var attributes = frame.get("attribute");

	      if (attributes) {
	        var _loop_2 = function (name) {
	          elements.forEach(function (el) {
	            el.setAttribute(name, attributes[name]);
	          });
	        };

	        for (var name in attributes) {
	          _loop_2(name);
	        }
	      }

	      var cssText = frame.toCSS();

	      if (state.cssText !== cssText) {
	        state.cssText = cssText;
	        elements.forEach(function (el) {
	          el.style.cssText += cssText;
	        });
	        return frame;
	      }
	    };

	    return this;
	  };

	  __proto.setTarget = function (target) {
	    this.target = target;

	    this.targetFunc = function (frame) {
	      var obj = frame.get();

	      for (var name in obj) {
	        target[name] = obj[name];
	      }
	    };

	    return this;
	  };
	  /**
	    * add css styles of items's element to the frame at that time.
	    * @param {Array} properties - elements to synchronize item's keyframes.
	    * @return {SceneItem} An instance itself
	    * @example
	  item.setElement(document.querySelector("#id.class"));
	  item.setCSS(0, ["opacity"]);
	  item.setCSS(0, ["opacity", "width", "height"]);
	    */


	  __proto.setCSS = function (time, properties) {
	    this.set(time, fromCSS(this.elements, properties));
	    return this;
	  };

	  __proto.setTime = function (time, isTick, isParent, parentEasing) {
	    _super.prototype.setTime.call(this, time, isTick, isParent);

	    var iterationTime = this.getIterationTime();
	    var easing = this.getEasing() || parentEasing;
	    var frame = this.getNowFrame(iterationTime, easing);
	    var currentTime = this.getTime();
	    this.temp = frame;
	    /**
	         * This event is fired when timeupdate and animate.
	         * @event SceneItem#animate
	         * @param {Number} param.currentTime The total time that the animator is running.
	         * @param {Number} param.time The iteration time during duration that the animator is running.
	         * @param {Frame} param.frame frame of that time.
	         */

	    this.trigger("animate", {
	      frame: frame,
	      currentTime: currentTime,
	      time: iterationTime
	    });
	    this.targetFunc && this.targetFunc(frame);
	    return this;
	  };
	  /**
	    * update property names used in frames.
	    * @return {SceneItem} An instance itself
	    * @example
	  item.update();
	    */


	  __proto.update = function () {
	    var names = {};
	    this.forEach(function (frame) {
	      updateFrame(names, frame.properties);
	    });
	    this.names = names;
	    this.needUpdate = false;
	    return this;
	  };
	  /**
	    * Create and add a frame to the sceneItem at that time
	    * @param {Number} time - frame's time
	    * @return {Frame} Created frame.
	    * @example
	  item.newFrame(time);
	    */


	  __proto.newFrame = function (time) {
	    var frame = this.getFrame(time);

	    if (frame) {
	      return frame;
	    }

	    frame = new Frame();
	    this.setFrame(time, frame);
	    return frame;
	  };
	  /**
	    * Add a frame to the sceneItem at that time
	    * @param {Number} time - frame's time
	    * @return {SceneItem} An instance itself
	    * @example
	  item.setFrame(time, frame);
	    */


	  __proto.setFrame = function (time, frame) {
	    var realTime = this.getUnitTime(time);
	    this.items[realTime] = frame;
	    addTime(this.times, realTime);
	    this.needUpdate = true;
	    return this;
	  };
	  /**
	    * get sceneItem's frame at that time
	    * @param {Number} time - frame's time
	    * @return {Frame} sceneItem's frame at that time
	    * @example
	  const frame = item.getFrame(time);
	    */


	  __proto.getFrame = function (time) {
	    return this.items[this.getUnitTime(time)];
	  };
	  /**
	    * remove sceneItem's frame at that time
	    * @param - frame's time
	    * @return {SceneItem} An instance itself
	    * @example
	  item.removeFrame(time);
	    */


	  __proto.removeFrame = function (time) {
	    var realTime = this.getUnitTime(time);
	    var items = this.items;
	    var index = this.times.indexOf(realTime);
	    delete items[realTime]; // remove time

	    if (index > -1) {
	      this.times.splice(index, 1);
	    }

	    this.needUpdate = true;
	    return this;
	  };
	  /**
	    * check if the item has a frame at that time
	    * @param {Number} time - frame's time
	    * @return {Boolean} true: the item has a frame // false: not
	    * @example
	  if (item.hasFrame(10)) {
	    // has
	  } else {
	    // not
	  }
	    */


	  __proto.hasFrame = function (time) {
	    return this.getUnitTime(time) in this.items;
	  };
	  /**
	    * Check if keyframes has propery's name
	    * @param - property's time
	    * @return {boolean} true: if has property, false: not
	    * @example
	  item.hasName(["transform", "translate"]); // true or not
	    */


	  __proto.hasName = function (args) {
	    this.needUpdate && this.update();
	    return isInProperties(this.names, args, true);
	  };
	  /**
	    * merge frame of the previous time at the next time.
	  * @param - The time of the frame to merge
	  * @param - The target frame
	    * @return {SceneItem} An instance itself
	    * @example
	  // getFrame(1) contains getFrame(0)
	  item.merge(0, 1);
	    */


	  __proto.mergeFrame = function (time, frame) {
	    if (frame) {
	      var toFrame = this.newFrame(time);
	      toFrame.merge(frame);
	    }

	    return this;
	  };
	  /**
	    * Get frame of the current time
	    * @param {Number} time - the current time
	    * @param {function} easing - the speed curve of an animation
	    * @return {Frame} frame of the current time
	    * @example
	  let item = new SceneItem({
	    0: {
	        display: "none",
	    },
	    1: {
	        display: "block",
	        opacity: 0,
	    },
	    2: {
	        opacity: 1,
	    }
	  });
	  // opacity: 0.7; display:"block";
	  const frame = item.getNowFrame(1.7);
	    */


	  __proto.getNowFrame = function (time, easing, isAccurate) {
	    var _this = this;

	    this.needUpdate && this.update();
	    var frame = new Frame();

	    var _a = getNearTimeIndex(this.times, time),
	        left = _a[0],
	        right = _a[1];

	    var realEasing = this.getEasing() || easing;
	    var nameObject = this.names;

	    if (this.hasName([TIMING_FUNCTION])) {
	      var nowEasing = this.getNowValue(time, [TIMING_FUNCTION], left, right, false, 0, true);
	      isFunction(nowEasing) && (realEasing = nowEasing);
	    }

	    if (isAccurate) {
	      var prevFrame = this.getFrame(time);
	      var prevNames = updateFrame({}, prevFrame.properties);

	      for (var name in ROLES) {
	        if (name in prevNames) {
	          prevNames[name] = nameObject[name];
	        }
	      }

	      nameObject = prevNames;
	    }

	    var names = getNames(nameObject, []);
	    names.forEach(function (properties) {
	      var value = _this.getNowValue(time, properties, left, right, isAccurate, realEasing, isFixed(properties));

	      if (isUndefined(value)) {
	        return;
	      }

	      frame.set(properties, value);
	    });
	    return frame;
	  };

	  __proto.load = function (properties, options) {
	    if (properties === void 0) {
	      properties = {};
	    }

	    if (options === void 0) {
	      options = properties.options;
	    }

	    var _a;

	    options && this.setOptions(options);

	    if (isArray(properties)) {
	      this.set(properties);
	    } else if (properties.keyframes) {
	      this.set(properties.keyframes);
	    } else {
	      for (var time in properties) {
	        if (time !== "options") {
	          this.set((_a = {}, _a[time] = properties[time], _a));
	        }
	      }
	    }

	    if (options && options[DURATION]) {
	      this.setDuration(options[DURATION]);
	    }

	    return this;
	  };
	  /**
	     * clone SceneItem.
	     * @return {SceneItem} An instance of clone
	     * @example
	     * item.clone();
	     */


	  __proto.clone = function () {
	    var item = new SceneItem();
	    item.setOptions(this.state);
	    this.forEach(function (frame, time) {
	      item.setFrame(time, frame.clone());
	    });
	    return item;
	  };
	  /**
	     * executes a provided function once for each scene item.
	     * @param - Function to execute for each element, taking three arguments
	     * @return {Keyframes} An instance itself
	     */


	  __proto.forEach = function (callback) {
	    var times = this.times;
	    var items = this.items;
	    times.forEach(function (time) {
	      callback(items[time], time, items);
	    });
	    return this;
	  };

	  __proto.setOptions = function (options) {
	    if (options === void 0) {
	      options = {};
	    }

	    _super.prototype.setOptions.call(this, options);

	    var id = options.id,
	        selector = options.selector,
	        elements = options.elements,
	        element = options.element,
	        target = options.target;
	    id && this.setId(id);

	    if (target) {
	      this.setTarget(target);
	    } else if (selector) {
	      this.setSelector(selector);
	    } else if (elements || element) {
	      this.setElement(elements || element);
	    }

	    return this;
	  };

	  __proto.toCSS = function (playCondition, parentDuration, states) {
	    if (playCondition === void 0) {
	      playCondition = {
	        className: START_ANIMATION
	      };
	    }

	    if (parentDuration === void 0) {
	      parentDuration = this.getDuration();
	    }

	    if (states === void 0) {
	      states = [];
	    }

	    var itemState = this.state;
	    var selector = itemState[SELECTOR];

	    if (!selector) {
	      return "";
	    }

	    var originalDuration = this.getDuration();
	    itemState[DURATION] = originalDuration;
	    states.push(itemState);
	    var reversedStates = toArray(states).reverse();
	    var id = toId(getRealId(this));
	    var superParent = states[0];
	    var infiniteIndex = findIndex(reversedStates, function (state) {
	      return state[ITERATION_COUNT] === INFINITE || !isFinite(state[DURATION]);
	    }, states.length - 1);
	    var finiteStates = reversedStates.slice(0, infiniteIndex);
	    var duration = parentDuration || finiteStates.reduce(function (prev, cur) {
	      return (cur[DELAY] + prev * cur[ITERATION_COUNT]) / cur[PLAY_SPEED];
	    }, originalDuration);
	    var delay = reversedStates.slice(infiniteIndex).reduce(function (prev, cur) {
	      return (prev + cur[DELAY]) / cur[PLAY_SPEED];
	    }, 0);
	    var easingName = find(reversedStates, function (state) {
	      return state[EASING] && state[EASING_NAME];
	    }, itemState)[EASING_NAME];
	    var iterationCount = reversedStates[infiniteIndex][ITERATION_COUNT];
	    var fillMode = superParent[FILL_MODE];
	    var direction = reversedStates[infiniteIndex][DIRECTION];
	    var cssText = makeAnimationProperties({
	      fillMode: fillMode,
	      direction: direction,
	      iterationCount: iterationCount,
	      delay: delay + "s",
	      name: PREFIX + "KEYFRAMES_" + id,
	      duration: duration / superParent[PLAY_SPEED] + "s",
	      timingFunction: easingName
	    });
	    var selectors = splitComma(selector).map(function (sel) {
	      var matches = /([\s\S]+)(:+[a-zA-Z]+)$/g.exec(sel);

	      if (matches) {
	        return [matches[0], matches[1]];
	      } else {
	        return [sel, ""];
	      }
	    });
	    var className = playCondition.className;
	    var selectorCallback = playCondition.selector;
	    var preselector = isFunction(selectorCallback) ? selectorCallback(this, selector) : selectorCallback;
	    return "\n    " + (preselector || selectors.map(function (_a) {
	      var sel = _a[0],
	          peusdo = _a[1];
	      return sel + "." + className + peusdo;
	    })) + " {" + cssText + "}\n    " + selectors.map(function (_a) {
	      var sel = _a[0],
	          peusdo = _a[1];
	      return sel + "." + PAUSE_ANIMATION + peusdo;
	    }) + " {" + ANIMATION + "-play-state: paused;}\n    @" + KEYFRAMES + " " + PREFIX + "KEYFRAMES_" + id + "{" + this._toKeyframes(duration, finiteStates, direction) + "}";
	  };
	  /**
	   * Export the CSS of the items to the style.
	   * @param - Add a selector or className to play.
	   * @return {SceneItem} An instance itself
	   */


	  __proto.exportCSS = function (playCondition, duration, options) {
	    if (!this.elements.length) {
	      return "";
	    }

	    var css = this.toCSS(playCondition, duration, options);
	    var isParent = options && !isUndefined(options[ITERATION_COUNT]);
	    !isParent && exportCSS(getRealId(this), css);
	    return this;
	  };

	  __proto.pause = function () {
	    _super.prototype.pause.call(this);

	    isPausedCSS(this) && this.pauseCSS();
	    return this;
	  };

	  __proto.pauseCSS = function () {
	    this.elements.forEach(function (element) {
	      addClass(element, PAUSE_ANIMATION);
	    });
	    return this;
	  };

	  __proto.endCSS = function () {
	    this.elements.forEach(function (element) {
	      removeClass(element, PAUSE_ANIMATION);
	      removeClass(element, START_ANIMATION);
	    });
	    setPlayCSS(this, false);
	    return this;
	  };

	  __proto.end = function () {
	    isEndedCSS(this) && this.endCSS();

	    _super.prototype.end.call(this);

	    return this;
	  };
	  /**
	    * Play using the css animation and keyframes.
	    * @param - Check if you want to export css.
	    * @param [playClassName="startAnimation"] - Add a class name to play.
	    * @param - The shorthand properties for six of the animation properties.
	    * @see {@link https://www.w3schools.com/cssref/css3_pr_animation.asp}
	    * @example
	  item.playCSS();
	  item.playCSS(false, "startAnimation", {
	    direction: "reverse",
	    fillMode: "forwards",
	  });
	    */


	  __proto.playCSS = function (isExportCSS, playClassName, properties) {
	    if (isExportCSS === void 0) {
	      isExportCSS = true;
	    }

	    if (properties === void 0) {
	      properties = {};
	    }

	    playCSS(this, isExportCSS, playClassName, properties);
	    return this;
	  };

	  __proto.addPlayClass = function (isPaused, playClassName, properties) {
	    if (properties === void 0) {
	      properties = {};
	    }

	    var elements = this.elements;
	    var length = elements.length;
	    var cssText = makeAnimationProperties(properties);

	    if (!length) {
	      return;
	    }

	    if (isPaused) {
	      elements.forEach(function (element) {
	        removeClass(element, PAUSE_ANIMATION);
	      });
	    } else {
	      elements.forEach(function (element) {
	        element.style.cssText += cssText;

	        if (hasClass(element, START_ANIMATION)) {
	          removeClass(element, START_ANIMATION);
	          requestAnimationFrame(function () {
	            requestAnimationFrame(function () {
	              addClass(element, START_ANIMATION);
	            });
	          });
	        } else {
	          addClass(element, START_ANIMATION);
	        }
	      });
	    }

	    return elements[0];
	  };

	  __proto.getNowValue = function (time, properties, left, right, isAccurate, easing, usePrevValue) {
	    var times = this.times;
	    var length = times.length;
	    var prevTime;
	    var nextTime;
	    var prevFrame;
	    var nextFrame;
	    var isUndefinedLeft = isUndefined(left);
	    var isUndefinedRight = isUndefined(right);

	    if (isUndefinedLeft || isUndefinedRight) {
	      var indicies = getNearTimeIndex(times, time);
	      isUndefinedLeft && (left = indicies[0]);
	      isUndefinedRight && (right = indicies[1]);
	    }

	    for (var i = left; i >= 0; --i) {
	      var frame = this.getFrame(times[i]);

	      if (frame.has.apply(frame, properties)) {
	        prevTime = times[i];
	        prevFrame = frame;
	        break;
	      }
	    }

	    var prevValue = prevFrame && prevFrame.raw.apply(prevFrame, properties);

	    if (isAccurate && !isRole([properties[0]])) {
	      return prevTime === time ? prevValue : undefined;
	    }

	    if (usePrevValue) {
	      return prevValue;
	    }

	    for (var i = right; i < length; ++i) {
	      var frame = this.getFrame(times[i]);

	      if (frame.has.apply(frame, properties)) {
	        nextTime = times[i];
	        nextFrame = frame;
	        break;
	      }
	    }

	    var nextValue = nextFrame && nextFrame.raw.apply(nextFrame, properties);

	    if (!prevFrame || isUndefined(prevValue)) {
	      return nextValue;
	    }

	    if (!nextFrame || isUndefined(nextValue) || prevValue === nextValue) {
	      return prevValue;
	    }

	    return dotValue(time, Math.max(prevTime, 0), nextTime, prevValue, nextValue, easing);
	  };

	  __proto._toKeyframes = function (duration, states, direction) {
	    var _this = this;

	    var frames = {};
	    var times = this.times.slice();

	    if (!times.length) {
	      return "";
	    }

	    var originalDuration = this.getDuration();
	    !this.getFrame(0) && times.unshift(0);
	    !this.getFrame(originalDuration) && times.push(originalDuration);
	    var entries = getEntries(times, states);
	    var lastEntry = entries[entries.length - 1]; // end delay time

	    lastEntry[0] < duration && addEntry(entries, duration, lastEntry[1]);
	    var prevTime = -1;
	    return entries.map(function (_a) {
	      var time = _a[0],
	          keytime = _a[1];

	      if (!frames[keytime]) {
	        frames[keytime] = (!_this.hasFrame(keytime) || keytime === 0 || keytime === originalDuration ? _this.getNowFrame(keytime) : _this.getNowFrame(keytime, 0, true)).toCSS();
	      }

	      var frameTime = time / duration * 100;

	      if (frameTime - prevTime < THRESHOLD) {
	        frameTime += THRESHOLD;
	      }

	      prevTime = frameTime;
	      return Math.min(frameTime, 100) + "%{\n                " + (time === 0 && !isDirectionReverse(0, 1, direction) ? "" : frames[keytime]) + "\n            }";
	    }).join("");
	  };

	  return SceneItem;
	}(Animator);

	/**
	 * manage sceneItems and play Scene.
	 * @sort 1
	 */

	var Scene =
	/*#__PURE__*/
	function (_super) {
	  __extends$3(Scene, _super);
	  /**
	  * @param - properties
	  * @param - options
	  * @example
	  const scene = new Scene({
	    item1: {
	      0: {
	        display: "none",
	      },
	      1: {
	        display: "block",
	        opacity: 0,
	      },
	      2: {
	        opacity: 1,
	      },
	    },
	    item2: {
	      2: {
	        opacity: 1,
	      },
	    }
	  });
	    */


	  function Scene(properties, options) {
	    var _this = _super.call(this) || this;

	    _this.items = new ListMap();

	    _this.load(properties, options);

	    return _this;
	  }

	  var __proto = Scene.prototype;

	  __proto.getDuration = function () {
	    var time = 0;
	    this.forEach(function (item) {
	      time = Math.max(time, item.getTotalDuration() / item.getPlaySpeed());
	    });
	    return time || this.state[DURATION];
	  };

	  __proto.setDuration = function (duration) {
	    var items = this.items;
	    var sceneDuration = this.getDuration();

	    if (duration === 0 || !isFinite(sceneDuration)) {
	      return this;
	    }

	    if (sceneDuration === 0) {
	      this.forEach(function (item) {
	        item.setDuration(duration);
	      });
	    } else {
	      var ratio_1 = duration / sceneDuration;
	      this.forEach(function (item) {
	        item.setDelay(item.getDelay() * ratio_1);
	        item.setDuration(item.getDuration() * ratio_1);
	      });
	    }

	    _super.prototype.setDuration.call(this, duration);

	    return this;
	  };
	  /**
	  * get item in scene by name
	  * @param - The item's name
	  * @return {Scene | SceneItem} item
	  * @example
	  const item = scene.getItem("item1")
	  */


	  __proto.getItem = function (name) {
	    return this.items.get(name);
	  };
	  /**
	  * create item in scene
	  * @param {} name - name of item to create
	  * @param {} options - The option object of SceneItem
	  * @return {} Newly created item
	  * @example
	  const item = scene.newItem("item1")
	  */


	  __proto.newItem = function (name, options) {
	    if (options === void 0) {
	      options = {};
	    }

	    if (this.items.has(name)) {
	      return this.items.get(name);
	    }

	    var item = new SceneItem();
	    this.setItem(name, item);
	    item.setOptions(options);
	    return item;
	  };
	  /**
	  * remove item in scene
	  * @param - name of item to remove
	  * @return  An instance itself
	  * @example
	  const item = scene.newItem("item1")
	   scene.removeItem("item1");
	  */


	  __proto.removeItem = function (name) {
	    this.items.remove(name);
	    return this;
	  };
	  /**
	  * add a sceneItem to the scene
	  * @param - name of item to create
	  * @param - sceneItem
	  * @example
	  const item = scene.newItem("item1")
	  */


	  __proto.setItem = function (name, item) {
	    item.setId(name);
	    this.items.set(name, item);
	    return this;
	  };

	  __proto.setTime = function (time, isTick, isParent, parentEasing) {
	    _super.prototype.setTime.call(this, time, isTick, isParent);

	    var iterationTime = this.getIterationTime();
	    var easing = this.getEasing() || parentEasing;
	    var frames = {};
	    this.forEach(function (item) {
	      item.setTime(iterationTime * item.getPlaySpeed() - item.getDelay(), isTick, true, easing);
	      frames[item.getId()] = item.temp;
	    });
	    this.temp = frames;
	    /**
	     * This event is fired when timeupdate and animate.
	     * @event Scene#animate
	     * @param {object} param The object of data to be sent to an event.
	     * @param {number} param.currentTime The total time that the animator is running.
	     * @param {number} param.time The iteration time during duration that the animator is running.
	     * @param {object} param.frames frames of that time.
	     * @example
	    const scene = new Scene({
	    a: {
	    0: {
	        opacity: 0,
	    },
	    1: {
	        opacity: 1,
	    }
	    },
	    b: {
	    0: {
	        opacity: 0,
	    },
	    1: {
	        opacity: 1,
	    }
	    }
	    }).on("animate", e => {
	    console.log(e);
	    // {a: Frame, b: Frame}
	    console.log(e.a.get("opacity"));
	    });
	         */

	    this.trigger("animate", {
	      frames: frames,
	      currentTime: this.getTime(),
	      time: iterationTime
	    });
	    return this;
	  };
	  /**
	   * executes a provided function once for each scene item.
	   * @param - Function to execute for each element, taking three arguments
	   * @return {Scene} An instance itself
	   */


	  __proto.forEach = function (func) {
	    var items = this.items;
	    items.forEach(function (item, id, index, obj) {
	      func(item, id, index, obj);
	    });
	    return this;
	  };

	  __proto.toCSS = function (playCondition, duration, parentStates) {
	    if (duration === void 0) {
	      duration = this.getDuration();
	    }

	    if (parentStates === void 0) {
	      parentStates = [];
	    }

	    var totalDuration = !duration || !isFinite(duration) ? 0 : duration;
	    var styles = [];
	    var state = this.state;
	    state[DURATION] = this.getDuration();
	    this.forEach(function (item) {
	      styles.push(item.toCSS(playCondition, totalDuration, parentStates.concat(state)));
	    });
	    return styles.join("");
	  };
	  /**
	   * Export the CSS of the items to the style.
	   * @param - Add a selector or className to play.
	   * @return {Scene} An instance itself
	   */


	  __proto.exportCSS = function (playCondition, duration, parentStates) {
	    var css = this.toCSS(playCondition, duration, parentStates);
	    (!parentStates || !parentStates.length) && exportCSS(getRealId(this), css);
	    return this;
	  };

	  __proto.append = function (item) {
	    item.setDelay(item.getDelay() + this.getDuration());
	    this.setItem(getRealId(item), item);
	  };

	  __proto.pauseCSS = function () {
	    return this.forEach(function (item) {
	      item.pauseCSS();
	    });
	  };

	  __proto.pause = function () {
	    _super.prototype.pause.call(this);

	    isPausedCSS(this) && this.pauseCSS();
	    this.forEach(function (item) {
	      item.pause();
	    });
	    return this;
	  };

	  __proto.endCSS = function () {
	    this.forEach(function (item) {
	      item.endCSS();
	    });
	    setPlayCSS(this, false);
	  };

	  __proto.end = function () {
	    isEndedCSS(this) && this.endCSS();

	    _super.prototype.end.call(this);

	    return this;
	  };

	  __proto.addPlayClass = function (isPaused, playClassName, properties) {
	    if (properties === void 0) {
	      properties = {};
	    }

	    var animtionElement;
	    this.forEach(function (item) {
	      var el = item.addPlayClass(isPaused, playClassName, properties);
	      !animtionElement && (animtionElement = el);
	    });
	    return animtionElement;
	  };
	  /**
	  * Play using the css animation and keyframes.
	  * @param - Check if you want to export css.
	  * @param [playClassName="startAnimation"] - Add a class name to play.
	  * @param - The shorthand properties for six of the animation properties.
	  * @return {Scene} An instance itself
	  * @see {@link https://www.w3schools.com/cssref/css3_pr_animation.asp}
	  * @example
	  scene.playCSS();
	  scene.playCSS(false, {
	  direction: "reverse",
	  fillMode: "forwards",
	  });
	  */


	  __proto.playCSS = function (isExportCSS, playClassName, properties) {
	    if (isExportCSS === void 0) {
	      isExportCSS = true;
	    }

	    if (properties === void 0) {
	      properties = {};
	    }

	    playCSS(this, isExportCSS, playClassName, properties);
	    return this;
	  };
	  /**
	    * Set properties to the Scene.
	    * @param - properties
	    * @return An instance itself
	    * @example
	  scene.set({
	  ".a": {
	      0: {
	          opacity: 0,
	      },
	      1: {
	          opacity: 1,
	      },
	  },
	  });
	  // 0
	  console.log(scene.getItem(".a").get(0, "opacity"));
	  // 1
	  console.log(scene.getItem(".a").get(1, "opacity"));
	    */


	  __proto.set = function (properties) {
	    this.load(properties);
	    return this;
	  };

	  __proto.load = function (properties, options) {
	    if (properties === void 0) {
	      properties = {};
	    }

	    if (options === void 0) {
	      options = properties.options;
	    }

	    if (!properties) {
	      return this;
	    }

	    var selector = options && options[SELECTOR] || this.state[SELECTOR];

	    for (var name in properties) {
	      if (name === "options") {
	        continue;
	      }

	      var object = properties[name];
	      var item = void 0;

	      if (object instanceof Scene || object instanceof SceneItem) {
	        this.setItem(name, object);
	        item = object;
	      } else if (isFunction(object) && selector) {
	        var elements = IS_WINDOW ? $("" + (isFunction(selector) ? selector(name) : name), true) : [];
	        var length = elements.length;
	        var scene = new Scene();

	        for (var i = 0; i < length; ++i) {
	          scene.newItem(i).setId().setElement(elements[i]).load(object(i, elements[i]));
	        }

	        this.setItem(name, scene);
	        continue;
	      } else {
	        item = this.newItem(name);
	        item.load(object);
	      }

	      selector && item.setSelector(selector);
	    }

	    this.setOptions(options);
	  };

	  __proto.setOptions = function (options) {
	    if (options === void 0) {
	      options = {};
	    }

	    _super.prototype.setOptions.call(this, options);

	    var selector = options.selector;

	    if (selector) {
	      this.state[SELECTOR] = selector;
	    }

	    return this;
	  };

	  __proto.setSelector = function (target) {
	    var state = this.state;
	    var selector = target || state[SELECTOR];
	    state[SELECTOR] = selector;
	    var isItFunction = isFunction(target);

	    if (selector) {
	      this.forEach(function (item, name) {
	        item.setSelector(isItFunction ? target(name) : selector);
	      });
	    }

	    return this;
	  };

	  __proto.start = function (delay) {
	    if (delay === void 0) {
	      delay = this.state[DELAY];
	    }

	    var result = _super.prototype.start.call(this, delay);

	    if (result) {
	      this.forEach(function (item) {
	        item.start(0);
	      });
	    } else {
	      this.forEach(function (item) {
	        item.setPlayState(RUNNING);
	      });
	    }

	    return result;
	  };
	  /**
	  * version info
	  * @type {string}
	  * @example
	  * Scene.VERSION // 1.0.4
	  */


	  Scene.VERSION = "1.0.4";
	  return Scene;
	}(Animator);
	//# sourceMappingURL=scene.esm.js.map

	/*
	Copyright (c) 2019 Daybrush
	name: react-pure-props
	license: MIT
	author: Daybrush
	repository: https://github.com/daybrush/pure-props/tree/master/react-pure-props
	version: 0.1.5
	*/

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */

	/* global Reflect, Promise */
	var extendStatics$3 = function (d, b) {
	  extendStatics$3 = Object.setPrototypeOf || {
	    __proto__: []
	  } instanceof Array && function (d, b) {
	    d.__proto__ = b;
	  } || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	  };

	  return extendStatics$3(d, b);
	};

	function __extends$4(d, b) {
	  extendStatics$3(d, b);

	  function __() {
	    this.constructor = d;
	  }

	  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}

	//

	var shallowequal = function shallowEqual(objA, objB, compare, compareContext) {
	  var ret = compare ? compare.call(compareContext, objA, objB) : void 0;

	  if (ret !== void 0) {
	    return !!ret;
	  }

	  if (objA === objB) {
	    return true;
	  }

	  if (typeof objA !== "object" || !objA || typeof objB !== "object" || !objB) {
	    return false;
	  }

	  var keysA = Object.keys(objA);
	  var keysB = Object.keys(objB);

	  if (keysA.length !== keysB.length) {
	    return false;
	  }

	  var bHasOwnProperty = Object.prototype.hasOwnProperty.bind(objB);

	  // Test for A's keys different from B.
	  for (var idx = 0; idx < keysA.length; idx++) {
	    var key = keysA[idx];

	    if (!bHasOwnProperty(key)) {
	      return false;
	    }

	    var valueA = objA[key];
	    var valueB = objB[key];

	    ret = compare ? compare.call(compareContext, valueA, valueB, key) : void 0;

	    if (ret === false || (ret === void 0 && valueA !== valueB)) {
	      return false;
	    }
	  }

	  return true;
	};

	var PureProps =
	/*#__PURE__*/
	function (_super) {
	  __extends$4(PureProps, _super);

	  function PureProps() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = PureProps.prototype;

	  __proto.shouldComponentUpdate = function (prevProps, prevState) {
	    return prevState !== this.state || !shallowequal(prevProps, this.props);
	  };

	  return PureProps;
	}(Component$1);
	//# sourceMappingURL=pure-props.esm.js.map

	/*
	Copyright (c) 2019 Daybrush
	name: react-css-styler
	license: MIT
	author: Daybrush
	repository: git+https://github.com/daybrush/react-css-styler.git
	version: 0.1.1
	*/

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */

	/* global Reflect, Promise */
	var extendStatics$4 = function (d, b) {
	  extendStatics$4 = Object.setPrototypeOf || {
	    __proto__: []
	  } instanceof Array && function (d, b) {
	    d.__proto__ = b;
	  } || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	  };

	  return extendStatics$4(d, b);
	};

	function __extends$5(d, b) {
	  extendStatics$4(d, b);

	  function __() {
	    this.constructor = d;
	  }

	  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}
	var __assign$2 = function () {
	  __assign$2 = Object.assign || function __assign(t) {
	    for (var s, i = 1, n = arguments.length; i < n; i++) {
	      s = arguments[i];

	      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
	    }

	    return t;
	  };

	  return __assign$2.apply(this, arguments);
	};
	function __rest(s, e) {
	  var t = {};

	  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];

	  if (s != null && typeof Object.getOwnPropertySymbols === "function") for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
	    if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i])) t[p[i]] = s[p[i]];
	  }
	  return t;
	}

	function hash(str) {
	  var hash = 5381,
	      i    = str.length;

	  while(i) {
	    hash = (hash * 33) ^ str.charCodeAt(--i);
	  }

	  /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
	   * integers. Since we want the results to be always positive, convert the
	   * signed int to an unsigned by doing an unsigned bitshift. */
	  return hash >>> 0;
	}

	var stringHash = hash;

	function getHash(str) {
	  return stringHash(str).toString(36);
	}
	function injectStyle(className, css) {
	  var style = document.createElement("style");
	  style.setAttribute("type", "text/css");
	  style.innerHTML = css.replace(/([^}{]*){/mg, function (all, selector) {
	    return splitComma(selector).map(function (subSelector) {
	      return "." + className + " " + subSelector;
	    }).join(", ") + "{";
	  });
	  (document.head || document.body).appendChild(style);
	  return style;
	}

	function styled(Tag, css) {
	  if (Tag === void 0) {
	    Tag = "div";
	  }

	  var injectClassName = "rCS" + getHash(css);
	  var injectCount = 0;
	  var injectElement;
	  return (
	    /*#__PURE__*/
	    function (_super) {
	      __extends$5(Styler, _super);

	      function Styler(props) {
	        return _super.call(this, props) || this;
	      }

	      Styler.prototype.render = function () {
	        var _a = this.props,
	            className = _a.className,
	            attributes = __rest(_a, ["className"]);

	        return index.createElement(Tag, __assign$2({
	          className: className + " " + injectClassName
	        }, attributes));
	      };

	      Styler.prototype.componentDidMount = function () {
	        if (injectCount === 0) {
	          injectElement = injectStyle(injectClassName, css);
	        }

	        ++injectCount;
	      };

	      Styler.prototype.componentWillUnmount = function () {
	        --injectCount;

	        if (injectCount === 0 && injectElement) {
	          injectElement.parentNode.removeChild(injectElement);
	        }
	      };

	      return Styler;
	    }(index.Component)
	  );
	}
	//# sourceMappingURL=styler.esm.js.map

	/*
	Copyright (c) 2019 Daybrush
	name: react-scenejs-timeline
	license: MIT
	author: Daybrush
	repository: git+https://github.com/daybrush/scenejs-timeline.git
	version: 0.3.1
	*/

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */

	/* global Reflect, Promise */
	var extendStatics$5 = function (d, b) {
	  extendStatics$5 = Object.setPrototypeOf || {
	    __proto__: []
	  } instanceof Array && function (d, b) {
	    d.__proto__ = b;
	  } || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	  };

	  return extendStatics$5(d, b);
	};

	function __extends$6(d, b) {
	  extendStatics$5(d, b);

	  function __() {
	    this.constructor = d;
	  }

	  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}
	var __assign$3 = function () {
	  __assign$3 = Object.assign || function __assign(t) {
	    for (var s, i = 1, n = arguments.length; i < n; i++) {
	      s = arguments[i];

	      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
	    }

	    return t;
	  };

	  return __assign$3.apply(this, arguments);
	};
	function __rest$1(s, e) {
	  var t = {};

	  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];

	  if (s != null && typeof Object.getOwnPropertySymbols === "function") for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0) t[p[i]] = s[p[i]];
	  return t;
	}

	var PREFIX$1 = "scenejs-editor-";
	var CSS = prefixCSS(PREFIX$1, "\n{\n    position: relative;\n    width: 100%;\n    font-size: 0;\n    background: #232e30;\n    display: flex;\n    flex-direction: column;\n}\n* {\n    font-family: sans-serif;\n    box-sizing: border-box;\n    color: #fff;\n}\n.header-area, .scroll-area {\n   width: 100%;\n   position: relative;\n  display: flex;\n  -webkit-align-items: flex-start;\n  align-items: flex-start;\n}\n.header-area {\n  position: relative;\n  z-index: 10;\n  top: 0;\n  height: 30px;\n  min-height: 30px;\n}\n.header-area .keyframes {\n  padding: 0px;\n}\n.header-area .properties-area,\n.header-area .keyframes-area,\n.header-area .values-area,\n.header-area .keyframes-scroll-area {\n    height: 100%;\n}\n.header-area .keyframes-scroll-area {\n    overflow: hidden;\n}\n.header-area .property, .header-area .value, .header-area .keyframes {\n  height: 100%;\n}\n.header-area .property {\n    line-height: 30px;\n}\n.value .add {\n    text-align: center;\n    color: #fff;\n    line-height: 30px;\n    font-weight: bold;\n    font-size: 20px;\n    cursor: pointer;\n}\n.header-area .keyframes-area::-webkit-scrollbar {\n    display: none;\n}\n.header-area .keyframe-cursor {\n    position: absolute;\n    border-top: 10px solid #f60;\n    border-left: 6px solid transparent;\n    border-right: 6px solid transparent;\n    width: 0;\n    height: 0;\n    bottom: 0;\n    top: auto;\n    background: none;\n    cursor: pointer;\n}\n.control-area .keyframes {\n    padding-left: 10px;\n}\n.play-control-area {\n    position: absolute;\n    top: 50%;\n    left: 50%;\n    transform: translate(-50%, -50%);\n}\n.play-control-area .control {\n    position: relative;\n    display: inline-block;\n    vertical-align: middle;\n    color: white;\n    margin: 0px 15px;\n    cursor: pointer;\n}\n.play {\n    border-left: 14px solid white;\n    border-top: 8px solid transparent;\n    border-bottom: 8px solid transparent;\n}\n.pause {\n    border-left: 4px solid #fff;\n    border-right: 4px solid #fff;\n    width: 14px;\n    height: 16px;\n}\n.playRecord {\n  width: 15px;\n  height: 15px;\n  border-radius: 25px;\n  background-color: red;\n}\n.pauseRecord {\n  width: 15px;\n  height: 15px;\n  border-radius: 25px;\n  background-color: white;\n}\n.prev {\n    border-right: 10px solid white;\n    border-top: 6px solid transparent;\n    border-bottom: 6px solid transparent;\n}\n.prev:before {\n    position: absolute;\n    content: \"\";\n    width: 3px;\n    height: 10px;\n    top: 0;\n    right: 100%;\n    transform: translate(0, -50%);\n    background: white;\n}\n.next {\n    border-left: 10px solid white;\n    border-top: 6px solid transparent;\n    border-bottom: 6px solid transparent;\n}\n.next:before {\n    position: absolute;\n    content: \"\";\n    width: 3px;\n    height: 10px;\n    top: 0;\n    transform: translate(0, -50%);\n    background: white;\n}\n.keytime {\n  position: relative;\n  display: inline-block;\n  height: 100%;\n  font-size: 13px;\n  font-weight: bold;\n  color: #777;\n}\n.keytime:last-child {\n  max-width: 0px;\n}\n.keytime span {\n  position: absolute;\n  line-height: 1;\n  bottom: 12px;\n  display: inline-block;\n  transform: translate(-50%);\n  color: #eee;\n}\n.keytime .graduation {\n  position: absolute;\n  bottom: 0;\n  width: 1px;\n  height: 10px;\n  background: #666;\n  transform: translate(-50%);\n}\n.keytime .graduation.half {\n  left: 50%;\n  height: 7px;\n}\n.keytime .graduation.quarter {\n  left: 25%;\n  height: 5px;\n}\n.keytime .graduation.quarter3 {\n  left: 75%;\n  height: 5px;\n}\n.scroll-area {\n  position: relative;\n  width: 100%;\n  height: calc(100% - 60px);\n  overflow: auto;\n}\n.properties-area, .keyframes-area, .values-area {\n  display: inline-block;\n  position: relative;\n  font-size: 16px;\n  overflow: auto;\n}\n\n.properties-area::-webkit-scrollbar, .keyframes-area::-webkit-scrollbar {\n    display: none;\n}\n.properties-area {\n  width: 30%;\n  max-width: 200px;\n  box-sizing: border-box;\n}\n.values-area {\n    width: 50px;\n    min-width: 50px;\n    display: inline-block;\n    border-right: 1px solid #666;\n    box-sizing: border-box;\n}\n.value input {\n    appearance: none;\n    -webkit-appearance: none;\n    outline: none;\n    position: relative;\n    display: block;\n    width: 100%;\n    height: 100%;\n    background: transparent;\n    color: #f60;\n    font-weight: bold;\n    background: none;\n    border: 0;\n    box-sizing: border-box;\n    text-align: center;\n}\n.value {\n\n}\n:host.alt .value input {\n    cursor: ew-resize;\n}\n.value[data-object=\"1\"] input {\n    display: none;\n}\n.properties-scroll-area {\n  display: inline-block;\n  min-width: 100%;\n}\n.keyframes-area {\n  flex: 1;\n}\n.keyframes-scroll-area {\n  position: relative;\n  min-width: 300px;\n}\n.keyframes, .property, .value {\n  position: relative;\n  height: 30px;\n  line-height: 30px;\n  border-bottom: 1px solid #555;\n  box-sizing: border-box;\n  white-space: nowrap;\n  background: #364346;\n  z-index: 1;\n}\n\n.property {\n  padding-left: 10px;\n  box-sizing: border-box;\n  font-size: 13px;\n  font-weight: bold;\n  color: #eee;\n}\n.property .remove {\n    position: absolute;\n    display: inline-block;\n    cursor: pointer;\n    width: 18px;\n    height: 18px;\n    top: 0;\n    bottom: 0;\n    right: 10px;\n    margin: auto;\n    border-radius: 50%;\n    border: 2px solid #fff;\n    vertical-align: middle;\n    display: none;\n    margin-left: 10px;\n    box-sizing: border-box;\n}\n.property .remove:before, .property .remove:after {\n    position: absolute;\n    content: \"\";\n    width: 8px;\n    height: 2px;\n    border-radius: 1px;\n    background: #fff;\n    top: 0;\n    left: 0;\n    right: 0;\n    bottom: 0;\n    margin: auto;\n}\n.property .remove:before {\n    transform: rotate(45deg);\n}\n.property .remove:after {\n    transform: rotate(-45deg);\n}\n.property:hover .remove {\n    display: inline-block;\n}\n\n[data-item=\"1\"], [data-item=\"1\"] .add {\n    height: 30px;\n    line-height: 30px;\n}\n.time-area {\n    position: absolute;\n    top: 0;\n    left: 10px;\n    font-size: 13px;\n    color: #f60;\n    line-height: 30px;\n    font-weight: bold;\n    height: 100%;\n    line-height: 30px;\n    border: 0;\n    background: transparent;\n    outline: 0;\n}\n.time-area:after {\n    content: \"s\";\n}\n.property .arrow {\n    position: relative;\n    display: inline-block;\n    width: 20px;\n    height: 25px;\n    cursor: pointer;\n    vertical-align: middle;\n}\n.property .arrow:after {\n    content: \"\";\n    position: absolute;\n    top: 0;\n    right: 0;\n    left: 0;\n    bottom: 0;\n    margin: auto;\n    width: 0;\n    height: 0;\n    border-top: 6px solid #eee;\n    border-left: 4px solid transparent;\n    border-right: 4px solid transparent;\n}\n.property[data-fold=\"1\"] .arrow:after {\n    border-top: 4px solid transparent;\n    border-bottom: 4px solid transparent;\n    border-right: 0;\n    border-left: 6px solid #eee;\n}\n.property[data-object=\"0\"] .arrow {\n    display: none;\n}\n.property.fold, .keyframes.fold, .value.fold {\n    display: none;\n}\n.property.select, .value.select, .keyframes.select {\n    background: rgba(120, 120, 120, 0.7);\n}\n.keyframes {\n\n}\n.keyframe-delay {\n  position: absolute;\n  top: 3px;\n  bottom: 3px;\n  left: 0;\n  background: #f60;\n  opacity: 0.2;\n  z-index: 0;\n}\n.keyframe-group {\n    position: absolute;\n    top: 3px;\n    bottom: 3px;\n    left: 0;\n    background: #f60;\n    opacity: 0.6;\n    border: 1px solid rgba(0, 0, 0, 0.2);\n    border-left-color: rgba(255, 255, 255, 0.2);\n    border-top-color: rgba(255, 255, 255, 0.2);\n    z-index: 0;\n}\n.keyframe-line {\n  position: absolute;\n  height: 8px;\n  top: 0;\n  bottom: 0;\n  margin: auto;\n  background: #666;\n  z-index: 0;\n}\n.keyframe {\n  position: absolute;\n  font-size: 0px;\n  width: 12px;\n  height: 12px;\n  top: 0px;\n  bottom: 0px;\n  margin: auto;\n  background: #fff;\n  border: 2px solid #383838;\n  border-radius: 2px;\n  box-sizing: border-box;\n  transform: translate(-50%) rotate(45deg);\n  z-index: 1;\n  cursor: pointer;\n}\n.keyframe[data-no=\"1\"] {\n    opacity: 0.2;\n}\n.select .keyframe {\n    border-color: #555;\n}\n.keyframe.select {\n    background: #f60;\n}\n.keyframes-container, .line-area {\n  position: relative;\n  width: calc(100% - 30px);\n  left: 15px;\n  height: 100%;\n}\n.line-area {\n  position: absolute;\n  top: 0;\n  z-index: 0;\n}\n.keyframe-cursor {\n  position: absolute;\n  top: 0;\n  z-index: 1;\n  background: #f60;\n  width: 1px;\n  height: 100%;\n  left: 15px;\n  transform: translate(-50%);\n}\n.scroll-area .keyframe-cursor {\n  pointer-events: none;\n}\n.division-line {\n  position: absolute;\n  background: #333;\n  width: 1px;\n  height: 100%;\n  transform: translate(-50%);\n}\n");
	var DIRECTION$1 = "direction";
	var ITERATION_COUNT$1 = "iterationCount";
	var DELAY$1 = "delay";
	var PLAY_SPEED$1 = "playSpeed";
	var ALTERNATE$1 = "alternate";
	var REVERSE$1 = "reverse";
	var ALTERNATE_REVERSE$1 = "alternate-reverse";
	var INFINITE$1 = "infinite";

	function numberFormat(num, count, isRight) {
	  var length = ("" + num).length;
	  var arr = [];

	  if (isRight) {
	    arr.push(num);
	  }

	  for (var i = length; i < count; ++i) {
	    arr.push(0);
	  }

	  if (!isRight) {
	    arr.push(num);
	  }

	  return arr.join("");
	}
	function keys(value) {
	  var arr = [];

	  for (var name in value) {
	    arr.push(name);
	  }

	  return arr;
	}
	function toValue(value) {
	  if (isObject(value)) {
	    if (Array.isArray(value)) {
	      return "[" + value.join(", ") + "]";
	    }

	    return "{" + keys(value).map(function (k) {
	      return k + ": " + toValue(value[k]);
	    }).join(", ") + "}";
	  }

	  return value;
	}
	function flatObject(obj, newObj) {
	  if (newObj === void 0) {
	    newObj = {};
	  }

	  for (var name in obj) {
	    var value = obj[name];

	    if (isObject(value)) {
	      var nextObj = flatObject(isFrame(value) ? value.get() : value);

	      for (var nextName in nextObj) {
	        newObj[name + "///" + nextName] = nextObj[nextName];
	      }
	    } else {
	      newObj[name] = value;
	    }
	  }

	  return newObj;
	}
	function getTarget(target, conditionCallback) {
	  var parentTarget = target;

	  while (parentTarget && parentTarget !== document.body) {
	    if (conditionCallback(parentTarget)) {
	      return parentTarget;
	    }

	    parentTarget = parentTarget.parentNode;
	  }

	  return null;
	}
	function hasClass$1(target, className) {
	  return hasClass(target, "" + PREFIX$1 + className);
	}
	function isScene(value) {
	  return value && !!value.constructor.prototype.getItem;
	}
	function isFrame(value) {
	  return value && !!value.constructor.prototype.toCSS;
	}
	function findElementIndexByPosition(elements, pos) {
	  return findIndex(elements, function (el) {
	    var box = el.getBoundingClientRect();
	    var top = box.top;
	    var bottom = top + box.height;
	    return top <= pos && pos < bottom;
	  });
	}
	function prefix() {
	  var classNames = [];

	  for (var _i = 0; _i < arguments.length; _i++) {
	    classNames[_i] = arguments[_i];
	  }

	  return prefixNames.apply(void 0, [PREFIX$1].concat(classNames));
	}
	function checkFolded(foldedInfo, names) {
	  var index = findIndex(names, function (name, i) {
	    return foldedInfo[names.slice(0, i + 1).join("///") + "///"];
	  });

	  if (index > -1) {
	    if (index === names.length - 1) {
	      return 2;
	    }

	    return 1;
	  } else {
	    return 0;
	  }
	}
	function fold(target, foldedProperty, isNotUpdate) {
	  var id = foldedProperty + "///";
	  var foldedInfo = target.state.foldedInfo;
	  foldedInfo[id] = !foldedInfo[id];

	  if (!isNotUpdate) {
	    target.setState({
	      foldedInfo: __assign$3({}, foldedInfo)
	    });
	  }
	}

	var ElementComponent =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(ElementComponent, _super);

	  function ElementComponent() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = ElementComponent.prototype;

	  __proto.getElement = function () {
	    return this.element || (this.element = findDOMNode(this));
	  };

	  return ElementComponent;
	}(PureComponent);

	var TimeArea =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(TimeArea, _super);

	  function TimeArea() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = TimeArea.prototype;

	  __proto.render = function () {
	    return createElement("input", {
	      className: prefix("time-area")
	    });
	  };

	  __proto.componentDidMount = function () {
	    var _this = this;

	    new KeyController(this.getElement()).keydown(function (e) {
	      !e.isToggle && e.inputEvent.stopPropagation();
	    }).keyup(function (e) {
	      !e.isToggle && e.inputEvent.stopPropagation();
	    }).keyup("enter", function () {
	      // go to time
	      var value = _this.getElement().value;

	      var result = /(\d+):(\d+):(\d+)/g.exec(value);

	      if (!result) {
	        return;
	      }

	      var minute = parseFloat(result[1]);
	      var second = parseFloat(result[2]);
	      var milisecond = parseFloat("0." + result[3]);
	      var time = minute * 60 + second + milisecond;

	      _this.props.timeline.setTime(time);
	    });
	  };

	  return TimeArea;
	}(ElementComponent);

	var ControlArea =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(ControlArea, _super);

	  function ControlArea() {
	    var _this = _super !== null && _super.apply(this, arguments) || this;

	    _this.state = {
	      isPlay: false,
	      isRecord: false
	    };

	    _this.play = function () {
	      _this.setState({
	        isPlay: true
	      });
	    };

	    _this.pause = function () {
	      _this.setState({
	        isPlay: false
	      });
	    };

	    _this.togglePlay = function () {
	      _this.props.timeline.togglePlay();
	    };

	    _this.toggleRecord = function () {
	      _this.setState({
	        isRecord: !_this.state.isRecord
	      });

	      _this.props.timeline.toggleRecord(_this.state.isRecord);
	    };

	    _this.prev = function () {
	      _this.props.timeline.prev();
	    };

	    _this.next = function () {
	      _this.props.timeline.next();
	    };

	    _this.unselect = function () {
	      _this.props.timeline.select("", -1);
	    };

	    return _this;
	  }

	  var __proto = ControlArea.prototype;

	  __proto.render = function () {
	    var timeline = this.props.timeline;
	    return createElement("div", {
	      className: prefix("control-area header-area")
	    }, createElement("div", {
	      className: prefix("properties-area"),
	      onClick: this.unselect
	    }, createElement("div", {
	      className: prefix("property")
	    })), createElement("div", {
	      className: prefix("values-area")
	    }, createElement("div", {
	      className: prefix("value")
	    })), createElement("div", {
	      className: prefix("keyframes-area")
	    }, createElement("div", {
	      className: prefix("keyframes")
	    }, createElement(TimeArea, {
	      ref: ref(this, "timeArea"),
	      timeline: timeline
	    }), createElement("div", {
	      className: prefix("play-control-area")
	    }, createElement("div", {
	      className: prefix("control prev"),
	      onClick: this.prev
	    }), createElement("div", {
	      className: prefix("control " + (this.state.isPlay ? "pause" : "play")),
	      onClick: this.togglePlay
	    }), createElement("div", {
	      className: prefix("control next"),
	      onClick: this.next
	    }), createElement("div", {
	      className: prefix("control " + (this.state.isRecord ? "playRecord" : "pauseRecord")),
	      onClick: this.toggleRecord
	    })))));
	  };

	  __proto.componentDidMount = function () {
	    this.initScene(this.props.scene);
	  };

	  __proto.componentDidUpdate = function (prevProps) {
	    if (prevProps.scene !== this.props.scene) {
	      this.initScene(this.props.scene);
	      this.releaseScene(prevProps.scene);
	    }
	  };

	  __proto.componentWillUnmount = function () {
	    this.releaseScene(this.props.scene);
	  };

	  __proto.initScene = function (scene) {
	    if (!scene) {
	      return;
	    }

	    scene.on({
	      play: this.play,
	      paused: this.pause
	    });
	  };

	  __proto.releaseScene = function (scene) {
	    if (!scene) {
	      return;
	    }

	    scene.off("play", this.play);
	    scene.off("paused", this.pause);
	  };

	  return ControlArea;
	}(ElementComponent);

	var KeyframeCursor =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(KeyframeCursor, _super);

	  function KeyframeCursor() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = KeyframeCursor.prototype;

	  __proto.render = function () {
	    return createElement("div", {
	      className: prefix("keyframe-cursor")
	    });
	  };

	  return KeyframeCursor;
	}(ElementComponent);

	var KeytimesArea =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(KeytimesArea, _super);

	  function KeytimesArea() {
	    var _this = _super !== null && _super.apply(this, arguments) || this;

	    _this.onWheel = function (e) {
	      var timeline = _this.props.timeline;
	      var delta = e.deltaY;
	      timeline.setZoom(timeline.getZoom() + delta / 5000);
	      !e.deltaX && e.preventDefault();
	    };

	    return _this;
	  }

	  var __proto = KeytimesArea.prototype;

	  __proto.renderKeytimes = function () {
	    var maxTime = this.props.maxTime;
	    var keytimes = [];

	    for (var time = 0; time <= maxTime; ++time) {
	      keytimes.push(createElement("div", {
	        key: time,
	        "data-time": time,
	        className: prefix("keytime"),
	        style: {
	          width: 100 / maxTime + "%"
	        }
	      }, createElement("span", null, time), createElement("div", {
	        className: prefix("graduation start")
	      }), createElement("div", {
	        className: prefix("graduation quarter")
	      }), createElement("div", {
	        className: prefix("graduation half")
	      }), createElement("div", {
	        className: prefix("graduation quarter3")
	      })));
	    }

	    return keytimes;
	  };

	  __proto.render = function () {
	    var _a = this.props,
	        maxTime = _a.maxTime,
	        maxDuration = _a.maxDuration,
	        zoom = _a.zoom;
	    return createElement("div", {
	      className: prefix("keytimes-area keyframes-area")
	    }, createElement("div", {
	      className: prefix("keyframes-scroll-area"),
	      ref: ref(this, "scrollAreaElement"),
	      style: {
	        minWidth: 50 * maxTime + "px",
	        width: Math.min(maxDuration ? maxTime / maxDuration : 1, 2) * zoom * 100 + "%"
	      }
	    }, createElement("div", {
	      className: prefix("keytimes keyframes")
	    }, createElement("div", {
	      className: prefix("keyframes-container")
	    }, this.renderKeytimes()), createElement(KeyframeCursor, {
	      ref: ref(this, "cursor")
	    }))));
	  };

	  __proto.componentDidMount = function () {
	    var _this = this;

	    addEvent(this.getElement(), "wheel", this.onWheel);
	    this.dragger = new Dragger(this.cursor.getElement(), {
	      dragstart: function (_a) {
	        var inputEvent = _a.inputEvent;
	        inputEvent.stopPropagation();
	      },
	      drag: function (_a) {
	        var clientX = _a.clientX;

	        _this.props.timeline.move(clientX);
	      },
	      container: window
	    });
	  };

	  __proto.componentWillUnmount = function () {
	    removeEvent(this.getElement(), "wheel", this.onWheel);
	    this.dragger.unset();
	  };

	  return KeytimesArea;
	}(ElementComponent);

	var HeaderArea =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(HeaderArea, _super);

	  function HeaderArea() {
	    var _this = _super !== null && _super.apply(this, arguments) || this;

	    _this.openDialog = function () {
	      _this.props.timeline.openDialog();
	    };

	    return _this;
	  }

	  var __proto = HeaderArea.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        timelineInfo = _a.timelineInfo,
	        maxTime = _a.maxTime,
	        maxDuration = _a.maxDuration,
	        zoom = _a.zoom,
	        timeline = _a.timeline;
	    return createElement("div", {
	      className: prefix("header-area")
	    }, createElement("div", {
	      className: prefix("properties-area")
	    }, createElement("div", {
	      className: prefix("property")
	    }, "Tracks")), createElement("div", {
	      className: prefix("values-area")
	    }, createElement("div", {
	      className: prefix("value")
	    }, createElement("div", {
	      className: prefix("add"),
	      title: "Add new track",
	      onClick: this.openDialog
	    }, "+"))), createElement(KeytimesArea, {
	      ref: ref(this, "keytimesArea"),
	      timeline: timeline,
	      timelineInfo: timelineInfo,
	      maxDuration: maxDuration,
	      maxTime: maxTime,
	      zoom: zoom
	    }));
	  };

	  return HeaderArea;
	}(ElementComponent);

	var Keyframe =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(Keyframe, _super);

	  function Keyframe() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = Keyframe.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        time = _a.time,
	        value = _a.value,
	        maxTime = _a.maxTime,
	        selected = _a.selected;
	    return createElement("div", {
	      className: prefix("keyframe" + (selected ? " select" : "")),
	      "data-time": time,
	      style: {
	        left: time / maxTime * 100 + "%"
	      }
	    }, time, " ", value);
	  };

	  return Keyframe;
	}(ElementComponent);

	var KeyframeGroup =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(KeyframeGroup, _super);

	  function KeyframeGroup() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = KeyframeGroup.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        time = _a.time,
	        nextTime = _a.nextTime,
	        maxTime = _a.maxTime,
	        selected = _a.selected;
	    return createElement("div", {
	      className: prefix("keyframe-group" + (selected ? " select" : "")),
	      "data-time": time,
	      style: {
	        left: time / maxTime * 100 + "%",
	        width: (nextTime - time) / maxTime * 100 + "%"
	      }
	    });
	  };

	  return KeyframeGroup;
	}(PureComponent);

	var KeyframeDelay =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(KeyframeDelay, _super);

	  function KeyframeDelay() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = KeyframeDelay.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        time = _a.time,
	        nextTime = _a.nextTime,
	        maxTime = _a.maxTime;
	    return createElement("div", {
	      className: prefix("keyframe-delay"),
	      style: {
	        left: time / maxTime * 100 + "%",
	        width: (nextTime - time) / maxTime * 100 + "%"
	      }
	    });
	  };

	  return KeyframeDelay;
	}(PureComponent);

	var KeyframeLine =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(KeyframeLine, _super);

	  function KeyframeLine() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = KeyframeLine.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        time = _a.time,
	        nextTime = _a.nextTime,
	        maxTime = _a.maxTime;
	    return createElement("div", {
	      className: prefix("keyframe-line"),
	      style: {
	        left: time / maxTime * 100 + "%",
	        width: (nextTime - time) / maxTime * 100 + "%"
	      }
	    });
	  };

	  return KeyframeLine;
	}(PureComponent);

	var Keyframes =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(Keyframes, _super);

	  function Keyframes() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = Keyframes.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        id = _a.id,
	        propertiesInfo = _a.propertiesInfo,
	        selected = _a.selected,
	        folded = _a.folded;
	    return createElement("div", {
	      className: prefix("keyframes" + (folded === 1 ? " fold" : "") + (selected ? " select" : "")),
	      "data-item": propertiesInfo.isItem ? "1" : "0",
	      "data-id": id
	    }, createElement("div", {
	      className: prefix("keyframes-container")
	    }, this.renderList()));
	  };

	  __proto.renderList = function () {
	    var _a = this.props,
	        propertiesInfo = _a.propertiesInfo,
	        maxTime = _a.maxTime,
	        selected = _a.selected,
	        selectedTime = _a.selectedTime;
	    var item = propertiesInfo.item,
	        frames = propertiesInfo.frames,
	        properties = propertiesInfo.properties;
	    var isItScene = isScene(item);
	    var duration = item.getDuration();
	    var keyframes = [];
	    var keyframeGroups = [];
	    var keyframeDelays = [];
	    var keyframeLines = [];
	    var length = frames.length;
	    var hasProperties = properties.length;
	    var startIndex = 0;

	    if (length >= 2 && !hasProperties) {
	      var delayedIndex = 0;

	      for (var i = 1; i < length; ++i) {
	        var iterationTime = frames[i][1];

	        if (frames[i - 1][1] === iterationTime && (iterationTime === 0 || iterationTime === duration)) {
	          delayedIndex = i;
	        } else {
	          break;
	        }
	      }

	      var index = findIndex(frames, function (_a) {
	        var value = _a[2];
	        return !isUndefined(value);
	      });
	      startIndex = Math.min(length - 2, Math.max(delayedIndex, index));
	      var startFrame = frames[startIndex];
	      var endFrame = frames[length - 1];
	      var time = startFrame[0];
	      var nextTime = endFrame[0];
	      keyframeGroups.push(createElement(KeyframeGroup, {
	        key: "group",
	        selected: selected && time <= selectedTime && selectedTime <= nextTime,
	        time: time,
	        nextTime: nextTime,
	        maxTime: maxTime
	      }));
	    }

	    frames.forEach(function (_a, i) {
	      var time = _a[0],
	          iterationTime = _a[1],
	          value = _a[2];
	      var valueText = toValue(value);

	      if (frames[i + 1]) {
	        var _b = frames[i + 1],
	            nextTime = _b[0],
	            nextIterationTime = _b[1];

	        if (iterationTime === 0 && nextIterationTime === 0 || iterationTime === duration && nextIterationTime === duration) {
	          keyframeDelays.push(createElement(KeyframeDelay, {
	            key: "delay" + time + "," + nextTime,
	            id: "-1",
	            time: time,
	            nextTime: nextTime,
	            maxTime: maxTime
	          }));
	        }
	      }

	      if (i === 0 && time === 0 && iterationTime === 0 && isUndefined(value) && !hasProperties) {
	        return;
	      }

	      if (frames[i + 1]) {
	        var _c = frames[i + 1],
	            nextTime = _c[0],
	            nextValue = _c[2];
	        var nextValueText = toValue(nextValue);

	        if (!isItScene && !isUndefined(value) && !isUndefined(nextValue) && valueText !== nextValueText && hasProperties) {
	          keyframeLines.push(createElement(KeyframeLine, {
	            key: "line" + keyframeLines.length,
	            time: time,
	            id: time + "," + nextTime,
	            nextTime: nextTime,
	            maxTime: maxTime
	          }));
	        }
	      }

	      if (isItScene || i < startIndex) {
	        return;
	      }

	      keyframes.push(createElement(Keyframe, {
	        key: "keyframe" + i,
	        selected: selected && time === selectedTime,
	        time: time,
	        value: valueText,
	        maxTime: maxTime
	      }));
	    });
	    return keyframeGroups.concat(keyframes, keyframeDelays, keyframeLines);
	  };

	  return Keyframes;
	}(ElementComponent);

	var KeyframeLine$1 =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(KeyframeLine, _super);

	  function KeyframeLine() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = KeyframeLine.prototype;

	  __proto.render = function () {
	    var maxTime = this.props.maxTime;
	    var lines = [];

	    for (var time = 0; time <= maxTime; ++time) {
	      lines.push(createElement("div", {
	        key: time,
	        className: prefix("division-line"),
	        style: {
	          left: 100 / maxTime * time + "%"
	        }
	      }));
	    }

	    return createElement("div", {
	      className: prefix("line-area")
	    }, lines);
	  };

	  return KeyframeLine;
	}(PureComponent);

	var KeyframesArea =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(KeyframesArea, _super);

	  function KeyframesArea() {
	    var _this = _super !== null && _super.apply(this, arguments) || this;

	    _this.keyframesList = [];
	    _this.state = {
	      foldedInfo: {}
	    };

	    _this.onWheel = function (e) {
	      // if (!KeyController.global.altKey) {
	      //     return;
	      // }
	      e.preventDefault();
	      var delta = e.deltaY;
	      var timeline = _this.props.timeline;
	      timeline.setZoom(timeline.getZoom() + delta / 5000);
	    };

	    return _this;
	  }

	  var __proto = KeyframesArea.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        timelineInfo = _a.timelineInfo,
	        maxTime = _a.maxTime,
	        maxDuration = _a.maxDuration,
	        zoom = _a.zoom,
	        selectedProperty = _a.selectedProperty,
	        selectedTime = _a.selectedTime;
	    var foldedInfo = this.state.foldedInfo;
	    var width = Math.min(maxDuration ? maxTime / maxDuration : 1, 2);
	    var keyframesList = [];
	    this.keyframesList = [];

	    for (var key in timelineInfo) {
	      var propertiesInfo = timelineInfo[key];
	      var selected = key === selectedProperty;
	      var folded = checkFolded(foldedInfo, propertiesInfo.keys);
	      keyframesList.push(createElement(Keyframes, {
	        ref: refs(this, "keyframesList", keyframesList.length),
	        selected: selected,
	        folded: folded,
	        selectedTime: selectedTime,
	        key: key,
	        id: key,
	        propertiesInfo: propertiesInfo,
	        maxTime: maxTime
	      }));
	    }

	    return createElement("div", {
	      className: prefix("keyframes-area"),
	      onWheel: this.onWheel
	    }, createElement("div", {
	      className: prefix("keyframes-scroll-area"),
	      ref: ref(this, "scrollAreaElement"),
	      style: {
	        minWidth: 50 * maxTime + "px",
	        width: width * zoom * 100 + "%"
	      }
	    }, keyframesList.concat([createElement(KeyframeCursor, {
	      key: "cursor",
	      ref: ref(this, "cursor")
	    }), createElement(KeyframeLine$1, {
	      maxTime: maxTime,
	      key: "lines"
	    })])));
	  };

	  return KeyframesArea;
	}(ElementComponent);

	var Property =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(Property, _super);

	  function Property() {
	    var _this = _super !== null && _super.apply(this, arguments) || this;

	    _this.onClick = function (e) {
	      var target = e.target;

	      if (hasClass$1(target, "arrow")) {
	        _this.onClickArrow();
	      } else if (hasClass$1(target, "remove")) {
	        _this.onClickRemove();
	      } else {
	        var _a = _this.props,
	            timeline = _a.timeline,
	            id = _a.id;
	        timeline.select(id);
	      }
	    };

	    _this.onClickArrow = function () {
	      var _a = _this.props,
	          id = _a.id,
	          timeline = _a.timeline,
	          scrollArea = _a.scrollArea,
	          index = _a.index;
	      timeline.select(id);
	      scrollArea.fold(index);
	    };

	    _this.onClickRemove = function () {
	      var _a = _this.props,
	          propertiesInfo = _a.propertiesInfo,
	          timeline = _a.timeline;
	      var isItem = propertiesInfo.isItem,
	          parentItem = propertiesInfo.parentItem,
	          targetItem = propertiesInfo.item,
	          properties = propertiesInfo.properties;

	      if (isItem) {
	        var targetName_1 = null;
	        parentItem.forEach(function (item, name) {
	          if (item === targetItem) {
	            targetName_1 = name;
	            return;
	          }
	        });

	        if (targetName_1 != null) {
	          parentItem.removeItem(targetName_1);
	        }
	      } else {
	        var times = targetItem.times;
	        times.forEach(function (time) {
	          var _a;

	          (_a = targetItem).remove.apply(_a, [time].concat(properties));
	        });
	      }

	      timeline.select("", -1, true);
	      timeline.update();
	    };

	    return _this;
	  }

	  var __proto = Property.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        id = _a.id,
	        selected = _a.selected,
	        folded = _a.folded,
	        _b = _a.propertiesInfo,
	        propertyNames = _b.keys,
	        isItem = _b.isItem,
	        isParent = _b.isParent;
	    var length = propertyNames.length;
	    var name = propertyNames[length - 1];
	    return createElement("div", {
	      className: prefix("property"
	      /*+ (folded === 1 ? " fold" : "")*/
	      + (selected ? " select" : "")),
	      onClick: this.onClick,
	      "data-id": id,
	      "data-name": name,
	      "data-object": isParent ? 1 : 0,
	      "data-item": isItem ? 1 : 0,
	      "data-fold": folded === 2 ? 1 : 0,
	      style: {
	        paddingLeft: 10 + (length - 1) * 20 + "px"
	      }
	    }, createElement("span", null, name), createElement("div", {
	      className: prefix("remove"),
	      title: "Remove selected track"
	    }));
	  };

	  return Property;
	}(ElementComponent);

	var PropertiesArea =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(PropertiesArea, _super);

	  function PropertiesArea() {
	    var _this = _super !== null && _super.apply(this, arguments) || this;

	    _this.properties = [];
	    _this.state = {
	      foldedInfo: {}
	    };
	    return _this;
	  }

	  var __proto = PropertiesArea.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        timelineInfo = _a.timelineInfo,
	        selectedProperty = _a.selectedProperty,
	        timeline = _a.timeline,
	        scrollArea = _a.scrollArea;
	    var foldedInfo = this.state.foldedInfo;
	    var properties = [];
	    this.properties = [];
	    var index = -1;

	    for (var id in timelineInfo) {
	      var propertiesInfo = timelineInfo[id];
	      var selected = selectedProperty === id;
	      var folded = checkFolded(foldedInfo, propertiesInfo.keys);
	      ++index;
	      properties.push(createElement(Property, {
	        ref: refs(this, "properties", index),
	        timeline: timeline,
	        scrollArea: scrollArea,
	        selected: selected,
	        folded: folded,
	        key: id,
	        id: id,
	        index: index,
	        propertiesInfo: propertiesInfo
	      }));
	    }

	    return createElement("div", {
	      className: prefix("properties-area")
	    }, createElement("div", {
	      className: prefix("properties-scroll-area")
	    }, properties));
	  };

	  return PropertiesArea;
	}(ElementComponent);

	var Value =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(Value, _super);

	  function Value() {
	    var _this = _super !== null && _super.apply(this, arguments) || this;

	    _this.add = function () {
	      var _a = _this.props,
	          _b = _a.propertiesInfo,
	          item = _b.item,
	          properties = _b.properties,
	          timeline = _a.timeline;
	      timeline.openDialog(item, properties);
	    };

	    return _this;
	  }

	  var __proto = Value.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        id = _a.id,
	        selected = _a.selected,
	        folded = _a.folded,
	        _b = _a.propertiesInfo,
	        isItem = _b.isItem,
	        isParent = _b.isParent;
	    return createElement("div", {
	      className: prefix("value" + (folded === 1 ? " fold" : "") + (selected ? " select" : "")),
	      "data-id": id,
	      "data-object": isParent ? 1 : 0,
	      "data-item": isItem ? 1 : 0
	    }, this.renderValue());
	  };

	  __proto.renderValue = function () {
	    // const { isParent } = this.props.propertiesInfo;
	    // if (isParent) {
	    //     return (
	    //         <div className={prefix("add")} on={this.add}>+</div>
	    //     );
	    // } else {
	    return createElement("input", {
	      ref: ref(this, "inputElement")
	    }); //}
	  };

	  return Value;
	}(ElementComponent);

	var ValuesArea =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(ValuesArea, _super);

	  function ValuesArea() {
	    var _this = _super !== null && _super.apply(this, arguments) || this;

	    _this.values = [];
	    _this.state = {
	      foldedInfo: {}
	    };
	    return _this;
	  }

	  var __proto = ValuesArea.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        timelineInfo = _a.timelineInfo,
	        selectedProperty = _a.selectedProperty,
	        timeline = _a.timeline;
	    var foldedInfo = this.state.foldedInfo;
	    var values = [];
	    this.values = [];

	    for (var id in timelineInfo) {
	      var propertiesInfo = timelineInfo[id];
	      var selected = selectedProperty === id;
	      var folded = checkFolded(foldedInfo, propertiesInfo.keys);
	      values.push(createElement(Value, {
	        ref: refs(this, "values", values.length),
	        timeline: timeline,
	        key: id,
	        folded: folded,
	        selected: selected,
	        id: id,
	        propertiesInfo: propertiesInfo
	      }));
	    }

	    return createElement("div", {
	      className: prefix("values-area")
	    }, values);
	  };

	  __proto.componentDidMount = function () {
	    var _this = this;

	    var element = this.getElement();
	    var dragTarget;
	    var dragTargetValue;
	    element.addEventListener("focusout", function (e) {
	      _this.props.timeline.setTime();
	    });
	    this.dragger = new Dragger(element, {
	      container: window,
	      dragstart: function (e) {
	        dragTarget = e.inputEvent.target;
	        dragTargetValue = dragTarget.value;

	        if (!KeyController.global.altKey || !getTarget(dragTarget, function (el) {
	          return el.nodeName === "INPUT";
	        })) {
	          return false;
	        }
	      },
	      drag: function (e) {
	        var nextValue = dragTargetValue.replace(/-?\d+/g, function (num) {
	          return "" + (parseFloat(num) + Math.round(e.distX / 2));
	        });
	        dragTarget.value = nextValue;
	      },
	      dragend: function (e) {
	        _this.edit(dragTarget, dragTarget.value);
	      }
	    });
	    this.keycon = new KeyController(element).keydown(function (e) {
	      !e.isToggle && e.inputEvent.stopPropagation();
	    }).keyup(function (e) {
	      !e.isToggle && e.inputEvent.stopPropagation();
	    }).keyup("enter", function (e) {
	      var target = e.inputEvent.target;

	      _this.edit(target, target.value);
	    }).keyup("esc", function (e) {
	      var target = e.inputEvent.target;
	      target.blur();
	    });
	  };

	  __proto.componentWillUnmount = function () {
	    this.dragger.unset();
	    this.keycon.off();
	  };

	  __proto.edit = function (target, value) {
	    var parentEl = getTarget(target, function (el) {
	      return hasClass$1(el, "value");
	    });

	    if (!parentEl) {
	      return;
	    }

	    var index = findIndex(this.values, function (v) {
	      return v.getElement() === parentEl;
	    });

	    if (index === -1) {
	      return;
	    }

	    this.props.timeline.editKeyframe(index, value);
	  };

	  return ValuesArea;
	}(ElementComponent);

	var ScrollArea =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(ScrollArea, _super);

	  function ScrollArea() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = ScrollArea.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        zoom = _a.zoom,
	        maxDuration = _a.maxDuration,
	        maxTime = _a.maxTime,
	        timelineInfo = _a.timelineInfo,
	        selectedProperty = _a.selectedProperty,
	        selectedTime = _a.selectedTime,
	        timeline = _a.timeline;
	    return createElement("div", {
	      className: prefix("scroll-area")
	    }, createElement(PropertiesArea, {
	      ref: ref(this, "propertiesArea"),
	      timeline: timeline,
	      scrollArea: this,
	      timelineInfo: timelineInfo,
	      selectedProperty: selectedProperty
	    }), createElement(ValuesArea, {
	      ref: ref(this, "valuesArea"),
	      timeline: timeline,
	      timelineInfo: timelineInfo,
	      selectedProperty: selectedProperty
	    }), createElement(KeyframesArea, {
	      ref: ref(this, "keyframesArea"),
	      timeline: timeline,
	      zoom: zoom,
	      maxDuration: maxDuration,
	      timelineInfo: timelineInfo,
	      maxTime: maxTime,
	      selectedProperty: selectedProperty,
	      selectedTime: selectedTime
	    }));
	  };

	  __proto.componentDidMount = function () {
	    this.foldAll();
	  };

	  __proto.foldAll = function () {
	    var _this = this; // fold all


	    this.propertiesArea.properties.forEach(function (property, i) {
	      var isParent = property.props.propertiesInfo.isParent;

	      if (isParent) {
	        _this.fold(i);
	      }
	    });
	  };

	  __proto.fold = function (index, isNotUpdate) {
	    var selectedProperty = this.propertiesArea.properties[index];
	    var foldedId = selectedProperty.props.id;
	    fold(this.propertiesArea, foldedId, isNotUpdate);
	    fold(this.valuesArea, foldedId, isNotUpdate);
	    fold(this.keyframesArea, foldedId, isNotUpdate);
	  };

	  return ScrollArea;
	}(ElementComponent);

	var prevTime = 0;
	var prevX = -1;
	var prevY = -1;
	function dblCheck(isDrag, e, clientX, clientY, callback) {
	  var currentTime = now();

	  if (!isDrag) {
	    if (prevX === clientX && prevY === clientY && currentTime - prevTime <= 500) {
	      callback(e, clientX, clientY);
	    }

	    prevX = clientX;
	    prevY = clientY;
	    prevTime = currentTime;
	  }
	}

	var MAXIMUM$1 = 1000000;
	function toFixed$1(num) {
	  return Math.round(num * MAXIMUM$1) / MAXIMUM$1;
	}
	function addEntry$1(entries, time, keytime) {
	  var prevEntry = entries[entries.length - 1];
	  (!prevEntry || prevEntry[0] !== time || prevEntry[1] !== keytime) && entries.push([toFixed$1(time), toFixed$1(keytime)]);
	}
	function getEntries$1(times, states) {
	  if (!times.length) {
	    return [];
	  }

	  var entries = times.map(function (time) {
	    return [time, time];
	  });
	  var nextEntries = [];
	  var firstEntry = entries[0];

	  if (firstEntry[0] !== 0 && states[states.length - 1][DELAY$1]) {
	    entries.unshift([0, 0]);
	  }

	  states.forEach(function (state) {
	    var iterationCount = state[ITERATION_COUNT$1];
	    var delay = state[DELAY$1];
	    var playSpeed = state[PLAY_SPEED$1];
	    var direction = state[DIRECTION$1];
	    var intCount = Math.ceil(iterationCount);
	    var currentDuration = entries[entries.length - 1][0];
	    var length = entries.length;
	    var lastTime = currentDuration * iterationCount;

	    for (var i = 0; i < intCount; ++i) {
	      var isReverse = direction === REVERSE$1 || direction === ALTERNATE$1 && i % 2 || direction === ALTERNATE_REVERSE$1 && !(i % 2);

	      for (var j = 0; j < length; ++j) {
	        var entry = entries[isReverse ? length - j - 1 : j];
	        var time = entry[1];
	        var currentTime = currentDuration * i + (isReverse ? currentDuration - entry[0] : entry[0]);
	        var prevEntry = entries[isReverse ? length - j : j - 1];

	        if (currentTime > lastTime) {
	          if (j !== 0) {
	            var prevTime = currentDuration * i + (isReverse ? currentDuration - prevEntry[0] : prevEntry[0]);
	            var divideTime = dot(prevEntry[1], time, lastTime - prevTime, currentTime - lastTime);
	            addEntry$1(nextEntries, (delay + currentDuration * iterationCount) / playSpeed, divideTime);
	          }

	          break;
	        } else if (currentTime === lastTime && nextEntries.length && nextEntries[nextEntries.length - 1][0] === lastTime + delay) {
	          break;
	        }

	        addEntry$1(nextEntries, (delay + currentTime) / playSpeed, time);
	      }
	    } // delay time


	    delay && nextEntries.unshift([0, nextEntries[0][1]]);
	    entries = nextEntries;
	    nextEntries = [];
	  });
	  return entries;
	}
	function getFiniteEntries(times, states) {
	  var infiniteIndex = findIndex(states, function (state) {
	    return state[ITERATION_COUNT$1] === INFINITE$1;
	  }, states.length - 1) + 1;
	  return getEntries$1(times, states.slice(0, infiniteIndex));
	}
	function getItemInfo(timelineInfo, items, names, item) {
	  item.update();
	  var times = item.times.slice();
	  var originalDuration = item.getDuration();
	  !item.getFrame(0) && times.unshift(0);
	  !item.getFrame(originalDuration) && times.push(originalDuration);
	  var states = items.slice(1).map(function (animator) {
	    return animator.state;
	  }).reverse();
	  var entries = getFiniteEntries(times, states);
	  var parentItem = items[items.length - 2];

	  (function getPropertyInfo(itemNames) {
	    var properties = [];

	    for (var _i = 1; _i < arguments.length; _i++) {
	      properties[_i - 1] = arguments[_i];
	    }

	    var frames = [];
	    var isParent = isObject(itemNames);
	    var isItem = properties.length === 0;
	    entries.forEach(function (_a) {
	      var time = _a[0],
	          iterationTime = _a[1];
	      var value = item.get.apply(item, [iterationTime].concat(properties));

	      if (isUndefined(value) && properties.length) {
	        return;
	      }

	      frames.push([time, iterationTime, value]);
	    });
	    var keys = names.concat(properties);
	    var key = keys.join("///");

	    if (key) {
	      timelineInfo[key] = {
	        key: key,
	        keys: keys,
	        parentItem: parentItem,
	        isParent: isParent,
	        isItem: isItem,
	        item: item,
	        names: names,
	        properties: properties,
	        frames: frames
	      };
	    }

	    if (isParent) {
	      for (var property in itemNames) {
	        getPropertyInfo.apply(void 0, [itemNames[property]].concat(properties, [property]));
	      }
	    }
	  })(item.names);
	}
	function getTimelineInfo(scene) {
	  var timelineInfo = {};

	  (function sceneForEach() {
	    var items = [];

	    for (var _i = 0; _i < arguments.length; _i++) {
	      items[_i] = arguments[_i];
	    }

	    var length = items.length;
	    var lastItem = items[length - 1];
	    var names = items.slice(1).map(function (item) {
	      return item.getId();
	    });

	    if (isScene(lastItem)) {
	      if (names.length) {
	        var key = names.join("///");
	        var times = [0, lastItem.getDuration()];
	        var entries = getFiniteEntries(times, items.slice(1).map(function (animator) {
	          return animator.state;
	        }).reverse());
	        var frames_1 = [];
	        entries.forEach(function (_a) {
	          var time = _a[0],
	              iterationTime = _a[1];
	          frames_1.push([time, iterationTime, iterationTime]);
	        });
	        timelineInfo[key] = {
	          key: key,
	          keys: names,
	          isItem: true,
	          isParent: true,
	          parentItem: items[length - 2],
	          item: lastItem,
	          names: [],
	          properties: [],
	          frames: frames_1
	        };
	      }

	      lastItem.forEach(function (item) {
	        sceneForEach.apply(void 0, items.concat([item]));
	      });
	    } else {
	      getItemInfo(timelineInfo, items, names, lastItem);
	    }
	  })(scene);

	  return timelineInfo;
	}

	var TimelineElement = styled("div", CSS);

	var Timeline =
	/*#__PURE__*/
	function (_super) {
	  __extends$6(Timeline, _super);

	  function Timeline(props) {
	    var _this = _super.call(this, props) || this;

	    _this.values = {};
	    _this.state = {
	      alt: false,
	      zoom: 1,
	      maxDuration: 0,
	      maxTime: 10,
	      timelineInfo: {},
	      selectedProperty: "",
	      selectedTime: -1,
	      selectedItem: null,
	      init: false,
	      updateTime: false
	    };
	    _this.keyMap = {
	      keydown: {
	        alt: function () {
	          _this.setState({
	            alt: true
	          });
	        },
	        space: function (_a) {
	          var inputEvent = _a.inputEvent;
	          inputEvent.preventDefault();
	        },
	        left: function () {
	          _this.prev();
	        },
	        right: function () {
	          _this.context();
	        }
	      },
	      keyup: {
	        alt: function () {
	          _this.setState({
	            alt: false
	          });
	        },
	        esc: function () {
	          _this.finish();
	        },
	        backspace: function () {
	          _this.removeKeyframe(_this.state.selectedProperty);
	        },
	        space: function () {
	          _this.togglePlay();
	        }
	      }
	    };

	    _this.update = function (isInit, zoomUpdate) {
	      if (isInit === void 0) {
	        isInit = false;
	      }

	      if (zoomUpdate === void 0) {
	        zoomUpdate = true;
	      }

	      var scene = _this.props.scene;

	      if (!scene) {
	        return;
	      }

	      var maxDuration = zoomUpdate ? Math.ceil(scene.getDuration()) + 1 : _this.state.maxDuration; //const maxDuration = 5;

	      var maxTime = maxDuration; //const maxTime = Math.max(this.state.maxTime, maxDuration);
	      //const currentMaxTime = this.state.maxTime;
	      // const zoom = this.state.zoom;
	      // const nextZoomScale = currentMaxTime > 1 ? maxTime / currentMaxTime : 1;
	      // const nextZoom = Math.max(1, zoom * nextZoomScale);

	      var nextZoom = 1;

	      _this.setState({
	        timelineInfo: getTimelineInfo(scene),
	        maxTime: maxTime,
	        maxDuration: maxDuration,
	        updateTime: true,
	        init: isInit,
	        zoom: nextZoom
	      });
	    };

	    _this.prev = function () {
	      var scene = _this.props.scene;
	      scene && _this.setTime(scene.getTime() - 0.05);
	    };

	    _this.finish = function () {
	      var scene = _this.props.scene;
	      scene && scene.finish();
	    };

	    _this.togglePlay = function () {
	      var scene = _this.props.scene;

	      if (!scene) {
	        return;
	      }

	      var playState;

	      if (scene.getPlayState() === "running") {
	        scene.pause();
	        playState = false;
	      } else {
	        scene.play();
	        playState = true;
	      }

	      if (_this.props.onTogglePlay) {
	        _this.props.onTogglePlay(playState);
	      }
	    };

	    _this.toggleRecord = function (recordingState) {
	      if (_this.props.onToggleRecord) {
	        _this.props.onToggleRecord(recordingState);
	      }
	    };

	    _this.getDistTime = function (distX, rect) {
	      if (rect === void 0) {
	        rect = _this.scrollArea.keyframesArea.scrollAreaElement.getBoundingClientRect();
	      }

	      var scrollAreaWidth = rect.width - 30;
	      var percentage = Math.min(scrollAreaWidth, distX) / scrollAreaWidth;
	      var time = _this.state.maxTime * percentage;
	      return Math.round(time * 20) / 20;
	    };

	    _this.getTime = function (clientX) {
	      var rect = _this.scrollArea.keyframesArea.scrollAreaElement.getBoundingClientRect();

	      var scrollAreaX = rect.left + 15;
	      var x = Math.max(clientX - scrollAreaX, 0);
	      return _this.getDistTime(x, rect);
	    };

	    _this.animate = function (e) {
	      var time = e.time;
	      var minute = numberFormat(Math.floor(time / 60), 2);
	      var second = numberFormat(Math.floor(time % 60), 2);
	      var milisecond = numberFormat(Math.floor(time % 1 * 100), 3, true);

	      _this.moveCursor(time);

	      _this.setInputs(flatObject(e.frames || e.frame.get()));

	      _this.controlArea.timeArea.getElement().value = minute + ":" + second + ":" + milisecond;
	    };

	    _this.onBlur = function () {
	      if (_this.state.alt === true) {
	        _this.setState({
	          alt: false
	        });
	      }
	    };

	    _this.state = __assign$3({}, _this.state, _this.initScene(_this.props.scene, false));
	    return _this;
	  }

	  var __proto = Timeline.prototype;

	  __proto.render = function () {
	    var _a = this.props,
	        scene = _a.scene,
	        className = _a.className,
	        keyboard = _a.keyboard,
	        onSelect = _a.onSelect,
	        attributes = __rest$1(_a, ["scene", "className", "keyboard", "onSelect"]);

	    var _b = this.state,
	        zoom = _b.zoom,
	        alt = _b.alt,
	        maxDuration = _b.maxDuration,
	        maxTime = _b.maxTime,
	        timelineInfo = _b.timelineInfo,
	        selectedProperty = _b.selectedProperty,
	        selectedTime = _b.selectedTime;
	    return createElement(TimelineElement, __assign$3({
	      className: prefix("timeline" + (alt ? " alt" : "")) + (className ? " " + className : "")
	    }, attributes), createElement(ControlArea, {
	      ref: ref(this, "controlArea"),
	      scene: scene,
	      timeline: this
	    }), createElement(HeaderArea, {
	      ref: ref(this, "headerArea"),
	      timeline: this,
	      maxDuration: maxDuration,
	      zoom: zoom,
	      maxTime: maxTime,
	      timelineInfo: timelineInfo
	    }), createElement(ScrollArea, {
	      ref: ref(this, "scrollArea"),
	      timeline: this,
	      maxDuration: maxDuration,
	      zoom: zoom,
	      maxTime: maxTime,
	      selectedProperty: selectedProperty,
	      selectedTime: selectedTime,
	      timelineInfo: timelineInfo
	    }));
	  };

	  __proto.componentDidMount = function () {
	    this.initWheelZoom();
	    this.initScroll();
	    this.initDragKeyframes();
	    this.initKeyController();
	  };

	  __proto.componentDidUpdate = function (prevProps) {
	    var scene = this.props.scene;
	    var state = this.state;

	    if (state.init) {
	      state.init = false;
	      this.scrollArea.foldAll();
	    }

	    if (prevProps.scene !== scene) {
	      this.releaseScene(prevProps.scene);
	      this.setState(this.initScene(scene, true));
	    }

	    if (state.updateTime) {
	      state.updateTime = false;
	      this.setTime();
	    }
	  };

	  __proto.componentWillUnmount = function () {
	    this.draggers.forEach(function (dragger) {
	      dragger.unset();
	    });
	    this.pinchDragger.unset();
	    var keycon = KeyController.global;
	    var keyMap = this.keyMap;
	    var keydownMap = keyMap.keydown;
	    var keyupMap = keyMap.keyup;
	    removeEvent(window, "blur", this.onBlur);
	    keycon.offKeydown("alt", keydownMap.alt).offKeyup("alt", keyupMap.alt);

	    if (this.props.keyboard) {
	      keycon.offKeydown("space", keydownMap.space).offKeydown("left", keydownMap.left).offKeydown("right", keydownMap.right).offKeyup("backspace", keyupMap.backspace).offKeyup("esc", keyupMap.esc).offKeyup("space", keyupMap.space);
	    }
	  };

	  __proto.next = function () {
	    var scene = this.props.scene;
	    scene && this.setTime(scene.getTime() + 0.05);
	  };

	  __proto.selectItem = function (scene) {
	    var _a = this.state,
	        timelineInfo = _a.timelineInfo,
	        selectedTime = _a.selectedTime;

	    for (var name in timelineInfo) {
	      var info = timelineInfo[name];

	      if (info.item === scene) {
	        this.select(info.key, selectedTime);
	        break;
	      }
	    }
	  };

	  __proto.select = function (property, time, isNotUpdate) {
	    if (time === void 0) {
	      time = -1;
	    }

	    var activeElement = document.activeElement;

	    if (activeElement && activeElement.blur) {
	      activeElement.blur();
	    }

	    var scene = this.props.scene;

	    if (!scene) {
	      return;
	    }

	    scene.pause();
	    var state = this.state;
	    var prevSelectedProperty = state.selectedProperty,
	        prevSelectedTime = state.selectedTime,
	        prevSelectedItem = state.selectedItem,
	        timelineInfo = state.timelineInfo;
	    var propertiesInfo = timelineInfo[property];
	    var selectedItem = property ? propertiesInfo.item : this.props.scene;
	    var selectedName = property ? propertiesInfo.names.join("///") : "";

	    if (this.props.onSelect) {
	      this.props.onSelect({
	        selectedItem: selectedItem,
	        selectedName: selectedName,
	        selectedProperty: property,
	        selectedTime: time,
	        prevSelectedProperty: prevSelectedProperty,
	        prevSelectedTime: prevSelectedTime,
	        prevSelectedItem: prevSelectedItem
	      });
	    }

	    if (isNotUpdate) {
	      state.selectedProperty = property;
	      state.selectedTime = time;
	      state.selectedItem = selectedItem;
	    } else {
	      this.setState({
	        selectedProperty: property,
	        selectedTime: time,
	        selectedItem: selectedItem
	      });
	    }
	  };

	  __proto.editKeyframe = function (index, value) {
	    var propertiesInfo = this.scrollArea.propertiesArea.properties[index].props.propertiesInfo; // const isObjectData = propertiesInfo.isParent;
	    // if (isObjectData) {
	    //     return;
	    // }

	    var item = propertiesInfo.item;
	    var properties = propertiesInfo.properties;
	    item.set.apply(item, [item.getIterationTime()].concat(properties, [value]));
	    this.update();
	  };

	  __proto.setTime = function (time) {
	    var scene = this.props.scene;

	    if (!scene) {
	      return;
	    }

	    var direction = scene.getDirection();
	    scene.pause();

	    if (isUndefined(time)) {
	      time = scene.getTime();
	    }

	    var activeTime = time;

	    if (direction === "normal" || direction === "alternate") {
	      scene.setTime(time);
	    } else {
	      activeTime = scene.getDuration() - time;
	      scene.setTime(activeTime);
	    }

	    if (this.props.onTimeUpdated) {
	      this.props.onTimeUpdated(activeTime);
	    }
	  };

	  __proto.setZoom = function (zoom) {
	    this.setState({
	      zoom: Math.max(zoom, 1)
	    });
	  };

	  __proto.getZoom = function () {
	    return this.state.zoom;
	  };

	  __proto.getValues = function () {
	    return this.values;
	  };

	  __proto.openDialog = function (item, properties) {
	    if (item === void 0) {
	      item = this.props.scene;
	    }

	    if (properties === void 0) {
	      properties = [];
	    }

	    if (!this.props.scene) {
	      return;
	    }

	    if (isScene(item)) {
	      this.newItem(item);
	    } else {
	      this.newProperty(item, properties);
	    }
	  };

	  __proto.move = function (clientX) {
	    this.setTime(this.getTime(clientX));
	  };

	  __proto.newItem = function (scene) {
	    var name = prompt("New Track Name");

	    if (!name) {
	      return;
	    }

	    var item = scene.newItem(name);
	    this.update();

	    if (this.props.onTrackAdded) {
	      this.props.onTrackAdded(item);
	    }
	  };

	  __proto.newProperty = function (item, properties) {
	    var property = prompt("Add Property");

	    if (!property) {
	      return;
	    }

	    var roles = ROLES;
	    var nextProperties = properties.concat([property]);
	    var isRole = nextProperties.every(function (name) {
	      if (isObject(roles[name])) {
	        roles = roles[name];
	        return true;
	      }

	      return false;
	    });
	    item.set.apply(item, [item.getIterationTime()].concat(nextProperties, [isRole ? {} : ""]));
	    this.update();
	  };

	  __proto.moveCursor = function (time) {
	    var maxTime = this.state.maxTime;
	    var px = 15 - 30 * time / maxTime;
	    var percent = 100 * time / maxTime;
	    var left = "calc(" + percent + "% + " + px + "px)";
	    this.scrollArea.keyframesArea.cursor.getElement().style.left = left;
	    this.headerArea.keytimesArea.cursor.getElement().style.left = left;
	  };

	  __proto.setInputs = function (obj) {
	    this.values = obj;
	    var valuesArea = this.scrollArea.valuesArea.getElement();

	    for (var name in obj) {
	      valuesArea.querySelector("[data-id=\"" + name + "\"] input").value = obj[name];
	    }
	  };

	  __proto.removeKeyframe = function (property) {
	    var propertiesInfo = this.state.timelineInfo[property];

	    if (!property || !propertiesInfo || isScene(propertiesInfo.item)) {
	      return;
	    }

	    var properties = propertiesInfo.properties;
	    var item = propertiesInfo.item;
	    item.remove.apply(item, [item.getIterationTime()].concat(properties));
	    this.update();
	  };

	  __proto.addKeyframe = function (index, time) {
	    var keyframesList = this.scrollArea.keyframesArea.keyframesList;
	    var id = keyframesList[index].props.id; // --- check if we need to change the duration of the animation

	    if (this.props.scene) {
	      var timelineInfo = getTimelineInfo(this.props.scene);
	      var propertiesInfo = timelineInfo[id];
	      var selectedItem = propertiesInfo.item;
	      var itemTotalDuration = selectedItem.getTotalDuration();

	      if (time > itemTotalDuration) {
	        // @ts-ignore
	        selectedItem.newFrame(time);
	        this.setTime(time);
	      }
	    }

	    this.select(id, time);
	    this.editKeyframe(index, ""); // const inputElement = this.scrollArea.valuesArea.values[index]
	    //     .inputElement!;
	    // if (inputElement) {
	    //     this.editKeyframe(index, inputElement.value);
	    // }
	  };

	  __proto.initScene = function (scene, isInit) {
	    if (!scene) {
	      return {
	        timelineInfo: {},
	        maxTime: 0,
	        maxDuration: 0,
	        zoom: 1,
	        init: false
	      };
	    }

	    scene.finish();
	    scene.on("animate", this.animate);
	    var duration = Math.ceil(scene.getDuration());
	    return {
	      timelineInfo: getTimelineInfo(scene),
	      maxTime: duration,
	      maxDuration: duration,
	      zoom: 1,
	      init: isInit || false
	    };
	  };

	  __proto.releaseScene = function (scene) {
	    if (!scene) {
	      return;
	    }

	    scene.off("animate", this.animate);
	  };

	  __proto.initWheelZoom = function () {
	    var _this = this;

	    var keyframesArea = this.scrollArea.keyframesArea.getElement();
	    this.pinchDragger = new Dragger(keyframesArea, {
	      pinchstart: function (_a) {
	        var datas = _a.datas;
	        datas.zoom = _this.state.zoom;
	      },
	      pinch: function (_a) {
	        var scale = _a.scale,
	            datas = _a.datas;
	        console.log("SCALE", scale);

	        _this.setZoom(datas.zoom * scale);
	      }
	    });
	  };

	  __proto.initScroll = function () {
	    var isScrollKeyframe = false;
	    var headerKeyframesArea = this.headerArea.keytimesArea.getElement();
	    var scrollKeyframesArea = this.scrollArea.keyframesArea.getElement();
	    headerKeyframesArea.addEventListener("scroll", function () {
	      if (isScrollKeyframe) {
	        isScrollKeyframe = false;
	      } else {
	        isScrollKeyframe = true;
	        scrollKeyframesArea.scrollLeft = headerKeyframesArea.scrollLeft;
	      }
	    });
	    scrollKeyframesArea.addEventListener("scroll", function (e) {
	      if (isScrollKeyframe) {
	        isScrollKeyframe = false;
	      } else {
	        isScrollKeyframe = true;
	        headerKeyframesArea.scrollLeft = scrollKeyframesArea.scrollLeft;
	      }
	    });
	  };

	  __proto.selectByKeyframe = function (keyframeElement) {
	    var keyframesElement = keyframeElement.parentElement.parentElement;
	    var time = parseFloat(keyframeElement.getAttribute("data-time") || "0");
	    var id = keyframesElement.getAttribute("data-id") || "";
	    this.setTime(time);
	    this.select(id, time);
	  };

	  __proto.initDragKeyframes = function () {
	    var _this = this;

	    var click = function (e, clientX, clientY) {
	      var time = _this.getTime(clientX);

	      var list = _this.scrollArea.keyframesArea.keyframesList;
	      var index = findElementIndexByPosition(list.map(function (keyframes) {
	        return keyframes.getElement();
	      }), clientY);

	      _this.setTime(time);

	      index > -1 && _this.select(list[index].props.id, time);
	      e.preventDefault();
	    };

	    var dblclick = function (e, clientX, clientY) {
	      var list = _this.scrollArea.keyframesArea.keyframesList;
	      var index = findElementIndexByPosition(list.map(function (keyframes) {
	        return keyframes.getElement();
	      }), clientY);

	      if (index === -1) {
	        return;
	      }

	      _this.addKeyframe(index, _this.getTime(clientX));
	    };

	    var keytimesScrollArea = this.headerArea.keytimesArea.scrollAreaElement;
	    var keyframesScrollArea = this.scrollArea.keyframesArea.scrollAreaElement;
	    var dragItem;
	    var dragDelay = 0;
	    var dragTarget;
	    this.draggers = [keytimesScrollArea, keyframesScrollArea].map(function (element) {
	      var baseFrameTimes = [];
	      return new Dragger(element, {
	        container: window,
	        dragstart: function (_a) {
	          var clientX = _a.clientX,
	              inputEvent = _a.inputEvent;
	          var inputTarget = inputEvent.target;
	          var keyframeTarget = getTarget(inputTarget, function (el) {
	            return hasClass$1(el, "keyframe");
	          });

	          if (keyframeTarget) {
	            _this.selectByKeyframe(keyframeTarget);

	            return false;
	          }

	          dragTarget = getTarget(inputTarget, function (el) {
	            return hasClass$1(el, "keyframe-group");
	          });

	          if (dragTarget) {
	            var properties = _this.scrollArea.propertiesArea.properties;
	            var keyframesElement = getTarget(dragTarget, function (el) {
	              return hasClass$1(el, "keyframes");
	            });
	            var id_1 = keyframesElement.getAttribute("data-id");
	            var property = find(properties, function (p) {
	              return p.props.id === id_1;
	            });
	            var propertiesInfo = property.props.propertiesInfo;
	            dragItem = propertiesInfo.item; // @ts-ignore

	            var editorDelay = dragItem.editorDelay;
	            dragDelay = editorDelay ? editorDelay : 0.0;
	            var index = 0;

	            for (var time in dragItem.items) {
	              baseFrameTimes[index] = parseFloat(time);
	              index++;
	            }
	          }
	        },
	        drag: function (_a) {
	          var distX = _a.distX,
	              deltaX = _a.deltaX,
	              deltaY = _a.deltaY,
	              inputEvent = _a.inputEvent;

	          if (dragTarget && dragItem) {
	            var nextDelay = dragDelay + _this.getDistTime(distX); // @ts-ignore


	            if (dragItem.editorDelay !== nextDelay) {
	              // @ts-ignore
	              dragItem.editorDelay = nextDelay;
	              var items = dragItem.items;
	              var index = 0;

	              for (var time in items) {
	                var newTime = baseFrameTimes[index] + nextDelay; // @ts-ignore

	                dragItem.removeFrame(time); // @ts-ignore

	                dragItem.newFrame(newTime);
	                index++;
	              } // @ts-ignore


	              dragItem.update();

	              _this.update(false, false);
	            }
	          } else {
	            _this.scrollArea.keyframesArea.getElement().scrollLeft -= deltaX;
	            _this.scrollArea.getElement().scrollTop -= deltaY;
	            inputEvent.preventDefault();
	          }
	        },
	        dragend: function (_a) {
	          var isDrag = _a.isDrag,
	              clientX = _a.clientX,
	              clientY = _a.clientY,
	              inputEvent = _a.inputEvent;
	          dragTarget = null;
	          dragItem = null;
	          dragDelay = 0;
	          !isDrag && click(inputEvent, clientX, clientY);
	          dblCheck(isDrag, inputEvent, clientX, clientY, dblclick);
	        }
	      });
	    });
	  };

	  __proto.initKeyController = function () {
	    addEvent(window, "blur", this.onBlur);
	    var keycon = KeyController.global;
	    var keyMap = this.keyMap;
	    var keydownMap = keyMap.keydown;
	    var keyupMap = keyMap.keyup;
	    keycon.keydown("alt", keydownMap.alt).keyup("alt", keyupMap.alt);

	    if (this.props.keyboard) {
	      keycon.keydown("space", keydownMap.space).keydown("left", keydownMap.left).keydown("right", keydownMap.right).keyup("backspace", keyupMap.backspace).keyup("esc", keyupMap.esc).keyup("space", keyupMap.space);
	    }
	  };

	  Timeline.defaultProps = {
	    keyboard: true,
	    onSelect: function () {},
	    onTrackAdded: function () {},
	    onTogglePlay: function () {},
	    onToggleRecord: function () {},
	    onTimeUpdated: function () {}
	  };
	  return Timeline;
	}(PureProps);

	var Timeline$1 =
	/*#__PURE__*/
	function (_super) {
	  __extends(Timeline$1, _super);

	  function Timeline$1() {
	    return _super !== null && _super.apply(this, arguments) || this;
	  }

	  var __proto = Timeline$1.prototype;

	  __proto.render = function () {
	    var _this = this;

	    return h(Timeline, __assign({}, this.props, {
	      ref: function (e) {
	        _this.timeline = e;
	      }
	    }));
	  };

	  __proto.update = function (isInit) {
	    this.timeline.update(isInit);
	  };

	  __proto.prev = function () {
	    this.timeline.prev();
	  };

	  __proto.next = function () {
	    this.timeline.next();
	  };

	  __proto.finish = function () {
	    this.timeline.finish();
	  };

	  __proto.togglePlay = function () {
	    this.timeline.togglePlay();
	  };

	  return Timeline$1;
	}(Component);
	 //# sourceMappingURL=Timeline.js.map

	//# sourceMappingURL=index.js.map

	/*
	Copyright (c) Daybrush
	name: @scenejs/effects
	license: MIT
	author: Daybrush
	repository: git+https://github.com/daybrush/scenejs-effects.git
	version: 0.1.0
	*/

	/**
	 * @namespace Effects
	 */

	/**
	 * Use the property to create an effect.
	 * @memberof Effects
	 * @private
	 * @param - property to set effect
	 * @param - values of 100%
	 * @example
	// import {set, blink} from "@scenejs/effects";
	// Scene.set("opacity", [0, 1, 0], {duration: 2});
	set("opacity", [0, 1, 0], {duration: 2});

	// Same
	// Scene.blink({duration: 2});
	blink({ duration: 2});

	// Same
	new SceneItem({
	    "0%": {
	        opacity: 0,
	    },
	    "50%": {
	        opacity: 1,
	    }
	    "100%": {
	        opacity: 0,
	    }
	}, {
	    duration: 2,
	});
	 */

	function set(property, values, options) {
	  var item = new SceneItem({}, options);
	  var length = values.length;

	  for (var i = 0; i < length; ++i) {
	    item.set(i / (length - 1) * 100 + "%", property, values[i]);
	  }

	  return item;
	}
	/**
	 * Make a zoom in effect.
	 * @memberof Effects
	 * @param options
	 * @param {number} [options.from = 0] start zoom
	 * @param {number}[options.to = 1] end zoom
	 * @param {number} options.duration animation's duration
	 * @example
	import { zoomIn } from "@scenejs/effects";

	// Scene.zoomIn({duration: 2});
	zoomIn({duration: 2});

	// Same
	new SceneItem({
	    "0%": {
	        "transform": "scale(0)",
	    },
	    "100%": {
	        "transform": "scale(1)",
	    }
	}, {
	    duration: 2,
	});
	 */


	function zoomIn(_a) {
	  var _b = _a === void 0 ? {} : _a,
	      _c = _b.from,
	      from = _c === void 0 ? 0 : _c,
	      _d = _b.to,
	      to = _d === void 0 ? 1 : _d;

	  return set(["transform", "scale"], [from, to], arguments[0]);
	}
	//# sourceMappingURL=effects.esm.js.map

	/*
	Copyright (c) 2018 Daybrush
	@name: @daybrush/utils
	license: MIT
	author: Daybrush
	repository: https://github.com/daybrush/utils
	@version 0.5.2
	*/
	/**
	* Checks if the specified class value exists in the element's class attribute.
	* @memberof DOM
	* @param element - target
	* @param className - the class name to search
	* @return {boolean} return false if the class is not found.
	* @example
	import {hasClass} from "@daybrush/utils";

	console.log(hasClass(element, "start")); // true or false
	*/

	function hasClass$2(element, className) {
	  if (element.classList) {
	    return element.classList.contains(className);
	  }

	  return !!element.className.match(new RegExp("(\\s|^)" + className + "(\\s|$)"));
	}
	/**
	* Add the specified class value. If these classe already exist in the element's class attribute they are ignored.
	* @memberof DOM
	* @param element - target
	* @param className - the class name to add
	* @example
	import {addClass} from "@daybrush/utils";

	addClass(element, "start");
	*/

	function addClass$1(element, className) {
	  if (element.classList) {
	    element.classList.add(className);
	  } else {
	    element.className += " " + className;
	  }
	}
	//# sourceMappingURL=utils.esm.js.map

	/*
	Copyright (c) 2018 Daybrush
	name: shape-svg
	license: MIT
	author: Daybrush
	repository: https://github.com/daybrush/shape-svg
	@version 0.3.3
	*/

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */
	var __assign$4 = function () {
	  __assign$4 = Object.assign || function __assign(t) {
	    for (var s, i = 1, n = arguments.length; i < n; i++) {
	      s = arguments[i];

	      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
	    }

	    return t;
	  };

	  return __assign$4.apply(this, arguments);
	};
	function __rest$2(s, e) {
	  var t = {};

	  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];

	  if (s != null && typeof Object.getOwnPropertySymbols === "function") for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0) t[p[i]] = s[p[i]];
	  return t;
	}

	var CLASS_NAME = "__shape-svg";

	function makeDOM(tag) {
	  return document.createElementNS("http://www.w3.org/2000/svg", tag);
	}

	function makeSVGDOM() {
	  var el = makeDOM("svg");
	  addClass$1(el, CLASS_NAME);
	  return el;
	}

	function setAttributes(element, attributes) {
	  for (var name in attributes) {
	    element.setAttribute(name, attributes[name]);
	  }
	}

	function setStyles(element, styles) {
	  var cssText = [];

	  for (var name in styles) {
	    cssText.push(name + ":" + styles[name] + ";");
	  }

	  element.style.cssText += cssText.join("");
	}

	function setViewBox(container, _a) {
	  var width = _a.width,
	      height = _a.height,
	      left = _a.left,
	      right = _a.right,
	      bottom = _a.bottom,
	      top = _a.top,
	      strokeWidth = _a.strokeWidth,
	      className = _a.className;

	  if (container && hasClass$2(container, CLASS_NAME)) {
	    className && className.split(" ").forEach(function (name) {
	      addClass$1(container, name);
	    });

	    var _b = (container.getAttribute("viewBox") || "").split(" ").map(function (pos) {
	      return parseFloat(pos || "0");
	    }),
	        _c = _b[2],
	        boxWidth = _c === void 0 ? 0 : _c,
	        _d = _b[3],
	        boxHeight = _d === void 0 ? 0 : _d;

	    container.setAttribute("viewBox", "0 0 " + ( // tslint:disable-next-line:max-line-length
	    Math.max(left + width + right + strokeWidth, boxWidth) + " " + Math.max(top + height + bottom + strokeWidth, boxHeight)));
	  }
	}

	function getRect(_a) {
	  var _b = _a.left,
	      left = _b === void 0 ? 0 : _b,
	      _c = _a.top,
	      top = _c === void 0 ? 0 : _c,
	      _d = _a.side,
	      side = _d === void 0 ? 3 : _d,
	      _e = _a.rotate,
	      rotate = _e === void 0 ? 0 : _e,
	      _f = _a.innerRadius,
	      innerRadius = _f === void 0 ? 100 : _f,
	      _g = _a.height,
	      height = _g === void 0 ? 0 : _g,
	      _h = _a.split,
	      split = _h === void 0 ? 1 : _h,
	      _j = _a.width,
	      width = _j === void 0 ? height ? 0 : 100 : _j,
	      _k = _a.strokeLinejoin,
	      strokeLinejoin = _k === void 0 ? "round" : _k,
	      _l = _a.strokeWidth,
	      strokeWidth = _l === void 0 ? 0 : _l;
	  var xPoints = [];
	  var yPoints = [];
	  var sideCos = Math.cos(Math.PI / side);
	  var startRad = Math.PI / 180 * rotate + Math.PI * ((side % 2 ? 0 : 1 / side) - 1 / 2);

	  for (var i = 0; i < side; ++i) {
	    var rad = Math.PI * (1 / side * 2 * i) + startRad;
	    var cos = Math.cos(rad);
	    var sin = Math.sin(rad);
	    xPoints.push(cos);
	    yPoints.push(sin);

	    if (innerRadius !== 100) {
	      if (sideCos <= innerRadius / 100) {
	        continue;
	      } else {
	        xPoints.push(innerRadius / 100 * Math.cos(rad + Math.PI / side));
	        yPoints.push(innerRadius / 100 * Math.sin(rad + Math.PI / side));
	      }
	    }
	  }

	  var minX = Math.min.apply(Math, xPoints);
	  var minY = Math.min.apply(Math, yPoints);
	  var maxX = Math.max.apply(Math, xPoints);
	  var maxY = Math.max.apply(Math, yPoints);
	  var isWidth = !!width;
	  var scale = isWidth ? width / (maxX - minX) : height / (maxY - minY);
	  var isOuter = strokeLinejoin === "miter" || strokeLinejoin === "arcs" || strokeLinejoin === "miter-clip";
	  var sideSin = Math.sin(Math.PI / side);
	  var innerCos = Math.min(sideCos, innerRadius / 100);
	  var innerScale = scale * innerCos;
	  var diagonal = strokeWidth / 2 / (sideCos === innerCos ? 1 : Math.sin(Math.atan(sideSin / (sideCos - innerCos))));
	  var outerScale = isOuter ? (innerScale + diagonal) / innerScale : 1;
	  var pos = isOuter ? 0 : strokeWidth / 2;
	  xPoints = xPoints.map(function (xp) {
	    return (xp - minX * outerScale) * scale + pos;
	  });
	  yPoints = yPoints.map(function (yp) {
	    return (yp - minY * outerScale) * scale + pos;
	  });
	  var pathWidth = (maxX - minX) * outerScale * scale + pos * 2;
	  var pathHeight = (maxY - minY) * outerScale * scale + pos * 2;
	  var length = xPoints.length;
	  var points = [];
	  points.push([left + xPoints[0], top + yPoints[0]]);

	  for (var i = 1; i <= length; ++i) {
	    var x1 = xPoints[i - 1];
	    var y1 = yPoints[i - 1];
	    var x2 = xPoints[i === length ? 0 : i];
	    var y2 = yPoints[i === length ? 0 : i];

	    for (var j = 1; j <= split; ++j) {
	      var x = (x1 * (split - j) + x2 * j) / split;
	      var y = (y1 * (split - j) + y2 * j) / split;
	      points.push([left + x, top + y]);
	    }
	  }

	  return {
	    points: points,
	    width: pathWidth,
	    height: pathHeight
	  };
	}
	function getPath(points) {
	  return points.map(function (point, i) {
	    return (i === 0 ? "M" : "L") + " " + point.join(" ");
	  }).join(" ") + " Z";
	}
	function be(path, _a, container) {
	  var _b = _a.left,
	      left = _b === void 0 ? 0 : _b,
	      _c = _a.top,
	      top = _c === void 0 ? 0 : _c,
	      _d = _a.right,
	      right = _d === void 0 ? 0 : _d,
	      _e = _a.bottom,
	      bottom = _e === void 0 ? 0 : _e,
	      side = _a.side,
	      split = _a.split,
	      rotate = _a.rotate,
	      innerRadius = _a.innerRadius,
	      height = _a.height,
	      width = _a.width,
	      _f = _a.fill,
	      fill = _f === void 0 ? "transparent" : _f,
	      _g = _a.strokeLinejoin,
	      strokeLinejoin = _g === void 0 ? "round" : _g,
	      _h = _a.strokeWidth,
	      strokeWidth = _h === void 0 ? 0 : _h,
	      _j = _a.css,
	      css = _j === void 0 ? false : _j,
	      className = _a.className,
	      attributes = __rest$2(_a, ["left", "top", "right", "bottom", "side", "split", "rotate", "innerRadius", "height", "width", "fill", "strokeLinejoin", "strokeWidth", "css", "className"]);

	  var _k = getRect({
	    left: left,
	    top: top,
	    split: split,
	    side: side,
	    rotate: rotate,
	    width: width,
	    height: height,
	    innerRadius: innerRadius,
	    strokeLinejoin: strokeLinejoin,
	    strokeWidth: strokeWidth
	  }),
	      points = _k.points,
	      pathWidth = _k.width,
	      pathHeight = _k.height;

	  setViewBox(container, {
	    left: left,
	    top: top,
	    bottom: bottom,
	    right: right,
	    className: className,
	    strokeWidth: 0,
	    width: pathWidth,
	    height: pathHeight
	  });
	  var d = getPath(points);
	  css ? setStyles(path, {
	    d: "path('" + d + "')"
	  }) : setAttributes(path, {
	    d: d
	  });
	  setAttributes(path, __assign$4({
	    fill: fill,
	    "stroke-linejoin": strokeLinejoin,
	    "stroke-width": "" + strokeWidth
	  }, attributes));
	}
	function poly(options, container) {
	  if (container === void 0) {
	    container = makeSVGDOM();
	  }

	  var path = makeDOM("path");
	  be(path, options, container);
	  container.appendChild(path);
	  return container;
	}
	//# sourceMappingURL=shape-svg.esm.js.map

	var App =
	/*#__PURE__*/
	function (_super) {
	  __extends(App, _super);

	  function App() {
	    var _this = _super !== null && _super.apply(this, arguments) || this;

	    _this.scene = new Scene();
	    return _this;
	  }

	  var __proto = App.prototype;

	  __proto.render = function () {
	    var _this = this;

	    return h("div", null, h("div", {
	      className: "clapper"
	    }, h("div", {
	      className: "clapper-container"
	    }, h("div", {
	      className: "clapper-body"
	    }, h("div", {
	      className: "top"
	    }, h("div", {
	      className: "stick stick1"
	    }, h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    })), h("div", {
	      className: "stick stick2"
	    }, h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    }), h("div", {
	      className: "rect"
	    }))), h("div", {
	      className: "bottom"
	    })), h("div", {
	      className: "circle"
	    }), h("div", {
	      className: "play"
	    }))), h(Timeline$1, {
	      ref: function (e) {
	        _this.timeline = e;
	      },
	      scene: this.scene,
	      style: {
	        maxHeight: "350px",
	        position: "fixed",
	        left: 0,
	        right: 0,
	        bottom: 0
	      }
	    }));
	  };

	  __proto.componentDidMount = function () {
	    window.app = this;
	    document.querySelector(".play").appendChild(poly({
	      strokeWidth: 10,
	      left: 5,
	      top: 5,
	      right: 5,
	      bottom: 5,
	      width: 50,
	      rotate: 90,
	      fill: "#333",
	      stroke: "#333"
	    }));
	    this.scene.load({
	      ".clapper": {
	        2: "transform: translate(-50%, -50%) rotate(0deg)",
	        2.5: {
	          transform: "rotate(-15deg)"
	        },
	        3: {
	          transform: "rotate(0deg)"
	        },
	        3.5: {
	          transform: "rotate(-10deg)"
	        }
	      },
	      ".clapper-container": {
	        0: zoomIn({
	          duration: 1
	        })
	      },
	      ".circle": {
	        0.3: zoomIn({
	          duration: 1
	        })
	      },
	      ".play": {
	        0: {
	          transform: "translate(-50%, -50%)"
	        },
	        0.6: zoomIn({
	          duration: 1
	        })
	      },
	      ".top .stick1": {
	        2: {
	          transform: {
	            rotate: "0deg"
	          }
	        },
	        2.5: {
	          transform: {
	            rotate: "-20deg"
	          }
	        },
	        3: {
	          transform: {
	            rotate: "0deg"
	          }
	        },
	        3.5: {
	          transform: {
	            rotate: "-10deg"
	          }
	        }
	      },
	      ".stick1 .rect": function (i) {
	        return {
	          0: {
	            transform: {
	              scale: 0,
	              skew: "15deg"
	            }
	          },
	          0.7: {
	            transform: {
	              scale: 1
	            }
	          },
	          options: {
	            delay: 0.6 + i * 0.1
	          }
	        };
	      },
	      ".stick2 .rect": function (i) {
	        return {
	          0: {
	            transform: {
	              scale: 0,
	              skew: "-15deg"
	            }
	          },
	          0.7: {
	            transform: {
	              scale: 1
	            }
	          },
	          options: {
	            delay: 0.8 + i * 0.1
	          }
	        };
	      }
	    }, {
	      easing: "ease-in-out",
	      iterationCount: "infinite",
	      selector: true
	    });
	    this.timeline.update(true);
	  };

	  return App;
	}(Component);
	 //# sourceMappingURL=App.js.map

	render(h(App, null), document.getElementById("root")); //# sourceMappingURL=index.js.map

}));
