const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    try {
        const users = await prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' }
        })
        console.log('Recent users:', JSON.stringify(users, null, 2))
    } catch (err) {
        console.error('Database query failed:', err)
    } finally {
        await prisma.$disconnect()
    }
}

main()
