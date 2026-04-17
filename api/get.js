import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = req.cookies?.build_token;
    if (!token) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    const email = await kv.get(`token:${token}`);
    if (!email) {
        return res.status(401).json({ error: 'Неверный токен' });
    }

    const user = await kv.get(`users:${email}`);
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    return res.status(200).json({
        email: user.email,
        createdAt: user.createdAt
    });
}