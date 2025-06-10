const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 50e6, // 50MB
  pingTimeout: 30000,     // 30초
  pingInterval: 25000,    // 25초
  connectTimeout: 5000,   // 5초
  maxPayload: 50000000,    // 50MB
  transports: ['websocket', 'polling'],
  upgradeTimeout: 10000,  // 10초
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2분
    skipMiddlewares: true,
  }
});

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// 기본 라우트
app.get('/', (req, res) => {
  res.send('채팅 서버가 실행 중입니다.');
});

// 기본 채팅방 목록
const defaultRooms = [
    { id: 'room1', name: '일반 채팅' },
    { id: 'room2', name: '게임 채팅' },
    { id: 'room3', name: '음악 채팅' }
];

// 채팅방 목록 요청 처리
app.get('/api/rooms', (req, res) => {
    res.json(defaultRooms);
});

// 채팅방 관리를 위한 Map
const chatRooms = new Map();
const chatHistory = new Map();

// 연결된 클라이언트 수 추적
let connectedClients = 0;
const MAX_CLIENTS = 10;

// 파일 업로드를 위한 디렉토리 생성
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 소켓 연결 처리
io.on('connection', (socket) => {
    if (connectedClients >= MAX_CLIENTS) {
        socket.emit('error', { message: '서버가 최대 수용 인원에 도달했습니다.' });
        socket.disconnect(true);
        return;
    }
    
    connectedClients++;
    console.log(`현재 연결된 클라이언트 수: ${connectedClients}`);

    // 채팅방 입장
    socket.on('joinRoom', (roomId, username) => {
        socket.join(roomId);
        
        if (!chatRooms.has(roomId)) {
            chatRooms.set(roomId, new Set());
            chatHistory.set(roomId, []);
        }
        chatRooms.get(roomId).add(username);

        // 기존 메시지 기록 전송
        const history = chatHistory.get(roomId) || [];
        socket.emit('chatHistory', history);

        io.to(roomId).emit('userJoined', {
            username,
            message: `${username}님이 입장하셨습니다.`,
            timestamp: new Date().toISOString()
        });
    });

    // 메시지 수신 및 브로드캐스트
    socket.on('sendMessage', (data) => {
        const { roomId, message, username, type, fileName } = data;
        
        if (type === 'image') {
            try {
                const base64Data = message.replace(/^data:image\/\w+;base64,/, '');
                const fileExt = fileName.split('.').pop();
                const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const filePath = path.join(uploadDir, uniqueFileName);
                
                fs.writeFileSync(filePath, base64Data, 'base64');
                console.log('File saved:', filePath);
                
                const fileUrl = `uploads/${uniqueFileName}`;
                const messageData = {
                    username,
                    message: fileUrl,
                    type: 'image',
                    fileName,
                    fileSize: data.fileSize,
                    timestamp: new Date().toISOString()
                };

                if (!chatHistory.has(roomId)) {
                    chatHistory.set(roomId, []);
                }
                chatHistory.get(roomId).push(messageData);

                if (chatHistory.get(roomId).length > 100) {
                    chatHistory.get(roomId).shift();
                }

                io.to(roomId).emit('newMessage', messageData);
            } catch (error) {
                console.error('File upload error:', error);
                socket.emit('error', { message: '파일 업로드 실패' });
            }
        } else {
            const messageData = {
                username,
                message,
                timestamp: new Date().toISOString()
            };

            if (!chatHistory.has(roomId)) {
                chatHistory.set(roomId, []);
            }
            chatHistory.get(roomId).push(messageData);

            if (chatHistory.get(roomId).length > 100) {
                chatHistory.get(roomId).shift();
            }

            io.to(roomId).emit('newMessage', messageData);
        }
    });

    // 채팅방 퇴장
    socket.on('leaveRoom', (roomId, username) => {
        socket.leave(roomId);
        
        if (chatRooms.has(roomId)) {
            chatRooms.get(roomId).delete(username);
            
            io.to(roomId).emit('userLeft', {
                username,
                message: `${username}님이 퇴장하셨습니다.`,
                timestamp: new Date().toISOString()
            });
        }
    });

    // 연결 해제
    socket.on('disconnect', () => {
        connectedClients--;
        console.log('클라이언트가 연결을 종료했습니다.');
        console.log(`현재 연결된 클라이언트 수: ${connectedClients}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 