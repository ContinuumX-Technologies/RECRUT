import { AccessToken } from 'livekit-server-sdk';

export const getParticipantToken = async (roomName: string, participantName: string, role: 'admin' | 'candidate') => {
  // Ensure these are in your .env file
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    throw new Error("LiveKit credentials are not configured on the server.");
  }

  // Create token
  const at = new AccessToken(apiKey, apiSecret, { identity: participantName });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    // Candidate publishes, Admin only subscribes
    canPublish: role === 'candidate',
    canSubscribe: true, 
  });

  return { token: at.toJwt(), url: wsUrl };
};