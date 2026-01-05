import { Router } from 'express';
import { getParticipantToken } from '../services/livekit.service';
import { authMiddleware } from '../lib/auth';

const router = Router();

router.post('/livekit/token', authMiddleware, async (req: any, res) => {
  try {
    const { room, username, role } = req.body;
    
    // Security check: Only allow 'candidate' role if the user matches the candidate logic (simplified here)
    // In production, verify req.user.id matches the interview candidate
    
    const data = await getParticipantToken(room, username || req.user.name, role);
    res.json(data);
  } catch (error: any) {
    console.error("LiveKit Token Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;