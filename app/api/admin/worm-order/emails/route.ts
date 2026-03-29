import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

export const dynamic = 'force-dynamic'

export async function GET() {
    const user = process.env.DAUM_IMAP_USER
    const pass = process.env.DAUM_IMAP_PASS

    if (!user || !pass) {
        return NextResponse.json(
            { error: 'Vercel 환경변수 (DAUM_IMAP_USER, DAUM_IMAP_PASS) 가 설정되지 않았습니다.' },
            { status: 500 }
        )
    }

    const client = new ImapFlow({
        host: 'imap.daum.net',
        port: 993,
        secure: true,
        auth: { user, pass },
        logger: false,
    })

    try {
        await client.connect()
        
        const lock = await client.getMailboxLock('INBOX')
        try {
            const status = await client.status('INBOX', { messages: true })
            const total = typeof status.messages === 'number' ? status.messages : 0
            
            if (total === 0) {
                return NextResponse.json({ emails: [] })
            }

            // 최근 30개의 메일 시퀀스 범위 지정
            const startSeq = Math.max(1, total - 30)
            const seqRange = `${startSeq}:*`

            const emails = []

            // 순차적으로 메일을 가져오면서 Node.js 레벨에서 필터링 (Daum IMAP Search 오류 우회)
            for await (const message of client.fetch(seqRange, { source: true })) {
                if (message && message.source) {
                    const parsed = await simpleParser(message.source)
                    const body = (parsed.html || parsed.textAsHtml || parsed.text || '').toLowerCase()
                    
                    if (body.includes('michael@oikki.com')) {
                        let extractedAWB = null;

                        // 첨부파일 중 파일명이 SKM으로 시작하는 PDF에서 운송장 번호 추출 시도
                        if (parsed.attachments && parsed.attachments.length > 0) {
                            for (const att of parsed.attachments) {
                                const filename = att.filename || '';
                                if (att.contentType === 'application/pdf' && att.content && filename.toUpperCase().includes('SKM')) {
                                    try {
                                        if (typeof global !== 'undefined') {
                                            if (!global.DOMMatrix) (global as any).DOMMatrix = class DOMMatrix {};
                                            if (!global.Path2D) (global as any).Path2D = class Path2D {};
                                        }
                                        const pdfParse = require('pdf-parse');
                                        const data = await pdfParse(att.content);
                                        const text = data.text;
                                        const textClean = text.replace(/\n/g, ' ');
                                        const match = textClean.match(/(?:^|[^0-9])([0-9](?:[\s-]*[0-9]){10})(?![0-9])/);
                                        if (match && match[1]) {
                                            extractedAWB = match[1].replace(/[\s-]/g, '');
                                            break;
                                        } else {
                                            // 11자리 숫자가 정규식에 안 걸리는 경우 단순 검색 대체재
                                            const simpleMatch = textClean.match(/\d{11}/);
                                            if (simpleMatch) {
                                                extractedAWB = simpleMatch[0];
                                                break;
                                            }

                                            // 실패 원인 디버그 텍스트 반환
                                            if (text.trim().length < 30) {
                                                extractedAWB = "오류: 이미지 전용 PDF (텍스트 없음)";
                                            } else {
                                                const awbIndex = textClean.toUpperCase().indexOf('WAYBILL');
                                                if (awbIndex !== -1) {
                                                    extractedAWB = "실패: " + textClean.substring(awbIndex, awbIndex + 30).trim();
                                                } else {
                                                    extractedAWB = "오류: 11자리 숫자 패턴 없음";
                                                }
                                            }
                                        }
                                    } catch (err) {
                                        console.error('PDF Parse Error:', err);
                                    }
                                }
                            }
                        }

                        emails.push({
                            uid: message.uid,
                            subject: parsed.subject || '(제목 없음)',
                            date: parsed.date,
                            text: parsed.html || parsed.textAsHtml || parsed.text || '',
                            hasAttachments: parsed.attachments && parsed.attachments.length > 0,
                            extractedAWB,
                            attachments: (parsed.attachments || []).map((att: any, idx: number) => ({
                                filename: att.filename || `attachment-${idx}`,
                                contentType: att.contentType,
                                size: att.size || 0,
                                index: idx
                            }))
                        })
                    }
                }
            }

            // 최신 날짜 순으로 정렬 후 상위 10개만 리턴
            emails.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            const recentEmails = emails.slice(0, 10)

            return NextResponse.json({ emails: recentEmails })
        } finally {
            lock.release()
        }
    } catch (error: any) {
        console.error('Daum IMAP 연동 에러:', error)
        return NextResponse.json({ error: error.message || '이메일 로딩 실패' }, { status: 500 })
    } finally {
        await client.logout()
    }
}
