/* v30 -> v31 loader: carrega a Gestão completa com datas, gráficos e Atendimentos */
(function(){
  if (window.__gestaoV31Loader) return;
  window.__gestaoV31Loader = true;
  var s = document.createElement('script');
  s.src = '/patch-v31.js?v=31';
  s.defer = true;
  document.head.appendChild(s);
})();
