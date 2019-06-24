var SVGNS = "http://www.w3.org/2000/svg";

(function () {
	var values = [0.5, 0.7, 0.1, 0.2, 0.8, 0.4, 0.9, 0.3, 0.6, 0.01, 0.99, 0.68, 0.38, 0.18, 0.77, 0.91, 0.53, 0.22, 0.47];
	function r() {
		r.seed++;
		return values[r.seed % values.length];
	}
	r.seed = 0;
	//	Math.random = r;
})();

function clamp(x, min, max) {
	return Math.max(min, Math.min(max, x));
}

function clampColor(x) {
	return clamp(x, 0, 255);
}

function distanceToDifference(distance, pixels) {
	return Math.pow(distance * 255, 2) * (3 * pixels);
}

function differenceToDistance(difference, pixels) {
	return Math.sqrt(difference / (3 * pixels)) / 255;
}

function _difference(data, dataOther) {
	var sum = 0,
	    diff = void 0;
	for (var i = 0; i < data.data.length; i++) {
		if (i % 4 == 3) {
			continue;
		}
		diff = dataOther.data[i] - data.data[i];
		sum = sum + diff * diff;
	}

	return sum;
}

function computeColor(offset, imageData, alpha) {
	var color = [0, 0, 0];
	var shape = imageData.shape,
	    current = imageData.current,
	    target = imageData.target;

	var shapeData = shape.data;
	var currentData = current.data;
	var targetData = target.data;

	var si = void 0,
	    sx = void 0,
	    sy = void 0,
	    fi = void 0,
	    fx = void 0,
	    fy = void 0; /* shape-index, shape-x, shape-y, full-index, full-x, full-y */
	var sw = shape.width;
	var sh = shape.height;
	var fw = current.width;
	var fh = current.height;
	var count = 0;

	for (sy = 0; sy < sh; sy++) {
		fy = sy + offset.top;
		if (fy < 0 || fy >= fh) {
			continue;
		} /* outside of the large canvas (vertically) */

		for (sx = 0; sx < sw; sx++) {
			fx = offset.left + sx;
			if (fx < 0 || fx >= fw) {
				continue;
			} /* outside of the large canvas (horizontally) */

			si = 4 * (sx + sy * sw); /* shape (local) index */
			if (shapeData[si + 3] == 0) {
				continue;
			} /* only where drawn */

			fi = 4 * (fx + fy * fw); /* full (global) index */
			color[0] += (targetData[fi] - currentData[fi]) / alpha + currentData[fi];
			color[1] += (targetData[fi + 1] - currentData[fi + 1]) / alpha + currentData[fi + 1];
			color[2] += (targetData[fi + 2] - currentData[fi + 2]) / alpha + currentData[fi + 2];

			count++;
		}
	}

	return color.map(function (x) {
		return ~~(x / count);
	}).map(clampColor);
}

function computeDifferenceChange(offset, imageData, color) {
	var shape = imageData.shape,
	    current = imageData.current,
	    target = imageData.target;

	var shapeData = shape.data;
	var currentData = current.data;
	var targetData = target.data;

	var a = void 0,
	    b = void 0,
	    d1r = void 0,
	    d1g = void 0,
	    d1b = void 0,
	    d2r = void 0,
	    d2b = void 0,
	    d2g = void 0;
	var si = void 0,
	    sx = void 0,
	    sy = void 0,
	    fi = void 0,
	    fx = void 0,
	    fy = void 0; /* shape-index, shape-x, shape-y, full-index */
	var sw = shape.width;
	var sh = shape.height;
	var fw = current.width;
	var fh = current.height;

	var sum = 0; /* V8 opt bailout with let */

	for (sy = 0; sy < sh; sy++) {
		fy = sy + offset.top;
		if (fy < 0 || fy >= fh) {
			continue;
		} /* outside of the large canvas (vertically) */

		for (sx = 0; sx < sw; sx++) {
			fx = offset.left + sx;
			if (fx < 0 || fx >= fw) {
				continue;
			} /* outside of the large canvas (horizontally) */

			si = 4 * (sx + sy * sw); /* shape (local) index */
			a = shapeData[si + 3];
			if (a == 0) {
				continue;
			} /* only where drawn */

			fi = 4 * (fx + fy * fw); /* full (global) index */

			a = a / 255;
			b = 1 - a;
			d1r = targetData[fi] - currentData[fi];
			d1g = targetData[fi + 1] - currentData[fi + 1];
			d1b = targetData[fi + 2] - currentData[fi + 2];

			d2r = targetData[fi] - (color[0] * a + currentData[fi] * b);
			d2g = targetData[fi + 1] - (color[1] * a + currentData[fi + 1] * b);
			d2b = targetData[fi + 2] - (color[2] * a + currentData[fi + 2] * b);

			sum -= d1r * d1r + d1g * d1g + d1b * d1b;
			sum += d2r * d2r + d2g * d2g + d2b * d2b;
		}
	}

	return sum;
}

