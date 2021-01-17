
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35730/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
(function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function stop_propagation(fn) {
        return function (event) {
            event.stopPropagation();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var tinycolor = createCommonjsModule(function (module) {
    // TinyColor v1.4.2
    // https://github.com/bgrins/TinyColor
    // Brian Grinstead, MIT License

    (function(Math) {

    var trimLeft = /^\s+/,
        trimRight = /\s+$/,
        tinyCounter = 0,
        mathRound = Math.round,
        mathMin = Math.min,
        mathMax = Math.max,
        mathRandom = Math.random;

    function tinycolor (color, opts) {

        color = (color) ? color : '';
        opts = opts || { };

        // If input is already a tinycolor, return itself
        if (color instanceof tinycolor) {
           return color;
        }
        // If we are called as a function, call using new instead
        if (!(this instanceof tinycolor)) {
            return new tinycolor(color, opts);
        }

        var rgb = inputToRGB(color);
        this._originalInput = color,
        this._r = rgb.r,
        this._g = rgb.g,
        this._b = rgb.b,
        this._a = rgb.a,
        this._roundA = mathRound(100*this._a) / 100,
        this._format = opts.format || rgb.format;
        this._gradientType = opts.gradientType;

        // Don't let the range of [0,255] come back in [0,1].
        // Potentially lose a little bit of precision here, but will fix issues where
        // .5 gets interpreted as half of the total, instead of half of 1
        // If it was supposed to be 128, this was already taken care of by `inputToRgb`
        if (this._r < 1) { this._r = mathRound(this._r); }
        if (this._g < 1) { this._g = mathRound(this._g); }
        if (this._b < 1) { this._b = mathRound(this._b); }

        this._ok = rgb.ok;
        this._tc_id = tinyCounter++;
    }

    tinycolor.prototype = {
        isDark: function() {
            return this.getBrightness() < 128;
        },
        isLight: function() {
            return !this.isDark();
        },
        isValid: function() {
            return this._ok;
        },
        getOriginalInput: function() {
          return this._originalInput;
        },
        getFormat: function() {
            return this._format;
        },
        getAlpha: function() {
            return this._a;
        },
        getBrightness: function() {
            //http://www.w3.org/TR/AERT#color-contrast
            var rgb = this.toRgb();
            return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        },
        getLuminance: function() {
            //http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
            var rgb = this.toRgb();
            var RsRGB, GsRGB, BsRGB, R, G, B;
            RsRGB = rgb.r/255;
            GsRGB = rgb.g/255;
            BsRGB = rgb.b/255;

            if (RsRGB <= 0.03928) {R = RsRGB / 12.92;} else {R = Math.pow(((RsRGB + 0.055) / 1.055), 2.4);}
            if (GsRGB <= 0.03928) {G = GsRGB / 12.92;} else {G = Math.pow(((GsRGB + 0.055) / 1.055), 2.4);}
            if (BsRGB <= 0.03928) {B = BsRGB / 12.92;} else {B = Math.pow(((BsRGB + 0.055) / 1.055), 2.4);}
            return (0.2126 * R) + (0.7152 * G) + (0.0722 * B);
        },
        setAlpha: function(value) {
            this._a = boundAlpha(value);
            this._roundA = mathRound(100*this._a) / 100;
            return this;
        },
        toHsv: function() {
            var hsv = rgbToHsv(this._r, this._g, this._b);
            return { h: hsv.h * 360, s: hsv.s, v: hsv.v, a: this._a };
        },
        toHsvString: function() {
            var hsv = rgbToHsv(this._r, this._g, this._b);
            var h = mathRound(hsv.h * 360), s = mathRound(hsv.s * 100), v = mathRound(hsv.v * 100);
            return (this._a == 1) ?
              "hsv("  + h + ", " + s + "%, " + v + "%)" :
              "hsva(" + h + ", " + s + "%, " + v + "%, "+ this._roundA + ")";
        },
        toHsl: function() {
            var hsl = rgbToHsl(this._r, this._g, this._b);
            return { h: hsl.h * 360, s: hsl.s, l: hsl.l, a: this._a };
        },
        toHslString: function() {
            var hsl = rgbToHsl(this._r, this._g, this._b);
            var h = mathRound(hsl.h * 360), s = mathRound(hsl.s * 100), l = mathRound(hsl.l * 100);
            return (this._a == 1) ?
              "hsl("  + h + ", " + s + "%, " + l + "%)" :
              "hsla(" + h + ", " + s + "%, " + l + "%, "+ this._roundA + ")";
        },
        toHex: function(allow3Char) {
            return rgbToHex(this._r, this._g, this._b, allow3Char);
        },
        toHexString: function(allow3Char) {
            return '#' + this.toHex(allow3Char);
        },
        toHex8: function(allow4Char) {
            return rgbaToHex(this._r, this._g, this._b, this._a, allow4Char);
        },
        toHex8String: function(allow4Char) {
            return '#' + this.toHex8(allow4Char);
        },
        toRgb: function() {
            return { r: mathRound(this._r), g: mathRound(this._g), b: mathRound(this._b), a: this._a };
        },
        toRgbString: function() {
            return (this._a == 1) ?
              "rgb("  + mathRound(this._r) + ", " + mathRound(this._g) + ", " + mathRound(this._b) + ")" :
              "rgba(" + mathRound(this._r) + ", " + mathRound(this._g) + ", " + mathRound(this._b) + ", " + this._roundA + ")";
        },
        toPercentageRgb: function() {
            return { r: mathRound(bound01(this._r, 255) * 100) + "%", g: mathRound(bound01(this._g, 255) * 100) + "%", b: mathRound(bound01(this._b, 255) * 100) + "%", a: this._a };
        },
        toPercentageRgbString: function() {
            return (this._a == 1) ?
              "rgb("  + mathRound(bound01(this._r, 255) * 100) + "%, " + mathRound(bound01(this._g, 255) * 100) + "%, " + mathRound(bound01(this._b, 255) * 100) + "%)" :
              "rgba(" + mathRound(bound01(this._r, 255) * 100) + "%, " + mathRound(bound01(this._g, 255) * 100) + "%, " + mathRound(bound01(this._b, 255) * 100) + "%, " + this._roundA + ")";
        },
        toName: function() {
            if (this._a === 0) {
                return "transparent";
            }

            if (this._a < 1) {
                return false;
            }

            return hexNames[rgbToHex(this._r, this._g, this._b, true)] || false;
        },
        toFilter: function(secondColor) {
            var hex8String = '#' + rgbaToArgbHex(this._r, this._g, this._b, this._a);
            var secondHex8String = hex8String;
            var gradientType = this._gradientType ? "GradientType = 1, " : "";

            if (secondColor) {
                var s = tinycolor(secondColor);
                secondHex8String = '#' + rgbaToArgbHex(s._r, s._g, s._b, s._a);
            }

            return "progid:DXImageTransform.Microsoft.gradient("+gradientType+"startColorstr="+hex8String+",endColorstr="+secondHex8String+")";
        },
        toString: function(format) {
            var formatSet = !!format;
            format = format || this._format;

            var formattedString = false;
            var hasAlpha = this._a < 1 && this._a >= 0;
            var needsAlphaFormat = !formatSet && hasAlpha && (format === "hex" || format === "hex6" || format === "hex3" || format === "hex4" || format === "hex8" || format === "name");

            if (needsAlphaFormat) {
                // Special case for "transparent", all other non-alpha formats
                // will return rgba when there is transparency.
                if (format === "name" && this._a === 0) {
                    return this.toName();
                }
                return this.toRgbString();
            }
            if (format === "rgb") {
                formattedString = this.toRgbString();
            }
            if (format === "prgb") {
                formattedString = this.toPercentageRgbString();
            }
            if (format === "hex" || format === "hex6") {
                formattedString = this.toHexString();
            }
            if (format === "hex3") {
                formattedString = this.toHexString(true);
            }
            if (format === "hex4") {
                formattedString = this.toHex8String(true);
            }
            if (format === "hex8") {
                formattedString = this.toHex8String();
            }
            if (format === "name") {
                formattedString = this.toName();
            }
            if (format === "hsl") {
                formattedString = this.toHslString();
            }
            if (format === "hsv") {
                formattedString = this.toHsvString();
            }

            return formattedString || this.toHexString();
        },
        clone: function() {
            return tinycolor(this.toString());
        },

        _applyModification: function(fn, args) {
            var color = fn.apply(null, [this].concat([].slice.call(args)));
            this._r = color._r;
            this._g = color._g;
            this._b = color._b;
            this.setAlpha(color._a);
            return this;
        },
        lighten: function() {
            return this._applyModification(lighten, arguments);
        },
        brighten: function() {
            return this._applyModification(brighten, arguments);
        },
        darken: function() {
            return this._applyModification(darken, arguments);
        },
        desaturate: function() {
            return this._applyModification(desaturate, arguments);
        },
        saturate: function() {
            return this._applyModification(saturate, arguments);
        },
        greyscale: function() {
            return this._applyModification(greyscale, arguments);
        },
        spin: function() {
            return this._applyModification(spin, arguments);
        },

        _applyCombination: function(fn, args) {
            return fn.apply(null, [this].concat([].slice.call(args)));
        },
        analogous: function() {
            return this._applyCombination(analogous, arguments);
        },
        complement: function() {
            return this._applyCombination(complement, arguments);
        },
        monochromatic: function() {
            return this._applyCombination(monochromatic, arguments);
        },
        splitcomplement: function() {
            return this._applyCombination(splitcomplement, arguments);
        },
        triad: function() {
            return this._applyCombination(triad, arguments);
        },
        tetrad: function() {
            return this._applyCombination(tetrad, arguments);
        }
    };

    // If input is an object, force 1 into "1.0" to handle ratios properly
    // String input requires "1.0" as input, so 1 will be treated as 1
    tinycolor.fromRatio = function(color, opts) {
        if (typeof color == "object") {
            var newColor = {};
            for (var i in color) {
                if (color.hasOwnProperty(i)) {
                    if (i === "a") {
                        newColor[i] = color[i];
                    }
                    else {
                        newColor[i] = convertToPercentage(color[i]);
                    }
                }
            }
            color = newColor;
        }

        return tinycolor(color, opts);
    };

    // Given a string or object, convert that input to RGB
    // Possible string inputs:
    //
    //     "red"
    //     "#f00" or "f00"
    //     "#ff0000" or "ff0000"
    //     "#ff000000" or "ff000000"
    //     "rgb 255 0 0" or "rgb (255, 0, 0)"
    //     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
    //     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
    //     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
    //     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
    //     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
    //     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
    //
    function inputToRGB(color) {

        var rgb = { r: 0, g: 0, b: 0 };
        var a = 1;
        var s = null;
        var v = null;
        var l = null;
        var ok = false;
        var format = false;

        if (typeof color == "string") {
            color = stringInputToObject(color);
        }

        if (typeof color == "object") {
            if (isValidCSSUnit(color.r) && isValidCSSUnit(color.g) && isValidCSSUnit(color.b)) {
                rgb = rgbToRgb(color.r, color.g, color.b);
                ok = true;
                format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
            }
            else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.v)) {
                s = convertToPercentage(color.s);
                v = convertToPercentage(color.v);
                rgb = hsvToRgb(color.h, s, v);
                ok = true;
                format = "hsv";
            }
            else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.l)) {
                s = convertToPercentage(color.s);
                l = convertToPercentage(color.l);
                rgb = hslToRgb(color.h, s, l);
                ok = true;
                format = "hsl";
            }

            if (color.hasOwnProperty("a")) {
                a = color.a;
            }
        }

        a = boundAlpha(a);

        return {
            ok: ok,
            format: color.format || format,
            r: mathMin(255, mathMax(rgb.r, 0)),
            g: mathMin(255, mathMax(rgb.g, 0)),
            b: mathMin(255, mathMax(rgb.b, 0)),
            a: a
        };
    }


    // Conversion Functions
    // --------------------

    // `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
    // <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

    // `rgbToRgb`
    // Handle bounds / percentage checking to conform to CSS color spec
    // <http://www.w3.org/TR/css3-color/>
    // *Assumes:* r, g, b in [0, 255] or [0, 1]
    // *Returns:* { r, g, b } in [0, 255]
    function rgbToRgb(r, g, b){
        return {
            r: bound01(r, 255) * 255,
            g: bound01(g, 255) * 255,
            b: bound01(b, 255) * 255
        };
    }

    // `rgbToHsl`
    // Converts an RGB color value to HSL.
    // *Assumes:* r, g, and b are contained in [0, 255] or [0, 1]
    // *Returns:* { h, s, l } in [0,1]
    function rgbToHsl(r, g, b) {

        r = bound01(r, 255);
        g = bound01(g, 255);
        b = bound01(b, 255);

        var max = mathMax(r, g, b), min = mathMin(r, g, b);
        var h, s, l = (max + min) / 2;

        if(max == min) {
            h = s = 0; // achromatic
        }
        else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }

            h /= 6;
        }

        return { h: h, s: s, l: l };
    }

    // `hslToRgb`
    // Converts an HSL color value to RGB.
    // *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
    // *Returns:* { r, g, b } in the set [0, 255]
    function hslToRgb(h, s, l) {
        var r, g, b;

        h = bound01(h, 360);
        s = bound01(s, 100);
        l = bound01(l, 100);

        function hue2rgb(p, q, t) {
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        if(s === 0) {
            r = g = b = l; // achromatic
        }
        else {
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return { r: r * 255, g: g * 255, b: b * 255 };
    }

    // `rgbToHsv`
    // Converts an RGB color value to HSV
    // *Assumes:* r, g, and b are contained in the set [0, 255] or [0, 1]
    // *Returns:* { h, s, v } in [0,1]
    function rgbToHsv(r, g, b) {

        r = bound01(r, 255);
        g = bound01(g, 255);
        b = bound01(b, 255);

        var max = mathMax(r, g, b), min = mathMin(r, g, b);
        var h, s, v = max;

        var d = max - min;
        s = max === 0 ? 0 : d / max;

        if(max == min) {
            h = 0; // achromatic
        }
        else {
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h, s: s, v: v };
    }

    // `hsvToRgb`
    // Converts an HSV color value to RGB.
    // *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
    // *Returns:* { r, g, b } in the set [0, 255]
     function hsvToRgb(h, s, v) {

        h = bound01(h, 360) * 6;
        s = bound01(s, 100);
        v = bound01(v, 100);

        var i = Math.floor(h),
            f = h - i,
            p = v * (1 - s),
            q = v * (1 - f * s),
            t = v * (1 - (1 - f) * s),
            mod = i % 6,
            r = [v, q, p, p, t, v][mod],
            g = [t, v, v, q, p, p][mod],
            b = [p, p, t, v, v, q][mod];

        return { r: r * 255, g: g * 255, b: b * 255 };
    }

    // `rgbToHex`
    // Converts an RGB color to hex
    // Assumes r, g, and b are contained in the set [0, 255]
    // Returns a 3 or 6 character hex
    function rgbToHex(r, g, b, allow3Char) {

        var hex = [
            pad2(mathRound(r).toString(16)),
            pad2(mathRound(g).toString(16)),
            pad2(mathRound(b).toString(16))
        ];

        // Return a 3 character hex if possible
        if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
            return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
        }

        return hex.join("");
    }

    // `rgbaToHex`
    // Converts an RGBA color plus alpha transparency to hex
    // Assumes r, g, b are contained in the set [0, 255] and
    // a in [0, 1]. Returns a 4 or 8 character rgba hex
    function rgbaToHex(r, g, b, a, allow4Char) {

        var hex = [
            pad2(mathRound(r).toString(16)),
            pad2(mathRound(g).toString(16)),
            pad2(mathRound(b).toString(16)),
            pad2(convertDecimalToHex(a))
        ];

        // Return a 4 character hex if possible
        if (allow4Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1) && hex[3].charAt(0) == hex[3].charAt(1)) {
            return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0) + hex[3].charAt(0);
        }

        return hex.join("");
    }

    // `rgbaToArgbHex`
    // Converts an RGBA color to an ARGB Hex8 string
    // Rarely used, but required for "toFilter()"
    function rgbaToArgbHex(r, g, b, a) {

        var hex = [
            pad2(convertDecimalToHex(a)),
            pad2(mathRound(r).toString(16)),
            pad2(mathRound(g).toString(16)),
            pad2(mathRound(b).toString(16))
        ];

        return hex.join("");
    }

    // `equals`
    // Can be called with any tinycolor input
    tinycolor.equals = function (color1, color2) {
        if (!color1 || !color2) { return false; }
        return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
    };

    tinycolor.random = function() {
        return tinycolor.fromRatio({
            r: mathRandom(),
            g: mathRandom(),
            b: mathRandom()
        });
    };


    // Modification Functions
    // ----------------------
    // Thanks to less.js for some of the basics here
    // <https://github.com/cloudhead/less.js/blob/master/lib/less/functions.js>

    function desaturate(color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.s -= amount / 100;
        hsl.s = clamp01(hsl.s);
        return tinycolor(hsl);
    }

    function saturate(color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.s += amount / 100;
        hsl.s = clamp01(hsl.s);
        return tinycolor(hsl);
    }

    function greyscale(color) {
        return tinycolor(color).desaturate(100);
    }

    function lighten (color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.l += amount / 100;
        hsl.l = clamp01(hsl.l);
        return tinycolor(hsl);
    }

    function brighten(color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var rgb = tinycolor(color).toRgb();
        rgb.r = mathMax(0, mathMin(255, rgb.r - mathRound(255 * - (amount / 100))));
        rgb.g = mathMax(0, mathMin(255, rgb.g - mathRound(255 * - (amount / 100))));
        rgb.b = mathMax(0, mathMin(255, rgb.b - mathRound(255 * - (amount / 100))));
        return tinycolor(rgb);
    }

    function darken (color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.l -= amount / 100;
        hsl.l = clamp01(hsl.l);
        return tinycolor(hsl);
    }

    // Spin takes a positive or negative amount within [-360, 360] indicating the change of hue.
    // Values outside of this range will be wrapped into this range.
    function spin(color, amount) {
        var hsl = tinycolor(color).toHsl();
        var hue = (hsl.h + amount) % 360;
        hsl.h = hue < 0 ? 360 + hue : hue;
        return tinycolor(hsl);
    }

    // Combination Functions
    // ---------------------
    // Thanks to jQuery xColor for some of the ideas behind these
    // <https://github.com/infusion/jQuery-xcolor/blob/master/jquery.xcolor.js>

    function complement(color) {
        var hsl = tinycolor(color).toHsl();
        hsl.h = (hsl.h + 180) % 360;
        return tinycolor(hsl);
    }

    function triad(color) {
        var hsl = tinycolor(color).toHsl();
        var h = hsl.h;
        return [
            tinycolor(color),
            tinycolor({ h: (h + 120) % 360, s: hsl.s, l: hsl.l }),
            tinycolor({ h: (h + 240) % 360, s: hsl.s, l: hsl.l })
        ];
    }

    function tetrad(color) {
        var hsl = tinycolor(color).toHsl();
        var h = hsl.h;
        return [
            tinycolor(color),
            tinycolor({ h: (h + 90) % 360, s: hsl.s, l: hsl.l }),
            tinycolor({ h: (h + 180) % 360, s: hsl.s, l: hsl.l }),
            tinycolor({ h: (h + 270) % 360, s: hsl.s, l: hsl.l })
        ];
    }

    function splitcomplement(color) {
        var hsl = tinycolor(color).toHsl();
        var h = hsl.h;
        return [
            tinycolor(color),
            tinycolor({ h: (h + 72) % 360, s: hsl.s, l: hsl.l}),
            tinycolor({ h: (h + 216) % 360, s: hsl.s, l: hsl.l})
        ];
    }

    function analogous(color, results, slices) {
        results = results || 6;
        slices = slices || 30;

        var hsl = tinycolor(color).toHsl();
        var part = 360 / slices;
        var ret = [tinycolor(color)];

        for (hsl.h = ((hsl.h - (part * results >> 1)) + 720) % 360; --results; ) {
            hsl.h = (hsl.h + part) % 360;
            ret.push(tinycolor(hsl));
        }
        return ret;
    }

    function monochromatic(color, results) {
        results = results || 6;
        var hsv = tinycolor(color).toHsv();
        var h = hsv.h, s = hsv.s, v = hsv.v;
        var ret = [];
        var modification = 1 / results;

        while (results--) {
            ret.push(tinycolor({ h: h, s: s, v: v}));
            v = (v + modification) % 1;
        }

        return ret;
    }

    // Utility Functions
    // ---------------------

    tinycolor.mix = function(color1, color2, amount) {
        amount = (amount === 0) ? 0 : (amount || 50);

        var rgb1 = tinycolor(color1).toRgb();
        var rgb2 = tinycolor(color2).toRgb();

        var p = amount / 100;

        var rgba = {
            r: ((rgb2.r - rgb1.r) * p) + rgb1.r,
            g: ((rgb2.g - rgb1.g) * p) + rgb1.g,
            b: ((rgb2.b - rgb1.b) * p) + rgb1.b,
            a: ((rgb2.a - rgb1.a) * p) + rgb1.a
        };

        return tinycolor(rgba);
    };


    // Readability Functions
    // ---------------------
    // <http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef (WCAG Version 2)

    // `contrast`
    // Analyze the 2 colors and returns the color contrast defined by (WCAG Version 2)
    tinycolor.readability = function(color1, color2) {
        var c1 = tinycolor(color1);
        var c2 = tinycolor(color2);
        return (Math.max(c1.getLuminance(),c2.getLuminance())+0.05) / (Math.min(c1.getLuminance(),c2.getLuminance())+0.05);
    };

    // `isReadable`
    // Ensure that foreground and background color combinations meet WCAG2 guidelines.
    // The third argument is an optional Object.
    //      the 'level' property states 'AA' or 'AAA' - if missing or invalid, it defaults to 'AA';
    //      the 'size' property states 'large' or 'small' - if missing or invalid, it defaults to 'small'.
    // If the entire object is absent, isReadable defaults to {level:"AA",size:"small"}.

    // *Example*
    //    tinycolor.isReadable("#000", "#111") => false
    //    tinycolor.isReadable("#000", "#111",{level:"AA",size:"large"}) => false
    tinycolor.isReadable = function(color1, color2, wcag2) {
        var readability = tinycolor.readability(color1, color2);
        var wcag2Parms, out;

        out = false;

        wcag2Parms = validateWCAG2Parms(wcag2);
        switch (wcag2Parms.level + wcag2Parms.size) {
            case "AAsmall":
            case "AAAlarge":
                out = readability >= 4.5;
                break;
            case "AAlarge":
                out = readability >= 3;
                break;
            case "AAAsmall":
                out = readability >= 7;
                break;
        }
        return out;

    };

    // `mostReadable`
    // Given a base color and a list of possible foreground or background
    // colors for that base, returns the most readable color.
    // Optionally returns Black or White if the most readable color is unreadable.
    // *Example*
    //    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:false}).toHexString(); // "#112255"
    //    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:true}).toHexString();  // "#ffffff"
    //    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"large"}).toHexString(); // "#faf3f3"
    //    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"small"}).toHexString(); // "#ffffff"
    tinycolor.mostReadable = function(baseColor, colorList, args) {
        var bestColor = null;
        var bestScore = 0;
        var readability;
        var includeFallbackColors, level, size ;
        args = args || {};
        includeFallbackColors = args.includeFallbackColors ;
        level = args.level;
        size = args.size;

        for (var i= 0; i < colorList.length ; i++) {
            readability = tinycolor.readability(baseColor, colorList[i]);
            if (readability > bestScore) {
                bestScore = readability;
                bestColor = tinycolor(colorList[i]);
            }
        }

        if (tinycolor.isReadable(baseColor, bestColor, {"level":level,"size":size}) || !includeFallbackColors) {
            return bestColor;
        }
        else {
            args.includeFallbackColors=false;
            return tinycolor.mostReadable(baseColor,["#fff", "#000"],args);
        }
    };


    // Big List of Colors
    // ------------------
    // <http://www.w3.org/TR/css3-color/#svg-color>
    var names = tinycolor.names = {
        aliceblue: "f0f8ff",
        antiquewhite: "faebd7",
        aqua: "0ff",
        aquamarine: "7fffd4",
        azure: "f0ffff",
        beige: "f5f5dc",
        bisque: "ffe4c4",
        black: "000",
        blanchedalmond: "ffebcd",
        blue: "00f",
        blueviolet: "8a2be2",
        brown: "a52a2a",
        burlywood: "deb887",
        burntsienna: "ea7e5d",
        cadetblue: "5f9ea0",
        chartreuse: "7fff00",
        chocolate: "d2691e",
        coral: "ff7f50",
        cornflowerblue: "6495ed",
        cornsilk: "fff8dc",
        crimson: "dc143c",
        cyan: "0ff",
        darkblue: "00008b",
        darkcyan: "008b8b",
        darkgoldenrod: "b8860b",
        darkgray: "a9a9a9",
        darkgreen: "006400",
        darkgrey: "a9a9a9",
        darkkhaki: "bdb76b",
        darkmagenta: "8b008b",
        darkolivegreen: "556b2f",
        darkorange: "ff8c00",
        darkorchid: "9932cc",
        darkred: "8b0000",
        darksalmon: "e9967a",
        darkseagreen: "8fbc8f",
        darkslateblue: "483d8b",
        darkslategray: "2f4f4f",
        darkslategrey: "2f4f4f",
        darkturquoise: "00ced1",
        darkviolet: "9400d3",
        deeppink: "ff1493",
        deepskyblue: "00bfff",
        dimgray: "696969",
        dimgrey: "696969",
        dodgerblue: "1e90ff",
        firebrick: "b22222",
        floralwhite: "fffaf0",
        forestgreen: "228b22",
        fuchsia: "f0f",
        gainsboro: "dcdcdc",
        ghostwhite: "f8f8ff",
        gold: "ffd700",
        goldenrod: "daa520",
        gray: "808080",
        green: "008000",
        greenyellow: "adff2f",
        grey: "808080",
        honeydew: "f0fff0",
        hotpink: "ff69b4",
        indianred: "cd5c5c",
        indigo: "4b0082",
        ivory: "fffff0",
        khaki: "f0e68c",
        lavender: "e6e6fa",
        lavenderblush: "fff0f5",
        lawngreen: "7cfc00",
        lemonchiffon: "fffacd",
        lightblue: "add8e6",
        lightcoral: "f08080",
        lightcyan: "e0ffff",
        lightgoldenrodyellow: "fafad2",
        lightgray: "d3d3d3",
        lightgreen: "90ee90",
        lightgrey: "d3d3d3",
        lightpink: "ffb6c1",
        lightsalmon: "ffa07a",
        lightseagreen: "20b2aa",
        lightskyblue: "87cefa",
        lightslategray: "789",
        lightslategrey: "789",
        lightsteelblue: "b0c4de",
        lightyellow: "ffffe0",
        lime: "0f0",
        limegreen: "32cd32",
        linen: "faf0e6",
        magenta: "f0f",
        maroon: "800000",
        mediumaquamarine: "66cdaa",
        mediumblue: "0000cd",
        mediumorchid: "ba55d3",
        mediumpurple: "9370db",
        mediumseagreen: "3cb371",
        mediumslateblue: "7b68ee",
        mediumspringgreen: "00fa9a",
        mediumturquoise: "48d1cc",
        mediumvioletred: "c71585",
        midnightblue: "191970",
        mintcream: "f5fffa",
        mistyrose: "ffe4e1",
        moccasin: "ffe4b5",
        navajowhite: "ffdead",
        navy: "000080",
        oldlace: "fdf5e6",
        olive: "808000",
        olivedrab: "6b8e23",
        orange: "ffa500",
        orangered: "ff4500",
        orchid: "da70d6",
        palegoldenrod: "eee8aa",
        palegreen: "98fb98",
        paleturquoise: "afeeee",
        palevioletred: "db7093",
        papayawhip: "ffefd5",
        peachpuff: "ffdab9",
        peru: "cd853f",
        pink: "ffc0cb",
        plum: "dda0dd",
        powderblue: "b0e0e6",
        purple: "800080",
        rebeccapurple: "663399",
        red: "f00",
        rosybrown: "bc8f8f",
        royalblue: "4169e1",
        saddlebrown: "8b4513",
        salmon: "fa8072",
        sandybrown: "f4a460",
        seagreen: "2e8b57",
        seashell: "fff5ee",
        sienna: "a0522d",
        silver: "c0c0c0",
        skyblue: "87ceeb",
        slateblue: "6a5acd",
        slategray: "708090",
        slategrey: "708090",
        snow: "fffafa",
        springgreen: "00ff7f",
        steelblue: "4682b4",
        tan: "d2b48c",
        teal: "008080",
        thistle: "d8bfd8",
        tomato: "ff6347",
        turquoise: "40e0d0",
        violet: "ee82ee",
        wheat: "f5deb3",
        white: "fff",
        whitesmoke: "f5f5f5",
        yellow: "ff0",
        yellowgreen: "9acd32"
    };

    // Make it easy to access colors via `hexNames[hex]`
    var hexNames = tinycolor.hexNames = flip(names);


    // Utilities
    // ---------

    // `{ 'name1': 'val1' }` becomes `{ 'val1': 'name1' }`
    function flip(o) {
        var flipped = { };
        for (var i in o) {
            if (o.hasOwnProperty(i)) {
                flipped[o[i]] = i;
            }
        }
        return flipped;
    }

    // Return a valid alpha value [0,1] with all invalid values being set to 1
    function boundAlpha(a) {
        a = parseFloat(a);

        if (isNaN(a) || a < 0 || a > 1) {
            a = 1;
        }

        return a;
    }

    // Take input from [0, n] and return it as [0, 1]
    function bound01(n, max) {
        if (isOnePointZero(n)) { n = "100%"; }

        var processPercent = isPercentage(n);
        n = mathMin(max, mathMax(0, parseFloat(n)));

        // Automatically convert percentage into number
        if (processPercent) {
            n = parseInt(n * max, 10) / 100;
        }

        // Handle floating point rounding errors
        if ((Math.abs(n - max) < 0.000001)) {
            return 1;
        }

        // Convert into [0, 1] range if it isn't already
        return (n % max) / parseFloat(max);
    }

    // Force a number between 0 and 1
    function clamp01(val) {
        return mathMin(1, mathMax(0, val));
    }

    // Parse a base-16 hex value into a base-10 integer
    function parseIntFromHex(val) {
        return parseInt(val, 16);
    }

    // Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
    // <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
    function isOnePointZero(n) {
        return typeof n == "string" && n.indexOf('.') != -1 && parseFloat(n) === 1;
    }

    // Check to see if string passed in is a percentage
    function isPercentage(n) {
        return typeof n === "string" && n.indexOf('%') != -1;
    }

    // Force a hex value to have 2 characters
    function pad2(c) {
        return c.length == 1 ? '0' + c : '' + c;
    }

    // Replace a decimal with it's percentage value
    function convertToPercentage(n) {
        if (n <= 1) {
            n = (n * 100) + "%";
        }

        return n;
    }

    // Converts a decimal to a hex value
    function convertDecimalToHex(d) {
        return Math.round(parseFloat(d) * 255).toString(16);
    }
    // Converts a hex value to a decimal
    function convertHexToDecimal(h) {
        return (parseIntFromHex(h) / 255);
    }

    var matchers = (function() {

        // <http://www.w3.org/TR/css3-values/#integers>
        var CSS_INTEGER = "[-\\+]?\\d+%?";

        // <http://www.w3.org/TR/css3-values/#number-value>
        var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

        // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
        var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

        // Actual matching.
        // Parentheses and commas are optional, but not required.
        // Whitespace can take the place of commas or opening paren
        var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
        var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";

        return {
            CSS_UNIT: new RegExp(CSS_UNIT),
            rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
            rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
            hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
            hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
            hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
            hsva: new RegExp("hsva" + PERMISSIVE_MATCH4),
            hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
            hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
            hex4: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
            hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
        };
    })();

    // `isValidCSSUnit`
    // Take in a single string / number and check to see if it looks like a CSS unit
    // (see `matchers` above for definition).
    function isValidCSSUnit(color) {
        return !!matchers.CSS_UNIT.exec(color);
    }

    // `stringInputToObject`
    // Permissive string parsing.  Take in a number of formats, and output an object
    // based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
    function stringInputToObject(color) {

        color = color.replace(trimLeft,'').replace(trimRight, '').toLowerCase();
        var named = false;
        if (names[color]) {
            color = names[color];
            named = true;
        }
        else if (color == 'transparent') {
            return { r: 0, g: 0, b: 0, a: 0, format: "name" };
        }

        // Try to match string input using regular expressions.
        // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
        // Just return an object and let the conversion functions handle that.
        // This way the result will be the same whether the tinycolor is initialized with string or object.
        var match;
        if ((match = matchers.rgb.exec(color))) {
            return { r: match[1], g: match[2], b: match[3] };
        }
        if ((match = matchers.rgba.exec(color))) {
            return { r: match[1], g: match[2], b: match[3], a: match[4] };
        }
        if ((match = matchers.hsl.exec(color))) {
            return { h: match[1], s: match[2], l: match[3] };
        }
        if ((match = matchers.hsla.exec(color))) {
            return { h: match[1], s: match[2], l: match[3], a: match[4] };
        }
        if ((match = matchers.hsv.exec(color))) {
            return { h: match[1], s: match[2], v: match[3] };
        }
        if ((match = matchers.hsva.exec(color))) {
            return { h: match[1], s: match[2], v: match[3], a: match[4] };
        }
        if ((match = matchers.hex8.exec(color))) {
            return {
                r: parseIntFromHex(match[1]),
                g: parseIntFromHex(match[2]),
                b: parseIntFromHex(match[3]),
                a: convertHexToDecimal(match[4]),
                format: named ? "name" : "hex8"
            };
        }
        if ((match = matchers.hex6.exec(color))) {
            return {
                r: parseIntFromHex(match[1]),
                g: parseIntFromHex(match[2]),
                b: parseIntFromHex(match[3]),
                format: named ? "name" : "hex"
            };
        }
        if ((match = matchers.hex4.exec(color))) {
            return {
                r: parseIntFromHex(match[1] + '' + match[1]),
                g: parseIntFromHex(match[2] + '' + match[2]),
                b: parseIntFromHex(match[3] + '' + match[3]),
                a: convertHexToDecimal(match[4] + '' + match[4]),
                format: named ? "name" : "hex8"
            };
        }
        if ((match = matchers.hex3.exec(color))) {
            return {
                r: parseIntFromHex(match[1] + '' + match[1]),
                g: parseIntFromHex(match[2] + '' + match[2]),
                b: parseIntFromHex(match[3] + '' + match[3]),
                format: named ? "name" : "hex"
            };
        }

        return false;
    }

    function validateWCAG2Parms(parms) {
        // return valid WCAG2 parms for isReadable.
        // If input parms are invalid, return {"level":"AA", "size":"small"}
        var level, size;
        parms = parms || {"level":"AA", "size":"small"};
        level = (parms.level || "AA").toUpperCase();
        size = (parms.size || "small").toLowerCase();
        if (level !== "AA" && level !== "AAA") {
            level = "AA";
        }
        if (size !== "small" && size !== "large") {
            size = "small";
        }
        return {"level":level, "size":size};
    }

    // Node: Export function
    if ( module.exports) {
        module.exports = tinycolor;
    }
    // AMD/requirejs: Define the module
    else {
        window.tinycolor = tinycolor;
    }

    })(Math);
    });

    const limitatePercent = (num) => Math.max(0, Math.min(1, num));

    const getValidColor = (input) => {
      
      if(typeof input !== "string"){
        
        for(const key in input){
          if(isNaN(input[key])){
            return false;
          }
        }

        const {h, s, l, v, r, g, b, a} = input;

        if(
          (h !== null && (h < 0 || h > 360)) ||
          (a !== null && (a < 0 || a > 1)) ||
          (s !== null && (s < 0 || s > 1)) ||
          (v !== null && (v < 0 || v > 1)) ||
          (l !== null && (l < 0 || l > 1)) ||
          (r !== null && (r < 0 || r > 255)) ||
          (g !== null && (g < 0 || g > 255)) ||
          (b !== null && (b < 0 || b > 255))
        ) return false;
      }
      
      const color = tinycolor(input);
      return color.isValid() && color;
    };

    /* SaturationValue.svelte generated by Svelte v3.31.2 */

    const file = "SaturationValue.svelte";

    function create_fragment(ctx) {
    	let div3;
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let div2;
    	let div3_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			attr_dev(div0, "class", "saturation svelte-hk0xhy");
    			add_location(div0, file, 102, 2, 2445);
    			attr_dev(div1, "class", "value svelte-hk0xhy");
    			add_location(div1, file, 103, 2, 2478);
    			attr_dev(div2, "class", "pointer svelte-hk0xhy");
    			set_style(div2, "left", /*pointerX*/ ctx[4] * 100 + "%");
    			set_style(div2, "top", /*pointerY*/ ctx[5] * 100 + "%");
    			add_location(div2, file, 104, 2, 2506);
    			attr_dev(div3, "class", div3_class_value = "saturation-value " + /*className*/ ctx[0] + " svelte-hk0xhy");
    			set_style(div3, "background-color", /*pureColor*/ ctx[3]);
    			add_location(div3, file, 96, 0, 2280);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div3, t0);
    			append_dev(div3, div1);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			/*div2_binding*/ ctx[11](div2);
    			/*div3_binding*/ ctx[12](div3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div2, "mousedown", stop_propagation(prevent_default(/*handlePointerMousedown*/ ctx[6])), false, true, true),
    					listen_dev(div3, "mousedown", prevent_default(/*handleSquareMousedown*/ ctx[7]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*pointerX*/ 16) {
    				set_style(div2, "left", /*pointerX*/ ctx[4] * 100 + "%");
    			}

    			if (dirty & /*pointerY*/ 32) {
    				set_style(div2, "top", /*pointerY*/ ctx[5] * 100 + "%");
    			}

    			if (dirty & /*className*/ 1 && div3_class_value !== (div3_class_value = "saturation-value " + /*className*/ ctx[0] + " svelte-hk0xhy")) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			if (dirty & /*pureColor*/ 8) {
    				set_style(div3, "background-color", /*pureColor*/ ctx[3]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			/*div2_binding*/ ctx[11](null);
    			/*div3_binding*/ ctx[12](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let pureColor;
    	let pointerX;
    	let pointerY;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("SaturationValue", slots, []);
    	const dispatch = createEventDispatcher();
    	let { class: className = "" } = $$props;
    	let { h = 180 } = $$props;
    	let { s = 0 } = $$props;
    	let { v = 0 } = $$props;

    	// DOM
    	let square;

    	let pointer;
    	let pointerOffsetX = 0;
    	let pointerOffsetY = 0;

    	const handleMousemove = event => {
    		const { x, y, width, height } = square.getBoundingClientRect();
    		$$invalidate(8, s = limitatePercent((event.x - x + pointerOffsetX) / width));
    		$$invalidate(9, v = 1 - limitatePercent((event.y - y + pointerOffsetY) / height));
    		dispatch("input", { s, v });
    	};

    	const startMove = () => {
    		//dispatch("inputstart", {s, v})
    		handleMousemove(event);

    		self.addEventListener("mousemove", handleMousemove);
    		self.addEventListener("mouseup", handleMouseup);
    	};

    	const handleMouseup = () => {
    		self.removeEventListener("mousemove", handleMousemove);
    		self.removeEventListener("mouseup", handleMouseup);
    	}; //dispatch("inputend", {s, v});

    	const handlePointerMousedown = event => {
    		const { x, y, width, height } = pointer.getBoundingClientRect();
    		pointerOffsetX = width / 2 - (event.x - x);
    		pointerOffsetY = height / 2 - (event.y - y);
    		startMove();
    	};

    	const handleSquareMousedown = event => {
    		pointerOffsetX = pointerOffsetY = 0;
    		startMove();
    	};

    	const writable_props = ["class", "h", "s", "v"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SaturationValue> was created with unknown prop '${key}'`);
    	});

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			pointer = $$value;
    			$$invalidate(2, pointer);
    		});
    	}

    	function div3_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			square = $$value;
    			$$invalidate(1, square);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("class" in $$props) $$invalidate(0, className = $$props.class);
    		if ("h" in $$props) $$invalidate(10, h = $$props.h);
    		if ("s" in $$props) $$invalidate(8, s = $$props.s);
    		if ("v" in $$props) $$invalidate(9, v = $$props.v);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		limitatePercent,
    		className,
    		h,
    		s,
    		v,
    		square,
    		pointer,
    		pointerOffsetX,
    		pointerOffsetY,
    		handleMousemove,
    		startMove,
    		handleMouseup,
    		handlePointerMousedown,
    		handleSquareMousedown,
    		pureColor,
    		pointerX,
    		pointerY
    	});

    	$$self.$inject_state = $$props => {
    		if ("className" in $$props) $$invalidate(0, className = $$props.className);
    		if ("h" in $$props) $$invalidate(10, h = $$props.h);
    		if ("s" in $$props) $$invalidate(8, s = $$props.s);
    		if ("v" in $$props) $$invalidate(9, v = $$props.v);
    		if ("square" in $$props) $$invalidate(1, square = $$props.square);
    		if ("pointer" in $$props) $$invalidate(2, pointer = $$props.pointer);
    		if ("pointerOffsetX" in $$props) pointerOffsetX = $$props.pointerOffsetX;
    		if ("pointerOffsetY" in $$props) pointerOffsetY = $$props.pointerOffsetY;
    		if ("pureColor" in $$props) $$invalidate(3, pureColor = $$props.pureColor);
    		if ("pointerX" in $$props) $$invalidate(4, pointerX = $$props.pointerX);
    		if ("pointerY" in $$props) $$invalidate(5, pointerY = $$props.pointerY);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*h*/ 1024) {
    			 $$invalidate(3, pureColor = `hsl(${h}, 100%, 50%)`);
    		}

    		if ($$self.$$.dirty & /*s*/ 256) {
    			 $$invalidate(4, pointerX = s);
    		}

    		if ($$self.$$.dirty & /*v*/ 512) {
    			 $$invalidate(5, pointerY = -(v - 1)); // v = 1 - x // x = -(v - 1)
    		}
    	};

    	return [
    		className,
    		square,
    		pointer,
    		pureColor,
    		pointerX,
    		pointerY,
    		handlePointerMousedown,
    		handleSquareMousedown,
    		s,
    		v,
    		h,
    		div2_binding,
    		div3_binding
    	];
    }

    class SaturationValue extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { class: 0, h: 10, s: 8, v: 9 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SaturationValue",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get class() {
    		throw new Error("<SaturationValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<SaturationValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get h() {
    		throw new Error("<SaturationValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set h(value) {
    		throw new Error("<SaturationValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get s() {
    		throw new Error("<SaturationValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set s(value) {
    		throw new Error("<SaturationValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get v() {
    		throw new Error("<SaturationValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set v(value) {
    		throw new Error("<SaturationValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Slider.svelte generated by Svelte v3.31.2 */
    const file$1 = "Slider.svelte";

    function create_fragment$1(ctx) {
    	let div1;
    	let div0;
    	let div1_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "pointer svelte-1prfj86");
    			set_style(div0, "--value", /*value*/ ctx[0] * 100 + "%");
    			add_location(div0, file$1, 108, 2, 2450);
    			attr_dev(div1, "class", div1_class_value = "slider " + /*className*/ ctx[1] + " svelte-1prfj86");
    			toggle_class(div1, "vertical", /*vertical*/ ctx[2]);
    			toggle_class(div1, "horizontal", !/*vertical*/ ctx[2]);
    			add_location(div1, file$1, 101, 0, 2289);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			/*div0_binding*/ ctx[8](div0);
    			/*div1_binding*/ ctx[9](div1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "mousedown", stop_propagation(prevent_default(/*handlePointerMousedown*/ ctx[6])), false, true, true),
    					listen_dev(div1, "mousedown", prevent_default(/*handleSliderMousemove*/ ctx[5]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*value*/ 1) {
    				set_style(div0, "--value", /*value*/ ctx[0] * 100 + "%");
    			}

    			if (dirty & /*className*/ 2 && div1_class_value !== (div1_class_value = "slider " + /*className*/ ctx[1] + " svelte-1prfj86")) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (dirty & /*className, vertical*/ 6) {
    				toggle_class(div1, "vertical", /*vertical*/ ctx[2]);
    			}

    			if (dirty & /*className, vertical*/ 6) {
    				toggle_class(div1, "horizontal", !/*vertical*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*div0_binding*/ ctx[8](null);
    			/*div1_binding*/ ctx[9](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Slider", slots, []);
    	const dispatch = createEventDispatcher();
    	let { class: className = "" } = $$props;
    	let { value = 0 } = $$props;
    	let { vertical = false } = $$props;
    	const set = newValue => $$invalidate(0, value = newValue);
    	let pointerOffsetX = 0;
    	let pointerOffsetY = 0;
    	let prevValue = value;
    	let slider;
    	let pointer;

    	const handleMousemove = event => {
    		const { x, y, width, height } = slider.getBoundingClientRect();

    		if (vertical) {
    			$$invalidate(0, value = limitatePercent((event.y - y + pointerOffsetY) / height));
    		} else {
    			$$invalidate(0, value = limitatePercent((event.x - x + pointerOffsetX) / width));
    		}

    		if (value !== prevValue) {
    			prevValue = value;
    			dispatch("input", value);
    		}
    	};

    	const startMove = event => {
    		handleMousemove(event);
    		self.addEventListener("mousemove", handleMousemove);
    		self.addEventListener("mouseup", handleMouseup);
    	};

    	const handleMouseup = () => {
    		self.removeEventListener("mousemove", handleMousemove);
    		self.removeEventListener("mousedown", handleMouseup);
    	};

    	const handleSliderMousemove = event => {
    		pointerOffsetX = pointerOffsetY = 0;
    		startMove(event);
    	};

    	const handlePointerMousedown = event => {
    		const { x, y, width, height } = pointer.getBoundingClientRect();
    		pointerOffsetX = width / 2 - (event.x - x);
    		pointerOffsetY = height / 2 - (event.y - y);
    		startMove(event);
    	};

    	const writable_props = ["class", "value", "vertical"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Slider> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			pointer = $$value;
    			$$invalidate(4, pointer);
    		});
    	}

    	function div1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			slider = $$value;
    			$$invalidate(3, slider);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("class" in $$props) $$invalidate(1, className = $$props.class);
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("vertical" in $$props) $$invalidate(2, vertical = $$props.vertical);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		limitatePercent,
    		className,
    		value,
    		vertical,
    		set,
    		pointerOffsetX,
    		pointerOffsetY,
    		prevValue,
    		slider,
    		pointer,
    		handleMousemove,
    		startMove,
    		handleMouseup,
    		handleSliderMousemove,
    		handlePointerMousedown
    	});

    	$$self.$inject_state = $$props => {
    		if ("className" in $$props) $$invalidate(1, className = $$props.className);
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("vertical" in $$props) $$invalidate(2, vertical = $$props.vertical);
    		if ("pointerOffsetX" in $$props) pointerOffsetX = $$props.pointerOffsetX;
    		if ("pointerOffsetY" in $$props) pointerOffsetY = $$props.pointerOffsetY;
    		if ("prevValue" in $$props) prevValue = $$props.prevValue;
    		if ("slider" in $$props) $$invalidate(3, slider = $$props.slider);
    		if ("pointer" in $$props) $$invalidate(4, pointer = $$props.pointer);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		value,
    		className,
    		vertical,
    		slider,
    		pointer,
    		handleSliderMousemove,
    		handlePointerMousedown,
    		set,
    		div0_binding,
    		div1_binding
    	];
    }

    class Slider extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { class: 1, value: 0, vertical: 2, set: 7 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Slider",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get class() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vertical() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vertical(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get set() {
    		return this.$$.ctx[7];
    	}

    	set set(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Alpha.svelte generated by Svelte v3.31.2 */

    const { console: console_1 } = globals;
    const file$2 = "Alpha.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let slider;
    	let updating_value;
    	let div1_class_value;
    	let current;

    	function slider_value_binding(value) {
    		/*slider_value_binding*/ ctx[5].call(null, value);
    	}

    	let slider_props = { vertical: /*vertical*/ ctx[2] };

    	if (/*a*/ ctx[0] !== void 0) {
    		slider_props.value = /*a*/ ctx[0];
    	}

    	slider = new Slider({ props: slider_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider, "value", slider_value_binding));
    	slider.$on("input", /*input_handler*/ ctx[6]);
    	slider.$on("input", /*input_handler_1*/ ctx[7]);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(slider.$$.fragment);
    			attr_dev(div0, "class", "alpha-in svelte-ekrr8n");
    			set_style(div0, "background", "linear-gradient(to " + /*toGradient*/ ctx[4] + ", transparent 0%, " + /*color*/ ctx[3] + " 100%)");
    			add_location(div0, file$2, 37, 2, 853);
    			attr_dev(div1, "class", div1_class_value = "alpha " + /*className*/ ctx[1] + " svelte-ekrr8n");
    			toggle_class(div1, "vertical", /*vertical*/ ctx[2]);
    			toggle_class(div1, "horizontal", !/*vertical*/ ctx[2]);
    			add_location(div1, file$2, 36, 0, 775);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			mount_component(slider, div0, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const slider_changes = {};
    			if (dirty & /*vertical*/ 4) slider_changes.vertical = /*vertical*/ ctx[2];

    			if (!updating_value && dirty & /*a*/ 1) {
    				updating_value = true;
    				slider_changes.value = /*a*/ ctx[0];
    				add_flush_callback(() => updating_value = false);
    			}

    			slider.$set(slider_changes);

    			if (!current || dirty & /*toGradient, color*/ 24) {
    				set_style(div0, "background", "linear-gradient(to " + /*toGradient*/ ctx[4] + ", transparent 0%, " + /*color*/ ctx[3] + " 100%)");
    			}

    			if (!current || dirty & /*className*/ 2 && div1_class_value !== (div1_class_value = "alpha " + /*className*/ ctx[1] + " svelte-ekrr8n")) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (dirty & /*className, vertical*/ 6) {
    				toggle_class(div1, "vertical", /*vertical*/ ctx[2]);
    			}

    			if (dirty & /*className, vertical*/ 6) {
    				toggle_class(div1, "horizontal", !/*vertical*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(slider.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(slider.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(slider);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let toGradient;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Alpha", slots, []);
    	let { class: className = "" } = $$props;
    	let { a = 1 } = $$props;
    	let { vertical = false } = $$props;
    	let { color = "#fff" } = $$props; // style like string
    	const writable_props = ["class", "a", "vertical", "color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Alpha> was created with unknown prop '${key}'`);
    	});

    	function slider_value_binding(value) {
    		a = value;
    		$$invalidate(0, a);
    	}

    	function input_handler(event) {
    		bubble($$self, event);
    	}

    	const input_handler_1 = event => console.log(event.detail);

    	$$self.$$set = $$props => {
    		if ("class" in $$props) $$invalidate(1, className = $$props.class);
    		if ("a" in $$props) $$invalidate(0, a = $$props.a);
    		if ("vertical" in $$props) $$invalidate(2, vertical = $$props.vertical);
    		if ("color" in $$props) $$invalidate(3, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({
    		Slider,
    		className,
    		a,
    		vertical,
    		color,
    		toGradient
    	});

    	$$self.$inject_state = $$props => {
    		if ("className" in $$props) $$invalidate(1, className = $$props.className);
    		if ("a" in $$props) $$invalidate(0, a = $$props.a);
    		if ("vertical" in $$props) $$invalidate(2, vertical = $$props.vertical);
    		if ("color" in $$props) $$invalidate(3, color = $$props.color);
    		if ("toGradient" in $$props) $$invalidate(4, toGradient = $$props.toGradient);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*vertical*/ 4) {
    			 $$invalidate(4, toGradient = vertical ? "bottom" : "right");
    		}
    	};

    	return [
    		a,
    		className,
    		vertical,
    		color,
    		toGradient,
    		slider_value_binding,
    		input_handler,
    		input_handler_1
    	];
    }

    class Alpha extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { class: 1, a: 0, vertical: 2, color: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Alpha",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get class() {
    		throw new Error("<Alpha>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Alpha>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get a() {
    		throw new Error("<Alpha>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set a(value) {
    		throw new Error("<Alpha>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vertical() {
    		throw new Error("<Alpha>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vertical(value) {
    		throw new Error("<Alpha>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Alpha>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Alpha>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Hue.svelte generated by Svelte v3.31.2 */
    const file$3 = "Hue.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let slider_1;
    	let updating_value;
    	let div_class_value;
    	let current;

    	function slider_1_value_binding(value) {
    		/*slider_1_value_binding*/ ctx[6].call(null, value);
    	}

    	let slider_1_props = { vertical: /*vertical*/ ctx[1] };

    	if (/*sliderValue*/ ctx[2] !== void 0) {
    		slider_1_props.value = /*sliderValue*/ ctx[2];
    	}

    	slider_1 = new Slider({ props: slider_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider_1, "value", slider_1_value_binding));
    	slider_1.$on("input", /*handle*/ ctx[3]);

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(slider_1.$$.fragment);
    			attr_dev(div, "class", div_class_value = "hue " + /*className*/ ctx[0] + " svelte-1fgqm9o");
    			toggle_class(div, "vertical", /*vertical*/ ctx[1]);
    			toggle_class(div, "horizontal", !/*vertical*/ ctx[1]);
    			add_location(div, file$3, 37, 0, 812);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(slider_1, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const slider_1_changes = {};
    			if (dirty & /*vertical*/ 2) slider_1_changes.vertical = /*vertical*/ ctx[1];

    			if (!updating_value && dirty & /*sliderValue*/ 4) {
    				updating_value = true;
    				slider_1_changes.value = /*sliderValue*/ ctx[2];
    				add_flush_callback(() => updating_value = false);
    			}

    			slider_1.$set(slider_1_changes);

    			if (!current || dirty & /*className*/ 1 && div_class_value !== (div_class_value = "hue " + /*className*/ ctx[0] + " svelte-1fgqm9o")) {
    				attr_dev(div, "class", div_class_value);
    			}

    			if (dirty & /*className, vertical*/ 3) {
    				toggle_class(div, "vertical", /*vertical*/ ctx[1]);
    			}

    			if (dirty & /*className, vertical*/ 3) {
    				toggle_class(div, "horizontal", !/*vertical*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(slider_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(slider_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(slider_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let sliderValue;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Hue", slots, []);
    	const dispatch = createEventDispatcher();
    	let { class: className = "" } = $$props;
    	let { h = 0 } = $$props;
    	let { vertical = false } = $$props;

    	const set = newValue => {
    		$$invalidate(4, h = newValue);
    		$$invalidate(2, sliderValue = newValue / 360);
    	};

    	let slider;

    	const handle = event => {
    		$$invalidate(4, h = Math.floor(sliderValue * 360));
    		dispatch("input", h);
    	};

    	const writable_props = ["class", "h", "vertical"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Hue> was created with unknown prop '${key}'`);
    	});

    	function slider_1_value_binding(value) {
    		sliderValue = value;
    		($$invalidate(2, sliderValue), $$invalidate(4, h));
    	}

    	$$self.$$set = $$props => {
    		if ("class" in $$props) $$invalidate(0, className = $$props.class);
    		if ("h" in $$props) $$invalidate(4, h = $$props.h);
    		if ("vertical" in $$props) $$invalidate(1, vertical = $$props.vertical);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		Slider,
    		className,
    		h,
    		vertical,
    		set,
    		slider,
    		handle,
    		sliderValue
    	});

    	$$self.$inject_state = $$props => {
    		if ("className" in $$props) $$invalidate(0, className = $$props.className);
    		if ("h" in $$props) $$invalidate(4, h = $$props.h);
    		if ("vertical" in $$props) $$invalidate(1, vertical = $$props.vertical);
    		if ("slider" in $$props) slider = $$props.slider;
    		if ("sliderValue" in $$props) $$invalidate(2, sliderValue = $$props.sliderValue);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*h*/ 16) {
    			 $$invalidate(2, sliderValue = h / 360);
    		}
    	};

    	return [className, vertical, sliderValue, handle, h, set, slider_1_value_binding];
    }

    class Hue extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { class: 0, h: 4, vertical: 1, set: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Hue",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get class() {
    		throw new Error("<Hue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Hue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get h() {
    		throw new Error("<Hue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set h(value) {
    		throw new Error("<Hue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vertical() {
    		throw new Error("<Hue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vertical(value) {
    		throw new Error("<Hue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get set() {
    		return this.$$.ctx[5];
    	}

    	set set(value) {
    		throw new Error("<Hue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* ColorSquare.svelte generated by Svelte v3.31.2 */

    const file$4 = "ColorSquare.svelte";

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "color-square-in svelte-v4tr2x");
    			set_style(div0, "background", /*color*/ ctx[0]);
    			add_location(div0, file$4, 20, 2, 444);
    			attr_dev(div1, "class", "color-square svelte-v4tr2x");
    			add_location(div1, file$4, 19, 0, 415);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*color*/ 1) {
    				set_style(div0, "background", /*color*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ColorSquare", slots, []);
    	let { color } = $$props;
    	const writable_props = ["color"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ColorSquare> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    	};

    	$$self.$capture_state = () => ({ color });

    	$$self.$inject_state = $$props => {
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [color];
    }

    class ColorSquare extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { color: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ColorSquare",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*color*/ ctx[0] === undefined && !("color" in props)) {
    			console.warn("<ColorSquare> was created without expected prop 'color'");
    		}
    	}

    	get color() {
    		throw new Error("<ColorSquare>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<ColorSquare>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Chrome.svelte generated by Svelte v3.31.2 */
    const file$5 = "Chrome.svelte";

    // (234:6) {#if !disableAlpha}
    function create_if_block_5(ctx) {
    	let div;
    	let alpha;
    	let updating_a;
    	let current;

    	function alpha_a_binding(value) {
    		/*alpha_a_binding*/ ctx[22].call(null, value);
    	}

    	let alpha_props = { color: /*hex*/ ctx[7] };

    	if (/*a*/ ctx[8] !== void 0) {
    		alpha_props.a = /*a*/ ctx[8];
    	}

    	alpha = new Alpha({ props: alpha_props, $$inline: true });
    	binding_callbacks.push(() => bind(alpha, "a", alpha_a_binding));
    	alpha.$on("input", /*dispatchInput*/ ctx[13]);

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(alpha.$$.fragment);
    			attr_dev(div, "class", "alpha-wrap svelte-olvd4n");
    			add_location(div, file$5, 234, 8, 4920);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(alpha, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const alpha_changes = {};
    			if (dirty[0] & /*hex*/ 128) alpha_changes.color = /*hex*/ ctx[7];

    			if (!updating_a && dirty[0] & /*a*/ 256) {
    				updating_a = true;
    				alpha_changes.a = /*a*/ ctx[8];
    				add_flush_callback(() => updating_a = false);
    			}

    			alpha.$set(alpha_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(alpha.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(alpha.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(alpha);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(234:6) {#if !disableAlpha}",
    		ctx
    	});

    	return block;
    }

    // (305:34) 
    function create_if_block_3(ctx) {
    	let div6;
    	let div1;
    	let input0;
    	let input0_value_value;
    	let t0;
    	let div0;
    	let t2;
    	let div3;
    	let input1;
    	let input1_value_value;
    	let t3;
    	let div2;
    	let t5;
    	let div5;
    	let input2;
    	let input2_value_value;
    	let t6;
    	let div4;
    	let t8;
    	let mounted;
    	let dispose;
    	let if_block = !/*disableAlpha*/ ctx[9] && create_if_block_4(ctx);

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div1 = element("div");
    			input0 = element("input");
    			t0 = space();
    			div0 = element("div");
    			div0.textContent = "h";
    			t2 = space();
    			div3 = element("div");
    			input1 = element("input");
    			t3 = space();
    			div2 = element("div");
    			div2.textContent = "s";
    			t5 = space();
    			div5 = element("div");
    			input2 = element("input");
    			t6 = space();
    			div4 = element("div");
    			div4.textContent = "l";
    			t8 = space();
    			if (if_block) if_block.c();
    			attr_dev(input0, "class", "hsla svelte-olvd4n");
    			input0.value = input0_value_value = Math.round(/*h*/ ctx[0]) % 360;
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "maxlength", 3);
    			add_location(input0, file$5, 307, 12, 7196);
    			attr_dev(div0, "class", "label svelte-olvd4n");
    			add_location(div0, file$5, 314, 12, 7464);
    			attr_dev(div1, "class", "input-wrap svelte-olvd4n");
    			add_location(div1, file$5, 306, 10, 7159);
    			attr_dev(input1, "class", "hsla percent-input svelte-olvd4n");
    			input1.value = input1_value_value = "" + (Math.round(/*s*/ ctx[1] * 100) + "%");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "maxlength", 4);
    			add_location(input1, file$5, 317, 12, 7555);
    			attr_dev(div2, "class", "label svelte-olvd4n");
    			add_location(div2, file$5, 325, 12, 7862);
    			attr_dev(div3, "class", "input-wrap svelte-olvd4n");
    			add_location(div3, file$5, 316, 10, 7518);
    			attr_dev(input2, "class", "hsla percent-input svelte-olvd4n");
    			input2.value = input2_value_value = "" + (Math.round(/*l*/ ctx[3] * 100) + "%");
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "maxlength", 4);
    			add_location(input2, file$5, 328, 12, 7953);
    			attr_dev(div4, "class", "label svelte-olvd4n");
    			add_location(div4, file$5, 336, 12, 8260);
    			attr_dev(div5, "class", "input-wrap svelte-olvd4n");
    			add_location(div5, file$5, 327, 10, 7916);
    			attr_dev(div6, "class", "hsla-wrap svelte-olvd4n");
    			add_location(div6, file$5, 305, 8, 7125);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div1);
    			append_dev(div1, input0);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div6, t2);
    			append_dev(div6, div3);
    			append_dev(div3, input1);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div6, t5);
    			append_dev(div6, div5);
    			append_dev(div5, input2);
    			append_dev(div5, t6);
    			append_dev(div5, div4);
    			append_dev(div6, t8);
    			if (if_block) if_block.m(div6, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "keypress", /*onlyNumbers*/ ctx[15], false, false, false),
    					listen_dev(input0, "input", /*input_handler_7*/ ctx[28], false, false, false),
    					listen_dev(input1, "keypress", /*onlyNumbers*/ ctx[15], false, false, false),
    					listen_dev(input1, "input", /*input_handler_8*/ ctx[29], false, false, false),
    					listen_dev(input2, "keypress", /*onlyNumbers*/ ctx[15], false, false, false),
    					listen_dev(input2, "input", /*input_handler_9*/ ctx[30], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*h*/ 1 && input0_value_value !== (input0_value_value = Math.round(/*h*/ ctx[0]) % 360) && input0.value !== input0_value_value) {
    				prop_dev(input0, "value", input0_value_value);
    			}

    			if (dirty[0] & /*s*/ 2 && input1_value_value !== (input1_value_value = "" + (Math.round(/*s*/ ctx[1] * 100) + "%")) && input1.value !== input1_value_value) {
    				prop_dev(input1, "value", input1_value_value);
    			}

    			if (dirty[0] & /*l*/ 8 && input2_value_value !== (input2_value_value = "" + (Math.round(/*l*/ ctx[3] * 100) + "%")) && input2.value !== input2_value_value) {
    				prop_dev(input2, "value", input2_value_value);
    			}

    			if (!/*disableAlpha*/ ctx[9]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_4(ctx);
    					if_block.c();
    					if_block.m(div6, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(305:34) ",
    		ctx
    	});

    	return block;
    }

    // (257:34) 
    function create_if_block_1(ctx) {
    	let div6;
    	let div1;
    	let input0;
    	let t0;
    	let div0;
    	let t2;
    	let div3;
    	let input1;
    	let t3;
    	let div2;
    	let t5;
    	let div5;
    	let input2;
    	let t6;
    	let div4;
    	let t8;
    	let mounted;
    	let dispose;
    	let if_block = !/*disableAlpha*/ ctx[9] && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div1 = element("div");
    			input0 = element("input");
    			t0 = space();
    			div0 = element("div");
    			div0.textContent = "r";
    			t2 = space();
    			div3 = element("div");
    			input1 = element("input");
    			t3 = space();
    			div2 = element("div");
    			div2.textContent = "g";
    			t5 = space();
    			div5 = element("div");
    			input2 = element("input");
    			t6 = space();
    			div4 = element("div");
    			div4.textContent = "b";
    			t8 = space();
    			if (if_block) if_block.c();
    			attr_dev(input0, "class", "rgba svelte-olvd4n");
    			attr_dev(input0, "type", "text");
    			input0.value = /*r*/ ctx[4];
    			attr_dev(input0, "maxlength", 3);
    			add_location(input0, file$5, 259, 12, 5617);
    			attr_dev(div0, "class", "label svelte-olvd4n");
    			add_location(div0, file$5, 267, 12, 5881);
    			attr_dev(div1, "class", "input-wrap svelte-olvd4n");
    			add_location(div1, file$5, 258, 10, 5580);
    			attr_dev(input1, "class", "rgba svelte-olvd4n");
    			attr_dev(input1, "type", "text");
    			input1.value = /*g*/ ctx[5];
    			attr_dev(input1, "maxlength", 3);
    			add_location(input1, file$5, 270, 12, 5972);
    			attr_dev(div2, "class", "label svelte-olvd4n");
    			add_location(div2, file$5, 278, 12, 6236);
    			attr_dev(div3, "class", "input-wrap svelte-olvd4n");
    			add_location(div3, file$5, 269, 10, 5935);
    			attr_dev(input2, "class", "rgba svelte-olvd4n");
    			attr_dev(input2, "type", "text");
    			input2.value = /*b*/ ctx[6];
    			attr_dev(input2, "maxlength", 3);
    			add_location(input2, file$5, 281, 12, 6327);
    			attr_dev(div4, "class", "label svelte-olvd4n");
    			add_location(div4, file$5, 288, 12, 6577);
    			attr_dev(div5, "class", "input-wrap svelte-olvd4n");
    			add_location(div5, file$5, 280, 10, 6290);
    			attr_dev(div6, "class", "rgba-wrap svelte-olvd4n");
    			add_location(div6, file$5, 257, 8, 5546);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div1);
    			append_dev(div1, input0);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div6, t2);
    			append_dev(div6, div3);
    			append_dev(div3, input1);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div6, t5);
    			append_dev(div6, div5);
    			append_dev(div5, input2);
    			append_dev(div5, t6);
    			append_dev(div5, div4);
    			append_dev(div6, t8);
    			if (if_block) if_block.m(div6, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "keypress", /*onlyNumbers*/ ctx[15], false, false, false),
    					listen_dev(input0, "input", /*input_handler_3*/ ctx[24], false, false, false),
    					listen_dev(input1, "keypress", /*onlyNumbers*/ ctx[15], false, false, false),
    					listen_dev(input1, "input", /*input_handler_4*/ ctx[25], false, false, false),
    					listen_dev(input2, "keypress", /*onlyNumbers*/ ctx[15], false, false, false),
    					listen_dev(input2, "input", /*input_handler_5*/ ctx[26], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*r*/ 16 && input0.value !== /*r*/ ctx[4]) {
    				prop_dev(input0, "value", /*r*/ ctx[4]);
    			}

    			if (dirty[0] & /*g*/ 32 && input1.value !== /*g*/ ctx[5]) {
    				prop_dev(input1, "value", /*g*/ ctx[5]);
    			}

    			if (dirty[0] & /*b*/ 64 && input2.value !== /*b*/ ctx[6]) {
    				prop_dev(input2, "value", /*b*/ ctx[6]);
    			}

    			if (!/*disableAlpha*/ ctx[9]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(div6, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(257:34) ",
    		ctx
    	});

    	return block;
    }

    // (245:6) {#if fieldsIndex === 0}
    function create_if_block(ctx) {
    	let div1;
    	let input;
    	let t0;
    	let div0;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			input = element("input");
    			t0 = space();
    			div0 = element("div");
    			div0.textContent = "hex";
    			attr_dev(input, "class", "hex svelte-olvd4n");
    			attr_dev(input, "type", "text");
    			input.value = /*hex*/ ctx[7];
    			attr_dev(input, "maxlength", 7);
    			add_location(input, file$5, 246, 10, 5207);
    			attr_dev(div0, "class", "label svelte-olvd4n");
    			add_location(div0, file$5, 254, 10, 5459);
    			attr_dev(div1, "class", "input-wrap hex-wrap");
    			add_location(div1, file$5, 245, 8, 5163);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, input);
    			append_dev(div1, t0);
    			append_dev(div1, div0);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "keypress", /*onlyChars*/ ctx[14]("#0123456789abcdefABCFDEF"), false, false, false),
    					listen_dev(input, "input", /*input_handler_2*/ ctx[23], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*hex*/ 128 && input.value !== /*hex*/ ctx[7]) {
    				prop_dev(input, "value", /*hex*/ ctx[7]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(245:6) {#if fieldsIndex === 0}",
    		ctx
    	});

    	return block;
    }

    // (339:10) {#if !disableAlpha}
    function create_if_block_4(ctx) {
    	let div1;
    	let input;
    	let input_value_value;
    	let t0;
    	let div0;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			input = element("input");
    			t0 = space();
    			div0 = element("div");
    			div0.textContent = "a";
    			attr_dev(input, "class", "hsla svelte-olvd4n");
    			input.value = input_value_value = Math.round(/*a*/ ctx[8] * 100) / 100;
    			attr_dev(input, "type", "text");
    			attr_dev(input, "maxlength", 4);
    			add_location(input, file$5, 340, 14, 8385);
    			attr_dev(div0, "class", "label svelte-olvd4n");
    			add_location(div0, file$5, 348, 14, 8688);
    			attr_dev(div1, "class", "input-wrap svelte-olvd4n");
    			add_location(div1, file$5, 339, 12, 8346);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, input);
    			append_dev(div1, t0);
    			append_dev(div1, div0);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "keypress", /*onlyNumbersAndDot*/ ctx[16], false, false, false),
    					listen_dev(input, "input", /*input_handler_10*/ ctx[31], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*a*/ 256 && input_value_value !== (input_value_value = Math.round(/*a*/ ctx[8] * 100) / 100) && input.value !== input_value_value) {
    				prop_dev(input, "value", input_value_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(339:10) {#if !disableAlpha}",
    		ctx
    	});

    	return block;
    }

    // (291:10) {#if !disableAlpha}
    function create_if_block_2(ctx) {
    	let div1;
    	let input;
    	let input_value_value;
    	let t0;
    	let div0;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			input = element("input");
    			t0 = space();
    			div0 = element("div");
    			div0.textContent = "a";
    			attr_dev(input, "class", "rgba svelte-olvd4n");
    			attr_dev(input, "type", "text");
    			input.value = input_value_value = Math.round(/*a*/ ctx[8] * 100) / 100;
    			attr_dev(input, "maxlength", 4);
    			add_location(input, file$5, 292, 14, 6702);
    			attr_dev(div0, "class", "label svelte-olvd4n");
    			add_location(div0, file$5, 300, 14, 7005);
    			attr_dev(div1, "class", "input-wrap svelte-olvd4n");
    			add_location(div1, file$5, 291, 12, 6663);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, input);
    			append_dev(div1, t0);
    			append_dev(div1, div0);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "keypress", /*onlyNumbersAndDot*/ ctx[16], false, false, false),
    					listen_dev(input, "input", /*input_handler_6*/ ctx[27], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*a*/ 256 && input_value_value !== (input_value_value = Math.round(/*a*/ ctx[8] * 100) / 100) && input.value !== input_value_value) {
    				prop_dev(input, "value", input_value_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(291:10) {#if !disableAlpha}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div10;
    	let div0;
    	let saturationvalue;
    	let t0;
    	let div4;
    	let div1;
    	let colorsquare;
    	let t1;
    	let div3;
    	let div2;
    	let hue;
    	let t2;
    	let t3;
    	let div9;
    	let div5;
    	let t4;
    	let div8;
    	let div6;
    	let t5;
    	let div7;
    	let current;
    	let mounted;
    	let dispose;

    	saturationvalue = new SaturationValue({
    			props: {
    				h: /*h*/ ctx[0],
    				s: /*s*/ ctx[1],
    				v: /*v*/ ctx[2]
    			},
    			$$inline: true
    		});

    	saturationvalue.$on("input", /*input_handler*/ ctx[20]);

    	colorsquare = new ColorSquare({
    			props: {
    				color: "rgba(" + /*r*/ ctx[4] + ", " + /*g*/ ctx[5] + ", " + /*b*/ ctx[6] + ", " + /*a*/ ctx[8] + ")"
    			},
    			$$inline: true
    		});

    	hue = new Hue({
    			props: { h: /*h*/ ctx[0] },
    			$$inline: true
    		});

    	hue.$on("input", /*input_handler_1*/ ctx[21]);
    	let if_block0 = !/*disableAlpha*/ ctx[9] && create_if_block_5(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*fieldsIndex*/ ctx[10] === 0) return create_if_block;
    		if (/*fieldsIndex*/ ctx[10] === 1) return create_if_block_1;
    		if (/*fieldsIndex*/ ctx[10] === 2) return create_if_block_3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div0 = element("div");
    			create_component(saturationvalue.$$.fragment);
    			t0 = space();
    			div4 = element("div");
    			div1 = element("div");
    			create_component(colorsquare.$$.fragment);
    			t1 = space();
    			div3 = element("div");
    			div2 = element("div");
    			create_component(hue.$$.fragment);
    			t2 = space();
    			if (if_block0) if_block0.c();
    			t3 = space();
    			div9 = element("div");
    			div5 = element("div");
    			if (if_block1) if_block1.c();
    			t4 = space();
    			div8 = element("div");
    			div6 = element("div");
    			t5 = space();
    			div7 = element("div");
    			attr_dev(div0, "class", "saturation-value-wrap");
    			add_location(div0, file$5, 218, 2, 4449);
    			attr_dev(div1, "class", "square-wrap svelte-olvd4n");
    			add_location(div1, file$5, 224, 4, 4650);
    			attr_dev(div2, "class", "hue-wrap");
    			add_location(div2, file$5, 229, 6, 4774);
    			attr_dev(div3, "class", "sliders svelte-olvd4n");
    			add_location(div3, file$5, 228, 4, 4746);
    			attr_dev(div4, "class", "sliders-and-square svelte-olvd4n");
    			add_location(div4, file$5, 222, 2, 4608);
    			attr_dev(div5, "class", "inputs-wrap svelte-olvd4n");
    			add_location(div5, file$5, 243, 4, 5099);
    			attr_dev(div6, "class", "changer-up svelte-olvd4n");
    			add_location(div6, file$5, 356, 6, 8826);
    			attr_dev(div7, "class", "changer-down svelte-olvd4n");
    			add_location(div7, file$5, 357, 6, 8942);
    			attr_dev(div8, "class", "changer-wrap svelte-olvd4n");
    			add_location(div8, file$5, 355, 4, 8793);
    			attr_dev(div9, "class", "inputs-and-changer svelte-olvd4n");
    			add_location(div9, file$5, 241, 2, 5058);
    			attr_dev(div10, "class", "color-picker svelte-olvd4n");
    			add_location(div10, file$5, 216, 0, 4417);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div0);
    			mount_component(saturationvalue, div0, null);
    			append_dev(div10, t0);
    			append_dev(div10, div4);
    			append_dev(div4, div1);
    			mount_component(colorsquare, div1, null);
    			append_dev(div4, t1);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			mount_component(hue, div2, null);
    			append_dev(div3, t2);
    			if (if_block0) if_block0.m(div3, null);
    			append_dev(div10, t3);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			if (if_block1) if_block1.m(div5, null);
    			append_dev(div9, t4);
    			append_dev(div9, div8);
    			append_dev(div8, div6);
    			append_dev(div8, t5);
    			append_dev(div8, div7);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div6, "click", /*click_handler*/ ctx[32], false, false, false),
    					listen_dev(div7, "click", /*click_handler_1*/ ctx[33], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const saturationvalue_changes = {};
    			if (dirty[0] & /*h*/ 1) saturationvalue_changes.h = /*h*/ ctx[0];
    			if (dirty[0] & /*s*/ 2) saturationvalue_changes.s = /*s*/ ctx[1];
    			if (dirty[0] & /*v*/ 4) saturationvalue_changes.v = /*v*/ ctx[2];
    			saturationvalue.$set(saturationvalue_changes);
    			const colorsquare_changes = {};
    			if (dirty[0] & /*r, g, b, a*/ 368) colorsquare_changes.color = "rgba(" + /*r*/ ctx[4] + ", " + /*g*/ ctx[5] + ", " + /*b*/ ctx[6] + ", " + /*a*/ ctx[8] + ")";
    			colorsquare.$set(colorsquare_changes);
    			const hue_changes = {};
    			if (dirty[0] & /*h*/ 1) hue_changes.h = /*h*/ ctx[0];
    			hue.$set(hue_changes);

    			if (!/*disableAlpha*/ ctx[9]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty[0] & /*disableAlpha*/ 512) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div3, null);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if (if_block1) if_block1.d(1);
    				if_block1 = current_block_type && current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div5, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(saturationvalue.$$.fragment, local);
    			transition_in(colorsquare.$$.fragment, local);
    			transition_in(hue.$$.fragment, local);
    			transition_in(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(saturationvalue.$$.fragment, local);
    			transition_out(colorsquare.$$.fragment, local);
    			transition_out(hue.$$.fragment, local);
    			transition_out(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			destroy_component(saturationvalue);
    			destroy_component(colorsquare);
    			destroy_component(hue);
    			if (if_block0) if_block0.d();

    			if (if_block1) {
    				if_block1.d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Chrome", slots, []);
    	const dispatch = createEventDispatcher();
    	let { h = 0 } = $$props;
    	let { s = 1 } = $$props;
    	let { v = 1 } = $$props;
    	let { l = 0.5 } = $$props;
    	let { r = 255 } = $$props;
    	let { g = 0 } = $$props;
    	let { b = 0 } = $$props;
    	let { hex = "#ff0000" } = $$props;
    	let { a = 1 } = $$props;
    	let { color } = $$props;
    	let { startColor = "#ff0000" } = $$props; // all tinycolor colors
    	let { disableAlpha = false } = $$props;
    	let fieldsIndex = 1;
    	const setColor = args => update(args, false);

    	const update = (args, dispatch = true) => {
    		// is not enough with color.isValidColor
    		const color = getValidColor(args);

    		if (!color) return;
    		const format = color.getFormat();

    		// we dont use hex8
    		(format === "hex" || format === "hex8") && color.setAlpha(a);

    		const _rgba = color.toRgb();
    		const _hsla = color.toHsl();
    		const _hsva = color.toHsv();
    		const _hex = `#${color.toHex()}`;
    		$$invalidate(4, r = args.r != null ? args.r : _rgba.r);
    		$$invalidate(5, g = args.g != null ? args.g : _rgba.g);
    		$$invalidate(6, b = args.b != null ? args.b : _rgba.b);
    		$$invalidate(0, h = args.h != null ? args.h : _hsla.h);
    		$$invalidate(1, s = args.s != null ? args.s : _hsla.s);
    		$$invalidate(3, l = args.l != null ? args.l : _hsla.l);
    		$$invalidate(2, v = args.v != null ? args.v : _hsva.v);
    		$$invalidate(8, a = args.a != null ? args.a : _rgba.a);
    		$$invalidate(7, hex = format === "hex" ? args : _hex);
    		dispatch && dispatchInput();
    	};

    	const updateAlpha = alpha => {
    		if (isNaN(alpha) || alpha < 0 || alpha > 1) return;
    		$$invalidate(8, a = alpha);
    		dispatchInput();
    	};

    	const dispatchInput = () => dispatch("input", color);
    	const onlyChars = chars => event => chars.indexOf(String.fromCharCode(event.charCode)) === -1 && event.preventDefault();
    	const onlyNumbers = onlyChars("0123456789");
    	const onlyNumbersAndDot = onlyChars("0123456789.");
    	update(startColor, false);

    	const writable_props = [
    		"h",
    		"s",
    		"v",
    		"l",
    		"r",
    		"g",
    		"b",
    		"hex",
    		"a",
    		"color",
    		"startColor",
    		"disableAlpha"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Chrome> was created with unknown prop '${key}'`);
    	});

    	const input_handler = event => update({
    		h,
    		s: event.detail.s,
    		v: event.detail.v,
    		a
    	});

    	const input_handler_1 = event => update({ h: event.detail, s, v, a });

    	function alpha_a_binding(value) {
    		a = value;
    		$$invalidate(8, a);
    	}

    	const input_handler_2 = event => update(event.target.value);
    	const input_handler_3 = event => update({ r: parseInt(event.target.value), g, b, a });
    	const input_handler_4 = event => update({ r, g: parseInt(event.target.value), b, a });
    	const input_handler_5 = event => update({ r, g, b: parseInt(event.target.value), a });
    	const input_handler_6 = event => updateAlpha(parseFloat(event.target.value));
    	const input_handler_7 = event => update({ h: parseInt(event.target.value), s, l, a });

    	const input_handler_8 = event => update({
    		h,
    		s: parseFloat(event.target.value) / 100,
    		l,
    		a
    	});

    	const input_handler_9 = event => update({
    		h,
    		s,
    		l: parseFloat(event.target.value) / 100,
    		a
    	});

    	const input_handler_10 = event => updateAlpha(parseFloat(event.target.value));
    	const click_handler = () => $$invalidate(10, fieldsIndex = fieldsIndex === 0 ? 2 : (fieldsIndex - 1) % 3);
    	const click_handler_1 = () => $$invalidate(10, fieldsIndex = (fieldsIndex + 1) % 3);

    	$$self.$$set = $$props => {
    		if ("h" in $$props) $$invalidate(0, h = $$props.h);
    		if ("s" in $$props) $$invalidate(1, s = $$props.s);
    		if ("v" in $$props) $$invalidate(2, v = $$props.v);
    		if ("l" in $$props) $$invalidate(3, l = $$props.l);
    		if ("r" in $$props) $$invalidate(4, r = $$props.r);
    		if ("g" in $$props) $$invalidate(5, g = $$props.g);
    		if ("b" in $$props) $$invalidate(6, b = $$props.b);
    		if ("hex" in $$props) $$invalidate(7, hex = $$props.hex);
    		if ("a" in $$props) $$invalidate(8, a = $$props.a);
    		if ("color" in $$props) $$invalidate(17, color = $$props.color);
    		if ("startColor" in $$props) $$invalidate(18, startColor = $$props.startColor);
    		if ("disableAlpha" in $$props) $$invalidate(9, disableAlpha = $$props.disableAlpha);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		tinycolor,
    		getValidColor,
    		SaturationValue,
    		Alpha,
    		Hue,
    		ColorSquare,
    		h,
    		s,
    		v,
    		l,
    		r,
    		g,
    		b,
    		hex,
    		a,
    		color,
    		startColor,
    		disableAlpha,
    		fieldsIndex,
    		setColor,
    		update,
    		updateAlpha,
    		dispatchInput,
    		onlyChars,
    		onlyNumbers,
    		onlyNumbersAndDot
    	});

    	$$self.$inject_state = $$props => {
    		if ("h" in $$props) $$invalidate(0, h = $$props.h);
    		if ("s" in $$props) $$invalidate(1, s = $$props.s);
    		if ("v" in $$props) $$invalidate(2, v = $$props.v);
    		if ("l" in $$props) $$invalidate(3, l = $$props.l);
    		if ("r" in $$props) $$invalidate(4, r = $$props.r);
    		if ("g" in $$props) $$invalidate(5, g = $$props.g);
    		if ("b" in $$props) $$invalidate(6, b = $$props.b);
    		if ("hex" in $$props) $$invalidate(7, hex = $$props.hex);
    		if ("a" in $$props) $$invalidate(8, a = $$props.a);
    		if ("color" in $$props) $$invalidate(17, color = $$props.color);
    		if ("startColor" in $$props) $$invalidate(18, startColor = $$props.startColor);
    		if ("disableAlpha" in $$props) $$invalidate(9, disableAlpha = $$props.disableAlpha);
    		if ("fieldsIndex" in $$props) $$invalidate(10, fieldsIndex = $$props.fieldsIndex);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*r, g, b, h, s, l, v, a, hex*/ 511) {
    			 $$invalidate(17, color = { r, g, b, h, s, l, v, a, hex });
    		}
    	};

    	return [
    		h,
    		s,
    		v,
    		l,
    		r,
    		g,
    		b,
    		hex,
    		a,
    		disableAlpha,
    		fieldsIndex,
    		update,
    		updateAlpha,
    		dispatchInput,
    		onlyChars,
    		onlyNumbers,
    		onlyNumbersAndDot,
    		color,
    		startColor,
    		setColor,
    		input_handler,
    		input_handler_1,
    		alpha_a_binding,
    		input_handler_2,
    		input_handler_3,
    		input_handler_4,
    		input_handler_5,
    		input_handler_6,
    		input_handler_7,
    		input_handler_8,
    		input_handler_9,
    		input_handler_10,
    		click_handler,
    		click_handler_1
    	];
    }

    class Chrome extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$5,
    			create_fragment$5,
    			safe_not_equal,
    			{
    				h: 0,
    				s: 1,
    				v: 2,
    				l: 3,
    				r: 4,
    				g: 5,
    				b: 6,
    				hex: 7,
    				a: 8,
    				color: 17,
    				startColor: 18,
    				disableAlpha: 9,
    				setColor: 19
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Chrome",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*color*/ ctx[17] === undefined && !("color" in props)) {
    			console.warn("<Chrome> was created without expected prop 'color'");
    		}
    	}

    	get h() {
    		return this.$$.ctx[0];
    	}

    	set h(h) {
    		this.$set({ h });
    		flush();
    	}

    	get s() {
    		return this.$$.ctx[1];
    	}

    	set s(s) {
    		this.$set({ s });
    		flush();
    	}

    	get v() {
    		return this.$$.ctx[2];
    	}

    	set v(v) {
    		this.$set({ v });
    		flush();
    	}

    	get l() {
    		return this.$$.ctx[3];
    	}

    	set l(l) {
    		this.$set({ l });
    		flush();
    	}

    	get r() {
    		return this.$$.ctx[4];
    	}

    	set r(r) {
    		this.$set({ r });
    		flush();
    	}

    	get g() {
    		return this.$$.ctx[5];
    	}

    	set g(g) {
    		this.$set({ g });
    		flush();
    	}

    	get b() {
    		return this.$$.ctx[6];
    	}

    	set b(b) {
    		this.$set({ b });
    		flush();
    	}

    	get hex() {
    		return this.$$.ctx[7];
    	}

    	set hex(hex) {
    		this.$set({ hex });
    		flush();
    	}

    	get a() {
    		return this.$$.ctx[8];
    	}

    	set a(a) {
    		this.$set({ a });
    		flush();
    	}

    	get color() {
    		return this.$$.ctx[17];
    	}

    	set color(color) {
    		this.$set({ color });
    		flush();
    	}

    	get startColor() {
    		return this.$$.ctx[18];
    	}

    	set startColor(startColor) {
    		this.$set({ startColor });
    		flush();
    	}

    	get disableAlpha() {
    		return this.$$.ctx[9];
    	}

    	set disableAlpha(disableAlpha) {
    		this.$set({ disableAlpha });
    		flush();
    	}

    	get setColor() {
    		return this.$$.ctx[19];
    	}

    	set setColor(value) {
    		throw new Error("<Chrome>: Cannot set read-only property 'setColor'");
    	}
    }

    /* Docs.svelte generated by Svelte v3.31.2 */
    const file$6 = "Docs.svelte";

    function create_fragment$6(ctx) {
    	let script;
    	let script_src_value;
    	let t0;
    	let div11;
    	let div0;
    	let t1;
    	let div10;
    	let header;
    	let div1;
    	let h1;
    	let t3;
    	let p0;
    	let t5;
    	let p1;
    	let t6;
    	let a0;
    	let t8;
    	let a1;
    	let t10;
    	let p2;
    	let t11;
    	let a2;
    	let t13;
    	let a3;
    	let t15;
    	let p3;
    	let code0;
    	let t17;
    	let div3;
    	let chrome_1;
    	let updating_r;
    	let updating_g;
    	let updating_b;
    	let updating_a;
    	let updating_h;
    	let updating_s;
    	let updating_l;
    	let updating_v;
    	let updating_hex;
    	let t18;
    	let div2;
    	let t20;
    	let seccion0;
    	let div6;
    	let div5;
    	let hue;
    	let updating_h_1;
    	let t21;
    	let div4;
    	let t23;
    	let div9;
    	let div8;
    	let alpha;
    	let updating_a_1;
    	let t24;
    	let div7;
    	let t26;
    	let seccion1;
    	let h2;
    	let t28;
    	let pre;
    	let code1;
    	let current;

    	function chrome_1_r_binding(value) {
    		/*chrome_1_r_binding*/ ctx[13].call(null, value);
    	}

    	function chrome_1_g_binding(value) {
    		/*chrome_1_g_binding*/ ctx[14].call(null, value);
    	}

    	function chrome_1_b_binding(value) {
    		/*chrome_1_b_binding*/ ctx[15].call(null, value);
    	}

    	function chrome_1_a_binding(value) {
    		/*chrome_1_a_binding*/ ctx[16].call(null, value);
    	}

    	function chrome_1_h_binding(value) {
    		/*chrome_1_h_binding*/ ctx[17].call(null, value);
    	}

    	function chrome_1_s_binding(value) {
    		/*chrome_1_s_binding*/ ctx[18].call(null, value);
    	}

    	function chrome_1_l_binding(value) {
    		/*chrome_1_l_binding*/ ctx[19].call(null, value);
    	}

    	function chrome_1_v_binding(value) {
    		/*chrome_1_v_binding*/ ctx[20].call(null, value);
    	}

    	function chrome_1_hex_binding(value) {
    		/*chrome_1_hex_binding*/ ctx[21].call(null, value);
    	}

    	let chrome_1_props = { startColor: "#0f0" };

    	if (/*r*/ ctx[0] !== void 0) {
    		chrome_1_props.r = /*r*/ ctx[0];
    	}

    	if (/*g*/ ctx[1] !== void 0) {
    		chrome_1_props.g = /*g*/ ctx[1];
    	}

    	if (/*b*/ ctx[2] !== void 0) {
    		chrome_1_props.b = /*b*/ ctx[2];
    	}

    	if (/*a*/ ctx[7] !== void 0) {
    		chrome_1_props.a = /*a*/ ctx[7];
    	}

    	if (/*h*/ ctx[3] !== void 0) {
    		chrome_1_props.h = /*h*/ ctx[3];
    	}

    	if (/*s*/ ctx[4] !== void 0) {
    		chrome_1_props.s = /*s*/ ctx[4];
    	}

    	if (/*l*/ ctx[6] !== void 0) {
    		chrome_1_props.l = /*l*/ ctx[6];
    	}

    	if (/*v*/ ctx[5] !== void 0) {
    		chrome_1_props.v = /*v*/ ctx[5];
    	}

    	if (/*hex*/ ctx[8] !== void 0) {
    		chrome_1_props.hex = /*hex*/ ctx[8];
    	}

    	chrome_1 = new Chrome({ props: chrome_1_props, $$inline: true });
    	/*chrome_1_binding*/ ctx[12](chrome_1);
    	binding_callbacks.push(() => bind(chrome_1, "r", chrome_1_r_binding));
    	binding_callbacks.push(() => bind(chrome_1, "g", chrome_1_g_binding));
    	binding_callbacks.push(() => bind(chrome_1, "b", chrome_1_b_binding));
    	binding_callbacks.push(() => bind(chrome_1, "a", chrome_1_a_binding));
    	binding_callbacks.push(() => bind(chrome_1, "h", chrome_1_h_binding));
    	binding_callbacks.push(() => bind(chrome_1, "s", chrome_1_s_binding));
    	binding_callbacks.push(() => bind(chrome_1, "l", chrome_1_l_binding));
    	binding_callbacks.push(() => bind(chrome_1, "v", chrome_1_v_binding));
    	binding_callbacks.push(() => bind(chrome_1, "hex", chrome_1_hex_binding));

    	function hue_h_binding(value) {
    		/*hue_h_binding*/ ctx[22].call(null, value);
    	}

    	let hue_props = {};

    	if (/*h*/ ctx[3] !== void 0) {
    		hue_props.h = /*h*/ ctx[3];
    	}

    	hue = new Hue({ props: hue_props, $$inline: true });
    	binding_callbacks.push(() => bind(hue, "h", hue_h_binding));
    	hue.$on("input", /*input_handler*/ ctx[23]);

    	function alpha_a_binding(value) {
    		/*alpha_a_binding*/ ctx[24].call(null, value);
    	}

    	let alpha_props = { color: /*hex*/ ctx[8] };

    	if (/*a*/ ctx[7] !== void 0) {
    		alpha_props.a = /*a*/ ctx[7];
    	}

    	alpha = new Alpha({ props: alpha_props, $$inline: true });
    	binding_callbacks.push(() => bind(alpha, "a", alpha_a_binding));
    	alpha.$on("input", /*input_handler_1*/ ctx[25]);

    	const block = {
    		c: function create() {
    			script = element("script");
    			t0 = space();
    			div11 = element("div");
    			div0 = element("div");
    			t1 = space();
    			div10 = element("div");
    			header = element("header");
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Svelte Color";
    			t3 = space();
    			p0 = element("p");
    			p0.textContent = "A Collection of Color Pickers for Svelte (and vanilla js)";
    			t5 = space();
    			p1 = element("p");
    			t6 = text("Inspired by the excelents ");
    			a0 = element("a");
    			a0.textContent = "Vue Color";
    			t8 = text(" and ");
    			a1 = element("a");
    			a1.textContent = "React Color";
    			t10 = space();
    			p2 = element("p");
    			t11 = text("Available in ");
    			a2 = element("a");
    			a2.textContent = "npm";
    			t13 = text(" and ");
    			a3 = element("a");
    			a3.textContent = "github";
    			t15 = space();
    			p3 = element("p");
    			code0 = element("code");
    			code0.textContent = "npm install svelte-color";
    			t17 = space();
    			div3 = element("div");
    			create_component(chrome_1.$$.fragment);
    			t18 = space();
    			div2 = element("div");
    			div2.textContent = "Chrome";
    			t20 = space();
    			seccion0 = element("seccion");
    			div6 = element("div");
    			div5 = element("div");
    			create_component(hue.$$.fragment);
    			t21 = space();
    			div4 = element("div");
    			div4.textContent = "Hue";
    			t23 = space();
    			div9 = element("div");
    			div8 = element("div");
    			create_component(alpha.$$.fragment);
    			t24 = space();
    			div7 = element("div");
    			div7.textContent = "Alpha";
    			t26 = space();
    			seccion1 = element("seccion");
    			h2 = element("h2");
    			h2.textContent = "Usage";
    			t28 = space();
    			pre = element("pre");
    			code1 = element("code");

    			code1.textContent = `${`<!-- my-component.svelte -->
<script>
  import ChromePicker from 'svelte-color/Chrome.svelte';
  // or "svelte-color/Chrome" for pre-compiled js

  let chrome;
  let color; // same as event.detail

  const handleInput = (event) => {
    {r, g, b, h, s, l, v, a, hex} = event.detail;
    /*
      r: red          Number 0-255,
      g: green        Number 0-255,
      b: blue         Number 0-255,
      h: hue          Number 0-359,
      s: saturation   Number 0-1
      l: lightness    Number 0-1
      v: value        Number 0-1
      a: alpha        Number 0-1
      hex: hex        String (starting with #)
    */
  }

  function setColor(){
    // setColor accepts any value
    // that tinycolor2 accepts
    // use this method, do not do chrome.color = "red"
    // startColor accepts the same values
    chrome.setColor("red");
    chrome.setColor("#fff")
    chrome.setColor("#ffffff")
    chrome.setColor("rgb(255, 255, 255, 1)")
    chrome.setColor("rgba(255, 255, 255 ,1)")
    chrome.setColor("hsv(359, 100%, 100%, 1)")
    chrome.setColor("hsva(359, 100%, 100%, 1)")
    chrome.setColor({r: 255, g: 255, b: 255, a?: 1});
    chrome.setColor({h: 359, s: 1, l: 1, a?: 1});
    chrome.setColor({h: 359, s: 1, v: 1, a?: 1});
  }

</script>

<ChromePicker
  class="classes to add to the root element"
  bind:color
  bind:this={chrome}
  startColor="red"
  disableAlpha={false} // default
  on:input={handleInput}
/>
<!-- 
  you can also bind 
  specific props 
  like bind:r={red} bind:h={hue}
-->
`}`;

    			script.async = true;
    			script.defer = true;
    			if (script.src !== (script_src_value = "prism.js")) attr_dev(script, "src", script_src_value);
    			attr_dev(script, "class", "svelte-1g5jqbn");
    			add_location(script, file$6, 1, 2, 16);
    			attr_dev(div0, "class", "docs-bg svelte-1g5jqbn");
    			attr_dev(div0, "style", /*style*/ ctx[10]);
    			add_location(div0, file$6, 118, 2, 1621);
    			attr_dev(h1, "class", "svelte-1g5jqbn");
    			add_location(h1, file$6, 123, 8, 1750);
    			attr_dev(p0, "class", "svelte-1g5jqbn");
    			add_location(p0, file$6, 124, 8, 1780);
    			attr_dev(a0, "href", "http://vue-color.surge.sh/");
    			attr_dev(a0, "class", "svelte-1g5jqbn");
    			add_location(a0, file$6, 125, 37, 1882);
    			attr_dev(a1, "href", "https://casesandberg.github.io/react-color/");
    			attr_dev(a1, "class", "svelte-1g5jqbn");
    			add_location(a1, file$6, 125, 92, 1937);
    			attr_dev(p1, "class", "svelte-1g5jqbn");
    			add_location(p1, file$6, 125, 8, 1853);
    			attr_dev(a2, "href", "https://www.npmjs.com/package/svelte-color");
    			attr_dev(a2, "class", "svelte-1g5jqbn");
    			add_location(a2, file$6, 126, 24, 2035);
    			attr_dev(a3, "href", "https://github.com/ramiroaisen/svelte-color");
    			attr_dev(a3, "class", "svelte-1g5jqbn");
    			add_location(a3, file$6, 126, 89, 2100);
    			attr_dev(p2, "class", "svelte-1g5jqbn");
    			add_location(p2, file$6, 126, 8, 2019);
    			attr_dev(code0, "class", "svelte-1g5jqbn");
    			add_location(code0, file$6, 127, 11, 2180);
    			attr_dev(p3, "class", "svelte-1g5jqbn");
    			add_location(p3, file$6, 127, 8, 2177);
    			attr_dev(div1, "class", "main-text svelte-1g5jqbn");
    			add_location(div1, file$6, 122, 6, 1718);
    			attr_dev(div2, "class", "chrome-label label svelte-1g5jqbn");
    			add_location(div2, file$6, 131, 8, 2396);
    			attr_dev(div3, "class", "main-picker svelte-1g5jqbn");
    			add_location(div3, file$6, 129, 6, 2241);
    			attr_dev(header, "class", "main svelte-1g5jqbn");
    			add_location(header, file$6, 121, 4, 1690);
    			attr_dev(div4, "class", "label svelte-1g5jqbn");
    			add_location(div4, file$6, 140, 10, 2632);
    			attr_dev(div5, "class", "hue svelte-1g5jqbn");
    			add_location(div5, file$6, 138, 8, 2544);
    			attr_dev(div6, "class", "hue-wrap svelte-1g5jqbn");
    			add_location(div6, file$6, 137, 6, 2513);
    			attr_dev(div7, "class", "label svelte-1g5jqbn");
    			add_location(div7, file$6, 147, 10, 2833);
    			attr_dev(div8, "class", "alpha svelte-1g5jqbn");
    			add_location(div8, file$6, 145, 8, 2729);
    			attr_dev(div9, "class", "alpha-wrap svelte-1g5jqbn");
    			add_location(div9, file$6, 144, 6, 2696);
    			attr_dev(seccion0, "class", "hue-alpha-wrap svelte-1g5jqbn");
    			add_location(seccion0, file$6, 135, 4, 2473);
    			attr_dev(h2, "class", "svelte-1g5jqbn");
    			add_location(h2, file$6, 154, 6, 2941);
    			attr_dev(code1, "class", "language-html svelte-1g5jqbn");
    			add_location(code1, file$6, 157, 8, 2977);
    			attr_dev(pre, "class", "svelte-1g5jqbn");
    			add_location(pre, file$6, 156, 6, 2963);
    			attr_dev(seccion1, "class", "api svelte-1g5jqbn");
    			add_location(seccion1, file$6, 152, 4, 2912);
    			attr_dev(div10, "class", "docs-in svelte-1g5jqbn");
    			add_location(div10, file$6, 119, 2, 1659);
    			attr_dev(div11, "class", "docs svelte-1g5jqbn");
    			add_location(div11, file$6, 117, 0, 1600);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, script);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div11, anchor);
    			append_dev(div11, div0);
    			append_dev(div11, t1);
    			append_dev(div11, div10);
    			append_dev(div10, header);
    			append_dev(header, div1);
    			append_dev(div1, h1);
    			append_dev(div1, t3);
    			append_dev(div1, p0);
    			append_dev(div1, t5);
    			append_dev(div1, p1);
    			append_dev(p1, t6);
    			append_dev(p1, a0);
    			append_dev(p1, t8);
    			append_dev(p1, a1);
    			append_dev(div1, t10);
    			append_dev(div1, p2);
    			append_dev(p2, t11);
    			append_dev(p2, a2);
    			append_dev(p2, t13);
    			append_dev(p2, a3);
    			append_dev(div1, t15);
    			append_dev(div1, p3);
    			append_dev(p3, code0);
    			append_dev(header, t17);
    			append_dev(header, div3);
    			mount_component(chrome_1, div3, null);
    			append_dev(div3, t18);
    			append_dev(div3, div2);
    			append_dev(div10, t20);
    			append_dev(div10, seccion0);
    			append_dev(seccion0, div6);
    			append_dev(div6, div5);
    			mount_component(hue, div5, null);
    			append_dev(div5, t21);
    			append_dev(div5, div4);
    			append_dev(seccion0, t23);
    			append_dev(seccion0, div9);
    			append_dev(div9, div8);
    			mount_component(alpha, div8, null);
    			append_dev(div8, t24);
    			append_dev(div8, div7);
    			append_dev(div10, t26);
    			append_dev(div10, seccion1);
    			append_dev(seccion1, h2);
    			append_dev(seccion1, t28);
    			append_dev(seccion1, pre);
    			append_dev(pre, code1);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*style*/ 1024) {
    				attr_dev(div0, "style", /*style*/ ctx[10]);
    			}

    			const chrome_1_changes = {};

    			if (!updating_r && dirty & /*r*/ 1) {
    				updating_r = true;
    				chrome_1_changes.r = /*r*/ ctx[0];
    				add_flush_callback(() => updating_r = false);
    			}

    			if (!updating_g && dirty & /*g*/ 2) {
    				updating_g = true;
    				chrome_1_changes.g = /*g*/ ctx[1];
    				add_flush_callback(() => updating_g = false);
    			}

    			if (!updating_b && dirty & /*b*/ 4) {
    				updating_b = true;
    				chrome_1_changes.b = /*b*/ ctx[2];
    				add_flush_callback(() => updating_b = false);
    			}

    			if (!updating_a && dirty & /*a*/ 128) {
    				updating_a = true;
    				chrome_1_changes.a = /*a*/ ctx[7];
    				add_flush_callback(() => updating_a = false);
    			}

    			if (!updating_h && dirty & /*h*/ 8) {
    				updating_h = true;
    				chrome_1_changes.h = /*h*/ ctx[3];
    				add_flush_callback(() => updating_h = false);
    			}

    			if (!updating_s && dirty & /*s*/ 16) {
    				updating_s = true;
    				chrome_1_changes.s = /*s*/ ctx[4];
    				add_flush_callback(() => updating_s = false);
    			}

    			if (!updating_l && dirty & /*l*/ 64) {
    				updating_l = true;
    				chrome_1_changes.l = /*l*/ ctx[6];
    				add_flush_callback(() => updating_l = false);
    			}

    			if (!updating_v && dirty & /*v*/ 32) {
    				updating_v = true;
    				chrome_1_changes.v = /*v*/ ctx[5];
    				add_flush_callback(() => updating_v = false);
    			}

    			if (!updating_hex && dirty & /*hex*/ 256) {
    				updating_hex = true;
    				chrome_1_changes.hex = /*hex*/ ctx[8];
    				add_flush_callback(() => updating_hex = false);
    			}

    			chrome_1.$set(chrome_1_changes);
    			const hue_changes = {};

    			if (!updating_h_1 && dirty & /*h*/ 8) {
    				updating_h_1 = true;
    				hue_changes.h = /*h*/ ctx[3];
    				add_flush_callback(() => updating_h_1 = false);
    			}

    			hue.$set(hue_changes);
    			const alpha_changes = {};
    			if (dirty & /*hex*/ 256) alpha_changes.color = /*hex*/ ctx[8];

    			if (!updating_a_1 && dirty & /*a*/ 128) {
    				updating_a_1 = true;
    				alpha_changes.a = /*a*/ ctx[7];
    				add_flush_callback(() => updating_a_1 = false);
    			}

    			alpha.$set(alpha_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(chrome_1.$$.fragment, local);
    			transition_in(hue.$$.fragment, local);
    			transition_in(alpha.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(chrome_1.$$.fragment, local);
    			transition_out(hue.$$.fragment, local);
    			transition_out(alpha.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(script);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div11);
    			/*chrome_1_binding*/ ctx[12](null);
    			destroy_component(chrome_1);
    			destroy_component(hue);
    			destroy_component(alpha);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let style;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Docs", slots, []);
    	let r;
    	let g;
    	let b;
    	let h;
    	let s;
    	let v;
    	let l;
    	let a;
    	let hex;
    	let chrome;
    	const update = color => chrome.setColor(color);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Docs> was created with unknown prop '${key}'`);
    	});

    	function chrome_1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			chrome = $$value;
    			$$invalidate(9, chrome);
    		});
    	}

    	function chrome_1_r_binding(value) {
    		r = value;
    		$$invalidate(0, r);
    	}

    	function chrome_1_g_binding(value) {
    		g = value;
    		$$invalidate(1, g);
    	}

    	function chrome_1_b_binding(value) {
    		b = value;
    		$$invalidate(2, b);
    	}

    	function chrome_1_a_binding(value) {
    		a = value;
    		$$invalidate(7, a);
    	}

    	function chrome_1_h_binding(value) {
    		h = value;
    		$$invalidate(3, h);
    	}

    	function chrome_1_s_binding(value) {
    		s = value;
    		$$invalidate(4, s);
    	}

    	function chrome_1_l_binding(value) {
    		l = value;
    		$$invalidate(6, l);
    	}

    	function chrome_1_v_binding(value) {
    		v = value;
    		$$invalidate(5, v);
    	}

    	function chrome_1_hex_binding(value) {
    		hex = value;
    		$$invalidate(8, hex);
    	}

    	function hue_h_binding(value) {
    		h = value;
    		$$invalidate(3, h);
    	}

    	const input_handler = () => update({ h, s, v, a });

    	function alpha_a_binding(value) {
    		a = value;
    		$$invalidate(7, a);
    	}

    	const input_handler_1 = () => update({ h, s, v, a });

    	$$self.$capture_state = () => ({
    		Chrome,
    		Hue,
    		Alpha,
    		r,
    		g,
    		b,
    		h,
    		s,
    		v,
    		l,
    		a,
    		hex,
    		chrome,
    		update,
    		style
    	});

    	$$self.$inject_state = $$props => {
    		if ("r" in $$props) $$invalidate(0, r = $$props.r);
    		if ("g" in $$props) $$invalidate(1, g = $$props.g);
    		if ("b" in $$props) $$invalidate(2, b = $$props.b);
    		if ("h" in $$props) $$invalidate(3, h = $$props.h);
    		if ("s" in $$props) $$invalidate(4, s = $$props.s);
    		if ("v" in $$props) $$invalidate(5, v = $$props.v);
    		if ("l" in $$props) $$invalidate(6, l = $$props.l);
    		if ("a" in $$props) $$invalidate(7, a = $$props.a);
    		if ("hex" in $$props) $$invalidate(8, hex = $$props.hex);
    		if ("chrome" in $$props) $$invalidate(9, chrome = $$props.chrome);
    		if ("style" in $$props) $$invalidate(10, style = $$props.style);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*r, g, b*/ 7) {
    			 $$invalidate(10, style = `background-color: rgba(${r}, ${g}, ${b}, 0.5)`);
    		}
    	};

    	return [
    		r,
    		g,
    		b,
    		h,
    		s,
    		v,
    		l,
    		a,
    		hex,
    		chrome,
    		style,
    		update,
    		chrome_1_binding,
    		chrome_1_r_binding,
    		chrome_1_g_binding,
    		chrome_1_b_binding,
    		chrome_1_a_binding,
    		chrome_1_h_binding,
    		chrome_1_s_binding,
    		chrome_1_l_binding,
    		chrome_1_v_binding,
    		chrome_1_hex_binding,
    		hue_h_binding,
    		input_handler,
    		alpha_a_binding,
    		input_handler_1
    	];
    }

    class Docs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Docs",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    const docs = new Docs({target: document.body});

}());
//# sourceMappingURL=bundle.js.map
