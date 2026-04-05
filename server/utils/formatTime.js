const formatTime = (time = new Date()) => {
    return time.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

module.exports = formatTime;