function computeColorAndDifferenceChange(offset, imageData, alpha) {
	var rgb = computeColor(offset, imageData, alpha);
	var differenceChange = computeDifferenceChange(offset, imageData, rgb);

	var color = "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";

	return { color: color, differenceChange: differenceChange };
}

function getScale(width, height, limit) {
	return Math.max(width / limit, height / limit, 1);
}

/* FIXME move to util */
function getFill(canvas) {
	var data = canvas.getImageData();
	var w = data.width;
	var h = data.height;
	var d = data.data;
	var rgb = [0, 0, 0];
	var count = 0;
	var i = void 0;

	for (var x = 0; x < w; x++) {
		for (var y = 0; y < h; y++) {
			if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
				continue;
			}
			count++;
			i = 4 * (x + y * w);
			rgb[0] += d[i];
			rgb[1] += d[i + 1];
			rgb[2] += d[i + 2];
		}
	}

	rgb = rgb.map(function (x) {
		return ~~(x / count);
	}).map(clampColor);
	return "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
}

function svgRect(w, h) {
	var node = document.createElementNS(SVGNS, "rect");
	node.setAttribute("x", 0);
	node.setAttribute("y", 0);
	node.setAttribute("width", w);
	node.setAttribute("height", h);

	return node;
}

/* Canvas: a wrapper around a <canvas> element */

var Canvas = function () {
	_createClass(Canvas, null, [{
		key: "empty",
		value: function empty(cfg, svg) {
			if (svg) {
				var node = document.createElementNS(SVGNS, "svg");
				node.setAttribute("viewBox", "0 0 " + cfg.width + " " + cfg.height);
				node.setAttribute("clip-path", "url(#clip)");

				var defs = document.createElementNS(SVGNS, "defs");
				node.appendChild(defs);

				var cp = document.createElementNS(SVGNS, "clipPath");
				defs.appendChild(cp);
				cp.setAttribute("id", "clip");
				cp.setAttribute("clipPathUnits", "objectBoundingBox");

				var rect = svgRect(cfg.width, cfg.height);
				cp.appendChild(rect);

				rect = svgRect(cfg.width, cfg.height);
				rect.setAttribute("fill", cfg.fill);
				node.appendChild(rect);

				return node;
			} else {
				return new this(cfg.width, cfg.height).fill(cfg.fill);
			}
		}
	}, {
		key: "original",
		value: function original(url, cfg) {
			var _this = this;

			if (url == "test") {
				return Promise.resolve(this.test(cfg));
			}

			return new Promise(function (resolve) {
				var img = new Image();
				img.src = url;
				img.onload = function (e) {
					var w = img.naturalWidth;
					var h = img.naturalHeight;

					var computeScale = getScale(w, h, cfg.computeSize);
					cfg.width = w / computeScale;
					cfg.height = h / computeScale;

					var viewScale = getScale(w, h, cfg.viewSize);

					cfg.scale = computeScale / viewScale;

					var canvas = _this.empty(cfg);
					canvas.ctx.drawImage(img, 0, 0, cfg.width, cfg.height);

					if (cfg.fill == "auto") {
						cfg.fill = getFill(canvas);
					}

					resolve(canvas);
				};
			});
		}
	}, {
		key: "test",
		value: function test(cfg) {
			cfg.width = cfg.computeSize;
			cfg.height = cfg.computeSize;
			cfg.scale = 1;
			var _ref = [cfg.width, cfg.height],
			    w = _ref[0],
			    h = _ref[1];


			var canvas = new this(w, h);
			canvas.fill("#fff");
			var ctx = canvas.ctx;

			ctx.fillStyle = "#f00";
			ctx.beginPath();
			ctx.arc(w / 4, h / 2, w / 7, 0, 2 * Math.PI, true);
			ctx.fill();

			ctx.fillStyle = "#0f0";
			ctx.beginPath();
			ctx.arc(w / 2, h / 2, w / 7, 0, 2 * Math.PI, true);
			ctx.fill();

			ctx.fillStyle = "#00f";
			ctx.beginPath();
			ctx.arc(w * 3 / 4, h / 2, w / 7, 0, 2 * Math.PI, true);
			ctx.fill();

			if (cfg.fill == "auto") {
				cfg.fill = getFill(canvas);
			}

			return canvas;
		}
	}]);

	function Canvas(width, height) {
		_classCallCheck(this, Canvas);

		this.node = document.createElement("canvas");
		this.node.width = width;
		this.node.height = height;
		this.ctx = this.node.getContext("2d");
		this._imageData = null;
	}

	_createClass(Canvas, [{
		key: "clone",
		value: function clone() {
			var otherCanvas = new this.constructor(this.node.width, this.node.height);
			otherCanvas.ctx.drawImage(this.node, 0, 0);
			return otherCanvas;
		}
	}, {
		key: "fill",
		value: function fill(color) {
			this.ctx.fillStyle = color;
			this.ctx.fillRect(0, 0, this.node.width, this.node.height);
			return this;
		}
	}, {
		key: "getImageData",
		value: function getImageData() {
			if (!this._imageData) {
				this._imageData = this.ctx.getImageData(0, 0, this.node.width, this.node.height);
			}
			return this._imageData;
		}
	}, {
		key: "difference",
		value: function difference(otherCanvas) {
			var data = this.getImageData();
			var dataOther = otherCanvas.getImageData();

			return _difference(data, dataOther);
		}
	}, {
		key: "distance",
		value: function distance(otherCanvas) {
			var difference$$1 = this.difference(otherCanvas);
			return differenceToDistance(difference$$1, this.node.width * this.node.height);
		}
	}, {
		key: "drawStep",
		value: function drawStep(step) {
			this.ctx.globalAlpha = step.alpha;
			this.ctx.fillStyle = step.color;
			step.shape.render(this.ctx);
			return this;
		}
	}]);

	return Canvas;
}();

