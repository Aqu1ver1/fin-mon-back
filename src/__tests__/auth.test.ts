import request from 'supertest';
import app from '../app';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TEST_USER = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
};

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { contains: 'test' } },
  });
});

describe('POST /auth/register', () => {
  it('should create a user and return token + user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send(TEST_USER);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: TEST_USER.email,
      name: TEST_USER.name,
    });
    expect(res.body.user.id).toBeDefined();
    expect(res.body.token).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it('should return 409 for duplicate email', async () => {
    await request(app).post('/auth/register').send(TEST_USER);

    const res = await request(app)
      .post('/auth/register')
      .send(TEST_USER);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });

  it('should return 400 for missing email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
    expect(res.body.issues).toBeDefined();
  });

  it('should return 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('should return 400 for short password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('should return 400 for short name', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'A' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('should allow registration without a name', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user.name).toBeNull();
  });

  it('should hash the password in the database', async () => {
    await request(app).post('/auth/register').send(TEST_USER);

    const dbUser = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
    });

    expect(dbUser).toBeDefined();
    expect(dbUser!.password).not.toBe(TEST_USER.password);
    const isValid = await bcrypt.compare(TEST_USER.password, dbUser!.password);
    expect(isValid).toBe(true);
  });

  it('should set a session cookie', async () => {
    const res = await request(app).post('/auth/register').send(TEST_USER);

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const sessionCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.includes('finmon_session'))
      : cookies?.includes('finmon_session') ? cookies : undefined;
    expect(sessionCookie).toBeDefined();
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send(TEST_USER);
  });

  it('should login and return token + user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it('should return 401 for wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('should return 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('should return 400 for missing password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('should return 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'bad-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('should set a session cookie', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });
});

describe('GET /auth/me', () => {
  let token: string;

  beforeEach(async () => {
    const res = await request(app).post('/auth/register').send(TEST_USER);
    token = res.body.token;
  });

  it('should return user for valid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.user.name).toBe(TEST_USER.name);
    expect(res.body.user.password).toBeUndefined();
  });

  it('should return 401 for missing token', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No token provided');
  });

  it('should return 401 for invalid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid token');
  });

  it('should return 401 for expired token', async () => {
    const expiredToken = jwt.sign(
      { userId: 999 },
      process.env.JWT_SECRET!,
      { expiresIn: '0s' }
    );

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });
});

describe('PUT /auth/update', () => {
  let token: string;

  beforeEach(async () => {
    const res = await request(app).post('/auth/register').send(TEST_USER);
    token = res.body.token;
  });

  it('should update name', async () => {
    const res = await request(app)
      .put('/auth/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated Name');
    expect(res.body.token).toBeDefined();
  });

  it('should update email', async () => {
    const res = await request(app)
      .put('/auth/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'newemail-test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('newemail-test@example.com');
  });

  it('should update password', async () => {
    const res = await request(app)
      .put('/auth/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'newpassword123' });

    expect(res.status).toBe(200);

    // Verify new password works for login
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: 'newpassword123' });

    expect(loginRes.status).toBe(200);
  });

  it('should return 409 for email already in use', async () => {
    // Register a second user
    await request(app).post('/auth/register').send({
      email: 'other-test@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .put('/auth/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'other-test@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });

  it('should return 401 without auth', async () => {
    const res = await request(app)
      .put('/auth/update')
      .send({ name: 'New Name' });

    expect(res.status).toBe(401);
  });

  it('should return 400 for no fields to update', async () => {
    const res = await request(app)
      .put('/auth/update')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid email format', async () => {
    const res = await request(app)
      .put('/auth/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'bad-email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });
});

describe('POST /auth/logout', () => {
  it('should clear session cookie and return 204', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(204);
    const cookies = res.headers['set-cookie'];
    if (cookies) {
      const sessionCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.includes('finmon_session'))
        : cookies;
      if (sessionCookie) {
        expect(sessionCookie).toMatch(/finmon_session=;/);
      }
    }
  });
});
