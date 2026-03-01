import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().min(2).max(255).optional().or(z.literal("").transform(() => undefined)),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const logInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export type LogInInput = z.infer<typeof logInSchema>;

export const updateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).max(128).optional(),
  name: z.string().min(2).max(255).optional().or(z.literal("").transform(() => undefined)),
});

export type UpdateInput = z.infer<typeof updateSchema>;
