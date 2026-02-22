import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS, // Changed from password to pass
    },
} as any); // Use 'as any' as a quick fix for type mismatch if definitions are strict


export async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text?: string; html?: string }) {
    if (!SMTP_USER || !SMTP_PASS) {
        console.warn('SMTP credentials not set. Skipping email.');
        return;
    }

    try {
        const info = await transporter.sendMail({
            from: `"Beiko" <${SMTP_USER}>`,
            to,
            subject,
            text,
            html,
        });
        console.log('Email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Failed to send email:', error);
        throw error;
    }
}
