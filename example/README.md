# MisakiSharp WASM example

Example tối giản sử dụng package `misakisharp-wasm` từ project cha. Runtime chạy trong Web Worker, dữ liệu ngôn ngữ chỉ được tải từ browser mirror của GitHub Release khi sử dụng lần đầu và tiến trình tải được hiển thị theo byte/file.

```sh
npm install
npm start
```

Mở [http://localhost:4173](http://localhost:4173).

Project không dùng framework hoặc dependency cho web server. `server.mjs` chỉ phục vụ trang example và ánh xạ package đã cài vào `/vendor/misakisharp/` với đúng MIME type cho WebAssembly.
