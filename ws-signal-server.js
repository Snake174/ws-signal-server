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
        const message = JSON.stringify(obj);
        console.log(`Sending message: ${message.substring(0, 100)}...`);
        ws.send(message);
    } else {
        console.log(`Cannot send message, WebSocket state: ${ws.readyState}`);
    }
}

function broadcastExcept(senderId, obj) {
    let sentCount = 0;
    for (const [peerId, ws] of peers.entries()) {
        if (peerId !== senderId && ws.readyState === WebSocket.OPEN) {
            console.log(`Sending message to peer ${peerId}, ws state: ${ws.readyState}`);
            send(ws, obj);
            sentCount++;
        } else {
            console.log(`Skipping peer ${peerId}, ws state: ${ws.readyState}, is sender: ${peerId === senderId}`);
        }
    }
    console.log(`Broadcast completed: sent to ${sentCount} peers`);
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
    if (peers.size > 1) {
        console.log(`Broadcasting new-peer notification for ${peerId} to ${peers.size - 1} existing peers`);
        broadcastExcept(peerId, {
            type: 'new-peer',
            peerId
        });
        console.log(`Sent new-peer notification to ${peers.size - 1} existing peers`);
    } else {
        console.log(`No existing peers to notify about new peer ${peerId}`);
    }

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