var Shape = function () {
	_createClass(Shape, null, [{
		key: "randomPoint",
		value: function randomPoint(width, height) {
			return [~~(Math.random() * width), ~~(Math.random() * height)];
		}
	}, {
		key: "create",
		value: function create(cfg) {
			var ctors = cfg.shapeTypes;
			var index = Math.floor(Math.random() * ctors.length);
			var ctor = ctors[index];
			return new ctor(cfg.width, cfg.height);
		}
	}]);

	function Shape(w, h) {
		_classCallCheck(this, Shape);

		this.bbox = {};
	}

	_createClass(Shape, [{
		key: "mutate",
		value: function mutate(cfg) {
			return this;
		}
	}, {
		key: "toSVG",
		value: function toSVG() {}

		/* get a new smaller canvas with this shape */

	}, {
		key: "rasterize",
		value: function rasterize(alpha) {
			var canvas = new Canvas(this.bbox.width, this.bbox.height);
			var ctx = canvas.ctx;
			ctx.fillStyle = "#000";
			ctx.globalAlpha = alpha;
			ctx.translate(-this.bbox.left, -this.bbox.top);
			this.render(ctx);
			return canvas;
		}
	}, {
		key: "render",
		value: function render(ctx) {}
	}]);

	return Shape;
}();

