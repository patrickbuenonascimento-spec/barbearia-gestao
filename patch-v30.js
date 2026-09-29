/* v30 -> v32 loader: carrega Gestão fiel à planilha e Recuperar Clientes no menu lateral */
(function(){
  if (window.__gestaoV32Loader) return;
  window.__gestaoV32Loader = true;
  var s = document.createElement('script');
  s.src = '/patch-v32.js?v=32';
  s.defer = true;
  document.head.appendChild(s);
})();