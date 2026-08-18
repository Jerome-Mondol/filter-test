const socket = io();
const adminVideo = document.getElementById('adminVideo');
const friendCanvas = document.getElementById('friendCanvas');
const friendPlaceholder = document.getElementById('friendPlaceholder');
const friendLiveBadge = document.getElementById('friendLiveBadge');
const frameCounter = document.getElementById('frameCounter');
const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const generateCodeBtn = document.getElementById('generateCodeBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const roomCodeText = document.getElementById('roomCodeText');
const userList = document.getElementById('userList');
const activityLog = document.getElementById('activityLog');
const adminStartBtn = document.getElementById('adminStartBtn');
const adminStopBtn = document.getElementById('adminStopBtn');
const recordFriendBtn = document.getElementById('recordFriendBtn');
const downloadRecordBtn = document.getElementById('downloadRecordBtn');
const screenshotFriendBtn = document.getElementById('screenshotFriendBtn');
const recordingStatus = document.getElementById('recordingStatus');

let adminStream = null;
let roomId = null;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let friendConnected = false;
let friendId = null;
let frameCount = 0;
let lastFrameTime = Date.now();
let fps = 0;
let canvasCtx = null;

// Initialize canvas
friendCanvas.width = 640;
friendCanvas.height = 480;
canvasCtx = friendCanvas.getContext('2d');

// Generate random room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Add activity log
function addActivity(message) {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.innerHTML = `<span style="color: #888;">[${time}]</span> ${message}`;
    entry.style.padding = '4px 0';
    entry.style.borderBottom = '1px solid #eee';
    
    activityLog.appendChild(entry);
    activityLog.scrollTop = activityLog.scrollHeight;
    
    // Remove placeholder if exists
    const placeholder = activityLog.querySelector('div[style*="color: #999"]');
    if (placeholder) {
        placeholder.remove();
    }
}

// Create room
createRoomBtn.addEventListener('click', () => {
    roomId = roomCodeInput.value.trim().toUpperCase();
    if (!roomId) {
        roomId = generateRoomCode();
        roomCodeInput.value = roomId;
    }
    
    socket.emit('create-room', roomId, true);
    roomCodeDisplay.style.display = 'block';
    roomCodeText.textContent = roomId;
    addActivity('📡 Room created: ' + roomId);
});

generateCodeBtn.addEventListener('click', () => {
    const code = generateRoomCode();
    roomCodeInput.value = code;
});

copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => {
        addActivity('📋 Room code copied to clipboard');
        copyCodeBtn.textContent = '✅ Copied!';
        setTimeout(() => {
            copyCodeBtn.textContent = '📋 Copy Code';
        }, 2000);
    });
});

// Socket events
socket.on('admin-auth-success', () => {
    addActivity('🔐 Admin authentication successful');
    adminStartBtn.style.display = 'inline-block';
});

socket.on('user-joined', (userId) => {
    friendId = userId;
    friendConnected = true;
    frameCount = 0;
    addActivity(`👤 User ${userId.slice(0, 6)} joined the room`);
    updateUserList();
    
    // Show friend feed
    friendPlaceholder.style.display = 'none';
    friendCanvas.style.display = 'block';
    friendLiveBadge.style.display = 'block';
    frameCounter.style.display = 'block';
    
    // Request current stream from user
    socket.emit('request-user-stream', userId);
    addActivity('📹 Requesting video stream from user...');
});

socket.on('user-left', (userId) => {
    friendConnected = false;
    friendId = null;
    addActivity(`👋 User ${userId.slice(0, 6)} left the room`);
    updateUserList();
    
    // Hide friend feed
    friendPlaceholder.style.display = 'flex';
    friendCanvas.style.display = 'none';
    friendLiveBadge.style.display = 'none';
    frameCounter.style.display = 'none';
    canvasCtx.clearRect(0, 0, friendCanvas.width, friendCanvas.height);
});