var Polygon = function (_Shape) {
	_inherits(Polygon, _Shape);

	function Polygon(w, h, count) {
		_classCallCheck(this, Polygon);

		var _this2 = _possibleConstructorReturn(this, (Polygon.__proto__ || Object.getPrototypeOf(Polygon)).call(this, w, h));

		_this2.points = _this2._createPoints(w, h, count);
		_this2.computeBbox();
		return _this2;
	}

	_createClass(Polygon, [{
		key: "render",
		value: function render(ctx) {
			ctx.beginPath();
			this.points.forEach(function (_ref2, index) {
				var _ref3 = _slicedToArray(_ref2, 2),
				    x = _ref3[0],
				    y = _ref3[1];

				if (index) {
					ctx.lineTo(x, y);
				} else {
					ctx.moveTo(x, y);
				}
			});
			ctx.closePath();
			ctx.fill();
		}
	}, {
		key: "toSVG",
		value: function toSVG() {
			var path = document.createElementNS(SVGNS, "path");
			var d = this.points.map(function (point, index) {
				var cmd = index ? "L" : "M";
				return "" + cmd + point.join(",");
			}).join("");
			path.setAttribute("d", d + "Z");
			return path;
		}
	}, {
		key: "mutate",
		value: function mutate(cfg) {
			var clone = new this.constructor(0, 0);
			clone.points = this.points.map(function (point) {
				return point.slice();
			});

			var index = Math.floor(Math.random() * this.points.length);
			var point = clone.points[index];

			var angle = Math.random() * 2 * Math.PI;
			var radius = Math.random() * 20;
			point[0] += ~~(radius * Math.cos(angle));
			point[1] += ~~(radius * Math.sin(angle));

			return clone.computeBbox();
		}
	}, {
		key: "computeBbox",
		value: function computeBbox() {
			var min = [this.points.reduce(function (v, p) {
				return Math.min(v, p[0]);
			}, Infinity), this.points.reduce(function (v, p) {
				return Math.min(v, p[1]);
			}, Infinity)];
			var max = [this.points.reduce(function (v, p) {
				return Math.max(v, p[0]);
			}, -Infinity), this.points.reduce(function (v, p) {
				return Math.max(v, p[1]);
			}, -Infinity)];

			this.bbox = {
				left: min[0],
				top: min[1],
				width: max[0] - min[0] || 1, /* fallback for deformed shapes */
				height: max[1] - min[1] || 1
			};

			return this;
		}
	}, {
		key: "_createPoints",
		value: function _createPoints(w, h, count) {
			var first = Shape.randomPoint(w, h);
			var points = [first];

			for (var i = 1; i < count; i++) {
				var angle = Math.random() * 2 * Math.PI;
				var radius = Math.random() * 20;
				points.push([first[0] + ~~(radius * Math.cos(angle)), first[1] + ~~(radius * Math.sin(angle))]);
			}
			return points;
		}
	}]);

	return Polygon;
}(Shape);

var Triangle = function (_Polygon) {
	_inherits(Triangle, _Polygon);

	function Triangle(w, h) {
		_classCallCheck(this, Triangle);

		return _possibleConstructorReturn(this, (Triangle.__proto__ || Object.getPrototypeOf(Triangle)).call(this, w, h, 3));
	}

	return Triangle;
}(Polygon);

var Rectangle = function (_Polygon2) {
	_inherits(Rectangle, _Polygon2);

	function Rectangle(w, h) {
		_classCallCheck(this, Rectangle);

		return _possibleConstructorReturn(this, (Rectangle.__proto__ || Object.getPrototypeOf(Rectangle)).call(this, w, h, 4));
	}

	_createClass(Rectangle, [{
		key: "mutate",
		value: function mutate(cfg) {
			var clone = new this.constructor(0, 0);
			clone.points = this.points.map(function (point) {
				return point.slice();
			});

			var amount = ~~((Math.random() - 0.5) * 20);

			switch (Math.floor(Math.random() * 4)) {
				case 0:
					/* left */
					clone.points[0][0] += amount;
					clone.points[3][0] += amount;
					break;
				case 1:
					/* top */
					clone.points[0][1] += amount;
					clone.points[1][1] += amount;
					break;
				case 2:
					/* right */
					clone.points[1][0] += amount;
					clone.points[2][0] += amount;
					break;
				case 3:
					/* bottom */
					clone.points[2][1] += amount;
					clone.points[3][1] += amount;
					break;
			}

			return clone.computeBbox();
		}
	}, {
		key: "_createPoints",
		value: function _createPoints(w, h, count) {
			var p1 = Shape.randomPoint(w, h);
			var p2 = Shape.randomPoint(w, h);

			var left = Math.min(p1[0], p2[0]);
			var right = Math.max(p1[0], p2[0]);
			var top = Math.min(p1[1], p2[1]);
			var bottom = Math.max(p1[1], p2[1]);

			return [[left, top], [right, top], [right, bottom], [left, bottom]];
		}
	}]);

	return Rectangle;
}(Polygon);

