// ws-signal-server.js
// WebSocket signaling server for WebRTC (Node.js version)

const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const PATH = '/ws';

const server = http.createServer();
const wss = new WebSocket.Server({ server, path: PATH });

wss.on('connection', (ws, req) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        console.log('Received:', message.toString().trim(), '(broadcasting)');
        // Broadcast to all other clients
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (err) => {
        console.log('WebSocket error:', err.message);
    });
});

server.listen(PORT, () => {
    console.log(`WebSocket Signal Server started at ws://localhost:${PORT}${PATH}`);
}); 