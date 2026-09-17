# MisakiSharp WASM example

Example tối giản sử dụng package `misakisharp-wasm` từ project cha. Runtime chạy trong Web Worker và dữ liệu ngôn ngữ chỉ được tải từ GitHub Release khi sử dụng lần đầu.

```sh
npm install
npm start
```

Mở [http://localhost:4173](http://localhost:4173).

Project không dùng framework hoặc dependency cho web server. `server.mjs` chỉ phục vụ trang example và ánh xạ package đã cài vào `/vendor/misakisharp/` với đúng MIME type cho WebAssembly.
