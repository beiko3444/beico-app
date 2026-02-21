const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({ select: { id: true, name: true, nameEN: true, barcode: true, productCode: true } });
    console.log("sample products: ", products.slice(0, 5));
}
main().catch(console.error).finally(() => prisma.$disconnect());