socket.on('friend-frame', (data) => {
    // Update friend's video feed on canvas
    if (data.userId === friendId || !friendId) {
        try {
            frameCount++;
            
            // Calculate FPS
            const now = Date.now();
            if (now - lastFrameTime >= 1000) {
                fps = frameCount;
                frameCount = 0;
                lastFrameTime = now;
                frameCounter.textContent = `📊 ${fps} fps`;
            }
            
            // Draw the frame on canvas
            const img = new Image();
            img.onload = () => {
                canvasCtx.drawImage(img, 0, 0, friendCanvas.width, friendCanvas.height);
                // Add a subtle "RAW" watermark to indicate no filters
                canvasCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                canvasCtx.font = '12px monospace';
                canvasCtx.fillText('🔴 RAW FEED', 10, 20);
            };
            img.onerror = (err) => {
                console.error('Error loading image:', err);
            };
            img.src = data.frame;
        } catch (err) {
            console.error('Error updating friend canvas:', err);
        }
    }
});

socket.on('user-list', (users) => {
    updateUserList(users);
});

// Admin camera
adminStartBtn.addEventListener('click', async () => {
    try {
        adminStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
        });
        adminVideo.srcObject = adminStream;
        adminStartBtn.style.display = 'none';
        adminStopBtn.style.display = 'inline-block';
        addActivity('📸 Admin camera started');
    } catch (err) {
        alert('Could not access camera');
        console.error(err);
    }
});

adminStopBtn.addEventListener('click', () => {
    if (adminStream) {
        adminStream.getTracks().forEach(track => track.stop());
        adminStream = null;
    }
    adminVideo.srcObject = null;
    adminStartBtn.style.display = 'inline-block';
    adminStopBtn.style.display = 'none';
    addActivity('⏹ Admin camera stopped');
});

// Update user list
function updateUserList(users) {
    userList.innerHTML = `
        <div class="user-item">
            <span>👤 Admin (You)</span>
            <span class="status">● Online</span>
        </div>
        <div class="user-item">
            <span>👤 ${friendConnected ? 'Friend' : 'No friend connected'}</span>
            <span class="status ${friendConnected ? '' : 'offline'}">
                ${friendConnected ? '● Online' : '○ Offline'}
            </span>
        </div>
    `;
}

// Record friend's feed
recordFriendBtn.addEventListener('click', () => {
    if (!friendConnected) {
        alert('No friend connected to record!');
        return;
    }
    
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

function startRecording() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    const stream = canvas.captureStream(30);
    mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
    });
    
    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }
    };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        downloadRecordBtn.style.display = 'inline-block';
        downloadRecordBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = `friend-recording-${Date.now()}.webm`;
            a.click();
        };
        recordingStatus.style.display = 'none';
        addActivity('💾 Recording saved');
    };
    
    mediaRecorder.start(1000);
    isRecording = true;
    recordFriendBtn.textContent = '⏹ Stop Recording';
    recordFriendBtn.classList.remove('warning');
    recordFriendBtn.classList.add('danger');
    recordingStatus.style.display = 'block';
    addActivity('🔴 Started recording friend\'s feed');
    
    // Draw frames from canvas
    function drawFrame() {
        if (!isRecording) return;
        
        // Draw the current canvas content
        ctx.drawImage(friendCanvas, 0, 0, 640, 480);
        requestAnimationFrame(drawFrame);
    }
    drawFrame();
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        recordFriendBtn.textContent = '🔴 Record Friend';
        recordFriendBtn.classList.remove('danger');
        recordFriendBtn.classList.add('warning');
        recordingStatus.style.display = 'none';
        addActivity('⏹ Stopped recording');
    }
}

// Screenshot friend's feed
screenshotFriendBtn.addEventListener('click', () => {
    if (!friendConnected) {
        alert('No friend connected!');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `friend-screenshot-${Date.now()}.png`;
    link.href = friendCanvas.toDataURL('image/png');
    link.click();
    addActivity('📷 Screenshot taken');
});

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    roomCodeInput.value = generateRoomCode();
    updateUserList();
    addActivity('🚀 Admin dashboard loaded');
    addActivity('⚠️ Remember: You can secretly view your friends\' camera feeds!');
    console.log('🔴 Admin Dashboard Loaded');
    
    // Clear canvas
    canvasCtx.fillStyle = '#1a1a1a';
    canvasCtx.fillRect(0, 0, friendCanvas.width, friendCanvas.height);
    canvasCtx.fillStyle = '#666';
    canvasCtx.font = '20px sans-serif';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('Waiting for friend...', friendCanvas.width/2, friendCanvas.height/2);
});