(function (f) {
	if (typeof exports === "object" && typeof module !== "undefined") {
		module.exports = f()
	} else if (typeof define === "function" && define.amd) {
		define([], f)
	} else {
		var g;
		if (typeof window !== "undefined") {
			g = window
		} else if (typeof global !== "undefined") {
			g = global
		} else if (typeof self !== "undefined") {
			g = self
		} else {
			g = this
		}
		g.Slideout = f()
	}
})(function () {
	var define, module, exports;
	return (function () {
		function r(e, n, t) {
			function o(i, f) {
				if (!n[i]) {
					if (!e[i]) {
						var c = "function" == typeof require && require;
						if (!f && c) return c(i, !0);
						if (u) return u(i, !0);
						var a = new Error("Cannot find module '" + i + "'");
						throw a.code = "MODULE_NOT_FOUND", a
					}
					var p = n[i] = {
						exports: {}
					};
					e[i][0].call(p.exports, function (r) {
						var n = e[i][1][r];
						return o(n || r)
					}, p, p.exports, r, e, n, t)
				}
				return n[i].exports
			}
			for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
			return o
		}
		return r
	})()({
		1: [function (require, module, exports) {
			'use strict';

			/**
			 * Module dependencies
			 */
			var decouple = require('decouple');
			var Emitter = require('emitter');

			/**
			 * Privates
			 */
			var scrollTimeout;
			var scrolling = false;
			var doc = window.document;
			var html = doc.documentElement;
			var msPointerSupported = window.navigator.msPointerEnabled;
			var touch = {
				'start': msPointerSupported ? 'MSPointerDown' : 'touchstart',
				'move': msPointerSupported ? 'MSPointerMove' : 'touchmove',
				'end': msPointerSupported ? 'MSPointerUp' : 'touchend'
			};
			var prefix = (function prefix() {
				var regex = /^(Webkit|Khtml|Moz|ms|O)(?=[A-Z])/;
				var styleDeclaration = doc.getElementsByTagName('script')[0].style;
				for (var prop in styleDeclaration) {
					if (regex.test(prop)) {
						return '-' + prop.match(regex)[0].toLowerCase() + '-';
					}
				}
				// Nothing found so far? Webkit does not enumerate over the CSS properties of the style object.
				// However (prop in style) returns the correct value, so we'll have to test for
				// the precence of a specific property
				if ('WebkitOpacity' in styleDeclaration) {
					return '-webkit-';
				}
				if ('KhtmlOpacity' in styleDeclaration) {
					return '-khtml-';
				}
				return '';
			}());

			function extend(destination, from) {
				for (var prop in from) {
					if (from[prop]) {
						destination[prop] = from[prop];
					}
				}
				return destination;
			}

			function inherits(child, uber) {
				child.prototype = extend(child.prototype || {}, uber.prototype);
			}

			function hasIgnoredElements(el) {
				while (el.parentNode) {
					if (el.getAttribute('data-slideout-ignore') !== null) {
						return el;
					}
					el = el.parentNode;
				}
				return null;
			}

			/**
			 * Slideout constructor
			 */
			function Slideout(options) {
				options = options || {};

				// Sets default values
				this._startOffsetX = 0;
				this._currentOffsetX = 0;
				this._opening = false;
				this._moved = false;
				this._opened = false;
				this._preventOpen = false;
				this._touch = options.touch === undefined ? true : options.touch && true;
				this._side = options.side || 'left';

				// Sets panel
				this.panel = options.panel;
				this.menu = options.menu;

				// Sets  classnames
				if (!this.panel.classList.contains('slideout-panel')) {
					this.panel.classList.add('slideout-panel');
				}
				if (!this.panel.classList.contains('slideout-panel-' + this._side)) {
					this.panel.classList.add('slideout-panel-' + this._side);
				}
				if (!this.menu.classList.contains('slideout-menu')) {
					this.menu.classList.add('slideout-menu');
				}
				if (!this.menu.classList.contains('slideout-menu-' + this._side)) {
					this.menu.classList.add('slideout-menu-' + this._side);
				}

				// Sets options
				this._fx = options.fx || 'ease';
				this._duration = parseInt(options.duration, 10) || 300;
				this._tolerance = parseInt(options.tolerance, 10) || 70;
				this._padding = this._translateTo = parseInt(options.padding, 10) || 256;
				this._orientation = this._side === 'right' ? -1 : 1;
				this._translateTo *= this._orientation;

				// Init touch events
				if (this._touch) {
					this._initTouchEvents();
				}
			}

			/**
			 * Inherits from Emitter
			 */
			inherits(Slideout, Emitter);

			/**
			 * Opens the slideout menu.
			 */
			Slideout.prototype.open = function () {
				var self = this;
				this.emit('beforeopen');
				if (!html.classList.contains('slideout-open')) {
					html.classList.add('slideout-open');
				}
				this._setTransition();
				this._translateXTo(this._translateTo);
				this._opened = true;
				setTimeout(function () {
					self.panel.style.transition = self.panel.style['-webkit-transition'] = '';
					self.emit('open');
				}, this._duration + 50);
				return this;
			};

			/**
			 * Closes slideout menu.
			 */
			Slideout.prototype.close = function () {
				var self = this;
				if (!this.isOpen() && !this._opening) {
					return this;
				}
				this.emit('beforeclose');
				this._setTransition();
				this._translateXTo(0);
				this._opened = false;
				setTimeout(function () {
					html.classList.remove('slideout-open');
					self.panel.style.transition = self.panel.style['-webkit-transition'] = self.panel.style[prefix + 'transform'] = self.panel.style.transform = '';
					self.emit('close');
				}, this._duration + 50);
				return this;
			};

			/**
			 * Toggles (open/close) slideout menu.
			 */
			Slideout.prototype.toggle = function () {
				return this.isOpen() ? this.close() : this.open();
			};

			/**
			 * Returns true if the slideout is currently open, and false if it is closed.
			 */
			Slideout.prototype.isOpen = function () {
				return this._opened;
			};

			/**
			 * Translates panel and updates currentOffset with a given X point
			 */
			Slideout.prototype._translateXTo = function (translateX) {
				this._currentOffsetX = translateX;
				this.panel.style[prefix + 'transform'] = this.panel.style.transform = 'translateX(' + translateX + 'px)';
				return this;
			};

			/**
			 * Set transition properties
			 */
			Slideout.prototype._setTransition = function () {
				this.panel.style[prefix + 'transition'] = this.panel.style.transition = prefix + 'transform ' + this._duration + 'ms ' + this._fx;
				return this;
			};

			/**
			 * Initializes touch event
			 */
			Slideout.prototype._initTouchEvents = function () {
				var self = this;

				/**
				 * Decouple scroll event
				 */
				this._onScrollFn = decouple(doc, 'scroll', function () {
					if (!self._moved) {
						clearTimeout(scrollTimeout);
						scrolling = true;
						scrollTimeout = setTimeout(function () {
							scrolling = false;
						}, 250);
					}
				});

				/**
				 * Prevents touchmove event if slideout is moving
				 */
				// this._preventMove = function (eve) {
				// 	if (self._moved) {
				// 		eve.preventDefault();
				// 	}
				// };

				// doc.addEventListener(touch.move, this._preventMove);

				/**
				 * Resets values on touchstart
				 */
				this._resetTouchFn = function (eve) {
					if (typeof eve.touches === 'undefined') {
						return;
					}

					self._moved = false;
					self._opening = false;
					self._startOffsetX = eve.touches[0].pageX;
					self._preventOpen = (!self._touch || (!self.isOpen() && self.menu.clientWidth !== 0));
				};

				this.panel.addEventListener(touch.start, this._resetTouchFn);

				/**
				 * Resets values on touchcancel
				 */
				this._onTouchCancelFn = function () {
					self._moved = false;
					self._opening = false;
				};

				this.panel.addEventListener('touchcancel', this._onTouchCancelFn);

				/**
				 * Toggles slideout on touchend
				 */
				this._onTouchEndFn = function () {
					if (self._moved) {
						self.emit('translateend');
						(self._opening && Math.abs(self._currentOffsetX) > self._tolerance) ? self.open(): self.close();
					}
					self._moved = false;
				};

				this.panel.addEventListener(touch.end, this._onTouchEndFn);

				/**
				 * Translates panel on touchmove
				 */
				this._onTouchMoveFn = function (eve) {
					if (
						scrolling ||
						self._preventOpen ||
						typeof eve.touches === 'undefined' ||
						hasIgnoredElements(eve.target)
					) {
						return;
					}

					var dif_x = eve.touches[0].clientX - self._startOffsetX;
					var translateX = self._currentOffsetX = dif_x;

					if (Math.abs(translateX) > self._padding) {
						return;
					}

					if (Math.abs(dif_x) > 20) {

						self._opening = true;

						var oriented_dif_x = dif_x * self._orientation;

						if (self._opened && oriented_dif_x > 0 || !self._opened && oriented_dif_x < 0) {
							return;
						}

						if (!self._moved) {
							self.emit('translatestart');
						}

						if (oriented_dif_x <= 0) {
							translateX = dif_x + self._padding * self._orientation;
							self._opening = false;
						}

						if (!(self._moved && html.classList.contains('slideout-open'))) {
							html.classList.add('slideout-open');
						}

						self.panel.style[prefix + 'transform'] = self.panel.style.transform = 'translateX(' + translateX + 'px)';
						self.emit('translate', translateX);
						self._moved = true;
					}

				};

				this.panel.addEventListener(touch.move, this._onTouchMoveFn);

				return this;
			};

			/**
			 * Enable opening the slideout via touch events.
			 */
			Slideout.prototype.enableTouch = function () {
				this._touch = true;
				return this;
			};

			/**
			 * Disable opening the slideout via touch events.
			 */
			Slideout.prototype.disableTouch = function () {
				this._touch = false;
				return this;
			};

			/**
			 * Destroy an instance of slideout.
			 */
			Slideout.prototype.destroy = function () {
				// Close before clean
				this.close();

				// Remove event listeners
				// doc.removeEventListener(touch.move, this._preventMove);
				this.panel.removeEventListener(touch.start, this._resetTouchFn);
				this.panel.removeEventListener('touchcancel', this._onTouchCancelFn);
				this.panel.removeEventListener(touch.end, this._onTouchEndFn);
				this.panel.removeEventListener(touch.move, this._onTouchMoveFn);
				doc.removeEventListener('scroll', this._onScrollFn);

				// Remove methods
				this.open = this.close = function () {};

				// Return the instance so it can be easily dereferenced
				return this;
			};

			/**
			 * Expose Slideout
			 */
			module.exports = Slideout;

		}, {
			"decouple": 2,
			"emitter": 3
		}],
		2: [function (require, module, exports) {
			'use strict';

			var requestAnimFrame = (function () {
				return window.requestAnimationFrame ||
					window.webkitRequestAnimationFrame ||
					function (callback) {
						window.setTimeout(callback, 1000 / 60);
					};
			}());

			function decouple(node, event, fn) {
				var eve,
					tracking = false;

				function captureEvent(e) {
					eve = e;
					track();
				}

				function track() {
					if (!tracking) {
						requestAnimFrame(update);
						tracking = true;
					}
				}

				function update() {
					fn.call(node, eve);
					tracking = false;
				}

				node.addEventListener(event, captureEvent, false);

				return captureEvent;
			}

			/**
			 * Expose decouple
			 */
			module.exports = decouple;

		}, {}],
		3: [function (require, module, exports) {
			"use strict";

			var _classCallCheck = function (instance, Constructor) {
				if (!(instance instanceof Constructor)) {
					throw new TypeError("Cannot call a class as a function");
				}
			};

			exports.__esModule = true;
			/**
			 * Creates a new instance of Emitter.
			 * @class
			 * @returns {Object} Returns a new instance of Emitter.
			 * @example
			 * // Creates a new instance of Emitter.
			 * var Emitter = require('emitter');
			 *
			 * var emitter = new Emitter();
			 */

			var Emitter = (function () {
				function Emitter() {
					_classCallCheck(this, Emitter);
				}

				/**
				 * Adds a listener to the collection for the specified event.
				 * @memberof! Emitter.prototype
				 * @function
				 * @param {String} event - The event name.
				 * @param {Function} listener - A listener function to add.
				 * @returns {Object} Returns an instance of Emitter.
				 * @example
				 * // Add an event listener to "foo" event.
				 * emitter.on('foo', listener);
				 */

				Emitter.prototype.on = function on(event, listener) {
					// Use the current collection or create it.
					this._eventCollection = this._eventCollection || {};

					// Use the current collection of an event or create it.
					this._eventCollection[event] = this._eventCollection[event] || [];

					// Appends the listener into the collection of the given event
					this._eventCollection[event].push(listener);

					return this;
				};

				/**
				 * Adds a listener to the collection for the specified event that will be called only once.
				 * @memberof! Emitter.prototype
				 * @function
				 * @param {String} event - The event name.
				 * @param {Function} listener - A listener function to add.
				 * @returns {Object} Returns an instance of Emitter.
				 * @example
				 * // Will add an event handler to "foo" event once.
				 * emitter.once('foo', listener);
				 */

				Emitter.prototype.once = function once(event, listener) {
					var self = this;

					function fn() {
						self.off(event, fn);
						listener.apply(this, arguments);
					}

					fn.listener = listener;

					this.on(event, fn);

					return this;
				};

				/**
				 * Removes a listener from the collection for the specified event.
				 * @memberof! Emitter.prototype
				 * @function
				 * @param {String} event - The event name.
				 * @param {Function} listener - A listener function to remove.
				 * @returns {Object} Returns an instance of Emitter.
				 * @example
				 * // Remove a given listener.
				 * emitter.off('foo', listener);
				 */

				Emitter.prototype.off = function off(event, listener) {

					var listeners = undefined;

					// Defines listeners value.
					if (!this._eventCollection || !(listeners = this._eventCollection[event])) {
						return this;
					}

					listeners.forEach(function (fn, i) {
						if (fn === listener || fn.listener === listener) {
							// Removes the given listener.
							listeners.splice(i, 1);
						}
					});

					// Removes an empty event collection.
					if (listeners.length === 0) {
						delete this._eventCollection[event];
					}

					return this;
				};

				/**
				 * Execute each item in the listener collection in order with the specified data.
				 * @memberof! Emitter.prototype
				 * @function
				 * @param {String} event - The name of the event you want to emit.
				 * @param {...Object} data - Data to pass to the listeners.
				 * @returns {Object} Returns an instance of Emitter.
				 * @example
				 * // Emits the "foo" event with 'param1' and 'param2' as arguments.
				 * emitter.emit('foo', 'param1', 'param2');
				 */

				Emitter.prototype.emit = function emit(event) {
					var _this = this;

					for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
						args[_key - 1] = arguments[_key];
					}

					var listeners = undefined;

					// Defines listeners value.
					if (!this._eventCollection || !(listeners = this._eventCollection[event])) {
						return this;
					}

					// Clone listeners
					listeners = listeners.slice(0);

					listeners.forEach(function (fn) {
						return fn.apply(_this, args);
					});

					return this;
				};

				return Emitter;
			})();

			/**
			 * Exports Emitter
			 */
			exports["default"] = Emitter;
			module.exports = exports["default"];
		}, {}]
	}, {}, [1])(1)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvdXBsZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lbWl0dGVyL2Rpc3QvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogTW9kdWxlIGRlcGVuZGVuY2llc1xuICovXG52YXIgZGVjb3VwbGUgPSByZXF1aXJlKCdkZWNvdXBsZScpO1xudmFyIEVtaXR0ZXIgPSByZXF1aXJlKCdlbWl0dGVyJyk7XG5cbi8qKlxuICogUHJpdmF0ZXNcbiAqL1xudmFyIHNjcm9sbFRpbWVvdXQ7XG52YXIgc2Nyb2xsaW5nID0gZmFsc2U7XG52YXIgZG9jID0gd2luZG93LmRvY3VtZW50O1xudmFyIGh0bWwgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xudmFyIG1zUG9pbnRlclN1cHBvcnRlZCA9IHdpbmRvdy5uYXZpZ2F0b3IubXNQb2ludGVyRW5hYmxlZDtcbnZhciB0b3VjaCA9IHtcbiAgJ3N0YXJ0JzogbXNQb2ludGVyU3VwcG9ydGVkID8gJ01TUG9pbnRlckRvd24nIDogJ3RvdWNoc3RhcnQnLFxuICAnbW92ZSc6IG1zUG9pbnRlclN1cHBvcnRlZCA/ICdNU1BvaW50ZXJNb3ZlJyA6ICd0b3VjaG1vdmUnLFxuICAnZW5kJzogbXNQb2ludGVyU3VwcG9ydGVkID8gJ01TUG9pbnRlclVwJyA6ICd0b3VjaGVuZCdcbn07XG52YXIgcHJlZml4ID0gKGZ1bmN0aW9uIHByZWZpeCgpIHtcbiAgdmFyIHJlZ2V4ID0gL14oV2Via2l0fEtodG1sfE1venxtc3xPKSg/PVtBLVpdKS87XG4gIHZhciBzdHlsZURlY2xhcmF0aW9uID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKVswXS5zdHlsZTtcbiAgZm9yICh2YXIgcHJvcCBpbiBzdHlsZURlY2xhcmF0aW9uKSB7XG4gICAgaWYgKHJlZ2V4LnRlc3QocHJvcCkpIHtcbiAgICAgIHJldHVybiAnLScgKyBwcm9wLm1hdGNoKHJlZ2V4KVswXS50b0xvd2VyQ2FzZSgpICsgJy0nO1xuICAgIH1cbiAgfVxuICAvLyBOb3RoaW5nIGZvdW5kIHNvIGZhcj8gV2Via2l0IGRvZXMgbm90IGVudW1lcmF0ZSBvdmVyIHRoZSBDU1MgcHJvcGVydGllcyBvZiB0aGUgc3R5bGUgb2JqZWN0LlxuICAvLyBIb3dldmVyIChwcm9wIGluIHN0eWxlKSByZXR1cm5zIHRoZSBjb3JyZWN0IHZhbHVlLCBzbyB3ZSdsbCBoYXZlIHRvIHRlc3QgZm9yXG4gIC8vIHRoZSBwcmVjZW5jZSBvZiBhIHNwZWNpZmljIHByb3BlcnR5XG4gIGlmICgnV2Via2l0T3BhY2l0eScgaW4gc3R5bGVEZWNsYXJhdGlvbikgeyByZXR1cm4gJy13ZWJraXQtJzsgfVxuICBpZiAoJ0todG1sT3BhY2l0eScgaW4gc3R5bGVEZWNsYXJhdGlvbikgeyByZXR1cm4gJy1raHRtbC0nOyB9XG4gIHJldHVybiAnJztcbn0oKSk7XG5mdW5jdGlvbiBleHRlbmQoZGVzdGluYXRpb24sIGZyb20pIHtcbiAgZm9yICh2YXIgcHJvcCBpbiBmcm9tKSB7XG4gICAgaWYgKGZyb21bcHJvcF0pIHtcbiAgICAgIGRlc3RpbmF0aW9uW3Byb3BdID0gZnJvbVtwcm9wXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlc3RpbmF0aW9uO1xufVxuZnVuY3Rpb24gaW5oZXJpdHMoY2hpbGQsIHViZXIpIHtcbiAgY2hpbGQucHJvdG90eXBlID0gZXh0ZW5kKGNoaWxkLnByb3RvdHlwZSB8fCB7fSwgdWJlci5wcm90b3R5cGUpO1xufVxuZnVuY3Rpb24gaGFzSWdub3JlZEVsZW1lbnRzKGVsKSB7XG4gIHdoaWxlIChlbC5wYXJlbnROb2RlKSB7XG4gICAgaWYgKGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1zbGlkZW91dC1pZ25vcmUnKSAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGVsO1xuICAgIH1cbiAgICBlbCA9IGVsLnBhcmVudE5vZGU7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogU2xpZGVvdXQgY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gU2xpZGVvdXQob3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyBTZXRzIGRlZmF1bHQgdmFsdWVzXG4gIHRoaXMuX3N0YXJ0T2Zmc2V0WCA9IDA7XG4gIHRoaXMuX2N1cnJlbnRPZmZzZXRYID0gMDtcbiAgdGhpcy5fb3BlbmluZyA9IGZhbHNlO1xuICB0aGlzLl9tb3ZlZCA9IGZhbHNlO1xuICB0aGlzLl9vcGVuZWQgPSBmYWxzZTtcbiAgdGhpcy5fcHJldmVudE9wZW4gPSBmYWxzZTtcbiAgdGhpcy5fdG91Y2ggPSBvcHRpb25zLnRvdWNoID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0aW9ucy50b3VjaCAmJiB0cnVlO1xuICB0aGlzLl9zaWRlID0gb3B0aW9ucy5zaWRlIHx8ICdsZWZ0JztcblxuICAvLyBTZXRzIHBhbmVsXG4gIHRoaXMucGFuZWwgPSBvcHRpb25zLnBhbmVsO1xuICB0aGlzLm1lbnUgPSBvcHRpb25zLm1lbnU7XG5cbiAgLy8gU2V0cyAgY2xhc3NuYW1lc1xuICBpZiAoIXRoaXMucGFuZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCdzbGlkZW91dC1wYW5lbCcpKSB7XG4gICAgdGhpcy5wYW5lbC5jbGFzc0xpc3QuYWRkKCdzbGlkZW91dC1wYW5lbCcpO1xuICB9XG4gIGlmICghdGhpcy5wYW5lbC5jbGFzc0xpc3QuY29udGFpbnMoJ3NsaWRlb3V0LXBhbmVsLScgKyB0aGlzLl9zaWRlKSkge1xuICAgIHRoaXMucGFuZWwuY2xhc3NMaXN0LmFkZCgnc2xpZGVvdXQtcGFuZWwtJyArIHRoaXMuX3NpZGUpO1xuICB9XG4gIGlmICghdGhpcy5tZW51LmNsYXNzTGlzdC5jb250YWlucygnc2xpZGVvdXQtbWVudScpKSB7XG4gICAgdGhpcy5tZW51LmNsYXNzTGlzdC5hZGQoJ3NsaWRlb3V0LW1lbnUnKTtcbiAgfVxuICBpZiAoIXRoaXMubWVudS5jbGFzc0xpc3QuY29udGFpbnMoJ3NsaWRlb3V0LW1lbnUtJyArIHRoaXMuX3NpZGUpKSB7XG4gICAgdGhpcy5tZW51LmNsYXNzTGlzdC5hZGQoJ3NsaWRlb3V0LW1lbnUtJyArIHRoaXMuX3NpZGUpO1xuICB9XG5cbiAgLy8gU2V0cyBvcHRpb25zXG4gIHRoaXMuX2Z4ID0gb3B0aW9ucy5meCB8fCAnZWFzZSc7XG4gIHRoaXMuX2R1cmF0aW9uID0gcGFyc2VJbnQob3B0aW9ucy5kdXJhdGlvbiwgMTApIHx8IDMwMDtcbiAgdGhpcy5fdG9sZXJhbmNlID0gcGFyc2VJbnQob3B0aW9ucy50b2xlcmFuY2UsIDEwKSB8fCA3MDtcbiAgdGhpcy5fcGFkZGluZyA9IHRoaXMuX3RyYW5zbGF0ZVRvID0gcGFyc2VJbnQob3B0aW9ucy5wYWRkaW5nLCAxMCkgfHwgMjU2O1xuICB0aGlzLl9vcmllbnRhdGlvbiA9IHRoaXMuX3NpZGUgPT09ICdyaWdodCcgPyAtMSA6IDE7XG4gIHRoaXMuX3RyYW5zbGF0ZVRvICo9IHRoaXMuX29yaWVudGF0aW9uO1xuXG4gIC8vIEluaXQgdG91Y2ggZXZlbnRzXG4gIGlmICh0aGlzLl90b3VjaCkge1xuICAgIHRoaXMuX2luaXRUb3VjaEV2ZW50cygpO1xuICB9XG59XG5cbi8qKlxuICogSW5oZXJpdHMgZnJvbSBFbWl0dGVyXG4gKi9cbmluaGVyaXRzKFNsaWRlb3V0LCBFbWl0dGVyKTtcblxuLyoqXG4gKiBPcGVucyB0aGUgc2xpZGVvdXQgbWVudS5cbiAqL1xuU2xpZGVvdXQucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbigpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLmVtaXQoJ2JlZm9yZW9wZW4nKTtcbiAgaWYgKCFodG1sLmNsYXNzTGlzdC5jb250YWlucygnc2xpZGVvdXQtb3BlbicpKSB7XG4gICAgaHRtbC5jbGFzc0xpc3QuYWRkKCdzbGlkZW91dC1vcGVuJyk7XG4gIH1cbiAgdGhpcy5fc2V0VHJhbnNpdGlvbigpO1xuICB0aGlzLl90cmFuc2xhdGVYVG8odGhpcy5fdHJhbnNsYXRlVG8pO1xuICB0aGlzLl9vcGVuZWQgPSB0cnVlO1xuICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgIHNlbGYucGFuZWwuc3R5bGUudHJhbnNpdGlvbiA9IHNlbGYucGFuZWwuc3R5bGVbJy13ZWJraXQtdHJhbnNpdGlvbiddID0gJyc7XG4gICAgc2VsZi5lbWl0KCdvcGVuJyk7XG4gIH0sIHRoaXMuX2R1cmF0aW9uICsgNTApO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQ2xvc2VzIHNsaWRlb3V0IG1lbnUuXG4gKi9cblNsaWRlb3V0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmICghdGhpcy5pc09wZW4oKSAmJiAhdGhpcy5fb3BlbmluZykge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIHRoaXMuZW1pdCgnYmVmb3JlY2xvc2UnKTtcbiAgdGhpcy5fc2V0VHJhbnNpdGlvbigpO1xuICB0aGlzLl90cmFuc2xhdGVYVG8oMCk7XG4gIHRoaXMuX29wZW5lZCA9IGZhbHNlO1xuICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgIGh0bWwuY2xhc3NMaXN0LnJlbW92ZSgnc2xpZGVvdXQtb3BlbicpO1xuICAgIHNlbGYucGFuZWwuc3R5bGUudHJhbnNpdGlvbiA9IHNlbGYucGFuZWwuc3R5bGVbJy13ZWJraXQtdHJhbnNpdGlvbiddID0gc2VsZi5wYW5lbC5zdHlsZVtwcmVmaXggKyAndHJhbnNmb3JtJ10gPSBzZWxmLnBhbmVsLnN0eWxlLnRyYW5zZm9ybSA9ICcnO1xuICAgIHNlbGYuZW1pdCgnY2xvc2UnKTtcbiAgfSwgdGhpcy5fZHVyYXRpb24gKyA1MCk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBUb2dnbGVzIChvcGVuL2Nsb3NlKSBzbGlkZW91dCBtZW51LlxuICovXG5TbGlkZW91dC5wcm90b3R5cGUudG9nZ2xlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLmlzT3BlbigpID8gdGhpcy5jbG9zZSgpIDogdGhpcy5vcGVuKCk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc2xpZGVvdXQgaXMgY3VycmVudGx5IG9wZW4sIGFuZCBmYWxzZSBpZiBpdCBpcyBjbG9zZWQuXG4gKi9cblNsaWRlb3V0LnByb3RvdHlwZS5pc09wZW4gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX29wZW5lZDtcbn07XG5cbi8qKlxuICogVHJhbnNsYXRlcyBwYW5lbCBhbmQgdXBkYXRlcyBjdXJyZW50T2Zmc2V0IHdpdGggYSBnaXZlbiBYIHBvaW50XG4gKi9cblNsaWRlb3V0LnByb3RvdHlwZS5fdHJhbnNsYXRlWFRvID0gZnVuY3Rpb24odHJhbnNsYXRlWCkge1xuICB0aGlzLl9jdXJyZW50T2Zmc2V0WCA9IHRyYW5zbGF0ZVg7XG4gIHRoaXMucGFuZWwuc3R5bGVbcHJlZml4ICsgJ3RyYW5zZm9ybSddID0gdGhpcy5wYW5lbC5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlWCgnICsgdHJhbnNsYXRlWCArICdweCknO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogU2V0IHRyYW5zaXRpb24gcHJvcGVydGllc1xuICovXG5TbGlkZW91dC5wcm90b3R5cGUuX3NldFRyYW5zaXRpb24gPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5wYW5lbC5zdHlsZVtwcmVmaXggKyAndHJhbnNpdGlvbiddID0gdGhpcy5wYW5lbC5zdHlsZS50cmFuc2l0aW9uID0gcHJlZml4ICsgJ3RyYW5zZm9ybSAnICsgdGhpcy5fZHVyYXRpb24gKyAnbXMgJyArIHRoaXMuX2Z4O1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdG91Y2ggZXZlbnRcbiAqL1xuU2xpZGVvdXQucHJvdG90eXBlLl9pbml0VG91Y2hFdmVudHMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8qKlxuICAgKiBEZWNvdXBsZSBzY3JvbGwgZXZlbnRcbiAgICovXG4gIHRoaXMuX29uU2Nyb2xsRm4gPSBkZWNvdXBsZShkb2MsICdzY3JvbGwnLCBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXNlbGYuX21vdmVkKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2Nyb2xsVGltZW91dCk7XG4gICAgICBzY3JvbGxpbmcgPSB0cnVlO1xuICAgICAgc2Nyb2xsVGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHNjcm9sbGluZyA9IGZhbHNlO1xuICAgICAgfSwgMjUwKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8qKlxuICAgKiBQcmV2ZW50cyB0b3VjaG1vdmUgZXZlbnQgaWYgc2xpZGVvdXQgaXMgbW92aW5nXG4gICAqL1xuICB0aGlzLl9wcmV2ZW50TW92ZSA9IGZ1bmN0aW9uKGV2ZSkge1xuICAgIGlmIChzZWxmLl9tb3ZlZCkge1xuICAgICAgZXZlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuICB9O1xuXG4gIGRvYy5hZGRFdmVudExpc3RlbmVyKHRvdWNoLm1vdmUsIHRoaXMuX3ByZXZlbnRNb3ZlKTtcblxuICAvKipcbiAgICogUmVzZXRzIHZhbHVlcyBvbiB0b3VjaHN0YXJ0XG4gICAqL1xuICB0aGlzLl9yZXNldFRvdWNoRm4gPSBmdW5jdGlvbihldmUpIHtcbiAgICBpZiAodHlwZW9mIGV2ZS50b3VjaGVzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGYuX21vdmVkID0gZmFsc2U7XG4gICAgc2VsZi5fb3BlbmluZyA9IGZhbHNlO1xuICAgIHNlbGYuX3N0YXJ0T2Zmc2V0WCA9IGV2ZS50b3VjaGVzWzBdLnBhZ2VYO1xuICAgIHNlbGYuX3ByZXZlbnRPcGVuID0gKCFzZWxmLl90b3VjaCB8fCAoIXNlbGYuaXNPcGVuKCkgJiYgc2VsZi5tZW51LmNsaWVudFdpZHRoICE9PSAwKSk7XG4gIH07XG5cbiAgdGhpcy5wYW5lbC5hZGRFdmVudExpc3RlbmVyKHRvdWNoLnN0YXJ0LCB0aGlzLl9yZXNldFRvdWNoRm4pO1xuXG4gIC8qKlxuICAgKiBSZXNldHMgdmFsdWVzIG9uIHRvdWNoY2FuY2VsXG4gICAqL1xuICB0aGlzLl9vblRvdWNoQ2FuY2VsRm4gPSBmdW5jdGlvbigpIHtcbiAgICBzZWxmLl9tb3ZlZCA9IGZhbHNlO1xuICAgIHNlbGYuX29wZW5pbmcgPSBmYWxzZTtcbiAgfTtcblxuICB0aGlzLnBhbmVsLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoY2FuY2VsJywgdGhpcy5fb25Ub3VjaENhbmNlbEZuKTtcblxuICAvKipcbiAgICogVG9nZ2xlcyBzbGlkZW91dCBvbiB0b3VjaGVuZFxuICAgKi9cbiAgdGhpcy5fb25Ub3VjaEVuZEZuID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHNlbGYuX21vdmVkKSB7XG4gICAgICBzZWxmLmVtaXQoJ3RyYW5zbGF0ZWVuZCcpO1xuICAgICAgKHNlbGYuX29wZW5pbmcgJiYgTWF0aC5hYnMoc2VsZi5fY3VycmVudE9mZnNldFgpID4gc2VsZi5fdG9sZXJhbmNlKSA/IHNlbGYub3BlbigpIDogc2VsZi5jbG9zZSgpO1xuICAgIH1cbiAgICBzZWxmLl9tb3ZlZCA9IGZhbHNlO1xuICB9O1xuXG4gIHRoaXMucGFuZWwuYWRkRXZlbnRMaXN0ZW5lcih0b3VjaC5lbmQsIHRoaXMuX29uVG91Y2hFbmRGbik7XG5cbiAgLyoqXG4gICAqIFRyYW5zbGF0ZXMgcGFuZWwgb24gdG91Y2htb3ZlXG4gICAqL1xuICB0aGlzLl9vblRvdWNoTW92ZUZuID0gZnVuY3Rpb24oZXZlKSB7XG4gICAgaWYgKFxuICAgICAgc2Nyb2xsaW5nIHx8XG4gICAgICBzZWxmLl9wcmV2ZW50T3BlbiB8fFxuICAgICAgdHlwZW9mIGV2ZS50b3VjaGVzID09PSAndW5kZWZpbmVkJyB8fFxuICAgICAgaGFzSWdub3JlZEVsZW1lbnRzKGV2ZS50YXJnZXQpXG4gICAgKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGRpZl94ID0gZXZlLnRvdWNoZXNbMF0uY2xpZW50WCAtIHNlbGYuX3N0YXJ0T2Zmc2V0WDtcbiAgICB2YXIgdHJhbnNsYXRlWCA9IHNlbGYuX2N1cnJlbnRPZmZzZXRYID0gZGlmX3g7XG5cbiAgICBpZiAoTWF0aC5hYnModHJhbnNsYXRlWCkgPiBzZWxmLl9wYWRkaW5nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKE1hdGguYWJzKGRpZl94KSA+IDIwKSB7XG5cbiAgICAgIHNlbGYuX29wZW5pbmcgPSB0cnVlO1xuXG4gICAgICB2YXIgb3JpZW50ZWRfZGlmX3ggPSBkaWZfeCAqIHNlbGYuX29yaWVudGF0aW9uO1xuXG4gICAgICBpZiAoc2VsZi5fb3BlbmVkICYmIG9yaWVudGVkX2RpZl94ID4gMCB8fCAhc2VsZi5fb3BlbmVkICYmIG9yaWVudGVkX2RpZl94IDwgMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghc2VsZi5fbW92ZWQpIHtcbiAgICAgICAgc2VsZi5lbWl0KCd0cmFuc2xhdGVzdGFydCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3JpZW50ZWRfZGlmX3ggPD0gMCkge1xuICAgICAgICB0cmFuc2xhdGVYID0gZGlmX3ggKyBzZWxmLl9wYWRkaW5nICogc2VsZi5fb3JpZW50YXRpb247XG4gICAgICAgIHNlbGYuX29wZW5pbmcgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCEoc2VsZi5fbW92ZWQgJiYgaHRtbC5jbGFzc0xpc3QuY29udGFpbnMoJ3NsaWRlb3V0LW9wZW4nKSkpIHtcbiAgICAgICAgaHRtbC5jbGFzc0xpc3QuYWRkKCdzbGlkZW91dC1vcGVuJyk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYucGFuZWwuc3R5bGVbcHJlZml4ICsgJ3RyYW5zZm9ybSddID0gc2VsZi5wYW5lbC5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlWCgnICsgdHJhbnNsYXRlWCArICdweCknO1xuICAgICAgc2VsZi5lbWl0KCd0cmFuc2xhdGUnLCB0cmFuc2xhdGVYKTtcbiAgICAgIHNlbGYuX21vdmVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgfTtcblxuICB0aGlzLnBhbmVsLmFkZEV2ZW50TGlzdGVuZXIodG91Y2gubW92ZSwgdGhpcy5fb25Ub3VjaE1vdmVGbik7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEVuYWJsZSBvcGVuaW5nIHRoZSBzbGlkZW91dCB2aWEgdG91Y2ggZXZlbnRzLlxuICovXG5TbGlkZW91dC5wcm90b3R5cGUuZW5hYmxlVG91Y2ggPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fdG91Y2ggPSB0cnVlO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogRGlzYWJsZSBvcGVuaW5nIHRoZSBzbGlkZW91dCB2aWEgdG91Y2ggZXZlbnRzLlxuICovXG5TbGlkZW91dC5wcm90b3R5cGUuZGlzYWJsZVRvdWNoID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX3RvdWNoID0gZmFsc2U7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBEZXN0cm95IGFuIGluc3RhbmNlIG9mIHNsaWRlb3V0LlxuICovXG5TbGlkZW91dC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAvLyBDbG9zZSBiZWZvcmUgY2xlYW5cbiAgdGhpcy5jbG9zZSgpO1xuXG4gIC8vIFJlbW92ZSBldmVudCBsaXN0ZW5lcnNcbiAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIodG91Y2gubW92ZSwgdGhpcy5fcHJldmVudE1vdmUpO1xuICB0aGlzLnBhbmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodG91Y2guc3RhcnQsIHRoaXMuX3Jlc2V0VG91Y2hGbik7XG4gIHRoaXMucGFuZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hjYW5jZWwnLCB0aGlzLl9vblRvdWNoQ2FuY2VsRm4pO1xuICB0aGlzLnBhbmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodG91Y2guZW5kLCB0aGlzLl9vblRvdWNoRW5kRm4pO1xuICB0aGlzLnBhbmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodG91Y2gubW92ZSwgdGhpcy5fb25Ub3VjaE1vdmVGbik7XG4gIGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKCdzY3JvbGwnLCB0aGlzLl9vblNjcm9sbEZuKTtcblxuICAvLyBSZW1vdmUgbWV0aG9kc1xuICB0aGlzLm9wZW4gPSB0aGlzLmNsb3NlID0gZnVuY3Rpb24oKSB7fTtcblxuICAvLyBSZXR1cm4gdGhlIGluc3RhbmNlIHNvIGl0IGNhbiBiZSBlYXNpbHkgZGVyZWZlcmVuY2VkXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBFeHBvc2UgU2xpZGVvdXRcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBTbGlkZW91dDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJlcXVlc3RBbmltRnJhbWUgPSAoZnVuY3Rpb24oKSB7XG4gIHJldHVybiB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XG4gICAgd2luZG93LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxuICAgIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgd2luZG93LnNldFRpbWVvdXQoY2FsbGJhY2ssIDEwMDAgLyA2MCk7XG4gICAgfTtcbn0oKSk7XG5cbmZ1bmN0aW9uIGRlY291cGxlKG5vZGUsIGV2ZW50LCBmbikge1xuICB2YXIgZXZlLFxuICAgICAgdHJhY2tpbmcgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBjYXB0dXJlRXZlbnQoZSkge1xuICAgIGV2ZSA9IGU7XG4gICAgdHJhY2soKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyYWNrKCkge1xuICAgIGlmICghdHJhY2tpbmcpIHtcbiAgICAgIHJlcXVlc3RBbmltRnJhbWUodXBkYXRlKTtcbiAgICAgIHRyYWNraW5nID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGUoKSB7XG4gICAgZm4uY2FsbChub2RlLCBldmUpO1xuICAgIHRyYWNraW5nID0gZmFsc2U7XG4gIH1cblxuICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGNhcHR1cmVFdmVudCwgZmFsc2UpO1xuXG4gIHJldHVybiBjYXB0dXJlRXZlbnQ7XG59XG5cbi8qKlxuICogRXhwb3NlIGRlY291cGxlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZGVjb3VwbGU7XG4iLCJcInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBfY2xhc3NDYWxsQ2hlY2sgPSBmdW5jdGlvbiAoaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIik7IH0gfTtcclxuXHJcbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XHJcbi8qKlxyXG4gKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIEVtaXR0ZXIuXHJcbiAqIEBjbGFzc1xyXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGEgbmV3IGluc3RhbmNlIG9mIEVtaXR0ZXIuXHJcbiAqIEBleGFtcGxlXHJcbiAqIC8vIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgRW1pdHRlci5cclxuICogdmFyIEVtaXR0ZXIgPSByZXF1aXJlKCdlbWl0dGVyJyk7XHJcbiAqXHJcbiAqIHZhciBlbWl0dGVyID0gbmV3IEVtaXR0ZXIoKTtcclxuICovXHJcblxyXG52YXIgRW1pdHRlciA9IChmdW5jdGlvbiAoKSB7XHJcbiAgZnVuY3Rpb24gRW1pdHRlcigpIHtcclxuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBFbWl0dGVyKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgYSBsaXN0ZW5lciB0byB0aGUgY29sbGVjdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBldmVudC5cclxuICAgKiBAbWVtYmVyb2YhIEVtaXR0ZXIucHJvdG90eXBlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0gVGhlIGV2ZW50IG5hbWUuXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgLSBBIGxpc3RlbmVyIGZ1bmN0aW9uIHRvIGFkZC5cclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIEVtaXR0ZXIuXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBBZGQgYW4gZXZlbnQgbGlzdGVuZXIgdG8gXCJmb29cIiBldmVudC5cclxuICAgKiBlbWl0dGVyLm9uKCdmb28nLCBsaXN0ZW5lcik7XHJcbiAgICovXHJcblxyXG4gIEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gb24oZXZlbnQsIGxpc3RlbmVyKSB7XHJcbiAgICAvLyBVc2UgdGhlIGN1cnJlbnQgY29sbGVjdGlvbiBvciBjcmVhdGUgaXQuXHJcbiAgICB0aGlzLl9ldmVudENvbGxlY3Rpb24gPSB0aGlzLl9ldmVudENvbGxlY3Rpb24gfHwge307XHJcblxyXG4gICAgLy8gVXNlIHRoZSBjdXJyZW50IGNvbGxlY3Rpb24gb2YgYW4gZXZlbnQgb3IgY3JlYXRlIGl0LlxyXG4gICAgdGhpcy5fZXZlbnRDb2xsZWN0aW9uW2V2ZW50XSA9IHRoaXMuX2V2ZW50Q29sbGVjdGlvbltldmVudF0gfHwgW107XHJcblxyXG4gICAgLy8gQXBwZW5kcyB0aGUgbGlzdGVuZXIgaW50byB0aGUgY29sbGVjdGlvbiBvZiB0aGUgZ2l2ZW4gZXZlbnRcclxuICAgIHRoaXMuX2V2ZW50Q29sbGVjdGlvbltldmVudF0ucHVzaChsaXN0ZW5lcik7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhIGxpc3RlbmVyIHRvIHRoZSBjb2xsZWN0aW9uIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50IHRoYXQgd2lsbCBiZSBjYWxsZWQgb25seSBvbmNlLlxyXG4gICAqIEBtZW1iZXJvZiEgRW1pdHRlci5wcm90b3R5cGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSBUaGUgZXZlbnQgbmFtZS5cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciAtIEEgbGlzdGVuZXIgZnVuY3Rpb24gdG8gYWRkLlxyXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgRW1pdHRlci5cclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIFdpbGwgYWRkIGFuIGV2ZW50IGhhbmRsZXIgdG8gXCJmb29cIiBldmVudCBvbmNlLlxyXG4gICAqIGVtaXR0ZXIub25jZSgnZm9vJywgbGlzdGVuZXIpO1xyXG4gICAqL1xyXG5cclxuICBFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24gb25jZShldmVudCwgbGlzdGVuZXIpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBmdW5jdGlvbiBmbigpIHtcclxuICAgICAgc2VsZi5vZmYoZXZlbnQsIGZuKTtcclxuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICBmbi5saXN0ZW5lciA9IGxpc3RlbmVyO1xyXG5cclxuICAgIHRoaXMub24oZXZlbnQsIGZuKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmVzIGEgbGlzdGVuZXIgZnJvbSB0aGUgY29sbGVjdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBldmVudC5cclxuICAgKiBAbWVtYmVyb2YhIEVtaXR0ZXIucHJvdG90eXBlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0gVGhlIGV2ZW50IG5hbWUuXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgLSBBIGxpc3RlbmVyIGZ1bmN0aW9uIHRvIHJlbW92ZS5cclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIEVtaXR0ZXIuXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBSZW1vdmUgYSBnaXZlbiBsaXN0ZW5lci5cclxuICAgKiBlbWl0dGVyLm9mZignZm9vJywgbGlzdGVuZXIpO1xyXG4gICAqL1xyXG5cclxuICBFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbiBvZmYoZXZlbnQsIGxpc3RlbmVyKSB7XHJcblxyXG4gICAgdmFyIGxpc3RlbmVycyA9IHVuZGVmaW5lZDtcclxuXHJcbiAgICAvLyBEZWZpbmVzIGxpc3RlbmVycyB2YWx1ZS5cclxuICAgIGlmICghdGhpcy5fZXZlbnRDb2xsZWN0aW9uIHx8ICEobGlzdGVuZXJzID0gdGhpcy5fZXZlbnRDb2xsZWN0aW9uW2V2ZW50XSkpIHtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgbGlzdGVuZXJzLmZvckVhY2goZnVuY3Rpb24gKGZuLCBpKSB7XHJcbiAgICAgIGlmIChmbiA9PT0gbGlzdGVuZXIgfHwgZm4ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB7XHJcbiAgICAgICAgLy8gUmVtb3ZlcyB0aGUgZ2l2ZW4gbGlzdGVuZXIuXHJcbiAgICAgICAgbGlzdGVuZXJzLnNwbGljZShpLCAxKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUmVtb3ZlcyBhbiBlbXB0eSBldmVudCBjb2xsZWN0aW9uLlxyXG4gICAgaWYgKGxpc3RlbmVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50Q29sbGVjdGlvbltldmVudF07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogRXhlY3V0ZSBlYWNoIGl0ZW0gaW4gdGhlIGxpc3RlbmVyIGNvbGxlY3Rpb24gaW4gb3JkZXIgd2l0aCB0aGUgc3BlY2lmaWVkIGRhdGEuXHJcbiAgICogQG1lbWJlcm9mISBFbWl0dGVyLnByb3RvdHlwZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBuYW1lIG9mIHRoZSBldmVudCB5b3Ugd2FudCB0byBlbWl0LlxyXG4gICAqIEBwYXJhbSB7Li4uT2JqZWN0fSBkYXRhIC0gRGF0YSB0byBwYXNzIHRvIHRoZSBsaXN0ZW5lcnMuXHJcbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gRW1pdHMgdGhlIFwiZm9vXCIgZXZlbnQgd2l0aCAncGFyYW0xJyBhbmQgJ3BhcmFtMicgYXMgYXJndW1lbnRzLlxyXG4gICAqIGVtaXR0ZXIuZW1pdCgnZm9vJywgJ3BhcmFtMScsICdwYXJhbTInKTtcclxuICAgKi9cclxuXHJcbiAgRW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uIGVtaXQoZXZlbnQpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBBcnJheShfbGVuID4gMSA/IF9sZW4gLSAxIDogMCksIF9rZXkgPSAxOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XHJcbiAgICAgIGFyZ3NbX2tleSAtIDFdID0gYXJndW1lbnRzW19rZXldO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBsaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XHJcblxyXG4gICAgLy8gRGVmaW5lcyBsaXN0ZW5lcnMgdmFsdWUuXHJcbiAgICBpZiAoIXRoaXMuX2V2ZW50Q29sbGVjdGlvbiB8fCAhKGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50Q29sbGVjdGlvbltldmVudF0pKSB7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENsb25lIGxpc3RlbmVyc1xyXG4gICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLnNsaWNlKDApO1xyXG5cclxuICAgIGxpc3RlbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChmbikge1xyXG4gICAgICByZXR1cm4gZm4uYXBwbHkoX3RoaXMsIGFyZ3MpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgcmV0dXJuIEVtaXR0ZXI7XHJcbn0pKCk7XHJcblxyXG4vKipcclxuICogRXhwb3J0cyBFbWl0dGVyXHJcbiAqL1xyXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IEVtaXR0ZXI7XHJcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1tcImRlZmF1bHRcIl07Il19
