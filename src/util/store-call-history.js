// Utility function to store call history
export const storeCallHistory = async (callData) => {
    try {
        const response = await fetch('/api/store-call-history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(callData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Call history stored successfully:', result.data);
            return result.data;
        } else {
            console.error('Failed to store call history:', result.message);
            return null;
        }
    } catch (error) {
        console.error('Error storing call history:', error);
        return null;
    }
};

// Format call duration from seconds to MM:SS format
export const formatCallDuration = (seconds) => {
    if (seconds == null || isNaN(seconds)) return '0:00';
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Get call status text based on status and direction
export const getCallStatusText = (status, direction, callType) => {
    const callTypeText = callType === 'voice' ? 'Voice' : 'Video';
    
    switch (status) {
        case 'missed':
            return direction === 'incoming' ? `Missed ${callTypeText} call` : `${callTypeText} call missed`;
        case 'declined':
            return direction === 'incoming' ? `Declined ${callTypeText} call` : `${callTypeText} call declined`;
        case 'answered':
        case 'ended':
            return `${callTypeText} call`;
        default:
            return `${callTypeText} call`;
    }
};
