/**
 * Abstract layer between low-level data transfer and hi-level application binding interface.
 * Controls the data flow using only two abstract entry points: tell and listen.
 * @constructor
 * @param {*} webSocket - WebSocket instance (even emitter)
 */
function Radio (webSocket) {

	/**
	 * @type {Object.<string,{ handler: function, id: number, [times]: number }[]>}
	 * @private
	 */
	this.listeners = {};

	/**
	 * Note: the number of properties should be kept.
	 * @type {Object.<string,function>}
	 * @private
	 */
	this.callbacks = {};

	/**
	 * Stack with messages to send.
	 * @type {*[]}
	 * @private
	 */
	this.messages = [];

	/**
	 * Callback counter decides which callback identifier should be generated next.
	 * @type {number}
	 * @private
	 */
	this.cbCounter = 0;

	/**
	 * Listeners counter decides which listener id should be assigned next.
	 * @type {number}
	 */
	this.listenersCounter = 0;

	/**
	 * @type {WebSocket|EventEmitter}
	 */
	this.webSocket = webSocket;

	if (webSocket)
		this.bind();

}

/**
 * Initialize new WebSocket instance.
 */
Radio.prototype.bind = function () {

	this.webSocket.addEventListener("message", (event) => {
		let obj = {};
		try { obj = JSON.parse(event.data); } catch ( e ) { }
		this._receive(typeof obj === "object" ? obj : {});
	});
	if (this.webSocket.readyState === this.webSocket.OPEN) {
		this._sendStack();
	} else if (this.webSocket.readyState === this.webSocket.CONNECTING) {
		let l = () => { this.webSocket.removeEventListener("open", l); this._sendStack(); };
		this.webSocket.addEventListener("open", l);
	}

};

/**
 * @type {function}
 * @returns {boolean} - Send success.
 * @private
 */
Radio.prototype._send = function (data) {
	this.messages.push(data);
	this._sendStack();
};

/**
 * @private
 */
Radio.prototype._sendStack = function () {

	if (!this.webSocket || this.webSocket.readyState !== this.webSocket.OPEN)
		return;
	let i = 0;
	for (; i < this.messages.length; i++) {
		try {
			this.webSocket.send(
				typeof this.messages[i] === "object"
					? JSON.stringify(this.messages[i])
					: this.messages[i]
			);
		} catch (e) { break; }
	}
	this.messages = this.messages.slice(i, this.messages.length);
};

/**
 * Gives a new WebSocket object to the radio.
 * @param {EventEmitter} webSocket
 */
Radio.prototype.renew = function (webSocket) {
	this.webSocket = webSocket;
	this.bind();
};

/**
 * Messaging note.
 * {
 *  a: "Act",
 *  cb: "Callback. This means 'Give me a response.'",
 *  rb: "Response callback. This means 'Here is your response to callback cbr.'",
 *  d: "Data to send"
 * }
 */

/**
 * Transmits the data. Optionally waits for a response.
 * @param {string|number} act - String is the new message identifier, when number is a response id.
 * @param {*} [data] - Data to transmit.
 * @param {Radio~tellCallback} [callback] - Performs effective tell, waiting for a response.
 */
Radio.prototype.tell = function (act, data, callback) {

	let message = {};

	if (typeof act === "string")
		message.a = act;
	else if (typeof act === "number") // may be an instance later
		message.rb = act;
	else
		throw new Error(`Radio.tell(act): act must be a string or a number, got`, act);

	if (typeof data === "function") {
		callback = data;
		data = undefined;
	}

	if (typeof data !== "undefined")
		message.d = data;

	if (typeof callback === "function")
		this.callbacks[message.cb = ++this.cbCounter] = callback;

	this._send(message);

};

/**
 * Low-level WebSocket send. Useful to send initial handshake.
 * @param {string} string
 */
Radio.prototype.transmit = function (string) {
	this._send(string);
};

/**
 * Ends the current session with the status and reason.
 * @param {string=""} [reason]
 * @param {number=1000} [status]
 */
Radio.prototype.end = function (reason = "", status = 1000) {

	this.tell("end", {
		error: !!reason,
		message: reason || undefined,
		status: status || undefined
	});
	if (this.webSocket)
		this.webSocket.close(status);
	this.listeners = {};
	this.callbacks = {};

};

/**
 * Listens for the data.
 * @param {string} act - Message to expect identifier.
 * @param {Radio~listenHandler} handler
 * @param {number} [times]
 */
Radio.prototype.listen = function ( act, handler, times ) {

	if (typeof handler !== "function") throw new Error("handler must be a function");
	if (typeof act !== "string") throw new Error("act must be a string");
	if (!this.listeners[act]) this.listeners[act] = [];

	let listenerId = ++this.listenersCounter,
		obj = {
			handler: handler,
			id: listenerId
		};

	if (typeof times !== "undefined")
		obj.times = times;
	this.listeners[act].push(obj);

	return listenerId;

};

/**
 * Unbind listener by id.
 * @param listenerId
 * @returns {boolean} - If listener removed.
 */
Radio.prototype.forget = function (listenerId) {

	let filtered = false;

	for (let ar in this.listeners) {
		let len = this.listeners[ar].length;
		this.listeners[ar] = this.listeners[ar].filter((obj) => obj.id !== listenerId);
		filtered = (this.listeners[ar].length < len) || filtered;
		if (!this.listeners[ar].length) {
			delete this.listeners[ar];
		}
	}

	return filtered;

};

/**
 * Sequence modifier.
 * @param {number=1} times
 */
Radio.prototype.times = function (times = 1) {

	let self = this;

	return {
		listen: (act, handler) => {
			return self.listen(act, handler, times);
		}
	};

};

/**
 * Lower-level receive.
 * @param data
 * Not a @private, should be used once as a handler.
 */
Radio.prototype._receive = function (data = {}) {

	if (data.rb) {
		if (this.callbacks[data.rb]) {
			this.callbacks[data.rb](data.d);
			delete this.callbacks[data.rb];
		} else {
			console.log(`[Radio] No callback '${ data.rb }',`, data.d, `lost.`);
		}
	}

	if (data.a) { // listening functions handle the response
		if (this.listeners[data.a] instanceof Array) {
			// re-assigning this.listeners has a downbeat effect here.
			// Just imagine the case when handler removes listener.
			let deprecatedIds = {}, // so the workaround is to remove deprecated listeners later
				hasDeprecated = false;
			this.listeners[data.a].forEach((obj) => {
				obj.handler(data.d, typeof data.cb !== "undefined" ? data.cb : null);
				if (typeof obj.times !== "undefined") {
					obj.times--;
					if (obj.times <= 0) {
						deprecatedIds[obj.id] = true;
						hasDeprecated = true;
					}
				}
			});
			if (hasDeprecated)
				this.listeners[data.a] = this.listeners[data.a].filter(
					({ id }) => !deprecatedIds.hasOwnProperty(id)
				);
		} else {
			console.log(`[Radio] No listener for '${ data.a }',`, data.d, `lost.`);
		}
	}

};

/**
 * Called with the first argument representing probable error.
 * @callback Radio~listenHandler
 * @param {*} data
 * @param {string|null} [data.error] - Status report.
 * @param {number} reply
 */

/**
 * Callback that handles the answer.
 * @callback Radio~tellCallback
 * @param {*} response - Data got in a response.
 * @param {number} reply - Callback identifier, have to be passed as a first argument to another
 *                         tell call.
 */

/**
 * Called with the first argument representing probable error.
 * @callback Radio~sendFunction
 * @param {*} dataToSerialize
 */

module.exports = Radio;