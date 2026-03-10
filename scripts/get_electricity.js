const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const records = await prisma.electricityUsage.findMany({
        orderBy: [
            { year: 'asc' },
            { month: 'asc' }
        ]
    });
    console.log(JSON.stringify(records, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
