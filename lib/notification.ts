import nodemailer from 'nodemailer';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || '';
const KAKAO_REFRESH_TOKEN = process.env.KAKAO_REFRESH_TOKEN || '';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

let cachedAccessToken = '';

/**
 * Refreshes the Kakao Access Token using the stored Refresh Token.
 * Note: In a production environment, you should store the updated refresh token 
 * back to your database if it changes.
 */
async function refreshAccessToken() {
    if (!KAKAO_REST_API_KEY || !KAKAO_REFRESH_TOKEN) {
        throw new Error('Kakao credentials not set');
    }

    try {
        const response = await fetch('https://kauth.kakao.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: KAKAO_REST_API_KEY,
                refresh_token: KAKAO_REFRESH_TOKEN,
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Kakao Token Refresh Error: ${JSON.stringify(data)}`);
        }

        cachedAccessToken = data.access_token;
        // console.log('Kakao access token refreshed');
        return data.access_token;
    } catch (error) {
        console.error('Failed to refresh Kakao token:', error);
        throw error;
    }
}

interface OrderNotificationData {
    orderNumber: string;
    total: number;
    itemsCount: number;
    customerName: string;
}

export async function sendOrderNotification(data: OrderNotificationData) {
    if (!KAKAO_REST_API_KEY || !KAKAO_REFRESH_TOKEN) {
        console.warn('Kakao credentials not set. Skipping notification.');
        return;
    }

    const message = `[새 주문 알림]\n\n신규 주문이 접수되었습니다.\n\n- 주문번호: ${data.orderNumber}\n- 고객명: ${data.customerName}\n- 상품수: ${data.itemsCount}개\n- 총금액: ${data.total.toLocaleString()}원`;

    async function attemptSend(token: string) {
        const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                template_object: JSON.stringify({
                    object_type: 'text',
                    text: message,
                    link: {
                        web_url: 'http://localhost:3000/admin/orders', // Update with your actual production URL
                        mobile_web_url: 'http://localhost:3000/admin/orders'
                    },
                    button_title: '주문 확인하기'
                })
            })
        });

        return response;
    }

    try {
        // 1. Try with cached token first
        let response = await attemptSend(cachedAccessToken);

        // 2. If unauthorized (expired), refresh and retry
        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            response = await attemptSend(newToken);
        }

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Kakao Message Error: ${JSON.stringify(result)}`);
        }

        // console.log('Kakao order notification sent successfully');
        // result holds kakao response, we can just log or ignore
    } catch (error) {
        console.error('Failed to send Kakao order notification:', error);
    }

    // Send Email Notification
    try {
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            await transporter.sendMail({
                from: `"Beiko Admin" <${process.env.SMTP_USER}>`,
                to: 'contact@beiko.co.kr',
                subject: `[신규 주문 알림] ${data.customerName}님의 새로운 주문 (${data.orderNumber})`,
                html: `
                    <h2>새로운 주문이 접수되었습니다.</h2>
                    <hr />
                    <ul>
                        <li><strong>주문번호:</strong> ${data.orderNumber}</li>
                        <li><strong>고객(사)명:</strong> ${data.customerName}</li>
                        <li><strong>총 상품 수:</strong> ${data.itemsCount}개</li>
                        <li><strong>총 주문 금액:</strong> ${data.total.toLocaleString()}원</li>
                    </ul>
                    <br />
                    <p>관리자 페이지에서 주문 목록을 확인해주세요.</p>
                `
            });
            // console.log('Email order notification sent successfully');
        } else {
            console.warn('SMTP credentials not configured. Email notification skipped.');
        }
    } catch (emailError) {
        console.error('Failed to send order notification email:', emailError);
    }
}
