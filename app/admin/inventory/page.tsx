"use client";

import { useState, useEffect } from "react";
import { Package, RefreshCw, AlertCircle, ShoppingCart, ArrowUpDown } from "lucide-react";

interface InventoryItem {
    vendorId: string;
    vendorItemId: string;
    externalSkuId: string;
    productName?: string;
    imageUrl?: string | null;
    inventoryDetails: {
        totalOrderableQuantity: number;
    };
    salesCountMap: {
        SALES_COUNT_LAST_THIRTY_DAYS?: number;
    };
}

export default function InventoryPage() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const fetchInventory = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/coupang/inventory");
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "리스트를 불러오는 데 실패했습니다.");
            }
            const data = await res.json();

            // Set last sync time if provided
            if (data?.lastSyncedAt) {
                const date = new Date(data.lastSyncedAt);
                const syncTimeStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')} 기준`;
                setLastSyncTime(syncTimeStr);
                sessionStorage.setItem("coupang_lastSyncTime", syncTimeStr);
            }

            // Checking if Coupang gave valid structured data
            if (data?.data && Array.isArray(data.data)) {
                setInventory(data.data);
                sessionStorage.setItem("coupang_inventory", JSON.stringify(data.data));
            } else if (data?.code === "ERROR") {
                throw new Error(data.message || "쿠팡 API 오류가 발생했습니다.");
            } else {
                setInventory([]);
                sessionStorage.removeItem("coupang_inventory");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Restore from sessionStorage if exists
        const cachedInventory = sessionStorage.getItem("coupang_inventory");
        const cachedSyncTime = sessionStorage.getItem("coupang_lastSyncTime");

        if (cachedInventory) {
            try {
                setInventory(JSON.parse(cachedInventory));
            } catch (e) {
                console.error("Failed to parse cached inventory");
            }
        }
        if (cachedSyncTime) {
            setLastSyncTime(cachedSyncTime);
        }

        setLoading(false); // Stop the initial loading spinner
    }, []);

    const syncWithDB = async () => {
        if (inventory.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            const externalSkus = inventory.map(item => item.externalSkuId).filter(Boolean);
            const res = await fetch("/api/coupang/match-db", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ externalSkus })
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "DB 동기화에 실패했습니다.");
            }
            const data = await res.json();
            const mapping = data.mapping || {};

            const updatedInventory = inventory.map(item => {
                const match = mapping[item.externalSkuId];
                if (match) {
                    return { ...item, productName: match.name, imageUrl: match.imageUrl };
                }
                return item;
            });

            setInventory(updatedInventory);
            sessionStorage.setItem("coupang_inventory", JSON.stringify(updatedInventory));
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const sortedInventory = [...inventory].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue: any;
        let bValue: any;

        if (key === "externalSkuId") {
            aValue = a.externalSkuId || "";
            bValue = b.externalSkuId || "";
        } else if (key === "productName") {
            aValue = a.productName || "";
            bValue = b.productName || "";
        } else if (key === "vendorItemId") {
            aValue = a.vendorItemId || "";
            bValue = b.vendorItemId || "";
        } else if (key === "stock") {
            aValue = a.inventoryDetails?.totalOrderableQuantity || 0;
            bValue = b.inventoryDetails?.totalOrderableQuantity || 0;
        } else if (key === "sales") {
            aValue = a.salesCountMap?.SALES_COUNT_LAST_THIRTY_DAYS || 0;
            bValue = b.salesCountMap?.SALES_COUNT_LAST_THIRTY_DAYS || 0;
        }

        if (aValue < bValue) return direction === "asc" ? -1 : 1;
        if (aValue > bValue) return direction === "asc" ? 1 : -1;
        return 0;
    });

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const renderSortHeader = (title: string, key: string, alignRight = false) => (
        <th
            className={`px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${alignRight ? 'text-right' : 'text-left'}`}
            onClick={() => requestSort(key)}
        >
            <div className={`flex items-center gap-1.5 ${alignRight ? 'justify-end' : ''}`}>
                {title}
                <ArrowUpDown className={`w-3.5 h-3.5 ${sortConfig?.key === key ? 'opacity-100 text-[#e34219]' : 'opacity-30'}`} />
            </div>
        </th>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 mt-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <Package className="w-7 h-7 text-[#e34219]" />
                        로켓창고 재고관리
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 font-medium">
                        쿠팡 로켓창고에 등록된 상품의 재고와 판매량을 관리합니다.
                        {lastSyncTime && <span className="ml-2 font-bold text-[#e34219]">({lastSyncTime})</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={syncWithDB}
                        disabled={loading || inventory.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm font-bold text-gray-700 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        나의 DB 연동 새로고침
                    </button>
                    <button
                        onClick={fetchInventory}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-[#e34219] text-white text-sm font-bold rounded-xl hover:bg-[#c93a15] transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        쿠팡서버 새로고침
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-bold text-red-800">재고 정보를 불러오지 못했습니다</h3>
                        <p className="text-xs text-red-600 mt-1">{error}</p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 select-none">
                                {renderSortHeader("SKU ID", "externalSkuId")}
                                {renderSortHeader("옵션 ID", "vendorItemId")}
                                {renderSortHeader("상품명", "productName")}
                                {renderSortHeader("주문가능 재고", "stock", true)}
                                {renderSortHeader("최근 30일 판매량", "sales", true)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading && inventory.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-sm font-medium text-gray-400">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <RefreshCw className="w-6 h-6 animate-spin text-gray-300" />
                                            재고 정보를 불러오는 중입니다...
                                        </div>
                                    </td>
                                </tr>
                            ) : inventory.length === 0 && !error ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-sm font-medium text-gray-400">
                                        등록된 재고 데이터가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                sortedInventory.map((item, idx) => (
                                    <tr key={`${item.vendorItemId}-${idx}`} className="even:bg-gray-50/50 hover:bg-gray-50/80 transition-colors">
                                        <td className="px-6 py-2">
                                            <div className="text-xs text-gray-700">{item.externalSkuId || "-"}</div>
                                        </td>
                                        <td className="px-6 py-2">
                                            <div className="text-xs text-gray-500">{item.vendorItemId}</div>
                                        </td>
                                        <td className="px-6 py-2">
                                            <div className="flex items-center gap-3">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.productName} className="w-10 h-10 object-cover rounded-md flex-shrink-0 border border-gray-100 bg-white" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-50 rounded-md border border-gray-100 flex-shrink-0 flex items-center justify-center">
                                                        <Package className="w-4 h-4 text-gray-300" />
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-700 min-w-[300px] whitespace-normal leading-relaxed" title={item.productName}>{item.productName || "알 수 없는 상품"}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2 text-right">
                                            <div className="inline-flex items-center justify-end gap-1.5 min-w-[3rem]">
                                                <span className={`text-xs ${item.inventoryDetails.totalOrderableQuantity > 10 ? 'text-gray-700' : 'text-red-500'}`}>
                                                    {item.inventoryDetails.totalOrderableQuantity.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-gray-400">개</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2 text-right">
                                            <div className="inline-flex items-center justify-end gap-1.5 text-blue-600 min-w-[3rem]">
                                                <ShoppingCart className="w-3.5 h-3.5" />
                                                <span className="text-xs">
                                                    {(item.salesCountMap?.SALES_COUNT_LAST_THIRTY_DAYS || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
