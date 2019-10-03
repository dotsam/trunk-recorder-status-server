const url = require("url");
const path = require("path");
const express = require("express");
const app = express(),
  http = require("http"),
  server = http.createServer(app);
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const clientWss = new WebSocket.Server({
  noServer: true
});
const serverWss = new WebSocket.Server({
  noServer: true
});

var router = express.Router();

var clients = [];
var servers = [];

server.on("upgrade", (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;

  if (pathname === "/client") {
    console.log("Upgrading Client Connection");
    clientWss.handleUpgrade(request, socket, head, ws => {
      clientWss.emit("connection", ws);
    });
  } else if (pathname === "/server") {
    console.log("Upgrading Server Connection");
    serverWss.handleUpgrade(request, socket, head, ws => {
      serverWss.emit("connection", ws);
    });
  } else {
    socket.destroy();
  }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));

app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname + "/public/index.html"));
});

function heartbeat() {
  this.isAlive = true;
}

clientWss.on("connection", function connection(ws, req) {
  console.log(new Date() + " WebSocket Connection accepted.");
  var client = {
    socket: ws
  };
  clients.push(client);

  ws.isAlive = true;

  ws.on("pong", heartbeat);

  ws.on("message", function incoming(message) {
    // console.log("Got message: " + message);
    try {
      var data = JSON.parse(message);
      if (typeof data.type !== "undefined") {
        if (data.type == "add") {
          if (servers) {
            var serversConfig = servers.map(function(srv) {
              return srv.config;
            });
            ws.send(JSON.stringify({
              type: 'config',
              servers: serversConfig,
            }));
          }
        }

      }
    } catch (err) {
      console.log("JSON Parsing Error: " + err);
    }
    // console.log('Received Message: ' + message);
  });

  ws.on("close", function(reasonCode, description) {
    console.log(new Date() + " Client " + connection.remoteAddress + " disconnected.");
    console.log("code: " + reasonCode + " description: " + description);

    for (var i = 0; i < clients.length; i++) {
      // # Remove from our connections list so we don't send
      // # to a dead socket
      if (clients[i].socket == ws) {
        clients.splice(i);
        break;
      }
    }
  });
});

serverWss.on("connection", function connection(ws, req) {
  console.log(new Date() + " WebSocket Connection accepted.");
  ws.isAlive = true;

  ws.on("pong", heartbeat);

  ws.on("message", function incoming(message) {
    try {
      var data = JSON.parse(message);
      if (typeof data.type !== "undefined") {
        if (data.type == "config") {
          srv = {
            socket: ws,
            config: data,
          };
          servers.push(srv);

          // console.log("[ " + data.type + " ] Server Live - Config rcv'd");
        } else if (data.type == "status") {
          // console.log("[ " + data.type + " ] Server - Status message ");
        } else if (data.type == "rates") {
          // console.log("[ " + data.type + " ] Server - Rate message ");
        } else if (data.type == "calls_active") {
          // console.log("[ " + data.type + " ] Server - Calls message ");
        } else {
          // console.log("[ " + data.type + " ] Server - Uknown message type");
        }
      } else {
        console.log("Server - Message type not defined");
      }

      clientWss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (err) {
      console.log("JSON Parsing Error: " + err);
    }
    // console.log('Received Message: ' + message);
  });

  ws.on("close", function(reasonCode, description) {
    console.log(new Date() + " Server " + connection.remoteAddress + " disconnected.");
    console.log("code: " + reasonCode + " description: " + description);

    for (var i = 0; i < servers.length; i++) {
      if (servers[i].socket == ws) {
        servers.splice(i);
        break;
      }
    }
  });
});

server.listen(3010, function() {
  console.log(
    "Web interface is available at: " + server.address().port + "..."
  );
  console.log("status socket address is probably: http://localhost/server");
  // console.log(process.env);
});

module.exports = server;
