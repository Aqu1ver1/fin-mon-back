import { Router } from 'express';
import { register, login, update } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.put('/update', update);

export default router;