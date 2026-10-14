# IWMS: Inventory & Warehouse Management System

Next.js 14 (React + API Routes) + PostgreSQL. Chạy được trên Vercel, bám theo báo cáo Software Engineering của nhóm.

## Đã có gì

| Nhóm | Nội dung | Yêu cầu trong báo cáo |
|---|---|---|
| Đăng nhập, phân quyền | JWT trong cookie httpOnly, bcrypt, 4 vai trò (admin, manager, staff, purchasing), kiểm tra quyền ở backend, giới hạn 8 lần đăng nhập/phút | FR-01, FR-02, NFR-03 |
| Danh mục | Sản phẩm (SKU duy nhất, tìm kiếm, vô hiệu hóa), danh mục, kho, nhà cung cấp | FR-03, FR-04, FR-15, BR-01, BR-07 |
| Đơn mua hàng | Draft → Submitted → Approved → Partially Received → Received, hủy đơn, chặn nhận vượt số lượng đặt | FR-05, BR-08 |
| Nhập kho | Nhập theo PO hoặc nhập trực tiếp, một transaction DB | FR-06, FR-07, NFR-04 |
| Xuất kho | Từ chối nếu thiếu hàng, UPDATE có điều kiện nên an toàn khi nhiều người cùng xuất | FR-08, BR-03, TC-12 |
| Chuyển kho | Kho nguồn ≠ kho đích, trừ và cộng trong cùng transaction | FR-09, BR-04 |
| Kiểm kê, điều chỉnh | Nhập số đếm thực tế, bắt buộc có lý do | FR-10, BR-06 |
| Báo cáo | Tồn kho theo kho, cảnh báo dưới mức đặt hàng lại, lịch sử nhập xuất có lọc (ngày, kho, sản phẩm, loại) | FR-11, FR-12, FR-13 |
| Sổ cái | Mọi thay đổi tồn kho đều ghi `stock_movements` (append-only) kèm người thực hiện, thời gian | FR-14, BR-05, NFR-09 |

Chưa làm (có thể thêm sau): quản lý người dùng bằng giao diện, xuất báo cáo CSV, phân trang, kiểm thử tự động.

## Deploy lên Vercel (khoảng 10 phút)

1. **Đẩy code lên GitHub** (repo của nhóm): giải nén thư mục này, `git add . && git commit && git push`.
2. **Tạo database**: vào [neon.tech](https://neon.tech) (miễn phí) tạo project Postgres, copy *connection string* (dạng `postgres://...?sslmode=require`). Hoặc trong Vercel: *Storage → Create → Neon* (biến `DATABASE_URL` hoặc `POSTGRES_URL` sẽ tự được thêm).
3. **Import repo vào Vercel** (vercel.com → Add New → Project). Framework tự nhận là Next.js.
4. Trong *Settings → Environment Variables* thêm:
   - `DATABASE_URL`: chuỗi kết nối ở bước 2 (bỏ qua nếu Vercel đã tự thêm `POSTGRES_URL`)
   - `JWT_SECRET`: chuỗi ngẫu nhiên dài ≥ 32 ký tự
   - `SETUP_TOKEN`: một mã bí mật bất kỳ
5. **Deploy** (hoặc Redeploy nếu vừa thêm biến).
6. Mở **một lần** `https://<tên-app>.vercel.app/api/setup?token=<SETUP_TOKEN>` → tạo bảng và dữ liệu mẫu. Thấy `{"schema":"ready","seeded":true,...}` là xong.
7. Vào trang chủ và đăng nhập (mật khẩu `Password123!`):

| Vai trò | Email |
|---|---|
| Admin | admin@iwms.test |
| Manager | manager@iwms.test |
| Warehouse staff | staff@iwms.test |
| Purchasing | purchasing@iwms.test |

> Đổi mật khẩu mẫu hoặc xóa tài khoản demo trước khi dùng thật. Sau khi setup xong, nên xóa biến `SETUP_TOKEN` (endpoint sẽ tự khóa).

## Chạy local

```bash
cp .env.example .env.local    # điền DATABASE_URL, JWT_SECRET, SETUP_TOKEN
npm install
npm run dev
# mở http://localhost:3000/api/setup?token=<SETUP_TOKEN> một lần, rồi vào http://localhost:3000
```

## Kịch bản demo / kiểm thử thủ công (map với TC trong báo cáo)

- **TC-01/02**: đăng nhập `staff`, thử mở Products → không có form thêm; gọi `POST /api/products` bị 403.
- **TC-03**: đăng nhập `admin`, thêm sản phẩm với SKU `LAP-001` → báo trùng SKU.
- **TC-04**: `staff` → Inventory operations → Receive 10 cái → xem Stock levels tăng 10, Movement history (đăng nhập manager) có 1 dòng.
- **TC-06**: Issue số lượng lớn hơn tồn → báo `Insufficient stock. Available: n`, tồn không đổi.
- **TC-07**: Transfer 4 cái từ Main sang Branch.
- **TC-08**: `manager` → Stocktake bỏ trống lý do → bị từ chối.
- **TC-09**: sản phẩm `PEN-100` (tồn 12 < mức đặt lại 20) xuất hiện ở Dashboard.
- **TC-11**: admin vô hiệu hóa sản phẩm, rồi thử nhập kho → bị từ chối.
- Luồng PO: `purchasing` tạo và Submit → `manager` Approve → `staff` Receive chọn PO đó.

Hãy tự chạy và ghi kết quả thực tế vào cột *Actual* của báo cáo. Đừng điền Pass khi chưa chạy.

## Cấu trúc

```
app/page.js              Giao diện (React, một trang, đổi view theo menu)
app/api/**/route.js      REST API (khớp mục 3.8 báo cáo)
lib/inventory.js         Nghiệp vụ nhập/xuất/chuyển/điều chỉnh (transaction + sổ cái)
lib/schema.js            Schema SQL + dữ liệu mẫu (/api/setup)
lib/api.js, auth.js      Middleware xác thực, phân quyền, xử lý lỗi
```
