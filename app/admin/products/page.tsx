import { prisma } from "@/lib/prisma"
import { getProductImageUrl } from "@/lib/product-image-url"
import { Prisma } from "@prisma/client"
import ProductTable from "./ProductTable"

// Force dynamic to ensure we get fresh data
export const dynamic = 'force-dynamic'

const productSelect = Prisma.validator<Prisma.ProductSelect>()({
    id: true,
    productNumber: true,
    name: true,
    nameJP: true,
    nameEN: true,
    buyPrice: true,
    sellPrice: true,
    onlinePrice: true,
    priceA: true,
    priceB: true,
    priceC: true,
    priceD: true,
    stock: true,
    safetyStock: true,
    barcode: true,
    productCode: true,
    groupName: true,
    autoGroupingDisabled: true,
    hsCode: true,
    japanHsCode: true,
    coupangSku: true,
    imageUrl: true,
    sortOrder: true,
    minOrderQuantity: true,
    orderUnit: true,
    jpBuyPrice: true,
    jpSellPrice: true,
    krBuyPrice: true,
    krSellPrice: true,
    usBuyPrice: true,
    usSellPrice: true,
    regionalPrices: true,
    wholesaleAvailable: true,
    createdAt: true,
    updatedAt: true,
})

const getProducts = async () => {
    return prisma.product.findMany({
        select: productSelect,
        orderBy: [
            { sortOrder: 'asc' },
            { createdAt: 'asc' },
        ],
    })
}

export default async function ProductsPage() {
    const productRows = await getProducts()
    const products = productRows.map(({ imageUrl, updatedAt, ...product }) => ({
        ...product,
        imageUrl: imageUrl ? getProductImageUrl(product.id, updatedAt) : null,
    }))

    return <ProductTable initialProducts={products} />
}
