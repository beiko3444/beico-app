"use client";

import { useState, useEffect } from "react";
import { Package, RefreshCw, AlertCircle, ShoppingCart, ArrowUpDown, Store } from "lucide-react";

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

interface SmartstoreInventoryItem {
    channelProductNo: number | null;
    sellerManagementCode: string;
    productName: string;
    dbProductName: string | null;
    dbProductCode: string | null;
    imageUrl?: string | null;
    stockQuantity: number;
    statusType?: string;
}

type SortDirection = "asc" | "desc";
type SortConfig = { key: string; direction: SortDirection } | null;

const formatSyncTime = (isoDateString: string) => {
    const date = new Date(isoDateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")} 기준`;
};

const toErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};

export default function InventoryPage() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const [smartstoreInventory, setSmartstoreInventory] = useState<SmartstoreInventoryItem[]>([]);
    const [smartstoreLastSyncTime, setSmartstoreLastSyncTime] = useState<string | null>(null);
    const [smartstoreLoading, setSmartstoreLoading] = useState(false);
    const [smartstoreError, setSmartstoreError] = useState<string | null>(null);
    const [smartstoreSortConfig, setSmartstoreSortConfig] = useState<SortConfig>(null);

    const fetchInventory = async (options?: { force?: boolean }) => {
        setLoading(true);
        setError(null);
        try {
            const force = options?.force === true;
            const res = await fetch(force ? "/api/coupang/inventory?force=1" : "/api/coupang/inventory");
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "리스트를 불러오는 데 실패했습니다.");
            }
            const data = await res.json();

            if (data?.lastSyncedAt) {
                const syncTimeStr = formatSyncTime(data.lastSyncedAt);
                setLastSyncTime(syncTimeStr);
                sessionStorage.setItem("coupang_lastSyncTime", syncTimeStr);
            }

            if (data?.data && Array.isArray(data.data)) {
                setInventory(data.data);
                sessionStorage.setItem("coupang_inventory", JSON.stringify(data.data));
            } else if (data?.code === "ERROR") {
                throw new Error(data.message || "쿠팡 API 오류가 발생했습니다.");
            } else {
                setInventory([]);
                sessionStorage.removeItem("coupang_inventory");
            }
        } catch (err: unknown) {
            console.error(err);
            setError(toErrorMessage(err, "리스트를 불러오는 중 오류가 발생했습니다."));
        } finally {
            setLoading(false);
        }
    };

    const fetchSmartstoreInventory = async (options?: { force?: boolean }) => {
        setSmartstoreLoading(true);
        setSmartstoreError(null);
        try {
            const force = options?.force === true;
            const res = await fetch(force ? "/api/naver/inventory?force=1" : "/api/naver/inventory");
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "스마트스토어 재고를 불러오는 데 실패했습니다.");
            }

            const data = await res.json();
            const nextInventory = Array.isArray(data?.data) ? data.data : [];
            setSmartstoreInventory(nextInventory);
            sessionStorage.setItem("smartstore_inventory", JSON.stringify(nextInventory));

            if (data?.fetchedAt) {
                const syncTimeStr = formatSyncTime(data.fetchedAt);
                setSmartstoreLastSyncTime(syncTimeStr);
                sessionStorage.setItem("smartstore_lastSyncTime", syncTimeStr);
            }
        } catch (err: unknown) {
            console.error(err);
            setSmartstoreError(toErrorMessage(err, "스마트스토어 재고를 불러오는 중 오류가 발생했습니다."));
        } finally {
            setSmartstoreLoading(false);
        }
    };

    useEffect(() => {
        const cachedInventory = sessionStorage.getItem("coupang_inventory");
        const cachedSyncTime = sessionStorage.getItem("coupang_lastSyncTime");
        const cachedSmartstoreInventory = sessionStorage.getItem("smartstore_inventory");
        const cachedSmartstoreSyncTime = sessionStorage.getItem("smartstore_lastSyncTime");

        if (cachedInventory) {
            try {
                setInventory(JSON.parse(cachedInventory));
            } catch {
                console.error("Failed to parse cached inventory");
            }
        }
        if (cachedSyncTime) {
            setLastSyncTime(cachedSyncTime);
        }
        if (cachedSmartstoreInventory) {
            try {
                setSmartstoreInventory(JSON.parse(cachedSmartstoreInventory));
            } catch {
                console.error("Failed to parse cached smartstore inventory");
            }
        }
        if (cachedSmartstoreSyncTime) {
            setSmartstoreLastSyncTime(cachedSmartstoreSyncTime);
        }

        setLoading(false);
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
                body: JSON.stringify({ externalSkus }),
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
        } catch (err: unknown) {
            console.error(err);
            setError(toErrorMessage(err, "DB 동기화 중 오류가 발생했습니다."));
        } finally {
            setLoading(false);
        }
    };

    const sortedInventory = [...inventory].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue: string | number = "";
        let bValue: string | number = "";

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

    const sortedSmartstoreInventory = [...smartstoreInventory].sort((a, b) => {
        if (!smartstoreSortConfig) return 0;
        const { key, direction } = smartstoreSortConfig;
        let aValue: string | number = "";
        let bValue: string | number = "";

        if (key === "sellerManagementCode") {
            aValue = a.sellerManagementCode || "";
            bValue = b.sellerManagementCode || "";
        } else if (key === "channelProductNo") {
            aValue = a.channelProductNo || 0;
            bValue = b.channelProductNo || 0;
        } else if (key === "productName") {
            aValue = (a.dbProductName || a.productName || "").toLowerCase();
            bValue = (b.dbProductName || b.productName || "").toLowerCase();
        } else if (key === "stockQuantity") {
            aValue = a.stockQuantity || 0;
            bValue = b.stockQuantity || 0;
        } else if (key === "statusType") {
            aValue = a.statusType || "";
            bValue = b.statusType || "";
        }

        if (aValue < bValue) return direction === "asc" ? -1 : 1;
        if (aValue > bValue) return direction === "asc" ? 1 : -1;
        return 0;
    });

    const requestSort = (key: string, sortState: SortConfig, setSortState: (next: SortConfig) => void) => {
        let direction: SortDirection = "asc";
        if (sortState && sortState.key === key && sortState.direction === "asc") {
            direction = "desc";
        }
        setSortState({ key, direction });
    };

    const renderSortHeader = (
        title: string,
        key: string,
        sortState: SortConfig,
        setSortState: (next: SortConfig) => void,
        alignRight = false,
    ) => (
        <th
            className={`px-6 py-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors ${alignRight ? "text-right" : "text-left"}`}
            onClick={() => requestSort(key, sortState, setSortState)}
        >
            <div className={`flex items-center gap-1.5 ${alignRight ? "justify-end" : ""}`}>
                {title}
                <ArrowUpDown className={`w-3.5 h-3.5 ${sortState?.key === key ? "opacity-100 text-[#e34219]" : "opacity-30"}`} />
            </div>
        </th>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 mt-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Package className="w-7 h-7 text-[#e34219]" />
                        재고관리
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                        쿠팡 로켓창고 재고와 스마트스토어 재고를 함께 확인합니다.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={syncWithDB}
                        disabled={loading || inventory.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] text-sm font-bold text-gray-700 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-[#252525] transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        쿠팡 DB 연동 새로고침
                    </button>
                    <button
                        onClick={() => fetchInventory({ force: true })}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-[#e34219] text-white text-sm font-bold rounded-xl hover:bg-[#c93a15] transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        쿠팡서버 새로고침
                    </button>
                    <button
                        onClick={() => fetchSmartstoreInventory({ force: true })}
                        disabled={smartstoreLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0f766e] text-white text-sm font-bold rounded-xl hover:bg-[#0d655e] transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${smartstoreLoading ? "animate-spin" : ""}`} />
                        스마트스토어 새로고침
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-bold text-red-800">쿠팡 재고 정보를 불러오지 못했습니다</h3>
                        <p className="text-xs text-red-600 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {smartstoreError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-bold text-red-800">스마트스토어 재고 정보를 불러오지 못했습니다</h3>
                        <p className="text-xs text-red-600 mt-1">{smartstoreError}</p>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a] bg-gray-50/40 dark:bg-[#1a1a1a]">
                    <h2 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#e34219]" />
                        쿠팡 로켓창고 재고
                        {lastSyncTime && <span className="ml-2 font-bold text-[#e34219] text-xs">({lastSyncTime})</span>}
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-[#2a2a2a] select-none">
                                {renderSortHeader("SKU ID", "externalSkuId", sortConfig, setSortConfig)}
                                {renderSortHeader("옵션 ID", "vendorItemId", sortConfig, setSortConfig)}
                                {renderSortHeader("상품명", "productName", sortConfig, setSortConfig)}
                                {renderSortHeader("주문가능 재고", "stock", sortConfig, setSortConfig, true)}
                                {renderSortHeader("최근 30일 판매량", "sales", sortConfig, setSortConfig, true)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-[#2a2a2a]">
                            {loading && inventory.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-sm font-medium text-gray-400 dark:text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <RefreshCw className="w-6 h-6 animate-spin text-gray-300 dark:text-gray-500" />
                                            재고 정보를 불러오는 중입니다...
                                        </div>
                                    </td>
                                </tr>
                            ) : inventory.length === 0 && !error ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-sm font-medium text-gray-400 dark:text-gray-500">
                                        등록된 재고 데이터가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                sortedInventory.map((item, idx) => (
                                    <tr key={`${item.vendorItemId}-${idx}`} className="even:bg-gray-50/50 dark:even:bg-[#1a1a1a] hover:bg-gray-50/80 dark:hover:bg-[#252525] transition-colors">
                                        <td className="px-6 py-2">
                                            <div className="text-xs text-gray-700 dark:text-gray-400">{item.externalSkuId || "-"}</div>
                                        </td>
                                        <td className="px-6 py-2">
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{item.vendorItemId}</div>
                                        </td>
                                        <td className="px-6 py-2">
                                            <div className="flex items-center gap-3">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.productName} className="w-10 h-10 object-cover rounded-md flex-shrink-0 border border-gray-100 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e]" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-50 dark:bg-[#1a1a1a] rounded-md border border-gray-100 dark:border-[#2a2a2a] flex-shrink-0 flex items-center justify-center">
                                                        <Package className="w-4 h-4 text-gray-300 dark:text-gray-500" />
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-700 dark:text-gray-400 min-w-[300px] whitespace-normal leading-relaxed" title={item.productName}>
                                                    {item.productName || "알 수 없는 상품"}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2 text-right">
                                            <div className="inline-flex items-center justify-end gap-1.5 min-w-[3rem]">
                                                <span className={`text-xs ${item.inventoryDetails.totalOrderableQuantity > 10 ? "text-gray-700 dark:text-gray-400" : "text-red-500"}`}>
                                                    {item.inventoryDetails.totalOrderableQuantity.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500">개</span>
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

            <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none overflow-hidden mt-8">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a] bg-gray-50/40 dark:bg-[#1a1a1a]">
                    <h2 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <Store className="w-4 h-4 text-[#0f766e]" />
                        스마트스토어 재고
                        {smartstoreLastSyncTime && <span className="ml-2 font-bold text-[#0f766e] text-xs">({smartstoreLastSyncTime})</span>}
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-[#2a2a2a] select-none">
                                {renderSortHeader("판매자코드", "sellerManagementCode", smartstoreSortConfig, setSmartstoreSortConfig)}
                                {renderSortHeader("채널상품번호", "channelProductNo", smartstoreSortConfig, setSmartstoreSortConfig)}
                                {renderSortHeader("상품명", "productName", smartstoreSortConfig, setSmartstoreSortConfig)}
                                {renderSortHeader("재고수량", "stockQuantity", smartstoreSortConfig, setSmartstoreSortConfig, true)}
                                {renderSortHeader("판매상태", "statusType", smartstoreSortConfig, setSmartstoreSortConfig)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-[#2a2a2a]">
                            {smartstoreLoading && smartstoreInventory.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-sm font-medium text-gray-400 dark:text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <RefreshCw className="w-6 h-6 animate-spin text-gray-300 dark:text-gray-500" />
                                            스마트스토어 재고 정보를 불러오는 중입니다...
                                        </div>
                                    </td>
                                </tr>
                            ) : smartstoreInventory.length === 0 && !smartstoreError ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-sm font-medium text-gray-400 dark:text-gray-500">
                                        스마트스토어 재고 데이터가 없습니다. 상단 버튼으로 조회해주세요.
                                    </td>
                                </tr>
                            ) : (
                                sortedSmartstoreInventory.map((item, idx) => (
                                    <tr key={`${item.channelProductNo || "no"}-${item.sellerManagementCode}-${idx}`} className="even:bg-gray-50/50 dark:even:bg-[#1a1a1a] hover:bg-gray-50/80 dark:hover:bg-[#252525] transition-colors">
                                        <td className="px-6 py-2">
                                            <div className="text-xs text-gray-700 dark:text-gray-400">{item.sellerManagementCode || "-"}</div>
                                        </td>
                                        <td className="px-6 py-2">
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{item.channelProductNo ? item.channelProductNo.toLocaleString() : "-"}</div>
                                        </td>
                                        <td className="px-6 py-2">
                                            <div className="flex items-center gap-3">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.dbProductName || item.productName || "상품 이미지"} className="w-10 h-10 object-cover rounded-md flex-shrink-0 border border-gray-100 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e]" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-50 dark:bg-[#1a1a1a] rounded-md border border-gray-100 dark:border-[#2a2a2a] flex-shrink-0 flex items-center justify-center">
                                                        <Package className="w-4 h-4 text-gray-300 dark:text-gray-500" />
                                                    </div>
                                                )}
                                                <div className="min-w-[280px]">
                                                    <div className="text-xs text-gray-700 dark:text-gray-400 leading-relaxed">
                                                        {item.dbProductName || item.productName || "-"}
                                                    </div>
                                                    {item.dbProductName && item.productName && item.dbProductName !== item.productName && (
                                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{item.productName}</div>
                                                    )}
                                                    {item.dbProductCode && (
                                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{item.dbProductCode}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2 text-right">
                                            <div className="inline-flex items-center justify-end gap-1.5 min-w-[3rem]">
                                                <span className={`text-xs ${item.stockQuantity > 10 ? "text-gray-700 dark:text-gray-400" : "text-red-500"}`}>
                                                    {item.stockQuantity.toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500">개</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2">
                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-400">
                                                {item.statusType || "-"}
                                            </span>
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
