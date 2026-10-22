/* Reemplaza las ventanitas grises del navegador (alert) por avisos con el diseño de la plataforma.
   Elige el ícono según el texto: error, advertencia, éxito o información. */
(function () {
  const alertOriginal = window.alert.bind(window);
  window.alert = function (mensaje) {
    if (typeof Swal === 'undefined') return alertOriginal(mensaje);
    let texto = String(mensaje ?? '');
    let icon = 'info';
    if (/^\s*✅/.test(texto) || /(con éxito|correctamente|guardad[ao]|actualizad[ao]|enviada)/i.test(texto)) icon = 'success';
    if (/^\s*(⚠️|🔒)/.test(texto) || /(por favor|no es válido|obligatorio|no podés|no hay|vacío)/i.test(texto)) icon = 'warning';
    if (/^\s*error|no se pudo|falló|ocurrió un error|incorrect/i.test(texto)) icon = 'error';
    texto = texto.replace(/^\s*(✅|⚠️|🔒|📁)\s*/, '');
    Swal.fire({ icon, text: texto, confirmButtonText: 'Aceptar' });
  };
})();
