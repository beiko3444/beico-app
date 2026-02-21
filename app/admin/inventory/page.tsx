"use client";

import { useState, useEffect } from "react";
import { Package, RefreshCw, AlertCircle, ShoppingCart } from "lucide-react";

interface InventoryItem {
    vendorId: string;
    vendorItemId: string;
    externalSkuId: string;
    productName?: string;
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
                setLastSyncTime(`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')} 기준`);
            }

            // Checking if Coupang gave valid structured data
            if (data?.data && Array.isArray(data.data)) {
                setInventory(data.data);
            } else if (data?.code === "ERROR") {
                throw new Error(data.message || "쿠팡 API 오류가 발생했습니다.");
            } else {
                setInventory([]);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // fetchInventory(); // Removed so user must manually click refresh
        setLoading(false); // Stop the initial loading spinner
    }, []);

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
                <button
                    onClick={fetchInventory}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    새로고침
                </button>
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
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">외부 SKU ID (바코드)</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">상품명</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">옵션 ID</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">주문가능 재고</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">최근 30일 판매량</th>
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
                                inventory.map((item, idx) => (
                                    <tr key={`${item.vendorItemId}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900">{item.externalSkuId || "-"}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-700 max-w-[200px] truncate" title={item.productName}>{item.productName || "알 수 없는 상품"}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-medium text-gray-500">{item.vendorItemId}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex items-center justify-end gap-1.5 min-w-[3rem]">
                                                <span className={`text-sm font-black ${item.inventoryDetails.totalOrderableQuantity > 10 ? 'text-gray-900' : 'text-red-500'}`}>
                                                    {item.inventoryDetails.totalOrderableQuantity.toLocaleString()}
                                                </span>
                                                <span className="text-xs font-medium text-gray-400">개</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex items-center justify-end gap-1.5 text-blue-600 min-w-[3rem]">
                                                <ShoppingCart className="w-3.5 h-3.5" />
                                                <span className="text-sm font-bold">
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
