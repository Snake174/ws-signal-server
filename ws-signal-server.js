// ws-signal-server-mesh.js
// WebSocket mesh signaling server for WebRTC (Node.js)

const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;
const PATH = '/ws';

const server = http.createServer();
const wss = new WebSocket.Server({ server, path: PATH });

// peerId -> ws
const peers = new Map();

function send(ws, obj) {
    ws.send(JSON.stringify(obj));
}

function broadcastExcept(senderId, obj) {
    for (const [peerId, ws] of peers.entries()) {
        if (peerId !== senderId && ws.readyState === WebSocket.OPEN) {
            send(ws, obj);
        }
    }
}

wss.on('connection', (ws, req) => {
    const peerId = uuidv4();
    peers.set(peerId, ws);
    console.log(`Client connected: ${peerId}`);

    // Отправляем клиенту его peerId и список других peer'ов
    send(ws, {
        type: 'welcome',
        peerId,
        peers: Array.from(peers.keys()).filter(id => id !== peerId)
    });

    // Оповещаем других о новом peer
    broadcastExcept(peerId, {
        type: 'new-peer',
        peerId
    });

    ws.on('message', (message) => {
        let msg;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            console.log('Invalid message:', message);
            return;
        }
        // Ожидаем поля: {from, to, type, data}
        if (msg.to && peers.has(msg.to)) {
            // unicast
            send(peers.get(msg.to), msg);
        } else if (msg.type === 'broadcast') {
            // broadcast всем кроме отправителя
            broadcastExcept(msg.from, msg);
        } else {
            // неизвестный to
            console.log('Unknown recipient or message:', msg);
        }
    });

    ws.on('close', () => {
        peers.delete(peerId);
        console.log(`Client disconnected: ${peerId}`);
        // Оповещаем других о выходе peer
        broadcastExcept(peerId, {
            type: 'peer-left',
            peerId
        });
    });

    ws.on('error', (err) => {
        console.log('WebSocket error:', err.message);
    });
});

server.listen(PORT, () => {
    console.log(`WebSocket Mesh Signal Server started at ws://localhost:${PORT}${PATH}`);
});
