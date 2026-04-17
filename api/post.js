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

    const { action, email, password, password2, reason } = req.body;

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

        const existing = await kv.get(`users:${email}`);
        if (existing) {
            return res.status(400).json({ error: 'Email уже зарегистрирован' });
        }

        const pending = await kv.get(`reg:${email}`);
        if (pending) {
            return res.status(400).json({ error: 'Заявка уже отправлена' });
        }

        const hash = await bcrypt.hash(password, 10);
        const entry = {
            email,
            password_hash: hash,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        await kv.set(`reg:${email}`, entry);

        const list = (await kv.get('reg:list')) || [];
        if (!list.includes(email)) {
            list.push(email);
            await kv.set('reg:list', list);
        }

        return res.status(200).json({ ok: true, message: 'Заявка отправлена. Ожидайте подтверждения.' });
    }

    // ЛОГИН
    if (action === 'login') {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        let user = await kv.get(`users:${email}`);
        if (user) {
            const valid = await bcrypt.compare(password, user.password_hash);
            if (valid) {
                const token = generateToken();
                await kv.set(`token:${token}`, email);
                res.setHeader('Set-Cookie', `build_token=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`);
                return res.status(200).json({ ok: true, redirect: '/dashboard.html' });
            }
        }

        const pending = await kv.get(`reg:${email}`);
        if (pending && pending.status === 'pending') {
            return res.status(403).json({ error: 'Заявка на рассмотрении' });
        }
        if (pending && pending.status === 'rejected') {
            return res.status(403).json({ error: `Заявка отклонена: ${pending.reason || 'не указана'}` });
        }

        return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // ПРОВЕРКА СТАТУСА ЗАЯВКИ
    if (action === 'check-status') {
        if (!email) {
            return res.status(400).json({ error: 'Email обязателен' });
        }
        const entry = await kv.get(`reg:${email}`);
        if (!entry) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }
        return res.status(200).json({
            status: entry.status,
            reason: entry.reason || null,
            createdAt: entry.createdAt
        });
    }

    // АДМИНКА: получить все заявки
    if (action === 'admin-get-requests') {
        const pwd = req.headers['x-admin-password'];
        if (!pwd || pwd !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Неверный пароль' });
        }
        const list = (await kv.get('reg:list')) || [];
        const requests = [];
        for (const email of list) {
            const entry = await kv.get(`reg:${email}`);
            if (entry) {
                requests.push({
                    email: entry.email,
                    status: entry.status,
                    reason: entry.reason || null,
                    createdAt: entry.createdAt
                });
            }
        }
        return res.status(200).json({ requests });
    }

    // АДМИНКА: одобрить
    if (action === 'admin-approve') {
        const pwd = req.headers['x-admin-password'];
        if (!pwd || pwd !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Неверный пароль' });
        }
        const { email } = req.body;
        const entry = await kv.get(`reg:${email}`);
        if (!entry) return res.status(404).json({ error: 'Заявка не найдена' });
        if (entry.status !== 'pending') return res.status(400).json({ error: 'Уже обработана' });

        const user = {
            email: entry.email,
            password_hash: entry.password_hash,
            createdAt: entry.createdAt
        };
        await kv.set(`users:${email}`, user);
        entry.status = 'approved';
        await kv.set(`reg:${email}`, entry);

        return res.status(200).json({ ok: true });
    }

    // АДМИНКА: отклонить
    if (action === 'admin-reject') {
        const pwd = req.headers['x-admin-password'];
        if (!pwd || pwd !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Неверный пароль' });
        }
        const { email, reason } = req.body;
        const entry = await kv.get(`reg:${email}`);
        if (!entry) return res.status(404).json({ error: 'Заявка не найдена' });
        if (entry.status !== 'pending') return res.status(400).json({ error: 'Уже обработана' });

        entry.status = 'rejected';
        entry.reason = reason || 'Не указана';
        await kv.set(`reg:${email}`, entry);

        return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Неизвестное действие' });
}