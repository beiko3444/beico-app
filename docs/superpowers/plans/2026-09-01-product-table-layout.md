# Product Table Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 상품관리 시안대로 상단 분류, 영구 상품번호, 그룹순서, 표시 열 설정을 구현한다.

**Architecture:** Product에 자동 증가 상품번호를 추가하고 서버 조회 응답에 포함한다. 열 정의와 저장값 정규화는 `lib/productTableColumns.ts`로 분리하며, `ProductTable.tsx`는 해당 정의를 사용해 동적으로 헤더와 셀을 렌더링한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma/PostgreSQL, Tailwind CSS, Node test runner

---

### Task 1: 열 설정과 상품번호 데이터 계약

**Files:**
- Create: `lib/productTableColumns.ts`
- Modify: `prisma/schema.prisma`
- Modify: `app/admin/products/page.tsx`
- Modify: `app/admin/products/product-form.tsx`
- Modify: `app/api/products/route.ts`
- Modify: `app/api/products/[id]/route.ts`
- Test: `tests/product-table-layout.test.mjs`

- [ ] 열 기본값과 저장값 정규화 테스트를 작성하고 실패를 확인한다.
- [ ] Product에 `productNumber Int @unique @default(autoincrement())`를 추가한다.
- [ ] 상품 조회와 타입에 productNumber를 연결한다.
- [ ] 열 설정 도우미를 구현하고 테스트 통과를 확인한다.

### Task 2: 승인된 상품관리 UI 구현

**Files:**
- Modify: `app/admin/products/page.tsx`
- Modify: `app/admin/products/ProductTable.tsx`

- [ ] 최상단 헤더 안으로 분류 메뉴와 수량 배지를 이동한다.
- [ ] 표 고정 열을 상품번호, 그룹순서, 이미지, 상품명 순서로 렌더링한다.
- [ ] 표시 열 설정 메뉴와 localStorage 저장을 구현한다.
- [ ] 그룹순서 편집이 같은 그룹 안에서만 동작하도록 변경한다.
- [ ] 기본 표를 바코드, 재고, 매입가, 판매가 중심으로 단순화한다.

### Task 3: 검증과 배포

**Files:**
- Modify: `tests/product-table-layout.test.mjs`

- [ ] Node 테스트, ESLint, TypeScript/Next 빌드를 실행한다.
- [ ] 데스크톱과 모바일 브라우저에서 헤더, 열 설정, 그룹순서를 확인한다.
- [ ] 변경사항을 커밋하고 main 브랜치에 푸시한다.

