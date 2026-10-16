/* Tương thích các trang cũ: bộ nạp bố cục chung đã chuyển về /main.js. */
(function () {
  const url = new URL('../main.js', document.currentScript.src);
  window.layoutReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url.href;
    script.onload = () => Promise.resolve(window.layoutReady).then(resolve, reject);
    script.onerror = () => reject(new Error('Không tải được bố cục chung.'));
    document.head.appendChild(script);
  });
})();
