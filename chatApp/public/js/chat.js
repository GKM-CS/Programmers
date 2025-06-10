const socket = io(SERVER_URL);

// DOM 요소
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const nicknameModal = document.getElementById('nickname-modal');
const nicknameForm = document.getElementById('nickname-form');
const nicknameInput = document.getElementById('nickname-input');
const fileInput = document.getElementById('file-input');
const emojiButton = document.getElementById('emoji-button');
const emojiPopup = document.getElementById('emoji-popup');
const emojiContainer = document.querySelector('.emoji-container');

// roomId를 전역 변수로 선언
let currentRoomId = 'room1';  // 기본값

// 저장된 닉네임 확인
let username = localStorage.getItem('username') || 'User' + Math.floor(Math.random() * 1000);

// 닉네임이 없으면 모달 표시
if (!username) {
    nicknameModal.style.display = 'flex';
} else {
    // 저장된 닉네임으로 채팅방 입장
    socket.emit('joinRoom', currentRoomId, username);
}

// 닉네임 폼 제출 처리
nicknameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newNickname = nicknameInput.value.trim();
    if (newNickname) {
        username = newNickname;
        localStorage.setItem('username', username);
        nicknameModal.style.display = 'none';
        
        // 채팅방 입장
        socket.emit('joinRoom', currentRoomId, username);
    }
});

// sendMessage 함수 수정
const sendMessage = () => {
    const message = messageInput.value.trim();
    
    if (message) {
        socket.emit('sendMessage', {
            roomId: currentRoomId,  // 수정된 부분
            message,
            username
        });
        messageInput.value = '';
    }
};

// 메시지 전송 처리
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    
    if (message) {
        // 서버로 메시지 전송
        socket.emit('sendMessage', {
            roomId: currentRoomId,
            message,
            username
        });
        
        // 입력창 초기화
        messageInput.value = '';
    }
});

// 엔터 키 이벤트 처리
messageInput.addEventListener('keypress', (e) => {
    // Shift + Enter는 줄바꿈 허용
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 파일 선택 이벤트 처리
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) {
        alert('파일 크기는 50MB 이하여야 합니다.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        socket.emit('sendMessage', {
            roomId: currentRoomId,
            message: e.target.result,  // Base64 데이터
            username,
            type: 'image',
            fileName: file.name,
            fileSize: file.size
        });
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
});

// 메시지 수신 처리 수정
socket.on('newMessage', (data) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    const isMyMessage = data.username === username;
    if (isMyMessage) {
        messageElement.classList.add('my-message');
    }

    const messageTime = new Date(data.timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    let messageContent = data.message;
    if (data.type === 'image') {
        const imageUrl = `${SERVER_URL}/${data.message}`;
        messageContent = `
            <div class="image-container">
                <img src="${imageUrl}" alt="${data.fileName || '업로드된 이미지'}" class="chat-image" onerror="this.onerror=null; this.src='${data.message}';">
                <div class="file-info">
                    <span>${data.fileName || '이미지'}</span>
                    <span>${(data.fileSize / 1024 / 1024).toFixed(2)}MB</span>
                </div>
            </div>
        `;
    } else {
        messageContent = formatMessage(data.message);
    }

    messageElement.innerHTML = `
        <div class="message-content">
            ${!isMyMessage ? `<span class="username">${data.username}</span>` : ''}
            <div class="message-bubble">${messageContent}</div>
            <span class="timestamp">${messageTime}</span>
        </div>
    `;

    chatMessages.appendChild(messageElement);
    scrollToBottom();
});

