const socket = io();
const localVideo = document.getElementById('localVideo');
const filterCanvas = document.getElementById('filterCanvas');
const ctx = filterCanvas.getContext('2d');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const roomDisplay = document.getElementById('roomDisplay');
const joinSection = document.getElementById('joinSection');
const cameraSection = document.getElementById('cameraSection');

let stream = null;
let currentFilter = 'none';
let roomId = null;
let isStreaming = false;
let animationId = null;
let frameInterval = null;
let isSendingFrames = false;

// Filter functions
const filters = {
    none: (ctx, video, width, height) => {
        ctx.drawImage(video, 0, 0, width, height);
    },
    funny: (ctx, video, width, height) => {
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] + 30);
            data[i+1] = Math.max(0, data[i+1] - 20);
            data[i+2] = Math.min(255, data[i+2] + 50);
        }
        ctx.putImageData(imageData, 0, 0);
        ctx.font = '60px sans-serif';
        ctx.fillText('🤪', width - 80, 80);
    },
    mustache: (ctx, video, width, height) => {
        ctx.drawImage(video, 0, 0, width, height);
        ctx.fillStyle = '#4a3728';
        ctx.beginPath();
        ctx.ellipse(width/2 - 30, height/2 + 30, 40, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(width/2 + 30, height/2 + 30, 40, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(width/2 - 30, height/2 + 20, 60, 10);
    },
    glasses: (ctx, video, width, height) => {
        ctx.drawImage(video, 0, 0, width, height);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(width/2 - 40, height/2 - 10, 45, 35, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(width/2 + 40, height/2 - 10, 45, 35, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(width/2 - 5, height/2 - 10);
        ctx.lineTo(width/2 + 5, height/2 - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(width/2 - 85, height/2 - 5);
        ctx.lineTo(width/2 - 110, height/2 + 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(width/2 + 85, height/2 - 5);
        ctx.lineTo(width/2 + 110, height/2 + 10);
        ctx.stroke();
    },
    bigeyes: (ctx, video, width, height) => {
        ctx.drawImage(video, 0, 0, width, height);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(width/2 - 30, height/2 - 20, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(width/2 + 30, height/2 - 20, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(width/2 - 30, height/2 - 15, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(width/2 + 30, height/2 - 15, 15, 0, Math.PI * 2);
        ctx.fill();
    },
    invert: (ctx, video, width, height) => {
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i+1] = 255 - data[i+1];
            data[i+2] = 255 - data[i+2];
        }
        ctx.putImageData(imageData, 0, 0);
    },
    alien: (ctx, video, width, height) => {
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] + 60);
            data[i+1] = Math.max(0, data[i+1] - 30);
            data[i+2] = Math.min(255, data[i+2] + 80);
        }
        ctx.putImageData(imageData, 0, 0);
        ctx.font = '40px sans-serif';
        ctx.fillText('👽', 20, 60);
    },
    clown: (ctx, video, width, height) => {
        ctx.drawImage(video, 0, 0, width, height);
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(width/2, height/2 + 40, 30, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(width/2 - 40, height/2 - 20, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(width/2 + 40, height/2 - 20, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '50px sans-serif';
        ctx.fillText('🤡', width - 70, 70);
    }
};

// Join room
joinBtn.addEventListener('click', () => {
    roomId = roomInput.value.trim().toUpperCase();
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    console.log('Joining room:', roomId);
    socket.emit('create-room', roomId, false);
    joinSection.style.display = 'none';
    cameraSection.style.display = 'block';
    roomDisplay.textContent = roomId;
});

// Socket events
socket.on('room-joined', (id) => {
    console.log('✅ Joined room:', id);
    roomId = id;
    document.querySelector('.status-badge').textContent = '🟢 Connected';
});

socket.on('room-error', (msg) => {
    alert(msg);
    joinSection.style.display = 'block';
    cameraSection.style.display = 'none';
});

socket.on('room-closed', (msg) => {
    alert(msg);
    leaveRoom();
});

// Leave room
leaveBtn.addEventListener('click', leaveRoom);

function leaveRoom() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (frameInterval) {
        clearInterval(frameInterval);
        frameInterval = null;
    }
    localVideo.srcObject = null;
    ctx.clearRect(0, 0, filterCanvas.width, filterCanvas.height);
    joinSection.style.display = 'block';
    cameraSection.style.display = 'none';
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    screenshotBtn.style.display = 'none';
    roomInput.value = '';
    isStreaming = false;
    isSendingFrames = false;
}

// Start camera
startBtn.addEventListener('click', async () => {
    try {
        console.log('Starting camera...');
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        localVideo.srcObject = stream;
        filterCanvas.width = 640;
        filterCanvas.height = 480;
        
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        screenshotBtn.style.display = 'inline-block';
        
        isStreaming = true;
        isSendingFrames = true;
        
        // Start applying filters
        applyFilter();
        
        // Start sending frames to admin
        if (frameInterval) clearInterval(frameInterval);
        frameInterval = setInterval(sendFrame, 50); // 20 fps
        
        document.querySelector('.status-badge').textContent = '🟢 Streaming';
        console.log('✅ Camera started, sending frames...');
        
    } catch (err) {
        alert('Could not access camera. Please allow camera permissions.');
        console.error('Camera error:', err);
    }
});

// Send frame to admin
function sendFrame() {
    if (!isSendingFrames || !roomId || !isStreaming) return;
    
    try {
        // Get the filtered frame as base64
        const frame = filterCanvas.toDataURL('image/jpeg', 0.3);
        
        // Send to server
        socket.emit('video-frame', {
            roomId: roomId,
            frame: frame
        });
    } catch (err) {
        console.error('Error sending frame:', err);
    }
}

// Apply filter
function applyFilter() {
    if (!stream || !isStreaming) return;
    
    const video = localVideo;
    const width = filterCanvas.width;
    const height = filterCanvas.height;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const filterFn = filters[currentFilter] || filters.none;
        filterFn(ctx, video, width, height);
    }
    
    animationId = requestAnimationFrame(applyFilter);
}

// Stop camera
stopBtn.addEventListener('click', () => {
    console.log('Stopping camera...');
    isSendingFrames = false;
    isStreaming = false;
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    localVideo.srcObject = null;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (frameInterval) {
        clearInterval(frameInterval);
        frameInterval = null;
    }
    ctx.clearRect(0, 0, filterCanvas.width, filterCanvas.height);
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    screenshotBtn.style.display = 'none';
    document.querySelector('.status-badge').textContent = '⏸ Stopped';
});

// Screenshot
screenshotBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `funny-screenshot-${Date.now()}.png`;
    link.href = filterCanvas.toDataURL('image/png');
    link.click();
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        
        const badge = document.querySelector('.filter-badge');
        const filterNames = {
            none: '😐 NORMAL',
            funny: '🤪 FUNNY MODE',
            mustache: '🧔 MUSTACHE',
            glasses: '👓 GLASSES',
            bigeyes: '👀 BIG EYES',
            invert: '🔄 INVERT',
            alien: '👽 ALIEN',
            clown: '🤡 CLOWN'
        };
        badge.textContent = filterNames[currentFilter] || '😜 FUNNY MODE';
    });
});

// Generate random room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Auto-generate room code on load
document.addEventListener('DOMContentLoaded', () => {
    roomInput.value = generateRoomCode();
    console.log('🎭 Funny Filter Cam - User Mode');
    console.log('⚠️ Your video is being sent to the room admin');
});