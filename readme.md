# WebSockets Radio

Universal publish/subscribe WebSockets API for JavaScript: a single tiny module 
both for server (NodeJS) and client.

Radio provides a tiny wrapper around client and server WebSocket objects,
which has the same API for communication with another peer.

Usage
-----

Both on client and server you have to work with `Radio` instance, using the same API.
But first, you need to initialize Radio instance and pass a WebSocket to it.

Connect client to server:

```javascript
import Radio from "ws-radio";

const ws = new WebSocket(`http://localhost:12345`);
const radio = new Radio(ws);
```

Server usage (within `ws` package):

```javascript
import Radio from "ws-radio";
import WebSocket from "ws";

const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
	
    const radio = new Radio(ws);
  
});
```

Server/client API:

```javascript
// Send any data to another peer
radio.tell("anyEventNameHere", {
	any: "Data",
	whatever: [1, 2, 3]
});

// Send and wait for response to this request
radio.tell("requestASandwich", 100500, (response) => {
	console.log(`I've got my sandwich: ${ response }`);
});

// Listen for particular event data coming from another peer
radio.listen("anyEventNameHere", (data) => {
	console.log(data); // logs {  }
});

// Listen and reply to a particular message
radio.listen("requestASandwitch", (data, callback) => {
	// pass callback as a first argument to tell
	radio.tell(callback, "Here is your sandwich!");
});

// Re-initialize Radio with another WebSocket (for example, after WebSocket disconnects):
radio.renew(newWebSocket);
```

License
-------

[MIT](license) © [Nikita Savchenko](https://nikita.tk)
