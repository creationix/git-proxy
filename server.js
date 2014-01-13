var WebSocketServer = require('ws').Server;
var net = require('net');
var tls = require('tls');

var port = process.env.PORT || 8080;
var server = new WebSocketServer({port: port});
console.log("Proxy server listening on ws://localhost:%s/", port);

function hostBase(host) {
  return host.match(/([^.:]+(?:\.com|\.org)?)(?:\:[0-9]+)?$/)[1];
}

server.on('connection', function(ws) {
  var req = ws.upgradeReq;
  if (!req.headers.host || !req.headers.origin || hostBase(req.headers.host) !== hostBase(req.headers.origin)) {
    ws.send("Only local origins allowed.");
    ws.close();
    return;
  }
  var match = req.url.match(/^\/(tcp|tls)\/([^\/]+)\/([0-9]+)$/);
  if (!match) {
    ws.send("Invalid request url.\nMust be /:protocol/:host/:port");
    ws.close();
    return;
  }
  var protocol = match[1];
  console.log("ws<->%s Client connected", protocol);
  var host = match[2];
  var port = parseInt(match[3], 10);
  var base = protocol === "tcp" ? net : tls;
  console.log("Connecting to %s:%s", host, port)
  var s = base.connect({host: host, port: port}, onConnect);
  s.on("error", function (err) {
    try {
      ws.send(err);
      ws.close();
    } catch (err) {}
  });
  function onConnect() {
    ws.send("connect");
    console.log("Connected to %s:%s", host, port);
    s.on("error", function (err) {
      try {
        ws.send(err);
        ws.close();
      } catch (err) {}
    });
    ws.on('message', function (message) {
      try {
        s.write(message);
      } catch (err) {}
    });
    ws.on('close', function () {
      try {
        s.end();
      } catch (err) {}
    });
    s.on('data', function (chunk) {
      try {
        ws.send(chunk);
      } catch (err) {}
    });
    s.on('close', function () {
      try {
        ws.close();
      } catch (err) {}
    });
  }
});
