import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, email, password, password2 } = req.body;

    // РЕГИСТРАЦИЯ
    if (action === 'register') {
        if (!email || !password || !password2) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }
        if (password !== password2) {
            return res.status(400).json({ error: 'Пароли не совпадают' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
        }

        const existing = await kv.get(`user:${email}`);
        if (existing) {
            return res.status(400).json({ error: 'Email уже зарегистрирован' });
        }

        const hash = await bcrypt.hash(password, 10);
        const user = {
            email,
            password_hash: hash,
            createdAt: new Date().toISOString()
        };
        await kv.set(`user:${email}`, user);

        // Автоматический вход
        const token = generateToken();
        await kv.set(`token:${token}`, email);
        res.setHeader('Set-Cookie', `build_token=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`);
        
        return res.status(200).json({ ok: true, redirect: '/dashboard.html' });
    }

    // ЛОГИН
    if (action === 'login') {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        const user = await kv.get(`user:${email}`);
        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const token = generateToken();
        await kv.set(`token:${token}`, email);
        res.setHeader('Set-Cookie', `build_token=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`);
        
        return res.status(200).json({ ok: true, redirect: '/dashboard.html' });
    }

    // ПОЛУЧЕНИЕ ПРОФИЛЯ
    if (action === 'get-profile') {
        const token = req.cookies?.build_token;
        if (!token) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        const email = await kv.get(`token:${token}`);
        if (!email) {
            return res.status(401).json({ error: 'Неверный токен' });
        }
        const user = await kv.get(`user:${email}`);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        return res.status(200).json({ email: user.email, createdAt: user.createdAt });
    }

    return res.status(400).json({ error: 'Неизвестное действие' });
}