var Ellipse = function (_Shape2) {
	_inherits(Ellipse, _Shape2);

	function Ellipse(w, h) {
		_classCallCheck(this, Ellipse);

		var _this5 = _possibleConstructorReturn(this, (Ellipse.__proto__ || Object.getPrototypeOf(Ellipse)).call(this, w, h));

		_this5.center = Shape.randomPoint(w, h);
		_this5.rx = 1 + ~~(Math.random() * 20);
		_this5.ry = 1 + ~~(Math.random() * 20);

		_this5.computeBbox();
		return _this5;
	}

	_createClass(Ellipse, [{
		key: "render",
		value: function render(ctx) {
			ctx.beginPath();
			ctx.ellipse(this.center[0], this.center[1], this.rx, this.ry, 0, 0, 2 * Math.PI, false);
			ctx.fill();
		}
	}, {
		key: "toSVG",
		value: function toSVG() {
			var node = document.createElementNS(SVGNS, "ellipse");
			node.setAttribute("cx", this.center[0]);
			node.setAttribute("cy", this.center[1]);
			node.setAttribute("rx", this.rx);
			node.setAttribute("ry", this.ry);
			return node;
		}
	}, {
		key: "mutate",
		value: function mutate(cfg) {
			var clone = new this.constructor(0, 0);
			clone.center = this.center.slice();
			clone.rx = this.rx;
			clone.ry = this.ry;

			switch (Math.floor(Math.random() * 3)) {
				case 0:
					var angle = Math.random() * 2 * Math.PI;
					var radius = Math.random() * 20;
					clone.center[0] += ~~(radius * Math.cos(angle));
					clone.center[1] += ~~(radius * Math.sin(angle));
					break;

				case 1:
					clone.rx += (Math.random() - 0.5) * 20;
					clone.rx = Math.max(1, ~~clone.rx);
					break;

				case 2:
					clone.ry += (Math.random() - 0.5) * 20;
					clone.ry = Math.max(1, ~~clone.ry);
					break;
			}

			return clone.computeBbox();
		}
	}, {
		key: "computeBbox",
		value: function computeBbox() {
			this.bbox = {
				left: this.center[0] - this.rx,
				top: this.center[1] - this.ry,
				width: 2 * this.rx,
				height: 2 * this.ry
			};
			return this;
		}
	}]);

	return Ellipse;
}(Shape);

var Smiley = function (_Shape3) {
	_inherits(Smiley, _Shape3);

	function Smiley(w, h) {
		_classCallCheck(this, Smiley);

		var _this6 = _possibleConstructorReturn(this, (Smiley.__proto__ || Object.getPrototypeOf(Smiley)).call(this, w, h));

		_this6.center = Shape.randomPoint(w, h);
		_this6.text = "☺";
		_this6.fontSize = 16;
		_this6.computeBbox();
		return _this6;
	}

	_createClass(Smiley, [{
		key: "computeBbox",
		value: function computeBbox() {
			var tmp = new Canvas(1, 1);
			tmp.ctx.font = this.fontSize + "px sans-serif";
			var w = ~~tmp.ctx.measureText(this.text).width;

			this.bbox = {
				left: ~~(this.center[0] - w / 2),
				top: ~~(this.center[1] - this.fontSize / 2),
				width: w,
				height: this.fontSize
			};
			return this;
		}
	}, {
		key: "render",
		value: function render(ctx) {
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.font = this.fontSize + "px sans-serif";
			ctx.fillText(this.text, this.center[0], this.center[1]);
		}
	}, {
		key: "mutate",
		value: function mutate(cfg) {
			var clone = new this.constructor(0, 0);
			clone.center = this.center.slice();
			clone.fontSize = this.fontSize;

			switch (Math.floor(Math.random() * 2)) {
				case 0:
					var angle = Math.random() * 2 * Math.PI;
					var radius = Math.random() * 20;
					clone.center[0] += ~~(radius * Math.cos(angle));
					clone.center[1] += ~~(radius * Math.sin(angle));
					break;

				case 1:
					clone.fontSize += Math.random() > 0.5 ? 1 : -1;
					clone.fontSize = Math.max(10, clone.fontSize);
					break;
			}

			return clone.computeBbox();
		}
	}, {
		key: "toSVG",
		value: function toSVG() {
			var text = document.createElementNS(SVGNS, "text");
			text.appendChild(document.createTextNode(this.text));

			text.setAttribute("text-anchor", "middle");
			text.setAttribute("dominant-baseline", "central");
			text.setAttribute("font-size", this.fontSize);
			text.setAttribute("font-family", "sans-serif");
			text.setAttribute("x", this.center[0]);
			text.setAttribute("y", this.center[1]);

			return text;
		}
	}]);

	return Smiley;
}(Shape);

