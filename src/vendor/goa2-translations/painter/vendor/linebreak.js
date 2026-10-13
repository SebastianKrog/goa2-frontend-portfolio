// Vendored from goa2-translations (src/painter/vendor/linebreak.js). Do not edit — see scripts/sync-translations.mjs.
//#region \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), s = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, c = (n, r, a) => (a = n == null ? {} : e(i(n)), s(r || !n || !n.__esModule ? t(a, "default", {
	value: n,
	enumerable: !0
}) : a, n)), l = /* @__PURE__ */ o(((e, t) => {
	var n = 0, r = -3;
	function i() {
		this.table = new Uint16Array(16), this.trans = new Uint16Array(288);
	}
	function a(e, t) {
		this.source = e, this.sourceIndex = 0, this.tag = 0, this.bitcount = 0, this.dest = t, this.destLen = 0, this.ltree = new i(), this.dtree = new i();
	}
	var o = new i(), s = new i(), c = new Uint8Array(30), l = new Uint16Array(30), u = new Uint8Array(30), d = new Uint16Array(30), f = new Uint8Array([
		16,
		17,
		18,
		0,
		8,
		7,
		9,
		6,
		10,
		5,
		11,
		4,
		12,
		3,
		13,
		2,
		14,
		1,
		15
	]), p = new i(), m = new Uint8Array(320);
	function h(e, t, n, r) {
		var i, a;
		for (i = 0; i < n; ++i) e[i] = 0;
		for (i = 0; i < 30 - n; ++i) e[i + n] = i / n | 0;
		for (a = r, i = 0; i < 30; ++i) t[i] = a, a += 1 << e[i];
	}
	function g(e, t) {
		var n;
		for (n = 0; n < 7; ++n) e.table[n] = 0;
		for (e.table[7] = 24, e.table[8] = 152, e.table[9] = 112, n = 0; n < 24; ++n) e.trans[n] = 256 + n;
		for (n = 0; n < 144; ++n) e.trans[24 + n] = n;
		for (n = 0; n < 8; ++n) e.trans[168 + n] = 280 + n;
		for (n = 0; n < 112; ++n) e.trans[176 + n] = 144 + n;
		for (n = 0; n < 5; ++n) t.table[n] = 0;
		for (t.table[5] = 32, n = 0; n < 32; ++n) t.trans[n] = n;
	}
	var _ = new Uint16Array(16);
	function v(e, t, n, r) {
		var i, a;
		for (i = 0; i < 16; ++i) e.table[i] = 0;
		for (i = 0; i < r; ++i) e.table[t[n + i]]++;
		for (e.table[0] = 0, a = 0, i = 0; i < 16; ++i) _[i] = a, a += e.table[i];
		for (i = 0; i < r; ++i) t[n + i] && (e.trans[_[t[n + i]]++] = i);
	}
	function y(e) {
		e.bitcount-- || (e.tag = e.source[e.sourceIndex++], e.bitcount = 7);
		var t = e.tag & 1;
		return e.tag >>>= 1, t;
	}
	function b(e, t, n) {
		if (!t) return n;
		for (; e.bitcount < 24;) e.tag |= e.source[e.sourceIndex++] << e.bitcount, e.bitcount += 8;
		var r = e.tag & 65535 >>> 16 - t;
		return e.tag >>>= t, e.bitcount -= t, r + n;
	}
	function x(e, t) {
		for (; e.bitcount < 24;) e.tag |= e.source[e.sourceIndex++] << e.bitcount, e.bitcount += 8;
		var n = 0, r = 0, i = 0, a = e.tag;
		do
			r = 2 * r + (a & 1), a >>>= 1, ++i, n += t.table[i], r -= t.table[i];
		while (r >= 0);
		return e.tag = a, e.bitcount -= i, t.trans[n + r];
	}
	function S(e, t, n) {
		var r = b(e, 5, 257), i = b(e, 5, 1), a = b(e, 4, 4), o, s, c;
		for (o = 0; o < 19; ++o) m[o] = 0;
		for (o = 0; o < a; ++o) {
			var l = b(e, 3, 0);
			m[f[o]] = l;
		}
		for (v(p, m, 0, 19), s = 0; s < r + i;) {
			var u = x(e, p);
			switch (u) {
				case 16:
					var d = m[s - 1];
					for (c = b(e, 2, 3); c; --c) m[s++] = d;
					break;
				case 17:
					for (c = b(e, 3, 3); c; --c) m[s++] = 0;
					break;
				case 18:
					for (c = b(e, 7, 11); c; --c) m[s++] = 0;
					break;
				default:
					m[s++] = u;
					break;
			}
		}
		v(t, m, 0, r), v(n, m, r, i);
	}
	function C(e, t, r) {
		for (;;) {
			var i = x(e, t);
			if (i === 256) return n;
			if (i < 256) e.dest[e.destLen++] = i;
			else {
				var a, o, s, f;
				for (i -= 257, a = b(e, c[i], l[i]), o = x(e, r), s = e.destLen - b(e, u[o], d[o]), f = s; f < s + a; ++f) e.dest[e.destLen++] = e.dest[f];
			}
		}
	}
	function w(e) {
		for (var t, i, a; e.bitcount > 8;) e.sourceIndex--, e.bitcount -= 8;
		if (t = e.source[e.sourceIndex + 1], t = 256 * t + e.source[e.sourceIndex], i = e.source[e.sourceIndex + 3], i = 256 * i + e.source[e.sourceIndex + 2], t !== (~i & 65535)) return r;
		for (e.sourceIndex += 4, a = t; a; --a) e.dest[e.destLen++] = e.source[e.sourceIndex++];
		return e.bitcount = 0, n;
	}
	function T(e, t) {
		var i = new a(e, t), c, l, u;
		do {
			switch (c = y(i), l = b(i, 2, 0), l) {
				case 0:
					u = w(i);
					break;
				case 1:
					u = C(i, o, s);
					break;
				case 2:
					S(i, i.ltree, i.dtree), u = C(i, i.ltree, i.dtree);
					break;
				default: u = r;
			}
			if (u !== n) throw Error("Data error");
		} while (!c);
		return i.destLen < i.dest.length ? typeof i.dest.slice == "function" ? i.dest.slice(0, i.destLen) : i.dest.subarray(0, i.destLen) : i.dest;
	}
	g(o, s), h(c, l, 4, 3), h(u, d, 2, 1), c[28] = 0, l[28] = 258, t.exports = T;
})), u = /* @__PURE__ */ o(((e, t) => {
	var n = new Uint8Array(new Uint32Array([305419896]).buffer)[0] === 18, r = (e, t, n) => {
		let r = e[t];
		e[t] = e[n], e[n] = r;
	}, i = (e) => {
		let t = e.length;
		for (let n = 0; n < t; n += 4) r(e, n, n + 3), r(e, n + 1, n + 2);
	};
	t.exports = { swap32LE: (e) => {
		n && i(e);
	} };
})), d = /* @__PURE__ */ o(((e, t) => {
	var n = l(), { swap32LE: r } = u(), i = 11, a = 5, o = i - a, s = 65536 >> i, c = (1 << o) - 1, d = 2, f = (1 << a) - 1, p = 65536 >> a, m = p + (1024 >> a) + 32, h = 1 << d;
	t.exports = class {
		constructor(e) {
			let t = typeof e.readUInt32BE == "function" && typeof e.slice == "function";
			if (t || e instanceof Uint8Array) {
				let i;
				if (t) this.highStart = e.readUInt32LE(0), this.errorValue = e.readUInt32LE(4), i = e.readUInt32LE(8), e = e.slice(12);
				else {
					let t = new DataView(e.buffer);
					this.highStart = t.getUint32(0, !0), this.errorValue = t.getUint32(4, !0), i = t.getUint32(8, !0), e = e.subarray(12);
				}
				e = n(e, new Uint8Array(i)), e = n(e, new Uint8Array(i)), r(e), this.data = new Uint32Array(e.buffer);
			} else ({data: this.data, highStart: this.highStart, errorValue: this.errorValue} = e);
		}
		get(e) {
			let t;
			return e < 0 || e > 1114111 ? this.errorValue : e < 55296 || e > 56319 && e <= 65535 ? (t = (this.data[e >> a] << d) + (e & f), this.data[t]) : e <= 65535 ? (t = (this.data[p + (e - 55296 >> a)] << d) + (e & f), this.data[t]) : e < this.highStart ? (t = this.data[m - s + (e >> i)], t = this.data[t + (e >> a & c)], t = (t << d) + (e & f), this.data[t]) : this.data[this.data.length - h];
		}
	};
})), f = /* @__PURE__ */ o(((e) => {
	var t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	(function(e) {
		var n = typeof Uint8Array < "u" ? Uint8Array : Array, r = 43, i = 47, a = 48, o = 97, s = 65, c = 45, l = 95;
		function u(e) {
			var t = e.charCodeAt(0);
			if (t === r || t === c) return 62;
			if (t === i || t === l) return 63;
			if (t < a) return -1;
			if (t < a + 10) return t - a + 26 + 26;
			if (t < s + 26) return t - s;
			if (t < o + 26) return t - o + 26;
		}
		function d(e) {
			var t, r, i, a, o, s;
			if (e.length % 4 > 0) throw Error("Invalid string. Length must be a multiple of 4");
			var c = e.length;
			o = e.charAt(c - 2) === "=" ? 2 : +(e.charAt(c - 1) === "="), s = new n(e.length * 3 / 4 - o), i = o > 0 ? e.length - 4 : e.length;
			var l = 0;
			function d(e) {
				s[l++] = e;
			}
			for (t = 0, r = 0; t < i; t += 4, r += 3) a = u(e.charAt(t)) << 18 | u(e.charAt(t + 1)) << 12 | u(e.charAt(t + 2)) << 6 | u(e.charAt(t + 3)), d((a & 16711680) >> 16), d((a & 65280) >> 8), d(a & 255);
			return o === 2 ? (a = u(e.charAt(t)) << 2 | u(e.charAt(t + 1)) >> 4, d(a & 255)) : o === 1 && (a = u(e.charAt(t)) << 10 | u(e.charAt(t + 1)) << 4 | u(e.charAt(t + 2)) >> 2, d(a >> 8 & 255), d(a & 255)), s;
		}
		function f(e) {
			var n, r = e.length % 3, i = "", a, o;
			function s(e) {
				return t.charAt(e);
			}
			function c(e) {
				return s(e >> 18 & 63) + s(e >> 12 & 63) + s(e >> 6 & 63) + s(e & 63);
			}
			for (n = 0, o = e.length - r; n < o; n += 3) a = (e[n] << 16) + (e[n + 1] << 8) + e[n + 2], i += c(a);
			switch (r) {
				case 1:
					a = e[e.length - 1], i += s(a >> 2), i += s(a << 4 & 63), i += "==";
					break;
				case 2:
					a = (e[e.length - 2] << 8) + e[e.length - 1], i += s(a >> 10), i += s(a >> 4 & 63), i += s(a << 2 & 63), i += "=";
					break;
			}
			return i;
		}
		e.toByteArray = d, e.fromByteArray = f;
	})(e === void 0 ? e.base64js = {} : e);
})), p = /* @__PURE__ */ c(d(), 1), m = /* @__PURE__ */ c(f(), 1), h = {}, g = 5, _ = 12, v = 13, y = 16, b = 17, x = 22, S = 28, C = 31, w = 33, T = 34, E = 35, D = 36, O = 37, k = 38, A = 39, j = 40, M = 41, N = 42, P = 0, F = 1, I = 2, L = 3, R = 4, z = [
	[
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		L,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R,
		R
	],
	[
		P,
		R,
		R,
		F,
		F,
		R,
		R,
		R,
		R,
		F,
		F,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		R,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		R,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		R,
		I,
		R,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		R,
		I,
		R,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		P,
		F,
		P,
		F,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		P,
		F,
		F,
		F,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		P,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		F,
		F,
		F,
		F,
		F,
		P,
		F,
		F,
		F,
		P
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		P,
		F,
		F,
		F,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		F,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		P,
		F,
		R,
		R,
		R,
		P,
		P,
		F,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		P,
		F,
		R,
		R,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		R,
		I,
		R,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		R,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		R,
		I,
		R,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F,
		F
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		F,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		F,
		F,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		F,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		F,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		F,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		F,
		F,
		F,
		F,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		F,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		F,
		F,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		F,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		F,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		F,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		F,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		P,
		F,
		P,
		P,
		P,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		F,
		R,
		R,
		F,
		F,
		F,
		R,
		R,
		R,
		F,
		F,
		F,
		F,
		F,
		P,
		F,
		F,
		F,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	],
	[
		P,
		R,
		R,
		F,
		F,
		P,
		R,
		R,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		R,
		I,
		R,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		P,
		F,
		P
	]
], B = new p.default(m.default.toByteArray("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")), V = function(e) {
	switch (e) {
		case w: return _;
		case A:
		case j:
		case N: return _;
		case E: return g;
		default: return e;
	}
}, H = function(e) {
	switch (e) {
		case O:
		case k: return T;
		case M: return x;
		default: return e;
	}
}, U = class {
	constructor(e, t = !1) {
		this.position = e, this.required = t;
	}
};
h = class {
	nextCodePoint() {
		let e = this.string.charCodeAt(this.pos++), t = this.string.charCodeAt(this.pos);
		return 55296 <= e && e <= 56319 && 56320 <= t && t <= 57343 ? (this.pos++, (e - 55296) * 1024 + (t - 56320) + 65536) : e;
	}
	nextCharClass() {
		return V(B.get(this.nextCodePoint()));
	}
	getSimpleBreak() {
		switch (this.nextClass) {
			case M: return !1;
			case T:
			case O:
			case k: return this.curClass = T, !1;
			case D: return this.curClass = D, !1;
		}
		return null;
	}
	getPairTableBreak(e) {
		let t = !1;
		switch (z[this.curClass][this.nextClass]) {
			case P:
				t = !0;
				break;
			case F:
				t = e === M;
				break;
			case I:
				if (t = e === M, !t) return t = !1, t;
				break;
			case L:
				if (e !== M) return t;
				break;
			case R: break;
		}
		return this.LB8a && (t = !1), this.LB21a && (this.curClass === y || this.curClass === b) ? (t = !1, this.LB21a = !1) : this.LB21a = this.curClass === v, this.curClass === S ? (this.LB30a++, this.LB30a == 2 && this.nextClass === S && (t = !0, this.LB30a = 0)) : this.LB30a = 0, this.curClass = this.nextClass, t;
	}
	nextBreak() {
		if (this.curClass == null) {
			let e = this.nextCharClass();
			this.curClass = H(e), this.nextClass = e, this.LB8a = e === C, this.LB30a = 0;
		}
		for (; this.pos < this.string.length;) {
			this.lastPos = this.pos;
			let e = this.nextClass;
			if (this.nextClass = this.nextCharClass(), this.curClass === T || this.curClass === D && this.nextClass !== O) return this.curClass = H(V(this.nextClass)), new U(this.lastPos, !0);
			let t = this.getSimpleBreak();
			if (t === null && (t = this.getPairTableBreak(e)), this.LB8a = this.nextClass === C, t) return new U(this.lastPos);
		}
		return this.lastPos < this.string.length ? (this.lastPos = this.string.length, new U(this.string.length)) : null;
	}
	constructor(e) {
		this.string = e, this.pos = 0, this.lastPos = 0, this.curClass = null, this.nextClass = null, this.LB8a = !1, this.LB21a = !1, this.LB30a = 0;
	}
};
//#endregion
export { h as default };
