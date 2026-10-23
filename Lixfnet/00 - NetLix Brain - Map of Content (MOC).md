---
title: NetLix Brain - Map of Content (MOC)
aliases: [Home, MOC, Second Brain, NetLix Index]
tags: [moc, index, architecture, netlix, second-brain]
created: 2026-10-22
updated: 2026-10-22
version: 1.0.0
---

# 🧠 NetLix (Lixfnet) — Central Knowledge Base & Second Brain

> [!NOTE]
> Chào mừng bạn đến với **NetLix Second Brain** — hệ thống tài liệu hóa toàn diện về kiến trúc, nghiệp vụ, mã nguồn, components, logic xử lý, hệ thống APIs và các giải pháp khắc phục lỗi của nền tảng xem phim trực tuyến **NetLix** (Lixfnet).

---

## 🗺️ Bản Đồ Kiến Thức (Map of Content)

```mermaid
mindmap
  root((NetLix Brain))
    Nghiep Vu & Kien Truc
      [[01.1 - Kien Truc He Thong & Tong Quan Du An]]
      [[01.2 - Quy Trinh Nghiep Vu Xem Phim & Luong Du Lieu]]
      [[01.3 - He Thong De Xuat & Ca Nhan Hoa (Taste Profile)]]
      [[01.4 - Xac Thuc Nguoi Dung & Phan Quyen (Auth & Session)]]
    APIs & Ket Noi
      [[02.1 - API NguonC (Danh Sach, Chi Tiet & Tap Phim)]]
      [[02.2 - API TMDB (Title Logo & YouTube Trailer)]]
      [[02.3 - API Routes Noi Bo Next.js]]
      [[02.4 - Firebase Realtime Database & Schema]]
    Components & UI
      [[03.1 - Components Architecture & Hierarchy]]
      [[03.2 - HeroBanner Component]]
      [[03.3 - HoverPopoutCard Component]]
      [[03.4 - VideoPlayerModal Component]]
      [[03.5 - MovieModal Component]]
      [[03.6 - MovieRow & Cards Components]]
      [[03.7 - Navbar & Search Components]]
      [[03.8 - Auth & Account Management Components]]
    Logic & State
      [[04.1 - NetflixContext (State Toan Cuc)]]
      [[04.2 - movieApi Service (Logic Xu Ly Du Lieu)]]
      [[04.3 - logoService (Logic Xu Ly TMDB Logo)]]
      [[04.4 - recommendationEngine (Thuat Toan De Xuat)]]
      [[04.5 - firebaseAdmin Library (Quan Ly Database)]]
    Thu Vien & Deploy
      [[05.1 - Danh Sach Thu Vien & Dependencies]]
      [[05.2 - Huong Dan Cau Hinh & Trien Khai (Vercel & Local)]]
    Troubleshooting
      [[06.1 - Bang Tong Hop Loi & Cach Khac Phuc]]
    Mo Rong Nen Tang
      [[07.1 - Dinh Huong Phat Trien Mobile & Samsung Smart TV (Tizen)]]
      [[07.2 - Giai Phap Proxy Streaming Cho Nguoi Dung Nuoc Ngoai]]
```

---

## 📂 Danh Mục Tài Liệu Chi Tiết

### 1. [[01.1 - Kien Truc He Thong & Tong Quan Du An|01. Nghiệp Vụ & Kiến Trúc Cốt Lõi]]
- **[[01.1 - Kien Truc He Thong & Tong Quan Du An]]**: Tổng quan dự án, cấu trúc thư mục, tech stack (Next.js 16 App Router, React 19, Tailwind CSS v4, Firebase Realtime Database).
- **[[01.2 - Quy Trinh Nghiep Vu Xem Phim & Luong Du Lieu]]**: Luồng người dùng từ trang chủ, duyệt phim, xem trước (trailer popout), phát phim (streaming player), lưu tiến trình và danh sách yêu thích.
- **[[01.3 - He Thong De Xuat & Ca Nhan Hoa (Taste Profile)]]**: Thuật toán phân tích gu người dùng theo thể loại, quốc gia, diễn viên và trọng số thời gian (recency weight).
- **[[01.4 - Xac Thuc Nguoi Dung & Phan Quyen (Auth & Session)]]**: Cơ chế bảo vệ toàn trang bằng `middleware.ts`, mã hóa mật khẩu `bcryptjs`, cookie phiên `lixfnet_session` (30 ngày), phân quyền Admin / Member.