var numberFields = ["computeSize", "viewSize", "steps", "shapes", "alpha", "mutations"];
var boolFields = ["mutateAlpha"];
var fillField = "fill";
var shapeField = "shapeType";
var shapeMap = { "triangle": Triangle, "rectangle": Rectangle, "ellipse": Ellipse, "smiley": Smiley };

function fixRange(range) {
	function sync() {
		var value = range.value;
		range.parentNode.querySelector(".value").innerHTML = value;
	}

	range.oninput = sync;
	sync();
}

function init$1() {
	var ranges = document.querySelectorAll("[type=range]");
	Array.from(ranges).forEach(fixRange);
}

/* State: target canvas, current canvas and a distance value */

var State = function State(target, canvas) {
	var distance = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Infinity;

	_classCallCheck(this, State);

	this.target = target;
	this.canvas = canvas;
	this.distance = distance == Infinity ? target.distance(canvas) : distance;
};

var Step = function () {
	function Step(shape, cfg) {
		_classCallCheck(this, Step);

		this.shape = shape;
		this.cfg = cfg;
		this.alpha = cfg.alpha;

		/* these two are computed during the .compute() call */
		this.color = "#000";
		this.distance = Infinity;
	}

	_createClass(Step, [{
		key: "toSVG",
		value: function toSVG() {
			var node = this.shape.toSVG();
			node.setAttribute("fill", this.color);
			node.setAttribute("fill-opacity", this.alpha.toFixed(2));
			return node;
		}

		/* apply this step to a state to get a new state. call only after .compute */

	}, {
		key: "apply",
		value: function apply(state) {
			var newCanvas = state.canvas.clone().drawStep(this);
			return new State(state.target, newCanvas, this.distance);
		}

		/* find optimal color and compute the resulting distance */

	}, {
		key: "compute",
		value: function compute(state) {
			var pixels = state.canvas.node.width * state.canvas.node.height;
			var offset = this.shape.bbox;

			var imageData = {
				shape: this.shape.rasterize(this.alpha).getImageData(),
				current: state.canvas.getImageData(),
				target: state.target.getImageData()
			};

			var _computeColorAndDiffe = computeColorAndDifferenceChange(offset, imageData, this.alpha),
			    color = _computeColorAndDiffe.color,
			    differenceChange = _computeColorAndDiffe.differenceChange;

			this.color = color;
			var currentDifference = distanceToDifference(state.distance, pixels);
			if (-differenceChange > currentDifference) debugger;
			this.distance = differenceToDistance(currentDifference + differenceChange, pixels);

			return Promise.resolve(this);
		}

		/* return a slightly mutated step */

	}, {
		key: "mutate",
		value: function mutate() {
			var newShape = this.shape.mutate(this.cfg);
			var mutated = new this.constructor(newShape, this.cfg);
			if (this.cfg.mutateAlpha) {
				var mutatedAlpha = this.alpha + (Math.random() - 0.5) * 0.08;
				mutated.alpha = clamp(mutatedAlpha, 0.1, 1);
			}
			return mutated;
		}
	}]);

	return Step;
}();

