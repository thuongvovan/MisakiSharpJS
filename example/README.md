# MisakiSharp WASM example

Example tối giản sử dụng package `misakisharp-wasm` từ project cha. Runtime chạy trong Web Worker, preload `en-us` ngay khi khởi tạo và chủ động tải ngôn ngữ khác khi người dùng đổi lựa chọn. `phonemize` chỉ chạy sau khi data đã sẵn sàng; tiến trình tải được hiển thị theo byte/file.

```sh
npm install
npm start
```

Mở [http://localhost:4173](http://localhost:4173).

Project không dùng framework hoặc dependency cho web server. `server.mjs` chỉ phục vụ trang example và ánh xạ package đã cài vào `/vendor/misakisharp/` với đúng MIME type cho WebAssembly.
