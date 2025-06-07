import { auth } from '@/auth'
import { google } from 'googleapis';

export const oauth2Client = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_ID,
    clientSecret: process.env.GOOGLE_SECRET,
    redirectUri: process.env.NEXT_PUBLIC_BASE_URL + "/api/auth/callback/google" || "http://localhost:3000/api/auth/callback/google", // Ajuste conforme necessário
});

export const sheetsClient = google.sheets({ version: 'v4', auth: oauth2Client });
export const driveClient = google.drive({ version: 'v3', auth: oauth2Client });
export const gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });

export const updateToken = async () => {
    const session = await auth();
    oauth2Client.setCredentials({ access_token: session?.access_token });
}