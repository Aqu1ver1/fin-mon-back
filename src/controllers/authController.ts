import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Проверка существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание пользователя
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        password: hashedPassword,
      }
    });

    // Генерация JWT токена
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Найти пользователя
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Генерация токена
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || '',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const { email, password, name, userId } = req.body;

    // Если userId не передан, возвращаем ошибку
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Находим текущего пользователя
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Подготавливаем данные для обновления
    const updateData: any = {};

    // Проверяем email, если изменился
    if (email && email !== currentUser.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email }
      });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
      updateData.email = email;
    }

    // Обновляем name если он изменился
    if (name !== undefined && name !== currentUser.name) {
      updateData.name = name || null;
    }

    // Обновляем пароль если он был передан
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Если нечего обновлять, возвращаем текущего пользователя
    if (Object.keys(updateData).length === 0) {
      const token = jwt.sign(
        { userId: currentUser.id, email: currentUser.email },
        process.env.JWT_SECRET as string,
        { expiresIn: '1h' }
      );

      return res.status(200).json({
        message: 'No changes to update',
        token,
        user: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name
        }
      });
    }

    // Обновляем пользователя
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: updateData
    });

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'User updated successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};