---

### 2. [[02.1 - API NguonC (Danh Sach, Chi Tiet & Tap Phim)|02. Hệ Thống APIs & Tích Hợp Dịch Vụ]]
- **[[02.1 - API NguonC (Danh Sach, Chi Tiet & Tap Phim)]]**: Nguồn phim chính (phim mới cập nhật, phim bộ, phim lẻ, hoạt hình, tv shows, tìm kiếm và luồng phát stream iframe).
- **[[02.2 - API TMDB (Title Logo & YouTube Trailer)]]**: Tích hợp TMDB API để lấy trailer YouTube và Title Logo (ClearLogo nghệ thuật dạng SVG/PNG chất lượng cao).
- **[[02.3 - API Routes Noi Bo Next.js]]**: Tập hợp các endpoints nội bộ (`/api/logo`, `/api/trailer`, `/api/netflix-top10`, `/api/auth/*`, `/api/user/progress`, `/api/user/mylist`).
- **[[02.4 - Firebase Realtime Database & Schema]]**: Cấu trúc dữ liệu `lixfnet/users`, lưu tài khoản và tiến trình xem theo thời gian thực.

---

### 3. [[03.1 - Components Architecture & Hierarchy|03. Components & Giao Diện UI/UX]]
- **[[03.1 - Components Architecture & Hierarchy]]**: Cây phân cấp component và sơ đồ truyền props/state.
- **[[03.2 - HeroBanner Component]]**: Banner chính đầu trang, trailer tự động chạy, hiệu ứng chuyển đổi mượt mà giữa text title và Title Logo.
- **[[03.3 - HoverPopoutCard Component]]**: Card hover xem nhanh phong cách Netflix, tính toán vị trí tọa độ động, phát video trailer preview có âm thanh.
- **[[03.4 - VideoPlayerModal Component]]**: Trình phát video chuyên nghiệp, tự động ẩn thanh điều khiển sau 3.5s, nhận diện chạm màn hình trên mobile, nút xoay màn hình và bộ chọn tập phim.
- **[[03.5 - MovieModal Component]]**: Modal thông tin chi tiết phim, danh sách mùa / tập, phim tương tự, thông tin diễn viên / đạo diễn.
- **[[03.6 - MovieRow & Cards Components]]**: Các hàng phim trượt ngang mượt mà, `ContinueWatchingCard`, `Top10Card` (Thẻ dọc 2:3 với chữ số 3D nghệ thuật và logo nền tảng), `MovieCard` (Thẻ ngang 16:9 đồng bộ).
- **[[03.7 - Navbar & Search Components]]**: Thanh điều hướng glassmorphism, tìm kiếm live debounced, menu tài khoản.
- **[[03.8 - Auth & Account Management Components]]**: Modal tạo và quản lý tài khoản người dùng của quản trị viên.

---

### 4. [[04.1 - NetflixContext (State Toan Cuc)|04. Logic & State Management]]
- **[[04.1 - NetflixContext (State Toan Cuc)]]**: Trái tim state của ứng dụng: quản lý modal, video đang phát, tiến trình xem phim, danh sách cá nhân, âm thanh toàn cục.
- **[[04.2 - movieApi Service (Logic Xu Ly Du Lieu)]]**: Module chuẩn hóa dữ liệu từ API NguonC, phân tích thời lượng, gắn nhãn, phân loại quốc gia và thể loại.
- **[[04.3 - logoService (Logic Xu Ly TMDB Logo)]]**: Module tìm kiếm và lựa chọn Title Logo tối ưu theo ngôn ngữ (vi > en > neutral > any) kèm thuật toán **Anti-Black Logo Luminance Analysis** giải nén PNG trên RAM bằng `zlib`.
- **[[04.4 - recommendationEngine (Thuat Toan De Xuat)]]**: Logic tính toán điểm phù hợp và sắp xếp lại các hàng phim dựa trên lịch sử xem của từng người dùng.
- **[[04.5 - firebaseAdmin Library (Quan Ly Database)]]**: Thư viện khởi tạo Firebase Admin SDK với cơ chế 3 tầng fallback, làm sạch payload và thao tác CRUD an toàn.

---

