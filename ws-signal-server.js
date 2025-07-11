// ws-signal-server.js
// WebSocket mesh signaling server for WebRTC (Node.js) - Updated version

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
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
    }
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

        console.log('Received message:', JSON.stringify(msg, null, 2));

        // Обработка запроса о peer'ах - проверяем оба варианта регистра
        if ((msg.Data === 'peers-request') || (msg.data === 'peers-request')) {
            console.log(`Peer ${peerId} requested peers list`);
            send(ws, {
                type: 'unknown',
                Data: 'peers-response',
                peers: Array.from(peers.keys()).filter(id => id !== peerId)
            });
            return;
        }

        // Ожидаем поля: {from, to, type, data} или {From, To, Type, Data}
        // Проверяем оба варианта регистра
        const to = msg.to || msg.To;
        const from = msg.from || msg.From;
        const type = msg.type || msg.Type;
        const data = msg.data || msg.Data;

        if (to && peers.has(to)) {
            // unicast - отправляем как есть
            send(peers.get(to), msg);
        } else if (type === 'broadcast') {
            // broadcast всем кроме отправителя
            broadcastExcept(from, msg);
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
    console.log(`WebSocket Mesh Signal Server (Updated) started at ws://localhost:${PORT}${PATH}`);
});
