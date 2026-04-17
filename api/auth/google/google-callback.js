import { kv } from '@vercel/kv';
import crypto from 'crypto';

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

export default async function handler(req, res) {
    const { code } = req.query;
    if (!code) return res.redirect('/login.html?error=no_code');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = 'https://buildvpn.vercel.app/api/auth/google/callback';

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret,
            redirect_uri: redirectUri, grant_type: 'authorization_code'
        })
    });
    const tokenData = await tokenRes.json();
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    const email = userData.email;

    if (!email) return res.redirect('/login.html?error=no_email');

    let user = await kv.get(`user:${email}`);
    if (!user) {
        user = { email, name: userData.name, createdAt: new Date().toISOString() };
        await kv.set(`user:${email}`, user);
    }

    const token = generateToken();
    await kv.set(`token:${token}`, email);
    res.setHeader('Set-Cookie', `build_token=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`);
    res.redirect('/dashboard.html');
}