### 5. [[05.1 - Danh Sach Thu Vien & Dependencies|05. Thư Viện & Triển Khai]]
- **[[05.1 - Danh Sach Thu Vien & Dependencies]]**: Chi tiết các thư viện (Next.js 16, React 19, Lucide React, Tailwind CSS v4, Bcryptjs, Firebase Admin).
- **[[05.2 - Huong Dan Cau Hinh & Trien Khai (Vercel & Local)]]**: Hướng dẫn biến môi trường (`.env.local`), cấu hình Vercel, xử lý private key Firebase.

---

### 6. [[06.1 - Bang Tong Hop Loi & Cach Khac Phuc|06. Bảng Tổng Hợp Lỗi & Cách Khắc Phục (Troubleshooting)]]
- Tổng hợp các vấn đề hóc búa nhất và giải pháp triệt để:
  1. *Lỗi iframe nuốt sự kiện chạm trên mobile và cách giải quyết bằng Top Gesture Zone + Window Blur Listener*.
  2. *Lỗi giật layout (layout shift) khi tải Title Logo TMDB và giải pháp CSS Grid Stacking*.
  3. *Lỗi Next.js Hydration & SSR Mismatch với LocalStorage*.
  4. *Lỗi Firebase Service Account Key trên môi trường Cloud / Vercel*.
  5. *Lỗi Screen Orientation Lock trên trình duyệt di động*.
  6. *Lỗi Title Logo TMDB màu đen bị hòa lẫn vào nền tối (giải pháp đo độ sáng PNG Luminance + CSS Rim Glow)*.
  7. *Lỗi khuyết vị trí #5, #6, #9 trong Top 10 Series Netflix VN do bộ lọc filterNoChina*.
  8. *Lỗi mismatch dữ liệu phim Top 10 do trùng tên tiếng Anh và hậu tố mùa Tudum*.
  9. *Lỗi chậm tải trang do quá tải request đa nền tảng và giải pháp tinh gọn tối ưu*.

---

### 7. [[07.1 - Dinh Huong Phat Trien Mobile & Samsung Smart TV (Tizen)|07. Định Hướng Phát Triển Mobile & Samsung Smart TV]]
- **[[07.1 - Dinh Huong Phat Trien Mobile & Samsung Smart TV (Tizen)]]**: Kế hoạch mở rộng hệ sinh thái đa nền tảng, giải pháp điều hướng Remote D-Pad (Spatial Navigation), mã phím Tizen OS, xử lý luồng stream HLS `.m3u8`, cử chỉ vuốt chạm Mobile và cơ chế đăng nhập bằng mã PIN/QR trên TV.

---

## ⚡ Bảng Tra Cứu Nhanh (Quick Reference)

| Danh Mục | Tệp Nguồn Trọng Tâm | Tệp Ghi Chú Obsidian Tương Ứng |
| :--- | :--- | :--- |
| **State Toàn Cục** | `context/NetflixContext.tsx` | [[04.1 - NetflixContext (State Toan Cuc)]] |
| **Trình Phát Video** | `components/player/VideoPlayerModal.tsx` | [[03.4 - VideoPlayerModal Component]] |
| **Title Logo TMDB** | `services/logoService.ts`, `/api/logo` | [[04.3 - logoService (Logic Xu Ly TMDB Logo)]] |
| **Bảng Xếp Hạng Top 10** | `app/api/netflix-top10/route.ts`, `components/cards/Top10Card.tsx` | [[02.3 - API Routes Noi Bo Next.js]], [[03.6 - MovieRow & Cards Components]] |
| **API Phim NguonC** | `services/movieApi.ts` | [[02.1 - API NguonC (Danh Sach, Chi Tiet & Tap Phim)]] |
| **Bảo Vệ & Phiên** | `middleware.ts`, `lib/firebaseAdmin.ts` | [[01.4 - Xac Thuc Nguoi Dung & Phan Quyen (Auth & Session)]] |
| **Gợi Ý Phim** | `services/recommendationEngine.ts` | [[01.3 - He Thong De Xuat & Ca Nhan Hoa (Taste Profile)]] |
| **Card Hover** | `components/cards/HoverPopoutCard.tsx` | [[03.3 - HoverPopoutCard Component]] |
| **Khắc Phục Sự Cố** | `Lixfnet/06.1...` | [[06.1 - Bang Tong Hop Loi & Cach Khac Phuc]] |
| **Roadmap Mobile & TV**| `Lixfnet/07.1...` | [[07.1 - Dinh Huong Phat Trien Mobile & Samsung Smart TV (Tizen)]] |

---
*Tài liệu được biên soạn tự động và đồng bộ trực tiếp với mã nguồn NetLix.*