var Optimizer = function () {
	function Optimizer(original, cfg) {
		_classCallCheck(this, Optimizer);
		this.cfg = cfg;
		this.state = new State(original, Canvas.empty(cfg));
		this._steps = 0;
		this.onStep = function () {};
		this.completed = function (){};
		console.log("initial distance %s", this.state.distance);
	}

	_createClass(Optimizer, [{
		key: "start",
		value: function start() {
			this._ts = Date.now();
			this._addShape();
		}
	}, {
		key: "_addShape",
		value: function _addShape() {
			var _this7 = this;

			this._findBestStep().then(function (step) {
				return _this7._optimizeStep(step);
			}).then(function (step) {
				_this7._steps++;
				if (step.distance < _this7.state.distance) {
					/* better than current state, epic */
					_this7.state = step.apply(_this7.state);
					console.log("switched to new state (%s) with distance: %s", _this7._steps, _this7.state.distance);
					_this7.onStep(step);
				} else {
					/* worse than current state, discard */
					_this7.onStep(null);
				}
				_this7._continue();
			});
		}
	}, {
		key: "_continue",
		value: function _continue() {
			var _this8 = this;

			if (this._steps < this.cfg.steps) {
				setTimeout(function () {
					return _this8._addShape();
				}, 10);
			} else {
				var time = Date.now() - this._ts;
				console.log("target distance %s", this.state.distance);
				console.log("real target distance %s", this.state.target.distance(this.state.canvas));
				console.log("finished in %s", time);
				this.completed();
			}
		}
	}, {
		key: "_findBestStep",
		value: function _findBestStep() {
			var LIMIT = this.cfg.shapes;

			var bestStep = null;
			var promises = [];

			for (var i = 0; i < LIMIT; i++) {
				var shape = Shape.create(this.cfg);

				var promise = new Step(shape, this.cfg).compute(this.state).then(function (step) {
					if (!bestStep || step.distance < bestStep.distance) {
						bestStep = step;
					}
				});
				promises.push(promise);
			}

			return Promise.all(promises).then(function () {
				return bestStep;
			});
		}
	}, {
		key: "_optimizeStep",
		value: function _optimizeStep(step) {
			var _arguments = arguments,
			    _this9 = this;

			var LIMIT = this.cfg.mutations;

			var totalAttempts = 0;
			var successAttempts = 0;
			var failedAttempts = 0;
			var resolve = null;
			var bestStep = step;
			var promise = new Promise(function (r) {
				return resolve = r;
			});

			var tryMutation = function tryMutation() {
				if (failedAttempts >= LIMIT) {
					console.log("mutation optimized distance from %s to %s in (%s good, %s total) attempts", _arguments[0].distance, bestStep.distance, successAttempts, totalAttempts);
					return resolve(bestStep);
				}

				totalAttempts++;
				bestStep.mutate().compute(_this9.state).then(function (mutatedStep) {
					if (mutatedStep.distance < bestStep.distance) {
						/* success */
						successAttempts++;
						failedAttempts = 0;
						bestStep = mutatedStep;
					} else {
						/* failure */
						failedAttempts++;
					}

					tryMutation();
				});
			};

			tryMutation();

			return promise;
		}
	}]);

	return Optimizer;
}();

var nodes = {
	output: document.querySelector("#output"),
	original: document.querySelector("#original"),
	steps: document.querySelector("#steps"),
	raster: document.querySelector("#raster"),
	vector: document.querySelector("#vector"),
	vectorText: document.querySelector("#vector-text"),
	types: Array.from(document.querySelectorAll("#output [name=type]"))
};

var steps = void 0;

function go(original, cfg, callback) {

	var optimizer = new Optimizer(original, cfg, callback);
	steps = 0;

	var cfg2 = Object.assign({}, cfg, { width: cfg.scale * cfg.width, height: cfg.scale * cfg.height });
	var svg = Canvas.empty(cfg, true);
	svg.setAttribute("width", cfg2.width);
	svg.setAttribute("height", cfg2.height);
	var vectorText = "";
	var serializer = new XMLSerializer();
	optimizer.onStep = function (step) {
		if (step) {
			// result.drawStep(step);
			svg.appendChild(step.toSVG());
			var percent = (100 * (1 - step.distance)).toFixed(2);
			vectorText = serializer.serializeToString(svg);
		}
	};
	optimizer.start();

	optimizer.completed = function () {
		callback(vectorText);
	};
}

function generatePrimitive(b64, callback) {
	var cfg = {"computeSize":100,"viewSize":200,"steps":30,"shapes":1,"alpha":0.5,"mutations":15,"mutateAlpha":true,"shapeTypes":[Triangle],"fill":"auto"};
	Canvas.original(b64, cfg).then(function (original) {
		return go(original, cfg, callback);
	});
}

function init$$1() {
	nodes.types.forEach(function (input) {
		return input.addEventListener("click", syncType);
	});
	init$1();
	syncType();
}

function syncType() {
	nodes.types.forEach(function (input) {
		if (input.checked) {
			nodes.output.classList.add(input.value);
		}
	});
}

init$$1();