// URL과 이모지를 처리하는 함수
function formatMessage(message) {
    // URL을 클릭 가능한 링크로 변환
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return message.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

// 부드러운 스크롤 함수
function scrollToBottom() {
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

// 테마 관리
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('i');

// 저장된 테마 불러오기
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon(currentTheme);

// 테마 토글 이벤트
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

// 아이콘 업데이트 함수
function updateThemeIcon(theme) {
    themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// 자주 사용되는 이모지 목록
const commonEmojis = [
    '😀', '😂', '🥰', '😊', '😎', '🤔', '😴', '😭',
    '👍', '👋', '🎉', '❤️', '✨', '🔥', '🌟', '💯',
    '🤣', '😅', '😉', '😋', '😍', '😘', '🥺', '😮',
    '💪', '🙏', '👏', '🎵', '🎮', '🌈', '☀️', '🌙'
];

// 이모지 팝업 초기화 함수 수정
function initEmojiPopup() {
    commonEmojis.forEach(emoji => {
        const emojiItem = document.createElement('div');
        emojiItem.className = 'emoji-item';
        emojiItem.textContent = emoji;
        emojiItem.onclick = () => {
            messageInput.value += emoji;
            messageInput.focus();
            emojiPopup.style.display = 'none';
            // 이모지 선택 후 자동으로 메시지 전송
            sendMessage();
        };
        emojiContainer.appendChild(emojiItem);
    });
}

// 이모지 버튼 클릭 이벤트
emojiButton.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPopup.style.display = emojiPopup.style.display === 'block' ? 'none' : 'block';
});

// 팝업 외부 클릭시 닫기
document.addEventListener('click', (e) => {
    if (!emojiPopup.contains(e.target) && e.target !== emojiButton) {
        emojiPopup.style.display = 'none';
    }
});

// 이모지 팝업 초기화 호출
initEmojiPopup();

// 채팅방 목록 가져오기 및 처리
async function loadRooms() {
    try {
        const response = await fetch(`${SERVER_URL}/api/rooms`);
        const rooms = await response.json();
        const roomList = document.querySelector('.room-list');
        
        roomList.innerHTML = rooms.map(room => `
            <div class="room-item ${room.id === currentRoomId ? 'active' : ''}" data-room-id="${room.id}">
                <i class="fas fa-hashtag"></i>
                <span>${room.name}</span>
            </div>
        `).join('');

        // 채팅방 클릭 이벤트 추가
        document.querySelectorAll('.room-item').forEach(item => {
            item.addEventListener('click', () => {
                const newRoomId = item.dataset.roomId;
                if (currentRoomId !== newRoomId) {
                    // 이전 방에서 나가기
                    socket.emit('leaveRoom', currentRoomId, username);
                    
                    // 새로운 방 입장
                    currentRoomId = newRoomId;
                    socket.emit('joinRoom', currentRoomId, username);
                    
                    // UI 업데이트
                    document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));
                    item.classList.add('active');
                    chatMessages.innerHTML = '';
                    
                    // 채널 이름 업데이트
                    const roomName = item.querySelector('span').textContent;
                    document.querySelector('.channel-info h2').textContent = roomName;
                }
            });
        });
    } catch (error) {
        console.error('채팅방 목록을 불러오는데 실패했습니다:', error);
    }
}

// 페이지 로드 시 채팅방 목록 불러오기
loadRooms();

// 채팅 기록 수신 처리
socket.on('chatHistory', (history) => {
    chatMessages.innerHTML = ''; // 기존 메시지 초기화
    history.forEach(data => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        const isMyMessage = data.username === username;
        if (isMyMessage) {
            messageElement.classList.add('my-message');
        }

        const messageTime = new Date(data.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        let messageContent = data.message;
        if (data.type === 'image') {
            const imageUrl = `${SERVER_URL}/${data.message}`;
            messageContent = `
                <div class="image-container">
                    <img src="${imageUrl}" alt="${data.fileName || '업로드된 이미지'}" class="chat-image" onerror="this.onerror=null; this.src='${data.message}';">
                    <div class="file-info">
                        <span>${data.fileName || '이미지'}</span>
                        <span>${(data.fileSize / 1024 / 1024).toFixed(2)}MB</span>
                    </div>
                </div>
            `;
        } else {
            messageContent = formatMessage(data.message);
        }

        messageElement.innerHTML = `
            <div class="message-content">
                ${!isMyMessage ? `<span class="username">${data.username}</span>` : ''}
                <div class="message-bubble">${messageContent}</div>
                <span class="timestamp">${messageTime}</span>
            </div>
        `;

        chatMessages.appendChild(messageElement);
    });
    scrollToBottom();
}); 