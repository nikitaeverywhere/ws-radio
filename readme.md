# WebSockets Radio

A lightweight universal WebSocket publish/subscribe wrapper: a single module for NodeJS and client
JavaScript.

Usage
-----

Client usage:

```javascript
import Radio from "ws-radio";

const ws = new WebSocket(`http://localhost:12345`);
const radio = new Radio(ws);
```

Server usage (with `ws` package):

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
// send any data to another peer
radio.tell("saveObject", {
	any: "Data",
	whatever: [1, 2, 3]
});
radio.tell("message", "anyData", (response) => {
	console.log(`I've got a response to my message: ${ response }`);
});

// listen for data coming from another peer
radio.listen("message", (data) => { // without sending a response
	console.log(data);
});
radio.listen("message", (data, response) => { // send response to client
	radio.tell(response, "I received a message!");
});
```

License
-------

[MIT](license) © [Nikita Savchenko](https://nikita.tk)
