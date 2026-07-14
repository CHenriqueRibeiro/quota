import { z } from 'zod';
import { Role } from '@prisma/client'; 

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(3),
  role: z.enum(Role) 
});