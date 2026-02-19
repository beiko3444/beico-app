const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
    const password = await bcrypt.hash('1234', 10)

    try {
        const user = await prisma.user.upsert({
            where: { username: 'tester' },
            update: {},
            create: {
                username: 'tester',
                password: password,
                name: 'Tester Account',
                role: 'PARTNER',
                status: 'APPROVED',
                country: 'KR'
            }
        })
        console.log('User created:', user)
    } catch (e) {
        console.error(e)
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
